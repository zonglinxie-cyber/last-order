import { recentlyPurchased } from "../src/world/purchases.ts";
// 人情场有限信息模拟：只读界面看得见的东西做接待决策，量"看了、问了、试了"到底值多少钱。
// 跑法：node --experimental-strip-types tests/consult-sim.ts [种子数，默认 20] [季数，默认 1]
//
// 这一份不抽剧情卡、不接委托、不加自选加难：只跑楼层进出 → 接待 → 开单 → 时段末抢客这条销售循环。
// 每一位被接待的客人同时算两笔影子账（不改变世界）：
//   ① 标签猜法：只用她主动说出的需求 + 货架 tag / 价格，问 1 件，不看、不问、不试；
//   ② 全知天花板：知道她的完整诉求与上限，选能开出的最大一单（只用于测量，不参与决策）。
// 盲策能读的：openConsult 的 known / lines、试穿反应、SHELF 的 tag / note / 价、预算、
// 件数问答、自己问过与试过的记录。不能读：fitOfPerson、bestFit、隐藏诉求、maxUnits（除非已问出）。
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ambient, beginServe, beginSlot, doVerb, endDay, leaveServe, newWorld,
  nextSeason, qualityOf, rivalTargets, rivalGuarded, SERVE_REFUSE_OPINION, settleServe, verbOptions,
  VERB_ENERGY,
  inviteRivalGuest, prepareWeekendOrder,
} from "../src/world/engine.ts";
import {
  askHer, lookAt, openConsult, PUSH_QUESTION, questionsOf, rememberConsult, spotsOf, tryOn,
  UNITS_QUESTION, type Consult,
} from "../src/world/consult.ts";
import {
  PERFECT_MATCH, SHELF, SHELF_IDS, TAG_WORD, fitOfPerson, shelfFitTier, shelfUnits,
  type FitTier, type ShelfId,
} from "../src/world/shelf.ts";
import { isSunday, weekNoOf } from "../src/world/weeks.ts";
import {
  ROUTE_WORD, WEEK_TARGETS, routeFromCode, weekCareCountKey, weekCareDaysOf, weekCareKey,
  weekMadeKey, weekRivalKey, weekRouteKey, weekStarsKey, type WeekRoute,
} from "../src/world/target.ts";
import { visitPerson } from "../src/world/visits.ts";
import { rivalBookingNow, RIVAL_INVITE_ENERGY } from "../src/world/rival-business.ts";
import { WEEKEND_PREP_ENERGY } from "../src/world/weekend-orders.ts";
import type { Festival, Person, PersonId, Trait, World } from "../src/world/types.ts";
import { FIXTURE_PEOPLE } from "./fixtures/world-fixture.ts";

const DAYS = 28;
const N = Math.max(1, Number(process.argv[2]) || 20);
const SEASONS = Math.max(1, Number(process.argv[3]) || 1);
// 可选第四参数 compete：只按公开预约邀来比货，接待仍用同一套有限信息策略。
const COMPETE_BOOKINGS = process.argv[4] === "compete";

const yuan = (n: number) => `¥${Math.round(n).toLocaleString("zh-CN")}`;
const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—";
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
/** 最近秩分位数：给调目标线用，不插值，读数就是某个种子真打出来的数。 */
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * q))];
};

// —— 盲策能读的公开信息 ——

/** 货架 tag 上那两三个词，是玩家一眼能看见的全部功能信息。 */
const tagTraits = (id: ShelfId): Set<Trait> => {
  const out = new Set<Trait>();
  for (const word of SHELF[id].tag.split("·")) {
    const t = TAG_WORD[word];
    if (t) out.add(t);
  }
  return out;
};

/** 只看脸/身上那几处：名字越像真在观察，越先看。不读 spotsOf 里的 reveals。 */
const SPOT_ORDER = ["眼下", "气色", "脸颊", "下巴", "T 区", "鼻翼", "皮肤", "细节", "神情", "信息", "表达", "眼神", "手机", "手上", "发际线", "唇周"];
const spotRank = (label: string) => {
  const i = SPOT_ORDER.findIndex(w => label.startsWith(w));
  return i < 0 ? 99 : i;
};
/** 界面上的部位名本来就是公开线索；手写客人换了说法时，看她脸上那段描述。 */
const SPOT_LABEL_TRAIT: Record<string, Trait> = {
  眼下: "natural", 气色: "correct", 脸颊: "soothe", 下巴: "steady", "T 区": "wear",
};
const SPOT_FINDING_HINTS: Array<[Trait, RegExp]> = [
  ["natural", /卡纹|叠厚|粉感|面具|看不出化妆/],
  ["correct", /气色|发暗|照镜子|当天|遮瑕/],
  ["soothe", /干|红|脱皮|敏感|刺激/],
  ["steady", /闭口|闷|痘|过敏|闹脸|出油|微油/],
  ["wear", /斑驳|补过|撑一整天|持妆|一天/],
];
/** 生成的客人用部位名就对得上；手写客人的部位名是通用词，得看她脸上那段描述。 */
const spotTraitOf = (s: { label: string; finding: string; at?: unknown }): Trait | undefined => {
  const fromFinding = SPOT_FINDING_HINTS.find(([, re]) => re.test(s.finding))?.[0];
  return s.at ? fromFinding : SPOT_LABEL_TRAIT[s.label] ?? fromFinding;
};

/** 只看能问出「还不知道」的那一处；问不出新诉求的部位不去花耐心。
 *  今天的重点还没摸清时，先看一处非空白的部位 —— 不读它到底露哪条，只读界面上的部位名与描述。 */
function pickSpot(person: Person, c: Consult) {
  const left = spotsOf(person).filter(s => !c.looked.includes(s.key));
  if (!c.focusKnown && c.focus) {
    const possible = left.filter(s => spotTraitOf(s) !== undefined);
    if (possible.length) return [...possible].sort((a, b) => spotRank(a.label) - spotRank(b.label))[0];
  }
  const unknown = left.filter(s => {
    const trait = spotTraitOf(s);
    return !!trait && !c.known.includes(trait);
  });
  if (!unknown.length) return null;
  return [...unknown].sort((a, b) => spotRank(a.label) - spotRank(b.label))[0];
}

/** 问句标签里的关键词 → 那条诉求。只读 label，不读 questionsOf 的 trait / kind / key。 */
const ASK_HINTS: Array<[Trait, RegExp]> = [
  ["soothe", /干|红|敏感|刺激|修护|香精/],
  ["steady", /闷|痘|过敏|闹脸|认生|香/],
  ["wear", /持妆|撑|斑驳|补妆|一天|下午|八小时/],
  ["correct", /见效|效果|气色|精神|照镜子|变化|遮瑕|改善|场合|面试/],
  ["natural", /镜头|粉感|厚|面具|换了一层皮|看出|妆重|假|自然/],
];
const ASK_SKIP = /预算|套装|整套|小样/;
const hintOf = (label: string): Trait | undefined =>
  ASK_HINTS.find(([, re]) => re.test(label))?.[0];

/** 从问句里挑一句：还没问过、又能指向未知诉求的问句先问；已知诉求的问句不再花耐心。
 *  今天的重点还没摸清时，允许问一句标签已经对上的话 —— 它可能就是今天的重点。
 *  问句池里本来就混着一条她不在意的陪跑项，没有公开线索能把它提前认出来。 */
function pickQuestion(person: Person, c: Consult) {
  const options = questionsOf(person).filter(q =>
    q.label !== UNITS_QUESTION && q.label !== PUSH_QUESTION && !ASK_SKIP.test(q.label)
    && !c.asked.includes(q.key));
  const mapped = options.filter(q => {
    const trait = hintOf(q.label);
    return !!trait && (!c.known.includes(trait) || !c.focusKnown);
  });
  if (mapped.length) return mapped[0]!;
  // 手写客人的问句未必带那五个关键词；没有可映射的新诉求时，留一句原话问法兜底。
  return options.find(q => !hintOf(q.label)) ?? null;
}

/** 公开信息下的候选排序。已知底线时只读它管哪条诉求，不读 below 那个阈值。
 *  今天的重点摸清以后，覆盖它的货往前排；它只是玩家听到的一句话，不是隐藏权重。 */
function rankProducts(live: Person, c: Consult): ShelfId[] {
  const budget = live.skin?.budget ?? 0;
  const veto = c.vetoKnown ? live.skin?.veto?.trait : undefined;
  const focus = c.focusKnown ? c.focus : null;
  return SHELF_IDS
    .filter(id => SHELF[id].price <= budget)
    .map(id => {
      const tags = tagTraits(id);
      const cover = c.known.filter(t => tags.has(t)).length;
      let score = cover * 100;
      if (c.known.length && cover === 0) score -= 40;
      if (veto && !tags.has(veto)) score -= 200;
      if (focus) score += tags.has(focus) ? 50 : -80;
      const tier = c.tried[id];
      if (tier === "positive") score += 1000;
      else if (tier === "mixed") score += 50;
      else if (tier === "negative") score -= 1000;
      score += tags.size;
      return { id, score, price: SHELF[id].price };
    })
    .sort((a, b) => b.score - a.score || a.price - b.price || SHELF_IDS.indexOf(a.id) - SHELF_IDS.indexOf(b.id))
    .map(x => x.id);
}

/** 这一单最后报哪支：试出点头就报它；只有犹豫就报犹豫的那支；试过全摇头就不卖。
 *  blind 只给"完全不咨询的影子猜"用：一次没试也照样按标签报。 */
function pickOffer(live: Person, c: Consult, blind = false): ShelfId | null {
  const ranked = rankProducts(live, c);
  if (!ranked.length) return null;
  const positive = ranked.find(id => c.tried[id] === "positive");
  if (positive) return positive;
  const mixed = ranked.find(id => c.tried[id] === "mixed");
  if (mixed) return mixed;
  return blind && !Object.keys(c.tried).length ? ranked[0] : null;
}

/** 件数：问出来过就用上限，没问就按界面默认的 1 件。 */
function unitsFor(live: Person, c: Consult, id: ShelfId): number {
  const affordable = Math.floor((live.skin?.budget ?? 0) / SHELF[id].price);
  if (affordable < 1) return 0;
  if (!c.unitsKnown) return 1;
  return Math.max(1, Math.min(live.skin?.maxUnits ?? 1, affordable));
}

// —— 测量用的隐藏信息：只在天花板与事后核对里出现，决策函数不调用 ——

type FitInfo = {
  score: number; tier: FitTier; units: number; amount: number;
  blocked: "opinion" | "bought" | null;
};
function fitInfo(w: World, person: Person, id: ShelfId, asked: number): FitInfo {
  const live = visitPerson(w, person);
  if (!live.skin) return { score: 0, tier: "negative", units: 0, amount: 0, blocked: null };
  if ((w.opinion[live.id] ?? 0) <= SERVE_REFUSE_OPINION)
    return { score: 0, tier: "negative", units: 0, amount: 0, blocked: "opinion" };
  if (recentlyPurchased(w, live.id))
    return { score: 0, tier: "negative", units: 0, amount: 0, blocked: "bought" };
  const score = fitOfPerson(live, id);
  const tier = shelfFitTier(score);
  const units = shelfUnits(live, id, tier, asked);
  return { score, tier, units, amount: units * SHELF[id].price, blocked: null };
}

function ceilingOf(w: World, person: Person): { amount: number; product: ShelfId | null; units: number } {
  const live = visitPerson(w, person);
  let best: { amount: number; product: ShelfId | null; units: number } = { amount: 0, product: null, units: 0 };
  if (!live.skin) return best;
  for (const id of SHELF_IDS) {
    const info = fitInfo(w, person, id, live.skin.maxUnits);
    if (info.amount > best.amount) best = { amount: info.amount, product: id, units: info.units };
  }
  return best;
}

// —— 一次接待 ——

type ActionStats = {
  look: number; blankLook: number; ask: number; shrug: number;
  try: number; tryPositive: number; tryMixed: number; tryNegative: number;
  unitsAsk: number; patience: number; startPatience: number;
};
const emptyActions = (): ActionStats => ({
  look: 0, blankLook: 0, ask: 0, shrug: 0,
  try: 0, tryPositive: 0, tryMixed: 0, tryNegative: 0, unitsAsk: 0, patience: 0,
  startPatience: 0,
});
const infoKey = (c: Consult) => `${[...c.known].sort().join(",")}|${c.focusKnown ? c.focus : "-"}|${c.unitsKnown}|${c.vetoKnown}|${c.mood}`;

/** 看 / 问 / 试的顺序：先确认件数；再看一处、问一句；剩下的耐心必须留给试。
 *  和柜台一致：看/问/试用当天来访的那位（熟客的诉求和预算会变），不拿原始人物硬套。 */
function runConsult(w: World, person: Person, stats: ActionStats): { world: World; consult: Consult } {
  const live = visitPerson(w, person);
  let c = openConsult(w, person);
  const start = c.patience;
  stats.startPatience = start;
  let cw = w;
  const apply = (next: Consult) => {
    c = next;
    cw = rememberConsult(cw, person, next);
  };
  const ask = (q: { key: string }) => {
    const before = infoKey(c);
    const next = askHer(c, live, q.key);
    if (next === c) return;
    apply(next); stats.ask++;
    if (infoKey(c) === before) stats.shrug++;
  };

  if (!c.unitsKnown) {
    const budget = live.skin?.budget ?? 0;
    const maxAffordable = Math.max(...SHELF_IDS.map(id => Math.floor(budget / SHELF[id].price)));
    // 只剩两句时不再问件数：问完就没手试了，宁可先按一件开。
    if (maxAffordable > 1 && c.patience > 2) {
      const q = questionsOf(live).find(x => x.label === UNITS_QUESTION);
      if (q) {
        const next = askHer(c, live, q.key);
        if (next !== c) { apply(next); stats.unitsAsk++; }
      }
    }
  }

  let looked = false;
  const doLook = () => {
    const spot = pickSpot(live, c);
    if (!spot) return false;
    const before = infoKey(c);
    const next = lookAt(c, live, spot.key);
    if (next === c) return false;
    apply(next); stats.look++;
    if (infoKey(c) === before) stats.blankLook++;
    return true;
  };
  if (c.patience > 1) looked = doLook();

  // 没有可看的部位（替别人买的那几位），把这一下换成问一句。
  if (!looked) {
    const q = pickQuestion(live, c);
    if (q) ask(q);
  }

  // 今天的重点还没摸清：再看一处。两处都看不对，才把剩下那一句留给问。
  if (looked && c.focus && !c.focusKnown && c.patience > 1) doLook();

  // 看了一处之后，还有余量再问一句；这一句可能是她的另一条诉求、今天的重点，也可能是那条陪跑项。
  if (looked && c.patience > 1) {
    const q = pickQuestion(live, c);
    if (q) ask(q);
  }

  while (c.patience > 0 && !c.matched) {
    const ranked = rankProducts(live, c);
    if (ranked.some(id => c.tried[id] === "positive")) break;
    const nextId = ranked.find(id => !c.tried[id]);
    if (!nextId) break;
    const next = tryOn(c, live, nextId);
    if (next === c) break;
    apply(next); stats.try++;
    const tier = c.tried[nextId];
    if (tier === "positive") stats.tryPositive++;
    else if (tier === "mixed") stats.tryMixed++;
    else stats.tryNegative++;
    if (tier === "positive") break;
  }

  stats.patience += start - c.patience;
  return { world: cw, consult: c };
}

type Outcome = "sold" | "declined" | "wrong" | "price" | "blocked" | "no-sale";

type Attempt = {
  seed: string; season: number; day: number; slot: number; person: PersonId;
  opinion: number;
  actual: number; actualUnits: number; product: ShelfId | null;
  freeGuess: number; freeProduct: ShelfId | null; freeUnits: number;
  oracle: number; oracleProduct: ShelfId | null; oracleUnits: number;
  freePerfect: boolean; actualPerfect: boolean; actualScore: number;
  outcome: Outcome; actions: ActionStats;
  freeKnown: number; paidKnown: number;
  freeUnitsKnown: boolean; paidUnitsKnown: boolean;
  freeVetoKnown: boolean; paidVetoKnown: boolean;
  hasFocus: boolean; focusKnownAtStart: boolean; focusKnownAtEnd: boolean;
  log?: string;
};

function attempt(w: World, people: Person[], person: Person, seed: string, season: number): { world: World; rec: Attempt } {
  const live = visitPerson(w, person);
  const free = openConsult(w, person);
  const freeProduct = pickOffer(live, free, true);
  const freeUnits = freeProduct ? unitsFor(live, free, freeProduct) : 0;
  const freeFit = freeProduct ? fitInfo(w, person, freeProduct, freeUnits) : null;
  const oracle = ceilingOf(w, person);
  const base = {
    seed, season, day: w.day, slot: w.slot, person: person.id,
    opinion: w.opinion[person.id] ?? 0,
    freeGuess: freeFit?.amount ?? 0, freeProduct, freeUnits,
    oracle: oracle.amount, oracleProduct: oracle.product, oracleUnits: oracle.units,
    freePerfect: !!freeFit && freeFit.amount > 0 && freeFit.score >= PERFECT_MATCH,
    freeKnown: free.known.length, freeUnitsKnown: free.unitsKnown, freeVetoKnown: free.vetoKnown,
    hasFocus: free.focus !== null, focusKnownAtStart: free.focusKnown,
  };

  let cw = beginServe(w, people, person.id);
  if (cw === w) {
    return { world: w, rec: { ...base, actual: 0, actualUnits: 0, product: null, actualPerfect: false,
      actualScore: 0, outcome: "blocked", actions: emptyActions(), paidKnown: free.known.length,
      paidUnitsKnown: free.unitsKnown, paidVetoKnown: free.vetoKnown, focusKnownAtEnd: free.focusKnown, log: "没能接手" } };
  }

  const stats = emptyActions();
  const run = runConsult(cw, person, stats);
  cw = run.world;
  const c = run.consult;
  const liveAfter = visitPerson(cw, person);
  const product = pickOffer(liveAfter, c);
  const units = product ? unitsFor(liveAfter, c, product) : 0;
  let after = cw;
  let outcome: Outcome = product ? "sold" : Object.keys(c.tried).length ? "declined" : "no-sale";
  if (product && units > 0) {
    const expected = fitInfo(cw, person, product, units);
    const next = settleServe(cw, people, person.id, product, units, false, c.mood);
    if (next !== cw) after = next;
    outcome = expected.blocked ? "blocked" : expected.tier === "negative" ? "wrong"
      : expected.units === 0 ? "price" : "sold";
  } else {
    const next = leaveServe(cw, people, person.id, c.mood);
    if (next !== cw) after = next;
  }
  const actual = after.money - cw.money;
  const actualUnits = product ? Math.round(actual / SHELF[product].price) : 0;
  const actualFit = product ? fitInfo(cw, person, product, units) : null;
  if (actual > 0) outcome = "sold";
  else if (outcome === "sold") outcome = "no-sale";

  return { world: after, rec: {
    ...base, actual, actualUnits, product,
    actualPerfect: actual > 0 && !!actualFit && actualFit.score >= PERFECT_MATCH,
    actualScore: actualFit?.score ?? 0,
    outcome, actions: stats,
    paidKnown: c.known.length, paidUnitsKnown: c.unitsKnown, paidVetoKnown: c.vetoKnown,
    focusKnownAtEnd: c.focusKnown,
    log: after.log.at(-1)?.text,
  } };
}

// —— 楼层：选谁、接完再做什么 ——

function choseCustomer(w: World, people: Person[], failed: Set<PersonId>): Person | null {
  const candidates = people.filter(p => {
    if (p.role !== "customer" || !p.skin || failed.has(p.id)) return false;
    if (!(p.id in w.present) || w.present[p.id] === "rival") return false;
    if (w.touched.includes(p.id) || w.energy < VERB_ENERGY.serve) return false;
    if ((w.opinion[p.id] ?? 0) <= SERVE_REFUSE_OPINION) return false;
    // 两家成交都在现场公开；记住已发生的购买，不读取隐藏诉求。
    if (recentlyPurchased(w, p.id)) return false;
    const live = visitPerson(w, p);
    return SHELF_IDS.some(id => SHELF[id].price <= (live.skin?.budget ?? 0));
  });
  const target = candidates.find(p => rivalTargets(w).includes(p.id) && !rivalGuarded(w, p.id));
  if (target) return target;
  candidates.sort((a, b) => (w.opinion[b.id] ?? 0) - (w.opinion[a.id] ?? 0) || a.id.localeCompare(b.id));
  return candidates[0] ?? null;
}

/** 接完一单剩下的劲：先办柜位的人情，再把小样给本周还没照应过的人，其次微信/保密/招呼。 */
function socialTurn(w: World, people: Person[]): { world: World; verb: string } {
  const options = verbOptions(w, people);
  const plan = rivalTargets(w).find(id => !rivalGuarded(w, id));
  if (plan && !rivalGuarded(w, plan) && w.rivalPlan?.tactic !== "compare") {
    const handoff = options.find(c => c.verb === "handoff" && c.targets[1] === plan);
    if (handoff) {
      const next = doVerb(w, people, "handoff", handoff.targets);
      if (next !== w) return { world: next, verb: "handoff" };
    }
  }
  if (qualityOf(w, "standing:social-day") !== w.day) {
    for (const verb of ["help", "mediate", "introduce"] as const) {
      const call = options.find(c => c.verb === verb);
      if (call) {
        const next = doVerb(w, people, verb, call.targets);
        if (next !== w) return { world: next, verb };
      }
    }
  }
  const week = weekNoOf(w.day);
  const samples = options.filter(c => c.verb === "sample" && !qualityOf(w, weekCareKey(week, c.targets[0])));
  samples.sort((a, b) => weekCareDaysOf(w, b.targets[0]) - weekCareDaysOf(w, a.targets[0])
    || (w.opinion[b.targets[0]] ?? 0) - (w.opinion[a.targets[0]] ?? 0));
  if (samples[0]) {
    const next = doVerb(w, people, "sample", samples[0].targets);
    if (next !== w) return { world: next, verb: "sample" };
  }
  for (const verb of ["wechat", "keep", "greet"] as const) {
    const call = options.find(c => c.verb === verb && !(verb === "greet" && w.touched.includes(c.targets[0])));
    if (call) {
      const next = doVerb(w, people, verb, call.targets);
      if (next !== w) return { world: next, verb };
    }
  }
  return { world: w, verb: "" };
}

// —— 一周 ——

type WeekRow = { seed: string; season: number; week: number; made: number; serve: number; rival: number; target: number;
  stars: number; route: WeekRoute; care: number; guard: number; threats: number; stops: number };
function weekRowOf(w: World, closingDay: number, seed: string, season: number, serve: number): WeekRow {
  const week = Math.ceil(closingDay / 7);
  const guardAt = (kind: string) => Object.entries(w.qualities)
    .filter(([k, v]) => k.startsWith(`week-${kind}:${week}:`) && v === 1).length;
  return {
    seed, season, week, serve,
    made: qualityOf(w, weekMadeKey(week)), rival: qualityOf(w, weekRivalKey(week)),
    target: WEEK_TARGETS[week - 1], stars: qualityOf(w, weekStarsKey(week)),
    route: routeFromCode(qualityOf(w, weekRouteKey(week))),
    care: qualityOf(w, weekCareCountKey(week)),
    guard: guardAt("guard-person"), threats: guardAt("guard-threat"), stops: guardAt("guard-stop"),
  };
}

// —— 一季 ——

type SeasonRun = {
  seed: string; season: number; world: World; money: number; rival: number; rivalWins: number;
  standing: number; compliance: number; attempts: Attempt[]; weeks: WeekRow[];
  social: Record<string, number>; customers: Set<PersonId>;
};
function playSeason(seed: string, season: number, world: World, people: Person[], festivals: Festival[]): SeasonRun {
  let w = world;
  const attempts: Attempt[] = [];
  const weeks: WeekRow[] = [];
  const social: Record<string, number> = {};
  const customers = new Set<PersonId>();
  let failedDay = -1;
  const failed = new Set<PersonId>();
  let weekServe = 0;
  while (w.day <= DAYS) {
    if (w.day !== failedDay) { failed.clear(); failedDay = w.day; }
    for (let slot = 0; slot < 4; slot++) {
      w = { ...w, slot: slot as 0 | 1 | 2 | 3 };
      w = beginSlot(w, people, festivals);
      if (COMPETE_BOOKINGS && w.energy >= WEEKEND_PREP_ENERGY + VERB_ENERGY.serve) {
        const prepared = prepareWeekendOrder(w, people);
        if (prepared !== w) { w = prepared; social["prepare-weekend"] = (social["prepare-weekend"] ?? 0) + 1; }
      }
      const booking = rivalBookingNow(w);
      let invited: Person | undefined;
      if (COMPETE_BOOKINGS && booking) {
        if (booking.invited && w.energy >= VERB_ENERGY.serve) invited = people.find(p => p.id === booking.person);
        else if (w.energy >= RIVAL_INVITE_ENERGY + VERB_ENERGY.serve) {
          const next = inviteRivalGuest(w, people);
          if (next !== w) { invited = people.find(p => p.id === booking.person); w = next; social["invite-booking"] = (social["invite-booking"] ?? 0) + 1; }
        }
      }
      const person = invited ?? choseCustomer(w, people, failed);
      let attempted = false;
      if (person) {
        const run = attempt(w, people, person, seed, season);
        w = run.world;
        attempts.push(run.rec);
        customers.add(person.id);
        attempted = true;
        weekServe += run.rec.actual;
        if (run.rec.outcome !== "sold") failed.add(person.id);
      }
      const turns = attempted ? 1 : 3;
      for (let n = 0; n < turns; n++) {
        const turn = socialTurn(w, people);
        if (turn.world === w) break;
        w = turn.world;
        social[turn.verb] = (social[turn.verb] ?? 0) + 1;
      }
      w = ambient(w, people);
    }
    const closingDay = w.day;
    w = endDay(w, people);
    if (isSunday(closingDay)) {
      weeks.push(weekRowOf(w, closingDay, seed, season, weekServe));
      weekServe = 0;
    }
  }
  return { seed, season, world: w, money: w.money, rival: w.rivalMoney, rivalWins: w.rivalWins,
    standing: w.standing, compliance: w.compliance, attempts, weeks, social, customers };
}

// —— 内容加载 ——

type FestivalsFor = (season: number) => Festival[];
async function loadContent(): Promise<{ people: Person[]; festivalsFor: FestivalsFor; source: string }> {
  const url = new URL("../src/world/content/index.ts", import.meta.url);
  if (existsSync(fileURLToPath(url))) {
    const mod = await import(url.href) as Record<string, unknown>;
    const people = (mod.PEOPLE ?? mod.people ?? (mod.default as { people?: Person[] })?.people) as Person[] | undefined;
    const flat = mod.FESTIVALS as Festival[] | undefined;
    const festivalsFor = (mod.festivalsFor as FestivalsFor | undefined) ?? (flat ? () => flat : () => []);
    if (people?.length) return { people, festivalsFor, source: "src/world/content" };
  }
  return { people: FIXTURE_PEOPLE, festivalsFor: () => [], source: "tests/fixtures/world-fixture.ts" };
}

// —— 跑 ——

const { people, festivalsFor, source } = await loadContent();
const runs: SeasonRun[] = [];
for (let i = 0; i < N; i++) {
  const seed = `sim-${i}`;
  let w = newWorld(seed, people);
  for (let season = 1; season <= SEASONS; season++) {
    if (season > 1) w = nextSeason(w, people);
    const run = playSeason(seed, season, w, people, festivalsFor(season));
    runs.push(run);
    w = run.world;
  }
}

const attempts = runs.flatMap(r => r.attempts);
const weeks = runs.flatMap(r => r.weeks);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => sum(xs) / Math.max(1, xs.length);
const actual = sum(attempts.map(a => a.actual));
const freeGuess = sum(attempts.map(a => a.freeGuess));
const oracle = sum(attempts.map(a => a.oracle));
const sold = attempts.filter(a => a.actual > 0);
const perfect = attempts.filter(a => a.actualPerfect).length;
const freePerfect = attempts.filter(a => a.freePerfect).length;
const stats = attempts.reduce((s, a) => {
  const x = a.actions;
  s.look += x.look; s.blankLook += x.blankLook; s.ask += x.ask; s.shrug += x.shrug;
  s.try += x.try; s.tryPositive += x.tryPositive; s.tryMixed += x.tryMixed; s.tryNegative += x.tryNegative;
  s.unitsAsk += x.unitsAsk; s.patience += x.patience; s.startPatience += x.startPatience; return s;
}, { look: 0, blankLook: 0, ask: 0, shrug: 0, try: 0, tryPositive: 0, tryMixed: 0, tryNegative: 0, unitsAsk: 0, patience: 0, startPatience: 0 });
const outcomeCount = (o: Outcome) => attempts.filter(a => a.outcome === o).length;
const seasonMoney = runs.map(r => r.money);
const serveOnly = runs.map(r => sum(r.attempts.map(a => a.actual)));
const captureOf = (r: SeasonRun) => {
  const o = sum(r.attempts.map(a => a.oracle));
  return o > 0 ? sum(r.attempts.map(a => a.actual)) / o : 0;
};
const medianCapture = median(runs.map(captureOf));
const nonServe = runs.map(r => r.money - sum(r.attempts.map(a => a.actual)));
const zeroTryOffers = attempts.filter(a => a.actions.startPatience > 0 && a.actions.try === 0 && a.product).length;
const positiveUnsold = attempts.filter(a => a.actions.tryPositive > 0 && a.actual === 0).length;
const focusAttempts = attempts.filter(a => a.hasFocus);
const focusAtStart = focusAttempts.filter(a => a.focusKnownAtStart).length;
const focusDiscovered = focusAttempts.filter(a => !a.focusKnownAtStart && a.focusKnownAtEnd).length;
const focusMissed = focusAttempts.filter(a => !a.focusKnownAtEnd).length;
const weeksByNo = [1, 2, 3, 4].map(n => weeks.filter(x => x.week === n)).filter(xs => xs.length);
const routes = (xs: WeekRow[]) => {
  const out: Record<WeekRoute, number> = { sales: 0, care: 0, guard: 0 };
  for (const x of xs) out[x.route]++;
  return `业绩 ${out.sales} / 客情 ${out.care} / 守客 ${out.guard}`;
};
const stars = (xs: WeekRow[]) => [0, 1, 2, 3].map(k => xs.filter(x => x.stars === k).length).join(" / ");
const buckets = [
  { label: "陌生 <10", test: (a: Attempt) => a.opinion < 10 },
  { label: "熟客 10-39", test: (a: Attempt) => a.opinion >= 10 && a.opinion < 40 },
  { label: "老客 ≥40", test: (a: Attempt) => a.opinion >= 40 },
];
const productRows = SHELF_IDS.map(id => ({
  id, offers: attempts.filter(a => a.product === id).length,
  sales: attempts.filter(a => a.product === id && a.actual > 0).length,
  perfect: attempts.filter(a => a.product === id && a.actualPerfect).length,
  free: attempts.filter(a => a.freeProduct === id).length,
  oracle: attempts.filter(a => a.oracleProduct === id).length,
})).filter(x => x.offers || x.free || x.oracle).sort((a, b) => b.offers - a.offers);

console.log(`== 人情场 · 有限信息接待模拟 · 内容来源 ${source} · ${people.length} 人 ==`);
console.log(`== ${N} 个种子 × ${SEASONS} 季 · 每格最多接待 1 位 · 不抽剧情卡 / 不接委托 / 无自选加难 ==`);
console.log("盲策只读：openConsult 的 known / focusKnown 与台词、试穿反应、货架 tag / note / 价、预算、件数问答。");
console.log("不读：fitOfPerson、bestFit、隐藏诉求、未揭开的今天的重点、maxUnits（除非已经问出）。影子账只用于测量，不参与决策。\n");

console.log("一、每季（接待销售 = 种子里的接待单；影子猜 / 全知顶 是同一批接待机会的对照）");
console.log("种子      总收入     接待销售    影子猜      全知顶     捕获率   成交  完美  星  过关周  对面");
for (const r of runs) {
  const a = sum(r.attempts.map(x => x.actual));
  const f = sum(r.attempts.map(x => x.freeGuess));
  const o = sum(r.attempts.map(x => x.oracle));
  const s = r.attempts.filter(x => x.actual > 0).length;
  const p = r.attempts.filter(x => x.actualPerfect).length;
  const st = sum(r.weeks.map(x => x.stars));
  console.log(`${r.seed.padEnd(8)} ${yuan(r.money).padStart(9)} ${yuan(a).padStart(10)} ${yuan(f).padStart(10)} ${yuan(o).padStart(10)} ${pct(a, o).padStart(7)} ${String(s).padStart(4)} ${String(p).padStart(4)} ${String(st).padStart(3)} ${String(r.weeks.filter(x => x.stars > 0).length).padStart(5)} ${yuan(r.rival).padStart(9)}`);
}
console.log(`中位       ${yuan(median(seasonMoney)).padStart(9)} ${yuan(median(serveOnly)).padStart(10)} ${yuan(median(runs.map(r => sum(r.attempts.map(x => x.freeGuess))))).padStart(10)} ${yuan(median(runs.map(r => sum(r.attempts.map(x => x.oracle))))).padStart(10)} ${pct(medianCapture, 1).padStart(7)}`);

console.log("\n二、接待与信息");
console.log(`接待机会 ${attempts.length} 次：卖成 ${outcomeCount("sold")} / 试过全摇头不卖 ${outcomeCount("declined")} / 推错货 ${outcomeCount("wrong")} / 超预算 ${outcomeCount("price")} / 被挡 ${outcomeCount("blocked")} / 其它 ${outcomeCount("no-sale")}`);
console.log(`每单开局已知 ${avg(attempts.map(a => a.freeKnown)).toFixed(2)} 条诉求，谈完 ${avg(attempts.map(a => a.paidKnown)).toFixed(2)} 条 · 问出件数 ${stats.unitsAsk} 次`);
console.log(`看 ${stats.look} 次（${stats.blankLook} 次没带来新信息） · 问 ${stats.ask} 次（${stats.shrug} 次没问出新信息）`);
console.log(`试 ${stats.try} 支（点头 ${stats.tryPositive} / 犹豫 ${stats.tryMixed} / 摇头 ${stats.tryNegative}） · 每单平均花 ${(stats.patience / Math.max(1, attempts.length)).toFixed(2)} 次耐心`);
console.log(`今天的重点：${focusAttempts.length} 次有 · 开局已知 ${focusAtStart}（手写线索覆盖不到的老写法） · 谈完知道 ${focusAttempts.length - focusMissed}（新揭开 ${focusDiscovered}） · 没摸清 ${focusMissed}`);
console.log(`完美命中：实卖 ${perfect} 单 / 影子猜 ${freePerfect} 单；实际成交率 ${pct(sold.length, attempts.length)}`);
console.log("关系        单数  开局已知  谈完已知  看/问/试        成交率  捕获   重点摸清");
for (const b of buckets) {
  const xs = attempts.filter(b.test);
  if (!xs.length) continue;
  const a = sum(xs.map(x => x.actual));
  const o = sum(xs.map(x => x.oracle));
  const focused = xs.filter(x => x.hasFocus);
  const focusRate = focused.length ? pct(focused.filter(x => x.focusKnownAtEnd).length, focused.length) : "—";
  console.log(`${b.label.padEnd(9)} ${String(xs.length).padStart(4)} ${avg(xs.map(x => x.freeKnown)).toFixed(2).padStart(8)} ${avg(xs.map(x => x.paidKnown)).toFixed(2).padStart(8)} ${`${avg(xs.map(x => x.actions.look)).toFixed(1)}/${avg(xs.map(x => x.actions.ask)).toFixed(1)}/${avg(xs.map(x => x.actions.try)).toFixed(1)}`.padStart(14)} ${pct(xs.filter(x => x.actual > 0).length, xs.length).padStart(6)} ${pct(a, o).padStart(6)} ${focusRate.padStart(8)}`);
}

console.log("\n三、同一批机会上的信息差");
console.log(`实际接待销售 ${yuan(actual)} / 全知天花板 ${yuan(oracle)} → 捕获 ${pct(actual, oracle)}；每单平均漏掉 ${yuan((oracle - actual) / Math.max(1, attempts.length))}`);
{
  const soldUnits = sum(attempts.map(a => a.actualUnits));
  const oracleUnits = sum(attempts.map(a => a.oracleUnits));
  console.log(`实际 ${soldUnits} 件（每成交 ${(soldUnits / Math.max(1, sold.length)).toFixed(2)} 件，均价 ${yuan(actual / Math.max(1, soldUnits))}） / 全知顶 ${oracleUnits} 件（每机会 ${(oracleUnits / Math.max(1, attempts.length)).toFixed(2)} 件，均价 ${yuan(oracle / Math.max(1, oracleUnits))}）`);
}
console.log(`不咨询的影子猜 ${yuan(freeGuess)} → 实际比影子猜多 ${yuan(actual - freeGuess)}（${freeGuess > 0 ? `${((actual - freeGuess) / freeGuess * 100).toFixed(1)}%` : "—"}，每单 ${yuan((actual - freeGuess) / Math.max(1, attempts.length))}）`);
console.log(`全知顶与影子猜之间还隔着 ${yuan(oracle - freeGuess)}：这是标签上看不出的隐藏适配，不是玩家已经拿到的信息。`);
console.log(`非接待进账（托单 / 回访等）中位 ${yuan(median(nonServe))}；每周目标按总进账算，接待单独看。`);

console.log("\n四、每周（实际打出来的账）");
console.log(`周  目标      总进账中位  接待中位    对面中位    星 0/1/2/3 计 ${N * SEASONS} 组        过关   路线`);
for (const list of weeksByNo) {
  const n = list[0]?.week ?? 0;
  console.log(`${n}   ${yuan(WEEK_TARGETS[n - 1]).padStart(7)}  ${yuan(median(list.map(x => x.made))).padStart(9)}  ${yuan(median(list.map(x => x.serve))).padStart(9)}  ${yuan(median(list.map(x => x.rival))).padStart(9)}   ${stars(list).padEnd(18)} ${String(list.filter(x => x.stars > 0).length).padStart(3)}/${list.length}  ${routes(list)}`);
}
console.log(`合计星 ${sum(weeks.map(x => x.stars))} / 满星 ${weeks.filter(x => x.stars === 3).length} / 过关 ${weeks.filter(x => x.stars > 0).length}（共 ${weeks.length} 周）`);
console.log(`比分：领先 ${runs.filter(r => r.money > r.rival).length} / 打平 ${runs.filter(r => r.money === r.rival).length} / 落后 ${runs.filter(r => r.money < r.rival).length}；对面每季成交中位 ${median(runs.map(r => r.rivalWins))} 单`);
console.log(`社交动作：${Object.entries(runs.reduce((m, r) => { for (const [k, v] of Object.entries(r.social)) m[k] = (m[k] ?? 0) + v; return m; }, {} as Record<string, number>)).map(([k, v]) => `${k} ${v}`).join(" / ") || "无"}`);

console.log("\n四之二、每周分位数（盲策真打出来的数，给调目标线用）");
console.log("周   总进账 P25 / 中位 / P75          对面 P25 / 中位 / P75          接待 P25 / 中位 / P75");
for (const list of weeksByNo) {
  const n = list[0]?.week ?? 0;
  const band = (xs: number[]) => `${yuan(quantile(xs, 0.25)).padStart(7)} / ${yuan(median(xs)).padStart(7)} / ${yuan(quantile(xs, 0.75)).padStart(7)}`;
  console.log(`${n}   ${band(list.map(x => x.made))}   ${band(list.map(x => x.rival))}   ${band(list.map(x => x.serve))}`);
}

console.log("\n四之三、目标候选（这份盲策的周进账；每档写「过关/三星」的种子数，三星还要求赢对面）");
{
  const candidates = [13_000, 14_000, 16_000, 18_000, 21_000, 24_000, 26_000];
  console.log(`周   ${candidates.map(t => `${Math.round(t / 1000)}k`).join("      ")}`);
  for (const list of weeksByNo) {
    const n = list[0]?.week ?? 0;
    const made = list.map(x => x.made), rival = list.map(x => x.rival);
    const row = candidates.map(t => {
      const hit = made.filter(x => x >= t).length;
      const three = made.filter((x, i) => x >= Math.ceil(t * 1.3) && x > rival[i]!).length;
      return `${String(hit).padStart(2)}/${String(three).padStart(2)}`;
    }).join("   ");
    console.log(`${n}   ${row}`);
  }
}

console.log("\n四之四、三条路线（每周结束时的实际人数；守客率 = 挡住的公开威胁 / 公开威胁）");
console.log("周   客情 P25 / 中位 / P75      守客 P25 / 中位 / P75      威胁中位   守客率中位");
for (const list of weeksByNo) {
  const n = list[0]?.week ?? 0;
  const band = (xs: number[]) => `${String(quantile(xs, 0.25)).padStart(3)} / ${String(median(xs)).padStart(3)} / ${String(quantile(xs, 0.75)).padStart(3)}`;
  const rates = list.filter(x => x.threats > 0).map(x => x.stops / x.threats);
  console.log(`${n}   ${band(list.map(x => x.care))}          ${band(list.map(x => x.guard))}          ${String(median(list.map(x => x.threats))).padStart(5)}      ${rates.length ? pct(median(rates), 1) : "—"}`);
}

console.log("\n五、货架（同一批机会里谁被报、谁真卖出去；后两列是次数，不是钱）");
console.log("货      价     tag        报出  成交  完美  影子猜  全知首选");
for (const p of productRows) {
  console.log(`${SHELF[p.id].short.padEnd(5)} ${SHELF[p.id].price.toString().padStart(5)}  ${SHELF[p.id].tag.padEnd(10)} ${String(p.offers).padStart(4)} ${String(p.sales).padStart(5)} ${String(p.perfect).padStart(5)} ${String(p.free).padStart(7)} ${String(p.oracle).padStart(7)}`);
}

console.log("\n六、核对");
{
  const badOracle = attempts.filter(a => a.oracle + 0.5 < a.actual).length;
  const badAmount = attempts.filter(a => a.actual > 0 && a.product && a.actual !== a.actualUnits * SHELF[a.product].price).length;
  console.log(`全知顶 < 实际：${badOracle} 次 · 成交额 ≠ 单价 × 件数：${badAmount} 次 · 接待机会为 0：${attempts.length === 0 ? "是（模拟没跑起来）" : "否"}`);
  console.log(`一次没试就开单：${zeroTryOffers} 次（策略应恒为 0） · 试出点头却没成交：${positiveUnsold} 次 · 推错货：${outcomeCount("wrong")} 次`);
  console.log(`耐心花光且没成交：${attempts.filter(a => a.actions.startPatience > 0 && a.actions.patience >= a.actions.startPatience && a.actual === 0).length} 次；没花完耐心就成交：${attempts.filter(a => a.actual > 0 && a.actions.patience < a.actions.startPatience).length} 次`);
}

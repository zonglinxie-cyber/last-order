// 人情场无界面模拟器：四种玩法风格 × N 个种子 × 28 天 × 可选多季，量"结果有多少种"。
// 跑法：node --experimental-strip-types tests/world-sim.ts [种子数，默认 16] [季数，默认 1]
// 季数 ≥2 时第 2 季起用 nextSeason 接着上一季的世界跑，并报告相对上一季谁倒戈了。
// 内容目录 src/world/content/ 存在时吃正式内容（导出 PEOPLE/STORYLETS 或 people/storylets），否则用测试夹具。
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drawIndex } from "../src/world/rng.ts";
import {
  ambient, applyChoice, beginSlot, bestFit, choiceVisible, clueIds, doVerb, drawStorylet, endDay,
  newWorld, nextSeason, qualityOf, seasonSummary, storyDeck, verbOptions, VERB_ENERGY, type VerbArgs, type VerbCall,
} from "../src/world/engine.ts";
import { rank, seasonEnding } from "../src/world/ending.ts";
import { CLUES, CLUE_THREADS, MAINLINE_ACTS, MAINLINE_ACT_KEY, threadLanding } from "../src/world/content/clues.ts";
import { ARC_PEOPLE, threadLandings } from "../src/world/progress.ts";
import { EXCHANGE_ACTS, exchangeTally } from "../src/world/exchanges.ts";
import { INSTANT_KINDS, QUOTA_MIN, QUOTA_STEP_DAYS, QUOTA_TOP, resolveRequestChoice, soldUnitsKey } from "../src/world/requests.ts";
import type { Festival, Person, PersonId, RequestState, Slot, Storylet, World } from "../src/world/types.ts";
import { SHELF_IDS } from "../src/world/shelf.ts";
import { FIXTURE_PEOPLE, FIXTURE_STORYLETS } from "./fixtures/world-fixture.ts";

type Style = "honest" | "pushy" | "social" | "random";
const STYLES: Style[] = ["honest", "pushy", "social", "random"];
const DAYS = 28;
const ACTIONS_PER_SLOT = 5;
const PRODUCT_IDS = SHELF_IDS; // 货架上全部八支，random 风格从这里瞎挑（价格见 shelf.ts 的 SHELF）

const personOf = (people: Person[], id: PersonId) => people.find(p => p.id === id)!;

/** 从世界自己的种子抽一次 —— 模拟器的决定也走 rngCalls，同样确定。 */
const simDraw = (w: World): [number, World] => {
  const v = w.rngCalls;
  return [drawIndex(w.seed, v, 1_000_000) / 1_000_000, { ...w, rngCalls: v + 1 }];
};
const simIndex = (w: World, n: number): [number, World] => {
  const i = drawIndex(w.seed, w.rngCalls, n);
  return [i, { ...w, rngCalls: w.rngCalls + 1 }];
};

/** 各风格在 verbOptions 里挑下一个动作。返回 null = 这个时段收手。 */
function pickAction(style: Style, w: World, people: Person[]): [{ call: VerbCall; args?: VerbArgs } | null, World] {
  const options = verbOptions(w, people);
  const first = (verb: VerbCall["verb"], pred?: (c: VerbCall) => boolean) =>
    options.find(c => c.verb === verb && (!pred || pred(c)));
  const untouched = (c: VerbCall) => !w.touched.includes(c.targets[0]);
  switch (style) {
    case "honest": {
      const serve = first("serve", untouched);
      if (serve) {
        const p = personOf(people, serve.targets[0]);
        return [{ call: serve, args: { product: bestFit(p), units: p.skin!.maxUnits } }, w];
      }
      // 柜位的一天一次人情（engine 的 standing:social-day 门）只有 help/mediate/introduce 会给，
      // keep/greet/wechat/sample 都不给。按格发精力之后一格只够一单接待，把这些排在前面就等于
      // 一笔人情永远轮不到 —— 会算的人这一刻做的是"没有客可开单时，先把那 +1/+2 拿到手"。
      for (const verb of ["mediate", "help", "introduce", "keep", "greet", "wechat", "sample"] as const) {
        // 挑不到劲够得着的那一个就跳过：doVerb 对不够劲的动作原样返回，takeTurns 会当成"没做成"直接收手，
        // 一格 20 点会被这种空转整格浪费掉。
        const c = first(verb, x => untouched(x) && w.energy >= VERB_ENERGY[verb]);
        if (c) return [{ call: c }, w];
      }
      return [null, w];
    }
    case "pushy": {
      const serve = first("serve", untouched);
      if (serve) {
        const p = personOf(people, serve.targets[0]);
        return [{ call: serve, args: { product: bestFit(p), units: p.skin!.maxUnits, force: true } }, w];
      }
      return [null, w];
    }
    case "social": {
      // 先经营关系网（劝和、帮同事、牵线），再把客人托给肯开单的同事。
      // 托单放在前面的话，客人一多五次动作全花在托单上，人情动作一次都轮不到。
      for (const verb of ["mediate", "help", "introduce"] as const) {
        const c = first(verb, untouched);
        if (c) return [{ call: c }, w];
      }
      const sale = options.find(c => c.verb === "handoff" && personOf(people, c.targets[1]).skin);
      if (sale) return [{ call: sale }, w];
      for (const verb of ["keep", "tell", "wechat", "sample", "greet"] as const) {
        const c = first(verb, untouched);
        if (c) return [{ call: c }, w];
      }
      return [null, w];
    }
    case "random": {
      if (!options.length) return [null, w];
      let i: number; [i, w] = simIndex(w, options.length);
      const call = options[i];
      if (call.verb === "serve") {
        let p: number; [p, w] = simIndex(w, PRODUCT_IDS.length);
        let u: number; [u, w] = simIndex(w, 4);
        let f: number; [f, w] = simDraw(w);
        return [{ call, args: { product: PRODUCT_IDS[p], units: u + 1, force: f < 0.5 } }, w];
      }
      return [{ call }, w];
    }
  }
}

/** 当场可答的委托（唐可借小样）各风格怎么选：老实做人和经营关系的都借，硬推的舍不得。 */
function answerRequests(style: Style, w: World, people: Person[]): World {
  for (const req of w.requests.filter(r => r.state === "open" && INSTANT_KINDS.includes(r.kind))) {
    const b = w;
    let yes = w.samples >= (req.n ?? 1);
    if (style === "pushy") yes = false;
    else if (style === "random") { let x: number; [x, w] = simDraw(w); yes = x < 0.5; }
    w = resolveRequestChoice(w, people, req.id, yes);
    bumpStand(style, "当场委托", b, w);
  }
  return w;
}

/** 这个时段玩家实际做成了几件事（第二个返回值）—— 节奏仪表要读它，判定本身没改。 */
function takeTurns(style: Style, w: World, people: Person[]): [World, number] {
  let acted = 0;
  for (let n = 0; n < ACTIONS_PER_SLOT; n++) {
    let action: { call: VerbCall; args?: VerbArgs } | null;
    [action, w] = pickAction(style, w, people);
    if (!action) break;
    const before = w;
    verbTally.set(`${style}|${action.call.verb}`, (verbTally.get(`${style}|${action.call.verb}`) ?? 0) + 1);
    w = doVerb(w, people, action.call.verb, action.call.targets, action.args ?? {});
    bumpStand(style, `动作 ${action.call.verb}`, before, w);
    if (w === before) { verbFail.set(`${style}|${action.call.verb}`, (verbFail.get(`${style}|${action.call.verb}`) ?? 0) + 1); break; } // 动作没生效（精力不够之类）就收手
    acted++;
  }
  return [w, acted];
}

/** 每种风格下每张卡被抽到的次数（跨种子、跨季累计），用来找"写了却永远出不来"的卡。 */
const fireCount = new Map<Style, Map<string, number>>();

/** 落点卡被抽到那一刻，五格里摆上桌几格。
 *  为什么量这个：某一档只占 15/160 有两种完全不同的解释 —— 玩家撞不到（本节下面那个均匀随机政策的算术），
 *  或者那一格根本没摆上桌（内容写坏了）。露出率把这两者分开：露出高而到达低 = 政策问题，露出 0 = 死档。 */
type EndExposure = { seen: number; onlyDefault: number; vis: number[]; perIndex: number[]; slots: number };
const endExposure = new Map<PersonId, EndExposure>();
const endCardOf = (s: Storylet): PersonId | null => {
  for (const c of s.choices) for (const e of c.effects) {
    if ("quality" in e) { const m = /^arc:([^:]+):end$/.exec(e.quality); if (m) return m[1] as PersonId; }
  }
  return null;
};

/** 内容燃烧曲线：一个种子从第 1 季到最后一季连着算，天数是跨季累计的绝对天。
    第一次见到的卡算"新内容"，之后每次抽到已经见过的卡算重复 —— 曲线见底的绝对天
    就是"没玩就结束了"那个体感的天数。 */
type SeasonBurn = {
  season: number; draws: number; repeats: number;
  /** 这一季抽到的故事卡（个人线 + 主线）次数，和第一次抽到的张数 —— 「这一季到底有没有新剧情」看这两列 */
  story: number; arcFirst: Set<string>; mainFirst: Set<string>;
  /** 节奏（第 23 轮加的仪表，纯读）：一季 112 个时段里，有多少个时段玩家手上真的有事做。
   *  「没玩就结束了」的反面不是卡不够多，是**点下一时段的次数**太多。 */
  slots: number; noStory: number; readOnly: number; acted: number; starved: number[];
  /** 做不动分两种，修法是两码事：缺劲（energy 连最便宜那一下都不够）和没人（场上一个都点不到）。 */
  noEnergy: number; noGuest: number;
};
type RunBurn = { firstDay: Map<string, number>; draws: number; repeats: number; perSeason: SeasonBurn[] };
const runBurn = new Map<string, RunBurn>();
/** 四个时段各自「开门那一刻」的在场可点人数与精力（四种风格混在一起池化，与节奏表同口径）。 */
const slotHands: number[][] = [[], [], [], []];
const slotEnergy: number[][] = [[], [], [], []];
/** 柜位是被哪几笔攒起来 / 又是被哪几笔扣掉的。每处会动 standing 的转移只做一次前后差值 ——
 *  纯读：不抽随机数，其余表与加这段之前逐行一致。
 *  为什么要量：精力改成按格发之后老实人的柜位中位从 85 掉到 60，成交却从 28 单涨到 38 单，
 *  说明掉的那 25 点不是少卖了几单，是另一笔进项断了。 */
const standTally = new Map<string, Map<string, [number, number]>>();
/** 每种风格挑过几次哪个动作、其中几次没做成（doVerb 原样返回）。用来回答"人情为什么一次都没轮上"。 */
const verbTally = new Map<string, number>();
const verbFail = new Map<string, number>();
/** 桌上有几张戏可讲（第 25 轮加的仪表，纯读）：每天上午那一格，把说书人那一摞牌按"讲得成哪一类"数一遍。
 *  为什么要量：每季故事卡 47 / 31 / 11 / 11 次，后两季基本只剩过场 —— 得先分清是**没有卡可讲**还是
 *  **有卡但抽不到**，这两条的修法是两码事（前者补内容，后者动权重）。走完的线在这里自证：
 *  「已落地那条线还剩的卡」那一列如果是 0，就是"走完就断、池子净缩水"。
 *  storyDeck 内部会推进 rngCalls（绑定搜索按槽数计），这里只取 eligible、把 cursor 丢掉，所以不消耗随机流。 */
const deckCensus = new Map<number, number[][]>();
const CENSUS_COLS = ["可抽总张数", "过场", "主线", "个人线未开头", "个人线进行中", "走完的线还剩的卡", "走完的线数"];
const censusRow = (w: World, people: Person[], storylets: Storylet[]): number[] => {
  const landed = new Set<PersonId>();
  const running = new Set<PersonId>();
  for (const id of ARC_PEOPLE) {
    if ((w.qualities[`arc:${id}:end`] ?? 0) >= 1) landed.add(id);
    else if ((w.qualities[`arc:${id}`] ?? 0) >= 1) running.add(id);
  }
  // 0 可抽总数 1 过场 2 主线 3 个人线未开头 4 进行中 5 走完的线还剩的卡 6 走完的线数
  const row = [0, 0, 0, 0, 0, 0, landed.size];
  for (const { storylet } of storyDeck(w, people, storylets, qualityOf(w, "storyteller:heat")).eligible) {
    row[0]++;
    const ids = Object.values(storylet.cast).map(s => s.id).filter((x): x is PersonId => x !== undefined);
    if (storylet.kind === "mainline") row[2]++;
    else if (storylet.kind === "arc") {
      if (ids.some(id => landed.has(id))) row[5]++;
      else if (ids.some(id => running.has(id))) row[4]++;
      else row[3]++;
    } else row[1]++;
  }
  return row;
};
let standSeason = 1;
function bumpStand(style: Style, where: string, before: World, after: World): void {
  const d = after.standing - before.standing;
  if (!d) return;
  const key = `${style}|第 ${standSeason} 季`;
  const m = standTally.get(key) ?? new Map<string, [number, number]>();
  const cur = m.get(where) ?? [0, 0];
  m.set(where, [cur[0] + 1, cur[1] + d]);
  standTally.set(key, m);
}
const burnOf = (style: Style, seed: string): RunBurn => {
  const key = `${style}|${seed}`;
  let b = runBurn.get(key);
  if (!b) { b = { firstDay: new Map(), draws: 0, repeats: 0, perSeason: [] }; runBurn.set(key, b); }
  return b;
};

function playSeason(style: Style, w: World, people: Person[], storylets: Storylet[], festivals: Festival[], seasonNo: number, burn: RunBurn): World {
  const seasonTally: SeasonBurn = { season: seasonNo, draws: 0, repeats: 0, story: 0, arcFirst: new Set(), mainFirst: new Set(),
    slots: 0, noStory: 0, readOnly: 0, acted: 0, starved: [], noEnergy: 0, noGuest: 0 };
  burn.perSeason.push(seasonTally);
  standSeason = seasonNo;
  while (w.day <= DAYS) {
    for (let s = 0; s < 4; s++) {
      w = { ...w, slot: s as Slot };
      w = beginSlot(w, people, festivals);
      w = answerRequests(style, w, people); // 开门提的当场类委托，先答了再抽卡做动作
      // 节奏仪表（纯读）：进场这一刻手上有没有牌 —— 场上还点得到人、精力还够做最便宜的那件事。
      const hands = Object.values(w.present).filter(z => z !== "rival").length;
      const lowEnergy = w.energy < VERB_ENERGY.greet;
      const canAct = !lowEnergy && hands > 0;
      slotHands[s].push(hands);
      slotEnergy[s].push(w.energy);
      // 只在每天上午那一格数（每季 28 个读数 / 每副牌）：storyDeck 要把 271 张卡逐张探绑定，
      // 四个时段全数等于把说书人的活儿再干一遍，整跑从几分钟变成十几分钟。上午那一格足够代表这一季的池子形状。
      if (s === 0) {
        const bucket = deckCensus.get(seasonNo) ?? [];
        bucket.push(censusRow(w, people, storylets));
        deckCensus.set(seasonNo, bucket);
      }
      const { world: w2, drawn } = drawStorylet(w, people, storylets);
      w = w2;
      if (drawn) {
        const absDay = (seasonNo - 1) * DAYS + w.day;
        const isNew = !burn.firstDay.has(drawn.storylet.id);
        if (isNew) burn.firstDay.set(drawn.storylet.id, absDay); else { burn.repeats++; seasonTally.repeats++; }
        if (drawn.storylet.kind === "arc" || drawn.storylet.kind === "mainline") {
          seasonTally.story++;
          if (isNew) (drawn.storylet.kind === "arc" ? seasonTally.arcFirst : seasonTally.mainFirst).add(drawn.storylet.id);
        }
        burn.draws++; seasonTally.draws++;
        const counts = fireCount.get(style) ?? new Map<string, number>();
        counts.set(drawn.storylet.id, (counts.get(drawn.storylet.id) ?? 0) + 1);
        fireCount.set(style, counts);
        const visibleIdx = drawn.storylet.choices.map((c, i) => i)
          .filter(i => choiceVisible(w, people, drawn, drawn.storylet.choices[i]));
        const endLine = endCardOf(drawn.storylet);
        if (endLine) {
          // 只读上面已经算好的可见格，不再多问一次 choiceVisible、也不碰随机流
          const ex = endExposure.get(endLine) ?? { seen: 0, onlyDefault: 0, vis: [], perIndex: [], slots: drawn.storylet.choices.length };
          ex.seen++;
          ex.vis.push(visibleIdx.length);
          for (const i of visibleIdx) ex.perIndex[i] = (ex.perIndex[i] ?? 0) + 1;
          const ungated = drawn.storylet.choices.map((c, i) => i).filter(i => !drawn.storylet.choices[i].when);
          if (ungated.length && visibleIdx.every(i => ungated.includes(i))) ex.onlyDefault++;
          endExposure.set(endLine, ex);
        }
        let k: number; [k, w] = simIndex(w, Math.max(1, visibleIdx.length));
        const b4 = w;
        w = applyChoice(w, people, drawn, visibleIdx[k] ?? 0);
        bumpStand(style, "剧情选项", b4, w);
      }
      let acted = 0;
      [w, acted] = takeTurns(style, w, people);
      seasonTally.slots++;
      seasonTally.acted += acted;
      if (!drawn) seasonTally.noStory++;
      if (!canAct) {
        seasonTally.starved.push(s);
        if (lowEnergy) seasonTally.noEnergy++;
        if (hands === 0) seasonTally.noGuest++;
      }
      // 「只能读不能做」：这一段剧情给了你，可这一刻连一句最便宜的招呼都接不住 —— 纯看客的时段。
      if (drawn && !canAct) seasonTally.readOnly++;
      const ba = w;
      w = ambient(w, people); // 时段末：传话、陆遥带走没顾上的人（与界面同一个顺序）
      bumpStand(style, "时段末传话", ba, w);
    }
    const bd = w;
    w = endDay(w, people);
    bumpStand(style, "打烊(名额与委托)", bd, w);
  }
  return w;
}

// —— 内容加载 ——

type FestivalsFor = (season: number) => Festival[];

async function loadContent(): Promise<{ people: Person[]; storylets: Storylet[]; festivalsFor: FestivalsFor; source: string }> {
  const url = new URL("../src/world/content/index.ts", import.meta.url);
  if (existsSync(fileURLToPath(url))) {
    const mod = await import(url.href) as Record<string, unknown>;
    const people = (mod.PEOPLE ?? mod.people ?? (mod.default as { people?: Person[] })?.people) as Person[] | undefined;
    const storylets = (mod.STORYLETS ?? mod.storylets ?? (mod.default as { storylets?: Storylet[] })?.storylets) as Storylet[] | undefined;
    const flat = mod.FESTIVALS as Festival[] | undefined;
    const festivalsFor = (mod.festivalsFor as FestivalsFor | undefined) ?? (flat ? () => flat : () => []);
    if (people?.length && storylets?.length) return { people, storylets, festivalsFor, source: "src/world/content" };
  }
  return { people: FIXTURE_PEOPLE, storylets: FIXTURE_STORYLETS, festivalsFor: () => [], source: "tests/fixtures/world-fixture.ts" };
}

// —— 统计 ——

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const dist = (xs: number[]) =>
  `min ${Math.min(...xs)} / med ${median(xs)} / max ${Math.max(...xs)}`;

const { people, storylets, festivalsFor, source } = await loadContent();
/** 每条个人线在第几季开张：看它第 1 张卡（写着 { not: { quality: "arc:<她>", gte: 1 } } 的那张）上的 season 门槛。
 *  下面的两张名单都从这里推，不再手写 id —— 上一版把梅女士漏在第 1 季那张表外面，第 2 季那张表只挂着四条线。
 *  取最大的那一档：线上的第 2、3 张也写着「她还没开张」（挡重头），它们不带 season，默认成第 1 季会把整条线错归到第 1 季。 */
const lineSeason = new Map<PersonId, number>();
for (const card of storylets) {
  if (card.kind !== "arc") continue;
  for (const c of card.when) {
    if (!("not" in c)) continue;
    const inner = c.not as { quality?: unknown; gte?: unknown };
    if (typeof inner.quality !== "string" || inner.gte !== 1) continue;
    const opened = /^arc:([^:]+)$/.exec(inner.quality);
    if (!opened) continue;
    const gate = card.when.find(w => "season" in w) as { season?: { gte?: number } } | undefined;
    const id = opened[1] as PersonId;
    lineSeason.set(id, Math.max(lineSeason.get(id) ?? 1, gate?.season?.gte ?? 1));
  }
}
const linesOf = (season: number) => ARC_PEOPLE.filter(id => (lineSeason.get(id) ?? season) === season);
const N = Math.max(1, Number(process.argv[2]) || 16);
const SEASON_COUNT = Math.max(1, Number(process.argv[3]) || 1);
console.log(`== 人情场模拟 · 内容来源 ${source} · ${people.length} 人 · ${storylets.length} 张卡 ==`);
console.log(`== ${N} 个种子 × ${DAYS} 天${SEASON_COUNT > 1 ? ` × ${SEASON_COUNT} 季` : ""} × ${STYLES.length} 种风格 ==\n`);

type Result = {
  style: Style; seed: string; money: number; standing: number; compliance: number;
  rival: number; rivalWins: number;
  signature: string; ending: string; arcs: Record<PersonId, Record<string, number>>;
};
type Flip = { style: Style; seed: string; allyToEnemy: PersonId[]; enemyToAlly: PersonId[] };
const resultOf = (style: Style, seed: string, w: World): Result => {
  const s = seasonSummary(w, people);
  const ending = seasonEnding(w, people);
  return {
    style, seed, money: w.money, standing: w.standing, compliance: w.compliance,
    rival: w.rivalMoney, rivalWins: w.rivalWins,
    signature: `盟友[${[...s.allies].sort().join(",")}] 仇人[${[...s.enemies].sort().join(",")}]`,
    ending: ending.id, arcs: s.arcs,
  };
};
const results: Result[] = [];
/** 主线本子（每种子一条）：幕号、本子上攒了几条、每条线收到哪种收法（0 = 一季过完还没弄清）。 */
type Spine = { style: Style; seed: string; act: number; clues: number; ends: Record<string, number> };
const spines: Spine[] = [];
/** 自主社交动作的发生次数：每跑完一季记一行（exn: 计数换季自动清零，一行就是一季）。 */
const exTallies: Array<{ style: Style; tally: Record<string, number> }> = [];
/** 委托结算：每季一行（状态 -> 次数），再加每模板的明细。 */
const reqTallies: Array<{ style: Style; tally: Record<RequestState, number>; byKind: Record<string, Record<RequestState, number>> }> = [];
const tallyRequests = (w: World): { tally: Record<RequestState, number>; byKind: Record<string, Record<RequestState, number>> } => {
  const tally = { open: 0, done: 0, failed: 0, declined: 0, void: 0 } as Record<RequestState, number>;
  const byKind: Record<string, Record<RequestState, number>> = {};
  for (const r of w.requests) {
    tally[r.state]++;
    (byKind[r.kind] ??= { open: 0, done: 0, failed: 0, declined: 0, void: 0 })[r.state]++;
  }
  return { tally, byKind };
};
/** 第 2 季起每季一格：结局与"相对上一季谁倒戈了"。 */
const later: Array<{ season: number; results: Result[]; flips: Flip[] }> = [];
/** 每天在柜上开出几件（季内的天号，两季都算）：罗曼的 quota 阶梯按这个分布定。 */
const dayUnits: Array<{ style: Style; season: number; day: number; units: number }> = [];
const pushDayUnits = (style: Style, season: number, w: World) => {
  for (let d = 1; d <= DAYS; d++) dayUnits.push({ style, season, day: d, units: w.qualities[soldUnitsKey(d)] ?? 0 });
};
for (const style of STYLES) {
  for (let i = 0; i < N; i++) {
    const seed = `sim-${i}`;
    let w = playSeason(style, newWorld(seed, people), people, storylets, festivalsFor(1), 1, burnOf(style, seed));
    exTallies.push({ style, tally: exchangeTally(w) });
    reqTallies.push({ style, ...tallyRequests(w) });
    let s = seasonSummary(w, people);
    results.push(resultOf(style, seed, w));
    pushDayUnits(style, 1, w);
    for (let k = 2; k <= SEASON_COUNT; k++) {
      w = playSeason(style, nextSeason(w, people), people, storylets, festivalsFor(k), k, burnOf(style, seed));
      exTallies.push({ style, tally: exchangeTally(w) });
      reqTallies.push({ style, ...tallyRequests(w) });
      const next = seasonSummary(w, people);
      const bag = (later[k - 2] ??= { season: k, results: [], flips: [] });
      bag.results.push(resultOf(style, seed, w));
      pushDayUnits(style, k, w);
      bag.flips.push({
        style, seed,
        allyToEnemy: s.allies.filter(id => next.enemies.includes(id)),
        enemyToAlly: s.enemies.filter(id => next.allies.includes(id)),
      });
      s = next;
    }
    // 主线本子读的是最后一季的世界：幕号、线索、每条线的收法都跨季带着走。
    spines.push({
      style, seed, act: w.qualities[MAINLINE_ACT_KEY] ?? 0, clues: clueIds(w).length,
      ends: Object.fromEntries(CLUE_THREADS.map(t => [t.id, threadLanding(w.qualities, t.id)])),
    });
  }
}

console.log("风格      不同签名数   钱 (min/med/max)              柜位 (min/med/max)   台账 (min/med/max)");
for (const style of STYLES) {
  const rs = results.filter(r => r.style === style);
  const signatures = new Set(rs.map(r => r.signature));
  console.log(`${style.padEnd(9)} ${String(signatures.size).padStart(4)}/${N}    ${dist(rs.map(r => r.money)).padEnd(30)} ${dist(rs.map(r => r.standing)).padEnd(22)} ${dist(rs.map(r => r.compliance))}`);
}

// 同屏比分（第 1 季）：对面这一季从你手上截走多少。赢面太大说明比分给不出压力，落后太多说明名额分配有问题。
console.log("\n比分（第 1 季，我 vs 对面维珞）:");
{
  const all = results;
  const ahead = all.filter(r => r.money > r.rival).length;
  const tie = all.filter(r => r.money === r.rival).length;
  const behind = all.filter(r => r.money < r.rival).length;
  console.log(`  全盘 ${ahead} 领先 / ${tie} 打平 / ${behind} 落后（共 ${all.length}）`);
  for (const style of STYLES) {
    const rs = results.filter(r => r.style === style);
    const n = (f: (r: Result) => boolean) => rs.filter(f).length;
    console.log(`  ${style.padEnd(8)} 对面 ${dist(rs.map(r => r.rival))} · 成交 ${dist(rs.map(r => r.rivalWins))} 单`
      + ` · 领先 ${n(r => r.money > r.rival)}/打平 ${n(r => r.money === r.rival)}/落后 ${n(r => r.money < r.rival)}`);
  }
}

// 每天开出几件：罗曼的 quota 阶梯按这个分布定。
// 阶梯不改变模拟里的手法（honest 只按她的 maxUnits 开单），所以任一阶梯的达成率能在这里直接算出来 ——
// 一次跑完把几组候选都摆出来，选中哪组就写回 requests.ts 的常量。
console.log("\n每天开出几件（quota 阶梯按这个定）:");
{
  for (const style of STYLES) {
    const us = dayUnits.filter(x => x.style === style).map(x => x.units).sort((a, b) => a - b);
    const q = (p: number) => us[Math.min(us.length - 1, Math.floor(us.length * p))];
    console.log(`  ${style.padEnd(8)} 中位 ${q(0.5)} · P75 ${q(0.75)} · P90 ${q(0.9)} · 最高 ${us[us.length - 1]} 件/天`);
  }
  const ladder = (min: number, step: number, top: number) => (d: number) => Math.min(top, min + Math.floor((d - 1) / step));
  const rateOf = (t: (d: number) => number, style: Style) => {
    const us = dayUnits.filter(x => x.style === style);
    return Math.round(us.filter(x => x.units >= t(x.day)).length * 100 / us.length);
  };
  const now = ladder(QUOTA_MIN, QUOTA_STEP_DAYS, QUOTA_TOP);
  console.log(`  现在写死的这组（${QUOTA_MIN}→${QUOTA_TOP} 件，每 ${QUOTA_STEP_DAYS} 天一格）：`
    + `  ${STYLES.map(s => `${s} ${rateOf(now, s)}%`).join(" · ")}`);
  // 阶梯不改模拟里的手法（各风格按自己的方针卖货），任一组合的达成率都能在这里直接算完再挑。
  console.log("  候选（起步件数 → 封顶件数，每 N 天一格）：");
  for (const min of [2, 3]) for (const step of [28, 14, 10, 5]) for (const top of [min, min + 1, min + 2]) {
    const t = ladder(min, step, top);
    console.log(`    ${min}→${top} 件 / 每 ${String(step).padStart(2)} 天  `
      + STYLES.map(s => `${s} ${String(rateOf(t, s)).padStart(2)}%`).join(" · "));
  }
}

const ended = (r: Result, id: PersonId) => (r.arcs[id]?.end ?? 0) >= 1;
console.log("\n结局分布（rank 越小越好）:");
for (const style of STYLES) {
  const rs = results.filter(r => r.style === style);
  const counts = new Map<string, number>();
  for (const r of rs) counts.set(r.ending, (counts.get(r.ending) ?? 0) + 1);
  const line = [...counts.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1])
    .map(([id, n]) => `${id}(r${rank(id)})×${n}`)
    .join(" · ");
  console.log(`  ${style.padEnd(8)} ${line}`);
}

/** 主线那四句的 id：认的是它们的门槛读 s.act。改哪一句要同步这里（表只数命中，不参与判定）。 */
const MAINLINE_ENDINGS = new Set(["page-carried", "row-is-yours", "row-in-total", "row-still-open"]);
// 结局层逐季：同一句判词在哪几季被念到。主线那四句只该在退货单落地的那一季念一次，
// 往后的季还念它，人物层那十三句就被盖住（第 27 轮 8 副牌 × 6 季量到：第 5、6 季三个人物结局 0/32）。
// 纯读结果，不碰世界也不碰抽数。
console.log("\n结局层逐季命中（每格 = 四风格 × 这些副牌里落到这一句的牌数；* = 主线那四句）:");
{
  const bySeason = [{ season: 1, rs: results }, ...later.map(l => ({ season: l.season, rs: l.results }))];
  const ids = [...new Set(bySeason.flatMap(b => b.rs.map(r => r.ending)))].sort((a, b) => rank(a) - rank(b));
  console.log(`  ${"判词".padEnd(20)}${bySeason.map(b => `第${b.season}季`.padStart(7)).join("")}   合计`);
  for (const id of ids) {
    const cells = bySeason.map(b => b.rs.filter(r => r.ending === id).length);
    const label = MAINLINE_ENDINGS.has(id) ? `${id}*` : id;
    console.log(`  ${label.padEnd(20)}${cells.map(c => String(c).padStart(7)).join("")}   ${String(cells.reduce((a, c) => a + c, 0)).padStart(5)}`);
  }
  const kinds = bySeason.map(b => new Set(b.rs.map(r => r.ending)).size);
  console.log(`  ${"这一季出现过的不同判词".padEnd(18)}${kinds.map(c => String(c).padStart(7)).join("")}`);
}

/** 落点分布从读数里现推，不写死 1~4：梁夏那条有六档，第 5、6 档以前折在表外，只能拿 160 去减。 */
const endTally = (rows: Result[], id: string): string => {
  const seen = [...new Set(rows.map(r => r.arcs[id]?.end ?? 0))].filter(n => n >= 1).sort((a, b) => a - b);
  return seen.map(n => `end=${n} ${rows.filter(r => r.arcs[id]?.end === n).length}`).join(" ");
};

console.log("\n个人线走到终点（end≥1）:");
for (const id of linesOf(1)) {
  const bits = STYLES.map(style => {
    const rs = results.filter(r => r.style === style);
    const n = rs.filter(r => ended(r, id)).length;
    return `${style} ${n}/${N}`;
  });
  const ends = endTally(results, id);
  console.log(`  ${id.padEnd(8)} ${bits.join(" · ")} · ${ends}`);
}

// 每个种子里结局更好的风格是谁（rank 越小越好）；并列都算赢。
const wins: Record<Style, number> = { honest: 0, pushy: 0, social: 0, random: 0 };
for (let i = 0; i < N; i++) {
  const seed = `sim-${i}`;
  const mine = results.filter(r => r.seed === seed);
  const best = Math.min(...mine.map(r => rank(r.ending)));
  for (const r of mine.filter(r => rank(r.ending) === best)) wins[r.style]++;
}
const dominant = STYLES.filter(s => wins[s] === N);
console.log(`\n按种子算账（结局更好者赢，并列都算）: ${STYLES.map(s => `${s} ${wins[s]}/${N}`).join(" · ")}`);
console.log(dominant.length
  ? `⚠ ${dominant.join(",")} 在所有种子上都最优 —— 规则可能写坏了`
  : `没有哪种风格在所有种子上都最优`);

// 每日委托：每种风格说到做到的比例（作废与还没到期的不算进分母）。
console.log("\n每日委托（done / 已结算，未到期与作废不计）:");
for (const style of STYLES) {
  const rows = reqTallies.filter(r => r.style === style);
  const sum = (pick: (t: (typeof rows)[number]["tally"]) => number) => rows.reduce((a, r) => a + pick(r.tally), 0);
  const done = sum(t => t.done), failed = sum(t => t.failed), declined = sum(t => t.declined);
  const open = sum(t => t.open), vd = sum(t => t.void);
  const settled = done + failed + declined;
  console.log(`  ${style.padEnd(8)} ${settled ? `${Math.round(done * 100 / settled)}%` : "-"}`
    + `（done ${done} · failed ${failed} · declined ${declined} · 未到期 ${open} · 作废 ${vd}）`);
}
const REQ_KINDS = ["quota", "keep", "samples", "pair", "clean", "rebook"] as const;
console.log("  分模板（各风格 done/已结算）:");
for (const kind of REQ_KINDS) {
  const bits = STYLES.map(style => {
    const rows = reqTallies.filter(r => r.style === style).map(r => r.byKind[kind]).filter(Boolean);
    const sum = (s: RequestState) => rows.reduce((a, t) => a + (t?.[s] ?? 0), 0);
    const settled = sum("done") + sum("failed") + sum("declined");
    return `${style} ${settled ? `${Math.round(sum("done") * 100 / settled)}%(${sum("done")}/${settled})` : "-"}`;
  });
  console.log(`    ${kind.padEnd(8)} ${bits.join(" · ")}`);
}

// 自主社交动作：每种动作一季平均发生几次（跨种子、跨季平均）。
console.log("\n自主社交（每种动作一季平均几次）:");
for (const act of EXCHANGE_ACTS) {
  const bits = STYLES.map(style => {
    const xs = exTallies.filter(r => r.style === style).map(r => r.tally[act] ?? 0);
    const avg = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    return `${style} ${avg.toFixed(1)}`;
  });
  console.log(`  ${act.padEnd(8)} ${bits.join(" · ")}`);
}

// 每条个人线的落点分布（跨风格合计）。
const arcTable = new Map<PersonId, Map<string, number>>();
for (const r of results) {
  for (const p of people) {
    const arc = r.arcs[p.id];
    const key = arc && Object.keys(arc).length
      ? Object.entries(arc).map(([k, v]) => `${k}=${v}`).join(",") : "（未触发）";
    if (!arcTable.has(p.id)) arcTable.set(p.id, new Map());
    const row = arcTable.get(p.id)!;
    row.set(key, (row.get(key) ?? 0) + 1);
  }
}
console.log("\n每条个人线的落点分布（全风格合计）:");
for (const p of people) {
  const row = arcTable.get(p.id)!;
  console.log(`  ${p.id.padEnd(8)} ${[...row.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(" · ")}`);
}

// 第 2 季起：接着上一季的世界再跑一季，报结局分布和"谁倒戈了"。
for (const { season, results: rs2, flips } of later) {
  console.log(`\n== 第 ${season} 季（接着上一季的世界再跑 ${DAYS} 天）==`);
  console.log("风格      不同签名数   钱 (min/med/max)              柜位 (min/med/max)   台账 (min/med/max)");
  for (const style of STYLES) {
    const rs = rs2.filter(r => r.style === style);
    const signatures = new Set(rs.map(r => r.signature));
    console.log(`${style.padEnd(9)} ${String(signatures.size).padStart(4)}/${N}    ${dist(rs.map(r => r.money)).padEnd(30)} ${dist(rs.map(r => r.standing)).padEnd(22)} ${dist(rs.map(r => r.compliance))}`);
  }
  console.log("结局分布（rank 越小越好）:");
  for (const style of STYLES) {
    const rs = rs2.filter(r => r.style === style);
    const counts = new Map<string, number>();
    for (const r of rs) counts.set(r.ending, (counts.get(r.ending) ?? 0) + 1);
    const line = [...counts.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1])
      .map(([id, n]) => `${id}(r${rank(id)})×${n}`)
      .join(" · ");
    console.log(`  ${style.padEnd(8)} ${line}`);
  }
  console.log("倒戈（相对上一季盘点）:");
  for (const style of STYLES) {
    const fs = flips.filter(f => f.style === style);
    const tally = (key: "allyToEnemy" | "enemyToAlly") => {
      const ids = fs.flatMap(f => f[key]);
      const c = new Map<PersonId, number>();
      for (const id of ids) c.set(id, (c.get(id) ?? 0) + 1);
      const names = [...c.entries()].map(([id, n]) => (n > 1 ? `${id}×${n}` : id)).join(", ");
      return `${ids.length} 人次 / ${fs.filter(f => f[key].length).length} 个种子${names ? `（${names}）` : ""}`;
    };
    console.log(`  ${style.padEnd(8)} 盟友→仇人 ${tally("allyToEnemy")} · 仇人→盟友 ${tally("enemyToAlly")}`);
  }
  console.log("个人线走到终点（end≥1）:");
  for (const id of linesOf(season)) {
    const bits = STYLES.map(style => {
      const rs = rs2.filter(r => r.style === style);
      const n = rs.filter(r => (r.arcs[id]?.end ?? 0) >= 1).length;
      return `${style} ${n}/${N}`;
    });
    const all = rs2.filter(r => (r.arcs[id]?.end ?? 0) >= 1).length;
    const ends = endTally(rs2, id);
    console.log(`  ${id.padEnd(8)} ${bits.join(" · ")} · 合计 ${all}/${rs2.length} · ${ends}`);
  }
  // 这三个 id 是第 2 季才有的结局（ENDINGS 表里没有季号字段，只能这么点名）；
  // 第 3 季起这一行念的是"同一组在第 ${season} 季还出不出得来"，不是"本季新出"。
  console.log(`第 2 季那三个新结局（第 ${season} 季读数）:`);
  for (const id of ["names-stay", "own-sentence", "file-and-sheet"]) {
    const hits = rs2.filter(r => r.ending === id);
    const styles = STYLES.filter(style => hits.some(r => r.style === style));
    console.log(`  ${id.padEnd(16)} ${hits.length}/${rs2.length}（${styles.join(", ") || "无"}）`);
  }
}

// 内容燃烧曲线：新内容在第几天见底，见底之后每一抽都在重播已经看过的卡。
// "见底天"= 这个种子最后一个新内容（第一次抽到的卡）出现的绝对天；剩下的日子全是重复。
console.log("\n落点那一屏摆上桌几格（收尾卡被抽到那一刻，含四风格四种子的全部读数）:");
console.log("  线          抽到   中位露出  只给默认   各格露出率（#1 起按卡片里的顺序；门是死的会露出 0%）");
for (const id of ARC_PEOPLE) {
  const ex = endExposure.get(id);
  if (!ex?.seen) continue;
  const cells = Array.from({ length: ex.slots }, (_, i) => `#${i + 1} ${Math.round(((ex.perIndex[i] ?? 0) / ex.seen) * 100)}%`).join(" · ");
  console.log(`  ${id.padEnd(11)} ${String(ex.seen).padStart(4)}   ${String(median(ex.vis)).padStart(4)} 格  ` +
    `${String(Math.round((ex.onlyDefault / ex.seen) * 100)).padStart(4)}%    ${cells}`);
}

// 燃烧曲线看不出"这一季有没有剧情" —— 它数的是所有卡，而且见底那一列被窗口末尾夹住了（四季跑满永远是 112）。
// 这张表按 kind 只数个人线与主线，某一季中位新演 0 张就是那一季空着（第 4 季曾经整季只有过场）。
console.log(`\n每季的故事卡（个人线 + 主线；"新演" = 这副牌里第一次抽到它。各列取 ${runBurn.size} 副牌的中位）:`);
console.log("季   天数区间    抽到故事卡   新演   其中个人线  其中主线   故事卡占本季抽牌");
for (let season = 1; season <= SEASON_COUNT; season++) {
  const rows = [...runBurn.values()].map(b => b.perSeason.find(p => p.season === season)).filter((p): p is SeasonBurn => !!p);
  if (!rows.length) continue;
  const med = (f: (p: SeasonBurn) => number) => median(rows.map(f));
  const story = med(p => p.story), fresh = med(p => p.arcFirst.size + p.mainFirst.size);
  console.log(` ${String(season).padStart(2)}  ${String((season - 1) * DAYS + 1).padStart(3)}~${String(season * DAYS).padEnd(4)}  ` +
    `${String(story).padStart(7)} 次  ${String(fresh).padStart(4)} 张  ${String(med(p => p.arcFirst.size)).padStart(7)} 张` +
    `  ${String(med(p => p.mainFirst.size)).padStart(6)} 张      ${Math.round((story / Math.max(1, med(p => p.draws))) * 100)}%` +
    (fresh === 0 ? "   ← 这一季一张新剧情都没有，只剩过场在重演" : ""));
}

// 节奏表（第 23 轮）：回答「没玩就结束了」的另一半 —— 卡够不够是一回事，
// 有多少个时段玩家只能干点「下一时段」是另一回事。这一张表量后者。
const SLOT_WORDS = ["上午", "午后", "傍晚", "晚高峰"];
console.log(`\n每季的节奏（各列取 ${runBurn.size} 副牌的中位；"做不动" = 进这个时段时精力连最便宜的招呼（${VERB_ENERGY.greet} 点）都不够、或场上点不到人）:`);
console.log("季   时段数   抽到卡   做不动  其中缺劲  其中没人   只能读不能做   每时段做成几件  每天做成几件   做不动的时段落在哪一档");
for (let season = 1; season <= SEASON_COUNT; season++) {
  const rows = [...runBurn.values()].map(b => b.perSeason.find(p => p.season === season)).filter((p): p is SeasonBurn => !!p);
  if (!rows.length) continue;
  const med = (f: (p: SeasonBurn) => number) => median(rows.map(f));
  const avg = (f: (p: SeasonBurn) => number) => rows.reduce((a, p) => a + f(p), 0) / Math.max(1, rows.length);
  const slots = Math.max(1, med(p => p.slots));
  const starvedAll = rows.flatMap(p => p.starved);
  const hist = SLOT_WORDS.map((_, s) => `${SLOT_WORDS[s]} ${Math.round((starvedAll.filter(x => x === s).length / Math.max(1, starvedAll.length)) * 100)}%`).join(" · ");
  console.log(` ${String(season).padStart(2)}  ${String(slots).padStart(6)}  ` +
    `${String(Math.round((med(p => p.draws) / slots) * 100)).padStart(5)}%  ` +
    `${String(Math.round((starvedAll.length / rows.length / slots) * 100)).padStart(5)}%  ` +
    `${String(Math.round((avg(p => p.noEnergy) / slots) * 100)).padStart(7)}%  ` +
    `${String(Math.round((avg(p => p.noGuest) / slots) * 100)).padStart(7)}%  ` +
    `${String(Math.round((med(p => p.readOnly) / slots) * 100)).padStart(7)}%  ` +
    `${(med(p => p.acted) / slots).toFixed(2).padStart(9)} 件  ` +
    `${(med(p => p.acted) / DAYS).toFixed(2).padStart(9)} 件   ${starvedAll.length ? hist : "整季都有劲"}`);
}
console.log("（缺劲与没人按均值算，一个时段可以两条都占，所以两列加起来会略高于「做不动」。）");
console.log("\n四个时段开门那一刻（同样池化）：场上点得到几位 / 还剩多少劲");
console.log("档       上午    午后    傍晚   晚高峰");
console.log(`点得到   ${slotHands.map(h => String(median(h)).padStart(6)).join(" ")} 位`);
console.log(`剩精力   ${slotEnergy.map(e => String(Math.round(median(e))).padStart(6)).join(" ")} 点`);

// 桌上有几张戏可讲：每季每一格读一次，取**均值**（保留一位小数）。
// 为什么不是中位数：arc 卡要她本人在楼层上才绑得出槽，来客是错峰的，中位数会被一片 0 拿走
// —— 实测第 1 季"个人线未开头"那一列中位是 0，可同一副牌第 1 季讲了 47 次故事卡，两个数讲的是两件事。
// 只有「走完的线数」是中位的阶梯量（一季只涨不跌），那一列留中位。
// 读法：先看「走完的线还剩的卡」—— 如果是 0，后两季故事变薄就是"线走完就断"，不是权重偏心；
// 再看「个人线未开头 / 进行中」还够不够，那是补内容之前要知道的底。
console.log(`\n每季桌上有几张戏可讲（每天上午那一格数一次，各列取 ${[...deckCensus.values()].flat().length} 个读数的均值；"可抽" = 那一刻说书人那一摞里合法的张数）:`);
console.log(`季   ${CENSUS_COLS.map((c, i) => (i === 6 ? `${c}(中位)` : c).padStart(9)).join(" ")}`);
for (let season = 1; season <= SEASON_COUNT; season++) {
  const rows = deckCensus.get(season);
  if (!rows?.length) continue;
  const cell = (i: number) => (i === 6
    ? String(Math.round(median(rows.map(r => r[i]))))
    : (rows.reduce((a, r) => a + r[i], 0) / rows.length).toFixed(1));
  console.log(` ${String(season).padStart(2)}  ${CENSUS_COLS.map((_, i) => cell(i).padStart(9)).join(" ")}`);
}

// 柜位的进项与扣项：一处一笔一笔地数，别靠猜。（nextSeason 那一笔"跨季折半"发生在季与季之间，
// 不在这张表里 —— 它是写死的规则：新季从 (旧柜位 − 50) 的一半起步。）
console.log("\n柜位这一路谁在加、谁在扣（40 个种子合计：笔数 / 累计点数）:");
for (const [key, m] of [...standTally].sort()) {
  const [style, season] = key.split("|");
  const rows = [...m.entries()].sort((a, b) => b[1][1] - a[1][1]);
  console.log(`  ${season} ${style.padEnd(7)} ${rows.map(([where, [n, sum]]) => `${where} ${n} 次/${sum >= 0 ? "+" : ""}${sum}`).join(" · ")}`);
}
console.log("\n各风格挑过几次哪个动作（四季合计；括号 = 挑了却没做成、整格收手）:");
for (const st of STYLES) {
  const rows = [...verbTally].filter(([k]) => k.startsWith(`${st}|`)).sort((a, b) => b[1] - a[1]);
  console.log(`  ${st.padEnd(7)} ${rows.map(([k, n]) => {
    const f = verbFail.get(k) ?? 0;
    return `${k.split("|")[1]} ${n}${f ? `(${f} 空)` : ""}`;
  }).join(" · ")}`);
}

console.log(`\n内容燃烧曲线（${SEASON_COUNT} 季 × ${DAYS} 天 = ${SEASON_COUNT * DAYS} 天，跨季连着算）:`);
console.log("风格      见过的卡数   半池在第几天  八成在第几天  新内容见底  见底后还剩几天  整段重复率  第1季重复率");
for (const style of STYLES) {
  const bs = [...runBurn.entries()].filter(([k]) => k.startsWith(`${style}|`)).map(([, b]) => b);
  /** 这个种子的卡池按出现顺序排好，第 frac 张新内容出现在第几天。 */
  const dayAt = (b: RunBurn, frac: number) => {
    const sorted = [...b.firstDay.values()].sort((x, y) => x - y);
    return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * frac) - 1))] ?? 0;
  };
  const pct = (xs: number[]) => `${Math.round(median(xs) * 100)}%`;
  console.log(`  ${style.padEnd(8)} ${String(median(bs.map(b => b.firstDay.size))).padStart(6)}/${storylets.length}`
    + `        ${String(median(bs.map(b => dayAt(b, 0.5)))).padStart(6)} 天`
    + `        ${String(median(bs.map(b => dayAt(b, 0.8)))).padStart(6)} 天`
    + `      ${String(median(bs.map(b => dayAt(b, 1)))).padStart(4)} 天`
    + `        ${String(SEASON_COUNT * DAYS - median(bs.map(b => dayAt(b, 1)))).padStart(4)} 天`
    + `        ${pct(bs.map(b => (b.draws ? b.repeats / b.draws : 0)))}`
    + `        ${pct(bs.map(b => { const p = b.perSeason.find(x => x.season === 1); return p && p.draws ? p.repeats / p.draws : 0; }))}`);
}

// 主线本子：反转到底有没有被玩出来。幕号是跨季累计的（换季不清），所以一条种子就是一整段局。
if (source === "src/world/content") {
  const maxAct = MAINLINE_ACTS.length;
  console.log("\n主线本子（幕号与线索跨季带着走）:");
  console.log("风格      幕号（0 没开局 / 1 摆上桌 / 2 翻过面）    本子上条数   拧过来的线");
  for (const style of STYLES) {
    const ss = spines.filter(x => x.style === style);
    if (!ss.length) continue;
    const acts = Array.from({ length: maxAct + 1 }, (_, a) => `${a}:${ss.filter(x => x.act === a).length}`).join(" ");
    const turned = ss.filter(x => Object.values(x.ends).some(v => v >= 1)).length;
    console.log(`  ${style.padEnd(8)} ${acts.padEnd(30)}  ${String(median(ss.map(x => x.clues))).padStart(2)}/${CLUES.length}`
      + `      ${String(Math.round(turned / ss.length * 100)).padStart(3)}%`);
  }
  for (const thread of CLUE_THREADS) {
    const titleOf = (landing: number) =>
      landing === 0 ? "还没弄清" : threadLandings(storylets, thread.id).find(l => l.landing === landing)?.title ?? `第 ${landing} 档`;
    const landings = new Map<number, number>();
    for (const x of spines) {
      const v = x.ends[thread.id] ?? 0;
      landings.set(v, (landings.get(v) ?? 0) + 1);
    }
    console.log(`  ${thread.name}：`);
    for (const landing of [...landings.keys()].sort((a, b) => a - b)) {
      console.log(`    ${String(landing).padStart(2)} ${titleOf(landing)} ${landings.get(landing)}/${spines.length}`);
    }
  }
  // 主线各张卡有多少个种子真的碰到过：出场率低的卡就是门槛写死了，不是玩家不想看。
  console.log("  主线卡的出场率（几个种子里见过这张卡）:");
  for (const card of storylets.filter(s => s.kind === "mainline")) {
    const hits = [...runBurn.values()].filter(b => b.firstDay.has(card.id)).length;
    console.log(`    ${card.id.padEnd(22)} ${String(hits).padStart(3)}/${runBurn.size}  中位第 ${String(median([...runBurn.values()].filter(b => b.firstDay.has(card.id)).map(b => b.firstDay.get(card.id)!))).padStart(2)} 天`);
  }
}

// 卡的覆盖面：每种风格抽到过几张；所有风格合起来都没抽到过的卡单独列出来 —— 写了却永远出不来，要么条件写死，要么引擎没接上。
console.log("\n故事碎片覆盖（抽到过的张数 / 总张数）:");
for (const style of STYLES) console.log(`  ${style.padEnd(8)} ${fireCount.get(style)?.size ?? 0}/${storylets.length}`);
const everFired = new Set(STYLES.flatMap(style => [...(fireCount.get(style)?.keys() ?? [])]));
const never = storylets.filter(s => !everFired.has(s.id));
console.log(never.length ? `  从没出现过 ${never.length} 张：${never.map(s => s.id).join(" ")}` : "  每张卡都至少出现过一次");

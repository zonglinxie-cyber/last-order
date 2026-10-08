// 话术牌局五日平衡模拟：三条路线只通过 duel.ts 与 campaign.ts 的公开函数出牌。
// 单独跑：node --experimental-strip-types tests/duel-sim.ts
import {
  availableCustomers, canLeaveSample, CUSTOMERS, dayEvent, endingTitle, fitOf, fitScore,
  INITIAL, knownDemands, openFloorState, patienceLeft, QUESTIONS, revealOf, RIVAL_IDS,
  releaseService, settleDayEvent, startNextDay, TARGET, visibleChoices,
  type BundleId, type Campaign, type CustomerId, type ProductId,
} from "../src/campaign.ts";
import {
  DUEL_BUNDLE_AT, DUEL_CLOSE_MIN, duelClose, duelLook, duelMulligan, duelPlay, duelRandom,
  duelSendAway, duelTrial, duelUnlockedBundles, startDuel, type DuelState,
} from "../src/duel.ts";

type Route = "skilled" | "naive" | "grey" | "novice";
const PRODUCT_IDS: ProductId[] = ["soft", "glow", "repair"];
const CUE_ORDER = ["eyes", "cheek", "nose"] as const;

const bestProduct = (id: CustomerId): ProductId =>
  PRODUCT_IDS.reduce((a, b) => (fitScore(CUSTOMERS[id], b) > fitScore(CUSTOMERS[id], a) ? b : a));

// novice 不能看答案：只拿已揭示的诉求喂给 fitScore，没揭出来的 veto 也当作不知道；
// 平分时 reduce 的严格大于会保住 soft → glow → repair 的顺序。
const noviceBestProduct = (id: CustomerId, known: Set<string>): ProductId => {
  const her = CUSTOMERS[id];
  const partial = { ...her, demands: her.demands.filter(d => known.has(d.trait)),
    veto: her.veto && known.has(her.veto.trait) ? her.veto : undefined };
  return PRODUCT_IDS.reduce((a, b) => (fitScore(partial, b) > fitScore(partial, a) ? b : a));
};

// 她自己说过的上限对应的档位：1 件认 60，2 件认 80，更多认 100。
const targetBundle = (id: CustomerId): BundleId => {
  const cap = CUSTOMERS[id].maxUnits;
  return cap >= 4 ? "bulk" : cap === 3 ? "set" : cap === 2 ? "pair" : "single";
};
const highestUnlocked = (d: DuelState): BundleId | null => {
  const open = duelUnlockedBundles(d);
  return open.length ? open[open.length - 1] : null;
};

function tryClose(s: Campaign, d: DuelState, route: Route): Campaign | null {
  const customer = CUSTOMERS[d.customerId];
  const session = s.activeSession;
  if (!session?.tested) return null;
  let bundle: BundleId | null = null;
  if (route === "naive" || route === "novice") {
    // naive/novice：兴趣一到 60 就按已解锁的最高档开口。
    if (d.interest >= DUEL_CLOSE_MIN) bundle = highestUnlocked(d);
  } else {
    const wanted = targetBundle(d.customerId);
    if (d.interest >= 100 || d.interest >= DUEL_BUNDLE_AT[wanted]) bundle = wanted;
    // 「最后一句」里还够 60 就开已解锁的最高档，不够就由主循环送她走。
    else if (d.lastCall && d.interest >= DUEL_CLOSE_MIN) bundle = highestUnlocked(d);
  }
  if (!bundle) return null;
  if (RIVAL_IDS.includes(d.customerId) && !session.rivalChoice) return null; // 触发不了就还按牌走
  const res = duelClose(s, d, bundle);
  return res ? res.campaign : null;
}

// novice 按固定顺序看没看过的点：眼下 → 脸颊 → 鼻翼。
function lookNovice(s: Campaign, d: DuelState): { campaign: Campaign; duel: DuelState } {
  const cue = CUE_ORDER.find(id => !s.activeSession!.discovered.includes(id));
  return cue ? (duelLook(s, d, cue) ?? { campaign: s, duel: d }) : { campaign: s, duel: d };
}

// 每回合先看一处还没看过、能揭出新诉求的点位（skilled/grey 的上界可以"看答案"）。
function lookOnce(s: Campaign, d: DuelState): { campaign: Campaign; duel: DuelState } {
  const customer = CUSTOMERS[d.customerId];
  const cue = (Object.keys(customer.cues) as Array<"eyes" | "cheek" | "nose">)
    .find(id => !s.activeSession!.discovered.includes(id)
      && customer.cues[id].reveals.some(t => !s.activeSession!.revealed.includes(t)));
  return cue ? (duelLook(s, d, cue) ?? { campaign: s, duel: d }) : { campaign: s, duel: d };
}

// 主动作优先级（skilled/grey）：竞品插话 → 讲透这支（仅 positive）→ 已知诉求就试最适配的那支 →
// 有用的问牌 → 留小样 → 接住她这句 → 其它牌。grey 例外：手里有「夸下海口」就先打。
function pickAction(s: Campaign, d: DuelState, route: Route, naiveProduct: ProductId): { card?: string; trial?: { product: ProductId; side: "left" | "right" } } | null {
  if (d.rivalPending) return { card: "rival:clarify" };
  const session = s.activeSession!;
  const customer = CUSTOMERS[d.customerId];
  if (route === "naive") {
    if (!session.tested) return { trial: { product: naiveProduct, side: "left" } };
    return d.hand[0] ? { card: d.hand[0].id } : null;
  }
  if (route === "grey") {
    const grey = d.hand.find(c => c.kind === "overpromise");
    if (grey) return { card: grey.id };
  }
  const known = revealOf(customer, session.discovered, session.revealed);
  if (route === "novice") {
    // 没试过且知道 ≥1 条诉求：用「只含已知诉求的她」算 fitScore，不偷看答案。
    if (!session.tested) {
      if (knownDemands(customer, known).length >= 1) {
        return { trial: { product: noviceBestProduct(d.customerId, known), side: "left" } };
      }
    } else {
      const pitch = d.hand.find(c => c.kind === "pitch");
      if (pitch && d.current && session.reaction !== "negative") return { card: pitch.id };
    }
    const ask = d.hand.find(c => c.kind === "ask");
    if (ask) return { card: ask.id };
    const catched = d.hand.find(c => c.kind === "catch");
    if (catched) return { card: catched.id };
    const sample = d.hand.find(c => c.kind === "sample");
    if (sample && canLeaveSample(s, d.customerId)) return { card: sample.id };
    // 底线：手里只剩「夸下海口」也绝不打——宁可没动作空耗到「最后一句」。
    return null;
  }
  if (!session.tested && knownDemands(customer, known).length >= 1) {
    return { trial: { product: bestProduct(d.customerId), side: "left" } };
  }
  const pitch = d.hand.find(c => c.kind === "pitch");
  if (pitch && d.current && fitOf(customer, d.current).tier === "positive") return { card: pitch.id };
  const useful = d.hand.find(c => c.kind === "ask" && QUESTIONS[d.customerId][c.question!]?.useful);
  if (useful) return { card: useful.id };
  const sample = d.hand.find(c => c.kind === "sample");
  if (sample && canLeaveSample(s, d.customerId)) return { card: sample.id };
  const catched = d.hand.find(c => c.kind === "catch");
  if (catched) return { card: catched.id };
  const other = d.hand.find(c => c.kind !== "rival");
  return other ? { card: other.id } : null;
}

function runDuel(s: Campaign, d: DuelState, route: Route, day: number): Campaign {
  let state = s, duel = d;
  const naiveRoll = duelRandom(`naive:${day}:${d.customerId}`);
  const naiveProduct = PRODUCT_IDS[Math.floor(naiveRoll() * PRODUCT_IDS.length)];
  while (!duel.walked) {
    const closed = tryClose(state, duel, route);
    if (closed) return closed;
    // 「最后一句」：牌脸都锁了，只剩成交/硬推/目送她走；skilled/novice 不够 60 就送她走，naive 从不硬推。
    if (duel.lastCall) {
      const away = duelSendAway(state, duel);
      if (!away) break;
      state = away.campaign;
      duel = away.duel;
      continue;
    }
    if (route === "novice" && !duel.lookedThisRound) ({ campaign: state, duel } = lookNovice(state, duel));
    else if (route !== "naive" && !duel.lookedThisRound) ({ campaign: state, duel } = lookOnce(state, duel));
    const action = pickAction(state, duel, route, naiveProduct);
    if (!action) {
      // novice 唯一会空手的情况是只剩「夸下海口」：她宁可换话题烧一回合也不打这张牌。
      const swapped = duelMulligan(state, duel);
      if (swapped) { state = swapped.campaign; duel = swapped.duel; continue; }
      break;
    }
    const res = action.trial ? duelTrial(state, duel, action.trial.product, action.trial.side) : duelPlay(state, duel, action.card!);
    if (!res) break;
    state = res.campaign;
    duel = res.duel;
  }
  // 兜底：无论如何不能把一个还开着的 session 留在柜台上过夜。
  return duel.walked || !state.activeSession ? state : releaseService(state);
}

function runRoute(route: Route) {
  let s = openFloorState(INITIAL);
  const dayTotals: number[] = [];
  for (let day = 1; day <= 5; day++) {
    while (true) {
      const ids = availableCustomers(s);
      if (!ids.length) break;
      // skilled/grey/novice 先接耐心最少的那位；naive 按到场顺序。
      const order = route === "naive" ? ids : [...ids].sort((a, b) => patienceLeft(s, a) - patienceLeft(s, b));
      const started = order.map(id => startDuel(s, id)).find(Boolean);
      if (!started) break;
      s = runDuel(started.campaign, started.duel, route, day);
    }
    const event = dayEvent(s);
    const choice = visibleChoices(s, event)[0];
    if (choice) s = settleDayEvent(s, choice.id);
    dayTotals.push(s.daySales);
    s = day < 5 ? openFloorState(startNextDay(s)) : startNextDay(s);
  }
  return { s, dayTotals };
}

for (const route of ["skilled", "naive", "grey", "novice"] as Route[]) {
  const { s, dayTotals } = runRoute(route);
  const ending = endingTitle(s);
  console.log(`route=${route}  total=¥${s.sales.toLocaleString("zh-CN")}  days=[${dayTotals.join(", ")}]  lost=${s.lost.length} (${s.lost.join(",") || "—"})  compliance=${s.compliance}  ending=${ending}`);
}
const skilled = runRoute("skilled"), naive = runRoute("naive");
console.log(`verdict: skilled ${skilled.s.sales >= TARGET ? "≥" : "<"} ¥21,000 (${skilled.s.sales}); naive ${naive.s.sales < TARGET ? "<" : "≥"} ¥21,000 (${naive.s.sales})`);

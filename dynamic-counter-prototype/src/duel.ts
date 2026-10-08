// 话术牌局（?mode=duel）的纯规则层：不碰 React、不碰 DOM。
// 原则：这一层只组织"一局牌"怎么打，成交、断货、耐心、拼单、信任、台账全部交给
// campaign.ts 里已有的函数（startService / spendAttention / applyQuestion / applyRival /
// leaveSample / faceTrialReveal / closeService / releaseService），不另起一份销售经济。
// activeSession 的字段（discovered / revealed / askedQuestion / selectedProduct / tested /
// reaction / faceTrialled / faceTrialRevealed / rivalChoice / claimed / bundle）与旧版同一份，
// closeService 拿到的就是一个完整的旧版 session。
import {
  applyQuestion, applyRival, canLeaveSample, clamp, closeService, CUSTOMERS, faceTrialReveal,
  fitOf, flag, hasFlag, history, leaveSample, QUESTIONS, REACTIONS, releaseService, revealOf,
  RIVAL_IDS, RIVAL_INTERRUPTIONS, spendAttention, startService, TRAIT_LABELS,
  type BundleId, type Campaign, type CueId, type CustomerId, type FitTier, type ProductId,
  type RivalChoice, type SaleOutcome, type Trait,
} from "./campaign.ts";

export const DUEL_SAVE_KEY = "last-order-duel-v1";
export const DUEL_GUIDE_KEY = "last-order-duel-guide-v1";
export const DUEL_START_INTEREST = 30;
export const DUEL_INTEREST_MAX = 100;
export const DUEL_CLOSE_MIN = 60;
export const DUEL_BUNDLE_AT: Record<BundleId, number> = { single: 60, pair: 75, set: 90, bulk: 90 };
export const DUEL_HAND_SIZE = 4;
export const DUEL_LOOK_BONUS = 4;
export const DUEL_ASK_GOOD = 12;
export const DUEL_ASK_BAD = -8;
export const DUEL_CATCH_BONUS = 8;
export const DUEL_SAMPLE_BONUS = 10;
export const DUEL_OVERPROMISE_BONUS = 25;
export const DUEL_OVERPROMISE_COMPLIANCE = -8;
export const DUEL_MULLIGAN_COST = -3;
export const DUEL_RIVAL_ROUND = 3;
export const DUEL_RIVAL_HIT = -12;
export const DUEL_RIVAL_DELTA: Record<RivalChoice, number> = { record: 0, clarify: 6, yield: 10 };
export const DUEL_TRIAL_DELTA: Record<FitTier, number> = { positive: 20, mixed: 4, negative: -12 };
export const DUEL_PITCH_DELTA: Record<FitTier, number> = { positive: 18, mixed: 2, negative: -15 };

export type DuelCardKind = "ask" | "catch" | "sample" | "overpromise" | "pitch" | "rival";
export type DuelCard = { id: string; kind: DuelCardKind; title: string; hint?: string; question?: number; rival?: RivalChoice };
export type DuelLogEntry = { who: "her" | "you" | "note"; text: string; delta?: number };
export type DuelSide = "left" | "right";

export type DuelState = {
  customerId: CustomerId;
  round: number;
  rounds: number;
  interest: number;
  lookedThisRound: boolean;
  deck: DuelCard[];
  hand: DuelCard[];
  trials: { left?: ProductId; right?: ProductId };
  current: ProductId | null;
  pitchUsed: boolean;
  mulliganUsed: boolean;
  rivalPending: boolean;
  rivalDone: boolean;
  usefulAsked: number | null;
  lastAsked: number | null;
  log: DuelLogEntry[];
  // 规格字段之外的三个状态件：竞品插话时原手牌要原样奉还；回合耗尽先给最后一次开口的机会
  // （lastCall），她真的走了才置 walked 让 UI 换屏。
  stashedHand: DuelCard[];
  lastCall: boolean;
  walked: boolean;
};

const CUE_IDS: CueId[] = ["eyes", "cheek", "nose"];
export const DUEL_CUES = CUE_IDS;
export const DUEL_LAST_CALL_LINE = "她看了眼表：就这样吧，你说个数。";
export const DUEL_RIVAL_CARDS: DuelCard[] = [
  { id: "rival:record", kind: "rival", title: "记录在案", rival: "record", hint: "留痕 · 兴趣不变" },
  { id: "rival:clarify", kind: "rival", title: "当面讲清", rival: "clarify", hint: "+6" },
  { id: "rival:yield", kind: "rival", title: "让她拼单", rival: "yield", hint: "+10 · 业绩各半" },
];
export const DUEL_PITCH_CARD: DuelCard = { id: "pitch", kind: "pitch", title: "讲透这一支" };

const RIVAL_RESPOND_LINE: Record<RivalChoice, string> = {
  record: "你把陆遥这句话记进了接待本。",
  clarify: "你当着沈薇的面把这单说清楚了。",
  yield: "你让她跟陆遥拼这一单。",
};

// 种子洗牌：牌序由「哪天 + 哪位顾客」决定，刷新不会换一副牌。
function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function duelRandom(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 牌面标题最多 8 个字：扇形手牌放不下整句问题，问牌的完整问法在打出那一瞬的台词里。
const shortTitle = (label: string) => (label.length > 8 ? `${label.slice(0, 7)}…` : label);

export function duelDeck(day: number, id: CustomerId): DuelCard[] {
  const deck: DuelCard[] = QUESTIONS[id].map((q, index) => ({ id: `ask:${index}`, kind: "ask", title: shortTitle(q.label), question: index }));
  deck.push({ id: "catch", kind: "catch", title: "接住她这句" });
  deck.push({ id: "sample", kind: "sample", title: "留一支小样" });
  deck.push({ id: "overpromise", kind: "overpromise", title: "夸下海口" });
  const rand = duelRandom(`${day}:${id}`);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export const duelRounds = (customer: { patience: number }) => (customer.patience >= 10 ? 6 : 5);

export function startDuel(s: Campaign, id: CustomerId): { campaign: Campaign; duel: DuelState } | null {
  const started = startService(s, id);
  if (!started.activeSession || started.activeSession.customerId !== id) return null;
  const deck = duelDeck(s.day, id);
  const duel: DuelState = {
    customerId: id, round: 0, rounds: duelRounds(CUSTOMERS[id]), interest: DUEL_START_INTEREST,
    lookedThisRound: false, deck: deck.slice(DUEL_HAND_SIZE), hand: deck.slice(0, DUEL_HAND_SIZE),
    trials: {}, current: null, pitchUsed: false, mulliganUsed: false,
    rivalPending: false, rivalDone: false, usefulAsked: null, lastAsked: null,
    log: [{ who: "her", text: CUSTOMERS[id].opening }], stashedHand: [], lastCall: false, walked: false,
  };
  return { campaign: started, duel };
}

const say = (d: DuelState, who: DuelLogEntry["who"], text: string, delta?: number): DuelState =>
  ({ ...d, log: [...d.log, { who, text, ...(delta === undefined ? {} : { delta }) }] });

// 一次主动作的收尾：扣柜台另一边一分钟；回合用尽不直接赶人，先进「最后一句」——
// 她还在听你说个数，看脸出牌试用都不再有机会；轮到第 3 回合陆遥插话。
function endRound(s: Campaign, d: DuelState): { campaign: Campaign; duel: DuelState } {
  const next = spendAttention(s, d.customerId, 1);
  const duel = { ...d, round: d.round + 1, lookedThisRound: false };
  if (duel.round >= duel.rounds) {
    return { campaign: next, duel: { ...duel, lastCall: true, log: [...duel.log, { who: "her", text: DUEL_LAST_CALL_LINE }] } };
  }
  if (RIVAL_IDS.includes(d.customerId) && !duel.rivalDone && !duel.rivalPending && duel.round === DUEL_RIVAL_ROUND - 1) {
    const quote = RIVAL_INTERRUPTIONS[d.customerId as "shen" | "zhou" | "returning"].quote;
    const hit = { ...duel, rivalPending: true, stashedHand: duel.hand, hand: [...DUEL_RIVAL_CARDS], interest: clamp(duel.interest + DUEL_RIVAL_HIT) };
    return { campaign: next, duel: { ...hit, log: [...hit.log, { who: "note", text: `陆遥插话：${quote}` }, { who: "note", text: "", delta: DUEL_RIVAL_HIT }] } };
  }
  return { campaign: next, duel };
}

const drawOne = (d: DuelState, hand: DuelCard[]): { deck: DuelCard[]; hand: DuelCard[] } =>
  ({ deck: d.deck.slice(1), hand: d.deck.length ? [...hand, d.deck[0]] : hand });

// 看脸：每回合一处免费。看过的点还能再点（不扣不加），只把那句话再念一遍。
export function duelLook(s: Campaign, d: DuelState, cue: CueId): { campaign: Campaign; duel: DuelState } | null {
  const session = s.activeSession;
  if (!session || session.customerId !== d.customerId || d.walked || d.lastCall || d.round >= d.rounds) return null;
  const customer = CUSTOMERS[d.customerId];
  const spot = customer.cues[cue];
  if (session.discovered.includes(cue)) return { campaign: s, duel: say(d, "her", spot.finding) };
  if (d.lookedThisRound) return null;
  const known = revealOf(customer, session.discovered, session.revealed);
  const revealed = [...new Set([...session.revealed, ...spot.reveals])];
  const bonus = spot.reveals.some(trait => !known.has(trait)) ? DUEL_LOOK_BONUS : 0;
  const duel: DuelState = { ...d, lookedThisRound: true, interest: clamp(d.interest + bonus) };
  duel.log = [...duel.log, { who: "her", text: spot.finding }, ...(bonus ? [{ who: "note" as const, text: "", delta: bonus }] : [])];
  return { campaign: { ...s, activeSession: { ...session, discovered: [...session.discovered, cue], revealed } }, duel };
}

export function duelPlay(s: Campaign, d: DuelState, cardId: string): { campaign: Campaign; duel: DuelState } | null {
  const session = s.activeSession;
  if (!session || session.customerId !== d.customerId || d.walked || d.lastCall || d.round >= d.rounds) return null;
  const card = d.hand.find(item => item.id === cardId);
  if (!card) return null;
  const customer = CUSTOMERS[d.customerId];

  if (d.rivalPending) {
    // 应对竞品是这一回合的主动作：打完交还手牌、写进 session、照旧扣一分钟。
    if (card.kind !== "rival" || !card.rival) return null;
    const applied = applyRival(s, card.rival);
    const delta = DUEL_RIVAL_DELTA[card.rival];
    const sessioned: Campaign = { ...applied, activeSession: { ...session, rivalChoice: card.rival, claimed: session.claimed || card.rival === "record" } };
    let duel: DuelState = { ...d, rivalPending: false, rivalDone: true, interest: clamp(d.interest + delta), hand: d.stashedHand, stashedHand: [] };
    duel.log = [...duel.log, { who: "you", text: RIVAL_RESPOND_LINE[card.rival] }, ...(delta ? [{ who: "note" as const, text: "", delta }] : [])];
    return endRound(sessioned, duel);
  }
  if (card.kind === "rival") return null;

  const rest = d.hand.filter(item => item.id !== card.id);
  if (card.kind === "ask") {
    const q = QUESTIONS[d.customerId][card.question!];
    if (!q) return null;
    const delta = q.useful ? DUEL_ASK_GOOD : DUEL_ASK_BAD;
    const usefulAsked = d.usefulAsked ?? (q.useful ? card.question! : null);
    const lastAsked = card.question!;
    const revealed = [...new Set([...session.revealed, ...q.reveals])];
    const asked = applyQuestion(s, d.customerId, card.question!);
    const next: Campaign = { ...asked, activeSession: { ...session, revealed, askedQuestion: usefulAsked ?? lastAsked } };
    const drawn = drawOne(d, rest);
    const duel: DuelState = { ...d, ...drawn, usefulAsked, lastAsked, interest: clamp(d.interest + delta) };
    duel.log = [...duel.log, { who: "you", text: q.label }, { who: "her", text: q.response }, { who: "note", text: "", delta }];
    return endRound(next, duel);
  }
  if (card.kind === "catch") {
    const drawn = drawOne(d, rest);
    const duel: DuelState = { ...d, ...drawn, interest: clamp(d.interest + DUEL_CATCH_BONUS) };
    duel.log = [...duel.log, { who: "you", text: "你把这句话接住了。" }, { who: "note", text: "", delta: DUEL_CATCH_BONUS }];
    return endRound(s, duel);
  }
  if (card.kind === "sample") {
    if (!canLeaveSample(s, d.customerId)) return null;
    const next = leaveSample(s, d.customerId);
    const drawn = drawOne(d, rest);
    const duel: DuelState = { ...d, ...drawn, interest: clamp(d.interest + DUEL_SAMPLE_BONUS) };
    duel.log = [...duel.log, { who: "you", text: `你留了一支小样给${customer.name}。` }, { who: "note", text: "", delta: DUEL_SAMPLE_BONUS }];
    return endRound(next, duel);
  }
  if (card.kind === "overpromise") {
    const next: Campaign = { ...s, compliance: clamp(s.compliance + DUEL_OVERPROMISE_COMPLIANCE),
      flags: flag(s, `duel-overpromise:${d.customerId}`), history: history(s, `你对${customer.name}把效果说满了`) };
    const drawn = drawOne(d, rest);
    const duel: DuelState = { ...d, ...drawn, interest: clamp(d.interest + DUEL_OVERPROMISE_BONUS) };
    duel.log = [...duel.log, { who: "you", text: "你把效果说满了——这句以后会回来找你。" }, { who: "note", text: "", delta: DUEL_OVERPROMISE_BONUS }];
    return endRound(next, duel);
  }
  if (card.kind === "pitch") {
    if (!d.current || d.pitchUsed || !session.tested) return null;
    const tier = fitOf(customer, d.current).tier;
    const delta = DUEL_PITCH_DELTA[tier];
    const drawn = drawOne(d, rest);
    const line: Record<FitTier, string> = {
      positive: "你把这支讲到了她最在意的那件事上。",
      mixed: "她听完了，点了一下头，没接话。",
      negative: "越讲越不对，她皱眉把手收了回去。",
    };
    const duel: DuelState = { ...d, ...drawn, pitchUsed: true, interest: clamp(d.interest + delta) };
    duel.log = [...duel.log, { who: "you", text: line[tier] }, { who: "note", text: "", delta }];
    return endRound(s, duel);
  }
  return null;
}

// 换话题：手上的牌放回牌堆底重抽四张，烧掉这一回合，也烧掉她一点耐心。
export function duelMulligan(s: Campaign, d: DuelState): { campaign: Campaign; duel: DuelState } | null {
  if (!s.activeSession || s.activeSession.customerId !== d.customerId || d.walked || d.lastCall || d.round >= d.rounds || d.mulliganUsed || d.rivalPending) return null;
  const deck = [...d.deck, ...d.hand];
  const duel: DuelState = { ...d, deck: deck.slice(DUEL_HAND_SIZE), hand: deck.slice(0, DUEL_HAND_SIZE),
    mulliganUsed: true, interest: clamp(d.interest + DUEL_MULLIGAN_COST) };
  duel.log = [...duel.log, { who: "you", text: "你把话头收了回来，重新起一局。" }, { who: "note", text: "", delta: DUEL_MULLIGAN_COST }];
  return endRound(s, duel);
}

// 试用是拖拽的那一步，也是一次主动作：一半脸只能放一支，同一支不能上两边，最多两次。
export function duelTrial(s: Campaign, d: DuelState, product: ProductId, side: DuelSide): { campaign: Campaign; duel: DuelState } | null {
  const session = s.activeSession;
  if (!session || session.customerId !== d.customerId || d.walked || d.lastCall || d.round >= d.rounds || d.rivalPending) return null;
  if (d.trials[side]) return null;
  const other = side === "left" ? d.trials.right : d.trials.left;
  if (other === product) return null;
  const customer = CUSTOMERS[d.customerId];
  const tier = fitOf(customer, product).tier;
  const delta = DUEL_TRIAL_DELTA[tier];
  const trials = { ...d.trials, [side]: product };
  let sessioned = { ...session, selectedProduct: product, tested: true, reaction: tier };
  let hand = d.hand;
  // 「讲透这一支」不占抽牌：第一次有东西上了她的脸，这张牌才出现在手里。
  if (!d.trials.left && !d.trials.right && !hand.some(item => item.kind === "pitch")) hand = [...hand, { ...DUEL_PITCH_CARD }];
  let log: DuelLogEntry[] = [...d.log, { who: "her", text: REACTIONS[product][tier] }, { who: "note", text: "", delta }];
  if (trials.left && trials.right && !sessioned.faceTrialled) {
    // 两半都上了脸，她自己对着镜子比两边：这一步只买信息，不加兴趣。
    const shown = faceTrialReveal(customer, sessioned.discovered, sessioned.revealed);
    sessioned = { ...sessioned, faceTrialled: true, faceTrialRevealed: shown,
      revealed: shown ? [...new Set([...sessioned.revealed, shown])] : sessioned.revealed };
    log = [...log, { who: "her", text: shown ? `两边一比，她自己看出来了：${TRAIT_LABELS[shown]}。` : "她对着镜子看了两边，没有新的话。" }];
  }
  const next: Campaign = { ...s, activeSession: sessioned };
  const duel: DuelState = { ...d, trials, current: product, hand, interest: clamp(d.interest + delta), log };
  return endRound(next, duel);
}

// 陆遥不会让她安静地开单：竞品顾客在插话被应对之前，成交与硬推都先触发插话。
// UI 在按下成交但 rivalDone 为假时调用它；规则层自己不消耗回合。
export function duelTriggerRival(d: DuelState): DuelState | null {
  if (d.rivalDone || d.rivalPending || d.walked || !RIVAL_IDS.includes(d.customerId)) return null;
  const quote = RIVAL_INTERRUPTIONS[d.customerId as "shen" | "zhou" | "returning"].quote;
  return { ...d, rivalPending: true, stashedHand: d.hand, hand: [...DUEL_RIVAL_CARDS],
    interest: clamp(d.interest + DUEL_RIVAL_HIT),
    log: [...d.log, { who: "note", text: `陆遥插话：${quote}` }, { who: "note", text: "", delta: DUEL_RIVAL_HIT }] };
}

export const duelUnlockedBundles = (d: DuelState): BundleId[] =>
  (Object.keys(DUEL_BUNDLE_AT) as BundleId[]).filter(bundle => d.interest >= DUEL_BUNDLE_AT[bundle]);

// 「最后一句」里的第三个选择：玩家不开口，她自己走。结果屏照旧念 lostLine。
export function duelSendAway(s: Campaign, d: DuelState): { campaign: Campaign; duel: DuelState } | null {
  const session = s.activeSession;
  if (!session || session.customerId !== d.customerId || d.walked || !d.lastCall) return null;
  const customer = CUSTOMERS[d.customerId];
  return { campaign: releaseService(s), duel: { ...d, walked: true, log: [...d.log, { who: "note", text: customer.lostLine }] } };
}

// 提出成交：档位写进 session.bundle，件数与金额全部交给 resolveSale（经 closeService）。
// 适配是 negative 时她不买单——靠嘴堆上去的兴趣买不动不合适的东西。
export function duelClose(s: Campaign, d: DuelState, bundle: BundleId): { campaign: Campaign; outcome: SaleOutcome } | null {
  const session = s.activeSession;
  if (!session || session.customerId !== d.customerId || d.walked || !session.tested) return null;
  if (d.interest < Math.max(DUEL_CLOSE_MIN, DUEL_BUNDLE_AT[bundle])) return null;
  if (RIVAL_IDS.includes(d.customerId) && !session.rivalChoice) return null;
  const chosen: Campaign = { ...s, activeSession: { ...session, bundle } };
  return closeService(chosen, false);
}

// 硬推：试用过就能按，不需要兴趣门槛；件数按 single 开，风险与退款照旧由 resolveSale 记。
export function duelForce(s: Campaign, d: DuelState): { campaign: Campaign; outcome: SaleOutcome } | null {
  const session = s.activeSession;
  if (!session || session.customerId !== d.customerId || d.walked || !session.tested) return null;
  if (RIVAL_IDS.includes(d.customerId) && !session.rivalChoice) return null;
  const chosen: Campaign = { ...s, activeSession: { ...session, bundle: "single" } };
  return closeService(chosen, true);
}

export const hasOverpromised = (s: Campaign, id: CustomerId) => hasFlag(s, `duel-overpromise:${id}`);
export type { Trait };

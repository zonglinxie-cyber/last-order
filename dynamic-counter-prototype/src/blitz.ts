// 速诊（?mode=blitz）的纯规则层：不碰 React、不碰 DOM。
// 一局 240 秒、最多 3 个主动作回合接完一位就换下一位，没有楼层、跨日账和闭店事件。
// 成交、断货、拼单、台账全部仍走 campaign.ts 的 closeService/resolveSale；牌局怎么走
// 仍走 duel.ts（look/play/trial/mulligan/sendAway/close），这里只包倒计时、队列与计分。
// 不放进 duel.ts 的原因：同一时刻别的任务在动 duel 的签名，这层薄包装自己消化差异。
import {
  CUSTOMERS, flag, history, INITIAL, WEEK_ALLOCATION,
  type BundleId, type Campaign, type CueId, type CustomerId, type CustomerSession,
  type ProductId, type SaleOutcome,
} from "./campaign.ts";
import {
  DUEL_START_INTEREST, duelClose, duelDeck, duelLook, duelMulligan, duelPlay, duelRandom,
  duelSendAway, duelTrial, type DuelCard, type DuelLogEntry, type DuelSide, type DuelState,
} from "./duel.ts";

export const BLITZ_SAVE_KEY = "last-order-blitz-v1";
export const BLITZ_BEST_KEY = "last-order-blitz-best";
export const BLITZ_SECONDS = 240;
// 每回合固定占 8 秒：玩家按下的每一格（看脸、出牌、试用、换话题、开口收单）都从同一只
// 表上扣 8 秒，走完 duel 的那一步就扣这一格——240 秒约等于 30 格，烧完的队就截在那儿。
export const BLITZ_ACTION_SECONDS = 8;
export const BLITZ_ROUNDS = 3;
export const BLITZ_HAND_SIZE = 4;
export const BLITZ_QUEUE_MIN = 5;
export const BLITZ_QUEUE_MAX = 7;
// 速诊把队伍钉在一个不存在的那一天上：floorCustomers 为空，spendAttention 就不会再
// 用五日剧情的阵容把排队的顾客耗走；入场不再经 startService，是因为那一关要"今天的
// 轮班表"，速诊没有。
export const BLITZ_DAY = 6;

export type BlitzServed = { id: CustomerId; outcome: SaleOutcome };
export type BlitzScore = { sales: number; served: number; clean: number };
export type BlitzState = {
  seed: string;
  // 依次进场的顾客名单（去掉了陆遥插话的那三位竞品顾客，牌堆也没有 rival/overpromise）。
  queue: CustomerId[];
  // 下一位在 queue 里的位置；接待中的就是 queue[customerIndex-1]。
  customerIndex: number;
  // 走到报价的有小票；没等到的只有名字与那句走了的话。
  served: BlitzServed[];
  walked: CustomerId[];
  score: BlitzScore;
  // 换人与收尾的公告行：谁走了、谁坐下来、结算开始。牌桌内的对话仍在 duel.log 里。
  log: DuelLogEntry[];
  duel: DuelState | null;
  secondsLeft: number;
  over: boolean;
};
export type BlitzRun = { campaign: Campaign; blitz: BlitzState };

// 排队的是柜上不会出现竞品插话的那几位：3 回合里没有空间给"应对陆遥"这张牌。
export const BLITZ_POOL: CustomerId[] = (Object.keys(CUSTOMERS) as CustomerId[])
  .filter(id => !CUSTOMERS[id].rival);

export function blitzQueue(seed: string): CustomerId[] {
  const rand = duelRandom(`queue:${seed}`);
  const count = BLITZ_QUEUE_MIN + Math.floor(rand() * (BLITZ_QUEUE_MAX - BLITZ_QUEUE_MIN + 1));
  const pool = [...BLITZ_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// 一副小牌组：duelDeck 洗出来的那副去掉「夸下海口」与陆遥应对牌。牌序由"种子 × 第几位"
// 决定——换人洗牌是真实的牌堆动作，同一个种子进同一位顾客还是同一副牌。
export function blitzDeck(seed: string, index: number, id: CustomerId): DuelCard[] {
  const daySeed = Math.floor(duelRandom(`deck:${seed}:${index}:${id}`)() * 1_000_000) + 1;
  return duelDeck(daySeed, id).filter(card => card.kind !== "overpromise" && card.kind !== "rival");
}

// 不开 startService：那一关要求顾客在当日轮班表里，速诊的队是全柜随机的。
// session 字段与 startService 立出来的一模一样，closeService/resolveSale 拿它不用分新旧。
const freshSession = (id: CustomerId): CustomerSession => ({
  customerId: id, discovered: [], askedQuestion: null, selectedProduct: null, bundle: "single",
  revealed: [], tested: false, reaction: null, faceTrialled: false, faceTrialRevealed: null,
  revisions: 0, claimed: false, rivalChoice: null, chat: [], visitMinutes: 0,
});

const announce = (b: BlitzState, text: string): BlitzState =>
  ({ ...b, log: [...b.log, { who: "note", text }] });

function seatNext(s: Campaign, b: BlitzState): BlitzRun {
  const id = b.queue[b.customerIndex];
  if (!id || b.secondsLeft <= 0) return finish(s, b);
  const deck = blitzDeck(b.seed, b.customerIndex, id);
  const duel: DuelState = {
    customerId: id, round: 0, rounds: BLITZ_ROUNDS, interest: DUEL_START_INTEREST,
    lookedThisRound: false, deck: deck.slice(BLITZ_HAND_SIZE), hand: deck.slice(0, BLITZ_HAND_SIZE),
    trials: {}, current: null, pitchUsed: false, mulliganUsed: false,
    // 竞品插话在速诊里不存在：既不会触发，也不必在成交前先挡一道。
    rivalPending: false, rivalDone: true, usefulAsked: null, lastAsked: null,
    log: [{ who: "her", text: CUSTOMERS[id].opening }], stashedHand: [], lastCall: false, walked: false,
  };
  const campaign: Campaign = { ...s, activeSession: freshSession(id) };
  const blitz = announce(
    { ...b, customerIndex: b.customerIndex + 1, duel },
    `${CUSTOMERS[id].name}坐到了镜前`,
  );
  return { campaign, blitz };
}

// 结算：这一局再没有下一位。计时表归零和队伍打空走同一个出口。
function finish(s: Campaign, b: BlitzState): BlitzRun {
  return { campaign: s, blitz: announce({ ...b, over: true }, "计分牌已经翻开") };
}

// 倒计时到 0：当前这位立刻走——她不等一句还没说完的话。走的不经 releaseService，
// 因为那一行"把注意力留给另一位顾客"说错了话；这里只有时间用完这一个原因。
function walkOut(s: Campaign, b: BlitzState): BlitzRun {
  const duel = b.duel;
  if (!duel) return finish(s, b);
  const customer = CUSTOMERS[duel.customerId];
  const campaign: Campaign = {
    ...s, activeSession: null,
    lost: s.lost.includes(customer.id) ? s.lost : [...s.lost, customer.id],
    flags: flag(s, `lost:${customer.id}`),
    history: history(s, customer.lostLine),
  };
  const blitz = announce({
    ...b, duel: { ...duel, walked: true },
    walked: [...b.walked, customer.id],
    score: { ...b.score, served: b.score.served + 1 },
  }, `${customer.name}没等到你开口`);
  return finish(campaign, blitz);
}

// 一次主动作之后从同一只表扣 8 秒；扣到 0 的那一格强制送走当前顾客并进结算。
// UI 与测试也可以用 blitzTick 快进/慢进表，不走真实时钟。
export function blitzTick(run: BlitzRun, seconds = BLITZ_ACTION_SECONDS): BlitzRun {
  const b = run.blitz;
  if (b.over || !Number.isFinite(seconds) || seconds <= 0) return run;
  const secondsLeft = Math.max(0, b.secondsLeft - seconds);
  if (secondsLeft <= 0) return walkOut(run.campaign, { ...b, secondsLeft });
  return { campaign: run.campaign, blitz: { ...b, secondsLeft } };
}

export function startBlitz(seed: string): BlitzRun {
  const campaign: Campaign = {
    ...INITIAL, day: BLITZ_DAY,
    // 一局按整周配货开抽屉：速诊没有"按天到货"，断货仍然是一张真实的嘴。
    stock: { ...WEEK_ALLOCATION },
    waitMeters: {}, floorSeconds: 0, shiftMinutes: 0,
  };
  const blitz: BlitzState = {
    seed, queue: blitzQueue(seed), customerIndex: 0, served: [], walked: [],
    score: { sales: 0, served: 0, clean: 0 }, log: [], duel: null,
    secondsLeft: BLITZ_SECONDS, over: false,
  };
  return seatNext(campaign, blitz);
}

// 看脸不占主动作格，但走表：免费是免回合，不是免时间。每回合固定 8 秒走表，说的是
// 玩家每按一下都烧 8 秒——不然 21 个回合怎么也烧不完 240 秒，倒计时就成了装饰。
export function blitzLook(run: BlitzRun, cue: CueId): BlitzRun | null {
  const b = run.blitz;
  if (b.over || !b.duel) return null;
  return actThenTick(duelLook(run.campaign, b.duel, cue), b);
}

const actThenTick = (res: { campaign: Campaign; duel: DuelState } | null, b: BlitzState): BlitzRun | null => {
  if (!res) return null;
  return blitzTick({ campaign: res.campaign, blitz: { ...b, duel: res.duel } }, BLITZ_ACTION_SECONDS);
};

export function blitzPlay(run: BlitzRun, cardId: string): BlitzRun | null {
  const b = run.blitz;
  if (b.over || !b.duel) return null;
  return actThenTick(duelPlay(run.campaign, b.duel, cardId), b);
}

export function blitzTrial(run: BlitzRun, product: ProductId, side: DuelSide): BlitzRun | null {
  const b = run.blitz;
  if (b.over || !b.duel) return null;
  return actThenTick(duelTrial(run.campaign, b.duel, product, side), b);
}

export function blitzMulligan(run: BlitzRun): BlitzRun | null {
  const b = run.blitz;
  if (b.over || !b.duel) return null;
  return actThenTick(duelMulligan(run.campaign, b.duel), b);
}

// 「最后一句」里的送走：duel 照旧把 lostLine 写回，这里再把名字放进这一局的走客名单。
export function blitzSendAway(run: BlitzRun): BlitzRun | null {
  const b = run.blitz;
  if (b.over || !b.duel) return null;
  const res = duelSendAway(run.campaign, b.duel);
  if (!res) return null;
  const id = b.duel.customerId;
  const blitz = announce({ ...b, walked: [...b.walked, id], score: { ...b.score, served: b.score.served + 1 } },
    `${CUSTOMERS[id].name}走了`);
  return seatNext(res.campaign, { ...blitz, duel: res.duel });
}

export type BlitzCloseResult = { run: BlitzRun; outcome: SaleOutcome };

// 成交或拒绝：件数、金额、断货、台账全部落在 duelClose→closeService→resolveSale 那一条
// 链上，这里只把这一位记进小票并叫下一位。
export function blitzClose(run: BlitzRun, bundle: BundleId): BlitzCloseResult | null {
  const b = run.blitz;
  if (b.over || !b.duel) return null;
  const res = duelClose(run.campaign, b.duel, bundle);
  if (!res) return null;
  const { outcome } = res;
  const id = b.duel.customerId;
  const score: BlitzScore = {
    sales: b.score.sales + outcome.amount,
    served: b.score.served + 1,
    clean: b.score.clean + (outcome.good ? 1 : 0),
  };
  const line = outcome.units > 0 ? `${outcome.title} · ¥${outcome.amount.toLocaleString("zh-CN")}` : outcome.title;
  const blitz = announce({ ...b, score, served: [...b.served, { id, outcome }] }, line);
  // 开口收单也走表一格；烧完的那一格就别再叫下一位了。
  const ticked = blitzTick({ campaign: res.campaign, blitz: { ...blitz, duel: null } }, BLITZ_ACTION_SECONDS);
  return { run: ticked.blitz.over ? ticked : seatNext(res.campaign, ticked.blitz), outcome };
}

export const blitzScore = (b: BlitzState): BlitzScore => b.score;
export const blitzLeft = (b: BlitzState): number => Math.max(0, b.queue.length - b.customerIndex);
export const blitzNext = (b: BlitzState): CustomerId | null => b.queue[b.customerIndex] ?? null;

// ---------- 存档：上一局是单局摘要，最高纪录是另一支 key ----------

export const BLITZ_SUMMARY_VERSION = 1;
export type BlitzSummary = { version: number; seed: string; sales: number; served: number; clean: number; queueSize: number };
export type BlitzStore = Pick<Storage, "getItem" | "setItem">;

export const blitzSummary = (b: BlitzState): BlitzSummary => ({
  version: BLITZ_SUMMARY_VERSION, seed: b.seed,
  sales: b.score.sales, served: b.score.served, clean: b.score.clean, queueSize: b.queue.length,
});

function parseSummary(raw: string | null): BlitzSummary | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BlitzSummary>;
    if (parsed.version !== BLITZ_SUMMARY_VERSION || typeof parsed.seed !== "string") return null;
    for (const key of ["sales", "served", "clean", "queueSize"] as const) {
      if (typeof parsed[key] !== "number" || !Number.isFinite(parsed[key])) return null;
    }
    return parsed as BlitzSummary;
  } catch {
    return null;
  }
}

export const loadBlitzRun = (store: Pick<Storage, "getItem">): BlitzSummary | null =>
  parseSummary(store.getItem(BLITZ_SAVE_KEY));
export const loadBlitzBest = (store: Pick<Storage, "getItem">): BlitzSummary | null =>
  parseSummary(store.getItem(BLITZ_BEST_KEY));

export function saveBlitzRun(store: BlitzStore, b: BlitzState): BlitzSummary {
  const summary = blitzSummary(b);
  try { store.setItem(BLITZ_SAVE_KEY, JSON.stringify(summary)); } catch { /* 存不进就不存 */ }
  return summary;
}

// 纪录先说钱，再比干净：快诊一局追的是成交总额，干净成交是同分时的评语。
export const blitzBetter = (a: BlitzSummary, b: BlitzSummary): boolean =>
  a.sales !== b.sales ? a.sales > b.sales : a.clean !== b.clean ? a.clean > b.clean : a.served > b.served;

export function saveBlitzBest(store: BlitzStore, b: BlitzState): { best: BlitzSummary; isNew: boolean } {
  const summary = blitzSummary(b);
  const previous = loadBlitzBest(store);
  const best = previous && !blitzBetter(summary, previous) ? previous : summary;
  try { store.setItem(BLITZ_BEST_KEY, JSON.stringify(best)); } catch { /* 同上 */ }
  return { best, isNew: !previous || best === summary };
}

export type { DuelCard, DuelLogEntry, DuelSide, DuelState };

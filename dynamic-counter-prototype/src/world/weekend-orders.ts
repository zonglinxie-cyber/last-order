import { drawIndex } from "./rng.ts";
import { BUY_INTERVAL_DAYS, lastPurchaseDay } from "./purchases.ts";
import { bestShelf, POSITIVE_FIT, fitOfPerson, SHELF } from "./shelf.ts";
import { SEASON_DAYS, type Person, type PersonId, type WeekendOrder, type WeekendOutcome, type WeekendSale, type World } from "./types.ts";

export const WEEKEND_PREP_ENERGY = 6;
export const WEEKEND_PREP_SAMPLES = 1;
export const WEEKEND_SPONSOR_TRUST = 30;
export const WEEKEND_SPONSOR_WARMTH = 20;
/** 介绍人关心朋友被怎样接待，不要求每次都买成。 */
export const WEEKEND_SPONSOR_RESPONSE: Record<WeekendOutcome, { delta: number; act: string; line: string }> = {
  good: { delta: 4, act: "referral-kept", line: "「朋友说你挑得合适。我这次没介绍错人。」" },
  mixed: { delta: -4, act: "referral-rushed", line: "「朋友买了，心里却还有犹豫。下次先听清楚，别急着开单。」" },
  hard: { delta: -8, act: "referral-pressed", line: "「我介绍朋友来，不是让你硬推的。以后还怎么开这个口？」" },
  rival: { delta: 0, act: "", line: "「朋友最后在对面买了。各有合适，别为了一单勉强人。」" },
  missed: { delta: 0, act: "", line: "「这次没买成就下次再聊。别因为是我介绍的，就觉得非开单不可。」" },
};
export const WEEKEND_OUTCOMES: readonly WeekendOutcome[] = ["good", "mixed", "hard", "rival", "missed"];
export const WEEKEND_RESULT: Record<WeekendOutcome, string> = {
  good: "这一单，接住了", mixed: "成交了，还有话没说完", hard: "开出了单，也留下了压力",
  rival: "这次在对面成交", missed: "这次没约成",
};
export const WEEKEND_RESPONSE: Record<WeekendOutcome, string> = {
  good: "「那天你帮我把需要的挑出来了。下次还想找你。」",
  mixed: "「那天东西带走了，但有点犹豫还没说完。下回能再多听我一句吗？」",
  hard: "「那天开的单，不是我真正想买的。下回先听我把话说完。」",
  rival: "「那单我在对面买了。你也别着急，下一回我们再聊。」",
  missed: "「那天没买成。下回我想先把需要说清楚。」",
};

/** 周五只公布一位真实客人，不占她已有的预约，也不凭空提高预算或用量。 */
export function planWeekendOrder(world: World, people: Person[]): WeekendOrder | undefined {
  if (world.slot !== 0 || world.day % 7 !== 5) return undefined;
  const due = world.day + 2;
  if (due > SEASON_DAYS || world.weekendOrder?.due === due) return undefined;
  const pool = people.filter(p => p.role === "customer" && p.skin && p.id !== world.weekendOrder?.person
    && (p.visits.fromDay ?? 1) <= world.day && !p.visits.festivals
    && !world.appointments.some(a => a.day >= world.day && a.day <= due && (a.person === p.id || a.bring?.includes(p.id)))
    && (lastPurchaseDay(world, p.id) <= 0 || due - lastPurchaseDay(world, p.id) >= BUY_INTERVAL_DAYS)
    && SHELF[bestShelf(p)].price <= p.skin.budget && fitOfPerson(p, bestShelf(p)) >= POSITIVE_FIT)
    .sort((a, b) => b.skin!.budget - a.skin!.budget || a.id.localeCompare(b.id)).slice(0, 8);
  if (!pool.length) return undefined;
  const person = pool[drawIndex(`${world.seed}:weekend:${world.season}:${due}`, 0, pool.length)]!;
  return { person: person.id, due, prepared: false };
}

export const currentWeekendOrder = (world: World) => world.weekendOrder
  && world.day >= world.weekendOrder.due - 2 && world.day <= world.weekendOrder.due ? world.weekendOrder : undefined;

/** 归因只读实际成交；提前买好也算办妥，不能为了周末的戏强迫客人再买一遍。 */
export function recordWeekendOutcome(world: World, person: PersonId, outcome: WeekendOutcome, sale?: WeekendSale): World {
  const order = currentWeekendOrder(world);
  if (!order || order.person !== person || order.outcome) return world;
  return { ...world, weekendOrder: { ...order, outcome, resolvedDay: world.day, ...(sale ? { sale } : {}) } };
}

const ATTEMPT_REASONS = ["good", "mixed", "over-ask", "hard", "refused", "recent", "price", "mismatch"] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const positiveInt = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const productOf = (v: unknown) => typeof v === "string" && Object.hasOwn(SHELF, v) ? SHELF[v as keyof typeof SHELF] : undefined;
function validReview(o: Record<string, unknown>): boolean {
  if (o.attempt !== undefined) {
    const a = o.attempt;
    if (!record(a) || !productOf(a.product) || !positiveInt(a.requested) || !Number.isSafeInteger(a.sold)
      || Number(a.sold) < 0 || Number(a.sold) > Number(a.requested)
      || !Number.isInteger(a.day) || Number(a.day) < Number(o.due) - 2 || Number(a.day) > Number(o.resolvedDay ?? o.due)
      || !Number.isInteger(a.slot) || Number(a.slot) < 0 || Number(a.slot) > 3
      || !ATTEMPT_REASONS.includes(a.reason as typeof ATTEMPT_REASONS[number])) return false;
    const soldOutcome = a.reason === "good" ? "good" : a.reason === "hard" ? "hard"
      : a.reason === "mixed" || a.reason === "over-ask" ? "mixed" : undefined;
    if (soldOutcome ? Number(a.sold) <= 0 || o.outcome !== soldOutcome : a.sold !== 0) return false;
  }
  if (o.sale !== undefined) {
    const s = o.sale;
    if (!record(s) || !productOf(s.product) || !positiveInt(s.units) || !Number.isSafeInteger(s.amount)
      || s.amount !== productOf(s.product)!.price * Number(s.units)
      || !["serve", "return", "handoff", "booking", "poach"].includes(s.via as string)
      || !o.outcome || o.outcome === "missed"
      || ((s.via === "booking" || s.via === "poach") !== (o.outcome === "rival"))
      || ((s.via === "return" || s.via === "handoff") && o.outcome !== "good")
      || (s.via === "booking" ? typeof s.invited !== "boolean" : s.invited !== undefined)
      || (s.via === "serve" && (!record(o.attempt) || o.attempt.product !== s.product || o.attempt.sold !== s.units))) return false;
  }
  return true;
}

export function validWeekendOrder(value: unknown): value is WeekendOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return typeof o.person === "string" && !!o.person && Number.isInteger(o.due)
    && Number(o.due) >= 7 && Number(o.due) <= SEASON_DAYS && Number(o.due) % 7 === 0
    && typeof o.prepared === "boolean" && validReview(o)
    && (o.sponsor === undefined || typeof o.sponsor === "string" && !!o.sponsor && o.sponsor !== o.person && o.prepared === true)
    && (o.echoQueued === undefined || typeof o.echoQueued === "boolean")
    && (o.outcome === undefined ? o.resolvedDay === undefined && !o.echoQueued
      : WEEKEND_OUTCOMES.includes(o.outcome as WeekendOutcome) && Number.isInteger(o.resolvedDay)
        && Number(o.resolvedDay) >= Number(o.due) - 2 && Number(o.resolvedDay) <= Number(o.due));
}

const ATTEMPT_WORD = {
  good: "推荐符合需要，客人愿意买单。", mixed: "客人勉强接受了，仍有顾虑。",
  "over-ask": "开口的件数超过了客人想带的量，多要的部分没有多卖出去。",
  hard: "这笔靠硬推成交，关系和台账都付了代价；多出来的货以后可能退回。",
  refused: "客人当时不愿接受你的推荐，这次没有成交。",
  recent: "上次买的还没用完，这次没有再买。",
  price: "产品对症，但单件价格超过了当天预算。",
  mismatch: "这支货没有接住客人的需要，这次没有成交。",
};
const ATTEMPT_LESSON = {
  good: "记住这次问出的偏好；下次见面，再确认当次的用途。",
  mixed: "试用时如果还有犹豫，可以先问清顾虑，再决定换货或留到下次。",
  "over-ask": "下一次先问想带几件，再决定开单数量；多开口未必多成交。",
  hard: "可以少开一些、换一支，或把这笔生意留到以后。",
  refused: "先用招呼、帮忙或履约修复关系，再谈下一单。",
  recent: "不必追着重复开单。先照应这次来意，等真正有需要时再约。",
  price: "下次先核对预算，再在买得起的货里用试用判断是否合适。",
  mismatch: "下次把问出的需求与货架标签对照，留一次耐心给试用。",
};

/** 只复述已记录的经过。旧档缺证据时不编造“没问”“没留精力”等原因。 */
export function weekendReview(order: WeekendOrder): { facts: string[]; lesson: string } | null {
  const { attempt: a, sale: s } = order;
  if (!a && !s) return null;
  const facts: string[] = [];
  if (a) facts.push(`第 ${a.day} 天，你推荐${productOf(a.product)!.name}，开口 ${a.requested} 件${a.sold ? `、实际带走 ${a.sold} 件` : ""}。${ATTEMPT_WORD[a.reason]}`);
  if (s) {
    const lead = s.via === "handoff" ? "同事接手后在本柜开单" : s.via === "return" ? "回店时在本柜买好"
      : s.via === "booking" ? s.invited ? "已经邀来，本柜仍未成交；最后在对面买好" : "没有邀来比货，最后在对面买好"
      : s.via === "poach" ? "被对面争取过去并成交" : "在本柜成交";
    facts.push(`第 ${order.resolvedDay} 天，${lead}：${productOf(s.product)!.name} ${s.units} 件，¥${s.amount.toLocaleString("zh-CN")}。`);
  }
  const lesson = order.outcome === "good" ? ATTEMPT_LESSON.good
    : a ? ATTEMPT_LESSON[a.reason]
    : s?.via === "booking" ? s.invited
      ? "确认时间或邀到柜前之后，还要留出接待的精力，听清需要再开单。"
      : "下次可在周五先确认时间；也可以留 6 精力和 1 份小样，晚高峰邀来，再留 12 精力接待。"
    : "先看对面公开的目标，再安排接待；守住一位客人也可能要放下另一笔机会。";
  return { facts, lesson };
}

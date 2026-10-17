import { drawIndex } from "./rng.ts";
import { BUY_INTERVAL_DAYS, lastPurchaseDay } from "./purchases.ts";
import { bestShelf, POSITIVE_FIT, fitOfPerson, SHELF } from "./shelf.ts";
import { SEASON_DAYS, type Person, type PersonId, type WeekendOrder, type WeekendOutcome, type World } from "./types.ts";

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
export function recordWeekendOutcome(world: World, person: PersonId, outcome: WeekendOutcome): World {
  const order = currentWeekendOrder(world);
  if (!order || order.person !== person || order.outcome) return world;
  return { ...world, weekendOrder: { ...order, outcome, resolvedDay: world.day } };
}

export function validWeekendOrder(value: unknown): value is WeekendOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return typeof o.person === "string" && !!o.person && Number.isInteger(o.due)
    && Number(o.due) >= 7 && Number(o.due) <= SEASON_DAYS && Number(o.due) % 7 === 0
    && typeof o.prepared === "boolean"
    && (o.sponsor === undefined || typeof o.sponsor === "string" && !!o.sponsor && o.sponsor !== o.person && o.prepared === true)
    && (o.echoQueued === undefined || typeof o.echoQueued === "boolean")
    && (o.outcome === undefined ? o.resolvedDay === undefined && !o.echoQueued
      : WEEKEND_OUTCOMES.includes(o.outcome as WeekendOutcome) && Number.isInteger(o.resolvedDay)
        && Number(o.resolvedDay) >= Number(o.due) - 2 && Number(o.resolvedDay) <= Number(o.due));
}

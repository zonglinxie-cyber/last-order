// 预约的公开预告与已经发生的来访。这里只读事实，不改变来访概率、信任或成交。
import type { Appointment, Arrival, Person, PersonId, Slot, WeekendOutcome, World } from "./types.ts";
import { WEEKEND_OUTCOMES, WEEKEND_RESPONSE } from "./weekend-orders.ts";

export type ArrivalNote = { title: string; line: string; scene: string };
const customer = (people: Person[], id: PersonId | undefined) => people.find(p => p.id === id && p.role === "customer");

export function arrivalFromAppointment(ap: Appointment): Arrival {
  if (ap.reason === "refund") return { person: ap.person, kind: "refund" };
  if (ap.reason === "weekend") return { person: ap.person, kind: "weekend", weekendOutcome: ap.weekendOutcome };
  if (ap.reason === "wechat") return { person: ap.person, kind: "wechat" };
  return ap.referredBy && ap.referredBy !== ap.person
    ? { person: ap.person, kind: "referral", source: ap.referredBy }
    : { person: ap.person, kind: "visit" };
}

export function describeArrival(arrival: Arrival, people: Person[]): ArrivalNote | null {
  const person = customer(people, arrival.person);
  if (!person) return null;
  const source = arrival.source !== arrival.person ? customer(people, arrival.source) : undefined;
  if (arrival.kind === "weekend") {
    const line = arrival.weekendOutcome ? WEEKEND_RESPONSE[arrival.weekendOutcome] : "「那次周末的事，我还记着。」";
    return { title: "周末那单，后来呢", line, scene: `${person.name}回来聊周末那单：${line}` };
  }
  if (arrival.kind === "referral" && source) return {
    title: `${source.name}介绍来的`, line: `「${source.name}让我来找你。」`,
    scene: `${person.name}是${source.name}介绍来的，今天专门来找你。`,
  };
  if (arrival.kind === "companion" && source) return {
    title: `和${source.name}一起来的`, line: `「我跟${source.name}一起来的，先帮我看看吧。」`,
    scene: `${person.name}跟着${source.name}一起来了。`,
  };
  if (arrival.kind === "wechat") return {
    title: "微信约来的", line: "「微信里说好了，今天过来找你。」",
    scene: `${person.name}按微信里说好的时间，来找你了。`,
  };
  if (arrival.kind === "refund") return {
    title: "回来退货", line: "「上回那单，我想退掉。」",
    scene: `${person.name}带着上回那单回来退货了。`,
  };
  return { title: "按约来访", line: "「说好了来，今天过来看看。」", scene: `${person.name}如约来了。` };
}

/** 只认本时段已经进门的记录。刷新仍能读，下一次自然来访不能冒用上一次的介绍人。 */
export function currentArrival(world: World, person: PersonId, people: Person[]): ArrivalNote | null {
  if (!(person in world.present)) return null;
  for (let i = world.log.length - 1; i >= 0; i--) {
    const entry = world.log[i];
    if (entry.day === world.day && entry.slot === world.slot && entry.arrival?.person === person)
      return describeArrival(entry.arrival, people);
  }
  return null;
}

export type AppointmentPreview = { name: string; slot: Slot; detail: string };
export function publicAppointments(world: World, people: Person[], day: number): AppointmentPreview[] {
  return world.appointments.filter(ap => ap.day === day && ap.reason !== "refund")
    .sort((a, b) => a.slot - b.slot)
    .flatMap(ap => {
      const person = customer(people, ap.person);
      if (!person) return [];
      const source = ap.referredBy !== ap.person ? customer(people, ap.referredBy) : undefined;
      const companions = [...new Set(ap.bring ?? [])].filter(id => id !== ap.person)
        .flatMap(id => { const p = customer(people, id); return p ? [p.name] : []; });
      const route = ap.reason === "weekend" ? "回来聊周末那单，不是再买一单" : ap.reason === "wechat" ? "微信里约好" : source ? `${source.name}替你约来的` : "按约来访";
      return [{ name: person.name, slot: ap.slot, detail: route + (companions.length ? `，会和${companions.join("、")}一起来` : "") }];
    });
}

/** 新增说明字段损坏时只舍弃说明，不能让一整季旧档失效。 */
export function isArrival(value: unknown): value is Arrival {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.person !== "string" || !v.person || typeof v.kind !== "string" || !["visit", "wechat", "referral", "companion", "refund", "weekend"].includes(v.kind)) return false;
  if (v.kind === "weekend") return v.source === undefined && (v.weekendOutcome === undefined || WEEKEND_OUTCOMES.includes(v.weekendOutcome as WeekendOutcome));
  return v.kind === "referral" || v.kind === "companion"
    ? typeof v.source === "string" && !!v.source && v.source !== v.person
    : v.source === undefined;
}

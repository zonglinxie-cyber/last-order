// 继续游戏前，只从已落盘的停点与公开安排找回上下文；不推进世界、不补抽剧情。
import type { Consult } from "../consult.ts";
import type { Person, PersonId, World } from "../types.ts";
import { publicAppointments } from "../arrivals.ts";
import { rivalBookingNow } from "../rival-business.ts";
import { currentWeekendOrder, WEEKEND_RESULT } from "../weekend-orders.ts";
import { weekGoalWord } from "../target.ts";
import { SLOT_WORD } from "./words.ts";

export type ReturnState = {
  screen?: "play" | "report" | "season";
  reportDay?: number;
  hasStory: boolean;
  focusedConsult?: unknown;
  consults: Record<PersonId, Consult>;
};
export type ReturnPoint = {
  title: string; detail: string; button: string;
  kind: "consult" | "story" | "report" | "season" | "floor";
  person?: PersonId;
};
const short = (line: string) => line.length > 90 ? `${line.slice(0, 89)}…` : line;

export function returnPoint(world: World, state: ReturnState, people: Person[]): ReturnPoint {
  const name = (id: PersonId) => people.find(p => p.id === id)?.name;
  if (state.screen === "season") return {
    kind: "season", title: `第 ${world.season} 季已经收工`,
    detail: "生意和人情都已记下。回去看看这一季的结果，再决定下一季怎么开。",
    button: `继续 · 看第 ${world.season} 季回顾`,
  };
  if (state.screen === "report" && Number.isInteger(state.reportDay) && state.reportDay! >= 1) return {
    kind: "report", title: `第 ${state.reportDay} 天已经打烊`,
    detail: "账还摊在柜上。先看完这一天，下一天等你亲自开门。",
    button: `继续 · 看第 ${state.reportDay} 天的账`,
  };
  if (state.hasStory) return {
    kind: "story", title: "柜上还有一句话没说完",
    detail: "上次那一幕的选择还留着，回去接上。", button: "继续 · 接上这段故事",
  };
  const id = typeof state.focusedConsult === "string" ? state.focusedConsult : undefined;
  const c = id ? state.consults[id] : undefined;
  // 接待记录由 restoreConsults 验过时段与内容；已被请去对面的人不能越过邀回流程。
  if (id && name(id) && c?.begun && world.present[id] && world.present[id] !== "rival") return {
    kind: "consult", person: id, title: `和${name(id)}还没谈完`,
    detail: short(c.lines.at(c.patience === 0 ? -2 : -1) ?? "这单的精力已经花过，接着看、问或挑货就好。"),
    button: `继续 · 和${name(id)}接着谈`,
  };
  const floor = { kind: "floor" as const, button: `继续 · 第 ${world.season} 季 · 第 ${world.day} 天 ${SLOT_WORD[world.slot]}` };
  const booking = rivalBookingNow(world);
  if (booking && !booking.outcome && name(booking.person) && world.present[booking.person]
    && world.qualities[`bought:${booking.person}`] !== world.day) return {
    ...floor, title: `${name(booking.person)}的预约还没定`,
    detail: `${booking.invited ? "已经邀来比货" : "现在在对面试货"}，这时段结束才结账。回到现场，再决定要不要争取。`,
  };
  const order = currentWeekendOrder(world);
  if (order && name(order.person)) return {
    ...floor, title: `周末那一单 · ${name(order.person)}`,
    detail: order.outcome ? `${WEEKEND_RESULT[order.outcome]}，周日打烊还会说起这件事。`
      : `第 ${order.due} 天晚高峰${order.sponsor && name(order.sponsor) ? `，${name(order.sponsor)}已经替你牵线` : order.prepared ? "，已经确认来柜前" : "，还没提前确认时间"}。`,
  };
  const days = [...new Set(world.appointments.filter(a => a.day >= world.day).map(a => a.day))].sort((a, b) => a - b);
  for (const day of days) {
    const next = publicAppointments(world, people, day).find(a => day > world.day || a.slot > world.slot);
    if (next) return { ...floor, title: `${next.name}约好了要来`, detail: `第 ${day} 天${SLOT_WORD[next.slot]} · ${next.detail}。` };
  }
  const paused = Object.values(state.consults).filter(c => c.begun && name(c.person) && world.present[c.person] && world.present[c.person] !== "rival");
  if (paused.length) return { ...floor, title: `${name(paused[0].person)}的谈话还留着`,
    detail: "上次已经花过这单的精力。在楼层点人，再选“接着谈”，就能找回谈话。" };
  return { ...floor, title: "柜上的事，接着慢慢来", detail: `本周${weekGoalWord(world)}。时间仍停在你离开时，没有替你往下走。` };
}

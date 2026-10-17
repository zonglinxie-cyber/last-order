import assert from "node:assert/strict";
import { test } from "node:test";
import { newWorld, beginServe } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { askHer, openConsult, restoreConsults, saveConsults } from "../src/world/consult.ts";
import { returnPoint, type ReturnState } from "../src/world/ui/return-context.ts";
import type { World } from "../src/world/types.ts";
const world = (): World => ({ ...newWorld("return-test", PEOPLE), day: 2, slot: 1, energy: 20,
  present: { shen: "counter", luyao: "rival" }, opinion: { shen: 0 } });
const base: ReturnState = { hasStory: false, consults: {} };
const talking = () => {
  const w = beginServe(world(), PEOPLE, "shen"), p = PEOPLE.find(p => p.id === "shen")!;
  const c = askHer(openConsult(w, p), p, "hand-1");
  assert.ok(c.begun);
  return { w, c, state: { ...base, focusedConsult: "shen", consults: { shen: c } } };
};

test("返回摘要只用已说出的回应，读取不花资源；结算与未完剧情优先于接待", () => {
  const { w, c, state } = talking(), before = JSON.stringify(w);
  const point = returnPoint(w, state, PEOPLE);
  assert.equal(point.kind, "consult"); assert.equal(point.person, "shen");
  assert.equal(point.detail, c.lines.at(-1)); assert.equal(JSON.stringify(w), before);
  assert.equal(returnPoint(w, { ...state, hasStory: true }, PEOPLE).kind, "story");
  assert.equal(returnPoint(w, { ...state, hasStory: true, screen: "report", reportDay: 1 }, PEOPLE).button, "继续 · 看第 1 天的账");
  assert.equal(returnPoint({ ...w, day: 29 }, { ...state, screen: "season" }, PEOPLE).button, "继续 · 看第 1 季回顾");
});

test("只恢复明确开着且仍有效的接待：旧档、主动关闭、失效和被带到对面均回楼层", () => {
  const { w, c, state } = talking();
  for (const focusedConsult of [undefined, "missing", 3, {}, ["shen"]])
    assert.equal(returnPoint(w, { ...state, focusedConsult }, PEOPLE).kind, "floor");
  assert.equal(returnPoint({ ...w, present: {} }, state, PEOPLE).kind, "floor");
  assert.equal(returnPoint({ ...w, present: { shen: "rival" } }, state, PEOPLE).kind, "floor");
  const later = { ...w, slot: 2 as const };
  const expired = restoreConsults(saveConsults(w, { shen: c }), later, PEOPLE);
  assert.deepEqual(expired, {});
  assert.equal(returnPoint(later, { ...state, consults: expired }, PEOPLE).kind, "floor");
  const closed = returnPoint(w, { ...state, focusedConsult: undefined }, PEOPLE);
  assert.match(closed.title, /谈话还留着/);
});

test("眼前未结预约优先于未来约单；已成交不能还说客人正在等比较", () => {
  const w: World = { ...world(), day: 5, slot: 1,
    rivalBooking: { day: 5, slot: 1, person: "shen", product: "plain", units: 1, amount: 980, invited: true },
    weekendOrder: { person: "liangxia", due: 7, prepared: true, sponsor: "anjie" } };
  assert.match(returnPoint(w, base, PEOPLE).title, /沈薇的预约还没定/);
  const sold = { ...w, qualities: { ...w.qualities, "bought:shen": 5 } };
  const point = returnPoint(sold, base, PEOPLE);
  assert.match(point.title, /梁夏/); assert.match(point.detail, /安姐已经替你牵线/);
  assert.match(returnPoint({ ...sold, weekendOrder: { ...w.weekendOrder!, outcome: "good", resolvedDay: 5 } }, base, PEOPLE).detail, /接住了/);
});

test("只预告真正公开的未来预约，不把退款或已经过时的安排当成客人约好了", () => {
  const w: World = { ...world(), appointments: [
    { person: "shen", day: 2, slot: 0, reason: "visit" },
    { person: "zhao", day: 2, slot: 2, reason: "refund", amount: 980 },
    { person: "mei", day: 3, slot: 2, reason: "visit", referredBy: "anjie" },
  ] };
  const point = returnPoint(w, base, PEOPLE);
  assert.match(point.title, /梅女士/); assert.match(point.detail, /第 3 天傍晚/);
  assert.match(point.detail, /安姐替你约来的/); assert.doesNotMatch(point.detail, /980|退货|赵女士/);
});

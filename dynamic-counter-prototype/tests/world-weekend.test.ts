import assert from "node:assert/strict";
import { test } from "node:test";
import { ambient, beginServe, beginSlot, endDay, inviteRivalGuest, MAX_PRESENT_CUSTOMERS, newWorld, nextSeason,
  parseWorld, prepareWeekendOrder, resolveServe, serializeWorld, weekendPrepareBlock, ZONE_GUEST_CAPACITY } from "../src/world/engine.ts";
import { currentArrival, publicAppointments } from "../src/world/arrivals.ts";
import { planWeekendOrder, WEEKEND_RESPONSE } from "../src/world/weekend-orders.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { bestShelf, fitOfPerson, SHELF_IDS, shelfFitTier } from "../src/world/shelf.ts";
import { visitPerson } from "../src/world/visits.ts";
import type { Person, WeekendOutcome, World } from "../src/world/types.ts";

const friday = (day = 5) => beginSlot({ ...newWorld("weekend-test", PEOPLE), day }, PEOPLE);
const sunday = (prepared = false, day = 5) => {
  let w = friday(day); assert.ok(w.weekendOrder);
  if (prepared) w = prepareWeekendOrder(w, PEOPLE);
  return beginSlot({ ...w, day: day + 2, slot: 3, energy: 0 }, PEOPLE);
};
const guestOf = (w: World) => PEOPLE.find(p => p.id === w.weekendOrder!.person)!;
const sell = (w: World) => resolveServe(w, PEOPLE, w.weekendOrder!.person, bestShelf(visitPerson(w, guestOf(w))), 1);

test("周五预告真实周日约单：不占已有预约，不约近期买过或未登场的人，读档不改人", () => {
  assert.equal(planWeekendOrder({ ...newWorld("w", PEOPLE), day: 4 }, PEOPLE), undefined);
  for (const day of [5, 12, 19, 26]) {
    const w = friday(day), o = w.weekendOrder!;
    assert.equal(o.due, day + 2);
    assert.deepEqual(parseWorld(serializeWorld(w))!.weekendOrder, o);
    assert.equal(planWeekendOrder(w, PEOPLE), undefined);
    const blocked = { ...w, weekendOrder: undefined, appointments: PEOPLE.filter(p => p.role === "customer")
      .map(p => ({ person: p.id, day: day + 1, slot: 2 as const })) };
    assert.equal(planWeekendOrder(blocked, PEOPLE), undefined);
    const allBought = { ...w, weekendOrder: undefined, qualities: Object.fromEntries(PEOPLE.map(p => [`rival-bought:${p.id}`, day])) };
    assert.equal(planWeekendOrder(allBought, PEOPLE), undefined);
  }
});

test("提前联系真实扣费且不重复：约的是时间，不送信任或成交，也不要求人当前在场", () => {
  const w = friday(), o = w.weekendOrder!;
  const prepared = prepareWeekendOrder(w, PEOPLE);
  assert.equal(prepared.energy, w.energy - 6);
  assert.equal(prepared.samples, w.samples - 1);
  assert.deepEqual(prepared.opinion, w.opinion);
  assert.equal(prepared.money, w.money);
  assert.equal(prepared.weekendOrder?.prepared, true);
  assert.equal(prepareWeekendOrder(prepared, PEOPLE), prepared);
  for (const patch of [{ energy: 5 }, { samples: 0 }, { standing: 0 }, { compliance: 0 }, { opinion: { [o.person]: -30 } }]) {
    const blocked = { ...w, ...patch };
    assert.ok(weekendPrepareBlock(blocked));
    assert.equal(prepareWeekendOrder(blocked, PEOPLE), blocked);
  }
});

test("提前联系把邀请成本挪出晚高峰：到店可直接接待，临时争取仍需花资源", () => {
  const ready = sunday(true), late = sunday(false), id = ready.weekendOrder!.person;
  assert.equal(ready.rivalBooking?.weekend, true);
  assert.equal(ready.rivalBooking?.invited, true);
  assert.notEqual(ready.present[id], "rival");
  assert.equal(late.present[id], "rival");
  assert.equal(beginServe(ready, PEOPLE, id).energy, ready.energy - 12);
  const invited = inviteRivalGuest(late, PEOPLE);
  assert.equal(invited.energy, late.energy - 6);
  assert.equal(invited.samples, late.samples - 1);
  assert.equal(beginServe(invited, PEOPLE, id).energy, late.energy - 18);
  assert.equal(prepareWeekendOrder(late, PEOPLE), late);
  for (const w of [ready, late]) {
    const guests = PEOPLE.filter(p => p.role === "customer" && p.id in w.present);
    assert.ok(guests.length <= MAX_PRESENT_CUSTOMERS);
    for (const [z, max] of Object.entries(ZONE_GUEST_CAPACITY)) assert.ok(guests.filter(p => w.present[p.id] === z).length <= max);
  }
});

test("赢单靠实际接待：不加一笔获胜钱，周日结果排到次日回访而不自动再买", () => {
  const w = sunday(true), id = w.weekendOrder!.person;
  const sold = sell(w);
  assert.equal(sold.weekendOrder?.outcome, "good");
  const withoutOrder = sell({ ...w, weekendOrder: { ...w.weekendOrder!, outcome: "missed", resolvedDay: w.day } });
  assert.equal(sold.money, withoutOrder.money);
  assert.deepEqual(sold.opinion, withoutOrder.opinion);
  const settled = ambient(sold, PEOPLE);
  assert.equal(settled.rivalBooking?.outcome, "player");
  const next = endDay(settled, PEOPLE);
  const echo = next.appointments.find(a => a.person === id && a.weekendOutcome)!;
  assert.ok(echo); assert.equal(echo.day, 8); assert.equal(echo.reason, "weekend");
  assert.ok(publicAppointments(next, PEOPLE, 8).find(a => a.name === guestOf(w).name)?.detail.includes("周末那单"));
  const arrived = beginSlot({ ...next, slot: echo.slot, appointments: [echo] }, PEOPLE);
  assert.equal(arrived.money, next.money);
  assert.equal(currentArrival(arrived, id, PEOPLE)?.line, WEEKEND_RESPONSE.good);
  assert.equal(currentArrival({ ...arrived, slot: ((echo.slot + 1) % 4) as World["slot"] }, id, PEOPLE), null);
});

test("没争取会输掉真实订单，结果刷新后不重收钱，回访承认是在对面买的", () => {
  const w = sunday(), quote = w.rivalBooking!;
  const settled = ambient({ ...w, rivalPlan: { day: w.day, slot: w.slot, targets: [], tactic: "invite" } }, PEOPLE);
  assert.equal(settled.rivalMoney, w.rivalMoney + quote.amount);
  assert.equal(settled.weekendOrder?.outcome, "rival");
  assert.equal(ambient(parseWorld(serializeWorld(settled))!, PEOPLE).rivalMoney, settled.rivalMoney);
  const next = endDay(settled, PEOPLE), echo = next.appointments.find(a => a.weekendOutcome)!;
  const arrived = beginSlot({ ...next, slot: echo.slot, appointments: [echo] }, PEOPLE);
  assert.equal(arrived.money, next.money);
  assert.equal(currentArrival(arrived, quote.person, PEOPLE)?.line, WEEKEND_RESPONSE.rival);
});

test("提前办好就不强迫周末重买；最后一单不要求玩家按固定剧本等待", () => {
  const w = friday(), id = w.weekendOrder!.person;
  const early = { ...w, day: 6, slot: 0 as const, energy: 40, present: { [id]: "counter" as const } };
  const sold = sell(early);
  assert.ok(sold.money > w.money); assert.equal(sold.weekendOrder?.resolvedDay, 6);
  assert.equal(prepareWeekendOrder(sold, PEOPLE), sold);
  const later = beginSlot({ ...sold, day: 7, slot: 3 }, PEOPLE);
  assert.equal(later.rivalBooking?.weekend, undefined);
  assert.equal(later.money, sold.money);
});

test("回访根据真实销售分支说话：普通成交、勉强买和硬推不能共用夸奖", () => {
  const original = PEOPLE.find(p => p.id === "mei")!;
  const guest: Person = { ...original, skin: { ...original.skin!, budget: 10000, maxUnits: 2 } };
  const people = PEOPLE.map(p => p.id === guest.id ? guest : p);
  const base: World = { ...newWorld("response", people), day: 7, slot: 3, energy: 60,
    present: { mei: "counter" }, weekendOrder: { person: "mei", due: 7, prepared: true } };
  const mixed = SHELF_IDS.find(id => shelfFitTier(fitOfPerson(guest, id)) === "mixed")!;
  const bad = SHELF_IDS.find(id => shelfFitTier(fitOfPerson(guest, id)) === "negative")!;
  assert.ok(mixed && bad);
  for (const [product, force, outcome] of [[bestShelf(guest), false, "good"], [mixed, false, "mixed"], [bad, true, "hard"]] as const) {
    const sold = resolveServe(base, people, "mei", product, 1, force);
    assert.equal(sold.weekendOrder?.outcome, outcome);
    const ended = endDay(sold, people), echo = ended.appointments.find(a => a.weekendOutcome)!;
    assert.equal(echo.weekendOutcome, outcome);
  }
});

test("季末最后一单的回访接到下季，只带回应不带退款金额、不白送新季收入", () => {
  const sold = sell(sunday(true, 26));
  const ended = endDay(ambient(sold, PEOPLE), PEOPLE);
  const next = nextSeason(ended, PEOPLE);
  assert.equal(next.weekendOrder, undefined);
  const echo = next.appointments.find(a => a.weekendOutcome)!;
  assert.ok(echo); assert.equal(echo.day, 1); assert.equal(echo.amount, undefined);
  const arrived = beginSlot({ ...next, slot: echo.slot }, PEOPLE);
  assert.equal(arrived.money, 0);
  assert.equal(currentArrival(arrived, echo.person, PEOPLE)?.line, WEEKEND_RESPONSE.good);
});

test("客位不足或顾客已经买过，不另造收入；有效旧档继续，损坏新状态拒收", () => {
  const w = friday(), id = w.weekendOrder!.person;
  const recent = beginSlot({ ...w, day: 7, slot: 3, qualities: { ...w.qualities, [`bought:${id}`]: 6 } }, PEOPLE);
  assert.equal(recent.weekendOrder?.outcome, "missed");
  assert.equal(recent.rivalBooking?.weekend, undefined);
  const appointments = PEOPLE.filter(p => p.role === "customer" && p.id !== id).slice(0, 7)
    .map(p => ({ person: p.id, day: 7, slot: 3 as const }));
  const full = beginSlot({ ...w, day: 7, slot: 3, appointments }, PEOPLE);
  assert.equal(full.weekendOrder?.outcome, "missed");
  const guests = PEOPLE.filter(p => p.role === "customer" && p.id in full.present);
  assert.equal(guests.length, 7);
  for (const [z, max] of Object.entries(ZONE_GUEST_CAPACITY)) assert.ok(guests.filter(p => full.present[p.id] === z).length <= max);
  const { weekendOrder, ...old } = w; assert.ok(parseWorld(serializeWorld(old)));
  for (const patch of [{ due: 6 }, { prepared: "yes" }, { outcome: "bad" }, { outcome: "good", resolvedDay: 1 }, { echoQueued: true }])
    assert.equal(parseWorld(serializeWorld({ ...w, weekendOrder: { ...weekendOrder, ...patch } } as World)), null);
  for (const outcome of ["good", "mixed", "hard", "rival", "missed"] as WeekendOutcome[])
    assert.ok(parseWorld(serializeWorld({ ...w, weekendOrder: { ...weekendOrder!, outcome, resolvedDay: w.day } })));
});

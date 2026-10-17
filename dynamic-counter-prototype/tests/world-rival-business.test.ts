import assert from "node:assert/strict";
import { test } from "node:test";
import { ambient, beginServe, beginSlot, doVerb, inviteRivalGuest, MAX_PRESENT_CUSTOMERS, newWorld, nextSeason,
  hasOpenedSale, isReturningGuest, parseWorld, resolveServe, rivalCandidates, rivalTargets, serializeWorld, ZONE_GUEST_CAPACITY } from "../src/world/engine.ts";
import { openConsult } from "../src/world/consult.ts";
import { saleFeedback } from "../src/world/sales-feedback.ts";
import { rivalBookingNow } from "../src/world/rival-business.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { bestShelf, SHELF } from "../src/world/shelf.ts";
import { visitPerson } from "../src/world/visits.ts";
import type { World } from "../src/world/types.ts";

const opening = (over: Partial<World> = {}) => beginSlot({ ...newWorld("booking-test", PEOPLE), day: 22, slot: 1, ...over }, PEOPLE);
const isolated = () => {
  const w = opening(); const b = rivalBookingNow(w)!;
  assert.ok(b);
  return { ...w, present: { [b.person]: "rival", luyao: "rival" }, rivalPlan: { day: w.day, slot: w.slot, targets: [], tactic: "invite" } } as World;
};

test("独立预约在首季第二周后午后出现，报价公开，人数与区域不溢出", () => {
  assert.equal(rivalBookingNow(opening({ day: 7 })), undefined);
  assert.equal(rivalBookingNow(opening({ day: 8, slot: 0 })), undefined);
  assert.ok(rivalBookingNow(opening({ season: 2, day: 1 })));
  for (let i = 0; i < 20; i++) {
    const w = opening({ seed: `booking-${i}` }); const b = rivalBookingNow(w)!;
    assert.ok(b && b.units > 0);
    assert.equal(w.rivalMoney, 0, "公示不等于已成交");
    assert.equal(b.amount, b.units * SHELF[b.product].price);
    assert.equal(w.present[b.person], "rival");
    assert.equal(rivalTargets(w).includes(b.person), false);
    const guests = PEOPLE.filter(p => p.role === "customer" && p.id in w.present);
    assert.ok(guests.length <= MAX_PRESENT_CUSTOMERS);
    for (const [zone, max] of Object.entries(ZONE_GUEST_CAPACITY)) assert.ok(guests.filter(p => w.present[p.id] === zone).length <= max);
    assert.ok(w.log.some(l => l.text.includes(`预计这单 ¥${b.amount}`)));
  }
});

test("即使全场已建立信任，对手仍可经营自己的预约，不偷抢忠诚客人", () => {
  const opinion = Object.fromEntries(PEOPLE.map(p => [p.id, 100]));
  const w = opening({ opinion, appointments: [{ day: 22, slot: 1, person: "shen", reason: "visit" }] });
  assert.ok(rivalBookingNow(w));
  assert.notEqual(w.rivalBooking!.person, "shen");
  assert.deepEqual(rivalTargets(w), []);
  const after = ambient(w, PEOPLE);
  assert.ok(after.rivalMoney > 0);
  assert.notEqual(after.present.shen, "rival");
});

test("放弃争取按公示结一次账，存档往返不会重收款，十天内不再约同一人买", () => {
  const w = isolated(); const b = w.rivalBooking!;
  const end = ambient(w, PEOPLE);
  assert.equal(end.rivalMoney, b.amount);
  assert.equal(end.rivalWins, 1);
  assert.equal(end.rivalBooking?.outcome, "rival");
  const again = ambient(parseWorld(serializeWorld(end))!, PEOPLE);
  assert.equal(again.rivalMoney, b.amount);
  assert.equal(again.rivalWins, 1);
  assert.equal(end.qualities[`rival-bought:${b.person}`], w.day);
  assert.equal(end.qualities[`bought:${b.person}`], undefined);
  assert.equal(hasOpenedSale(end), false, "对面开张不算玩家首单");
  assert.equal(isReturningGuest(end, b.person), false, "对面的顾客不会冒充玩家熟客");
  assert.equal(openConsult(end, PEOPLE.find(p => p.id === b.person)!).unitsKnown, false, "对面的成交不能泄露用量答案");
  const roster = PEOPLE.filter(p => [b.person, "luyao"].includes(p.id));
  for (let day = w.day + 1; day < w.day + 10; day++) {
    const later = beginSlot({ ...end, day, slot: 1 }, roster);
    assert.equal(rivalBookingNow(later), undefined);
  }
});

test("双方成交共用购买间隔：柜台接待、托单与赴约回流都不能再次卖货", () => {
  const end = ambient(isolated(), PEOPLE); const id = end.rivalBooking!.person;
  const guest = PEOPLE.find(p => p.id === id)!;
  const later: World = { ...end, day: end.day + 1, slot: 0, energy: 80, touched: [],
    present: { [id]: "counter", fangmin: "counter" }, opinion: { [id]: 50, fangmin: 50 },
    qualities: { ...end.qualities, [`client-note:${id}:${guest.skin!.demands[0].trait}`]: 1 } };
  const product = bestShelf(visitPerson(later, guest));
  const sold = resolveServe(later, PEOPLE, id, product, 1);
  assert.equal(sold.money, later.money);
  assert.equal(saleFeedback(later, sold, visitPerson(later, guest), product).title, "还没用完，先别急");
  assert.equal(doVerb(later, PEOPLE, "handoff", ["fangmin", id]).money, later.money);
  const revisit = beginSlot({ ...later, appointments: [{ person: id, day: later.day, slot: 0, reason: "wechat" }] }, PEOPLE);
  assert.equal(revisit.money, later.money);
  const expired = { ...later, day: end.day + 10 };
  assert.ok(resolveServe(expired, PEOPLE, id, bestShelf(visitPerson(expired, guest)), 1).money > later.money);
  const next = nextSeason(end, PEOPLE);
  assert.equal(next.qualities[`rival-bought:${id}`], undefined);
});

test("旧招揽也排除近期购买：公开目标与结账二次校验，不能隔天重复收同一人的钱", () => {
  for (const key of ["bought:shen", "rival-bought:shen"]) {
    const w: World = { ...newWorld("cooldown", PEOPLE), day: 5, energy: 40,
      present: { shen: "counter", luyao: "rival" }, opinion: { shen: -10 }, qualities: { [key]: 4 } };
    assert.deepEqual(rivalCandidates(w, PEOPLE), []);
    assert.equal(rivalCandidates({ ...w, day: 14 }, PEOPLE)[0]?.id, "shen");
    for (let i = 0; i < 20; i++) {
      const stale = { ...w, seed: `stale-${i}`, rivalPlan: { day: 5, slot: w.slot, targets: ["shen"], tactic: "invite" as const } };
      const end = ambient(stale, PEOPLE);
      assert.equal(end.rivalMoney, 0, "已亮出的旧目标也不能重复成交");
    }
  }
  let captured: World | undefined;
  for (let i = 0; i < 30; i++) {
    const w: World = { ...newWorld(`capture-${i}`, PEOPLE), day: 5,
      present: { shen: "counter", luyao: "rival" }, opinion: { shen: -10 },
      rivalPlan: { day: 5, slot: 0, targets: ["shen"], tactic: "invite" } };
    const end = ambient(w, PEOPLE);
    if (end.rivalMoney > 0) { captured = end; break; }
  }
  assert.ok(captured, "仍能完成合法的对面成交");
  assert.equal(captured.qualities["rival-bought:shen"], 5);
  assert.equal(captured.qualities["bought:shen"], undefined);
  assert.deepEqual(rivalCandidates({ ...captured, day: 6, present: { shen: "counter", luyao: "rival" } }, PEOPLE), []);
});

test("邀来花真实精力与小样，重复点击不扣；必须实际成交才能赢下预约", () => {
  const w = isolated(); const b = w.rivalBooking!;
  const invited = inviteRivalGuest(w, PEOPLE);
  assert.equal(invited.energy, w.energy - 6);
  assert.equal(invited.samples, w.samples - 1);
  assert.deepEqual(invited.opinion, w.opinion);
  assert.notEqual(invited.present[b.person], "rival");
  assert.equal(inviteRivalGuest(invited, PEOPLE), invited);
  const guest = PEOPLE.find(p => p.id === b.person)!;
  const sold = resolveServe(invited, PEOPLE, b.person, bestShelf(visitPerson(invited, guest)), 1);
  assert.ok(sold.money > w.money);
  const settled = ambient(sold, PEOPLE);
  assert.equal(settled.rivalMoney, 0);
  assert.equal(settled.rivalBooking?.outcome, "player");
  assert.equal(settled.money, sold.money, "没有额外的获胜奖金");
});

test("只邀来或开口但没成交，预约仍由陆遥完成；高信任不替代买货", () => {
  let w = isolated(); w = { ...w, opinion: { [w.rivalBooking!.person]: 100 } };
  const invited = inviteRivalGuest(w, PEOPLE);
  const talked = beginServe(invited, PEOPLE, w.rivalBooking!.person);
  const settled = ambient(talked, PEOPLE);
  assert.equal(settled.rivalMoney, w.rivalBooking!.amount);
  assert.equal(settled.rivalBooking?.outcome, "rival");
  assert.equal(settled.opinion[w.rivalBooking!.person], 100, "不凭空惩罚已建立的信任");
});

test("知道需求且经营好同事关系也能接单：托单花真实名额，不凭空得到正解", () => {
  const base = isolated();
  const guest = PEOPLE.find(p => p.id === base.rivalBooking!.person)!;
  const unknown: World = { ...base, energy: 12, present: { ...base.present, fangmin: "counter" }, opinion: { fangmin: 50 } };
  const noNotes = doVerb(inviteRivalGuest(unknown, PEOPLE), PEOPLE, "handoff", ["fangmin", guest.id]);
  assert.equal(noNotes.money, 0, "没有客情笔记，托同事只是照看");
  const w = { ...unknown, qualities: { ...unknown.qualities, [`client-note:${guest.id}:${guest.skin!.demands[0].trait}`]: 1 } };
  const invited = inviteRivalGuest(w, PEOPLE);
  const sold = doVerb(invited, PEOPLE, "handoff", ["fangmin", w.rivalBooking!.person]);
  assert.ok(sold.money > 0);
  assert.equal(sold.energy, 0);
  const end = ambient(sold, PEOPLE);
  assert.equal(end.rivalBooking?.outcome, "player");
  assert.equal(end.rivalMoney, 0);
  assert.equal(end.qualities[`handoff-duty:${w.day}:fangmin`], 1);
});

test("资源不足、反感或过期不能邀请；有效旧档没有新字段仍可读取", () => {
  const w = isolated(); const id = w.rivalBooking!.person;
  for (const patch of [{ energy: 5 }, { samples: 0 }, { compliance: 0 }, { standing: 0 }, { slot: 2 as const }, { opinion: { [id]: -30 } }]) {
    const unavailable = { ...w, ...patch };
    assert.equal(inviteRivalGuest(unavailable, PEOPLE), unavailable);
  }
  const { rivalBooking, ...old } = w;
  assert.ok(parseWorld(serializeWorld(old)));
  assert.equal(nextSeason(w, PEOPLE).rivalBooking, undefined);
});

test("坏报价或状态拒收，不能通过存档多记钱；客人离开则本单落空", () => {
  const w = isolated();
  for (const patch of [{ amount: 1 }, { units: 1.5 }, { product: "unknown" }, { invited: "yes" }, { outcome: "paid" }])
    assert.equal(parseWorld(serializeWorld({ ...w, rivalBooking: { ...w.rivalBooking, ...patch } } as World)), null);
  const absent = ambient({ ...w, present: { luyao: "rival" } }, PEOPLE);
  assert.equal(absent.rivalMoney, 0);
  assert.equal(absent.rivalBooking?.outcome, "missed");
});

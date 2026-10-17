import assert from "node:assert/strict";
import { test } from "node:test";
import { ambient, beginSlot, contactInviteBlock, inviteContact, newWorld, nextSeason, parseWorld, planContactInvite, resolveServe, serializeWorld } from "../src/world/engine.ts";
import { appointmentTime, currentArrival, publicAppointments } from "../src/world/arrivals.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { bestShelf, SHELF } from "../src/world/shelf.ts";
import { visitPerson } from "../src/world/visits.ts";
import type { World } from "../src/world/types.ts";
const shen = PEOPLE.find(p => p.id === "shen")!;
const base = (): World => ({ ...newWorld("invite-test", PEOPLE), day: 2, slot: 3, energy: 40,
  opinion: { shen: 40 }, qualities: { "wechat:shen": 1 }, present: { luyao: "rival" } });

test("已加微信的客人不在场也可主动约，支付一次精力，不送信任、收入或答案", () => {
  const w = base(), next = inviteContact(w, PEOPLE, "shen");
  assert.equal(next.energy, 36); assert.equal(next.samples, w.samples);
  assert.equal(next.money, 0); assert.deepEqual(next.opinion, w.opinion); assert.deepEqual(next.qualities, w.qualities);
  assert.equal(next.rngCalls, w.rngCalls);
  assert.deepEqual(next.appointments, [{ person: "shen", day: 3, slot: 0, reason: "invited" }]);
  assert.equal(inviteContact(next, PEOPLE, "shen"), next);
  assert.deepEqual(parseWorld(serializeWorld(next)), next);
  assert.match(publicAppointments(next, PEOPLE, 3)[0].detail, /你主动约来/);
});

test("主动邀约到店不会自动买，即使高信任；来路可刷新，仍靠真实接待成交", () => {
  const w = inviteContact({ ...base(), opinion: { shen: 100 } }, PEOPLE, "shen");
  const next = beginSlot({ ...w, day: 3, slot: 0 }, PEOPLE);
  assert.ok(next.present.shen); assert.equal(next.money, 0); assert.equal(next.qualities["bought:shen"], undefined);
  assert.equal(next.appointments.some(a => a.person === "shen" && a.reason === "invited"), false);
  assert.equal(currentArrival(parseWorld(serializeWorld(next))!, "shen", PEOPLE)?.title, "你主动约来的");
  const sold = resolveServe(next, PEOPLE, "shen", bestShelf(visitPerson(next, shen)), 1);
  assert.ok(sold.money > next.money);
  assert.equal(currentArrival({ ...next, slot: 1 }, "shen", PEOPLE), null);
});

test("输给对面后仍能约下次，双方购买都等十天，跨季保留真实日期", () => {
  const w: World = { ...base(), day: 22, slot: 1, present: { shen: "rival", luyao: "rival" },
    rivalPlan: { day: 22, slot: 1, targets: [], tactic: "invite" },
    rivalBooking: { day: 22, slot: 1, person: "shen", product: "plain", units: 1, amount: SHELF.plain.price, invited: true } };
  const lost = ambient(w, PEOPLE); assert.equal(lost.rivalBooking?.outcome, "rival");
  const promised = inviteContact(lost, PEOPLE, "shen");
  assert.ok(parseWorld(serializeWorld(promised)));
  assert.equal(promised.appointments.at(-1)?.day, 32); assert.equal(promised.rivalMoney, lost.rivalMoney);
  assert.equal(appointmentTime(promised, promised.appointments.at(-1)!), "第 2 季 · 第 4 天上午");
  const season = nextSeason(promised, PEOPLE);
  assert.deepEqual(season.appointments, [{ person: "shen", day: 4, slot: 0, reason: "invited" }]);
  const arrived = beginSlot({ ...season, day: 4, slot: 0 }, PEOPLE);
  assert.equal(arrived.money, 0); assert.ok(arrived.present.shen);
  for (const key of ["bought:shen", "rival-bought:shen"]) {
    const recent = { ...base(), day: 8, qualities: { "wechat:shen": 1, [key]: 7 } };
    assert.equal(planContactInvite(recent, shen)?.day, 17);
  }
});

test("缺联系、关系拒绝、资源不足、关柜和禁微信不能邀请，不覆盖任何已有约定", () => {
  const w = base();
  const patches: Partial<World>[] = [{ qualities: {} }, { energy: 3 }, { standing: 0 }, { compliance: 0 },
    { opinion: { shen: -30 } }, { heat: ["no-wechat"] }, { day: 29 },
    { appointments: [{ day: 3, slot: 0, person: "shen", reason: "refund", amount: 980 }] },
    { appointments: [{ day: 3, slot: 2, person: "mei", bring: ["shen"], reason: "visit" }] },
    { day: 5, weekendOrder: { person: "shen", due: 7, prepared: false } }];
  for (const patch of patches) {
    const before = { ...w, ...patch }; assert.ok(contactInviteBlock(before, PEOPLE, "shen"));
    assert.equal(inviteContact(before, PEOPLE, "shen"), before);
  }
  for (const id of ["missing", "luyao", "fangmin"]) assert.equal(inviteContact(w, PEOPLE, id), w);
  assert.equal(inviteContact({ ...w, qualities: { ...w.qualities, "week:member-day": 1 } }, PEOPLE, "shen").energy, 36);
  const refund = { ...w, appointments: [{ day: 3, slot: 0 as const, person: "shen", reason: "refund" as const, amount: 980 }] };
  assert.doesNotMatch(contactInviteBlock(refund, PEOPLE, "shen")!, /第 3 天|退货|980/);
});

test("预约占真实客位，优先换到客人方便的空时段，所有时段满则不扣费", () => {
  const guests = PEOPLE.filter(p => p.role === "customer" && p.id !== "shen").slice(0, 7);
  const w = { ...base(), appointments: guests.map(p => ({ person: p.id, day: 3, slot: 0 as const, reason: "visit" as const })) };
  assert.equal(planContactInvite(w, shen)?.slot, 1);
  const full = { ...w, appointments: [0, 1, 2].flatMap(slot => guests.map(p => ({ person: p.id, day: 3, slot: slot as 0 | 1 | 2, reason: "visit" as const }))) };
  assert.equal(inviteContact(full, PEOPLE, "shen"), full);
  const booked = inviteContact(w, PEOPLE, "shen");
  const arrived = beginSlot({ ...booked, day: 3, slot: 1 }, PEOPLE);
  assert.ok(arrived.present.shen);
  assert.ok(PEOPLE.filter(p => p.role === "customer" && p.id in arrived.present).length <= 7);
});

test("新预约和周末回响各按自己的方式跨季，过期预约不复活，旧档照常读", () => {
  const w: World = { ...base(), day: 28, appointments: [
    { person: "shen", day: 29, slot: 0, reason: "invited" },
    { person: "mei", day: 29, slot: 2, reason: "weekend", weekendOutcome: "rival" },
    { person: "anjie", day: 27, slot: 2, reason: "invited" },
    { person: "unknown", day: 31, slot: 0, reason: "invited" },
  ] };
  assert.deepEqual(nextSeason(w, PEOPLE).appointments, [
    { person: "shen", day: 1, slot: 0, reason: "invited" },
    { person: "mei", day: 1, slot: 2, reason: "weekend", weekendOutcome: "rival" },
  ]);
  assert.ok(parseWorld(serializeWorld(base())));
  assert.equal(parseWorld(serializeWorld({ ...w, appointments: [{ person: "shen", day: 3, slot: 0, reason: "invented" }] } as unknown as World)), null);
});

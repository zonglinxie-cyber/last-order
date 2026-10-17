import assert from "node:assert/strict";
import { test } from "node:test";
import { beginSlot, endDay, MAX_PRESENT_CUSTOMERS, newWorld, parseWorld, serializeWorld } from "../src/world/engine.ts";
import { currentArrival, publicAppointments } from "../src/world/arrivals.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { World } from "../src/world/types.ts";

const night = () => endDay({ ...newWorld("origin-4", PEOPLE), day: 4, slot: 3, opinion: { mei: 50 } }, PEOPLE);
const readBack = (world: World) => parseWorld(serializeWorld(world))!;
const visit = (): World => ({ ...newWorld("arrival", PEOPLE), day: 5, slot: 2,
  appointments: [{ day: 5, slot: 2, person: "zhou", reason: "visit", referredBy: "mei" }] });

test("真实熟客引荐：打烊约人、预告、到场及刷新保留同一个介绍人", () => {
  const invited = night();
  assert.ok(invited.log.some(l => l.text === "梅女士跟朋友说这层有个靠谱的人，周姐明天会来。"));
  assert.deepEqual(invited.appointments.find(a => a.person === "zhou"),
    { day: 5, slot: 2, person: "zhou", reason: "visit", referredBy: "mei" });
  assert.deepEqual(publicAppointments(invited, PEOPLE, 5), [{ name: "周姐", slot: 2, detail: "梅女士替你约来的" }]);
  const arrived = beginSlot({ ...readBack(invited), slot: 2 }, PEOPLE);
  assert.equal(arrived.appointments.some(a => a.person === "zhou" && a.day === 5 && a.slot === 2), false);
  assert.equal(currentArrival(readBack(arrived), "zhou", PEOPLE)?.title, "梅女士介绍来的");
  assert.ok(arrived.log.some(l => l.text === "周姐是梅女士介绍来的，今天专门来找你。"));
});

test("记录来路不会改变来访、自动购买、随机数或其它世界状态", () => {
  const start = { ...visit(), opinion: { zhou: 80 } };
  const withOrigin = beginSlot(start, PEOPLE);
  const withoutOrigin = beginSlot({ ...start, appointments: start.appointments.map(({ referredBy, ...ap }) => ap) }, PEOPLE);
  const { log: described, ...actual } = withOrigin;
  const { log: generic, ...expected } = withoutOrigin;
  assert.deepEqual(actual, expected);
  assert.ok(withOrigin.money > start.money, "包含实际自动购买的分支");
  assert.equal(described.length, generic.length);
});

test("微信本人和带来的朋友有各自来路，预告不泄漏退货或未知人名", () => {
  const world: World = { ...visit(), appointments: [
    { day: 5, slot: 2, person: "zhou", reason: "wechat", bring: ["mei", "mei", "zhou", "no-such-person"] },
    { day: 5, slot: 3, person: "shen", reason: "refund", amount: 980 },
    { day: 6, slot: 0, person: "mei", reason: "visit" },
    { day: 5, slot: 3, person: "no-such-person", reason: "visit" },
  ] };
  assert.deepEqual(publicAppointments(world, PEOPLE, 5), [{ name: "周姐", slot: 2, detail: "微信里约好，会和梅女士一起来" }]);
  const arrived = beginSlot(world, PEOPLE);
  assert.equal(currentArrival(arrived, "zhou", PEOPLE)?.title, "微信约来的");
  assert.equal(currentArrival(arrived, "mei", PEOPLE)?.title, "和周姐一起来的");
  assert.equal(arrived.log.filter(l => l.arrival?.person === "mei").length, 1);
});

test("没有来路的旧档只说如约而来，未知介绍人不暴露内部标识", () => {
  for (const referredBy of [undefined, "removed-person"]) {
    const world = visit();
    world.appointments[0].referredBy = referredBy;
    assert.equal(publicAppointments(readBack(world), PEOPLE, 5)[0].detail, "按约来访");
    const arrived = beginSlot(readBack(world), PEOPLE);
    assert.equal(currentArrival(arrived, "zhou", PEOPLE)?.title, "按约来访");
    assert.ok(arrived.log.some(l => l.text === "周姐如约来了。"));
  }
  const oldArrival = beginSlot(visit(), PEOPLE);
  oldArrival.log = oldArrival.log.map(({ arrival, ...entry }) => entry);
  assert.equal(currentArrival(readBack(oldArrival), "zhou", PEOPLE), null);
});

test("可选说明损坏只丢说明，旧档主状态保留；不修改传入对象", () => {
  const data = JSON.parse(serializeWorld(visit()));
  data.world.appointments[0].referredBy = ["mei"];
  data.world.log = [{ day: 5, slot: 2, text: "周姐来了。", arrival: { person: "zhou", kind: "referral", source: "zhou" } }];
  const parsed = parseWorld(data)!;
  assert.ok(parsed);
  assert.equal(parsed.appointments[0].referredBy, undefined);
  assert.equal(parsed.log[0].arrival, undefined);
  assert.equal(parsed.day, 5);
  assert.equal(parsed.log[0].text, "周姐来了。");
  assert.deepEqual(data.world.appointments[0].referredBy, ["mei"]);
});

test("来路仅属于本次在场：离场、下一时段和下一天都不冒用", () => {
  const world = beginSlot(visit(), PEOPLE);
  assert.ok(currentArrival(world, "zhou", PEOPLE));
  assert.equal(currentArrival({ ...world, present: {} }, "zhou", PEOPLE), null);
  assert.equal(currentArrival({ ...world, slot: 3 }, "zhou", PEOPLE), null);
  assert.equal(currentArrival({ ...world, day: 6 }, "zhou", PEOPLE), null);
});

test("退货仅在实际进门时说明，并沿用原退款金额", () => {
  const world: World = { ...visit(), money: 2000,
    appointments: [{ day: 5, slot: 2, person: "zhou", reason: "refund", amount: 980 }] };
  assert.deepEqual(publicAppointments(world, PEOPLE, 5), []);
  const arrived = beginSlot(world, PEOPLE);
  assert.equal(arrived.money, 1020);
  assert.equal(currentArrival(arrived, "zhou", PEOPLE)?.title, "回来退货");
});

test("预约因楼层满员没进门，不生成虚假的到场说明", () => {
  const customers = PEOPLE.filter(p => p.role === "customer").slice(0, MAX_PRESENT_CUSTOMERS + 1);
  const world: World = { ...visit(), appointments: customers.map(p => ({ day: 5, slot: 2, person: p.id, reason: "visit" })) };
  const arrived = beginSlot(world, PEOPLE);
  assert.equal(arrived.log.filter(l => l.arrival).length, MAX_PRESENT_CUSTOMERS);
  assert.equal(currentArrival(arrived, customers.at(-1)!.id, PEOPLE), null);
});

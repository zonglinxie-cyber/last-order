import assert from "node:assert/strict";
import { test } from "node:test";
import { ambient, beginServe, beginSlot, doVerb, endDay, inviteRivalGuest, MAX_PRESENT_CUSTOMERS, newWorld, nextSeason,
  parseWorld, prepareWeekendOrder, resolveServe, serializeWorld, weekendPrepareBlock, weekendSponsors, ZONE_GUEST_CAPACITY } from "../src/world/engine.ts";
import { currentArrival, publicAppointments } from "../src/world/arrivals.ts";
import { planWeekendOrder, weekendReview, WEEKEND_RESPONSE, WEEKEND_SPONSOR_RESPONSE } from "../src/world/weekend-orders.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { bestShelf, fitOfPerson, SHELF, SHELF_IDS, shelfFitTier } from "../src/world/shelf.ts";
import { LAST_MET, visitPerson } from "../src/world/visits.ts";
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

const referralWorld = (): World => ({ ...friday(),
  weekendOrder: { person: "liangxia", due: 7, prepared: false },
  opinion: { anjie: 35, liangxia: 0 }, qualities: { [LAST_MET("anjie")]: 1 }, samples: 0,
});

test("熟客牵线要求真接触、信任与双向熟悉，不拿单向关系或传闻高好感凑人", () => {
  const w = referralWorld();
  assert.ok(weekendSponsors(w, PEOPLE).some(p => p.id === "anjie"));
  const blockedCases: Partial<World>[] = [{ qualities: {} }, { opinion: { anjie: 29 } },
    { bonds: { "anjie>liangxia": 19 } }, { bonds: { "liangxia>anjie": 19 } }];
  for (const patch of blockedCases) {
    const blocked = { ...w, ...patch };
    assert.ok(!weekendSponsors(blocked, PEOPLE).some(p => p.id === "anjie"));
    assert.equal(prepareWeekendOrder(blocked, PEOPLE, "anjie"), blocked);
  }
  for (const id of ["liangxia", "roman", "missing"]) assert.equal(prepareWeekendOrder(w, PEOPLE, id), w);
});

test("牵线省小样但仍付精力：不能重复付费、换人或绕过拒绝与关柜；普通联系照旧", () => {
  const w = referralWorld(), prepared = prepareWeekendOrder(w, PEOPLE, "anjie");
  assert.equal(prepared.energy, w.energy - 6); assert.equal(prepared.samples, 0);
  assert.equal(prepared.weekendOrder?.sponsor, "anjie");
  assert.deepEqual(prepared.opinion, w.opinion); assert.equal(prepared.money, w.money);
  assert.deepEqual(parseWorld(serializeWorld(prepared))!.weekendOrder, prepared.weekendOrder);
  assert.equal(prepareWeekendOrder(prepared, PEOPLE), prepared);
  assert.equal(prepareWeekendOrder(prepared, PEOPLE, "anjie"), prepared);
  for (const patch of [{ energy: 5 }, { standing: 0 }, { compliance: 0 }, { opinion: { anjie: 35, liangxia: -30 } }, { day: 7, slot: 3 as const }]) {
    const blocked = { ...w, ...patch };
    assert.equal(prepareWeekendOrder(blocked, PEOPLE, "anjie"), blocked);
  }
  assert.equal(prepareWeekendOrder(w, PEOPLE), w);
  const direct = prepareWeekendOrder({ ...w, samples: 1 }, PEOPLE);
  assert.equal(direct.samples, 0); assert.equal(direct.weekendOrder?.sponsor, undefined);
});

test("牵线到场有真实介绍来路，和直接联系同样接待、不赠需求或自动买单", () => {
  const w = referralWorld();
  const referred = beginSlot({ ...prepareWeekendOrder(w, PEOPLE, "anjie"), day: 7, slot: 3, energy: 0 }, PEOPLE);
  const direct = beginSlot({ ...prepareWeekendOrder({ ...w, samples: 1 }, PEOPLE), day: 7, slot: 3, energy: 0 }, PEOPLE);
  assert.equal(currentArrival(referred, "liangxia", PEOPLE)?.title, "安姐介绍来的");
  assert.equal(currentArrival(parseWorld(serializeWorld(referred))!, "liangxia", PEOPLE)?.title, "安姐介绍来的");
  assert.equal(currentArrival({ ...referred, slot: 0 }, "liangxia", PEOPLE), null);
  assert.equal(referred.money, direct.money); assert.deepEqual(referred.opinion, direct.opinion);
  assert.deepEqual(referred.rivalBooking, direct.rivalBooking);
  assert.deepEqual(referred.qualities, direct.qualities);
  assert.equal(beginServe(referred, PEOPLE, "liangxia").energy, referred.energy - 12);
});

test("介绍人听实际结果且只结一次：合适加信任、勉强或硬推扣信任，未买不罚", () => {
  const people = PEOPLE.filter(p => ["liangxia", "anjie"].includes(p.id));
  for (const outcome of ["good", "mixed", "hard", "rival", "missed"] as const) {
    const w: World = { ...prepareWeekendOrder(referralWorld(), PEOPLE, "anjie"), day: 7, slot: 3,
      present: { anjie: "counter", liangxia: "counter" }, requests: [], memories: [],
      weekendOrder: { person: "liangxia", sponsor: "anjie", prepared: true, due: 7, outcome, resolvedDay: 7 } };
    const expected = WEEKEND_SPONSOR_RESPONSE[outcome];
    const end = endDay(w, people);
    assert.equal(end.opinion.anjie, w.opinion.anjie + expected.delta);
    assert.ok(end.log.some(l => l.text.includes(expected.line)));
    assert.equal(end.memories.filter(m => m.holder === "anjie" && m.act === expected.act).length, expected.delta ? 1 : 0);
    const again = endDay({ ...parseWorld(serializeWorld(end))!, day: 7, present: w.present }, people);
    assert.equal(again.opinion.anjie, end.opinion.anjie);
    assert.equal(again.memories.filter(m => m.holder === "anjie" && m.act === expected.act).length, expected.delta ? 1 : 0);
  }
});

test("有介绍人的旧档兼容与损坏校验：未准备不能凭空担保，不能自己介绍自己", () => {
  const w = referralWorld();
  for (const patch of [{ sponsor: "anjie", prepared: false }, { sponsor: "liangxia", prepared: true }, { sponsor: "", prepared: true }, { sponsor: 3, prepared: true }])
    assert.equal(parseWorld(serializeWorld({ ...w, weekendOrder: { ...w.weekendOrder!, ...patch } } as World)), null);
  assert.ok(parseWorld(serializeWorld(w)));
});

test("真实销售分支接到介绍人反馈：不另发奖金，季末先结人情再带入新季", () => {
  const guest = { ...PEOPLE.find(p => p.id === "mei")!, skin: { ...PEOPLE.find(p => p.id === "mei")!.skin!, budget: 10000, maxUnits: 2 } };
  const people = [guest, PEOPLE.find(p => p.id === "anjie")!];
  const mixed = SHELF_IDS.find(id => shelfFitTier(fitOfPerson(guest, id)) === "mixed")!;
  const bad = SHELF_IDS.find(id => shelfFitTier(fitOfPerson(guest, id)) === "negative")!;
  for (const [product, force, outcome] of [[bestShelf(guest), false, "good"], [mixed, false, "mixed"], [bad, true, "hard"]] as const) {
    const w: World = { ...newWorld("real-referral", people), day: 28, slot: 3, energy: 60,
      opinion: { anjie: 35 }, present: { anjie: "counter", mei: "counter" },
      weekendOrder: { person: "mei", sponsor: "anjie", prepared: true, due: 28 } };
    const sold = resolveServe(w, people, guest.id, product, 1, force);
    assert.equal(sold.weekendOrder?.outcome, outcome);
    const direct = endDay({ ...sold, weekendOrder: { ...sold.weekendOrder!, sponsor: undefined } }, people);
    const end = endDay(sold, people);
    assert.equal(end.money, direct.money);
    assert.equal(end.opinion.anjie - direct.opinion.anjie, WEEKEND_SPONSOR_RESPONSE[outcome].delta);
    const next = nextSeason(end, people);
    assert.equal(next.weekendOrder, undefined);
    assert.equal(next.opinion.anjie, Math.trunc(end.opinion.anjie / 2));
    assert.equal(next.money, 0);
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


// 周末复盘必须来自本次真实结算；记录事实不改变原有游戏结果。
const reviewGuest = { ...PEOPLE.find(p => p.id === "mei")!, skin: { ...PEOPLE.find(p => p.id === "mei")!.skin!, budget: 10000, maxUnits: 2 } };
const reviewWorld = (): World => ({ ...newWorld("weekend-review", PEOPLE), day: 7, slot: 3, energy: 80,
  present: { mei: "counter" }, weekendOrder: { person: "mei", due: 7, prepared: true } });
const withoutOrder = (w: World) => { const { weekendOrder, ...rest } = w; return rest; };
for (const reason of ["good", "mixed", "over-ask", "hard", "refused", "recent", "price", "mismatch"] as const) {
  test(`周末记录实际推荐 ${reason}：理由、件数与结算一致，其他状态不受复盘影响`, () => {
    const good = bestShelf(reviewGuest);
    const mixed = SHELF_IDS.find(id => shelfFitTier(fitOfPerson(reviewGuest, id)) === "mixed")!;
    const bad = SHELF_IDS.find(id => shelfFitTier(fitOfPerson(reviewGuest, id)) === "negative")!;
    const product = reason === "mixed" ? mixed : reason === "hard" || reason === "mismatch" ? bad : good;
    assert.ok(product);
    const guest = reason === "price" ? { ...reviewGuest, skin: { ...reviewGuest.skin, budget: SHELF[good].price - 1 } } : reviewGuest;
    const people = PEOPLE.map(p => p.id === "mei" ? guest : p);
    const w = { ...reviewWorld(), ...(reason === "refused" ? { opinion: { mei: -40 } } : {}),
      ...(reason === "recent" ? { qualities: { "bought:mei": 6 } } : {}) };
    const units = reason === "over-ask" ? 3 : 1;
    const input = structuredClone(w);
    const result = resolveServe(w, people, "mei", product, units, reason === "hard");
    const reference = resolveServe({ ...w, weekendOrder: undefined }, people, "mei", product, units, reason === "hard");
    assert.deepEqual(withoutOrder(result), withoutOrder(reference));
    assert.deepEqual(w, input);
    const o = result.weekendOrder!;
    assert.deepEqual(o.attempt, { day: 7, slot: 3, product, requested: units,
      sold: (result.money - w.money) / SHELF[product].price, reason });
    if (o.attempt!.sold) assert.deepEqual(o.sale, { product, units: o.attempt!.sold, amount: result.money - w.money, via: "serve" });
    else assert.equal(o.sale, undefined);
    assert.deepEqual(parseWorld(serializeWorld(result))?.weekendOrder, o);
    assert.ok(weekendReview(o)?.facts.some(line => line.includes(SHELF[product].name)));
  });
}

test("推荐失败后对面成交：保留两段事实，不能把选货不合适说成没有接待", () => {
  const first = sunday(true), guest = guestOf(first), profile = visitPerson(first, guest);
  const bad = SHELF_IDS.find(id => shelfFitTier(fitOfPerson(profile, id)) === "negative")!;
  assert.ok(bad);
  const tried = resolveServe(first, PEOPLE, guest.id, bad, 1);
  assert.equal(tried.weekendOrder?.attempt?.reason, "mismatch");
  const result = ambient(tried, PEOPLE), o = result.weekendOrder!;
  assert.equal(o.outcome, "rival"); assert.deepEqual(o.attempt, tried.weekendOrder!.attempt);
  const b = first.rivalBooking!;
  assert.deepEqual(o.sale, { product: b.product, units: b.units, amount: b.amount, via: "booking", invited: true });
  assert.deepEqual(parseWorld(serializeWorld(result))!.weekendOrder, o);
  const review = weekendReview(o)!;
  assert.ok(review.facts.some(line => line.includes("没有接住客人的需要")));
  assert.ok(review.facts.some(line => line.includes("最后在对面买好")));
  assert.ok(review.lesson.includes("留一次耐心给试用"));
  // 存档重读、重复结账不增加一笔记录或一笔钱。
  const again = ambient(parseWorld(serializeWorld(result))!, PEOPLE);
  assert.deepEqual(again.weekendOrder, o); assert.equal(again.rivalMoney, result.rivalMoney);
});

test("周末已结案或给别人推荐不改经过；退款排期不提前泄漏到复盘", () => {
  const w = reviewWorld(), sold = resolveServe(w, [reviewGuest], "mei", bestShelf(reviewGuest), 1);
  const o = sold.weekendOrder!;
  const later = resolveServe({ ...sold, energy: 80 }, [reviewGuest], "mei", bestShelf(reviewGuest), 2, true);
  assert.deepEqual(later.weekendOrder, o);
  const other = resolveServe({ ...w, present: { ...w.present, shen: "counter" } }, PEOPLE, "shen", bestShelf(PEOPLE.find(p => p.id === "shen")!), 1);
  assert.deepEqual(other.weekendOrder, w.weekendOrder);
  const withRefund = { ...sold, appointments: [...sold.appointments, { person: "mei", day: 9, slot: 1 as const, reason: "refund" as const, amount: 9999 }] };
  assert.deepEqual(weekendReview(withRefund.weekendOrder!), weekendReview(o));
  assert.ok(!JSON.stringify(weekendReview(o)).includes("9999"));
});

test("复盘旧档不编原因；未知商品、错误金额、无成交却有小票等损坏记录拒绝读取", () => {
  const old = { ...reviewWorld(), weekendOrder: { person: "mei", due: 7, prepared: true, outcome: "good" as const, resolvedDay: 7 } };
  assert.ok(parseWorld(serializeWorld(old))); assert.equal(weekendReview(old.weekendOrder), null);
  const sold = resolveServe(reviewWorld(), [reviewGuest], "mei", bestShelf(reviewGuest), 1), order = sold.weekendOrder!;
  for (const patch of [
    { attempt: { ...order.attempt!, product: "missing" } }, { attempt: { ...order.attempt!, reason: "guessed" } },
    { attempt: { ...order.attempt!, day: 4 } }, { attempt: { ...order.attempt!, slot: 4 } },
    { attempt: { ...order.attempt!, sold: 0 } }, { attempt: { ...order.attempt!, requested: -1 } },
    { sale: { ...order.sale!, amount: 1 } },
    { sale: { ...order.sale!, units: 2, amount: order.sale!.amount * 2 } }, { sale: { ...order.sale!, product: "missing" } },
    { sale: { ...order.sale!, via: "booking" } }, { sale: { ...order.sale!, invited: true } },
    { outcome: "missed" }, { outcome: undefined, resolvedDay: undefined },
  ]) assert.equal(parseWorld(serializeWorld({ ...sold, weekendOrder: { ...order, ...patch } } as World)), null, JSON.stringify(patch));
});


test("同事接手和熟客回购各记真实出处，不冒充玩家亲自推荐", () => {
  const w: World = { ...reviewWorld(), day: 6, slot: 1, opinion: { mei: 60, suman: 60 },
    qualities: { "client-note:mei:soothe": 1, "client-note:mei:steady": 1, "client-note:mei:correct": 1 },
    present: { mei: "counter", suman: "counter" } };
  const handoff = doVerb(w, PEOPLE, "handoff", ["suman", "mei"]);
  assert.equal(handoff.weekendOrder?.sale?.via, "handoff");
  assert.equal(handoff.weekendOrder?.attempt, undefined);
  assert.equal(handoff.weekendOrder!.sale!.amount, handoff.money - w.money);
  assert.ok(weekendReview(handoff.weekendOrder!)!.facts.some(line => line.includes("同事接手")));
  assert.ok(parseWorld(serializeWorld(handoff)));
  const back = beginSlot({ ...w, appointments: [{ day: 6, slot: 1, person: "mei", reason: "visit" }] }, PEOPLE);
  assert.equal(back.weekendOrder?.sale?.via, "return");
  assert.equal(back.weekendOrder?.attempt, undefined);
  assert.ok(weekendReview(back.weekendOrder!)!.facts.some(line => line.includes("回店时在本柜")));
  assert.ok(parseWorld(serializeWorld(back)));
});

test("没有邀来、邀来未开单两种实际经过分别提示，不凭空断言缺精力", () => {
  for (const prepared of [false, true]) {
    const w = sunday(prepared), result = ambient(w, PEOPLE), order = result.weekendOrder!;
    assert.equal(order.sale?.via, "booking"); assert.equal(order.sale?.invited, prepared);
    assert.equal(order.attempt, undefined);
    const review = weekendReview(order)!;
    assert.ok(review.facts.some(line => line.includes(prepared ? "已经邀来" : "没有邀来比货")));
    assert.ok(review.lesson.includes(prepared ? "还要留出接待的精力" : "周五先确认时间"));
    assert.ok(!JSON.stringify(review).includes("精力不足"));
  }
});

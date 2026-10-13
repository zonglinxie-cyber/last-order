import assert from "node:assert/strict";
import { test } from "node:test";
import { BUY_INTERVAL_DAYS, ambient, availableVerbs, beginServe, beginSlot, doVerb, newWorld, nextSeason, parseWorld, resolveServe, rivalGuarded, rivalPlanWord, rivalTarget, serializeWorld } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { POSITIVE_FIT, SHELF, bestShelf, fitOfPerson } from "../src/world/shelf.ts";
import { CARE_DAYS_MIN, CARE_TRUST_MIN, weekCareDaysOf, weekCareOf, weekCarePeople, weekGuardOf, weekGuardedPeople } from "../src/world/target.ts";
import { assignVisitContexts, LAST_MET, visitContext, visitPerson } from "../src/world/visits.ts";

const customer = (id: string) => PEOPLE.find(p => p.id === id)!;

test("熟客当天的用途在开场锁定；选货与预算读同一张临时诉求表，换季仍认得这人", () => {
  const originalDemands = structuredClone(customer("shen").skin!.demands);
  const first = beginSlot(newWorld("repeat-guest", PEOPLE), PEOPLE);
  assert.equal(visitContext(first, customer("shen")), null, "初见没有凭空变成熟客");
  const met = beginServe(first, PEOPLE, "shen");
  assert.equal(met.qualities[LAST_MET("shen")], 1);
  const second = beginSlot({ ...met, day: 2, slot: 0, appointments: [{ day: 2, slot: 0, person: "shen", reason: "visit" }] }, PEOPLE);
  const context = visitContext(second, customer("shen"));
  assert.ok(context, "回来的熟客有今天的用途");
  assert.match(context.line, /今天|这次/);
  const profile = visitPerson(second, customer("shen"));
  assert.equal(bestShelf(profile), bestShelf(visitPerson(parseWorld(serializeWorld(second))!, customer("shen"))));
  assert.deepEqual(visitContext(assignVisitContexts(second, PEOPLE), customer("shen")), context, "同一天重新落位不重抽");
  assert.deepEqual(customer("shen").skin!.demands, originalDemands, "长期人物资料没有被改写");
  const later = nextSeason(second, PEOPLE);
  assert.equal(later.qualities[LAST_MET("shen")], 1);
  assert.equal(later.qualities["visit-context-code:shen"], undefined, "临时用途不能带到下一季");
});

test("每一位可回访顾客的临时需求都有买得起的对症货", () => {
  const base = newWorld("repeat-roster", PEOPLE);
  let changed = 0;
  for (const p of PEOPLE.filter(p => p.role === "customer" && p.skin)) {
    const w = assignVisitContexts({ ...base, day: 9, present: { [p.id]: "counter" },
      qualities: { [LAST_MET(p.id)]: 2 } }, PEOPLE);
    const profile = visitPerson(w, p), best = bestShelf(profile);
    assert.ok(visitContext(w, p), `${p.name}没有回访用途`);
    assert.ok(SHELF[best].price <= profile.skin!.budget, `${p.name}今天的正解买不起`);
    assert.ok(fitOfPerson(profile, best) >= POSITIVE_FIT, `${p.name}今天没有对症货`);
    if (best !== bestShelf(p)) changed++;
  }
  assert.ok(changed >= 10, `今天实际要重新选货的人只有 ${changed} 位`);
});

test("陆遥锁定最低看法的柜前人；玩家照应目标后她不会临时改抢旁人", () => {
  const bare = { ...newWorld("rival-plan", PEOPLE), day: 3, slot: 1 as const, energy: 20,
    present: { shen: "counter" as const, mei: "cashier" as const, luyao: "rival" as const },
    opinion: { shen: -20, mei: -10 } };
  assert.equal(rivalTarget(bare, PEOPLE)?.id, "shen");
  const planned = { ...bare, rivalPlan: { day: 3, slot: 1 as const, person: "shen" } };
  const restored = parseWorld(serializeWorld(planned))!;
  assert.deepEqual(restored.rivalPlan, planned.rivalPlan);
  const justGreeted = ambient({ ...restored, touched: ["shen"] }, PEOPLE);
  assert.equal(weekGuardOf(justGreeted), 0, "只碰一下目标不算挡下对手");
  const guarded = ambient(beginServe(restored, PEOPLE, "shen"), PEOPLE);
  assert.equal(guarded.present.mei, "cashier");
  assert.equal(guarded.rivalMoney, 0);
  assert.equal(weekGuardOf(guarded), 1);
  assert.equal(weekGuardOf(ambient(guarded, PEOPLE)), 1, "重复结算不刷守客次数");

  let captured = false;
  for (let i = 0; i < 50; i++) {
    const missed = ambient({ ...planned, seed: `rival-${i}` }, PEOPLE);
    assert.notEqual(missed.present.mei, "rival", "公开盯一人后不能临时换目标");
    if (missed.present.shen === "rival") captured = true;
  }
  assert.ok(captured, "不照应目标时，抢客仍是真实威胁");
});

test("客情人数要有信任作底，一次随机送样不能直接过关", () => {
  const base = { ...newWorld("trust-gate", PEOPLE), day: 2, slot: 1 as const, energy: 40,
    present: { shen: "counter" as const } };
  const first = doVerb(base, PEOPLE, "sample", ["shen"]);
  assert.equal(weekCareOf(first), 0);
  assert.equal(doVerb(first, PEOPLE, "sample", ["shen"]), first, "同一天不能反复塞小样刷看法");
  const second = doVerb({ ...first, day: 3, energy: 40 }, PEOPLE, "sample", ["shen"]);
  assert.equal(weekCareOf(second), 1);
  assert.equal(second.qualities[LAST_MET("shen")], 3);
});

test("托单全柜每天最多一笔，同一同事每天只接一客；旧存档记号会迁移", () => {
  const base = { ...newWorld("handoff-limit", PEOPLE), day: 3, slot: 1 as const, energy: 40,
    present: { suman: "counter" as const, roman: "counter" as const, shen: "counter" as const, mei: "cashier" as const },
    opinion: { suman: 30, roman: 30 },
    qualities: { "client-note:shen:natural": 1, "client-note:mei:soothe": 1 } };
  assert.equal(doVerb({ ...base, qualities: {} }, PEOPLE, "handoff", ["suman", "shen"]).money, 0,
    "没问过的陌生客不能交给同事就自动卖出正确货");
  const first = doVerb(base, PEOPLE, "handoff", ["suman", "shen"]);
  assert.ok(first.money > 0);
  assert.equal(first.qualities["handoff-sale-day:3"], 1);
  assert.equal(doVerb(first, PEOPLE, "handoff", ["suman", "shen"]), first);
  assert.ok(!availableVerbs(first, PEOPLE, ["suman", "mei"]).includes("handoff"), "换客人不能绕过同事当天的照看名额");
  const second = doVerb(first, PEOPLE, "handoff", ["roman", "mei"]);
  assert.equal(second.money, first.money, "第二位同事照看可以，但不能凭空多开一笔自动单");
  const old = JSON.parse(serializeWorld(base));
  old.world.qualities["handoff-sale:suman:3"] = 1;
  const restored = parseWorld(old)!;
  assert.equal(restored.qualities["handoff-sale-day:3"], 1);
  assert.equal(restored.qualities["handoff-sale:suman:3"], undefined);
  assert.ok(!availableVerbs(restored, PEOPLE, ["suman", "mei"]).includes("handoff"), "旧档卖过一单的同事当天也已用完照看名额");
  assert.ok(availableVerbs(restored, PEOPLE, ["roman", "mei"]).includes("handoff"), "不能把没托过人的同事一起锁掉");
});

test("托单成交后的公开比货避开购买冷却期，没有可成交目标时不制造无解威胁", () => {
  const base = { ...newWorld("compare-cooldown", PEOPLE), day: 3, slot: 1 as const, energy: 80,
    present: { shen: "counter" as const, mei: "cashier" as const, suman: "counter" as const, luyao: "rival" as const },
    opinion: { shen: -10, mei: 0, suman: 30 },
    qualities: { "client-note:shen:natural": 1 },
    rivalPlan: { day: 3, slot: 1 as const, person: "shen", tactic: "invite" as const } };
  const handed = doVerb(base, PEOPLE, "handoff", ["suman", "shen"]);
  assert.ok(handed.money > base.money);
  const next = { ...handed, touched: [], slot: 2 as const };
  assert.equal(rivalTarget(next, PEOPLE)?.id, "mei", "比货应选还有正常成交窗口的顾客");
  const onlyRecent = { ...next, present: { shen: "counter" as const, luyao: "rival" as const } };
  assert.equal(rivalTarget(onlyRecent, PEOPLE), undefined, "唯一顾客刚买过时不亮出无解目标");
  assert.equal(rivalTarget({ ...onlyRecent, day: 3 + BUY_INTERVAL_DAYS - 1 }, PEOPLE), undefined);
  assert.equal(rivalTarget({ ...onlyRecent, day: 3 + BUY_INTERVAL_DAYS }, PEOPLE)?.id, "shen", "冷却结束即可再次比货");
  assert.equal(rivalTarget({ ...onlyRecent, day: 3 + BUY_INTERVAL_DAYS, opinion: { shen: -100 } }, PEOPLE), undefined,
    "已拒绝正常接待的顾客也不能被指定成必须成交的比货目标");
  const opening = beginSlot({ ...next, appointments: [
    { day: 3, slot: 2 as const, person: "shen", reason: "visit" as const },
    { day: 3, slot: 2 as const, person: "mei", reason: "visit" as const },
  ] }, PEOPLE);
  assert.equal(opening.rivalPlan?.tactic, "compare");
  assert.notEqual(opening.rivalPlan?.person, "shen", "实际开时段也不能锁刚刚代售过的客人");
});

test("客情要本周两天实事：同日送样加微信不重复计数，托单和同事不计人数", () => {
  const base = { ...newWorld("care-days", PEOPLE), day: 2, slot: 1 as const, energy: 80,
    present: { shen: "counter" as const, suman: "counter" as const }, opinion: { shen: 20, suman: 20 },
    qualities: { "secret-known:suman": 1 } };
  const sampled = doVerb(base, PEOPLE, "sample", ["shen"]);
  const wechat = doVerb(sampled, PEOPLE, "wechat", ["shen"]);
  assert.equal(weekCareOf(wechat), 0);
  assert.equal(weekCareDaysOf(wechat, "shen"), CARE_DAYS_MIN - 1);
  const handoff = doVerb({ ...wechat, day: 3, energy: 80 }, PEOPLE, "handoff", ["suman", "shen"]);
  assert.equal(weekCareOf(handoff), 0);
  assert.equal(weekCareDaysOf(handoff, "shen"), 1, "交给同事不算自己回访");
  const next = doVerb(handoff, PEOPLE, "sample", ["shen"]);
  assert.deepEqual(weekCarePeople(next), ["shen"]);
  const staffFirst = doVerb(base, PEOPLE, "keep", ["suman"]);
  const staffAgain = doVerb({ ...staffFirst, day: 3 }, PEOPLE, "keep", ["suman"]);
  assert.equal(weekCareOf(staffAgain), 0, "同事不是客情路线的顾客");
  const newWeek = doVerb({ ...next, day: 8, energy: 80 }, PEOPLE, "sample", ["shen"]);
  assert.equal(weekCareOf(newWeek), 0, "前一周的回访天数不带进新关");
});

test("正向成交先结信任奖励再记客情，刚跨门槛的第二天不会漏记", () => {
  const base = { ...newWorld("care-sale-order", PEOPLE), day: 2, slot: 1 as const, energy: 80,
    present: { shen: "counter" as const }, opinion: { shen: 2 } };
  const first = doVerb(base, PEOPLE, "sample", ["shen"]);
  assert.ok(first.opinion.shen < CARE_TRUST_MIN);
  const sold = resolveServe({ ...first, day: 3, energy: 80 }, PEOPLE, "shen", bestShelf(customer("shen")), 1);
  assert.ok(sold.money > first.money);
  assert.ok(sold.opinion.shen >= CARE_TRUST_MIN);
  assert.equal(weekCareOf(sold), 1);
});

test("托单引出公开比货；比货只认亲自对症成交，打招呼、开始接待、托单都不够", () => {
  const base = { ...newWorld("counter-plan", PEOPLE), day: 3, slot: 1 as const, energy: 80,
    present: { shen: "counter" as const, mei: "cashier" as const, suman: "counter" as const, luyao: "rival" as const },
    opinion: { shen: 0, mei: 0, suman: 20 },
    rivalPlan: { day: 3, slot: 1 as const, person: "shen", tactic: "invite" as const } };
  const handed = doVerb(base, PEOPLE, "handoff", ["suman", "shen"]);
  assert.ok(rivalGuarded(handed));
  assert.deepEqual(weekGuardedPeople(ambient(handed, PEOPLE)), ["shen"]);
  const next = beginSlot({ ...handed, slot: 2 }, PEOPLE);
  assert.equal(next.rivalPlan?.tactic, "compare");
  const compare = { ...base, rivalPlan: { ...base.rivalPlan, tactic: "compare" as const } };
  assert.match(rivalPlanWord(compare)!.howTo, /亲自对症成交/);
  assert.ok(!rivalGuarded(doVerb(compare, PEOPLE, "greet", ["shen"])));
  assert.ok(!rivalGuarded(beginServe(compare, PEOPLE, "shen")));
  assert.ok(!rivalGuarded(doVerb(compare, PEOPLE, "handoff", ["suman", "shen"])));
  const wrongProduct = (Object.keys(SHELF) as Array<keyof typeof SHELF>)
    .sort((a, b) => fitOfPerson(customer("shen"), a) - fitOfPerson(customer("shen"), b))[0];
  const wrong = resolveServe(compare, PEOPLE, "shen", wrongProduct, 1);
  assert.ok(!rivalGuarded(wrong), "错误选货不能挡比货");
  const sold = resolveServe(compare, PEOPLE, "shen", bestShelf(customer("shen")), 1);
  assert.ok(sold.money > base.money);
  assert.ok(rivalGuarded(sold));
  assert.equal(beginSlot({ ...sold, slot: 2 }, PEOPLE).rivalPlan?.tactic, "invite");
  assert.equal(weekGuardOf(ambient({ ...sold, qualities: { ...sold.qualities,
    "week-guard-person:1:shen": 1 } }, PEOPLE)), 1, "跨时段守同一人不刷次数");
  assert.deepEqual(parseWorld(serializeWorld(compare))?.rivalPlan, compare.rivalPlan);
  assert.equal(parseWorld(serializeWorld({ ...compare, rivalPlan: { ...compare.rivalPlan, tactic: "hidden" } } as never)), null);
});

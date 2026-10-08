// 七日周目（?mode=run）规则层：种子洗牌、阵容合法性、目标折算、存档校验、增幅、
// 以及 resolveRivalSale 与 resolveSale 对账。跑法：node --experimental-strip-types --test tests/run-rules.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUSTOMERS, DAYS, fitOf, floorCustomers, hasFlag, INITIAL, leaveSample, metersFor, parseCampaign,
  PRODUCTS, resolveRivalSale, resolveSale, SAVE_VERSION, startNextDay, startService, TARGET,
  targetOf, unitsWanted, weekOf, type BundleId, type CustomerId, type ProductId,
} from "../src/campaign.ts";
import { duelUnlockedBundles, type DuelState } from "../src/duel.ts";
import {
  applyRunPerk, nextRunSeed, perkChoices, RUN_PERKS, runTarget, runWeek, startRun,
} from "../src/run.ts";

const ALL_IDS = Object.keys(CUSTOMERS) as CustomerId[];

test("同一颗种子排出同一周，不同种子排出不同周", () => {
  assert.deepEqual(runWeek("week-1:1"), runWeek("week-1:1"), "同种子必须可复现");
  const signatures = new Set(["week-1:1", "week-1:2", "week-1:3", "week-1:4"].map(seed =>
    runWeek(seed).map(day => day.customers.join(",")).join("/")));
  assert.ok(signatures.size > 1, "不同种子不该排出同一副周牌");
});

test("生成周每天 1~3 位、顾客不重复、全员在池内", () => {
  for (let index = 0; index < 12; index++) {
    const week = runWeek(`week-1:${index}`);
    assert.equal(week.length, 5);
    const seen: CustomerId[] = [];
    week.forEach((day, i) => {
      assert.equal(day.day, i + 1);
      assert.ok(day.customers.length >= 1 && day.customers.length <= 3, `第 ${i + 1} 天阵容要在 1~3 人`);
      for (const id of day.customers) assert.ok(ALL_IDS.includes(id), `${id} 得是已知顾客`);
      seen.push(...day.customers);
    });
    assert.equal(new Set(seen).size, seen.length, "同一周里同一个人不能被排两次");
    assert.ok(seen.length >= 7 && seen.length <= 10, `整周客流 7~10 人次，实际 ${seen.length}`);
  }
});

test("周目标落在本周预算合计的 0.65~0.75 且取整到百位", () => {
  for (let index = 0; index < 8; index++) {
    const seed = `week-2:${index}`;
    const budget = runWeek(seed).flatMap(day => day.customers).reduce((sum, id) => sum + CUSTOMERS[id].budget, 0);
    const target = runTarget(seed);
    assert.ok(target >= Math.round(budget * 0.65 / 100) * 100, `${target} 不该低于预算的 0.65`);
    assert.ok(target <= Math.round(budget * 0.75 / 100) * 100 + 100, `${target} 不该高于预算的 0.75`);
    assert.equal(target % 100, 0);
  }
});

test("startRun 用生成周覆盖排程与目标，canonical 字段不落", () => {
  const run = startRun("week-1:7");
  assert.equal(run.day, 1);
  assert.equal(run.target, runTarget("week-1:7"));
  assert.equal(run.runSeed, "week-1:7");
  assert.equal(targetOf(run), run.target);
  assert.equal(targetOf(INITIAL), TARGET);
  assert.deepEqual(weekOf(run), run.week);
  assert.deepEqual(weekOf(INITIAL), DAYS);
  // 生成周的 floorCustomers 不挂 canonical 的 zhou2 / anjie2 链：排进谁的当天就只有谁。
  for (const story of run.week!) {
    const at = { ...run, day: story.day };
    assert.deepEqual(floorCustomers(at), story.customers, `第 ${story.day} 天阵容就是排程本身`);
  }
});

test("week / target / runSeed 进 parseCampaign，脏字段整份拒收", () => {
  const run = startRun("week-1:9");
  const restored = parseCampaign(JSON.stringify(run))!;
  assert.deepEqual(restored.week, run.week);
  assert.equal(restored.target, run.target);
  assert.equal(restored.runSeed, "week-1:9");

  const dirtyWeek = { ...run, week: [{ ...run.week![0], customers: ["ghost"] }] };
  assert.equal(parseCampaign(JSON.stringify(dirtyWeek)), null, "池外 ID 不认");
  const noCustomers = { ...run, week: [{ ...run.week![0], customers: [] }] };
  assert.equal(parseCampaign(JSON.stringify(noCustomers)), null, "空阵容不认");
  const badDay = { ...run, week: [{ ...run.week![0], day: 6 }] };
  assert.equal(parseCampaign(JSON.stringify(badDay)), null, "日次越界不认");
  assert.equal(parseCampaign(JSON.stringify({ ...run, target: 0 })), null);
  assert.equal(parseCampaign(JSON.stringify({ ...run, target: 200_001 })), null);
  assert.equal(parseCampaign(JSON.stringify({ ...run, target: 1234.5 })), null);
  assert.equal(parseCampaign(JSON.stringify({ ...run, runSeed: "nope" })), null);
  // canonical 存档不带这三个字段照样过：版本一致就够。
  assert.ok(parseCampaign(JSON.stringify(INITIAL)));
});

test("增幅：每条 perk 应用一次且 flag 落位", () => {
  const base = startRun("week-1:4");
  const boosted = applyRunPerk(base, "perk:energy:+15");
  assert.equal(boosted.energy, Math.min(100, base.energy + 15));
  assert.ok(hasFlag(boosted, "perk:energy:+15"));
  assert.ok(applyRunPerk(boosted, "perk:energy:+15") === boosted, "同一条增幅不叠加");

  assert.equal(applyRunPerk(base, "perk:samples:+2").samples, base.samples + 2);
  assert.equal(applyRunPerk(base, "perk:ledger:+6").compliance, Math.min(100, base.compliance + 6));
  assert.equal(applyRunPerk(base, "perk:target:-10%").target, Math.round(base.target! * 0.9 / 100) * 100);
  const shifted = applyRunPerk({ ...base, day: 2 }, "perk:shift:+5");
  for (const id of runWeek("week-1:4")[1].customers) {
    assert.equal(shifted.waitMeters[id], CUSTOMERS[id].patience + 5, "在场每位顾客耐心 +5");
  }
  // 最后一天不再给"早到五分钟"：周都要收了。
  const lastDay = { ...base, day: 5 };
  assert.equal(applyRunPerk(lastDay, "perk:shift:+5"), lastDay);
  // perk:sample-x2 走 leaveSample：信任多 +1。
  const sampled = leaveSample({ ...base, flags: ["perk:sample-x2"], dayServed: [] }, runWeek("week-1:4")[0].customers[0]);
  const plain = leaveSample(base, runWeek("week-1:4")[0].customers[0]);
  assert.equal(sampled.trust - base.trust, plain.trust - base.trust + 1);
});

test("perkChoices 只给没拿过且条件满足的，三条封顶", () => {
  const base = startRun("week-1:6");
  const first = perkChoices(base);
  assert.equal(first.length, 3);
  const picked = applyRunPerk(base, first[0].id);
  const next = perkChoices(picked);
  assert.equal(next.length, 3);
  assert.ok(!next.some(perk => perk.id === first[0].id), "拿过的增幅不再进选项");
  const allTaken = RUN_PERKS.reduce((s, perk) => ({ ...s, flags: [...s.flags, perk.id] }), base);
  assert.equal(perkChoices(allTaken).length, 0);
});

test("perk:edge 把连带门槛降下来，只由 duelBundleGate 一处算", () => {
  const duel = { interest: 60 } as DuelState;
  assert.ok(!duelUnlockedBundles(duel).includes("pair"), "60 兴趣正常开不出 pair");
  assert.deepEqual(duelUnlockedBundles(duel, { ...INITIAL, flags: ["perk:edge"] }), ["single", "pair"]);
  assert.deepEqual(duelUnlockedBundles({ ...duel, interest: 50 }, { ...INITIAL, flags: ["perk:edge"] }), ["single"], "地板 45 不穿透");
  assert.deepEqual(duelUnlockedBundles(duel, INITIAL), ["single"], "没带旗的存档不受影响");
});

test("resolveRivalSale 与 resolveSale 对同一单入账一致，但不动玩家侧", () => {
  const day2 = startNextDay(INITIAL);
  const id = "xiaoyu";
  const rival = resolveRivalSale(day2, id)!;
  assert.ok(rival, "该入得了账");
  // 同一位顾客、同一种库存，玩家自己接这一单的最优组合入账金额一致。
  let best: { product: ProductId; bundle: BundleId; amount: number } | null = null;
  for (const product of Object.keys(PRODUCTS) as ProductId[]) {
    const { tier } = fitOf(CUSTOMERS[id], product);
    if (tier === "negative" || day2.stock[product] <= 0) continue;
    for (const bundle of ["single", "pair", "set", "bulk"] as BundleId[]) {
      const amount = PRODUCTS[product].price * unitsWanted(CUSTOMERS[id], product, bundle, tier, day2.stock[product]);
      if (amount > (best?.amount ?? 0)) best = { product, bundle, amount };
    }
  }
  const sessioned = startService(day2, id);
  const playerSide = resolveSale(sessioned, {
    customerId: id, selectedProduct: best!.product, bundle: best!.bundle,
    revealed: CUSTOMERS[id].demands.map(d => d.trait), tested: true, askedQuestion: 0, claimed: false,
    interruption: true, interruptionHandled: true, force: false,
  })!;
  assert.equal(rival.outcome.amount, playerSide.outcome.amount, "同一单入账金额对得上");
  assert.equal(rival.campaign.sales - day2.sales, playerSide.campaign.sales - sessioned.sales);
  assert.equal(rival.campaign.stock[best!.product], day2.stock[best!.product] - playerSide.outcome.units, "库存同一道扣法");
  assert.equal(rival.campaign.orders.length, day2.orders.length + 1, "台账多一笔单");
  assert.ok(rival.campaign.dayServed.includes(id));
  assert.ok(hasFlag(rival.campaign, `served:${id}:good`));
  // 玩家侧不能动：体力、信任、耐心、班内分钟、activeSession 都原样。
  assert.equal(rival.campaign.energy, day2.energy);
  assert.equal(rival.campaign.trust, day2.trust);
  assert.equal(rival.campaign.shiftMinutes, day2.shiftMinutes);
  assert.deepEqual(rival.campaign.waitMeters, day2.waitMeters);
  assert.deepEqual(rival.campaign.lost, day2.lost, "陆遥开单不能替玩家把别的顾客耗走");
  assert.equal(rival.campaign.activeSession, null);
  // 玩家在接待时照样能给视野外的人入账：手上的单不丢。
  const serving = startService(day2, "zhou");
  const whileServing = resolveRivalSale(serving, id)!;
  assert.equal(whileServing.campaign.activeSession?.customerId, "zhou");
});


test("下一周的种子顺延周目号，周目计数随存档走", () => {
  const run = startRun("week-3:12");
  assert.equal(nextRunSeed(run), "week-4:13");
  assert.equal(nextRunSeed(INITIAL), null, "canonical 章节没有下一周");
});

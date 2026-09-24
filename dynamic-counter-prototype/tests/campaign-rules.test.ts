import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDawn, applyFinale, CUSTOMERS, dawnNotices, endingTitle, fitOf, floorCustomers, history, INITIAL, leaveSample, parseCampaign,
  PRODUCTS, QUESTIONS, resolveSale, RIVAL_INTERRUPTIONS, SAMPLE_RETURN_SALE, SAVE_VERSION, TARGET, type BundleId, type Campaign,
} from "../src/campaign.ts";
import { bestFit, herCap, runRoute } from "./clean-route.ts";

function campaign(patch: Partial<Campaign>): Campaign {
  return { ...INITIAL, ...patch, relations: { ...INITIAL.relations, ...patch.relations }, flags: patch.flags ?? [], history: patch.history ?? [] };
}

test("a clean route still needs day 5 to clear the target", () => {
  const clean = runRoute();
  assert.equal(TARGET, 21_000);
  assert.deepEqual(clean.lost, [], "读准上限的路线不该在路上丢掉任何人");
  assert.equal(clean.served, 10);
  assert.equal(clean.dayTotals[3], 17_430);
  assert.ok(clean.dayTotals[3] < TARGET, "第 4 天结束时还不能提前达标");
  assert.equal(clean.final.sales, 25_590);
  assert.ok(clean.final.sales >= TARGET);
  assert.equal(endingTitle(clean.final), "你留下了，而且没变成她们");
});

test("连带 is what closes the gap, not luck", () => {
  for (const id of Object.keys(CUSTOMERS) as (keyof typeof CUSTOMERS)[]) {
    assert.ok(herCap(id, bestFit(id)) >= 1, `${id} 合适的产品至少要能带走一件`);
  }
  const singles = runRoute("single");
  assert.deepEqual(singles.lost, []);
  assert.equal(singles.served, 10);
  assert.ok(singles.final.sales < TARGET, "一件都不连带也能活着，但到不了两万一千");
  const greedy = runRoute("bulk");
  assert.ok(greedy.lost.length >= 3, "每个人都按最多件数硬开口，前面的人会把后面的人耗光");
  assert.ok(greedy.final.sales < TARGET);
});

test("合适的产品唯一，而且她的底线问得到", () => {
  for (const customer of Object.values(CUSTOMERS)) {
    const productIds = Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[];
    const positive = productIds.filter(product => fitOf(customer, product).tier === "positive");
    assert.equal(positive.length, 1, `${customer.id} 应该只有一款真正合适的产品`);
    const disclosable = new Set([...Object.values(customer.cues), ...QUESTIONS[customer.id]].flatMap(entry => entry.reveals));
    if (customer.veto) assert.ok(disclosable.has(customer.veto.trait), `${customer.id} 的硬底线不能是问不出来的地雷`);
    for (const demand of customer.demands) {
      if (demand.weight >= 2) assert.ok(disclosable.has(demand.trait), `${customer.id} 的主要诉求「${demand.trait}」必须能靠观察或提问问出来`);
    }
  }
});

// 「持妆」必须是一个真答案，而不是只存在于文案里的诱惑。
test("持妆有一个真实需求，而且这个需求是前一天养出来的", () => {
  const wearCases = Object.values(CUSTOMERS).filter(customer => fitOf(customer, "glow").tier === "positive").map(customer => customer.id);
  assert.deepEqual(wearCases, ["anjie2"], "全柜只能有一个人把高遮瑕当正解，否则它又变成默认答案");
  assert.equal(fitOf(CUSTOMERS.anjie2, "repair").tier, "negative", "只会推最安全那支的人，在她这里就是推错了");
  assert.equal(fitOf(CUSTOMERS.anjie2, "soft").tier, "mixed", "轻薄在她这里只算勉强：撑不到敬酒");
  // 她回来要当天的妆，前提是第 4 天按她的皮肤给了修护；被退单的人不会回来找你要判断。
  assert.deepEqual(floorCustomers(campaign({ day: 5, flags: ["served:anjie:good"] })), ["anjie2", "returning"]);
  assert.deepEqual(floorCustomers(campaign({ day: 5, flags: ["served:anjie:risky", "anjie-blew-up"] })), ["returning"]);
  assert.deepEqual(floorCustomers(campaign({ day: 4, flags: ["served:anjie:good"] })), ["anjie"]);
  // 回来这件事得在晨会上说清，不然玩家以为现场随机多刷了一个人。
  assert.ok(dawnNotices(campaign({ day: 5, flags: ["served:anjie:good"] })).some(note => note.speaker.includes("安姐")));
  // 因果账本里也要留下一行：她的回来是第 4 天那个判断的结果，而且只留一次。
  const dawn = applyDawn(campaign({ day: 5, flags: ["served:anjie:good"] }));
  const cameBack = (c: Campaign) => c.history.filter(entry => entry.text.includes("安姐赶在化妆师之前回来")).length;
  assert.equal(cameBack(dawn), 1);
  assert.equal(cameBack(applyDawn(dawn)), 1, "重复过晨会不能把她回来再记一遍");
  assert.equal(cameBack(applyDawn(campaign({ day: 5, flags: ["served:anjie:risky"] }))), 0, "第 4 天没接对，就没有这一行");
});

test("history keeps more than 25 entries", () => {
  let state = INITIAL;
  for (let index = 0; index < 30; index += 1) state = { ...state, history: history(state, `记录${index}`) };
  assert.equal(state.history.length, 30);
  assert.equal(state.history[0]?.text, "记录0");
});

test("forcing Anjie comes back as a wedding-week blow-up", () => {
  const push = (bundle: BundleId) => resolveSale(campaign({ day: 5, sales: 0 }), {
    customerId: "anjie", selectedProduct: "glow", bundle, revealed: [], tested: true, askedQuestion: null,
    claimed: true, interruption: false, interruptionHandled: false, force: true,
  })!.campaign.orders[0].amount;
  const forced = resolveSale(campaign({ day: 5, sales: 18_000, daySales: 0 }), {
    customerId: "anjie", selectedProduct: "glow", bundle: "bulk", revealed: [], tested: true, askedQuestion: null,
    claimed: true, interruption: false, interruptionHandled: false, force: true,
  })!;
  assert.ok(forced.campaign.orders[0].amount > 0, "强推得先记上数字，否则没有东西可以冲回");
  const next = applyDawn(forced.campaign);
  assert.equal(next.sales, 18_000, "强推记进业绩多少，婚礼前就从业绩里退多少");
  assert.ok(next.flags.includes("anjie-blew-up"));
  // 晨会在退货落定之后才念数字，所以柜位那一条排在客诉后面。
  const blowUp = next.history.findIndex(entry => entry.text === "安姐婚前爆红，苏蔓的三年老客炸了");
  assert.ok(blowUp >= 0, "婚礼客诉要留在账本里");
  assert.ok(next.history.slice(blowUp + 1).some(entry => entry.text.startsWith("晨会 ·")), "晨会读的是已经落定的数字");
  assert.ok(dawnNotices(next).some(note => note.body.includes("婚礼前双颊爆红")));
  // 旧存档没有逐笔记账。兜底要等于最小的一件强推，不能和报价系统各说一套。
  const legacy = applyDawn(campaign({ day: 5, sales: 18_000, daySales: 0, flags: ["served:anjie:risky"] }));
  assert.equal(18_000 - legacy.sales, push("single"));
  assert.ok(18_000 - legacy.sales < forced.outcome.total, "旧存档没有账本，按最小的一件强推退，不能多退");
});

test("a sample left after a refusal returns as a small repurchase", () => {
  const refused = leaveSample(campaign({ day: 1, flags: ["served:shen:refused"] }), "shen");
  const next = applyDawn({ ...refused, day: 2, daySales: 0 });
  assert.equal(next.sales, SAMPLE_RETURN_SALE);
  assert.ok(next.flags.includes("sample-return:shen"));
  assert.ok(dawnNotices(next).some(note => note.speaker.includes("沈薇")));
});

test("old saves without the current version are discarded", () => {
  assert.equal(parseCampaign(JSON.stringify({ ...INITIAL, version: 1, sales: 99_000 })), null);
  assert.equal(parseCampaign(JSON.stringify(INITIAL))?.version, SAVE_VERSION);
});

test("a same-day risky last order is clawed back in the finale", () => {
  const closed = resolveSale(campaign({ day: 5, sales: 20_000 }), {
    customerId: "returning", selectedProduct: "repair", bundle: "bulk", revealed: [],
    tested: true, askedQuestion: 0, claimed: true, interruption: true, interruptionHandled: true, force: true,
  });
  assert.ok(closed);
  const booked = 4 * PRODUCTS.repair.price;
  assert.equal(closed.outcome.units, 4, "强推按你开口的件数记账");
  assert.equal(closed.campaign.sales, 20_000 + booked);
  const finale = applyFinale(closed.campaign);
  assert.equal(finale.sales, 20_000, "批量强推的金额在结局整笔暂扣");
  assert.ok(finale.flags.includes("returning-chargeback"));
});

test("the four endings each need their own condition", () => {
  const base = { sales: 21_000, compliance: 60, trust: 60 };
  assert.equal(endingTitle(campaign(base)), "你留下了，而且没变成她们");
  assert.equal(endingTitle(campaign({ ...base, compliance: 30 })), "销冠的账单");
  assert.equal(endingTitle(campaign({ ...base, trust: 30 })), "你留下了，可没人等你");
  assert.equal(endingTitle(campaign({ ...base, sales: 12_000, trust: 60 })), "没转正，但有人等你");
  assert.equal(endingTitle(campaign({ ...base, sales: 12_000, trust: 30 })), "柜台灯灭了");
});

test("Lu Yao's interruption copy changes by customer", () => {
  assert.notEqual(RIVAL_INTERRUPTIONS.shen.quote, RIVAL_INTERRUPTIONS.zhou.quote);
  assert.notEqual(RIVAL_INTERRUPTIONS.shen.quote, RIVAL_INTERRUPTIONS.returning.quote);
});

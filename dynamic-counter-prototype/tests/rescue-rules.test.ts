import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceFloorTime, applyDawn, askService, availableCustomers, BUNDLES, canPullOver, chooseBundle, closeService, consultationRecord, CUSTOMERS, dayEvent, endingTitle,
  FACE_TRIAL_MINUTES, faceTrialService, hasFlag, INITIAL, leaveSample, observeService, openFloorState, orderQuote, parseCampaign, PRODUCTS, pullOver, pullOverLabel, patienceLeft, PULL_OVER_MINUTES, PULL_OVER_WINDOW, QUESTIONS,
  releaseService, requestStaffHelp, respondToRival, RIVAL_IDS, selectServiceProduct, settleDayEvent, spendAttention,
  startNextDay, startService, TARGET, trialService, type BundleId, type Campaign, type CueId, type CustomerId, type ProductId,
} from "../src/campaign.ts";
import { bestFit, herCap, playCustomer, runRoute } from "./clean-route.ts";

// Stop right after the trial so a test can drive the closing itself.
function consult(state: Campaign, id: CustomerId = "shen", product: ProductId = bestFit(id), bundle: BundleId = "single"): Campaign {
  let s = startService(state, id);
  assert.equal(s.activeSession?.customerId, id);
  s = observeService(observeService(s, "eyes"), "cheek");
  s = askService(s, QUESTIONS[id][0].label, 0);
  s = trialService(selectServiceProduct(s, product));
  return bundle === "single" ? s : chooseBundle(s, bundle);
}

test("clock, patience and fractional time survive a saved floor", () => {
  const nineteen = advanceFloorTime(INITIAL, 19);
  assert.equal(nineteen.shiftMinutes, 0);
  const restored = parseCampaign(JSON.stringify(nineteen))!;
  const minute = advanceFloorTime(restored, 1);
  assert.equal(minute.shiftMinutes, 1);
  assert.equal(minute.waitMeters.shen, CUSTOMERS.shen.patience - 1);
  assert.equal(minute.floorSeconds, 0);
  const left = advanceFloorTime(minute, CUSTOMERS.shen.patience * 20);
  assert.ok(left.lost.includes("shen"));
  assert.ok(left.history.some(row => row.text.includes("陆遥带沈薇")));
  assert.equal(advanceFloorTime(left, 0), left);
});

test("repeated observations do not spend time; a returned consultation remains resumable", () => {
  const observed = observeService(startService(INITIAL, "shen"), "eyes");
  assert.equal(observeService(observed, "eyes"), observed);
  const restored = parseCampaign(JSON.stringify(observed))!;
  assert.deepEqual(restored.activeSession?.discovered, ["eyes"]);
  assert.equal(startService(restored, "mei"), restored);
  assert.equal(startService(restored, "shen"), restored);
  const expired = advanceFloorTime(restored, CUSTOMERS.shen.patience * 20);
  assert.equal(expired.activeSession, null);
  assert.equal(releaseService(releaseService(restored)).lost.length, 1);
});

test("a sample never turns an unsuitable trial into a suitable sale", () => {
  let s = respondToRival(consult(INITIAL, "shen", "repair"), "record");
  s = leaveSample(s, "shen");
  assert.equal(s.activeSession?.reaction, "negative");
  assert.equal(leaveSample(s, "shen"), s);
  const refused = closeService(s)!;
  assert.equal(refused.outcome.units, 0);
  assert.equal(refused.outcome.amount, 0);
  assert.ok(refused.campaign.flags.includes("served:shen:refused"));
  const repaired = trialService(selectServiceProduct(s, "soft"));
  assert.equal(repaired.activeSession?.reaction, "positive");
  const sold = closeService(repaired)!;
  assert.equal(sold.outcome.units, 1, "默认只开口一件");
  assert.equal(sold.outcome.amount, PRODUCTS.soft.price);
  assert.equal(closeService(chooseBundle(repaired, "set"))!.outcome.units, herCap("shen", "soft"));
});

test("半脸上妆要先试过才让上，多花两分钟换她没说出口的那件事", () => {
  const fresh = startService(INITIAL, "shen");
  assert.equal(faceTrialService(fresh), fresh, "手背都还没试，就上不了脸");
  const trialled = consult(INITIAL, "shen", "soft");
  const shown = faceTrialService(trialled);
  assert.equal(shown.activeSession?.faceTrialled, true);
  assert.equal(shown.activeSession?.faceTrialRevealed, "steady", "natural 已经问出口了，上脸才露出第二重的 steady");
  assert.ok(shown.activeSession?.revealed.includes("steady"));
  assert.equal(shown.shiftMinutes, trialled.shiftMinutes + FACE_TRIAL_MINUTES, "这两分钟从队伍另一头扣");
  assert.equal(faceTrialService(shown), shown, "同一支不能在她脸上试两次");
  const switched = selectServiceProduct(shown, "glow");
  assert.equal(switched.activeSession?.faceTrialled, false, "换一支等于重新上脸");
  assert.equal(switched.activeSession?.faceTrialRevealed, "steady", "她说出口的那件事不会因为换产品忘掉");
});

test("半脸上过妆还硬推，扣的是明知故犯，不是营业额", () => {
  const pending = respondToRival(consult(INITIAL, "shen", "glow"), "clarify");
  const blind = closeService(pending, true)!;
  const seen = closeService(faceTrialService(pending), true)!;
  assert.deepEqual(seen.campaign.lost, blind.campaign.lost, "两次跑法不能一个丢了人一个没丢");
  assert.equal(seen.campaign.sales, blind.campaign.sales, "钱一分不少：她照样把单买了");
  assert.equal(seen.campaign.trust, blind.campaign.trust - 4);
  assert.equal(seen.campaign.compliance, blind.campaign.compliance - 4);
  assert.ok(seen.campaign.history.some(row => row.text.includes("照着镜子看过这半张脸")));
  assert.ok(!blind.campaign.history.some(row => row.text.includes("照着镜子看过这半张脸")));
  assert.ok(seen.outcome.body.includes("她知道不合适，你也知道"));
});

// 面板上那句「还差什么」由这里念出来。两个 UI 都问同一个函数，所以措辞只在这里对一次。
const look = (...cues: CueId[]) => { let s = startService(INITIAL, "shen"); for (const cue of cues) s = observeService(s, cue); return s.activeSession!; };

test("她脸上没看的点、没说出口的要求，念成句子而不是 x/y", () => {
  const one = look("eyes");
  assert.deepEqual(consultationRecord(CUSTOMERS.shen, one.discovered, one.revealed), {
    face: "", said: ["妆感要轻薄自然"], blind: "还有 2 条她没说出口 · 问出来，或上脸试出来", veto: "一厚就卡粉，镜头里全是粉感",
  }, "只看过一处时她脸上全是闪着的点，报「还剩几处」没有取舍可言");
  const two = look("eyes", "cheek");
  assert.equal(consultationRecord(CUSTOMERS.shen, two.discovered, two.revealed).face, "她脸上还有 1 处没看：鼻翼");
  assert.equal(consultationRecord(CUSTOMERS.shen, look("eyes", "cheek", "nose").discovered, two.revealed).face, "", "看完最后一处就不再报剩下的点");
  // 半脸上妆的按钮已经摆在面板上，那一句不用再教她怎么问
  assert.equal(consultationRecord(CUSTOMERS.shen, two.discovered, two.revealed, true).blind, "还有 2 条她没说出口");
  for (const line of Object.values(consultationRecord(CUSTOMERS.shen, two.discovered, two.revealed)).flat())
    assert.doesNotMatch(line, /\d\s*\/\s*\d/, `${line} 里不该再有分数样子的计数`);
});

test("每个人都上脸，队伍后面就会少两个人", () => {
  const everyTrial = runRoute("matched", true);
  assert.deepEqual(everyTrial.lost, ["mei", "zhou2"], "两分钟一次不是免费的：排队的人先走");
  assert.equal(everyTrial.served, 8);
  assert.equal(everyTrial.final.sales, 22_230, "量出来的值，不是写出来的");
  assert.ok(everyTrial.final.sales >= TARGET, "全都试也还过线，但余量只剩 ¥1,230");
  assert.equal(everyTrial.final.standing, 44, "少了两位顾客，柜位那句话就贴着风险线");
});

// 一次杠杆值多少钱，要拿一整周量：只要有人看表就迎，救回一个的同时把另一个推向门口。
test("迎上去是保险不是收入：三条整周路线的钱和走的人一个都没变，只少了小样", () => {
  const greedy = runRoute("matched", false, false, true);
  assert.equal(greedy.pulled, 2);
  assert.deepEqual(greedy.lost, []);
  assert.equal(greedy.final.sales, 25_590, "不动这一行的清洁路线一分不差：这一步不能拿来刷营业额");
  assert.equal(greedy.final.samples, 6, "迎出去的两支，是从柜台那两支里出的");
  const trials = runRoute("matched", true, false, true);
  assert.equal(trials.pulled, 3);
  assert.deepEqual(trials.lost, ["mei", "zhou2"], "上脸那条线该走的两位，窗口开在别人身上就救不到她");
  assert.equal(trials.final.sales, 22_230);
  assert.equal(trials.final.standing, 44);
  const roster = runRoute("matched", false, true, true);
  assert.equal(roster.pulled, 2);
  assert.equal(roster.final.sales, 29_510);
  assert.equal(roster.final.samples, 0, "私域那条线小样本来就不够分，迎完就没有了");
});

test("rival decisions are required and idempotent; split risk refunds only the recorded share", () => {

  const pending = consult(INITIAL, "shen", "glow");
  assert.equal(closeService(pending, true), null);
  const shared = respondToRival(pending, "yield");
  assert.equal(respondToRival(shared, "record"), shared);
  const closed = closeService(shared, true)!;
  assert.equal(closed.outcome.units, 1, "她一件都不认同，强推也只能记一件");
  assert.equal(closed.outcome.total, PRODUCTS.glow.price);
  assert.equal(closed.outcome.amount, PRODUCTS.glow.price / 2);
  assert.equal(closed.campaign.orders[0].total, PRODUCTS.glow.price);
  assert.equal(closed.campaign.orders[0].amount, PRODUCTS.glow.price / 2);
  assert.equal(closeService(closed.campaign), null);
  const returned = applyDawn({ ...closed.campaign, day: 3, daySales: 0 });
  assert.equal(returned.sales, 0);
  assert.equal(returned.daySales, -PRODUCTS.glow.price / 2);
  assert.equal(parseCampaign(JSON.stringify(returned))?.daySales, -PRODUCTS.glow.price / 2);
  assert.ok(returned.flags.includes("shen-chargeback"));
  assert.equal(applyDawn(returned).sales, returned.sales);
});

test("old version-2 saves migrate additively and malformed sessions cannot enter gameplay", () => {
  const { orders, shiftMinutes, floorSeconds, finished, ...old } = INITIAL;
  const restored = parseCampaign(JSON.stringify(old))!;
  assert.equal(restored.shiftMinutes, 0);
  assert.deepEqual(restored.orders, []);
  assert.equal(restored.finished, false);
  for (const patch of [{ day: 1.5 }, { day: 6 }, { sales: "1000" }, { sales: null }, { activeSession: { customerId: "unknown" } },
    { activeSession: { customerId: "shen", discovered: [], faceTrialled: "yes" } },
    { activeSession: { customerId: "shen", discovered: [], faceTrialRevealed: "made-up" } }]) {
    assert.equal(parseCampaign(JSON.stringify({ ...INITIAL, ...patch })), null);
  }
  // 旧存档没有上脸这一格：不能整份丢掉，按「还没上脸」补。
  const beforeFaceTrial = parseCampaign(JSON.stringify({ ...INITIAL, activeSession: { customerId: "shen", discovered: ["eyes"], selectedProduct: null, askedQuestion: null, tested: true } }))!;
  assert.equal(beforeFaceTrial.activeSession?.faceTrialled, false);
  assert.equal(beforeFaceTrial.activeSession?.faceTrialRevealed, null);
});

test("staff favors require a relationship and can only be used once per shift", () => {
  assert.equal(requestStaffHelp(INITIAL, "shen"), INITIAL);
  const helped = requestStaffHelp({ ...INITIAL, flags: ["covered-suman"] }, "shen");
  assert.equal(helped.waitMeters.shen, INITIAL.waitMeters.shen + 2);
  assert.equal(helped.energy, 94);
  assert.equal(requestStaffHelp(helped, "mei"), helped);
});

test("迎上去：一支小样加离柜两分钟，只能请回一个", () => {
  // 第 4 天那两位耐心不一样（10 / 9），才看得出"从另一头扣"扣掉了谁。
  const day4: Campaign = { ...INITIAL, day: 4, flags: ["served:zhou:good"], waitMeters: {}, eventDoneDays: [1, 2, 3] };
  const drifting = spendAttention(day4, null, 7);
  assert.equal(patienceLeft(drifting, "zhou2"), PULL_OVER_WINDOW, "她已经在看表了");
  assert.equal(canPullOver(drifting, "anjie"), false, "她还在三分钟往上，迎上去没有意义");
  assert.equal(canPullOver(drifting, "zhou2"), true);
  assert.equal(pullOverLabel(drifting, "anjie"), "迎上去 · 她还没开始看表");
  assert.equal(pullOverLabel(drifting, "zhou2"), `迎上去 · 1 支小样 · ${PULL_OVER_MINUTES} 分钟`);

  const greeted = pullOver(drifting, "zhou2");
  assert.equal(greeted.samples, day4.samples - 1, "样品从中庭那一支走");
  assert.equal(patienceLeft(greeted, "zhou2"), CUSTOMERS.zhou2.patience, "她重新站回柜台前");
  assert.equal(patienceLeft(greeted, "anjie"), 1, "离柜的两分钟照扣另一头");
  assert.equal(greeted.shiftMinutes, drifting.shiftMinutes + PULL_OVER_MINUTES);
  assert.ok(!hasFlag(greeted, "sample:zhou2"), "中庭那一支换的是她肯走过来，不是她明天回来（那要留在柜台那一支）");
  assert.ok(greeted.history.some(row => row.text.includes("把她从中庭那边请回柜台")));
  assert.equal(canPullOver(greeted, "zhou2"), false, "同一个人整周只迎一次");
  assert.equal(pullOver(greeted, "zhou2"), greeted, "按不动的时候一个数都不该变");

  const serving = startService(drifting, "anjie");
  assert.ok(availableCustomers(serving).includes("zhou2"), "她还站在场里——下面那条拒的是「你在接待」，不是「她已经走了」");
  assert.equal(canPullOver(serving, "zhou2"), false, "人还在你手上，走不开");
  assert.match(pullOverLabel(serving, "zhou2"), /你还在接待安姐/);
  assert.equal(canPullOver({ ...drifting, samples: 0 }, "zhou2"), false, "柜后空了就没有这一步");

  // 两个都到了门口：请回这个，那个就走掉——第一晚那句"只能先抓住一个"第一次落在玩家手上。
  const bothLate = spendAttention(day4, null, 8);
  assert.deepEqual(availableCustomers(bothLate), ["anjie", "zhou2"]);
  const savedOne = pullOver(bothLate, "anjie");
  assert.deepEqual(savedOne.lost, ["zhou2"]);
  assert.equal(patienceLeft(savedOne, "anjie"), CUSTOMERS.anjie.patience);
  // 手不伸出去的那一支：再走两分钟两位都没了。这一步买的是"至少留住一个"，不是多一位客流。
  assert.deepEqual(spendAttention(bothLate, null, 2).lost.slice().sort(), ["anjie", "zhou2"]);
});

test("every displayed quote adds up to its complete order and actual share", () => {
  const bundles = Object.keys(BUNDLES) as BundleId[];
  for (const id of Object.keys(CUSTOMERS) as CustomerId[]) for (const product of ["soft", "glow", "repair"] as ProductId[]) for (const bundle of bundles) for (const shared of [false, true]) {
    const quote = orderQuote(id, product, bundle, shared);
    assert.equal(quote.lines.reduce((sum, row) => sum + row.amount, 0), quote.total);
    assert.equal(quote.total, quote.units * PRODUCTS[product].price);
    assert.equal(quote.amount, shared ? quote.total / 2 : quote.total);
    assert.ok(quote.units <= CUSTOMERS[id].maxUnits, `${id} 不能带走超过她说过的用量`);
    assert.ok(quote.total <= CUSTOMERS[id].budget || quote.tier === "negative", `${id} 的报价不能超出她的预算`);
    if (quote.tier === "negative") assert.equal(quote.units, 0, "方向不对时报价就是零");
    if (!quote.units) assert.ok(quote.tier === "negative" || PRODUCTS[product].price > CUSTOMERS[id].budget, "零件必须说得出理由");
    assert.ok(quote.minutes >= 1, "任何一次关单都要占现场时间");
  }
});

test("refused customers do not create phantom ownership or paid-order events", () => {
  const day2 = { ...INITIAL, day: 2, dayServed: ["xiaoyu" as const], flags: ["served:xiaoyu:refused"] };
  assert.equal(dayEvent(day2).choices.some(choice => choice.id === "split-tang"), false);
  const day3 = { ...INITIAL, day: 3, dayServed: ["zhao" as const], flags: ["served:zhao:refused"] };
  assert.equal(dayEvent(day3).choices.some(choice => choice.id === "protect-zhao"), false);
  assert.equal(dayEvent({ ...INITIAL, day: 4, lost: ["anjie"] }).choices.some(choice => choice.id === "give-gifts"), false);
});

test("transferring a risky order only refunds the share still credited to you", () => {
  let s = consult({ ...INITIAL, day: 2, waitMeters: { xiaoyu: 8, zhou: 8 } }, "xiaoyu", "glow");
  s = closeService(s, true)!.campaign;
  assert.equal(s.sales, PRODUCTS.glow.price);
  s = settleDayEvent(s, "split-tang");
  assert.equal(s.sales, PRODUCTS.glow.price / 2);
  assert.equal(s.orders[0].amount, PRODUCTS.glow.price / 2);
  const refunded = applyDawn({ ...s, day: 4, daySales: 0 });
  assert.equal(refunded.daySales, -PRODUCTS.glow.price / 2);
  assert.equal(refunded.sales, 0);
});

test("legacy purchases keep their event and transferred refund liability without an orders field", () => {
  const booked = PRODUCTS.glow.price;
  const legacy: Campaign = { ...INITIAL, day: 2, sales: booked, daySales: booked, dayServed: ["xiaoyu"], flags: ["served:xiaoyu:risky"] };
  const shared = settleDayEvent(legacy, "split-tang");
  assert.equal(shared.sales, booked / 2);
  assert.equal(applyDawn({ ...shared, day: 4, daySales: 0 }).daySales, -booked / 2);
  assert.ok(dayEvent({ ...INITIAL, day: 3, flags: ["served:zhao:good"] }).choices.some(choice => choice.id === "protect-zhao"));
});

test("gift choices cannot spend inventory that does not exist", () => {
  const state: Campaign = { ...INITIAL, day: 4, samples: 1, orders: [{ day: 4, customerId: "anjie", product: "repair", total: 6800, amount: 6800, shared: false, risky: false }] };
  assert.equal(settleDayEvent(state, "give-gifts"), state);
  assert.equal(settleDayEvent(state, "sign-gifts"), state);
});

test("the closing response is recorded once and survives reload", () => {
  const closed = settleDayEvent(INITIAL, "refuse-suman");
  assert.ok(closed.history.some(entry => entry.text.includes("苏蔓沉默了")));
  assert.deepEqual(parseCampaign(JSON.stringify(closed))?.history, closed.history);
  assert.equal(settleDayEvent(closed, "refuse-suman"), closed);
});

test("an actual five-day route survives saves and still needs the final order", () => {
  const clean = runRoute();
  assert.equal(clean.served, 10);
  assert.equal(clean.final.orders.length, 10);
  assert.equal(clean.final.finished, true);
  assert.equal(endingTitle(clean.final), "你留下了，而且没变成她们");
  const reloaded = parseCampaign(JSON.stringify(clean.final))!;
  assert.equal(reloaded.sales, clean.final.sales);
  assert.deepEqual(reloaded.orders, clean.final.orders);
  assert.ok(clean.dayTotals[3] < TARGET, "第 4 天还不能提前达标");
  assert.ok(clean.final.sales >= TARGET);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceFloorTime, applyDawn, askService, availableCustomers, BUNDLES, canPullOver, canTransfer, canTransferVia, chooseBundle, closeService, consultationRecord, CUSTOMERS, dayEvent, endingTitle,
  FACE_TRIAL_MINUTES, faceTrialService, floorCustomers, FLOOR_SECONDS_PER_ACTION, hasFlag, INITIAL, leaveSample, observeService, openFloorState, orderQuote, parseCampaign, PRODUCTS, pullOver, pullOverLabel, patienceLeft, PULL_OVER_MINUTES, PULL_OVER_WINDOW, QUESTIONS,
  releaseService, requestStaffHelp, respondToRival, RIVAL_IDS, selectServiceProduct, settleDayEvent, spendAttention, TANGKE_STOCK_GATE,
  startNextDay, startService, STANDING_RISK, TARGET, offerTransfer, transferLabel, transferStock, TRANSFER_MINUTES, TRANSFER_UNITS, trialService, type BundleId, type Campaign, type CueId, type CustomerId, type ProductId,
  canCheckCounter, checkCounter, checkCounterLabel, dawnNotices, EXPIRED_SAMPLING, expiredSamplesLeft, ledgerSum,
} from "../src/campaign.ts";
import { bestFit, herCap, playCustomer, PRODUCT_IDS, runRoute } from "./clean-route.ts";

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
  assert.equal(everyTrial.final.sales, 21_250, "量出来的值，不是写出来的");
  assert.ok(everyTrial.final.sales >= TARGET, "全都试也还过线，但余量只剩 ¥250");
  assert.equal(everyTrial.final.standing, 36, "少了两位顾客，柜位那句话就掉到风险线以下了");
  assert.ok(everyTrial.final.standing < STANDING_RISK, "这条线的代价就是第 5 天区域经理那句「评估是否保留」");
});

// 抽屉里该放几支，得先量出来这一周到底被谁吃掉多少：整周路线的件数按支拆开。
const byProduct = (route: { final: Campaign }) => PRODUCT_IDS
  .map(product => route.final.orders.filter(order => order.product === product).reduce((sum, order) => sum + order.units, 0));

test("一周的配货和整周的动销对不上：断的是柔焦，卖不动的是持妆", () => {
  const clean = runRoute();
  assert.deepEqual(byProduct(clean), [10, 2, 6], "柔焦卖到最后一支，修护被第 4 天那批没赶上的两支削掉，持妆只走两套");
  assert.equal(clean.final.stock.soft, 0);
  assert.equal(clean.final.stock.repair, 1, "配到柜上 7 支、卖掉 6 支：少卖掉的那一支不是没人要，是当天没到");
  assert.equal(clean.final.stock.glow, 2, "配下来四套只卖掉两套：没人要的那支占着抽屉");
  // 需求本来是 11 支柔焦、7 支修护：把电话打在缺口上的那条线跑得动，才知道差的正好是那几支。
  assert.deepEqual(byProduct(runRoute("matched", false, false, true, "official")), [11, 2, 7]);
  // 另外两条线一起量：配货比例不是照着某一条路线配的，是照着"整周最多被要多少"配的。
  assert.deepEqual(byProduct(runRoute("matched", false, true)), [10, 2, 5]);
  assert.deepEqual(byProduct(runRoute("bulk")), [8, 2, 5], "人人都按最大档报，也吃不满配货：断的不是量不够，是比例不对");
  // 只肯各带走一件的那条线，五天下来抽屉里还剩一半 —— 到货节奏不是靠"卖光"来证明的。
  assert.deepEqual(byProduct(runRoute("single")), [5, 1, 4]);
});

// 一次杠杆值多少钱要拿一整周量。这一轮把电话改回它真正的按法：两行按钮长在报价单上，
// 也就是她人在柜台、session 还开着的那一刻 —— 规则里离柜那三分钟扣的是排队的人，不含正在接待的这位。
// 上一版量成"净亏 ¥700"，是因为模拟器在两位顾客之间打这通电话，那个时刻两个界面都给不出来。
test("调货救的是正在被削的那一单：两支货两条路，钱和台账各付一半", () => {
  const stocked = runRoute("matched", false, false, true, "official");
  assert.equal(stocked.final.sales, 25_590, "两次缺口都打电话：¥2,660 挣回来，一个人都没多走");
  assert.deepEqual(stocked.lost, []);
  // 91 → 87 不是这一轮调了价：这条线迎上去递给周姐的那一支是去年批号，第二天她问回来扣四分（P20 的账，量在下面的路线表里）。
  assert.equal(stocked.final.compliance, 87, "走系统单：台账上多两行你的名字");
  assert.deepEqual(stocked.transferred, ["soft", "repair"], "第 2 天柔焦、第 4 天修护，各一次");
  assert.equal(runRoute("matched", false, false, false, "official").final.sales, 25_590, "迎不迎上去都是这个数：这两通电话没有花掉别人的耐心");
  const blind = runRoute("matched", false, false, false, "tangke");
  assert.deepEqual(blind.transferred, ["repair"], "第 2 天那通她没接：唐可起步不认你，只有第 4 天的修护拿到了");
  assert.equal(blind.final.sales, 24_610, "同一批缺口，私下拿货比调拨单少挣 ¥980");
  assert.equal(blind.final.compliance, 78, "差的只是记录：一条留名，一条系统里没有这张单");
  const tight = runRoute("matched", true, false, false, "official");
  assert.equal(tight.final.sales, 22_230, "全都上脸那条线也能靠这通电话多挣 ¥980，但柜位仍然在风险线以下");
  assert.deepEqual(tight.lost, ["mei", "zhou2"]);
  assert.equal(tight.final.standing, 44);
  // 一次都不打也不该出局：清洁路线整周仍然过五日目标，只是差着这两通电话能挣的 ¥2,660。
  assert.ok(runRoute().final.sales >= TARGET);
});

// 两行按钮一天只在该亮的时候亮：柜上够开这一单，就不劝人离柜。
test("报价单没有被削件数时，柜台上不出现调货那两行", () => {
  const quoted = (product: ProductId, left: number, bundle: BundleId = "set") => orderQuote("zhou", product, bundle, false, left);
  assert.equal(offerTransfer({ ...INITIAL, stock: { soft: 1, glow: 1, repair: 1 } }, "soft", quoted("soft", 1)), true, "她开口三件、柜上一件：这一单正要被削，出路得摆在报价单下面");
  assert.equal(offerTransfer({ ...INITIAL, stock: { soft: 10, glow: 10, repair: 10 } }, "soft", quoted("soft", 10)), false, "货够，就不该有这两行");
  assert.equal(offerTransfer({ ...INITIAL, stock: { soft: 1, glow: 1, repair: 1 } }, "soft", { risky: true, units: 0, wanted: 3 }), false, "强推那一单她本来就不带走，调三支回来还是不开张");
  const called = transferStock({ ...INITIAL, stock: { soft: 1, glow: 1, repair: 1 } }, "soft", "official");
  assert.equal(offerTransfer(called, "soft", quoted("soft", called.stock.soft)), false, "同一支货一周只调一次，调完这一周不再开口");
});

// 一次杠杆值多少钱，要拿一整周量：只要有人看表就迎，救回一个的同时把另一个推向门口。
test("迎上去是保险不是收入：三条整周路线的钱和走的人一个都没变，只少了小样", () => {
  const greedy = runRoute("matched", false, false, true);
  assert.equal(greedy.pulled, 2);
  assert.deepEqual(greedy.lost, []);
  assert.equal(greedy.final.sales, 22_930, "不动这一行的清洁路线一分不差：这一步不能拿来刷营业额");
  assert.equal(greedy.final.samples, 6, "迎出去的两支，是从柜台那两支里出的");
  const trials = runRoute("matched", true, false, true);
  assert.equal(trials.pulled, 3);
  assert.deepEqual(trials.lost, ["mei", "zhou2"], "上脸那条线该走的两位，窗口开在别人身上就救不到她");
  assert.equal(trials.final.sales, 21_250);
  assert.equal(trials.final.standing, 36);
  const roster = runRoute("matched", false, true, true);
  assert.equal(roster.pulled, 2);
  assert.equal(roster.final.sales, 28_530);
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

// 上一轮我在验收记录里写下"手机版的分钟数最多比规则多约 1 分钟"。这条用例把它按回去：
// patienceLeft 永远落在 (waitMeters-1, waitMeters] 里，向上取整之后两端念的是同一个整数。
test("现场那截零头不会让两端念出两个分钟数", () => {
  for (let seconds = 0; seconds < FLOOR_SECONDS_PER_ACTION; seconds += 1) {
    const ticking = { ...INITIAL, floorSeconds: seconds };
    for (const id of floorCustomers(ticking)) {
      assert.equal(Math.ceil(patienceLeft(ticking, id)), ticking.waitMeters[id], `${id} 在 +${seconds}s 时读数不符`);
    }
  }
  // 零头只影响一件事：迎上去的窗口按含零头的那个数开，所以"2 分钟耐心"那一档正好是它能按下去的那一档。
  const almost = { ...INITIAL, floorSeconds: FLOOR_SECONDS_PER_ACTION - 1, waitMeters: { shen: 3, mei: 3 } };
  assert.equal(patienceLeft(almost, "shen") > PULL_OVER_WINDOW, true, "刚过两拍还不算开始看表");
  assert.equal(canPullOver(almost, "shen"), false);
  assert.equal(canPullOver({ ...almost, waitMeters: { shen: 2, mei: 3 } }, "shen"), true);
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

// 断货要在报价单上先说一次、成交之后再说一次，而且不能算成"她拒绝你"：这三件事用一条线串起来测。
test("断货不是推错：报价先说只剩几支，成交才扣支数，抽屉空了才开不出单", () => {
  // 沈薇第一晚的预算够到三支，所以"只剩两支"才是抽屉的锅，不是她的。
  const low: Campaign = { ...INITIAL, stock: { soft: 2, glow: 4, repair: 7 } };
  const quote = orderQuote("shen", "soft", "bulk", false, low.stock.soft);
  assert.equal(quote.units, 2, "她要三支，抽屉只剩两支");
  assert.equal(quote.note, "柜上只剩 2 支，这单最多开到 2 件");
  // 沈薇是竞品柜也在跟的那位：关单前得先把她那边处理掉，否则 closeService 本来就该拒绝。
  const closed = closeService(respondToRival(consult(low, "shen", "soft", "bulk"), "clarify"))!;
  assert.equal(closed.outcome.units, 2);
  assert.equal(closed.campaign.stock.soft, 0);
  assert.ok(closed.campaign.history.some(row => row.text.includes("抽屉里只剩 2 支柔焦，这单按现货开")));
  // 同一件事不能念两遍，第二遍还会念错：被抽屉削掉的那一支不是她的预算问题。
  assert.equal(closed.campaign.history.some(row => row.text.includes("预算只够")), false);

  const empty: Campaign = { ...INITIAL, stock: { soft: 0, glow: 4, repair: 7 } };
  const stalled = respondToRival(consult(empty, "shen", "soft"), "clarify");
  const nothing = closeService(stalled)!;
  assert.equal(nothing.outcome.units, 0);
  assert.equal(nothing.outcome.good, false);
  assert.match(nothing.outcome.title, /没买成/);
  assert.match(nothing.outcome.body, /抽屉里一支柔焦都没有/);
  assert.equal(nothing.campaign.compliance, empty.compliance, "柜上没货不该记成一次错判的合规扣分");
  assert.ok(hasFlag(nothing.campaign, "served:shen:out-of-stock"));
  assert.equal(closeService(stalled, true)!.outcome.units, 0, "硬推也推不出柜上没有的支数");
  // 试用照旧做得成：小样和中庭那支现货是两个抽屉，断的是能卖出去的那一支。
  assert.equal(stalled.activeSession?.tested, true);
});

test("调货一周一次、剩到三支才开口，私下拿货要唐可愿意帮你", () => {
  const low: Campaign = { ...INITIAL, stock: { soft: 3, glow: 4, repair: 7 } };
  assert.equal(canTransfer(low, "glow"), false, "还剩四套，不该为它开口");
  assert.equal(transferLabel(low, "glow", "official"), `请罗曼开调拨单 · ${TRANSFER_MINUTES.official} 分钟 · 持妆还够开一整套连带，先不用为它开口`);
  assert.equal(transferLabel(low, "soft", "official"), `请罗曼开调拨单 · ${TRANSFER_MINUTES.official} 分钟`);

  const called = transferStock(low, "soft", "official");
  assert.equal(called.stock.soft, 3 + TRANSFER_UNITS);
  assert.equal(called.compliance, low.compliance + 2, "系统里有一张单，台账上写着你的名字");
  assert.equal(called.shiftMinutes, low.shiftMinutes + TRANSFER_MINUTES.official);
  assert.equal(called.waitMeters.mei, (low.waitMeters.mei ?? 0) - TRANSFER_MINUTES.official, "这三分钟是从排队的人头上扣的");
  assert.ok(called.history.some(row => row.text.includes("台账上写着你的名字")));
  assert.equal(transferStock(called, "soft", "official"), called, "同一支货一周只调一次");
  assert.match(transferLabel(called, "soft", "official"), /柔焦这一周已经调过一次/);

  assert.equal(canTransferVia(low, "soft", "tangke"), false, "唐可起步不认你，不会把货给一个刚跟她抢过单的人");
  assert.equal(transferStock(low, "soft", "tangke"), low, "被拒的时候一个数都不该变");
  assert.match(transferLabel(low, "soft", "tangke"), /唐可不会把货给/);
  const friendly: Campaign = { ...low, relations: { ...low.relations, tangke: TANGKE_STOCK_GATE } };
  const borrowed = transferStock(friendly, "soft", "tangke");
  assert.equal(borrowed.stock.soft, 3 + TRANSFER_UNITS, "她肯给，给的是同一张单的三支");
  assert.equal(borrowed.compliance, friendly.compliance - 9, "系统里没有这张单，缺口留在台账上");
  assert.equal(borrowed.shiftMinutes, friendly.shiftMinutes + TRANSFER_MINUTES.tangke);
  assert.equal(borrowed.relations.tangke, TANGKE_STOCK_GATE + 8, "这一支算她欠你的还是你欠她的，总得记一笔");
  assert.ok(borrowed.history.some(row => row.text.includes("系统里没有这张单")));
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
    // 抽屉里的支数是第四道闸：它只会把件数削短，而且削到零的时候必须说得出为什么。
    for (const left of [0, 1, 3]) {
      const short = orderQuote(id, product, bundle, shared, left);
      assert.ok(short.units <= left, `${id} 的报价开不出柜上没有的支数`);
      assert.ok(short.forced <= left, "硬推也不能凭空多出几件");
      assert.ok(short.total <= quote.total);
      if (short.units === 0 && quote.units > 0) assert.match(short.note, /柜上这一支断了/);
    }
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
  assert.equal(clean.served, 9, "十位里第 4 天周姐带回来的那单修护当天一支都没到，开不出单就不算接到");
  assert.equal(clean.final.orders.length, 9, "开不出单的那一位不留流水：账上的钱和抽屉里的支数才对得上");
  assert.equal(clean.final.finished, true);
  assert.equal(endingTitle(clean.final), "你留下了，而且没变成她们");
  const reloaded = parseCampaign(JSON.stringify(clean.final))!;
  assert.equal(reloaded.sales, clean.final.sales);
  assert.deepEqual(reloaded.orders, clean.final.orders);
  assert.ok(clean.dayTotals[3] < TARGET, "第 4 天还不能提前达标");
  assert.ok(clean.final.sales >= TARGET);
});

// 《化妆品监督管理条例》第三十九条要经营者"定期检查并及时处理"到期货。柜台抽屉里压着去年批号的小样，
// 整周就两支、只查得了一次：查要当场下架并晚开门一分钟，不查则派出去的人第二天在微信上问回来。
const day3open = (): Campaign => ({ ...INITIAL, day: 3, waitMeters: { zhao: 8, duan: 8 }, eventDoneDays: [1, 2] });
const handOut = (s: Campaign, ids: CustomerId[]) => ids.reduce((value, id) => leaveSample(value, id), s);

test("开店前那一遍自查：整周只查一次，价写在自己那一行上", () => {
  assert.equal(expiredSamplesLeft(INITIAL), 0, "第 3 天以前这一批还没被人想起来");
  assert.equal(canCheckCounter(INITIAL), false);
  const s = day3open();
  assert.equal(expiredSamplesLeft(s), EXPIRED_SAMPLING.units);
  assert.equal(checkCounterLabel(s), `开店前查一遍批号 · 下 2 支 · 晚开门 ${EXPIRED_SAMPLING.minutes} 分钟`);
  const checked = checkCounter(s);
  assert.equal(checked.samples, s.samples - EXPIRED_SAMPLING.units, "到期那两支从抽屉里出去，不是从营业额里出去");
  assert.equal(checked.compliance, s.compliance + EXPIRED_SAMPLING.compliance);
  assert.equal(checked.standing, s.standing + EXPIRED_SAMPLING.standing);
  assert.equal(checked.shiftMinutes, EXPIRED_SAMPLING.minutes, "晚开门的那一分钟照扣排队的人");
  assert.equal(patienceLeft(checked, "zhao"), CUSTOMERS.zhao.patience - EXPIRED_SAMPLING.minutes);
  assert.ok(checked.history.some(row => row.text === "开店前查了一遍批号，下了 2 支到期小样"));
  assert.ok(!checked.history.some(row => row.text.includes("¥")), "这一遍查的是货，账上的钱一分没动");
  assert.equal(expiredSamplesLeft(checked), 0, "整周只查这一次");
  assert.equal(checkCounterLabel(checked), "查批号 · 到期那批已经下了");
  assert.equal(checkCounter(checked), checked, "按不动的时候一个数都不该变");
  const opened = { ...day3open(), shiftMinutes: 1 };
  assert.equal(canCheckCounter(opened), false, "门已经开了就不存在「晚开门」这件事");
  assert.equal(checkCounterLabel(opened), "查批号 · 已经开门了");
});

test("到期那批派出去两个人就到头：第二天她问回来，钱一分不动", () => {
  // leaveSample 不分人在不在柜上（她只要抽屉里还有），所以第三支拿"今天根本没来的沈薇"来试上限。
  const handed = handOut(day3open(), ["zhao", "duan", "shen"]);
  assert.deepEqual(handed.flags.filter(name => name.startsWith("sample-expired:")),
    ["sample-expired:zhao:3", "sample-expired:duan:3"], "抽屉里那批就两支，第三支不是这一批的；旗子上带的是哪一天派出去的");
  const dawn = applyDawn({ ...handed, day: 4 });
  assert.equal(dawn.compliance, handed.compliance - 8, "一支扣四分，两支扣八分");
  assert.equal(dawn.trust, handed.trust - 8, "她以后不敢随手试——这一笔扣的是信任");
  assert.equal(ledgerSum(dawn), dawn.sales, "问回来这两行不带 ¥：它动的不是钱");
  assert.ok(dawn.history.filter(row => row.text.includes("批号是去年的")).every(row => !row.text.includes("¥")));
  const notes = dawnNotices(dawn).filter(note => note.body.includes("批号"));
  // P30：微信里的事合成一条通知 —— 一人一句仍然各念一次，只是不再长成两张卡，名字写在句子前面。
  assert.equal(notes.length, 1, "两个人各问一句，合在同一个聊天框里");
  assert.match(notes[0].speaker, /· 微信$/);
  assert.equal(notes[0].body.match(/批号/g)?.length, 2, "两条问句都在，一条不多一条不少");
  assert.ok(notes[0].body.includes("赵女士：") && notes[0].body.includes("段小姐："), "合并不能把名字合掉");
  const again = applyDawn(dawn);
  assert.equal(again.compliance, dawn.compliance, "问过一次的不再问第二遍（刷新重跑晨会也是这一条）");
  assert.equal(again.history.length, dawn.history.length);
  // 查过的人不会被这一批问回来：同一双手、同三天，账上少那八分。
  const checkedOut = handOut(checkCounter(day3open()), ["zhao", "duan", "shen"]);
  assert.deepEqual(checkedOut.flags.filter(name => name.startsWith("sample-expired:")), []);
  const cleanDawn = applyDawn({ ...checkedOut, day: 4 });
  assert.equal(cleanDawn.compliance, checkedOut.compliance);
  assert.equal(dawnNotices(cleanDawn).filter(note => note.body.includes("批号")).length, 0);
});

test("那句问回来是第二天的事：当天回到现场不问，隔天只问一次，旧存档不带日次也算昨天", () => {
  // 和 P34 越界那一句同一道门：`openFloorState` 当天回到现场也会过一次 applyDawn。
  const handed = handOut(day3open(), ["zhao", "duan"]);
  const sameDay = openFloorState(handed);
  assert.equal(sameDay.compliance, handed.compliance, "她回家才看到批号，不是当天下午就翻脸");
  assert.equal(sameDay.trust, handed.trust);
  // 只数问回来那一行：晨会本身每天要在台账上写一条读数，那不是这一条要量的东西。
  assert.equal(sameDay.history.filter(row => row.text.includes("批号")).length, 0, "不问就不该有那一行");
  const morning = openFloorState({ ...sameDay, day: 4 });
  assert.equal(morning.compliance, handed.compliance - EXPIRED_SAMPLING.penalty * 2, "隔到第二天，两个人各问一次");
  assert.deepEqual(morning.flags.filter(name => name.startsWith("expired-raised:")).sort(),
    ["expired-raised:duan:3", "expired-raised:zhao:3"], "问过的那一发按旗子上那个日次记账");
  const again = openFloorState(morning);
  assert.equal(again.compliance, morning.compliance, "同一天再进一次现场，不能问第三遍");
  assert.equal(again.history.filter(row => row.text.includes("批号")).length, 2, "两个人各问一句，也就两行");
  // 旧存档那面旗不带日次：按"今天之前派出去"处理，第二天照问 —— 改了格式不能吞掉一次后果。
  const legacy = { ...INITIAL, day: 4, flags: ["sample-expired:mei"] };
  const legacyDawn = applyDawn(legacy);
  assert.equal(legacyDawn.compliance, legacy.compliance - EXPIRED_SAMPLING.penalty, "不带日次的旧旗也要问回来一次");
  assert.ok(legacyDawn.flags.includes("expired-raised:mei:0"));
  assert.equal(applyDawn(legacyDawn).compliance, legacyDawn.compliance, "问过一次就是一过");
});

test("查这一遍值多少钱：整周量，钱不会因为它变多，分钟会扣人", () => {
  // 第九格是"开店前查不查"。清洁线第 3 天柜上没人卡在门口，这一分钟没花掉任何人。
  const clean = runRoute("matched", false, false, false, null, undefined, undefined, false, true);
  assert.equal(clean.final.sales, 22_930, "查这一遍不该改变营业额：清洁线还是 ¥22,930");
  assert.equal(clean.final.compliance, 92, "86 分台账 + 这一遍的 6 分");
  assert.deepEqual(clean.lost, []);
  // 半脸上妆那条线第 3 天段小姐只剩最后一分钟：晚开门一分钟就把她扣在柜门外，代价是 ¥980。
  const trials = runRoute("matched", true, false, false, null, undefined, undefined, false, true);
  assert.equal(trials.final.sales, 20_270, "同一条线不查是 ¥21,250");
  assert.ok(trials.lost.includes("duan"), "多走的就是那一个被分钟扣掉的人");
  assert.equal(runRoute("matched", true, false, false, null, undefined, undefined, false, false).final.sales, 21_250);
  // 迎上去递出去的那一支是去年批号：不查 87，查了 97（省下的四分 + 这一遍记下的六分）。
  assert.equal(runRoute("matched", false, false, true, "official", undefined, undefined, false, true).final.compliance, 97);
  assert.equal(ledgerSum(clean.final), clean.final.sales, "P19 那条账平契约在这个新动作上照样成立");
});

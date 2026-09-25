import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDawn, applyFinale, applyTouch, availableCustomers, BUNDLE_MINUTE_HINT, bundleMinutesWord, canLeaveSample, COMPLIANCE_RISK, complianceWord, consultsLeft, CUSTOMERS, dawnNotices, demandBudgetWord, endingTitle,
  ENERGY_LOCK, energyWord, evidenceWord, fitOf, floorCustomers, hasFlag, hasRecords, history, INITIAL, LEAVE_SAMPLE_RETURN, leaveSample, ledgerSum, openFloorState, parseCampaign,
  ADVANCE_COMPLIANCE, ADVANCE_HELD_COMPLIANCE, ADVANCE_HELD_STANDING, ADVANCE_SALE, ADVANCE_TANGKE, advancePocket, dayEvent, settleDayEvent, startNextDay, TANGKE_STOCK_GATE, visibleChoices,
  PRODUCTS, QUESTIONS, RECORDS_MIN, resolveSale,
  askService, chooseBundle, closeService, FACE_TRIAL_MINUTES, faceTrialService, observeService, respondToRival, selectServiceProduct, startService, trialService, visitWord, RIVAL_INTERRUPTIONS, SAMPLE_RETURN_SALE, SAVE_VERSION, STANDING_RISK, TARGET, DELIVERIES, FIRST_DAY_STOCK, deliveryWord, TRANSFER_UNITS, WEEK_ALLOCATION, touchThreads,
  morningReview, progressTarget,
  PRICE_GAP, PRICE_PAD_SAMPLES,
  TOUCHES_PER_EVENING, touchesLeft, structureLine, weekStructure, type BundleId, type Campaign, type CustomerId, type OrderRecord, type ProductId,
  canClaim, claimLine, claimQuestion, CLAIM_ASKBACK_TRUST, CLAIM_COMPLIANCE, CLAIM_TRUST, CLAIM_UNITS,
} from "../src/campaign.ts";
import { bestFit, herCap, playCustomer, runRoute } from "./clean-route.ts";

function campaign(patch: Partial<Campaign>): Campaign {
  return { ...INITIAL, ...patch, relations: { ...INITIAL.relations, ...patch.relations }, flags: patch.flags ?? [], history: patch.history ?? [] };
}

test("a clean route still needs day 5 to clear the target", () => {
  const clean = runRoute();
  assert.equal(TARGET, 21_000);
  assert.deepEqual(clean.lost, [], "读准上限的路线不该在路上丢掉任何人");
  assert.equal(clean.served, 9, "十位里有一位当天开不出单：她在场，只是柜上没货");
  assert.ok(clean.final.flags.includes("served:zhou2:out-of-stock"), "断货写在旗子上，不算她走掉");
  assert.equal(clean.dayTotals[3], 14_770);
  assert.ok(clean.dayTotals[3] < TARGET, "第 4 天结束时还不能提前达标");
  assert.equal(clean.dayTotals[1], 6_090, "配货按天到之后，第 2 天就被削掉一支柔焦");
  assert.equal(clean.final.sales, 22_930, "第 2 天柔焦差一支（¥980）、第 4 天修护差一支（¥1,680）：两次都是当天的批次没赶上，不是谁算错");
  assert.ok(clean.final.sales >= TARGET, "一次电话都不打、只按她说过的上限卖，也还够得着五日目标");
  assert.equal(endingTitle(clean.final), "你留下了，而且没变成她们");
  // 第 5 晚那句「摊得开」必须够得着：一路按「登记我的接待」的干净路线，五天下来本子里有 12 行。
  assert.equal(clean.final.evidence, 12);
  assert.ok(hasRecords(clean.final.evidence), "门槛高过走得通的路线，摊记录就成了死文案");
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
  // 回来这件事得在晨会上说清，不然玩家以为现场随机多刷了一个人。P30 起她的名字写在微信那一条的句子前面。
  assert.ok(dawnNotices(campaign({ day: 5, flags: ["served:anjie:good"] })).some(note => note.body.includes("安姐：")));
  // 因果账本里也要留下一行：她的回来是第 4 天那个判断的结果，而且只留一次。
  const dawn = applyDawn(campaign({ day: 5, flags: ["served:anjie:good"] }));
  const cameBack = (c: Campaign) => c.history.filter(entry => entry.text.includes("安姐赶在化妆师之前回来")).length;
  assert.equal(cameBack(dawn), 1);
  assert.equal(cameBack(applyDawn(dawn)), 1, "重复过晨会不能把她回来再记一遍");
  assert.equal(cameBack(applyDawn(campaign({ day: 5, flags: ["served:anjie:risky"] }))), 0, "第 4 天没接对，就没有这一行");
});

// 台账不做成第三个数字：两个 UI 念的是同一句，分界线也不能和结局各说一套。
test("合规只有一句话，而且和结局用的是同一条线", () => {
  assert.deepEqual([80, 55, 49, 10].map(complianceWord), [
    "台账对得上，巡店没话说", "台账还压得住", "盘点表上有对不上的数", "方敏的文件夹里已经有你",
  ]);
  assert.equal(endingTitle({ ...INITIAL, sales: TARGET, trust: 60, compliance: COMPLIANCE_RISK }), "你留下了，而且没变成她们");
  assert.equal(endingTitle({ ...INITIAL, sales: TARGET, trust: 60, compliance: COMPLIANCE_RISK - 1 }), "销冠的账单", "差一分就换一本账，这条线必须和台账那句话同源");
});

// 体力不做成百分比：界面念的是"还能再接几位"，而这个数按实测最贵的一次接待算。
test("体力念成还能再接几位，锁人的那条线只有一个来源", () => {
  assert.deepEqual([17, 18, 42, 100].map(consultsLeft), [0, 1, 2, 4], "100→76→52→28→4 是实测的四单");
  assert.deepEqual([17, 18, 100].map(energyWord), [
    "腿已经不听使唤，接不了新人", "撑一撑还能再接一位，之后就站不住", "还站得住，能再接 4 位",
  ]);
  assert.equal(consultsLeft(ENERGY_LOCK - 1), 0, "低于锁位就是零位，界面不能自己再算一遍");
});

// 留痕不是分数：只有"摊得开/摊不开"两种说法，和第 5 天那一步用的是同一条线。
test("记录本只说摊不摊得开", () => {
  assert.deepEqual([0, RECORDS_MIN - 1, RECORDS_MIN].map(evidenceWord), ["空着", "没几行", "摊得开"]);
  assert.equal(hasRecords(RECORDS_MIN - 1), false);
  assert.equal(hasRecords(RECORDS_MIN), true);
});

test("history keeps more than 25 entries", () => {
  let state = INITIAL;
  for (let index = 0; index < 30; index += 1) state = { ...state, history: history(state, `记录${index}`) };
  assert.equal(state.history.length, 30);
  assert.equal(state.history[0]?.text, "记录0");
});

test("forcing Anjie comes back as a wedding-week blow-up", () => {
  // 这一条量的是退款的兜底算法，不是抽屉：柜上给足整周的配货，别让"只剩一支"混进断言。
  const full = { stock: { ...WEEK_ALLOCATION } };
  const push = (bundle: BundleId) => resolveSale(campaign({ day: 5, sales: 0, ...full }), {
    customerId: "anjie", selectedProduct: "glow", bundle, revealed: [], tested: true, askedQuestion: null,
    claimed: true, interruption: false, interruptionHandled: false, force: true,
  })!.campaign.orders[0].amount;
  const forced = resolveSale(campaign({ day: 5, sales: 18_000, daySales: 0, ...full }), {
    customerId: "anjie", selectedProduct: "glow", bundle: "bulk", revealed: [], tested: true, askedQuestion: null,
    claimed: true, interruption: false, interruptionHandled: false, force: true,
  })!;
  assert.ok(forced.campaign.orders[0].amount > 0, "强推得先记上数字，否则没有东西可以冲回");
  const next = applyDawn(forced.campaign);
  assert.equal(next.sales, 18_000, "强推记进业绩多少，婚礼前就从业绩里退多少");
  assert.ok(next.flags.includes("anjie-blew-up"));
  // 晨会在退货落定之后才念数字，所以柜位那一条排在客诉后面。
  const blowUp = next.history.findIndex(entry => entry.text === `安姐婚前爆红，苏蔓的三年老客炸了 · −¥${forced.outcome.amount.toLocaleString("zh-CN")}`);
  assert.ok(blowUp >= 0, "婚礼客诉要留在账本里，而且写下从累计退了多少钱");
  assert.ok(next.history.slice(blowUp + 1).some(entry => entry.text.startsWith("晨会 ·")), "晨会读的是已经落定的数字");
  assert.ok(dawnNotices(next).some(note => note.body.includes("婚礼前双颊爆红")));
  // 旧存档没有逐笔记账。兜底要等于最小的一件强推，不能和报价系统各说一套。
  const legacy = applyDawn(campaign({ day: 5, sales: 18_000, daySales: 0, ...full, flags: ["served:anjie:risky"] }));
  assert.equal(18_000 - legacy.sales, push("single"));
  assert.ok(18_000 - legacy.sales < forced.outcome.total, "旧存档没有账本，按最小的一件强推退，不能多退");
});

test("a sample only comes back if you followed up that evening", () => {
  const refused = leaveSample(campaign({ day: 1, flags: ["served:shen:refused"] }), "shen");
  // 发完小样当晚没跟：她顺着别柜的微信走了，这支小样换不回任何一单。
  const ignored = applyDawn({ ...refused, day: 2, daySales: 0 });
  assert.equal(ignored.sales, 0, "没人跟进的小样不算复购");
  assert.ok(!ignored.flags.includes("sample-return:shen"));
  // 同一支小样，当晚问一句使用感，第二天才变成一单。
  const touched = applyTouch(refused, "shen");
  assert.ok(touched.flags.includes("touched:shen:1"), "跟进要留在当天那一批 flag 里");
  const next = applyDawn({ ...touched, day: 2, daySales: 0 });
  assert.equal(next.sales, SAMPLE_RETURN_SALE);
  assert.ok(next.flags.includes("sample-return:shen"));
  assert.ok(dawnNotices(next).some(note => note.body.includes("沈薇：")));
});

// P24：界面上那句"这一支买到什么"不许超过规则真给的条件，而按钮亮不亮必须和收不收这一支同步。
test("留在柜台那一支：按得动就等于收得下，回柜要三件事同时成立", () => {
  // 抽屉空了 / 她手上已经有一支 / 正常。三种状态下 `canLeaveSample` 都得和 `leaveSample` 的"什么都不做"对齐：
  // 闸写在按钮上、理由写在别处，两边就会各自漂移（界面亮着、按下去一个数都不变）。
  for (const [name, s] of [
    ["抽屉空的", campaign({ day: 1, samples: 0 })],
    ["给过一支", leaveSample(campaign({ day: 1 }), "shen")],
    ["还能给", campaign({ day: 1 })],
  ] as Array<[string, Campaign]>)
    assert.equal(canLeaveSample(s, "shen"), leaveSample(s, "shen") !== s, `${name}这一档按钮和规则不同步`);
  const given = leaveSample(campaign({ day: 1, flags: ["served:shen:refused"] }), "shen");
  // 她当场就买过一支：这一支是赠品，不是第二条线。回柜那一单只属于"没成的那一单"。
  const bought = applyTouch(leaveSample(campaign({ day: 1, flags: ["served:shen:good"] }), "shen"), "shen");
  assert.equal(applyDawn({ ...bought, day: 2, daySales: 0 }).sales, 0, "已经成交的人不再回柜一次");
  // 排定的那天之前不到账：周姐那条写在第 3 天，第 2 早问也问不回来。
  const zhou = applyTouch(leaveSample(campaign({ day: 2, flags: ["served:zhou:refused"] }), "zhou"), "zhou");
  assert.equal(applyDawn({ ...zhou, day: 2, daySales: 0 }).sales, 0, "没到她那天的早晨，这一支还不该回柜");
  assert.equal(applyDawn({ ...zhou, day: 3, daySales: 0 }).sales, SAMPLE_RETURN_SALE, "三件事都齐了才兑这一单");
  assert.equal(hasFlag(given, "sample:shen"), true, "留小样记的是她这一支，截流那一支不记（见 pullOver）");
  // 那句只念条件，不念钱和日子：¥620、第几天到账是规则里的数，写进按钮就是替她保证她一定会回来。
  assert.doesNotMatch(LEAVE_SAMPLE_RETURN, /[¥0-9第]/, "那句「买到什么」里出现了承诺性的数字");
});

test("the evening follow-up is a capped, spend-once line", () => {
  const base = campaign({
    day: 1, members: ["shen", "mei", "xiaoyu"], flags: ["sample:shen", "sample:mei", "served:shen:refused"],
    orders: [{ day: 1, customerId: "mei", product: "soft", units: 1, total: 980, amount: 980, shared: false, risky: false }],
  });
  assert.deepEqual(touchThreads(base).map(thread => `${thread.id}:${thread.kind}`), ["shen:sample", "mei:repeat"],
    "小雨既没成过单也没被拒过，今晚就没有线可以跟");
  const first = applyTouch(applyTouch(base, "shen"), "mei");
  assert.equal(touchesLeft(first), 0);
  assert.deepEqual(touchThreads(first).map(thread => thread.id), [], "同一个人整周只跟一次");
  // 配额花完以后第三次调用必须原样退回，不能只靠界面挡。
  assert.equal(applyTouch(first, "shen"), first);
  // 换一天就是新的一晚：昨天的两句不能替今天预支。
  assert.equal(touchesLeft({ ...first, day: 2 }), TOUCHES_PER_EVENING);
  // 第 5 晚之后没有早晨，跟谁都不会再回来。
  assert.deepEqual(touchThreads({ ...base, day: 5 }), []);
  assert.deepEqual(touchThreads(campaign({ day: 1 })), [], "手里没线的人开不出这个面板");
});

test("the day-5 private-domain repurchase needs the touch, not just the follow", () => {
  const product = bestFit("shen");
  const bought = resolveSale(campaign({ day: 4, members: ["shen"] }), {
    customerId: "shen", selectedProduct: product, bundle: "single", revealed: [], tested: true, askedQuestion: 0,
    claimed: true, interruption: false, interruptionHandled: false, force: false,
  })!.campaign;
  assert.equal(bought.orders.length, 1, "先要真有一单，第 5 天才有得补");
  const quiet = applyDawn({ ...bought, day: 5, daySales: 0 });
  assert.equal(quiet.daySales, 0, "只加了微信、从没跟进的人不会在第 5 天自己补单");
  const spoken = applyDawn({ ...applyTouch({ ...bought, day: 4 }, "shen"), day: 5, daySales: 0 });
  assert.equal(spoken.daySales, PRODUCTS[product].price, "她回来补的是你给她的那一支");
  // 钱不能是凭空多出来的：早上那一叠通知里要有点名的那一句。
  assert.deepEqual(dawnNotices(spoken).filter(note => note.speaker === "私域 · 微信").map(note => note.body),
    [`沈薇在微信上补了一支${PRODUCTS[product].short}。`]);
  assert.deepEqual(dawnNotices(quiet).filter(note => note.speaker === "私域 · 微信"), [], "没跟过的线早上也没的可念");
});

// 跟进可以晚一天，兑现就晚一天：晨会认的是今天到账的那笔流水，不是排定的天数。
test("a line that comes back late is read out on the morning it actually lands", () => {
  const day1 = leaveSample(campaign({ day: 1, flags: ["served:shen:refused"] }), "shen");
  const dawn2 = applyDawn({ ...day1, day: 2, daySales: 0 });
  assert.equal(dawn2.sales, 0, "第 2 早没跟过，小样不会自己回来");
  const dawn3 = applyDawn({ ...applyTouch(dawn2, "shen"), day: 3, daySales: 0 });
  assert.equal(dawn3.sales, SAMPLE_RETURN_SALE, "第 2 晚补上的那一句，第 3 早才兑现");
  assert.ok(dawnNotices(dawn3).some(note => note.body.includes("沈薇：")), "到账那一早要念出来");
  assert.ok(!dawnNotices({ ...dawn3, day: 4, daySales: 0 }).some(note => note.body.includes("沈薇：")), "同一条线不在第二天再念一遍");
});

test("working the private domain earns more and costs real customers", () => {
  const counter = runRoute();
  const privateDomain = runRoute("matched", false, true);
  // 现场每要一个微信占一分钟，这一分钟是从别人头上扣的：私域做满要拿柜台上的人换。
  assert.deepEqual(privateDomain.lost, ["mei", "zhou2"], "加粉烧掉的耐心让两个人走掉了");
  assert.equal(privateDomain.served, 8);
  assert.equal(privateDomain.final.samples, 0, "小样全派出去了，第 5 天的巡店才认这条线");
  assert.equal(privateDomain.final.members.length, 8);
  // 四个晚上最多八句，这一局只发得出六句：沈薇和安姐是第 5 天才来的，那之后没有早晨了。
  assert.equal(privateDomain.final.flags.filter(f => f.startsWith("touched:")).length, 6);
  assert.equal(privateDomain.final.flags.filter(f => f.startsWith("member-repeat:")).length, 6, "跟过的六个人全部回柜");
  assert.equal(privateDomain.final.sales, 28_530);
  assert.ok(privateDomain.final.sales > counter.final.sales, "跟到底的私域比只在柜台前多开口更值钱，这一条要能被量出来");
  // 它买的是营业额，不是评分：整周多花的那几分钟让柜位比清洁路线低 6 格（实测 51 对 57），
  // 但那条线仍然站在 `STANDING_RISK` 之上 —— 掉到风险线以下的代价应该由更贪心的走法去付。
  assert.ok(privateDomain.final.standing < counter.final.standing, "私域做满不涨柜位：这一晚的耐心是从别人头上扣的");
  assert.ok(privateDomain.final.standing >= STANDING_RISK, "多出来的营业额不该把柜台推到评估线以下");
});

test("old saves without the current version are discarded", () => {
  assert.equal(parseCampaign(JSON.stringify({ ...INITIAL, version: 1, sales: 99_000 })), null);
  // v5 是"配货一次性倒在柜台上"那一版写的：字段一模一样，但过一遍新晨会会多出配货之外的一批货。
  assert.equal(parseCampaign(JSON.stringify({ ...INITIAL, version: 5, stock: { ...WEEK_ALLOCATION } })), null);
  assert.equal(parseCampaign(JSON.stringify(INITIAL))?.version, SAVE_VERSION);
});

test("a same-day risky last order is clawed back in the finale", () => {
  // 柜上按整周配货给足，这一条量的是"开口几件就记几件、结局整笔暂扣"，不是断货。
  const input = {
    customerId: "returning" as const, selectedProduct: "repair" as const, bundle: "bulk" as const, revealed: [] as const,
    tested: true, askedQuestion: 0, claimed: true, interruption: true, interruptionHandled: true, force: true,
  };
  const closed = resolveSale(campaign({ day: 5, sales: 20_000, stock: { ...WEEK_ALLOCATION } }), input);
  assert.ok(closed);
  const booked = 4 * PRODUCTS.repair.price;
  assert.equal(closed.outcome.units, 4, "强推按你开口的件数记账");
  assert.equal(closed.campaign.sales, 20_000 + booked);
  const finale = applyFinale(closed.campaign);
  assert.equal(finale.sales, 20_000, "批量强推的金额在结局整笔暂扣");
  assert.ok(finale.flags.includes("returning-chargeback"));
  // 小票还留在账上，钱却是结局拿走的：那一笔必须写成一行带数额的暂扣，否则结局的累计就少一笔说不清的钱。
  assert.ok(finale.history.some(entry => entry.text === `沈薇团队发现效果不稳定，批量单暂扣 · −¥${booked.toLocaleString("zh-CN")}`));
  // "写的钱 = 大数字"只能从 0 起步量：上面那一格手写的 ¥20,000 在账上没有行可念。
  const fromZero = resolveSale(campaign({ day: 5, stock: { ...WEEK_ALLOCATION } }), input)!.campaign;
  assert.equal(ledgerSum(fromZero), booked, "开单当下账上就写了这一笔");
  assert.equal(ledgerSum(applyFinale(fromZero)), 0, "整笔暂扣之后账本跟着归零");
});

// 账本不是文案集：玩家把界面上看得见的每一行 ¥ 加起来，应当就是页顶那个大数字。
// 私域那条线一周多出 ¥8,260（六支微信补单加赵青那一单），以前全落在没有数额的散文里。
const MONEY_LINE = /·\s*−?¥/;
test("每一笔动过 sales 的钱都在自己那一行写下数额：账本各行加起来等于累计", () => {
  const privateDomain = runRoute("matched", false, true).final;
  const routes: Array<[string, Campaign]> = [
    ["读准她的上限", runRoute().final],
    ["一件都不连带", runRoute("single").final],
    ["每套都推到套装", runRoute("set").final],
    ["每个人都按最多开口", runRoute("bulk").final],
    ["半脸上妆做满", runRoute("matched", true).final],
    ["私域做满", privateDomain],
    ["只要有人看表就迎上去", runRoute("matched", false, false, true).final],
    ["盯着缺口调货", runRoute("matched", false, false, false, "roman").final],
    ["误读连带那一排", runRoute("matched", false, false, false, null, undefined, undefined, true).final],
  ];
  for (const [label, state] of routes) {
    assert.equal(ledgerSum(state), state.sales, `${label}：账上写下 ¥ 的行加起来必须等于累计 ${state.sales}`);
    assert.ok(state.orders.length > 0 && state.history.some(entry => MONEY_LINE.test(entry.text)), `${label}：至少要有对得上的行可念`);
  }
  // 17 行 = 8 张小票 + 6 支微信补单 + 赵青那一单 + 两条闭店调整；小票单加只有 20,270，缺的那 8,260 现在每一笔都有数额。
  assert.equal(privateDomain.history.filter(entry => MONEY_LINE.test(entry.text)).length, 17);
  assert.equal(privateDomain.orders.reduce((sum, order) => sum + order.amount, 0), 20_270);
  assert.ok(privateDomain.history.some(entry => entry.text === "赵青加你微信，下了一单修护 · ¥1,680"), "晨会转过来那一单不能只留一句白话");
  assert.ok(privateDomain.history.some(entry => entry.text === "沈薇在微信上补了一支柔焦 · ¥980"));
  // 让单给同事的那一笔：账上写的就是自己那半份，不需要再补一条减法，账本才对得回来。
  const yielded = resolveSale(campaign({ day: 2, stock: { ...WEEK_ALLOCATION } }), {
    customerId: "shen", selectedProduct: "soft", bundle: "pair", revealed: [],
    tested: true, askedQuestion: 0, claimed: true, interruption: true, interruptionHandled: true, force: false, rivalChoice: "yield",
  });
  assert.ok(yielded?.outcome.shared, "让单这一格确实各半");
  assert.ok(yielded.campaign.history.some(entry => entry.text === "沈薇带走 2 件柔焦（与陆遥各半） · ¥980"), "整单 ¥1,960，入账那半份写在同一行上");
  assert.equal(ledgerSum(yielded.campaign), yielded.campaign.sales);
});

// P26：一周的账不只按总额结。探针（/tmp/p26-upt.ts）量到八条路线的连带率 1.0~2.5，
// 而连带率与钱几乎不相关（Spearman rho = 0.02）：UPT 最高的两条（2.5）都 ¥19,290、都不达标。
// 所以这一行只做描述，不评级、不进 `standing` —— 把它做成记分牌会表扬一条已知会输的路线。
test("连带率只从单和件推：件数最凶的那条路线钱更少，所以那句不许写成表扬", () => {
  const clean = runRoute().final;
  const singles = runRoute("single").final;
  const greedy = runRoute("bulk").final;
  assert.deepEqual(weekStructure(clean), { tickets: 9, units: 18, walked: 0, perTicket: 2 });
  assert.deepEqual(weekStructure(singles), { tickets: 10, units: 10, walked: 0, perTicket: 1 });
  assert.deepEqual(weekStructure(greedy), { tickets: 6, units: 15, walked: 3, perTicket: 2.5 });
  // 规则层的因果：多要一件把件数推上去，同时把单数压下来（人等走了）。
  assert.ok(weekStructure(greedy).perTicket > weekStructure(clean).perTicket, "按最多件数那一档连带率更高");
  assert.ok(weekStructure(greedy).tickets < weekStructure(clean).tickets, "而开出去的单更少");
  assert.ok(weekStructure(greedy).walked > weekStructure(clean).walked, "少掉的那些单是走掉的人");
  assert.ok(greedy.sales < clean.sales && greedy.sales < TARGET && clean.sales >= TARGET, "钱更少、也不达标");
  // 那句不许超过规则给的东西：不带 ¥（sales 里有转单、回柜、微信补单这些不写 orders 的入账，件数和金额是两种口径），也不带好坏。
  for (const [label, state] of [["清洁", clean], ["不连带", singles], ["硬开口", greedy]] as Array<[string, Campaign]>) {
    assert.equal(structureLine(state).includes("¥"), false, `${label}：这一行不碰钱`);
    assert.doesNotMatch(structureLine(state), /达标|优秀|很好|糟|差|失败|成功/, `${label}：这一行不评级`);
  }
  assert.equal(structureLine(clean), "这周开了 9 单、带走 18 件 · 平均一单 2 件");
  assert.equal(structureLine(greedy), "这周开了 6 单、带走 15 件 · 平均一单 2.5 件 · 另有 3 位没等到你");
  assert.equal(structureLine(INITIAL), "一单没开", "没人可接的那一早不硬凑句子");
  // 前三早手上只有 1~4 单（探针 /tmp/p26-days.ts），平均一单几件在那个样本上没意义：从第 4 早起才念。
  assert.equal(dawnNotices({ ...clean, day: 3 }).some(note => note.speaker === "日报 · 柜台"), false, "第 3 早不念结构");
  assert.ok(dawnNotices({ ...clean, day: 4 }).some(note => note.body === structureLine(clean)), "第 4 早念的是同一句，不在 UI 各拼一份");
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

const PRODUCT_IDS = Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[];
const stockOf = (s: Campaign) => PRODUCT_IDS.map(product => s.stock[product]);

test("整周的配货按天排：五批加起来正好是配货，第 1 天柜上只有第一批", () => {
  assert.equal(DELIVERIES.length, 5, "一天一批，正好排满活动周");
  for (const product of PRODUCT_IDS) {
    assert.equal(DELIVERIES.reduce((sum, batch) => sum + batch[product], 0), WEEK_ALLOCATION[product], `${product} 五批加起来必须正好等于整周配货，不能凭空多也不能少`);
    assert.equal(INITIAL.stock[product], FIRST_DAY_STOCK[product], "开局柜上就是第一批，不是整周的量");
    assert.ok(FIRST_DAY_STOCK[product] < WEEK_ALLOCATION[product], `${product} 第 1 天不该一次拿到整周的货`);
    for (const batch of DELIVERIES) assert.ok(batch[product] + INITIAL.stock[product] <= WEEK_ALLOCATION[product] + TRANSFER_UNITS, `${product} 到货之后不能超出存档认的支数上限`);
  }
});

test("到货每早一次：重复过晨会不会双倍到货，第 1 天不再补第一批", () => {
  const day2 = applyDawn(campaign({ day: 2, daySales: 0 }));
  assert.deepEqual(stockOf(day2), stockOf(INITIAL).map((left, index) => left + DELIVERIES[1][PRODUCT_IDS[index]]), "第 2 早补的就是第 2 批");
  assert.deepEqual(stockOf(applyDawn(day2)), stockOf(day2), "同一早过两次晨会，货不能到两次");
  assert.equal(day2.flags.filter(name => name.startsWith("delivered:")).length, 1);
  assert.deepEqual(stockOf(applyDawn(campaign({ day: 1, daySales: 0 }))), stockOf(INITIAL), "第 1 天的那批已经在柜上，过晨会不会再来一次");
  // 进沙盘那一步也走 applyDawn：两个入口算出的抽屉必须是同一个。
  assert.deepEqual(stockOf(openFloorState(campaign({ day: 3, daySales: 0 }))), stockOf(applyDawn(campaign({ day: 3, daySales: 0 }))));
});

test("到货那句只在晨会念一次，说的是今天到几支、明天排几支", () => {
  const arrivals = (s: Campaign) => dawnNotices(s).filter(note => note.speaker.includes("到货"));
  for (let day = 1; day <= 5; day += 1) {
    const lines = arrivals(campaign({ day, daySales: 0 }));
    assert.equal(lines.length, 1, `第 ${day} 早只念一句到货`);
    assert.equal(lines[0].body, deliveryWord(day));
  }
  assert.match(deliveryWord(1), /不是一次性给的/, "第 1 早要顺带把「按天到」这件事说清楚");
  assert.ok(deliveryWord(1).includes("支"), "支数是柜台的量词，别混进别的东西");
  assert.match(deliveryWord(2), /明天排的是/, "看不到明天的排期，「等」就不是一个选项");
  assert.ok(!deliveryWord(5).includes("明天"), "最后一天没有明天的货可以承诺");
  // 第 4 早那一批修护只有 2 支：清洁路线当天要吃 5 支，缺口就是这两行按钮唯一该亮的地方。
  assert.match(deliveryWord(4), /修护 2 支/);
});

// 这轮节奏到底咬掉了多少钱，要用同一条动作序列量出来，不是写一句"更紧张了"。
// oneShot = 一周的货第 1 天全给到（把后面四批标成已发），其余一步不动。
test("按天到货真的咬在柜台上：同一条清洁路线，一次性给满是 ¥24,610", () => {
  const oneShot = campaign({ stock: { ...WEEK_ALLOCATION }, flags: [2, 3, 4, 5].map(day => `delivered:${day}`) });
  const flat = runRoute("matched", false, false, false, null, undefined, oneShot);
  const clean = runRoute();
  assert.equal(flat.final.sales, 24_610);
  assert.equal(clean.final.sales, 22_930);
  assert.equal(flat.served, 10, "货一次给到时，第 4 天周姐那一单开得出来");
  assert.equal(flat.final.flags.includes("served:zhou2:out-of-stock"), false, "反事实里不该有断货旗子");
  const unitsOf = (s: Campaign, day: number, id: string) => s.orders!.filter(order => order.day === day && order.customerId === id).reduce((sum, order) => sum + order.units, 0);
  // 差额是三处件数的合力，不是某一步掉线：周中被削的、当天开不出的、第 5 天补回来的。
  assert.equal(unitsOf(clean.final, 2, "zhou"), 1);
  assert.equal(unitsOf(flat.final, 2, "zhou"), 2, "第 2 天那两件柔焦，一次性给到时给得出");
  assert.equal(unitsOf(clean.final, 4, "zhou2"), 0, "第 4 天她要的那支修护，那天早上还没到");
  assert.equal(unitsOf(flat.final, 5, "returning"), 3, "一次性给到时前面多开走两件，第 5 天就只剩 3 支给她");
  assert.equal(unitsOf(clean.final, 5, "returning"), 4, "按天到把第 5 天那四件留住了：整周 10 支柔焦，前面少花一支，后面就开得出来");
});

test("断货那张卡给的出路跟着到货排期走：还有下一批才提\"等\"，周末不再补就只剩两条", () => {
  const card = (day: number) => resolveSale(campaign({ day, stock: { soft: 10, glow: 4, repair: 0 } }), {
    customerId: "zhou2", selectedProduct: "repair", bundle: "single", revealed: [],
    tested: true, askedQuestion: 0, claimed: true, interruption: true, interruptionHandled: true, force: false,
  })!.outcome;
  assert.equal(card(4).title, "周姐没买成");
  assert.ok(card(4).body.includes("等大仓下一批"), "第 4 天断的修护，第 5 早上还排着一支：\"等\"这时候是条真路");
  assert.ok(!card(5).body.includes("等大仓下一批"), "第 5 天之后没有下一批，不能给玩家指一条不存在的路");
  assert.ok(card(5).body.includes("只剩两条路"));
});

// P15：连带那一排的分钟买的是"开口多要一件"，不是"柜上多开一件"。这层意思原来只有手机版说一句。
test("件数已经被削平时，按钮要把这一档开口要几件写在分钟上", () => {
  assert.equal(bundleMinutesWord("set", 3), "占 3 分钟");
  assert.equal(bundleMinutesWord("bulk", 3), "要 4 件 · 占 4 分钟", "她自己就到 3 件：第 4 分钟买的是开口，不是货");
  assert.equal(bundleMinutesWord("pair", 1), "要 2 件 · 占 2 分钟", "柜上只剩 1 支时也一样，这一档是在问她要 2 件");
});

// P17：她的预算/上限和"多要一件多占一分钟"是两个槽各念一句，原来合成一句在同一个屏幕读两遍。
test("她的预算那句和连带那一行的计时句各念各的，不互相重复", () => {
  assert.equal(demandBudgetWord(CUSTOMERS.shen), "预算 ¥3,200 · 上限 3 件");
  assert.equal(BUNDLE_MINUTE_HINT, "多要一件多占一分钟");
  assert.ok(!BUNDLE_MINUTE_HINT.includes("预算") && !BUNDLE_MINUTE_HINT.includes("上限"), "计时那句不能再把她的数字念一遍");
  assert.ok(!demandBudgetWord(CUSTOMERS.shen).includes("分钟"), "她那句也不能替连带解释分钟");
});

test("游戏里第一张报价单：多按一档开的还是 3 件，但当天就没有第二位顾客了", () => {
  const first = (bundle: BundleId) => {
    const played = playCustomer(openFloorState(INITIAL), "shen", { bundle });
    return { ...played.outcome, meiLeft: played.campaign.waitMeters.mei, stillHere: availableCustomers(played.campaign).includes("mei") };
  };
  const honest = first("set");
  const over = first("bulk");
  assert.equal(over.units, honest.units, "件数一模一样");
  assert.equal(over.total, honest.total, "钱也一模一样");
  assert.equal(over.minutes, honest.minutes + 1, "多的那一分钟什么都没换来");
  assert.equal(honest.meiLeft, 1);
  assert.equal(over.stillHere, false, "她那一单占掉的就是梅女士剩下的最后一分钟");
});

test("把连带那一排整周都误读成\"更贵=更多\"，少 ¥3,640、走掉三位，掉到线下", () => {
  const over = runRoute("matched", false, false, false, null, undefined, undefined, true);
  assert.equal(over.final.sales, 19_290);
  assert.ok(over.final.sales < TARGET, "误读一周的代价是这一周不达标");
  assert.equal(over.served, 6);
  assert.deepEqual([...new Set(over.lost)].sort(), ["duan", "mei", "zhou"]);
});

// —— P28 自掏腰包垫货：调研里那条"KPI 完不成、BA 自己掏钱囤货、完不成要交改进报告"（虎嗅），
// 落到第 4 晚的一格选择上。钱按小票价进 sales，内购折扣只发生在她自己的工资里，所以不进账。
const yuan = (value: number) => value.toLocaleString("zh-CN");
const dayFourBehind = () => campaign({ day: 4, sales: 12_000, daySales: 2_000, eventDoneDays: [1, 2, 3] });
const advanceOf = (s: Campaign) => visibleChoices(s, dayEvent(s)).find(choice => choice.id === "advance-order");

test("这一格只给追不上进度的人，而且当晚只结一次", () => {
  assert.ok(advanceOf(dayFourBehind()), "落后 2,000 的人该看得见这条出路");
  const anjie: Campaign = { ...dayFourBehind(), orders: [{ day: 4, customerId: "anjie", product: "soft", units: 1, total: 980, amount: 980, shared: false, risky: false }] };
  assert.ok(advanceOf(anjie), "第 4 晚两个事件（婚礼单没留下 / 安姐要赠品）都摆同一格，不然它变成事件的彩蛋");
  assert.equal(advanceOf({ ...dayFourBehind(), sales: 14_770 }), undefined, "干净路线第 4 天已经做到 14,770，不该白送她一格");
  const once = settleDayEvent(dayFourBehind(), "advance-order");
  assert.equal(advanceOf(once), undefined, "垫过一次不再摆出来");
  assert.equal(settleDayEvent(once, "advance-order").sales, once.sales, "当晚结过一次，再点一次不再进钱");
  // 13,500 垫一支正好越过 100%：这一格按下去就"自己看不见自己"，手机版的确认屏得回全量列表找它。
  const crossing = settleDayEvent({ ...dayFourBehind(), sales: 13_500 }, "advance-order");
  assert.equal(advanceOf(crossing), undefined, "追平之后不再摆出来");
  assert.ok(dayEvent(crossing).choices.some(choice => choice.id === "advance-order"), "确认那一屏按 id 找得到它");
});

test("按下去买到什么：小票价的业绩、自己工资里的钱、台账上一条虚增", () => {
  const before = dayFourBehind();
  const after = settleDayEvent(before, "advance-order");
  assert.equal(ADVANCE_SALE, 980);
  assert.equal(advancePocket(), 686);
  assert.equal(after.sales - before.sales, ADVANCE_SALE, "进账的是小票价");
  assert.equal(after.daySales - before.daySales, ADVANCE_SALE);
  assert.equal(after.compliance, before.compliance + ADVANCE_COMPLIANCE, "没有客人的单子记在合规上");
  assert.equal(after.relations.tangke, before.relations.tangke + ADVANCE_TANGKE, "单是唐可替你开的");
  // P19 那条口径在这一格上同样成立：动了钱就得有一行 ¥，而且那行的数正好等于涨跌。
  assert.equal(ledgerSum(after) - ledgerSum(before), ADVANCE_SALE);
  assert.ok(after.history.some(entry => entry.text.includes(`· ¥${yuan(ADVANCE_SALE)}`)), "台账里没有这一笔钱");
  assert.equal(after.history.filter(entry => entry.text.includes("¥")).length, 1, "同一笔钱不能写两行");
});

test("第 5 早两条分岔：她出得掉钱回来，出不掉货压在家里还要写说明", () => {
  const advanced = settleDayEvent(dayFourBehind(), "advance-order");
  assert.equal(advanced.relations.tangke, 44, "38 + 6：差一格，所以垫完立刻指望唐可是靠不住的");
  // 同一个早晨再走一遍"没垫过"的版本：第 5 早的晨会读数也会动 standing，只有对比才知道扣的是哪一格。
  const baseline = startNextDay({ ...advanced, flags: advanced.flags.filter(name => name !== "advance-order") });
  const sold = startNextDay({ ...advanced, relations: { ...advanced.relations, tangke: TANGKE_STOCK_GATE } });
  assert.ok(hasFlag(sold, "advance-out"));
  assert.equal(sold.sales, advanced.sales, "那 980 昨天已经入账，替她出掉不能把同一支货再卖一遍");
  assert.equal(sold.compliance, baseline.compliance, "钱回来了不代表台账干净了：那张单子还是你自己开的");
  assert.ok(dawnNotices(sold).some(note => note.speaker === "唐可 · 柜后" && note.body.includes(`¥${yuan(advancePocket())}`)));
  assert.ok(!dawnNotices(sold).some(note => note.speaker === "方敏 · 合规" && note.body.includes("是谁买走的")));

  const held = startNextDay(advanced);
  assert.ok(hasFlag(held, "advance-held"));
  assert.equal(held.compliance, baseline.compliance + ADVANCE_HELD_COMPLIANCE);
  assert.equal(held.standing, baseline.standing + ADVANCE_HELD_STANDING, "写不出客人名字的说明会挪到柜位那一栏");
  assert.equal(held.sales, advanced.sales, "出不掉也不冲业绩：数字留下来了，这才是这一格真正难放下的地方");
  assert.ok(dawnNotices(held).some(note => note.speaker === "方敏 · 合规" && note.body.includes(`¥${yuan(ADVANCE_SALE)}`)));
  // 晨会重跑不会再扣一遍（和 P20 那条"刷新不重复入账"是同一类事故）。
  assert.equal(applyDawn(held).history.filter(entry => entry.text.includes("垫的那支")).length, 1);
});

test("没垫过的人第 5 早不该听见这一句", () => {
  const clean = startNextDay(campaign({ day: 4, sales: 14_770, eventDoneDays: [1, 2, 3] }));
  assert.ok(!dawnNotices(clean).some(note => note.body.includes("自己垫") || note.body.includes("是谁买走的")));
  assert.equal(applyDawn(clean).history.filter(entry => entry.text.includes("垫")).length, 0);
});

// 晨会改成整屏滚之后，被钉住的脚压住的是表尾（P29 量的表：第 5 早 1280×800 上第 5 条整条 0px）。
// 所以顺序本身是判据：只在这一屏出现一次的"回账"排在前面，每天都在的那两条例行数字留在表尾。
test("晨会那一屏的表尾留给每天都在的那两条", () => {
  const ROUTINE = ["品牌 · 到货", "日报 · 柜台"];
  const evenings: Campaign[] = [];
  runRoute("matched", false, false, false, null, undefined, undefined, false, false, settled => evenings.push(settled));
  assert.equal(evenings.length, 4, "第 2 到第 5 早各对应一个前一晚");
  for (const [index, settled] of evenings.entries()) {
    const speakers = dawnNotices(startNextDay(settled)).map(note => note.speaker);
    const routineAt = speakers.map((speaker, at) => (ROUTINE.includes(speaker) ? at : -1)).filter(at => at >= 0);
    const payoffAt = speakers.map((speaker, at) => (ROUTINE.includes(speaker) ? -1 : at)).filter(at => at >= 0);
    assert.ok(payoffAt.length && routineAt.length, `第 ${index + 2} 早两类告示都该有：${speakers.join(" | ")}`);
    assert.ok(Math.max(...payoffAt) < Math.min(...routineAt), `第 ${index + 2} 早把例行数字排到了回账前面：${speakers.join(" | ")}`);
  }
  // 垫货那支的回账也要在例行前面 —— P29 就是被这一条撞出来的。
  const held = startNextDay(campaign({ day: 4, sales: 12_000, eventDoneDays: [1, 2, 3], flags: ["advance-order", "advance-held"] }));
  const order = dawnNotices(held).map(note => note.speaker);
  assert.ok(order.indexOf("方敏 · 合规") >= 0 && order.indexOf("方敏 · 合规") < order.indexOf("品牌 · 到货"), order.join(" | "));
});

// P30：微信里的事合成一条通知（一个聊天框连着好几条消息，不该长成好几张卡），柜台那几道各是各的。
test("微信里的回音合成一条，名字写在句子前面；柜台那一道不混进来", () => {
  const cards = dawnNotices(campaign({ day: 5, flags: ["zhao-daughter-order", "served:anjie:good"] })).filter(note => note.speaker === "私域 · 微信");
  assert.equal(cards.length, 1, "整屏只有一条微信通知");
  assert.ok(cards[0].body.includes("赵青：") && cards[0].body.includes("安姐："), "一个名字一句，都在里面");
  assert.equal(cards[0].body.match(/赵青：/g)?.length, 1, "合并不把同一个人念两遍");
  // 客诉是苏蔓当面那道，不是微信里的消息：混进那一条会把"谁在找你"念错。
  const blown = applyDawn(resolveSale(campaign({ day: 5, sales: 18_000, daySales: 0, stock: { ...WEEK_ALLOCATION } }), {
    customerId: "anjie", selectedProduct: "glow", bundle: "bulk", revealed: [], tested: true, askedQuestion: null,
    claimed: true, interruption: false, interruptionHandled: false, force: true,
  })!.campaign);
  const notes = dawnNotices(blown);
  assert.ok(notes.some(note => note.speaker === "客诉 · 苏蔓" && note.body.includes("婚礼前双颊爆红")), "客诉单独一张卡");
  assert.ok(!notes.some(note => note.speaker === "私域 · 微信" && note.body.includes("婚礼前双颊爆红")), "客诉不并进微信那一条");
});

// P31：第 4 早那两张卡顶着一模一样的「晨会 · 罗曼」，玩家看见的是"同一封信寄了两遍"。
// 名单那一张不是罗曼发来的消息，是品牌在数企微名单（P17 已经裁过一次同类的错：规则提示不挂人名）。
test("第 4 早那两张晨会卡各有各的标签", () => {
  // 两张都是"晨会念过才有旗"的那一类（`dawnNotices` 认 `morning:4` / `roster:4`），所以种子要带旗。
  const flags = ["morning:4", "roster:4"];
  const empty = dawnNotices(campaign({ day: 4, sales: 9_000, members: [], flags }));
  const full = dawnNotices(campaign({ day: 4, sales: 9_000, members: ["zhao", "anjie"], flags }));
  for (const [label, notes] of [["名单为空", empty], ["名单有人", full]] as const) {
    const speakers = notes.map(note => note.speaker);
    assert.equal(speakers.filter(name => name === "晨会 · 罗曼").length, 1, `${label}：进度那一张才是罗曼念的，不该有两张`);
    assert.ok(speakers.includes("晨会 · 私域名单"), `${label}：名单那一张要写清楚数的是什么`);
    assert.equal(new Set(speakers).size, speakers.length, `${label}：同一屏出现两张同名卡 ${speakers.join(" | ")}`);
  }
  assert.ok(empty.find(note => note.speaker === "晨会 · 私域名单")!.body.includes("一条都没加"));
  assert.ok(full.find(note => note.speaker === "晨会 · 私域名单")!.body.includes("2 个"), "名单里几个人写在句子前面");
  // 清洁路线四个早晨逐个查：这一条挡住"以后又有人共用标签"。坏路线上两张「退货 · 收银」是合法的（两个人各退一单），
  // 所以"全部告示标签互不相同"只钉在这条真跑得通的路线上，不写成全局不变量。
  const evenings: Campaign[] = [];
  runRoute("matched", false, false, false, null, undefined, undefined, false, false, settled => evenings.push(settled));
  for (const [index, settled] of evenings.entries()) {
    const speakers = dawnNotices(startNextDay(settled)).map(note => note.speaker);
    assert.equal(new Set(speakers).size, speakers.length, `第 ${index + 2} 早有两张同名卡：${speakers.join(" | ")}`);
  }
});

// —— P32 电商比价：她离柜以后才去搜旗舰店。真实依据是《明码标价和禁止价格欺诈规定》第十六条（被比较价格要真实准确、
// 有依据）和第十八条（赠品要标示品名、数量）：柜台既改不了票面，也不能拿没登记的赠品垫差价。
// 所以这一格一分钱都不动 —— 动的只有抽屉里的小样、台账上的合规，和"她有没有你的微信"。
const dayThreePrice = (patch: Partial<Campaign> = {}) => campaign({ day: 3, daySales: 0, eventDoneDays: [1, 2], flags: ["served:xiaoyu:good"], ...patch });
const priceOf = (s: Campaign, id: string) => visibleChoices(s, dayEvent(s)).find(choice => choice.id === id);

test("这一格只给真的从小雨手里卖出过东西的人，两条分支都摆，格子接在尾巴上", () => {
  const roman = dayThreePrice();
  const zhao = dayThreePrice({ flags: ["served:xiaoyu:good", "served:zhao:good"] });
  for (const [title, s] of [["罗曼催数据", roman], ["赵女士过敏", zhao]] as const) {
    const ids = dayEvent(s).choices.map(choice => choice.id);
    assert.deepEqual(ids.slice(3), ["price-explain", "price-pad"], `${title}：新格子接在原来那三条后面`);
    assert.ok(dayEvent(s).body.includes(`¥${yuan(PRICE_GAP)}`), `${title}：她那句"少 280"得先被念出来，按钮才有出处`);
  }
  // 原来那三条必须还在前三个位置：模拟器没命中 CLEAN_EVENTS 时取的就是 choices[0]。
  assert.deepEqual(dayEvent(roman).choices.slice(0, 3).map(choice => choice.id), ["push-data", "tell-truth", "ask-suman"]);
  assert.deepEqual(dayEvent(zhao).choices.slice(0, 3).map(choice => choice.id), ["protect-zhao", "risk-zhao", "promise-zhao"]);
  assert.equal(priceOf(campaign({ day: 3, eventDoneDays: [1, 2] }), "price-explain"), undefined, "她没买，就没有那张截图");
  assert.equal(priceOf(campaign({ day: 4, eventDoneDays: [1, 2, 3], flags: ["served:xiaoyu:good"] }), "price-explain"), undefined, "只有第 3 晚摆这一格：晚了两天再问退差，谁都不信");
});

test("按下去票面一分不动：动的只有小样、合规和台账", () => {
  const before = dayThreePrice();
  const explained = settleDayEvent(before, "price-explain");
  assert.equal(explained.sales, before.sales, "柜台退不了差价，也不许改票面");
  assert.equal(ledgerSum(explained), ledgerSum(before), "没动钱就不该多出一行 ¥");
  assert.equal(explained.compliance, before.compliance + 5, "按价盘讲清楚是合规的");
  assert.equal(explained.trust, before.trust + 4);
  const padded = settleDayEvent(before, "price-pad");
  assert.equal(padded.samples, before.samples - PRICE_PAD_SAMPLES);
  assert.equal(padded.compliance, before.compliance - 8, "没登记的赠品记在合规上：第十八条要标示品名和数量");
  assert.equal(padded.sales, before.sales, "垫的是货，不是票面");
  assert.equal(settleDayEvent({ ...before, samples: 1 }, "price-pad").samples, 1, "抽屉里只剩一支就不能按：和安姐那两格同一道闸");
  // 结局那一屏的因果账要念得到这两句（第五天分组里出现的是当天那句原话）。
  assert.ok(explained.history.some(entry => entry.text.includes("你按品牌价盘向小雨解释了那张券后价")));
  assert.ok(padded.history.some(entry => entry.text.includes("你拿未登记的小样补了小雨的差价")));
});

test("这句话传不传得出去，按下去之前就得看见", () => {
  const withWechat = dayThreePrice({ members: ["xiaoyu"] });
  const without = dayThreePrice();
  const detail = (s: Campaign) => priceOf(s, "price-explain")!.detail;
  assert.ok(detail(without).includes("没有你的微信"), "空名单要把这一格的代价写在按钮第二行");
  assert.ok(detail(withWechat).includes("她在你名单里"));
  assert.notEqual(detail(withWechat), detail(without));
  const settled = settleDayEvent(withWechat, "price-explain");
  assert.ok(settled.trust > settleDayEvent(without, "price-explain").trust, "早上加的微信，晚上才有人替你传这句话");
  assert.equal(settled.evidence, withWechat.evidence + 1, "传出去的那句才是留得下的痕");
});

test("第 4 晚念得到昨晚的答案，晨会那一屏不因此多一张卡", () => {
  const nextNight = (s: Campaign) => dayEvent({ ...s, day: 4, eventDoneDays: [1, 2, 3] }).body;
  const explained = settleDayEvent(dayThreePrice(), "price-explain");
  const padded = settleDayEvent(dayThreePrice(), "price-pad");
  const quiet = settleDayEvent(dayThreePrice(), "tell-truth");
  assert.ok(nextNight(explained).includes("小雨没有再回你"), "没加微信那一种要说得出代价");
  assert.ok(nextNight(settleDayEvent(dayThreePrice({ members: ["xiaoyu"] }), "price-explain")).includes("面试群"), "传出去那一种也要被看见");
  assert.ok(nextNight(padded).includes("旅行装领给谁"), "台账上那道空位第二天有人问");
  assert.ok(!nextNight(quiet).includes("小雨"), "没接这一格的人，第 4 晚不该听见她");
  // P29/P30 量的那一屏只放得下三条：这一格的答案走的是同一张卡上的一句话，不是第四条告示。
  const notes = (s: Campaign) => dawnNotices(startNextDay(s)).length;
  assert.equal(notes(explained), notes(quiet), "第 4 早的告示数不该因为这一格多一条");
  assert.equal(notes(padded), notes(quiet));
});

// —— P33 同一屏两个进度口径。分子含今早到账是 `applyDawn` 末尾故意定的（补录、退货、私域复购都算进进度），
// 所以错的是那句话自己的说法：写着"累计"，读的却是"到昨天为止"。改完之后两条线各自有名 ——
// 晨会念「昨天那条线 ¥14,000，你 118%」，第 4 晚那一格写「今天这条线还差 ¥2,000」。
test("晨会那一句说的是昨天那条线，不是这一周做到哪了", () => {
  // 第 5 早：昨晚 14,770，今早赵青那一单 1,680 进来 → 账上 16,450。
  const dawned = applyDawn(campaign({ day: 5, sales: 14_770, flags: ["protected-zhao"] }));
  assert.equal(dawned.sales - dawned.daySales, 14_770, "今早进来的那一份要能减出来");
  const review = morningReview(dawned)!;
  assert.ok(review.text.includes("昨天那条线达成 118%"), `念的应该是昨天那条线：${review.text}`);
  assert.ok(!review.text.includes("累计") && !review.body.includes("累计"), "『累计』就是那个没交代时点的词");
  assert.ok(review.body.includes(`¥${yuan(progressTarget(4))}`), "卡片要把那条线的数念出来，玩家才知道 118% 是对着谁算的");
  // 同一份钱对着今天的线只有 78%：如果哪天有人把分母换成 progressTarget(day)，这一条会红。
  assert.ok(!review.text.includes("78%") && !review.body.includes("78%"), "晨会念的不是今天那条线");
  // 四个早晨逐个查：每一早的数字都对着前一天的线。
  const evenings: Campaign[] = [];
  runRoute("matched", false, false, false, null, undefined, undefined, false, false, settled => evenings.push(settled));
  for (const [index, settled] of evenings.entries()) {
    const brief = startNextDay(settled);
    const line = morningReview(brief);
    if (!line) continue;
    const againstYesterday = Math.round(brief.sales / progressTarget(brief.day - 1) * 100);
    assert.ok(line.text.includes(`昨天那条线达成 ${againstYesterday}%`), `第 ${index + 2} 早：${line.text}`);
    assert.ok(!line.text.includes("累计") && !line.body.includes("累计"), `第 ${index + 2} 早又把时点省掉了：${line.body}`);
  }
});

test("垫货那一格把差的那一截写在按钮上，做到就不出现", () => {
  const dayFour = (sales: number) => campaign({ day: 4, sales, eventDoneDays: [1, 2, 3] });
  const today = progressTarget(4);
  for (const sales of [9_600, 12_000, 13_020]) {
    const card = priceOf(dayFour(sales), "advance-order")!;
    assert.ok(card.detail.includes(`今天这条线还差 ¥${yuan(today - sales)}`), `¥${sales} 那一晚按钮要念出差额：${card.detail}`);
    assert.ok(today - sales > 0, "这一格只在线没做到时出现，所以念出来的必定是正数");
  }
  assert.equal(priceOf(dayFour(14_770), "advance-order"), undefined, "今天这条线做到了，就不该再劝人垫钱");
  // 垫完那一支，缺口按 980 收：第 5 早晨会念的是垫过之后的账。
  const after = settleDayEvent(dayFour(12_000), "advance-order");
  assert.equal(after.sales, 12_000 + ADVANCE_SALE);
  assert.ok(morningReview({ ...after, day: 5 })!.text.includes(`昨天那条线达成 ${Math.round(after.sales / progressTarget(4) * 100)}%`));
});

// —— P34 柜台功效宣称：一支只有普通备案的修护精华，嘴上把"两周淡斑"说满。
// 淡斑属特殊化妆品、要注册才准宣称（条例第 16、17 条），柜台改不了包装，但一句话就能越线。
// 这三条盯的是：它只多开一支、多出来那一支当场看得见、两次代价各落在自己那一屏（当天合规、隔天她的追问）。
const claimSeed = (patch: Partial<Campaign> = {}) => campaign({ day: 2, sales: 4_620, daySales: 0, stock: { ...WEEK_ALLOCATION }, ...patch });
const claimPush = (id: CustomerId, claim: boolean, bundle: BundleId = "single", seed = claimSeed()) => resolveSale(seed, {
  customerId: id, selectedProduct: "repair", bundle, revealed: [], tested: true, askedQuestion: null,
  claimed: true, interruption: false, interruptionHandled: false, force: true, claim,
})!;

test("把话说满只多开一支，而且只在本来多不开走的那一格出现", () => {
  const plain = claimPush("zhou", false);
  const over = claimPush("zhou", true);
  assert.equal(plain.campaign.orders.at(-1)!.units, 1, "硬推一支：她当场不认同，只拿一件");
  assert.equal(over.campaign.orders.at(-1)!.units, CLAIM_UNITS);
  assert.equal(over.campaign.sales - plain.campaign.sales, PRODUCTS.repair.price, "多出来的就是那一支的钱，不多不少");
  assert.equal(over.campaign.compliance, plain.campaign.compliance + CLAIM_COMPLIANCE, "越线的代价当天写在合规上");
  assert.equal(over.campaign.trust, plain.campaign.trust + CLAIM_TRUST, "她信了，当下这一单确实顺了一点");
  assert.ok(hasFlag(over.campaign, "claim:zhou:2"), "旗子要带上是谁、哪一天说的");
  assert.equal(plain.campaign.flags.some(name => name.startsWith("claim:")), false, "没越界就不该有这一行");
  assert.ok(over.campaign.history.some(entry => entry.text === claimLine("zhou")));
  // 她本来就要带走两支、或者她的上限只有一支：这一格都不出现——那不是一个选择，是一笔白扣的合规。
  assert.equal(canClaim(claimSeed(), "zhou", "repair", "single"), true);
  for (const bundle of ["pair", "set", "bulk"] as BundleId[]) {
    assert.equal(canClaim(claimSeed(), "zhou", "repair", bundle), false, `${bundle} 那一档本来就多带走，越界不额外买到什么`);
  }
  assert.equal(canClaim(claimSeed(), "mei", "repair", "single"), false, "梅女士的上限就是一支");
  assert.equal(canClaim(claimSeed({ stock: { ...WEEK_ALLOCATION, repair: 1 } }), "zhou", "repair", "single"), false, "柜上只剩一支，话说得再满也开不出第二支");
  assert.equal(canClaim(claimSeed(), "zhou", "soft", "single"), false, "越的是淡斑那条线，别的支数说法不算");
  assert.equal(canClaim(claimSeed({ day: 5 }), "zhou", "repair", "single"), false, "最后一天没有『第二天早上』，那两次代价都落不了地");
});

test("她回家查了备案，问回来是第二天早上的事，而且只问一次", () => {
  const over = claimPush("zhou", true);
  // 当天点「回到现场」也走 applyDawn（openFloorState）：旗子上不带日次，就成了下午立刻被追问一次。
  const sameDay = openFloorState(over.campaign);
  assert.equal(sameDay.trust, over.campaign.trust, "当天回到现场不该提前扣这一笔");
  assert.equal(sameDay.flags.some(name => name.startsWith("claim-raised:")), false, "当天不该有回音旗");
  assert.equal(dawnNotices(sameDay).some(note => note.speaker === "私域 · 微信" && note.body.includes("淡斑")), false, "微信里也还没问回来");
  const dawned = applyDawn({ ...over.campaign, day: 3 });
  assert.equal(dawned.trust, over.campaign.trust + CLAIM_ASKBACK_TRUST, "隔天那一句扣在信任上");
  assert.ok(hasFlag(dawned, "claim-raised:zhou:2"));
  assert.ok(dawned.history.some(entry => entry.day === 3 && entry.text === claimQuestion("zhou")));
  const wechat = dawnNotices(dawned).filter(note => note.speaker === "私域 · 微信");
  assert.equal(wechat.length, 1, "她的追问走微信那一条，不另开卡");
  assert.ok(wechat[0].body.includes(`${CUSTOMERS.zhou.name}：`), "名字在句子上");
  assert.ok(wechat[0].body.includes("没有淡斑这项"));
  // 刷新重跑晨会不会把同一句再扣一遍——和"到货不能双倍"是同一类事故。
  const again = applyDawn(dawned);
  assert.equal(again.trust, dawned.trust);
  assert.equal(again.history.filter(entry => entry.text === claimQuestion("zhou")).length, 1);
});

test("话说满了她退回来的是两支，账上仍然只有小票和退货那两行", () => {
  // 沈薇那条回账 fromDay 3：第 2 天说满，第 3 早就退回来。
  const fromZero = claimSeed({ sales: 0 });
  const plain = claimPush("shen", false, "single", fromZero);
  const over = claimPush("shen", true, "single", fromZero);
  assert.equal(over.campaign.sales - plain.campaign.sales, PRODUCTS.repair.price);
  const plainDawn = applyDawn({ ...plain.campaign, day: 3 });
  const overDawn = applyDawn({ ...over.campaign, day: 3 });
  assert.equal(plain.campaign.sales - plainDawn.sales, PRODUCTS.repair.price, "硬推一支，退货退一支");
  assert.equal(over.campaign.sales - overDawn.sales, PRODUCTS.repair.price * CLAIM_UNITS, "话说满她带走两支，退回来也是两支");
  // 多出来的那一支不另开一行说明：退货那条念的就是小票上的金额（paybackCharge 读同一张票）。
  assert.equal(overDawn.history.filter(entry => MONEY_LINE.test(entry.text)).length, 2, "小票一行、退货一行");
  assert.equal(ledgerSum(overDawn), overDawn.sales, "两行加起来还是账上那个数");
  assert.equal(overDawn.orders.filter(order => order.risky).length, 1, "同一单只记一次风险");
});

// —— P35 退的是哪一支，认的是那张小票。`risky` 只在 fit 为 negative 那一档才记进 orders（resolveSale 末尾），
// 所以同一个人整周可能被推两种货（沈薇：持妆 / 修护），而原来两条台词把品类写死在文字里：
// 晨会卡上念着"沈薇退了那单持妆"，账上退的却是 ¥1,680 的修护。
// 判据两条：新落的那两处不许出现小票以外的品类名；旧存档（根本没有 orders 可认）那两句一字不改。
const RETURN_SCHEDULE: Array<[CustomerId, number]> = [["shen", 3], ["mei", 3], ["xiaoyu", 4], ["zhou", 4], ["zhao", 5], ["duan", 5], ["anjie", 5], ["zhou2", 5]];
const RETURN_SPEAKERS = new Set(["退货 · 收银", "客诉 · 方敏", "客诉 · 罗曼", "客诉 · 苏蔓"]);
const negativeFits = (id: CustomerId) => PRODUCT_IDS.filter(product => fitOf(CUSTOMERS[id], product).tier === "negative");

// 那一早落到柜台上的一切。金额按规则自己的口径：有小票按票面，没小票按"推错方向里最贵的一支"估。
function returnMorning(id: CustomerId, product: ProductId | null, fromDay: number) {
  const charge = product ? PRODUCTS[product].price : Math.max(...negativeFits(id).map(item => PRODUCTS[item].price));
  const order: OrderRecord | null = product
    ? { day: fromDay - 1, customerId: id, product, units: 1, total: charge, amount: charge, shared: false, risky: true } : null;
  const dawned = applyDawn(campaign({ day: fromDay, sales: charge, daySales: 0, flags: [`served:${id}:risky`], orders: order ? [order] : [] }));
  const lines = dawned.history.filter(entry => entry.text.endsWith(`· −¥${yuan(charge)}`));
  assert.equal(lines.length, 1, `${CUSTOMERS[id].name} 第 ${fromDay} 早该正好落一条退 ¥${charge} 的行：0 条是没退，2 条是种子撞上了别的因果`);
  const cards = dawnNotices(dawned).filter(note => RETURN_SPEAKERS.has(note.speaker));
  assert.equal(cards.length, 1, `${CUSTOMERS[id].name} 的退货只在柜台那一道念成一张卡`);
  return { line: lines[0].text, card: cards[0].body };
}

test("退的那一支只从小票上认：同一个人被推过两种货，台账和晨会卡都不许念错品类", () => {
  for (const [id, fromDay] of RETURN_SCHEDULE) {
    const negatives = negativeFits(id);
    assert.ok(negatives.length >= 1, `${CUSTOMERS[id].name} 得有一种推错的方向，否则这一条测不到东西`);
    for (const product of negatives) {
      const seen = returnMorning(id, product, fromDay);
      for (const [where, text] of [["台账那一行", seen.line], ["晨会那张卡", seen.card]] as const) {
        for (const other of PRODUCT_IDS) {
          if (other === product) continue;
          assert.equal(text.includes(PRODUCTS[other].short), false,
            `${CUSTOMERS[id].name}退的是${PRODUCTS[product].short}，${where}却念了${PRODUCTS[other].short}：${text}`);
        }
      }
    }
  }
});

test("那一句真的跟着小票变：同一个沈薇，推持妆和推修护退回来念的是两句话", () => {
  assert.deepEqual(negativeFits("shen").slice().sort(), ["glow", "repair"], "这条测的就是能被推两种货的那个人");
  const wear = returnMorning("shen", "glow", 3);
  const repair = returnMorning("shen", "repair", 3);
  assert.ok(wear.line.includes("退了那单持妆") && wear.card.includes("近看全是粉"), "有票、票上就是持妆：那一句还是原来那一句");
  assert.ok(repair.line.includes("退了那单修护"), "台账念的是票上那一支");
  assert.equal(repair.line.includes("粉感"), false, "修护不是粉，那句抱怨不成立");
  assert.ok(repair.card.includes("不是当天的妆"), "她退修护时给的理由是这瓶不当天的妆");
  // 周姐那一句的品类原来写在正文里（"持妆暗沉的对比图"），台账那一行反倒不带品类：两处各写一遍就会有一处念错。
  assert.ok(returnMorning("zhou", "glow", 4).card.includes("持妆暗沉的对比图"));
  const zhouRepair = returnMorning("zhou", "repair", 4);
  assert.equal(zhouRepair.card.includes("持妆"), false, "退的是修护，就没有持妆暗沉这回事");
  assert.ok(zhouRepair.card.includes("这瓶太慢"));
  // 旧存档连金额都是估出来的，那一句也只能估：fallback 就是原来写死的"持妆"，一字不改。
  assert.equal(returnMorning("shen", null, 3).line, `沈薇退了那单持妆，说镜头里全是粉感 · −¥${yuan(1_680)}`);
  assert.equal(returnMorning("zhou", null, 4).card, "周姐把会议自拍发到了会员群。持妆暗沉的对比图还在。");
});

// —— 成交卡上那句时间账（P46）——
// 下面这些数不是推出来的：先按屏幕字把第 1 天那一单走一遍（沙盘 5199 + 手机版 5200），再逐笔量出来写死在这里。
function sitDown(id: CustomerId = "shen") { return startService(openFloorState(INITIAL), id); }

test("这一单的分钟一笔一笔记：重复看那一处不再占第二分钟，挑一支不花时间", () => {
  let s = sitDown();
  assert.equal(s.activeSession?.visitMinutes, 0, "坐下这一格本身不花分钟");
  s = observeService(s, "eyes");
  assert.equal(s.activeSession?.visitMinutes, 1, "第一处线索一分钟");
  s = observeService(s, "eyes");
  assert.equal(s.activeSession?.visitMinutes, 1, "回头再看已经看过的那处，不该再占一分钟");
  s = observeService(s, "cheek");
  assert.equal(s.activeSession?.visitMinutes, 2);
  s = askService(s, QUESTIONS.shen[0].label, 0);
  assert.equal(s.activeSession?.visitMinutes, 3, "开口问一分钟");
  s = askService(s, QUESTIONS.shen[1].label, 1);
  assert.equal(s.activeSession?.visitMinutes, 4, "再问一句还是占一分钟");
  s = selectServiceProduct(s, "soft");
  assert.equal(s.activeSession?.visitMinutes, 4, "在三支里挑一支不花时间");
  s = trialService(s);
  assert.equal(s.activeSession?.visitMinutes, 5, "手背试色一分钟");
  s = faceTrialService(s);
  assert.equal(s.activeSession?.visitMinutes, 5 + FACE_TRIAL_MINUTES, `半脸上妆买的是 ${FACE_TRIAL_MINUTES} 分钟，不是 ${FACE_TRIAL_MINUTES + 1} 分钟`);
});

test("成交卡那句念的是这一位在柜前花掉的分钟，不是连带那一档的分钟", () => {
  let sold = sitDown();
  sold = observeService(observeService(sold, "eyes"), "cheek");
  sold = askService(sold, QUESTIONS.shen[0].label, 0);
  sold = selectServiceProduct(sold, "soft");
  sold = trialService(sold);
  sold = faceTrialService(sold);
  sold = respondToRival(sold, "clarify");
  sold = chooseBundle(sold, "pair");
  const closed = closeService(sold, false, false);
  assert.ok(closed);
  assert.equal(closed.outcome.minutes, 2, "连带那一档自己占两分钟：这个数没动，报价单和账本还认它");
  assert.equal(closed.outcome.units, 2);
  assert.equal(closed.outcome.visitMinutes, 8);
  assert.equal(visitWord(2, 8, true), "这一位在柜前花掉 8 分钟，其中开单占 2 分钟");

  let refused = sitDown();
  refused = observeService(observeService(refused, "eyes"), "cheek");
  refused = askService(refused, QUESTIONS.shen[0].label, 0);
  refused = selectServiceProduct(refused, "glow");
  refused = trialService(refused);
  refused = respondToRival(refused, "clarify");
  const declined = closeService(refused, false, false);
  assert.ok(declined);
  assert.equal(declined.outcome.units, 0, "推错了方向：这一单没开出来");
  assert.equal(declined.outcome.visitMinutes, 5);
  // 同一张卡上面写着「沈薇拒绝成交」，下面就不能说这一单"开"过 —— 那一分钟是收尾，不是开单。
  assert.equal(visitWord(declined.outcome.minutes, declined.outcome.visitMinutes, declined.outcome.units > 0), "这一位在柜前花掉 5 分钟，其中收尾占 1 分钟");
});

test("成交卡上那个数，就是当天把柜台另一边那位挤走的分钟数", () => {
  let s = sitDown();
  s = observeService(observeService(s, "eyes"), "cheek");
  s = askService(s, QUESTIONS.shen[0].label, 0);
  s = selectServiceProduct(s, "soft");
  s = trialService(s);
  s = faceTrialService(s);
  s = respondToRival(s, "clarify");
  s = chooseBundle(s, "pair");
  const closed = closeService(s, false, false);
  assert.ok(closed);
  assert.equal(closed.outcome.visitMinutes, CUSTOMERS.mei.patience, "为这一位花掉的分钟，正好是梅女士肯等的分钟");
  assert.equal(closed.campaign.waitMeters.mei, 0);
  assert.deepEqual(closed.campaign.lost, ["mei"], "第 1 天走掉的是梅女士，不是别人");
  // 卡上原来只念连带那一档：两分钟挤不走任何一位等着的人，所以那句话教的是"一单很便宜"。
  assert.ok(closed.outcome.minutes < CUSTOMERS.mei.patience, "只念连带那个数的时候，这一单看起来根本不该有人走");

  let lean = sitDown();
  lean = observeService(observeService(lean, "eyes"), "cheek");
  lean = askService(lean, QUESTIONS.shen[0].label, 0);
  lean = selectServiceProduct(lean, "soft");
  lean = trialService(lean);
  lean = respondToRival(lean, "clarify");
  const kept = closeService(lean, false, false);
  assert.ok(kept);
  assert.equal(kept.outcome.visitMinutes, 5);
  assert.deepEqual(kept.campaign.lost, [], "省掉上妆那一格、连带只开一件，梅女士就还在");
});

test("旧存档续上的那一单没有逐笔账，那句就退回只念关单那个数", () => {
  const raw = JSON.parse(JSON.stringify(sitDown()));
  delete raw.activeSession.visitMinutes;
  raw.activeSession.discovered = ["eyes", "cheek"];
  const resumed = parseCampaign(JSON.stringify(raw));
  assert.equal(resumed?.activeSession?.visitMinutes, 0, "缺字段按 0 起算：宁可少说几分钟，不猜她花过几分钟");
  assert.equal(visitWord(1, 0, true), "这一单占现场 1 分钟", "没有逐笔账就不说「其中」，免得后半句比前半句大");
  // 类型不对不是"没这个字段"：和 faceTrialled 一样，写了个不是数字的东西进来，整份存档拒收。
  const garbage = JSON.parse(JSON.stringify(resumed));
  garbage.activeSession.visitMinutes = "三分钟";
  assert.equal(parseCampaign(JSON.stringify(garbage)), null, "读数进来不是数字，就不续这一份档");
});

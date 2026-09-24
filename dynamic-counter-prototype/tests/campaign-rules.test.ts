import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDawn, applyFinale, applyTouch, availableCustomers, BUNDLE_MINUTE_HINT, bundleMinutesWord, canLeaveSample, COMPLIANCE_RISK, complianceWord, consultsLeft, CUSTOMERS, dawnNotices, demandBudgetWord, endingTitle,
  ENERGY_LOCK, energyWord, evidenceWord, fitOf, floorCustomers, hasFlag, hasRecords, history, INITIAL, LEAVE_SAMPLE_RETURN, leaveSample, ledgerSum, openFloorState, parseCampaign,
  PRODUCTS, QUESTIONS, RECORDS_MIN, resolveSale, RIVAL_INTERRUPTIONS, SAMPLE_RETURN_SALE, SAVE_VERSION, STANDING_RISK, TARGET, DELIVERIES, FIRST_DAY_STOCK, deliveryWord, TRANSFER_UNITS, WEEK_ALLOCATION, touchThreads,
  TOUCHES_PER_EVENING, touchesLeft, structureLine, weekStructure, type BundleId, type Campaign,
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
  // 回来这件事得在晨会上说清，不然玩家以为现场随机多刷了一个人。
  assert.ok(dawnNotices(campaign({ day: 5, flags: ["served:anjie:good"] })).some(note => note.speaker.includes("安姐")));
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
  assert.ok(dawnNotices(next).some(note => note.speaker.includes("沈薇")));
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
  assert.ok(dawnNotices(dawn3).some(note => note.speaker.includes("沈薇")), "到账那一早要念出来");
  assert.ok(!dawnNotices({ ...dawn3, day: 4, daySales: 0 }).some(note => note.speaker.includes("沈薇")), "同一条线不在第二天再念一遍");
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

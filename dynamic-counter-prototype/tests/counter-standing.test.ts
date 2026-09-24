// 柜位这一条线：晨会念的累计进度、私域名单、派样数据和撤柜评估。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addMember, applyDawn, canAddMember, counterVerdict, CUSTOMERS, dayEvent, DAY_TARGETS, dawnNotices,
  INITIAL, morningReview, orderQuote, parseCampaign, PRODUCTS, progressTarget, RECORDS_MIN, SAVE_VERSION, settleDayEvent,
  spendAttention, STANDING_RISK, TARGET, visibleChoices, type Campaign, type CustomerId,
} from "../src/campaign.ts";
import { bestFit, playCustomer } from "./clean-route.ts";

function campaign(patch: Partial<Campaign>): Campaign {
  return { ...INITIAL, ...patch, relations: { ...INITIAL.relations, ...patch.relations }, flags: patch.flags ?? [], history: patch.history ?? [] };
}

const order = (id: CustomerId, day: number, product = "soft" as const, units = 1) => ({
  day, customerId: id, product, units, total: PRODUCTS[product].price * units, amount: PRODUCTS[product].price * units, shared: false, risky: false,
});

test("每日进度加起来就是同一个五日目标，不另开记分牌", () => {
  assert.deepEqual(DAY_TARGETS, [2800, 3200, 3600, 4400, 7000]);
  assert.equal(progressTarget(5), TARGET);
  assert.equal(progressTarget(0), 0);
  assert.equal(progressTarget(99), TARGET, "越界不能读出第二份目标");
});

test("晨会按累计进度说话，超前加分、落后才提撤柜", () => {
  const ahead = campaign({ day: 3, sales: 7070 });
  const review = morningReview(ahead)!;
  assert.equal(review.key, "morning:3");
  assert.ok(review.body.includes("118%"), "念的是到昨天为止的累计");
  const applied = applyDawn(ahead);
  assert.equal(applied.standing, 55);
  assert.equal(applied.relations.roman, 47);
  assert.ok(applied.history.some(entry => entry.text.includes("累计达成 118%")));
  assert.ok(dawnNotices(applied).some(note => note.body.includes("区域周会")), "晨会要出现在当天的告示里");
  // 同一天的晨会只念一次。
  assert.equal(applyDawn(applied).standing, 55);
  const behind = applyDawn(campaign({ day: 3, sales: 4000 }));
  assert.equal(behind.standing, 42);
  assert.ok(morningReview(behind)!.body.includes("还要不要留"), "落后要有人开始问柜位");
  assert.equal(morningReview(campaign({ day: 1 }))?.key, undefined, "第一天没有昨天");
});

test("名单和派样各有一天被品牌数到", () => {
  assert.equal(campaign({ day: 4 }).standing, 50);
  const empty = applyDawn(campaign({ day: 4, sales: 9030 }));
  assert.equal(empty.standing, 46, "94% 只是差一点，名单空着要扣分");
  assert.ok(dawnNotices(empty).some(note => note.body.includes("一条都没加")));
  const roster = applyDawn(campaign({ day: 4, sales: 10000, members: ["shen", "mei"] }));
  assert.equal(roster.standing, 59);
  assert.equal(roster.relations.roman, 50);
  assert.ok(dawnNotices(roster).some(note => note.body.includes("明年还在")));
  // 巡店当天盘的是库存实际数字，不是 flag。
  const hoarded = applyDawn(campaign({ day: 5, sales: 17430, samples: 8 }));
  assert.equal(hoarded.standing, 51, "进度 +5、派样 −4");
  assert.ok(dawnNotices(hoarded).some(note => note.speaker.includes("派样") && note.body.includes("8 份")));
  const sampled = applyDawn(campaign({ day: 5, sales: 17430, samples: 1 }));
  assert.equal(sampled.standing, 58);
});

test("加粉花现场时间，而且只在她接到过你的东西之后", () => {
  const fresh = campaign({ day: 1, waitMeters: { shen: 8, mei: 8 } });
  assert.equal(canAddMember(fresh, "shen"), false, "还没说过话就要微信，她不会给");
  assert.equal(addMember(fresh, "shen"), fresh);
  const afterSample = addMember(campaign({ day: 1, waitMeters: { shen: 8, mei: 8 }, flags: ["sample:shen"] }), "shen");
  assert.deepEqual(afterSample.members, ["shen"]);
  assert.equal(afterSample.shiftMinutes, 1, "要微信就得占一分钟");
  assert.equal(afterSample.waitMeters.shen, 8, "她本人站在你面前");
  assert.equal(afterSample.waitMeters.mei, 7, "另一边的人还在倒数");
  assert.equal(addMember(afterSample, "shen"), afterSample, "名单不重复");
  const gone = campaign({ day: 1, lost: ["mei" as CustomerId], flags: ["sample:mei"] });
  assert.equal(addMember(gone, "mei"), gone, "已经走了的人加不上");
  const saved = parseCampaign(JSON.stringify(afterSample))!;
  assert.deepEqual(saved.members, ["shen"]);
});

test("私域复购只在最后一天到账，金额是她自己那支", () => {
  const sold = playCustomer(campaign({ day: 1, waitMeters: { shen: 8, mei: 8 } }), "shen");
  const added = addMember(sold.campaign, "shen");
  assert.ok(added.dayServed.includes("shen"));
  const before = applyDawn({ ...added, day: 4, daySales: 0 });
  assert.equal(before.sales, added.sales, "名单不是当天见效的东西");
  const dawn = applyDawn({ ...before, day: 5, daySales: 0 });
  assert.equal(dawn.sales - before.sales, PRODUCTS.soft.price, "她补的是自己认过的那一支");
  assert.ok(dawn.history.some(entry => entry.text === `${CUSTOMERS.shen.name}在微信上补了一支${PRODUCTS.soft.short}`));
  assert.equal(applyDawn(dawn).sales, dawn.sales, "同一个人不重复复购");
  // 强推的那单已经退了，不能又变成复购。
  const risky = applyDawn(campaign({ day: 5, sales: 0, members: ["shen"], orders: [{ ...order("shen", 1), risky: true }] }));
  assert.equal(risky.sales, 0);
  // 从没在她那里成过单的名单不产生任何数字。
  assert.equal(applyDawn(campaign({ day: 5, sales: 0, members: ["mei"] })).sales, 0);
});

test("进度落后时闭店事件问的是柜位，不是储备人选", () => {
  const atRisk = campaign({ day: 5, sales: 6000, standing: 30, relations: { roman: 40 } });
  const event = dayEvent(atRisk);
  assert.equal(event.title, "柜位在评估表上");
  assert.ok(event.body.includes("29%"), "她念的是这一周做到多少");
  assert.deepEqual(event.choices.map(choice => choice.id), ["hand-roster", "argue-records", "own-counter-miss", "ask-roman-vouch"]);
  assert.equal(visibleChoices(atRisk, event).length, 2, "罗曼不签字，就没有第三条路");
  // 名单是柜位被评估时唯一能被数出来的东西，所以它也要出现在这一晚。
  const rescued = campaign({ day: 5, sales: 6000, standing: 30, relations: { roman: 40 }, members: ["shen", "mei"] });
  const rescuedEvent = dayEvent(rescued);
  assert.equal(rescuedEvent.title, "柜位在评估表上");
  assert.ok(rescuedEvent.body.includes("2 个人是她问不到"), "她得先知道你手里站着多少人");
  assert.equal(visibleChoices(rescued, rescuedEvent).some(choice => choice.id === "hand-roster"), true);
  assert.equal(counterVerdict(settleDayEvent(rescued, "hand-roster")).label, "柜位留下，名单归你");
  const vouched = dayEvent({ ...atRisk, relations: { roman: 60 } });
  assert.equal(visibleChoices({ ...atRisk, relations: { roman: 60 } }, vouched).length, 3, "之前站在她这边，她才肯签");
  // 摊记录这件事得有本子可摊：空本子只够她翻两页，柜位仍然被写进评估。
  const emptyBook = settleDayEvent(atRisk, "argue-records");
  assert.equal(emptyBook.standing, 33, "没几条记录只救回三个点");
  assert.equal(counterVerdict(emptyBook).label, "撤柜评估已经写上去", "旗没挂上，判词就不能认这一步");
  assert.ok(dayEvent(atRisk).body.includes("摊开来没几行"), "她得先知道你本子里有没有东西");
  const withBook = { ...atRisk, evidence: RECORDS_MIN };
  assert.ok(dayEvent(withBook).body.includes("五天本子摊得开"));
  const settled = settleDayEvent(withBook, "argue-records");
  assert.equal(settled.standing, 40, "摊得开的记录能救回柜位，但刚好压在及格线上");
  assert.equal(counterVerdict(settled).label, "柜位留到季度末");
  // 有赠品缺口时，审计仍然先于柜位；但进度会写进同一张桌子。
  const gap = dayEvent({ ...atRisk, flags: ["covered-suman"] });
  assert.equal(gap.title, "请解释赠品缺口");
  assert.ok(gap.body.includes("她没有把这两件事分开看"));
  const safe = campaign({ day: 5, sales: 17430, standing: 55 });
  assert.equal(dayEvent(safe).title, "账对得上，她仍要一句话");
  assert.equal(visibleChoices(safe, dayEvent(safe)).some(choice => choice.id === "hand-roster"), false, "空名单不能往上交");
  const withRoster = campaign({ day: 5, sales: 17430, standing: 55, members: ["shen", "mei"] });
  assert.equal(visibleChoices(withRoster, dayEvent(withRoster)).some(choice => choice.id === "hand-roster"), true);
  assert.equal(counterVerdict(settleDayEvent(withRoster, "hand-roster")).label, "柜位留下，名单归你");
});

test("报价、存档和柜位数字互不复用：新字段被校验", () => {
  assert.equal(SAVE_VERSION, 4);
  const restored = parseCampaign(JSON.stringify({ ...INITIAL, members: ["shen", "nobody", "shen"], standing: 62 }))!;
  assert.deepEqual(restored.members, ["shen"]);
  assert.equal(restored.standing, 62);
  assert.equal(parseCampaign(JSON.stringify({ ...INITIAL, standing: -5 })), null);
  assert.equal(parseCampaign(JSON.stringify({ ...INITIAL, version: 3 })), null, "旧版本存档整份丢弃，不把老数字并进新的柜位账");
  // 名单不影响报价：同一位顾客在有无名单时报价完全一致。
  assert.deepEqual(orderQuote("shen", bestFit("shen"), "set", false), orderQuote("shen", bestFit("shen"), "set", false));
});

test("清洁路线的柜位落在安全区，但名单和派样不会白送", () => {
  const shen = playCustomer(campaign({ day: 1, waitMeters: { shen: 8, mei: 8 } }), "shen");
  const mei = playCustomer(shen.campaign, "mei");
  const withRoster = addMember(mei.campaign, "mei");
  const dawn = applyDawn({ ...withRoster, day: 5, daySales: 0, samples: 2 });
  assert.ok(dawn.standing > STANDING_RISK, `接待满员、名单和派样都做对的柜位不该被评估：${dawn.standing}`);
  assert.ok(dawn.sales > withRoster.sales, "名单在最后一天要还钱");
  assert.equal(spendAttention(dawn, null, 1).shiftMinutes, dawn.shiftMinutes + 1);
});

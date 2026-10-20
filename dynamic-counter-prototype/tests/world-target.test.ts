// 每周一关（src/world/target.ts）：周一早会记起点、周日打烊对账盖星、柜位跟着动、
// 楼层上跨过目标那一下有一声、档案记最好的一季。
import assert from "node:assert/strict";
import { test } from "node:test";
import { beginSlot, endDay, newWorld } from "../src/world/engine.ts";
import {
  CARE_STEPS, CARE_TRUST_MIN, GUARD_STEPS, SEASON_WEEKS, WEEK_EXCEED_RATE, WEEK_HIT_ROMAN, WEEK_HIT_STANDING, WEEK_MISS_ROMAN, WEEK_START_MONEY, WEEK_START_RIVAL, WEEK_TARGETS,
  markWeekCare, markWeekGuard, markWeekThreat, seasonStarsOf, weekCareOf, weekCareDayKey, weekCareNearOf, weekCareNearPeople, weekCareKey, weekGuardOf, weekGuardRateOf, weekGuardStopsOf, weekGuardThreatsOf, weekMadeKey, weekMoneyOf,
  weekResultOf, weekRouteKey, weekStarsKey, weekStarsOf, weekTargetOf, nextWeekHint,
} from "../src/world/target.ts";
import { worldMoments } from "../src/world/ui/cues.ts";
import { emptyWorldProgress, observeWorldProgress, parseWorldProgress } from "../src/world/progress.ts";
import { SEASON_DAYS } from "../src/world/types.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { World } from "../src/world/types.ts";

/** 这周起点在 money0、对面 rival0 的一副盘，摆到第 day 天。 */
const books = (day: number, money: number, rivalMoney: number, money0 = 0, rival0 = 0): World => {
  const w = newWorld("target-seed", PEOPLE);
  return { ...w, day, slot: 3, money, rivalMoney, standing: 50,
    qualities: { ...w.qualities, [WEEK_START_MONEY]: money0, [WEEK_START_RIVAL]: rival0 } };
};

const careFor = (w: World, id: string): World => markWeekCare({ ...w, opinion: { ...w.opinion, [id]: 10 } }, id);
const careDay = (w: World, id: string, day = 7): World => ({ ...w,
  qualities: { ...w.qualities, [weekCareDayKey(1, id, day)]: 1 },
  opinion: { ...w.opinion, [id]: CARE_TRUST_MIN } });
const careIds = (n: number) => Array.from({ length: n }, (_, i) => `guest-${i}`);

test("一季四关，目标数与天数对得上", () => {
  assert.equal(SEASON_DAYS, SEASON_WEEKS * 7);
  assert.equal(weekTargetOf(1), WEEK_TARGETS[0]);
  assert.equal(weekTargetOf(7), WEEK_TARGETS[0]);
  assert.equal(weekTargetOf(8), WEEK_TARGETS[1]);
  assert.equal(weekTargetOf(28), WEEK_TARGETS[3]);
});

test("三颗星：过关 / 赢对面 / 超额；没过关一颗都不给", () => {
  const t = 10_000;
  assert.equal(weekStarsOf(9_999, 0, t).stars, 0, "差一块也没过");
  assert.equal(weekStarsOf(9_999, 0, t).beatRival, true, "赢了对面也照样 0 星");
  assert.equal(weekStarsOf(10_000, 20_000, t).stars, 1);
  assert.equal(weekStarsOf(10_000, 9_000, t).stars, 2);
  assert.equal(weekStarsOf(Math.ceil(t * WEEK_EXCEED_RATE), 99_999, t).stars, 2, "超额但输给对面：两颗");
  assert.equal(weekStarsOf(Math.ceil(t * WEEK_EXCEED_RATE), 0, t).stars, 3);
});

test("周一早会记下这一关的起点：本周挣的 = 现在 − 起点", () => {
  const w0 = { ...newWorld("target-monday", PEOPLE), day: 8, slot: 0 as const, money: 12_345, rivalMoney: 6_789 };
  const w = beginSlot(w0, PEOPLE);
  assert.equal(w.qualities[WEEK_START_MONEY], 12_345);
  assert.equal(w.qualities[WEEK_START_RIVAL], 6_789);
  assert.equal(weekMoneyOf(w), 0);
  // 周中不重记
  const mid = beginSlot({ ...w, day: 9, slot: 0, money: 20_000 }, PEOPLE);
  assert.equal(mid.qualities[WEEK_START_MONEY], 12_345);
});

test("周日打烊对账：落三格、过关柜位与罗曼 +、没过柜位不动罗曼 −、罗曼说一句", () => {
  const t = WEEK_TARGETS[0];
  const pass = endDay(books(7, t + 500, 100), PEOPLE);
  assert.equal(pass.qualities[weekMadeKey(1)], t + 500);
  assert.equal(pass.qualities[weekStarsKey(1)], 2);
  assert.equal(pass.standing, 50 + WEEK_HIT_STANDING);
  assert.equal(pass.opinion.roman - (books(7, 0, 0).opinion.roman ?? 0), WEEK_HIT_ROMAN);
  assert.ok(pass.log.some(l => l.text.includes("第 1 关对账") && l.text.includes("过关")));

  const fail = endDay(books(14, 30_000, 0, 25_000, 0), PEOPLE);
  assert.equal(fail.qualities[weekMadeKey(2)], 5_000, "本周只算起点之后的钱");
  assert.equal(fail.qualities[weekStarsKey(2)], 0);
  assert.equal(fail.standing, 50, "没过不扣柜位（这是卖货的关，不替人情那条路判死刑）");
  assert.equal(fail.opinion.roman - (books(14, 0, 0).opinion.roman ?? 0), WEEK_MISS_ROMAN);
  assert.ok(fail.log.some(l => l.text.includes("第 2 关对账") && l.text.includes("都还没到线")));
  assert.deepEqual(seasonStarsOf(fail), [0]);

  // 不是周日不结账
  const wed = endDay(books(3, 99_999, 0), PEOPLE);
  assert.equal(wed.qualities[weekMadeKey(1)], undefined);
  assert.equal(wed.standing, 50);
});

test("客情、守客是独立的过关路线；同一人不能刷进度，只取最高星", () => {
  let care = books(7, 500, 10_000);
  for (const id of careIds(CARE_STEPS[0])) care = careFor(care, id);
  care = careFor(care, "guest-0");
  assert.equal(weekCareOf(care), CARE_STEPS[0]);
  assert.deepEqual([weekResultOf(care).route, weekResultOf(care).stars], ["care", 1]);
  const settledCare = endDay(care, PEOPLE);
  assert.equal(settledCare.qualities[weekRouteKey(1)], 2);
  assert.equal(settledCare.qualities[weekStarsKey(1)], 1);
  assert.equal(settledCare.standing, 52);
  assert.ok(settledCare.log.some(l => l.text.includes("客情线") && l.text.includes("过关")));

  let guard = books(7, 500, 10_000);
  for (const [i, id] of ["shen", "mei", "zhao"].entries()) guard = markWeekGuard({ ...guard, day: i + 1, slot: 0 }, id);
  guard = { ...guard, day: 3, slot: 0 };
  guard = markWeekGuard({ ...guard, slot: 1 }, "shen");
  assert.equal(weekGuardOf({ ...guard, day: 7 }), 3);
  const settledGuard = endDay({ ...guard, day: 7 }, PEOPLE);
  assert.equal(settledGuard.qualities[weekRouteKey(1)], 3);
  assert.equal(settledGuard.qualities[weekStarsKey(1)], 1);

  let better = books(7, 8_100, 500);
  for (const id of careIds(CARE_STEPS[2])) better = careFor(better, id);
  assert.equal(weekResultOf(better).route, "care");
  assert.equal(weekResultOf(better).stars, 3);
});

test("客情线跨过第一颗星时当场亮过关反馈", () => {
  let before = books(3, 0, 0);
  for (const id of careIds(CARE_STEPS[0] - 1)) before = careFor(before, id);
  const after = careFor(before, careIds(CARE_STEPS[0]).at(-1)!);
  assert.ok(worldMoments(before, after).some(m => m.kind === "goal"));
  assert.ok(!worldMoments(after, careFor(after, `guest-${CARE_STEPS[0]}`)).some(m => m.kind === "goal"));
});

test("客情星看当前信任，盖过章后伤了关系仍会掉出名单", () => {
  let w = books(4, 0, 10_000);
  for (const id of careIds(CARE_STEPS[0])) w = careFor(w, id);
  assert.equal(weekResultOf(w).careStars, 1);
  const hurt = { ...w, opinion: { ...w.opinion, "guest-0": 9 } };
  assert.equal(weekCareOf(hurt), CARE_STEPS[0] - 1);
  assert.equal(weekResultOf(hurt).careStars, 0);
});

test("守客过关仍认人数，高星还要挡住公开威胁的一半/四分之三；无目标不扩大分母", () => {
  let w = books(7, 0, 99_999);
  for (let i = 0; i < 28; i++) w = markWeekThreat({ ...w, day: 1 + Math.floor(i / 4), slot: (i % 4) as World["slot"] }, i < GUARD_STEPS[2] ? `guest-${i}` : "guest-0");
  for (let i = 0; i < GUARD_STEPS[2]; i++) w = markWeekGuard({ ...w, day: 1 + Math.floor(i / 4), slot: (i % 4) as World["slot"] }, `guest-${i}`);
  w = { ...w, day: 7 };
  assert.equal(weekGuardOf(w), GUARD_STEPS[2]);
  assert.equal(weekGuardThreatsOf(w), 28);
  assert.equal(weekGuardStopsOf(w), GUARD_STEPS[2]);
  assert.equal(weekResultOf(w).guardStars, 1, "守很多不同人却漏掉多数威胁，只过关");
  for (let i: number = GUARD_STEPS[2]; i < 21; i++) {
    w = markWeekGuard({ ...w, day: 1 + Math.floor(i / 4), slot: (i % 4) as World["slot"] }, "guest-0");
    if (i === 13) assert.equal(weekResultOf(w).guardStars, 2);
  }
  assert.equal(weekGuardRateOf(w), 0.75);
  assert.equal(weekResultOf(w).guardStars, 3);
  assert.equal(weekGuardOf(w), GUARD_STEPS[2], "同客重复挡下只改善守住率，不刷人数");
  const sameSlot = markWeekThreat(markWeekGuard({ ...w, day: 1, slot: 0 }, "guest-0"), "guest-0");
  assert.equal(weekGuardRateOf(sameSlot), 0.75, "重复结算不刷分子分母");
  assert.equal(weekGuardThreatsOf(books(3, 0, 0)), 0);
});

test("楼层上跨过这一关的数那一下，有「本周过关」那一声；周与周之间不误报", () => {
  const t = WEEK_TARGETS[0];
  const before = books(3, t - 100, 0), after = { ...before, money: t + 900 };
  assert.ok(worldMoments(before, after).some(m => m.kind === "goal"));
  assert.ok(!worldMoments(after, { ...after, money: after.money + 500 }).some(m => m.kind === "goal"), "已经过了不再响");
  const nextWeek = { ...after, day: 8 };
  assert.ok(!worldMoments(before, nextWeek).some(m => m.kind === "goal"), "跨周那一下不算");
});

test("档案记最好的一季（四关星数加起来），只在收季那一刻认、只升不降，旧档案缺键按 0 读", () => {
  const w = books(28, 0, 0);
  const done: World = { ...w, qualities: { ...w.qualities,
    [weekMadeKey(1)]: 1, [weekStarsKey(1)]: 3, [weekMadeKey(2)]: 1, [weekStarsKey(2)]: 2,
    [weekMadeKey(3)]: 1, [weekStarsKey(3)]: 0, [weekMadeKey(4)]: 1, [weekStarsKey(4)]: 1 } };
  const mid = observeWorldProgress(emptyWorldProgress(), done);
  assert.equal(mid.bestSeasonStars, 0, "没收季不认");
  const end = observeWorldProgress(emptyWorldProgress(), done, "nobody-left");
  assert.equal(end.bestSeasonStars, 6);
  const worse = { ...done, qualities: { ...done.qualities, [weekStarsKey(1)]: 0 } };
  assert.equal(observeWorldProgress(end, worse, "nobody-left").bestSeasonStars, 6, "只升不降");
  const round = parseWorldProgress(JSON.stringify(end));
  assert.equal(round?.bestSeasonStars, 6);
  const { bestSeasonStars: _, ...legacy } = end;
  assert.equal(parseWorldProgress(JSON.stringify(legacy))?.bestSeasonStars, 0);
  assert.equal(parseWorldProgress(JSON.stringify({ ...end, bestSeasonStars: 13 })), null, "超过满星整份拒收");
});

test("下一周先改什么：从这一周离门槛最近的一条里挑一句能做的事", () => {
  const nearSales = books(7, 11_800, 9_000);
  assert.match(nextWeekHint(nearSales), /下周目标 ¥16,000/, "第 2 关目标");
  assert.match(nextWeekHint(nearSales), /先追业绩：还差 ¥1,200/);
  assert.doesNotMatch(nextWeekHint(nearSales), /先补客情|先守客/);

  let care = books(7, 8_000, 9_000);
  for (const id of careIds(8)) care = careFor(care, id);
  assert.match(nextWeekHint(care), /先补客情：还差 1 位/);
  assert.match(nextWeekHint(care), /同一位客人要在两个不同日子/);

  let guard = books(7, 8_000, 9_000);
  for (const id of careIds(2)) guard = markWeekGuard(guard, id);
  assert.match(nextWeekHint(guard), /先守客：还差 1 位/);

  const passed = books(7, WEEK_TARGETS[0] + 500, 1_000);
  const hint = nextWeekHint(passed);
  assert.match(hint, /下周目标 ¥16,000/);
  assert.match(hint, /凭业绩过关/);
  assert.match(hint, /下周品牌培训周/, "下一周的规矩提前进复盘");

  const last = nextWeekHint({ ...books(28, 50_000, 10_000), season: 1 });
  assert.match(last, /下季第 1 关 ¥13,000/);
  assert.match(last, /下季品牌培训周/);
});

test("客情只差一天：单独读出人数，下周提示不说「再点一次就补完」", () => {
  // 1 位已记（两天 + week-care）+ 8 位本周只照应过一天；业绩/守客都离得更远，客情应被选中。
  let w = books(7, 1_000, 9_000);
  w = careDay(careDay(w, "guest-0", 6), "guest-0", 7);
  w = careFor(w, "guest-0");
  for (const id of careIds(9).slice(1)) w = careDay(w, id);
  assert.equal(weekCareOf(w), 1);
  assert.equal(weekCareNearOf(w), 8);
  assert.deepEqual(weekCareNearPeople(w).sort(), careIds(9).slice(1).sort());
  // 信任不到门槛、或只有上周那一天的，不算进来。
  const lowTrust = { ...w, opinion: { ...w.opinion, "guest-3": CARE_TRUST_MIN - 1 } };
  assert.equal(weekCareNearOf(lowTrust), 7);
  const otherWeek = { ...w, qualities: { ...w.qualities, [weekCareDayKey(2, "guest-9", 8)]: 1 },
    opinion: { ...w.opinion, "guest-9": CARE_TRUST_MIN } };
  assert.equal(weekCareNearOf(otherWeek), 8);
  assert.doesNotMatch(nextWeekHint(w), /先约回本周只照应过一天的人/);
  assert.match(nextWeekHint(w), /先补客情：还差 8 位/);
  assert.match(nextWeekHint(w), /8 位只差一天/);
  assert.match(nextWeekHint(w), /下周要从头记两天/);
});

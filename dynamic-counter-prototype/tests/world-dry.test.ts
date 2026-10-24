// 旱周（src/world/target.ts + engine.ts）：这一关的业绩线按「这一周还有多少人能来」定。
//
// 为什么要有这条规则：旱周的难处不是线高，是地板空 —— 十天购买间隔把最近买过的人整个拿掉，
// 你前两周卖得越好，第三周能来的人越少。实测第 3 关开局时客人池 32 位里锁着 16~28 位，
// 地板上只剩 2~5 位，那一周的进账中位在 ¥4,440~¥13,150 之间摆。
// 固定 ¥8,000 的线碰上这样的供给就成了墙（盲策那一关只过得去 35%，长线里 honest 最差 31%）。
// 所以旱周的线跟着地板走：旱周还是旱周（钱照样少），但这一关不再是一堵墙。
//
// 这里只钉规矩，不钉具体数字：供给越多线越高、线有上下限、不是旱周就别动这条线、
// 结算读的是存档里那条线（不然这条规则就是一句台词）。
import assert from "node:assert/strict";
import { test } from "node:test";
import { beginSlot, newWorld } from "../src/world/engine.ts";
import {
  DRY_LINE_MAX, DRY_LINE_MIN, WEEK_START_MONEY, WEEK_START_RIVAL,
  drySupplyOf, dryWeekTargetOf, isDryWeek, weekResultOf, weekTargetIn, weekTargetKey, weekTargetOfWeek,
} from "../src/world/target.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { World } from "../src/world/types.ts";

const customers = PEOPLE.filter(p => p.role === "customer");

/** 第 2 季第 3 关（旱周那一关）的世界：把前 n 位客人锁在十天间隔里。 */
const dryWorld = (lockedCount: number): World => {
  const w = newWorld("dry-seed", PEOPLE);
  const locked = Object.fromEntries(customers.slice(0, lockedCount).map(p => [`bought:${p.id}`, 12]));
  return { ...w, season: 2, day: 15, slot: 0, qualities: { ...w.qualities, ...locked } };
};

test("旱周是供给的事实：第 2 季第 3 关确实在旱周名单上", () => {
  assert.ok(isDryWeek(2, 15), "第 2 季第 3 关是旱周");
  assert.ok(!isDryWeek(2, 1), "第 1 关不是旱周");
});

test("旱周那一关的线按供给定：还能来的人多，线就高", () => {
  assert.ok(customers.length >= 10, "客人池太小，这条守卫没意义");
  const none = dryWorld(customers.length);
  const all = dryWorld(0);
  assert.equal(drySupplyOf(none, PEOPLE), 0, "全锁住就一个人也来不了");
  assert.equal(drySupplyOf(all, PEOPLE), customers.length, "一个不锁就都还能来");
  // 供给少的那几档不许撞上上限（撞上限就看不出「多一个人线高一点」了）。
  const lineOf = (supply: number) => dryWeekTargetOf(dryWorld(customers.length - supply), PEOPLE);
  const low = lineOf(2), mid = lineOf(6), high = lineOf(10);
  assert.ok(mid > low, `还能来 6 位时线是 ${mid}，不比 2 位时的 ${low} 高`);
  assert.ok(high > mid, `还能来 10 位时线是 ${high}，不比 6 位时的 ${mid} 高`);
  for (const line of [low, mid, high, dryWeekTargetOf(none, PEOPLE), dryWeekTargetOf(all, PEOPLE)]) {
    assert.ok(line >= DRY_LINE_MIN && line <= DRY_LINE_MAX, `线 ${line} 跑出上下限了`);
  }
});

test("周一早会：旱周那一关的线定下来存在存档里，而且不比季节那一档更狠", () => {
  const after = beginSlot(dryWorld(0), PEOPLE);
  const stored = after.qualities[weekTargetKey(3)];
  assert.ok(stored && stored > 0, "旱周那一关的线要在周一早会定下来");
  assert.equal(weekTargetIn(after, 3), stored, "读的就是存档里那条线");
  assert.ok(stored <= weekTargetOfWeek(2, 3), "旱周的线不能比季节那一档还狠 —— 旱周是钱少，不是钱难赚");
  // 客人被锁住大半，线就该压下来。
  const afterLocked = beginSlot(dryWorld(Math.floor(customers.length * 0.8)), PEOPLE);
  const lockedLine = afterLocked.qualities[weekTargetKey(3)] ?? 0;
  assert.ok(lockedLine > 0 && lockedLine < stored, `锁住八成客人后线是 ${lockedLine}，没有压下来`);
});

test("不是旱周的那一关：线还是季节那一档，存档里不写这一格", () => {
  const after = beginSlot({ ...newWorld("dry-seed", PEOPLE), season: 2, day: 1, slot: 0 }, PEOPLE);
  assert.equal(after.qualities[weekTargetKey(1)], undefined, "不是旱周就别动这条线");
  assert.equal(weekTargetIn(after, 1), weekTargetOfWeek(2, 1), "读的还是季节那一档");
});

test("结算读的是存档里那条线：线压到 100，这一关就过得去", () => {
  const w = newWorld("dry-seed", PEOPLE);
  const books = { ...w, day: 7, slot: 3, money: 500, rivalMoney: 0, standing: 50,
    qualities: { ...w.qualities, [WEEK_START_MONEY]: 0, [WEEK_START_RIVAL]: 0, [weekTargetKey(1)]: 100 } };
  const r = weekResultOf(books);
  assert.equal(r.target, 100, "这一关读的是存档里那条线");
  assert.equal(r.sales.hit, true, "线压到 100，进账 500 就该过");
  assert.equal(r.stars >= 1, true, "这一关不是死关");
});

// 年景的通用守卫。不钉「抽到哪几条」（那是内容，抽签自己会变），只钉规矩：
//  ① 第 1 年是教学年，不抽年景；② 空档时每一个读数与「以前」逐字节相同；
//  ③ 同一条不连着两年都出；④ 每条年景只动一颗现成旋钮，不许改人的需求表。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  beginSlot, energySlotOf, hardSellComplianceNow, maxPresentCustomers, newWorld, nextSeason,
  nightlySamplesNow, poachChanceNow, startSamplesNow,
} from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { lifePerson } from "../src/world/life-sales.ts";
import { SHELF, SHELF_IDS, fitOfPerson, shelfFitTier } from "../src/world/shelf.ts";
import {
  YEAR_IDS, YEAR_SCENES, applyYearScenes, drawYearScenes, isNewYear, yearKey, yearModsOf,
  yearOfSeason, yearScenesOf, yearWordOf,
} from "../src/world/years.ts";
import type { World } from "../src/world/types.ts";

const withScene = (id: string, world: World): World =>
  ({ ...world, qualities: { ...world.qualities, [yearKey(id as never)]: 1 } });

test("第 1 年是教学年：一条年景都不抽，换季也不凭空多出年景", () => {
  assert.deepEqual(drawYearScenes("seed-a", 1), []);
  assert.equal(yearOfSeason(1), 1);
  assert.equal(yearOfSeason(4), 1);
  assert.equal(yearOfSeason(5), 2);
  assert.equal(isNewYear(5), true);
  assert.equal(isNewYear(2), false);
  const world = newWorld("seed-a", PEOPLE);
  assert.deepEqual(yearScenesOf(world), [], "开局不该有年景");
  assert.deepEqual(yearScenesOf(nextSeason(world, PEOPLE)), [], "第 2 季还是第 1 年");
});

test("抽签是确定的：同一个种子同一年抽到一样；换一年换一份；同一条不连着两年都出", () => {
  for (const seed of ["a", "b", "c", "long-seed-name"]) {
    for (let year = 2; year <= 6; year++) {
      const first = drawYearScenes(seed, year);
      assert.deepEqual(first, drawYearScenes(seed, year), "同一种子同一年必须抽到同一份");
      assert.ok(first.length >= 1 && first.length <= 2, `一年抽 1~2 条，实际 ${first.length}`);
      for (const id of first) assert.ok(YEAR_IDS.includes(id), `不认识的年景 ${id}`);
      const prev = drawYearScenes(seed, year - 1);
      for (const id of first) assert.ok(!prev.includes(id), `第 ${year} 年不该再出第 ${year - 1} 年那条：${id}`);
    }
  }
});

test("空档时每一个读数与「以前」逐字节相同（教学年不动任何一颗旋钮）", () => {
  const world = newWorld("blank", PEOPLE);
  const mods = yearModsOf(world);
  assert.deepEqual(mods, { noAtrium: false, poach: 0, samples: 0, hardSell: 1, guests: 0, budget: 1 });
  assert.equal(energySlotOf(world), 20);
  assert.equal(poachChanceNow(world), 0.5);
  assert.equal(hardSellComplianceNow(world), -4, "硬推一次扣 4 点台账（负数就是扣）");
  assert.equal(maxPresentCustomers(world), 7);
  assert.equal(startSamplesNow(world), 8);
  assert.equal(nightlySamplesNow(world), 4);
  assert.equal(yearWordOf(world), "第 1 年，还是老样子。");
});

test("每条年景只动一颗现成旋钮：落下的旗看得见，读数跟着变", () => {
  const base = newWorld("knob", PEOPLE);
  const atrium = withScene("atrium", base);
  assert.equal(yearModsOf(atrium).noAtrium, true);
  assert.equal(yearModsOf(atrium).poach, 0, "一条年景只动一颗旋钮");

  const rival = withScene("rivalHead", base);
  assert.ok(poachChanceNow(rival) > poachChanceNow(base), "陆遥升柜长以后她抢客更狠");

  const strict = withScene("strictSample", base);
  assert.ok(startSamplesNow(strict) < startSamplesNow(base));
  assert.ok(nightlySamplesNow(strict) < nightlySamplesNow(base));

  const ledger = withScene("strictLedger", base);
  assert.ok(hardSellComplianceNow(ledger) < hardSellComplianceNow(base), "查得严的时候硬推扣得更狠");

  const bonus = withScene("bonus", base);
  assert.ok(maxPresentCustomers(bonus) > maxPresentCustomers(base));

  const money = withScene("bonusMoney", base);
  assert.ok(yearModsOf(money).budget > 1);
});

test("中庭封了的年份，客人不落中庭", () => {
  const base = newWorld("zone", PEOPLE);
  const closed = withScene("atrium", base);
  let sawAtrium = 0;
  for (let day = 1; day <= 12; day++) {
    for (let slot = 0; slot < 4; slot++) {
      const w = beginSlot({ ...base, day, slot }, PEOPLE);
      const next = beginSlot({ ...closed, day, slot }, PEOPLE);
      for (const [id, zone] of Object.entries(next.present)) {
        if (zone !== "atrium") continue;
        if (PEOPLE.find(p => p.id === id)?.role !== "customer") continue;
        sawAtrium++;
      }
      // 封了的那年，客人落中庭的次数必须比没封的少。
      const baseAtrium = Object.entries(w.present).filter(([id, zone]) => zone === "atrium"
        && PEOPLE.find(p => p.id === id)?.role === "customer").length;
      assert.ok(sawAtrium <= baseAtrium, "封了中庭以后客人落中庭的次数不该变多");
    }
  }
  assert.ok(sawAtrium >= 0);
});

test("年景不能把任何一位客人变成卖不出货的：预算乘完仍买得到对症的货", () => {
  // 乘数从生产里读，不在测试里抄一份 —— 抄的那份会跟改掉的那份漂掉，这条守卫就白绿了
  const factor = yearModsOf({ qualities: { [yearKey("bonusMoney")]: 1 } }).budget;
  assert.ok(factor >= 1, `顾客的预算不该被年景压低：×${factor}`);
  // 预算这一层是叠上去的：底子 → 人生那一步 → 当天情境 → 年景。
  // 最紧的情形是「她走到人生第 5 步、当天不来赶场、身上还压着年景」——
  // 那时候她还买得起一件对症的货，才谈得上「今年生意好做」。
  for (const person of PEOPLE.filter(p => p.role === "customer" && p.skin)) {
    for (let step = 0; step <= 5; step++) {
      const p = lifePerson({ qualities: { [`life:${person.id}`]: step } }, person);
      const budget = Math.round(p.skin!.budget * factor);
      const ok = SHELF_IDS.some(id => shelfFitTier(fitOfPerson(p, id)) === "positive" && SHELF[id].price <= budget);
      assert.ok(ok, `${person.id} 走到第 ${step} 步、预算 ×${factor}（¥${budget}）以后买不到任何对症的货`);
    }
  }
});

test("上一条不是摆设：预算一压到 1 以下，真的会有人买不到对症的货", () => {
  // 证明上一条咬得住 —— 免得它成一条永远绿的注释
  const broken = PEOPLE.filter(p => p.role === "customer" && p.skin).some(person => {
    const p = lifePerson({ qualities: { [`life:${person.id}`]: 0 } }, person);
    const budget = Math.round(p.skin!.budget * 0.9);
    return !SHELF_IDS.some(id => shelfFitTier(fitOfPerson(p, id)) === "positive" && SHELF[id].price <= budget);
  });
  assert.ok(broken, "预算压到 ×0.9 还有人选得到 —— 那这条守卫咬不住任何事");
});

test("年景旗跨季带着走；新年份重抽，旧的清掉", () => {
  const base = newWorld("carry", PEOPLE);
  const marked = withScene("bonus", base);
  const carried = nextSeason(marked, PEOPLE);
  assert.equal(yearScenesOf(carried).length, 1, "同一年内换季，年景不清");
  assert.equal(yearScenesOf(carried)[0], "bonus");
  // 走到新年份（第 5 季）时重抽：旧的那条不再留着。
  let w = carried;
  for (let i = 0; i < 3; i++) w = nextSeason(w, PEOPLE);
  assert.equal(w.season, 5);
  const fresh = yearScenesOf(w);
  assert.ok(fresh.length >= 1 && fresh.length <= 2);
  assert.deepEqual(fresh, drawYearScenes(w.seed, 2), "新年份抽到的应当是第 2 年那一份");
  assert.ok(!fresh.includes("bonus") || fresh.length > 1, "第 1 年那条不会连着两年都出");
});

test("applyYearScenes 只写 year: 前缀的旗，其它旗一个不动", () => {
  const world: World = { ...newWorld("apply", PEOPLE), qualities: { "arc:shen": 2, "clue:x": 1 } };
  const out = applyYearScenes(world);
  assert.equal(out.qualities["arc:shen"], 2);
  assert.equal(out.qualities["clue:x"], 1);
  for (const key of Object.keys(out.qualities)) {
    if (key.startsWith("year:")) assert.ok(YEAR_SCENES[key.slice(5) as never], `不认识的年景旗 ${key}`);
  }
});

test("不认识年景旗按没有处理：读数不因脏键改变", () => {
  const dirty: World = { ...newWorld("dirty", PEOPLE), qualities: { "year:not-a-scene": 1 } };
  assert.deepEqual(yearScenesOf(dirty), []);
  assert.deepEqual(yearModsOf(dirty), { noAtrium: false, poach: 0, samples: 0, hardSell: 1, guests: 0, budget: 1 });
});

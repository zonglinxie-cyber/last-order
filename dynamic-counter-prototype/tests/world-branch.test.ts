// 第 4 级（三条分支结局线）的通用守卫。不钉「哪条分支第几年走到哪一档」那种内容，
// 只钉规矩：
//  ① 分支选一次就定死，没选时三条路摆出来；
//  ② 三条分支发的旋钮互不相同，而且没有哪条是「什么也不给」；
//  ③ 区域督导：一天只定一个柜，三个柜各有各的取舍（没有一档三样都最好）；
//  ④ 跳去维珞：对手换成老同事，他开单更贵、也更常抢；
//  ⑤ 自己开店：罗曼那本件数账没了，但房租照交；
//  ⑥ 第 4 级：年景里跟你过不去的那几条劲道减半（位置稳了，风浪小了）；
//  ⑦ 职业终局有两种收法：被换掉与走完，各给一句不一样的话。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  endDay, energySlotOf, hardSellComplianceNow, maxPresentCustomers, newWorld, poachChanceNow, poachSale,
  startSamplesNow,
} from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { CAREER_RANK_KEY, careerAudit } from "../src/world/career.ts";
import {
  BRANCH_IDS, BRANCHES, branchModsOf, branchOf, chooseBranch, poacherIdOf, rivalNameOf,
  OWN_RENT_PER_WEEK, OWN_RENT_PER_SEASON,
} from "../src/world/branches.ts";
import { DISTRICT_SPEC, DISTRICT_ZONES, chooseDistrict, districtChosenToday, districtZoneOf } from "../src/world/district.ts";
import { CAREER_DONE_KEY, CAREER_ENDED_KEY, careerContinued, careerDone, keepGoing } from "../src/world/career.ts";
import { careerEndingOf } from "../src/world/ending.ts";
import { openDay } from "../src/world/requests.ts";
import { SHELF, SHELF_IDS, bestShelf, fitOfPerson, POSITIVE_FIT, richestShelf } from "../src/world/shelf.ts";
import type { World } from "../src/world/types.ts";

/** 第 4 级的世界（还没选分支）。 */
const atRank4 = (seed: string): World => {
  const base = newWorld(seed, PEOPLE);
  return { ...base, qualities: { ...base.qualities, [CAREER_RANK_KEY]: 4 } };
};

test("分支选一次就定死：到了第 4 级先摆出三条路，选完不能改", () => {
  const r4 = atRank4("branch-pick");
  assert.equal(branchOf(r4), null, "没选就没有分支");
  const picked = chooseBranch(r4, "district");
  assert.equal(branchOf(picked), "district");
  assert.equal(chooseBranch(picked, "own"), picked, "选完不能改 —— 同一份对象一个字节都不动");
  assert.equal(branchOf(chooseBranch(picked, "own")), "district", "第二次选不算数");
  // 三条路都念得出名字与手感句（第 4 级不能只是一句台词）。
  for (const id of BRANCH_IDS) {
    assert.ok(BRANCHES[id].name.length > 0, `${id} 没有名字`);
    assert.ok(BRANCHES[id].line.length > 4, `${id} 没有手感句`);
    assert.ok(BRANCHES[id].effect.length > 4, `${id} 没写改了什么`);
  }
});

test("没选分支时，引擎读数一个数都不许变 —— 第 1~3 级还是原来那套账", () => {
  const base = newWorld("branch-neutral", PEOPLE);
  const m = branchModsOf(base);
  assert.equal(m.guests, 0, "没选分支不能多给客人");
  assert.equal(m.energy, 0, "没选分支不能多给精力");
  assert.equal(m.poach, 0, "没选分支不能改抢客");
  assert.equal(m.budget, 1, "没选分支不能改顾客的钱袋子");
  assert.equal(m.rent, 0, "没选分支没人收租");
  assert.equal(m.quota, true, "没选分支罗曼那本件数账照旧");
  assert.equal(m.oldColleague, false, "没选分支对面还是陆遥");
  // 引擎那几处读数也不许动。
  const plain = { ...base, qualities: { ...base.qualities, [CAREER_RANK_KEY]: 3 } } as World;
  const r4 = { ...base, qualities: { ...base.qualities, [CAREER_RANK_KEY]: 4 } } as World;
  assert.equal(maxPresentCustomers(r4), maxPresentCustomers(plain), "第 4 级本身不改客人上限");
  assert.equal(energySlotOf(r4), energySlotOf(plain), "第 4 级本身不改精力");
  assert.equal(poachChanceNow(r4), poachChanceNow(plain), "第 4 级本身不改抢客概率");
  // 但选了分支就该变 —— 不然上面那几条是摆设。
  assert.notEqual(maxPresentCustomers(chooseBranch(r4, "weiluo")), maxPresentCustomers(r4), "选了分支就该换读数");
});

test("三条分支发的旋钮互不相同：不能两条分支发一样的东西", () => {
  const r4 = atRank4("branch-mods");
  const shapes = BRANCH_IDS.map(id => JSON.stringify(branchModsOf(chooseBranch(r4, id))));
  assert.equal(new Set(shapes).size, BRANCH_IDS.length, "三条分支的旋钮重了 —— 那就不是三条路");
});

test("区域督导：一天只定一个柜，选完当天改不了；三个柜各有各的取舍", () => {
  const w = chooseBranch(atRank4("branch-district"), "district");
  const east = chooseDistrict(w, "east");
  assert.equal(districtZoneOf(east), "east");
  assert.equal(districtChosenToday(east), true);
  assert.equal(chooseDistrict(east, "west"), east, "当天定住了 —— 换柜要重新认人、重新摆货");
  // 换一个柜，客流、客单、力气三样里总有几样不一样。
  const specs = DISTRICT_ZONES.map(z => DISTRICT_SPEC[z]);
  assert.equal(new Set(specs.map(s => s.guests)).size, DISTRICT_ZONES.length, "三个柜的客流得不一样");
  assert.equal(new Set(specs.map(s => s.budget)).size, DISTRICT_ZONES.length, "三个柜的客单得不一样");
  for (const s of specs) {
    const best = DISTRICT_ZONES.every(o => {
      const t = DISTRICT_SPEC[o];
      return t.guests <= s.guests && t.budget <= s.budget && t.energy <= s.energy;
    });
    assert.ok(!best, `${s.name} 三样都最好 —— 那就不是选择`);
  }
  // 三档的旋钮真的接进引擎：换柜，客人上限与顾客的钱袋子跟着变。
  const guestsOf = (z: typeof DISTRICT_ZONES[number]) =>
    maxPresentCustomers(chooseDistrict(w, z));
  assert.notEqual(guestsOf("east"), guestsOf("west"), "换柜要换客流");
  assert.notEqual(energySlotOf(chooseDistrict(w, "middle")), energySlotOf(chooseDistrict(w, "east")),
    "换柜要换力气");
});

test("跳去维珞：跟你抢客的换成老同事周敏，他开单更贵", () => {
  const w = chooseBranch(atRank4("branch-weiluo"), "weiluo");
  assert.equal(rivalNameOf(w), "周敏");
  assert.equal(poacherIdOf(w), "zhoumin", "楼层上站在对面那一侧的人与抢客的人必须是同一个");
  const r3 = { ...newWorld("branch-weiluo", PEOPLE), qualities: { [CAREER_RANK_KEY]: 3 } };
  assert.ok(poachChanceNow(w) > poachChanceNow(r3 as World), "老同事比陆遥更常抢");
  // 他开单更贵：同一批客人，他那边进账更多。
  const buyers = PEOPLE.filter(p => p.skin);
  const his = buyers.reduce((a, p) => a + poachSale(p, true).amount, 0);
  const hers = buyers.reduce((a, p) => a + poachSale(p, false).amount, 0);
  assert.ok(his > hers, `老同事那边进账 ${his} 不比陆遥的 ${hers} 多 —— 他知道你那几样要什么`);
});

test("最贵正解那一支：买得起、对症、且是这些里最贵的一支", () => {
  for (const person of PEOPLE.filter(p => p.skin)) {
    const rich = richestShelf(person);
    assert.ok(fitOfPerson(person, rich) >= POSITIVE_FIT, `${person.name} 最贵那支不该是推错的`);
    const better = SHELF_IDS.filter(id => fitOfPerson(person, id) >= POSITIVE_FIT
      && Math.min(person.skin!.maxUnits, Math.floor(person.skin!.budget / SHELF[id].price)) > 0
      && SHELF[id].price > SHELF[rich].price);
    assert.equal(better.length, 0, `${person.name} 还有更贵且买得起的对症货：${better.join("、")}`);
  }
  assert.equal(SHELF[bestShelf(PEOPLE.find(p => p.id === "yinxiaojie")!)].price > 0, true);
});

test("自己开店：罗曼那本件数账不再报给你，但房租照交", () => {
  const own = chooseBranch(atRank4("branch-own"), "own");
  assert.equal(branchModsOf(own).quota, false, "自己的店没有人报件数");
  assert.equal(branchModsOf(own).rent, OWN_RENT_PER_SEASON);
  // 罗曼的件数委托在别的分支里是会出现的 —— 不然上面那条就是摆设。
  const dayWorld = (w: World): World => ({ ...w, season: 2, day: 5, slot: 0, present: { roman: "counter" } });
  let quotaSeen = 0, ownQuota = 0;
  for (const seed of ["q1", "q2", "q3", "q4"]) {
    const plain = dayWorld(newWorld(seed, PEOPLE));
    for (let day = 2; day <= 20; day++) {
      const w = openDay({ ...plain, day }, PEOPLE);
      quotaSeen += w.requests.filter(r => r.kind === "quota").length;
      const o = openDay({ ...dayWorld(chooseBranch(atRank4(seed), "own")), day }, PEOPLE);
      ownQuota += o.requests.filter(r => r.kind === "quota").length;
    }
  }
  assert.ok(quotaSeen > 0, "罗曼的件数委托在别的分支里根本不出现 —— 上一条断言就是摆设");
  assert.equal(ownQuota, 0, "自己的店里还有罗曼报的件数");
  // 房租：每周日打烊扣一次。
  const sunday = { ...own, day: 7, slot: 3, money: 10000, present: {}, touched: [] };
  const after = endDay(sunday, PEOPLE);
  assert.equal(after.money, 10000 - OWN_RENT_PER_WEEK, "周日打烊要交一次房租");
});

test("第 4 级：年景里跟你过不去的那几条，劲道减半", () => {
  const base = newWorld("branch-year", PEOPLE);
  const flags = { "year:rivalHead": 1, "year:strictSample": 1, "year:strictLedger": 1 };
  const r3 = { ...base, qualities: { ...base.qualities, ...flags, [CAREER_RANK_KEY]: 3 } } as World;
  const r4 = { ...base, qualities: { ...base.qualities, ...flags, [CAREER_RANK_KEY]: 4 } } as World;
  assert.ok(poachChanceNow(r4) < poachChanceNow(r3), "年景「她抢客更狠」在第 4 级以后劲道更小");
  assert.ok(startSamplesNow(r4) > startSamplesNow(r3), "年景「小样管得严」在第 4 级以后少扣得少");
  // 硬推扣的是台账，是负数 —— 扣得轻就是数更大。
  assert.ok(hardSellComplianceNow(r4) > hardSellComplianceNow(r3), "年景「查得严」在第 4 级以后扣得轻");
});

test("第 4 级：每年考的是守住这个位置 —— 过了接着走，没过被换掉", () => {
  const r4 = atRank4("branch-audit");
  const strong = { ...r4, standing: 95, compliance: 90, opinion: { suman: 60 }, qualities: { ...r4.qualities, "career:wins": 4 } };
  const ok = careerAudit(strong);
  assert.equal(ok.next, null, "第 4 级没有下一级");
  assert.equal(ok.goal, "守住这个位置");
  assert.equal(ok.replaced, false);
  const weak = careerAudit({ ...strong, standing: 10 });
  assert.equal(weak.replaced, true, "第 4 级上没过线就是被换掉");
});

test("走完一遍：判词给出来；看完接着干，那一屏不再挡路，但「走完」还记着", () => {
  const w = chooseBranch(atRank4("branch-keep"), "own");
  const done = { ...w, qualities: { ...w.qualities, [CAREER_DONE_KEY]: 1 } };
  assert.ok(careerEndingOf(done), "走完了一遍要有判词");
  assert.equal(careerContinued(done), false, "判词还没给玩家看");
  const kept = keepGoing(done);
  assert.equal(careerContinued(kept), true, "看过判词了 —— 那一屏不该再挡路");
  assert.equal(careerDone(kept), true, "「走完」这件事本身还记着 —— 档案里要看得见");
  assert.ok(careerEndingOf(kept), "判词还在");
});

test("职业终局有两种收法：被换掉与走完，各给一句不一样的话", () => {
  const own = chooseBranch(atRank4("branch-end"), "own");
  assert.equal(careerEndingOf(own), null, "还没收场");
  const replaced = { ...own, qualities: { ...own.qualities, [CAREER_ENDED_KEY]: 1 } };
  const done = { ...own, qualities: { ...own.qualities, [CAREER_DONE_KEY]: 1 } };
  const a = careerEndingOf(replaced), b = careerEndingOf(done);
  assert.ok(a && b, "两种收法都要有判词");
  assert.notEqual(a!.id, b!.id);
  assert.notEqual(a!.title, b!.title);
  assert.ok(a!.body.length > 10 && b!.body.length > 10, "判词不能只是一句标题");
  // 三条分支各有一句自己的收场话。
  const ids = new Set<string>();
  for (const id of BRANCH_IDS) {
    const w = chooseBranch(atRank4(`branch-end-${id}`), id);
    const e = careerEndingOf({ ...w, qualities: { ...w.qualities, [CAREER_ENDED_KEY]: 1 } });
    assert.ok(e, `${id} 没有被换掉时的判词`);
    ids.add(e!.id);
  }
  assert.equal(ids.size, BRANCH_IDS.length, "三条分支的收场话不能重样");
});

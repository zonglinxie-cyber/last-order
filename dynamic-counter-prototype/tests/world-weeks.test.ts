// 「本周规矩」：一季四周，周一早会罗曼念一句，那一条落进 `week:<id>`，周日打烊清掉（提案 §3，表在 weeks.ts）。
// 这一条要钉的三件事：① 轮转本身（哪一周轮到哪条、四季不重抄同一张课表、开局那一周不是扣劲的那条）；
// ② 每条规矩真的动到它自己那颗旋钮（行为级：给的精力、扣的台账、抢不抢人、加微信要不要劲、委托权重）；
// ③ 生命周期：周一落、周内不变、周日清、换季不带（`week:` 不在 CARRIED_QUALITY 里）。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ENERGY_PER_DAY, ENERGY_PER_SLOT, HARD_SELL_COMPLIANCE, VERB_ENERGY, ambient, availableVerbs, beginSlot,
  endDay, energyCeiling, energySlotOf, hardSellComplianceNow, newWorld, nextSeason, poachChanceNow,
  resolveServe, verbEnergyNow,
} from "../src/world/engine.ts";
import {
  WEEK_COUNT, WEEK_IDS, WEEK_RULES, cleanWeightOf, energyPerSlotOf, hardSellComplianceOf, isMonday, isSunday,
  poachMaxOpinionOf, weekKey, weekNow, weekNoOf, weekRuleOf, weekWordOf, wechatEnergyOf,
} from "../src/world/weeks.ts";
import { openDay } from "../src/world/requests.ts";
import { SHELF_IDS, fitOfPerson, shelfFitTier } from "../src/world/shelf.ts";
import { SEASON_DAYS } from "../src/world/types.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { World } from "../src/world/types.ts";

const withWeek = (w: World, id: string | null): World => {
  const qualities = { ...w.qualities };
  for (const x of WEEK_IDS) delete qualities[weekKey(x)];
  if (id) qualities[weekKey(id as (typeof WEEK_IDS)[number])] = 1;
  return { ...w, qualities };
};
/** 摆在"这周中途"的一副盘：不是周一，beginSlot 不会重落规矩，才能单独测某一条的效果。 */
const midweek = (id: string | null, patch: Partial<World> = {}): World =>
  withWeek({ ...newWorld(`week-${id ?? "none"}`, PEOPLE), day: 3, slot: 1, energy: ENERGY_PER_DAY, ...patch }, id);

test("轮转：一季四周各一条、四季不重抄同一张课表、第 1 季开局那周是不要劲的那条", () => {
  assert.equal(SEASON_DAYS, 7 * 4, "一季不是 28 天的话，四周这套排布要跟着改");
  for (const season of [1, 2, 3, 4, 5]) {
    const seen = [1, 8, 15, 22].map(day => weekRuleOf(season, day));
    assert.equal(new Set(seen).size, WEEK_COUNT, `第 ${season} 季这四周没把四条走满：${seen.join("/")}`);
  }
  // 起点：第 1 季第 1 周是会员日周。开局那七天是新手期，第一条就该是"多留几位"的正向变化，
  // 不是"每格少 5 点劲"——把 +3 那个起点挪掉，红的就是这一句。
  assert.equal(weekRuleOf(1, 1), "member-day");
  assert.equal(weekRuleOf(1, 8), "training", "第 1 季第 2 周才轮到扣劲的培训周");
  assert.equal(weekRuleOf(1, 15), "patrol");
  assert.equal(weekRuleOf(1, 22), "rival-off");
  assert.notEqual(weekRuleOf(2, 1), weekRuleOf(1, 1), "换季以后第 1 周还是同一条：四季在重抄同一张课表");
  for (const [day, no] of [[1, 1], [7, 1], [8, 2], [14, 2], [15, 3], [21, 3], [22, 4], [28, 4]] as const)
    assert.equal(weekNoOf(day), no, `第 ${day} 天不是第 ${no} 周`);
  for (const [day, m, s] of [[1, true, false], [7, false, true], [8, true, false], [28, false, true]] as const) {
    assert.equal(isMonday(day), m, `第 ${day} 天的"周一"判错`);
    assert.equal(isSunday(day), s, `第 ${day} 天的"周日"判错`);
  }
});

test("早会与打烊：周一念一句并落上那一条，周内不再改，周日清掉，下一周换下一条", () => {
  const start = { ...newWorld("week-life", PEOPLE), day: 1, slot: 0 };
  const monday = beginSlot(start, PEOPLE);
  assert.equal(weekNow(monday.qualities), "member-day", "第 1 季第 1 天上午没落上该轮到的那条");
  assert.ok(monday.log.some(l => l.text.includes("这周会员日")), `周一早会那句没念出来：${monday.log.map(l => l.text).join(" | ")}`);
  const tuesday = beginSlot({ ...monday, day: 2, slot: 0 }, PEOPLE);
  assert.equal(weekNow(tuesday.qualities), "member-day", "非周一不该重新落一条（一周只念一次）");
  assert.equal(tuesday.log.filter(l => l.text.includes("这周会员日")).length, 1, "同一句早会在一周里念了两遍");
  const sunday = endDay({ ...tuesday, day: 7, slot: 3 }, PEOPLE);
  assert.equal(weekNow(sunday.qualities), null, "周日打烊没把这一周的规矩清掉");
  const nextMonday = beginSlot({ ...sunday, day: 8, slot: 0 }, PEOPLE);
  assert.equal(weekNow(nextMonday.qualities), "training", "第二周没换下一条");
  // 换季不带：下一季第 1 周重新落一条，不是把上一季最后那条留着
  const carried = nextSeason({ ...sunday, day: 28, slot: 3 }, PEOPLE);
  assert.equal(Object.keys(carried.qualities).filter(k => k.startsWith("week:")).length, 0,
    "`week:` 被跨季带走了：下一季第 1 周该重新落一条，而带走的键还会让档案越攒越多");
});

test("品牌培训周：每一格少 5 点劲，天花板跟着降", () => {
  assert.equal(energyPerSlotOf({ [weekKey("training")]: 1 }, ENERGY_PER_SLOT), ENERGY_PER_SLOT - 5);
  assert.equal(energySlotOf(midweek("training")), 15);
  assert.equal(energyCeiling(3, energySlotOf(midweek("training"))), 60, "四个格子都少 5 点，一天满打满算 60");
  assert.equal(energyCeiling(3), ENERGY_PER_SLOT * 4, "没落规矩那一周还是原来的上限（一格 20 × 四格 = 80，不是 100 —— 我第一版把这个数写错了）");
  assert.ok(energyCeiling(3) < ENERGY_PER_DAY, "按格发的上限本来就到不了 100，这条要说清楚");
  const got = beginSlot(withWeek({ ...newWorld("week-e", PEOPLE), day: 3, slot: 0, energy: 0 }, "training"), PEOPLE);
  assert.equal(got.energy, ENERGY_PER_SLOT - 5, "开一格实际发到手的不止要少 5，还要少得刚好是 5");
});

test("商场巡查周：硬推那一下台账翻倍扣，方敏那张委托也更常来", () => {
  assert.equal(hardSellComplianceOf({ [weekKey("patrol")]: 1 }, HARD_SELL_COMPLIANCE), HARD_SELL_COMPLIANCE * 2);
  // 找一个真的会走"硬推"那条路的人与货：先探出来，再拿两副只差规矩的盘对比扣分。
  const trial = PEOPLE.filter(p => p.skin).flatMap(p => SHELF_IDS.map(id => ({ p, id })));
  const hit = trial.find(({ p, id }) => {
    const before = withWeek(midweek(null, { present: { [p.id]: "counter" } }), null);
    const after = resolveServe(before, PEOPLE, p.id, id, 4, true);
    return after.compliance - before.compliance === HARD_SELL_COMPLIANCE;
  });
  assert.ok(hit, "没有一对(人, 货)走出硬推那一档，这条断言量不到东西 —— 换夹具别换口径");
  const plain = resolveServe({ ...midweek(null), present: { [hit!.p.id]: "counter" } }, PEOPLE, hit!.p.id, hit!.id, 4, true);
  const patrolled = resolveServe({ ...midweek("patrol"), present: { [hit!.p.id]: "counter" } }, PEOPLE, hit!.p.id, hit!.id, 4, true);
  assert.equal(hardSellComplianceNow(midweek("patrol")), HARD_SELL_COMPLIANCE * 2);
  const plainDrop = plain.compliance - midweek(null).compliance;
  const patrolDrop = patrolled.compliance - midweek("patrol").compliance;
  assert.equal(patrolDrop, plainDrop * 2, `巡查周该把这一笔翻倍：平时 ${plainDrop}，巡查周 ${patrolDrop}`);
  // 委托权重：巡查周方敏那张 2 → 4
  assert.equal(cleanWeightOf({ [weekKey("patrol")]: 1 }, 2), 4);
  assert.equal(cleanWeightOf({}, 2), 2);
  // 行为级：同一批种子，巡查周开出的委托里"今天别硬推"出现得更多
  const rate = (id: string | null): number => {
    let hits = 0;
    // 一天开两颗委托（REQUESTS_PER_DAY），在场的人要把六个模板都喂合格 ——
    // 只有两三个人在场时哪条都被抽中，权重翻倍这件事量不出来（本轮第一版就是这么 40≤40 的）。
    for (let i = 0; i < 120; i++) {
      const base = withWeek({ ...newWorld(`clean-${i}`, PEOPLE), day: 4, slot: 0, energy: 0,
        opinion: { shen: 30, suman: 30, tangke: 30, mei: 30 },
        qualities: { "wechat:shen": 1 },
        present: { fangmin: "backroom", roman: "counter", suman: "counter", tangke: "cashier", mei: "counter", shen: "counter", zhou: "counter" } }, id);
      const w = openDay(base, PEOPLE);
      if (w.requests.some(r => r.kind === "clean")) hits++;
    }
    return hits;
  };
  const plainHits = rate(null);
  const patrolHits = rate("patrol");
  assert.ok(plainHits > 0 && plainHits < 120, `对照那一格要么从不出现(${plainHits})要么总出现(${plainHits})，权重这条量不出来`);
  assert.ok(patrolHits > plainHits, `巡查周方敏那张没多出（${patrolHits} ≤ ${plainHits}）—— 权重接上了但没接进抽委托那一步`);
});

test("对面休假周：她只带走本来就不想待着的那几位，门槛从 40 收到 20", () => {
  assert.equal(poachMaxOpinionOf({ [weekKey("rival-off")]: 1 }, 40), 20, "休假周没收门槛");
  assert.equal(poachMaxOpinionOf({}, 40), 40, "没落这一条时门槛不许动");
  // 看法 30：平时在她射程内，休假周不在；看法 10：两周都在（不是免疫周）
  const poached = (id: string | null, opinion: number, heat: string[] = []): number => {
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const w = ambient(withWeek({ ...newWorld(`poach-${i}`, PEOPLE), day: 3, present: { shen: "counter", luyao: "rival" }, opinion: { shen: opinion }, heat }, id), PEOPLE);
      if (w.present.shen === "rival") n++;
    }
    return n;
  };
  assert.ok(poached(null, 30) > 0, "对照那一格就没抢到（看法 30、门槛 40），概率或在场判定坏了，这条量不出来");
  assert.equal(poached("rival-off", 30), 0, "休假周还把她请走，那句「只带走本来就想走的」就是假话");
  const plainLow = poached(null, 10);
  assert.ok(poached("rival-off", 10) >= plainLow * 0.6, `看法 10 的人在休假周被抹掉了（${plainLow} → ${poached("rival-off", 10)}）—— 这一条不是清零周，收的是门槛`);
  assert.ok(poachChanceNow(midweek("rival-off")) > 0, "概率照旧（只有门槛动）");
  assert.ok(poachChanceNow(midweek(null)) < poachChanceNow({ ...midweek(null), heat: ["luyao-hungry"] }), "加难那一档还在（两条机制各管一件事）");
});

test("会员日周：加微信不要精力，一天能多留几位", () => {
  assert.equal(wechatEnergyOf({ [weekKey("member-day")]: 1 }, VERB_ENERGY.wechat), 0);
  // 精力只剩 3 点：平时买不起「加微信」，会员日买得起（它是 0 点）
  const low = { ...midweek(null), energy: 3, present: { shen: "counter" }, opinion: { shen: 40 } };
  assert.ok(!availableVerbs(low, PEOPLE, ["shen"]).includes("wechat"), "对照那一格本来就该要 4 点");
  assert.ok(availableVerbs({ ...low, qualities: { [weekKey("member-day")]: 1 } }, PEOPLE, ["shen"]).includes("wechat"),
    "会员日还收 4 点精力，那句「不花精力」就是假话");
  const spent = beginSlot(withWeek({ ...newWorld("week-w", PEOPLE), day: 3, slot: 0, energy: 3 }, "member-day"), PEOPLE);
  assert.equal(verbEnergyNow(midweek("member-day"), "wechat"), 0);
  assert.equal(verbEnergyNow(midweek(null), "greet"), VERB_ENERGY.greet, "别的花费不该被牵连");
  assert.equal(spent.energy, Math.min(ENERGY_PER_DAY, 3 + ENERGY_PER_SLOT), "会员日不动的是花费，不是发给你的格子");
});

test("规矩互不牵连：没落上的那几条一处都不生效", () => {
  // 一条落上时，另外三颗旋钮必须还在原位 —— 否则"这周是会员日"会顺手把硬推也变严。
  const w = midweek("member-day");
  assert.equal(energySlotOf(w), ENERGY_PER_SLOT);
  assert.equal(hardSellComplianceNow(w), HARD_SELL_COMPLIANCE);
  assert.ok(poachChanceNow(w) > 0);
  const t = midweek("training");
  assert.equal(hardSellComplianceNow(t), HARD_SELL_COMPLIANCE);
  assert.equal(verbEnergyNow(t, "wechat"), VERB_ENERGY.wechat);
});

test("表自己是完整的：每条有话可念、id 认得、界面念得出，而且引擎或委托真读它", () => {
  assert.equal(WEEK_RULES.length, WEEK_COUNT);
  assert.equal(new Set(WEEK_IDS).size, WEEK_IDS.length, "规矩 id 重了：qualities 上会互相盖住");
  for (const rule of WEEK_RULES) {
    assert.ok(rule.word.endsWith("周"), `「${rule.word}」没带"周"字，顶栏那句读起来不像一段时间`);
    assert.ok(rule.line.includes("早会罗曼"), `${rule.id} 那句不是早会念的`);
    assert.ok(rule.note.length >= 18, `${rule.id} 的说明太短`);
    assert.equal(/[A-Za-z]{2,}/.test(rule.word + rule.line + rule.note), false, `${rule.id} 的文案里混进英文`);
    // id 字面量只出现在 weeks.ts 的分支里（引擎读的是包装函数），所以这条查两段：
    // ① weeks.ts 里有一条认这个 id 的分支；② 表上点名的那颗旋钮包装函数真被 engine 或委托调用。
    const weeks = readFileSync(new URL("../src/world/weeks.ts", import.meta.url), "utf8");
    assert.ok(weeks.includes(`"${rule.id}"`), `${rule.id} 在 weeks.ts 里没有分支：这一条规矩是空表`);
    const callSites = [readFileSync(new URL("../src/world/engine.ts", import.meta.url), "utf8"),
      readFileSync(new URL("../src/world/requests.ts", import.meta.url), "utf8")];
    assert.ok(rule.knobs.length >= 1, `${rule.id} 没写它动哪颗旋钮（knobs）`);
    for (const knob of rule.knobs)
      assert.ok(callSites.some(text => text.includes(`${knob}(`)),
        `${rule.id} 的旋钮 ${knob} 在引擎与委托里都没有调用点：表上加了话，数却没动`);
    assert.ok(weekWordOf({ [weekKey(rule.id)]: 1 }).length > 0, `${rule.id} 顶栏念不出来`);
  }
});

// 「自选加难」：开新一季前勾 0~5 条规矩，每条只动一颗已有的旋钮（提案 §6，表在 src/world/heat.ts）。
// 这一条钉三件事：① 一条都不勾时每一个数与加这一刀以前逐字节相同（不然"自选"就变成了强制）；
// ② 每条规矩各自在**行为**上咬住那颗旋钮（不是读源码看有没有出现那个名字）；
// ③ 存档与跨季档案两头接得住：旧档缺字段按空读、坏值整份丢、章只升不降。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  COMPLIANCE_COLD_START, POACH_CHANCE, POACH_CHANCE_HEATED, SAMPLES_PER_NIGHT, START_COMPLIANCE, START_SAMPLES,
  ambient, availableVerbs, endDay, newWorld, nextSeason, nightlySamplesOf, parseWorld, poachChanceOf,
  startComplianceOf, startSamplesOf, wechatAllowed,
} from "../src/world/engine.ts";
import { HEAT_IDS, HEAT_MAX, HEAT_RULES, isHeatId, type HeatId } from "../src/world/heat.ts";
import type { World } from "../src/world/types.ts";
import { QUOTA_MIN, QUOTA_TOP, quotaTargetOf } from "../src/world/requests.ts";
import { emptyWorldProgress, observeWorldProgress, parseWorldProgress } from "../src/world/progress.ts";
import { ENDINGS } from "../src/world/ending.ts";
import { PEOPLE } from "../src/world/content/index.ts";

const allHeat: HeatId[] = [...HEAT_IDS];
const at = (patch: Partial<World>): World => ({ ...newWorld("heat", PEOPLE), ...patch } as World);

test("一条都不勾 = 加这一刀以前的柜上：每一颗旋钮回到原来的数", () => {
  assert.equal(startSamplesOf(), START_SAMPLES, "空档（连参数都不给，旧调用就这样）起手小样不该变");
  assert.equal(startSamplesOf([]), START_SAMPLES);
  assert.equal(nightlySamplesOf([]), SAMPLES_PER_NIGHT, "每晚补的那一档也不该动");
  assert.equal(startComplianceOf([]), START_COMPLIANCE);
  assert.equal(poachChanceOf([]), POACH_CHANCE);
  assert.equal(wechatAllowed([]), true, "没勾「不许加微信」时那一下照样要放出来");
  const plain = newWorld("plain", PEOPLE);
  assert.equal(plain.samples, START_SAMPLES);
  assert.equal(plain.compliance, START_COMPLIANCE);
  assert.deepEqual(plain.statsAtSeasonStart, { standing: plain.standing, compliance: START_COMPLIANCE });
  assert.deepEqual(plain.heat, [], "没勾也要把这一格落成空数组：界面与存档只认一个形状");
  // 委托那边的阶梯：第 1 天与第 15 天各回到以前那个数
  assert.equal(quotaTargetOf(at({ day: 1, heat: [] })), QUOTA_MIN);
  assert.equal(quotaTargetOf(at({ day: 15, heat: [] })), QUOTA_TOP);
  // 换季那条折回基线也是原数
  const folded = nextSeason(at({ standing: 80, compliance: 80, heat: [] }), PEOPLE);
  assert.equal(folded.compliance, Math.round(START_COMPLIANCE + (80 - START_COMPLIANCE) / 2));
});

test("小样减半：起手与换季那一次各少一半，每晚补的也减半", () => {
  const heat: HeatId[] = ["thin-samples"];
  assert.equal(startSamplesOf(heat), START_SAMPLES / 2);
  assert.equal(nightlySamplesOf(heat), SAMPLES_PER_NIGHT / 2);
  assert.equal(newWorld("h", PEOPLE, heat).samples, 4, "起手就该是 4 支");
  // 换季那一次发小样也照档位走：先勾着玩到第 2 季，看开局手里几支
  assert.equal(nextSeason(at({ heat }), PEOPLE).samples, 4);
  // 行为级：走一遍"打烊过夜"，补的小样真的按档位减半（H8' 就是把这一处忘了接，光测 helper 量不到）
  const overnight = (heat: HeatId[]): number => {
    const w = endDay({ ...newWorld(`h-night-${heat.join("-")}`, PEOPLE, heat), day: 3, samples: 0, present: {}, energy: 0 }, PEOPLE);
    return w.samples;
  };
  assert.equal(overnight(["thin-samples"]), SAMPLES_PER_NIGHT / 2, "打烊补的那一半也要照档位走");
  assert.equal(overnight([]), SAMPLES_PER_NIGHT, "没勾时每晚照旧补四支");
  // 没勾的另一条规矩不该被牵连
  assert.equal(newWorld("h2", PEOPLE, ["no-wechat"]).samples, START_SAMPLES);
});

test("台账起点低一截：开局、季初快照、换季折回三处都读同一颗基线", () => {
  const heat: HeatId[] = ["cold-ledger"];
  const w = newWorld("h", PEOPLE, heat);
  assert.equal(w.compliance, COMPLIANCE_COLD_START);
  assert.equal(w.statsAtSeasonStart?.compliance, COMPLIANCE_COLD_START, "季初快照要跟着基线走，不然季末那句「比开季」算错");
  // 折回的是"低的那条基线 + 高出的一半"，不是原基线
  assert.equal(nextSeason(at({ compliance: 80, heat }), PEOPLE).compliance,
    Math.round(COMPLIANCE_COLD_START + (80 - COMPLIANCE_COLD_START) / 2));
});

test("罗曼多要一件：整把阶梯上移一格，封顶也跟着上", () => {
  const heat: HeatId[] = ["roman-tough"];
  assert.equal(quotaTargetOf(at({ day: 1, heat })), QUOTA_MIN + 1, "季初就该多要一件");
  assert.equal(quotaTargetOf(at({ day: 14, heat })), QUOTA_MIN + 1);
  assert.equal(quotaTargetOf(at({ day: 15, heat })), QUOTA_TOP + 1, "封顶那格也要跟着上移");
  assert.equal(quotaTargetOf(at({ day: 28, heat })), QUOTA_TOP + 1, "不许超过封顶");
  // 阶梯形状本身还在（上移不等于把台阶抹平）
  assert.ok(quotaTargetOf(at({ day: 1, heat })) < quotaTargetOf(at({ day: 15, heat })),
    "上移以后第 15 天那一格还在往上拧");
});

test("陆遥更狠：同一批种子里勾过的截走得多，没勾的仍照原来的概率", () => {
  assert.equal(poachChanceOf(["luyao-hungry"]), POACH_CHANCE_HEATED);
  assert.ok(POACH_CHANCE_HEATED > POACH_CHANCE, "「更狠」必须真的更高，否则这条规矩是空话");
  const poached = (heat: HeatId[]): number => {
    let n = 0;
    for (let i = 1; i <= 60; i++) {
      const w = ambient({ ...newWorld(`h-poach-${i}`, PEOPLE), present: { shen: "counter", luyao: "rival" }, opinion: { shen: -10 }, heat }, PEOPLE);
      if (w.present.shen === "rival") n++;
    }
    return n;
  };
  const plain = poached([]);
  const heated = poached(["luyao-hungry"]);
  assert.ok(plain > 0, `空档 60 个种子一次都没截走，这条量不出来（概率或在场判定坏了）`);
  assert.ok(heated > plain, `勾了「陆遥更狠」反而截得少（${heated} ≤ ${plain}）—— 那颗旋钮没接到抢客那一步`);
});

test("不许加微信：那一下整个不放，别的动作照旧点得下去", () => {
  assert.equal(wechatAllowed(["no-wechat"]), false);
  const base = { ...newWorld("h-wechat", PEOPLE), day: 6, slot: 1, energy: 100, samples: START_SAMPLES,
    present: { shen: "counter" as const }, opinion: { shen: 40 } };
  const plain = availableVerbs(base, PEOPLE, ["shen"]);
  assert.ok(plain.includes("wechat"), "夹具本身要能放出加微信，否则这条断言量不到东西");
  const blocked = availableVerbs({ ...base, heat: ["no-wechat"] }, PEOPLE, ["shen"]);
  assert.ok(!blocked.includes("wechat"), "勾了「不许加微信」还放出来，那条规矩就是假话");
  // 勾满五条不许把柜台变成死局：招呼 / 送小样 / 接待 至少还得点得动
  assert.ok(blocked.length >= 2 && blocked.includes("greet"), "加难以后桌上必须还有事可做");
  assert.ok(availableVerbs({ ...base, heat: allHeat }, PEOPLE, ["shen"]).includes("greet"),
    "五条全开也不能一个动作都不给 —— 加难是难度，不是卡死");
});

test("heat 跨季带着走，季末那一屏改勾了就照新的开下一季", () => {
  const w = at({ heat: ["thin-samples", "cold-ledger"] });
  const carried = nextSeason(w, PEOPLE);
  assert.deepEqual(carried.heat, ["thin-samples", "cold-ledger"], "勾过的规矩要一整季一季连着算，换季不该悄悄松开");
  const raised = nextSeason(w, PEOPLE, [...allHeat]);
  assert.equal(raised.heat?.length, HEAT_MAX, "界面在季末那一屏改勾，下一季要照改过的开");
  assert.equal(raised.samples, startSamplesOf(raised.heat), "换季那一次的发小样要读**新季**的档位，不是上一季的");
  assert.deepEqual(nextSeason(at({ heat: [] }), PEOPLE).heat, []);
});

test("存档两头：旧档没有这一格按空读，坏值整份丢", () => {
  const fresh = newWorld("h-save", PEOPLE, ["roman-tough"]);
  const back = parseWorld(JSON.stringify({ version: 1, world: fresh }))!;
  assert.deepEqual(back.heat, ["roman-tough"], "勾过的规矩刷新前后要一样，否则中途换档就悄悄降难度");
  const old = { ...JSON.parse(JSON.stringify({ version: 1, world: fresh })) };
  delete (old as { world: Record<string, unknown> }).world.heat;
  assert.deepEqual(parseWorld(JSON.stringify(old))?.heat, [], "加这一刀以前的档：缺字段按一条都没勾读，不为它丢整份存档");
  for (const bad of [["no-such-rule"], ["thin-samples", "thin-samples"], "thin-samples", [7]]) {
    const broken = JSON.parse(JSON.stringify({ version: 1, world: fresh }));
    broken.world.heat = bad;
    assert.equal(parseWorld(JSON.stringify(broken)), null, `heat = ${JSON.stringify(bad)} 该整份丢，不该读成一个说不清的档位`);
  }
});

test("档案里的章按最难那一次盖：只升不降，旧档案缺这一格按空读", () => {
  const id = ENDINGS[ENDINGS.length - 1].id;
  const heatWorld = (n: number) => at({ heat: allHeat.slice(0, n) });
  let p = observeWorldProgress(emptyWorldProgress(), heatWorld(0), id);
  assert.equal(p.endingsAtHeat[id], 0, "一条都没勾也要落一枚 0 的章，界面才知道这一句是在平时拿到的");
  p = observeWorldProgress(p, heatWorld(3), id);
  assert.equal(p.endingsAtHeat[id], 3);
  p = observeWorldProgress(p, heatWorld(1), id);
  assert.equal(p.endingsAtHeat[id], 3, "勾 1 条再拿到不该把章退回 1 —— 档案记的是最难那一次");
  const round = parseWorldProgress(JSON.stringify(p))!;
  assert.equal(round.endingsAtHeat[id], 3);
  const old = JSON.parse(JSON.stringify(p));
  delete old.endingsAtHeat;
  assert.deepEqual(parseWorldProgress(JSON.stringify(old))?.endingsAtHeat, {}, "这一刀以前的档案缺这一格：按空读，别丢整份图鉴");
  for (const bad of [{ [id]: 99 }, { "not-an-ending": 1 }, { [id]: 1.5 }, "x"]) {
    const broken = JSON.parse(JSON.stringify(p));
    broken.endingsAtHeat = bad;
    assert.equal(parseWorldProgress(JSON.stringify(broken)), null, `endingsAtHeat = ${JSON.stringify(bad)} 该整份丢`);
  }
});

test("规矩表自己是完整的：每条都有话可念、id 认得，而且引擎或委托真读它", () => {
  // 加一张表却忘了接旋钮，是这一刀最容易出的错 —— 这条守卫只看"接上没有"，不点名是谁的旋钮。
  assert.equal(HEAT_RULES.length, HEAT_MAX);
  assert.equal(new Set(HEAT_IDS).size, HEAT_IDS.length, "规矩 id 重了：勾选会互相吃掉");
  const src = [
    ["engine.ts", readFileSync(new URL("../src/world/engine.ts", import.meta.url), "utf8")],
    ["requests.ts", readFileSync(new URL("../src/world/requests.ts", import.meta.url), "utf8")],
  ] as const;
  for (const rule of HEAT_RULES) {
    assert.ok(isHeatId(rule.id), `${rule.id} 不在校验认得的名单里`);
    assert.ok(rule.word.length >= 2 && rule.word.length <= 6, `「${rule.word}」太长，手机上一排放不下`);
    assert.ok(rule.note.length >= 20, `${rule.id} 的说明太短，玩家看不出这条改了什么`);
    assert.equal(/[A-Za-z]{2,}/.test(rule.word + rule.note), false, `${rule.id} 的文案里混进英文`);
    // 这条只保证"接上了"（≥1 个读数点），不保证"只接了一处"：小样那颗本来就有起手与每晚两处读，
    // 数==1 的写法在没变异的源码上就红了（本轮自己踩的，见设计文档"假红"那段）。
    // "两处各说各话"（一处读档位、一处忘了）不归这条管，归上面那几条**行为**断言管 —— H2' 就是这么抓到的。
    const reads = src.reduce((n, [, text]) => n + text.split(`"${rule.id}"`).length - 1, 0);
    assert.ok(reads >= 1, `${rule.id} 一处都没被读到 —— 加了表却没接旋钮，勾了等于没勾`);
  }
  // 表里每条都能被界面单独勾出来（勾选互不干扰）
  for (const id of HEAT_IDS) {
    const w = newWorld("h-one", PEOPLE, [id]);
    assert.deepEqual(w.heat, [id]);
    assert.ok(parseWorld(JSON.stringify({ version: 1, world: w }))?.heat.includes(id), `${id} 存不进档`);
  }
});

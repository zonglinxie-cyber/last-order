import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availableVerbs, beginServe, doVerb, handoffDayKey, handoffSaleDayKey, newWorld,
  resolveServe, rivalGuarded, serializeWorld, settleServe,
} from "../src/world/engine.ts";
import { handoffPreview } from "../src/world/handoff.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { SHELF, bestShelf } from "../src/world/shelf.ts";
import { soldUnitsKey } from "../src/world/requests.ts";
import { visitPerson } from "../src/world/visits.ts";
import type { World } from "../src/world/types.ts";

// 苏蔓(同事) + 安姐(客人)：第 7 天、精力 20、看法 16/10、已知 client-note:anjie:soothe，
// 托单加 4 后正好过代卖门槛 20。负责人在旧 HEAD 实测的决策场景，这里复现两种选择的真实取舍。
const bench = (): World => ({ ...newWorld("handoff-choice", PEOPLE), day: 7, slot: 1 as const, energy: 20,
  present: { suman: "counter", roman: "counter", anjie: "counter", mei: "cashier" },
  opinion: { suman: 16, roman: 30, anjie: 10, mei: 0 },
  qualities: { "client-note:anjie:soothe": 1, "client-note:mei:soothe": 1 } });
const anjie = PEOPLE.find(p => p.id === "anjie")!;
const unit = SHELF[bestShelf(visitPerson(bench(), anjie))].price; // 一支 2280

test("默认托单沿用旧自动行为：省略参数与 sell 逐位相同，且确实代卖一支", () => {
  const base = bench();
  const implicit = doVerb(base, PEOPLE, "handoff", ["suman", "anjie"]);
  const explicit = doVerb(base, PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "sell" });
  assert.equal(serializeWorld(implicit), serializeWorld(explicit), "省略参数=旧自动行为=显式 sell");
  assert.equal(implicit.money - base.money, unit, "门槛达标且已知需求时按旧逻辑代卖一支");
  assert.equal(implicit.energy, base.energy - 6, "托单花的是现有的 6 精力");
  assert.equal(implicit.qualities[handoffSaleDayKey(7)], 1, "全柜当日代卖名额记上");
  assert.equal(implicit.qualities[`bought:anjie`], 7, "代卖盖上 bought 触发购买间隔");
});

test("只照看：不代卖、不写任何成交账，留本人亲自接多件的机会", () => {
  const base = bench();
  const watched = doVerb(base, PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "watch" });
  assert.equal(watched.money, base.money, "watch 不进账");
  assert.equal(watched.qualities[`bought:anjie`], undefined, "watch 不写 bought");
  assert.equal(watched.qualities[handoffSaleDayKey(7)], undefined, "watch 不占全柜代卖名额");
  assert.equal(watched.qualities[soldUnitsKey(7)] ?? 0, base.qualities[soldUnitsKey(7)] ?? 0, "watch 不记 soldUnits");
  assert.equal(watched.energy, base.energy - 6, "watch 照旧花 6 精力");
  assert.equal(watched.qualities[handoffDayKey(7, "suman")], 1, "watch 也占同事当天照看名额");
  assert.match(watched.log.at(-1)!.text, /照看只守当口|下个时段/, "watch 日志点明照看只作用当前时段");
});

test("watch 之后亲自开 3 支成交（对照默认托单被冷却挡住）", () => {
  // watch 路径：6 精力只照看 → 亲自开 3 支 6840，余 2 精力。
  let w = doVerb(bench(), PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "watch" });
  w = resolveServe(w, PEOPLE, "anjie", bestShelf(visitPerson(w, anjie)), 3, false);
  assert.equal(w.money - bench().money, 3 * unit, "watch 保住亲自多件成交");
  assert.equal(w.energy, 2, "6（照看）+12（接待）后余 2 精力");
  // 对照：默认托单先代卖一支并盖冷却，之后亲自开 3 支不再成交，仍只有一支。
  let d = doVerb(bench(), PEOPLE, "handoff", ["suman", "anjie"]);
  const m = d.money;
  d = resolveServe(d, PEOPLE, "anjie", bestShelf(visitPerson(d, anjie)), 3, false);
  assert.equal(d.money - m, 0, "代卖后购买间隔挡住亲自再成交，取舍是真的");
});

test("含已付 12 精力的接待草稿：watch 不清草稿、开单时不重复收费", () => {
  // 先花 12 精力开接待草稿（beginServe），再只照看，最后 settleServe 结账不再扣。
  let w = beginServe(bench(), PEOPLE, "anjie");
  assert.equal(w.energy, bench().energy - 12, "beginServe 花 12");
  const energyAfterBegin = w.energy;
  w = doVerb(w, PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "watch" });
  assert.equal(w.energy, energyAfterBegin - 6, "watch 只额外花 6，不动已付的接待");
  assert.equal(w.touched.includes("anjie"), true, "已接手的草稿仍在");
  const settled = settleServe(w, PEOPLE, "anjie", bestShelf(visitPerson(w, anjie)), 3, false);
  assert.equal(settled.money - bench().money, 3 * unit, "草稿仍能亲自开 3 支结账");
  assert.equal(settled.energy, w.energy, "settleServe 不重复扣接待精力");
});

test("sell 守全柜一天一笔与同事每天一客：第二单照看不再自动成交", () => {
  const sold = doVerb(bench(), PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "sell" });
  assert.equal(sold.money - bench().money, unit, "第一单 sell 代卖一支");
  // 同一同事当天名额已用：换客人也不能再托，doVerb 原样返回、不扣费。
  const againSameStaff = doVerb(sold, PEOPLE, "handoff", ["suman", "mei"], { handoffMode: "watch" });
  assert.equal(againSameStaff, sold, "同事当天已照看一客，第二次托不动、不扣费");
  // 换同事（roman 照看 mei）：可以托，但全柜代卖名额已被第一单占用，只照看不再开第二笔。
  assert.ok(availableVerbs(sold, PEOPLE, ["roman", "mei"]).includes("handoff"), "不能把没托过人的同事一起锁掉");
  const second = doVerb(sold, PEOPLE, "handoff", ["roman", "mei"], { handoffMode: "sell" });
  assert.equal(second.money, sold.money, "sell 沿用全柜每天一笔限制，不凭空多开自动单");
  assert.equal(second.qualities[handoffDayKey(7, "roman")], 1, "第二位同事的照看名额照常消耗");
});

test("sell 不凭空保证成交：门槛不够或没问出需求时只花精力照看", () => {
  // 同事看法太低（托单后仍 < 20），sell 也不开单。
  const lowTrust = { ...bench(), opinion: { ...bench().opinion, suman: 5 } };
  const low = doVerb(lowTrust, PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "sell" });
  assert.equal(low.money, lowTrust.money, "看法没到门槛，sell 不硬开单");
  assert.equal(low.energy, lowTrust.energy - 6, "照看与照旧要花的 6 精力仍扣掉");
  // 已知需求这条不满足（没问出、也没卖过），sell 不开单。
  const noNeed = { ...bench(), qualities: {} };
  const nn = doVerb(noNeed, PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "sell" });
  assert.equal(nn.money, noNeed.money, "同事没信息替陌生人开单");
});

test("只照看照样守住对面邀客，比货仍要求本人对症成交", () => {
  const base: World = { ...bench(), present: { ...bench().present, luyao: "rival" },
    rivalPlan: { day: 7, slot: 1 as const, targets: ["anjie"], tactic: "invite" as const } };
  const watched = doVerb(base, PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "watch" });
  assert.ok(rivalGuarded(watched, "anjie"), "watch 的照看仍守住本时段对面邀客");
  assert.equal(watched.money, base.money, "守住不等于代卖，watch 不进账");
  // 下一时段转为比货：打招呼/开始接待/再托单都挡不住，只有本人对症成交才守得住。
  const compare: World = { ...base, slot: 2, rivalPlan: { day: 7, slot: 2, targets: ["anjie"], tactic: "compare" } };
  assert.ok(!rivalGuarded(doVerb(compare, PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "watch" }), "anjie"),
    "比货时段只托人照看守不住");
  const sold = resolveServe(compare, PEOPLE, "anjie", bestShelf(visitPerson(compare, anjie)), 1, false);
  assert.ok(rivalGuarded(sold, "anjie"), "比货要本人对症成交才守得住");
});

test("取消/过期/传错模式一律不收费", () => {
  const base = bench();
  // 无效模式在扣费前被拒。
  for (const bad of ["sell-one", "auto", "SEE", ""] as const) {
    const out = doVerb(base, PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: bad as never });
    assert.equal(out, base, `无效模式「${bad}」不应改世界`);
    assert.equal(out.energy, base.energy, `无效模式「${bad}」不应扣精力`);
  }
  // 精力不足：一格不够托这一单时不扣、不写。
  const broke = { ...base, energy: 3 };
  assert.ok(!availableVerbs(broke, PEOPLE, ["suman", "anjie"]).includes("handoff"));
  assert.equal(doVerb(broke, PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "watch" }), broke);
  // 当事人离场：stale 目标托不动、不扣费。
  const absent: World = { ...base, present: { suman: "counter" } };
  assert.ok(!availableVerbs(absent, PEOPLE, ["suman", "anjie"]).includes("handoff"));
  assert.equal(doVerb(absent, PEOPLE, "handoff", ["suman", "anjie"], { handoffMode: "watch" }), absent);
});

test("纯预览复用公开条件：门槛认托单 +4 后的值，柜台代卖名额已用仍可只照看", () => {
  const base = bench();
  const p = handoffPreview(base, PEOPLE, ["suman", "anjie"]);
  assert.equal(p.can, true);
  assert.equal(p.energyCost, 6);
  assert.equal(p.staffTrust, 16);
  assert.equal(p.staffTrustAfterHandoff, 20, "门槛要认托单动作本身 +4 后的看法");
  assert.equal(p.meetsSellThreshold, true, "20 >= 门槛 20");
  assert.equal(p.needKnown, true);
  assert.equal(p.sellOfferable, true);
  assert.equal((JSON.stringify(p).match(/密集修护|面霜|精华|2280|6840/g) ?? []).length, 0,
    "预览不泄露隐藏最优商品或金额");
  // 柜台当日代卖名额已用：仍可 watch，但 sellOfferable 变 false（sell 这次不会成交）。
  const soldOnce = doVerb(base, PEOPLE, "handoff", ["roman", "mei"], { handoffMode: "sell" });
  const p2 = handoffPreview(soldOnce, PEOPLE, ["suman", "anjie"]);
  assert.equal(p2.can, true, "全柜代卖名额用掉后仍可只托照看");
  assert.equal(p2.cabinetSaleFree, false);
  assert.equal(p2.sellOfferable, false);
  assert.ok(p2.sellNotes.some(s => s.includes("代卖过一单")), "说明这次只能照看");
  const highTrust = { ...base, opinion: { ...base.opinion, suman: 99 } };
  const before = serializeWorld(highTrust);
  assert.equal(handoffPreview(highTrust, PEOPLE, ["suman", "anjie"]).staffTrustAfterHandoff, 100,
    "预览沿用真实关系上限，不能显示103");
  assert.equal(serializeWorld(highTrust), before, "预览不能改写原世界");
});

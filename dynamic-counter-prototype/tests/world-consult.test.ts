// 柜上的接待：看 → 问 → 试 → 开单（src/world/consult.ts + engine 的 beginServe / settleServe）。
// 钉的是规则的形状：每位客人都接得了、每一下都花耐心、问出来的是真话、试出来的档位就是结账那一档，
// 以及"件数是个真选择"—— 开口超过她说过的上限要扣看法。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONSULT_PATIENCE, PUSH_QUESTION_MOOD, SECOND_TRY_HARD_MOOD, SECOND_TRY_MOOD, TRIED_MARK, askHer, consultPatience, lookAt, openConsult, plateOf, questionsOf, secondTryRisk, spotsOf, stillHolding, tryOn,
  clientNotes, offerEvidence, rememberConsult, restoreConsults, saveConsults,
} from "../src/world/consult.ts";
import { HAND_CONSULT } from "../src/world/content/consult-lines.ts";
import { existsSync } from "node:fs";
import {
  ENERGY_PER_DAY, OVER_ASK_OPINION, VERB_ENERGY, beginServe, leaveServe, newWorld, nextSeason, opinionOf, parseWorld, resolveServe, serializeWorld, settleServe,
} from "../src/world/engine.ts";
import { SHELF, SHELF_IDS, bestShelf, fitOfPerson, isPerfectMatch, perfectShelf, shelfFitTier } from "../src/world/shelf.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { Person, World } from "../src/world/types.ts";
import { saleFeedback } from "../src/world/sales-feedback.ts";
import { visitPerson } from "../src/world/visits.ts";
import { ta } from "../src/world/pronoun.ts";
import { askCompanion, companionOptions } from "../src/world/companion.ts";

const companionScene = (): World => ({ ...atCounter(["anjie", "liangxia"]), day: 7, slot: 1,
  energy: 20, opinion: { anjie: 0, liangxia: 25 } });

test("熟人搭话含首次接待共18精力，只补一个未知需求，保留耐心与真实账本", () => {
  const w = companionScene(), p = who("anjie"), c = openConsult(w, p);
  const { world: next, consult: learned } = askCompanion(w, PEOPLE, c, "liangxia");
  assert.equal(next.energy, 2);
  assert.equal(learned.patience, c.patience);
  assert.equal(learned.begun, true);
  assert.equal(learned.known.length, c.known.length + 1);
  assert.match(learned.lines.at(-1)!, /梁夏替你问.*安姐接过话/);
  assert.ok(next.touched.includes(p.id));
  for (const field of ["money", "rivalMoney", "opinion", "bonds", "rngCalls", "standing", "compliance", "appointments"] as const)
    assert.deepEqual(next[field], w[field], `${field} 不因搭话改变`);
  assert.ok(clientNotes(next, p).known.includes(learned.known.at(-1)!));
});

test("已接待的搭话只收6精力，不重置试用、提问、货品、件数与情绪", () => {
  const w = companionScene(), p = who("anjie");
  const c = { ...tryOn(openConsult(w, p), p, "soft"), stage: "offer" as const, product: "soft" as const, units: 3, mood: -3 };
  const begun = beginServe(w, PEOPLE, p.id), result = askCompanion(begun, PEOPLE, c, "liangxia");
  assert.equal(result.world.energy, begun.energy - 6);
  for (const key of ["stage", "product", "units", "patience", "tried", "looked", "asked", "mood", "matched"] as const)
    assert.deepEqual(result.consult[key], c[key], key);
  assert.equal(settleServe(result.world, PEOPLE, p.id, "soft", 1, false).energy, result.world.energy);
});

test("缺席、不信任、闹僵、敌对、缺精力或已耗尽耐心时不能搭话，拒绝无副作用", () => {
  const base = companionScene(), p = who("anjie"), c = openConsult(base, p);
  const cases: Array<[World, typeof c, string]> = [
    [{ ...base, present: { anjie: "counter" } }, c, "liangxia"],
    [{ ...base, present: { liangxia: "counter" } }, c, "liangxia"],
    [{ ...base, present: { anjie: "counter", liangxia: "rival" } }, c, "liangxia"],
    [{ ...base, opinion: { liangxia: 19 } }, c, "liangxia"],
    [{ ...base, bonds: { "anjie>liangxia": -1 } }, c, "liangxia"],
    [{ ...base, bonds: { "liangxia>anjie": 19 } }, c, "liangxia"],
    [{ ...base, bondKinds: { "liangxia>anjie": "rival" } }, c, "liangxia"],
    [{ ...base, energy: 17 }, c, "liangxia"],
    [{ ...base, standing: 0 }, c, "liangxia"],
    [{ ...base, compliance: 0 }, c, "liangxia"],
    [base, { ...c, patience: 0 }, "liangxia"],
    [base, { ...c, begun: true }, "liangxia"],
    [base, c, "anjie"], [base, c, "shen"],
  ];
  for (const [w, consult, helper] of cases) {
    const result = askCompanion(w, PEOPLE, consult, helper);
    assert.equal(result.world, w); assert.equal(result.consult, consult);
  }
  assert.equal(companionOptions(base, PEOPLE, c).length, 1);
  assert.equal(companionOptions(cases[0][0], PEOPLE, c).length, 0);
});

test("当日重点由本人确认，临时重点不写成长期偏好，也不暴露秘密", () => {
  const p = who("liangxia"), w: World = { ...companionScene(), opinion: { anjie: 30, liangxia: 40 },
    qualities: { "visit-context-day:liangxia": 7, "visit-context-code:liangxia": 1 } };
  const c = openConsult(w, p); assert.equal(c.focusKnown, false);
  const result = askCompanion(w, PEOPLE, c, "anjie");
  assert.equal(result.consult.focusKnown, true);
  assert.ok(result.consult.known.includes("correct"));
  assert.match(result.consult.lines.at(-1)!, /今天最要紧/);
  assert.equal(result.world.qualities["client-note:liangxia:correct"], undefined);
  assert.equal(result.world.qualities["secret-known:liangxia"], undefined);
});

test("底线和数量按需一次问一件，已知内容不重复收钱", () => {
  const p = who("anjie"), w = companionScene();
  const c = { ...openConsult(w, p), known: p.skin!.demands.map(d => d.trait) };
  const veto = askCompanion(w, PEOPLE, c, "liangxia");
  assert.equal(veto.consult.vetoKnown, true); assert.equal(veto.consult.unitsKnown, false);
  const units = askCompanion(w, PEOPLE, { ...c, vetoKnown: true }, "liangxia");
  assert.equal(units.consult.unitsKnown, true); assert.match(units.consult.lines.at(-1)!, /最多带 4 件/);
  const complete = { ...c, vetoKnown: true, unitsKnown: true };
  assert.equal(askCompanion(w, PEOPLE, complete, "liangxia").world, w);
});

test("刷新、收起重开或同日换时段均不能重复搭话；下一天重新计次", () => {
  const p = who("anjie"), first = askCompanion(companionScene(), PEOPLE, openConsult(companionScene(), p), "liangxia");
  const w = parseWorld(serializeWorld(first.world))!;
  const restored = restoreConsults(saveConsults(w, { anjie: first.consult }), w, PEOPLE).anjie;
  assert.deepEqual(restored, first.consult);
  assert.equal(askCompanion(w, PEOPLE, restored, "liangxia").world, w);
  const later = { ...w, slot: 2 as const, energy: 40 };
  assert.equal(askCompanion(later, PEOPLE, openConsult(later, p), "liangxia").world, later);
  const tomorrow = { ...later, day: 8 };
  assert.notEqual(askCompanion(tomorrow, PEOPLE, openConsult(tomorrow, p), "liangxia").world, tomorrow);
});

test("搭话不保证成交，错货仍失败；取消接待不凭空奖励关系", () => {
  const w = companionScene(), p = who("anjie"), c = openConsult(w, p);
  const result = askCompanion(w, PEOPLE, c, "liangxia");
  const wrong = SHELF_IDS.find(id => shelfFitTier(fitOfPerson(p, id)) === "negative")!;
  assert.ok(wrong);
  const settled = settleServe(result.world, PEOPLE, p.id, wrong, 1, false, result.consult.mood);
  assert.equal(settled.money, w.money);
  assert.deepEqual(leaveServe(result.world, PEOPLE, p.id, result.consult.mood).opinion, w.opinion);
});

const skinned = PEOPLE.filter(p => p.skin);
const who = (id: string) => PEOPLE.find(p => p.id === id)!;
const atCounter = (ids: string[]): World => {
  const w = newWorld("consult-seed", PEOPLE);
  return { ...w, present: Object.fromEntries(ids.map(id => [id, "counter"])), energy: ENERGY_PER_DAY };
};

test("熟客公开的当日用途进入选货提示，口头预算只加成一次且临时诉求不写成永久偏好", () => {
  const p = who("shen");
  const w: World = { ...atCounter([p.id]), day: 2, opinion: { [p.id]: -10 },
    qualities: { "last-met:shen": 1, "visit-context-day:shen": 2, "visit-context-code:shen": 2 } };
  const live = visitPerson(w, p), c = openConsult(w, p);
  assert.match(c.lines[0], new RegExp(`¥${live.skin!.budget.toLocaleString("zh-CN")}`));
  assert.ok(c.known.includes("wear"), "公开说今天要持妆，就是玩家已经知道的事实");
  assert.ok(offerEvidence(c, live, "plain", 1).some(s => s.includes("长效持妆")), "漏掉今天用途的货要说明已知缺口");
  const begun = beginServe(w, PEOPLE, p.id);
  const learned = askHer(c, live, "ask-units");
  const saved = rememberConsult(begun, p, learned);
  assert.equal(saved.qualities["client-note:shen:wear"], undefined, "沈薇今天赶场不等于永远要求持妆");
  assert.deepEqual(restoreConsults(saveConsults(saved, { [p.id]: learned }), saved, PEOPLE), { [p.id]: learned },
    "当日新增诉求在同一时段刷新后能恢复");
});

test("按诉求生成的老客：今天的重点开场不白送，看到那一处才揭开", () => {
  const p = PEOPLE.find(x => x.skin && !x.skin.buysFor && !HAND_CONSULT[x.id])!;
  const w: World = { ...atCounter([p.id]), day: 2, opinion: { [p.id]: 40 },
    qualities: { [`visit-context-day:${p.id}`]: 2, [`visit-context-code:${p.id}`]: 1 } };
  const live = visitPerson(w, p), c = openConsult(w, p);
  assert.equal(c.focus, "correct");
  assert.equal(c.focusKnown, false, "开场只说有件要紧事，不把重点白送");
  assert.ok(!c.known.includes("correct"), "今天的重点在揭开前不算已知");
  assert.match(c.lines[0]!, /有件最要紧的事/);
  assert.doesNotMatch(c.lines[0]!, /当天见效|长效持妆|舒缓泛红|温和不闷/);
  assert.ok(stillHolding(c, live), "重点没摸清，她仍像是有话没说");
  assert.ok(offerEvidence(c, live, "soft", 1).some(x => x.includes("今天的重点还没摸清")));
  const spot = spotsOf(live).find(s => s.reveals.includes("correct"))!;
  const looked = lookAt(c, live, spot.key);
  assert.equal(looked.focusKnown, true, "看到重点那一处就该知道今天最在意什么");
  assert.ok(looked.known.includes("correct"));
  assert.ok(!offerEvidence(looked, live, "soft", 1).some(x => x.includes("今天的重点还没摸清")));
});

test("手写客人盖得到的重点也要问出来；盖不到的仍按旧版直接说，并补一句问法", () => {
  const p = who("shen");
  const covered: World = { ...atCounter([p.id]), day: 2, opinion: { [p.id]: 40 },
    qualities: { [`visit-context-day:${p.id}`]: 2, [`visit-context-code:${p.id}`]: 4 } };
  const liveCovered = visitPerson(covered, p), cCovered = openConsult(covered, p);
  assert.equal(cCovered.focus, "steady");
  assert.equal(cCovered.focusKnown, false, "手写问话里有这条，仍要从她嘴里问出来");
  assert.ok(!cCovered.known.includes("steady"));
  const q = questionsOf(liveCovered).find(x => x.kind === "line" && x.reveals?.includes("steady"))!;
  const asked = askHer(cCovered, liveCovered, q.key);
  assert.equal(asked.focusKnown, true);
  assert.ok(asked.known.includes("steady"));

  const uncovered: World = { ...covered, qualities: { [`visit-context-day:${p.id}`]: 2, [`visit-context-code:${p.id}`]: 1 } };
  const liveUncovered = visitPerson(uncovered, p), cUncovered = openConsult(uncovered, p);
  assert.equal(cUncovered.focus, "correct");
  assert.equal(cUncovered.focusKnown, true, "手写线索盖不到的重点不能变成死胡同");
  assert.match(cUncovered.lines[0]!, /这次最在意当天见效/);
  assert.ok(questionsOf(liveUncovered).some(x => x.kind === "trait" && x.trait === "correct"),
    "盖不到的重点要补一句能问出来的话");
});

test("底线正好是今天的重点：高关系时她自己说破，面板就不再装没摸清", () => {
  const p = PEOPLE.find(x => x.skin?.veto?.trait === "steady" && !x.skin.buysFor && !HAND_CONSULT[x.id]);
  assert.ok(p, "需要一位有 steady 底线、按诉求生成、不替人买的客人");
  const w: World = { ...atCounter([p.id]), day: 2, opinion: { [p.id]: 40 },
    qualities: { [`visit-context-day:${p.id}`]: 2, [`visit-context-code:${p.id}`]: 4 } };
  const c = openConsult(w, p);
  assert.equal(c.focus, "steady");
  assert.equal(c.focusKnown, true, "底线那句已经把重点说破，不能再说还没摸清");
  assert.match(c.lines[0]!, /这次最在意温和不闷/);
  assert.ok(c.known.includes("steady"));
});

test("每一位有诉求表的客人都接得了：三处可看；按诉求生成的五句可问，手写的那几位照手写的问", () => {
  assert.ok(skinned.length >= 30);
  for (const p of skinned) {
    const hand = HAND_CONSULT[p.id];
    const spots = spotsOf(p), qs = questionsOf(p);
    assert.equal(spots.length, 3, p.id);
    assert.equal(new Set(spots.map(s => s.key)).size, 3, `${p.id} 三处不能重名`);
    assert.ok(qs.some(q => q.kind === "units") && qs.some(q => q.kind === "push"), p.id);
    assert.equal(new Set(qs.map(q => q.key)).size, qs.length, `${p.id} 问话的键重了`);
    if (!hand) assert.equal(qs.length, 5, p.id);
    // 看得出的必须是她真有的那条；替别人买的人（按诉求生成的那一路），脸上什么都看不出
    const mine = new Set(p.skin!.demands.map(d => d.trait));
    for (const s of spots) for (const t of s.reveals) assert.ok(mine.has(t), `${p.id} 的「${s.label}」露的是她没有的诉求`);
    if (p.skin!.buysFor && !hand) assert.ok(spots.every(s => !s.reveals.length), `${p.id} 替人买，看她的脸不该看出东西`);
    // 至少有一句问得到点子上，也至少有一句问偏（不然"问"就不是选择）
    const revealsOf = (q: (typeof qs)[number]) => q.kind === "trait" ? (mine.has(q.trait!) ? [q.trait!] : []) : q.kind === "line" ? q.reveals! : [];
    const asking = qs.filter(q => q.kind === "trait" || q.kind === "line");
    for (const q of asking) for (const t of revealsOf(q)) assert.ok(mine.has(t), `${p.id}「${q.label}」露的是她没有的诉求`);
    assert.ok(asking.some(q => revealsOf(q).length), `${p.id} 一句有用的都问不出来`);
    // 手写的那几位照旧版：问偏的那一句可以就是推销味那一句
    if (mine.size < 5 && !hand) assert.ok(asking.some(q => !revealsOf(q).length), `${p.id} 没有一句会问偏`);
    // 有忌讳的人，忌讳那条必须问得到
    if (p.skin!.veto) assert.ok(asking.some(q => revealsOf(q).includes(p.skin!.veto!.trait)), `${p.id} 的忌讳问不出来`);
  }
});

test("旧版手写的 7 位：诉求表与手写线索对得上，大图在盘上，三处落在横幅里", () => {
  const ids = Object.keys(HAND_CONSULT);
  assert.deepEqual(ids.sort(), ["anjie", "duan", "mei", "shen", "xiaoyu", "zhao", "zhou"]);
  for (const id of ids) {
    const p = who(id), hand = HAND_CONSULT[id]!;
    assert.ok(p.skin, id);
    assert.ok(existsSync(new URL(`../public${hand.plate}`, import.meta.url)), `${id} 的近景大图不在盘上`);
    assert.equal(new Set(hand.spots.map(s => s.at)).size, 3, `${id} 三处要落在三个不同的点`);
    for (const s of spotsOf(p)) {
      assert.ok(s.at && s.at.x > 0 && s.at.x < 100 && s.at.y > 0 && s.at.y < 100, `${id}「${s.label}」落在横幅外`);
    }
    assert.ok(plateOf(p), id);
  }
  assert.equal(plateOf(skinned.find(p => !HAND_CONSULT[p.id])!), null, "没有手写的人不出大图");
});

test("有信息才花一句耐心；没信息仍记下问过，但不扣耐心；花完了都按不动", () => {
  const p = who("shen");
  let c = openConsult(atCounter(["shen"]), p);
  assert.equal(c.patience, consultPatience(p, 0));
  assert.equal(c.begun, false, "打开抽屉不算接手");
  const steps = [
    ...spotsOf(p).map(s => (x: typeof c) => lookAt(x, p, s.key)),
    ...questionsOf(p).map(q => (x: typeof c) => askHer(x, p, q.key)),
  ];
  for (const step of steps) {
    const before = c.patience;
    const next = step(c);
    if (before <= 0) { assert.equal(next, c, "耐心花完还能动"); continue; }
    assert.equal(next.begun, true);
    assert.ok(next.patience === before || next.patience === before - 1, "一次最多花一句");
    if (next.patience === before) assert.match(next.lines.at(-1)!, /不算一次探问/);
    else assert.doesNotMatch(next.lines.at(-1)!, /不算一次探问/);
    c = next;
  }
  const spent = { ...c, patience: 0 };
  assert.equal(lookAt(spent, p, spotsOf(p)[0]!.key), spent);
  assert.equal(askHer(spent, p, questionsOf(p)[0]!.key), spent);
  assert.equal(tryOn(spent, p, "soft"), spent);
});

test("没带来新信息的看/问不扣耐心，并说明为什么；推销问句仍要付耐心和人情", () => {
  const shen = who("shen");
  let c = openConsult(atCounter(["shen"]), shen);
  assert.ok(c.known.includes("natural"), "她的开场已经说了轻薄自然");
  const knownSpot = spotsOf(shen).find(s => s.reveals.includes("natural"))!;
  const lookedKnown = lookAt(c, shen, knownSpot.key);
  assert.equal(lookedKnown.patience, c.patience, "看已经知道的诉求不扣耐心");
  assert.ok(lookedKnown.known.includes("natural"));
  assert.match(lookedKnown.lines.at(-1)!, /不算一次探问/);

  const budget = questionsOf(shen).find(q => q.kind === "line" && !q.reveals?.length)!;
  c = askHer(c, shen, budget.key);
  assert.equal(c.patience, lookedKnown.patience, "问偏的句子不扣耐心");
  assert.match(c.lines.at(-1)!, /没问出新的事实/);

  const units = questionsOf(shen).find(q => q.kind === "units")!;
  c = askHer(c, shen, units.key);
  assert.equal(c.patience, lookedKnown.patience - 1, "第一次问件数是有用的");
  const again = { ...c, asked: c.asked.filter(k => k !== units.key) };
  const repeated = askHer(again, shen, units.key);
  assert.equal(repeated.patience, again.patience, "件数已经知道，再问不扣耐心");
  assert.match(repeated.lines.at(-1)!, /件数你已经知道/);

  const push = questionsOf(shen).find(q => q.kind === "push")!;
  const pushed = askHer(c, shen, push.key);
  assert.equal(pushed.patience, c.patience - 1, "推销问句仍要付耐心");
  assert.equal(pushed.mood, PUSH_QUESTION_MOOD);
});

test("问偏的诉求进「排除」；旧档没有排除字段按空接上，坏值拒收", () => {
  const p = PEOPLE.find(x => x.skin && !x.skin.buysFor && !HAND_CONSULT[x.id])!;
  const base = openConsult(atCounter([p.id]), p);
  const wrong = questionsOf(p).find(q => q.kind === "trait" && !p.skin!.demands.some(d => d.trait === q.trait))!;
  assert.ok(wrong, "按诉求生成的客人要有一句问偏的");
  const asked = askHer(base, p, wrong.key);
  assert.equal(asked.patience, base.patience, "问偏不扣耐心");
  assert.deepEqual(asked.excluded, [wrong.trait]);
  assert.match(asked.lines.at(-1)!, /排除了一个方向/);
  assert.ok(!asked.known.includes(wrong.trait!), "排除的不是她的诉求");

  const w = beginServe(atCounter([p.id]), PEOPLE, p.id);
  const data = JSON.parse(JSON.stringify(saveConsults(w, { [p.id]: asked })));
  assert.deepEqual(restoreConsults(data, w, PEOPLE)[p.id]?.excluded, [wrong.trait]);
  const legacy = { ...asked } as Partial<typeof asked>;
  delete legacy.excluded;
  assert.deepEqual(restoreConsults(JSON.parse(JSON.stringify(saveConsults(w, { [p.id]: legacy as typeof asked }))), w, PEOPLE)[p.id]?.excluded, []);
  const bad = JSON.parse(JSON.stringify(data));
  bad.entries[p.id].excluded = ["made-up"];
  assert.deepEqual(restoreConsults(bad, w, PEOPLE), {});
  const clash = JSON.parse(JSON.stringify(data));
  clash.entries[p.id].excluded = [p.skin!.demands[0]!.trait];
  assert.deepEqual(restoreConsults(clash, w, PEOPLE), {});
});

test("底线不是「她不在意」：问到忌讳记底线，不混进排除", () => {
  const p = PEOPLE.find(x => x.skin?.veto && !HAND_CONSULT[x.id])!;
  const c = openConsult(atCounter([p.id]), p);
  const q = questionsOf(p).find(q => q.kind === "trait" && q.trait === p.skin!.veto!.trait)!;
  assert.ok(q);
  const asked = askHer(c, p, q.key);
  assert.equal(asked.vetoKnown, true);
  assert.ok(!asked.excluded.includes(p.skin!.veto!.trait));
  assert.equal(asked.patience, c.patience - 1, "知道底线是新事实，要花一句");
});

test("急性子少一句，熟起来的人多一句", () => {
  const hasty = skinned.find(p => p.tempers.includes("hasty"))!;
  const calm = skinned.find(p => !p.tempers.includes("hasty"))!;
  assert.equal(consultPatience(calm, 0), CONSULT_PATIENCE);
  assert.equal(consultPatience(hasty, 0), CONSULT_PATIENCE - 1);
  assert.equal(consultPatience(calm, 40), CONSULT_PATIENCE + 1);
});

test("看与问把诉求摆上台面；问件数才知道上限；推销味那句记一笔坏脸色", () => {
  for (const p of skinned) {
    const base = { ...openConsult(atCounter([p.id]), p), patience: 99 };
    for (const s of spotsOf(p)) {
      const c = lookAt(base, p, s.key);
      for (const t of s.reveals) assert.ok(c.known.includes(t), `${p.id} 看了${s.label}还不知道`);
    }
    for (const q of questionsOf(p)) {
      const c = askHer(base, p, q.key);
      if (q.kind === "units") assert.equal(c.unitsKnown, true);
      if (q.kind === "push") assert.equal(c.mood, PUSH_QUESTION_MOOD);
      if (q.kind === "trait" && p.skin!.demands.some(d => d.trait === q.trait)) assert.ok(c.known.includes(q.trait!));
      if (q.kind === "trait" && p.skin!.veto?.trait === q.trait) assert.equal(c.vetoKnown, true, `${p.id} 问到忌讳那条没说出来`);
      if (q.kind === "line") for (const t of q.reveals!) assert.ok(c.known.includes(t), `${p.id}「${q.label}」问完还不知道`);
      if (q.kind === "line" && p.skin!.veto && q.reveals!.includes(p.skin!.veto.trait)) assert.equal(c.vetoKnown, true, `${p.id} 问到忌讳那条没说出来`);
    }
  }
});

test("试出来的档位就是开单那一档，正中单独留字不升格；碰到忌讳，忌讳也露出来", () => {
  for (const p of skinned) {
    const base = { ...openConsult(atCounter([p.id]), p), patience: 99 };
    for (const id of SHELF_IDS) {
      const c = tryOn(base, p, id);
      const score = fitOfPerson(p, id), tier = shelfFitTier(score), veto = p.skin!.veto;
      const hitVeto = !!veto && SHELF[id].traits[veto.trait] < veto.below;
      const expected = !hitVeto && tier === "positive" && isPerfectMatch(p, id) ? "perfect" : tier;
      assert.equal(c.tried[id], expected, `${p.id} 试${id}`);
      if (c.tried[id] === "perfect") assert.equal(tier, "positive", `${p.id} 试${id}：认准仍属于点头那档结账`);
      assert.ok(Object.hasOwn(TRIED_MARK, c.tried[id]!), `${p.id} 试${id} 的格子要有字可留`);
      if (hitVeto) assert.equal(c.vetoKnown, true, `${p.id} 试${id}碰到忌讳没露出来`);
    }
    // 试到正中那一支：那句"还有顾虑"可以收了
    const perfect = perfectShelf(p);
    if (perfect) {
      const hit = tryOn(base, p, perfect);
      assert.equal(hit.tried[perfect], "perfect", p.id);
      assert.equal(stillHolding(hit, p), false, p.id);
    }
  }
});

test("拆成两步与一步到位结出同一个世界：模拟器那条路不受接待改版影响", () => {
  for (const p of skinned.slice(0, 12)) {
    const w = atCounter([p.id]);
    for (const force of [false, true]) {
      const one = resolveServe(w, PEOPLE, p.id, bestShelf(p), p.skin!.maxUnits, force);
      const begun = beginServe(w, PEOPLE, p.id);
      assert.equal(begun.energy, w.energy - VERB_ENERGY.serve, "开头那一下只扣一次接待的劲");
      const two = settleServe(begun, PEOPLE, p.id, bestShelf(p), p.skin!.maxUnits, force);
      assert.deepEqual(two, one, `${p.id} force=${force}`);
    }
  }
});

test("件数是个真选择：开口超过她说过的上限，每多一件扣一笔看法，货照她要的给", () => {
  const p = skinned.find(x => x.skin!.maxUnits === 1 && shelfFitTier(fitOfPerson(x, bestShelf(x))) === "positive")!;
  const w = atCounter([p.id]);
  const exact = resolveServe(w, PEOPLE, p.id, bestShelf(p), 1);
  const over = resolveServe(w, PEOPLE, p.id, bestShelf(p), 3);
  assert.equal(over.money, exact.money, "多开口不多卖");
  assert.equal(opinionOf(over, p.id) - opinionOf(exact, p.id), OVER_ASK_OPINION * 2);
});

test("接待里攒下的脸色在开单那一刻结", () => {
  const p: Person = who("shen");
  const w = beginServe(atCounter(["shen"]), PEOPLE, "shen");
  const calm = settleServe(w, PEOPLE, "shen", bestShelf(p), 1);
  const sour = settleServe(w, PEOPLE, "shen", bestShelf(p), 1, false, PUSH_QUESTION_MOOD);
  assert.equal(opinionOf(sour, "shen") - opinionOf(calm, "shen"), PUSH_QUESTION_MOOD);
});

test("客情笔记来自实际对话：离场、存读与换季后仍能用，不会补出没问过的需求", () => {
  const p = who("shen"), w = atCounter([p.id]);
  const opened = openConsult(w, p);
  assert.equal(rememberConsult(w, p, opened), w, "只打开不能记新的笔记");
  const q = questionsOf(p).find(q => q.kind === "line" && q.reveals?.includes("steady"))!;
  const c = askHer(opened, p, q.key);
  const learned = rememberConsult(beginServe(w, PEOPLE, p.id), p, c);
  assert.ok(clientNotes(learned, p).known.includes("steady"));
  assert.deepEqual(clientNotes(learned, p).known.sort(), [...c.known].sort());
  assert.equal(clientNotes(learned, p).unitsKnown, false);
  const loaded = parseWorld(serializeWorld(learned))!;
  const next = nextSeason(loaded, PEOPLE);
  assert.deepEqual(clientNotes(next, p), clientNotes(learned, p));
  assert.ok(openConsult(next, p).known.includes("steady"));
  assert.equal(clientNotes(w, p).known.length, 0, "原世界不可被修改");
});

test("付过精力的接待完整恢复：耐心、坏脸色、试用、件数和当前页面；跨时段与坏记录拒绝", () => {
  const p = who("shen");
  let w = beginServe(atCounter([p.id]), PEOPLE, p.id);
  let c = askHer(openConsult(w, p), p, questionsOf(p).find(q => q.kind === "push")!.key);
  c = { ...tryOn(c, p, "plain"), product: "plain", units: 2, stage: "offer" };
  w = rememberConsult(w, p, c);
  const data = JSON.parse(JSON.stringify(saveConsults(w, { [p.id]: c })));
  assert.deepEqual(restoreConsults(data, w, PEOPLE), { [p.id]: c });
  const focused = { ...c, focus: c.known[0]!, focusKnown: true };
  assert.deepEqual(restoreConsults(JSON.parse(JSON.stringify(saveConsults(w, { [p.id]: focused }))), w, PEOPLE),
    { [p.id]: focused }, "今天的重点与是否揭开都要跟着存档回来");
  const legacy = { ...c } as Partial<typeof c>;
  delete legacy.focus;
  delete legacy.focusKnown;
  assert.deepEqual(restoreConsults(JSON.parse(JSON.stringify(saveConsults(w, { [p.id]: legacy as typeof c }))), w, PEOPLE),
    { [p.id]: { ...c, focus: null, focusKnown: false } }, "旧存档没有重点字段也要接得上");
  assert.deepEqual(restoreConsults(data, { ...w, slot: 1 }, PEOPLE), {});
  assert.deepEqual(restoreConsults(data, { ...w, season: 2 }, PEOPLE), {});
  assert.deepEqual(restoreConsults(data, { ...w, touched: [] }, PEOPLE), {});
  for (const bad of [undefined, [], { ...data, entries: { shen: { ...c, patience: 99 } } },
    { ...data, entries: { shen: { ...c, product: "constructor" } } },
    { ...data, entries: { shen: { ...c, known: ["made-up"] } } },
    { ...data, entries: { shen: { ...c, focus: "wear" } } },
    { ...data, entries: { shen: { ...c, focusKnown: "yes" } } },
    { ...data, entries: { shen: { ...c, tried: { plain: { positive: true } } } } },
    { ...data, entries: { shen: { ...c, tried: { plain: "great" } } } },
    { ...data, entries: { shen: { ...c, tried: { plain: ["perfect"] } } } },
    { ...data, entries: { shen: { ...c, tried: { plain: "Perfect" } } } }]) {
    assert.deepEqual(restoreConsults(bad, w, PEOPLE), {});
  }
});

test("试用的四档字：正中单独记下、货架与开单提示共用同一措辞、旧档三档照旧恢复不升格、坏值仍拒", () => {
  const p = who("shen"), w = beginServe(atCounter([p.id]), PEOPLE, p.id);
  const perfect = perfectShelf(p)!;
  const positive = SHELF_IDS.find(id => shelfFitTier(fitOfPerson(p, id)) === "positive" && !isPerfectMatch(p, id))!;
  const negative = SHELF_IDS.find(id => shelfFitTier(fitOfPerson(p, id)) === "negative")!;
  const c = tryOn(tryOn(tryOn(openConsult(w, p), p, perfect), p, positive), p, negative);
  assert.equal(c.tried[perfect], "perfect");
  assert.equal(TRIED_MARK.perfect, "认准了");
  assert.notEqual(TRIED_MARK.perfect, TRIED_MARK.positive, "正中与「这个可以」不能留同一个字");
  // 开单提示与货架格子共用 TRIED_MARK：同一支货说同一句话。
  assert.ok(offerEvidence(c, p, perfect, 1).some(x => x === `试用反应：${ta(p)}${TRIED_MARK.perfect}。`));
  assert.ok(offerEvidence(c, p, positive, 1).some(x => x === `试用反应：${ta(p)}${TRIED_MARK.positive}。`));
  // 没试过的货只讲还没试过，不露反应、不露适配。
  const untried = SHELF_IDS.find(id => !c.tried[id])!;
  const hint = offerEvidence(c, p, untried, 1);
  assert.ok(hint.some(x => x.includes("还没试过")));
  assert.ok(!hint.some(x => Object.values(TRIED_MARK).some(mark => x.includes(`她${mark}`))),
    "没试的货不能提前露试用反应");
  // 存档：perfect 与三档一起回来；旧档的 positive 不凭分数升级成认准。
  const data = JSON.parse(JSON.stringify(saveConsults(w, { [p.id]: c })));
  assert.deepEqual(restoreConsults(data, w, PEOPLE)[p.id]?.tried, c.tried);
  const legacy = { ...c, tried: { [perfect]: "positive" as const } };
  const restored = restoreConsults(JSON.parse(JSON.stringify(saveConsults(w, { [p.id]: legacy }))), w, PEOPLE)[p.id];
  assert.equal(restored!.tried[perfect], "positive", "旧档记下的点头要按当时的知道接着用，不凭全知分数补升");
});

test("贵的全接住仍只是点头，正中那支是买得起、全接住里最省的", () => {
  const p = who("shen"), w = atCounter([p.id]);
  const base = tryOn(openConsult(w, p), p, "base");
  assert.equal(base.tried.base, "positive");
  assert.match(base.lines.at(-1)!, /还有一支更省/);
  const soft = tryOn(base, p, "soft");
  assert.equal(soft.tried.soft, "perfect");
  assert.match(soft.lines.at(-1)!, /就是这个感觉/);
});

test("没有正中的客人说清楚：最接近的一支也只是对症，不让人一直摸下去", () => {
  // 赶场那天周姐最要紧的换成撑妆：四条诉求一起要，货架上没有哪一支全接得住 —— 这时要当场说清楚。
  const p = who("zhou");
  const w: World = { ...atCounter([p.id]), day: 2,
    qualities: { [`visit-context-day:${p.id}`]: 2, [`visit-context-code:${p.id}`]: 2 } };
  const live = visitPerson(w, p), c = openConsult(w, p);
  assert.equal(perfectShelf(live), null, "赶场那天的周姐没有正中");
  assert.ok(offerEvidence(c, live, "soft", 1).some(x => x.includes("没有一支能全接住")));
});

// 「换支要结人情」这两条要的是三种档位各一支，不是哪三支货：按当下的货架现挑，
// 档位重排（见设计文档「货架尾部那一刀」）以后不用跟着改名单。
const trialTierOf = (w: World, p: Person, id: (typeof SHELF_IDS)[number]) =>
  tryOn({ ...openConsult(w, p), patience: 99 }, p, id).tried[id];
/** 点头一支 + 犹豫一支 + 随便再一支（用来验「只在第一次换支时结」）。挑不出来返回 null。 */
function switchCase(p: Person) {
  const w = beginServe(atCounter([p.id]), PEOPLE, p.id);
  const nod = SHELF_IDS.find(id => trialTierOf(w, p, id) === "positive");
  const mixed = SHELF_IDS.find(id => trialTierOf(w, p, id) === "mixed");
  const other = SHELF_IDS.find(id => id !== nod && id !== mixed);
  return nod && other ? { w, nod, mixed, other } : null;
}
/** 32 位客人个个都带两条脾气，没有"没脾气"的那种，所以普通人只能按"不犯那三条"来挑
 *  （那三条在 src/world/consult.ts 的 SECOND_TRY_HARD_TEMPERS 里，改了就红在这）。
 *  急性子那一档（-3）要点头与犹豫都齐；普通人（-2）只要点头一支就够。 */
const HARD_TEMPERS = ["proud", "hasty", "wary"] as const;
const switchSubject = (hard: boolean) => {
  const found = PEOPLE.find(p => p.role === "customer" && p.skin
    && p.tempers.some(t => (HARD_TEMPERS as readonly string[]).includes(t)) === hard
    && switchCase(p) && (!hard || !!switchCase(p)!.mixed));
  assert.ok(found, `挑不出一位${hard ? "犯那三条脾气" : "不犯那三条脾气"}的客人来验换支的代价`);
  return { person: found!, ...switchCase(found!)! };
};

test("点头后再换一支：第一次换支没试到正中才结人情，好胜/多疑更重；试到正中不罚", () => {
  const hard = switchSubject(true);
  const mei = hard.person, mw = hard.w, nod = hard.nod, other = hard.other;
  const mixed = hard.mixed!;   // switchSubject(true) 保证挑得到犹豫那一支
  const nodded = tryOn(openConsult(mw, mei), mei, nod);
  assert.equal(nodded.tried[nod], "positive");
  assert.equal(nodded.mood, 0);
  const risk = secondTryRisk(nodded, mei, mixed);
  assert.ok(risk, "点头后换支要在按下试用前看得见代价");
  assert.equal(risk!.mood, SECOND_TRY_HARD_MOOD);
  assert.match(risk!.line, /拿不准/);
  assert.match(risk!.line, /-3/);
  assert.ok(offerEvidence(nodded, mei, mixed, 1).includes(risk!.line), "选货提示要带同一句风险");
  const failed = tryOn(nodded, mei, mixed);
  assert.equal(failed.tried[mixed], "mixed");
  assert.equal(failed.mood, SECOND_TRY_HARD_MOOD);
  assert.equal(failed.risked, true);
  assert.match(failed.lines.at(-1)!, /刚才那支不是挺好吗/);
  // 只在第一次换支时结；再换一支不再叠罚（但照样花耐心）。
  assert.equal(secondTryRisk(failed, mei, other), null);
  assert.equal(tryOn(failed, mei, other).mood, SECOND_TRY_HARD_MOOD);
  const alreadyRisked = { ...nodded, risked: true, mood: -3 };
  assert.equal(secondTryRisk(alreadyRisked, mei, mixed), null, "仍有耐心且上支点头，也不能重复扣人情");
  assert.equal(tryOn(alreadyRisked, mei, mixed).mood, -3);
  // 先试过别的、再点头，换支仍要结 —— 风险认的是「最近一次点头」。
  const mixedFirst = tryOn(openConsult(mw, mei), mei, mixed);
  const thenNod = tryOn(mixedFirst, mei, nod);
  assert.equal(thenNod.tried[nod], "positive");
  assert.ok(secondTryRisk(thenNod, mei, other), "先试过犹豫货，再点头后换支同样有代价");
  // 换到正中不罚：换支的代价和收益是同一枚硬币。
  const shen = PEOPLE.find(p => p.role === "customer" && p.skin && perfectShelf(p)
    && SHELF_IDS.some(id => trialTierOf(beginServe(atCounter([p.id]), PEOPLE, p.id), p, id) === "positive"));
  assert.ok(shen, "挑不出一位既有正中、又有一支只是点头的客人");
  const sw = beginServe(atCounter([shen!.id]), PEOPLE, shen!.id);
  const shenNod = SHELF_IDS.find(id => trialTierOf(sw, shen!, id) === "positive")!;
  const first = tryOn(openConsult(sw, shen!), shen!, shenNod);
  assert.equal(first.tried[shenNod], "positive");
  const perfect = tryOn(first, shen!, perfectShelf(shen!)!);
  assert.equal(perfect.tried[perfectShelf(shen!)!], "perfect");
  assert.equal(perfect.mood, 0);
  assert.match(perfect.lines.at(-1)!, /就是这个感觉/);
  // 一点脾气都没有的普通人是 -2。
  const liang = switchSubject(false);
  const lw = beginServe(atCounter([liang.person.id]), PEOPLE, liang.person.id);
  const liangNod = tryOn(openConsult(lw, liang.person), liang.person, liang.nod);
  assert.equal(secondTryRisk(liangNod, liang.person, liang.other)!.mood, SECOND_TRY_MOOD);
});

test("换支人情按实际结算进账：同一位客人的两种收法差 3 点看法", () => {
  const hard = switchSubject(true);
  const mei = hard.person, nod = hard.nod, mixed = hard.mixed!;
  const base = beginServe(atCounter([mei.id]), PEOPLE, mei.id);
  const nodded = tryOn(openConsult(base, mei), mei, nod);
  const closedNow = settleServe(base, PEOPLE, mei.id, nod, 1, false, nodded.mood);
  const triedAgain = tryOn(nodded, mei, mixed);
  const closedAfter = settleServe(base, PEOPLE, mei.id, nod, 1, false, triedAgain.mood);
  assert.equal(opinionOf(closedNow, mei.id) - opinionOf(closedAfter, mei.id), -SECOND_TRY_HARD_MOOD,
    "多试一支没中，同样的货少 3 点人情");
  assert.equal(closedAfter.money, closedNow.money, "这笔风险不改成交金额，只改人情");
  const fb = saleFeedback(base, closedAfter, mei, nod, 1, triedAgain.mood, true);
  assert.match(fb.explanation, /反复/, "小票要解释少掉的人情从哪来");
  assert.match(fb.lesson, /点头后/);
  assert.doesNotMatch(saleFeedback(base, closedNow, mei, nod, 1, nodded.mood).explanation, /反复/);
});

test("旧接待没有 risked 按 false 恢复；坏值只丢这一段接待", () => {
  const p = who("shen"), w = beginServe(atCounter([p.id]), PEOPLE, p.id);
  const c = tryOn(openConsult(w, p), p, "plain");
  const data = JSON.parse(JSON.stringify(saveConsults(w, { [p.id]: c })));
  delete data.entries[p.id].risked;
  assert.equal(restoreConsults(data, w, PEOPLE)[p.id]?.risked, false);
  const bad = JSON.parse(JSON.stringify(data));
  bad.entries[p.id].risked = "yes";
  assert.deepEqual(restoreConsults(bad, w, PEOPLE), {});
});

test("售前提示只用已知信息：隐藏需求改变不会泄题；已问出的数量、底线与预算会提醒", () => {
  const p = who("shen"), c = openConsult(atCounter([p.id]), p);
  const changed: Person = { ...p, skin: { ...p.skin!, demands: p.skin!.demands.map(d => c.known.includes(d.trait) ? d : { ...d, weight: d.weight === 3 ? 1 : 3 }) } };
  assert.deepEqual(offerEvidence(c, p, "glow", 4), offerEvidence(c, changed, "glow", 4));
  assert.ok(offerEvidence(c, p, "glow", 4).some(x => x.includes("轻薄自然")));
  assert.ok(!offerEvidence(c, p, "glow", 4).some(x => x.includes("只想带")));
  const learned = askHer(c, p, questionsOf(p).find(q => q.kind === "units")!.key);
  assert.ok(offerEvidence(learned, p, "glow", 4).some(x => x.includes("只想带")));
  const lowBudget: Person = { ...p, skin: { ...p.skin!, budget: 100 } };
  assert.ok(offerEvidence(c, lowBudget, "glow", 1).some(x => x.includes("一件就超预算")));
});

test("主动不卖不会退精力、刷好感或抹掉推销问话的代价", () => {
  const w = beginServe(atCounter(["shen"]), PEOPLE, "shen");
  const left = leaveServe(w, PEOPLE, "shen", PUSH_QUESTION_MOOD);
  assert.equal(left.energy, w.energy);
  assert.equal(left.money, w.money);
  assert.equal(opinionOf(left, "shen"), opinionOf(w, "shen") + PUSH_QUESTION_MOOD);
  assert.equal(opinionOf(leaveServe(w, PEOPLE, "shen"), "shen"), opinionOf(w, "shen"));
  assert.equal(left.qualities["bought:shen"], undefined);
});

test("复盘来自实际结算：正常、超量、超预算与硬推分别解释，不提前揭晓退货", () => {
  const p = who("mei"), w = atCounter([p.id]);
  const id = bestShelf(p);
  const sold = resolveServe(w, PEOPLE, p.id, id, 4);
  const f = saleFeedback(w, sold, p, id, 4);
  assert.equal(f.amount, sold.money - w.money);
  assert.equal(f.units, p.skin!.maxUnits);
  assert.equal(f.opinion, opinionOf(sold, p.id) - opinionOf(w, p.id));
  assert.equal(f.title, "这单开口多了");
  assert.match(f.explanation, /最多只想带/);
  assert.ok(f.lines.some(x => x.includes("用不了那么多")));
  const forced = resolveServe(w, PEOPLE, p.id, "plain", 2, true);
  const hard = saleFeedback(w, forced, p, "plain");
  assert.equal(hard.tone, "mixed");
  assert.match(hard.explanation, /可能退/);
  assert.deepEqual(hard, saleFeedback(w, { ...forced, appointments: [] }, p, "plain"));
  const emptyLedger = { ...beginServe(w, PEOPLE, p.id), compliance: 0, standing: 0 };
  const forcedAtFloor = settleServe(emptyLedger, PEOPLE, p.id, "plain", 2, true);
  assert.equal(forcedAtFloor.compliance, 0);
  assert.ok(forcedAtFloor.money > emptyLedger.money);
  assert.match(saleFeedback(emptyLedger, forcedAtFloor, p, "plain").explanation, /可能退/,
    "台账已经归零，硬推仍有真实的关系代价，不能被复盘当成普通成交");
  const later = { ...w, memories: forced.memories };
  const honestAfterForce = resolveServe(later, PEOPLE, p.id, id, 1);
  assert.doesNotMatch(saleFeedback(later, honestAfterForce, p, id).explanation, /可能退/,
    "旧硬推记录不能污染这一次正常成交");
  const poor: Person = { ...p, skin: { ...p.skin!, budget: 1 } };
  const missed = resolveServe(w, [poor], p.id, id, 1);
  assert.match(saleFeedback(w, missed, poor, id).explanation, /预算/);
  const recent = { ...w, day: 2, qualities: { ...w.qualities, [`bought:${p.id}`]: 1 } };
  assert.match(saleFeedback(recent, resolveServe(recent, PEOPLE, p.id, id, 1), p, id).explanation, /没用完/);
  const distrust = { ...w, opinion: { [p.id]: -100 } };
  const refused = saleFeedback(distrust, resolveServe(distrust, PEOPLE, p.id, id, 1), p, id);
  assert.match(refused.explanation, /信任/);
  assert.match(refused.lesson, /修复关系/);
});

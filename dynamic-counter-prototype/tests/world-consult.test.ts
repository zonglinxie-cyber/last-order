// 柜上的接待：看 → 问 → 试 → 开单（src/world/consult.ts + engine 的 beginServe / settleServe）。
// 钉的是规则的形状：每位客人都接得了、每一下都花耐心、问出来的是真话、试出来的档位就是结账那一档，
// 以及"件数是个真选择"—— 开口超过她说过的上限要扣看法。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONSULT_PATIENCE, PUSH_QUESTION_MOOD, askHer, consultPatience, lookAt, openConsult, plateOf, questionsOf, spotsOf, stillHolding, tryOn,
  clientNotes, offerEvidence, rememberConsult, restoreConsults, saveConsults,
} from "../src/world/consult.ts";
import { HAND_CONSULT } from "../src/world/content/consult-lines.ts";
import { existsSync } from "node:fs";
import {
  ENERGY_PER_DAY, OVER_ASK_OPINION, VERB_ENERGY, beginServe, leaveServe, newWorld, nextSeason, opinionOf, parseWorld, resolveServe, serializeWorld, settleServe,
} from "../src/world/engine.ts";
import { SHELF, SHELF_IDS, bestShelf, fitOfPerson, shelfFitTier } from "../src/world/shelf.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { Person, World } from "../src/world/types.ts";
import { saleFeedback } from "../src/world/sales-feedback.ts";
import { visitPerson } from "../src/world/visits.ts";
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

test("每一下都花一句耐心；花完了看 / 问 / 试都按不动", () => {
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
    assert.equal(next.patience, before - 1);
    assert.equal(next.begun, true);
    c = next;
  }
  assert.equal(c.patience, 0);
  assert.equal(tryOn(c, p, "soft"), c);
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

test("试出来的档位就是开单那一档；碰到忌讳，忌讳也露出来", () => {
  for (const p of skinned) {
    const base = { ...openConsult(atCounter([p.id]), p), patience: 99 };
    for (const id of SHELF_IDS) {
      const c = tryOn(base, p, id);
      assert.equal(c.tried[id], shelfFitTier(fitOfPerson(p, id)), `${p.id} 试${id}`);
      const veto = p.skin!.veto;
      if (veto && SHELF[id].traits[veto.trait] < veto.below) assert.equal(c.vetoKnown, true, `${p.id} 试${id}碰到忌讳没露出来`);
    }
    // 试到她最准的那一支：那句"还有顾虑"可以收了
    const best = bestShelf(p);
    if (fitOfPerson(p, best) >= 0.95) assert.equal(stillHolding(tryOn(base, p, best), p), false, p.id);
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
    { ...data, entries: { shen: { ...c, tried: { plain: { positive: true } } } } }]) {
    assert.deepEqual(restoreConsults(bad, w, PEOPLE), {});
  }
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

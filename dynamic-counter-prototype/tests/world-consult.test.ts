// 柜上的接待：看 → 问 → 试 → 开单（src/world/consult.ts + engine 的 beginServe / settleServe）。
// 钉的是规则的形状：每位客人都接得了、每一下都花耐心、问出来的是真话、试出来的档位就是结账那一档，
// 以及"件数是个真选择"—— 开口超过她说过的上限要扣看法。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONSULT_PATIENCE, PUSH_QUESTION_MOOD, askHer, consultPatience, lookAt, openConsult, questionsOf, spotsOf, stillHolding, tryOn,
} from "../src/world/consult.ts";
import {
  ENERGY_PER_DAY, OVER_ASK_OPINION, VERB_ENERGY, beginServe, newWorld, opinionOf, resolveServe, settleServe,
} from "../src/world/engine.ts";
import { SHELF, SHELF_IDS, bestShelf, fitOfPerson, shelfFitTier } from "../src/world/shelf.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { Person, World } from "../src/world/types.ts";

const skinned = PEOPLE.filter(p => p.skin);
const who = (id: string) => PEOPLE.find(p => p.id === id)!;
const atCounter = (ids: string[]): World => {
  const w = newWorld("consult-seed", PEOPLE);
  return { ...w, present: Object.fromEntries(ids.map(id => [id, "counter"])), energy: ENERGY_PER_DAY };
};

test("每一位有诉求表的客人都接得了：三处可看、五句可问", () => {
  assert.ok(skinned.length >= 30);
  for (const p of skinned) {
    const spots = spotsOf(p), qs = questionsOf(p);
    assert.equal(spots.length, 3, p.id);
    assert.equal(new Set(spots.map(s => s.key)).size, 3, `${p.id} 三处不能重名`);
    assert.equal(qs.length, 5, p.id);
    assert.ok(qs.some(q => q.kind === "units") && qs.some(q => q.kind === "push"), p.id);
    // 看得出的必须是她真有的那条；替别人买的人，脸上什么都看不出
    const mine = new Set(p.skin!.demands.map(d => d.trait));
    for (const s of spots) if (s.reveals) assert.ok(mine.has(s.reveals), `${p.id} 的「${s.label}」露的是她没有的诉求`);
    if (p.skin!.buysFor) assert.ok(spots.every(s => !s.reveals), `${p.id} 替人买，看她的脸不该看出东西`);
    // 至少有一句问得到点子上，也至少有一句问偏（不然"问"就不是选择）
    const traitQs = qs.filter(q => q.kind === "trait");
    assert.ok(traitQs.some(q => mine.has(q.trait!)), `${p.id} 一句有用的都问不出来`);
    if (mine.size < 5) assert.ok(traitQs.some(q => !mine.has(q.trait!)), `${p.id} 五句里没有一句会问偏`);
    // 有忌讳的人，忌讳那条必须问得到
    if (p.skin!.veto) assert.ok(traitQs.some(q => q.trait === p.skin!.veto!.trait), `${p.id} 的忌讳问不出来`);
  }
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
      if (s.reveals) assert.ok(c.known.includes(s.reveals), `${p.id} 看了${s.label}还不知道`);
    }
    for (const q of questionsOf(p)) {
      const c = askHer(base, p, q.key);
      if (q.kind === "units") assert.equal(c.unitsKnown, true);
      if (q.kind === "push") assert.equal(c.mood, PUSH_QUESTION_MOOD);
      if (q.kind === "trait" && p.skin!.demands.some(d => d.trait === q.trait)) assert.ok(c.known.includes(q.trait!));
      if (q.kind === "trait" && p.skin!.veto?.trait === q.trait) assert.equal(c.vetoKnown, true, `${p.id} 问到忌讳那条没说出来`);
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

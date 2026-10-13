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

const skinned = PEOPLE.filter(p => p.skin);
const who = (id: string) => PEOPLE.find(p => p.id === id)!;
const atCounter = (ids: string[]): World => {
  const w = newWorld("consult-seed", PEOPLE);
  return { ...w, present: Object.fromEntries(ids.map(id => [id, "counter"])), energy: ENERGY_PER_DAY };
};

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
  assert.deepEqual(restoreConsults(data, { ...w, slot: 1 }, PEOPLE), {});
  assert.deepEqual(restoreConsults(data, { ...w, season: 2 }, PEOPLE), {});
  assert.deepEqual(restoreConsults(data, { ...w, touched: [] }, PEOPLE), {});
  for (const bad of [undefined, [], { ...data, entries: { shen: { ...c, patience: 99 } } },
    { ...data, entries: { shen: { ...c, product: "constructor" } } },
    { ...data, entries: { shen: { ...c, known: ["made-up"] } } },
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

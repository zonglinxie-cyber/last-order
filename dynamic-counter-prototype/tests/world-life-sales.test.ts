// 「人生一步」接到柜台上的守卫。表里的每一条 shift 都必须真的改变接待结果，
// 三档 how 必须真的改到来访 / 拉客 / 带人 —— 撤掉 engine 或 visits 里任一处读取，这里要红。
import assert from "node:assert/strict";
import test from "node:test";
import { beginSlot, endDay, newWorld } from "../src/world/engine.ts";
import { LIFE_HOW_BIAS, LIFE_SALES, lifeArriveChance, lifeBringChance, lifePerson, lifeReferChance } from "../src/world/life-sales.ts";
import { PEOPLE } from "../src/world/content/people.ts";
import { STORYLETS } from "../src/world/content/index.ts";
import { affordableUnits, bestShelf, perfectShelf, SHELF_IDS } from "../src/world/shelf.ts";
import { serveTalk } from "../src/world/serve-talk.ts";
import { clientNotes, openConsult, rememberConsult, type Consult } from "../src/world/consult.ts";
import { visitPerson } from "../src/world/visits.ts";
import type { Person, World } from "../src/world/types.ts";

const personOf = (id: string): Person => PEOPLE.find(p => p.id === id)!;
const wq = (qualities: Record<string, number>, patch: Partial<World> = {}): World =>
  ({ ...newWorld("life-sales", PEOPLE), qualities, ...patch });

/** 接待结果：正中那支、最准那支、每支货买得起几件。任务书验收读的就是正中与件数上限。 */
const outcome = (world: World, person: Person): string => {
  const p = lifePerson(world, person);
  return JSON.stringify({
    perfect: perfectShelf(p),
    best: bestShelf(p),
    units: SHELF_IDS.map(id => affordableUnits(p, id)),
  });
};

test("表只写给有诉求表的客人，步数递增且不超第五格", () => {
  const entries = Object.entries(LIFE_SALES);
  assert.ok(entries.length >= 10, "表要盖到足够多的人，空表等于没接");
  for (const [id, steps] of entries) {
    const person = personOf(id);
    assert.ok(person?.skin, `${id} 没有诉求表，shift 写了也没人读`);
    let prev = 0;
    for (const e of steps!) {
      assert.ok(e.step > prev && e.step <= 5, `${id} 步数要递增且 ≤5`);
      prev = e.step;
      assert.ok(e.budget || e.units || e.focus, `${id} 第 ${e.step} 步是空 shift`);
      assert.ok(!e.focus || e.focus !== person.skin!.veto?.trait, `${id} 的 focus 不能撞她自己的忌讳`);
    }
  }
  const withOneAndFour = entries.filter(([, steps]) =>
    steps!.some(e => e.step === 1) && steps!.some(e => e.step === 4));
  assert.ok(withOneAndFour.length >= 2, "至少两位要在第 1 步与第 4 步都有 shift，验收字面才有的比");
});

test("表里每条都挂在真写了那一步的那张卡上：错一格就红", () => {
  // 这一条守的是账和话对不上：`lifeN-x` 写的是第 N 步，挂在第 N-1 步上的 shift
  // 会在她读到那句话之前就先改掉她的钱和量。注释里的引用不算数，引用必须是数据。
  for (const [id, steps] of Object.entries(LIFE_SALES)) {
    for (const e of steps!) {
      const card = STORYLETS.find(s => s.id === e.card);
      assert.ok(card, `${id} 引的 ${e.card} 不在内容目录里`);
      assert.ok(Object.values(card!.cast).some(s => s.id === id), `${e.card} 的 cast 里没有 ${id}`);
      const sets = [...new Set(card!.choices.flatMap(c => c.effects)
        .filter(x => "quality" in x && x.quality === `life:${id}` && x.set !== undefined)
        .map(x => (x as { set?: number }).set!))];
      assert.deepEqual(sets, [e.step],
        `${e.card} 写的是第 ${sets.join("/")} 步，表里挂在第 ${e.step} 步`);
    }
  }
});

test("每一条 shift 都真的改变接待结果", () => {
  for (const [id, steps] of Object.entries(LIFE_SALES)) {
    const person = personOf(id);
    for (const e of steps!) {
      const before = outcome(wq({ ["life:" + id]: e.step - 1 }), person);
      const after = outcome(wq({ ["life:" + id]: e.step }), person);
      assert.notEqual(after, before, `${id} 第 ${e.step} 步的 shift 没改变正中/最准/件数`);
    }
  }
});

test("同一位客人 life=1 与 life=4 的接待结果不同（任务书验收字面）", () => {
  for (const [id, steps] of Object.entries(LIFE_SALES)) {
    if (!steps!.some(e => e.step === 1) || !steps!.some(e => e.step === 4)) continue;
    const person = personOf(id);
    assert.notEqual(outcome(wq({ ["life:" + id]: 1 }), person), outcome(wq({ ["life:" + id]: 4 }), person), id);
  }
});

// 周末单（planWeekendOrder）与对面自己约客（engine 里那处撬客候选池）都要求「最准那支买得起」，
// 买不起的人不是被卖便宜货，是整条路直接把她剔掉 —— 界面上看不出任何不对。
// 所以人生那一步只许改她要什么、要几件，不许把她推到买不起自己最准那支的位置。
test("走到任何一步，她都还买得起自己最准那支", () => {
  let baseline = 0;
  for (const person of PEOPLE.filter(p => p.role === "customer" && p.skin)) {
    const base = lifePerson(wq({}), person);
    if (affordableUnits(base, bestShelf(base)) < 1) continue;   // 本来就不卖的，不归这张表管
    baseline++;
    for (let step = 1; step <= 5; step++) {
      const p = lifePerson(wq({ ["life:" + person.id]: step }), person);
      assert.ok(affordableUnits(p, bestShelf(p)) >= 1,
        `${person.name} 走到第 ${step} 步以后买不起自己最准那支（预算 ${p.skin!.budget}）`);
    }
  }
  assert.ok(baseline >= 20, `基线只有 ${baseline} 位买得起，这一条测不到点上`);
});

test("预算与件数按表累加，没走到或没表的人原样返回", () => {
  const noTable = PEOPLE.find(p => p.skin && !LIFE_SALES[p.id]);
  assert.ok(noTable, "找不到一位有诉求表却没进人生表的客人，这一条测不到点上");
  assert.equal(lifePerson(wq({}), noTable!), noTable);
  assert.equal(lifePerson(wq({ ["life:" + noTable!.id]: 5 }), noTable!), noTable, "没表的人被改了");
  for (const [id, steps] of Object.entries(LIFE_SALES)) {
    const person = personOf(id), base = person.skin!;
    assert.equal(lifePerson(wq({}), person), person, `${id} 一步没走就被改了`);
    for (const e of steps!) {
      const skin = lifePerson(wq({ ["life:" + id]: e.step }), person).skin!;
      const upto = steps!.filter(s => s.step <= e.step);
      assert.equal(skin.budget, Math.max(0, base.budget + upto.reduce((n, s) => n + (s.budget ?? 0), 0)),
        `${id} 第 ${e.step} 步的预算不是按表累加的`);
      assert.equal(skin.maxUnits, Math.max(1, base.maxUnits + upto.reduce((n, s) => n + (s.units ?? 0), 0)),
        `${id} 第 ${e.step} 步的件数上限不是按表累加的`);
      for (const s of upto) {
        if (!s.focus) continue;
        const d = skin.demands.find(x => x.trait === s.focus);
        assert.ok(d && d.want === 2 && d.weight === 2, `${id} 第 ${s.step} 步的 focus 没变成头等诉求`);
      }
    }
  }
});

test("visitPerson 先叠人生这一层：柜上读到的就是走到第几步的她", () => {
  const moved = Object.entries(LIFE_SALES).filter(([, steps]) => steps!.some(e => e.budget));
  assert.ok(moved.length, "表里没有一条改预算，这一条测不到点上");
  for (const [id, steps] of moved) {
    const person = personOf(id);
    const at = steps!.find(e => e.budget)!.step;
    const w = wq({ ["life:" + id]: at, ["life:" + id + ":how"]: 1 });
    assert.equal(visitPerson(w, person).skin!.budget, lifePerson(w, person).skin!.budget, `${id} 第 ${at} 步`);
    assert.notEqual(visitPerson(w, person).skin!.budget, person.skin!.budget, `${id} 第 ${at} 步：柜上读到的还是原来的钱`);
  }
  const [plainId] = Object.keys(LIFE_SALES);
  assert.equal(visitPerson(wq({}), personOf(plainId!)).skin!.budget, personOf(plainId!).skin!.budget,
    "一步没走也被改了");
});

test("人生那一步新添的头等事，柜上「还有没说的」也跟着多一条", () => {
  let appended = 0;
  for (const [id, steps] of Object.entries(LIFE_SALES)) {
    const person = personOf(id);
    for (const e of steps!) {
      if (!e.focus) continue;
      const before = lifePerson(wq({ ["life:" + id]: e.step - 1 }), person);
      const after = lifePerson(wq({ ["life:" + id]: e.step }), person);
      // 原本就有那一条的，这一步只是把它提到头等（`want` / `weight`），条数不变，不归这一条管。
      if (after.skin!.demands.length === before.skin!.demands.length) continue;
      appended++;
      const talk = (p: Person) => serveTalk(p.skin!.demands, 0, false);
      assert.equal(talk(after).unsaid, talk(before).unsaid + 1, `${id} 第 ${e.step} 步新添的头等事没进 serve-talk 的诉求条数`);
      assert.equal(talk(after).said.length, talk(before).said.length, `${id} 第 ${e.step} 步：看法没变，她肯说的条数不该变`);
    }
  }
  assert.ok(appended >= 2, `只有 ${appended} 条 focus 是新添的，这一条测不到点上`);
});

// `openConsult` 里那句「先叠人生这一层」是这一轮最靠玩家的一处接缝：抽掉它，规则测试一条都不红
// （接待面板照旧读原始诉求表，只有界面上的字少一条）。这一条把它钉住。
test("接待面板读的是叠过人生这一层的她：新添的头等事她开口就说", () => {
  let appended = 0;
  for (const [id, steps] of Object.entries(LIFE_SALES)) {
    const person = personOf(id);
    for (const e of steps!) {
      if (!e.focus) continue;
      const prev = lifePerson(wq({ ["life:" + id]: e.step - 1 }), person);
      if (lifePerson(wq({ ["life:" + id]: e.step }), person).skin!.demands.length === prev.skin!.demands.length) continue;
      appended++;
      // 看法给到 40 以上她全讲；不带当天来访情境（那一层会另外盖住今天的重点），只量人生这一层。
      const w = (step: number) => wq({ ["life:" + id]: step }, { opinion: { [id]: 50 } as World["opinion"] });
      const before = openConsult(w(e.step - 1), person);
      const after = openConsult(w(e.step), person);
      assert.ok(!before.known.includes(e.focus), `${id} 第 ${e.step - 1} 步不该已经有那条头等事`);
      assert.ok(after.known.includes(e.focus), `${id} 第 ${e.step} 步：接待面板读的还是原来那张诉求表`);
      assert.equal(after.lines.length, before.lines.length + 1, `${id} 第 ${e.step} 步：她开口说的条数没跟着多一条`);
    }
  }
  assert.ok(appended >= 2, `只有 ${appended} 条 focus 是新添的，这一条测不到点上`);
});

test("三档 how 的修正顺序：自己人 > 只剩生意 > 不留了", () => {
  const base = 0.5;
  const [id] = Object.keys(LIFE_SALES);
  const w = (how: number) => wq({ ["life:" + id]: 2, ["life:" + id + ":how"]: how });
  const arrive = (how: number) => lifeArriveChance(w(how), id!, base);
  assert.ok(arrive(1) > arrive(2) && arrive(2) > arrive(3));
  assert.equal(arrive(2), base);
  assert.ok(lifeReferChance(w(1), id!, 0.15) > 0.15);
  assert.ok(lifeReferChance(w(3), id!, 0.15) <= 0, "不留了的那一档永远约不成朋友");
  assert.equal(lifeBringChance(w(3), id!, 0.2), 0, "不留了的那一档不带人");
  assert.ok(lifeBringChance(w(1), id!, 0.2) > 0.2);
  assert.equal(LIFE_HOW_BIAS[2].arrive + LIFE_HOW_BIAS[2].refer + LIFE_HOW_BIAS[2].bring, 0);
});

test("engine 读到了 arrive 修正：同一副牌 60 个种子，自己人比不留了来得多", () => {
  // 挑一位真的会在第 3 天头一格露面的客人，不点名：点名就成了内容名单上的钉子。
  const guest = PEOPLE.find(p => p.role === "customer" && p.skin && p.visits.chance > 0
    && (p.visits.days as readonly number[]).includes(3) && p.visits.slots.includes(0));
  assert.ok(guest, "找不到一位第 3 天头一格会来的客人，这一条测不到点上");
  const count = (how: number) => {
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const w = beginSlot({ ...newWorld(`ls-arrive-${i}`, PEOPLE), day: 3, slot: 0,
        qualities: { ["life:" + guest!.id + ":how"]: how } }, PEOPLE);
      if (w.present[guest!.id]) n++;
    }
    return n;
  };
  const warm = count(1), cold = count(3);
  assert.ok(warm > cold, `how=1 来了 ${warm} 次，how=3 来了 ${cold} 次，arrive 修正没接上`);
});

test("engine 读到了 refer / bring 修正：不留了的那一档夜里一次都约不成", () => {
  // 盟友得是热心或念旧的客人（引擎那一条门），这里按这条门自己找人，不点名。
  const ally = PEOPLE.find(p => p.role === "customer"
    && (p.tempers.includes("warm") || p.tempers.includes("loyal")));
  const friend = PEOPLE.find(p => p.role === "customer" && p.id !== ally?.id);
  assert.ok(ally && friend, "找不到一位能当盟友的客人和她的一位熟人，这一条测不到点上");
  const night = (how: number) => {
    let refer = 0, bring = 0;
    for (let i = 0; i < 80; i++) {
      const w = endDay({ ...newWorld(`ls-night-${i}`, PEOPLE), day: 3, slot: 3,
        opinion: { [ally!.id]: 50 }, bonds: { [`${ally!.id}>${friend!.id}`]: 30 },
        qualities: { ["wechat:" + ally!.id]: 1, ["life:" + ally!.id + ":how"]: how } }, PEOPLE);
      for (const ap of w.appointments) {
        if (ap.referredBy === ally!.id) refer++;
        if (ap.person === ally!.id && ap.bring?.length) bring++;
      }
    }
    return { refer, bring };
  };
  const cold = night(3);
  assert.equal(cold.refer, 0, "how=3 还能替她拉客，refer 修正没接上");
  assert.equal(cold.bring, 0, "how=3 还能带朋友，bring 修正没接上");
  assert.ok(night(1).refer > 0, "how=1 八十副牌一次都没拉成，修正方向反了");
});

test("笔记认人生那一步添上的诉求，不认当天情境临时添的那一条", () => {
  // 人生那一步添上的头等事是她这个人的，问出来了要记住；当天来访情境临时添的那条只属于今天，
  // 记进长期笔记明天就成了假话。找一位"表里给她添了新诉求"的客人，再找一个当天添出别的诉求的情境。
  const entry = Object.entries(LIFE_SALES).map(([id, steps]) => {
    const person = personOf(id);
    const e = steps!.find(s => s.focus && !person.skin!.demands.some(d => d.trait === s.focus));
    return e ? { id, person, step: e.step, focus: e.focus! } : null;
  }).find(Boolean);
  assert.ok(entry, "表里没有一条给客人添新诉求，这一条测不到点上");
  const { id, person, step, focus } = entry!;
  const at = (code: number): World => wq({ ["life:" + id]: step,
    ["visit-context-day:" + id]: 2, ["visit-context-code:" + id]: code }, { season: 1, day: 2 });
  const permanent = lifePerson(at(0), person).skin!.demands.map(d => d.trait);
  assert.ok(permanent.includes(focus), "人生那一步没把这条诉求添上，这一条测不到点上");
  const today = [1, 2, 3, 4].map(code => ({ code,
    extra: visitPerson(at(code), person).skin!.demands.map(d => d.trait).filter(t => !permanent.includes(t)) }))
    .find(x => x.extra.length);
  assert.ok(today, "四种当天情境都添不出新诉求，这一条测不到点上");
  const w = at(today!.code);
  const consult: Consult = { ...openConsult(w, person), begun: true, known: [focus, ...today!.extra] };
  const next = rememberConsult(w, person, consult);
  assert.equal(next.qualities[`client-note:${id}:${focus}`], 1, "人生那一步添上的头等事，问出来了却记不住");
  for (const t of today!.extra) {
    assert.notEqual(next.qualities[`client-note:${id}:${t}`], 1, "当天情境临时添的那条不该进长期笔记");
  }
  assert.ok(clientNotes(next, lifePerson(next, person)).known.includes(focus), "存档里有，人物卡上念不出来");
});

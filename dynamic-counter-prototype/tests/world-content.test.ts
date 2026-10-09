// 人情场内容体检。引擎不在这里测，只核对人和故事碎片对得上契约。
import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMERS } from "../src/campaign.ts";
import { FESTIVALS, festivalsFor } from "../src/world/content/festivals.ts";
import { CIRCLES, PEOPLE } from "../src/world/content/people.ts";
import { STORYLETS } from "../src/world/content/index.ts";
import { ARC_PEOPLE } from "../src/world/progress.ts";
import { applyChoice, beginSlot, choiceVisible, doVerb, drawStorylet, endDay, newWorld, nextSeason } from "../src/world/engine.ts";
import { PLAYER, type Cond, type Effect, type Ref, type Storylet, type Temper, type World, type Zone } from "../src/world/types.ts";

const SEASON_DAYS = 28;
const TEMPERS: Temper[] = ["face", "wary", "warm", "gossip", "thrifty", "hasty", "loyal", "proud", "shy"];
const IDS = new Set(PEOPLE.map(p => p.id));
const RELATIONAL = (e: Effect) => "opinion" in e || "bond" in e || "remember" in e || "appoint" in e;

function walkCond(cond: Cond, refs: Ref[]) {
  if ("any" in cond) {
    for (const item of cond.any) walkCond(item, refs);
    return;
  }
  if ("not" in cond) {
    walkCond(cond.not, refs);
    return;
  }
  if ("present" in cond) refs.push(cond.present);
  else if ("absent" in cond) refs.push(cond.absent);
  else if ("opinion" in cond) refs.push(cond.opinion);
  else if ("bond" in cond) refs.push(cond.bond[0], cond.bond[1]);
  else if ("remembers" in cond) {
    refs.push(cond.remembers);
    if (cond.subject) refs.push(cond.subject);
  } else if ("temper" in cond) refs.push(cond.temper);
  else if ("role" in cond) refs.push(cond.role);
}

function walkEffect(effect: Effect, refs: Ref[]) {
  if ("remember" in effect) {
    refs.push(effect.remember.holder);
    if (effect.remember.subject) refs.push(effect.remember.subject);
  } else if ("appoint" in effect) {
    refs.push(effect.appoint.person);
    for (const id of effect.appoint.bring ?? []) refs.push(id);
  } else if ("leave" in effect) refs.push(effect.leave);
  else if ("opinion" in effect) refs.push(effect.opinion);
  else if ("bond" in effect) refs.push(effect.bond[0], effect.bond[1]);
}

function assertRef(ref: Ref, slots: Set<string>, where: string, social: boolean) {
  if (ref === "$self" || ref === PLAYER) return;
  if (ref.startsWith("$")) {
    assert.ok(slots.has(ref.slice(1)), `${where} 用了未声明的槽 ${ref}`);
    return;
  }
  if (social) assert.fail(`${where} 社交局写死了人物 ${ref}`);
  assert.ok(IDS.has(ref), `${where} 指向不存在的人 ${ref}`);
}

function placeholders(text: string, slots: Set<string>, where: string) {
  for (const hit of text.matchAll(/\{([^}]+)\}/g)) {
    const token = hit[1] ?? "";
    if (token === "player") continue;
    assert.match(token, /^\$[A-Za-z0-9_]+$/, `${where} 有未声明的占位 {${token}}`);
    assert.ok(slots.has(token.slice(1)), `${where} 的 {${token}} 没有对应角色槽`);
  }
}

test("人物、关系、脾气和主团", () => {
  assert.ok(PEOPLE.length >= 38 && PEOPLE.length <= 48, `人数 ${PEOPLE.length}`);
  assert.equal(new Set(PEOPLE.map(p => p.id)).size, PEOPLE.length, "人物 id 重复");

  const circleOf = new Map<string, string>();
  for (const [circle, members] of Object.entries(CIRCLES)) {
    for (const id of members) {
      assert.ok(IDS.has(id), `主团 ${circle} 里没有这个人：${id}`);
      assert.ok(!circleOf.has(id), `${id} 进了两个主团`);
      circleOf.set(id, circle);
    }
  }
  for (const person of PEOPLE) assert.ok(circleOf.has(person.id), `${person.name} 没有主团`);

  const temperCount = Object.fromEntries(TEMPERS.map(temper => [temper, 0])) as Record<Temper, number>;
  let bonds = 0;
  let cross = 0;
  for (const person of PEOPLE) {
    assert.ok(person.tempers.length >= 1 && person.tempers.length <= 2, `${person.name} 的脾气不是 1~2 个`);
    for (const temper of person.tempers) temperCount[temper] += 1;
    assert.ok(person.bonds.length >= 2, `${person.name} 的关系少于 2 条`);
    assert.equal(new Set(person.bonds.map(b => b.to)).size, person.bonds.length, `${person.name} 对同一个人写了两条`);
    const voice = [person.voice.greet, person.voice.pleased, person.voice.hurt, person.voice.praise, person.voice.complain];
    for (const line of voice) {
      assert.ok(line.trim().length > 0, `${person.name} 有空口吻`);
      for (const hit of line.matchAll(/\{([^}]+)\}/g)) {
        assert.ok(hit[1] === "player" || hit[1] === "x", `${person.name} 的口吻有未声明占位 {${hit[1]}}`);
      }
    }
    let crossed = 0;
    for (const bond of person.bonds) {
      assert.ok(IDS.has(bond.to), `${person.name} 的关系指向不存在的人 ${bond.to}`);
      assert.ok(bond.warmth >= -100 && bond.warmth <= 100, `${person.name} → ${bond.to} 冷暖出界`);
      const back = PEOPLE.find(p => p.id === bond.to)?.bonds.some(b => b.to === person.id);
      assert.ok(back, `${person.name} → ${bond.to} 没有回指`);
      if (circleOf.get(bond.to) !== circleOf.get(person.id)) crossed += 1;
      bonds += 1;
    }
    assert.ok(crossed >= 1, `${person.name} 没有跨团关系`);
    cross += crossed;
    if (person.skin?.buysFor) assert.ok(IDS.has(person.skin.buysFor), `${person.name} 的 buysFor 找不到人`);
    for (const cond of person.secret?.reveal ?? []) {
      const refs: Ref[] = [];
      walkCond(cond, refs);
      for (const ref of refs) assertRef(ref, new Set(), `${person.name} 的秘密`, false);
    }
    const days = person.visits.days;
    if (days !== "any") for (const day of days) assert.ok(day >= 1 && day <= 7, `${person.name} 的来访日`);
    for (const slot of person.visits.slots) assert.ok(slot >= 0 && slot <= 3);
    assert.ok(person.visits.chance >= 0 && person.visits.chance <= 1, person.name);
    for (const festival of person.visits.festivals ?? []) {
      assert.ok(FESTIVALS.some(item => item.id === festival), `${person.name} 的节日 ${festival} 没有声明`);
    }
  }
  for (const temper of TEMPERS) assert.ok(temperCount[temper] >= 3, `${temper} 只有 ${temperCount[temper]} 人`);
  assert.ok(bonds >= 80, `关系条数 ${bonds}`);
  assert.ok(cross >= 40, `跨团 ${cross}`);
});

test("旧人物的名字、皮肤和立绘沿用 campaign", () => {
  const customers = ["shen", "mei", "xiaoyu", "zhao", "anjie", "zhou", "duan"] as const;
  for (const id of customers) {
    const person = PEOPLE.find(p => p.id === id);
    const customer = CUSTOMERS[id];
    assert.ok(person, id);
    assert.equal(person.name, customer.name);
    assert.equal(person.role, "customer");
    assert.deepEqual(person.skin?.demands, customer.demands);
    assert.deepEqual(person.skin?.veto, customer.veto);
    assert.equal(person.skin?.budget, customer.budget);
    assert.equal(person.skin?.maxUnits, customer.maxUnits);
    assert.ok(person.portrait?.includes(`customer-${id}-consultation.png`), person.portrait);
  }
  for (const [id, file] of [
    ["roman", "roman.png"], ["suman", "suman.png"], ["tangke", "tangke.png"],
    ["fangmin", "fangmin.png"], ["luyao", "luyao.png"],
  ] as const) {
    const person = PEOPLE.find(p => p.id === id);
    assert.ok(person?.portrait?.includes(`staff-portraits/${file}`), id);
  }
  assert.equal(PEOPLE.find(p => p.id === "luyao")?.role, "rival");
  for (const id of ["qiaowan", "peilan", "roman", "suman", "tangke", "fangmin"]) {
    assert.equal(PEOPLE.find(p => p.id === id)?.role, "staff", id);
  }
  for (const id of ["ligui", "laokang", "huojie"]) assert.equal(PEOPLE.find(p => p.id === id)?.role, "mall", id);
});

test("一季 28 天里有 520、618、七夕", () => {
  assert.ok(FESTIVALS.length >= 2 && FESTIVALS.length <= 3);
  const ids = FESTIVALS.map(item => item.id);
  assert.deepEqual(new Set(ids).size, ids.length);
  for (const need of ["520", "618", "qixi"]) assert.ok(ids.includes(need), need);
  for (const festival of FESTIVALS) {
    assert.ok(festival.fromDay >= 1 && festival.toDay <= SEASON_DAYS && festival.fromDay <= festival.toDay, festival.id);
  }
});

test("节日按季取：四季各一套，第 5 季起循环", () => {
  assert.deepEqual(festivalsFor(1), FESTIVALS, "第 1 季就是 FESTIVALS");
  const two = festivalsFor(2).map(f => f.id);
  for (const need of ["double11", "double12", "yearend"]) assert.ok(two.includes(need), need);
  assert.equal(new Set(two).size, two.length, "第 2 季节日 id 不重复");
  for (const festival of festivalsFor(2)) {
    assert.ok(festival.fromDay >= 1 && festival.toDay <= SEASON_DAYS && festival.fromDay <= festival.toDay, festival.id);
  }
  const three = festivalsFor(3).map(f => f.id);
  for (const need of ["valentine", "womens", "spring"]) assert.ok(three.includes(need), need);
  const four = festivalsFor(4).map(f => f.id);
  for (const need of ["school", "midautumn", "national"]) assert.ok(four.includes(need), need);
  for (const festival of [...festivalsFor(3), ...festivalsFor(4)]) {
    assert.ok(festival.fromDay >= 1 && festival.toDay <= SEASON_DAYS && festival.fromDay <= festival.toDay, festival.id);
  }
  const year = [1, 2, 3, 4].flatMap(n => festivalsFor(n).map(f => f.id));
  assert.equal(new Set(year).size, year.length, "一年里的节日 id 不重复");
  assert.deepEqual(festivalsFor(5), festivalsFor(1), "第 5 季循环回第 1 季");
  assert.deepEqual(festivalsFor(6), festivalsFor(2), "第 6 季循环回第 2 季");
  assert.deepEqual(festivalsFor(7), festivalsFor(3), "第 7 季循环回第 3 季");
});

test("个人线走到终点的，换季以后那条线的卡不再抽得到", () => {
  // 五条个人线全走到落点：arc:<id>:end 跟着换季带过去，下一季所有 arc 卡都该被条件挡住。
  const ended = {
    ...newWorld("arc-done", PEOPLE),
    day: 28,
    qualities: {
      "arc:shen": 3, "arc:shen:end": 2, "arc:anjie": 3, "arc:anjie:end": 4,
      "arc:luyao": 3, "arc:luyao:end": 1, "arc:suman": 3, "arc:suman:end": 3,
      "arc:mei": 3, "arc:mei:end": 1,
    },
  };
  const w: World = nextSeason(ended, PEOPLE);
  assert.equal(w.day, 1, "换季后天数回到 1");
  assert.equal(w.season, 2);
  const all = Object.fromEntries(PEOPLE.map(p => [p.id, "atrium" as Zone]));
  const seasonOneArc = /^arc-(shen|anjie|luyao|suman|mei)-/;
  for (let i = 0; i < 20; i++) {
    const { drawn } = drawStorylet({ ...w, seed: `arc-done-${i}`, present: { ...all } }, PEOPLE, STORYLETS);
    assert.ok(!drawn || !seasonOneArc.test(drawn.storylet.id),
      `第 2 季还抽到了已终结的个人线 ${drawn?.storylet.id}`);
  }
});

test("个人线名册双向对得上：卡写的落点都在档案里，档案里每个人都真有落点卡", () => {
  // 单向只测一半会漏：新增一条线忘了登记 ARC_PEOPLE，走完以后跨季档案和季末回顾都念不出她；
  // 反过来名册里挂着一个没有落点卡的人，档案那一页永远是空的。
  const ends = new Map<string, number[]>();
  for (const card of STORYLETS)
    for (const choice of card.choices)
      for (const effect of choice.effects) {
        if (!("quality" in effect) || typeof effect.set !== "number") continue;
        const landed = /^arc:([^:]+):end$/.exec(effect.quality);
        if (!landed) continue;
        const list = ends.get(landed[1]!) ?? [];
        if (!list.includes(effect.set)) ends.set(landed[1]!, [...list, effect.set]);
      }
  for (const [id, list] of ends)
    assert.ok(ARC_PEOPLE.includes(id), `卡给 ${id} 写了 ${list.length} 个落点，ARC_PEOPLE 里没有她 —— 档案念不出这条线`);
  for (const id of ARC_PEOPLE) assert.ok(ends.has(id), `档案里挂着 ${id} 的个人线，却没有一张卡能落到点上`);
});

/** 每条个人线在第几季开张（判据同 tests/world-sim.ts：第 1 张卡上那道 season 门槛）。 */
const lineSeason = (id: string): number => {
  const openers = STORYLETS.filter(s => s.kind === "arc"
    && s.when.some(c => "not" in c && (c.not as { quality?: unknown }).quality === `arc:${id}`
      && (c.not as { gte?: unknown }).gte === 1));
  return openers.reduce((max, s) => {
    const gate = s.when.find(c => "season" in c) as { season?: { gte?: number } } | undefined;
    return Math.max(max, gate?.season?.gte ?? 1);
  }, 1);
};

test("梅女士的十分钟：一路给她时间，一季之内必定走到反转和落点", () => {
  // 「人物线太乱、每条线不够完整」的验收方式：不数卡片数，直接拿引擎跑十二副牌。
  // 抽到自己线上的卡按指定选项走（那颗按不了退到备选），跑完必须看见 arc:mei:end。
  // 柜上抽到的别人的卡也必须落一手：界面上除了「一颗都按不动」以外没有第二条出路（WorldGame 那句
  // 「先记下这一幕」只在 storyChoices 为空时才出现）。丢着不按是引擎到不了的状态 —— 那张卡的 fired
  // 永远不写，同一条线的第一章能整季反复占着柜（上一版 11/12 就是这么来的，不是说书人偏心）。
  const route = new Map<string, string[]>([
    ["arc-mei-ten", ["十分钟里只讲一支"]],
    ["arc-mei-late", ["再给她十分钟"]],
    ["arc-mei-form", ["让她自己说完", "把表推回去，不问"]],
    ["arc-mei-end", ["这一支是给她自己的", "这单做完，不问下一次"]],
  ]);
  const seasonOne = ARC_PEOPLE.filter(id => lineSeason(id) === 1);

  let landed = 0;
  const unfinished: string[] = [];
  for (let i = 0; i < 12; i++) {
    let w = newWorld(`mei-line-${i}`, PEOPLE);
    while (w.day <= SEASON_DAYS) {
      for (let slot = 0; slot < 4; slot++) {
        w = beginSlot({ ...w, slot: slot as 0 | 1 | 2 | 3 }, PEOPLE, festivalsFor(1));
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        // 「一路给她时间」在真实游戏里不只是等她开口：她站到柜前，你先招呼一句 ——
        // 那一句花体力，也正是「她明天还来不来」的那一步。完全不招呼的玩家不能当验收基线。
        if (w.present["mei"] === "counter") w = doVerb(w, PEOPLE, "greet", ["mei"]);
        if (!drawn) continue;
        const labels = route.get(drawn.storylet.id) ?? drawn.storylet.choices.map(c => c.label);
        const choice = labels
          .map(label => drawn.storylet.choices.find(c => c.label === label))
          .find((c): c is Storylet["choices"][number] => !!c && choiceVisible(w, PEOPLE, drawn, c))
          ?? drawn.storylet.choices.find(c => choiceVisible(w, PEOPLE, drawn, c));
        if (!choice) continue;
        w = applyChoice(w, PEOPLE, drawn, drawn.storylet.choices.indexOf(choice));
      }
      w = endDay(w, PEOPLE);
    }
    for (const id of seasonOne)
      if ((w.qualities[`arc:${id}:end`] ?? 0) < 1) unfinished.push(`${id}@种子${i}`);
    if ((w.qualities["arc:mei:end"] ?? 0) >= 1) {
      landed++;
      assert.ok(w.qualities["secret-known:mei"], `种子 ${i}：走到了落点却没揭开那句「明早要见客户」`);
    }
  }
  assert.equal(landed, 12, "十二副牌跑完整季，有种子一次都没能走到梅女士的终点");
  assert.deepEqual(unfinished, [],
    `第 1 季挂着的线里有这些没能走完：${unfinished.join("、")}（线数或节奏变了先改 docs/人情场设计.md「一季讲几条线」）`);
});

test("第 2 季才开的那几条线：连着玩两季，每一条都开得了张、走得到落点", () => {
  // 「没玩就结束了」不止是第 1 季的事：第 2 季如果只把上一季的人再念一遍，玩家看到的是一层楼在重复。
  // 这一条把三条新线（尹小姐、段小姐、赵宁）和原有的四条一起钉在第 2 季那张名单上。
  const later = ARC_PEOPLE.filter(id => lineSeason(id) === 2);
  assert.deepEqual(later, ["yinxiaojie", "duan", "zhaoning", "tangke", "roman", "fangmin", "qiaowan"],
    "第 2 季开张的线名单变了 —— 改这条之前先改 docs/人情场设计.md「一季讲几条线」");

  const played = (world: World) => {
    let w = world;
    while (w.day <= SEASON_DAYS) {
      for (const slot of [0, 1, 2, 3] as const) {
        w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
        for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        // 每条线都按「玩家顺着她」走：拿第一个看得见的选项，不预设哪条线该被偏爱。
        const idx = drawn ? drawn.storylet.choices.findIndex(c => choiceVisible(w, PEOPLE, drawn, c)) : -1;
        if (!drawn || idx < 0) continue;
        w = applyChoice(w, PEOPLE, drawn, idx);
      }
      w = endDay(w, PEOPLE);
    }
    return w;
  };

  let landed = 0;
  for (let i = 0; i < 6; i++) {
    let w = played(newWorld(`s2-lines-${i}`, PEOPLE));
    w = played(nextSeason(w, PEOPLE));
    assert.equal(w.season, 2, `种子 ${i}：换季没走到第 2 季`);
    const none = later.filter(id => (w.qualities[`arc:${id}`] ?? 0) < 1);
    assert.equal(none.length, 0, `种子 ${i}：第 2 季这 ${none.length} 条线一次都没开张（${none.join(", ")}）`);
    if (later.every(id => (w.qualities[`arc:${id}:end`] ?? 0) >= 1)) landed++;
  }
  assert.equal(landed, 6, "六副牌连着跑两季，有种子没把第 2 季那几条线走到落点");
});

/** 这个人一季预期能站上楼层几个时段（判据照 beginSlot 里访客那一段：日子 = 一周第几天、时段在她的 slots 里、fromDay 之后、按 chance 计权）。 */
const floorChances = (id: string): number => {
  const v = PEOPLE.find(p => p.id === id)?.visits;
  if (!v) return 0;
  if (v.festivals) return Infinity; // 只在节日窗口里来的人另算：那一格是节日给的，不在这里比
  let n = 0;
  for (let day = 1; day <= SEASON_DAYS; day++) {
    if (v.fromDay !== undefined && day < v.fromDay) continue;
    const dow = ((day - 1) % 7) + 1;
    if (v.days !== "any" && !v.days.includes(dow)) continue;
    n += v.slots.length * v.chance;
  }
  return n;
};

test("被故事点名的那个人得上得了楼：个人线开头卡与主线线索卡的在场期望有下限", () => {
  // 这一条管的是「写了却碰不见」：开头那一张和主线的线索卡都只能在她在场的那一柜抽得到，
  // 她整季不来，卡就整季不存在 —— 跟抽签名额、跟玩家怎么选都无关。
  // 量过的两个反面（40 种子 × 4 风格，2026-10-09）：赵宁 days [6,7] × slots [1] × 0.4 = 3.2 格
  // → 她的线 148/160，掉的 12 副全是「整季没遇见过她」而不是走到一半停住；尹小洁 9% 的时段在场
  // → main-slip-yin 只讲到 49/160，主线本子停在 2/4。
  const thin: string[] = [];
  for (const story of STORYLETS) {
    if (story.kind !== "arc" && story.kind !== "mainline") continue;
    for (const slot of Object.values(story.cast)) {
      const id = slot.id;
      if (!id) continue;
      const person = PEOPLE.find(p => p.id === id);
      if (!person || person.role !== "customer") continue; // 同事、对面、商场的人天天在楼层上
      const opener = story.kind === "arc" && story.when.some(c => "not" in c
        && (c.not as { quality?: unknown }).quality === `arc:${id}` && (c.not as { gte?: unknown }).gte === 1);
      if (story.kind !== "mainline" && !opener) continue;
      const n = floorChances(id);
      if (n < 8) thin.push(`${story.id} 点名的${person.name}一季只有 ${n.toFixed(1)} 格`);
    }
  }
  assert.deepEqual(thin, [], `这些卡要靠她开口，但她上不了几次楼：${thin.join("；")}`);
});

test("主线本子：四条线索不是收藏册，但一副牌至少摸到两条、多数牌摸到三条", () => {
  // 反转要有料：本子上只有两条时，「名字在谁手里」那一张是把四选一压成二选一。
  // 十二副牌各跑两季（每张抽到的卡都落一手，判据同「梅女士的十分钟」），数每副牌讲到的线索卡张数。
  const CLUES = ["main-slip-shen", "main-slip-song", "main-slip-yin", "main-slip-fang"];
  const played = (start: World) => {
    let w = start;
    const seen = new Set<string>();
    while (w.day <= SEASON_DAYS) {
      for (const slot of [0, 1, 2, 3] as const) {
        w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
        for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        if (!drawn) continue;
        if (CLUES.includes(drawn.storylet.id)) seen.add(drawn.storylet.id);
        const idx = drawn.storylet.choices.findIndex(c => choiceVisible(w, PEOPLE, drawn, c));
        if (idx < 0) continue;
        w = applyChoice(w, PEOPLE, drawn, idx);
      }
      w = endDay(w, PEOPLE);
    }
    return { w, seen };
  };

  const hist = new Map<number, number>();
  for (let i = 0; i < 12; i++) {
    const run = played(newWorld(`slip-clues-${i}`, PEOPLE));
    const next = played(nextSeason(run.w, PEOPLE));
    for (const id of next.seen) run.seen.add(id);
    const n = run.seen.size;
    hist.set(n, (hist.get(n) ?? 0) + 1);
    assert.ok(n >= 2, `种子 ${i}：整季两副只摸到 ${n} 条线索，本子上撑不起一次反转`);
  }
  const threeOrMore = [...hist.entries()].filter(([n]) => n >= 3).reduce((a, [, c]) => a + c, 0);
  // 量过的两端：改之前 7/12 副（2 条×5、3 条×4、4 条×3），改之后 10/12 副（2 条×2、3 条×9、4 条×1）。
  // 门槛钉在 8：留两副余量，哪天真把在场或 weight 动坏了，这一条先报红。
  assert.ok(threeOrMore >= 8, `十二副牌里只有 ${threeOrMore} 副摸到三条以上线索（${[...hist.entries()].sort().map(([n, c]) => `${n} 条×${c} 副`).join(" ")}）`
    + " —— 在场期望或线索卡的 weight 被动过，回看 docs/人情场设计.md「主线本子上有几条线索」");
});

test("故事碎片的槽、占位、落点和关系效果", () => {
  assert.equal(new Set(STORYLETS.map(s => s.id)).size, STORYLETS.length, "故事 id 重复");
  const count = { social: 0, arc: 0, floor: 0, mainline: 0 };
  const tension = { [-1]: 0, 0: 0, 1: 0 };
  const arcCards = new Map<string, number>();
  const arcEnds = new Map<string, Set<number>>();

  const festivalIds = new Set([1, 2, 3, 4].flatMap(n => festivalsFor(n).map(item => item.id)));
  for (const story of STORYLETS) {
    count[story.kind] += 1;
    tension[story.tension] += 1;
    assert.ok(story.choices.length >= 2, story.id);
    const slots = new Set(Object.keys(story.cast));
    const social = story.kind === "social";
    const refs: Ref[] = [];
    for (const cond of story.when) walkCond(cond, refs);
    for (const slot of Object.values(story.cast)) for (const cond of slot.where) walkCond(cond, refs);
    placeholders(story.text, slots, story.id);
    if (social) assert.ok(story.choices.some(choice => (choice.when?.length ?? 0) > 0), `${story.id} 没有按条件分叉`);
    for (const choice of story.choices) {
      assert.ok(choice.effects.some(RELATIONAL), `${story.id} / ${choice.label} 没有改关系网`);
      for (const cond of choice.when ?? []) walkCond(cond, refs);
      placeholders(choice.label, slots, `${story.id} 选项`);
      placeholders(choice.result, slots, `${story.id} 结果`);
      for (const effect of choice.effects) {
        walkEffect(effect, refs);
        if ("log" in effect) placeholders(effect.log, slots, `${story.id} 记录`);
        if ("quality" in effect && effect.set !== undefined) {
          const end = /^arc:([^:]+):end$/.exec(effect.quality);
          if (end) {
            const bag = arcEnds.get(end[1] ?? "") ?? new Set<number>();
            bag.add(effect.set);
            arcEnds.set(end[1] ?? "", bag);
          }
        }
      }
    }
    for (const ref of refs) assertRef(ref, slots, story.id, social);
    for (const cond of story.when) {
      if ("festival" in cond) assert.ok(festivalIds.has(cond.festival), `${story.id} 的节日 ${cond.festival}`);
    }
    if (story.kind === "arc") {
      const qualities: string[] = [];
      const take = (cond: Cond) => {
        if ("any" in cond) cond.any.forEach(take);
        else if ("not" in cond) take(cond.not);
        else if ("quality" in cond && cond.quality.startsWith("arc:")) qualities.push(cond.quality);
      };
      for (const cond of story.when) take(cond);
      const arc = /^arc:([^:]+)/.exec(qualities[0] ?? "");
      assert.ok(arc, `${story.id} 没有 arc:<id>`);
      arcCards.set(arc[1] ?? "", (arcCards.get(arc[1] ?? "") ?? 0) + 1);
    }
  }

  assert.ok(count.social >= 24, `社交局 ${count.social}`);
  assert.ok(count.floor >= 8, `楼层 ${count.floor}`);
  assert.ok(count.arc >= 12, `个人线 ${count.arc}`);
  // 主线以前不在这个名目里：count["mainline"] 一直是 NaN，池子清点念不到那 11 张 spine 卡。
  assert.ok(count.mainline >= 11, `主线 ${count.mainline}`);
  assert.ok(tension[-1] > 0 && tension[0] > 0 && tension[1] > 0, "张力要有冲突也要有缓和");
  assert.ok(arcCards.size >= 4, `个人线人数 ${arcCards.size}`);
  for (const [id, cards] of arcCards) {
    assert.ok(cards >= 3, `${id} 只有 ${cards} 张`);
    const ends = arcEnds.get(id);
    assert.ok(ends && ends.size >= 2, `${id} 的落点只有 ${ends ? [...ends].join(",") : "没有"}`);
  }
});

test("同名选项互斥且全覆盖：任何一对人，介绍那张卡恰好只露出一颗'引到同一面镜子前'", async () => {
  const { choiceVisible, newWorld } = await import("../src/world/engine.ts");
  const card = STORYLETS.find(s => s.id === "social-intro-mirror")!;
  const label = "把两个人引到同一面镜子前";
  const w = newWorld("intro-mirror", PEOPLE);
  for (const a of PEOPLE) for (const b of PEOPLE) {
    if (a.id === b.id) continue;
    const drawn = { storylet: card, binding: { a: a.id, b: b.id } };
    const shown = card.choices.filter(c => c.label === label && choiceVisible(w, PEOPLE, drawn, c)).length;
    assert.equal(shown, 1, `${a.id} × ${b.id} 露出 ${shown} 颗`);
  }
});

test("第 2 季同名选项互斥且全覆盖", async () => {
  const { choiceVisible, newWorld } = await import("../src/world/engine.ts");
  const w = newWorld("s2-labels", PEOPLE);

  const hand = STORYLETS.find(s => s.id === "s2-d11-hand")!;
  const handLabel = "把到手价念完";
  for (const person of PEOPLE) {
    const drawn = { storylet: hand, binding: { a: person.id } };
    const shown = hand.choices.filter(c => c.label === handLabel && choiceVisible(w, PEOPLE, drawn, c)).length;
    assert.equal(shown, 1, `${person.id} 的到手价露出 ${shown} 颗`);
  }

  const unload = STORYLETS.find(s => s.id === "arc-qiaowan-unload")!;
  const unloadLabel = "让她把那句卸掉";
  for (const secret of [0, 1]) {
    const world = { ...w, qualities: secret ? { "secret-known:qiaowan": 1 } : {} };
    const drawn = { storylet: unload, binding: { a: "qiaowan" } };
    const shown = unload.choices.filter(c => c.label === unloadLabel && choiceVisible(world, PEOPLE, drawn, c)).length;
    assert.equal(shown, 1, `乔晚秘密 ${secret} 露出 ${shown} 颗`);
  }

  const who = STORYLETS.find(s => s.id === "arc-fangmin-who")!;
  const whoLabel = "问她缺口是谁的";
  for (const secret of [0, 1]) {
    const world = { ...w, qualities: secret ? { "secret-known:fangmin": 1 } : {} };
    const drawn = { storylet: who, binding: { a: "fangmin" } };
    const shown = who.choices.filter(c => c.label === whoLabel && choiceVisible(world, PEOPLE, drawn, c)).length;
    assert.equal(shown, 1, `方敏秘密 ${secret} 露出 ${shown} 颗`);
  }
});

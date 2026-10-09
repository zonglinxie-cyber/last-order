import assert from "node:assert/strict";
import test from "node:test";
import {
  absDay, applyChoice, clueIds, drawStorylet, evalCond, hasClue, learnClue,
  newWorld, nextSeason, setQuality,
} from "../src/world/engine.ts";
import { CLUES, CLUE_THREADS, PEOPLE, STORYLETS, isClueId, isThreadId, threadKey } from "../src/world/content/index.ts";
import type { Cond, PersonId, World } from "../src/world/types.ts";
import { MAINLINE_ACTS, MAINLINE_ACT_KEY } from "../src/world/content/clues.ts";
import { emptyWorldProgress, observeWorldProgress, parseWorldProgress } from "../src/world/progress.ts";

// 主线与线索本的规则层体检：引擎那一小块（clue 条件/效果/跨季）+ 内容那几条纪律
// （反转必须有本子才按得出来、但主线又不能被本子卡死）。

const at = (patch: Partial<World>): World => ({ ...newWorld("t", PEOPLE), ...patch });

/** 把 any / not 嵌套摊平，好一眼看清这张卡到底引用了哪些条件。 */
function flatten(conds: Cond[]): Cond[] {
  const out: Cond[] = [];
  for (const c of conds) {
    out.push(c);
    if ("any" in c) out.push(...flatten(c.any));
    if ("not" in c) out.push(...flatten([c.not]));
  }
  return out;
}

const cluesInConds = (conds: Cond[]): string[] => flatten(conds).flatMap(c => ("clue" in c ? [c.clue] : []));
const cluesInEffects = (card: (typeof STORYLETS)[number]): string[] =>
  card.choices.flatMap(ch => ch.effects).flatMap(e => ("clue" in e ? [e.clue] : []));
/** 这张卡把哪条线拧到哪一档（set 到 ≥1 才算拧）。 */
const threadSets = (card: (typeof STORYLETS)[number]) =>
  card.choices.flatMap(ch => ch.effects)
    .flatMap(e => "quality" in e && e.quality.startsWith("thread:") && typeof e.set === "number" && e.set >= 1 ? [{ thread: e.quality.slice("thread:".length), landing: e.set }] : []);

test("引擎：{clue} 效果把「学到的那一天」记进本子，绝对天数跨季连着数", () => {
  const w = learnClue(at({ season: 1, day: 3 }), "slip-hand");
  assert.equal(w.qualities["clue:slip-hand"], 3);
  assert.equal(absDay(at({ season: 2, day: 5 })), 33);
  const later = learnClue(at({ season: 2, day: 5 }), "slip-hand");
  assert.equal(later.qualities["clue:slip-hand"], 33, "本子上已经有这一条，值不该被后面的日子改写");
});

test("引擎：{clue} 条件只认本子上有的；不在表里的 id 永远不成立", () => {
  const bare = at({});
  assert.equal(evalCond(bare, PEOPLE, { clue: "slip-hand" }), false);
  assert.equal(evalCond(learnClue(bare, "slip-hand"), PEOPLE, { clue: "slip-hand" }), true);
  assert.equal(evalCond(setQuality(bare, "clue:ghost", 4), PEOPLE, { clue: "ghost" }), true, "引擎只认旗，id 是否在册由内容体检守");
  assert.equal(hasClue(bare, "slip-hand"), false);
});

test("引擎：clueIds 按学到的那天排，界面念得出先后", () => {
  let w = at({ season: 1, day: 20 });
  w = learnClue(w, "slip-gap");
  w = at({ ...w, season: 1, day: 4 });
  w = learnClue(w, "slip-hand");
  w = at({ ...w, season: 1, day: 9 });
  w = learnClue(w, "slip-borrowed");
  assert.deepEqual(clueIds(w), ["slip-hand", "slip-borrowed", "slip-gap"]);
});

test("跨季：本子、落点、幕号都带进下一季；一季自己的旗不带", () => {
  let w = at({ season: 1, day: 12 });
  w = setQuality(w, "clue:slip-hand", 12);
  w = setQuality(w, threadKey("return-slip"), 2);
  w = setQuality(w, MAINLINE_ACT_KEY, 2);
  w = setQuality(w, "season-only:whatever", 7);
  w = setQuality(w, "storyteller:heat", 3);
  const next = nextSeason(w, PEOPLE);
  assert.equal(next.season, 2);
  assert.equal(next.qualities["clue:slip-hand"], 12);
  assert.equal(next.qualities[threadKey("return-slip")], 2);
  assert.equal(next.qualities[MAINLINE_ACT_KEY], 2);
  assert.equal(next.qualities["season-only:whatever"], undefined);
  assert.equal(next.qualities["storyteller:heat"], undefined);
});

test("内容：本子上每一条线索都有卡会发给你，不留死线索", () => {
  const produced = new Set(STORYLETS.flatMap(cluesInEffects));
  for (const clue of CLUES) assert.ok(produced.has(clue.id), `线索「${clue.id}」没有任何卡会给出`);
  for (const id of produced) assert.ok(isClueId(id), `卡发出了本子上没有的线索「${id}」`);
});

test("内容：条件里引用的线索与线都在表里", () => {
  for (const card of STORYLETS) {
    for (const id of cluesInConds(card.when)) assert.ok(isClueId(id), `${card.id} 认了不在册的线索「${id}」`);
    for (const c of flatten(card.when)) {
      if ("quality" in c && c.quality.startsWith("thread:")) {
        assert.ok(isThreadId(c.quality.slice("thread:".length)), `${card.id} 认了不在册的线「${c.quality}」`);
      }
    }
    for (const s of threadSets(card)) assert.ok(isThreadId(s.thread), `${card.id} 拧了不在册的线「${s.thread}」`);
  }
});

test("内容：拧线必须有本子 —— 没线索的收法只能是那一季快过完的阀门", () => {
  const VALE_DAY = 20;
  for (const card of STORYLETS) {
    if (threadSets(card).length === 0) continue;
    const dayFloor = Math.max(0, ...flatten(card.when).flatMap(c => ("day" in c ? [c.day.gte ?? 0] : [])));
    if (cluesInConds(card.when).length > 0) continue;
    assert.ok(dayFloor >= VALE_DAY,
      `${card.id} 不收线索就能把线拧到 ${JSON.stringify(threadSets(card))}：反转必须靠本子上攒来的东西，要么就是 ${VALE_DAY} 天以后的收档阀门`);
  }
});

test("内容：每条能拧动的线既有查证那一面，也有不卡死那一面", () => {
  for (const thread of CLUE_THREADS) {
    const cards = STORYLETS.filter(c => threadSets(c).some(s => s.thread === thread.id));
    assert.ok(cards.length > 0, `线「${thread.id}」没有任何卡能拧过去`);
    const gated = cards.filter(c => cluesInConds(c.when).length > 0);
    const valve = cards.filter(c => cluesInConds(c.when).length === 0);
    assert.ok(gated.length > 0, `线「${thread.id}」只有一句话不说也能翻的卡，攒线索没有意义`);
    assert.ok(valve.length > 0, `线「${thread.id}」没有阀门：这一季没攒够线索就永远卡在这幕`);
  }
});

test("内容：主线卡都钉死在某一幕，每一幕都有人抬上去", () => {
  const mains = STORYLETS.filter(c => c.kind === "mainline");
  assert.ok(mains.length > 0, "主线一张卡都没有");
  const wanted = new Set<number>();
  const raised = new Set<number>();
  for (const card of mains) {
    const acts = flatten(card.when).flatMap(c => "quality" in c && c.quality === MAINLINE_ACT_KEY ? [c.eq] : []);
    assert.ok(acts.length > 0, `${card.id} 没写它属于第几幕，会跟下一幕的卡一起进牌堆`);
    for (const a of acts) if (a !== undefined) wanted.add(a);
    for (const e of card.choices.flatMap(ch => ch.effects)) {
      if ("quality" in e && e.quality === MAINLINE_ACT_KEY && typeof e.set === "number") raised.add(e.set);
    }
  }
  for (const a of wanted) {
    if (a === 0) continue;
    assert.ok(raised.has(a), `第 ${a} 幕的卡摆在牌堆里，却没有任何卡把幕号抬到 ${a}`);
    assert.ok(a <= MAINLINE_ACTS.length, `第 ${a} 幕还没写进 MAINLINE_ACTS，界面念不出这一幕叫什么`);
  }
  assert.deepEqual(mains.map(c => c.id).filter((id, i, all) => all.indexOf(id) !== i), [], "主线卡 id 重复");
});

test("内容：幕一每张往本子上添东西的卡都留着「顺着本子再问一句」这条路", () => {
  // 幕一是攒线索去翻面的那一段：这一段的卡不许只认「你跟她熟到什么地步」。
  // 模拟器实测那种门槛会让翻面率从 61% 掉到 21% —— 剧情不是玩家不想看，是走不到跟前。
  // 幕二之后的卡不受这条约束：线已经翻过来了，那一张本来就是奖励。
  const clueRoute = (conds: Cond[]) =>
    flatten(conds).some(c => "any" in c && c.any.some(x => "clue" in x));
  const emitters = STORYLETS.filter(c => c.kind === "mainline" && cluesInEffects(c).length > 0);
  assert.ok(emitters.length > 1);
  for (const card of emitters) {
    const act = flatten(card.when).find(c => "quality" in c && c.quality === MAINLINE_ACT_KEY && typeof c.eq === "number") as { eq: number } | undefined;
    if (act?.eq !== 1) continue;
    assert.ok(clueRoute(card.when), `${card.id} 只认关系门槛，本子上有线索也走不到她跟前`);
  }
});

test("可达性：没攒够线索翻不了面，攒齐了当天就翻得动", () => {
  const turn = STORYLETS.find(c => c.id === "main-slip-turn");
  assert.ok(turn);
  const base = at({ season: 1, day: 14, present: { shen: "counter", fangmin: "cashier" } });
  let w = setQuality(base, MAINLINE_ACT_KEY, 1);
  assert.equal(drawStorylet(w, PEOPLE, [turn]).drawn, null, "本子上一条都没有，翻面卡不该进得了牌堆");

  w = setQuality(w, "clue:slip-hand", 4);
  assert.equal(drawStorylet(w, PEOPLE, [turn]).drawn, null, "只有一条对不上日期，还差第二条");

  w = setQuality(w, "clue:slip-borrowed", 9);
  const drawn = drawStorylet(w, PEOPLE, [turn]).drawn;
  assert.equal(drawn?.storylet.id, "main-slip-turn");

  // 日子没到也不给翻：幕号与线索都齐，第 11 天仍进不了牌堆
  assert.equal(drawStorylet({ ...w, day: 11 }, PEOPLE, [turn]).drawn, null);

  // 翻过以后：这一季不会再走第二遍，幕号抬到第 2 幕
  assert.ok(drawn);
  const after = applyChoice(w, PEOPLE, drawn, 0);
  assert.equal(after.qualities[threadKey("return-slip")], 1);
  assert.equal(after.qualities[MAINLINE_ACT_KEY], 2);
  assert.equal(drawStorylet({ ...after, day: 20 }, PEOPLE, [turn]).drawn, null, "已经翻过的线不该再翻一次");
});

test("可达性：本子上只有「日期 + 那一行」时走台账那条路翻面，且沈薇不在场也翻得动", () => {
  const group = STORYLETS.find(c => c.id === "main-slip-turn");
  const desk = STORYLETS.find(c => c.id === "main-slip-turn-desk");
  assert.ok(group && desk, "两条翻面卡都在牌堆里");
  const legal = (w: World, card: (typeof STORYLETS)[number]) => card.when.every(c => evalCond(w, PEOPLE, c));
  const withClues = (clues: string[], day = 20, present: Record<string, "counter" | "cashier"> = { shen: "counter", fangmin: "cashier" }) => {
    let w = at({ season: 1, day, present });
    w = setQuality(w, MAINLINE_ACT_KEY, 1);
    for (const id of clues) w = setQuality(w, `clue:${id}`, 5);
    return w;
  };

  // 沈薇一季只在约一成的时段露面：台账那条不许把她当成必要条件，否则攒够了也走不到跟前。
  assert.equal(legal(withClues(["slip-hand", "slip-gap"], 20, { fangmin: "cashier" }), desk), true, "日期加那一行就该翻得动，她来不来都一样");
  assert.equal(legal(withClues(["slip-hand", "slip-gap"]), group), false, "没握着群里或录音那条，说不出「名字是借的」");
  assert.equal(legal(withClues(["slip-gap"]), desk), false, "只有领用表那一行，日期还没对不上");
  // 台账那条是兜底：日子压到第 18 天，给客人那两条留出空窗。
  // 实测第 12 天就放它会把本子中位数从 3 条压到 2 条，还会让「群里那条」的种子从 52/80 掉到 38/80。
  assert.equal(legal(withClues(["slip-hand", "slip-gap"], 14), desk), false, "第 14 天还该等客人那两条");

  // 两条路互斥：握着群里那条的人走客人那一面，不会被台账版抢掉。
  const both = withClues(["slip-hand", "slip-gap", "slip-borrowed"]);
  assert.equal(legal(both, group), true);
  assert.equal(legal(both, desk), false, "本子上有群里那条，就不该读成「只有台账一条线」");
  const taped = withClues(["slip-hand", "slip-gap", "slip-tape"]);
  assert.equal(legal(taped, group) && !legal(taped, desk), true);
  assert.equal(legal({ ...withClues(["slip-hand", "slip-gap"]), day: 11 }, desk), false, "日子没到第 18 天也不给翻");

  const applied = applyChoice(withClues(["slip-hand", "slip-gap"]), PEOPLE, { storylet: desk, binding: { a: "fangmin" } }, 0);
  assert.equal(applied.qualities[threadKey("return-slip")], 1);
  assert.equal(applied.qualities[MAINLINE_ACT_KEY], 2);
});

test("内容：同一个落点在图鉴上只能有一个说法", () => {
  // 图鉴与季末回顾都按「落点号 → 先出现的那张卡的 label」念（progress.ts 的 threadLandings）。
  // 再加一条翻面路时若把同一档写成另一句话，回顾会念出玩家没走过的那句 —— 这条把它钉住。
  const titles = new Map<string, Set<string>>();
  for (const card of STORYLETS) {
    for (const choice of card.choices) {
      for (const e of choice.effects) {
        if (!("quality" in e) || !e.quality.startsWith("thread:") || typeof e.set !== "number") continue;
        const key = `${e.quality.slice("thread:".length)}#${e.set}`;
        titles.set(key, new Set([...(titles.get(key) ?? new Set()), choice.label]));
      }
    }
  }
  for (const [key, labels] of titles) {
    assert.equal(labels.size, 1, `落点 ${key} 有几张卡各说一套：${[...labels].join(" / ")}`);
  }
});

test("档案：本子和收法只增不减，坏档整份丢弃", () => {
  let w = at({ qualities: { "clue:slip-hand": 6, "clue:ghost": 3, [threadKey("return-slip")]: 2, "clue:slip-tape": 0 } });
  const first = observeWorldProgress(emptyWorldProgress(), w);
  assert.deepEqual(first.clues, ["slip-hand"], "不在册的线索与值为 0 的那条都不进档");
  assert.deepEqual(first.threadEnds["return-slip"], [2]);

  w = setQuality(w, threadKey("return-slip"), 4);
  const second = observeWorldProgress(first, w);
  assert.deepEqual([...second.threadEnds["return-slip"]].sort(), [2, 4], "换一季落到另一种收法，两种都留在档上");
  const replay = observeWorldProgress(second, at({ qualities: { [threadKey("return-slip")]: 2 } }));
  assert.deepEqual(replay.threadEnds["return-slip"], second.threadEnds["return-slip"]);
  assert.deepEqual(first.threadEnds["return-slip"], [2], "原档不被就地改写");

  const round = parseWorldProgress(JSON.stringify(second));
  assert.deepEqual(round, second);
  const bad = (patch: Record<string, unknown>) => JSON.stringify({ ...second, ...patch });
  assert.equal(parseWorldProgress(bad({ clues: ["not-a-clue"] })), null);
  assert.equal(parseWorldProgress(bad({ clues: ["slip-hand", "slip-hand"] })), null);
  assert.equal(parseWorldProgress(bad({ clues: "slip-hand" })), null);
  assert.equal(parseWorldProgress(bad({ threadEnds: { "not-a-thread": [1] } })), null);
  assert.equal(parseWorldProgress(bad({ threadEnds: { "return-slip": [0] } })), null);
  assert.equal(parseWorldProgress(bad({ threadEnds: { "return-slip": 2 } })), null);
  // v1 那种根本没有这两个字段的旧档：整份丢弃，不做半份图鉴
  const v1 = JSON.parse(JSON.stringify(second)) as Record<string, unknown>;
  delete v1.clues;
  delete v1.threadEnds;
  v1.version = 1;
  assert.equal(parseWorldProgress(JSON.stringify(v1)), null);
});

test("内容：主线牵住的人都在人物圣经里", () => {
  const ids = new Set<PersonId>(PEOPLE.map(p => p.id));
  for (const clue of CLUES) for (const id of clue.about) assert.ok(ids.has(id), `线索「${clue.id}」牵住了不存在的人「${id}」`);
  for (const thread of CLUE_THREADS) assert.ok(thread.question.length > 0, `线「${thread.id}」那句问话还没写`);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  newWorld, nextSeason, parseWorld, serializeWorld,
  START_COMPLIANCE, START_STANDING,
} from "../src/world/engine.ts";
import { pickHighlights, seasonRecap, RECAP_HIGHLIGHT_MAX } from "../src/world/recap.ts";
import { MAINLINE_ACTS } from "../src/world/content/clues.ts";
import type { PersonId, Storylet, World, WorldRequest } from "../src/world/types.ts";
import { PLAYER } from "../src/world/types.ts";
import { FIXTURE_PEOPLE } from "./fixtures/world-fixture.ts";

// 季末回顾的规则测试。夹具人和引擎测试共用 FIXTURE_PEOPLE；
// 个人线用这里现写的小卡（fixture 里没有 arc:<id>:end 的落点写法）。

const recapWorld = (over: Partial<World>): World => ({
  ...newWorld("recap-seed", FIXTURE_PEOPLE),
  day: 29, // 第 28 天过完就是 season 屏
  ...over,
});

/** 一张钉死某人的落点卡：set 到 arc:<id>:end = end，结果句里 {$a} 会被换成人名。 */
const arcCard = (id: string, person: PersonId, end: number, title: string, result: string): Storylet => ({
  id, kind: "arc", tension: 0, weight: 1, once: true,
  cast: { a: { id: person, where: [] } },
  when: [], text: "x",
  choices: [{ label: title, effects: [{ quality: `arc:${person}:end`, set: end }], result }],
});

const count = (xs: string[], k: string) => xs.filter(x => x === k).length;

test("高光：同类至多两条；大单取金额最大的两笔；盟友时刻先挑重的那两件", () => {
  const w = recapWorld({
    opinion: { mei: 60 },
    log: [
      { day: 3, slot: 1, text: "彭姐勉强带走了 2 件修护霜，进账 ¥3,960。", who: ["peng"] },
      { day: 5, slot: 2, text: "梅女士试了柔焦精华，带走 3 件，进账 ¥5,040。", who: ["mei"] },
      { day: 9, slot: 0, text: "你硬是把邱太的修护霜开出了 4 件，进账 ¥7,920。", who: ["qiu"] },
      { day: 6, slot: 1, text: "何太在苏蔓面前替你说了句好话：「她看着是个实诚人。」", who: ["he", "suman"] },
      { day: 8, slot: 3, text: "彭姐沉着脸要走，赵阿姨抓起东西跟着她一起走了。", who: ["peng", "zhao"] },
      { day: 12, slot: 1, text: "梅女士加了你微信。", who: ["mei"] },
    ],
  });
  const hs = pickHighlights(w, FIXTURE_PEOPLE, []);
  const texts = hs.map(h => h.text);
  assert.ok(count(hs.map(h => h.kind), "sale") === 2);
  assert.ok(texts.some(t => t.includes("¥7,920")) && texts.some(t => t.includes("¥5,040")));
  assert.ok(!texts.some(t => t.includes("¥3,960")), "最小的那笔不该进高光");
  assert.ok(count(hs.map(h => h.kind), "ally") === 2);
  assert.ok(!texts.some(t => t.includes("加了你微信")), "说好话、气走在前，加微信那一条被同类限额挤掉");
  // 时间轴按天从前往后讲
  assert.deepEqual(hs.map(h => h.day), [...hs.map(h => h.day)].sort((a, b) => a - b));
});

test("高光：被陆遥请走的人里只留最在意的一位（季末对你看法最高的那个）", () => {
  const w = recapWorld({
    opinion: { mei: 60, qiu: 10 },
    log: [
      { day: 11, slot: 2, text: "你没顾上邱太，陆遥把她请去了对面维珞，今天不会再回来。", who: ["luyao", "qiu"] },
      { day: 15, slot: 1, text: "你没顾上梅女士，陆遥把她请去了对面维珞，今天不会再回来。", who: ["luyao", "mei"] },
    ],
  });
  const hs = pickHighlights(w, FIXTURE_PEOPLE, []);
  const poach = hs.filter(h => h.kind === "poach");
  assert.equal(poach.length, 1);
  assert.ok(poach[0]!.text.includes("梅女士"), "看法更高的梅女士才是'你最在意'的那位");
});

test("高光：委托做到和失约各念一件大事，取最近结的那件", () => {
  const requests: WorldRequest[] = [
    { id: "r1", kind: "clean", by: "suman", day: 4, due: 4, state: "done", text: "今天一单都别硬推", reward: "x" },
    { id: "r2", kind: "quota", by: "tangke", day: 7, due: 9, state: "failed", text: "帮我卖出 3 件", reward: "x", n: 3 },
    { id: "r3", kind: "samples", by: "mei", day: 9, due: 9, state: "done", text: "借我两支小样", reward: "x" },
  ];
  const hs = pickHighlights(recapWorld({ requests }), FIXTURE_PEOPLE, [])
    .filter(h => h.kind === "request");
  assert.equal(hs.length, 2, "同类至多两条");
  assert.ok(hs.some(h => h.text.includes("借我两支小样") && h.text.includes("你做到了")));
  assert.ok(hs.some(h => h.text.includes("帮我卖出 3 件") && h.text.includes("你失约了")));
  assert.ok(!hs.some(h => h.text.includes("别硬推")), "更早结的那件被同类限额挤掉");
});

test("高光：总数封顶 8 条；优先类不够时用有记性的现场句补足下限", () => {
  const beats = Array.from({ length: 12 }, (_, i) => ({
    day: i + 1, slot: 1 as const,
    text: `彭姐和赵阿姨当场拌起了嘴，谁也不让谁。(${i})`,
    who: ["peng", "zhao"] as PersonId[],
  }));
  const w = recapWorld({ log: [{ day: 2, slot: 0, text: "梅女士加了你微信。", who: ["mei"] }, ...beats] });
  const hs = pickHighlights(w, FIXTURE_PEOPLE, []);
  assert.ok(hs.length <= RECAP_HIGHLIGHT_MAX);
  assert.equal(count(hs.map(h => h.kind), "beat"), 2, "同小类（拌嘴）也不超两条");
});

test("高光：个人线落点认回 log 原句；三条线封顶两条，先讲早落定的", () => {
  const storylets = [
    arcCard("a-suman", "suman", 2, "名额那句还留在表上", "{$a}把名额那句留在了表上。"),
    arcCard("a-shen", "shen", 1, "她还把人交给你", "{$a}说团队还把人交给你。"),
    arcCard("a-luyao", "luyao", 3, "对面那面镜子碎了", "{$a}的镜子碎了一地。"),
  ];
  const w = recapWorld({
    qualities: { "arc:suman:end": 2, "arc:shen:end": 1, "arc:luyao:end": 3 },
    fired: { "a-suman": 14, "a-shen": 5, "a-luyao": 21 },
    log: [
      { day: 5, slot: 1, text: "沈薇说团队还把人交给你。", who: ["shen"] },
      { day: 14, slot: 2, text: "苏蔓把名额那句留在了表上。", who: ["suman"] },
      { day: 21, slot: 3, text: "陆遥的镜子碎了一地。", who: ["luyao"] },
    ],
  });
  const hs = pickHighlights(w, FIXTURE_PEOPLE, storylets).filter(h => h.kind === "arc");
  assert.equal(hs.length, 2, "三条落点线只念两条");
  assert.deepEqual(hs.map(h => h.day), [5, 14]);
  assert.ok(hs[0]!.text.includes("沈薇"), "认回的是 log 里的原句");
});

test("你的人：理由取最重的正面记忆，负面记忆不掺进来；听来的标出处", () => {
  const w = recapWorld({
    opinion: { shen: 55, qiu: -45 },
    memories: [
      { day: 4, holder: "shen", subject: PLAYER, act: "greeted", valence: 1 },
      { day: 6, holder: "shen", subject: PLAYER, act: "kept-secret", valence: 2 },
      { day: 9, holder: "shen", subject: PLAYER, act: "wrong-pick", valence: -1 },
      { day: 3, holder: "qiu", subject: PLAYER, act: "pestered", valence: -1 },
      { day: 7, holder: "qiu", subject: PLAYER, act: "betrayed", valence: -2 },
    ],
  });
  const r = seasonRecap(w, FIXTURE_PEOPLE, []);
  assert.equal(r.allies.length, 1);
  assert.equal(r.allies[0]!.id, "shen");
  assert.equal(r.allies[0]!.line, "记着你替她保守了秘密", "取 |valence| 最重的正面那条");
  assert.equal(r.remembered.length, 1);
  assert.equal(r.remembered[0]!.id, "qiu");
  assert.equal(r.remembered[0]!.line, "记着你把她的秘密说了出去");

  const heard = seasonRecap(recapWorld({
    opinion: { shen: 55 },
    memories: [
      { day: 6, holder: "shen", subject: PLAYER, act: "kept-secret", valence: 2 },
      { day: 12, holder: "shen", subject: PLAYER, act: "honest-advice", valence: 2, heardFrom: "he" },
    ],
  }), FIXTURE_PEOPLE, []);
  assert.equal(heard.allies[0]!.line, "听何太说，你给了她实在的建议", "同样重取新的；听来的念出从谁嘴里");
});

test("变化榜：按季初快照比出差额，只念三个人；钱柜位台账各带一句", () => {
  const w = recapWorld({
    opinionAtSeasonStart: { suman: 10, mei: -5 },
    statsAtSeasonStart: { standing: 50, compliance: 62 },
    opinion: { suman: 45, mei: -40, tangke: 12 },
    standing: 62, compliance: 55, money: 21_600,
  });
  const r = seasonRecap(w, FIXTURE_PEOPLE, []);
  assert.equal(r.movers.length, 3);
  assert.deepEqual(r.movers.map(m => m.id), ["mei", "suman", "tangke"], "|−35| 并列按 id，|+12| 第三");
  assert.equal(r.movers[0]!.from, -5);
  assert.equal(r.movers[2]!.from, undefined, "季初快照里没有的人按没见过念");
  assert.equal(r.stats.standing.line, "比开季高了 12");
  assert.equal(r.stats.compliance.line, "比开季低了 7");
  assert.equal(r.stats.money.line, "柜上的日子过下来了");
});

test("旧档没有季初快照：变化榜照常念（from 按没见过），数字只念季末值", () => {
  const w = recapWorld({
    opinionAtSeasonStart: {}, statsAtSeasonStart: undefined,
    opinion: { tangke: 12 }, standing: 62, compliance: 40, money: 0,
  });
  const r = seasonRecap(w, FIXTURE_PEOPLE, []);
  assert.deepEqual(r.movers.map(m => m.id), ["tangke"]);
  assert.equal(r.movers[0]!.from, undefined);
  assert.equal(r.stats.standing.line, "散场时在这层站住了");
  assert.equal(r.stats.compliance.line, "不上不下，下一季再做");
  assert.equal(r.stats.money.line, "一单没开，柜上的账是空的");
});

test("走完的线：标题复用档案的落点取法，落定那天从 fired 里读", () => {
  const storylets = [arcCard("a-suman", "suman", 2, "名额那句还留在表上", "{$a}把名额那句留在了表上。")];
  const w = recapWorld({
    qualities: { "arc:suman:end": 2 },
    fired: { "a-suman": 14 },
    log: [{ day: 14, slot: 1, text: "苏蔓把名额那句留在了表上。", who: ["suman"] }],
  });
  const r = seasonRecap(w, FIXTURE_PEOPLE, storylets);
  assert.deepEqual(r.arcs, [{ id: "suman", title: "名额那句还留在表上", day: 14 }]);
});

test("nextSeason 把换季收一半后的样子记成新季快照", () => {
  const end = recapWorld({
    standing: 70, compliance: 80,
    opinion: { suman: 40, tangke: -30 },
    opinionAtSeasonStart: { suman: 0, tangke: 0 },
  });
  const next = nextSeason(end, FIXTURE_PEOPLE);
  assert.equal(next.opinion.suman, 20);
  assert.equal(next.opinion.tangke, -15);
  assert.deepEqual(next.opinionAtSeasonStart, next.opinion, "快照 = 新季开局那一刻的看法");
  assert.deepEqual(next.statsAtSeasonStart, { standing: next.standing, compliance: next.compliance });
});

test("newWorld 的开季快照从初始值写起", () => {
  const w = newWorld("fresh", FIXTURE_PEOPLE);
  assert.deepEqual(w.opinionAtSeasonStart, {});
  assert.deepEqual(w.statsAtSeasonStart, { standing: START_STANDING, compliance: START_COMPLIANCE });
});

test("parseWorld：快照字段有就校验，没有按空读，坏了整份丢", () => {
  const w = newWorld("p", FIXTURE_PEOPLE);
  const envelope = () => JSON.parse(serializeWorld(w)) as { world: Record<string, unknown> };

  const ok = parseWorld(serializeWorld(w));
  assert.ok(ok);
  assert.deepEqual(ok.opinionAtSeasonStart, {});
  assert.deepEqual(ok.statsAtSeasonStart, { standing: START_STANDING, compliance: START_COMPLIANCE });

  const old = envelope();
  delete old.world.opinionAtSeasonStart;
  delete old.world.statsAtSeasonStart;
  const parsed = parseWorld(old);
  assert.ok(parsed, "旧档缺快照字段照样读得回来");
  assert.deepEqual(parsed!.opinionAtSeasonStart, {});
  assert.equal(parsed!.statsAtSeasonStart, undefined);

  const badSnap = envelope();
  badSnap.world.opinionAtSeasonStart = "x";
  assert.equal(parseWorld(badSnap), null);
  const badVal = envelope();
  badVal.world.opinionAtSeasonStart = { mei: "高" };
  assert.equal(parseWorld(badVal), null);
  const badStats = envelope();
  badStats.world.statsAtSeasonStart = { standing: 50 }; // 少 compliance
  assert.equal(parseWorld(badStats), null);
  const badStats2 = envelope();
  badStats2.world.statsAtSeasonStart = { standing: "高", compliance: 55 };
  assert.equal(parseWorld(badStats2), null);
});

// —— 季末回顾的「本子」那一块 ——

test("本子：幕一开过就把那条悬念挂上回顾页，一条线索都没攒也念得出问话", () => {
  const r = seasonRecap(recapWorld({ qualities: { "mainline:act": 1 } }), FIXTURE_PEOPLE, []);
  assert.equal(r.threads.length, 1);
  const t = r.threads[0];
  assert.equal(t.landing, 0);
  assert.equal(t.name, "那张退货单");
  assert.match(t.question, /退的不是她/);
  assert.deepEqual(t.held, []);
  // 幕号还没开：这一页不该凭空冒出主线
  assert.deepEqual(seasonRecap(recapWorld({}), FIXTURE_PEOPLE, []).threads, []);
});

test("本子：攒到的线索按学到的先后排，拧过来的那一档认得出收法名字", () => {
  const storylets: Storylet[] = [{
    id: "turn", kind: "mainline", tension: 0, weight: 1, once: true,
    cast: { a: { id: "mei", where: [] } }, when: [], text: "x",
    choices: [{ label: "把日期、笔迹和你自己那句一起交出去", effects: [{ quality: "thread:return-slip", set: 1 }], result: "y" }],
  }];
  const r = seasonRecap(recapWorld({
    qualities: { "mainline:act": 2, "clue:slip-borrowed": 9, "clue:slip-hand": 4, "thread:return-slip": 1 },
  }), FIXTURE_PEOPLE, storylets);
  const t = r.threads[0];
  assert.deepEqual(t.held, ["slip-hand", "slip-borrowed"]);
  assert.equal(t.landing, 1);
  assert.equal(t.title, "把日期、笔迹和你自己那句一起交出去");
  // 幕号停在 2 = 这一幕还没到底。玩家翻过面就会以为这条线结了，回顾页得留一句钩子，
  // 否则第 3 幕那种压到第 3 季的内容没有人会去玩到（钩子认的是 MAINLINE_ACTS 的长度，不写死数字）。
  assert.equal(t.carriesOn, true, "第 2 幕翻过面不等于这条线讲完，回顾页要留「下一季还有人认」");
  // 第 3 幕收了尾也不算讲完：第 4 幕那句「谁在写单子」还在后面。这一条在加第 4 幕之前是红的
  // （那时 act 3 就是最后一幕），报的就是这件事。
  assert.equal(
    seasonRecap(recapWorld({ qualities: { "mainline:act": 3, "thread:return-slip": 7 } }), FIXTURE_PEOPLE, storylets).threads[0].carriesOn,
    true, "幕号 3 只到第 3 幕，第 4 幕没演 —— 这一页还没合上");
  // 走到内容写到的最后一幕才收钩子：认的是 MAINLINE_ACTS 的长度，不写死第几幕，
  // 所以再加一幕时这条断言会跟着挪，而不会像上一版那样钉死在 3 上、把「还有下文」念成「已经讲完」。
  assert.equal(
    seasonRecap(recapWorld({ qualities: { "mainline:act": MAINLINE_ACTS.length, "thread:return-slip": 12 } }), FIXTURE_PEOPLE, storylets).threads[0].carriesOn,
    false, "幕号走到内容写到的最后一幕：这一页合上了，不许再挂下一季的钩子");

  // 上面那两句成立的前提是"最后一幕 = 说完了"。第 38 轮主线改成按季续写（第 6、7 季各一张，都不抬幕号），
  // 那句前提就不成立了，钩子改认**内容里有没有比这一季更晚的主线卡**。这两句钉的就是换掉之后的形状：
  // 同一份幕号（已是最后一幕）、同一份落点，只有第几季不同 —— 第 5 季末得挂着，第 7 季末得收掉。
  const relay = (from: number): Storylet => ({
    id: `relay-${from}`, kind: "mainline", tension: 0, weight: 1, once: true,
    cast: { a: { id: "mei", where: [] } }, when: [{ season: { gte: from } }], text: "x",
    choices: [{ label: "接住那一栏", effects: [], result: "y" }],
  });
  const withLater: Storylet[] = [storylets[0], relay(7)];
  const lastAct = (season: number) => recapWorld({
    season, qualities: { "mainline:act": MAINLINE_ACTS.length, "thread:return-slip": 12 },
  });
  assert.equal(
    seasonRecap(lastAct(5), FIXTURE_PEOPLE, withLater).threads[0].carriesOn,
    true, "幕号已是最后一幕，可内容里还有第 7 季才开的主线卡 —— 这一页没合上，钩子得留着（摘掉『更晚的主线卡』那一项就红这一句）");
  assert.equal(
    seasonRecap(lastAct(7), FIXTURE_PEOPLE, withLater).threads[0].carriesOn,
    false, "第 7 季末：内容里没有比第 7 季更晚的主线卡，钩子该收 —— 不许为了留悬念永远挂着");
});

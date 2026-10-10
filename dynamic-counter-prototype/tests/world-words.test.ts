import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { STORYLETS } from "../src/world/content/index.ts";
import { newWorld } from "../src/world/engine.ts";
import type { World } from "../src/world/types.ts";
import { byPriority, momentAnchor, momentSound, worldMoments } from "../src/world/ui/cues.ts";
import {
  ACT_WORD, guestKindWord, momentWord, newGuestWord, scoreBrief, scoreWord, servePickWord, verbsEmptyWord,
} from "../src/world/ui/words.ts";
import { PEOPLE } from "../src/world/content/index.ts";

test("引擎写进记忆的每个事件代号，界面都有一句中文", () => {
  const source = ["../src/world/engine.ts", "../src/world/exchanges.ts"]
    .map(f => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");
  const acts = new Set([...source.matchAll(/remember\(w, [^,]+, "([a-z-]+)"/g)].map(m => m[1]));
  assert.ok(acts.size >= 15, `只扫到 ${acts.size} 个代号，正则可能失效了`);
  assert.deepEqual([...acts].filter(act => !(act in ACT_WORD)), []);
});

test("故事碎片写进记忆的每个事件代号，界面都有一句中文", () => {
  const acts = new Set<string>();
  for (const storylet of STORYLETS) for (const choice of storylet.choices) for (const effect of choice.effects)
    if ("remember" in effect) acts.add(effect.remember.act);
  assert.ok(acts.size > 0);
  assert.deepEqual([...acts].filter(act => !(act in ACT_WORD)), []);
});

test("比分：领先、落后、打平、对面还没开张，各说一句", () => {
  assert.equal(scoreWord(12_000, 0), "对面一单没开");
  assert.equal(scoreWord(12_000, 9_800), "比对面多 ¥2,200");
  assert.equal(scoreWord(9_800, 12_000), "落后对面 ¥2,200");
  assert.equal(scoreWord(12_000, 12_000), "和对面打平");
  assert.equal(scoreBrief(9_800), "对面 ¥9,800", "页顶那一格只报对面的数，比较句留给打烊和季末");
});

test("新客与回头客的说法，和「现场」那半句只在 words.ts 写一次", () => {
  assert.equal(guestKindWord(false), "新客");
  assert.equal(guestKindWord(true), "回头客");
  assert.equal(newGuestWord(0), "", "一位新客都没有就不念 —— 全是熟人不算一条消息");
  assert.equal(newGuestWord(3), " · 新客 3");
  // 说法不许在界面里再拼一份：WorldGame 只 import 这两个函数，自己不写「新客」两个字。
  const ui = readFileSync(new URL("../src/world/ui/WorldGame.tsx", import.meta.url), "utf8");
  assert.equal(ui.includes('"新客"') || ui.includes("'新客'"), false, "界面上不该出现硬写的「新客」");
  assert.ok(ui.includes("guestKindWord") && ui.includes("newGuestWord"));
});

test("动作条空着那三句：只说一个原因，不许「或者」", () => {
  const mei = PEOPLE.find(p => p.id === "mei")!;
  assert.equal(verbsEmptyWord(mei, false, true), "她被请去了对面，这个时段够不着。");
  // 没劲那句必须自己给出路：精力一个时段发一格（beginSlot），出路是翻时段，不是熬到明早。
  const tired = verbsEmptyWord(mei, true, false);
  assert.ok(tired.includes("劲用完了") && tired.includes("下一时段"), tired);
  assert.ok(tired.includes("补一格"), `出路要说准是"下一时段补一格"：${tired}`);
  assert.equal(tired.includes("明早"), false, "过夜不再回满，别把玩家支到明早去");
  assert.equal(verbsEmptyWord(mei, false, false), "这会儿对她做不了什么。");
  for (const line of [verbsEmptyWord(mei, true, false), verbsEmptyWord(mei, false, false)])
    assert.ok(!line.includes("或者"), `这句把两条原因一起推给玩家：${line}`);
  // 界面不许再自己拼这句（上一版就是写在 WorldGame 里的，所以改口径时只改了一处）
  const ui = readFileSync(new URL("../src/world/ui/WorldGame.tsx", import.meta.url), "utf8");
  assert.equal(ui.includes("或者精力不够了"), false);
  assert.ok(ui.includes("verbsEmptyWord"));
});

// —— 三刻的判据（任务 22 ①）：成交、回头客、你超过对面（以及反过来那一下）。
// 判据写成纯函数是重点：早晨老客自己回柜那一笔（beginSlot 的赴约回流）不经过任何按钮，
// 上一版把它整个漏掉了，所以这里只认"两个盘之间变了什么"。
const w = (money: number, rivalMoney: number, qualities: Record<string, number> = {}): World =>
  ({ ...newWorld("cue-test", PEOPLE), money, rivalMoney, qualities });

test("进账那一笔：第一次带货算成交，回来过的人算回头客", () => {
  assert.deepEqual(worldMoments(w(0, 0), w(1680, 0, { "bought:mei": 1 })), [{ kind: "sale", who: "mei" }]);
  assert.deepEqual(worldMoments(w(0, 0, { "bought:mei": 3 }), w(1680, 0, { "bought:mei": 6 })),
    [{ kind: "regular", who: "mei" }], "上一单带过货的再进账是回头客，不是新客成交");
  // 加过微信也算"回来过"——私域那条线兑现的就是这一笔
  assert.equal(worldMoments(w(0, 0, { "wechat:mei": 2 }), w(980, 0, { "bought:mei": 7 }))[0]?.kind, "regular");
  // 只被招呼过（served:）不算回头：那是第一次正经接她
  assert.equal(worldMoments(w(0, 0, { "served:mei": 4 }), w(980, 0, { "bought:mei": 7 }))[0]?.kind, "sale");
});

test("退货与扣款没有收银声：钱变少、钱没变都不算一刻", () => {
  assert.deepEqual(worldMoments(w(1680, 1600), w(0, 1600)).filter(m => m.kind !== "trail"), []);
  assert.deepEqual(worldMoments(w(1680, 0), w(1680, 0)), []);
});

test("认不出是谁的那一笔只说「成交」，不报错一个名字", () => {
  // 同一天第二单：引擎把 bought: 写成同一个日期，差值看不出来是谁
  assert.deepEqual(worldMoments(w(0, 0, { "bought:mei": 1 }), w(960, 0, { "bought:mei": 1 })),
    [{ kind: "sale", who: null }]);
});

test("比分只认翻面那一下：0:0 你先开张是成交，从落后翻上来才是超过", () => {
  assert.deepEqual(worldMoments(w(0, 0), w(1680, 0, { "bought:mei": 1 })), [{ kind: "sale", who: "mei" }],
    "开季第一单的头衔该是「成交 · 她」，不是「超过对面了」");
  assert.deepEqual(worldMoments(w(3000, 4000), w(4680, 4000)),
    [{ kind: "sale", who: null }, { kind: "lead", who: null }]);
  assert.deepEqual(worldMoments(w(4680, 4000), w(6360, 4000)), [{ kind: "sale", who: null }],
    "本来就领先，再多开一单只报成交，不重复报超过");
  assert.deepEqual(worldMoments(w(500, 300), w(0, 300)), [{ kind: "trail", who: null }]);
  assert.deepEqual(worldMoments(w(0, 0), w(0, 300)), [{ kind: "trail", who: null }],
    "对面先开张那一拍必须报警，哪怕当时还打平");
  assert.deepEqual(worldMoments(w(0, 300), w(0, 600)), [], "已经落后了，对面再多开一单不重复报");
});

test("同一拍里两件事：只响优先级那一个声音，动画各留各的落点", () => {
  const both = worldMoments(w(3000, 4000), w(4680, 4000));
  assert.equal(byPriority(both)[0]!.kind, "lead");
  assert.equal(momentSound.lead, "lead", "反超要有自己的声音，不能再借成交那记收银");
  assert.deepEqual(both.flatMap(m => momentAnchor[m.kind]).sort(), ["money", "score"]);
  assert.deepEqual(both.map(m => momentSound[m.kind]).sort(), ["lead", "register"]);
  // 回头客那笔是两件事一起：钱到了，而且回来的是她 —— 两处都要亮
  assert.deepEqual(momentAnchor.regular, ["money", "person"]);
});

test("硬推那一单：看法跌得再狠，成交那一笔照样算一刻", () => {
  // 上一版是一条 if 链（跌了先响 down，否则才响 register），于是硬推那一单没有收银声。
  const pushed = worldMoments(w(0, 0), { ...w(400, 0, { "bought:mei": 1 }), opinion: { mei: -12 } });
  assert.deepEqual(pushed, [{ kind: "sale", who: "mei" }]);
  const ui = readFileSync(new URL("../src/world/ui/WorldGame.tsx", import.meta.url), "utf8");
  assert.equal(ui.includes('sfx("register")'), false, "音效由 cues.ts 的表出，界面不许自己点");
  assert.equal(ui.includes("cueOutcome"), false, "旧的『一声要么上要么下』那条链已经拆掉");
  assert.ok(ui.includes("momentSound") && ui.includes("worldMoments"));
});

test("三刻的文案只贴标签：不许多报一个数字或 ¥", () => {
  assert.equal(momentWord("sale", "梅女士"), "成交 · 梅女士");
  assert.equal(momentWord("regular", "梅女士"), "回头客 · 梅女士");
  assert.equal(momentWord("lead"), "超过对面了");
  assert.equal(momentWord("trail"), "被对面超过");
  for (const kind of ["sale", "regular", "lead", "trail"] as const) {
    const word = momentWord(kind, "梅女士");
    assert.ok(!/[\d¥]/.test(word), `${kind} 这句在重复报数：${word}`);
  }
  const ui = readFileSync(new URL("../src/world/ui/WorldGame.tsx", import.meta.url), "utf8");
  assert.ok(ui.includes("momentWord"), "牌要念 words.ts 那一句");
  assert.equal(ui.includes("成交 ·"), false, "标签在 words.ts 一处写，界面不许再拼一份");
});

// —— 第一单教挑货（任务 22 ②）：占位句要讲完"对不上就开不出去"，之后每一单只留一句口径。
test("挑货那句占位话：第一单把三件事讲完，开过单之后不重复念课文", () => {
  const first = servePickWord("她", true);
  assert.ok(first.startsWith("第一单"), "第一单要自己报家门：" + first);
  // 三件事都得上桌：去哪儿对（她说过那句 × 每支货底下的小字）、对不上会怎样、硬推是什么
  assert.ok(first.includes("关键词") && first.includes("小字"), first);
  assert.ok(first.includes("摇头") && first.includes("钱到不了账"), "要说准对不上的下场：" + first);
  assert.ok(first.includes("硬推") && first.includes("退回来"), "硬推那句是真的：当天到账、过两天退货：" + first);
  const later = servePickWord("她", false);
  assert.ok(!later.includes("硬推") && !later.includes("摇头"), "第二单起不再念课文：" + later);
  assert.ok(later.includes("小字") && later.includes("不止一支"), later);
  assert.notEqual(first, later, "两档说法必须不同，否则等于没教");
  // 代词跟着人走：男顾客那句不能写死"她"
  assert.ok(servePickWord("他", true).includes("他摇头") && !servePickWord("他", true).includes("她"));
  // 这句只在 words.ts 写一次，界面读函数
  const ui = readFileSync(new URL("../src/world/ui/WorldGame.tsx", import.meta.url), "utf8");
  assert.ok(ui.includes("servePickWord"));
  assert.equal(ui.includes("再对着每支货底下那行小字挑"), false, "占位句不许在 JSX 里再拼一份");
});

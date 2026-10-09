import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { STORYLETS } from "../src/world/content/index.ts";
import {
  ACT_WORD, guestKindWord, newGuestWord, scoreBrief, scoreWord, verbsEmptyWord,
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

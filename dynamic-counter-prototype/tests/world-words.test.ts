import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { STORYLETS } from "../src/world/content/index.ts";
import { ACT_WORD, guestKindWord, newGuestWord, scoreBrief, scoreWord } from "../src/world/ui/words.ts";

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

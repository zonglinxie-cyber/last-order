import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ACT_WORD } from "../src/world/ui/words.ts";

test("引擎写进记忆的每个事件代号，界面都有一句中文", () => {
  const source = readFileSync(new URL("../src/world/engine.ts", import.meta.url), "utf8");
  const acts = new Set([...source.matchAll(/remember\(w, [^,]+, "([a-z-]+)"/g)].map(m => m[1]));
  assert.ok(acts.size >= 15, `只扫到 ${acts.size} 个代号，正则可能失效了`);
  const missing = [...acts].filter(act => !(act in ACT_WORD));
  assert.deepEqual(missing, []);
});

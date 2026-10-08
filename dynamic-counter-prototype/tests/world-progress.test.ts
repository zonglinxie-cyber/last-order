import assert from "node:assert/strict";
import test from "node:test";
import { newWorld } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { World } from "../src/world/types.ts";
import {
  ARC_PEOPLE, emptyWorldProgress, observeWorldProgress, parseWorldProgress,
  WORLD_PROGRESS_KEY, WORLD_PROGRESS_VERSION,
  type WorldProgress,
} from "../src/world/progress.ts";

// 造一份只改了关心字段的世界读数：present / opinion / qualities。
const at = (patch: Partial<World>): World => ({ ...newWorld("t", PEOPLE), ...patch });

test("档案用独立存档键，不与一季存档同名", () => {
  assert.equal(WORLD_PROGRESS_KEY, "last-order-world-progress-v1");
  assert.notEqual(WORLD_PROGRESS_KEY, "last-order-world-v1");
});

test("observe：在场过的人算见过，present 里的人逐个进 seen", () => {
  const p = observeWorldProgress(emptyWorldProgress(), at({ present: { shen: "counter", mei: "entrance", roman: "cashier" } }));
  assert.deepEqual([...p.seen].sort(), ["mei", "roman", "shen"]);
  // 不在 present 的人不算见过，哪怕有看法。
  assert.ok(!p.seen.includes("anjie"));
});

test("observe：secret-known 旗认成秘密揭开，未知代号不进", () => {
  const p = observeWorldProgress(emptyWorldProgress(), at({
    present: { shen: "counter", anjie: "counter" },
    qualities: { "secret-known:shen": 1, "secret-known:ghost": 1 },
  }));
  assert.deepEqual(p.secretKnown, ["shen"]);
});

test("observe：看法取跨存档的最好与最差那一档，只增不减", () => {
  const a = observeWorldProgress(emptyWorldProgress(), at({ opinion: { shen: 20, mei: -10 } }));
  assert.equal(a.bestOpinion.shen, 20);
  assert.equal(a.worstOpinion.shen, 20);
  const b = observeWorldProgress(a, at({ opinion: { shen: 70, mei: -60 } }));
  assert.equal(b.bestOpinion.shen, 70);   // 撑大
  assert.equal(b.worstOpinion.shen, 20);  // 不掉回去
  const c = observeWorldProgress(b, at({ opinion: { shen: -80, mei: 5 } }));
  assert.equal(c.bestOpinion.shen, 70);   // 不再回落
  assert.equal(c.worstOpinion.shen, -80); // 压得更差
  assert.equal(c.worstOpinion.mei, -60);  // 更差的那次留着
});

test("observe：越界看法夹到 -100..100", () => {
  const p = observeWorldProgress(emptyWorldProgress(), at({ opinion: { shen: 999, mei: -999 } }));
  assert.equal(p.bestOpinion.shen, 100);
  assert.equal(p.worstOpinion.mei, -100);
});

test("observe：个人线落点只认 arc:<id>:end，收场那一档进 arcEnds", () => {
  const p = observeWorldProgress(emptyWorldProgress(), at({
    qualities: { "arc:shen": 3, "arc:shen:end": 2, "arc:anjie": 4, "arc:luyao": 1 },
  }));
  assert.deepEqual(p.arcEnds.shen, [2]);
  // 线推进但没收场：没有 end 旗，不算落点。
  assert.deepEqual(p.arcEnds.anjie, []);
  assert.deepEqual(p.arcEnds.luyao, []);
});

test("observe：多季可累积同一人多个落点，重放同一季不重复", () => {
  const one = observeWorldProgress(emptyWorldProgress(), at({ qualities: { "arc:shen:end": 1 } }));
  const two = observeWorldProgress(one, at({ qualities: { "arc:shen:end": 4 } }));
  assert.deepEqual([...two.arcEnds.shen].sort(), [1, 4]);
  const replay = observeWorldProgress(two, at({ qualities: { "arc:shen:end": 1 } }));
  assert.deepEqual(replay.arcEnds.shen, two.arcEnds.shen);
  // 原档不被就地改写
  assert.deepEqual(one.arcEnds.shen, [1]);
});

test("observe：结局 id 只认已知结局，未知整条丢", () => {
  const p = observeWorldProgress(emptyWorldProgress(), at({}), "both-kept");
  assert.deepEqual(p.endings, ["both-kept"]);
  assert.deepEqual(observeWorldProgress(p, at({}), "nonsense-ending").endings, ["both-kept"]);
  assert.deepEqual(observeWorldProgress(p, at({}), "both-kept").endings, ["both-kept"]);
});

test("parse：合法档往返，类型不对或 id 未知整份丢弃", () => {
  const progress = observeWorldProgress(emptyWorldProgress(),
    at({ present: { shen: "counter" }, opinion: { shen: 40 }, qualities: { "arc:shen:end": 1, "secret-known:shen": 1 } }),
    "counter-empty");
  assert.deepEqual(parseWorldProgress(JSON.stringify(progress)), progress);
  assert.equal(parseWorldProgress(null), null);
  assert.equal(parseWorldProgress("不是 JSON"), null);
  const bad = (patch: Record<string, unknown>) => JSON.stringify({ ...progress, ...patch, version: patch.version ?? WORLD_PROGRESS_VERSION });
  assert.equal(parseWorldProgress(bad({ version: 99 })), null);
  assert.equal(parseWorldProgress(bad({ seen: ["ghost"] })), null);
  assert.equal(parseWorldProgress(bad({ seen: "shen" })), null);
  assert.equal(parseWorldProgress(bad({ seen: ["shen", "shen"] })), null);
  assert.equal(parseWorldProgress(bad({ secretKnown: ["nobody"] })), null);
  assert.equal(parseWorldProgress(bad({ bestOpinion: { shen: 200 } })), null);
  assert.equal(parseWorldProgress(bad({ bestOpinion: { ghost: 10 } })), null);
  assert.equal(parseWorldProgress(bad({ bestOpinion: { shen: 1.5 } })), null);
  assert.equal(parseWorldProgress(bad({ arcEnds: { shen: [0] } })), null);
  assert.equal(parseWorldProgress(bad({ arcEnds: { shen: [1, 1] } })), null);
  assert.equal(parseWorldProgress(bad({ arcEnds: { "not-a-line": [1] } })), null);
  assert.equal(parseWorldProgress(bad({ endings: ["ghost-ending"] })), null);
  assert.equal(parseWorldProgress(bad({ endings: [7] })), null);
  // 最差反超最好：逻辑上不可能出现的档，拒收
  assert.equal(parseWorldProgress(bad({ bestOpinion: { shen: 10 }, worstOpinion: { shen: 50 } })), null);
});

test("parse：个人线的 owner 都在，落点表按这些人收", () => {
  const empty = emptyWorldProgress();
  assert.deepEqual(ARC_PEOPLE, ["shen", "anjie", "luyao", "suman", "tangke", "roman", "fangmin", "qiaowan"]);
  // 空档里 arcEnds 应已铺好四条线，但都还没落点
  for (const id of ARC_PEOPLE) assert.deepEqual(empty.arcEnds[id] ?? [], []);
});

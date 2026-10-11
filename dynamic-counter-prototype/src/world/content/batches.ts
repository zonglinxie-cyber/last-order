// 内容批次表：把整柜故事碎片按"哪一刀加的"分桶，用来按批报平均字数（docs/qoder-下一轮任务.md 第 4 项）。
// 口径与文档里那条字数链一致：正文 + 各选项结果的字符数，**不含选项自己的 label**。
// 为什么要单独一份：卡越写越厚这件事以前只在设计文档的正文里记账（第五格 379 字/张、前三格 230~254），
// 没有一个地方每周把它量一遍 —— 于是"手机上读一张要多久"这件事只能靠回忆。
import type { Storylet } from "../types.ts";

export type Batch = { id: string; word: string };

/** 一批卡的键。人生一步按格分（跨格密度不均是已记的账，混成一批就看不见了）。 */
export const batchOf = (s: Storylet): Batch => {
  if (s.id.startsWith("life-")) return { id: "life1", word: "人生一步·第 5 季" };
  if (s.id.startsWith("life2-")) return { id: "life2", word: "人生一步·第 6 季" };
  if (s.id.startsWith("life3-")) return { id: "life3", word: "人生一步·第 7 季" };
  if (s.id.startsWith("life4-")) return { id: "life4", word: "人生一步·第 8 季" };
  if (s.id.startsWith("life5-")) return { id: "life5", word: "人生一步·第 9 季" };
  if (s.id.startsWith("echo2-")) return { id: "echo2", word: "回访卡·第二回" };
  if (s.id.startsWith("echo")) return { id: "echo", word: "回访卡" };
  if (s.kind === "mainline") return { id: "mainline", word: "主线" };
  if (s.kind === "floor") return { id: "floor", word: "楼层" };
  if (s.kind === "arc") return { id: "arc", word: "个人线" };
  if (s.kind === "social") return { id: "social", word: "通用社交" };
  // 走到这里说明 `Storylet["kind"]` 扩了新的种类而这张表没跟着加一批 ——
  // 那条自洽守卫（tests/world-content.test.ts）会当场报"有卡没归进任何一批"，而不是悄悄少算一批。
  return { id: "unknown", word: "未分类" };
};

/** 一批的字数：正文 + 每颗选项的结果，不含 label。 */
export const wordsOf = (s: Storylet): number =>
  s.text.length + s.choices.reduce((a, c) => a + c.result.length, 0);

export const batchStats = (storylets: Storylet[]): Array<Batch & { cards: number; words: number; avg: number }> => {
  const by = new Map<string, Batch & { cards: number; words: number }>();
  for (const s of storylets) {
    const b = batchOf(s);
    const row = by.get(b.id) ?? { ...b, cards: 0, words: 0 };
    row.cards++;
    row.words += wordsOf(s);
    by.set(b.id, row);
  }
  return [...by.values()].map(r => ({ ...r, avg: r.cards ? r.words / r.cards : 0 }))
    .sort((a, b) => b.words - a.words);
};

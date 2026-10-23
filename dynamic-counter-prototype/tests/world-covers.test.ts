// 货架对「她」说话（ 51 轮）：货架格子底下那一行「管（✓）/ 不管（✗）」。
//
// 这一轮改的是**玩家看得见的那一层**：十二支货原来各有一句营销短标签，两三个词，
// 而一位客人可能要三四条（周姐：薄、见效、稳、撑妆）—— 任何一句标签都写不下，
// 于是「哪一支是她那一支」只能靠一次次试用去撞。改成按她已经说出口的那几条逐支标出来以后，
// 挑货那一屏才真的在回答玩家的问题。
//
// 这里钉的是**四条性质**，不是内容名单：
// ① 货架不能把答案藏起来（正中的那一支必定条条标「管」）；
// ② 标出来以后还得是选择（不能每位客人面前只剩一支）；
// ③ 标出来的那一列不能变成闭眼选它（没有哪支货五条全管）；
// ④ 每一条诉求都得有货管得上（不能出现「这一条谁都管不上」的死路）。
import assert from "node:assert/strict";
import { test } from "node:test";
import { SHELF, SHELF_IDS, affordableUnits, perfectShelf, shelfCovers } from "../src/world/shelf.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { Trait } from "../src/world/types.ts";

const skinned = PEOPLE.filter(p => p.skin);
const TRAITS: Trait[] = ["natural", "correct", "soothe", "steady", "wear"];

/** 她要的每一条，这一支都管得住。 */
const coversAll = (p: NonNullable<typeof skinned[number]>, id: string): boolean =>
  p.skin!.demands.every(d => shelfCovers(id as never, d.trait));

test("货架不能把答案藏起来：正中的那一支，条条都标「管」", () => {
  for (const p of skinned) {
    const id = perfectShelf(p);
    if (!id) continue;
    const missed = p.skin!.demands.filter(d => !shelfCovers(id, d.trait)).map(d => d.trait);
    assert.deepEqual(missed, [],
      `${p.id} 的正中「${SHELF[id].short}」在「${missed.join("、")}」上标着接不住 —— 那一支就当不成正中了`);
  }
});

test("挑哪一支是真的选择：要三条诉求的客人，面前至少有两支买得起又管得全的货", () => {
  // 要四条以上的那位（周姐：薄、见效、稳、撑妆）本来就只有一个答案 ——
  // 十二支里只有粉底给得起这四条，这不是货架变窄，是她要的东西多。
  const single = skinned.filter(p => p.skin!.demands.length <= 3)
    .filter(p => SHELF_IDS.filter(id => affordableUnits(p, id) > 0 && coversAll(p, id)).length < 2)
    .map(p => p.id);
  assert.deepEqual(single, [],
    `这几位客人面前只剩一支对得上的货，「挑哪一支」又变回「找那一支」：${single.join("、")}`);
});

test("没有哪支货把五条诉求全管上：标成全✓的那一列不能是所有客人共同的那一支", () => {
  const all = SHELF_IDS.filter(id => TRAITS.every(t => shelfCovers(id, t)));
  assert.deepEqual(all, [],
    `这几支什么都管，选它就等于不用挑：${all.map(id => SHELF[id].short).join("、")}`);
});

test("每一条诉求都有货管得上：不能出现「这一条谁都管不上」的死路", () => {
  for (const trait of TRAITS) {
    const n = SHELF_IDS.filter(id => shelfCovers(id, trait)).length;
    assert.ok(n >= 3, `「${trait}」只有 ${n} 支货管得上 —— 她说出来以后就没人接得住`);
  }
});

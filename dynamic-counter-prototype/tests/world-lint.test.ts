// 内容质检：扫全部故事卡（content/index.ts 的 STORYLETS），钉住四类文字问题。
// a 选项不许写出别人的隐藏脾气；b 游戏文字不许混调试腔；
// c 角色槽可能绑到男性时，同一句不许用"她"指代该槽（白名单放行，附理由）；
// d 同一张卡里同名选项必须带 when 且两两互斥（choiceVisible 对全部人物配对枚举）。
import assert from "node:assert/strict";
import { test } from "node:test";
import { PEOPLE } from "../src/world/content/people.ts";
import { STORYLETS } from "../src/world/content/index.ts";
import { choiceVisible, evalCond, newWorld } from "../src/world/engine.ts";
import type { CastSlot, Cond, Person, Storylet } from "../src/world/types.ts";

const byId = new Map(PEOPLE.map(p => [p.id, p]));

// —— a 选项里的脾气词 ——

const TEMPER_WORDS = ["爱面子", "多疑", "热心", "爱八卦", "精打细算", "急性子", "念旧", "好胜", "怕被推销", "要强", "疑心"];

test("选项 label 不写出别人的隐藏脾气", () => {
  const bad: string[] = [];
  for (const card of STORYLETS)
    for (const c of card.choices)
      for (const w of TEMPER_WORDS)
        if (c.label.includes(w)) bad.push(`${card.id}「${c.label}」含脾气词「${w}」`);
  assert.deepEqual(bad, []);
});

// —— b 调试腔 ——

const DEBUG_WORDS = ["冷暖", "关系种类", "quality", "valence", "看法值", "档位"];
const DEBUG_NUM = /[+＋-－]\s*\d/;

function debugHits(text: string): string[] {
  const hits = DEBUG_WORDS.filter(w => text.includes(w));
  const num = text.match(new RegExp(DEBUG_NUM.source, "g"));
  if (num) hits.push(...num.map(n => `±数字「${n}」`));
  return hits;
}

test("正文/选项/结果不混调试腔", () => {
  const bad: string[] = [];
  for (const card of STORYLETS) {
    for (const w of debugHits(card.text)) bad.push(`${card.id} text 含「${w}」：${card.text}`);
    for (const c of card.choices) {
      for (const w of debugHits(c.label)) bad.push(`${card.id} label 含「${w}」：${c.label}`);
      for (const w of debugHits(c.result)) bad.push(`${card.id} result 含「${w}」：${c.result}`);
    }
  }
  assert.deepEqual(bad, []);
});

// —— c 代词 ——

/** 槽在静态条件下是否可能绑到男性：钉死 id 看本人；否则看 where 里对 $self 的性别约束。 */
function slotCouldBeMale(slot: CastSlot): boolean {
  if (slot.id !== undefined) return byId.get(slot.id)?.gender === "m";
  const allow = { f: true, m: true };
  const walk = (cond: Cond, negated: boolean) => {
    if ("gender" in cond && cond.gender === "$self") {
      const other = cond.is === "f" ? "m" : "f";
      // 正着约束只留 cond.is；取反（not）则排除 cond.is、只剩另一个
      if (negated) allow[cond.is] = false;
      else allow[other] = false;
      return;
    }
    if ("not" in cond) walk(cond.not, !negated);
  };
  for (const c of slot.where) walk(c, false);
  return allow.m;
}

/**
 * 人工判断后放行的「{$x} 同句出现她」：她指的是句里别的人，不是该槽。
 * 逐条附卡 id、槽和理由。
 */
const PRONOUN_ALLOW: Array<{ card: string; slot: string; reason: string }> = [
  { card: "social-wary-hearsay", slot: "b", reason: "「{$b}说你上次帮过她」的她是未在场的受助者，不指两个槽里的任何人；{$a} 在场且当面，若指她会当面说「帮过你」" },
];

const SENTENCE_SPLIT = /[。！？；\n]/;

test("角色槽可能绑到男性时，同一句不许用「她」指代", () => {
  const bad: string[] = [];
  for (const card of STORYLETS) {
    const strings: Array<{ where: string; text: string }> = [{ where: "text", text: card.text }];
    card.choices.forEach((c, i) => {
      strings.push({ where: `choices[${i}].label`, text: c.label });
      strings.push({ where: `choices[${i}].result`, text: c.result });
    });
    for (const { where, text } of strings)
      for (const sentence of text.split(SENTENCE_SPLIT)) {
        if (!sentence.includes("她")) continue;
        for (const hit of sentence.matchAll(/\{\$(\w+)\}/g)) {
          const slot = card.cast[hit[1] ?? ""];
          if (!slot) continue;
          if (!slotCouldBeMale(slot)) continue;
          if (PRONOUN_ALLOW.some(a => a.card === card.id && a.slot === hit[1])) continue;
          bad.push(`${card.id} ${where} 槽 {$${hit[1]}} 可绑男性，同句有「她」：${sentence.trim()}`);
        }
      }
  }
  assert.deepEqual(bad, []);
});

// —— d 同名选项 ——

function bindingsOf(card: Storylet, slots: string[]): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];
  const world = lintWorld;
  const used = new Set<string>();
  const rec = (depth: number, binding: Record<string, string>) => {
    if (depth === slots.length) {
      if (card.when.every(c => evalCond(world, PEOPLE, c, binding))) out.push({ ...binding });
      return;
    }
    const name = slots[depth]!;
    const slot = card.cast[name]!;
    for (const p of PEOPLE) {
      if (used.has(p.id)) continue;
      if (slot.id !== undefined && p.id !== slot.id) continue;
      if (!slot.where.every(c => evalCond(world, PEOPLE, c, binding, p.id))) continue;
      used.add(p.id); binding[name] = p.id;
      rec(depth + 1, binding);
      delete binding[name]; used.delete(p.id);
    }
  };
  rec(0, {});
  return out;
}

const lintWorld = {
  ...newWorld("lint", PEOPLE),
  present: Object.fromEntries(PEOPLE.map(p => [p.id, "atrium" as const])),
};

test("同名选项必须带 when 且两两互斥", () => {
  const bad: string[] = [];
  for (const card of STORYLETS) {
    const groups = new Map<string, number[]>();
    card.choices.forEach((c, i) => {
      const list = groups.get(c.label) ?? [];
      list.push(i);
      groups.set(c.label, list);
    });
    for (const [label, idx] of groups) {
      if (idx.length < 2) continue;
      for (const i of idx) {
        if (!card.choices[i]!.when) bad.push(`${card.id}「${label}」第 ${i} 个同名选项没有 when`);
      }
      const slots = Object.keys(card.cast);
      const bindings = bindingsOf(card, slots);
      for (const binding of bindings) {
        const drawn = { storylet: card, binding };
        for (let x = 0; x < idx.length; x++)
          for (let y = x + 1; y < idx.length; y++) {
            const a = card.choices[idx[x]!]!, b = card.choices[idx[y]!]!;
            if (choiceVisible(lintWorld, PEOPLE, drawn, a) && choiceVisible(lintWorld, PEOPLE, drawn, b))
              bad.push(`${card.id}「${label}」在 ${JSON.stringify(binding)} 下同时可见（第 ${idx[x]}、${idx[y]} 个）`);
          }
      }
    }
  }
  assert.deepEqual(bad, []);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CUSTOMERS } from "../src/world/counter/content.ts";
import type { Trait } from "../src/world/counter/types.ts";
import * as voices from "../src/world/counter/voices.ts";

const { needReply, budgetReply, trialReply, receiptReply } = voices;
const TRAITS: Trait[] = ["light", "wear", "calm", "repair"];
const RESULTS = ["missing", "weak", "enough"] as const;
const OUTCOMES = ["sold", "lost", "leave"] as const;
const IDS = [...CUSTOMERS.map((c) => c.id), "unknown-customer", "", "__proto__", "constructor", "toString"];
const CLUES: Record<Trait, RegExp> = {
  light: /轻薄|厚重|自然|薄一点/,
  wear: /持妆|补妆|反复补|总补|少补/,
  calm: /舒缓|泛红|舒服/,
  repair: /修护|养护|干燥|起皮/,
};
const SYSTEM = /说服|匹配分|原始匹配|信誉|净收益|关系\s*[+＋]|[+＋]\s*\d|补贴|奖金|加分/;
const MEMORY = /上次|上回|回购|买过|用过|用完|老顾客|老熟人|一直信|还记得|介绍朋友/;
const PROMISE = /保证|包好|治好|治愈|立刻|马上见效|不红了|不干了|不刺了|已经好了|下次一定|以后都|肯定买/;
type ReceiptInput = Parameters<typeof receiptReply>[0];
const receipt = (customerId: string, overrides: Partial<ReceiptInput> = {}): ReceiptInput => ({
  customerId, outcome: "sold", productName: "本次所选乳", discount: 0,
  returning: false, fitOK: true, budgetOK: true, proofOK: true, ...overrides,
});

function shortText(line: string): void {
  assert.equal(typeof line, "string");
  assert.ok(line.trim().length > 0 && line.length <= 90, line);
  assert.equal(line, line.trim());
  assert.doesNotMatch(line, /[\r\n"'“”‘’「」『』]|undefined|null|NaN/, line);
}

function shortLine(line: string): void {
  shortText(line);
  assert.doesNotMatch(line, SYSTEM, line);
  assert.doesNotMatch(line, MEMORY, line);
  assert.doesNotMatch(line, PROMISE, line);
}

function noNeeds(line: string): void {
  for (const clue of Object.values(CLUES)) assert.doesNotMatch(line, clue, line);
}

function allReplies(customerId: string): string[] {
  return [
    ...TRAITS.flatMap((trait) => [false, true].map((secondary) => needReply(customerId, trait, secondary))),
    budgetReply(customerId, 713.25),
    ...RESULTS.map((result) => trialReply(customerId, result)),
    ...OUTCOMES.flatMap((outcome) => [false, true].map((returning) => receiptReply(receipt(customerId, { outcome, returning })))),
    receiptReply(receipt(customerId, { outcome: "lost", budgetOK: false })),
    receiptReply(receipt(customerId, { outcome: "lost", fitOK: false })),
    receiptReply(receipt(customerId, { outcome: "lost", proofOK: false })),
  ];
}

test("public API is exactly four pure reply functions with only a Trait type dependency", () => {
  assert.deepEqual(Object.keys(voices).sort(), ["budgetReply", "needReply", "receiptReply", "trialReply"]);
  const source = readFileSync(new URL("../src/world/counter/voices.ts", import.meta.url), "utf8");
  const typeImport = 'import type { Trait } from "./types.ts";';
  assert.ok(source.startsWith(typeImport));
  assert.doesNotMatch(source.slice(typeImport.length), /\bimport\b|\brequire\b|\bengine\b|\bCUSTOMERS\b|Math\s*\.\s*random|Date\s*\.|performance\s*\.|\bfetch\s*\(/);
});

test("all 24 customers and 72 stories stay short, distinct and return without invented history", () => {
  assert.equal(CUSTOMERS.length, 24);
  const stories: string[] = [];
  for (const customer of CUSTOMERS) {
    assert.equal(customer.scenes.length, 2);
    shortLine(customer.returnLine);
    for (const scene of [customer, ...customer.scenes]) {
      shortText(scene.opening);
      shortText(scene.story);
      assert.ok(scene.story.length <= 80, `${customer.id}: ${scene.story}`);
      const sentences = scene.story.split(/[。！？]+/u).filter((part) => part.trim());
      assert.ok(sentences.length >= 1 && sentences.length <= 2, scene.story);
      stories.push(scene.story);
    }
  }
  assert.equal(stories.length, 72);
  assert.equal(new Set(stories).size, 72);
});

for (const customerId of IDS) {
  test(`${customerId || "empty id"}: every revealed trait has distinct primary/secondary replies and no other need`, () => {
    for (const trait of TRAITS) {
      const primary = needReply(customerId, trait, false);
      const secondary = needReply(customerId, trait, true);
      assert.notEqual(primary, secondary);
      assert.doesNotMatch(primary, /另外|其次|再一项|也想兼顾|要是还能/);
      assert.match(secondary, /另外|再|也|还有|其次|兼顾|要是|对了|顺便/);
      for (const line of [primary, secondary]) {
        shortLine(line);
        assert.match(line, CLUES[trait]);
        for (const other of TRAITS.filter((t) => t !== trait)) assert.doesNotMatch(line, CLUES[other], line);
        assert.doesNotMatch(line, /\d|预算|折扣|九折|元|试过|买/, line);
      }
    }
  });

  test(`${customerId || "empty id"}: budget states the exact base amount without declaring a ceiling or granting extra room`, () => {
    for (const amount of [0, 1, 237, 341, 9876, 1234.5, 713.25]) {
      const line = budgetReply(customerId, amount);
      shortLine(line);
      assert.ok(line.includes(`${amount}元`), line);
      assert.deepEqual(line.match(/\d+(?:\.\d+)?/g), [String(amount)], line);
      noNeeds(line);
      assert.doesNotMatch(line, /九折|试用|试过|成交|付款|原价|折后/, line);
      assert.match(line, /先|打算|准备|想着|暂定/, line);
      assert.doesNotMatch(line, /最多|上限|封顶|以内|不能超|别超|再多就|到这.{0,2}为止|不.{0,6}(?:加|添|超)|就留这么多|喊停/, line);
      assert.doesNotMatch(line, /还能|再添|再加|加钱|加预算|往上|额外|预算空间|能力/, line);
    }
  });

  test(`${customerId || "empty id"}: trial distinguishes missing/weak/enough without promising a sale or physical effects`, () => {
    const lines = RESULTS.map((result) => trialReply(customerId, result));
    assert.equal(new Set(lines).size, RESULTS.length);
    // 区分没顾上、接近但不足、局部认可，不要求固定措辞或逐字快照。
    assert.match(lines[0]!, /不行|不成|顾不上|没顾上|没做到|做不到|没有/);
    assert.match(lines[1]!, /不够|差|欠|不足|没到/);
    assert.doesNotMatch(lines[1]!, /顾不上|没顾上|没做到|做不到|没有/);
    assert.match(lines[2]!, /可以|够|没问题|点行/);
    assert.doesNotMatch(lines[2]!, /不行|不成|不够|差|欠|不足|没到|没顾上|做不到/);
    assert.match(lines[2]!, /这(?:一)?点|刚才(?:说的|那)/);
    for (const line of lines) {
      shortLine(line);
      noNeeds(line);
      assert.doesNotMatch(line, /首要(?:需求|要求)|验证|确认|达(?:到|成).{0,4}(?:要求|标准)|达标|结论|能力|门槛|强度/, line);
      assert.doesNotMatch(line, /全都|都(?:行|可以|满足|够)|完全|各方面|没别的问题/, line);
      assert.doesNotMatch(line, /\d|预算|元|价格|便宜|折|买|结账|付款|包上|成交|皮肤|脸|两颊|鼻翼|嘴角/, line);
    }
  });

  test(`${customerId || "empty id"}: receipt uses outcome and failure facts across every flag combination`, () => {
    for (const outcome of OUTCOMES) for (const budgetOK of [false, true]) {
      for (const fitOK of [false, true]) for (const proofOK of [false, true]) {
        for (const discount of [0, 5, 10, 20]) for (const returning of [false, true]) {
          for (const productName of [null, "本次所选乳"]) {
            const input = Object.freeze(receipt(customerId, { outcome, budgetOK, fitOK, proofOK, discount, returning, productName }));
            const line = receiptReply(input);
            shortLine(line);
            noNeeds(line);
            assert.doesNotMatch(line, /\d|试过了|试着不错|试用满意|用了|有效|改善|补回|奖励|赚|原价|折后/, line);
            if (outcome === "sold") {
              assert.ok(line.includes(productName ?? "这支"), line);
              assert.doesNotMatch(line, /不买|不拿|超预算|不合适|九折|试用/, line);
            } else if (outcome === "leave") {
              assert.equal(line, receiptReply(receipt(customerId, { outcome: "leave" })));
              assert.doesNotMatch(line, /结账|付款|包上|包起来|买定|超预算|九折|不合适|浪费|耽误|骗子/, line);
            } else if (!budgetOK) {
              assert.match(line, /预算/);
              assert.doesNotMatch(line, /不合适|不符合|九折|试/);
            } else if (!fitOK) {
              assert.match(line, /不合适|不太合适|不符合|没选对/);
              assert.doesNotMatch(line, /预算|九折|试/);
            } else if (!proofOK) {
              assert.match(line, /九折/);
              assert.match(line, /或/);
              assert.match(line, /试/);
              assert.doesNotMatch(line, /超预算|不合适|没试过|没打折/);
            } else {
              assert.doesNotMatch(line, /预算|不合适|不符合|九折|试/);
            }
            if (outcome !== "sold") assert.doesNotMatch(line, /本次所选乳|结账|付款|包起来|包上/);
          }
        }
      }
    }
  });
}

test("24 voices have personal budget/sale/leave lines and eight substantive styles, not name prefixes", () => {
  const ids = CUSTOMERS.map((c) => c.id);
  for (const reply of [
    (id: string) => budgetReply(id, 713.25),
    (id: string) => receiptReply(receipt(id)),
    (id: string) => receiptReply(receipt(id, { outcome: "leave" })),
  ]) {
    const lines = ids.map(reply);
    assert.equal(new Set(lines).size, 24);
    for (const line of lines) for (const customer of CUSTOMERS) assert.ok(!line.includes(customer.name), line);
  }
  for (const trait of TRAITS) for (const secondary of [false, true]) {
    assert.ok(new Set(ids.map((id) => needReply(id, trait, secondary))).size >= 8);
  }
  for (const result of RESULTS) assert.ok(new Set(ids.map((id) => trialReply(id, result))).size >= 8);
});

test("unknown ids safely use generic speech, including inherited object property names", () => {
  const generic = allReplies("unknown-customer");
  for (const id of ["", "__proto__", "constructor", "toString"]) assert.deepEqual(allReplies(id), generic);
});

test("repeated and interleaved calls are deterministic and never call Math.random", (t) => {
  t.mock.method(Math, "random", () => { throw new Error("reply functions must not use randomness"); });
  const first = new Map(IDS.map((id) => [id, allReplies(id)]));
  for (let pass = 0; pass < 3; pass++) {
    for (const id of [...IDS].reverse()) {
      assert.deepEqual(allReplies(id), first.get(id));
      allReplies("interleaved-unknown");
    }
  }
});

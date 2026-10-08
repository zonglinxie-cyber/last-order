// 接待面板的"她越信你，说得越多"：看法分档、秘密多一条、忌讳只在 ≥40、念法不许是标签。
// 规则出处是 src/world/serve-talk.ts，这里钉住它；界面只是读它。
import assert from "node:assert/strict";
import { test } from "node:test";
import { PEOPLE } from "../src/world/content/people.ts";
import type { Demand, Trait } from "../src/campaign.ts";
import {
  DEMAND_WORDS, SECRET_EXTRA, TALK_OPEN, TALK_WARM, demandWords, serveTalk, unsaidWord,
} from "../src/world/serve-talk.ts";

const TRAITS: Trait[] = ["natural", "correct", "soothe", "steady", "wear"];
const D3: Demand[] = [{ trait: "soothe", want: 2, weight: 3 }, { trait: "steady", want: 1, weight: 2 }, { trait: "correct", want: 1, weight: 1 }];
const VETO = { note: "活跃痘正在冒，闷一下就爆" };

test("看法分三档：低时只说一条，中段两条，40 起全说", () => {
  for (const opinion of [-50, 0, 9])
    assert.equal(serveTalk(D3, opinion, false).said.length, 1, `看法 ${opinion} 只该开口一条`);
  for (const opinion of [TALK_WARM, 20, TALK_OPEN - 1])
    assert.equal(serveTalk(D3, opinion, false).said.length, 2, `看法 ${opinion} 该开口两条`);
  for (const opinion of [TALK_OPEN, 80])
    assert.equal(serveTalk(D3, opinion, false).said.length, D3.length, `看法 ${opinion} 该全说`);
});

test("说的是权重最高的那几条，同权重保持她自己的排法", () => {
  const talk = serveTalk(D3, 20, false);
  assert.deepEqual(talk.said.map(d => d.trait), ["soothe", "steady"]);
  assert.deepEqual(serveTalk(D3, 20, false).said.map(d => d.weight), [3, 2]);
  const tied: Demand[] = [{ trait: "wear", want: 1, weight: 2 }, { trait: "natural", want: 1, weight: 2 }, { trait: "soothe", want: 2, weight: 3 }];
  assert.deepEqual(serveTalk(tied, 20, false).said.map(d => d.trait), ["soothe", "wear"], "同权重不该被洗到后面");
});

test("知道她的秘密时多说一条，封顶在她一共几条诉求", () => {
  assert.equal(serveTalk(D3, 0, true).said.length, 1 + SECRET_EXTRA);
  assert.equal(serveTalk(D3, 20, true).said.length, 3, "两条档 + 秘密 = 三条全在里面");
  assert.equal(serveTalk(D3, 50, true).said.length, D3.length, "已经全说了，秘密不会变出第四条");
  assert.equal(serveTalk(D3, 20, true).unsaid, 0);
  assert.equal(serveTalk(D3, 0, false).unsaid, 2, "没说出口的条数只给规则看，界面上不出这个数");
});

test("忌讳只在看法 ≥ 40 时由她自己说出来，知道秘密也不算提前", () => {
  assert.equal(serveTalk(D3, TALK_OPEN - 1, true, VETO).vetoNote, null);
  assert.equal(serveTalk(D3, TALK_OPEN, false, VETO).vetoNote, VETO.note);
  assert.equal(serveTalk(D3, 90, true, VETO).vetoNote, VETO.note);
  assert.equal(serveTalk(D3, 90, false, undefined).vetoNote, null, "没有忌讳的人不该凭空冒出一句底线");
});

test("五个 Trait 的两档轻重都有 2~3 种口语说法", () => {
  for (const trait of TRAITS)
    for (const want of [1, 2] as const) {
      const list = DEMAND_WORDS[trait][want];
      assert.ok(list.length >= 2 && list.length <= 3, `${trait}·${want} 的说法该有 2~3 种，现有 ${list.length}`);
      for (const line of list) assert.ok(line.length >= 6, `${trait}·${want} 有一句太短，不像说的话`);
    }
});

test("念出来的是她自己的话：不出现英文 trait 名、标签腔和调试腔", () => {
  const labels = ["natural", "correct", "soothe", "steady", "wear"];
  const bad: string[] = [];
  for (const person of PEOPLE) {
    if (!person.skin) continue;
    for (const demand of person.skin.demands) {
      const line = demandWords(person.id, demand);
      if (!line) bad.push(`${person.id} 的 ${demand.trait}·${demand.want} 没有说法`);
      if (/[a-zA-Z]/.test(line)) bad.push(`${person.id}「${line}」夹了英文`);
      if (labels.some(t => line.includes(t))) bad.push(`${person.id}「${line}」念的是标签不是话`);
      if (/[·／、]/.test(line) && !line.includes("，")) bad.push(`${person.id}「${line}」像词表不像句子`);
    }
  }
  assert.deepEqual(bad, []);
});

test("同一个人同一条诉求说法固定；不同人不会全场共用一句", () => {
  const mei: Demand = { trait: "soothe", want: 2, weight: 3 };
  assert.equal(demandWords("mei", mei), demandWords("mei", mei));
  const saidByTrait = new Map<Trait, Set<string>>();
  for (const person of PEOPLE) for (const demand of person.skin?.demands ?? []) {
    if (!saidByTrait.has(demand.trait)) saidByTrait.set(demand.trait, new Set());
    saidByTrait.get(demand.trait)!.add(demandWords(person.id, demand));
  }
  for (const [trait, set] of saidByTrait)
    assert.ok(set.size >= 2, `${trait} 全场只有一句说法`);
});

test("没说出口的那一句按人物性别念，也不报条数", () => {
  assert.equal(unsaidWord("f"), "她像是还有顾虑，没说出来。");
  assert.equal(unsaidWord("m"), "他像是还有顾虑，没说出来。");
  assert.doesNotMatch(unsaidWord("f"), /\d/);
});

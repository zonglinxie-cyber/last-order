// 自主社交动作（src/world/exchanges.ts）的规则测试：每种动作"会触发/不该触发"的条件都钉住，
// 加上时段上限、同对同日同动作一次、以及确定性。全用 fixtures 的十个人手动摆场。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ambient, availableVerbs, doVerb, newWorld, opinionOf, serializeWorld, warmthOf,
} from "../src/world/engine.ts";
import {
  CHAT_WARMTH, EXCHANGE_ACTS, MAX_EXCHANGES_PER_SLOT, ONE_UP_OPINION, PULL_FOLLOW_OPINION,
  exchangeCandidates, exchangeTally, exchanges, quarrelKey, quarrelPairs, quarrelPartner,
} from "../src/world/exchanges.ts";
import type { World } from "../src/world/types.ts";
import { PLAYER } from "../src/world/types.ts";
import { FIXTURE_PEOPLE } from "./fixtures/world-fixture.ts";

const PEOPLE = FIXTURE_PEOPLE;
const person = (id: string) => PEOPLE.find(p => p.id === id)!;

/** 手动摆一个场面：不经过 beginSlot，直接指定谁在场。 */
const stage = (w: World, ids: string[], zone = "atrium"): World =>
  ({ ...w, present: Object.fromEntries(ids.map(id => [id, zone])) });
const setOpinion = (w: World, id: string, v: number): World =>
  ({ ...w, opinion: { ...w.opinion, [id]: v } });
const exKey = (act: string, a: string, b: string) => `ex:${act}:${[a, b].sort().join(":")}`;

/** 同一个摆法换种子重试，返回第一个让 act 触发的世界；八十次都不中返回 null。 */
const fireOn = (act: string, build: (seed: string) => World, tries = 80): World | null => {
  for (let i = 0; i < tries; i++) {
    const w = exchanges(build(`ex-${i}`), PEOPLE);
    if (exchangeTally(w)[act as keyof ReturnType<typeof exchangeTally>] > 0) return w;
  }
  return null;
};
const fires = (act: string, build: (seed: string) => World, tries = 80) => !!fireOn(act, build, tries);
const neverFires = (act: string, build: (seed: string) => World, tries = 80) =>
  !fires(act, build, tries);

test("闲聊：双向都不冷的熟人聊起来，冷暖慢慢变暖", () => {
  // 苏蔓和唐可是同事 40/40。
  const hit = fireOn("chat", seed => stage(newWorld(seed, PEOPLE), ["suman", "tangke"]));
  assert.ok(hit, "够亲的两人同场总会聊上");
  assert.equal(warmthOf(hit, PEOPLE, "suman", "tangke"), 40 + CHAT_WARMTH);
  assert.equal(warmthOf(hit, PEOPLE, "tangke", "suman"), 40 + CHAT_WARMTH);
  assert.ok(hit.log.at(-1)!.text.includes("聊"), "楼层上看得见她们在聊");

  // 不认识的两个人（小段和梅女士没有任何关系）聊不起来。
  assert.ok(neverFires("chat", seed => stage(newWorld(seed, PEOPLE), ["duan", "mei"])));
  // 单向冷的不行：把彭姐对赵阿姨的冷暖改回 0，另一头还是 -35，还是不够"凑一起聊"。
  assert.ok(neverFires("chat", seed => ({
    ...stage(newWorld(seed, PEOPLE), ["peng", "zhao"]), bonds: { "peng>zhao": 0 },
  })), "一头还在结冰的两人不算闲聊");
  // 今天刚拌过嘴的聊不起来：挂着 quarrel 状态挡住闲聊。
  assert.ok(neverFires("chat", seed => ({
    ...stage(newWorld(seed, PEOPLE), ["suman", "tangke"]),
    qualities: { [quarrelKey("suman", "tangke")]: 1 },
  })), "刚拌过嘴的两人当天不闲聊");
});

test("拌嘴：一头冷过线就吵，写下当天状态，关系再降", () => {
  // 彭姐和赵阿姨是 -35/-35 的对头。
  const hit = fireOn("quarrel", seed => stage(newWorld(seed, PEOPLE), ["peng", "zhao"]));
  assert.ok(hit, "对头同场会吵起来");
  assert.equal(hit.qualities[quarrelKey("peng", "zhao")], hit.day, "拌嘴状态记着当天");
  assert.deepEqual(quarrelPairs(hit), [["peng", "zhao"]]);
  assert.equal(quarrelPartner(hit, "zhao"), "peng");
  assert.ok(warmthOf(hit, PEOPLE, "peng", "zhao") < -35, "吵完更冷");
  assert.ok(warmthOf(hit, PEOPLE, "zhao", "peng") < -35);
  assert.ok(hit.memories.some(m => m.holder === "peng" && m.act === "quarreled" && m.subject === "zhao"));
  assert.ok(hit.memories.some(m => m.holder === "zhao" && m.act === "quarreled" && m.subject === "peng"));

  // 关系好的永远不吵。
  assert.ok(neverFires("quarrel", seed => stage(newWorld(seed, PEOPLE), ["suman", "tangke"])));
  // 走了的人不冒火：状态还在，人不在场 quarrelPairs 就不报。
  const gone = { ...hit, present: { peng: "atrium" as const } };
  assert.deepEqual(quarrelPairs(gone), [], "一个走了就吵不起来");
});

test("拌嘴中：点其中一人，打圆场在动作排里；劝成火气收掉", () => {
  // -35 的对头天然满足打圆场门槛（MEDIATE_COLD_LIMIT = -20）：拌嘴状态 ⇒ 一定能劝。
  let w = stage(newWorld("m-1", PEOPLE), ["peng", "zhao"]);
  w = { ...w, qualities: { [quarrelKey("peng", "zhao")]: w.day } };
  assert.ok(availableVerbs(w, PEOPLE, ["peng", "zhao"]).includes("mediate"));
  assert.ok(availableVerbs(w, PEOPLE, ["zhao", "peng"]).includes("mediate"), "点另一人也一样");

  // 劝成之后 quarrel 标记被摘掉（找一颗劝得成的种子）。
  let cleared = false;
  for (let i = 0; i < 60 && !cleared; i++) {
    let x = stage(newWorld(`m-${i}`, PEOPLE), ["peng", "zhao"]);
    x = { ...x, qualities: { [quarrelKey("peng", "zhao")]: x.day } };
    x = setOpinion(setOpinion(x, "peng", 50), "zhao", 50);
    const before = warmthOf(x, PEOPLE, "peng", "zhao");
    x = doVerb(x, PEOPLE, "mediate", ["peng", "zhao"]);
    if (warmthOf(x, PEOPLE, "peng", "zhao") > before) {
      assert.ok(!(quarrelKey("peng", "zhao") in x.qualities), "劝成了火气就收");
      cleared = true;
    }
  }
  assert.ok(cleared, "六十个种子里总该劝成一次");
});

test("较劲：两个好胜的同场就杠，对你看法低的那位跟着降", () => {
  // 唐可、彭姐都好胜，原本互不相识。
  const hit = fireOn("oneup", seed => setOpinion(
    setOpinion(stage(newWorld(seed, PEOPLE), ["tangke", "peng"]), "tangke", 30), "peng", 10));
  assert.ok(hit);
  assert.equal(warmthOf(hit, PEOPLE, "tangke", "peng"), -4, "不认识也杠上，冷暖记下这一杠");
  assert.equal(warmthOf(hit, PEOPLE, "peng", "tangke"), -4);
  assert.equal(opinionOf(hit, "peng"), 10 + ONE_UP_OPINION, "看法低的那位觉得你向着她");
  assert.equal(opinionOf(hit, "tangke"), 30);
  assert.ok(hit.memories.some(m => m.holder === "peng" && m.act === "one-upping" && m.subject === "tangke"));

  // 看法一样高就谁也说不着你偏心：只掉冷暖。
  const tie = fireOn("oneup", seed => stage(newWorld(seed, PEOPLE), ["tangke", "peng"]));
  assert.ok(tie);
  assert.equal(opinionOf(tie, "peng"), 0);
  assert.equal(opinionOf(tie, "tangke"), 0);

  // 不好胜的不杠。
  assert.ok(neverFires("oneup", seed => stage(newWorld(seed, PEOPLE), ["mei", "duan"])));
});

test("替你说话：热心/念旧、看法够高的人对有戒心的熟人替你美言，多疑打折", () => {
  // 何太念旧；沈薇对她够亲（沈薇→何太 45），沈薇对你有戒心。
  const hit = fireOn("vouch", seed => setOpinion(
    setOpinion(stage(newWorld(seed, PEOPLE), ["he", "shen"]), "he", 50), "shen", -10));
  assert.ok(hit);
  assert.ok(opinionOf(hit, "shen") > -10, "好话起了作用");
  const mem = hit.memories.find(m => m.holder === "shen" && m.act === "vouched-for");
  assert.ok(mem && mem.valence === 1 && mem.heardFrom === "he",
    "好话要记成「听来的」——传话系统接着往下传");

  // 多疑的邱太（邱太→何太 25）听到的同一句话要打折。
  const wary = fireOn("vouch", seed => setOpinion(
    setOpinion(stage(newWorld(seed, PEOPLE), ["he", "qiu"]), "he", 50), "qiu", -10));
  assert.ok(wary);
  assert.ok(opinionOf(wary, "qiu") > -10, "多疑也多少听进一点");
  assert.ok(opinionOf(wary, "qiu") < opinionOf(hit, "shen"), "但比不多疑的动得少");

  // 不够向着你的人不开口（看法 30 < 40）。
  assert.ok(neverFires("vouch", seed => setOpinion(
    setOpinion(stage(newWorld(seed, PEOPLE), ["he", "shen"]), "he", 30), "shen", -10)));
  // 对方没戒心（看法 ≥0）就不用劝。
  assert.ok(neverFires("vouch", seed => setOpinion(
    setOpinion(stage(newWorld(seed, PEOPLE), ["he", "shen"]), "he", 50), "shen", 5)));
  // 既不热心也不念旧的唐可，看法再高也不替你说。
  assert.ok(neverFires("vouch", seed => setOpinion(
    setOpinion(stage(newWorld(seed, PEOPLE), ["tangke", "suman"]), "tangke", 50), "suman", -10)));
});

test("背后抱怨：结了怨的人跟熟人嚼舌根，听来的坏印象接着往下传", () => {
  // 沈薇对你 -40，何太是她要好的听众（沈薇→何太 45）。
  const hit = fireOn("backbite", seed =>
    setOpinion(stage(newWorld(seed, PEOPLE), ["shen", "he"]), "shen", -40));
  assert.ok(hit);
  const mem = hit.memories.find(m => m.holder === "he" && m.act === "badmouthed");
  assert.ok(mem && mem.valence === -1 && mem.heardFrom === "shen",
    "抱怨生成一条「听来的」负面记忆");
  assert.ok(opinionOf(hit, "he") < 0, "还没见过你的何太先入为主");
  assert.ok(hit.log.at(-1)!.text.includes("嘀咕"));

  // 这条听来的记忆能被传话系统再传出去：何太讲给邱太。
  let passed = false;
  for (let i = 0; i < 80 && !passed; i++) {
    let w = stage(newWorld(`bb-${i}`, PEOPLE), ["he", "qiu"]);
    w = { ...w, memories: [
      { day: 1, holder: "he", subject: PLAYER, act: "badmouthed", valence: -1, heardFrom: "shen" },
    ] };
    w = ambient(w, PEOPLE);
    passed = w.memories.some(m => m.holder === "qiu" && m.act === "badmouthed" && m.heardFrom === "he");
  }
  assert.ok(passed, "坏话应当顺着关系网再传一层");

  // 没到结怨的程度（-20 > -30）不会背后编排你。
  assert.ok(neverFires("backbite", seed =>
    setOpinion(stage(newWorld(seed, PEOPLE), ["shen", "he"]), "shen", -20)));
  // 身边没熟人，火再大也没处说（小段和沈薇无关系）。
  assert.ok(neverFires("backbite", seed =>
    setOpinion(stage(newWorld(seed, PEOPLE), ["shen", "duan"]), "shen", -40)));
});

test("拉人：怨气攒够的顾客一走，够亲的跟着走", () => {
  // 沈薇 -40，闺蜜何太在场 → 走一双。
  const hit = fireOn("pull", seed =>
    setOpinion(stage(newWorld(seed, PEOPLE), ["shen", "he"]), "shen", -40));
  assert.ok(hit);
  assert.ok(!("shen" in hit.present) && !("he" in hit.present), "两个人都离开楼层");
  assert.equal(hit.qualities["away:shen"], hit.day, "今天不再回来");
  assert.equal(hit.qualities["away:he"], hit.day);
  assert.equal(opinionOf(hit, "he"), PULL_FOLLOW_OPINION, "跟着走的也记你一笔");
  assert.ok(hit.memories.some(m => m.holder === "he" && m.act === "stormed-off" && !m.heardFrom),
    "她就在场看着，算亲眼所见");
  assert.ok(hit.memories.some(m => m.holder === "shen" && m.act === "walked-out"));

  // 交情不够不跟：冷暖压到 20（种类仍是 friend）。
  assert.ok(neverFires("pull", seed => ({
    ...setOpinion(stage(newWorld(seed, PEOPLE), ["shen", "he"]), "shen", -40),
    bonds: { "shen>he": 20, "he>shen": 20 },
  })), "点头之交不跟着走");
  // 没那么气不走。
  assert.ok(neverFires("pull", seed =>
    setOpinion(stage(newWorld(seed, PEOPLE), ["shen", "he"]), "shen", -20)));
  // 同事是这层上班的人，不存在"跟着走"（苏蔓 -40 + 唐可也不会走）。
  assert.ok(neverFires("pull", seed =>
    setOpinion(stage(newWorld(seed, PEOPLE), ["suman", "tangke"]), "suman", -40)),
    "员工没有「走」这回事");
});

test("上限与冷却：每时段最多 MAX_EXCHANGES_PER_SLOT 次，同对同种一天一次", () => {
  // 一次摆出好几对够格的：两组闲聊、一组拌嘴、一组较劲。
  const crowded = (seed: string) => stage(newWorld(seed, PEOPLE),
    ["suman", "tangke", "peng", "zhao", "shen", "he", "luyao"]);
  let fired = 0;
  for (let i = 0; i < 40; i++) {
    const w = exchanges(crowded(`cap-${i}`), PEOPLE);
    const total = Object.values(exchangeTally(w)).reduce((a, b) => a + b, 0);
    assert.ok(total <= MAX_EXCHANGES_PER_SLOT, `一次最多 ${MAX_EXCHANGES_PER_SLOT} 次，实际 ${total}`);
    fired = Math.max(fired, total);
  }
  assert.equal(fired, MAX_EXCHANGES_PER_SLOT, "人够多时确实会顶到上限");

  // 同一天再来一轮：做过的（动作, 人）组合不再进候选。
  let w = exchanges(crowded("cap-done"), PEOPLE);
  const doneKeys = Object.keys(w.qualities).filter(k => k.startsWith("ex:"));
  assert.ok(doneKeys.length >= 1, "第一场确实发生了点什么");
  for (const c of exchangeCandidates(w, PEOPLE))
    assert.ok(!doneKeys.includes(exKey(c.act, c.a, c.b)), `${c.act} ${c.a}/${c.b} 今天来过了`);
});

test("确定性：同一个排面同一个种子，结果逐位相同", () => {
  const build = () => setOpinion(
    stage(newWorld("det", PEOPLE), ["suman", "tangke", "peng", "zhao", "shen", "he"]),
    "shen", -40);
  assert.equal(serializeWorld(exchanges(build(), PEOPLE)), serializeWorld(exchanges(build(), PEOPLE)));
  // 连着 ambient 一起（传话+抢客+自主社交）也确定。
  const a2 = ambient(build(), PEOPLE), b2 = ambient(build(), PEOPLE);
  assert.equal(serializeWorld(a2), serializeWorld(b2));
});

test("候选清单本身也按规矩来：不在场的人不出候选", () => {
  const w = stage(newWorld("cand", PEOPLE), ["suman", "tangke"]);
  const cands = exchangeCandidates(w, PEOPLE);
  assert.ok(cands.length > 0);
  assert.ok(cands.every(c => c.a in w.present && c.b in w.present));
  assert.ok(cands.every(c => EXCHANGE_ACTS.includes(c.act)));
  assert.ok(person("suman").tempers.includes("warm"), "夹具 sanity：苏蔓是热心");
});

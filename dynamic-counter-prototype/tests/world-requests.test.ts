// 每日委托：生成条件、完成判定、奖励、失约后果、存档往返。
// 生成条件用正式内容（content 里才有罗曼/苏蔓/唐可/方敏与苏蔓的老客）；
// 判定与结算用夹具 —— 摆一个场面直接调 openDay / settleRequests / resolveRequestChoice。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  beginSlot, endDay, newWorld as engineNewWorld, opinionOf, parseWorld, serializeWorld, warmthOf,
} from "../src/world/engine.ts";
import {
  checkRequest, openDay, resolveRequestChoice, settleRequests, seenKey, soldUnitsKey,
  QUOTA_MIN, REQUEST_DONE_OPINION, REQUEST_FAIL_OPINION, REQUEST_DECLINE_OPINION,
  SAMPLES_UNITS, SAMPLES_OPINION, KEEP_OPINION, KEEP_WARMTH, CLEAN_OPINION, CLEAN_COMPLIANCE,
  QUOTA_STANDING, REBOOK_OPINION, REQUESTS_PER_DAY,
} from "../src/world/requests.ts";
import type { Slot, World, WorldRequest } from "../src/world/types.ts";
import { PLAYER } from "../src/world/types.ts";
import { PEOPLE } from "../src/world/content/index.ts";

// 第一季第 1 天不发委托（FIRST_REQUEST_DAY）。这里测的是委托本身，开在第 2 季的第 1 天，天数口径不变。
const newWorld: typeof engineNewWorld = (seed, people) => ({ ...engineNewWorld(seed, people), season: 2 });

/** 手动摆一个场面：不经过 beginSlot，直接指定谁在场（openDay 读的就是这份 present）。 */
const stage = (w: World, ids: string[], zone = "atrium"): World =>
  ({ ...w, present: Object.fromEntries(ids.map(id => [id, zone])) });

const setOpinion = (w: World, id: string, v: number): World =>
  ({ ...w, opinion: { ...w.opinion, [id]: v } });

const req = (over: Partial<WorldRequest>): WorldRequest => ({
  id: "req:t", kind: "quota", by: "roman", day: 1, due: 1, state: "open",
  text: "t", reward: "r", ...over,
});

const withReq = (w: World, r: WorldRequest): World => ({ ...w, requests: [r] });
const stateOf = (w: World, id = "req:t") => w.requests.find(r => r.id === id)?.state;

// —— 生成 ——

test("openDay：第一个时段才发委托，同一天不重复发，一天最多两条", () => {
  let w = stage(newWorld("req-gen", PEOPLE), ["roman", "fangmin", "mei", "duan"], "counter");
  w = { ...w, slot: 1 as Slot };
  assert.deepEqual(openDay(w, PEOPLE).requests, [], "不是第一个时段不发");

  w = { ...w, slot: 0 as Slot };
  const a = openDay(w, PEOPLE);
  assert.ok(a.requests.length >= 1 && a.requests.length <= REQUESTS_PER_DAY);
  assert.ok(a.requests.every(r => r.day === 1 && r.due >= r.day && r.state === "open"));
  const again = openDay(a, PEOPLE);
  assert.equal(again.requests.length, a.requests.length, "同一天再开不重复发");

  // 不同的人来提：同一个人一天不张两次口。
  assert.equal(new Set(a.requests.map(r => r.by)).size, a.requests.length);
});

test("openDay 确定性：同一种子提出同一批委托", () => {
  const make = () => {
    const w = stage(newWorld("req-det", PEOPLE), ["roman", "suman", "tangke", "fangmin", "mei", "duan"], "counter");
    return openDay({ ...w, slot: 0 as Slot }, PEOPLE);
  };
  assert.equal(serializeWorld(make()), serializeWorld(make()));
});

test("模板生成条件：罗曼的件数按前几天平均，苏蔓只托她的老客，唐可要有得借", () => {
  // 只有罗曼在场：只有 quota 可提。第 1 天没历史，按下限开。
  let w = stage(newWorld("req-q", PEOPLE), ["roman"], "counter");
  let reqs = openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests;
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0]!.kind, "quota");
  assert.equal(reqs[0]!.n, QUOTA_MIN);
  assert.equal(reqs[0]!.due, 1, "当天打烊结算");

  // 第 4 天：前三天分别卖出 6、0、9 件 → 平均 5 → 按 5 件开。
  w = { ...stage(newWorld("req-q", PEOPLE), ["roman"], "counter"), day: 4,
    qualities: { [soldUnitsKey(1)]: 6, [soldUnitsKey(3)]: 9 } };
  reqs = openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests;
  assert.equal(reqs[0]!.n, 5, "(6+0+9)/3 向上取整");

  // 苏蔓 + 她的老客梅女士在场：能提 keep；老客不在场就不提。
  w = stage(newWorld("req-k", PEOPLE), ["suman", "mei"], "counter");
  reqs = openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests;
  assert.deepEqual(reqs.map(r => r.kind), ["keep"]);
  assert.equal(reqs[0]!.by, "suman");
  assert.equal(reqs[0]!.target, "mei");
  w = stage(newWorld("req-k", PEOPLE), ["suman"], "counter");
  assert.equal(openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests.length, 0, "老客不在场没得提");

  // 唐可 + 小样够：能提 samples；小样不够不开这个口。
  w = stage(newWorld("req-s", PEOPLE), ["tangke"], "counter");
  reqs = openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests;
  assert.deepEqual(reqs.map(r => r.kind), ["samples"]);
  assert.equal(reqs[0]!.n, SAMPLES_UNITS);
  w = { ...w, samples: SAMPLES_UNITS - 1 };
  assert.equal(openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests.length, 0, "小样不够借不了");
});

test("模板生成条件：熟客牵线/劝和要看法够线，方敏只提别硬推，约明天要加过微信", () => {
  // 看法 ≥15 的梅女士在场，层上有她不认识的人 → pair-introduce。
  let w = setOpinion(stage(newWorld("req-p", PEOPLE), ["mei", "duan"], "counter"), "mei", 20);
  let reqs = openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests;
  assert.deepEqual(reqs.map(r => r.kind), ["pair"]);
  assert.equal(reqs[0]!.by, "mei");
  assert.equal(reqs[0]!.goal, "introduce");

  // 看法不够不开口。
  w = stage(newWorld("req-p", PEOPLE), ["mei", "duan"], "counter");
  assert.equal(openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests.length, 0);

  // 白姐跟宋姐是对头：看法够的白姐在场 → pair-mediate 指名宋姐。
  w = setOpinion(stage(newWorld("req-p2", PEOPLE), ["baijie", "songjie"], "atrium"), "baijie", 20);
  reqs = openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests;
  const med = reqs.find(r => r.goal === "mediate");
  assert.ok(med, "对头在场能提劝和");
  assert.equal(med!.target, "songjie");

  // 方敏 → clean。
  w = stage(newWorld("req-c", PEOPLE), ["fangmin"], "counter");
  reqs = openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests;
  assert.deepEqual(reqs.map(r => r.kind), ["clean"]);

  // 加过微信的客人 → rebook：期限明天，同时把明天的约排上了。
  w = { ...stage(newWorld("req-r", PEOPLE), ["tangke"], "counter"), qualities: { "wechat:mei": 1 } };
  reqs = openDay({ ...w, slot: 0 as Slot }, PEOPLE).requests;
  const rb = reqs.find(r => r.kind === "rebook");
  assert.ok(rb, "加过微信的能约明天");
  assert.equal(rb!.due, 2);
  assert.equal(rb!.target, "mei");
});

test("rebook 生成时把明天的约排进 appointments", () => {
  let w = { ...stage(newWorld("req-r", PEOPLE), ["tangke"], "counter"), qualities: { "wechat:mei": 1 } };
  w = openDay({ ...w, slot: 0 as Slot }, PEOPLE);
  const ap = w.appointments.find(a => a.person === "mei");
  assert.ok(ap, "她明天的约要真排上");
  assert.equal(ap!.day, 2);
  assert.equal(ap!.reason, "wechat");
});

// —— 完成判定与结算 ——

test("quota：卖出件数够就成，不够就失约；做到柜位也认", () => {
  const r = req({ kind: "quota", by: "roman", n: 3 });
  let w = withReq(stage(newWorld("t", PEOPLE), ["roman"], "counter"), r);
  w = { ...w, qualities: { [soldUnitsKey(1)]: 3 }, standing: 50 };
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "done");
  assert.equal(opinionOf(w, "roman"), REQUEST_DONE_OPINION);
  assert.equal(w.standing, 50 + QUOTA_STANDING, "罗曼的数柜位也认");
  assert.ok(w.memories.some(m => m.holder === "roman" && m.act === "kept-promise" && m.valence === 1));
  assert.ok(w.log.some(l => l.text.includes("做到了")));

  w = withReq(stage(newWorld("t", PEOPLE), ["roman"], "counter"), r);
  w = { ...w, qualities: { [soldUnitsKey(1)]: 2 } };
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "failed");
  assert.equal(opinionOf(w, "roman"), REQUEST_FAIL_OPINION);
  const mem = w.memories.find(m => m.holder === "roman" && m.act === "broke-promise");
  assert.ok(mem && mem.valence === -1 && mem.subject === PLAYER && !mem.heardFrom,
    "失约要留一条能被传出去的负面记忆");
});

test("keep：看住了成、被请走或没顾上都算失约", () => {
  const r = req({ kind: "keep", by: "suman", target: "mei" });
  // 招呼过 → 成：苏蔓看法涨，老客跟她更亲。
  let w = withReq(stage(newWorld("t", PEOPLE), ["suman", "mei"], "counter"), r);
  w = { ...w, memories: [{ day: 1, holder: "mei", subject: PLAYER, act: "greeted", valence: 0 }] };
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "done");
  assert.equal(opinionOf(w, "suman"), KEEP_OPINION);
  assert.equal(warmthOf(w, PEOPLE, "mei", "suman"), 50 + KEEP_WARMTH, "老客跟她更亲");

  // 被对面请走 → 失约（哪怕白天招呼过）。
  w = withReq(stage(newWorld("t", PEOPLE), ["suman"], "counter"), r);
  w = { ...w, qualities: { "away:mei": 1 },
    memories: [{ day: 1, holder: "mei", subject: PLAYER, act: "greeted", valence: 0 }] };
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "failed");
  assert.ok(w.memories.some(m => m.holder === "suman" && m.act === "broke-promise"));

  // 人在你没顾上 → 也是失约。
  w = withReq(stage(newWorld("t", PEOPLE), ["suman"], "counter"), r);
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "failed");
});

test("samples：应下小样真出去、记人情；回绝体面一点；晾到打烊算失约", () => {
  const r = req({ kind: "samples", by: "tangke", n: SAMPLES_UNITS });
  let w = withReq(stage(newWorld("t", PEOPLE), ["tangke"], "counter"), r);
  w = resolveRequestChoice(w, PEOPLE, r.id, true);
  assert.equal(stateOf(w), "done");
  assert.equal(w.samples, 8 - SAMPLES_UNITS, "小样真给了");
  assert.equal(opinionOf(w, "tangke"), SAMPLES_OPINION);
  assert.ok(w.memories.some(m => m.holder === "tangke" && m.act === "lent-samples"));

  w = withReq(stage(newWorld("t", PEOPLE), ["tangke"], "counter"), r);
  w = resolveRequestChoice(w, PEOPLE, r.id, false);
  assert.equal(stateOf(w), "declined");
  assert.equal(w.samples, 8, "没借小样没少");
  assert.equal(opinionOf(w, "tangke"), REQUEST_DECLINE_OPINION);
  assert.ok(w.memories.some(m => m.holder === "tangke" && m.act === "turned-down"));

  // 不理不睬拖到打烊：按失约结，比当场回绝难看。
  w = withReq(stage(newWorld("t", PEOPLE), ["tangke"], "counter"), r);
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "failed");
  assert.equal(opinionOf(w, "tangke"), REQUEST_FAIL_OPINION);
  assert.ok(w.memories.some(m => m.holder === "tangke" && m.act === "broke-promise"));

  // 小样不够时想应也应不下。
  w = { ...withReq(stage(newWorld("t", PEOPLE), ["tangke"], "counter"), r), samples: 1 };
  assert.equal(resolveRequestChoice(w, PEOPLE, r.id, true), w);
});

test("pair：介绍成看 introduced，劝和成看 mediated", () => {
  const ri = req({ kind: "pair", by: "mei", goal: "introduce" });
  let w = withReq(stage(newWorld("t", PEOPLE), ["mei"], "counter"), ri);
  w = { ...w, memories: [{ day: 1, holder: "mei", subject: "duan", act: "introduced", valence: 1 }] };
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "done");
  assert.equal(opinionOf(w, "mei"), REQUEST_DONE_OPINION);

  const rm = req({ kind: "pair", by: "mei", goal: "mediate", target: "zhao" });
  w = withReq(stage(newWorld("t", PEOPLE), ["mei"], "counter"), rm);
  w = { ...w, memories: [{ day: 1, holder: "mei", subject: PLAYER, act: "mediated", valence: 2 }] };
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "done");

  w = withReq(stage(newWorld("t", PEOPLE), ["mei"], "counter"), rm);
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "failed");
  assert.equal(opinionOf(w, "mei"), REQUEST_FAIL_OPINION);
});

test("clean：一天没硬推就成；推了一单全盘皆输", () => {
  const r = req({ kind: "clean", by: "fangmin" });
  let w = withReq(stage(newWorld("t", PEOPLE), ["fangmin"], "counter"), r);
  w = { ...w, compliance: 60 };
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "done");
  assert.equal(opinionOf(w, "fangmin"), CLEAN_OPINION);
  assert.equal(w.compliance, 60 + CLEAN_COMPLIANCE, "台账记一笔");

  w = withReq(stage(newWorld("t", PEOPLE), ["fangmin"], "counter"), r);
  w = { ...w, memories: [{ day: 1, holder: "mei", subject: PLAYER, act: "hard-sell", valence: -2 }] };
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "failed");
});

test("rebook：明天来了、接住了才算；她没来成不算失约", () => {
  const r = req({ kind: "rebook", by: "mei", target: "mei", day: 1, due: 2 });
  // 第 2 天她来了（seen 盖章）、被招呼过 → 成。
  let w = withReq({ ...stage(newWorld("t", PEOPLE), ["mei"], "counter"), day: 2, slot: 3 as Slot }, r);
  w = { ...w, qualities: { [seenKey("mei")]: 2 },
    memories: [{ day: 2, holder: "mei", subject: PLAYER, act: "greeted", valence: 0 }] };
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "done");
  assert.equal(opinionOf(w, "mei"), REBOOK_OPINION);

  // 没露面 → 作废，不罚。
  w = withReq({ ...stage(newWorld("t", PEOPLE), [], "counter"), day: 2, slot: 3 as Slot }, r);
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "void");
  assert.equal(opinionOf(w, "mei"), 0, "没来成不算她的错也不算你的");

  // 来了被对面请走 → 失约。
  w = withReq({ ...stage(newWorld("t", PEOPLE), ["mei"], "rival"), day: 2, slot: 3 as Slot }, r);
  w = { ...w, qualities: { [seenKey("mei")]: 2, "away:mei": 2 } };
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "failed");

  // 到期之前不结。
  w = withReq({ ...stage(newWorld("t", PEOPLE), ["mei"], "counter"), day: 1 }, r);
  w = settleRequests(w, PEOPLE);
  assert.equal(stateOf(w), "open", "明天才到期的今天不结");
});

test("checkRequest 逐模板判法", () => {
  const w = stage(newWorld("t", PEOPLE), ["mei"], "counter");
  assert.equal(checkRequest({ ...w, qualities: { [soldUnitsKey(1)]: 5 } }, PEOPLE,
    req({ kind: "quota", n: 5 })), "done");
  assert.equal(checkRequest(w, PEOPLE, req({ kind: "quota", n: 6 })), "failed");
  assert.equal(checkRequest(w, PEOPLE, req({ kind: "clean" })), "done");
  assert.equal(checkRequest({ ...w, memories: [{ day: 1, holder: "mei", subject: PLAYER, act: "hard-sell", valence: -2 }] }, PEOPLE,
    req({ kind: "clean" })), "failed");
  assert.equal(checkRequest({ ...w, memories: [{ day: 1, holder: "mei", subject: PLAYER, act: "greeted", valence: 0 }] }, PEOPLE,
    req({ kind: "keep", target: "mei" })), "done");
  assert.equal(checkRequest(w, PEOPLE, req({ kind: "keep", target: "mei" })), "failed");
  assert.equal(checkRequest(w, PEOPLE, req({ kind: "samples" })), "failed");
});

// —— 接入引擎 ——

test("beginSlot 第一个时段发委托、当天不再发；endDay 夜里结清", () => {
  let w = newWorld("req-flow", PEOPLE);
  w = beginSlot(w, PEOPLE);
  assert.ok(w.requests.length >= 1, "开门应当有人托你做事");
  assert.equal(w.requests[0]!.day, 1);
  // 同一个时段再开不重复。
  const n = w.requests.length;
  w = beginSlot({ ...w, present: {} }, PEOPLE);
  assert.equal(w.requests.length, n, "同一天重复开时段不重复发");

  // 走过一天：endDay 之后当天到期的都结了。
  w = { ...w, slot: 3 as Slot, energy: 0 };
  w = endDay(w, PEOPLE);
  assert.equal(w.day, 2);
  assert.ok(w.requests.filter(r => r.due <= 1).every(r => r.state !== "open"), "昨天到期的都结清了");
});

test("存档：委托随档往返，旧档缺字段按空读，坏档拒收", () => {
  let w = openDay({ ...stage(newWorld("req-save", PEOPLE), ["roman"], "counter"), slot: 0 as Slot }, PEOPLE);
  assert.ok(w.requests.length > 0);
  assert.deepEqual(parseWorld(serializeWorld(w)), w, "带委托的存档往返一致");

  const old = JSON.parse(serializeWorld(w));
  delete old.world.requests;
  const parsed = parseWorld(JSON.stringify(old));
  assert.deepEqual(parsed!.requests, [], "旧档缺字段按空读");

  const bad = JSON.parse(serializeWorld(w));
  bad.world.requests = [{ id: "x", kind: "quota", by: "roman", day: 1, due: 1, state: "pending", text: "t", reward: "r" }];
  assert.equal(parseWorld(JSON.stringify(bad)), null, "state 越界拒收");
  bad.world.requests = [{ id: "x", kind: "bogus", by: "roman", day: 1, due: 1, state: "open", text: "t", reward: "r" }];
  assert.equal(parseWorld(JSON.stringify(bad)), null, "kind 不认得拒收");
  bad.world.requests = [{ id: "x", kind: "quota", by: "roman", day: 1, due: 0, state: "open", text: "t", reward: "r" }];
  assert.equal(parseWorld(JSON.stringify(bad)), null, "期限早于提起日拒收");
});

test("第一季第 1 天不托事，第 2 天起才开始", () => {
  const first = stage(engineNewWorld("req-first-day", PEOPLE), ["roman", "fangmin", "tangke", "suman"], "counter");
  assert.equal(openDay(first, PEOPLE).requests.length, 0);
  const second = { ...first, day: 2 };
  assert.ok(openDay(second, PEOPLE).requests.length > 0);
});

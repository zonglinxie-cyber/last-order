import assert from "node:assert/strict";
import test from "node:test";
import { newWorld } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { World } from "../src/world/types.ts";
import { closedRivalSeason, recordRivalSeason, rivalReply, rivalStreak, rivalYearResult, type RivalSeason } from "../src/world/rival-history.ts";
import {
  ARC_PEOPLE, emptyWorldProgress, observeWorldProgress, parseWorldProgress,
  WORLD_PROGRESS_KEY, WORLD_PROGRESS_VERSION,
  type WorldProgress,
} from "../src/world/progress.ts";

// 造一份只改了关心字段的世界读数：present / opinion / qualities。
const at = (patch: Partial<World>): World => ({ ...newWorld("t", PEOPLE), ...patch });

const result = (season: number, money = 10000, rivalMoney = 8000, run = "t"): RivalSeason => ({ run, season, money, rivalMoney, heat: 0 });

test("交锋只记真实收季：季中、季末前和未知结局不入账，刷新不重记", () => {
  const empty = emptyWorldProgress();
  for (const day of [1, 7, 28]) assert.deepEqual(observeWorldProgress(empty, at({ day }), "counter-empty").rivalSeasons, []);
  const closed = at({ day: 29, money: 11000, rivalMoney: 9000, heat: ["thin-samples"] });
  assert.equal(closedRivalSeason(at({ day: 28 })), null);
  assert.deepEqual(observeWorldProgress(empty, closed).rivalSeasons, []);
  assert.deepEqual(observeWorldProgress(empty, closed, "unknown").rivalSeasons, []);
  const first = observeWorldProgress(empty, closed, "counter-empty");
  assert.deepEqual(first.rivalSeasons, [{ ...result(1, 11000, 9000), heat: 1 }]);
  assert.deepEqual(observeWorldProgress(first, closed, "counter-empty").rivalSeasons, first.rivalSeasons);
  assert.deepEqual(observeWorldProgress(first, { ...closed, money: 99999 }, "counter-empty").rivalSeasons, first.rivalSeasons,
    "同一段经历同一季的首次真实结算冻结，不因重开季末页刷胜场");
  assert.deepEqual(empty.rivalSeasons, []);
});

test("交锋按新档区分，换季不丢比分，旧档缺季不补零", () => {
  let p = observeWorldProgress(emptyWorldProgress(), at({ day: 29, season: 3, money: 400, rivalMoney: 680 }), "counter-empty");
  p = observeWorldProgress(p, at({ seed: "new-life", day: 29, season: 1, money: 10000, rivalMoney: 8000 }), "counter-empty");
  assert.equal(p.rivalSeasons.length, 2);
  assert.deepEqual(p.rivalSeasons.map(r => [r.run, r.season]), [["t", 3], ["new-life", 1]]);
  assert.deepEqual(observeWorldProgress(p, at({ season: 4, day: 1 })).rivalSeasons, p.rivalSeasons);
  const old = { ...p } as Record<string, unknown>; delete old.rivalSeasons;
  assert.deepEqual(parseWorldProgress(JSON.stringify(old))!.rivalSeasons, []);
});

test("四季交锋按同一段经历和年度算胜负，平局不算输，不同年不串账", () => {
  const rows = [result(1), result(2, 8000, 8000), result(3, 5000, 8000), result(4), result(5, 1000, 8000), result(2, 1, 20000, "other")];
  const year = rivalYearResult(rows, "t", 4);
  assert.equal(year.year, 1); assert.equal(year.wins, 2); assert.equal(year.draws, 1); assert.equal(year.losses, 1);
  assert.equal(year.complete, true); assert.equal(year.verdict, "你赢下这一年");
  assert.equal(rivalYearResult(rows, "t", 5).losses, 1);
  assert.equal(rivalYearResult(rows, "t", 5).wins, 0);
  const tie = rivalYearResult([result(1), result(2), result(3, 0, 1), result(4, 0, 1)], "t", 4);
  assert.equal(tie.verdict, "这一年打成平手");
});

test("提前锁定要有完整连续记录，旧比分缺失不能假装只剩一季", () => {
  assert.equal(rivalYearResult([result(1), result(2), result(3)], "t", 3).locked, true);
  assert.equal(rivalYearResult([result(1), result(2)], "t", 2).verdict, null);
  assert.equal(rivalYearResult([result(1), result(2), result(3, 8000, 8000)], "t", 3).locked, true);
  assert.equal(rivalYearResult([result(5), result(6), result(7)], "t", 7).verdict, "你赢下这一年");
  const gap = rivalYearResult([result(2), result(3), result(4)], "t", 4);
  assert.equal(gap.verdict, null); assert.equal(gap.locked, false); assert.deepEqual(gap.missing, [1]);
});

test("连胜、连败和扳回一局的回话来自连续实绩，缺季与平局都断开", () => {
  assert.deepEqual(rivalStreak([result(1), result(2)], "t", 2), { outcome: "win", count: 2 });
  assert.equal(rivalStreak([result(1), result(3)], "t", 3).count, 1);
  assert.equal(rivalStreak([result(1, 1, 1), result(2)], "t", 2).count, 1);
  assert.equal(rivalStreak([result(2, 0, 1), result(3, 0, 1)], "t", 3).count, 2);
  assert.match(rivalReply(result(2), [result(1, 0, 1), result(2)]), /扳回来了/);
  assert.match(rivalReply(result(2), [result(1), result(2)]), /连着 2 季/);
  assert.match(rivalReply(result(1, 1, 1), [result(1, 1, 1)]), /一分都没分出来/);
});

test("战绩坏数据不进入档案：重复、新档标记、金额、季数与难度逐项校验", () => {
  const p = { ...emptyWorldProgress(), rivalSeasons: [result(1)] };
  assert.deepEqual(parseWorldProgress(JSON.stringify(p)), p);
  for (const patch of [{ run: "" }, { season: 0 }, { season: 1.2 }, { money: "1000" }, { rivalMoney: null }, { heat: 6 }, { heat: -1 }])
    assert.equal(parseWorldProgress(JSON.stringify({ ...p, rivalSeasons: [{ ...result(1), ...patch }] })), null);
  assert.equal(parseWorldProgress(JSON.stringify({ ...p, rivalSeasons: [result(1), result(1)] })), null);
  assert.equal(parseWorldProgress(JSON.stringify({ ...p, rivalSeasons: {} })), null);
  assert.deepEqual(recordRivalSeason([], null), []);
});

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
  assert.deepEqual(ARC_PEOPLE, ["shen", "anjie", "luyao", "suman", "xiaoyu", "zhou", "zhao", "miduo", "mei", "yinxiaojie", "duan", "zhaoning", "tangke", "roman", "fangmin", "qiaowan", "songjie", "baijie", "peilan", "liangxia"]);
  // 空档里 arcEnds 应已铺好这二十条线，但都还没落点
  assert.equal(ARC_PEOPLE.length, 20, "个人线名册：改这条之前先改 docs/人情场设计.md「人物线走得完」");
  for (const id of ARC_PEOPLE) assert.deepEqual(empty.arcEnds[id] ?? [], []);
});

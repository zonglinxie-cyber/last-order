import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL, endingTitle, type Campaign } from "../src/campaign.ts";
import {
  archiveEntries, campaignVisits, emptyProgress, endingEntries, parseProgress, PROGRESS_KEY, PROGRESS_VERSION, recordProgress,
  type Progress,
} from "../src/progress.ts";

const at = (flags: string[], extra: Partial<Campaign> = {}): Campaign => ({ ...INITIAL, flags, ...extra });

test("档案用独立存档键，不碰 campaign 的 SAVE_KEY", () => {
  assert.equal(PROGRESS_KEY, "last-order-progress-v1");
});

test("recordProgress 从 served/lost 旗推出每位顾客的结果", () => {
  const progress = recordProgress(emptyProgress(), at(["served:shen:good", "lost:mei", "served:zhou:risky", "served:duan:refused", "served:xiaoyu:out-of-stock"]));
  assert.deepEqual([...progress.met].sort(), ["duan", "mei", "shen", "xiaoyu", "zhou"]);
  assert.deepEqual(progress.outcomes.shen, ["good"]);
  assert.deepEqual(progress.outcomes.mei, ["lost"]);
  assert.deepEqual(progress.outcomes.zhou, ["risky"]);
  assert.deepEqual(progress.outcomes.duan, ["refused"]);
  assert.deepEqual(progress.outcomes.xiaoyu, ["out-of-stock"]);
  // 没落结果旗的人不算见过。
  assert.equal(progress.outcomes.zhao, undefined);
});

test("recordProgress 只增不减：跨局并入、重放同一局不变、原档不被改写", () => {
  const first = recordProgress(emptyProgress(), at(["served:shen:good", "lost:mei"]));
  const second = recordProgress(first, at(["served:mei:good", "served:zhao:risky"]));
  assert.deepEqual(second.outcomes.mei, ["lost", "good"]);
  assert.deepEqual(second.outcomes.shen, ["good"]);
  assert.deepEqual(second.outcomes.zhao, ["risky"]);
  const replay = recordProgress(second, at(["served:shen:good", "lost:mei"]));
  assert.deepEqual(replay, second);
  // 上一份没有被就地改写。
  assert.deepEqual(first.outcomes.mei, ["lost"]);
  assert.equal(first.met.length, 2);
});

test("结局只认收摊那一局，标题与 endingTitle 同源", () => {
  const win = at([], { finished: true, sales: 22_930, compliance: 60, trust: 60 });
  assert.equal(endingTitle(win), "你留下了，而且没变成她们");
  const withEnding = recordProgress(emptyProgress(), win);
  assert.deepEqual(withEnding.endings, ["你留下了，而且没变成她们"]);
  // 没收摊的同一副数字不算结局。
  assert.deepEqual(recordProgress(emptyProgress(), at([], { sales: 22_930, compliance: 60, trust: 60 })).endings, []);
  const dark = at([], { finished: true, sales: 8_000, compliance: 60, trust: 30 });
  const two = recordProgress(withEnding, dark);
  assert.deepEqual(two.endings, ["你留下了，而且没变成她们", endingTitle(dark)]);
  assert.deepEqual(recordProgress(two, dark).endings, two.endings);
});

test("parseProgress：合法档往返，类型不对整份丢弃", () => {
  const progress = recordProgress(emptyProgress(), at(["served:shen:good", "lost:mei"], { finished: true, sales: 22_930, compliance: 60, trust: 60 }));
  assert.deepEqual(parseProgress(JSON.stringify(progress)), progress);
  assert.equal(parseProgress(null), null);
  assert.equal(parseProgress("不是 JSON"), null);
  const bad = (patch: Record<string, unknown>) => JSON.stringify({ ...progress, ...patch, version: patch.version ?? PROGRESS_VERSION });
  assert.equal(parseProgress(bad({ version: 99 })), null);
  assert.equal(parseProgress(bad({ met: "shen" })), null);
  assert.equal(parseProgress(bad({ met: ["shen", "ghost"] })), null);
  assert.equal(parseProgress(bad({ outcomes: { shen: ["good", "cheated"] } })), null);
  assert.equal(parseProgress(bad({ outcomes: { ghost: ["good"] } })), null);
  assert.equal(parseProgress(bad({ outcomes: { shen: "good" } })), null);
  assert.equal(parseProgress(bad({ endings: ["你留下了，而且没变成她们", 7] })), null);
  assert.equal(parseProgress(bad({ endings: "你留下了，而且没变成她们" })), null);
});

test("变体归到同一张人物卡：回来的人按第几次来分条", () => {
  const progress = recordProgress(emptyProgress(), at([
    "served:shen:good", "served:returning:good",
    "served:zhou:risky", "served:zhou2:refused",
    "served:anjie2:good",
  ]));
  const entries = archiveEntries(progress);
  assert.equal(entries.length, 7);
  const shen = entries.find(entry => entry.key === "shen")!;
  assert.ok(shen.met);
  assert.deepEqual(shen.visits.map(visit => visit.id), ["shen", "returning"]);
  assert.equal(shen.visits[1].visitWord, "第 2 次来");
  assert.equal(shen.visits[1].need, "一整场直播稳定复现轻薄效果，并给出有记录的售后承诺");
  const zhou = entries.find(entry => entry.key === "zhou")!;
  assert.deepEqual(zhou.visits.map(visit => visit.outcomes), [["risky"], ["refused"]]);
  assert.equal(zhou.visits[0].need, null);
  // 只见过回来的安姐：卡片仍挂在安姐名下，条目写第二次来。
  const anjie = entries.find(entry => entry.key === "anjie")!;
  assert.deepEqual(anjie.visits.map(visit => visit.id), ["anjie2"]);
  assert.equal(anjie.visits[0].visitWord, "第 2 次来");
  assert.equal(anjie.visits[0].need, "皮肤已经稳住，要带妆十几个小时、强灯光和闪光灯下依然完整的妆面");
});

test("没见过的人是未解锁条目；做错过的人留一句话，不解锁她要的那句", () => {
  const progress = recordProgress(emptyProgress(), at(["served:mei:risky", "lost:duan"]));
  const entries = archiveEntries(progress);
  const mei = entries.find(entry => entry.key === "mei")!;
  assert.ok(mei.met);
  assert.equal(mei.visits[0].need, null);
  assert.match(mei.visits[0].outcomeWords.join(" "), /判断错/);
  const duan = entries.find(entry => entry.key === "duan")!;
  assert.ok(duan.met);
  assert.match(duan.visits[0].outcomeWords.join(" "), /等过头/);
  const zhao = entries.find(entry => entry.key === "zhao")!;
  assert.equal(zhao.met, false);
  assert.deepEqual(zhao.visits, []);
});

test("结局图鉴：五种全在列，达成的认标题", () => {
  const progress: Progress = { version: PROGRESS_VERSION, met: [], outcomes: {}, endings: ["柜台灯灭了"] };
  const entries = endingEntries(progress);
  assert.equal(entries.length, 5);
  assert.deepEqual(entries.filter(entry => entry.achieved).map(entry => entry.title), ["柜台灯灭了"]);
  const locked = entries.find(entry => !entry.achieved)!;
  assert.ok(locked.hint.length > 0);
  // campaign.ts 的 endingTitle 说得出五种，图鉴必须五种都摆着（用四种真实边界各跑一遍）。
  const titles = new Set([
    endingTitle(at([], { finished: true, sales: 22_930, compliance: 60, trust: 60 })),
    endingTitle(at([], { finished: true, sales: 22_930, compliance: 60, trust: 30 })),
    endingTitle(at([], { finished: true, sales: 22_930, compliance: 20, trust: 60 })),
    endingTitle(at([], { finished: true, sales: 8_000, compliance: 60, trust: 60 })),
    endingTitle(at([], { finished: true, sales: 8_000, compliance: 60, trust: 30 })),
  ]);
  assert.equal(titles.size, 5);
  assert.deepEqual([...titles].sort(), entries.map(entry => entry.title).sort());
});

test("campaignVisits 只认已知顾客的结果旗", () => {
  assert.deepEqual(campaignVisits(at(["served:ghost:good", "served:shen:good", "touched:shen:3", "sample:shen", "delivered:2"])), [{ id: "shen", outcome: "good" }]);
});

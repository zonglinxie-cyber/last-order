import assert from "node:assert/strict";
import test from "node:test";
import {
  BUNDLES, closeService, CUSTOMERS, fitOf, QUESTIONS, WEEK_ALLOCATION,
  type BundleId, type CustomerId, type ProductId,
} from "../src/campaign.ts";
import {
  BLITZ_ACTION_SECONDS, BLITZ_BEST_KEY, BLITZ_POOL, BLITZ_QUEUE_MAX, BLITZ_QUEUE_MIN,
  BLITZ_ROUNDS, BLITZ_SAVE_KEY, BLITZ_SECONDS, blitzClose, blitzDeck, blitzLook, blitzMulligan,
  blitzNext, blitzPlay, blitzQueue, blitzScore, blitzSendAway, blitzTick, blitzTrial,
  loadBlitzBest, loadBlitzRun, saveBlitzBest, saveBlitzRun, startBlitz,
  type BlitzRun, type BlitzSummary,
} from "../src/blitz.ts";
import { duelDeck } from "../src/duel.ts";

const begin = (seed = "s1"): BlitzRun => {
  const run = startBlitz(seed);
  assert.ok(run.blitz.duel, "开局第一位已经坐到镜前");
  return run;
};

const memoryStore = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
};

const positiveProduct = (id: CustomerId): ProductId =>
  (Object.keys({ soft: 1, glow: 1, repair: 1 }) as ProductId[]).find(p => fitOf(CUSTOMERS[id], p).tier === "positive")!;

// 每一局都打得完一单的流程：看一处有线索的点 + 有用的问牌 + 适配的试用，兴趣正好过 60。
const playOut = (run: BlitzRun): BlitzRun => {
  let r = run;
  const d = r.blitz.duel!;
  const cust = CUSTOMERS[d.customerId];
  const cue = (["eyes", "cheek", "nose"] as const).find(c => cust.cues[c].reveals.length > 0)!;
  const look = blitzLook(r, cue);
  assert.ok(look);
  r = look;
  const ask = r.blitz.duel!.hand.find(card => card.kind === "ask" && QUESTIONS[d.customerId][card.question!].useful);
  if (ask) {
    const played = blitzPlay(r, ask.id);
    assert.ok(played);
    r = played;
  }
  const trial = blitzTrial(r, positiveProduct(d.customerId), "left");
  assert.ok(trial);
  return trial;
};

test("同一副种子同一支队：队列与牌序完全确定，且都不带竞品插话位", () => {
  const a = startBlitz("s1"), b = startBlitz("s1"), c = startBlitz("s2");
  assert.deepEqual(a.blitz.queue, b.blitz.queue);
  assert.deepEqual(a.blitz.duel!.hand, b.blitz.duel!.hand);
  assert.notDeepEqual(a.blitz.queue, c.blitz.queue, "换个种子要换一支队伍");
  for (const id of a.blitz.queue) assert.equal(CUSTOMERS[id].rival, false, `${id} 不该是竞品顾客`);
  assert.ok(new Set(a.blitz.queue).size === a.blitz.queue.length, "队伍里同一位顾客只来一次");
});

test("队列长度在 5~7 位之间，牌堆里没有 rival / overpromise 卡", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const q = blitzQueue(`probe:${seed}`);
    assert.ok(q.length >= BLITZ_QUEUE_MIN && q.length <= BLITZ_QUEUE_MAX, `${q.length} 位`);
    for (const id of q) {
      const deck = blitzDeck(`probe:${seed}`, q.indexOf(id), id);
      assert.ok(deck.every(card => card.kind !== "rival" && card.kind !== "overpromise"));
      // 问牌全部来自她自己的 QUESTIONS，顺带露出的提示与 duelDeck 同源。
      const asks = deck.filter(card => card.kind === "ask");
      assert.deepEqual(asks.map(card => card.question).sort(), QUESTIONS[id].map((_, i) => i).sort());
    }
  }
  // blitzDeck 与 duelDeck 的牌面同源：同样的种子偏移下，内容只差被拿掉的那两种卡。
  const blitzCards = blitzDeck("s1", 0, "mei").map(card => card.id);
  const duelCards = duelDeck(1, "mei").map(card => card.id);
  assert.ok(blitzCards.every(id => !duelCards.includes(id) === false));
  assert.ok(!blitzCards.includes("overpromise"));
});

test("开局抽屉是整周配货，240 秒整表，第一位顾客已在接待位", () => {
  const run = begin();
  assert.deepEqual(run.campaign.stock, WEEK_ALLOCATION);
  assert.equal(run.blitz.secondsLeft, BLITZ_SECONDS);
  assert.equal(run.blitz.customerIndex, 1);
  assert.ok(blitzNext(run.blitz), "队里还有下一位");
  assert.equal(run.blitz.duel!.rounds, BLITZ_ROUNDS);
});

test("看脸不占回合但走表：免费的那一处仍然免费，时间烧掉一格", () => {
  const run = begin();
  const cue = (["eyes", "cheek", "nose"] as const).find(c => CUSTOMERS[run.blitz.duel!.customerId].cues[c].reveals.length > 0)!;
  const looked = blitzLook(run, cue);
  assert.ok(looked);
  assert.equal(looked.blitz.secondsLeft, BLITZ_SECONDS - BLITZ_ACTION_SECONDS);
  assert.equal(looked.blitz.duel!.round, 0, "看脸不是主动作，回合不推进");
  assert.equal(looked.blitz.duel!.interest, 34);
});

test("每个主动作从表上扣 8 秒，三个回合后进入最后一句", () => {
  let run = begin();
  for (let i = 0; i < BLITZ_ROUNDS; i++) {
    const card = run.blitz.duel!.hand[0];
    const played = blitzPlay(run, card.id);
    assert.ok(played, `第 ${i + 1} 张牌打得出去`);
    run = played;
    assert.equal(run.blitz.secondsLeft, BLITZ_SECONDS - (i + 1) * BLITZ_ACTION_SECONDS);
    assert.equal(run.blitz.duel!.round, i + 1);
  }
  assert.equal(run.blitz.duel!.lastCall, true);
  // 最后一句话之后，出牌与看脸都不再开门。
  assert.equal(blitzPlay(run, run.blitz.duel!.hand[0].id), null);
  assert.equal(blitzLook(run, "nose"), null);
  // 这时候要么开单要么送她走，mulligan 也锁了。
  assert.equal(blitzMulligan(run), null);
  const sent = blitzSendAway(run);
  assert.ok(sent);
  assert.ok(sent.blitz.duel, "送走之后下一位直接坐下");
  assert.notEqual(sent.blitz.duel!.customerId, run.blitz.duel!.customerId);
  assert.equal(sent.blitz.walked.length, 1);
  assert.equal(sent.blitz.score.served, 1);
});

test("倒计时到 0 强制送走当前顾客并进结算", () => {
  let run = begin();
  const id = run.blitz.duel!.customerId;
  run = blitzTick(run, BLITZ_SECONDS);
  assert.equal(run.blitz.over, true);
  assert.equal(run.blitz.secondsLeft, 0);
  assert.equal(run.blitz.duel!.walked, true);
  assert.ok(run.campaign.lost.includes(id));
  assert.ok(run.campaign.flags.includes(`lost:${id}`));
  assert.equal(run.campaign.activeSession, null);
  assert.ok(run.blitz.walked.includes(id));
  assert.equal(run.blitz.score.served, 1);
  assert.match(run.blitz.log.at(-2)!.text, /没等到/);
  // 表翻过 0 之后什么都按不动。
  assert.equal(blitzPlay(run, "catch"), null);
  assert.equal(blitzTick(run, 8).blitz.over, true);
});

test("一局打到结算：队伍全部过完，计分牌合上", () => {
  let run = begin();
  let guard = 0;
  while (!run.blitz.over && guard++ < 80) {
    const d = run.blitz.duel!;
    if (d.lastCall) { run = blitzSendAway(run)!; continue; }
    run = blitzPlay(run, d.hand[0].id) ?? blitzSendAway(run) ?? run;
  }
  assert.equal(run.blitz.over, true);
  assert.equal(run.blitz.score.served, run.blitz.queue.length);
  assert.equal(run.blitz.walked.length, run.blitz.queue.length);
});

test("成交落 resolveSale 同一条链：金额、件数、库存和逐笔账与直算一致", () => {
  let run = begin();
  const before = run.campaign;
  const id = run.blitz.duel!.customerId;
  run = playOut(run);
  const duel = run.blitz.duel!;
  assert.ok(duel.interest >= 60, `兴趣 ${duel.interest} 得能开单`);
  const product = duel.current!;

  // 用同一份 session 直算 closeService，作为"按 campaign.ts 直接算出来"的基准。
  const baseline = closeService({ ...before, activeSession: { ...run.campaign.activeSession!, bundle: "single" } });
  assert.ok(baseline);

  const closed = blitzClose(run, "single");
  assert.ok(closed);
  assert.deepEqual(closed.outcome, baseline.outcome, "同一份接待，同一张小票");
  assert.equal(closed.run.blitz.score.sales, baseline.outcome.amount);
  assert.equal(closed.run.blitz.score.clean, baseline.outcome.good ? 1 : 0);
  assert.equal(closed.run.blitz.score.served, 1);
  // 库存与逐笔账逐字段对齐，不是只对一个总数。
  assert.equal(closed.run.campaign.stock[product], baseline.campaign.stock[product]);
  assert.equal(closed.run.campaign.stock[product], before.stock[product] - baseline.outcome.units);
  assert.deepEqual(closed.run.campaign.orders.at(-1), baseline.campaign.orders.at(-1));
  assert.equal(closed.run.campaign.history.at(-1)!.text, baseline.campaign.history.at(-1)!.text);
  assert.equal(closed.run.campaign.sales, baseline.outcome.amount);
  // 下一位坐进来，接待位换人。
  assert.ok(closed.run.blitz.duel);
  assert.notEqual(closed.run.blitz.duel!.customerId, id);
});

test("成交总额与干净成交分开记：把人对的产品算干净，把走掉的算接待", () => {
  let run = begin();
  run = playOut(run);
  const closed = blitzClose(run, "single");
  assert.ok(closed);
  assert.equal(closed.run.blitz.score.clean, 1);
  // 直接打整个 run 到结算：剩下的位次送走，总账只含第一位那一单。
  run = closed.run;
  let guard = 0;
  while (!run.blitz.over && guard++ < 80) {
    const d = run.blitz.duel!;
    if (d.lastCall) { run = blitzSendAway(run)!; continue; }
    run = blitzPlay(run, d.hand[0].id) ?? blitzSendAway(run) ?? run;
  }
  const score = blitzScore(run.blitz);
  assert.equal(score.sales, closed.outcome.amount);
  assert.equal(score.served, run.blitz.queue.length);
  assert.equal(score.clean, 1);
});

test("上一局摘要与最高纪录：sales 优先，同分比干净，再比接待数", () => {
  const store = memoryStore();
  let run = begin("s1");
  run = playOut(run);
  const closed = blitzClose(run, "single")!;
  run = closed.run;
  let guard = 0;
  while (!run.blitz.over && guard++ < 80) {
    const d = run.blitz.duel!;
    if (d.lastCall) { run = blitzSendAway(run)!; continue; }
    run = blitzPlay(run, d.hand[0].id) ?? blitzSendAway(run) ?? run;
  }
  const summary = saveBlitzRun(store, run.blitz);
  assert.equal(store.getItem(BLITZ_SAVE_KEY), JSON.stringify(summary));
  assert.deepEqual(loadBlitzRun(store), summary);
  const { best, isNew } = saveBlitzBest(store, run.blitz);
  assert.equal(isNew, true);
  assert.deepEqual(best, summary);
  // 打更低的一局不该覆盖纪录。
  const lower = saveBlitzBest(store, { ...run.blitz, score: { sales: 0, served: 2, clean: 0 } });
  assert.equal(lower.isNew, false);
  assert.deepEqual(lower.best, best);
  assert.deepEqual(loadBlitzBest(store), best);
  // 同分比干净，再比接待数。
  const tied = { ...run.blitz, score: { ...run.blitz.score, clean: run.blitz.score.clean + 1 } };
  assert.equal(saveBlitzBest(store, tied).isNew, true);
  assert.ok((loadBlitzBest(store) as BlitzSummary).clean > best.clean);
});

test("存档读不进就是 null，不会把上一模式的记录认错", () => {
  const store = memoryStore();
  store.setItem(BLITZ_BEST_KEY, JSON.stringify({ version: 9, seed: "x", sales: 1, served: 1, clean: 1, queueSize: 5 }));
  assert.equal(loadBlitzBest(store), null);
  store.setItem(BLITZ_BEST_KEY, "not-json");
  assert.equal(loadBlitzBest(store), null);
});

test("牌堆里抽不到的牌不会留在手里：mulligan 烧一回合也烧 8 秒", () => {
  const run = begin();
  const swap = blitzMulligan(run);
  assert.ok(swap);
  assert.equal(swap.blitz.secondsLeft, BLITZ_SECONDS - BLITZ_ACTION_SECONDS);
  assert.equal(swap.blitz.duel!.round, 1);
  assert.equal(swap.blitz.duel!.mulliganUsed, true);
  assert.equal(blitzMulligan(swap), null, "每位顾客只有一次换话题");
});

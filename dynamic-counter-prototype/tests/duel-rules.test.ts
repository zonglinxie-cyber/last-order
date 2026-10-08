import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUSTOMERS, fitOf, INITIAL, openFloorState, patienceLeft, QUESTIONS, startNextDay,
  type Campaign, type CustomerId, type ProductId,
} from "../src/campaign.ts";
import {
  DUEL_ASK_BAD, DUEL_ASK_GOOD, DUEL_CATCH_BONUS,
  DUEL_LOOK_BONUS, DUEL_MULLIGAN_COST, DUEL_OVERPROMISE_BONUS, DUEL_OVERPROMISE_COMPLIANCE,
  DUEL_PITCH_DELTA, DUEL_RIVAL_DELTA, DUEL_RIVAL_HIT, DUEL_SAMPLE_BONUS, DUEL_START_INTEREST,
  DUEL_TRIAL_DELTA, duelClose, duelDeck, duelLook, duelMulligan, duelPlay, duelSendAway,
  duelTrial, duelUnlockedBundles, startDuel, type DuelCard, type DuelState,
} from "../src/duel.ts";

const floor = (): Campaign => openFloorState(INITIAL);

function begin(id: CustomerId, at: Campaign = floor()): { campaign: Campaign; duel: DuelState } {
  const started = startDuel(at, id);
  assert.ok(started, `${id} 应该能开局`);
  return started;
}
const floorAt = (day: number): Campaign => {
  let s = floor();
  for (let d = 1; d < day; d++) s = openFloorState(startNextDay(s));
  return s;
};

// 造一张手牌直接测某类牌的效果：规则只要求牌在手里，不验出处。
const withHand = (duel: DuelState, hand: DuelCard[]): DuelState => ({ ...duel, hand });
const askCard = (index: number): DuelCard => ({ id: `ask:${index}`, kind: "ask", title: "", question: index });
const positiveProduct = (id: CustomerId): ProductId =>
  (Object.keys({ soft: 1, glow: 1, repair: 1 }) as ProductId[]).find(p => fitOf(CUSTOMERS[id], p).tier === "positive")!;
const negativeProduct = (id: CustomerId): ProductId =>
  (Object.keys({ soft: 1, glow: 1, repair: 1 }) as ProductId[]).find(p => fitOf(CUSTOMERS[id], p).tier === "negative")!;

test("牌堆按「天数:顾客」洗牌，同一种子同一副牌", () => {
  const a = duelDeck(1, "shen"), b = duelDeck(1, "shen");
  assert.deepEqual(a.map(c => c.id), b.map(c => c.id));
  // 沈薇 5 条问题 + 接住/小样/夸下海口 3 张固定牌。
  assert.equal(a.length, QUESTIONS.shen.length + 3);
  assert.equal(a.filter(c => c.kind === "ask").length, QUESTIONS.shen.length);
  for (const kind of ["catch", "sample", "overpromise"]) assert.equal(a.filter(c => c.kind === kind).length, 1);
  assert.notDeepEqual(duelDeck(1, "shen").map(c => c.id), duelDeck(2, "shen").map(c => c.id));
});

test("看脸第一次给 +4，再看不给；一回合只能免费看一处新点", () => {
  const { campaign, duel } = begin("mei");
  const seen = duelLook(campaign, duel, "eyes");
  assert.ok(seen);
  assert.equal(seen.duel.interest, DUEL_START_INTEREST + DUEL_LOOK_BONUS);
  assert.equal(seen.duel.lookedThisRound, true);
  assert.ok(seen.campaign.activeSession!.discovered.includes("eyes"));
  assert.ok(seen.campaign.activeSession!.revealed.includes("soothe"));
  // 同一处再看：不扣不加，只把 finding 再念一遍。
  const again = duelLook(seen.campaign, seen.duel, "eyes");
  assert.ok(again);
  assert.equal(again.duel.interest, seen.duel.interest);
  // 同一回合看第二处新点：不行。
  assert.equal(duelLook(seen.campaign, seen.duel, "nose"), null);
});

test("有用的问牌 +12 并揭示诉求，白问 −8；askedQuestion 只认第一条有用的", () => {
  const { campaign, duel } = begin("mei");
  const badIndex = QUESTIONS.mei.findIndex(q => !q.useful);
  const goodIndex = QUESTIONS.mei.findIndex(q => q.useful);
  const bad = duelPlay(campaign, withHand(duel, [askCard(badIndex)]), `ask:${badIndex}`);
  assert.ok(bad);
  assert.equal(bad.duel.interest, DUEL_START_INTEREST + DUEL_ASK_BAD);
  assert.equal(bad.campaign.activeSession!.askedQuestion, badIndex);
  const good = duelPlay(bad.campaign, withHand(bad.duel, [askCard(goodIndex)]), `ask:${goodIndex}`);
  assert.ok(good);
  assert.equal(good.duel.interest, DUEL_START_INTEREST + DUEL_ASK_BAD + DUEL_ASK_GOOD);
  assert.equal(good.campaign.activeSession!.askedQuestion, goodIndex);
  // 再问一条没用的：有用的那条索引不动。
  const bad2 = duelPlay(good.campaign, withHand(good.duel, [askCard(badIndex)]), `ask:${badIndex}`);
  assert.ok(bad2);
  assert.equal(bad2.campaign.activeSession!.askedQuestion, goodIndex);
  assert.equal(bad2.duel.usefulAsked, goodIndex);
  assert.equal(bad2.duel.lastAsked, badIndex);
});

test("接住 +8、留小样 +10 且真留一支、夸下海口 +25 且台账 −8 挂旗", () => {
  const { campaign, duel } = begin("mei");
  const base = campaign.compliance;
  const catched = duelPlay(campaign, withHand(duel, [{ id: "catch", kind: "catch", title: "" }]), "catch");
  assert.ok(catched);
  assert.equal(catched.duel.interest, DUEL_START_INTEREST + DUEL_CATCH_BONUS);

  const sampled = duelPlay(catched.campaign, withHand(catched.duel, [{ id: "sample", kind: "sample", title: "" }]), "sample");
  assert.ok(sampled);
  assert.equal(sampled.duel.interest, DUEL_START_INTEREST + DUEL_CATCH_BONUS + DUEL_SAMPLE_BONUS);
  assert.equal(sampled.campaign.samples, campaign.samples - 1);
  assert.ok(sampled.campaign.flags.includes("sample:mei"));
  // 小样只有一支：第二张牌打不出去。
  assert.equal(duelPlay(sampled.campaign, withHand(sampled.duel, [{ id: "sample", kind: "sample", title: "" }]), "sample"), null);

  const promised = duelPlay(sampled.campaign, withHand(sampled.duel, [{ id: "overpromise", kind: "overpromise", title: "" }]), "overpromise");
  assert.ok(promised);
  assert.equal(promised.duel.interest, DUEL_START_INTEREST + DUEL_CATCH_BONUS + DUEL_SAMPLE_BONUS + DUEL_OVERPROMISE_BONUS);
  assert.equal(promised.campaign.compliance, base + DUEL_OVERPROMISE_COMPLIANCE);
  assert.ok(promised.campaign.flags.includes("duel-overpromise:mei"));
  assert.ok(promised.campaign.history.some(h => h.text === "你对梅女士把效果说满了"));
});

test("试用按适配加减，第一支进手「讲透这一支」，讲透按档位再给一次", () => {
  const { campaign, duel } = begin("mei");
  const best = positiveProduct("mei");
  const tried = duelTrial(campaign, duel, best, "left");
  assert.ok(tried);
  assert.equal(tried.duel.interest, DUEL_START_INTEREST + DUEL_TRIAL_DELTA.positive);
  assert.equal(tried.campaign.activeSession!.tested, true);
  assert.equal(tried.campaign.activeSession!.selectedProduct, best);
  assert.equal(tried.campaign.activeSession!.reaction, "positive");
  assert.ok(tried.duel.hand.some(c => c.kind === "pitch"));
  const pitched = duelPlay(tried.campaign, tried.duel, "pitch");
  assert.ok(pitched);
  assert.equal(pitched.duel.interest, DUEL_START_INTEREST + DUEL_TRIAL_DELTA.positive + DUEL_PITCH_DELTA.positive);
  assert.equal(pitched.duel.pitchUsed, true);
  // 讲透每位顾客一次。
  assert.equal(duelPlay(pitched.campaign, pitched.duel, "pitch"), null);
});

test("同一半不能放两支，同一支不能上两边；两半都试过才 faceTrialled 并揭示", () => {
  const { campaign, duel } = begin("mei");
  const best = positiveProduct("mei");
  const first = duelTrial(campaign, duel, best, "left");
  assert.ok(first);
  assert.equal(first.campaign.activeSession!.faceTrialled, false);
  // 同半再来一支：不行。同一支去右半：也不行。
  assert.equal(duelTrial(first.campaign, first.duel, "soft", "left"), null);
  assert.equal(duelTrial(first.campaign, first.duel, best, "right"), null);
  const other = (["soft", "glow", "repair"] as ProductId[]).find(p => p !== best)!;
  const second = duelTrial(first.campaign, first.duel, other, "right");
  assert.ok(second);
  assert.equal(second.campaign.activeSession!.faceTrialled, true);
  assert.equal(second.campaign.activeSession!.faceTrialRevealed !== undefined, true);
  // 第三位还想上脸：两张半脸都占了。
  const third = (["soft", "glow", "repair"] as ProductId[]).find(p => p !== best && p !== other)!;
  assert.equal(duelTrial(second.campaign, second.duel, third, "left"), null);
});

test("换话题 −3，手牌回牌堆底重抽，每位顾客一次", () => {
  const { campaign, duel } = begin("mei");
  const oldHand = duel.hand.map(c => c.id);
  const swapped = duelMulligan(campaign, duel);
  assert.ok(swapped);
  assert.equal(swapped.duel.interest, DUEL_START_INTEREST + DUEL_MULLIGAN_COST);
  assert.equal(swapped.duel.round, 1);
  assert.equal(swapped.duel.mulliganUsed, true);
  // 手牌回堆底、从顶重抽 4 张：新手牌 = 原牌堆 + 原手牌第一张，剩下的原手牌躺在堆底。
  assert.deepEqual(swapped.duel.hand.map(c => c.id), [...duel.deck, duel.hand[0]].map(c => c.id));
  assert.deepEqual(swapped.duel.deck.map(c => c.id), duel.hand.slice(1).map(c => c.id));
  assert.equal(duelMulligan(swapped.campaign, swapped.duel), null);
});

test("每个主动作只扣柜台另一边 1 分钟耐心", () => {
  const { campaign, duel } = begin("shen"); // mei 在等，8 分钟
  const before = patienceLeft(campaign, "mei");
  const played = duelPlay(campaign, duel, duel.hand[0].id);
  assert.ok(played);
  assert.equal(patienceLeft(played.campaign, "mei"), before - 1);
  const tried = duelTrial(played.campaign, played.duel, positiveProduct("shen"), "left");
  assert.ok(tried);
  assert.equal(patienceLeft(tried.campaign, "mei"), before - 2);
});

test("竞品第 3 回合插话：interest −12，手牌换成三张应对牌，其它主动作锁住", () => {
  const { campaign, duel } = begin("shen");
  const r1 = duelPlay(campaign, duel, duel.hand[0].id)!;
  const r2 = duelPlay(r1.campaign, r1.duel, r1.duel.hand[0].id)!;
  assert.equal(r2.duel.round, 2);
  assert.equal(r2.duel.rivalPending, true);
  assert.ok(r2.duel.log.some(entry => entry.delta === DUEL_RIVAL_HIT));
  assert.equal(r2.duel.hand.length, 3);
  assert.ok(r2.duel.hand.every(c => c.kind === "rival"));
  // 插话没解决之前：试用、成交都不给。
  assert.equal(duelTrial(r2.campaign, r2.duel, "soft", "left"), null);
  assert.equal(duelClose(r2.campaign, r2.duel, "single"), null);
  // 当面讲清 +6，写进 session，手牌奉还，照样消耗这一回合。
  const pending = r2.duel.interest;
  const resolved = duelPlay(r2.campaign, r2.duel, "rival:clarify");
  assert.ok(resolved);
  assert.equal(resolved.duel.interest, pending + DUEL_RIVAL_DELTA.clarify);
  assert.equal(resolved.duel.rivalDone, true);
  assert.equal(resolved.duel.rivalPending, false);
  assert.equal(resolved.duel.round, 3);
  assert.equal(resolved.campaign.activeSession!.rivalChoice, "clarify");
  assert.deepEqual(resolved.duel.hand, r2.duel.stashedHand);
  // 记录在案不加减、让她拼单 +10：另开一局核对数值（周姐第 2 天才在楼层）。
  const { campaign: c2, duel: d2 } = begin("zhou", floorAt(2));
  const z1 = duelPlay(c2, d2, d2.hand[0].id)!;
  const z2 = duelPlay(z1.campaign, z1.duel, z1.duel.hand[0].id)!;
  assert.equal(z2.duel.rivalPending, true);
  const yielded = duelPlay(z2.campaign, z2.duel, "rival:yield")!;
  assert.equal(yielded.duel.interest, z2.duel.interest + DUEL_RIVAL_DELTA.yield);
  assert.equal(yielded.campaign.activeSession!.rivalChoice, "yield");
});

test("回合耗尽进「最后一句」：只剩成交/硬推/送她走，送她走才进 lost", () => {
  const { campaign, duel } = begin("mei"); // 耐心 8 → 5 回合
  let state = { campaign, duel };
  for (let i = 0; i < 5; i++) {
    const card = state.duel.hand.find(c => c.kind !== "rival")!;
    const next = duelPlay(state.campaign, state.duel, card.id);
    assert.ok(next);
    state = next;
  }
  // 第 5 个动作结束后她不立刻走：进入 lastCall，session 还开着。
  assert.equal(state.duel.walked, false);
  assert.equal(state.duel.lastCall, true);
  assert.ok(state.campaign.activeSession);
  assert.ok(state.duel.log.some(entry => entry.text.includes("你说个数")));
  // lastCall 下：看脸、出牌、换话题、试用全部锁死。
  assert.equal(duelLook(state.campaign, state.duel, "eyes"), null);
  assert.equal(duelPlay(state.campaign, state.duel, state.duel.hand[0].id), null);
  assert.equal(duelMulligan(state.campaign, state.duel), null);
  assert.equal(duelTrial(state.campaign, state.duel, "soft", "left"), null);
  // 送她走 → releaseService，进 lost。
  const away = duelSendAway(state.campaign, state.duel);
  assert.ok(away);
  assert.equal(away.duel.walked, true);
  assert.equal(away.campaign.activeSession, null);
  assert.ok(away.campaign.lost.includes("mei"));
  assert.ok(away.campaign.flags.includes("lost:mei"));
});

test("「最后一句」里兴趣够 60 仍然能成交", () => {
  const { campaign, duel } = begin("mei");
  let state = { campaign, duel };
  for (let i = 0; i < 5; i++) {
    // 前 4 个回合正常打；最后一下用试用把回合烧满。
    if (i === 4) {
      const tried = duelTrial(state.campaign, state.duel, positiveProduct("mei"), "left");
      assert.ok(tried);
      state = { campaign: tried.campaign, duel: tried.duel };
    } else {
      const card = state.duel.hand.find(c => c.kind !== "rival")!;
      state = duelPlay(state.campaign, state.duel, card.id)!;
    }
  }
  assert.equal(state.duel.lastCall, true);
  const ready: DuelState = { ...state.duel, interest: 80 };
  const closed = duelClose(state.campaign, ready, "pair");
  assert.ok(closed);
  assert.equal(closed.outcome.units, 1);
  assert.ok(closed.campaign.sales > 0);
});

test("成交门槛与档位解锁：60 单件、75 两件、90 整套与批量", () => {
  const { campaign, duel } = begin("mei");
  const at60: DuelState = { ...duel, interest: 60 };
  assert.deepEqual(duelUnlockedBundles(at60), ["single"]);
  assert.deepEqual(duelUnlockedBundles({ ...duel, interest: 75 }), ["single", "pair"]);
  assert.deepEqual(duelUnlockedBundles({ ...duel, interest: 90 }), ["single", "pair", "set", "bulk"]);
  // 兴趣没到 60：成交键不亮。
  assert.equal(duelClose(campaign, duel, "single"), null);
  // 够了但没试用：也不亮。
  const untested: DuelState = { ...duel, interest: 90 };
  assert.equal(duelClose(campaign, untested, "single"), null);
  // 试过、兴趣 80：pair 开得成，set 开不成。
  const tried = duelTrial(campaign, duel, positiveProduct("mei"), "left")!;
  const ready: DuelState = { ...tried.duel, interest: 80 };
  assert.equal(duelClose(tried.campaign, ready, "set"), null);
  const closed = duelClose(tried.campaign, ready, "pair");
  assert.ok(closed);
  assert.equal(closed.outcome.units, 1); // 梅女士上限 1 件
  assert.equal(closed.outcome.good, true);
  assert.equal(closed.campaign.activeSession, null);
  assert.ok(closed.campaign.dayServed.includes("mei"));
  assert.ok(closed.campaign.sales > 0);
});

test("适配是 negative 时，兴趣堆到 90 她也不买单", () => {
  const { campaign, duel } = begin("mei");
  const worst = negativeProduct("mei");
  const tried = duelTrial(campaign, duel, worst, "left")!;
  const ready: DuelState = { ...tried.duel, interest: 90 };
  const closed = duelClose(tried.campaign, ready, "single");
  assert.ok(closed);
  assert.equal(closed.outcome.units, 0);
  assert.equal(closed.outcome.good, false);
  assert.equal(closed.campaign.sales, 0);
  assert.ok(closed.campaign.flags.includes("served:mei:refused"));
});

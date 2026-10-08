import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUSTOMERS, fitOf, hasFlag, patienceLeft, resolveRivalSale, type CustomerId, type ProductId,
} from "../src/campaign.ts";
import {
  DUEL_CLOSE_MIN, duelClose, duelForce, duelLook, duelPlay, duelSendAway,
  duelTrial, type DuelState,
} from "../src/duel.ts";
import {
  advanceMatchTick, MATCH_TICKS, matchBeginConsult, matchCustomerState, matchResolveConsult,
  matchSummary, rivalPolicy, RIVAL_FLAG, startMatch, type MatchState,
} from "../src/match.ts";

const SEED = "rules-test";
const stateless = (m: MatchState) => JSON.stringify({
  campaign: m.campaign, rival: m.rival, queueOrder: m.queueOrder, tick: m.tick, finished: m.finished,
});

// 队列里挑一位没竞品插话线的顾客（沈薇/周姐/沈薇回访都带 rival 插话，打法更绕）。
const quietOf = (m: MatchState): CustomerId =>
  m.queueOrder.find(id => !["shen", "zhou", "returning"].includes(id)) ?? m.queueOrder[0];
const positiveProduct = (id: CustomerId): ProductId =>
  (["soft", "glow", "repair"] as ProductId[]).find(p => fitOf(CUSTOMERS[id], p).tier === "positive")!;

// 玩家牌局的确定性打法：看脸 → 拖产品 → 手里能打的好牌都打出去 → 成交；兴趣不够就硬推。
// 不挑牌序——牌序是种子洗出来的，测试只保证"按规则打得到结局"。
function playDuelOut(m: MatchState, id: CustomerId): MatchState {
  const looked = duelLook(m.campaign, m.duel!, "eyes");
  assert.ok(looked);
  m = matchResolveConsult(m, looked.campaign, looked.duel);
  const trial = duelTrial(m.campaign, m.duel!, positiveProduct(id), "left");
  assert.ok(trial);
  m = matchResolveConsult(m, trial.campaign, trial.duel);
  let guard = 24;
  while (m.duel && !m.duel.walked && guard-- > 0) {
    const d = m.duel;
    if (d.rivalPending) {
      const card = d.hand.find(c => c.kind === "rival")!;
      const r = duelPlay(m.campaign, d, card.id);
      assert.ok(r);
      m = matchResolveConsult(m, r.campaign, r.duel);
      continue;
    }
    if (d.interest >= DUEL_CLOSE_MIN && m.campaign.activeSession?.tested) {
      const r = duelClose(m.campaign, d, "single");
      if (r) return matchResolveConsult(m, r.campaign, null);
    }
    const playable = d.hand.find(c => c.kind === "catch" || c.kind === "pitch")
      ?? d.hand.find(c => c.kind === "ask")
      ?? d.hand.find(c => c.kind === "sample")
      ?? d.hand.find(c => c.kind !== "rival");
    if (playable && !d.lastCall) {
      const r = duelPlay(m.campaign, d, playable.id);
      if (r) { m = matchResolveConsult(m, r.campaign, r.duel); continue; }
    }
    if (d.lastCall) {
      const r = duelSendAway(m.campaign, d);
      assert.ok(r);
      m = matchResolveConsult(m, r.campaign, r.duel);
      continue;
    }
    const forced = duelForce(m.campaign, d);
    if (forced) return matchResolveConsult(m, forced.campaign, null);
    break;
  }
  return m;
}

test("同一种子同一局：队列、陆遥动线、结局完全一致", () => {
  const run = (seed: string) => {
    let m = startMatch(seed);
    for (let i = 0; i < 90 && !m.finished; i++) m = advanceMatchTick(m);
    return stateless(m);
  };
  assert.equal(run(SEED), run(SEED));
  assert.notEqual(run(SEED), run("another-seed"));
  const m = startMatch(SEED);
  assert.ok(m.queueOrder.length >= 6 && m.queueOrder.length <= 8);
  assert.equal(new Set(m.queueOrder).size, m.queueOrder.length);
  for (const id of m.queueOrder) assert.ok(CUSTOMERS[id], `${id} 在顾客池里`);
});

test("玩家接待期间陆遥锁定别人，绝不碰 activeSession 那一位", () => {
  let m = startMatch(SEED);
  const id = quietOf(m);
  m = matchBeginConsult(m, id)!;
  assert.ok(m.campaign.activeSession, "接待开起来了");
  assert.equal(m.campaign.activeSession!.customerId, id);
  // 陆遥不能再点玩家手里这位，也不能再点已经锁定的。
  assert.equal(matchBeginConsult(m, m.queueOrder[0]), null);
  for (let i = 0; i < 30; i++) {
    m = advanceMatchTick(m);
    assert.notEqual(m.rival.serving, id, "陆遥不该接待玩家正在接待的顾客");
    assert.equal(m.campaign.activeSession?.customerId, id, "玩家的 session 不能被她的动线拆掉");
  }
});

test("陆遥的成交走 resolveRivalSale：同路径入账，但只动钱货订单，不动玩家状态", () => {
  let m = startMatch(SEED);
  const before = m.campaign;
  // 锁定前先问她要谁：锁定后再问她就该去拿下一位了。
  const pick = rivalPolicy(m)!;
  assert.ok(pick, "队列没满员时她总能挑出下一位");
  m = advanceMatchTick(m);
  assert.equal(m.rival.serving, pick.id, "锁定的人就是策略选出的人");
  const served = pick.id;
  for (let i = 0; i < 3; i++) m = advanceMatchTick(m);
  assert.equal(m.rival.serving, null);
  assert.ok(m.rival.served.includes(served));
  assert.ok(hasFlag(m.campaign, `${RIVAL_FLAG}${served}`), "她的单在 flags 里署名");
  if (m.campaign.orders.some(o => o.customerId === served)) {
    assert.ok(m.rival.sales > 0);
    assert.ok(m.campaign.sales >= m.rival.sales, "她的业绩进同一本账 sales");
    assert.ok(m.campaign.dayServed.includes(served));
  }
  // 玩家侧的账一分不动。
  assert.equal(m.campaign.energy, before.energy);
  assert.equal(m.campaign.trust, before.trust);
  assert.equal(m.campaign.compliance, before.compliance);
  assert.equal(m.campaign.evidence, before.evidence);
});

test("resolveRivalSale 直接调用：已收编的返回 null，断货时按 blocked 入账（0 件不动钱）", () => {
  const m = startMatch(SEED);
  const broke = { ...m.campaign, stock: { soft: 0, glow: 0, repair: 0 } };
  for (const id of m.queueOrder) {
    const res = resolveRivalSale(broke, id);
    assert.ok(res, `${id} 断货也走得完服务循环`);
    assert.equal(res!.outcome.units, 0, `${id} 断货时开不出件数`);
    assert.equal(res!.outcome.amount, 0);
    assert.equal(res!.campaign.sales, broke.sales, "断货的单不动销售额");
    assert.equal(res!.campaign.stock.soft, 0);
  }
  // 已经在 dayServed / lost 里的她不再谈。
  const spent = { ...m.campaign, dayServed: [m.queueOrder[0]] };
  assert.equal(resolveRivalSale(spent, m.queueOrder[0]), null);
});

test("玩家打完一单：成交入账、记号归玩家、回到队列后其余人不归零", () => {
  let m = startMatch(SEED);
  const id = quietOf(m);
  m = matchBeginConsult(m, id)!;
  const patienceBefore = Object.fromEntries(
    m.queueOrder.filter(x => x !== id).map(x => [x, patienceLeft(m.campaign, x)]));
  m = playDuelOut(m, id);
  assert.equal(m.duel, null);
  const resolved = m.campaign.dayServed.includes(id) || m.campaign.lost.includes(id);
  assert.ok(resolved, "打完一单这位顾客要有结局");
  if (m.campaign.orders.some(o => o.customerId === id)) {
    assert.ok(!hasFlag(m.campaign, `${RIVAL_FLAG}${id}`), "玩家的单不该署陆遥的名");
    assert.ok(m.campaign.sales > 0);
    assert.equal(m.rival.sales, 0);
  }
  // 柜台另一边还在等：玩家每打一手（≈1 分钟）排队的人都少一格，和 canonical 同一本账。
  for (const [x, left] of Object.entries(patienceBefore)) {
    if (m.campaign.lost.includes(x as CustomerId)) continue;
    assert.ok(patienceLeft(m.campaign, x as CustomerId) < left, `${x} 等你的这单要付出代价`);
  }
});

test("队列清空自动收工；tick 打满兜底收工；结算两边账对得上 orders/history", () => {
  let m = startMatch(SEED);
  for (let i = 0; i < MATCH_TICKS + 10 && !m.finished; i++) m = advanceMatchTick(m);
  assert.ok(m.finished, "tick 用尽或队列清空，这局必须收");
  assert.ok(m.queueOrder.every(id => m.campaign.dayServed.includes(id) || m.campaign.lost.includes(id)),
    "收工时每位顾客都有结局");
  const sum = matchSummary(m);
  assert.equal(sum.playerSales + sum.rivalSales, m.campaign.sales);
  assert.equal(sum.rivalSales, m.rival.sales);
  // orders 里署名 rival: 的那几笔就是她名下的全部。
  const rivalOrders = m.campaign.orders.filter(o => hasFlag(m.campaign, `${RIVAL_FLAG}${o.customerId}`));
  assert.equal(sum.rivalUnits, rivalOrders.reduce((s, o) => s + o.units, 0));
  assert.equal(rivalOrders.reduce((s, o) => s + o.amount, 0), m.rival.sales);
  const playerOrders = m.campaign.orders.filter(o => !hasFlag(m.campaign, `${RIVAL_FLAG}${o.customerId}`));
  assert.equal(sum.playerUnits, playerOrders.reduce((s, o) => s + o.units, 0));
  // 陆遥谈过的每一位都要么在她名下（orders 署名）、要么还记在她 served 的消耗里。
  for (const id of m.rival.served) {
    assert.ok(hasFlag(m.campaign, `${RIVAL_FLAG}${id}`) || !m.campaign.dayServed.includes(id),
      `${id} 她谈过，要么入账署名、要么没谈成`);
  }
});

test("玩家手里的牌局能被 matchResolveConsult 正常回写，并且不丢陆遥锁人", () => {
  let m = startMatch(SEED);
  // 先让陆遥锁一位，再让玩家开一局——两边的 busy 要各管各的。
  m = advanceMatchTick(m);
  const hers = m.rival.serving!;
  const mine = m.queueOrder.find(id => id !== hers && matchCustomerState(m, id) === "waiting")!;
  const heldMeter = m.campaign.waitMeters[hers];
  m = matchBeginConsult(m, mine)!;
  const trial = duelTrial(m.campaign, m.duel!, positiveProduct(mine), "left");
  assert.ok(trial);
  m = matchResolveConsult(m, trial.campaign, trial.duel);
  // duel 内部那一分钟不该把陆遥接待中的耐心表扣掉（她的时长是固定 tick）。
  assert.equal(m.campaign.waitMeters[hers], heldMeter);
  assert.equal(matchCustomerState(m, hers), "rival");
  assert.equal(matchCustomerState(m, mine), "you");
});

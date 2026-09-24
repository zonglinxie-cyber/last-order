// Shared five-day simulator for the rule tests: it plays the game through the public
// rule functions only, so the balance numbers are measured instead of hand-written.
import assert from "node:assert/strict";
import {
  addMember, applyTouch, askService, availableCustomers, canAddMember, canPullOver, chooseBundle, closeService, CUSTOMERS, INITIAL, dayEvent, orderQuote,
  leaveSample, observeService, openFloorState, parseCampaign, PRODUCTS, QUESTIONS, respondToRival, RIVAL_IDS, pullOver,
  selectServiceProduct, settleDayEvent, startNextDay, startService, trialService, faceTrialService, touchThreads, TOUCHES_PER_EVENING,
  fitOf, type BundleId, type Campaign, type CueId, type CustomerId, type ProductId, type SaleOutcome,
} from "../src/campaign.ts";

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];
export const CLEAN_EVENTS = ["refuse-suman", "split-tang", "protect-zhao", "refuse-gifts", "credit-team"];
const BUNDLE_UNITS: Record<BundleId, number> = { single: 1, pair: 2, set: 3, bulk: 4 };

// The product that actually fits her face and her stated needs.
export function bestFit(id: CustomerId): ProductId {
  const ranked = PRODUCT_IDS
    .map(product => ({ product, ...fitOf(CUSTOMERS[id], product) }))
    .filter(candidate => candidate.tier === "positive")
    .sort((a, b) => b.score - a.score);
  assert.ok(ranked.length, `${id} 必须存在一款真正合适的产品`);
  return ranked[0].product;
}

// 她自己说过的上限：预算和用量能吞下几件。
export function herCap(id: CustomerId, product: ProductId) {
  return Math.max(1, orderQuote(id, product, "bulk", false).units);
}

// 只开到她给过的上限，不多占一分钟。
export function matchedBundle(id: CustomerId, product: ProductId): BundleId {
  const cap = herCap(id, product);
  return (Object.keys(BUNDLE_UNITS) as BundleId[]).reduce(
    (best, key) => Math.abs(BUNDLE_UNITS[key] - cap) < Math.abs(BUNDLE_UNITS[best] - cap) ? key : best, "single");
}

export function playCustomer(
  state: Campaign,
  id: CustomerId,
  options: { bundle?: BundleId; product?: ProductId; askIndex?: number; faceTrial?: boolean } = {},
): { campaign: Campaign; outcome: SaleOutcome } {
  const customer = CUSTOMERS[id];
  const product = options.product ?? bestFit(id);
  const bundle = options.bundle ?? matchedBundle(id, product);
  let s = startService(state, id);
  assert.equal(s.activeSession?.customerId, id, `${id} 应该还能被接待（体力或耐心已耗尽？）`);
  const cues = Object.keys(customer.cues) as CueId[];
  s = observeService(observeService(s, cues[0]), cues[1]);
  const asked = options.askIndex ?? QUESTIONS[id].findIndex(question => question.useful);
  assert.ok(asked >= 0, `${id} 需要一个有用的问题`);
  s = askService(s, QUESTIONS[id][asked].label, asked);
  s = trialService(selectServiceProduct(s, product));
  if (options.faceTrial) {
    s = faceTrialService(s);
    assert.equal(s.activeSession?.faceTrialled, true, `${id} 的半脸上妆应该真的发生`);
  }
  s = chooseBundle(s, bundle);
  if (RIVAL_IDS.includes(id)) s = respondToRival(s, "clarify");
  // 「登记我的接待」是两个 UI 都有的那一步，e2e 每次都按；模拟器不按就等于少测一步，
  // 留痕数会比真实玩出来的低。这里按下去，是为了量到玩家真的会拿到的证据。
  s = { ...s, activeSession: { ...s.activeSession!, claimed: true } };
  const quote = orderQuote(id, product, bundle, false);
  const closed = closeService(s);
  assert.ok(closed, `${id} 的关单不应该失败`);
  // 报价单必须和真实入账一致，否则 UI 在骗玩家。
  assert.equal(closed.outcome.units, quote.units, `${id} 的成交件数和报价不符`);
  assert.equal(closed.outcome.total, quote.total, `${id} 的成交金额和报价不符`);
  assert.equal(closed.outcome.minutes, quote.minutes, `${id} 占用的时间和报价不符`);
  assert.equal(closed.campaign.activeSession, null);
  return { campaign: parseCampaign(JSON.stringify(closed.campaign))!, outcome: closed.outcome };
}

export type RouteResult = { final: Campaign; dayTotals: number[]; served: number; lost: CustomerId[]; pulled: number };

// 每天按现场顺序接完所有还能接的顾客，然后处理闭店事件。
// roster=true 走的是"把私域也做掉"的那条线：现场先留小样、再要微信（各占一分钟），
// 闭店事件之后按当晚顺序跟两句。加粉烧掉的是别人的耐心，所以这条线要拿柜台上的人换。
// pull=true 是"只要有人开始看表就迎上去"：一支小样加离柜两分钟，救回一个的同时把另一个推向门口。
export function runRoute(bundle: BundleId | "matched" = "matched", faceTrial = false, roster = false, pull = false): RouteResult {
  let s = openFloorState(INITIAL);
  const dayTotals: number[] = [];
  const lost: CustomerId[] = [];
  let served = 0;
  let pulled = 0;
  for (let day = 1; day <= 5; day += 1) {
    assert.equal(s.day, day);
    for (const id of [...availableCustomers(s)]) {
      // 接待别人期间她可能已经走了； greedy 路线就是在赌这个。
      if (!availableCustomers(s).includes(id)) continue;
      if (pull) for (const waiting of [...availableCustomers(s)]) {
        if (!canPullOver(s, waiting)) continue;
        s = pullOver(s, waiting);
        pulled += 1;
      }
      if (!availableCustomers(s).includes(id)) continue;
      if (roster && s.samples > 0 && !s.members.includes(id)) {
        s = leaveSample(s, id);
        if (canAddMember(s, id)) s = addMember(s, id);
      }
      const played = playCustomer(s, id, { ...(bundle === "matched" ? {} : { bundle }), faceTrial });
      s = played.campaign;
      served += played.outcome.units > 0 ? 1 : 0;
    }
    const event = dayEvent(s);
    const choice = event.choices.find(option => option.id === CLEAN_EVENTS[day - 1]) ?? event.choices[0];
    s = settleDayEvent(s, choice.id);
    if (roster) for (const thread of touchThreads(s).slice(0, TOUCHES_PER_EVENING)) s = applyTouch(s, thread.id);
    dayTotals.push(s.sales);
    lost.push(...s.lost);
    s = startNextDay(s);
  }
  assert.equal(s.finished, true);
  return { final: s, dayTotals, served, lost, pulled };
}

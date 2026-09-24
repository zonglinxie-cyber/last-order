// Shared five-day simulator for the rule tests: it plays the game through the public
// rule functions only, so the balance numbers are measured instead of hand-written.
import assert from "node:assert/strict";
import {
  askService, availableCustomers, chooseBundle, closeService, CUSTOMERS, INITIAL, dayEvent, orderQuote,
  observeService, openFloorState, parseCampaign, PRODUCTS, QUESTIONS, respondToRival, RIVAL_IDS,
  selectServiceProduct, settleDayEvent, startNextDay, startService, trialService,
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
  options: { bundle?: BundleId; product?: ProductId; askIndex?: number } = {},
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
  s = chooseBundle(s, bundle);
  if (RIVAL_IDS.includes(id)) s = respondToRival(s, "clarify");
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

export type RouteResult = { final: Campaign; dayTotals: number[]; served: number; lost: CustomerId[] };

// 每天按现场顺序接完所有还能接的顾客，然后处理闭店事件。
export function runRoute(bundle: BundleId | "matched" = "matched"): RouteResult {
  let s = openFloorState(INITIAL);
  const dayTotals: number[] = [];
  const lost: CustomerId[] = [];
  let served = 0;
  for (let day = 1; day <= 5; day += 1) {
    assert.equal(s.day, day);
    for (const id of [...availableCustomers(s)]) {
      // 接待别人期间她可能已经走了； greedy 路线就是在赌这个。
      if (!availableCustomers(s).includes(id)) continue;
      const played = playCustomer(s, id, bundle === "matched" ? {} : { bundle });
      s = played.campaign;
      served += played.outcome.units > 0 ? 1 : 0;
    }
    const event = dayEvent(s);
    const choice = event.choices.find(option => option.id === CLEAN_EVENTS[day - 1]) ?? event.choices[0];
    s = settleDayEvent(s, choice.id);
    dayTotals.push(s.sales);
    lost.push(...s.lost);
    s = startNextDay(s);
  }
  assert.equal(s.finished, true);
  return { final: s, dayTotals, served, lost };
}

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceFloorTime, applyDawn, askService, availableCustomers, BUNDLES, chooseBundle, closeService, CUSTOMERS, dayEvent, endingTitle,
  INITIAL, leaveSample, observeService, openFloorState, orderQuote, parseCampaign, PRODUCTS, QUESTIONS,
  releaseService, requestStaffHelp, respondToRival, RIVAL_IDS, selectServiceProduct, settleDayEvent,
  startNextDay, startService, TARGET, trialService, type BundleId, type Campaign, type CustomerId, type ProductId,
} from "../src/campaign.ts";
import { bestFit, herCap, playCustomer, runRoute } from "./clean-route.ts";

// Stop right after the trial so a test can drive the closing itself.
function consult(state: Campaign, id: CustomerId = "shen", product: ProductId = bestFit(id), bundle: BundleId = "single"): Campaign {
  let s = startService(state, id);
  assert.equal(s.activeSession?.customerId, id);
  s = observeService(observeService(s, "eyes"), "cheek");
  s = askService(s, QUESTIONS[id][0].label, 0);
  s = trialService(selectServiceProduct(s, product));
  return bundle === "single" ? s : chooseBundle(s, bundle);
}

test("clock, patience and fractional time survive a saved floor", () => {
  const nineteen = advanceFloorTime(INITIAL, 19);
  assert.equal(nineteen.shiftMinutes, 0);
  const restored = parseCampaign(JSON.stringify(nineteen))!;
  const minute = advanceFloorTime(restored, 1);
  assert.equal(minute.shiftMinutes, 1);
  assert.equal(minute.waitMeters.shen, CUSTOMERS.shen.patience - 1);
  assert.equal(minute.floorSeconds, 0);
  const left = advanceFloorTime(minute, CUSTOMERS.shen.patience * 20);
  assert.ok(left.lost.includes("shen"));
  assert.ok(left.history.some(row => row.text.includes("陆遥带沈薇")));
  assert.equal(advanceFloorTime(left, 0), left);
});

test("repeated observations do not spend time; a returned consultation remains resumable", () => {
  const observed = observeService(startService(INITIAL, "shen"), "eyes");
  assert.equal(observeService(observed, "eyes"), observed);
  const restored = parseCampaign(JSON.stringify(observed))!;
  assert.deepEqual(restored.activeSession?.discovered, ["eyes"]);
  assert.equal(startService(restored, "mei"), restored);
  assert.equal(startService(restored, "shen"), restored);
  const expired = advanceFloorTime(restored, CUSTOMERS.shen.patience * 20);
  assert.equal(expired.activeSession, null);
  assert.equal(releaseService(releaseService(restored)).lost.length, 1);
});

test("a sample never turns an unsuitable trial into a suitable sale", () => {
  let s = respondToRival(consult(INITIAL, "shen", "repair"), "record");
  s = leaveSample(s, "shen");
  assert.equal(s.activeSession?.reaction, "negative");
  assert.equal(leaveSample(s, "shen"), s);
  const refused = closeService(s)!;
  assert.equal(refused.outcome.units, 0);
  assert.equal(refused.outcome.amount, 0);
  assert.ok(refused.campaign.flags.includes("served:shen:refused"));
  const repaired = trialService(selectServiceProduct(s, "soft"));
  assert.equal(repaired.activeSession?.reaction, "positive");
  const sold = closeService(repaired)!;
  assert.equal(sold.outcome.units, 1, "默认只开口一件");
  assert.equal(sold.outcome.amount, PRODUCTS.soft.price);
  assert.equal(closeService(chooseBundle(repaired, "set"))!.outcome.units, herCap("shen", "soft"));
});

test("rival decisions are required and idempotent; split risk refunds only the recorded share", () => {
  const pending = consult(INITIAL, "shen", "glow");
  assert.equal(closeService(pending, true), null);
  const shared = respondToRival(pending, "yield");
  assert.equal(respondToRival(shared, "record"), shared);
  const closed = closeService(shared, true)!;
  assert.equal(closed.outcome.units, 1, "她一件都不认同，强推也只能记一件");
  assert.equal(closed.outcome.total, PRODUCTS.glow.price);
  assert.equal(closed.outcome.amount, PRODUCTS.glow.price / 2);
  assert.equal(closed.campaign.orders[0].total, PRODUCTS.glow.price);
  assert.equal(closed.campaign.orders[0].amount, PRODUCTS.glow.price / 2);
  assert.equal(closeService(closed.campaign), null);
  const returned = applyDawn({ ...closed.campaign, day: 3, daySales: 0 });
  assert.equal(returned.sales, 0);
  assert.equal(returned.daySales, -PRODUCTS.glow.price / 2);
  assert.equal(parseCampaign(JSON.stringify(returned))?.daySales, -PRODUCTS.glow.price / 2);
  assert.ok(returned.flags.includes("shen-chargeback"));
  assert.equal(applyDawn(returned).sales, returned.sales);
});

test("old version-2 saves migrate additively and malformed sessions cannot enter gameplay", () => {
  const { orders, shiftMinutes, floorSeconds, finished, ...old } = INITIAL;
  const restored = parseCampaign(JSON.stringify(old))!;
  assert.equal(restored.shiftMinutes, 0);
  assert.deepEqual(restored.orders, []);
  assert.equal(restored.finished, false);
  for (const patch of [{ day: 1.5 }, { day: 6 }, { sales: "1000" }, { sales: null }, { activeSession: { customerId: "unknown" } }]) {
    assert.equal(parseCampaign(JSON.stringify({ ...INITIAL, ...patch })), null);
  }
});

test("staff favors require a relationship and can only be used once per shift", () => {
  assert.equal(requestStaffHelp(INITIAL, "shen"), INITIAL);
  const helped = requestStaffHelp({ ...INITIAL, flags: ["covered-suman"] }, "shen");
  assert.equal(helped.waitMeters.shen, INITIAL.waitMeters.shen + 2);
  assert.equal(helped.energy, 94);
  assert.equal(requestStaffHelp(helped, "mei"), helped);
});

test("every displayed quote adds up to its complete order and actual share", () => {
  const bundles = Object.keys(BUNDLES) as BundleId[];
  for (const id of Object.keys(CUSTOMERS) as CustomerId[]) for (const product of ["soft", "glow", "repair"] as ProductId[]) for (const bundle of bundles) for (const shared of [false, true]) {
    const quote = orderQuote(id, product, bundle, shared);
    assert.equal(quote.lines.reduce((sum, row) => sum + row.amount, 0), quote.total);
    assert.equal(quote.total, quote.units * PRODUCTS[product].price);
    assert.equal(quote.amount, shared ? quote.total / 2 : quote.total);
    assert.ok(quote.units <= CUSTOMERS[id].maxUnits, `${id} 不能带走超过她说过的用量`);
    assert.ok(quote.total <= CUSTOMERS[id].budget || quote.tier === "negative", `${id} 的报价不能超出她的预算`);
    if (quote.tier === "negative") assert.equal(quote.units, 0, "方向不对时报价就是零");
    if (!quote.units) assert.ok(quote.tier === "negative" || PRODUCTS[product].price > CUSTOMERS[id].budget, "零件必须说得出理由");
    assert.ok(quote.minutes >= 1, "任何一次关单都要占现场时间");
  }
});

test("refused customers do not create phantom ownership or paid-order events", () => {
  const day2 = { ...INITIAL, day: 2, dayServed: ["xiaoyu" as const], flags: ["served:xiaoyu:refused"] };
  assert.equal(dayEvent(day2).choices.some(choice => choice.id === "split-tang"), false);
  const day3 = { ...INITIAL, day: 3, dayServed: ["zhao" as const], flags: ["served:zhao:refused"] };
  assert.equal(dayEvent(day3).choices.some(choice => choice.id === "protect-zhao"), false);
  assert.equal(dayEvent({ ...INITIAL, day: 4, lost: ["anjie"] }).choices.some(choice => choice.id === "give-gifts"), false);
});

test("transferring a risky order only refunds the share still credited to you", () => {
  let s = consult({ ...INITIAL, day: 2, waitMeters: { xiaoyu: 8, zhou: 8 } }, "xiaoyu", "glow");
  s = closeService(s, true)!.campaign;
  assert.equal(s.sales, PRODUCTS.glow.price);
  s = settleDayEvent(s, "split-tang");
  assert.equal(s.sales, PRODUCTS.glow.price / 2);
  assert.equal(s.orders[0].amount, PRODUCTS.glow.price / 2);
  const refunded = applyDawn({ ...s, day: 4, daySales: 0 });
  assert.equal(refunded.daySales, -PRODUCTS.glow.price / 2);
  assert.equal(refunded.sales, 0);
});

test("legacy purchases keep their event and transferred refund liability without an orders field", () => {
  const booked = PRODUCTS.glow.price;
  const legacy: Campaign = { ...INITIAL, day: 2, sales: booked, daySales: booked, dayServed: ["xiaoyu"], flags: ["served:xiaoyu:risky"] };
  const shared = settleDayEvent(legacy, "split-tang");
  assert.equal(shared.sales, booked / 2);
  assert.equal(applyDawn({ ...shared, day: 4, daySales: 0 }).daySales, -booked / 2);
  assert.ok(dayEvent({ ...INITIAL, day: 3, flags: ["served:zhao:good"] }).choices.some(choice => choice.id === "protect-zhao"));
});

test("gift choices cannot spend inventory that does not exist", () => {
  const state: Campaign = { ...INITIAL, day: 4, samples: 1, orders: [{ day: 4, customerId: "anjie", product: "repair", total: 6800, amount: 6800, shared: false, risky: false }] };
  assert.equal(settleDayEvent(state, "give-gifts"), state);
  assert.equal(settleDayEvent(state, "sign-gifts"), state);
});

test("the closing response is recorded once and survives reload", () => {
  const closed = settleDayEvent(INITIAL, "refuse-suman");
  assert.ok(closed.history.some(entry => entry.text.includes("苏蔓沉默了")));
  assert.deepEqual(parseCampaign(JSON.stringify(closed))?.history, closed.history);
  assert.equal(settleDayEvent(closed, "refuse-suman"), closed);
});

test("an actual five-day route survives saves and still needs the final order", () => {
  const clean = runRoute();
  assert.equal(clean.served, 10);
  assert.equal(clean.final.orders.length, 10);
  assert.equal(clean.final.finished, true);
  assert.equal(endingTitle(clean.final), "你留下了，而且没变成她们");
  const reloaded = parseCampaign(JSON.stringify(clean.final))!;
  assert.equal(reloaded.sales, clean.final.sales);
  assert.deepEqual(reloaded.orders, clean.final.orders);
  assert.ok(clean.dayTotals[3] < TARGET, "第 4 天还不能提前达标");
  assert.ok(clean.final.sales >= TARGET);
});

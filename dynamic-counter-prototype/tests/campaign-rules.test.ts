import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDawn, applyFinale, CUSTOMERS, dawnNotices, endingTitle, history, INITIAL, leaveSample, parseCampaign,
  resolveSale, RIVAL_INTERRUPTIONS, SAMPLE_RETURN_SALE, SAVE_VERSION, TARGET, type Campaign,
} from "../src/campaign.ts";

const honestThroughDay4 =
  CUSTOMERS.shen.sale + CUSTOMERS.mei.sale +
  CUSTOMERS.xiaoyu.sale + CUSTOMERS.zhou.sale - 490 +
  CUSTOMERS.zhao.sale + CUSTOMERS.duan.sale - 700 +
  CUSTOMERS.anjie.sale + CUSTOMERS.zhou2.sale;

const honestTotal = honestThroughDay4 + 1680 + CUSTOMERS.returning.sale;

function campaign(patch: Partial<Campaign>): Campaign {
  return { ...INITIAL, ...patch, relations: { ...INITIAL.relations, ...patch.relations }, flags: patch.flags ?? [], history: patch.history ?? [] };
}

test("a clean route still needs day 5 to clear the target", () => {
  assert.equal(TARGET, 21_000);
  assert.equal(honestThroughDay4, 16_750);
  assert.equal(honestTotal, 22_630);
  assert.ok(honestThroughDay4 < TARGET);
  assert.ok(honestTotal >= TARGET);
});

test("history keeps more than 25 entries", () => {
  let state = INITIAL;
  for (let index = 0; index < 30; index += 1) state = { ...state, history: history(state, `记录${index}`) };
  assert.equal(state.history.length, 30);
  assert.equal(state.history[0]?.text, "记录0");
});

test("forcing Anjie comes back as a wedding-week blow-up", () => {
  const next = applyDawn(campaign({ day: 5, sales: 18_000, daySales: 0, flags: ["served:anjie:risky"] }));
  assert.equal(next.sales, 8_800);
  assert.ok(next.flags.includes("anjie-blew-up"));
  assert.equal(next.history.at(-1)?.text, "安姐婚前爆红，苏蔓的三年老客炸了");
  assert.ok(dawnNotices(next).some(note => note.body.includes("婚礼前双颊爆红")));
});

test("a sample left after a refusal returns as a small repurchase", () => {
  const refused = leaveSample(campaign({ day: 1, flags: ["served:shen:refused"] }), "shen");
  const next = applyDawn({ ...refused, day: 2, daySales: 0 });
  assert.equal(next.sales, SAMPLE_RETURN_SALE);
  assert.ok(next.flags.includes("sample-return:shen"));
  assert.ok(dawnNotices(next).some(note => note.speaker.includes("沈薇")));
});

test("old saves without the current version are discarded", () => {
  assert.equal(parseCampaign(JSON.stringify({ ...INITIAL, version: 1, sales: 99_000 })), null);
  assert.equal(parseCampaign(JSON.stringify(INITIAL))?.version, SAVE_VERSION);
});

test("a same-day risky last order is clawed back in the finale", () => {
  const closed = resolveSale(campaign({ day: 5, sales: 20_000 }), {
    customerId: "returning", selectedProduct: "repair", tested: true, askedQuestion: 0, claimed: true, interruption: true, interruptionHandled: true, force: true,
  });
  assert.ok(closed);
  const finale = applyFinale(closed.campaign);
  assert.equal(finale.sales, 20_000 + CUSTOMERS.returning.wrongSale - 1680);
  assert.equal(endingTitle({ ...finale, compliance: 22, trust: 30 }), "柜台灯灭了");
});

test("Lu Yao's interruption copy changes by customer", () => {
  assert.notEqual(RIVAL_INTERRUPTIONS.shen.quote, RIVAL_INTERRUPTIONS.zhou.quote);
  assert.notEqual(RIVAL_INTERRUPTIONS.shen.quote, RIVAL_INTERRUPTIONS.returning.quote);
});

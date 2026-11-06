import test from "node:test";
import assert from "node:assert/strict";
import {
  act, closeDeal, continueRun, parseRun, pickCustomer, quote,
  selectDiscount, selectProduct, serializeRun,
} from "../src/world/counter/engine.ts";
import type { Receipt, Run } from "../src/world/counter/types.ts";

// Captured from the real pre-scene engine/content at commit
// 8fc8c4c34ca680ef11dc3a0f7c642b97e2c66f23 (HEAD during the semantic review).
// One-time generation used that commit's src/world/counter/{engine,content}.ts:
//   opened = pickCustomer(startRun("legacy-voice-review-55", 0, "reader"), "d1:mei");
//   listened = act(opened, "listen");
//   paid = act(act(selectProduct(opened, "dew"), "ask-budget"), "trial");
//   settled = closeDeal(selectProduct(listened, "dew"));
// These are fixed captured values, with shared unchanged fields factored out below.
// No current startRun, fabricated needs, Git access or legacy code evaluation at test time.
// The old engine genuinely rolled mei's secondary as light, not her default repair.
type LegacyRun = Omit<Run, "visitLog">;
const LEGACY_OPENED = {
  version: 1, seed: "legacy-voice-review-55", rng: 1028834540, rank: 0,
  style: "reader", phase: "deal", day: 1, turn: 0,
  money: 0, rivalMoney: 240, reputation: 5, samples: 3,
  perks: ["double-question"], relations: {},
  board: [
    {
      id: "d1:xiaoyu", customerId: "xiaoyu", primary: "light", secondary: "wear",
      budget: 249, budgetLow: 220, budgetHigh: 340, wanted: 2, rivalValue: 161,
      returning: false, occasion: "初次到柜 · 日常实用",
      opening: "第一次正式开会，想自然一点，别像戴着面具。 “今天最怕厚重，想像没涂一样轻薄。”",
    },
    {
      id: "d1:zhou", customerId: "zhou", primary: "wear", secondary: "repair",
      budget: 429, budgetLow: 380, budgetHigh: 500, wanted: 2, rivalValue: 91,
      returning: false, occasion: "初次到柜 · 日常实用",
      opening: "要连讲两场课，中间只有十分钟。 “今天要撑很久，没空补妆，持妆得靠得住。”",
    },
  ],
  active: {
    opportunity: {
      id: "d1:mei", customerId: "mei", primary: "calm", secondary: "light",
      budget: 426, budgetLow: 380, budgetHigh: 500, wanted: 3, rivalValue: 131,
      returning: false, occasion: "初次到柜 · 这次不能将就",
      opening: "风一吹脸就泛红，今天不想再受刺激。 “最近动不动泛红刺痛，先让我舒服一点。”",
    },
    patience: 3, maxPatience: 3, known: [], budgetKnown: false, listened: false,
    tried: [], trialNotes: {}, product: null, discount: 0,
    lines: ["风一吹脸就泛红，今天不想再受刺激。 “最近动不动泛红刺痛，先让我舒服一点。”"],
  },
  receipt: null, draft: [], history: [], dayRival: 240,
} satisfies LegacyRun;

const LEGACY_LISTENED = {
  ...LEGACY_OPENED,
  active: {
    ...LEGACY_OPENED.active, patience: 2, listened: true,
    lines: [
      ...LEGACY_OPENED.active.lines,
      "“队里人都跟着我买东西，我宁可慢点，也不想推荐错了让人难受。”",
      "倾听建立关系 +1（本单结算时记入）；匹配说服 +1，不改变预算。",
    ],
  },
} satisfies LegacyRun;

const LEGACY_PAID = {
  ...LEGACY_OPENED, samples: 2,
  active: {
    ...LEGACY_OPENED.active, patience: 1, budgetKnown: true,
    tried: ["dew"], product: "dew",
    trialNotes: { dew: "真实试用：主需求够用，原始匹配 9/9；报价这支可获试用说服 +1。不是预算承诺。" },
    lines: [
      ...LEGACY_OPENED.active.lines,
      "“我实际能拿出 426 元。”别替我擅自加预算。",
      "真实试用：主需求够用，原始匹配 9/9；报价这支可获试用说服 +1。不是预算承诺。",
    ],
  },
} satisfies LegacyRun;

const LEGACY_RECEIPT: Receipt = {
  id: "d1:mei", day: 1, customerId: "mei", productId: "dew", outcome: "sold",
  profit: 186, revenue: 328, fit: 9, discount: 0,
  relationDelta: 2, reputationDelta: 1, rivalGain: 0,
  headline: "梅姨成交 · 净赚 186",
  explanation: "匹配、预算与街角新柜规则都满足；没有随机掷骰。",
  lesson: "原价守住了毛利；别忘记还要选择谁留给对手。",
  breakdown: [
    "匹配 9/9 + 试用 0 + 倾听 1 = 10；门槛 8（需求强度 3）；首要需求舒缓能力 3/3，至少须为 1",
    "真实预算 426；报价 328；预算满足",
    "折扣 0%；比原价少收 0；本级不强制折扣",
    "收入 328 − 产品成本 142 + 能力奖金 0 = 净收益 186",
    "信誉 +1；关系 +2；对手机会净收益 +0",
  ],
  quote: "这次是适合我，不是你运气好。我记得你。", returning: false,
};
const LEGACY_SETTLED = {
  ...LEGACY_OPENED, phase: "receipt", turn: 1, money: 186, reputation: 6,
  relations: { mei: 2 }, active: null, receipt: LEGACY_RECEIPT, history: [LEGACY_RECEIPT],
} satisfies LegacyRun;

const NEUTRAL_STORY = "我今天还有几件事要办，先把这一样挑好。";
const LISTEN_NOTE = "倾听建立关系 +1（本单结算时记入）；匹配说服 +1，不改变预算。";

function roundTrip(run: Run): Run {
  const raw = serializeRun(run), loaded = parseRun(raw);
  assert.ok(loaded);
  assert.deepEqual(loaded, run);
  assert.equal(serializeRun(loaded), raw);
  return loaded;
}

function loadLegacy(fixture: LegacyRun = LEGACY_OPENED): Run {
  const raw = JSON.stringify(fixture), loaded = parseRun(raw);
  assert.ok(loaded, "the real old engine's save must remain loadable");
  // visitLog migration predates dialogue; it is the only permitted addition here.
  const { visitLog, ...preserved } = loaded;
  assert.deepEqual(preserved, fixture, "all old fields, numbers and historical prose survive verbatim");
  assert.deepEqual(Object.keys(visitLog).sort(), ["mei", "xiaoyu", "zhou"]);
  for (const visit of Object.values(visitLog)) assert.deepEqual(visit, { count: 1, lastDay: 1, sceneId: "daily" });
  assert.equal(JSON.stringify(fixture), raw);
  return roundTrip(loaded);
}

function assertOldOpportunity(run: Run): void {
  assert.deepEqual(run.active!.opportunity, LEGACY_OPENED.active.opportunity);
  assert.equal(Object.hasOwn(run.active!.opportunity, "story"), false);
  assert.equal(Object.hasOwn(run.active!.opportunity, "sceneId"), false);
}

function assertNeutralExchange(run: Run): void {
  assert.deepEqual(run.active!.conversation, [
    { speaker: "you", text: "今天忙不忙？我听你说。" },
    { speaker: "customer", text: NEUTRAL_STORY },
  ]);
  assert.doesNotMatch(run.active!.conversation!.map(line => line.text).join("\n"), /舒缓|轻薄|持妆|修护|426/);
  assertOldOpportunity(run);
}

test("real HEAD legacy fixtures load unchanged without story, sceneId or reconstructed conversation", () => {
  for (const fixture of [LEGACY_OPENED, LEGACY_LISTENED, LEGACY_PAID, LEGACY_SETTLED]) {
    const run = loadLegacy(fixture);
    for (const op of [...run.board, ...(run.active ? [run.active.opportunity] : [])]) {
      assert.equal(Object.hasOwn(op, "story"), false);
      assert.equal(Object.hasOwn(op, "sceneId"), false);
    }
    if (run.active) {
      assertOldOpportunity(run);
      assert.equal(Object.hasOwn(run.active, "conversation"), false);
    }
  }
  const run = loadLegacy();
  assert.deepEqual(run.active!.known, []);
  assert.equal(run.active!.budgetKnown, false);
  assert.equal(run.active!.patience, 3);
  assert.equal(run.active!.opportunity.primary, "calm");
  assert.equal(run.active!.opportunity.secondary, "light");
  assert.equal(run.active!.opportunity.budget, 426);
  assert.equal(run.active!.opportunity.wanted, 3);
});

test("legacy listen uses neutral small talk, not Mei's present-day repair requirement", () => {
  const before = loadLegacy(), snapshot = serializeRun(before);
  const next = act(before, "listen");
  assert.equal(serializeRun(before), snapshot, "the source save is not rewritten");
  assert.deepEqual({ ...next, active: before.active }, before, "listen does not settle money, relations or RNG");
  assertNeutralExchange(next);
  const { conversation: _conversation, ...deal } = next.active!;
  assert.deepEqual(deal, {
    ...before.active!, patience: 2, listened: true,
    lines: [...before.active!.lines, `“${NEUTRAL_STORY}”`, LISTEN_NOTE],
  });
  assert.equal(act(next, "listen"), next, "repeating listen neither spends nor appends");
  roundTrip(next);
});

test("after legacy listen, paid questions reveal the saved calm/light needs and 426 budget; dew still sells", () => {
  const listened = roundTrip(act(loadLegacy(), "listen"));
  const asked = act(listened, "ask-need");
  assert.equal(asked.active!.patience, 1);
  assert.deepEqual(asked.active!.known, ["calm", "light"]);
  assert.equal(asked.active!.budgetKnown, false);
  assertOldOpportunity(asked);
  assert.deepEqual(asked.active!.conversation!.slice(0, 2), listened.active!.conversation);
  const question = asked.active!.conversation!.slice(2);
  assert.deepEqual(question.map(line => line.speaker), ["you", "customer", "customer"]);
  assert.match(question[1]!.text, /舒缓/);
  assert.match(question[2]!.text, /轻薄/);
  assert.doesNotMatch(question.map(line => line.text).join("\n"), /修护|426/);
  assert.deepEqual(asked.active!.lines, [...listened.active!.lines, "问到需求：最看重舒缓。", "问到需求：其次需要轻薄。"]);
  assert.equal(act(asked, "ask-need"), asked);

  const budgeted = roundTrip(act(asked, "ask-budget"));
  assertOldOpportunity(budgeted);
  assert.equal(budgeted.active!.patience, 0);
  assert.equal(budgeted.active!.budgetKnown, true);
  assert.deepEqual(budgeted.active!.conversation!.slice(0, 5), asked.active!.conversation);
  assert.match(budgeted.active!.conversation!.at(-1)!.text, /426元/);
  assert.doesNotMatch(budgeted.active!.conversation!.at(-1)!.text, /30|修护/);
  assert.deepEqual(budgeted.active!.lines, [...asked.active!.lines, "“我实际能拿出 426 元。”别替我擅自加预算。"]);
  assert.deepEqual({ ...budgeted, active: listened.active }, listened);

  const offer = selectProduct(budgeted, "dew");
  assert.equal(quote(offer), 328);
  const sold = roundTrip(closeDeal(offer));
  const { quote: _newQuote, ...receiptFacts } = sold.receipt!;
  const { quote: _oldQuote, ...legacyFacts } = LEGACY_RECEIPT;
  assert.deepEqual(receiptFacts, legacyFacts, "only a newly settled quote may change, not the old deal's economics");
  assert.equal(sold.money, 186);
  assert.equal(sold.rivalMoney, 240);
  assert.equal(sold.reputation, 6);
  assert.equal(sold.samples, 3);
  assert.equal(sold.rng, LEGACY_OPENED.rng);
  assert.deepEqual(sold.relations, { mei: 2 });
  assert.deepEqual(sold.history, [sold.receipt]);
  assert.equal(closeDeal(sold), sold);
});

test("legacy settlement still uses light, not the repair suggested by the regressed fallback", () => {
  const listened = act(loadLegacy(), "listen");
  const wrongOffer = selectDiscount(selectProduct(listened, "nest"), 20);
  assert.equal(quote(wrongOffer), 366);
  assert.ok(quote(wrongOffer) <= 426, "this rejection is fit, not insufficient budget");
  const lost = roundTrip(closeDeal(wrongOffer));
  assert.equal(lost.receipt!.outcome, "lost");
  assert.equal(lost.receipt!.fit, 6);
  assert.equal(lost.receipt!.explanation, "匹配说服 7 未达 8，下次先确认需求、换合适产品或留一次试用/倾听");
  assert.equal(lost.money, 0);
  assert.equal(lost.receipt!.revenue, 0);
  assert.equal(lost.rivalMoney, 371);
  assert.equal(lost.reputation, 4);
  assert.equal(lost.samples, 4);
  assert.equal(lost.rng, LEGACY_OPENED.rng);
  assert.deepEqual(lost.relations, { mei: 1 });
  assert.equal(closeDeal(selectProduct(listened, "dew")).receipt!.outcome, "sold");
});

test("real old budget/trial notes remain snapshots; free choices do not reconstruct past speech", () => {
  const loaded = loadLegacy(LEGACY_PAID);
  const selected = selectDiscount(selectProduct(loaded, "nest"), 10);
  assert.equal(Object.hasOwn(selected.active!, "conversation"), false);
  assert.deepEqual(selected.active!.lines, LEGACY_PAID.active.lines);
  assert.deepEqual(selected.active!.trialNotes, LEGACY_PAID.active.trialNotes);
  const next = roundTrip(act(selected, "listen"));
  assertNeutralExchange(next);
  assert.equal(next.active!.patience, 0);
  assert.equal(next.samples, 2);
  assert.equal(next.active!.budgetKnown, true);
  assert.deepEqual(next.active!.tried, ["dew"]);
  assert.deepEqual(next.active!.known, []);
  assert.deepEqual(next.active!.trialNotes, LEGACY_PAID.active.trialNotes);
  assert.deepEqual(next.active!.lines, [...LEGACY_PAID.active.lines, `“${NEUTRAL_STORY}”`, LISTEN_NOTE]);
  assert.deepEqual(loaded.active!.lines, LEGACY_PAID.active.lines);
});

test("an already-paid old listen is never replaced with the new fallback or replayed as conversation", () => {
  const loaded = loadLegacy(LEGACY_LISTENED), before = serializeRun(loaded);
  assert.equal(act(loaded, "listen"), loaded);
  assert.equal(Object.hasOwn(loaded.active!, "conversation"), false);
  const next = roundTrip(act(loaded, "ask-need"));
  assert.equal(serializeRun(loaded), before);
  assertOldOpportunity(next);
  assert.equal(next.active!.patience, 1);
  assert.deepEqual(next.active!.known, ["calm", "light"]);
  assert.deepEqual(next.active!.lines.slice(0, 3), LEGACY_LISTENED.active.lines);
  assert.deepEqual(next.active!.conversation!.map(line => line.speaker), ["you", "customer", "customer"]);
  const spoken = next.active!.conversation!.map(line => line.text).join("\n");
  assert.match(spoken, /舒缓/);
  assert.match(spoken, /轻薄/);
  assert.doesNotMatch(spoken, /修护|426|队里人|先把这一样挑好/);
  assert.ok(!next.active!.lines.includes(`“${NEUTRAL_STORY}”`));
});

test("a genuinely settled legacy receipt keeps its old quote and accounting through refresh and the next customer", () => {
  const loaded = loadLegacy(LEGACY_SETTLED), before = serializeRun(loaded);
  assert.deepEqual(loaded.receipt, LEGACY_RECEIPT);
  assert.deepEqual(loaded.history, [LEGACY_RECEIPT]);
  assert.equal(closeDeal(loaded), loaded);
  const continued = roundTrip(continueRun(loaded));
  assert.equal(continued.money, 186);
  assert.equal(continued.rivalMoney, 240);
  assert.equal(continued.receipt, null);
  assert.deepEqual(continued.history, [LEGACY_RECEIPT]);
  const next = roundTrip(act(pickCustomer(continued, "d1:xiaoyu"), "listen"));
  assert.deepEqual(next.history, [LEGACY_RECEIPT]);
  assert.equal(next.money, 186);
  assert.equal(serializeRun(loaded), before);
});

import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOMERS, LEAGUES, PRODUCTS, STYLES, TRAIT_LABELS } from "../src/world/counter/content.ts";
import {
  act, choosePerk, closeDeal, continueRun, leaveDeal, META_KEY, parseRun, pickCustomer,
  SAVE_KEY, selectDiscount, selectProduct, serializeRun, startRun,
} from "../src/world/counter/engine.ts";
import { talkToSuman } from "../src/world/counter/colleague.ts";
import { budgetReply, needReply, receiptReply, trialReply } from "../src/world/counter/voices.ts";
import {
  publicSubsidyPreview, SUBSIDY_EXPERIMENT, SUBSIDY_META_KEY, SUBSIDY_SAVE_KEY,
} from "../src/world/counter/subsidy.ts";
import type { Action, ConversationLine, Experiment, Run, StyleId } from "../src/world/counter/types.ts";
import { publicView } from "./counter-sim.ts";
import { execute, finiteDecision, policyView, simulateWeek } from "./counter-subsidy-sim.ts";

// Fixtures use actual engine transitions. Only historical text/optional-field removal
// is edited for compatibility tests; never manufacture money, needs, budgets or wins.
const ACTIONS: Action[] = ["ask-need", "ask-budget", "listen", "trial"];
const SYSTEM_SPEECH = /原始匹配|匹配说服|倾听说服|关系\s*[+＋]|信誉\s*[+＋−-]|净收益|试用说服|能力奖金/;
const captures = new Map<string, Run[]>();
function states(seed = "counter-dialogue-0", experiment?: Experiment): Run[] {
  const key = `${seed}/${experiment ?? "standard"}`;
  if (!captures.has(key)) {
    const snapshots: Run[] = [];
    simulateWeek(seed, "reader", "standard", experiment ? "experiment" : "control", run => snapshots.push(structuredClone(run)));
    captures.set(key, snapshots);
  }
  return structuredClone(captures.get(key)!);
}
function at(day: number, phase: Run["phase"], experiment?: Experiment): Run {
  for (let seed = 0; seed < 12; seed++) {
    const run = states(`counter-dialogue-${seed}`, experiment).find(r => r.day === day && r.phase === phase);
    if (run) return roundTrip(run);
  }
  throw new Error(`No real D${day}/${phase} fixture within 12 finite-policy seeds`);
}
function roundTrip(run: Run): Run {
  const loaded = parseRun(serializeRun(run));
  assert.deepEqual(loaded, run);
  return loaded!;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}
function conversation(run: Run): ConversationLine[] {
  assert.ok(run.active?.conversation, "new paid exchanges must have a conversation snapshot");
  return run.active.conversation;
}
function withoutConversation(run: Run): Run {
  const copy = structuredClone(run);
  if (copy.active) delete copy.active.conversation;
  return copy;
}
function withoutChat(run: Run): Run {
  const copy = structuredClone(run);
  delete copy.colleagueChat;
  return copy;
}
function firstDeal(style: StyleId = "friend", experiment?: Experiment): Run {
  const run = startRun("counter-dialogue-actions", 0, style, experiment);
  return pickCustomer(run, run.board[0]!.id);
}
function expectedTrialNote(run: Run): string {
  const d = run.active!, op = d.opportunity, p = PRODUCTS.find(p => p.id === d.product)!;
  const primary = p.traits[op.primary], fit = primary * 2 + p.traits[op.secondary];
  const feedback = primary === 0 ? "缺失（这支解决不了首要需求）" : primary >= op.wanted ? "够用" : "偏弱";
  const eligible = primary >= op.wanted && p.traits[op.secondary] >= 1;
  const subsidy = run.experiment ? `适配补贴试用结论：主次需求商品能力${eligible ? "达到" : "未同时达到"}补贴标准（主需求能力须达到需求强度、次需求能力至少为 1）；不保证预算或成交。` : "";
  return `真实试用：主需求${feedback}，原始匹配 ${fit}/9；报价这支可获试用说服 +${run.perks.includes("trial-expert") ? 2 : 1}。不是预算承诺。${subsidy}`;
}
// Independent pre-dialogue action contract: exact notes are intentionally fixed,
// unlike natural speech, because the finite simulator parses these strings.
function expectedPaid(run: Run, action: Action): Run {
  const next = withoutConversation(run), d = next.active!, op = d.opportunity;
  d.patience--;
  if (action === "ask-need") {
    const unknown = [op.primary, op.secondary].filter(t => !d.known.includes(t));
    for (const trait of unknown.slice(0, next.perks.includes("double-question") ? 2 : 1)) {
      d.known.push(trait);
      d.lines.push(`问到需求：${d.known.length === 1 ? "最看重" : "其次需要"}${TRAIT_LABELS[trait]}。`);
    }
  } else if (action === "ask-budget") {
    d.budgetKnown = true;
    d.lines.push(`“我实际能拿出 ${op.budget} 元。”${next.perks.includes("budget-room") ? "说明价值后最多可再加 30 元。" : "别替我擅自加预算。"}`);
  } else if (action === "listen") {
    d.listened = true;
    d.lines.push(`“${op.story ?? "我今天还有几件事要办，先把这一样挑好。"}”`);
    d.lines.push(`倾听建立关系 +1（本单结算时记入）；匹配说服 +${next.perks.includes("deep-listen") ? 2 : 1}，不改变预算。`);
  } else {
    next.samples--;
    d.tried.push(d.product!);
    if (next.experiment) {
      const p = PRODUCTS.find(p => p.id === d.product)!;
      d.subsidyEvidence ??= {};
      d.subsidyEvidence[d.product!] = p.traits[op.primary] >= op.wanted && p.traits[op.secondary] >= 1;
    }
    d.trialNotes[d.product!] = expectedTrialNote(run);
    d.lines.push(d.trialNotes[d.product!]!);
  }
  return next;
}
function checkExchange(before: Run, after: Run, action: Action): void {
  const old = conversation(before), all = conversation(after), added = all.slice(old.length);
  assert.deepEqual(all.slice(0, old.length), old, "never rewrite earlier speech");
  assert.ok(added.length >= 2, "one player question and at least one customer response");
  assert.equal(added[0]!.speaker, "you");
  assert.ok(added.slice(1).every(line => line.speaker === "customer"));
  for (const line of added) {
    assert.ok(line.text.trim().length > 0);
    assert.doesNotMatch(line.text, SYSTEM_SPEECH);
  }
  const reply = added.slice(1).map(line => line.text).join("\n");
  const d = after.active!, op = d.opportunity;
  if (action === "ask-need") {
    for (const trait of d.known.filter(t => !before.active!.known.includes(t))) {
      assert.ok(reply.includes(needReply(op.customerId, trait, d.known.indexOf(trait) > 0)));
    }
    for (const trait of [op.primary, op.secondary].filter(t => !d.known.includes(t))) {
      assert.ok(!reply.includes(TRAIT_LABELS[trait]), "a single question cannot reveal the other need");
    }
  } else if (action === "ask-budget") {
    assert.ok(reply.includes(budgetReply(op.customerId, op.budget)));
    for (const label of Object.values(TRAIT_LABELS)) assert.ok(!reply.includes(label), "asking budget does not ask an extra need");
  } else if (action === "listen") {
    assert.ok(reply.includes(op.story ?? "我今天还有几件事要办，先把这一样挑好。"));
  } else {
    const p = PRODUCTS.find(p => p.id === d.product)!, primary = p.traits[op.primary];
    assert.ok(reply.includes(trialReply(op.customerId, primary === 0 ? "missing" : primary < op.wanted ? "weak" : "enough")));
    assert.doesNotMatch(reply, /\d|付款|结账|肯定买|一定买/);
    for (const label of Object.values(TRAIT_LABELS)) assert.ok(!reply.includes(label), "trial feedback is not an unasked need disclosure");
  }
  if (action !== "ask-budget") assert.ok(!reply.includes(String(op.budget)), "unasked exact budget remains private");
  assert.deepEqual(withoutConversation(after), expectedPaid(before, action), "dialogue must not change legacy rules, notes, RNG or resources");
  roundTrip(after);
}

test("new pickCustomer starts with the actual opening, without revealing extra needs or budget", () => {
  for (const style of STYLES) for (const rank of LEAGUES) {
    const run = startRun(`dialogue-opening-${rank.id}`, rank.id, style.id);
    for (const op of run.board) {
      const before = structuredClone(run), next = pickCustomer(freeze(run), op.id);
      assert.deepEqual(conversation(next), [{ speaker: "customer", text: op.opening }]);
      assert.deepEqual(next.active!.lines, [op.opening]);
      assert.deepEqual(next.active!.known, []);
      assert.equal(next.active!.budgetKnown, false);
      for (const key of ["rng", "money", "rivalMoney", "reputation", "samples"] as const) assert.equal(next[key], run[key]);
      assert.deepEqual(run, before);
      roundTrip(next);
    }
  }
});

for (const action of ACTIONS) test(`${action}: paid role exchange preserves old information scope, raw notes and every other field`, () => {
  for (const experiment of [undefined, SUBSIDY_EXPERIMENT] as const) for (const style of STYLES) for (const league of LEAGUES) {
    const run = startRun(`dialogue-paid-${league.id}`, league.id, style.id, experiment);
    for (const op of run.board) for (const product of action === "trial" ? PRODUCTS : PRODUCTS.slice(0, 1)) {
      const before = selectProduct(pickCustomer(run, op.id), product.id), snapshot = structuredClone(before);
      const next = act(freeze(before), action);
      checkExchange(before, next, action);
      assert.deepEqual(before, snapshot);
    }
  }
});

test("second need, paid perk modifiers and returning customers keep the same disclosure boundary", () => {
  const first = firstDeal();
  const once = act(first, "ask-need"), twice = act(once, "ask-need");
  assert.deepEqual(once.active!.known, [first.active!.opportunity.primary]);
  checkExchange(once, twice, "ask-need");
  assert.equal(act(twice, "ask-need"), twice);
  const covered = new Set<string>();
  let returning = false;
  for (let seed = 0; seed < 12; seed++) for (const state of states(`counter-dialogue-${seed}`)) {
    if (state.phase !== "select") continue;
    for (const op of state.board) {
      const deal = selectProduct(pickCustomer(state, op.id), PRODUCTS[0]!.id);
      if (op.returning && !returning) {
        assert.deepEqual(conversation(deal), [{ speaker: "customer", text: op.opening }]);
        assert.deepEqual(deal.active!.known, [op.primary]);
        assert.equal(deal.active!.budgetKnown, false);
        assert.equal(deal.active!.lines.length, 2, "relationship reminder remains a sales note, not invented speech");
        checkExchange(deal, act(deal, "ask-need"), "ask-need");
        returning = true;
      }
      for (const [perk, action] of [["budget-room", "ask-budget"], ["deep-listen", "listen"], ["trial-expert", "trial"]] as const) {
        if (state.perks.includes(perk) && !covered.has(perk) && (action !== "trial" || state.samples > 0)) {
          checkExchange(deal, act(deal, action), action);
          covered.add(perk);
        }
      }
    }
  }
  assert.equal(returning, true, "finite trajectories must exercise a real return visit");
  assert.deepEqual([...covered].sort(), ["budget-room", "deep-listen", "trial-expert"]);
});

test("invalid/repeated paid actions and free product/discount changes cannot append speech or charge twice", () => {
  const base = firstDeal("reader");
  assert.equal(act(base, "trial"), base);
  assert.equal(act(base, "invalid" as Action), base);
  for (const action of ["ask-need", "ask-budget", "listen"] as const) {
    const next = act(base, action);
    assert.equal(act(freeze(next), action), next);
  }
  const picked = selectProduct(base, PRODUCTS[0]!.id), tried = act(picked, "trial");
  assert.equal(act(freeze(tried), "trial"), tried);
  const switched = selectDiscount(selectProduct(tried, PRODUCTS[1]!.id), 10);
  assert.deepEqual(conversation(switched), conversation(tried));
  assert.deepEqual(switched.active!.lines, tried.active!.lines);
  for (const key of ["rng", "money", "samples", "reputation"] as const) assert.equal(switched[key], tried[key]);
  checkExchange(switched, act(switched, "trial"), "trial");
  const spent = act(act(tried, "listen"), "ask-budget");
  assert.equal(spent.active!.patience, 0);
  for (const action of ACTIONS) assert.equal(act(freeze(spent), action), spent);
  const receipt = closeDeal(spent);
  for (const action of ACTIONS) assert.equal(act(receipt, action), receipt);
});

test("trial-only publicly records both subsidy outcomes but never learns exact budget or silently asks needs", () => {
  const outcomes = new Set<string>();
  for (let seed = 0; seed < 12 && outcomes.size < 2; seed++) {
    const day = states(`counter-dialogue-${seed}`, SUBSIDY_EXPERIMENT).find(r => r.day === 3 && r.phase === "select" && r.turn === 0);
    if (!day) continue;
    for (const op of day.board.filter(o => !o.returning)) {
      const before = selectProduct(pickCustomer(day, op.id), day.subsidy!.productId);
      assert.equal(publicSubsidyPreview(before).status, "unknown");
      const next = act(before, "trial");
      checkExchange(before, next, "trial");
      assert.deepEqual(next.active!.known, []);
      assert.equal(next.active!.budgetKnown, false);
      assert.equal(publicView(next).active!.budget, null);
      const p = PRODUCTS.find(p => p.id === next.active!.product)!;
      const eligible = p.traits[op.primary] >= op.wanted && p.traits[op.secondary] >= 1;
      const preview = publicSubsidyPreview(roundTrip(next));
      assert.equal(preview.status, eligible ? "eligible" : "ineligible");
      assert.ok(!preview.reason.includes(String(op.budget)));
      assert.equal(next.active!.trialNotes[p.id], expectedTrialNote(before));
      assert.deepEqual(publicView(roundTrip(next)), publicView(next), "simulator still sees the original trial note");
      outcomes.add(preview.status);
    }
  }
  assert.deepEqual([...outcomes].sort(), ["eligible", "ineligible"]);
});

test("legacy deals without conversation load unchanged and never reconstruct earlier paid information", () => {
  for (const experiment of [undefined, SUBSIDY_EXPERIMENT] as const) {
    const before = act(act(selectProduct(firstDeal("friend", experiment), PRODUCTS[0]!.id), "ask-budget"), "trial");
    const legacy = withoutConversation(before), raw = serializeRun(legacy), loaded = roundTrip(legacy);
    assert.equal(Object.hasOwn(loaded.active!, "conversation"), false);
    assert.equal(serializeRun(loaded), raw);
    const next = act(loaded, "ask-need"), text = conversation(next).map(line => line.text).join("\n");
    assert.ok(!text.includes(String(loaded.active!.opportunity.budget)), "known legacy budget is not a new historical utterance");
    assert.ok(!text.includes(loaded.active!.trialNotes[PRODUCTS[0]!.id]!));
    assert.ok(!text.includes(budgetReply(loaded.active!.opportunity.customerId, loaded.active!.opportunity.budget)));
    assert.equal(conversation(next).filter(line => line.speaker === "you").length, 1);
    assert.deepEqual(withoutConversation(next), expectedPaid(loaded, "ask-need"));
    roundTrip(closeDeal(next));
  }
});

test("saved natural speech, raw notes and old receipt quotes are snapshots, not regenerated content", () => {
  let run = act(selectProduct(firstDeal(), PRODUCTS[0]!.id), "trial");
  run.active!.conversation = conversation(run).map((line, i) => ({ ...line, text: `旧版已保存谈话 ${i}，原句留在这里。` }));
  run.active!.trialNotes[PRODUCTS[0]!.id] = "旧版已保存试用笔记，不能按现在文案重算。";
  run.active!.lines[run.active!.lines.length - 1] = run.active!.trialNotes[PRODUCTS[0]!.id]!;
  const snapshot = structuredClone(run), loaded = roundTrip(run);
  const next = act(loaded, "listen");
  assert.deepEqual(conversation(next).slice(0, conversation(snapshot).length), conversation(snapshot));
  assert.deepEqual(next.active!.lines.slice(0, snapshot.active!.lines.length), snapshot.active!.lines);
  assert.deepEqual(next.active!.trialNotes, snapshot.active!.trialNotes);
  run = closeDeal(next);
  run.receipt!.quote = "旧版收据里已经说过的话，不重新配音。";
  run.history[run.history.length - 1]!.quote = run.receipt!.quote;
  const receipt = roundTrip(run), quote = receipt.receipt!.quote;
  assert.equal(closeDeal(receipt), receipt);
  const continued = roundTrip(continueRun(receipt));
  assert.equal(continued.history.at(-1)!.quote, quote);
  assert.equal(roundTrip(continued).history.at(-1)!.quote, quote);
});

test("optional dialogue/chat snapshots reject malformed values, without comparing historical prose", () => {
  const deal = act(firstDeal(), "listen");
  for (const bad of [null, {}, "text", [{ speaker: "narrator", text: "x" }], [{ speaker: "you", text: 12 }]]) {
    const value = JSON.parse(serializeRun(deal));
    value.active.conversation = bad;
    assert.equal(parseRun(JSON.stringify(value)), null);
  }
  const draft = at(1, "draft");
  for (const bad of [null, "review", {}, { choice: "other", reply: "x", nextMorning: "y" }, { choice: "review", reply: 1, nextMorning: "y" }]) {
    const value = JSON.parse(serializeRun(draft));
    value.colleagueChat = bad;
    assert.equal(parseRun(JSON.stringify(value)), null);
  }
});

function checkSettlement(before: Run, after: Run, leaving = false): void {
  const d = before.active!, op = d.opportunity, p = PRODUCTS.find(p => p.id === d.product)!;
  const fit = p.traits[op.primary] * 2 + p.traits[op.secondary];
  const price = Math.round(p.price * (100 - d.discount) / 100);
  const has = (id: string) => before.perks.includes(id);
  const budgetOK = price <= op.budget + Number(d.budgetKnown && has("budget-room")) * 30;
  const fitOK = p.traits[op.primary] >= 1 && fit + Number(d.tried.includes(p.id)) * (1 + Number(has("trial-expert"))) + Number(d.listened) * (1 + Number(has("deep-listen"))) >= op.wanted * 2 + 2 + Number(before.rank === 2 || before.rank === 4);
  const proofOK = ![1, 4].includes(before.rank) || d.discount >= 10 || d.tried.includes(p.id);
  const sold = !leaving && budgetOK && fitOK && proofOK && price >= p.cost;
  const profit = sold ? price - p.cost + Number(d.discount === 0 && has("full-price")) * 30 + Number(fit >= 8 && has("perfect-fit")) * 35 + Number(op.returning && has("warm-return")) * 40 + Number(d.listened && has("care-bonus")) * 25 : 0;
  const rep = sold ? Math.min(7 - before.reputation, Number(d.listened || fit >= 8) + Number(has("good-name"))) : -1;
  const receipt = after.receipt!;
  assert.equal(receipt.outcome, sold ? "sold" : leaving ? "leave" : "lost");
  assert.equal(receipt.quote, receiptReply({ customerId: op.customerId, outcome: receipt.outcome, productName: p.name, discount: d.discount, returning: op.returning, budgetOK, fitOK, proofOK }));
  assert.doesNotMatch(receipt.quote, SYSTEM_SPEECH);
  assert.equal(receipt.profit, profit);
  assert.equal(receipt.revenue, sold ? price : 0);
  assert.equal(receipt.fit, fit);
  assert.equal(receipt.relationDelta, Number(sold) + Number(d.listened));
  assert.equal(receipt.reputationDelta, rep);
  assert.equal(after.money, before.money + profit);
  assert.equal(after.reputation, before.reputation + rep);
  assert.equal(after.rivalMoney, before.rivalMoney + (sold ? 0 : op.rivalValue));
  assert.equal(after.samples, sold ? before.samples : Math.min(12, before.samples + (has("second-wind") ? 3 : 1)));
  assert.equal(after.rng, before.rng);
  const relations = { ...before.relations };
  if (receipt.relationDelta) relations[op.customerId] = (relations[op.customerId] ?? 0) + receipt.relationDelta;
  assert.deepEqual(after.relations, relations);
  assert.deepEqual(after.perks, before.perks);
  assert.deepEqual(after.history.slice(0, -1), before.history);
  assert.deepEqual(after.history.at(-1), receipt);
  assert.equal(closeDeal(after), after);
  roundTrip(after);
}

test("new receipt quotes come from the actual customer's voice without changing settlement or RNG", () => {
  const quotes = new Map<string, string>(), outcomes = new Set<string>();
  const soldVoices = new Map<string, Map<string, string>>();
  for (let seed = 0; seed < 8; seed++) for (const style of STYLES) for (const league of LEAGUES) {
    const start = startRun(`dialogue-receipt-${seed}`, league.id, style.id);
    for (const op of start.board) for (const p of PRODUCTS) {
      let run = selectProduct(pickCustomer(start, op.id), p.id);
      run = act(run, "listen");
      run = act(run, "trial");
      for (const discount of [0, 10, 20] as const) {
        const offer = selectDiscount(run, discount), settled = closeDeal(offer);
        checkSettlement(offer, settled);
        outcomes.add(settled.receipt!.outcome);
        if (settled.receipt!.outcome === "sold") {
          if (!soldVoices.has(p.id)) soldVoices.set(p.id, new Map());
          soldVoices.get(p.id)!.set(op.customerId, settled.receipt!.quote);
        }
      }
      const left = leaveDeal(run);
      checkSettlement(run, left, true);
      quotes.set(op.customerId, left.receipt!.quote);
    }
  }
  assert.deepEqual([...outcomes].sort(), ["lost", "sold"]);
  assert.ok(quotes.size >= 8, "cover multiple actual characters, not one generic fixture");
  assert.equal(new Set(quotes.values()).size, quotes.size, "different characters must not share a generic receipt quote");
  assert.ok([...soldVoices.values()].some(voices => voices.size >= 2));
  for (const voices of soldVoices.values()) assert.equal(new Set(voices.values()).size, voices.size, "same-product sales still sound like different customers");
});

function failedDraft(): Run {
  let run = startRun("dialogue-unassisted-losses", 0, "friend");
  for (let turn = 0; turn < 2; turn++) {
    run = pickCustomer(run, run.board[0]!.id);
    const p = PRODUCTS.find(p => p.traits[run.active!.opportunity.primary] === 0)!;
    run = closeDeal(selectProduct(run, p.id));
    assert.equal(run.receipt!.outcome, "lost");
    run = continueRun(run);
  }
  assert.equal(run.phase, "draft");
  return roundTrip(run);
}
function soldDraft(): Run {
  for (let seed = 0; seed < 12; seed++) {
    const run = states(`counter-dialogue-${seed}`).find(r => r.day === 1 && r.phase === "draft" && r.history.every(h => h.outcome === "sold"));
    if (run) return roundTrip(run);
  }
  throw new Error("No real two-sale D1 draft in 12 finite-policy seeds");
}

for (const choice of ["review", "own"] as const) test(`Suman ${choice}: once-only immutable snapshot, absolutely no economy/perk/RNG side effects`, () => {
  for (const draft of [soldDraft(), failedDraft()]) {
    const before = structuredClone(draft), chatted = talkToSuman(freeze(draft), choice);
    assert.notEqual(chatted, draft);
    assert.equal(chatted.colleagueChat!.choice, choice);
    assert.ok(chatted.colleagueChat!.reply.trim().length > 0);
    assert.ok(chatted.colleagueChat!.nextMorning.trim().length > 0);
    assert.deepEqual(withoutChat(chatted), before, "only colleagueChat may change");
    assert.deepEqual(draft, before);
    assert.deepEqual(talkToSuman(before, choice), chatted, "same real receipts yield the same snapshot");
    roundTrip(chatted);
    for (const again of ["review", "own"] as const) assert.equal(talkToSuman(freeze(chatted), again), chatted);
  }
});

test("review distinguishes genuine sales from failures and does not invent unperformed paid actions", () => {
  const success = soldDraft(), failure = failedDraft();
  const won = talkToSuman(success, "review").colleagueChat!, lost = talkToSuman(failure, "review").colleagueChat!;
  assert.notEqual(won.reply, lost.reply);
  for (const run of [success, failure]) {
    const reply = talkToSuman(run, "review").colleagueChat!.reply;
    for (const c of CUSTOMERS.filter(c => !run.history.some(r => r.customerId === c.id))) {
      assert.ok(!reply.includes(c.name), `Suman cannot review an unserved customer: ${c.name}`);
    }
  }
  assert.ok(failure.history.every(r => r.outcome === "lost" && r.relationDelta === 0));
  assert.doesNotMatch(lost.reply, /(?:两单|两笔|两位).*(?:都成了|全成了|都买了)|你(?:已经|刚才|今天|这次)(?:先)?(?:问清了|试过了|听完了)|你(?:问了预算|给了试用|做了试用|倾听了)/);
});

test("Suman rejects all wrong phases, later days, invalid choices and the experimental entry by identity", () => {
  const draft = at(1, "draft"), experimental = at(1, "draft", SUBSIDY_EXPERIMENT);
  const invalid = [startRun("dialogue-illegal"), firstDeal(), closeDeal(selectProduct(firstDeal(), PRODUCTS[0]!.id)), at(2, "draft"), at(7, "result"), experimental];
  for (const run of invalid) for (const choice of ["review", "own"] as const) assert.equal(talkToSuman(freeze(run), choice), run);
  for (const choice of ["bad", "", null, undefined, 1]) {
    assert.equal(talkToSuman(freeze(draft), choice as Parameters<typeof talkToSuman>[1]), draft);
  }
});

test("skipping is a normal perk choice; chatting preserves the D2 morning and all subsequent game states", () => {
  const draft = soldDraft();
  for (const choice of ["review", "own"] as const) {
    let plain = choosePerk(draft, draft.draft[0]!);
    let chatted = choosePerk(roundTrip(talkToSuman(draft, choice)), draft.draft[0]!);
    const snapshot = structuredClone(chatted.colleagueChat!);
    assert.equal(plain.day, 2);
    assert.equal(plain.turn, 0);
    assert.equal(plain.phase, "select");
    assert.equal(Object.hasOwn(plain, "colleagueChat"), false);
    for (let steps = 0; steps < 250; steps++) {
      assert.deepEqual(withoutChat(chatted), plain);
      assert.deepEqual(roundTrip(chatted).colleagueChat, snapshot);
      assert.equal(talkToSuman(chatted, choice), chatted);
      if (plain.phase === "result") break;
      if (plain.phase === "receipt") {
        plain = continueRun(plain); chatted = continueRun(chatted);
      } else if (plain.phase === "draft") {
        const id = plain.draft[0]!;
        plain = choosePerk(plain, id); chatted = choosePerk(chatted, id);
      } else {
        const command = finiteDecision(policyView(plain), "standard");
        plain = execute(plain, command); chatted = execute(chatted, command);
      }
    }
    assert.equal(chatted.phase, "result", "bounded real trajectory must finish");
  }
});

test("saved colleague wording survives refresh/content changes, and new runs never inherit it", () => {
  const talked = talkToSuman(soldDraft(), "own");
  talked.colleagueChat!.reply = "旧版苏蔓回复，原样保留。";
  talked.colleagueChat!.nextMorning = "旧版第二天记忆，原样保留。";
  const loaded = roundTrip(talked), next = choosePerk(loaded, loaded.draft[0]!);
  assert.deepEqual(roundTrip(next).colleagueChat, talked.colleagueChat);
  for (const experiment of [undefined, SUBSIDY_EXPERIMENT] as const) {
    const fresh = roundTrip(startRun(talked.seed, talked.rank, talked.style, experiment));
    assert.equal(Object.hasOwn(fresh, "colleagueChat"), false);
    assert.deepEqual(fresh.history, []);
  }
  assert.equal(SAVE_KEY, "last-order.counter.run.v1");
  assert.equal(META_KEY, "last-order.counter.profile.v1");
  assert.equal(SUBSIDY_SAVE_KEY, "last-order.counter.run.fit-subsidy-v1");
  assert.equal(SUBSIDY_META_KEY, "last-order.counter.profile.fit-subsidy-v1");
  assert.equal(new Set([SAVE_KEY, META_KEY, SUBSIDY_SAVE_KEY, SUBSIDY_META_KEY]).size, 4);
});

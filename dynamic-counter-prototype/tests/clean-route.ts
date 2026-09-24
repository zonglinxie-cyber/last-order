// Shared five-day simulator for the rule tests: it plays the game through the public
// rule functions only, so the balance numbers are measured instead of hand-written.
import assert from "node:assert/strict";
import {
  addMember, applyTouch, askService, availableCustomers, BUNDLES, canAddMember, canCheckCounter, canPullOver, canTransferVia, chooseBundle, closeService, CUSTOMERS, INITIAL, dayEvent, expiredCleared, offerTransfer, orderQuote,
  leaveSample, observeService, openFloorState, parseCampaign, PRODUCTS, QUESTIONS, respondToRival, RIVAL_IDS, pullOver,
  checkCounter,
  selectServiceProduct, settleDayEvent, startNextDay, startService, transferStock, trialService, faceTrialService, touchThreads, TOUCHES_PER_EVENING,
  fitOf, unitsWanted, type BundleId, type Campaign, type CueId, type CustomerId, type ProductId, type SaleOutcome, type TransferChannel,
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
  options: { bundle?: BundleId; product?: ProductId; askIndex?: number; faceTrial?: boolean; transfer?: TransferChannel } = {},
): { campaign: Campaign; outcome: SaleOutcome; transferred: ProductId | null } {
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
  // 调货这两行按钮长在报价单上，也就是她人在柜台、session 还开着的那一刻。
  // 在柜台外打这通电话是模拟器的自创动作，规则会把排队中的她一起扣掉 —— 那不是玩家能按出来的东西。
  let transferred: ProductId | null = null;
  if (options.transfer && offerTransfer(s, product, orderQuote(id, product, bundle, false, s.stock[product]))) {
    if (canTransferVia(s, product, options.transfer)) {
      s = transferStock(s, product, options.transfer);
      transferred = product;
    }
  }
  // 「登记我的接待」是两个 UI 都有的那一步，e2e 每次都按；模拟器不按就等于少测一步，
  // 留痕数会比真实玩出来的低。这里按下去，是为了量到玩家真的会拿到的证据。
  s = { ...s, activeSession: { ...s.activeSession!, claimed: true } };
  const quote = orderQuote(id, product, bundle, false, s.stock[product]);
  const closed = closeService(s);
  assert.ok(closed, `${id} 的关单不应该失败`);
  // 报价单必须和真实入账一致，否则 UI 在骗玩家。
  assert.equal(closed.outcome.units, quote.units, `${id} 的成交件数和报价不符`);
  assert.equal(closed.outcome.total, quote.total, `${id} 的成交金额和报价不符`);
  assert.equal(closed.outcome.minutes, quote.minutes, `${id} 占用的时间和报价不符`);
  assert.equal(closed.campaign.activeSession, null);
  return { campaign: parseCampaign(JSON.stringify(closed.campaign))!, outcome: closed.outcome, transferred };
}

export type RouteResult = { final: Campaign; dayTotals: number[]; served: number; lost: CustomerId[]; pulled: number; transferred: ProductId[] };

// 每天按现场顺序接完所有还能接的顾客，然后处理闭店事件。
// roster=true 走的是"把私域也做掉"的那条线：现场先留小样、再要微信（各占一分钟），
// 闭店事件之后按当晚顺序跟两句。加粉烧掉的是别人的耐心，所以这条线要拿柜台上的人换。
// pull=true 是"只要有人开始看表就迎上去"：一支小样加离柜两分钟，救回一个的同时把另一个推向门口。
// transfer 是"盯着抽屉的人"：她这一单正要被削的那一刻才打电话（罗曼走系统单 3 分钟，唐可私下拿 2 分钟但台账上什么都没有）。
// transferWhen 用来单独量"在哪些缺口上开口"这件事值多少钱，默认每个缺口都打。
// start 换的是柜台开局的那副牌：默认是第 1 天那一批货，传一份整周配货进来就是"配货一次性给到"的反事实。
// overAsk 量的是误读连带那一排的代价：件数已经被削到和便宜档一样时，仍然按最贵的那一档。
// check 量的是开店前那一遍自查：两支到期小样当场下架、晚开门一分钟，换来台账上那条处理记录。
// onEvening 拿的是"当晚全部结算完、还没滚到第二天"的那一刻：UI 探针要按「进入下一天」走进真实那一早，
// 告示排第几、被不被钉住的脚压住，得用真跑出来的那副牌，不能手捏数字。
export function runRoute(bundle: BundleId | "matched" = "matched", faceTrial = false, roster = false, pull = false, transfer: TransferChannel | null = null, transferWhen?: (day: number, product: ProductId, clip: number) => boolean, start?: Campaign, overAsk = false, check = false, onEvening?: (settled: Campaign, nextDay: number) => void): RouteResult {
  let s = openFloorState(start ?? INITIAL);
  const dayTotals: number[] = [];
  const lost: CustomerId[] = [];
  let served = 0;
  let pulled = 0;
  const transferred: ProductId[] = [];
  const tiers = Object.keys(BUNDLES) as BundleId[];
  for (let day = 1; day <= 5; day += 1) {
    assert.equal(s.day, day);
    if (check && canCheckCounter(s)) {
      const before = s.samples;
      s = checkCounter(s);
      assert.ok(before > s.samples && expiredCleared(s), "查这一遍至少该下一支、并且在台账上留下记录");
    }
    for (const id of [...availableCustomers(s)]) {
      // 接待别人期间她可能已经走了； greedy 路线就是在赌这个。
      if (!availableCustomers(s).includes(id)) continue;
      if (pull) for (const waiting of [...availableCustomers(s)]) {
        if (!canPullOver(s, waiting)) continue;
        s = pullOver(s, waiting);
        pulled += 1;
      }
      if (roster && s.samples > 0 && !s.members.includes(id)) {
        s = leaveSample(s, id);
        if (canAddMember(s, id)) s = addMember(s, id);
      }
      // 缺几件按报价单上同一个 wanted 算：这一位要几件、柜上还有几支，和玩家看到的是同一句话。
      const target = bestFit(id);
      const own = bundle === "matched" ? matchedBundle(id, target) : bundle;
      let play = own;
      if (overAsk && fitOf(CUSTOMERS[id], target).tier !== "negative") {
        const left = s.stock[target];
        const units = unitsWanted(CUSTOMERS[id], target, own, fitOf(CUSTOMERS[id], target).tier, left);
        const higher = tiers.filter(t => BUNDLES[t].units > BUNDLES[own].units && unitsWanted(CUSTOMERS[id], target, t, fitOf(CUSTOMERS[id], target).tier, left) === units);
        if (higher.length) play = higher.sort((a, b) => BUNDLES[b].units - BUNDLES[a].units)[0];
      }
      const quote = orderQuote(id, target, play, false, s.stock[target]);
      const clip = quote.wanted - quote.units;
      const played = playCustomer(s, id, {
        bundle: play, faceTrial,
        transfer: transfer && clip > 0 && (!transferWhen || transferWhen(day, target, clip)) ? transfer : undefined,
      });
      s = played.campaign;
      if (played.transferred) transferred.push(played.transferred);
      served += played.outcome.units > 0 ? 1 : 0;
    }
    const event = dayEvent(s);
    const choice = event.choices.find(option => option.id === CLEAN_EVENTS[day - 1]) ?? event.choices[0];
    s = settleDayEvent(s, choice.id);
    if (roster) for (const thread of touchThreads(s).slice(0, TOUCHES_PER_EVENING)) s = applyTouch(s, thread.id);
    dayTotals.push(s.sales);
    lost.push(...s.lost);
    if (day < 5) onEvening?.(s, day + 1);
    s = startNextDay(s);
  }
  assert.equal(s.finished, true);
  return { final: s, dayTotals, served, lost, pulled, transferred };
}

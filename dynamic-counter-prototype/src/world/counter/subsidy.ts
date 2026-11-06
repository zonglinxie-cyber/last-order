import { PRODUCTS, TRAIT_LABELS } from "./content.ts";
import type { Experiment, Opportunity, Run } from "./types.ts";

export const SUBSIDY_EXPERIMENT = "fit-subsidy-v1" satisfies Experiment;
export const SUBSIDY_SAVE_KEY = "last-order.counter.run.fit-subsidy-v1";
export const SUBSIDY_META_KEY = "last-order.counter.profile.fit-subsidy-v1";
export const SUBSIDY_DAYS = [3, 5, 7] as const;
export const SUBSIDY_AMOUNT = 30;

export function subsidyForDay(seed: string, day: number): Run["subsidy"] {
  if (!SUBSIDY_DAYS.some(d => d === day)) return undefined;
  // Separate seed stream: never consume run.rng or inspect today's customers.
  const input = JSON.stringify([SUBSIDY_EXPERIMENT, seed, day]);
  let value = 2166136261;
  for (let i = 0; i < input.length; i++) value = Math.imul(value ^ input.charCodeAt(i), 16777619);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  const index = Math.floor(((value ^ (value >>> 16)) >>> 0) / 4294967296 * PRODUCTS.length);
  return { day, productId: PRODUCTS[index]!.id, amount: SUBSIDY_AMOUNT, claimedBy: null };
}

// Settlement and a newly paid trial may use actual needs; previews only use public evidence.
export function actualSubsidyEligibility(
  op: Pick<Opportunity, "primary" | "secondary" | "wanted">, productId: string | null,
): { eligible: boolean; reason: string } {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return { eligible: false, reason: "未选择有效商品。" };
  const primary = product.traits[op.primary], secondary = product.traits[op.secondary];
  const failures: string[] = [];
  if (primary < op.wanted) failures.push(`主需求${TRAIT_LABELS[op.primary]}能力 ${primary} 未达 ${op.wanted}`);
  if (secondary < 1) failures.push(`次需求${TRAIT_LABELS[op.secondary]}能力 ${secondary} 未达 1`);
  return failures.length ?
    { eligible: false, reason: `${failures.join("；")}；倾听和试用说服加分不能替代商品能力。` } :
    { eligible: true, reason: `商品主需求${TRAIT_LABELS[op.primary]}能力 ${primary} ≥ ${op.wanted}，次需求${TRAIT_LABELS[op.secondary]}能力 ${secondary} ≥ 1。` };
}

export type SubsidyPreview = {
  status: "inactive" | "used" | "choose" | "unknown" | "eligible" | "ineligible";
  amount: number;
  reason: string;
};

// amount is the offer's face value (0 when inactive), not a prediction of income.
export function publicSubsidyPreview(run: Run, productId: string | null = run.active?.product ?? null): SubsidyPreview {
  const subsidy = run.subsidy;
  if (run.experiment !== SUBSIDY_EXPERIMENT || !subsidy || subsidy.day !== run.day) {
    return { status: "inactive", amount: 0, reason: "今日无适配补贴，普通成交照常。" };
  }
  const amount = subsidy.amount;
  if (subsidy.claimedBy !== null) return { status: "used", amount, reason: "今日这一份供货补贴已领取；所有商品仍可正常成交。" };
  if (productId === null) return { status: "choose", amount, reason: "选品后可查看补贴条件；不要求选择补贴商品。" };
  if (productId !== subsidy.productId) return { status: "ineligible", amount, reason: "所选商品不是今日补贴商品；仍可按普通规则成交。" };
  const deal = run.active;
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return { status: "ineligible", amount, reason: "未选择有效商品。" };
  const caveat = "仅判断补贴的商品能力条件，不保证预算或成交；仍须正常成交才可领取。";
  // Keep the paid conclusion stable across reloads/content changes. Legacy trials without
  // a snapshot reveal nothing extra here; never reconstruct their evidence from hidden needs.
  const evidence = deal?.subsidyEvidence?.[productId];
  if (deal && productId === deal.product && deal.tried.includes(productId) && typeof evidence === "boolean") {
    const reason = evidence ? "记录的主次需求商品能力达到补贴标准。" : "记录的主次需求商品能力未同时达到补贴标准；倾听和试用说服加分不能替代商品能力。";
    return { status: evidence ? "eligible" : "ineligible", amount, reason: `最终商品的付费试用结果：${reason}${caveat}` };
  }
  if (deal && deal.known.length === 2) {
    const result = actualSubsidyEligibility({ primary: deal.known[0]!, secondary: deal.known[1]!, wanted: deal.opportunity.wanted }, productId);
    return { status: result.eligible ? "eligible" : "ineligible", amount, reason: `已确认两条需求：${result.reason}${caveat}` };
  }
  if (deal && deal.known.length === 1 && product.traits[deal.known[0]!] < deal.opportunity.wanted) {
    return { status: "ineligible", amount, reason: `已知主需求${TRAIT_LABELS[deal.known[0]!]}能力 ${product.traits[deal.known[0]!]} 未达 ${deal.opportunity.wanted}；倾听和试用说服加分不能替代商品能力。` };
  }
  return { status: "unknown", amount, reason: `需求信息不足，尚不能判断主次需求能力是否够用。${caveat}` };
}

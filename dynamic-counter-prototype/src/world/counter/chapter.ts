import { PRODUCTS } from "./content.ts";
import type { ChapterPlan, CounterChapter, DealSupport, InventoryChoice, Receipt, Run, ShowcaseFormat } from "./types.ts";

// Public chapter preset, not another simulated run: feather 598−268+30, nest 458−198; both fit ≥8/full price.
export const TANGKE_BID = { score: 6, profit: 620 } as const;
const chapterOf = (run: Run) => run.experiment ? undefined : run.chapter;

export function createChapter(seed: string): CounterChapter {
  // A namespaced seed hash; neither the sales RNG nor hidden customer data participates.
  const input = JSON.stringify(["counter-chapter-v1", seed]);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return {
    version: 1, bookings: [], supportDays: [],
    gifts: { stock: 2, cause: ((hash ^ (hash >>> 16)) & 1) === 0 ? "transfer" : "taken", opened: false, recovered: false, expense: 0 },
  };
}

export function chooseChapterPlan(run: Run, plan: ChapterPlan): Run {
  const chapter = chapterOf(run);
  if (!chapter || run.day !== 1 || run.phase !== "draft" || chapter.plan !== undefined ||
    (plan !== "solo" && plan !== "team")) return run;
  const next = structuredClone(run);
  next.chapter!.plan = plan;
  return next;
}

export function preparationBlocked(run: Run): boolean {
  return run.day === 4 && chapterOf(run)?.gifts.choice === "trace";
}

export function bookCustomer(run: Run, id: string): Run {
  const chapter = chapterOf(run);
  if (!chapter || chapter.plan !== "solo" || run.day < 2 || run.day > 5 || run.phase !== "select" || run.turn !== 0 ||
    preparationBlocked(run) || chapter.bookings.some(booking => booking.day === run.day)) return run;
  const opportunity = run.board.find(op => op.id === id);
  if (!opportunity) return run;
  const next = structuredClone(run);
  next.chapter!.bookings.push({ day: run.day, opportunityId: id, budget: opportunity.budget });
  return next;
}

export function supportKind(run: Run): DealSupport["kind"] | null {
  const chapter = chapterOf(run), deal = run.active;
  if (!chapter || run.phase !== "deal" || !deal || !deal.product || deal.support || run.samples <= 0 ||
    chapter.supportDays.includes(run.day) || deal.tried.includes(deal.product) || !PRODUCTS.some(p => p.id === deal.product)) return null;
  // The teammate can still act after the player's own conversation patience is exhausted.
  if (chapter.plan === "team" && run.day >= 2 && run.day <= 5 && !preparationBlocked(run)) return "team";
  if (run.day >= 6 && run.day <= 7 && chapter.award?.won && chapter.format === "demo") return "demo";
  return null;
}

export function setGift(run: Run, enabled: boolean): Run {
  const chapter = chapterOf(run), deal = run.active;
  if (!chapter || run.phase !== "deal" || !deal || run.day < 4 || run.day > 7 || typeof enabled !== "boolean" ||
    (enabled && chapter.gifts.stock <= 0) || (enabled ? deal.gift === true : deal.gift === undefined)) return run;
  const next = structuredClone(run);
  if (enabled) next.active!.gift = true;
  else delete next.active!.gift;
  return next;
}

export function chooseInventory(run: Run, choice: InventoryChoice): Run {
  const chapter = chapterOf(run);
  if (!chapter || run.day !== 3 || run.phase !== "draft" || !chapter.gifts.opened || chapter.gifts.choice !== undefined ||
    (choice !== "trace" && choice !== "replace" && choice !== "report") || (choice === "replace" && run.money < 60)) return run;
  const next = structuredClone(run), gifts = next.chapter!.gifts;
  gifts.choice = choice;
  if (choice === "replace") {
    next.money -= 60;
    gifts.stock += 2;
    gifts.expense = 60;
  }
  return next;
}

// These two hooks mutate only the fresh clone supplied by the engine.
export function openInventory(run: Run): void {
  const chapter = chapterOf(run);
  if (!chapter || run.day !== 3 || run.phase !== "draft" || chapter.gifts.opened) return;
  chapter.gifts.stock -= 2;
  chapter.gifts.opened = true;
}

export function advanceChapter(run: Run): void {
  const chapter = chapterOf(run);
  if (!chapter) return;
  const gifts = chapter.gifts;
  const recoveryDay = gifts.choice === "trace" ? (gifts.cause === "transfer" ? 4 : 5) : 6;
  if (gifts.opened && !gifts.recovered && run.day >= recoveryDay) {
    gifts.recovered = true;
    gifts.stock += 2;
  }
  if (run.day === 6 && !chapter.award) {
    const { won, score, profit, receipts } = chapterBid(run);
    chapter.award = { won, score, profit, receiptIds: receipts.map(receipt => receipt.id) };
  }
}

const receiptScore = (receipt: Receipt) => 1 + Number(receipt.fit >= 8) + Number(receipt.discount === 0);

export function chapterBid(run: Run): { score: number; profit: number; receipts: Receipt[]; won: boolean } {
  // Stable sort preserves history order when both points and personal net profit tie.
  const receipts = run.history.filter(receipt => receipt.day >= 2 && receipt.day <= 5 && receipt.outcome === "sold")
    .sort((a, b) => receiptScore(b) - receiptScore(a) || b.profit - a.profit).slice(0, 2);
  const score = receipts.reduce((sum, receipt) => sum + receiptScore(receipt), 0);
  const profit = receipts.reduce((sum, receipt) => sum + receipt.profit, 0);
  const won = receipts.length === 2 && (score > TANGKE_BID.score || (score === TANGKE_BID.score && profit > TANGKE_BID.profit));
  return { score, profit, receipts, won };
}

export function chooseShowcaseFormat(run: Run, format: ShowcaseFormat): Run {
  const chapter = chapterOf(run);
  if (!chapter || run.day !== 6 || run.phase !== "select" || run.turn !== 0 || !chapter.award?.won || chapter.format !== undefined ||
    (format !== "consult" && format !== "demo")) return run;
  const next = structuredClone(run);
  next.chapter!.format = format;
  return next;
}

type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 160;
const unique = (v: unknown[]) => new Set(v).size === v.length;
function keys(v: Obj, required: string, optional = ""): boolean {
  const mandatory = required.split(" "), allowed = [...mandatory, ...optional.split(" ").filter(Boolean)];
  return mandatory.every(key => Object.hasOwn(v, key)) && Object.keys(v).every(key => allowed.includes(key));
}

export function validChapter(v: unknown): v is CounterChapter {
  if (!object(v) || !keys(v, "version bookings supportDays gifts", "plan award format") || v.version !== 1 ||
    (Object.hasOwn(v, "plan") && v.plan !== "solo" && v.plan !== "team")) return false;
  if (!Array.isArray(v.bookings) || v.bookings.length > 4 || !v.bookings.every(booking =>
    object(booking) && keys(booking, "day opportunityId budget") && integer(booking.day, 2, 5) &&
    id(booking.opportunityId) && integer(booking.budget, 0, 10000)) || !unique(v.bookings.map(booking => booking.day))) return false;
  if (!Array.isArray(v.supportDays) || v.supportDays.length > 6 || !v.supportDays.every(day => integer(day, 2, 7)) || !unique(v.supportDays)) return false;
  const gifts = v.gifts;
  if (!object(gifts) || !keys(gifts, "stock cause opened recovered expense", "choice") || !integer(gifts.stock, 0, 4) ||
    (gifts.cause !== "transfer" && gifts.cause !== "taken") || typeof gifts.opened !== "boolean" || typeof gifts.recovered !== "boolean" ||
    (gifts.expense !== 0 && gifts.expense !== 60) ||
    (Object.hasOwn(gifts, "choice") && gifts.choice !== "trace" && gifts.choice !== "replace" && gifts.choice !== "report")) return false;
  if ((!gifts.opened && (gifts.recovered || Object.hasOwn(gifts, "choice"))) || gifts.expense !== (gifts.choice === "replace" ? 60 : 0)) return false;
  if (Object.hasOwn(v, "award")) {
    const award = v.award;
    if (!object(award) || !keys(award, "won score profit receiptIds") || typeof award.won !== "boolean" ||
      !integer(award.profit, 0, 20000) || !Array.isArray(award.receiptIds) || award.receiptIds.length > 2 ||
      !award.receiptIds.every(id) || !unique(award.receiptIds) ||
      !integer(award.score, award.receiptIds.length, award.receiptIds.length * 3) || (award.won && award.receiptIds.length !== 2)) return false;
  }
  // Saved snapshots stay authoritative: no cause rehashing, receipt replay, or award recomparison.
  return !Object.hasOwn(v, "format") || ((v.format === "consult" || v.format === "demo") && object(v.award) && v.award.won === true);
}

export type Trait = "light" | "wear" | "calm" | "repair";
export type StyleId = "reader" | "friend" | "closer";
export type Discount = 0 | 10 | 20;
export type Experiment = "fit-subsidy-v1";
export type Phase = "select" | "deal" | "receipt" | "draft" | "result";
export type Action = "ask-need" | "ask-budget" | "listen" | "trial";

export type Product = {
  id: string; name: string; kind: string; price: number; cost: number;
  traits: Record<Trait, number>; color: string; note: string;
};
export type CustomerScene = {
  id: string; label: string; primary: Trait; secondary: Trait; budget: number;
  opening: string; story: string;
};
export type Customer = {
  id: string; name: string; role: string; portrait: string;
  primary: Trait; secondary: Trait; budget: number;
  opening: string; story: string; returnLine: string; scenes: CustomerScene[];
};
export type Perk = {
  id: string; name: string; category: "洞察" | "客情" | "成交";
  icon: string; description: string;
};
export type League = {
  id: number; name: string; rival: string; subtitle: string;
  rule: string; color: string;
};
export type Style = { id: StyleId; name: string; description: string; perk: string; icon: string };
export type Opportunity = {
  id: string; customerId: string; primary: Trait; secondary: Trait;
  budget: number; budgetLow: number; budgetHigh: number;
  wanted: number; rivalValue: number; returning: boolean;
  occasion: string; opening: string;
  sceneId?: string; story?: string;
};
export type ConversationLine = { speaker: "you" | "customer"; text: string };
export type ColleagueChat = { choice: "review" | "own"; reply: string; nextMorning: string };
export type ChapterPlan = "solo" | "team";
export type InventoryChoice = "trace" | "replace" | "report";
export type ShowcaseFormat = "consult" | "demo";
export type CounterChapter = {
  version: 1;
  plan?: ChapterPlan;
  bookings: { day: number; opportunityId: string; budget: number }[];
  supportDays: number[];
  gifts: { stock: number; cause: "transfer" | "taken"; opened: boolean; choice?: InventoryChoice; recovered: boolean; expense: number };
  award?: { won: boolean; score: number; profit: number; receiptIds: string[] };
  format?: ShowcaseFormat;
};
export type DealSupport = { kind: "team" | "demo"; productId: string };
export type Deal = {
  opportunity: Opportunity; patience: number; maxPatience: number;
  known: Trait[]; budgetKnown: boolean; listened: boolean;
  tried: string[]; trialNotes: Record<string, string>;
  subsidyEvidence?: Record<string, boolean>;
  product: string | null; discount: Discount; lines: string[];
  conversation?: ConversationLine[];
  support?: DealSupport;
  gift?: boolean;
};
export type Receipt = {
  id: string; day: number; customerId: string; productId: string | null;
  outcome: "sold" | "lost" | "leave"; profit: number; revenue: number;
  fit: number; discount: Discount; relationDelta: number; reputationDelta: number;
  rivalGain: number; headline: string; explanation: string; lesson: string;
  breakdown: string[]; quote: string; returning: boolean;
  subsidy?: number;
  support?: DealSupport & { grossProfit: number; partnerShare: number };
  gift?: boolean;
};
export type CustomerVisit = { count: number; lastDay: number; sceneId: string };
export type Run = {
  version: 1; seed: string; rng: number; rank: number; style: StyleId;
  phase: Phase; day: number; turn: number; money: number; rivalMoney: number;
  reputation: number; samples: number; perks: string[];
  relations: Record<string, number>; visitLog: Record<string, CustomerVisit>; board: Opportunity[];
  active: Deal | null; receipt: Receipt | null; draft: string[];
  history: Receipt[]; dayRival: number;
  colleagueChat?: ColleagueChat;
  chapter?: CounterChapter;
  experiment?: Experiment;
  subsidy?: { day: number; productId: string; amount: number; claimedBy: string | null };
};
export type RunResult = {
  won: boolean; title: string; reason: string; lesson: string;
  sales: number; returningSales: number; perfectSales: number;
};
export type Profile = {
  version: 1; unlocked: number; wins: number; runs: number;
  best: Record<string, number>; recorded: string[];
};

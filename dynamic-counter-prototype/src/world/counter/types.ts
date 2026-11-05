export type Trait = "light" | "wear" | "calm" | "repair";
export type StyleId = "reader" | "friend" | "closer";
export type Discount = 0 | 10 | 20;
export type Phase = "select" | "deal" | "receipt" | "draft" | "result";
export type Action = "ask-need" | "ask-budget" | "listen" | "trial";

export type Product = {
  id: string; name: string; kind: string; price: number; cost: number;
  traits: Record<Trait, number>; color: string; note: string;
};
export type Customer = {
  id: string; name: string; role: string; portrait: string;
  primary: Trait; secondary: Trait; budget: number;
  opening: string; story: string; returnLine: string;
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
};
export type Deal = {
  opportunity: Opportunity; patience: number; maxPatience: number;
  known: Trait[]; budgetKnown: boolean; listened: boolean;
  tried: string[]; trialNotes: Record<string, string>;
  product: string | null; discount: Discount; lines: string[];
};
export type Receipt = {
  id: string; day: number; customerId: string; productId: string | null;
  outcome: "sold" | "lost" | "leave"; profit: number; revenue: number;
  fit: number; discount: Discount; relationDelta: number; reputationDelta: number;
  rivalGain: number; headline: string; explanation: string; lesson: string;
  breakdown: string[]; quote: string; returning: boolean;
};
export type Run = {
  version: 1; seed: string; rng: number; rank: number; style: StyleId;
  phase: Phase; day: number; turn: number; money: number; rivalMoney: number;
  reputation: number; samples: number; perks: string[];
  relations: Record<string, number>; board: Opportunity[];
  active: Deal | null; receipt: Receipt | null; draft: string[];
  history: Receipt[]; dayRival: number;
};
export type RunResult = {
  won: boolean; title: string; reason: string; lesson: string;
  sales: number; returningSales: number; perfectSales: number;
};
export type Profile = {
  version: 1; unlocked: number; wins: number; runs: number;
  best: Record<string, number>; recorded: string[];
};

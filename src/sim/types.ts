export type StaffId = "xuyuan" | "luyao" | "roman" | "suman" | "tangke" | "fangmin";
export type CustomerId = "shen" | "mei" | "xiaoyu" | "zhao" | "anjie" | "returning" | "zhou" | "duan" | "zhou2";
export type ActorId = StaffId | CustomerId;
export type ProductId = "soft" | "glow" | "repair";
export type Fit = "good" | "poor" | "push";
export type Speed = 0 | 1 | 2 | 4;
export type CustomerStatus = "entering" | "waiting" | "serving" | "sold" | "lost" | "refund";

export type Actor = {
  id: ActorId;
  kind: "staff" | "customer";
  name: string;
  role: string;
  art: string;
  portrait: string;
  home: string;
  goal: string;
  x: number;
  y: number;
  destX: number;
  destY: number;
  path: string[];
  facing: 1 | -1;
  label: string;
  speech: string;
  speechLeft: number;
  patience: number;
  maxPatience: number;
  status: CustomerStatus;
  rival: boolean;
  need: string;
  opening: string;
  bestProduct: ProductId | null;
  sale: number;
  wrongSale: number;
  cluePool: string[];
  clues: string[];
  fits: Record<ProductId, Fit> | null;
  tried: ProductId[];
  threatLeft: number;
  refund: number;
  gifted: boolean;
  held: number;
  away: number;
};

export type StaffAct = { id: string; label: string; detail: string };

export type Product = { id: ProductId; short: string; name: string; price: number; note: string };

export type HistoryEntry = { day: number; text: string };

export type TomorrowPlan = {
  extra?: CustomerId;
  luyaoDelay?: number;
  giftsDelta?: number;
  helper?: "suman" | "tangke" | null;
};

export type CloseChoice = { id: string; label: string; detail: string; result: string; tomorrow?: TomorrowPlan };

export type CloseEvent = {
  speaker: StaffId | CustomerId;
  title: string;
  body: string;
  choices: CloseChoice[];
};

export type SimLog = { id: string; clock: string; title: string; detail: string };

export type Snapshot = {
  day: number;
  title: string;
  clock: string;
  phase: string;
  speed: Speed;
  sales: number;
  daySales: number;
  target: number;
  selectedId: ActorId;
  servingId: CustomerId | null;
  orderId: ActorId | null;
  huntId: CustomerId | null;
  probeLeft: number;
  gifts: number;
  tonight: number;
  kept: number;
  queued: number;
  huddleLeft: number;
  claimId: CustomerId | null;
  acts: StaffAct[];
  rushOver: boolean;
  close: CloseEvent | null;
  closePicked: CloseChoice | null;
  finale: boolean;
  logs: SimLog[];
  history: HistoryEntry[];
  actors: Actor[];
};

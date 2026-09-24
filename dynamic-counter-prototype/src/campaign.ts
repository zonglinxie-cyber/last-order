export type ProductId = "soft" | "glow" | "repair";
export type CueId = "eyes" | "cheek" | "nose";
export type Trait = "natural" | "correct" | "soothe" | "steady" | "wear";
export type BundleId = "single" | "pair" | "set" | "bulk";
export type CustomerId = "shen" | "mei" | "xiaoyu" | "zhao" | "anjie" | "returning" | "zhou" | "duan" | "zhou2" | "anjie2";
export type RivalChoice = "record" | "clarify" | "yield";
export type StaffKey = "player" | "luyao" | "roman" | "suman" | "tangke" | "fangmin";
export type HistoryEntry = { day: number; text: string };

export type ChatLine = { role: "player" | "customer"; text: string };
export type OrderRecord = { day: number; customerId: CustomerId; product: ProductId; units: number; total: number; amount: number; shared: boolean; risky: boolean };

export type CustomerSession = {
  customerId: CustomerId;
  discovered: CueId[];
  askedQuestion: number | null;
  selectedProduct: ProductId | null;
  bundle: BundleId;
  revealed: Trait[];
  tested: boolean;
  reaction: "positive" | "mixed" | "negative" | null;
  revisions: number;
  claimed: boolean;
  rivalChoice: RivalChoice | null;
  chat: ChatLine[];
};

export type Demand = { trait: Trait; want: 1 | 2; weight: 1 | 2 | 3 };

export type Customer = {
  id: CustomerId;
  name: string;
  descriptor: string;
  portrait: string;
  opening: string;
  need: string;
  demands: Demand[];
  veto?: { trait: Trait; below: number; note: string };
  budget: number;
  maxUnits: number;
  mapVariant: "young" | "mature";
  patience: number;
  lostLine: string;
  rival: boolean;
  cues: Record<CueId, { label: string; finding: string; reveals: Trait[] }>;
};

export type Campaign = {
  version: number;
  day: number;
  sales: number;
  daySales: number;
  trust: number;
  compliance: number;
  energy: number;
  samples: number;
  evidence: number;
  standing: number;
  relations: { suman: number; tangke: number; luyao: number; roman: number };
  flags: string[];
  members: CustomerId[];
  history: HistoryEntry[];
  dayServed: CustomerId[];
  lost: CustomerId[];
  eventDoneDays: number[];
  waitMeters: Partial<Record<CustomerId, number>>;
  activeSession: CustomerSession | null;
  shiftMinutes: number;
  floorSeconds: number;
  orders: OrderRecord[];
  finished: boolean;
};

export type EventChoice = {
  id: string;
  label: string;
  detail: string;
  result: string;
  visible?: (state: Campaign) => boolean;
  apply: (state: Campaign) => Campaign;
};

export type DayEvent = {
  speaker: string;
  speakerStaff: StaffKey | null;
  speakerCustomer: CustomerId | null;
  title: string;
  body: string;
  choices: EventChoice[];
};

export type DayStory = {
  day: number;
  title: string;
  subtitle: string;
  brief: string;
  threat: string;
  customers: CustomerId[];
};

export type SaleOutcome = { good: boolean; amount: number; total: number; units: number; minutes: number; tier: FitTier; shared: boolean; title: string; body: string };
export type DawnNotice = { speaker: string; body: string };

export const SAVE_KEY = "last-order-campaign-v1";
export const SAVE_VERSION = 4;
export const TARGET = 21_000;
export const ENERGY_LOCK = 18;
export const RIVAL_IDS: CustomerId[] = ["shen", "returning", "zhou"];
export const SAMPLE_RETURN_SALE = 620;
export const FLOOR_SECONDS_PER_ACTION = 20;
// 晨会念的是同一个数：五日目标拆成每天的进度，不另开一块记分牌。
export const DAY_TARGETS = [2800, 3200, 3600, 4400, 7000];
// 柜位评分低于这条线，区域就开始写"评估是否保留"。
export const STANDING_RISK = 40;
export const MEMBER_MIN_FOR_CREDIT = 2;

export const INITIAL: Campaign = {
  version: SAVE_VERSION,
  day: 1, sales: 0, daySales: 0, trust: 50, compliance: 55, energy: 100, samples: 8, evidence: 0, standing: 50,
  relations: { suman: 50, tangke: 38, luyao: 35, roman: 45 }, flags: [], members: [], history: [], dayServed: [], lost: [], eventDoneDays: [],
  waitMeters: { shen: 8, mei: 8 }, activeSession: null,
  shiftMinutes: 0, floorSeconds: 0, orders: [], finished: false,
};

export const PRODUCT_TRAITS: Record<ProductId, Record<Trait, number>> = {
  soft: { natural: 2, correct: 1, soothe: 0, steady: 2, wear: 1 },
  glow: { natural: 0, correct: 2, soothe: 0, steady: 0, wear: 2 },
  repair: { natural: 0, correct: 1, soothe: 2, steady: 2, wear: 0 },
};

export const PRODUCTS: Record<ProductId, { name: string; short: string; price: number; note: string }> = {
  soft: { name: "云纱柔焦粉底", short: "柔焦", price: 980, note: "轻薄分区叠加，镜头近看更自然；带妆时间越长越需要补" },
  glow: { name: "鎏光持妆套组", price: 1280, short: "持妆", note: "高遮瑕，强灯光和长时间带妆才站得住；皮肤正不稳时会发干" },
  repair: { name: "夜兰修护精华", short: "修护", price: 1680, note: "舒缓干燥与泛红，见效不靠厚重遮盖；它是护肤，不是当天的妆" },
};

export const TRAIT_LABELS: Record<Trait, string> = {
  natural: "妆感要轻薄自然",
  correct: "要立刻看得出改善",
  soothe: "先把干燥泛红稳住",
  steady: "低风险，不刺激不闷痘",
  wear: "带妆一整天也不斑驳",
};

export const BUNDLES: Record<BundleId, { units: number; label: string; detail: string }> = {
  single: { units: 1, label: "一件", detail: "只带走这一件" },
  pair: { units: 2, label: "两件连带", detail: "日用配夜用" },
  set: { units: 3, label: "三件整套", detail: "客单更高，也更容易超出她的预算" },
  bulk: { units: 4, label: "批量追加", detail: "团队或婚礼用量，件数最高" },
};

export const POSITIVE_FIT = 0.78;
export const MIXED_FIT = 0.55;
export type FitTier = "positive" | "mixed" | "negative";

export function fitScore(customer: Customer, product: ProductId): number {
  const traits = PRODUCT_TRAITS[product];
  let got = 0, total = 0;
  for (const demand of customer.demands) {
    total += demand.weight;
    got += (Math.min(traits[demand.trait], demand.want) / demand.want) * demand.weight;
  }
  const base = total ? got / total : 0;
  return customer.veto && traits[customer.veto.trait] < customer.veto.below ? base * 0.35 : base;
}

export const fitTier = (score: number): FitTier =>
  score >= POSITIVE_FIT ? "positive" : score >= MIXED_FIT ? "mixed" : "negative";

export function fitOf(customer: Customer, product: ProductId) {
  const score = fitScore(customer, product);
  return { score, tier: fitTier(score) };
}

// 她愿意带走几件：判断越准越敢连带；勉强只拿一件，还要受预算和用量上限约束。
export function unitsWanted(customer: Customer, product: ProductId, bundle: BundleId, tier: FitTier) {
  if (tier === "negative") return 0;
  const asked = tier === "mixed" ? 1 : Math.min(BUNDLES[bundle].units, customer.maxUnits);
  return Math.max(0, Math.min(asked, Math.floor(customer.budget / PRODUCTS[product].price)));
}

// 强推不看她的预算：她当场把钱付了，退货风险才会记在你名下。
export const forcedUnits = (customer: Customer, bundle: BundleId) => Math.min(BUNDLES[bundle].units, customer.maxUnits);

// 只有被线索或提问揭示过的诉求才显示给玩家；未揭示的要求仍然参与真实适配度。
export function revealOf(customer: Customer, discovered: CueId[], revealed: Trait[]) {
  const out = new Set<Trait>(revealed);
  for (const cue of discovered) for (const trait of customer.cues[cue].reveals) out.add(trait);
  return out;
}

export function knownDemands(customer: Customer, traits: Set<Trait>) {
  return customer.demands.filter(demand => traits.has(demand.trait));
}

export function unknownDemands(customer: Customer, traits: Set<Trait>) {
  return customer.demands.filter(demand => !traits.has(demand.trait));
}

export const QUESTIONS: Record<CustomerId, Array<{ label: string; response: string; useful: boolean; reveals: Trait[] }>> = {
  shen: [{ label: "你最怕镜头看到什么？", response: "近看有粉感。不卡粉只是底线，我要像没化妆。", useful: true, reveals: ["natural"] }, { label: "预算大概多少？", response: "预算不是问题，别拿价格替代判断。", useful: false, reveals: [] }, { label: "要不要直接看套装？", response: "我刚说了不缺粉底。你也没听我说话？", useful: false, reveals: [] }],
  mei: [{ label: "明早最想改善哪里？", response: "眼下干、脸没精神，但我不想遮成一张面具。", useful: true, reveals: ["soothe"] }, { label: "预算能到两千吗？", response: "我只有十分钟，你先告诉我什么真的有用。", useful: false, reveals: [] }, { label: "平时用高遮瑕吗？", response: "几乎不用，越厚越显累。", useful: true, reveals: ["steady"] }],
  xiaoyu: [{ label: "预算里最不能牺牲什么？", response: "别闷痘。我宁愿少买，也不想面试前爆更多。", useful: true, reveals: ["steady"] }, { label: "要不要咬牙上套装？", response: "我说了只有一千。高端柜也不听预算吗？", useful: false, reveals: [] }, { label: "明天是什么场合？", response: "第一次正式面试，想精神，但不想像换了张脸。", useful: true, reveals: ["correct"] }],
  zhao: [{ label: "女儿用过什么会不舒服？", response: "她发了过敏成分截图，我差点忘了给你看。", useful: true, reveals: ["steady", "soothe"] }, { label: "您自己喜欢哪一款？", response: "不是我用。看我的脸没有用。", useful: false, reveals: [] }, { label: "礼物一定要显得贵吗？", response: "我怕的是送错，不是看着不够贵。", useful: true, reveals: ["soothe"] }],
  anjie: [{ label: "婚礼前皮肤最近稳定吗？", response: "这两天突然泛红。越临近越不敢出错。", useful: true, reveals: ["soothe"] }, { label: "预算上限是多少？", response: "预算不是问题，出问题才是。", useful: false, reveals: [] }, { label: "要不要新品整套？", response: "苏蔓说你会判断，不是只会推套装。", useful: false, reveals: [] }],
  returning: [{ label: "昨天最满意哪一点？", response: "不是遮住了，是直播近看也没粉感。我要能稳定复现。", useful: true, reveals: ["natural"] }, { label: "团队预算能加吗？", response: "先证明效果稳定，再谈加预算。", useful: false, reveals: [] }, { label: "要不要直接按昨天开单？", response: "你如果连售后都不问，我为什么批量买？", useful: false, reveals: [] }],
  zhou: [{ label: "对面说的持妆你信吗？", response: "我怕下午暗沉斑驳。开会要拍照片，但不能看起来像换了一层皮。", useful: true, reveals: ["natural", "wear"] }, { label: "要不要直接上套组？", response: "我是来对比的，不是来被完成任务的。", useful: false, reveals: [] }, { label: "皮肤最近是不是发干？", response: "下午T区还出油，两颊已经紧了。你们怎么没人先问这个。", useful: true, reveals: ["steady"] }],
  duan: [{ label: "真的只是看看吗？", response: "室友过生日。我想买对，但我不想被说成好骗。", useful: true, reveals: ["natural"] }, { label: "要不要先领小样？", response: "中庭已经发过了。我缺的是判断，不是袋子。", useful: false, reveals: [] }, { label: "她皮肤和你像吗？", response: "她比我还容易闷痘。别推荐我自己都不敢用的。", useful: true, reveals: ["steady"] }],
  zhou2: [{ label: "昨天那款同事怎么说？", response: "她问有没有修护。我自己倒还想再确认会不会暗沉。", useful: true, reveals: ["soothe"] }, { label: "要不要直接按昨天开？", response: "昨天是我自己。今天是给同事带，别想当然。", useful: false, reveals: [] }, { label: "她最怕什么成分？", response: "香精。她上次用完一红就是这个。", useful: true, reveals: ["steady"] }],
  anjie2: [{ label: "今天几点开始化，几点能卸？", response: "早上六点化，敬完酒快十一点。中间没有化妆师跟着我，我不想一整天都在担心脸。", useful: true, reveals: ["wear"] }, { label: "宴会厅是什么灯？", response: "顶灯，加上一直闪的闪光灯。相册里那些婚礼照我不敢看第二遍。", useful: true, reveals: ["correct"] }, { label: "要不要按上周方案再拿一支修护？", response: "我今天不是来养皮肤的。今天我要的是化完妆以后站得住。", useful: false, reveals: [] }],
};

export const REACTIONS: Record<ProductId, { positive: string; mixed: string; negative: string }> = {
  soft: { positive: "她靠近镜子看了两秒，鼻翼没有结块。", mixed: "轻薄她认，可她说现在最急的不是妆感。", negative: "她摇头：这个方向解决不了我说的那件事。" },
  glow: { positive: "妆面立刻完整，她的目光停在镜子里。", mixed: "遮住了，可她摸着脸说有点绷。", negative: "她皱眉摸了摸脸：太厚，也有点绷。" },
  repair: { positive: "泛红缓下来，她第一次主动问起用法。", mixed: "肤感舒服，但没有回应她此刻最想解决的问题。", negative: "她说买了也治不了她要的那件事。" },
};

export const CUSTOMERS: Record<CustomerId, Customer> = {
  shen: {
    id: "shen", name: "沈薇", descriptor: "熟客博主 · 竞品也认识她", portrait: "/assets/game/customer-shen-consultation.png",
    opening: "先说好，我不缺粉底。要是又是品牌话术，我就去对面了。", need: "镜头近看不浮粉，补妆后也不能厚重",
    demands: [{ trait: "natural", want: 2, weight: 3 }, { trait: "steady", want: 1, weight: 2 }, { trait: "correct", want: 1, weight: 1 }],
    veto: { trait: "natural", below: 2, note: "一厚就卡粉，镜头里全是粉感" }, budget: 3200, maxUnits: 3, mapVariant: "young",
    patience: 8, lostLine: "陆遥带沈薇去了维珞", rival: true,
    cues: { eyes: { label: "眼下", finding: "已有薄薄卡纹，继续叠高遮瑕会显疲态。", reveals: ["natural"] }, cheek: { label: "脸颊", finding: "妆面基本完整，她真正介意的是镜头里的粉感。", reveals: ["natural"] }, nose: { label: "鼻翼", finding: "局部微红出油，需要轻薄分区处理。", reveals: ["steady"] } },
  },
  mei: {
    id: "mei", name: "梅女士", descriptor: "下班客 · 十分钟后离店", portrait: "/assets/game/customer-mei-consultation.png",
    opening: "我明早要见客户，脸看起来很累。别给我推荐一整套。", need: "快速改善干燥疲态，明早能直接用",
    demands: [{ trait: "soothe", want: 2, weight: 3 }, { trait: "steady", want: 1, weight: 2 }, { trait: "correct", want: 1, weight: 1 }],
    budget: 1800, maxUnits: 1, mapVariant: "mature",
    patience: 8, lostLine: "梅女士看了看表，已经赶去地铁", rival: false,
    cues: { eyes: { label: "眼下", finding: "干纹明显，厚粉底会让疲态更重。", reveals: ["soothe"] }, cheek: { label: "脸颊", finding: "缺水和光泽断层，修护打底比遮盖更重要。", reveals: ["soothe"] }, nose: { label: "鼻翼", finding: "没有明显出油，控油型产品会加重紧绷。", reveals: ["steady"] } },
  },
  xiaoyu: {
    id: "xiaoyu", name: "小雨", descriptor: "第一次买高端美妆 · 预算有限", portrait: "/assets/game/customer-xiaoyu-consultation.png",
    opening: "我只有一千块预算。最近爆痘，但明天面试想看起来精神一点。", need: "不刺激痘肌，在预算内改善气色",
    demands: [{ trait: "steady", want: 2, weight: 3 }, { trait: "natural", want: 1, weight: 2 }, { trait: "correct", want: 1, weight: 1 }],
    veto: { trait: "steady", below: 2, note: "活跃痘正在冒，闷一下就爆" }, budget: 1000, maxUnits: 1, mapVariant: "young",
    patience: 8, lostLine: "小雨被中庭的小样台叫走了", rival: false,
    cues: { eyes: { label: "眼下", finding: "睡眠不足带来暗沉，但不需要重度遮瑕。", reveals: ["natural"] }, cheek: { label: "脸颊", finding: "有活跃痘和轻微敏感，厚重持妆容易闷痘。", reveals: ["steady"] }, nose: { label: "鼻翼", finding: "T区出油、两颊不油，适合分区轻薄上妆。", reveals: ["steady"] } },
  },
  zhao: {
    id: "zhao", name: "赵女士", descriptor: "给女儿买礼物 · 不懂产品", portrait: "/assets/game/customer-zhao-consultation.png",
    opening: "我女儿总说脸红、用什么都刺。你别看我，东西是买给她的。", need: "为敏感肌女儿选低风险礼物，并保留退换余地",
    demands: [{ trait: "steady", want: 2, weight: 3 }, { trait: "soothe", want: 2, weight: 2 }],
    veto: { trait: "soothe", below: 2, note: "女儿对香精起反应，先要稳住" }, budget: 1800, maxUnits: 1, mapVariant: "mature",
    patience: 8, lostLine: "赵女士说再问问女儿，已经离开专柜", rival: false,
    cues: { eyes: { label: "神情", finding: "她一直看价签，不是不舍得，而是怕买错。", reveals: [] }, cheek: { label: "信息", finding: "观察她的皮肤不能代替询问女儿的使用史。", reveals: [] }, nose: { label: "细节", finding: "她手里有女儿发来的过敏成分截图。", reveals: ["steady"] } },
  },
  anjie: {
    id: "anjie", name: "安姐", descriptor: "婚前试妆 · 高价值老客", portrait: "/assets/game/customer-anjie-consultation.png",
    opening: "婚礼还有一周，我要一套绝对不出错的。预算不是问题。", need: "先稳定敏感泛红，再做轻薄婚礼妆；不能冒险换全套",
    demands: [{ trait: "soothe", want: 2, weight: 3 }, { trait: "steady", want: 2, weight: 2 }, { trait: "correct", want: 2, weight: 1 }],
    veto: { trait: "soothe", below: 2, note: "临婚前不能冒刺激风险" }, budget: 7000, maxUnits: 4, mapVariant: "young",
    patience: 10, lostLine: "安姐让苏蔓接手，这笔单离开了你", rival: false,
    cues: { eyes: { label: "眼下", finding: "焦虑和睡眠不足明显，当前状态不适合叠加新品。", reveals: ["soothe"] }, cheek: { label: "脸颊", finding: "双颊正在泛红，强持妆套组存在刺激风险。", reveals: ["soothe"] }, nose: { label: "表达", finding: "她强调“绝对不出错”，安全感比客单更重要。", reveals: ["steady"] } },
  },
  returning: {
    id: "returning", name: "沈薇", descriptor: "带着直播团队回来 · 最后一单", portrait: "/assets/game/customer-shen-consultation.png",
    opening: "昨天那次试妆直播间都在问。我要给团队订一批，但你得保证不是昙花一现。", need: "一整场直播稳定复现轻薄效果，并给出有记录的售后承诺",
    demands: [{ trait: "natural", want: 2, weight: 3 }, { trait: "steady", want: 2, weight: 2 }, { trait: "correct", want: 1, weight: 1 }, { trait: "wear", want: 1, weight: 1 }],
    veto: { trait: "steady", below: 1, note: "直播近景经不起厚妆" }, budget: 4200, maxUnits: 4, mapVariant: "young",
    patience: 10, lostLine: "沈薇说团队先去维珞看同款", rival: true,
    cues: { eyes: { label: "眼下", finding: "昨天的卡纹没有加重，说明轻薄方案有效。", reveals: ["natural"] }, cheek: { label: "反馈", finding: "妆面到现在还稳，她现在观察的是你是否守承诺。", reveals: ["natural", "wear"] }, nose: { label: "机会", finding: "订单来自信任复购，而不是一次高压推销。", reveals: ["steady"] } },
  },
  zhou: {
    id: "zhou", name: "周姐", descriptor: "对比维珞 · 只有二十分钟", portrait: "/assets/game/customer-zhou-consultation.png",
    opening: "对面说你们家持妆会暗沉。我开会要拍照，给我一个能站得住的理由。", need: "会议拍照不暗沉，但不能厚到像换了一层皮",
    demands: [{ trait: "natural", want: 2, weight: 2 }, { trait: "correct", want: 2, weight: 1 }, { trait: "steady", want: 2, weight: 2 }, { trait: "wear", want: 1, weight: 1 }],
    veto: { trait: "natural", below: 2, note: "不能厚到像换了一层皮" }, budget: 2100, maxUnits: 2, mapVariant: "young",
    patience: 8, lostLine: "陆遥用一盘试色把周姐接到了维珞", rival: true,
    cues: { eyes: { label: "眼下", finding: "细纹不多，真正的风险是下午两颊发干。", reveals: ["natural"] }, cheek: { label: "脸颊", finding: "底妆到下午就开始斑驳，可她一厚就显得假。", reveals: ["steady", "wear"] }, nose: { label: "鼻翼", finding: "T区微油，不适合整脸厚持妆。", reveals: ["steady"] } },
  },
  duan: {
    id: "duan", name: "段小姐", descriptor: "说只看小样 · 其实在买礼物", portrait: "/assets/game/customer-duan-consultation.png",
    opening: "我就是看看。不一定买。你们别围上来。", need: "给易闷痘的室友选对礼物，而不是把自己变成业绩",
    demands: [{ trait: "steady", want: 2, weight: 3 }, { trait: "natural", want: 2, weight: 2 }, { trait: "correct", want: 1, weight: 1 }],
    veto: { trait: "steady", below: 2, note: "室友比她更容易闷痘" }, budget: 1100, maxUnits: 1, mapVariant: "young",
    patience: 8, lostLine: "段小姐去中庭领了别的品牌小样", rival: false,
    cues: { eyes: { label: "眼神", finding: "她在看你，也在看有没有人准备强推。", reveals: [] }, cheek: { label: "皮肤", finding: "她自己并不敏感，但选品不能按她的脸来。", reveals: ["natural"] }, nose: { label: "手机", finding: "相册里是室友的过敏记录，不是她的自拍。", reveals: ["steady"] } },
  },
  zhou2: {
    id: "zhou2", name: "周姐", descriptor: "带着同事的需求回来", portrait: "/assets/game/customer-zhou-consultation.png",
    opening: "昨天那款我用了。同事问有没有修护，让我今天顺便看。", need: "给同事带低刺激修护，同时确认自己不会暗沉",
    demands: [{ trait: "steady", want: 2, weight: 3 }, { trait: "soothe", want: 2, weight: 2 }],
    veto: { trait: "soothe", below: 2, note: "同事一用香精就红" }, budget: 1800, maxUnits: 1, mapVariant: "young",
    patience: 9, lostLine: "周姐说同事先去对面问同款", rival: false,
    cues: { eyes: { label: "眼下", finding: "昨天的干纹没有加重，说明轻薄方案有效。", reveals: [] }, cheek: { label: "状态", finding: "她自己稳定，真正的新问题是同事的敏感。", reveals: ["soothe"] }, nose: { label: "清单", finding: "备忘录写着：无香精、要能退。", reveals: ["steady"] } },
  },
  // 她是全柜唯一把「持妆」当作正解的人，也是唯一被允许厚妆的人：前提是第 4 天先把她皮肤稳住。
  // 皮肤状态由 served:anjie:good 承担，所以她身上不设 veto——陷阱从"这一版她能不能承得住"变成"你有没有问她今天到底要什么"。
  anjie2: {
    id: "anjie2", name: "安姐", descriptor: "婚礼当天 · 她只信你的判断", portrait: "/assets/game/customer-anjie-consultation.png",
    opening: "婚礼在今晚。上周你让我先别叠新品，今天脸是稳的。现在我要的是从早上撑到敬酒。", need: "皮肤已经稳住，要带妆十几个小时、强灯光和闪光灯下依然完整的妆面",
    demands: [{ trait: "wear", want: 2, weight: 3 }, { trait: "correct", want: 2, weight: 2 }, { trait: "steady", want: 1, weight: 1 }],
    budget: 2600, maxUnits: 2, mapVariant: "young",
    patience: 10, lostLine: "安姐的化妆师提前到了，她只能走了", rival: false,
    cues: { eyes: { label: "眼下", finding: "上周的干纹平了，眼下不再卡粉。今天的问题不是皮肤。", reveals: ["steady"] }, cheek: { label: "脸颊", finding: "双颊不泛红，她现在承得住遮盖力强的底妆。", reveals: ["wear"] }, nose: { label: "灯光", finding: "她手机里是宴会厅的顶光和闪光灯照片，薄涂在那些照片里等于没化。", reveals: ["correct"] } },
  },
};

export const DAYS: DayStory[] = [
  { day: 1, title: "入口位", subtitle: "两个顾客，只能先抓住一个", brief: "新品活动晚高峰。陆遥盯上沈薇，梅女士又只剩十分钟。你第一次决定把黄金时间给谁。", threat: "选择会让另一边的机会继续流失", customers: ["shen", "mei"] },
  { day: 2, title: "新人价码", subtitle: "好服务不一定是高客单", brief: "小雨第一次买高端美妆，周姐同时在对比维珞。罗曼刚在晨会上说：今天谁的客单低于两千，谁留下复盘。", threat: "推对产品会低于柜长要求，推贵产品会超过顾客预算", customers: ["xiaoyu", "zhou"] },
  { day: 3, title: "不是买给自己", subtitle: "观察也会误导人", brief: "赵女士替女儿买礼物，段小姐说只看小样。同一时间总部群在催修护精华的新品数据。", threat: "销售技巧不能代替真正了解使用者", customers: ["zhao", "duan"] },
  { day: 4, title: "婚礼前一周", subtitle: "最大的一单，最脆弱的人", brief: "安姐是苏蔓维护三年的老客。她点名让你试妆。若你前两天接住了周姐，她会带着同事的需求回来。", threat: "高客单、老客归属、敏感风险同时出现", customers: ["anjie"] },
  { day: 5, title: "最后一单", subtitle: "复购、售后与盘点同时到来", brief: "区域经理提前巡店。沈薇带着直播团队回来下单，后仓却在查五天前的赠品缺口。若第 4 天你先稳住了安姐的皮肤，她会赶在化妆师之前回来要当天的妆。今天每条记录都会连起来。", threat: "成交只是开端；旧选择正在返回现场", customers: ["returning"] },
];

export const RIVAL_INTERRUPTIONS: Record<"shen" | "zhou" | "returning", { headline: string; quote: string }> = {
  shen: { headline: "陆遥靠到镜边", quote: "她之前用我们家的持妆款很满意。" },
  zhou: { headline: "陆遥把试色盘递过来", quote: "会议妆我们更熟。持妆拍照不会暗。" },
  returning: { headline: "陆遥拦在团队助理旁边", quote: "批量单我们也可以做售后。她昨天已经试过了。" },
};

const NEED_HINTS: Record<CustomerId, RegExp> = {
  shen: /镜头|粉感|近看|卡粉|自然|妆感|浮粉|补妆/,
  mei: /明早|眼下|干|疲|精神|修护|干燥|紧绷/,
  xiaoyu: /闷痘|痘|面试|刺激|一千|不能牺牲/,
  zhao: /女儿|过敏|成分|礼物|她用|不是我/,
  anjie: /婚礼|泛红|稳定|敏感|不出错|一周/,
  returning: /昨天|复现|直播|售后|稳定|团队/,
  zhou: /暗沉|拍照|会议|发干|对比|一层皮/,
  duan: /室友|礼物|闷痘|看看|过敏|好骗/,
  zhou2: /同事|香精|修护|昨天|退/,
  anjie2: /婚礼|今晚|撑|敬酒|化妆师|灯光|闪光灯|脱妆|掉|一整天|完整|稳定/,
};
const PUSH_HINTS = /套装|套组|贵的|最贵|成交|开单|直接买|业绩/;

export function inferUseful(customerId: CustomerId, text: string) {
  const message = text.trim();
  if (!message) return false;
  if (PUSH_HINTS.test(message) && !NEED_HINTS[customerId].test(message)) return false;
  if (NEED_HINTS[customerId].test(message)) return true;
  return QUESTIONS[customerId].some(question => question.useful && message.includes(question.label.slice(0, 6)));
}

export function fallbackReply(customerId: CustomerId, text: string, chipIndex: number | null, useful: boolean) {
  if (chipIndex != null) return QUESTIONS[customerId][chipIndex]?.response ?? CUSTOMERS[customerId].opening;
  if (useful) return QUESTIONS[customerId].find(question => question.useful)?.response ?? CUSTOMERS[customerId].need;
  if (/预算|多少钱|套装|套组/.test(text)) return QUESTIONS[customerId].find(question => !question.useful)?.response ?? "别拿价格替代判断。";
  return "你要是只想完成任务，我现在就可以走。";
}

type Payback = {
  id: CustomerId;
  resolve: string;
  fromDay: number;
  trust: number;
  compliance: number;
  relation?: { key: keyof Campaign["relations"]; delta: number };
  text: string;
  speaker: string;
  body: string;
};

// 旧存档可能没有逐笔记账。兜底金额从当前模型算出来：取她那个方向的一件最贵的，不再手写数字。
function estimatedOrderAmount(id: CustomerId, tier: FitTier): number {
  const prices = (Object.keys(PRODUCTS) as ProductId[])
    .filter(product => fitOf(CUSTOMERS[id], product).tier === tier)
    .map(product => PRODUCTS[product].price);
  return prices.length ? Math.max(...prices) : 0;
}

const estimatedRiskAmount = (id: CustomerId) => estimatedOrderAmount(id, "negative");

const RISKY_RETURNS: Payback[] = [
  { id: "shen", resolve: "shen-chargeback", fromDay: 3, trust: -8, compliance: -4, text: "沈薇退了那单持妆，说镜头里全是粉感", speaker: "退货 · 收银", body: "沈薇把持妆退了。她说近看全是粉，不会再帮你带货。" },
  { id: "mei", resolve: "mei-chargeback", fromDay: 3, trust: -6, compliance: -3, text: "梅女士客户会面翻车，客诉到专柜", speaker: "客诉 · 方敏", body: "梅女士说你卖的东西让她第二天更显疲态。客诉已记录。" },
  { id: "xiaoyu", resolve: "xiaoyu-chargeback", fromDay: 4, trust: -8, compliance: -4, text: "小雨面试前闷痘，妈妈来退货", speaker: "退货 · 收银", body: "小雨妈妈把那单退了。面试前爆痘的截图也在。" },
  { id: "zhou", resolve: "zhou-chargeback", fromDay: 4, trust: -6, compliance: -3, text: "周姐会议照片暗沉，她把对比发到了群里", speaker: "客诉 · 罗曼", body: "周姐把会议自拍发到了会员群。持妆暗沉的对比图还在。" },
  { id: "zhao", resolve: "zhao-forced-return", fromDay: 5, trust: -10, compliance: -6, text: "赵女士女儿用了你强推的套组，过敏退货", speaker: "退货 · 收银", body: "赵女士说你根本没问女儿。那套礼物已经退回后仓。" },
  { id: "duan", resolve: "duan-chargeback", fromDay: 5, trust: -8, compliance: -4, text: "段小姐室友过敏，礼物单被退回", speaker: "退货 · 收银", body: "段小姐说室友一用就红。礼物单从你名下划走了。" },
  { id: "anjie", resolve: "anjie-blew-up", fromDay: 5, trust: -14, compliance: -10, relation: { key: "suman", delta: -12 }, text: "安姐婚前爆红，苏蔓的三年老客炸了", speaker: "客诉 · 苏蔓", body: "安姐婚礼前双颊爆红。苏蔓三年的老客，因为你的强推套组进了客诉。" },
  { id: "zhou2", resolve: "zhou2-chargeback", fromDay: 5, trust: -6, compliance: -3, text: "周姐同事香精过敏，连带她也不再信你", speaker: "退货 · 收银", body: "周姐同事对香精过敏。她说昨天不该替你担保。" },
];

const SAMPLE_RETURNS: Array<{ id: CustomerId; resolve: string; fromDay: number; speaker: string; body: string; text: string }> = [
  { id: "shen", resolve: "sample-return:shen", fromDay: 2, speaker: "沈薇 · 微信", body: "你留的小样我用了。柔焦比昨天那支对。我先买一支自己的。", text: "沈薇用小样买回一单柔焦" },
  { id: "mei", resolve: "sample-return:mei", fromDay: 2, speaker: "梅女士 · 微信", body: "昨晚用了你给的小样，今天脸没那么紧。我过来补一单。", text: "梅女士凭小样回来补了一单" },
  { id: "xiaoyu", resolve: "sample-return:xiaoyu", fromDay: 3, speaker: "小雨 · 微信", body: "小样没有闷痘。面试前我只敢买你让我试过的。", text: "小雨凭小样回来买了对的那支" },
  { id: "zhou", resolve: "sample-return:zhou", fromDay: 3, speaker: "周姐 · 微信", body: "你留的小样下午没有暗。我按这个色号补了一单。", text: "周姐凭小样回来补了一单" },
  { id: "zhao", resolve: "sample-return:zhao", fromDay: 4, speaker: "赵女士 · 微信", body: "女儿用了小样，说这次不刺。我按你说的买了。", text: "赵女士凭小样为女儿补了一单" },
  { id: "duan", resolve: "sample-return:duan", fromDay: 4, speaker: "段小姐 · 微信", body: "室友用了小样没闷。生日礼物我还是找你买。", text: "段小姐凭小样回来买了对的礼物" },
  { id: "anjie", resolve: "sample-return:anjie", fromDay: 5, speaker: "安姐 · 微信", body: "你留的修护小样让泛红缓了。婚礼前我只信这个。", text: "安姐凭小样回来买了修护" },
  { id: "zhou2", resolve: "sample-return:zhou2", fromDay: 5, speaker: "周姐 · 微信", body: "同事用了无香精小样。她让我今天把单开了。", text: "周姐同事凭小样回来下了一单" },
];

export const clamp = (value: number) => Math.max(0, Math.min(100, value));
export const hasFlag = (s: Campaign, name: string) => s.flags.includes(name);
export const flag = (s: Campaign, name: string) => hasFlag(s, name) ? s.flags : [...s.flags, name];
export const history = (s: Campaign, item: string): HistoryEntry[] => [...s.history, { day: s.day, text: item }];
export const servedZhou = (s: Campaign) => hasFlag(s, "served:zhou:good") || hasFlag(s, "served:zhou:risky");
// 她回来要的是"当天的妆"，前提是第 4 天你按她的皮肤给了修护而不是硬推：被退掉的人不会再来找你要判断。
export const anjieComesBack = (s: Campaign) => s.day === 5 && hasFlag(s, "served:anjie:good");

export function floorCustomers(s: Campaign): CustomerId[] {
  const base = DAYS[s.day - 1]?.customers ?? [];
  if (s.day === 4 && servedZhou(s) && !hasFlag(s, "lost:zhou")) return [...base, "zhou2"];
  // 她约的是早上，排在沈薇前面：先接她不会把最后一天那一单的人耗到走。
  if (anjieComesBack(s)) return ["anjie2", ...base];
  return base;
}

export function metersFor(ids: CustomerId[], previous: Campaign["waitMeters"] = {}): Campaign["waitMeters"] {
  const next: Campaign["waitMeters"] = {};
  for (const id of ids) next[id] = previous[id] ?? CUSTOMERS[id].patience;
  return next;
}

function applyPayback(s: Campaign, item: Payback): Campaign {
  if (s.day < item.fromDay || !hasFlag(s, `served:${item.id}:risky`) || hasFlag(s, item.resolve)) return s;
  const relations = item.relation
    ? { ...s.relations, [item.relation.key]: s.relations[item.relation.key] + item.relation.delta }
    : s.relations;
  // Legacy v2 saves may lack orders; their transfer flags still constrain liability.
  const legacyShare = item.id === "xiaoyu" ? hasFlag(s, "tang-owes-order") ? 0 : hasFlag(s, "split-with-tang") ? .5 : 1 : 1;
  const charged = s.orders.find(order => order.customerId === item.id && order.risky)?.amount ?? estimatedRiskAmount(item.id) * legacyShare;
  return {
    ...s,
    sales: Math.max(0, s.sales - charged),
    daySales: s.daySales - charged,
    trust: clamp(s.trust + item.trust),
    compliance: clamp(s.compliance + item.compliance),
    relations,
    flags: flag(s, item.resolve),
    history: history(s, item.text),
  };
}

function applySampleReturn(s: Campaign, item: (typeof SAMPLE_RETURNS)[number]): Campaign {
  const refusedOrLost = hasFlag(s, `served:${item.id}:refused`) || hasFlag(s, `lost:${item.id}`);
  if (s.day < item.fromDay || !hasFlag(s, `sample:${item.id}`) || !refusedOrLost || hasFlag(s, item.resolve)) return s;
  return {
    ...s,
    sales: s.sales + SAMPLE_RETURN_SALE,
    daySales: s.daySales + SAMPLE_RETURN_SALE,
    trust: clamp(s.trust + 5),
    flags: flag(s, item.resolve),
    history: history(s, item.text),
  };
}

// 晨会念的是累计进度：到昨天为止这个柜位应该做到多少，账上实际有多少。
export const progressTarget = (throughDay: number) => DAY_TARGETS.slice(0, Math.max(0, Math.min(5, Math.trunc(throughDay)))).reduce((sum, value) => sum + value, 0);
const money = (value: number) => value.toLocaleString("zh-CN");
// 晨会看"到昨天为止"，闭店事件看"到今天为止"：同一份进度，两个时点。
export const thisWeekPercent = (s: Campaign) => { const need = progressTarget(s.day); return need ? Math.round(s.sales / need * 100) : 100; };

export type CounterReading = { key: string; speaker: string; body: string; text: string; standing: number; roman: number };

// 纯函数：只读当前状态、不写 flag，所以 dawnNotices 反复算出的都是同一句话。
export function morningReview(s: Campaign): CounterReading | null {
  if (s.day < 2) return null;
  const need = progressTarget(s.day - 1);
  const done = Math.round((need ? s.sales / need : 1) * 100);
  const base = { key: `morning:${s.day}`, speaker: "晨会 · 罗曼", standing: 0, roman: 0 };
  if (done >= 100) return { ...base, standing: 5, roman: 2, text: `晨会 · 累计达成 ${done}%，进度在你这边`, body: `罗曼念到累计 ${done}%：${money(need)} 的进度你超前了。区域周会上，她把这个柜位排在前面。` };
  if (done >= 80) return { ...base, text: `晨会 · 累计达成 ${done}%，差一点`, body: `罗曼没有点名：${money(need)} 的进度你做到 ${done}%，她说还差最后一天的量。` };
  return { ...base, standing: -8, roman: -3, text: `晨会 · 累计达成 ${done}%，区域开始问柜位`, body: `累计 ${money(need)} 你只做到 ${done}%。罗曼合上表格，说区域在问这个柜位还要不要留。` };
}

// 活动过半看名单，巡店当天看小样：这两项才是品牌真正在数的东西。
export function counterCheck(s: Campaign): CounterReading | null {
  if (s.day === 4) {
    if (s.members.length >= MEMBER_MIN_FOR_CREDIT) return { key: `roster:${s.day}`, speaker: "晨会 · 罗曼", standing: 4, roman: 3, text: `晨会 · 私域名单 ${s.members.length} 人`, body: `品牌在数企微名单，你手上有 ${s.members.length} 个。罗曼说这些人明年还在。` };
    if (!s.members.length) return { key: `roster:${s.day}`, speaker: "晨会 · 罗曼", standing: -4, roman: -2, text: "晨会 · 私域名单为空", body: "品牌在数企微名单，你一条都没加。罗曼只问了一句：那这些人以后找谁？" };
    return null;
  }
  if (s.day === 5) {
    if (s.samples >= 6) return { key: `sampling:${s.day}`, speaker: "巡店 · 派样数据", standing: -4, roman: 0, text: `巡店 · ${s.samples} 份小样没有派出去`, body: `后仓盘出你还压着 ${s.samples} 份小样。派样率是品牌看的数，没发出去的东西不算柜位的功劳。` };
    if (s.samples <= 2) return { key: `sampling:${s.day}`, speaker: "巡店 · 派样数据", standing: 3, roman: 0, text: "巡店 · 小样派得干净", body: "小样几乎发空了，领用记录一条条对得上。方敏说：这才是干活的样子。" };
  }
  return null;
}

function applyReading(s: Campaign, reading: CounterReading | null): Campaign {
  if (!reading || hasFlag(s, reading.key)) return s;
  return {
    ...s,
    standing: clamp(s.standing + reading.standing),
    relations: reading.roman ? { ...s.relations, roman: s.relations.roman + reading.roman } : s.relations,
    flags: flag(s, reading.key),
    history: history(s, reading.text),
  };
}

// 私域复购：加过粉、而且真在她那里成过单的人，会在最后一天自己在微信上补一支。
function applyMemberRepeat(s: Campaign): Campaign {
  if (s.day < 5) return s;
  let next = s;
  for (const id of next.members) {
    const order = next.orders.find(item => item.customerId === id && !item.risky);
    const guard = `member-repeat:${id}`;
    if (!order || hasFlag(next, guard)) continue;
    const amount = PRODUCTS[order.product].price;
    next = {
      ...next, sales: next.sales + amount, daySales: next.daySales + amount, trust: clamp(next.trust + 3),
      flags: flag(next, guard), history: history(next, `${CUSTOMERS[id].name}在微信上补了一支${PRODUCTS[order.product].short}`),
    };
  }
  return next;
}

export function applyDawn(s: Campaign): Campaign {
  let next = s;
  if (s.day === 4 && hasFlag(s, "tang-owes-order") && !hasFlag(s, "tang-paid-order")) {
    next = { ...next, sales: next.sales + 2080, daySales: next.daySales + 2080, flags: flag(next, "tang-paid-order"), history: history(next, "唐可把一单伴娘妆转到你名下") };
  }
  if (s.day === 5 && hasFlag(s, "protected-zhao") && !hasFlag(s, "zhao-daughter-order")) {
    next = { ...next, sales: next.sales + 1680, daySales: next.daySales + 1680, trust: clamp(next.trust + 6), flags: flag(next, "zhao-daughter-order"), history: history(next, "赵青加你微信，下了一单修护") };
  }
  if (s.day === 5 && hasFlag(s, "zhao-risk-sale") && !hasFlag(s, "zhao-complaint")) {
    next = { ...next, trust: clamp(next.trust - 10), compliance: clamp(next.compliance - 8), flags: flag(next, "zhao-complaint"), history: history(next, "赵女士女儿过敏，客诉已立案") };
  }
  if (s.day === 5 && hasFlag(s, "promise-zhao-return") && !hasFlag(s, "zhao-returned")) {
    // A forced order is already refunded by RISKY_RETURNS below.
    const charged = hasFlag(s, "served:zhao:risky") ? 0 : s.orders.find(order => order.customerId === "zhao")?.amount ?? estimatedOrderAmount("zhao", "positive");
    next = { ...next, sales: Math.max(0, next.sales - charged), daySales: next.daySales - charged, flags: flag(next, "zhao-returned"), history: history(next, "赵女士按承诺退了那单") };
  }
  // 她回来这件事要留在因果账本里，不能只算晨会念的一句话。
  if (s.day === 5 && hasFlag(s, "served:anjie:good") && !hasFlag(s, "anjie-came-back")) {
    next = { ...next, flags: flag(next, "anjie-came-back"), history: history(next, "安姐赶在化妆师之前回来，只要当天的妆") };
  }
  for (const item of RISKY_RETURNS) next = applyPayback(next, item);
  for (const item of SAMPLE_RETURNS) next = applySampleReturn(next, item);
  next = applyMemberRepeat(next);
  // 晨会读的是这一早晨已经落定的数字：补录、退货、私域复购都算在进度里。
  next = applyReading(next, morningReview(next));
  next = applyReading(next, counterCheck(next));
  return next;
}

export function applyFinale(s: Campaign): Campaign {
  if (!hasFlag(s, "served:returning:risky") || hasFlag(s, "returning-chargeback")) return s;
  const charged = s.orders.find(order => order.customerId === "returning" && order.risky)?.amount ?? estimatedRiskAmount("returning");
  return {
    ...s,
    sales: Math.max(0, s.sales - charged),
    daySales: s.daySales - charged,
    trust: clamp(s.trust - 8),
    compliance: clamp(s.compliance - 4),
    flags: flag(s, "returning-chargeback"),
    history: history(s, "沈薇团队发现效果不稳定，批量单暂扣"),
  };
}

export function dawnNotices(s: Campaign): DawnNotice[] {
  const notes: DawnNotice[] = [];
  for (const reading of [morningReview(s), counterCheck(s)]) {
    if (reading && hasFlag(s, reading.key)) notes.push({ speaker: reading.speaker, body: reading.body });
  }
  if (s.day === 4 && hasFlag(s, "tang-paid-order")) notes.push({ speaker: "唐可 · 交接", body: "她把一单伴娘妆转到你名下。口头承诺这次兑现了。" });
  if (s.day === 5 && hasFlag(s, "zhao-daughter-order")) notes.push({ speaker: "赵青 · 微信", body: "妈妈说可以信你。我买了那支修护。" });
  if (s.day === 5 && hasFlag(s, "zhao-complaint")) notes.push({ speaker: "客诉 · 方敏", body: "赵女士女儿过敏，这条已经进档案。" });
  if (s.day === 5 && hasFlag(s, "zhao-returned")) notes.push({ speaker: "退货 · 收银", body: "赵女士按你写下的承诺退了那单。" });
  if (anjieComesBack(s)) notes.push({ speaker: "安姐 · 微信", body: "上周听你的，只用了修护，今天脸是稳的。化妆师两点到，我早上先过来拿当天的妆。" });
  for (const item of RISKY_RETURNS) {
    if (s.day === item.fromDay && hasFlag(s, item.resolve)) notes.push({ speaker: item.speaker, body: item.body });
  }
  for (const item of SAMPLE_RETURNS) {
    if (s.day === item.fromDay && hasFlag(s, item.resolve)) notes.push({ speaker: item.speaker, body: item.body });
  }
  return notes;
}

// Ownership changes alter the credited order too, so future chargebacks never
// refund a colleague's share. Keep the original receipt total for the ledger.
function transferXiaoyuOrder(s: Campaign, fraction: number): Campaign {
  const order = s.orders.find(order => order.customerId === "xiaoyu");
  const amount = order?.amount ?? (hasFlag(s, "served:xiaoyu:good") ? estimatedOrderAmount("xiaoyu", "positive") : hasFlag(s, "served:xiaoyu:risky") ? estimatedRiskAmount("xiaoyu") : 0);
  const transferred = amount * fraction;
  return { ...s, sales: Math.max(0, s.sales - transferred), daySales: s.daySales - transferred,
    orders: s.orders.map(item => item === order ? { ...item, amount: item.amount - transferred, shared: true } : item) };
}

function hasPurchase(s: Campaign, id: CustomerId) {
  // Completed consultation is not proof of payment; successful legacy flags are.
  return s.orders.some(order => order.customerId === id) || hasFlag(s, `served:${id}:good`) || hasFlag(s, `served:${id}:risky`);
}

// 闭店事件里有些选项要先看关系和名单，界面试的也是这一份。
export const visibleChoices = (s: Campaign, event: DayEvent) => event.choices.filter(choice => !choice.visible || choice.visible(s));

export function dayEvent(s: Campaign): DayEvent {
  if (s.day === 1) return {
    speaker: "苏蔓", speakerStaff: "suman", speakerCustomer: null, title: "少了两份热门赠品",
    body: "苏蔓说上午太忙忘记登记，让你把缺口记到刚才的订单里。她是唯一主动教过你的前辈。",
    choices: [
      { id: "refuse-suman", label: "拒绝补登记", detail: "不替任何人改记录", result: "苏蔓沉默了。合规记录更干净，但她不再把你当自己人。", apply: st => ({ ...st, compliance: clamp(st.compliance + 10), relations: { ...st.relations, suman: st.relations.suman - 9 }, evidence: st.evidence + 1, flags: flag(st, "refused-suman"), history: history(st, "你拒绝替苏蔓补赠品登记") }) },
      { id: "cover-suman", label: "替她补上", detail: "用自己的订单填缺口", result: "苏蔓欠你一次人情。系统里也第一次留下了不属于你的风险。", apply: st => ({ ...st, compliance: clamp(st.compliance - 12), samples: Math.max(0, st.samples - 2), relations: { ...st.relations, suman: st.relations.suman + 14 }, flags: flag(st, "covered-suman"), history: history(st, "你替苏蔓掩盖了赠品缺口") }) },
      { id: "public-record", label: "发群里确认", detail: "公开问清批次再处理", result: "缺口被留痕。苏蔓觉得你把小事闹大，唐可却第一次认真看你。", apply: st => ({ ...st, compliance: clamp(st.compliance + 5), relations: { ...st.relations, suman: st.relations.suman - 6, tangke: st.relations.tangke + 8 }, evidence: st.evidence + 2, flags: flag(st, "public-sample-record"), history: history(st, "你在工作群公开确认赠品缺口") }) },
    ],
  };
  if (s.day === 2) {
    if (!hasPurchase(s, "xiaoyu")) return {
      speaker: "唐可", speakerStaff: "tangke", speakerCustomer: null, title: "小雨已经走了",
      body: "唐可把中庭的小样袋摔在抽屉里：这单本来可以留下。她问你要不要一起去追。",
      choices: [
        { id: "chase-xiaoyu", label: "和她一起去追", detail: "消耗体力，换回一点关系", result: "没追上。唐可记住你至少没有把人往外推。", apply: st => ({ ...st, energy: Math.max(0, st.energy - 12), relations: { ...st.relations, tangke: st.relations.tangke + 8 }, flags: flag(st, "chased-xiaoyu"), history: history(st, "你和唐可一起去追已经离开的小雨") }) },
        { id: "let-xiaoyu-go", label: "承认这单丢了", detail: "不编理由", result: "唐可没再说话。她开始把你当成会放走人的人。", apply: st => ({ ...st, relations: { ...st.relations, tangke: st.relations.tangke - 6 }, flags: flag(st, "lost-xiaoyu-owned"), history: history(st, "你承认小雨是在你眼皮底下走的") }) },
        { id: "record-xiaoyu", label: "记下她先问过色号", detail: "给自己留一条后路", result: "记录在，人已经不在。唐可觉得你在写对自己有利的故事。", apply: st => ({ ...st, evidence: st.evidence + 1, relations: { ...st.relations, tangke: st.relations.tangke - 4 }, flags: flag(st, "recorded-lost-xiaoyu"), history: history(st, "你在小雨离开后补了咨询记录") }) },
      ],
    };
    return {
      speaker: "唐可", speakerStaff: "tangke", speakerCustomer: null, title: "她说这单应该算她的",
      body: "唐可拿出一条上午的咨询记录：小雨先问过她色号，只是当时没有成交。你刚完成了全部试妆。",
      choices: [
        { id: "split-tang", label: "提出平分", detail: "各退一步，转出这单实际入账的一半", result: "唐可接受了。你少了一点数字，却多了一个愿意交接顾客的人。", apply: st => ({ ...transferXiaoyuOrder(st, .5), relations: { ...st.relations, tangke: st.relations.tangke + 14 }, flags: flag(st, "split-with-tang"), history: history(st, "你与唐可平分了小雨的订单") }) },
        { id: "beat-tang", label: "拿出服务记录", detail: "按有效接待规则据理力争", result: "订单归你。唐可无法反驳，但开始把你视作真正的竞争者。", apply: st => ({ ...st, evidence: st.evidence + 1, relations: { ...st.relations, tangke: st.relations.tangke - 5 }, flags: flag(st, "beat-tang-with-record"), history: history(st, "你用服务记录赢下订单归属") }) },
        { id: "yield-tang", label: "把单让给她", detail: "换她下次交接一个高客", result: "唐可答应欠你一单。口头承诺没有证据，但她的敌意明显下降。", apply: st => ({ ...transferXiaoyuOrder(st, 1), relations: { ...st.relations, tangke: st.relations.tangke + 22 }, flags: flag(st, "tang-owes-order"), history: history(st, "你把小雨的订单让给了唐可") }) },
      ],
    };
  }
  if (s.day === 3) {
    if (!hasPurchase(s, "zhao")) return {
      speaker: "罗曼", speakerStaff: "roman", speakerCustomer: null, title: "总部还在催修护数据",
      body: "赵女士没买就走了。罗曼没有骂你，只把区域群的截图转给你：今天这款必须有数。",
      choices: [
        { id: "push-data", label: "用别的订单顶数据", detail: "数字好看，记录不干净", result: "群里安静了。方敏的文件夹里多了一条对不上的数。", apply: st => ({ ...st, compliance: clamp(st.compliance - 10), relations: { ...st.relations, roman: st.relations.roman + 4 }, flags: flag(st, "faked-repair-data"), history: history(st, "你用别的订单顶了修护数据") }) },
        { id: "tell-truth", label: "如实说没做成", detail: "挨复盘，不造假", result: "罗曼让你留下十分钟。她没有帮你圆。", apply: st => ({ ...st, relations: { ...st.relations, roman: st.relations.roman - 4 }, flags: flag(st, "admitted-zhao-miss"), history: history(st, "你向罗曼承认赵女士那单没做成") }) },
        { id: "ask-suman", label: "请苏蔓帮你补一个老客", detail: "人情换数字", result: "苏蔓打了电话。数字有了，人情账也有了。", apply: st => ({ ...st, sales: st.sales + 980, daySales: st.daySales + 980, relations: { ...st.relations, suman: st.relations.suman - 6 }, flags: flag(st, "borrowed-suman-customer"), history: history(st, "你请苏蔓用老客帮你补了数据") }) },
      ],
    };
    return {
      speaker: "赵女士", speakerStaff: null, speakerCustomer: "zhao", title: "女儿发来一张过敏记录",
      body: "闭店前，她发来女儿的过敏记录：刚买的新品含有一种曾让女儿过敏的香精。订单已经入账，你现在可以主动联系她换货，也可以保留这笔销售。",
      choices: [
        { id: "protect-zhao", label: "换低价基础款", detail: "少卖 ¥700，避免已知风险", result: "赵女士松了口气。当天数字下降，但她把你的微信推给了女儿。", apply: st => ({ ...st, sales: Math.max(0, st.sales - 700), daySales: Math.max(0, st.daySales - 700), trust: clamp(st.trust + 12), flags: flag(st, "protected-zhao"), history: history(st, "你主动降低赵女士的客单避免过敏") }) },
        { id: "risk-zhao", label: "解释概率后成交", detail: "让她自己承担选择", result: "订单留下了。你说清了风险，却知道她并没有真正听懂。", apply: st => ({ ...st, trust: clamp(st.trust - 3), compliance: clamp(st.compliance - 3), flags: flag(st, "zhao-risk-sale"), history: history(st, "赵女士知情后仍买下新品") }) },
        { id: "promise-zhao", label: "写下退换承诺", detail: "保留销售，并承诺不适可退", result: "你保住数字，也背上一个有时间戳的售后承诺。", apply: st => ({ ...st, trust: clamp(st.trust + 5), evidence: st.evidence + 1, flags: flag(st, "promise-zhao-return"), history: history(st, "你向赵女士写下无条件退换承诺") }) },
      ],
    };
  }
  if (s.day === 4 && !hasPurchase(s, "anjie")) return {
    speaker: "苏蔓", speakerStaff: "suman", speakerCustomer: null, title: "没留下的婚礼单",
    body: "安姐没有在你这里下单。苏蔓收起准备好的旅行装：她跟了我三年。今天没卖成，也不能把原因藏起来。",
    choices: [
      { id: "record-anjie-miss", label: "如实交接试用记录", detail: "不补销售，不隐瞒风险", result: "苏蔓没有责怪你。她把记录留给下次接待的人，这至少不是一场没人负责的失败。", apply: st => ({ ...st, evidence: st.evidence + 1, flags: flag(st, "recorded-anjie-miss"), history: history(st, "你向苏蔓交接了未成交的婚礼咨询") }) },
      { id: "own-anjie-miss", label: "承认没能接住她", detail: "承担复盘，不伪造订单", result: "苏蔓让你明天一起复盘。她听见你没有拿顾客的敏感当借口。", apply: st => ({ ...st, relations: { ...st.relations, suman: st.relations.suman + 3 }, flags: flag(st, "owned-anjie-miss"), history: history(st, "你承担了婚礼单未成交的复盘") }) },
    ],
  };
  if (s.day === 4) return {
    speaker: "安姐", speakerStaff: "suman", speakerCustomer: "anjie", title: "“把赠品都装进去”",
    body: "她要六套旅行装送伴娘。系统额度只够两套。苏蔓在远处没有说话。",
    choices: [
      { id: "refuse-gifts", label: "只按额度给两套", detail: "守住规则，可能得罪大客", result: "安姐脸色不好看，但接受了。罗曼第一次在群里公开说你“能守底线”。", apply: st => ({ ...st, compliance: clamp(st.compliance + 12), relations: { ...st.relations, roman: st.relations.roman + 12 }, flags: flag(st, "refused-anjie-gifts"), history: history(st, "你拒绝给安姐超额赠品") }) },
      { id: "give-gifts", label: "私下补足六套", detail: "消耗4份库存，不登记", visible: st => st.samples >= 4, result: "安姐满意离开。盘点表上出现四个无法解释的空位。", apply: st => ({ ...st, samples: Math.max(0, st.samples - 4), compliance: clamp(st.compliance - 18), relations: { ...st.relations, suman: st.relations.suman + 8 }, flags: flag(st, "gave-anjie-gifts"), history: history(st, "你给安姐四套未登记赠品") }) },
      { id: "sign-gifts", label: "请苏蔓共同签字", detail: "消耗4份库存，责任共同留下", visible: st => st.samples >= 4, result: "苏蔓签了字。她帮了你，也知道你把她绑进了记录。", apply: st => ({ ...st, samples: Math.max(0, st.samples - 4), compliance: clamp(st.compliance - 6), evidence: st.evidence + 2, relations: { ...st.relations, suman: st.relations.suman + 3 }, flags: flag(st, "signed-anjie-gifts"), history: history(st, "你和苏蔓共同签了安姐赠品记录") }) },
    ],
  };
  const gap = hasFlag(s, "covered-suman") || hasFlag(s, "gave-anjie-gifts") || hasFlag(s, "signed-anjie-gifts");
  const atRisk = s.standing < STANDING_RISK;
  // 名单是柜位评估里唯一能被数出来的东西，所以它只在谈柜位的那两个晚上出现。
  const rosterCard: EventChoice = { id: "hand-roster", label: "把私域名单放在桌上", detail: `名单上有 ${s.members.length} 个人，明年还在`, visible: st => st.members.length >= MEMBER_MIN_FOR_CREDIT, result: "方敏把人数抄进报告。这个柜位后面站着的人，第一次是可以数的。", apply: st => ({ ...st, standing: clamp(st.standing + 8), relations: { ...st.relations, roman: st.relations.roman + 4 }, flags: flag(st, "handed-over-roster"), history: history(st, "你把私域名单交给柜位评估") }) };
  if (gap) return {
    speaker: "方敏 · 合规", speakerStaff: "fangmin", speakerCustomer: null, title: "请解释赠品缺口",
    body: (hasFlag(s, "covered-suman")
      ? "方敏把第一天的补登记和后来的盘点对在一起。缺口对得上人。她要一个能写进档案的说法。"
      : "盘点表上的空位和安姐那单对得上。她不问谁是好人，只问哪一种说法能被记录证明。")
      + (atRisk ? ` 同一张桌上，柜位进度只做到 ${thisWeekPercent(s)}%——她没有把这两件事分开看。` : ""),
    choices: [
      { id: "submit-all", label: "提交全部记录", detail: "不替任何人删减事实", result: "调查会伤到同事，也可能证明你没有独自制造缺口。", apply: st => ({ ...st, evidence: st.evidence + 3, compliance: clamp(st.compliance + 5), flags: flag(st, "submitted-all-records"), history: history(st, "你向合规提交了完整记录") }) },
      { id: "take-blame", label: "承认自己负责", detail: "保护团队，独自扛下缺口", result: "苏蔓记住了你的保护。总部也在档案里记住了同一件事。", apply: st => ({ ...st, compliance: clamp(st.compliance - 16), relations: { ...st.relations, suman: st.relations.suman + 18 }, flags: flag(st, "took-sample-blame"), history: history(st, "你独自承担了赠品缺口") }) },
      { id: "blame-suman", label: "指出苏蔓操作", detail: "用她的错误换自己的清白", result: "你的责任被切开了。苏蔓看你的眼神也彻底变了。", visible: st => hasFlag(st, "covered-suman") || hasFlag(st, "signed-anjie-gifts"), apply: st => ({ ...st, compliance: clamp(st.compliance + 3), relations: { ...st.relations, suman: st.relations.suman - 28, roman: st.relations.roman + 5 }, flags: flag(st, "blamed-suman"), history: history(st, "你向合规指出了苏蔓的操作") }) },
      { id: "use-group", label: "拿出群聊留痕", detail: "用公开记录证明你没有私改", result: "方敏点了点头。这条记录保护了你，也让苏蔓在群里被看见。", visible: st => hasFlag(st, "public-sample-record"), apply: st => ({ ...st, evidence: st.evidence + 2, compliance: clamp(st.compliance + 8), relations: { ...st.relations, suman: st.relations.suman - 8 }, flags: flag(st, "used-group-record"), history: history(st, "你用工作群记录证明赠品缺口") }) },
    ],
  };
  if (atRisk) return {
    speaker: "罗曼", speakerStaff: "roman", speakerCustomer: null, title: "柜位在评估表上",
    body: `本周进度做到 ${thisWeekPercent(s)}%。罗曼把区域发来的表推过来，绮光这个柜位被标了黄色。她问你：这一栏要不要有人替你写几句话。`
      + (s.members.length >= MEMBER_MIN_FOR_CREDIT ? ` 你手上有 ${s.members.length} 个人是她问不到、但明年还在的。` : ""),
    choices: [
      rosterCard,
      { id: "argue-records", label: "把五天记录摊开", detail: "用留痕、售后和退货记录说话", result: "罗曼一条条看完，在表上写了备注。柜位留到季度末，条件写在下一行。", apply: st => ({ ...st, evidence: st.evidence + 2, standing: clamp(st.standing + 10), relations: { ...st.relations, roman: st.relations.roman + 4 }, flags: flag(st, "counter-argued-records"), history: history(st, "你用五天的记录替柜位说话") }) },
      { id: "own-counter-miss", label: "认领自己的判断失误", detail: "不怪顾客，也不怪同事", result: "罗曼没有替你求情，但她在评价里写下'肯认'。你自己知道这两个字是真的。", apply: st => ({ ...st, trust: clamp(st.trust + 6), standing: clamp(st.standing + 6), flags: flag(st, "counter-owned-miss"), history: history(st, "你为柜位进度承担了复盘") }) },
      { id: "ask-roman-vouch", label: "请罗曼替你签一个字", detail: "她肯签，前提是你之前站在她这边", visible: st => st.relations.roman >= 50, result: "罗曼签了字，说这一次的人情你要自己还上。", apply: st => ({ ...st, standing: clamp(st.standing + 12), relations: { ...st.relations, roman: st.relations.roman + 6 }, flags: flag(st, "counter-vouched"), history: history(st, "罗曼替柜位签了字") }) },
    ],
  };
  return {
    speaker: "方敏 · 合规", speakerStaff: "fangmin", speakerCustomer: null, title: "账对得上，她仍要一句话",
    body: "赠品账没有把你单独钉住。方敏合上文件夹，问你：如果区域要写储备人选，你愿不愿意被写进去。",
    choices: [
      { id: "accept-reserve", label: "接受被写进储备", detail: "数字和纪律都对你有利", result: "罗曼第一次在评价里写“可独立带班”。苏蔓没有祝贺你。", apply: st => ({ ...st, relations: { ...st.relations, roman: st.relations.roman + 10, suman: st.relations.suman - 4 }, flags: flag(st, "accepted-reserve"), history: history(st, "你接受成为区域储备人选") }) },
      rosterCard,
      { id: "credit-team", label: "把评价分给柜台", detail: "自己少出风头", result: "方敏记下了。苏蔓看你的眼神松了一点。", apply: st => ({ ...st, relations: { ...st.relations, suman: st.relations.suman + 10, tangke: st.relations.tangke + 6 }, flags: flag(st, "credited-team"), history: history(st, "你把合规评价分给了柜台") }) },
      { id: "stay-quiet", label: "只说账是对的", detail: "不抢位置，也不站队", result: "她没有再问。你安全地过了这一天，也没有多交到一个盟友。", apply: st => ({ ...st, flags: flag(st, "stayed-quiet"), history: history(st, "你在合规抽查后没有表态") }) },
    ],
  };
}

function asHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (typeof item === "string" && item) return [{ day: 1, text: item }];
    if (item && typeof item === "object" && "text" in item) {
      const text = String((item as { text?: unknown }).text ?? "");
      if (!text) return [];
      const day = Number((item as { day?: unknown }).day);
      return [{ day: day >= 1 && day <= 5 ? day : 1, text }];
    }
    return [];
  });
}

export function parseCampaign(raw: string | null): Campaign | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Campaign>;
    if (!parsed || parsed.version !== SAVE_VERSION) return null;
    if (!Number.isInteger(parsed.day) || parsed.day! < 1 || parsed.day! > 5) return null;
    for (const key of ["sales", "daySales", "trust", "compliance", "energy", "samples", "evidence", "standing"] as const) {
      if (typeof parsed[key] !== "number" || !Number.isFinite(parsed[key]) || (key !== "daySales" && parsed[key]! < 0)) return null;
    }
    const customerIds = (value: unknown): CustomerId[] => Array.isArray(value)
      ? [...new Set(value.filter((id): id is CustomerId => typeof id === "string" && Object.hasOwn(CUSTOMERS, id)))] : [];
    const session = parsed.activeSession;
    if (session && (!Object.hasOwn(CUSTOMERS, session.customerId) || !Array.isArray(session.discovered)
      || session.discovered.some(id => !["eyes", "cheek", "nose"].includes(id))
      || (session.selectedProduct !== null && !Object.hasOwn(PRODUCTS, session.selectedProduct))
      || (session.askedQuestion !== null && (!Number.isInteger(session.askedQuestion) || !QUESTIONS[session.customerId][session.askedQuestion])
      || (session.bundle !== undefined && !Object.hasOwn(BUNDLES, session.bundle))
      || (session.revealed !== undefined && (!Array.isArray(session.revealed) || session.revealed.some(trait => !Object.hasOwn(TRAIT_LABELS, trait))))))) return null;
    const merged: Campaign = {
      ...INITIAL,
      ...parsed,
      version: SAVE_VERSION,
      relations: { ...INITIAL.relations, ...parsed.relations },
      flags: Array.isArray(parsed.flags) ? parsed.flags.filter(flag => typeof flag === "string") : [],
      history: asHistory(parsed.history),
      dayServed: customerIds(parsed.dayServed),
      members: customerIds(parsed.members),
      lost: customerIds(parsed.lost),
      eventDoneDays: Array.isArray(parsed.eventDoneDays) ? parsed.eventDoneDays.filter(day => Number.isInteger(day) && day >= 1 && day <= 5) : [],
      waitMeters: Object.fromEntries(Object.entries(parsed.waitMeters ?? {}).filter(([id, value]) => Object.hasOwn(CUSTOMERS, id) && typeof value === "number" && Number.isFinite(value) && value >= 0)),
      shiftMinutes: Number.isFinite(parsed.shiftMinutes) ? Math.max(0, parsed.shiftMinutes!) : 0,
      floorSeconds: Number.isFinite(parsed.floorSeconds) ? Math.max(0, Math.min(FLOOR_SECONDS_PER_ACTION - 0.001, parsed.floorSeconds!)) : 0,
      orders: Array.isArray(parsed.orders) ? parsed.orders.filter(order => order && Object.hasOwn(CUSTOMERS, order.customerId) && Object.hasOwn(PRODUCTS, order.product) && Number.isFinite(order.amount) && order.amount >= 0 && Number.isFinite(order.total) && order.total >= order.amount && Number.isInteger(order.units) && order.units > 0) : [],
      finished: parsed.finished === true,
      activeSession: parsed.activeSession
        ? { ...parsed.activeSession, bundle: parsed.activeSession.bundle ?? "single", revealed: parsed.activeSession.revealed ?? [], chat: parsed.activeSession.chat ?? [] }
        : null,
    };
    return { ...merged, waitMeters: metersFor(floorCustomers(merged), merged.waitMeters) };
  } catch {
    return null;
  }
}

export function relationText(value: number) {
  return value >= 68 ? "愿意站在你这边" : value >= 50 ? "保持合作" : value >= 35 ? "互相试探" : "公开敌对";
}

// 柜位评分在游戏里只用话说出来，不做成第二条进度条。
export function standingWord(value: number) {
  return value >= 60 ? "区域把柜位排在前面" : value >= STANDING_RISK ? "柜位没有被人点名" : "柜位已经写进评估表";
}

// 台账也不做成进度条：柜位怎么念，它就怎么念。分界线要和结局里的 safe 用同一个数。
export const COMPLIANCE_RISK = 50;
export function complianceWord(value: number) {
  return value >= 75 ? "台账对得上，巡店没话说" : value >= COMPLIANCE_RISK ? "台账还压得住" : value >= 30 ? "盘点表上有对不上的数" : "方敏的文件夹里已经有你";
}

export function todayHistory(s: Campaign): HistoryEntry[] {
  return s.history.filter(item => item.day === s.day);
}

export function historyByDay(s: Campaign): Array<{ day: number; title: string; items: HistoryEntry[] }> {
  return DAYS.map(story => ({
    day: story.day,
    title: story.title,
    items: s.history.filter(item => item.day === story.day),
  })).filter(group => group.items.length > 0);
}

// 柜位去向是第五条线：它不改结局标题，只决定你留下的是哪一个位置。
export function counterVerdict(s: Campaign): { label: string; body: string } {
  if (hasFlag(s, "counter-vouched") || s.standing >= 66) return { label: "柜位续到下一季", body: "区域把下一季排期发了过来。这个位置不再写在“评估”那一栏。" };
  if (hasFlag(s, "handed-over-roster")) return { label: "柜位留下，名单归你", body: "方敏的报告里多了一行：私域可复用。保住的不只是几平方米柜台。" };
  if (hasFlag(s, "counter-argued-records")) return { label: "柜位留到季度末", body: "你摊开的那五天记录被人逐条读完了。条件是下一个活动周自己挣。" };
  if (s.standing >= STANDING_RISK) return { label: "柜位暂时没动", body: "评估表上这一栏空着。数字会先替你说话，也可能替别人说话。" };
  return { label: "撤柜评估已经写上去", body: "绮光这个柜位被排进下一轮撤柜评估。你留下的数字，被人拿去说明面积不够。" };
}

export function endingTitle(s: Campaign) {
  const salesWin = s.sales >= TARGET;
  const safe = s.compliance >= COMPLIANCE_RISK;
  const trusted = s.trust >= 55;
  if (salesWin && !safe) return "销冠的账单";
  if (!salesWin) return trusted ? "没转正，但有人等你" : "柜台灯灭了";
  return safe && trusted ? "你留下了，而且没变成她们" : "你留下了，可没人等你";
}

export function spendAttention(s: Campaign, servingId: CustomerId | null, cost: number): Campaign {
  if (!Number.isFinite(cost) || cost <= 0 || s.finished) return s;
  const ids = floorCustomers(s);
  const waitMeters = { ...s.waitMeters };
  const newlyLost: CustomerId[] = [];
  for (const id of ids) {
    if (id === servingId || s.dayServed.includes(id) || s.lost.includes(id)) continue;
    const next = Math.max(0, (waitMeters[id] ?? CUSTOMERS[id].patience) - cost);
    waitMeters[id] = next;
    if (next === 0) newlyLost.push(id);
  }
  const shiftMinutes = s.shiftMinutes + cost;
  if (newlyLost.length === 0) return { ...s, waitMeters, shiftMinutes };
  let flags = s.flags;
  let log = s.history;
  let relations = s.relations;
  for (const id of newlyLost) {
    flags = flag({ ...s, flags }, `lost:${id}`);
    log = history({ ...s, history: log }, CUSTOMERS[id].lostLine);
    if (CUSTOMERS[id].rival) relations = { ...relations, luyao: relations.luyao - 4 };
  }
  return { ...s, waitMeters, shiftMinutes, lost: [...s.lost, ...newlyLost], flags, history: log, relations,
    activeSession: s.activeSession && newlyLost.includes(s.activeSession.customerId) ? null : s.activeSession };
}

export function availableCustomers(s: Campaign) {
  return floorCustomers(s).filter(id => !s.dayServed.includes(id) && !s.lost.includes(id));
}

// The floor clock and customer pressure consume the same action units. Reading a
// consultation pauses real time; committing an action spends one minute instead.
export function advanceFloorTime(s: Campaign, seconds: number): Campaign {
  if (!Number.isFinite(seconds) || seconds <= 0 || s.finished || s.eventDoneDays.includes(s.day) || !availableCustomers(s).length) return s;
  const elapsed = s.floorSeconds + seconds;
  const cost = Math.floor(elapsed / FLOOR_SECONDS_PER_ACTION);
  return { ...(cost ? spendAttention(s, null, cost) : s), floorSeconds: elapsed % FLOOR_SECONDS_PER_ACTION };
}

export function applyQuestion(s: Campaign, customerId: CustomerId, index: number): Campaign {
  const useful = QUESTIONS[customerId][index]?.useful;
  return { ...s, trust: clamp(s.trust + (useful ? 2 : -2)), energy: Math.max(0, s.energy - 3) };
}

export function applyRival(s: Campaign, choice: RivalChoice): Campaign {
  return choice === "record"
    ? { ...s, evidence: s.evidence + 1, compliance: clamp(s.compliance + 2), energy: Math.max(0, s.energy - 3) }
    : choice === "clarify"
      ? { ...s, trust: clamp(s.trust + 5), energy: Math.max(0, s.energy - 7) }
      : { ...s, trust: clamp(s.trust + 2), relations: { ...s.relations, luyao: s.relations.luyao + 7 }, energy: Math.max(0, s.energy - 4) };
}

// 加粉花的是现场时间：为一个今天不会买单的人占一分钟，赌的是活动周之后的复购。
export function canAddMember(s: Campaign, id: CustomerId) {
  // 她得先接到过你的东西：一支小样，或者一次完整接待。凭空要微信，她只会走。
  return !s.members.includes(id) && !s.lost.includes(id) && (hasFlag(s, `sample:${id}`) || s.dayServed.includes(id));
}

export function addMember(s: Campaign, id: CustomerId): Campaign {
  if (s.finished || !canAddMember(s, id)) return s;
  const customer = CUSTOMERS[id];
  return spendAttention(
    { ...s, members: [...s.members, id], trust: clamp(s.trust + 2), history: history(s, `${customer.name}把你加进了微信名单`) },
    id, 1,
  );
}

export function leaveSample(s: Campaign, customerId: CustomerId): Campaign {
  if (s.samples <= 0 || hasFlag(s, `sample:${customerId}`)) return s;
  const customer = CUSTOMERS[customerId];
  return { ...s, samples: s.samples - 1, trust: clamp(s.trust + 4), flags: flag(s, `sample:${customerId}`), history: history(s, `你给${customer.name}留下试用小样`) };
}

export function resolveSale(s: Campaign, input: {
  customerId: CustomerId;
  selectedProduct: ProductId;
  bundle: BundleId;
  revealed: Trait[];
  tested: boolean;
  askedQuestion: number | null;
  claimed: boolean;
  interruption: boolean;
  interruptionHandled: boolean;
  force: boolean;
  rivalChoice?: RivalChoice | null;
}): { campaign: Campaign; outcome: SaleOutcome } | null {
  const customer = CUSTOMERS[input.customerId];
  if (!customer || !input.tested || s.dayServed.includes(customer.id) || s.lost.includes(customer.id)) return null;
  if (input.interruption && !input.interruptionHandled) return null;
  const item = PRODUCTS[input.selectedProduct];
  const { tier } = fitOf(customer, input.selectedProduct);
  const known = new Set(input.revealed);
  const missed = unknownDemands(customer, known);
  const vetoMissed = Boolean(customer.veto && !known.has(customer.veto.trait));
  const guarded = !input.interruption || input.interruptionHandled;
  const usefulQuestion = input.askedQuestion !== null && QUESTIONS[customer.id][input.askedQuestion]?.useful;
  const units = tier === "negative"
    ? input.force ? forcedUnits(customer, input.bundle) : 0
    : unitsWanted(customer, input.selectedProduct, input.bundle, tier);
  const sold = units > 0;
  const shared = input.rivalChoice === "yield" || (s.activeSession?.customerId === customer.id && s.activeSession.rivalChoice === "yield");
  const total = item.price * units;
  const amount = shared ? total / 2 : total;
  const campaign: Campaign = {
    ...s, sales: s.sales + amount, daySales: s.daySales + amount,
    trust: clamp(s.trust + (tier === "positive" ? 7 : sold ? 1 : -10) + (usefulQuestion ? 4 : -2) + (guarded ? 2 : -6)),
    compliance: clamp(s.compliance + (tier === "positive" ? 1 : sold ? 0 : -5)), energy: Math.max(0, s.energy - 14),
    evidence: s.evidence + (input.claimed ? 1 : 0) + (!missed.length && !vetoMissed && sold ? 1 : 0),
    dayServed: [...s.dayServed, customer.id], activeSession: null,
    flags: flag(s, `served:${customer.id}:${sold ? (tier === "negative" ? "risky" : "good") : "refused"}`),
    history: history(s, sold
      ? `${customer.name}带走 ${units} 件${item.short} · ¥${total.toLocaleString("zh-CN")}${tier === "negative" ? "（她并不认同这个方向）" : ""}`
      : `${customer.name}拒绝了${item.short}的推荐`),
    orders: sold ? [...s.orders, { day: s.day, customerId: customer.id, product: input.selectedProduct, units, total, amount, shared, risky: tier === "negative" }] : s.orders,
  };
  if (sold && units < BUNDLES[input.bundle].units && units < customer.maxUnits) {
    campaign.history = history(campaign, `${customer.name}的预算只够 ${units} 件，连带没有谈满`);
  }
  if (shared && sold) campaign.history = history(campaign, `${customer.name}与陆遥拼单：总额 ¥${total.toLocaleString("zh-CN")}，你的业绩 ¥${amount.toLocaleString("zh-CN")}`);
  if (tier === "negative" && sold && vetoMissed) campaign.history = history(campaign, `你没有问出口的那条底线，已经写进这单的风险记录`);
  // 连带不是免费的：她每带走一件，就多用一分钟开单讲搭配，柜台另一边的人还在倒数。
  const minutes = sold ? BUNDLES[input.bundle].units : 1;
  return {
    campaign: spendAttention(campaign, null, minutes),
    outcome: {
      good: tier === "positive" && guarded, amount, total, units, minutes, tier, shared,
      title: sold ? (tier === "positive" ? `${customer.name}成交` : tier === "mixed" ? `${customer.name}只带走一件` : `${customer.name}被你推下来单`) : `${customer.name}拒绝成交`,
      body: (sold
        ? (tier === "positive"
            ? (guarded ? `你解决了真正需求，她还愿意带走 ${units} 件。她记住的不只是产品，还有你的判断。` : "产品选对了，但订单归属被人插进一道缝。")
            : tier === "mixed"
              ? "她认这个方向，却没有完全被说服。一件就够了，连带没有起来。"
              : `数字立刻好看了 ${total.toLocaleString("zh-CN")} 元，可她最在意的问题没有解决。退货风险已经留在你名下。`)
        : vetoMissed ? "她没有为错误判断买单。你连她在怕什么都没问出来。" : "她没有为这个方向买单。你丢掉一笔销售，但至少记住了这次反应。")
        + (shared && sold ? ` 陆遥分走一半，你实际记入 ¥${amount.toLocaleString("zh-CN")}。` : ""),
    },
  };
}

export function startNextDay(s: Campaign): Campaign {
  if (s.day >= 5) return { ...applyFinale(s), finished: true };
  const advanced = { ...s, day: s.day + 1, daySales: 0, dayServed: [], lost: [], energy: Math.min(100, s.energy + 24), activeSession: null, waitMeters: {}, shiftMinutes: 0, floorSeconds: 0 };
  const dawned = applyDawn(advanced);
  return { ...dawned, waitMeters: metersFor(floorCustomers(dawned)) };
}

export function openFloorState(s: Campaign): Campaign {
  const dawned = applyDawn(s);
  return { ...dawned, waitMeters: metersFor(floorCustomers(dawned), dawned.waitMeters) };
}

export function startService(s: Campaign, id: CustomerId): Campaign {
  if (!availableCustomers(s).includes(id) || s.finished || s.eventDoneDays.includes(s.day)) return s;
  if (s.activeSession) return s; // Finish or release the current customer first.
  if (s.energy < ENERGY_LOCK) return s;
  return { ...s, activeSession: { customerId: id, discovered: [], askedQuestion: null, selectedProduct: null,
    bundle: "single", revealed: [], tested: false, reaction: null, revisions: 0, claimed: false, rivalChoice: null, chat: [] } };
}

export function observeService(s: Campaign, cue: CueId): Campaign {
  const session = s.activeSession;
  if (!session || session.discovered.includes(cue)) return s;
  const customer = CUSTOMERS[session.customerId];
  const revealed = [...new Set([...session.revealed, ...customer.cues[cue].reveals])];
  return { ...spendAttention(s, session.customerId, 1), activeSession: { ...session, discovered: [...session.discovered, cue], revealed } };
}

export function askService(s: Campaign, text: string, chipIndex?: number): Campaign {
  const session = s.activeSession;
  if (!session || session.discovered.length < 2 || !text.trim() || session.tested) return s;
  const questions = QUESTIONS[session.customerId];
  const useful = chipIndex == null ? inferUseful(session.customerId, text) : Boolean(questions[chipIndex]?.useful);
  const index = chipIndex ?? Math.max(0, questions.findIndex(question => Boolean(question.useful) === useful));
  const response = fallbackReply(session.customerId, text, chipIndex ?? null, useful);
  const next = applyQuestion(spendAttention(s, session.customerId, 1), session.customerId, index);
  const revealed = [...new Set([...session.revealed, ...(questions[index]?.reveals ?? [])])];
  return { ...next, activeSession: { ...session, askedQuestion: index, revealed,
    chat: [...session.chat, { role: "player" as const, text: text.trim().slice(0, 280) }, { role: "customer" as const, text: response }].slice(-8) } };
}

export function chooseBundle(s: Campaign, bundle: BundleId): Campaign {
  const session = s.activeSession;
  if (!session || session.bundle === bundle || !Object.hasOwn(BUNDLES, bundle)) return s;
  return { ...s, activeSession: { ...session, bundle } };
}

export function selectServiceProduct(s: Campaign, id: ProductId): Campaign {
  const session = s.activeSession;
  if (!session || session.selectedProduct === id) return s;
  return { ...s, energy: Math.max(0, s.energy - (session.tested ? 5 : 0)), activeSession: { ...session,
    selectedProduct: id, tested: false, reaction: null, revisions: session.revisions + (session.tested ? 1 : 0) } };
}

export function trialService(s: Campaign): Campaign {
  const session = s.activeSession;
  if (!session || session.tested || session.discovered.length < 2 || session.askedQuestion === null || !session.selectedProduct) return s;
  return { ...spendAttention(s, session.customerId, 1), activeSession: { ...session, tested: true,
    reaction: fitOf(CUSTOMERS[session.customerId], session.selectedProduct).tier } };
}

export function respondToRival(s: Campaign, choice: RivalChoice): Campaign {
  const session = s.activeSession;
  if (!session || !session.tested || session.rivalChoice || !RIVAL_IDS.includes(session.customerId)) return s;
  return { ...applyRival(s, choice), activeSession: { ...session, rivalChoice: choice, claimed: session.claimed || choice === "record" } };
}

export function closeService(s: Campaign, force = false) {
  const session = s.activeSession;
  if (!session?.selectedProduct || !session.tested) return null;
  return resolveSale(s, { ...session, selectedProduct: session.selectedProduct, force,
    interruption: RIVAL_IDS.includes(session.customerId), interruptionHandled: Boolean(session.rivalChoice) });
}

export function releaseService(s: Campaign): Campaign {
  const session = s.activeSession;
  if (!session) return s;
  return { ...s, activeSession: null, lost: [...s.lost, session.customerId], flags: flag(s, `lost:${session.customerId}`),
    history: history(s, `你放下了${CUSTOMERS[session.customerId].name}的接待，把注意力留给另一位顾客`) };
}

export function settleDayEvent(s: Campaign, id: string): Campaign {
  if (s.eventDoneDays.includes(s.day)) return s;
  const choice = dayEvent(s).choices.find(choice => choice.id === id && (!choice.visible || choice.visible(s)));
  if (!choice) return s;
  const next = choice.apply(s);
  const change = next.sales - s.sales;
  if (change) next.history = history(next, `闭店调整 · ${choice.label}：${change > 0 ? "+" : "−"}¥${Math.abs(change).toLocaleString("zh-CN")}`);
  return { ...next, history: history(next, "回应 · " + choice.result), eventDoneDays: [...next.eventDoneDays, s.day], activeSession: null };
}

export function requestStaffHelp(s: Campaign, id: CustomerId): Campaign {
  if (!availableCustomers(s).includes(id) || hasFlag(s, `help:suman:${s.day}`) || s.energy < 6
    || !(hasFlag(s, "covered-suman") || s.relations.suman >= 60)) return s;
  return { ...s, energy: s.energy - 6, flags: flag(s, `help:suman:${s.day}`),
    waitMeters: { ...s.waitMeters, [id]: (s.waitMeters[id] ?? CUSTOMERS[id].patience) + 2 },
    history: history(s, `苏蔓替你留住${CUSTOMERS[id].name}，多争取了两次接待动作`) };
}

// 报价单不再由隐藏答案决定：件数来自她的预算、用量上限和你判断的准不准。
export function orderQuote(id: CustomerId, product: ProductId, bundle: BundleId, shared = false) {
  const customer = CUSTOMERS[id];
  const item = PRODUCTS[product];
  const { tier } = fitOf(customer, product);
  const units = unitsWanted(customer, product, bundle, tier);
  const total = item.price * units;
  const lines = units > 0 ? [{ label: `${item.name} × ${units}`, amount: total }] : [];
  const forced = forcedUnits(customer, bundle);
  const minutes = units > 0 ? BUNDLES[bundle].units : 1;
  const note = tier === "negative" ? `她不会为这个方向买单。硬推只能记 ${forced} 件，退货风险写在你名下`
    : tier === "mixed" ? "她最多只肯先拿一件"
      : units < BUNDLES[bundle].units ? `她的预算和用量只够 ${units} 件` : "";
  return { lines, units, total, amount: shared ? total / 2 : total, shared, minutes, risky: tier === "negative", forced, tier, note };
}

// 玩家能看到的部分：她说出来或被你问出来的诉求，以及还没问到的条数。
export function fitPreview(customer: Customer, revealed: Trait[]) {
  const known = new Set(revealed);
  return {
    known: knownDemands(customer, known),
    missed: unknownDemands(customer, known).length,
    vetoKnown: !customer.veto || known.has(customer.veto.trait),
  };
}

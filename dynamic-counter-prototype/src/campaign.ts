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
  // 半脸上妆是手背试色看不出来的那一步：她最在意的事要压在皮肤上才露出来。
  faceTrialled: boolean;
  faceTrialRevealed: Trait | null;
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
  stock: Record<ProductId, number>;
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
// 5 → 6：stock 的含义从"整周配货"变成"到今天早上为止到过的货"。字段没变，但一份 v5 存档过了新晨会会拿到超出配货的一批（量出来是柔焦 11、修护 9），所以整份拒收，不做合并。
export const SAVE_VERSION = 6;
export const TARGET = 21_000;
export const ENERGY_LOCK = 18;
export const RIVAL_IDS: CustomerId[] = ["shen", "returning", "zhou"];
export const SAMPLE_RETURN_SALE = 620;
export const FLOOR_SECONDS_PER_ACTION = 20;
// 迎上去（柜台的"截流"）：她已经在往中庭小样台那边挪了，端一支试用装过去才请得动。
// 窗口按"开始看表"那一档给，早了没意义；离柜两分钟从队列另一头扣。
export const PULL_OVER_WINDOW = 2;
export const PULL_OVER_MINUTES = 2;
// 晨会念的是同一个数：五日目标拆成每天的进度，不另开一块记分牌。
export const DAY_TARGETS = [2800, 3200, 3600, 4400, 7000];
// 柜位评分低于这条线，区域就开始写"评估是否保留"。
export const STANDING_RISK = 40;
export const MEMBER_MIN_FOR_CREDIT = 2;

// 品牌给这个柜台的是一周的量，不是无限的货架。21 支是按整周动销报的数，
// 可配下来的比例和这一周真正要卖出去的不一样：五条整周路线实测最多要吃 11 支柔焦、7 支修护、2 套持妆，
// 而柜上下来的是 10 / 7 / 4 —— 柔焦少一支、修护刚好见底、持妆多两套没人要。
// 这个错位才是柜台真实的一天：断货的不是"卖得最贵的那支"，是配货没配上动销的那支。
export const WEEK_ALLOCATION: Record<ProductId, number> = { soft: 10, glow: 4, repair: 7 };
// 配货不是一次性倒在柜台上：活动周第一天先出一部分，剩下的按天从大仓补。
// 批次是照着清洁路线的逐日动销排的（柔焦 3/3/1/0/4、修护 1/0/1/5/0、持妆 0/0/0/0/2），两处故意错位：
// 第 2 天柔焦差一支（¥980）——那天"打电话""等明天的货""少开一件"三个选项都还活着；
// 第 4 天修护差一支（¥1,680，而且是安姐接住的同事需求）——大仓把一批排晚了，正是这两行按钮唯一该亮的时候。
// 便宜的那次缺口要用"等"解决，贵的那次要用人离柜三分钟去换：这才叫选择。
export const DELIVERIES: Array<Record<ProductId, number>> = [
  { soft: 3, glow: 1, repair: 1 },
  { soft: 2, glow: 0, repair: 1 },
  { soft: 2, glow: 1, repair: 2 },
  { soft: 1, glow: 0, repair: 2 },
  { soft: 2, glow: 2, repair: 1 },
];
export const FIRST_DAY_STOCK: Record<ProductId, number> = { ...DELIVERIES[0] };
/** 今天到几支、明天排几支，晨会念的就是这一句。第 1 天那句顺带把"按天到"说清楚，
 *  明天那一半是给"等下一批"这个选项留的：看不到后天的排期，等和调就不是选择，是猜。 */
export function deliveryWord(day: number): string {
  const units = (batch: Record<ProductId, number>) => (Object.keys(PRODUCTS) as ProductId[]).filter(product => batch[product] > 0).map(product => `${PRODUCTS[product].short} ${batch[product]} 支`);
  const today = units(DELIVERIES[day - 1] ?? DELIVERIES[DELIVERIES.length - 1]);
  const tomorrow = day < DELIVERIES.length ? units(DELIVERIES[day]) : [];
  const head = day === 1
    ? `这一周的配货不是一次性给的：今天先出${today.join("、")}，剩下的按天到。`
    : today.length ? `今天大仓补到${today.join("、")}。` : "今天大仓没有新货，柜上剩多少就是多少。";
  return tomorrow.length ? `${head}明天排的是${tomorrow.join("、")}。` : head;
}
// 一次调货的量按品牌调拨单的最小单位算：一张单三支。
export const TRANSFER_UNITS = 3;
// 剩到 3 支才开口：刚好够开一套，连带（4 支）已经开不出来。一支没断就去找人借货，罗曼会先问你在做什么。
export const TRANSFER_GATE = 3;
// 离柜去打电话、等签字，柜台上排队的人不会停下来等你。
export const TRANSFER_MINUTES = { official: 3, tangke: 2 } as const;
// 唐可自己也在冲数：她愿意把货给一个她认的人，不愿意给一个刚抢过单的人。
export const TANGKE_STOCK_GATE = 45;
// 让单换回来的那一单伴娘妆（第 4 早进账）。她替开的那张单不走收银小票，只写在账本这一行上，
// 所以这一笔必须是个定死的数：第 2 晚那三条按钮上的钱要由它生成，否则玩家是在拿一个看得见的数换一句看不见的承诺。
export const TANG_PAYBACK = 2080;

export const INITIAL: Campaign = {
  version: SAVE_VERSION,
  day: 1, sales: 0, daySales: 0, trust: 50, compliance: 55, energy: 100, samples: 8, evidence: 0, standing: 50,
  stock: { ...FIRST_DAY_STOCK },
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

// 垫货：调研里最难看也最真实的一格（虎嗅那条：KPI 普遍完不成、BA 自掏腰包囤货、完不成要交改进报告，
// 见 audit/research-2026-09/调研与改造方案.md 第三节）。挑最便宜的那一支——真被逼到这一步的人，
// 先算的是自己掏多少，不是哪一支更好卖。进 sales 的是小票价，内购折扣只发生在她自己的工资上。
export const ADVANCE_PRODUCT: ProductId = "soft";
export const ADVANCE_POCKET_RATE = 0.7;
export const ADVANCE_SALE = PRODUCTS[ADVANCE_PRODUCT].price;
export const advancePocket = () => Math.round(ADVANCE_SALE * ADVANCE_POCKET_RATE);
export const ADVANCE_COMPLIANCE = -12;
export const ADVANCE_TANGKE = 6;
export const ADVANCE_HELD_STANDING = -6;
export const ADVANCE_HELD_COMPLIANCE = -6;

// P34：柜台上最容易越界的那一句 —— 一支只有普通备案的精华，口头承诺"用两周斑就淡了"。
// 祛斑美白属特殊化妆品（要注册，不是备案），功效宣称还得出自评价依据；柜台改不了包装，但一句话就能越线。
// 这一格买的是"当下少痛一点"：她信了，就多带走一支 —— 退货那天翻倍的金额走既有的回账机制，不在这里另记一笔。
export const CLAIM_PRODUCT: ProductId = "repair";
export const CLAIM_UNITS = 2;
export const CLAIM_TRUST = 4;
export const CLAIM_COMPLIANCE = -12;
export const CLAIM_ASKBACK_TRUST = -6;
export const claimLine = (id: CustomerId) => `你口头向${CUSTOMERS[id].name}承诺这瓶能淡斑`;
export const claimQuestion = (id: CustomerId) => `${CUSTOMERS[id].name}回去查了备案：那支没有淡斑这项`;
// 两个界面念同一句：按钮要说清买到什么（P23 的语法），越界的代价不能等到成交之后才知道。
// 出处核对见 audit/research-2026-09/调研与改造方案.md：祛斑美白属特殊化妆品（条例第 16、17 条：要注册，不是备案），
// 普通备案不得宣称这一项；柜台口头那一句走的是条例第 69 条后段那条通道。
export const CLAIM_LABEL = "把话说满 · 承诺两周淡斑";
export const CLAIM_NOTE = "淡斑是注册才准说的功效，这瓶只有备案 · 多带走一支，也退回来两支";

// 电商比价：她离柜以后才去搜旗舰店。柜台这一天最难接的就是这一击，而她手里能动的只有三样东西，
// 每一样都各有一代价：票面（品牌价盘 + 《明码标价和禁止价格欺诈规定》第十六、十七条：被比较价要真实有依据、不得提价后打折）、
// 抽屉里的小样（同规第十八条要求赠品标示品名数量，私下垫过去就是台账上对不上的空位）、以及她有没有你的微信。
// 差额写在句子里，不写进 sales：按下去哪一格票面都不动，动的只是别的东西。
export const PRICE_GAP = 280;
export const PRICE_PAD_SAMPLES = 2;

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
// 她的预算与上限、这一排的计时规则，是两句话：原来写成一整句被两个槽各念一遍，同一屏读两遍。
// 沙盘一个槽一句（诉求板 / 连带那一行），手机版那一屏只有一个槽念得下，把两句接回一行。措辞只在这里写一份。
export const demandBudgetWord = (customer: Customer) => `预算 ¥${customer.budget.toLocaleString("zh-CN")} · 上限 ${customer.maxUnits} 件`;
// 一路按高档误读量出来是一整周少 ¥3,640、走掉三位，只在第 1 单多按一档也会当天丢掉梅女士。
export const BUNDLE_MINUTE_HINT = "多要一件多占一分钟";
// 这一档开不出它自己开口要的件数时，把"要几件"补回按钮上：件数那一行已经是削过的结果。
export const bundleMinutesWord = (bundle: BundleId, units: number) => {
  const asked = BUNDLES[bundle].units;
  return asked > units ? `要 ${asked} 件 · 占 ${asked} 分钟` : `占 ${asked} 分钟`;
};
export const MIXED_FIT = 0.55;
// 开口之前的门槛：至少在她脸上看过两处。两个 UI 的这一步判定都问这个数。
export const OBSERVE_MIN = 2;
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

// 她愿意带走几件：判断越准越敢连带；勉强只拿一件，还要受预算、用量上限和柜上现货约束。
// left 是抽屉里剩下的支数。退货不补回来：拆封的单要回仓复检，这一周不会再上架。
export function unitsWanted(customer: Customer, product: ProductId, bundle: BundleId, tier: FitTier, left = Infinity) {
  if (tier === "negative") return 0;
  const asked = tier === "mixed" ? 1 : Math.min(BUNDLES[bundle].units, customer.maxUnits);
  return Math.max(0, Math.min(asked, left, Math.floor(customer.budget / PRODUCTS[product].price)));
}

// 强推不看她的预算：她当场把钱付了，退货风险才会记在你名下。但柜上没有的支数，硬推也开不出来。
export const forcedUnits = (customer: Customer, bundle: BundleId, left = Infinity) => Math.min(BUNDLES[bundle].units, customer.maxUnits, left);

// 把话说满能多开出来的那一支：她信了"两周"，就要带走够用的两支。同样不看预算，理由和硬推一样。
export const claimUnits = (customer: Customer, left = Infinity) => Math.min(CLAIM_UNITS, customer.maxUnits, left);
// 这一格只在真能多带走一支时出现：一支都多不出来还照收一次合规，那是看不见的陷阱，不是一格选择。
// 和第 5 天断货那一屏删掉「等」是同一条判断（restocks）：最后一天没有「第二天早上」，
// 这句承诺的两次代价 —— 她查备案问回来、退货那天翻倍 —— 都落不了地，所以那天不按这格卖货。
export const canClaim = (s: Campaign, id: CustomerId, product: ProductId, bundle: BundleId) =>
  s.day < DAYS.length && product === CLAIM_PRODUCT && claimUnits(CUSTOMERS[id], s.stock[product]) > forcedUnits(CUSTOMERS[id], bundle, s.stock[product]);

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
  // 台词里可以出现 "{货}"，由她那张小票填上；没有小票（旧存档）才退回 fallback 那一支。
  // 抱怨本身跟货绑定的那两条另配 variants：退的是修护，就不能念"镜头里全是粉感"。
  fallback?: ProductId;
  variants?: Partial<Record<ProductId, { text: string; body: string }>>;
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
  { id: "shen", resolve: "shen-chargeback", fromDay: 3, trust: -8, compliance: -4, fallback: "glow", text: "沈薇退了那单{货}，说镜头里全是粉感", speaker: "退货 · 收银", body: "沈薇把{货}退了。她说近看全是粉，不会再帮你带货。", variants: { repair: { text: "沈薇退了那单修护，说她第二天还要上镜", body: "沈薇把修护退了。她说这瓶不是当天的妆，不会再帮你带货。" } } },
  { id: "mei", resolve: "mei-chargeback", fromDay: 3, trust: -6, compliance: -3, text: "梅女士客户会面翻车，客诉到专柜", speaker: "客诉 · 方敏", body: "梅女士说你卖的东西让她第二天更显疲态。客诉已记录。" },
  { id: "xiaoyu", resolve: "xiaoyu-chargeback", fromDay: 4, trust: -8, compliance: -4, text: "小雨面试前闷痘，妈妈来退货", speaker: "退货 · 收银", body: "小雨妈妈把那单退了。面试前爆痘的截图也在。" },
  { id: "zhou", resolve: "zhou-chargeback", fromDay: 4, trust: -6, compliance: -3, fallback: "glow", text: "周姐会议照片暗沉，她把对比发到了群里", speaker: "客诉 · 罗曼", body: "周姐把会议自拍发到了会员群。{货}暗沉的对比图还在。", variants: { repair: { text: "周姐退了那单修护，说她等不到第二天", body: "周姐把会议自拍发到了会员群。她要的是当天看得见的变化，这瓶太慢。" } } },
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
// 账本要能对回来：凡是动了 sales 的那一条，钱就写在自己那一行的末尾。
// 两个界面念账本都只念 history 这一份，所以数额在这一处出一次就够，不在 UI 里另算一遍。
export const receiptLine = (text: string, amount: number) => `${text}${amount ? ` · ${amount < 0 ? "−" : ""}¥${Math.abs(amount).toLocaleString("zh-CN")}` : ""}`;
// 反着读回去：账上写下的这些 ¥ 加起来必须等于大数字。规则动了钱却没写行，两个数就会分叉——规则测试盯的就是这一条。
export const ledgerSum = (s: Campaign) => s.history.reduce((sum, entry) => sum + [...entry.text.matchAll(/·\s*(−?)¥([\d,.]+)/g)]
  .reduce((part, hit) => part + (hit[1] ? -1 : 1) * Number(hit[2].replace(/,/g, "")), 0), 0);
// 让单给同事这件事只在两处提：让她演示那颗按钮，和入账那一行。措辞只有一份。
export const SPLIT_WORD = "与陆遥各半";
// 《化妆品监督管理条例》第三十九条要经营者"定期检查并及时处理变质或者超过使用期限的化妆品"。
// 抽屉最下面压着一批去年批号的小样，第 3 天品牌巡店要翻处理记录才被人想起来：
// 这一批整周就两支，所以这一遍只查得了一次；不查，派出去了她第二天会问回来。
export const EXPIRED_SAMPLING = { fromDay: 3, units: 2, minutes: 1, compliance: 6, standing: 3, penalty: 4 };
// 查过的证据只有一条：这一批下没下架。已经派出去的那几支不在柜上了，下架也不能凭空多扣。
export const expiredCleared = (s: Campaign) => s.flags.some(name => name.startsWith("checked:"));
export const expiredSamplesGiven = (s: Campaign) => s.flags.filter(name => name.startsWith("sample-expired:")).length;
export const expiredSamplesLeft = (s: Campaign) => s.day < EXPIRED_SAMPLING.fromDay || expiredCleared(s) ? 0
  : Math.max(0, EXPIRED_SAMPLING.units - expiredSamplesGiven(s));
// 这一步长在晨会那一屏：现场时间一旦花出去，就不存在"晚开门"这件事了。
export const canCheckCounter = (s: Campaign) => expiredSamplesLeft(s) > 0 && !s.finished
  && !s.activeSession && s.shiftMinutes === 0 && s.dayServed.length === 0;
export const CHECK_COUNTER_NOTE = "当场下架，台账上留下一条处理记录";
export function checkCounterLabel(s: Campaign) {
  if (expiredCleared(s)) return "查批号 · 到期那批已经下了";
  if (canCheckCounter(s)) return `开店前查一遍批号 · 下 ${expiredSamplesLeft(s)} 支 · 晚开门 ${EXPIRED_SAMPLING.minutes} 分钟`;
  return "查批号 · 已经开门了";
}
const handsExpiredSample = (s: Campaign) => !expiredCleared(s) && s.day >= EXPIRED_SAMPLING.fromDay
  && expiredSamplesGiven(s) < EXPIRED_SAMPLING.units;
// 一支到期小样只记在一个人身上：抽屉里那批就两支，柜上不能凭空派出一整周。
// 日次写进旗子，因为"问回来"是第二天的事 —— 当天回到现场不该先扣一遍（见 applyDawn 那道门）。
const markExpiredSample = (s: Campaign, id: CustomerId): Campaign =>
  handsExpiredSample(s) ? { ...s, flags: flag(s, `sample-expired:${id}:${s.day}`) } : s;
export const expiredQuestion = (id: CustomerId) => `${CUSTOMERS[id].name}问起你给的那支小样：批号是去年的`;
export const EXPIRED_SAMPLING_NOTICE = "活动周过半，巡店要翻化妆品处理记录。抽屉最下面那排小样，批号是去年的。";

export function checkCounter(s: Campaign): Campaign {
  const left = expiredSamplesLeft(s);
  if (!left || !canCheckCounter(s)) return s;
  const cleared: Campaign = {
    ...s,
    samples: Math.max(0, s.samples - left),
    compliance: clamp(s.compliance + EXPIRED_SAMPLING.compliance),
    standing: clamp(s.standing + EXPIRED_SAMPLING.standing),
    flags: flag(s, `checked:${s.day}`),
    history: history(s, `开店前查了一遍批号，下了 ${left} 支到期小样`),
  };
  return spendAttention(cleared, null, EXPIRED_SAMPLING.minutes);
}
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

// 退的是哪一支，认的是那张小票，不是排好的台词：同一个人可能被推两种货（P34 之后越界那单退的就是修护）。
// 旧存档没有 orders 才退回 entry 上写死的那一支 —— 那一句本来就是按它写的。
export const paybackProductOf = (s: Campaign, id: CustomerId): ProductId | null =>
  s.orders.find(order => order.customerId === id && order.risky)?.product ?? null;

export function paybackCopy(item: Payback, product: ProductId | null) {
  const variant = product ? item.variants?.[product] : undefined;
  if (variant) return variant;
  const short = product ? PRODUCTS[product].short : item.fallback ? PRODUCTS[item.fallback].short : "";
  return { text: item.text.replace(/\{货\}/g, short), body: item.body.replace(/\{货\}/g, short) };
}

// 她这一单要退多少：小票还在就按小票，旧存档没有小票才按当前模型估。
// 退货当天和第二天早晨念这条的人读的是同一个算式，所以两处都从这里取。
function paybackCharge(s: Campaign, item: Payback) {
  // Legacy v2 saves may lack orders; their transfer flags still constrain liability.
  const legacyShare = item.id === "xiaoyu" ? hasFlag(s, "tang-owes-order") ? 0 : hasFlag(s, "split-with-tang") ? .5 : 1 : 1;
  return s.orders.find(order => order.customerId === item.id && order.risky)?.amount ?? estimatedRiskAmount(item.id) * legacyShare;
}

function applyPayback(s: Campaign, item: Payback): Campaign {
  if (s.day < item.fromDay || !hasFlag(s, `served:${item.id}:risky`) || hasFlag(s, item.resolve)) return s;
  const relations = item.relation
    ? { ...s.relations, [item.relation.key]: s.relations[item.relation.key] + item.relation.delta }
    : s.relations;
  const charged = paybackCharge(s, item);
  const line = paybackCopy(item, paybackProductOf(s, item.id)).text;
  return {
    ...s,
    sales: Math.max(0, s.sales - charged),
    daySales: s.daySales - charged,
    trust: clamp(s.trust + item.trust),
    compliance: clamp(s.compliance + item.compliance),
    relations,
    flags: flag(s, item.resolve),
    // 退掉的是真金白银，那一行就得写下退了多少；写的是从大数字上掉下来多少，不是账面应收。
    history: history(s, receiptLine(line, -Math.min(charged, s.sales))),
  };
}

// 私域这条线在真实柜台上是有节奏的：小样发出去、微信加上，都不算完 —— 当晚跟一句，她才会回柜。
// 一晚上跟不了几个人，所以"跟谁"是个要放弃一些人的决定；同一个人整周只跟一次，第二次就是骚扰。
export const TOUCHES_PER_EVENING = 2;
const TOUCH_PREFIX = "touched:";
export const wasTouched = (s: Campaign, id: CustomerId) => s.flags.some(f => f.startsWith(`${TOUCH_PREFIX}${id}:`));
// 今晚用掉几条，读的是当天那一批 flag：不为此新开一个数值字段，存档格式仍然只有 flags 一套。
export const touchesLeft = (s: Campaign) => TOUCHES_PER_EVENING - s.flags.filter(f => f.startsWith(TOUCH_PREFIX) && f.endsWith(`:${s.day}`)).length;

const SAMPLE_RETURN_BY_ID = new Map(SAMPLE_RETURNS.map(item => [item.id, item]));
// 一条回访只跟得动一条本来就存在的线。下面这两个判据用的就是兑现处那几个条件，
// 所以面板上写给她的那句"你在等她回来"不会比规则真正给的更多。
function sampleReturnDue(s: Campaign, id: CustomerId) {
  const item = SAMPLE_RETURN_BY_ID.get(id);
  return Boolean(item) && hasFlag(s, `sample:${id}`)
    && (hasFlag(s, `served:${id}:refused`) || hasFlag(s, `lost:${id}`)) && !hasFlag(s, item!.resolve);
}
function memberRepeatDue(s: Campaign, id: CustomerId) {
  return s.members.includes(id) && s.orders.some(order => order.customerId === id && !order.risky) && !hasFlag(s, `member-repeat:${id}`);
}

export type TouchKind = "sample" | "repeat";
// 两个人都在线的时候，先说小样那一头：她那句"回去试试"还悬着。
export const touchKind = (s: Campaign, id: CustomerId): TouchKind | null =>
  sampleReturnDue(s, id) ? "sample" : memberRepeatDue(s, id) ? "repeat" : null;

export type TouchThread = { id: CustomerId; kind: TouchKind; detail: string };

// 第 5 晚之后没有早晨了：最后那一晚跟谁，都不会再有人回来。
export function touchThreads(s: Campaign): TouchThread[] {
  if (s.day >= 5) return [];
  const threads: Array<TouchThread> = [];
  for (const id of Object.keys(CUSTOMERS) as CustomerId[]) {
    if (wasTouched(s, id)) continue;
    const kind = touchKind(s, id);
    if (!kind) continue;
    threads.push({ id, kind, detail: kind === "sample"
      ? "拿了小样，那单没成"
      : "名单上，也在你这里成过单" });
  }
  return threads;
}

// 她回的那句话用的是她自己排第一的那条诉求：离开了柜台，她说的还是那件事，只是终于说完整。
export function touchReply(s: Campaign, id: CustomerId) {
  const customer = CUSTOMERS[id];
  const demand = TRAIT_LABELS[customer.demands[0].trait];
  return touchKind(s, id) === "repeat"
    ? `${customer.name}回：「那支我用完了。我最在意的是：${demand}。这条你说到做到，我在微信上跟你开口。」`
    : `${customer.name}回：「那支我在用。我最在意的是：${demand}。这条你说得对，哪天路过我再来找你。」`;
}

export function applyTouch(s: Campaign, id: CustomerId): Campaign {
  if (s.finished || touchesLeft(s) <= 0 || !touchThreads(s).some(thread => thread.id === id)) return s;
  return { ...s, flags: flag(s, `${TOUCH_PREFIX}${id}:${s.day}`), history: history(s, `当晚你跟进了${CUSTOMERS[id].name}那条线`) };
}

// 今晚已经跟过谁，两个界面都从这一句读：回复的话由规则给，不在 UI 各拼一份。
export const tonightTouches = (s: Campaign): CustomerId[] => s.flags
  .filter(f => f.startsWith(TOUCH_PREFIX) && f.endsWith(`:${s.day}`))
  .map(f => f.slice(TOUCH_PREFIX.length, f.lastIndexOf(":")) as CustomerId);

function applySampleReturn(s: Campaign, item: (typeof SAMPLE_RETURNS)[number]): Campaign {
  const refusedOrLost = hasFlag(s, `served:${item.id}:refused`) || hasFlag(s, `lost:${item.id}`);
  // 小样不会自己说话：发出去那一晚没跟上的，她就顺着别柜的微信走了。
  if (s.day < item.fromDay || !wasTouched(s, item.id) || !hasFlag(s, `sample:${item.id}`) || !refusedOrLost || hasFlag(s, item.resolve)) return s;
  return {
    ...s,
    sales: s.sales + SAMPLE_RETURN_SALE,
    daySales: s.daySales + SAMPLE_RETURN_SALE,
    trust: clamp(s.trust + 5),
    flags: flag(s, item.resolve),
    history: history(s, receiptLine(item.text, SAMPLE_RETURN_SALE)),
  };
}

// 晨会念的是昨天那条线：到昨天为止这个柜位应该做到多少，账上实际有多少。
export const progressTarget = (throughDay: number) => DAY_TARGETS.slice(0, Math.max(0, Math.min(5, Math.trunc(throughDay)))).reduce((sum, value) => sum + value, 0);
const money = (value: number) => value.toLocaleString("zh-CN");
// 晨会看"到昨天为止"，闭店事件看"到今天为止"：同一份进度，两个时点。
export const thisWeekPercent = (s: Campaign) => { const need = progressTarget(s.day); return need ? Math.round(s.sales / need * 100) : 100; };

export type CounterReading = { key: string; speaker: string; body: string; text: string; standing: number; roman: number };

// 纯函数：只读当前状态、不写 flag，所以 dawnNotices 反复算出的都是同一句话。
// 分母是昨天那条线，分子是账上现在的钱（含今早到账 —— 见 `applyDawn` 末尾那句注释），所以三个分支都把线说成
// 「昨天那条线」、把数说成「你账上」：写成「累计 X%」时玩家读到的是"这一周到昨天已经 125%"，而那句话从来不是这个意思，
// 同一屏下面「自己垫一支走单」又是按今天的线给的（差 ¥2,000）—— 落后与否在一屏里得到两个答案，界面没说为什么。
export function morningReview(s: Campaign): CounterReading | null {
  if (s.day < 2) return null;
  const need = progressTarget(s.day - 1);
  const done = Math.round((need ? s.sales / need : 1) * 100);
  const base = { key: `morning:${s.day}`, speaker: "晨会 · 罗曼", standing: 0, roman: 0 };
  if (done >= 100) return { ...base, standing: 5, roman: 2, text: `晨会 · 昨天那条线达成 ${done}%，进度在你这边`, body: `罗曼念的是昨天那条线 ¥${money(need)}：你已经 ${done}%。区域周会上，她把这个柜位排在前面。` };
  if (done >= 80) return { ...base, text: `晨会 · 昨天那条线达成 ${done}%，差一点`, body: `罗曼没有点名：昨天那条线 ¥${money(need)}，你做到 ${done}%，她说还差最后一天的量。` };
  return { ...base, standing: -8, roman: -3, text: `晨会 · 昨天那条线达成 ${done}%，区域开始问柜位`, body: `昨天那条线 ¥${money(need)}，你只做到 ${done}%。罗曼合上表格，说区域在问这个柜位还要不要留。` };
}

// 活动过半看名单，巡店当天看小样：这两项才是品牌真正在数的东西。
// 卡顶按「通道 · 主题」写（和第 5 早那条「巡店 · 派样数据」同一副语法）：不挂人名，因为这一张不是罗曼发来的，
// 是品牌在数名单 —— 而同一屏上面那条「晨会 · 罗曼」念的是进度。两张顶着一样的标签，玩家看见的是"同一封信寄了两遍"。
export function counterCheck(s: Campaign): CounterReading | null {
  if (s.day === 4) {
    if (s.members.length >= MEMBER_MIN_FOR_CREDIT) return { key: `roster:${s.day}`, speaker: "晨会 · 私域名单", standing: 4, roman: 3, text: `晨会 · 私域名单 ${s.members.length} 人`, body: `品牌在数企微名单，你手上有 ${s.members.length} 个。罗曼说这些人明年还在。` };
    if (!s.members.length) return { key: `roster:${s.day}`, speaker: "晨会 · 私域名单", standing: -4, roman: -2, text: "晨会 · 私域名单为空", body: "品牌在数企微名单，你一条都没加。罗曼只问了一句：那这些人以后找谁？" };
    return null;
  }
  if (s.day === 5) {
    if (s.samples >= 6) return { key: `sampling:${s.day}`, speaker: "巡店 · 派样数据", standing: -4, roman: 0, text: `巡店 · ${s.samples} 份小样没有派出去`, body: `后仓盘出你还压着 ${s.samples} 份小样。派样率是品牌看的数，没发出去的东西不算柜位的功劳。` };
    if (s.samples <= 2) return { key: `sampling:${s.day}`, speaker: "巡店 · 派样数据", standing: 3, roman: 0, text: "巡店 · 小样派得干净", body: "小样几乎发空了，领用记录一条条对得上。方敏说：这才是干活的样子。" };
  }
  return null;
}

// 一周的账不只按总额结：连带率（件/单）和"没等到的人"是同一枚硬币的两面 ——
// 多要的那一件是从另一边还在等的人身上借分钟（`resolveSale` 按件数扣现场时间）。
// 只从 orders 与 `lost:` 旗推，不新开存档字段。故意不带 ¥：`sales` 里有转单、小样回柜、微信补单这些
// 不写 orders 的入账（探针量到每条路线 ¥980，私域那条 ¥8,260），件数和金额放进同一句就是两种口径。
// 第 4 天才念：前三早手上只有 1~4 单，"平均一单几件"在那个样本上没有意义（推导见 docs/DESIGN.md 的 P26）。
export const STRUCTURE_FROM_DAY = 4;

export function weekStructure(s: Campaign) {
  const tickets = s.orders.length;
  const units = s.orders.reduce((sum, order) => sum + order.units, 0);
  const walked = s.flags.filter(name => name.startsWith("lost:")).length;
  return { tickets, units, walked, perTicket: tickets ? Math.round(units / tickets * 10) / 10 : 0 };
}

// 一句不带方向的描述：只说这一周的钱和件数是怎么摊开的，不评级（评级是 `counterCheck` 那一档的事）。
export function structureLine(s: Campaign) {
  const { tickets, units, walked, perTicket } = weekStructure(s);
  if (!tickets) return `一单没开${walked ? ` · ${walked} 位没等到你` : ""}`;
  // 一个都没走的时候不念"0 位没等到你"：那是没有发生的事，不是发生了一件叫 0 的事。
  return `这周开了 ${tickets} 单、带走 ${units} 件 · 平均一单 ${perTicket} 件${walked ? ` · 另有 ${walked} 位没等到你` : ""}`;
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

// 私域复购：加过粉、真在她那里成过单、而且那一晚你跟她跟进过的人，才会在最后一天自己在微信上补一支。
// 这一句既是账本上的一行，也是晨会念的那一句，两处不能各写一遍。
const memberRepeatLine = (id: CustomerId, product: ProductId) => `${CUSTOMERS[id].name}在微信上补了一支${PRODUCTS[product].short}`;

function applyMemberRepeat(s: Campaign): Campaign {
  if (s.day < 5) return s;
  let next = s;
  for (const id of next.members) {
    const order = next.orders.find(item => item.customerId === id && !item.risky);
    const guard = `member-repeat:${id}`;
    if (!order || hasFlag(next, guard) || !wasTouched(next, id)) continue;
    const amount = PRODUCTS[order.product].price;
    next = {
      ...next, sales: next.sales + amount, daySales: next.daySales + amount, trust: clamp(next.trust + 3),
      // 晨会念她补了哪一支（不带钱），账本上这一行要把钱写下，否则累计就凭空多出来一截。
      flags: flag(next, guard), history: history(next, receiptLine(memberRepeatLine(id, order.product), amount)),
    };
  }
  return next;
}

export function applyDawn(s: Campaign): Campaign {
  let next = s;
  // 第 1 天那批已经在柜上（INITIAL.stock），从第 2 天起每早补一次；旗子挡住"重复过晨会 = 双倍到货"。
  if (s.day > 1 && !hasFlag(next, `delivered:${s.day}`)) {
    const batch = DELIVERIES[s.day - 1];
    next = {
      ...next,
      stock: { soft: next.stock.soft + batch.soft, glow: next.stock.glow + batch.glow, repair: next.stock.repair + batch.repair },
      flags: flag(next, `delivered:${s.day}`),
    };
  }
  // 到期那批没当场下架，派出去的人第二天就会问回来：品牌要的是"谁在处理、什么时候处理"，柜上答不上来。
  // 和越界那一句同一套节奏，所以同一道日次门：`openFloorState` 当天回到现场也走这里，不加就当下午被追问一次。
  // 旧存档那面旗不带日次 —— 按 0 处理，那本来就是"今天之前派出去"的意思。
  for (const name of [...next.flags]) {
    if (!name.startsWith("sample-expired:")) continue;
    const [id, stamped] = name.slice("sample-expired:".length).split(":");
    const day = Number(stamped ?? 0);
    if (next.day <= day) continue;
    if (hasFlag(next, `expired-raised:${id}:${day}`)) continue;
    next = {
      ...next, trust: clamp(next.trust - EXPIRED_SAMPLING.penalty), compliance: clamp(next.compliance - EXPIRED_SAMPLING.penalty),
      flags: flag(next, `expired-raised:${id}:${day}`), history: history(next, expiredQuestion(id as CustomerId)),
    };
  }
  // 越界那一句不会当天爆：她回家翻备案、截图发回来，是第二天早上的事（和到期小样同一套节奏）。
  // 但"第二天"按旗子上那个日次算：`openFloorState` 当天回到现场也走这里，不加这道门就当下午被追问一次。
  for (const name of [...next.flags]) {
    if (!name.startsWith("claim:")) continue;
    const [id, day] = name.slice("claim:".length).split(":");
    if (next.day <= Number(day)) continue;
    if (hasFlag(next, `claim-raised:${id}:${day}`)) continue;
    next = {
      ...next, trust: clamp(next.trust + CLAIM_ASKBACK_TRUST),
      flags: flag(next, `claim-raised:${id}:${day}`), history: history(next, claimQuestion(id as CustomerId)),
    };
  }
  if (s.day === 4 && hasFlag(s, "tang-owes-order") && !hasFlag(s, "tang-paid-order")) {
    // 她私下转过来这一单不进收银小票：钱只写在账本这一行上，否则累计就是一笔凭空多出来的数。
    const booked = TANG_PAYBACK;
    next = { ...next, sales: next.sales + booked, daySales: next.daySales + booked, flags: flag(next, "tang-paid-order"), history: history(next, receiptLine("唐可把一单伴娘妆转到你名下", booked)) };
  }
  if (s.day === 5 && hasFlag(s, "protected-zhao") && !hasFlag(s, "zhao-daughter-order")) {
    const booked = 1680;
    next = { ...next, sales: next.sales + booked, daySales: next.daySales + booked, trust: clamp(next.trust + 6), flags: flag(next, "zhao-daughter-order"), history: history(next, receiptLine("赵青加你微信，下了一单修护", booked)) };
  }
  if (s.day === 5 && hasFlag(s, "zhao-risk-sale") && !hasFlag(s, "zhao-complaint")) {
    next = { ...next, trust: clamp(next.trust - 10), compliance: clamp(next.compliance - 8), flags: flag(next, "zhao-complaint"), history: history(next, "赵女士女儿过敏，客诉已立案") };
  }
  if (s.day === 5 && hasFlag(s, "promise-zhao-return") && !hasFlag(s, "zhao-returned")) {
    // A forced order is already refunded by RISKY_RETURNS below.
    const charged = hasFlag(s, "served:zhao:risky") ? 0 : s.orders.find(order => order.customerId === "zhao")?.amount ?? estimatedOrderAmount("zhao", "positive");
    next = { ...next, sales: Math.max(0, next.sales - charged), daySales: next.daySales - charged, flags: flag(next, "zhao-returned"), history: history(next, receiptLine("赵女士按承诺退了那单", -Math.min(charged, next.sales))) };
  }
  // 她回来这件事要留在因果账本里，不能只算晨会念的一句话。
  if (s.day === 5 && hasFlag(s, "served:anjie:good") && !hasFlag(s, "anjie-came-back")) {
    next = { ...next, flags: flag(next, "anjie-came-back"), history: history(next, "安姐赶在化妆师之前回来，只要当天的妆") };
  }
  // 垫的那一支第二天必须有个去处。认的是唐可肯不肯替你张罗：和她借货、替她出货是同一条关系（`TANGKE_STOCK_GATE`）。
  // 出掉了钱也不再进一次 sales —— 那 980 昨天已经入账，再进一次就是把同一支货卖了两遍。
  // 出不掉才是真代价：货压在自己家里，数字却留在账上，方敏要的是一个写得出客人名字的说法。
  if (s.day === 5 && hasFlag(s, "advance-order") && !hasFlag(s, "advance-out") && !hasFlag(s, "advance-held")) {
    const sold = next.relations.tangke >= TANGKE_STOCK_GATE;
    next = {
      ...next,
      compliance: clamp(next.compliance + (sold ? 0 : ADVANCE_HELD_COMPLIANCE)),
      standing: clamp(next.standing + (sold ? 0 : ADVANCE_HELD_STANDING)),
      relations: sold ? { ...next.relations, tangke: next.relations.tangke + 5 } : next.relations,
      flags: flag(next, sold ? "advance-out" : "advance-held"),
      history: history(next, sold
        ? "唐可把垫的那支出给了真正要用的熟客，钱回到你口袋里"
        : "垫的那支还在你家里，没有客人名字"),
    };
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
    // 小票还在，钱却是从累计里整笔拿走的：不写下拿走的数额，结局那一屏就少一笔说不清的钱。
    history: history(s, receiptLine("沈薇团队发现效果不稳定，批量单暂扣", -Math.min(charged, s.sales))),
  };
}

// 兑现的那一句早上念一次：认的是今天这笔流水，不是排定的天数 —— 跟进晚一天，线就会晚一天回来。
// 账本上那一行末尾还跟着数额（· ¥620），所以这里认的是"这句话开头"，不是整句相等。
const landedToday = (s: Campaign, text: string) => s.history.some(entry => entry.day === s.day && (entry.text === text || entry.text.startsWith(`${text} · `)));

export function dawnNotices(s: Campaign): DawnNotice[] {
  const notes: DawnNotice[] = [];
  // 微信里的事合成一条通知：一个聊天框连着好几条消息，在界面上不该长成好几张卡（P30 量的第 5 早：
  // 脚顶以上 260px 只放得下三条 64px 的卡，而那天有四个人的回音）。名字写在句子前面，谁说的、说了几次都不丢。
  const wechat: string[] = [];
  for (const reading of [morningReview(s), counterCheck(s)]) {
    if (reading && hasFlag(s, reading.key)) notes.push({ speaker: reading.speaker, body: reading.body });
  }
  // 垫出去的那一支第二天早上一念定音：钱回没回来是玩家自己该知道的事，念一次就够（旗决定，不重复）。
  if (hasFlag(s, "advance-out")) notes.push({ speaker: "唐可 · 柜后", body: `昨天那张单是她替你开的，货她今天出给了一个真正要用的熟客：¥${money(advancePocket())} 回到你口袋里。大数字一分没多，你只是没亏。` });
  if (hasFlag(s, "advance-held")) notes.push({ speaker: "方敏 · 合规", body: `账上那 ¥${money(ADVANCE_SALE)} 找不到对应的客人。方敏要你写一份说明：这一支是谁买走的，货现在在哪里。` });
  // 这一遍自查不是柜上自己想起来的：第 3 天早上品牌说要翻处理记录，晨会念一次，那一屏上才长出这个动作。
  if (s.day === EXPIRED_SAMPLING.fromDay && !expiredCleared(s)) notes.push({ speaker: "品牌 · 巡店", body: EXPIRED_SAMPLING_NOTICE });
  if (s.day === 4 && hasFlag(s, "tang-paid-order")) notes.push({ speaker: "唐可 · 交接", body: "她把一单伴娘妆转到你名下。口头承诺这次兑现了。" });
  if (s.day === 5 && hasFlag(s, "zhao-daughter-order")) wechat.push("赵青：妈妈说可以信你。我买了那支修护。");
  if (s.day === 5 && hasFlag(s, "zhao-complaint")) notes.push({ speaker: "客诉 · 方敏", body: "赵女士女儿过敏，这条已经进档案。" });
  if (s.day === 5 && hasFlag(s, "zhao-returned")) notes.push({ speaker: "退货 · 收银", body: "赵女士按你写下的承诺退了那单。" });
  if (anjieComesBack(s)) wechat.push("安姐：上周听你的，只用了修护，今天脸是稳的。化妆师两点到，我早上先过来拿当天的妆。");
  // 到期小样不是当场翻脸，是台账上答不上来：她只问一句，而这一句让品牌看见你没在处理。
  for (const name of s.flags) {
    if (!name.startsWith("sample-expired:")) continue;
    const id = name.slice("sample-expired:".length).split(":")[0] as CustomerId;
    if (landedToday(s, expiredQuestion(id))) wechat.push(`${CUSTOMERS[id].name}：你那支小样我回家才看到批号，是去年的。脸倒没什么，就是以后不敢随手试了。`);
  }
  // 越界那一句走的是同一条通道：她不在柜台上翻脸，是回家翻备案，第二天在微信里问回来。
  for (const name of s.flags) {
    if (!name.startsWith("claim:")) continue;
    const id = name.slice("claim:".length).split(":")[0] as CustomerId;
    if (landedToday(s, claimQuestion(id))) wechat.push(`${CUSTOMERS[id].name}：我回去搜了备案，那支写的是舒缓，没有淡斑这项。`);
  }
  // 退货和客诉走的是柜台的通道（收银、方敏、罗曼、苏蔓），不和微信混在一条里。
  for (const item of RISKY_RETURNS) {
    if (!hasFlag(s, item.resolve)) continue;
    // 台账那一行和晨会这一张卡认的是同一条生成式（`memberRepeatLine` 那条先例）：
    // 台词按小票上那一支生成，两处各写一遍就会在第二天早上错开。
    const copy = paybackCopy(item, paybackProductOf(s, item.id));
    if (landedToday(s, copy.text)) notes.push({ speaker: item.speaker, body: copy.body });
  }
  for (const item of SAMPLE_RETURNS) {
    if (hasFlag(s, item.resolve) && landedToday(s, item.text)) wechat.push(`${CUSTOMERS[item.id].name}：${item.body}`);
  }
  // 名单上的人自己补的那一支也要在早上念出来，不然账上的钱是凭空多出来的。
  const repeats = s.day === 5 ? s.members.flatMap(id => {
    if (!hasFlag(s, `member-repeat:${id}`)) return [];
    const order = s.orders.find(item => item.customerId === id && !item.risky);
    // 台账那一行不带句号（`memberRepeatLine` 两处共用），念给人听的那一句要带上。
    return order ? [`${memberRepeatLine(id, order.product)}。`] : [];
  }) : [];
  if (repeats.length) wechat.push(...repeats);
  if (wechat.length) notes.push({ speaker: "私域 · 微信", body: wechat.join(" ") });
  // 例行的两条排最后：它们每天都在，漏看一眼不影响今天怎么接人（货数在抽屉里还有一份，结构到结局那一屏也还在）。
  // 上面那些"因为你上一手才出现"的一条只在这一屏念一次 —— 晨会改成整屏滚之后，被脚压住的正是表尾（P29 量的那张表：
  // 第 5 早 1280×800 上第 4 条只露 8/64px、第 5 条整条 0px），所以表尾要留给可以补看的那两条。
  notes.push({ speaker: "品牌 · 到货", body: deliveryWord(s.day) });
  // 总额之外没人念结构：这一行从第 4 早起跟着你，到结局那一屏还在。
  if (s.day >= STRUCTURE_FROM_DAY && s.orders.length) notes.push({ speaker: "日报 · 柜台", body: structureLine(s) });
  return notes;
}

// Ownership changes alter the credited order too, so future chargebacks never
// refund a colleague's share. Keep the original receipt total for the ledger.
// 这单此刻记在你名下多少，第 2 晚那三条按钮上写的就是多少：钱由下面这个数动，字也由同一个数生成。
function xiaoyuOrderAmount(s: Campaign): number {
  const order = s.orders.find(order => order.customerId === "xiaoyu");
  return order?.amount ?? (hasFlag(s, "served:xiaoyu:good") ? estimatedOrderAmount("xiaoyu", "positive") : hasFlag(s, "served:xiaoyu:risky") ? estimatedRiskAmount("xiaoyu") : 0);
}

function transferXiaoyuOrder(s: Campaign, fraction: number): Campaign {
  const order = s.orders.find(order => order.customerId === "xiaoyu");
  const transferred = xiaoyuOrderAmount(s) * fraction;
  return { ...s, sales: Math.max(0, s.sales - transferred), daySales: s.daySales - transferred,
    orders: s.orders.map(item => item === order ? { ...item, amount: item.amount - transferred, shared: true } : item) };
}

function hasPurchase(s: Campaign, id: CustomerId) {
  // Completed consultation is not proof of payment; successful legacy flags are.
  return s.orders.some(order => order.customerId === id) || hasFlag(s, `served:${id}:good`) || hasFlag(s, `served:${id}:risky`);
}

// 闭店事件里有些选项要先看关系和名单，界面试的也是这一份。
export const visibleChoices = (s: Campaign, event: DayEvent) => event.choices.filter(choice => !choice.visible || choice.visible(s));

// 第 3 晚那一击只在她真的从小雨手里卖出过东西之后才成立：没有那一单，就没有那张截图。
// 格子一律加在数组尾巴上 —— 模拟器在没命中 CLEAN_EVENTS 时取的是 choices[0]，原来那三条的位置不能动。
function priceCards(s: Campaign): EventChoice[] {
  if (!hasPurchase(s, "xiaoyu")) return [];
  const withWechat = s.members.includes("xiaoyu");
  return [
    {
      id: "price-explain",
      // 名字写进按钮：第 3 晚那张卡的抬头是她们的（赵女士的过敏 / 罗曼催数据），小雨这一格是同一屏上的第二条线。
      label: "回小雨：不退差，讲价盘",
      // 名单写进第二行：这句话传不传得出去，按下去之前就看得见（和 P23/P24 那两条"按钮要说清买到什么"同一种写法）。
      detail: `票面不动 · 说清那 ¥${money(PRICE_GAP)} 是旗舰店券后价 · ${withWechat ? "她在你名单里，这话传得出去" : "她没有你的微信，这话传不出去"}`,
      result: withWechat
        ? "她把你说的那段原话转给她妈妈：专柜至少不糊弄人。订单留下了，人也在你名单里。"
        : "她回了个「哦」。订单留下了，可你没有她的微信——明天她想核对这句话，找不到人。",
      apply: st => ({ ...st,
        // 同一句解释，说得出和说得进去是两件事：早上加过她微信的，这句话第二天还有人替你传。
        trust: clamp(st.trust + (st.members.includes("xiaoyu") ? 9 : 4)),
        compliance: clamp(st.compliance + 5),
        evidence: st.evidence + (st.members.includes("xiaoyu") ? 1 : 0),
        flags: flag(st, "price-explained"), history: history(st, "你按品牌价盘向小雨解释了那张券后价") }),
    },
    {
      id: "price-pad",
      label: "回小雨：垫两支小样",
      detail: `样品 −${PRICE_PAD_SAMPLES} · 不登记 · 空位留在你自己台账上`,
      // 抽屉里没有就不能按：和安姐那两格同一道闸。
      visible: st => st.samples >= PRICE_PAD_SAMPLES,
      result: "她说「这样我心里就平衡了」。两支旅行装进了她的包，收银条上什么都没有。",
      apply: st => ({ ...st, samples: Math.max(0, st.samples - PRICE_PAD_SAMPLES), trust: clamp(st.trust + 3), compliance: clamp(st.compliance - 8), flags: flag(st, "price-padded"), history: history(st, "你拿未登记的小样补了小雨的差价") }),
    },
  ];
}

// 那一晚说的话，第二天得念得到。只往当晚那张卡上补一句，不新增卡片：晨会那一屏的位置是 P29/P30 量出来的。
function priceEcho(s: Campaign): string {
  if (hasFlag(s, "price-explained")) return s.members.includes("xiaoyu")
    ? " 小雨把你说的那段话原样发进了她的面试群：柜台上至少有人肯把价格说清。"
    : " 小雨没有再回你。你连想补一句的人在哪里都不知道。";
  if (hasFlag(s, "price-padded")) return " 苏蔓路过抽屉时停了一下，问你那两支旅行装领给谁了。你说不上来。";
  return "";
}

// 她那句"少 ¥280"得先被念出来，按钮才有出处。
const priceAsk = (s: Campaign) => (hasPurchase(s, "xiaoyu")
  ? ` 同一时间小雨发来旗舰店预售截图：同款到手比你的票面少 ¥${money(PRICE_GAP)}，她问柜台能不能退差。` : "");

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
        { id: "split-tang", label: "提出平分", detail: `业绩 −¥${money(xiaoyuOrderAmount(s) / 2)} · 各退一步，这单的一半`, result: "唐可接受了。你少了一点数字，却多了一个愿意交接顾客的人。", apply: st => ({ ...transferXiaoyuOrder(st, .5), relations: { ...st.relations, tangke: st.relations.tangke + 14 }, flags: flag(st, "split-with-tang"), history: history(st, "你与唐可平分了小雨的订单") }) },
        { id: "beat-tang", label: "拿出服务记录", detail: `按有效接待规则据理力争 · 业绩 ¥${money(xiaoyuOrderAmount(s))} 一分不让`, result: "订单归你。唐可无法反驳，但开始把你视作真正的竞争者。", apply: st => ({ ...st, evidence: st.evidence + 1, relations: { ...st.relations, tangke: st.relations.tangke - 5 }, flags: flag(st, "beat-tang-with-record"), history: history(st, "你用服务记录赢下订单归属") }) },
        // 这一格买的是"今天归零、第 4 天回一笔大的"：两边的数不写出来，玩家就只能凭一句口头承诺下注。
        { id: "yield-tang", label: "把单让给她", detail: `业绩 −¥${money(xiaoyuOrderAmount(s))} 全归她 · 第 4 天她转回一单 ¥${money(TANG_PAYBACK)}`, result: "唐可答应欠你一单。这张单不进收银系统，只有她柜上那句口头话，但她的敌意明显下降。", apply: st => ({ ...transferXiaoyuOrder(st, 1), relations: { ...st.relations, tangke: st.relations.tangke + 22 }, flags: flag(st, "tang-owes-order"), history: history(st, "你把小雨的订单让给了唐可") }) },
      ],
    };
  }
  if (s.day === 3) {
    const price = priceCards(s);
    if (!hasPurchase(s, "zhao")) return {
      speaker: "罗曼", speakerStaff: "roman", speakerCustomer: null, title: "总部还在催修护数据",
      body: "赵女士没买就走了。罗曼没有骂你，只把区域群的截图转给你：今天这款必须有数。" + priceAsk(s),
      choices: [
        { id: "push-data", label: "用别的订单顶数据", detail: "数字好看，记录不干净", result: "群里安静了。方敏的文件夹里多了一条对不上的数。", apply: st => ({ ...st, compliance: clamp(st.compliance - 10), relations: { ...st.relations, roman: st.relations.roman + 4 }, flags: flag(st, "faked-repair-data"), history: history(st, "你用别的订单顶了修护数据") }) },
        { id: "tell-truth", label: "如实说没做成", detail: "挨复盘，不造假", result: "罗曼让你留下十分钟。她没有帮你圆。", apply: st => ({ ...st, relations: { ...st.relations, roman: st.relations.roman - 4 }, flags: flag(st, "admitted-zhao-miss"), history: history(st, "你向罗曼承认赵女士那单没做成") }) },
        { id: "ask-suman", label: "请苏蔓帮你补一个老客", detail: "人情换数字", result: "苏蔓打了电话。数字有了，人情账也有了。", apply: st => ({ ...st, sales: st.sales + 980, daySales: st.daySales + 980, relations: { ...st.relations, suman: st.relations.suman - 6 }, flags: flag(st, "borrowed-suman-customer"), history: history(st, "你请苏蔓用老客帮你补了数据") }) },
        ...price,
      ],
    };
    return {
      speaker: "赵女士", speakerStaff: null, speakerCustomer: "zhao", title: "女儿发来一张过敏记录",
      body: "闭店前，她发来女儿的过敏记录：刚买的新品含有一种曾让女儿过敏的香精。订单已经入账，你现在可以主动联系她换货，也可以保留这笔销售。" + priceAsk(s),
      choices: [
        { id: "protect-zhao", label: "换低价基础款", detail: "少卖 ¥700，避免已知风险", result: "赵女士松了口气。当天数字下降，但她把你的微信推给了女儿。", apply: st => ({ ...st, sales: Math.max(0, st.sales - 700), daySales: Math.max(0, st.daySales - 700), trust: clamp(st.trust + 12), flags: flag(st, "protected-zhao"), history: history(st, "你主动降低赵女士的客单避免过敏") }) },
        { id: "risk-zhao", label: "解释概率后成交", detail: "让她自己承担选择", result: "订单留下了。你说清了风险，却知道她并没有真正听懂。", apply: st => ({ ...st, trust: clamp(st.trust - 3), compliance: clamp(st.compliance - 3), flags: flag(st, "zhao-risk-sale"), history: history(st, "赵女士知情后仍买下新品") }) },
        { id: "promise-zhao", label: "写下退换承诺", detail: "保留销售，并承诺不适可退", result: "你保住数字，也背上一个有时间戳的售后承诺。", apply: st => ({ ...st, trust: clamp(st.trust + 5), evidence: st.evidence + 1, flags: flag(st, "promise-zhao-return"), history: history(st, "你向赵女士写下无条件退换承诺") }) },
        ...price,
      ],
    };
  }
  // 第 4 晚才给这一格：前三晚的缺口还来得及靠接待补，第四晚已经来不及了 —— 这正是它真实出现的时机。
  // 价目写在按钮第二行（和「迎上去」「留小样」同一种语法）：涨的是小票上的 980，掏的是自己工资里的 686。
  // 最后那一个是这一格存在的原因：闸按今天的线算（`visible`），所以差额在这里必定是正数，写出来玩家才能把
  // 上面那条「昨天那条线达成 125%」和这一格放在一起读 —— 两个时点，两条线，不用猜。
  const advanceCard: EventChoice = {
    id: "advance-order",
    label: "自己垫一支走单",
    detail: `业绩 +¥${money(ADVANCE_SALE)} · 你先掏 ¥${money(advancePocket())} · 今天这条线还差 ¥${money(progressTarget(s.day) - s.sales)} · 台账上多一笔虚增`,
    result: "唐可替你在系统里开了那张单。收银条写着你的名字，货搬进你自己的包。",
    // 两道闸：当晚没结过（`settleDayEvent` 认 eventDoneDays）+ 这一整周没垫过。
    // 注意 `visible` 是按当下状态算的，按下去之后它会翻假 —— 手机版的确认屏因此不能只读 visibleChoices。
    visible: st => !hasFlag(st, "advance-order") && thisWeekPercent(st) < 100,
    apply: st => ({
      ...st,
      sales: st.sales + ADVANCE_SALE,
      daySales: st.daySales + ADVANCE_SALE,
      compliance: clamp(st.compliance + ADVANCE_COMPLIANCE),
      relations: { ...st.relations, tangke: st.relations.tangke + ADVANCE_TANGKE },
      flags: flag(st, "advance-order"),
      history: history(st, "你把一支柔焦买下来，走成今天的单"),
    }),
  };
  if (s.day === 4 && !hasPurchase(s, "anjie")) return {
    speaker: "苏蔓", speakerStaff: "suman", speakerCustomer: null, title: "没留下的婚礼单",
    body: "安姐没有在你这里下单。苏蔓收起准备好的旅行装：她跟了我三年。今天没卖成，也不能把原因藏起来。" + priceEcho(s),
    choices: [
      { id: "record-anjie-miss", label: "如实交接试用记录", detail: "不补销售，不隐瞒风险", result: "苏蔓没有责怪你。她把记录留给下次接待的人，这至少不是一场没人负责的失败。", apply: st => ({ ...st, evidence: st.evidence + 1, flags: flag(st, "recorded-anjie-miss"), history: history(st, "你向苏蔓交接了未成交的婚礼咨询") }) },
      { id: "own-anjie-miss", label: "承认没能接住她", detail: "承担复盘，不伪造订单", result: "苏蔓让你明天一起复盘。她听见你没有拿顾客的敏感当借口。", apply: st => ({ ...st, relations: { ...st.relations, suman: st.relations.suman + 3 }, flags: flag(st, "owned-anjie-miss"), history: history(st, "你承担了婚礼单未成交的复盘") }) },
      advanceCard,
    ],
  };
  if (s.day === 4) return {
    speaker: "安姐", speakerStaff: "suman", speakerCustomer: "anjie", title: "“把赠品都装进去”",
    body: "她要六套旅行装送伴娘。系统额度只够两套。苏蔓在远处没有说话。" + priceEcho(s),
    choices: [
      { id: "refuse-gifts", label: "只按额度给两套", detail: "守住规则，可能得罪大客", result: "安姐脸色不好看，但接受了。罗曼第一次在群里公开说你“能守底线”。", apply: st => ({ ...st, compliance: clamp(st.compliance + 12), relations: { ...st.relations, roman: st.relations.roman + 12 }, flags: flag(st, "refused-anjie-gifts"), history: history(st, "你拒绝给安姐超额赠品") }) },
      { id: "give-gifts", label: "私下补足六套", detail: "消耗4份库存，不登记", visible: st => st.samples >= 4, result: "安姐满意离开。盘点表上出现四个无法解释的空位。", apply: st => ({ ...st, samples: Math.max(0, st.samples - 4), compliance: clamp(st.compliance - 18), relations: { ...st.relations, suman: st.relations.suman + 8 }, flags: flag(st, "gave-anjie-gifts"), history: history(st, "你给安姐四套未登记赠品") }) },
      { id: "sign-gifts", label: "请苏蔓共同签字", detail: "消耗4份库存，责任共同留下", visible: st => st.samples >= 4, result: "苏蔓签了字。她帮了你，也知道你把她绑进了记录。", apply: st => ({ ...st, samples: Math.max(0, st.samples - 4), compliance: clamp(st.compliance - 6), evidence: st.evidence + 2, relations: { ...st.relations, suman: st.relations.suman + 3 }, flags: flag(st, "signed-anjie-gifts"), history: history(st, "你和苏蔓共同签了安姐赠品记录") }) },
      advanceCard,
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
      + (s.members.length >= MEMBER_MIN_FOR_CREDIT ? ` 你手上有 ${s.members.length} 个人是她问不到、但明年还在的。` : "")
      // 摊记录之前得先让她知道本子里有没有东西，不然这一步是盲选。
      + (hasRecords(s.evidence) ? " 五天本子摊得开，哪一条她都问得出答案。" : " 只是你的本子摊开来没几行。"),
    choices: [
      rosterCard,
      // 摊记录这件事得有本子可摊：留痕不够的人同样能选，只是罗曼翻两页就停住。
      { id: "argue-records", label: "把五天记录摊开", detail: hasRecords(s.evidence) ? "用留痕、售后和退货记录说话" : "把本子里那几行推过去", result: hasRecords(s.evidence)
        ? "罗曼一条条看完，在表上写了备注。柜位留到季度末，条件写在下一行。"
        : "罗曼翻了两页就停住：\"就这些？\"她在表上写了一行，字比你预想的短。", apply: st => ({ ...st,
        // 她没看完的那两页不算新记录：本子的行数只在真的被逐条看完时才涨，结局里那句「摊得开」才不会和这一晚对不上。
        evidence: st.evidence + (hasRecords(st.evidence) ? 2 : 0), standing: clamp(st.standing + (hasRecords(st.evidence) ? 10 : 3)),
        // 那条"留到季度末"的判词认的是这个旗：本子空着的人不配挂它，柜位仍然在评估表上。
        relations: { ...st.relations, roman: st.relations.roman + 4 }, ...(hasRecords(st.evidence) ? { flags: flag(st, "counter-argued-records") } : {}), history: history(st, hasRecords(st.evidence) ? "你用五天的记录替柜位说话" : "你摊开记录本，里面没几条") }) },
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
    // 抽屉里的支数是这一单的硬顶，缺一个数就能把整周断货抹平，所以逐支验：负数、小数、凭空多出第四张调拨单都不认。
    if (!parsed.stock || typeof parsed.stock !== "object") return null;
    for (const product of Object.keys(PRODUCTS) as ProductId[]) {
      const value = parsed.stock[product];
      if (!Number.isInteger(value) || value < 0 || value > WEEK_ALLOCATION[product] + TRANSFER_UNITS) return null;
    }
    const customerIds = (value: unknown): CustomerId[] => Array.isArray(value)
      ? [...new Set(value.filter((id): id is CustomerId => typeof id === "string" && Object.hasOwn(CUSTOMERS, id)))] : [];
    const session = parsed.activeSession;
    if (session && (!Object.hasOwn(CUSTOMERS, session.customerId) || !Array.isArray(session.discovered)
      || session.discovered.some(id => !["eyes", "cheek", "nose"].includes(id))
      || (session.selectedProduct !== null && !Object.hasOwn(PRODUCTS, session.selectedProduct))
      || (session.askedQuestion !== null && (!Number.isInteger(session.askedQuestion) || !QUESTIONS[session.customerId][session.askedQuestion])
      || (session.bundle !== undefined && !Object.hasOwn(BUNDLES, session.bundle))
      || (session.revealed !== undefined && (!Array.isArray(session.revealed) || session.revealed.some(trait => !Object.hasOwn(TRAIT_LABELS, trait))))
      || (session.faceTrialRevealed !== undefined && session.faceTrialRevealed !== null && !Object.hasOwn(TRAIT_LABELS, session.faceTrialRevealed))
      || (session.faceTrialled !== undefined && typeof session.faceTrialled !== "boolean")))) return null;
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
        ? { ...parsed.activeSession, bundle: parsed.activeSession.bundle ?? "single", revealed: parsed.activeSession.revealed ?? [], chat: parsed.activeSession.chat ?? [],
            faceTrialled: parsed.activeSession.faceTrialled === true, faceTrialRevealed: parsed.activeSession.faceTrialRevealed ?? null }
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

// 体力不做成百分比：站到柜台后面的人只知道"还能再接几位"。
// 一次接待实测 17（干净）到 24（竞品插话），按 24 报才是不会骗人的那个数。
export const ENERGY_PER_CONSULT = 24;
export function consultsLeft(value: number) {
  return value < ENERGY_LOCK ? 0 : Math.floor((value - ENERGY_LOCK) / ENERGY_PER_CONSULT) + 1;
}
export function energyWord(value: number) {
  const left = consultsLeft(value);
  return left === 0 ? "腿已经不听使唤，接不了新人"
    : left === 1 ? "撑一撑还能再接一位，之后就站不住"
    : `还站得住，能再接 ${left} 位`;
}

// 留痕不是分数：它只在第 5 天"把记录摊开"那一刻兑现，界面和事件问的是同一条线。
export const RECORDS_MIN = 4;
export const hasRecords = (value: number) => value >= RECORDS_MIN;
export function evidenceWord(value: number) {
  return hasRecords(value) ? "摊得开" : value > 0 ? "没几行" : "空着";
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

// 她还剩多少分钟：现场那截没走满一分钟的零头也算进去，界面上念的和她走到的是同一个数。
export function patienceLeft(s: Campaign, id: CustomerId) {
  return Math.max(0, (s.waitMeters[id] ?? CUSTOMERS[id].patience) - s.floorSeconds / FLOOR_SECONDS_PER_ACTION);
}

// 柜台里叫这一步"迎上去"：人已经不在你这一头了，得拿着东西走过去把她请回来。
// 只有正往中庭小样台那边走的人才请得动，所以你手里的样品和另一头的耐心，同一时刻只能花在一个人的身上。
export function canPullOver(s: Campaign, id: CustomerId) {
  return !s.activeSession && !s.eventDoneDays.includes(s.day) && !hasFlag(s, `pulled:${id}`) && s.samples > 0
    && availableCustomers(s).includes(id) && patienceLeft(s, id) <= PULL_OVER_WINDOW;
}

export function pullOverLabel(s: Campaign, id: CustomerId) {
  if (hasFlag(s, `pulled:${id}`)) return "这一周已经迎过她一次";
  if (s.activeSession) return `迎上去 · 你还在接待${CUSTOMERS[s.activeSession.customerId].name}`;
  if (s.samples <= 0) return "迎上去 · 柜后没有小样了";
  if (patienceLeft(s, id) > PULL_OVER_WINDOW) return "迎上去 · 她还没开始看表";
  return `迎上去 · 1 支小样 · ${PULL_OVER_MINUTES} 分钟`;
}

// 按钮上原来只有代价（一支小样、离柜两分钟），买到的东西写在规则注释里，玩家看不见就决定不了。
// 这两句由规则一处出，两个界面共用：迎上去换的是她这一整段耐心重来，而中庭这支不记回柜的账（见 `pullOver`）。
export const PULL_OVER_RETURN = "换她重新站回柜台前 · 这一支不回柜";

// 同一支小样留在柜台上是另一笔账，而它买到的是一条**要等**的线：`applySampleReturn` 要同时满足
// 「她这一单没成（refused / lost）」+「当晚跟过一句」+「到了 `fromDay` 那天」才兑成回柜那一单。
// 所以这句只念规则真给的两个条件，不写 ¥620、也不写第几天 —— 那正是它和迎上去那一支的区别。
export const LEAVE_SAMPLE_RETURN = "她这一单没成才回得来 · 当晚还得跟一句";

// 这一支还花得出去吗（抽屉里有货、她手上还没有你给的那一支）。两个界面的 disabled 和那句"买到什么"都读这一句，
// 免得闸写在按钮上、理由写在别处，两边各自漂移。
export const canLeaveSample = (s: Campaign, id: CustomerId) => s.samples > 0 && !hasFlag(s, `sample:${id}`);

export function pullOver(s: Campaign, id: CustomerId): Campaign {
  if (!canPullOver(s, id)) return s;
  const customer = CUSTOMERS[id];
  // 中庭递出去的那一支换的是"她肯走过来"，不是"她明天回来"——那是留在柜台上那一支的账（`sample:` 才兑现回柜）。
  const marked = markExpiredSample(s, id);
  const stayed = {
    ...marked, samples: s.samples - 1, flags: flag(marked, `pulled:${id}`),
    waitMeters: { ...s.waitMeters, [id]: customer.patience },
    history: history(s, `你端着试用装走向${customer.name}，把她从中庭那边请回柜台`),
  };
  return spendAttention(stayed, id, PULL_OVER_MINUTES);
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
  const marked = markExpiredSample(s, customerId);
  return { ...marked, samples: s.samples - 1, trust: clamp(s.trust + 4), flags: flag(marked, `sample:${customerId}`), history: history(s, `你给${customer.name}留下试用小样`) };
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
  // 把话说满只在硬推那一条路上有意义（她已经被说服时不需要越界），所以它和 force 一样是可选的第三态。
  claim?: boolean;
  faceTrialled?: boolean;
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
  const left = s.stock[input.selectedProduct];
  // 把话说满买到的那一支：她信了"两周"，所以带走两支。越界开出来的钱照样只写一行小票。
  // 只有那一支普通备案的精华越得了界 —— 粉底说"遮瑕"是装饰效果，不在同一条红线上。
  const overclaimed = tier === "negative" && input.force && Boolean(input.claim) && input.selectedProduct === CLAIM_PRODUCT;
  const units = tier === "negative"
    ? input.force ? (overclaimed ? claimUnits(customer, left) : forcedUnits(customer, input.bundle, left)) : 0
    : unitsWanted(customer, input.selectedProduct, input.bundle, tier, left);
  const sold = units > 0;
  // 断货和推错是两件事：她没买是因为抽屉是空的，不是因为你判断错了，扣分不能共用同一档。
  const blocked = left <= 0;
  // 断货那一屏有几条路，要看这一支后面还到不到：到货按天排，"等"只有在还有下一批的时候才是选项。
  const restocks = s.day < DELIVERIES.length && DELIVERIES.slice(s.day).some(batch => batch[input.selectedProduct] > 0);
  // 现货削掉了多少连带，要和"她预算只够"分开说：前者是柜台的锅，后者是她的锅。
  const capped = sold && units < (tier === "negative"
    ? (overclaimed ? claimUnits(customer) : forcedUnits(customer, input.bundle))
    : unitsWanted(customer, input.selectedProduct, input.bundle, tier));
  // 半脸上过妆，她自己照过镜子：看清了不合适还塞进袋子，就不是判断失误，是明知故犯。
  const knowing = Boolean(input.faceTrialled) && tier === "negative" && sold;
  const shared = input.rivalChoice === "yield" || (s.activeSession?.customerId === customer.id && s.activeSession.rivalChoice === "yield");
  const total = item.price * units;
  const amount = shared ? total / 2 : total;
  const campaign: Campaign = {
    ...s, sales: s.sales + amount, daySales: s.daySales + amount,
    stock: { ...s.stock, [input.selectedProduct]: Math.max(0, left - units) },
    trust: clamp(s.trust + (blocked ? -2 : tier === "positive" ? 7 : sold ? 1 : -10) + (usefulQuestion ? 4 : -2) + (guarded ? 2 : -6) - (knowing ? 4 : 0) + (overclaimed && sold ? CLAIM_TRUST : 0)),
    compliance: clamp(s.compliance + (blocked ? 0 : tier === "positive" ? 1 : sold ? 0 : -5) - (knowing ? 4 : 0) + (overclaimed && sold ? CLAIM_COMPLIANCE : 0)), energy: Math.max(0, s.energy - 14),
    evidence: s.evidence + (input.claimed ? 1 : 0) + (!missed.length && !vetoMissed && sold ? 1 : 0),
    dayServed: [...s.dayServed, customer.id], activeSession: null,
    flags: flag(s, `served:${customer.id}:${blocked ? "out-of-stock" : sold ? (tier === "negative" ? "risky" : "good") : "refused"}`),
    // 账本这一行写的是真入账的那个数（拼单就是半份），不是小票上的整单：整单在报价单和收银记录上各念一次，够了。
    history: history(s, blocked ? `${customer.name}要的是${item.short}，柜上这一支已经断到最后` : sold
      ? receiptLine(`${customer.name}带走 ${units} 件${item.short}${tier === "negative" ? "（她并不认同这个方向）" : ""}${shared ? `（${SPLIT_WORD}）` : ""}`, amount)
      : `${customer.name}拒绝了${item.short}的推荐`),
    orders: sold ? [...s.orders, { day: s.day, customerId: customer.id, product: input.selectedProduct, units, total, amount, shared, risky: tier === "negative" }] : s.orders,
  };
  // 那句越界的话不动钱，所以它单独占一行：隔天她查了备案回来对质，台账上得念得出是谁、哪一句。
  // 旗子上带日次（和 `touched:<id>:<day>` 同一套写法）：回音只属于"当天之后"，不然点一下「回到现场」就提前追问一次。
  if (overclaimed && sold) {
    campaign.flags = flag(campaign, `claim:${customer.id}:${s.day}`);
    campaign.history = history(campaign, claimLine(customer.id));
  }
  if (capped) campaign.history = history(campaign, `抽屉里只剩 ${left} 支${item.short}，这单按现货开`);
  // 被抽屉削掉的那几件不能说成"她预算只够"：那是柜台的缺口，不是她的。
  if (sold && !capped && units < BUNDLES[input.bundle].units && units < customer.maxUnits) {
    campaign.history = history(campaign, `${customer.name}的预算只够 ${units} 件，连带没有谈满`);
  }
  if (shared && sold) campaign.history = history(campaign, `${customer.name}与陆遥拼单：总额 ¥${total.toLocaleString("zh-CN")}，你的业绩 ¥${amount.toLocaleString("zh-CN")}`);
  if (tier === "negative" && sold && vetoMissed) campaign.history = history(campaign, `你没有问出口的那条底线，已经写进这单的风险记录`);
  if (knowing) campaign.history = history(campaign, `${customer.name}照着镜子看过这半张脸，还是买了`);
  // 连带不是免费的：她每带走一件，就多用一分钟开单讲搭配，柜台另一边的人还在倒数。
  const minutes = sold ? BUNDLES[input.bundle].units : 1;
  return {
    campaign: spendAttention(campaign, null, minutes),
    outcome: {
      good: tier === "positive" && guarded && !blocked, amount, total, units, minutes, tier, shared,
      title: blocked ? `${customer.name}没买成` : sold ? (tier === "positive" ? `${customer.name}成交` : tier === "mixed" ? `${customer.name}只带走一件` : `${customer.name}被你推下来单`) : `${customer.name}拒绝成交`,
      body: (blocked
        ? `她认这个方向，钱也带了，可是抽屉里一支${item.short}都没有。这一单不是你推错了，是柜台没有货。`
        : (sold
            ? (tier === "positive"
                ? (guarded ? `你解决了真正需求，她还愿意带走 ${units} 件。她记住的不只是产品，还有你的判断。` : "产品选对了，但订单归属被人插进一道缝。")
                : tier === "mixed"
                  ? "她认这个方向，却没有完全被说服。一件就够了，连带没有起来。"
                  : `数字立刻好看了 ${total.toLocaleString("zh-CN")} 元，可她最在意的问题没有解决。退货风险已经留在你名下。`)
            : vetoMissed ? "她没有为错误判断买单。你连她在怕什么都没问出来。" : "她没有为这个方向买单。你丢掉一笔销售，但至少记住了这次反应。")
          + (knowing ? " 而且这半张脸你亲手画过：她知道不合适，你也知道。" : "")
          + (overclaimed && sold ? " 你说出口的那句是「用两周，斑就淡」——淡斑属特殊化妆品，要注册才准宣称，这瓶只有备案。" : "")
          + (shared && sold ? ` 陆遥分走一半，你实际记入 ¥${amount.toLocaleString("zh-CN")}。` : ""))
        + (blocked ? (restocks ? " 下一单之前有三条路：走调拨单、开口找人，或者等大仓下一批补上——如果她还等得起。" : " 下一单之前只剩两条路：走调拨单，或者开口找人。这一支到周末不会再补了。") : ""),
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
    bundle: "single", revealed: [], tested: false, reaction: null, faceTrialled: false, faceTrialRevealed: null,
    revisions: 0, claimed: false, rivalChoice: null, chat: [] } };
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
  if (!session || session.discovered.length < OBSERVE_MIN || !text.trim() || session.tested) return s;
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
  // 换一支等于重新上脸：她说过的那件事留着，但这支还没在她脸上试过。
  return { ...s, energy: Math.max(0, s.energy - (session.tested ? 5 : 0)), activeSession: { ...session,
    selectedProduct: id, tested: false, reaction: null, faceTrialled: false, revisions: session.revisions + (session.tested ? 1 : 0) } };
}

export function trialService(s: Campaign): Campaign {
  const session = s.activeSession;
  if (!session || session.tested || session.discovered.length < OBSERVE_MIN || session.askedQuestion === null || !session.selectedProduct) return s;
  return { ...spendAttention(s, session.customerId, 1), activeSession: { ...session, tested: true,
    reaction: fitOf(CUSTOMERS[session.customerId], session.selectedProduct).tier } };
}

// 手背试色只看颜色，半脸上妆才看得出她那张脸两小时后会怎么样：多花两分钟，代价是队伍另一头的人在倒数。
export const FACE_TRIAL_MINUTES = 2;
// 柜台上这一半脸是"她自己在脸上看见差别"那一步（现实里是一边上妆、一边她自己来）。
// 规则未必给得出新东西（`faceTrialReveal` 会返回 null），所以这句写的是赌注不是保证。
export const FACE_TRIAL_RETURN = "赌她还有没说出口的那条";

// 上脸之后最先露出来的，是她最在意却还没说出口的那件事。两个 UI 都问这一个函数，别各写一份。
export function faceTrialReveal(customer: Customer, discovered: CueId[], revealed: Trait[]): Trait | null {
  const hidden = unknownDemands(customer, revealOf(customer, discovered, revealed));
  return hidden.length ? hidden.reduce((a, b) => (b.weight > a.weight ? b : a)).trait : null;
}

export function faceTrialService(s: Campaign): Campaign {
  const session = s.activeSession;
  if (!session || !session.tested || session.faceTrialled || !session.selectedProduct) return s;
  const customer = CUSTOMERS[session.customerId];
  const shown = faceTrialReveal(customer, session.discovered, session.revealed);
  return { ...spendAttention(s, session.customerId, FACE_TRIAL_MINUTES), activeSession: { ...session,
    faceTrialled: true, faceTrialRevealed: shown, revealed: shown ? [...new Set([...session.revealed, shown])] : session.revealed } };
}

export function respondToRival(s: Campaign, choice: RivalChoice): Campaign {
  const session = s.activeSession;
  if (!session || !session.tested || session.rivalChoice || !RIVAL_IDS.includes(session.customerId)) return s;
  return { ...applyRival(s, choice), activeSession: { ...session, rivalChoice: choice, claimed: session.claimed || choice === "record" } };
}

export function closeService(s: Campaign, force = false, claim = false) {
  const session = s.activeSession;
  if (!session?.selectedProduct || !session.tested) return null;
  return resolveSale(s, { ...session, selectedProduct: session.selectedProduct, force, claim,
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
  // 事件动的是累计还是别的，这里一律按"大数字实际涨跌了多少"记一笔钱——和柜台小票、晨会那几行同一个格式。
  if (change) next.history = history(next, receiptLine(`闭店调整 · ${choice.label}`, change));
  return { ...next, history: history(next, "回应 · " + choice.result), eventDoneDays: [...next.eventDoneDays, s.day], activeSession: null };
}

export function requestStaffHelp(s: Campaign, id: CustomerId): Campaign {
  if (!availableCustomers(s).includes(id) || hasFlag(s, `help:suman:${s.day}`) || s.energy < 6
    || !(hasFlag(s, "covered-suman") || s.relations.suman >= 60)) return s;
  return { ...s, energy: s.energy - 6, flags: flag(s, `help:suman:${s.day}`),
    waitMeters: { ...s.waitMeters, [id]: (s.waitMeters[id] ?? CUSTOMERS[id].patience) + 2 },
    history: history(s, `苏蔓替你留住${CUSTOMERS[id].name}，多争取了两次接待动作`) };
}

// 报价单不再由隐藏答案决定：件数来自她的预算、用量上限、你判断的准不准，以及抽屉里还剩几支。
export function orderQuote(id: CustomerId, product: ProductId, bundle: BundleId, shared = false, left = Infinity) {
  const customer = CUSTOMERS[id];
  const item = PRODUCTS[product];
  const { tier } = fitOf(customer, product);
  const units = unitsWanted(customer, product, bundle, tier, left);
  const total = item.price * units;
  const lines = units > 0 ? [{ label: `${item.name} × ${units}`, amount: total }] : [];
  const forced = forcedUnits(customer, bundle, left);
  const minutes = units > 0 ? BUNDLES[bundle].units : 1;
  // 现货削掉的那几件要说得出数量，否则玩家分不清是她在克制还是柜上没了。
  const wanted = tier === "negative" ? forcedUnits(customer, bundle) : unitsWanted(customer, product, bundle, tier);
  const note = left <= 0 ? `柜上这一支断了：抽屉里一支${item.short}都没有，这一单开不出来`
    : tier === "negative" ? `她不会为这个方向买单。硬推只能记 ${forced} 件，退货风险写在你名下`
      : left < wanted ? `柜上只剩 ${left} 支，这单最多开到 ${units} 件`
        : tier === "mixed" ? "她最多只肯先拿一件"
          : units < BUNDLES[bundle].units ? `她的预算和用量只够 ${units} 件` : "";
  return { lines, units, total, amount: shared ? total / 2 : total, shared, minutes, risky: tier === "negative", forced, tier, wanted, note };
}

export type TransferChannel = keyof typeof TRANSFER_MINUTES;

// 一周一次的杠杆：同一支货调两次，罗曼会先问你为什么这么能动。
export function canTransfer(s: Campaign, product: ProductId) {
  return s.stock[product] <= TRANSFER_GATE && !hasFlag(s, `transfer:${product}`);
}

// 但这两行按钮只摆在她这一单正要被削的报价单上：柜上够开，就不劝人离柜打电话。
// 强推那一单不算 —— 她本来就不带走，调三支回来还是不开张。
export function offerTransfer(s: Campaign, product: ProductId, quote: { risky: boolean; units: number; wanted: number }) {
  return !quote.risky && quote.units < quote.wanted && canTransfer(s, product);
}

// 抽屉见底之后只有两条真实出路：走系统的调拨单，或者找人私下拿货。
// 两条都要离柜打电话，而排队的人不会因为你打电话就停下来。措辞只在这里改一次。
export function canTransferVia(s: Campaign, product: ProductId, channel: TransferChannel) {
  return canTransfer(s, product) && (channel !== "tangke" || s.relations.tangke >= TANGKE_STOCK_GATE);
}

// 起步的 38 分本来就够不到那道门，所以这句话在第一天就会被念出来 —— 那时抢单还是第 2 晚的事，
// 也可能整个星期都没跟她抢过。被按住的理由必须由真发生过的格子生成，不能替玩家认下一桩没发生的罪。
function tangkeRefusal(s: Campaign): string {
  if (hasFlag(s, "beat-tang-with-record")) return "她把第 2 晚那一单记着：不会替你压一张没有台账的单";
  if (hasFlag(s, "recorded-lost-xiaoyu")) return "第 2 晚她看见你事后补的那条记录：不会替你压一张没有台账的单";
  if (hasFlag(s, "lost-xiaoyu-owned")) return "她还在为第 2 晚没追上的人生气：轮不到替你开口";
  return "她还没打算替你压一张没有台账的单";
}

export function transferLabel(s: Campaign, product: ProductId, channel: TransferChannel) {
  const short = PRODUCTS[product].short;
  const head = channel === "official" ? `请罗曼开调拨单 · ${TRANSFER_MINUTES.official} 分钟` : `找唐可拿三支 · ${TRANSFER_MINUTES.tangke} 分钟`;
  if (hasFlag(s, `transfer:${product}`)) return `${head} · ${short}这一周已经调过一次`;
  if (s.stock[product] > TRANSFER_GATE) return `${head} · ${short}还够开一整套连带，先不用为它开口`;
  if (channel === "tangke" && s.relations.tangke < TANGKE_STOCK_GATE) return `${head} · ${tangkeRefusal(s)}`;
  return head;
}

// serving：手机版把接待拆在组件状态里，所以要把它手上那位单独报进来，否则离柜的三分钟会把她一起扣掉。
export function transferStock(s: Campaign, product: ProductId, channel: TransferChannel, serving: CustomerId | null = s.activeSession?.customerId ?? null): Campaign {
  if (!canTransferVia(s, product, channel)) return s;
  const item = PRODUCTS[product];
  const stock = { ...s.stock, [product]: s.stock[product] + TRANSFER_UNITS };
  const next: Campaign = channel === "official"
    ? { ...s, stock, compliance: clamp(s.compliance + 2), flags: flag(s, `transfer:${product}`),
        history: history(s, `罗曼在系统里替你开了调拨单：${item.short} +${TRANSFER_UNITS} 支，台账上写着你的名字`) }
    : { ...s, stock, compliance: clamp(s.compliance - 9), relations: { ...s.relations, tangke: s.relations.tangke + 8 },
        flags: flag(s, `transfer:${product}`), history: history(s, `唐可把 ${TRANSFER_UNITS} 支${item.short}塞进你的抽屉，系统里没有这张单`) };
  return spendAttention(next, serving, TRANSFER_MINUTES[channel]);
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

// 现场还差什么，念成她说的话而不是分数：脸上没看的点、没说出口的要求、问到才知道的底线。
// 两个 UI 都问这一个函数，措辞只在这里改一次。
export function consultationRecord(customer: Customer, discovered: CueId[], revealed: Trait[], tested = false) {
  const preview = fitPreview(customer, revealed);
  const left = (Object.keys(customer.cues) as CueId[]).filter(cue => !discovered.includes(cue));
  return {
    // 看够 OBSERVE_MIN 处之前不报剩下的点位：那时她脸上只有一直在闪的点，谈不上取舍。
    face: discovered.length >= OBSERVE_MIN && left.length ? `她脸上还有 ${left.length} 处没看：${left.map(cue => customer.cues[cue].label).join("、")}` : "",
    said: preview.known.map(demand => TRAIT_LABELS[demand.trait]),
    // 试过手背之后，「上脸试出来」这一步已经写在面板的按钮上了，句子就不再教一遍。
    blind: preview.missed ? `还有 ${preview.missed} 条她没说出口${tested ? "" : " · 问出来，或上脸试出来"}` : "",
    veto: customer.veto && preview.vetoKnown ? customer.veto.note : "",
  };
}

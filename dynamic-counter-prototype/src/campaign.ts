export type ProductId = "soft" | "glow" | "repair";
export type CueId = "eyes" | "cheek" | "nose";
export type CustomerId = "shen" | "mei" | "xiaoyu" | "zhao" | "anjie" | "returning" | "zhou" | "duan" | "zhou2";
export type RivalChoice = "record" | "clarify" | "yield";
export type StaffKey = "player" | "luyao" | "roman" | "suman" | "tangke" | "fangmin";
export type HistoryEntry = { day: number; text: string };

export type CustomerSession = {
  customerId: CustomerId;
  discovered: CueId[];
  askedQuestion: number | null;
  selectedProduct: ProductId | null;
  tested: boolean;
  reaction: "positive" | "negative" | null;
  revisions: number;
  claimed: boolean;
  rivalChoice: RivalChoice | null;
};

export type Customer = {
  id: CustomerId;
  name: string;
  descriptor: string;
  portrait: string;
  opening: string;
  need: string;
  bestProduct: ProductId;
  sale: number;
  wrongSale: number;
  mapVariant: "young" | "mature";
  patience: number;
  lostLine: string;
  rival: boolean;
  cues: Record<CueId, { label: string; finding: string }>;
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
  relations: { suman: number; tangke: number; luyao: number; roman: number };
  flags: string[];
  history: HistoryEntry[];
  dayServed: CustomerId[];
  lost: CustomerId[];
  eventDoneDays: number[];
  waitMeters: Partial<Record<CustomerId, number>>;
  activeSession: CustomerSession | null;
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

export type SaleOutcome = { good: boolean; amount: number; title: string; body: string };
export type DawnNotice = { speaker: string; body: string };

export const SAVE_KEY = "last-order-campaign-v1";
export const SAVE_VERSION = 2;
export const TARGET = 21_000;
export const ENERGY_LOCK = 18;
export const RIVAL_IDS: CustomerId[] = ["shen", "returning", "zhou"];
export const SAMPLE_RETURN_SALE = 620;

export const INITIAL: Campaign = {
  version: SAVE_VERSION,
  day: 1, sales: 0, daySales: 0, trust: 50, compliance: 55, energy: 100, samples: 8, evidence: 0,
  relations: { suman: 50, tangke: 38, luyao: 35, roman: 45 }, flags: [], history: [], dayServed: [], lost: [], eventDoneDays: [],
  waitMeters: { shen: 4, mei: 6 }, activeSession: null,
};

export const PRODUCTS: Record<ProductId, { name: string; short: string; price: number; note: string }> = {
  soft: { name: "云纱柔焦粉底", short: "柔焦", price: 980, note: "轻薄分区叠加，镜头近看更自然" },
  glow: { name: "鎏光持妆套组", short: "持妆", price: 1280, note: "高遮瑕、高提成；干燥和敏感肌风险更高" },
  repair: { name: "夜兰修护精华", short: "修护", price: 1680, note: "舒缓干燥与泛红，见效不靠厚重遮盖" },
};

export const QUESTIONS: Record<CustomerId, Array<{ label: string; response: string; useful: boolean }>> = {
  shen: [{ label: "你最怕镜头看到什么？", response: "近看有粉感。不卡粉只是底线，我要像没化妆。", useful: true }, { label: "预算大概多少？", response: "预算不是问题，别拿价格替代判断。", useful: false }, { label: "要不要直接看套装？", response: "我刚说了不缺粉底。你也没听我说话？", useful: false }],
  mei: [{ label: "明早最想改善哪里？", response: "眼下干、脸没精神，但我不想遮成一张面具。", useful: true }, { label: "预算能到两千吗？", response: "我只有十分钟，你先告诉我什么真的有用。", useful: false }, { label: "平时用高遮瑕吗？", response: "几乎不用，越厚越显累。", useful: true }],
  xiaoyu: [{ label: "预算里最不能牺牲什么？", response: "别闷痘。我宁愿少买，也不想面试前爆更多。", useful: true }, { label: "要不要咬牙上套装？", response: "我说了只有一千。高端柜也不听预算吗？", useful: false }, { label: "明天是什么场合？", response: "第一次正式面试，想精神，但不想像换了张脸。", useful: true }],
  zhao: [{ label: "女儿用过什么会不舒服？", response: "她发了过敏成分截图，我差点忘了给你看。", useful: true }, { label: "您自己喜欢哪一款？", response: "不是我用。看我的脸没有用。", useful: false }, { label: "礼物一定要显得贵吗？", response: "我怕的是送错，不是看着不够贵。", useful: true }],
  anjie: [{ label: "婚礼前皮肤最近稳定吗？", response: "这两天突然泛红。越临近越不敢出错。", useful: true }, { label: "预算上限是多少？", response: "预算不是问题，出问题才是。", useful: false }, { label: "要不要新品整套？", response: "苏蔓说你会判断，不是只会推套装。", useful: false }],
  returning: [{ label: "昨天最满意哪一点？", response: "不是遮住了，是直播近看也没粉感。我要能稳定复现。", useful: true }, { label: "团队预算能加吗？", response: "先证明效果稳定，再谈加预算。", useful: false }, { label: "要不要直接按昨天开单？", response: "你如果连售后都不问，我为什么批量买？", useful: false }],
  zhou: [{ label: "对面说的持妆你信吗？", response: "我怕暗沉。会议要拍照片，但不能看起来像换了一层皮。", useful: true }, { label: "要不要直接上套组？", response: "我是来对比的，不是来被完成任务的。", useful: false }, { label: "皮肤最近是不是发干？", response: "下午T区还出油，两颊已经紧了。你们怎么没人先问这个。", useful: true }],
  duan: [{ label: "真的只是看看吗？", response: "室友过生日。我想买对，但我不想被说成好骗。", useful: true }, { label: "要不要先领小样？", response: "中庭已经发过了。我缺的是判断，不是袋子。", useful: false }, { label: "她皮肤和你像吗？", response: "她比我还容易闷痘。别推荐我自己都不敢用的。", useful: true }],
  zhou2: [{ label: "昨天那款同事怎么说？", response: "她问有没有修护。我自己倒还想再确认会不会暗沉。", useful: true }, { label: "要不要直接按昨天开？", response: "昨天是我自己。今天是给同事带，别想当然。", useful: false }, { label: "她最怕什么成分？", response: "香精。她上次用完一红就是这个。", useful: true }],
};

export const REACTIONS: Record<ProductId, { positive: string; negative: string }> = {
  soft: { positive: "她靠近镜子看了两秒，鼻翼没有结块。", negative: "轻薄是真的，但她现在要解决的不是妆感。" },
  glow: { positive: "妆面立刻完整，她的目光停在镜子里。", negative: "她皱眉摸了摸脸：\u201c太厚，也有点绷。\u201d" },
  repair: { positive: "泛红缓下来，她第一次主动问起用法。", negative: "肤感舒服，但没有回应她此刻最想解决的问题。" },
};

export const CUSTOMERS: Record<CustomerId, Customer> = {
  shen: {
    id: "shen", name: "沈薇", descriptor: "熟客博主 · 竞品也认识她", portrait: "/assets/game/customer-shen-consultation.png",
    opening: "先说好，我不缺粉底。要是又是品牌话术，我就去对面了。", need: "镜头近看不浮粉，补妆后也不能厚重", bestProduct: "soft", sale: 2860, wrongSale: 1280, mapVariant: "young",
    patience: 4, lostLine: "陆遥带沈薇去了维珞", rival: true,
    cues: { eyes: { label: "眼下", finding: "已有薄薄卡纹，继续叠高遮瑕会显疲态。" }, cheek: { label: "脸颊", finding: "妆面基本完整，她真正介意的是镜头里的粉感。" }, nose: { label: "鼻翼", finding: "局部微红出油，需要轻薄分区处理。" } },
  },
  mei: {
    id: "mei", name: "梅女士", descriptor: "下班客 · 十分钟后离店", portrait: "/assets/game/customer-mei-consultation.png",
    opening: "我明早要见客户，脸看起来很累。别给我推荐一整套。", need: "快速改善干燥疲态，明早能直接用", bestProduct: "repair", sale: 1680, wrongSale: 620, mapVariant: "mature",
    patience: 6, lostLine: "梅女士看了看表，已经赶去地铁", rival: false,
    cues: { eyes: { label: "眼下", finding: "干纹明显，厚粉底会让疲态更重。" }, cheek: { label: "脸颊", finding: "缺水和光泽断层，修护打底比遮盖更重要。" }, nose: { label: "鼻翼", finding: "没有明显出油，控油型产品会加重紧绷。" } },
  },
  xiaoyu: {
    id: "xiaoyu", name: "小雨", descriptor: "第一次买高端美妆 · 预算有限", portrait: "/assets/game/customer-xiaoyu-consultation.png",
    opening: "我只有一千块预算。最近爆痘，但明天面试想看起来精神一点。", need: "不刺激痘肌，在预算内改善气色", bestProduct: "soft", sale: 980, wrongSale: 1680, mapVariant: "young",
    patience: 6, lostLine: "小雨被中庭的小样台叫走了", rival: false,
    cues: { eyes: { label: "眼下", finding: "睡眠不足带来暗沉，但不需要重度遮瑕。" }, cheek: { label: "脸颊", finding: "有活跃痘和轻微敏感，厚重持妆容易闷痘。" }, nose: { label: "鼻翼", finding: "T区出油、两颊不油，适合分区轻薄上妆。" } },
  },
  zhao: {
    id: "zhao", name: "赵女士", descriptor: "给女儿买礼物 · 不懂产品", portrait: "/assets/game/customer-zhao-consultation.png",
    opening: "我女儿总说脸红、用什么都刺。你别看我，东西是买给她的。", need: "为敏感肌女儿选低风险礼物，并保留退换余地", bestProduct: "repair", sale: 1680, wrongSale: 2860, mapVariant: "mature",
    patience: 6, lostLine: "赵女士说再问问女儿，已经离开专柜", rival: false,
    cues: { eyes: { label: "神情", finding: "她一直看价签，不是不舍得，而是怕买错。" }, cheek: { label: "信息", finding: "观察她的皮肤不能代替询问女儿的使用史。" }, nose: { label: "细节", finding: "她手里有女儿发来的过敏成分截图。" } },
  },
  anjie: {
    id: "anjie", name: "安姐", descriptor: "婚前试妆 · 高价值老客", portrait: "/assets/game/customer-anjie-consultation.png",
    opening: "婚礼还有一周，我要一套绝对不出错的。预算不是问题。", need: "先稳定敏感泛红，再做轻薄婚礼妆；不能冒险换全套", bestProduct: "repair", sale: 6800, wrongSale: 9200, mapVariant: "young",
    patience: 7, lostLine: "安姐让苏蔓接手，这笔单离开了你", rival: false,
    cues: { eyes: { label: "眼下", finding: "焦虑和睡眠不足明显，当前状态不适合叠加新品。" }, cheek: { label: "脸颊", finding: "双颊正在泛红，强持妆套组存在刺激风险。" }, nose: { label: "表达", finding: "她强调“绝对不出错”，安全感比客单更重要。" } },
  },
  returning: {
    id: "returning", name: "沈薇", descriptor: "带着直播团队回来 · 最后一单", portrait: "/assets/game/customer-shen-consultation.png",
    opening: "昨天那次试妆直播间都在问。我要给团队订一批，但你得保证不是昙花一现。", need: "稳定复现轻薄效果，并给出有记录的售后承诺", bestProduct: "soft", sale: 4200, wrongSale: 1680, mapVariant: "young",
    patience: 6, lostLine: "沈薇说团队先去维珞看同款", rival: true,
    cues: { eyes: { label: "眼下", finding: "昨天的卡纹没有加重，说明轻薄方案有效。" }, cheek: { label: "反馈", finding: "妆面稳定，她现在观察的是你是否守承诺。" }, nose: { label: "机会", finding: "订单来自信任复购，而不是一次高压推销。" } },
  },
  zhou: {
    id: "zhou", name: "周姐", descriptor: "对比维珞 · 只有二十分钟", portrait: "/assets/game/customer-zhou-consultation.png",
    opening: "对面说你们家持妆会暗沉。我开会要拍照，给我一个能站得住的理由。", need: "会议拍照不暗沉，但不能厚到像换了一层皮", bestProduct: "soft", sale: 1280, wrongSale: 620, mapVariant: "young",
    patience: 5, lostLine: "陆遥用一盘试色把周姐接到了维珞", rival: true,
    cues: { eyes: { label: "眼下", finding: "细纹不多，真正的风险是下午两颊发干。" }, cheek: { label: "脸颊", finding: "底妆还在，但干区已经开始起皮。" }, nose: { label: "鼻翼", finding: "T区微油，不适合整脸厚持妆。" } },
  },
  duan: {
    id: "duan", name: "段小姐", descriptor: "说只看小样 · 其实在买礼物", portrait: "/assets/game/customer-duan-consultation.png",
    opening: "我就是看看。不一定买。你们别围上来。", need: "给易闷痘的室友选对礼物，而不是把自己变成业绩", bestProduct: "soft", sale: 980, wrongSale: 1680, mapVariant: "young",
    patience: 5, lostLine: "段小姐去中庭领了别的品牌小样", rival: false,
    cues: { eyes: { label: "眼神", finding: "她在看你，也在看有没有人准备强推。" }, cheek: { label: "皮肤", finding: "她自己并不敏感，但选品不能按她的脸来。" }, nose: { label: "手机", finding: "相册里是室友的过敏记录，不是她的自拍。" } },
  },
  zhou2: {
    id: "zhou2", name: "周姐", descriptor: "带着同事的需求回来", portrait: "/assets/game/customer-zhou-consultation.png",
    opening: "昨天那款我用了。同事问有没有修护，让我今天顺便看。", need: "给同事带低刺激修护，同时确认自己不会暗沉", bestProduct: "repair", sale: 1680, wrongSale: 1280, mapVariant: "young",
    patience: 5, lostLine: "周姐说同事先去对面问同款", rival: false,
    cues: { eyes: { label: "眼下", finding: "昨天的干纹没有加重，说明轻薄方案有效。" }, cheek: { label: "状态", finding: "她自己稳定，真正的新问题是同事的敏感。" }, nose: { label: "清单", finding: "备忘录写着：无香精、要能退。" } },
  },
};

export const DAYS: DayStory[] = [
  { day: 1, title: "入口位", subtitle: "两个顾客，只能先抓住一个", brief: "新品活动晚高峰。陆遥盯上沈薇，梅女士又只剩十分钟。你第一次决定把黄金时间给谁。", threat: "选择会让另一边的机会继续流失", customers: ["shen", "mei"] },
  { day: 2, title: "新人价码", subtitle: "好服务不一定是高客单", brief: "小雨第一次买高端美妆，周姐同时在对比维珞。罗曼刚在晨会上说：今天谁的客单低于两千，谁留下复盘。", threat: "推对产品会低于柜长要求，推贵产品会超过顾客预算", customers: ["xiaoyu", "zhou"] },
  { day: 3, title: "不是买给自己", subtitle: "观察也会误导人", brief: "赵女士替女儿买礼物，段小姐说只看小样。同一时间总部群在催修护精华的新品数据。", threat: "销售技巧不能代替真正了解使用者", customers: ["zhao", "duan"] },
  { day: 4, title: "婚礼前一周", subtitle: "最大的一单，最脆弱的人", brief: "安姐是苏蔓维护三年的老客。她点名让你试妆。若你昨天接住了周姐，她会带着同事的需求回来。", threat: "高客单、老客归属、敏感风险同时出现", customers: ["anjie"] },
  { day: 5, title: "最后一单", subtitle: "复购、售后与盘点同时到来", brief: "区域经理提前巡店。沈薇带着直播团队回来下单，后仓却在查五天前的赠品缺口。今天每条记录都会连起来。", threat: "成交只是开端；旧选择正在返回现场", customers: ["returning"] },
];

export const RIVAL_INTERRUPTIONS: Record<"shen" | "zhou" | "returning", { headline: string; quote: string }> = {
  shen: { headline: "陆遥靠到镜边", quote: "她之前用我们家的持妆款很满意。" },
  zhou: { headline: "陆遥把试色盘递过来", quote: "会议妆我们更熟。持妆拍照不会暗。" },
  returning: { headline: "陆遥拦在团队助理旁边", quote: "批量单我们也可以做售后。她昨天已经试过了。" },
};

type Payback = {
  id: CustomerId;
  resolve: string;
  fromDay: number;
  sales: number;
  trust: number;
  compliance: number;
  relation?: { key: keyof Campaign["relations"]; delta: number };
  text: string;
  speaker: string;
  body: string;
};

const RISKY_RETURNS: Payback[] = [
  { id: "shen", resolve: "shen-chargeback", fromDay: 3, sales: -1280, trust: -8, compliance: -4, text: "沈薇退了那单持妆，说镜头里全是粉感", speaker: "退货 · 收银", body: "沈薇把持妆退了。她说近看全是粉，不会再帮你带货。" },
  { id: "mei", resolve: "mei-chargeback", fromDay: 3, sales: -620, trust: -6, compliance: -3, text: "梅女士客户会面翻车，客诉到专柜", speaker: "客诉 · 方敏", body: "梅女士说你卖的东西让她第二天更显疲态。客诉已记录。" },
  { id: "xiaoyu", resolve: "xiaoyu-chargeback", fromDay: 4, sales: -1680, trust: -8, compliance: -4, text: "小雨面试前闷痘，妈妈来退货", speaker: "退货 · 收银", body: "小雨妈妈把那支不该卖的修护退了。面试前爆痘的截图也在。" },
  { id: "zhou", resolve: "zhou-chargeback", fromDay: 4, sales: -620, trust: -6, compliance: -3, text: "周姐会议照片暗沉，她把对比发到了群里", speaker: "客诉 · 罗曼", body: "周姐把会议自拍发到了会员群。持妆暗沉的对比图还在。" },
  { id: "zhao", resolve: "zhao-forced-return", fromDay: 5, sales: -2860, trust: -10, compliance: -6, text: "赵女士女儿用了你强推的套组，过敏退货", speaker: "退货 · 收银", body: "赵女士说你根本没问女儿。那套礼物已经退回后仓。" },
  { id: "duan", resolve: "duan-chargeback", fromDay: 5, sales: -1680, trust: -8, compliance: -4, text: "段小姐室友过敏，礼物单被退回", speaker: "退货 · 收银", body: "段小姐说室友一用就红。礼物单从你名下划走了。" },
  { id: "anjie", resolve: "anjie-blew-up", fromDay: 5, sales: -9200, trust: -14, compliance: -10, relation: { key: "suman", delta: -12 }, text: "安姐婚前爆红，苏蔓的三年老客炸了", speaker: "客诉 · 苏蔓", body: "安姐婚礼前双颊爆红。苏蔓三年的老客，因为你的强推套组进了客诉。" },
  { id: "zhou2", resolve: "zhou2-chargeback", fromDay: 5, sales: -1280, trust: -6, compliance: -3, text: "周姐同事香精过敏，连带她也不再信你", speaker: "退货 · 收银", body: "周姐同事对香精过敏。她说昨天不该替你担保。" },
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

export function floorCustomers(s: Campaign): CustomerId[] {
  const base = DAYS[s.day - 1]?.customers ?? [];
  if (s.day === 4 && servedZhou(s) && !hasFlag(s, "lost:zhou")) return [...base, "zhou2"];
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
  return {
    ...s,
    sales: Math.max(0, s.sales + item.sales),
    daySales: Math.max(0, s.daySales + item.sales),
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
    next = { ...next, sales: Math.max(0, next.sales - 1680), flags: flag(next, "zhao-returned"), history: history(next, "赵女士按承诺退了那单") };
  }
  for (const item of RISKY_RETURNS) next = applyPayback(next, item);
  for (const item of SAMPLE_RETURNS) next = applySampleReturn(next, item);
  return next;
}

export function applyFinale(s: Campaign): Campaign {
  if (!hasFlag(s, "served:returning:risky") || hasFlag(s, "returning-chargeback")) return s;
  return {
    ...s,
    sales: Math.max(0, s.sales - 1680),
    trust: clamp(s.trust - 8),
    compliance: clamp(s.compliance - 4),
    flags: flag(s, "returning-chargeback"),
    history: history(s, "沈薇团队发现效果不稳定，批量单暂扣"),
  };
}

export function dawnNotices(s: Campaign): DawnNotice[] {
  const notes: DawnNotice[] = [];
  if (s.day === 4 && hasFlag(s, "tang-paid-order")) notes.push({ speaker: "唐可 · 交接", body: "她把一单伴娘妆转到你名下。口头承诺这次兑现了。" });
  if (s.day === 5 && hasFlag(s, "zhao-daughter-order")) notes.push({ speaker: "赵青 · 微信", body: "妈妈说可以信你。我买了那支修护。" });
  if (s.day === 5 && hasFlag(s, "zhao-complaint")) notes.push({ speaker: "客诉 · 方敏", body: "赵女士女儿过敏，这条已经进档案。" });
  if (s.day === 5 && hasFlag(s, "zhao-returned")) notes.push({ speaker: "退货 · 收银", body: "赵女士按你写下的承诺退了那单。" });
  for (const item of RISKY_RETURNS) {
    if (s.day === item.fromDay && hasFlag(s, item.resolve)) notes.push({ speaker: item.speaker, body: item.body });
  }
  for (const item of SAMPLE_RETURNS) {
    if (s.day === item.fromDay && hasFlag(s, item.resolve)) notes.push({ speaker: item.speaker, body: item.body });
  }
  return notes;
}

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
    if (!s.dayServed.includes("xiaoyu")) return {
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
        { id: "split-tang", label: "提出平分", detail: "各退一步，销售扣一半归属", result: "唐可接受了。你少了一点数字，却多了一个愿意交接顾客的人。", apply: st => ({ ...st, sales: Math.max(0, st.sales - 490), daySales: Math.max(0, st.daySales - 490), relations: { ...st.relations, tangke: st.relations.tangke + 14 }, flags: flag(st, "split-with-tang"), history: history(st, "你与唐可平分了小雨的订单") }) },
        { id: "beat-tang", label: "拿出服务记录", detail: "按有效接待规则据理力争", result: "订单归你。唐可无法反驳，但开始把你视作真正的竞争者。", apply: st => ({ ...st, evidence: st.evidence + 1, relations: { ...st.relations, tangke: st.relations.tangke - 5 }, flags: flag(st, "beat-tang-with-record"), history: history(st, "你用服务记录赢下订单归属") }) },
        { id: "yield-tang", label: "把单让给她", detail: "换她下次交接一个高客", result: "唐可答应欠你一单。口头承诺没有证据，但她的敌意明显下降。", apply: st => ({ ...st, sales: Math.max(0, st.sales - 980), daySales: Math.max(0, st.daySales - 980), relations: { ...st.relations, tangke: st.relations.tangke + 22 }, flags: flag(st, "tang-owes-order"), history: history(st, "你把小雨的订单让给了唐可") }) },
      ],
    };
  }
  if (s.day === 3) {
    if (!s.dayServed.includes("zhao")) return {
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
      body: "她准备付款时才发现，女儿曾对新品中的一种香精过敏。你可以换成低价基础款，也可以保证“多数人没事”。",
      choices: [
        { id: "protect-zhao", label: "换低价基础款", detail: "少卖 ¥700，避免已知风险", result: "赵女士松了口气。当天数字下降，但她把你的微信推给了女儿。", apply: st => ({ ...st, sales: Math.max(0, st.sales - 700), daySales: Math.max(0, st.daySales - 700), trust: clamp(st.trust + 12), flags: flag(st, "protected-zhao"), history: history(st, "你主动降低赵女士的客单避免过敏") }) },
        { id: "risk-zhao", label: "解释概率后成交", detail: "让她自己承担选择", result: "订单留下了。你说清了风险，却知道她并没有真正听懂。", apply: st => ({ ...st, trust: clamp(st.trust - 3), compliance: clamp(st.compliance - 3), flags: flag(st, "zhao-risk-sale"), history: history(st, "赵女士知情后仍买下新品") }) },
        { id: "promise-zhao", label: "写下退换承诺", detail: "保留销售，并承诺不适可退", result: "你保住数字，也背上一个有时间戳的售后承诺。", apply: st => ({ ...st, trust: clamp(st.trust + 5), evidence: st.evidence + 1, flags: flag(st, "promise-zhao-return"), history: history(st, "你向赵女士写下无条件退换承诺") }) },
      ],
    };
  }
  if (s.day === 4) return {
    speaker: "安姐", speakerStaff: "suman", speakerCustomer: "anjie", title: "“把赠品都装进去”",
    body: "她要六套旅行装送伴娘。系统额度只够两套。苏蔓在远处没有说话。",
    choices: [
      { id: "refuse-gifts", label: "只按额度给两套", detail: "守住规则，可能得罪大客", result: "安姐脸色不好看，但接受了。罗曼第一次在群里公开说你“能守底线”。", apply: st => ({ ...st, compliance: clamp(st.compliance + 12), relations: { ...st.relations, roman: st.relations.roman + 12 }, flags: flag(st, "refused-anjie-gifts"), history: history(st, "你拒绝给安姐超额赠品") }) },
      { id: "give-gifts", label: "私下补足六套", detail: "消耗4份库存，不登记", result: "安姐满意离开。盘点表上出现四个无法解释的空位。", apply: st => ({ ...st, samples: Math.max(0, st.samples - 4), compliance: clamp(st.compliance - 18), relations: { ...st.relations, suman: st.relations.suman + 8 }, flags: flag(st, "gave-anjie-gifts"), history: history(st, "你给安姐四套未登记赠品") }) },
      { id: "sign-gifts", label: "请苏蔓共同签字", detail: "赠品照给，责任共同留下", result: "苏蔓签了字。她帮了你，也知道你把她绑进了记录。", apply: st => ({ ...st, samples: Math.max(0, st.samples - 4), compliance: clamp(st.compliance - 6), evidence: st.evidence + 2, relations: { ...st.relations, suman: st.relations.suman + 3 }, flags: flag(st, "signed-anjie-gifts"), history: history(st, "你和苏蔓共同签了安姐赠品记录") }) },
    ],
  };
  const gap = hasFlag(s, "covered-suman") || hasFlag(s, "gave-anjie-gifts") || hasFlag(s, "signed-anjie-gifts");
  if (gap) return {
    speaker: "方敏 · 合规", speakerStaff: "fangmin", speakerCustomer: null, title: "请解释赠品缺口",
    body: hasFlag(s, "covered-suman")
      ? "方敏把第一天的补登记和后来的盘点对在一起。缺口对得上人。她要一个能写进档案的说法。"
      : "盘点表上的空位和安姐那单对得上。她不问谁是好人，只问哪一种说法能被记录证明。",
    choices: [
      { id: "submit-all", label: "提交全部记录", detail: "不替任何人删减事实", result: "调查会伤到同事，也可能证明你没有独自制造缺口。", apply: st => ({ ...st, evidence: st.evidence + 3, compliance: clamp(st.compliance + 5), flags: flag(st, "submitted-all-records"), history: history(st, "你向合规提交了完整记录") }) },
      { id: "take-blame", label: "承认自己负责", detail: "保护团队，独自扛下缺口", result: "苏蔓记住了你的保护。总部也在档案里记住了同一件事。", apply: st => ({ ...st, compliance: clamp(st.compliance - 16), relations: { ...st.relations, suman: st.relations.suman + 18 }, flags: flag(st, "took-sample-blame"), history: history(st, "你独自承担了赠品缺口") }) },
      { id: "blame-suman", label: "指出苏蔓操作", detail: "用她的错误换自己的清白", result: "你的责任被切开了。苏蔓看你的眼神也彻底变了。", visible: st => hasFlag(st, "covered-suman") || hasFlag(st, "signed-anjie-gifts"), apply: st => ({ ...st, compliance: clamp(st.compliance + 3), relations: { ...st.relations, suman: st.relations.suman - 28, roman: st.relations.roman + 5 }, flags: flag(st, "blamed-suman"), history: history(st, "你向合规指出了苏蔓的操作") }) },
      { id: "use-group", label: "拿出群聊留痕", detail: "用公开记录证明你没有私改", result: "方敏点了点头。这条记录保护了你，也让苏蔓在群里被看见。", visible: st => hasFlag(st, "public-sample-record"), apply: st => ({ ...st, evidence: st.evidence + 2, compliance: clamp(st.compliance + 8), relations: { ...st.relations, suman: st.relations.suman - 8 }, flags: flag(st, "used-group-record"), history: history(st, "你用工作群记录证明赠品缺口") }) },
    ],
  };
  return {
    speaker: "方敏 · 合规", speakerStaff: "fangmin", speakerCustomer: null, title: "账对得上，她仍要一句话",
    body: "赠品账没有把你单独钉住。方敏合上文件夹，问你：如果区域要写储备人选，你愿不愿意被写进去。",
    choices: [
      { id: "accept-reserve", label: "接受被写进储备", detail: "数字和纪律都对你有利", result: "罗曼第一次在评价里写“可独立带班”。苏蔓没有祝贺你。", apply: st => ({ ...st, relations: { ...st.relations, roman: st.relations.roman + 10, suman: st.relations.suman - 4 }, flags: flag(st, "accepted-reserve"), history: history(st, "你接受成为区域储备人选") }) },
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
    if (parsed.version !== SAVE_VERSION) return null;
    const merged: Campaign = {
      ...INITIAL,
      ...parsed,
      version: SAVE_VERSION,
      relations: { ...INITIAL.relations, ...parsed.relations },
      flags: parsed.flags ?? [],
      history: asHistory(parsed.history),
      dayServed: parsed.dayServed ?? [],
      lost: parsed.lost ?? [],
      eventDoneDays: parsed.eventDoneDays ?? [],
      waitMeters: parsed.waitMeters ?? {},
      activeSession: parsed.activeSession ?? null,
    };
    return { ...merged, waitMeters: metersFor(floorCustomers(merged), merged.waitMeters) };
  } catch {
    return null;
  }
}

export function relationText(value: number) {
  return value >= 68 ? "愿意站在你这边" : value >= 50 ? "保持合作" : value >= 35 ? "互相试探" : "公开敌对";
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

export function endingTitle(s: Campaign) {
  const salesWin = s.sales >= TARGET;
  const safe = s.compliance >= 50;
  const trusted = s.trust >= 55;
  return salesWin && safe && trusted ? "你留下了，而且没变成她们" : salesWin && !safe ? "销冠的账单" : !salesWin && trusted ? "没转正，但有人等你" : "柜台灯灭了";
}

export function spendAttention(s: Campaign, servingId: CustomerId, cost: number): Campaign {
  const ids = floorCustomers(s);
  const waitMeters = { ...s.waitMeters };
  const newlyLost: CustomerId[] = [];
  for (const id of ids) {
    if (id === servingId || s.dayServed.includes(id) || s.lost.includes(id)) continue;
    const next = Math.max(0, (waitMeters[id] ?? CUSTOMERS[id].patience) - cost);
    waitMeters[id] = next;
    if (next === 0) newlyLost.push(id);
  }
  if (newlyLost.length === 0) return { ...s, waitMeters };
  let flags = s.flags;
  let log = s.history;
  let relations = s.relations;
  for (const id of newlyLost) {
    flags = flag({ ...s, flags }, `lost:${id}`);
    log = history({ ...s, history: log }, CUSTOMERS[id].lostLine);
    if (CUSTOMERS[id].rival) relations = { ...relations, luyao: relations.luyao - 4 };
  }
  return { ...s, waitMeters, lost: [...s.lost, ...newlyLost], flags, history: log, relations };
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

export function leaveSample(s: Campaign, customerId: CustomerId): Campaign {
  if (s.samples <= 0) return s;
  const customer = CUSTOMERS[customerId];
  return { ...s, samples: s.samples - 1, trust: clamp(s.trust + 4), flags: flag(s, `sample:${customerId}`), history: history(s, `你给${customer.name}留下试用小样`) };
}

export function resolveSale(s: Campaign, input: {
  customerId: CustomerId;
  selectedProduct: ProductId;
  tested: boolean;
  askedQuestion: number | null;
  claimed: boolean;
  interruption: boolean;
  interruptionHandled: boolean;
  force: boolean;
}): { campaign: Campaign; outcome: SaleOutcome } | null {
  const customer = CUSTOMERS[input.customerId];
  if (!customer || !input.tested) return null;
  const correct = input.selectedProduct === customer.bestProduct;
  const guarded = !input.interruption || input.interruptionHandled;
  const usefulQuestion = input.askedQuestion !== null && QUESTIONS[customer.id][input.askedQuestion].useful;
  const wrongButForced = !correct && input.force;
  const sold = correct || wrongButForced;
  const amount = sold ? (correct ? customer.sale : customer.wrongSale) : 0;
  const campaign: Campaign = {
    ...s, sales: s.sales + amount, daySales: s.daySales + amount,
    trust: clamp(s.trust + (correct ? 7 : -10) + (usefulQuestion ? 4 : -2) + (guarded ? 2 : -6)),
    compliance: clamp(s.compliance + (correct ? 1 : -5)), energy: Math.max(0, s.energy - 14),
    evidence: s.evidence + (input.claimed ? 1 : 0), dayServed: [...s.dayServed, customer.id], activeSession: null,
    flags: flag(s, `served:${customer.id}:${correct ? "good" : sold ? "risky" : "refused"}`),
    history: history(s, sold ? `${customer.name}${correct ? "得到准确推荐" : "被强推了不合适的产品"}` : `${customer.name}拒绝了不合适的推荐`),
  };
  return {
    campaign,
    outcome: {
      good: correct && guarded, amount,
      title: sold ? (correct ? `${customer.name}成交` : `${customer.name}勉强买单`) : `${customer.name}拒绝成交`,
      body: sold ? (correct ? (guarded ? "你解决了真正需求。她记住的不只是产品，还有你的判断。" : "产品选对了，但订单归属被人插进一道缝。") : "数字更好看了，但她最在意的问题没有解决。退货风险已经留下。") : "她没有为错误判断买单。你丢掉一笔销售，但至少还有机会记住这次反应。",
    },
  };
}

export function startNextDay(s: Campaign): Campaign {
  const advanced = { ...s, day: s.day + 1, daySales: 0, dayServed: [], lost: [], energy: Math.min(100, s.energy + 24), activeSession: null, waitMeters: {} };
  const dawned = applyDawn(advanced);
  return { ...dawned, waitMeters: metersFor(floorCustomers(dawned)) };
}

export function openFloorState(s: Campaign): Campaign {
  const dawned = applyDawn(s);
  return { ...dawned, waitMeters: metersFor(floorCustomers(dawned), dawned.waitMeters) };
}

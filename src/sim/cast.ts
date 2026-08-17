import { asset } from "./asset";
import type { Actor, CloseEvent, CustomerId, Fit, Product, ProductId, StaffId } from "./types";

export const TARGET = 20_000;

export const PRODUCTS: Product[] = [
  { id: "soft", short: "柔焦", name: "云纱柔焦粉底", price: 980, note: "轻薄，镜头近看更自然" },
  { id: "glow", short: "持妆", name: "鎏光持妆套组", price: 1280, note: "高遮瑕、高提成，干燥和敏感风险高" },
  { id: "repair", short: "修护", name: "夜兰修护精华", price: 1680, note: "舒缓干燥与泛红" },
];

export const REACTIONS: Record<ProductId, { good: string; bad: string }> = {
  soft: { good: "她靠近镜子看了两秒，鼻翼没有结块。", bad: "轻薄是真的，但没解决她此刻的问题。" },
  glow: { good: "妆面立刻完整，她的目光停在镜子里。", bad: "她皱眉摸了摸脸：太厚，也有点绷。" },
  repair: { good: "泛红缓下来，她第一次主动问起用法。", bad: "肤感舒服，但不是她现在最想解决的。" },
};

type CustomerSeed = {
  id: CustomerId;
  name: string;
  role: string;
  art: string;
  portrait: string;
  opening: string;
  need: string;
  bestProduct: ProductId;
  sale: number;
  wrongSale: number;
  patience: number;
  lostLine: string;
  rival: boolean;
  wait: string;
  cluePool: string[];
  fits: Record<ProductId, Fit>;
};

export const CUSTOMERS: Record<CustomerId, CustomerSeed> = {
  shen: { id: "shen", name: "沈薇", role: "熟客博主", art: asset("assets/chibi/shen.png"), portrait: asset("assets/aurora/customer-shen-consultation.png"), opening: "先说好，我不缺粉底。又是品牌话术，我就去对面。", need: "镜头近看不浮粉", bestProduct: "soft", sale: 2860, wrongSale: 3480, patience: 4, lostLine: "陆遥带沈薇去了维珞", rival: true, wait: "tester", cluePool: ["她把镜头凑到鼻翼上看粉感。", "包里已经有一支厚粉底。", "她在看对面的持妆赠品袋。"], fits: { soft: "good", glow: "push", repair: "poor" } },
  mei: { id: "mei", name: "梅女士", role: "下班客", art: asset("assets/chibi/mei.png"), portrait: asset("assets/aurora/customer-mei-consultation.png"), opening: "我明早要见客户。别给我推荐一整套。", need: "快速改善干燥疲态", bestProduct: "repair", sale: 1680, wrongSale: 2560, patience: 6, lostLine: "梅女士看了看表，赶去地铁", rival: false, wait: "tester_side", cluePool: ["妆面干，嘴角起皮。", "她看了两次手表。", "她拿起了最贵的套组盒子。"], fits: { soft: "poor", glow: "push", repair: "good" } },
  xiaoyu: { id: "xiaoyu", name: "小雨", role: "预算有限", art: asset("assets/chibi/xiaoyu.png"), portrait: asset("assets/aurora/customer-xiaoyu-consultation.png"), opening: "我只有一千块。别闷痘。", need: "不刺激痘肌，预算内改善气色", bestProduct: "soft", sale: 980, wrongSale: 1680, patience: 6, lostLine: "小雨被中庭小样台叫走", rival: false, wait: "tester_side", cluePool: ["下巴有新痘。", "她把零钱数了两遍。", "她问套组能不能分期。"], fits: { soft: "good", glow: "poor", repair: "poor" } },
  zhou: { id: "zhou", name: "周姐", role: "对比维珞", art: asset("assets/chibi/zhou.png"), portrait: asset("assets/aurora/customer-zhou-consultation.png"), opening: "对面说你们持妆会暗沉。给我一个站得住的理由。", need: "拍照不暗沉，但不能像换了一层皮", bestProduct: "glow", sale: 1280, wrongSale: 620, patience: 5, lostLine: "陆遥把周姐接到了维珞", rival: true, wait: "tester", cluePool: ["她捏着维珞的试色卡。", "她停在绮光持妆柜的立牌前。", "她摸了摸脸，像是嫌厚。"], fits: { soft: "poor", glow: "good", repair: "poor" } },
  zhao: { id: "zhao", name: "赵女士", role: "给女儿买", art: asset("assets/chibi/zhao.png"), portrait: asset("assets/aurora/customer-zhao-consultation.png"), opening: "东西是买给我女儿的。你别看我的脸。", need: "敏感肌、低风险礼物", bestProduct: "repair", sale: 1680, wrongSale: 2860, patience: 6, lostLine: "赵女士说再问问女儿", rival: false, wait: "tester", cluePool: ["她不照镜子，只看盒子。", "她把女儿过敏史念了一遍。", "她问哪套包装最好看。"], fits: { soft: "poor", glow: "push", repair: "good" } },
  duan: { id: "duan", name: "段小姐", role: "说只看看", art: asset("assets/chibi/duan.png"), portrait: asset("assets/aurora/customer-duan-consultation.png"), opening: "我就是看看。你们别围上来。", need: "给易闷痘的室友选对礼物", bestProduct: "soft", sale: 980, wrongSale: 1680, patience: 5, lostLine: "段小姐去中庭领了别的小样", rival: false, wait: "aisle", cluePool: ["她站在过道，一靠近就退半步。", "手机备忘录写着室友闷痘。", "她看了一眼中庭免费小样台。"], fits: { soft: "good", glow: "poor", repair: "poor" } },
  anjie: { id: "anjie", name: "安姐", role: "婚前试妆", art: asset("assets/chibi/anjie.png"), portrait: asset("assets/aurora/customer-anjie-consultation.png"), opening: "婚礼还有一周。我要一套绝对不出错的。", need: "先稳定泛红，再做轻薄婚礼妆", bestProduct: "repair", sale: 6800, wrongSale: 9200, patience: 7, lostLine: "安姐让苏蔓接手", rival: false, wait: "tester", cluePool: ["两颊有固定泛红。", "苏蔓站在她侧后方没走远。", "她把最贵的全套往自己面前推。"], fits: { soft: "poor", glow: "push", repair: "good" } },
  returning: { id: "returning", name: "沈薇", role: "带团队回来", art: asset("assets/chibi/shen.png"), portrait: asset("assets/aurora/customer-shen-consultation.png"), opening: "昨天那次直播间都在问。你得保证不是昙花一现。", need: "稳定复现轻薄效果", bestProduct: "soft", sale: 4200, wrongSale: 1680, patience: 6, lostLine: "沈薇说团队先去维珞", rival: true, wait: "tester", cluePool: ["助理举着手机要拍同款。", "她翻出上次的轻薄小票。", "她问持妆能不能撑整场直播。"], fits: { soft: "good", glow: "push", repair: "poor" } },
  zhou2: { id: "zhou2", name: "周姐", role: "替同事看", art: asset("assets/chibi/zhou.png"), portrait: asset("assets/aurora/customer-zhou-consultation.png"), opening: "同事问有没有修护。今天顺便看。", need: "给同事带低刺激修护", bestProduct: "repair", sale: 1680, wrongSale: 1280, patience: 5, lostLine: "周姐说同事先去对面问", rival: false, wait: "tester_side", cluePool: ["她念同事的敏感词。", "袋子里已经有一支绮光持妆。", "她问有没有更贵的套组。"], fits: { soft: "poor", glow: "poor", repair: "good" } },
};

export function fitFor(actor: Pick<Actor, "fits" | "bestProduct">, product: ProductId): Fit {
  if (actor.fits) return actor.fits[product];
  return product === actor.bestProduct ? "good" : "poor";
}

export function pendingReturn(flags: string[]) {
  const handled = new Set(flags.filter(flag => flag.startsWith("refunded:")).map(flag => flag.slice(9)));
  for (const flag of flags) {
    if (!flag.startsWith("return:")) continue;
    const [, id, amount] = flag.split(":");
    if (!id || handled.has(id)) continue;
    return { id: id as CustomerId, amount: Number(amount) || 0 };
  }
  return null;
}

export const DAYS: Array<{ day: number; title: string; customers: CustomerId[] }> = [
  { day: 1, title: "入口位", customers: ["shen", "mei"] },
  { day: 2, title: "新人价码", customers: ["xiaoyu", "zhou"] },
  { day: 3, title: "不是买给自己", customers: ["zhao", "duan"] },
  { day: 4, title: "婚礼前一周", customers: ["anjie"] },
  { day: 5, title: "最后一单", customers: ["returning"] },
];

type StaffSeed = { id: StaffId; name: string; role: string; art: string; portrait: string; home: string; lines: string[] };

export const STAFF: StaffSeed[] = [
  { id: "xuyuan", name: "许愿", role: "试用期柜姐", art: asset("assets/chibi/xuyuan.png"), portrait: asset("assets/aurora/xuyuan.png"), home: "xuyuan", lines: ["我先看她真正要什么。", "陆遥已经靠过来了。"] },
  { id: "luyao", name: "陆遥", role: "竞品销冠", art: asset("assets/chibi/luyao.png"), portrait: asset("assets/aurora/luyao.png"), home: "luyao", lines: ["这单我也可以做。", "她之前用我们家持妆。"] },
  { id: "roman", name: "罗曼", role: "柜长", art: asset("assets/chibi/roman.png"), portrait: asset("assets/aurora/roman.png"), home: "roman", lines: ["客单，别只顾着聊天。", "今日排名已更新。"] },
  { id: "suman", name: "苏蔓", role: "资深柜姐", art: asset("assets/chibi/suman.png"), portrait: asset("assets/aurora/suman.png"), home: "suman", lines: ["先看她的皮肤，再开口。", "闭店后来找我。"] },
  { id: "tangke", name: "唐可", role: "同期新人", art: asset("assets/chibi/tangke.png"), portrait: asset("assets/aurora/tangke.png"), home: "tangke", lines: ["这单本来可以留下。", "别把人往外推。"] },
  { id: "fangmin", name: "方敏", role: "合规", art: asset("assets/chibi/fangmin.png"), portrait: asset("assets/aurora/fangmin.png"), home: "backroom", lines: ["缺口要对得上人。", "我要一个能写进档案的说法。"] },
];

export function makeStaff(): Actor[] {
  return STAFF.map(seed => ({
    id: seed.id,
    kind: "staff" as const,
    name: seed.name,
    role: seed.role,
    art: seed.art,
    portrait: seed.portrait,
    home: seed.home,
    goal: seed.home,
    x: 50,
    y: 88,
    destX: 50,
    destY: 88,
    path: [],
    facing: 1 as const,
    label: seed.role,
    speech: "",
    speechLeft: 0,
    patience: 0,
    maxPatience: 0,
    status: "waiting" as const,
    rival: false,
    need: "",
    opening: "",
    bestProduct: null,
    sale: 0,
    wrongSale: 0,
    cluePool: [],
    clues: [],
    fits: null,
    tried: [],
    threatLeft: 0,
    refund: 0,
    gifted: false,
    held: 0,
    away: 0,
  }));
}

export function makeCustomer(id: CustomerId, index: number): Actor {
  const seed = CUSTOMERS[id];
  return {
    id,
    kind: "customer",
    name: seed.name,
    role: seed.role,
    art: seed.art,
    portrait: seed.portrait,
    home: seed.wait,
    goal: seed.wait,
    x: 42 + index * 10,
    y: 92,
    destX: 42 + index * 10,
    destY: 92,
    path: [],
    facing: 1,
    label: "进店",
    speech: seed.opening,
    speechLeft: 8,
    patience: seed.patience,
    maxPatience: seed.patience,
    status: "entering",
    rival: seed.rival,
    need: seed.need,
    opening: seed.opening,
    bestProduct: seed.bestProduct,
    sale: seed.sale,
    wrongSale: seed.wrongSale,
    cluePool: [...seed.cluePool],
    clues: [],
    fits: { ...seed.fits },
    tried: [],
    threatLeft: 0,
    refund: 0,
    gifted: false,
    held: 0,
    away: 0,
  };
}

export function makeReturnee(id: CustomerId, amount: number): Actor {
  const actor = makeCustomer(id, 0);
  actor.role = "退货";
  actor.home = "checkout";
  actor.goal = "checkout";
  actor.label = "退货";
  actor.opening = "昨天那单我要退。";
  actor.speech = "昨天那单我要退。";
  actor.rival = false;
  actor.refund = amount;
  actor.patience = 10;
  actor.maxPatience = 10;
  actor.status = "entering";
  return actor;
}

export function dayCustomers(day: number, flags: string[]): CustomerId[] {
  const base = [...(DAYS[day - 1]?.customers ?? [])];
  if (day === 4 && flags.includes("served:zhou:good")) base.push("zhou2");
  return base;
}

export function closingFor(day: number, flags: string[]): CloseEvent {
  if (day === 1) {
    return {
      speaker: "suman",
      title: "少了两份热门赠品",
      body: "苏蔓说上午太忙忘记登记，让你把缺口记到刚才的订单里。",
      choices: [
        { id: "refuse-suman", label: "拒绝补登记", detail: "明天苏蔓不帮你拖客 · 赠品还在", result: "苏蔓沉默了。她不再把你当自己人。", tomorrow: { helper: null, luyaoDelay: 10 } },
        { id: "cover-suman", label: "替她补上", detail: "明天苏蔓会替你拖住一个客人 · 赠品账空了", result: "苏蔓欠你一次。系统里留下不属于你的缺口。", tomorrow: { helper: "suman", giftsDelta: -1, luyaoDelay: 8 } },
      ],
    };
  }
  if (day === 2) {
    return {
      speaker: "tangke",
      title: flags.includes("taken:xiaoyu") || flags.includes("served:xiaoyu:good") || flags.includes("served:xiaoyu:risky") ? "她说这单该算她的" : "小雨已经走了",
      body: flags.includes("taken:xiaoyu") ? "唐可已经把小雨带到收银。小票时间戳比你早。" : flags.includes("lost:xiaoyu") ? "唐可把小样袋摔在抽屉里：这单本来可以留下。" : "唐可拿出上午的咨询记录：小雨先问过她色号。",
      choices: [
        { id: "yield-tang", label: "把单让给她", detail: "少 ¥490 · 明天陆遥晚一点才截", result: "唐可答应欠你一单。", tomorrow: { helper: "tangke", luyaoDelay: 18 } },
        { id: "keep-tang", label: "按有效接待留下", detail: "单归你 · 明天陆遥一开门就截", result: "订单归你。她开始把你当竞争者。", tomorrow: { luyaoDelay: 0 } },
      ],
    };
  }
  if (day === 3) {
    return {
      speaker: "roman",
      title: "总部还在催修护数据",
      body: "罗曼没有骂你，只把区域群截图转过来：今天这款必须有数。",
      choices: [
        { id: "tell-truth", label: "如实说", detail: "明天陆遥晚一点才截 · 数字不好看", result: "罗曼让你留下十分钟。她没有帮你圆。", tomorrow: { luyaoDelay: 16 } },
        { id: "push-data", label: "用别的订单顶", detail: "明天陆遥照常截 · 赠品窗会被盯", result: "群里安静了。方敏的文件夹多了一条对不上的数。", tomorrow: { luyaoDelay: 0 } },
      ],
    };
  }
  if (day === 4) {
    return {
      speaker: "anjie",
      title: "把赠品都装进去",
      body: "她要六套旅行装送伴娘。系统额度只够两套。",
      choices: [
        { id: "refuse-gifts", label: "只按额度给", detail: "赠品还在 · 安姐不会再让", result: "安姐脸色不好看。罗曼第一次说你能守底线。", tomorrow: { giftsDelta: 0, luyaoDelay: 8 } },
        { id: "give-gifts", label: "私下补足", detail: "赠品空了 · 明天方敏会对空位", result: "安姐满意离开。盘点表上多了四个空位。", tomorrow: { giftsDelta: -1, luyaoDelay: 6 } },
      ],
    };
  }
  const dirty = flags.includes("cover-suman") || flags.includes("give-gifts") || flags.includes("push-data");
  return {
    speaker: "fangmin",
    title: dirty ? "请解释赠品缺口" : "账对得上，她仍要一句话",
    body: dirty ? "方敏把补登记和盘点对在一起。缺口对得上人。" : "赠品账没有把你单独钉住。区域要写储备人选。",
    choices: dirty
      ? [
          { id: "submit-all", label: "提交全部记录", detail: "不删减", result: "调查会伤到同事，也可能证明你没有独造缺口。" },
          { id: "take-blame", label: "自己扛下", detail: "保护团队", result: "苏蔓记住了你的保护。总部也记住了同一件事。" },
        ]
      : [
          { id: "accept-reserve", label: "接受被写进储备", detail: "数字和纪律都对你有利", result: "罗曼第一次写「可独立带班」。" },
          { id: "credit-team", label: "把评价分给柜台", detail: "少出风头", result: "苏蔓看你的眼神松了一点。" },
        ],
  };
}

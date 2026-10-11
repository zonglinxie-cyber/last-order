// 人情场的货架。旧版只有三支货（campaign.ts 的柔焦/持妆/修护），32 位有诉求表的客人里
// 28 位只有一支"买得起的正解"，16 位挤在同一支上 —— 货架给不出选择，也满足不了低预算那几位。
// 这一份是人情场自己的货架：8 支、六个价位（¥400~¥2,280），判断公式与 campaign.ts 同口径，
// 但货不进旧五日版，所以旧版那些钉死的路线金额不受影响。柔焦/持妆/修护三支的档位和价格照抄旧版，
// 三处以上共用的阈值（POSITIVE_FIT / MIXED_FIT）也从 campaign.ts 读，不在这里重定义。
import { MIXED_FIT, POSITIVE_FIT, type Demand, type FitTier, type Trait } from "../campaign.ts";
import type { Person } from "./types.ts";

export type ShelfId = "plain" | "mist" | "balm" | "soft" | "base" | "glow" | "repair" | "mask";

export type ShelfItem = {
  name: string; short: string; price: number;
  /** 界面 serve-note 那句：它适合什么样的脸，代价在哪。 */
  note: string;
  /** 货架格子上那行短标签：把 note 里"它管什么"压成两三个词，八支一眼扫完，不必逐支点。
   *  只能由 TAG_WORD 里那五个词拼（world-shelf.test.ts 钉着"不许虚标"）。 */
  tag: string;
  traits: Record<Trait, number>;
};

/** 短标签里唯一能出现的五个词，每个词就是一句诉求的缩写。
 *  写了这个词，这一支在该条上必须至少 1 分 —— 标签是承诺，不能是营销。 */
export const TAG_WORD: Record<string, Trait> = {
  薄: "natural", 见效: "correct", 退红: "soothe", 不闷: "steady", 撑妆: "wear",
};

// 产品线照真实的顶奢专柜排（参考海蓝之谜 / 赫莲娜 / 肌肤之钥这一档的柜台）：一半底妆、一半护肤，
// 价位梯度也照那一档的柜台价 —— 防晒隔离四五百、粉底一千上下、精华一千六七、面霜两千往上。
// 名字是绮光自己的，不借真牌子的名。档位向量与价格沿用上一版（模拟器与货架测试钉着），
// 换的是"它是什么东西"：玩家看到的是柜台上真有的品类，而不是八个编出来的功能名。
export const SHELF: Record<ShelfId, ShelfItem> = {
  // 平替：只强在"薄"和"不闷"两条，见效与舒缓都是 0。低预算的正解，也是高预算那位的陷阱。
  plain: {
    name: "清透防晒隔离乳", short: "隔离", price: 400,
    note: "薄、不闷、不堵毛孔，四百一支；它只管打底防晒，当天看不出什么变化",
    tag: "薄·不闷",
    traits: { natural: 2, correct: 0, soothe: 0, steady: 2, wear: 0 },
  },
  // 便宜那一档只管"先别泛红"，带妆和遮瑕一律不沾。
  mist: {
    name: "舒缓修护喷雾", short: "喷雾", price: 680,
    note: "舒缓干燥与泛红，六百八一瓶；它是急救，不撑一整天",
    tag: "退红",
    traits: { natural: 1, correct: 0, soothe: 2, steady: 1, wear: 0 },
  },
  balm: {
    name: "维稳修护乳", short: "乳液", price: 880,
    note: "温和不闷痘，八百八一支；见效慢，红得厉害时它压不住",
    tag: "不闷",
    traits: { natural: 1, correct: 0, soothe: 1, steady: 2, wear: 0 },
  },
  soft: {
    name: "云纱轻薄粉底液", short: "粉底", price: 980,
    note: "轻薄分区叠加，镜头近看更自然；带妆时间越长越需要补",
    tag: "薄·撑妆",
    traits: { natural: 2, correct: 1, soothe: 0, steady: 2, wear: 1 },
  },
  // 粉霜比粉底液多一条"能稳住泛红"（底妆里掺了养肤的东西），代价是带妆那条让出去了。
  base: {
    name: "精华养肤粉霜", short: "粉霜", price: 1180,
    note: "粉底里掺了养肤成分，又薄又能撑住干燥，一千一百八；带妆一整天它不占这条",
    tag: "薄·退红",
    traits: { natural: 2, correct: 1, soothe: 1, steady: 2, wear: 0 },
  },
  glow: {
    name: "鎏光持妆套组", short: "持妆", price: 1280,
    note: "持妆粉底加定妆粉，高遮瑕，强灯光和长时间带妆才站得住；皮肤正不稳时会发干",
    tag: "见效·撑妆",
    traits: { natural: 0, correct: 2, soothe: 0, steady: 0, wear: 2 },
  },
  repair: {
    name: "夜兰修护精华", short: "精华", price: 1680,
    note: "舒缓干燥与泛红，见效不靠厚重遮盖；它是护肤，不是当天的妆",
    tag: "退红·不闷",
    traits: { natural: 0, correct: 1, soothe: 2, steady: 2, wear: 0 },
  },
  // 最贵那一档：三条都给到，但"薄"那条是 0 —— 面霜化不出一张妆，怕被看出化妆的人一律接不住。
  mask: {
    name: "夜兰密集修护面霜", short: "面霜", price: 2280,
    note: "稳住、见效、低风险三条都占，两千二百八一罐；它是护肤，化不出一张妆",
    tag: "见效·退红",
    traits: { natural: 0, correct: 2, soothe: 2, steady: 2, wear: 1 },
  },
};

export const SHELF_IDS = Object.keys(SHELF) as ShelfId[];

/** 命中她某一条诉求：档位不到她要的水准就按比例打折，超出了不多给。 */
export function shelfFitScore(demands: Demand[], veto: { trait: Trait; below: number } | undefined, id: ShelfId): number {
  const traits = SHELF[id].traits;
  let got = 0, total = 0;
  for (const demand of demands) {
    total += demand.weight;
    got += (Math.min(traits[demand.trait], demand.want) / demand.want) * demand.weight;
  }
  const base = total ? got / total : 0;
  return veto && traits[veto.trait] < veto.below ? base * 0.35 : base;
}

export const shelfFitTier = (score: number): FitTier =>
  score >= POSITIVE_FIT ? "positive" : score >= MIXED_FIT ? "mixed" : "negative";

export const fitOfPerson = (person: Person, id: ShelfId): number =>
  person.skin ? shelfFitScore(person.skin.demands, person.skin.veto, id) : 0;

/** 她这一单的最高命中分。命中到这条线以上，她觉得你不只是"没推错"，而是懂她。 */
export const PERFECT_MATCH = 0.95;
/** 达到 PERFECT_MATCH 时在 SERVE_GOOD_OPINION 之外多给的看法。
 *  八支货之后光看"正解/勉强"两档不够用：同一个人可能三支都过线，只差在命中多少。
 *  这一笔把"钱多的那支"和"最懂她那支"拉开成两个选择。 */
export const PERFECT_MATCH_OPINION = 4;

/** 她最准的那一支：分数最高、并列时取货架上靠前的那支。 */
export const bestShelf = (person: Person): ShelfId =>
  SHELF_IDS.reduce((x, y) => (fitOfPerson(person, y) > fitOfPerson(person, x) ? y : x));

/** 她的预算和用量上限允许她带走几件（不看适配，界面那句"这价最多开几件"读它）。 */
export const affordableUnits = (person: Person, id: ShelfId): number =>
  person.skin ? Math.min(person.skin.maxUnits, Math.floor(person.skin.budget / SHELF[id].price)) : 0;

/** 预算与用量上限把件数削到这里。与 campaign.ts 的 unitsWanted 同一口径，只是价格查这张货架。
 *  勉强（mixed）只带一件，但那一件也得她买得起 —— 买不起就是 0，不是 1。 */
export const shelfUnits = (person: Person, id: ShelfId, tier: FitTier, asked: number): number => {
  if (!person.skin || tier === "negative") return 0;
  const left = affordableUnits(person, id);
  return Math.max(0, Math.min(tier === "mixed" ? 1 : asked, left));
};

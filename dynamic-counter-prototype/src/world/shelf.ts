// 人情场的货架。旧五日版只有三支货（柔焦/持妆/修护），32 位有诉求表的客人里
// 28 位只有一支"买得起的正解"，16 位挤在同一支上 —— 货架给不出选择，也满足不了低预算那几位。
// 这一份先扩到 8 支，再照真专柜一整条线扩到 12 支（见 docs/人情场设计.md「货架扩到十二支」）。
// 适配公式与两条分界线沿用旧版口径；旧版删掉以后，这两条线定义在这里。
//
// 2026-10-21 重排过一次档位（见设计文档「货架尾部那一刀」）。十二支货里原来有四支是"死的"：
// 喷雾、乳液、持妆、精粹水各自被一支更便宜的货在每条诉求上盖住，于是永远当不了"正中" ——
// 不是卖不出去（过线照样成交），而是"你是懂她的那支"这一笔永远轮不到它们。
// 排档位时只守一条：没有哪支货被更便宜的货全面盖住，
// 每支货都要有一处"只有它给得起"的诉求。标签也跟着改：短标签写的就是它真正占的那两条，
// 玩家扫一眼货架、盲策排个序，才知道该往哪一支上伸手。
// 改完以后：喷雾、乳液、持妆各自成了某些人的正中，精粹水仍是 0 位正中 ——
// 它现在占的是"妆前打底"那一格（退红 + 撑妆，只有它两样都给），当搭售品卖，不抢正中。
import type { Demand, Person, Trait } from "./types.ts";

/** 过了这条线她认这支是对症的（positive），过了下一条只算勉强（mixed），再往下是不对症。 */
export const POSITIVE_FIT = 0.78;
export const MIXED_FIT = 0.55;
export type FitTier = "positive" | "mixed" | "negative";

export type ShelfId = "plain" | "mist" | "balm" | "soft" | "base" | "glow" | "repair" | "mask" | "wash" | "sheet" | "cushion" | "essence";

export type ShelfItem = {
  name: string; short: string; price: number;
  /** 界面 serve-note 那句：它适合什么样的脸，代价在哪。 */
  note: string;
  /** 货架格子上那行短标签：把 note 里"它管什么"压成两三个词，十二支一眼扫完，不必逐支点。
   *  只能由 TAG_WORD 里那五个词拼（world-shelf.test.ts 钉着"不许虚标"）。 */
  tag: string;
  traits: Record<Trait, number>;
};

/** 短标签里能出现的词，每个词就是一句诉求的缩写（五条诉求各有一个主词，四条有近义词）。
 *  写了这个词，这一支在该条上必须至少 1 分 —— 标签是承诺，不能是营销。 */
export const TAG_WORD: Record<string, Trait> = {
  薄: "natural", 见效: "correct", 退红: "soothe", 不闷: "steady", 撑妆: "wear",
  // 第二批四支带进来的四个近义词：十二支货只靠五个词排不出两两不同的标签，
  // 而且柜台上本来就这么说 —— 也让"把她那句话跟小字对上"多一步理解，不再是逐字找同一个字。
  温和: "steady", 舒缓: "soothe", 遮瑕: "correct", 提亮: "correct",
};

/** 一条诉求在货架格子上的短词：就是 TAG_WORD 里那五个主词。格子小，只放得下这两个字。 */
export const TRAIT_SHORT: Record<Trait, string> = {
  natural: "薄", correct: "见效", soothe: "退红", steady: "不闷", wear: "撑妆",
};

/** 这一支管不管她这一条：给上一档就算「管」。
 *
 *  这一条是第 51 轮加的：货架原来只给两句营销词，玩家扫一眼分不出「哪一支是她那一支」——
 *  一位客人要四条（周姐：薄、见效、稳、撑妆），而任何一句标签都只写得下两个词，
 *  十二支里只有一支给得起这四条，那一支却看不出来，只能靠一次次试用去撞。
 *  所以货架格子改成对「她」说话：她已经说出口的那几条，每一支货都标出管 / 不管。
 *
 *  只分两档，不分档位：她要几档（want 1 还是 2）还没问出来，界面不能替她编；
 *  档位高低留给试用去验（「认准了」= 每条都接满，「点头」= 对症）。
 *  读的是同一张档位表（SHELF[id].traits），不是另抄一份 —— 抄的那份迟早跟货架脱节。 */
export const shelfCovers = (id: ShelfId, trait: Trait): boolean => SHELF[id].traits[trait] > 0;

/** 她已经说出口的那几条，这一支各管不管（顺序与给的顺序一致）。 */
export const shelfCoversOf = (id: ShelfId, traits: readonly Trait[]): boolean[] =>
  traits.map(trait => shelfCovers(id, trait));

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
  // 喷雾是这一刀里被救回来的一支：原来它跟面膜只差一条"不闷"，而面膜还便宜两百块，
  // 于是它被全面盖住。现在它是"薄 + 退红"那一格 —— 水感、喷上就吸收、不留一层，
  // 泛红的时候救得急；代价是它顶不了一整天（不闷只给 1），也比面膜便宜不了多少。
  mist: {
    name: "舒缓修护喷雾", short: "喷雾", price: 480,
    note: "水感喷雾，泛红时压得住，喷上就吸收不留一层；四百八一瓶，它救得急，顶不了一整天",
    tag: "退红·薄",
    traits: { natural: 2, correct: 0, soothe: 2, steady: 1, wear: 0 },
  },
  // 乳液是第二支被救回来的：原来它和洁面是一模一样的两支，洁面还便宜五百块。
  // 现在它比洁面多一条"见效"（淡纹要慢慢看），于是它成了"要见效但兜里不宽裕"的那一支。
  balm: {
    name: "维稳修护乳", short: "乳液", price: 880,
    note: "温和不闷，一层薄薄的乳液，淡纹要慢慢看；八百八一支，红得厉害时它压不住",
    tag: "见效·不闷",
    traits: { natural: 1, correct: 1, soothe: 1, steady: 2, wear: 0 },
  },
  // 粉底补上了"见效"那一条（遮瑕提亮，镜头里不斑驳）：周姐要薄、见效、稳、撑妆四条全接住，
  // 原来十二支里没有一支给得起这四条，她一直没有正中。
  soft: {
    name: "云纱轻薄粉底液", short: "粉底", price: 980,
    note: "轻薄分区叠加，遮得住痘印也不斑驳，镜头近看更自然；九百八，带妆时间越长越需要补",
    tag: "薄·撑妆",
    traits: { natural: 2, correct: 2, soothe: 0, steady: 2, wear: 1 },
  },
  // 粉霜比粉底液多一条"能稳住泛红"（底妆里掺了养肤的东西），代价是带妆那条让出去了。
  base: {
    name: "精华养肤粉霜", short: "粉霜", price: 1180,
    note: "粉底里掺了养肤成分，又薄又能撑住干燥，一千一百八；带妆一整天它不占这条",
    tag: "薄·退红",
    traits: { natural: 2, correct: 1, soothe: 1, steady: 2, wear: 0 },
  },
  // 持妆是第三支被救回来的：原来气垫在每条诉求上都不比它差，还便宜五百多块。
  // 现在定妆粉压住油光，它占住"撑妆 + 不闷"这一格 —— 叶女士要撑妆、要见效、还不能闷，
  // 原来十二支里没有一支给得起这三条。代价是它厚，脸上正泛红的人接不住。
  glow: {
    name: "鎏光持妆套组", short: "持妆", price: 1280,
    note: "持妆粉底加定妆粉，遮得住、撑得久，定妆粉压住油光不闷；一千二百八，它厚，脸上正泛红时别用",
    tag: "撑妆·不闷",
    traits: { natural: 0, correct: 2, soothe: 0, steady: 1, wear: 2 },
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
  // —— 第二批四支（2026-10-12）：把真专柜一整条线补齐（洁面、面膜、气垫、精粹水）。
  // 排在表尾是有意的：bestShelf 并列时取靠前那支，新货只在"真比老货准"的地方抢走首选，
  // 不会因为同分就把老客的单价拉低。界面按品类另排（SHELF_DISPLAY）。
  // 最便宜的一支：只管温和不闷，低预算、怕闷痘的人多一个选择；要"看得出变化"的人它给不了。
  wash: {
    name: "氨基酸净透洁面", short: "洁面", price: 380,
    note: "温和不闷、洗完不紧绷，三百八一支；它只是洗干净，不上妆也不见效",
    tag: "温和",
    traits: { natural: 1, correct: 0, soothe: 1, steady: 2, wear: 0 },
  },
  // 一盒面膜：稳住泛红又不闷，比精华便宜一半 —— 代价是它不见效，也化不出妆。
  sheet: {
    name: "舒缓修护面膜", short: "面膜", price: 580,
    note: "一盒五片，退红、不闷，五百八；敷完舒服，第二天才看得出，当天不见效",
    tag: "舒缓·不闷",
    traits: { natural: 1, correct: 0, soothe: 2, steady: 2, wear: 0 },
  },
  // 气垫：遮得住、撑得久、还算薄 —— 比持妆套组轻一档，但敏感皮扛不住它。
  cushion: {
    name: "鎏光持妆气垫", short: "气垫", price: 760,
    note: "遮瑕、持妆、上脸还算薄，七百六；皮肤正闹的时候别用，它不管退红也不管闷",
    tag: "遮瑕·撑妆",
    traits: { natural: 1, correct: 2, soothe: 0, steady: 0, wear: 2 },
  },
  // 精粹水是第四支：原来它被粉霜在每条诉求上盖住，当不了正中。现在它是妆前打底那一支 ——
  // 底妆更服帖（撑妆），泛红时也压得住；它不见效，所以当"锦上添花"的那支卖，不抢正中。
  essence: {
    name: "夜兰精粹水", short: "精粹水", price: 1450,
    note: "温和不闷，泛红时能压一点，妆前打底让底妆更服帖；一千四百五，它不见效，急着要效果的人买回去是锦上添花",
    tag: "退红·撑妆",
    traits: { natural: 1, correct: 0, soothe: 2, steady: 1, wear: 1 },
  },
};

/** 货架格子在界面上的排法：底妆一排、护肤两排（与 SHELF_IDS 的判定顺序无关）。 */
export const SHELF_LINES: Array<{ word: string; ids: ShelfId[] }> = [
  { word: "底妆", ids: ["cushion", "soft", "base", "glow"] },
  { word: "护肤", ids: ["wash", "plain", "mist", "sheet", "balm", "essence", "repair", "mask"] },
];

export const SHELF_IDS = Object.keys(SHELF) as ShelfId[];

/** 命中她某一条诉求：档位不到她要的水准就按比例打折，超出了不多给。
 *  几支一起看时，每条诉求取几支里给得最高的���档 —— 这才叫「两支合起来接住了她的事」。 */
export function shelfFitScoreOf(demands: Demand[], veto: { trait: Trait; below: number } | undefined, ids: ShelfId[]): number {
  const traits = ids.map(id => SHELF[id].traits);
  let got = 0, total = 0;
  for (const demand of demands) {
    total += demand.weight;
    const best = Math.max(...traits.map(t => t[demand.trait]));
    got += (Math.min(best, demand.want) / demand.want) * demand.weight;
  }
  const base = total ? got / total : 0;
  // 底线是她不能接受的那一条：几支里有一支破了就不行 —— 破底线的那支根本不卖。
  return veto && traits.some(t => t[veto.trait] < veto.below) ? base * 0.35 : base;
}

/** 命中她某一条诉求：档位不到她要的水准就按比例打折，超出了不多给。 */
export function shelfFitScore(demands: Demand[], veto: { trait: Trait; below: number } | undefined, id: ShelfId): number {
  return shelfFitScoreOf(demands, veto, [id]);
}

export const shelfFitTier = (score: number): FitTier =>
  score >= POSITIVE_FIT ? "positive" : score >= MIXED_FIT ? "mixed" : "negative";

export const fitOfPerson = (person: Person, id: ShelfId): number =>
  person.skin ? shelfFitScore(person.skin.demands, person.skin.veto, id) : 0;

/** 两支合起来的命中分：每条诉求取两支里给得更高的那一档。
 *  她的事要两支才接得住时，单支再准也只是「差一口气」，这一支才是那个「合起来才正中」的答案。 */
export const fitOfPair = (person: Person, a: ShelfId, b: ShelfId): number =>
  person.skin ? shelfFitScoreOf(person.skin.demands, person.skin.veto, [a, b]) : 0;

/** 搭得上这一支的那些货：这一支自己接不满她要的事，配上它才接得全，而且她买得起这两支。
 *  这是「再搭一支」那行的候选 —— 只列真的能配成的那几支，不列配不成的。
 *  单独就接得全的那支不在里头：她有单支正中时，搭什么都是多余的钱。 */
export const pairPartners = (person: Person, a: ShelfId): ShelfId[] => {
  const skin = person.skin;
  if (!skin) return [];
  if (skin.maxUnits < 2) return [];                   // 她一次只肯带走一件，配不成
  if (affordableUnits(person, a) <= 0) return [];
  if (fitOfPerson(person, a) >= PERFECT_MATCH) return [];
  return SHELF_IDS.filter(b => b !== a && affordableUnits(person, b) > 0
    && SHELF[a].price + SHELF[b].price <= skin.budget
    && fitOfPair(person, a, b) >= PERFECT_MATCH);
};

/** 她的事是不是「一件货接不住、得配两支」：没有单支正中，却有配得成的两支。 */
export const needsPair = (person: Person): boolean =>
  !!person.skin && !perfectShelf(person) && SHELF_IDS.some(a => pairPartners(person, a).length > 0);

/** 搭的那一支她放不放得下：件数上限够两支、钱够买这一对。
 *  放不下就不算配成 —— 不拿「两支合起来」的分数，也不把它算进卖出的件数。
 *  结算、界面报价、收据都读这一份，别各判一遍。 */
export const pairFits = (person: Person, a: ShelfId, b: ShelfId): boolean =>
  !!person.skin && person.skin.maxUnits >= 2
  && person.skin.budget >= SHELF[a].price + SHELF[b].price;

/** 她这一单的最高命中分。命中到这条线以上，她觉得你不只是"没推错"，而是懂她。 */
export const PERFECT_MATCH = 0.95;
/** 正中那支在 SERVE_GOOD_OPINION 之外多给的看法。
 *  货一多光看"正解/勉强"两档不够用：同一个人可能三支都过线，只差在命中多少。
 *  这一笔把"钱多的那支"和"最懂她那支"拉开成两个选择。 */
export const PERFECT_MATCH_OPINION = 4;

/** 她买得起的、最便宜的「两支合起来正中」那一对：她要的每一条都被接住，且没让她为不需要的东西多付。
 *  比它贵的组合照样接得住她的每一条，但拿不到「你懂她」那一笔 —— 跟单支一个口径。
 *  没有就是 null（她的事一件货就接得住，或者根本没有配得成的两支）。 */
export const perfectPairOf = (person: Person): [ShelfId, ShelfId] | null => {
  if (!person.skin) return null;
  let best: [ShelfId, ShelfId] | null = null;
  let bestPrice = Infinity;
  for (const a of SHELF_IDS) for (const b of SHELF_IDS) {
    if (a === b || !pairFits(person, a, b)) continue;
    if (fitOfPair(person, a, b) < PERFECT_MATCH) continue;
    const price = SHELF[a].price + SHELF[b].price;
    // 同价时取货架上靠前的那一对 —— 跟 perfectShelf 的并列口径一样，不让读数自己飘。
    const older = SHELF_IDS.indexOf(a) + SHELF_IDS.indexOf(b);
    const bestOlder = best ? SHELF_IDS.indexOf(best[0]) + SHELF_IDS.indexOf(best[1]) : Infinity;
    if (price < bestPrice || (price === bestPrice && older < bestOlder)) { best = [a, b]; bestPrice = price; }
  }
  return best;
};

/** 这一对是不是她那「最省的正中」：接住每一条、买得起，而且是最便宜的那一对。
 *  贵的那一对接得住她的每一条，却只是「对症」—— 跟单支「贵的那支也接住，却不是正中」是同一个分法。
 *  她一件货就接得住的话，这一对只是多卖了她一件：那是「对症」，不是「懂她」。 */
export const isPerfectPair = (person: Person, a: ShelfId, b: ShelfId): boolean => {
  const best = perfectPairOf(person);
  if (!best || perfectShelf(person)) return false;
  return fitOfPair(person, a, b) >= PERFECT_MATCH && pairFits(person, a, b)
    && SHELF[a].price + SHELF[b].price === SHELF[best[0]].price + SHELF[best[1]].price;
};

/** 她最准的那一支：分数最高、并列时取货架上靠前的那支。对手与托单读它。 */
export const bestShelf = (person: Person): ShelfId =>
  SHELF_IDS.reduce((x, y) => (fitOfPerson(person, y) > fitOfPerson(person, x) ? y : x));

/** 她买得起、而且真的对症的那几支里，最贵的那一支。
 *  老同事那一档用的：他自己知道她那几样要什么，开单就往贵里走 —— 不是坑她，是把她的钱袋打开。
 *  没有对症的那支就退回她自己最准的那支 —— 他也得卖她能接受的东西。 */
export const richestShelf = (person: Person): ShelfId => {
  if (!person.skin) return bestShelf(person);
  const fit = SHELF_IDS.filter(id => fitOfPerson(person, id) >= POSITIVE_FIT && affordableUnits(person, id) > 0);
  if (!fit.length) return bestShelf(person);
  return fit.reduce((x, y) => (SHELF[y].price > SHELF[x].price ? y : x));
};

/** 她的预算和用量上限允许她带走几件（不看适配，界面那句"这价最多开几件"读它）。 */
export const affordableUnits = (person: Person, id: ShelfId): number =>
  person.skin ? Math.min(person.skin.maxUnits, Math.floor(person.skin.budget / SHELF[id].price)) : 0;

/** 正中：买得起、每条诉求都接住的最便宜那支；并列按货架顺序。
 *  让「正中」不是一串都能拿的分，而是一支具体的货：贵的全接住仍是对症，但不拿正中那一笔；
 *  她要的「每条都接住」也仍要真的买得起，不能让超预算的完美货占着正中。没有就是 null。 */
export const perfectShelf = (person: Person): ShelfId | null => {
  if (!person.skin) return null;
  const fit = SHELF_IDS.filter(id => fitOfPerson(person, id) >= PERFECT_MATCH && affordableUnits(person, id) > 0);
  return fit.length ? fit.reduce((x, y) => (SHELF[y].price < SHELF[x].price ? y : x)) : null;
};
export const isPerfectMatch = (person: Person, id: ShelfId): boolean => perfectShelf(person) === id;

/** 预算与用量上限把件数削到这里。与 campaign.ts 的 unitsWanted 同一口径，只是价格查这张货架。
 *  勉强（mixed）只带一件，但那一件也得她买得起 —— 买不起就是 0，不是 1。 */
export const shelfUnits = (person: Person, id: ShelfId, tier: FitTier, asked: number): number => {
  if (!person.skin || tier === "negative") return 0;
  const left = affordableUnits(person, id);
  return Math.max(0, Math.min(tier === "mixed" ? 1 : asked, left));
};

/** 这一单卖掉的货：主支几件，外加搭的那一支一件。
 *  两支要一起买 —— 件数不能超她的上限，钱不能超她的预算，所以搭的那支先占一件，
 *  主支能拿几件得给它留出位置。结算与收据都读这一份，别各算一遍。 */
export function serveItemsOf(person: Person, main: ShelfId, units: number, tier: FitTier,
  extra: ShelfId | null): Array<{ product: ShelfId; units: number }> {
  const skin = person.skin;
  if (!skin) return [];
  const price = SHELF[main].price;
  const extraPrice = extra ? SHELF[extra].price : 0;
  const extraUnits = extra && skin.maxUnits >= 2 && skin.budget >= price + extraPrice ? 1 : 0;
  const base = shelfUnits(person, main, tier, units);
  const mainUnits = extraUnits
    ? Math.max(0, Math.min(base, skin.maxUnits - 1, Math.floor((skin.budget - extraPrice) / price)))
    : base;
  const out: Array<{ product: ShelfId; units: number }> = [];
  if (mainUnits > 0) out.push({ product: main, units: mainUnits });
  if (extraUnits > 0) out.push({ product: extra!, units: 1 });
  return out;
}

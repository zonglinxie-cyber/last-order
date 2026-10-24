// 第 4 级：分支。三选一，各成一条结局线。
//
// 分支存在 World 的 qualities 里（"career:branch:<id>" = 1），跟年景（"year:<id>"）、
// 星期规矩（"week:<id>"）一个写法：键里带 id，值是 1 —— 换季时 "career:" 前缀本来就带着走，
// 引擎那边一个字都不用改。
//
// 为什么第 4 级是"分支"而不是第四个数：前三级每升一级，玩法上多一件事（多 5 点精力、多一位客人、
// 少一点被抢）。第 4 级多的是**一整条不同的活法** —— 三条路的客群、对手、账本结构全不一样，
// 所以这一级发的不是一笔数值，是「往后的日子按哪本账过」。
import type { World } from "./types.ts";
import { districtModsOf } from "./district.ts";

export type CareerBranch = "district" | "weiluo" | "own";
export const BRANCH_IDS: readonly CareerBranch[] = ["district", "weiluo", "own"];

export type BranchSpec = {
  id: CareerBranch;
  /** 第 4 级这一级叫什么（分支不同，名字也不同） */
  name: string;
  /** 这一级手上是怎么过的 —— 跟第 2、3 级一个口径，写的是"玩法上多了什么" */
  line: string;
  /** 三选一那一屏上，这条路的那一句 */
  pick: string;
  /** 这一条到底改了什么 —— 写给档案与设计文档看 */
  effect: string;
};

export const BRANCHES: Record<CareerBranch, BranchSpec> = {
  district: {
    id: "district",
    name: "区域督导",
    line: "你不再只守一个柜 —— 东、中、西三个柜轮着去。今天在哪个柜，客流、客人的钱袋子、你的力气都不一样。",
    pick: "楼里三个柜，管哪一个，你说了算。",
    effect: "每天早上选一个柜，选完当天定住：东柜人多钱少、中庭省劲、西柜人少钱多。",
  },
  weiluo: {
    id: "weiluo",
    name: "维珞 BA",
    line: "你跳到维珞去带柜。跟你抢客的不再是陆遥 —— 是你带过的老同事周敏，他知道你那些客人要什么。",
    pick: "对面那一头的位置空着，你敢不敢过去坐。",
    effect: "对手换成周敏：抢客更狠（概率 +0.10、按最贵正解开单），陆遥不再抢你的客；你这边客人上限 +1、每格精力 +5。",
  },
  own: {
    id: "own",
    name: "自己的店",
    line: "罗曼不管你了，也没有要报的数 —— 你自己租了个铺面。她的那本件数账没了，换成每周都要交的房租。",
    pick: "不再替谁站柜台，自己开一格。",
    effect: "罗曼的件数委托不再出现；每季 ¥9,000 房租（每周日 ¥2,250）；客人上限 +1、每格精力 +5。",
  },
};

/** 分支旗标：键里带 id，值是 1。 */
export const BRANCH_KEY = (id: CareerBranch) => `career:branch:${id}`;
export const isBranchId = (id: string): id is CareerBranch => Object.hasOwn(BRANCHES, id);

/** 拿到第 4 级那一夜，三条路摆出来时说的那句。 */
export const BRANCH_CHOICE_WORD =
  "三条路摆在你面前 —— 区域督导、跳去维珞、自己开店。选一条，往后的日子按那本账过。";

/** 眼下走的是哪条分支（还没选就是 null）。 */
export const branchOf = (world: Pick<World, "qualities">): CareerBranch | null =>
  BRANCH_IDS.find(id => world.qualities[BRANCH_KEY(id)] === 1) ?? null;

/** 定了分支：只写旗标，不动别的 —— 换分支不是玩家能做的事，选一次就定死。 */
export function chooseBranch<W extends Pick<World, "qualities">>(world: W, id: CareerBranch): W {
  if (!isBranchId(id)) return world;
  if (branchOf(world)) return world;
  return { ...world, qualities: { ...world.qualities, [BRANCH_KEY(id)]: 1 } };
}

/** 这一条分支动了哪些旋钮。差量，底数在引擎那边。
 *  区域督导那一档的旋钮跟着「今天在哪个柜」变，去 district.ts 读。 */
export type BranchMods = {
  /** 同屏客人上限的差量 */
  guests: number;
  /** 每格精力的差量 */
  energy: number;
  /** 抢客概率的差量（加） */
  poach: number;
  /** 顾客预算乘数 */
  budget: number;
  /** 每季房租（自己开店才有；0 = 没人收你租） */
  rent: number;
  /** 罗曼那本件数账还管不管你 */
  quota: boolean;
  /** 跟你抢客的是不是换成了老同事 */
  oldColleague: boolean;
};

const NO_BRANCH_MODS: BranchMods = {
  guests: 0, energy: 0, poach: 0, budget: 1, rent: 0, quota: true, oldColleague: false,
};

/** 眼下这条分支的旋钮。没走分支就是一份空差量 —— 第 1~3 级一个数都不变。
 *  区域督导那一档要读「今天在哪个柜」，所以这里要日子与季号。 */
export function branchModsOf(world: Pick<World, "qualities" | "season" | "day">): BranchMods {
  const b = branchOf(world);
  if (b === "weiluo") return { ...NO_BRANCH_MODS, guests: 1, energy: 5, poach: 0.1, oldColleague: true };
  if (b === "own") return { ...NO_BRANCH_MODS, guests: 1, energy: 5, quota: false, rent: OWN_RENT_PER_SEASON };
  if (b === "district") {
    const d = districtModsOf(world);
    return { ...NO_BRANCH_MODS, guests: d.guests, energy: d.energy, budget: d.budget, poach: d.poach };
  }
  return NO_BRANCH_MODS;
}

/** 自己开店：每季的房租。一周交一次，周日打烊时从柜上扣。 */
export const OWN_RENT_PER_SEASON = 9000;
export const OWN_RENT_PER_WEEK = OWN_RENT_PER_SEASON / 4;
/** 开铺以来交过的房租（跨季带着走；结余那一栏读它）。 */
export const RENT_PAID_KEY = "career:rent";
export const rentPaidOf = (world: Pick<World, "qualities">): number =>
  world.qualities[RENT_PAID_KEY] ?? 0;
/** 结余：赚到的钱减去交出去的房租。自己开店这一档看它 —— 毛收入好看不算数。 */
export const branchBalanceOf = (world: Pick<World, "qualities" | "money">): number =>
  world.money - rentPaidOf(world);

// —— 对面那一位是谁 ——
// 跳去维珞以后，你成了维珞的 BA：陆遥是你的上司（她不再抢你的客，她给你派活），
// 跟你抢客的是你带过的老同事周敏 —— 他留在原来那头的柜上，还在这一层接客。
export const RIVAL_NAME_DEFAULT = "陆遥";
export const RIVAL_NAME_OLD_COLLEAGUE = "周敏";

/** 对面那一位的名字。所有比分读数都读它，别处不许各写一份「陆遥」。 */
export const rivalNameOf = (world: Pick<World, "qualities">): string =>
  branchOf(world) === "weiluo" ? RIVAL_NAME_OLD_COLLEAGUE : RIVAL_NAME_DEFAULT;

/** 跟你抢客的那一位的 id：跳去维珞以后是周敏，其余时候是陆遥。
 *  楼层上「站在对面那一侧的是谁」与「抢客的是谁」都读它 —— 两处必须是一个人。 */
export const poacherIdOf = (world: Pick<World, "qualities">): string =>
  branchOf(world) === "weiluo" ? "zhoumin" : "luyao";

/** 对面那一头柜子上挂的牌子：跳去维珞以后，对面是绮光（你原来那头的公司）。 */
export const rivalCounterWord = (world: Pick<World, "qualities">): string =>
  branchOf(world) === "weiluo" ? "绮光" : "维珞";

/** 老同事那一档：他自己知道你那些客人要什么 —— 开的单按最贵正解走，不按他自己的偏好走。 */
export const OLD_COLLEAGUE_POACH_BONUS = 0.1;

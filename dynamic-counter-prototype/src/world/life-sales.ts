// 「人生一步」落在柜台上。life:<id> 原来只被卡自己的门读（storylets-life.ts），
// 走到第几步、上一步怎么落的，卖货这一侧一件都不认 —— 九十张卡写完，柜台照旧当她没变过。
// 这一份把两件事接上：
// - 走到第 N 步以后，她进门带的诉求 / 预算 / 件数跟着变（LIFE_SALES，按卡的 beat 写，注释标卡 id）；
// - 上一步怎么落的（life:<id>:how）决定她还来不来、还带不带人（LIFE_HOW_BIAS，三档通用，不点名）。
// 读法只有一处接缝：visits.ts 的 visitPerson 先叠这一层再叠当天来访情境，
// 于是 shelf / serve-talk / consult / 结算 / 对面报价全部自动读到，界面不拼句子。
import type { Person, PersonId, Trait, World } from "./types.ts";

export type LifeSaleStep = {
  step: number;
  /** 这一步的依据是哪张卡。守卫会去核：那张卡真的存在，而且它写的就是 `life:<id>` = step。
   *  写小一格，她的钱就会在她读到那句话之前先变 —— 这一栏把那种错变成过不了测试。 */
  card: string;
  /** 从这一步起她进门带的钱加减（元）。 */
  budget?: number;
  /** 从这一步起她的用量上限加减（至少 1）。 */
  units?: number;
  /** 从这一步起这条诉求变成她这一单的头等事（没有就添上）。 */
  focus?: Trait;
};

export const LIFE_SALES: Partial<Record<PersonId, LifeSaleStep[]>> = {
  // 那一栏归在别人名下，今年报的是自己那一支：替组里备的那份钱和量收回来；
  // 名下剩的两张退单交回柜上，她自己来答：这一支从此按她自己的价买。
  shen: [{ step: 1, card: "life-shen", budget: -1200, units: -2 }, { step: 4, card: "life4-shen", budget: 800 }],
  // 那张单子上写的不是她的名字，婚礼那一档的量她不再备；
  // 今年只接一场、接的是自己的事，别人的请托退回三张，钱回到自己脸上。
  anjie: [{ step: 1, card: "life-anjie", budget: -2500, units: -2 }, { step: 3, card: "life3-anjie", budget: 2000, units: 1 }],
  // 她从那个位置上退下来了，一下午都是自己的，第一次不是为了见谁来；
  // 楼上又问一遍她还是没答，她那一下午归自己定，量也备下了。
  mei: [{ step: 1, card: "life-mei", budget: 1200, units: 1 }, { step: 4, card: "life4-mei", budget: 600, units: 1 }],
  // 那两人把她往这一柜指，她自己来把那一行填成自己的名字；
  // 那孩子满一年、也领了新人，轮到她往后面站，自己那份留下。
  xiaoyu: [{ step: 1, card: "life-xiaoyu", budget: 600 }, { step: 4, card: "life4-xiaoyu", budget: 500, units: 1 }],
  // 那两位被换给别人带了，第一次不替谁掐表，量和钱都收回自己；
  // 排班表最上头那一行写谁，她指着问这一柜：这一格归她自己。
  zhou: [{ step: 2, card: "life2-zhou", budget: -600, units: -1 }, { step: 4, card: "life4-zhou", budget: 600, units: 1 }],
  // 三家给她发东西，她先问这一柜今年敢不敢让她照着念；敢，她就把钱放在这一柜；
  // 排货写字的人换了别家，三张纸改成她自己写的，每一行都要当天看得出。
  miduo: [{ step: 2, card: "life2-miduo", budget: 800 }, { step: 4, card: "life4-miduo", focus: "correct" }],
  // 女儿反过来问她用的什么，今年这一单她想跟女儿一起对：一人一支；
  // 女儿替她接对了后半句，她把那一张带来，要自己把话说完。
  zhao: [{ step: 2, card: "life2-zhao", units: 1 }, { step: 4, card: "life4-zhao", budget: 600 }],
  // 她自己写一页成分表，念不出的那一行自己划掉：只买过得了那一页的；
  // 那一页印到第三版、三行还在，她来问这一柜念出来还算不算她那句 —— 效果那一行成了头等事，
  // 划掉的那份钱回来一部分（两处不是她写的，所以她没回到从前那个数）。
  yinxiaojie: [{ step: 2, card: "life2-yinxiaojie", budget: -1300 }, { step: 4, card: "life4-yinxiaojie", budget: 900, focus: "correct" }],
  // 替别人记的三本都退回去，身上只留自己那一页过敏记录：先求压得住，替别人搭的那份钱回到自己这一页；
  // 五个人拿着五张纸上来，她替这五个问，量和钱都备下。
  duan: [{ step: 2, card: "life2-duan", budget: 400, focus: "soothe" }, { step: 4, card: "life4-duan", budget: 900, units: 1 }],
  // 身边那同学也先自己查了成分才敢进柜，一人一支；
  // 她那页被人抄到别人名下讲，她把原本带来，要念一次自己的。
  zhaoning: [{ step: 2, card: "life2-zhaoning", units: 1 }, { step: 4, card: "life4-zhaoning", budget: 500 }],
  // 这几年她替人带了太多东西，自己想要的没添过一行：替人带的那份先收；
  // 她妈那一行由妹妹填了，家里再没人让她替谁问，她坐下去先给自己挑。
  songjie: [{ step: 1, card: "life-songjie", budget: -2000, units: -1 }, { step: 4, card: "life4-songjie", budget: -2000, units: -1 }],
  // 替别人上台的次数多了，今天她想先给自己问一次色号：见效成了头等事；
  // 工具包是那孩子提来的，还上不上台她自己答不了，先来这一柜为自己备两支。
  baijie: [{ step: 1, card: "life-baijie", focus: "correct" }, { step: 4, card: "life4-baijie", budget: 700, units: 1 }],
  // 有人按她那句话来找她，那一页开始挣钱；
  // 那一页写到第三行、第三行她想好了，给前面两行也备上。
  liangxia: [{ step: 2, card: "life2-liangxia", budget: 600 }, { step: 4, card: "life4-liangxia", budget: 400, units: 1 }],
};

/** 上一步怎么落的：1 还当自己人 / 2 只剩生意 / 3 这一格不留了。
 *  三档对「来不来、带不带人」的修正，加在既有的概率上，不新开抽数。 */
export const LIFE_HOW_BIAS: Record<1 | 2 | 3, { arrive: number; refer: number; bring: number }> = {
  1: { arrive: 0.05, refer: 0.1, bring: 0.1 },
  2: { arrive: 0, refer: 0, bring: 0 },
  3: { arrive: -0.07, refer: -1, bring: -1 },
};

export const lifeStepOf = (world: Pick<World, "qualities">, id: PersonId): number =>
  world.qualities[`life:${id}`] ?? 0;

/** 熟客流失的旗：她被冷落了一整季（这一季你没在她这儿开过单）。
 *  落旗时按这一档算 —— 她来得少了，也不替你带人。
 *  再接待她一次就把旗清掉：这一步还挽回得了。 */
export const lifeAwayKey = (id: PersonId) => `life:${id}:away`;
export const lifeAwayOf = (world: Pick<World, "qualities">, id: PersonId): boolean =>
  world.qualities[lifeAwayKey(id)] === 1;
export const clearLifeAway = <W extends { qualities: Record<string, number> }>(world: W, id: PersonId): W => {
  if (!world.qualities[lifeAwayKey(id)]) return world;
  const qualities = { ...world.qualities };
  delete qualities[lifeAwayKey(id)];
  return { ...world, qualities };
};

/** 被冷落了一整季的那一档。**到访那一格是量出来的**，不借卡上落点那一档：
 *  借第三档（−0.07）会把「压着人硬卖」那一路的晚期局面压平 —— 16 副牌里有两副撞成同一副
 *  （签名的盟友/仇人名单一模一样）。−0.05 不会，而「不替你带人」那两档（−1）原样不动：
 *  她去了别的柜的意思要留住，冷落的分量要轻到不把某一种打法压成一个形状。 */
export const AWAY_BIAS: { arrive: number; refer: number; bring: number } =
  { arrive: -0.05, refer: -1, bring: -1 };

export const lifeHowOf = (world: Pick<World, "qualities">, id: PersonId): number =>
  world.qualities[`life:${id}:how`] ?? 0;

const biasOf = (world: Pick<World, "qualities">, id: PersonId) =>
  // 被冷落了一整季：按 AWAY_BIAS 那一档算（来得少、不替你带人）。这一档压过卡上写下的落点 ——
  // 卡说「她还当自己人」，你整整一季没接住她，那就当不成了。
  lifeAwayOf(world, id) ? AWAY_BIAS : (LIFE_HOW_BIAS[lifeHowOf(world, id) as 1 | 2 | 3] ?? LIFE_HOW_BIAS[2]);

const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

/** 她这一步怎么落，改她自然来访的概率（engine 的 visitChance 之后叠）。 */
export const lifeArriveChance = (world: Pick<World, "qualities">, id: PersonId, base: number): number =>
  clamp01(base + biasOf(world, id).arrive);

/** 盟友夜里替她拉客的概率；-1 那一档永远约不成。 */
export const lifeReferChance = (world: Pick<World, "qualities">, id: PersonId, base: number): number =>
  base + biasOf(world, id).refer;

/** 微信约回来时带不带朋友的概率；-1 那一档不带。 */
export const lifeBringChance = (world: Pick<World, "qualities">, id: PersonId, base: number): number =>
  clamp01(base + biasOf(world, id).bring);

/** 走到第几步的她：预算 / 件数 / 头等诉求按表累加。没走到或没表，原样返回同一个对象，
 *  调用方可以靠引用相等判断"这一层没动她"。 */
export function lifePerson(world: Pick<World, "qualities">, person: Person): Person {
  const steps = LIFE_SALES[person.id];
  if (!person.skin || !steps) return person;
  const at = lifeStepOf(world, person.id);
  if (at <= 0) return person;
  let budget = person.skin.budget;
  let units = person.skin.maxUnits;
  let demands = person.skin.demands;
  for (const e of steps) {
    if (e.step > at) continue;
    if (e.budget) budget += e.budget;
    if (e.units) units = Math.max(1, units + e.units);
    if (e.focus) demands = demands.some(d => d.trait === e.focus)
      ? demands.map(d => (d.trait === e.focus ? { ...d, want: 2 as const, weight: 2 } : d))
      : [...demands, { trait: e.focus, want: 2 as const, weight: 2 }];
  }
  return { ...person, skin: { ...person.skin, budget: Math.max(0, budget), maxUnits: units, demands } };
}

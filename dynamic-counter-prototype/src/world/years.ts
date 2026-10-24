// 年景：每年第 1 季开局抽一次，同一年四季都受影响 —— 同一批人，换个场子。
// 只调现成旋钮（中庭落区、陆遥抢客、小样补给、硬推扣分、同屏人数、顾客预算），不写新卡。
// 存在 World 的 qualities 里（"year:<id>" = 1），跨季带着走；新年份抽到新的，旧的清掉。
// 抽签只用 (seed, 年号) 推，不占世界那串随机数：同一个种子，每一年看到的年景都一样。
//
// 第 1 年不抽年景：那是教学年，玩法照旧。第 2 年起（也就是第 5 季往后）才一年一换 ——
// 这一条让「第 1 年」的所有读数（单测钉着的、模拟器量过的）一个字都不动。
import { drawIndex, drawInt } from "./rng.ts";
import type { World } from "./types.ts";

export type YearId = "atrium" | "rivalHead" | "strictSample" | "strictLedger" | "bonus" | "bonusMoney";

export type YearScene = {
  id: YearId;
  /** 玩家听到的那一句 */
  word: string;
  /** 这一条动了哪颗旋钮 —— 写给档案与设计文档看 */
  knob: string;
};

export const YEAR_SCENES: Record<YearId, YearScene> = {
  atrium: {
    id: "atrium",
    word: "今年商场在改造，中庭封了半年 —— 人都挤到柜台这一头。",
    knob: "中庭这一区不落客",
  },
  rivalHead: {
    id: "rivalHead",
    word: "陆遥升了维珞的柜长。",
    knob: "她抢客更狠",
  },
  strictSample: {
    id: "strictSample",
    word: "今年小样管得严，每晚补不了几支。",
    knob: "每晚补的小样少一半，起手那份也少",
  },
  strictLedger: {
    id: "strictLedger",
    word: "今年商场查得严，硬推一次就要记两笔。",
    knob: "硬推扣的台账翻倍",
  },
  bonus: {
    id: "bonus",
    word: "今年周年庆，商场多请了人来看场。",
    knob: "同屏客人上限 +1",
  },
  bonusMoney: {
    id: "bonusMoney",
    word: "今年商场做活动，进门的人手里松一点。",
    knob: "顾客预算 ×1.15",
  },
};

export const YEAR_IDS = Object.keys(YEAR_SCENES) as YearId[];
/** 一年几季。一季四周，一季一关，一季一季地过完一年。 */
export const SEASONS_PER_YEAR = 4;
/** 第几季是第几年的开头。第 1 季是第 1 年。 */
export const yearOfSeason = (season: number): number => Math.floor((season - 1) / SEASONS_PER_YEAR) + 1;
/** 这一季是不是新开一年的第一季。 */
export const isNewYear = (season: number): boolean => (season - 1) % SEASONS_PER_YEAR === 0;

/** 年景旗存在 qualities 里，键 "year:<id>"，值 1。 */
export const YEAR_PREFIX = "year:";
export const yearKey = (id: YearId) => `${YEAR_PREFIX}${id}`;
export const isYearId = (id: string): id is YearId => Object.hasOwn(YEAR_SCENES, id);

/** 第 1 年不抽年景（教学年照旧）；同一条不连着两年都出。 */
export function drawYearScenes(seed: string, year: number): YearId[] {
  if (year <= 1) return [];
  const prev = drawYearScenes(seed, year - 1);
  const pool = YEAR_IDS.filter(id => !prev.includes(id));
  const count = drawInt(seed, year * 31 + 7, 1, 2);
  const out: YearId[] = [];
  let rest = pool;
  for (let i = 0; i < count && rest.length; i++) {
    const idx = drawIndex(seed, year * 131 + i * 17, rest.length);
    const picked = rest[idx]!;
    out.push(picked);
    rest = rest.filter(x => x !== picked);
  }
  return out;
}

/** 这一年动过的旋钮。只写差量，底数在引擎那边（engine.ts 的常量），免得绕成环。 */
export type YearMods = {
  /** 中庭这一区不落客。 */
  noAtrium: boolean;
  /** 陆遥抢客概率加这个数。 */
  poach: number;
  /** 小样少发几份（每晚补的和起手的都少）。 */
  samples: number;
  /** 硬推一次扣的台账乘这个数。 */
  hardSell: number;
  /** 同屏客人上限加这个数。 */
  guests: number;
  /** 顾客预算乘这个数。 */
  budget: number;
};

const NO_MODS: YearMods = { noAtrium: false, poach: 0, samples: 0, hardSell: 1, guests: 0, budget: 1 };

/** 眼下这一年的旋钮。引擎各处读这一个函数，不各拼一份。
 *  resist：第 4 级以后，年景里**跟你过不去**的那几条劲道减半（位置稳了，商场那些风浪对你的柜子影响小了）。
 *  跟你有利的两条（多请一个人、顾客手里松）不打折 —— 打折的是麻烦，不是好事。 */
export function yearModsOf(world: Pick<World, "qualities">, resist = 1): YearMods {
  const on = (id: YearId) => world.qualities[yearKey(id)] === 1;
  if (!YEAR_IDS.some(id => on(id))) return NO_MODS;
  return {
    noAtrium: on("atrium"),
    poach: on("rivalHead") ? 0.05 * resist : 0,
    samples: on("strictSample") ? Math.round(2 * resist) : 0,
    hardSell: on("strictLedger") ? 1 + resist : 1,
    guests: on("bonus") ? 1 : 0,
    budget: on("bonusMoney") ? 1.15 : 1,
  };
}

/** 眼下这一年抽到的是哪几条。 */
export const yearScenesOf = (world: Pick<World, "qualities">): YearId[] =>
  YEAR_IDS.filter(id => world.qualities[yearKey(id)] === 1);

/** 季初那一句：今年是什么年景。一条都没有（第 1 年）就说一句「老样子」。 */
export const yearWordOf = (world: Pick<World, "qualities" | "season">): string => {
  const ids = yearScenesOf(world);
  const year = yearOfSeason(world.season);
  if (!ids.length) return `第 ${year} 年，还是老样子。`;
  return `第 ${year} 年：${ids.map(id => YEAR_SCENES[id].word).join("")}`;
};

/** 落上年景：新年份抽新的，旧的清掉。同一年内不重抽（换季时由引擎判断）。 */
export function applyYearScenes<W extends Pick<World, "qualities" | "season" | "seed">>(world: W): W {
  const ids = drawYearScenes(world.seed, yearOfSeason(world.season));
  const qualities = { ...world.qualities };
  for (const key of Object.keys(qualities)) if (key.startsWith(YEAR_PREFIX)) delete qualities[key];
  for (const id of ids) qualities[yearKey(id)] = 1;
  return { ...world, qualities };
}

/** 顾客今天带的钱：年景里「商场做活动」那一档让她手里松一点。 */
export const yearBudgetOf = (world: Pick<World, "qualities">, budget: number): number =>
  Math.round(budget * yearModsOf(world).budget);

// 区域督导：楼里三个柜，你每天早上选一个，选完当天定住。
//
// 三个柜各给一样东西，也各拿走一样 —— 这一档的取舍不在"哪个更强"，在"今天要什么"：
// 东柜人多钱薄、中庭人少省劲、西柜人少但她手里松。
// 选了当天不能改：换柜要重新认人、重新摆货，一天换三次就不是干活了。
import { SEASON_DAYS, type World } from "./types.ts";

export type DistrictZone = "east" | "middle" | "west";
export const DISTRICT_ZONES: readonly DistrictZone[] = ["east", "middle", "west"];

export type DistrictSpec = {
  id: DistrictZone;
  /** 柜子叫什么 */
  name: string;
  /** 这一档的手感 —— 界面只念它 */
  word: string;
  /** 同屏客人上限的差量 */
  guests: number;
  /** 顾客预算乘数 */
  budget: number;
  /** 每格精力的差量 */
  energy: number;
  /** 抢客概率的差量 */
  poach: number;
};

export const DISTRICT_SPEC: Record<DistrictZone, DistrictSpec> = {
  east: {
    id: "east", name: "东柜",
    word: "正门那一侧，人最多，钱最薄 —— 你一上午都停不下来。",
    guests: 2, budget: 0.85, energy: -5, poach: 0.05,
  },
  middle: {
    id: "middle", name: "中庭",
    word: "老位置。人不多，可这里的每一位你都认得，不费劲。",
    guests: 1, budget: 1, energy: 5, poach: 0,
  },
  west: {
    id: "west", name: "西柜",
    word: "最里头那排。人少，可她手里松 —— 卖一单是一单。",
    guests: -1, budget: 1.3, energy: 0, poach: -0.05,
  },
};

/** 旗标：键里带 id，值是 1 —— 跟年景、星期规矩一个写法。 */
export const DISTRICT_ZONE_KEY = "career:zone";
/** 这一天（绝对天）定的柜。存绝对天不存「第几天」：换季以后「第几天」会撞上。 */
export const DISTRICT_ZONE_DAY_KEY = "career:zone-day";

const absoluteDay = (world: Pick<World, "season" | "day">) =>
  (world.season - 1) * SEASON_DAYS + world.day;

/** 今天在哪个柜：定过就是定的那个；没定就按日子轮（三个柜一天一个）。 */
export const districtZoneOf = (world: Pick<World, "season" | "day" | "qualities">): DistrictZone => {
  const picked = world.qualities[DISTRICT_ZONE_KEY] ?? 0;
  if (picked >= 1 && picked <= DISTRICT_ZONES.length
    && world.qualities[DISTRICT_ZONE_DAY_KEY] === absoluteDay(world))
    return DISTRICT_ZONES[picked - 1]!;
  return DISTRICT_ZONES[(absoluteDay(world) - 1) % DISTRICT_ZONES.length]!;
};

/** 今天定过没有。 */
export const districtChosenToday = (world: Pick<World, "season" | "day" | "qualities">): boolean =>
  world.qualities[DISTRICT_ZONE_DAY_KEY] === absoluteDay(world);

/** 选柜：一天一次。定过了就定住了，返回原样 —— 界面据此把另外两个按暗。 */
export function chooseDistrict<W extends Pick<World, "season" | "day" | "qualities">>(world: W, zone: DistrictZone): W {
  if (!DISTRICT_ZONES.includes(zone)) return world;
  if (districtChosenToday(world)) return world;
  return { ...world, qualities: { ...world.qualities,
    [DISTRICT_ZONE_KEY]: DISTRICT_ZONES.indexOf(zone) + 1,
    [DISTRICT_ZONE_DAY_KEY]: absoluteDay(world) } };
}

export type DistrictMods = { guests: number; budget: number; energy: number; poach: number };

/** 今天这个柜的旋钮。 */
export function districtModsOf(world: Pick<World, "season" | "day" | "qualities">): DistrictMods {
  const s = DISTRICT_SPEC[districtZoneOf(world)];
  return { guests: s.guests, budget: s.budget, energy: s.energy, poach: s.poach };
}

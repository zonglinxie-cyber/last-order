// 每周一关：人情场开局缺的那个"看得见的目标"，也是过关感和胜负欲落地的地方。
// 旧五日版一进门就是「五日 ¥21,000」，玩家知道自己在追什么；人情场只说"看看谁会回来"，
// 真人试玩第一句反馈就是"没有头绪"。这里补的是中间那一层：一季四周 = 四关，
// 周一早会罗曼报这一关的数，周日打烊对账、盖星：
//   ★ 过关：这周的钱到了罗曼要的数
//   ★ 赢对面：这周比陆遥挣得多
//   ★ 超额：到了目标的 1.3 倍
// 过关柜位涨、罗曼记你一笔好；没过罗曼记着；季末把四关的星加起来，档案记最好的一季。
//
// 纯数据纯函数，不 import 引擎（与 weeks.ts 同理，免得绕成环）。引擎在周一早会记下这周的起点、
// 周日打烊结账；界面和模拟器只读这里。
import { WEEK_RULES, weekNoOf, weekRuleOf } from "./weeks.ts";

/** 一季四关各要多少：第一关是新手那七天，往后一关比一关高（同旧版按天抬的那条思路）。
 *  数值按模拟器「每周一关」那张表定，见 docs/人情场设计.md 同名一节。 */
export const WEEK_TARGETS = [8_000, 9_000, 10_000, 11_000] as const;
export const SEASON_WEEKS = WEEK_TARGETS.length;
/** 第三颗星：到目标的这个倍数。 */
export const WEEK_EXCEED_RATE = 1.3;
export const WEEK_STARS_MAX = 3;
/** 周日对账：过关柜位 +2、罗曼 +2；没过柜位不动，罗曼 −3。
 *  没过不扣柜位，是模拟器量出来的：扣柜位（−4 / −2 两版都试过）会把"经营人情、不靠自己开单"那一路
 *  （social）一季四关全没过的 −8 直接压过「谁也没交」那条 35 的线，结局一半掉进「镜子前空了」——
 *  这一层是卖货的关，不该替人情那条路判死刑。没过的代价落在排班的那个人身上：罗曼记着。 */
export const WEEK_HIT_STANDING = 2;
export const WEEK_HIT_ROMAN = 2;
export const WEEK_MISS_ROMAN = -3;
export const WEEK_BOSS = "roman";

/** 周一早会那一刻的账面：这周挣了多少 = 现在 − 起点。不跨季（money 换季清零，这几个键也不在跨季名单里）。 */
export const WEEK_START_MONEY = "week-start:money";
export const WEEK_START_RIVAL = "week-start:rival";
/** 周日打烊落下的三格：第 n 关挣了多少、对面多少、几颗星（0 = 没过关）。季末回顾与结算屏读它们。 */
export const weekMadeKey = (n: number) => `week-made:${n}`;
export const weekRivalKey = (n: number) => `week-rival:${n}`;
export const weekStarsKey = (n: number) => `week-stars:${n}`;

type Books = { day: number; season?: number; money: number; rivalMoney: number; qualities: Record<string, number> };

export const weekTargetOf = (day: number): number =>
  WEEK_TARGETS[Math.min(SEASON_WEEKS, weekNoOf(day)) - 1];
export const weekMoneyOf = (w: Books): number => w.money - (w.qualities[WEEK_START_MONEY] ?? 0);
export const weekRivalOf = (w: Books): number => w.rivalMoney - (w.qualities[WEEK_START_RIVAL] ?? 0);
/** 这周还剩几天（含今天）。 */
export const weekDaysLeft = (day: number): number => 7 - ((day - 1) % 7);

/** 周一早会记下起点。 */
export const markWeekStart = <W extends Books>(w: W): W =>
  ({ ...w, qualities: { ...w.qualities, [WEEK_START_MONEY]: w.money, [WEEK_START_RIVAL]: w.rivalMoney } });

export type WeekStars = { hit: boolean; beatRival: boolean; exceeded: boolean; stars: number };

/** 这一关眼下几颗星（结算那一刻和页顶都问这一个）。没过关就是 0，哪怕这周赢了对面。 */
export function weekStarsOf(made: number, rival: number, target: number): WeekStars {
  const hit = made >= target;
  const beatRival = made > rival;
  const exceeded = made >= Math.ceil(target * WEEK_EXCEED_RATE);
  return { hit, beatRival, exceeded, stars: hit ? 1 + (beatRival ? 1 : 0) + (exceeded ? 1 : 0) : 0 };
}

/** 周日打烊结账：落三格、动柜位、罗曼说一句。返回给引擎拼进日志的那句话。 */
export function settleWeek<W extends Books & { standing: number; opinion: Record<string, number> }>(w: W): { world: W; line: string } {
  const n = weekNoOf(w.day);
  const made = weekMoneyOf(w), rival = weekRivalOf(w), target = weekTargetOf(w.day);
  const s = weekStarsOf(made, rival, target);
  const standing = Math.max(0, Math.min(100, w.standing + (s.hit ? WEEK_HIT_STANDING : 0)));
  const boss = Math.max(-100, Math.min(100, (w.opinion[WEEK_BOSS] ?? 0) + (s.hit ? WEEK_HIT_ROMAN : WEEK_MISS_ROMAN)));
  const world = { ...w, standing, opinion: { ...w.opinion, [WEEK_BOSS]: boss }, qualities: { ...w.qualities,
    [weekMadeKey(n)]: made, [weekRivalKey(n)]: rival, [weekStarsKey(n)]: s.stars } };
  const yuan = (x: number) => `¥${x.toLocaleString("zh-CN")}`;
  const line = s.hit
    ? `第 ${n} 关对账：这周 ${yuan(made)}，罗曼要的是 ${yuan(target)} —— 过关，${"★".repeat(s.stars)}${"☆".repeat(WEEK_STARS_MAX - s.stars)}。她在排班表上你那一栏打了个勾。`
    : `第 ${n} 关对账：这周 ${yuan(made)}，差 ${yuan(target - made)} 没到 ${yuan(target)}。罗曼没说话，把你的名字往后挪了一格。`;
  return { world, line };
}

/** 这一季已经结过的几关：[第 1 关星数, 第 2 关……]，没结的不在里面。 */
export const seasonStarsOf = (w: Books): number[] =>
  Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1)
    .filter(n => w.qualities[weekMadeKey(n)] !== undefined)
    .map(n => w.qualities[weekStarsKey(n)] ?? 0);

/** 页顶那条的三段：第几关叫什么、钱到哪了、还剩几天和对面这周多少。 */
export const weekLevelWord = (w: Books): string => {
  const n = Math.min(SEASON_WEEKS, weekNoOf(w.day));
  const rule = WEEK_RULES.find(r => r.id === weekRuleOf(w.season ?? 1, w.day));
  return `第 ${n} 关${rule ? ` · ${rule.word}` : ""}`;
};
export const weekGoalWord = (w: Books): string =>
  `¥${weekMoneyOf(w).toLocaleString("zh-CN")} / ¥${weekTargetOf(w.day).toLocaleString("zh-CN")}`;
export const weekGoalTail = (w: Books): string => {
  const left = weekDaysLeft(w.day);
  return `${left === 1 ? "今晚对账" : `还剩 ${left} 天`} · 对面本周 ¥${weekRivalOf(w).toLocaleString("zh-CN")}`;
};

/** 结算屏那三颗星各自的说法。 */
export const starWords = (target: number): [string, string, string] => [
  `到 ¥${target.toLocaleString("zh-CN")}`,
  "这周比对面多",
  `到 ¥${Math.ceil(target * WEEK_EXCEED_RATE).toLocaleString("zh-CN")}`,
];

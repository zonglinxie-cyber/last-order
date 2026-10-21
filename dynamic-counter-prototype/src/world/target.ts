// 每周一关：人情场开局缺的那个"看得见的目标"，也是过关感和胜负欲落地的地方。
// 旧五日版一进门就是「五日 ¥21,000」，玩家知道自己在追什么；人情场只说"看看谁会回来"，
// 真人试玩第一句反馈就是"没有头绪"。这里补的是中间那一层：一季四周 = 四关，
// 周一早会罗曼报三条过关路线；周日只取表现最好的一条盖星。
// 过关柜位涨、罗曼记你一笔好；没过罗曼记着；季末把四关的星加起来，档案记最好的一季。
//
// 纯数据纯函数，不 import 引擎（与 weeks.ts 同理，免得绕成环）。引擎在周一早会记下这周的起点、
// 周日打烊结账；界面和模拟器只读这里。
import { WEEK_RULES, weekNoOf, weekRuleOf } from "./weeks.ts";
import type { PersonId } from "./types.ts";

/** 一季四关各要多少：第一关是新手那七天，往后一关比一关高。
 *  2026-10-21 按当前 20 种子盲策重定（旧 13k/16k/19k/22k 是 10-17 那版读数）：
 *  周进账 P25/中位/P75 = 17.6/18.8/19.4k、10.0/12.3/16.1k、10.0/12.4/17.1k、13.6/17.1/19.4k。
 *  旧第 3 关 19k 在 P75 之上，销售线 0/20 过；第 4 关 22k 只有 3/20。
 *  现在第 2–4 关取 14/16/18k：销售线分别约 7/8/9 过（20 副牌），第一关 13k 仍低于 P25，留作新手关。
 *  目标值只改判星；来访、对手和结算不跟着变。 */
export const WEEK_TARGETS = [13_000, 14_000, 16_000, 18_000] as const;
export const SEASON_WEEKS = WEEK_TARGETS.length;

/** 每季一档目标线。第 1 季是学徒档（第 1 关 13k 低于那一关的 P25 ¥17,620，留给新手那七天）；
 *  第 2 季起是正式档：客人的池子到那一季就饱和了（第 3 季的供给与第 2 季差在一成上下），
 *  所以正式档只定一档，之后的季沿用它。
 *  正式档按那一季的供给节奏分档（20 种子盲策，第 2 季各周销售线「过关/三星」）：
 *  第 1 关开季客最多（进账 P25 ¥28,820）→ 26k（18/20 过，12 三星）；
 *  第 2 关 20k（20/20 过，8 三星）；第 4 关 20k（19/20 过，11 三星）；
 *  第 3 关是旱周（十天购买间隔把客人挡住，进账 P25 只有 ¥6,000）→ 压到 9k（6/20 过，3 三星），
 *  旱周不再是墙，但业绩这条路还在那儿。
 *  同一批线对「第 1 季没攒下微信网络」的打法也留得住业绩路（16/20、15/20、13/20）。 */
export const SEASON_TARGETS: Record<number, readonly number[]> = {
  1: WEEK_TARGETS,
  2: [26_000, 20_000, 9_000, 20_000],
};
/** 第 2 季起沿用的正式档。 */
export const SEASON_TARGETS_LATEST = SEASON_TARGETS[2]!;
/** 某一季的四关目标线；没单独定过的季沿用正式档。 */
export const seasonTargetsOf = (season: number): readonly number[] =>
  SEASON_TARGETS[season] ?? SEASON_TARGETS_LATEST;
/** 第 week 关（1..4）在那一季的目标线。 */
export const weekTargetOfWeek = (season: number, week: number): number =>
  seasonTargetsOf(season)[Math.min(SEASON_WEEKS, Math.max(1, week)) - 1]!;
/** 第三颗星：到目标的这个倍数。 */
export const WEEK_EXCEED_RATE = 1.3;
export const WEEK_STARS_MAX = 3;
export const CARE_STEPS = [9, 12, 15] as const;
export const GUARD_STEPS = [3, 5, 8] as const;
/** 高星要持续守住公开威胁；无目标的时段不进分母。 */
export const GUARD_RATE_STEPS = [0, 0.5, 0.75] as const;
export const CARE_TRUST_MIN = 10;
/** 本周至少两天亲自办过实事；同日多点几次不算回访。 */
export const CARE_DAYS_MIN = 2;
export type WeekRoute = "sales" | "care" | "guard";
export const ROUTE_WORD: Record<WeekRoute, string> = { sales: "业绩", care: "客情", guard: "守客" };
const ROUTE_CODE: Record<WeekRoute, number> = { sales: 1, care: 2, guard: 3 };
export const routeFromCode = (code: number): WeekRoute => code === 2 ? "care" : code === 3 ? "guard" : "sales";
/** 周日对账：过关柜位 +2、罗曼 +2；没过柜位不动，罗曼 −3。
 *  没过不扣柜位，是模拟器量出来的：扣柜位（−4 / −2 两版都试过）会把"经营人情、不靠自己开单"那一路
 *  （social）一季四关全没过的 −8 直接压过「谁也没交」那条 35 的线，结局一半掉进「镜子前空了」——
 *  三条路线共享过关奖励，没过的代价落在排班的那个人身上：罗曼记着。 */
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
export const weekRouteKey = (n: number) => `week-route:${n}`;
/** 周日冻结当时仍信任你的客情人数，历史回顾不拿季末信任倒算。 */
export const weekCareCountKey = (n: number) => `week-care-count:${n}`;
export const weekCareKey = (n: number, person: string) => `week-care:${n}:${person}`;
export const weekGuardPersonKey = (n: number, person: string) => `week-guard-person:${n}:${person}`;
export const weekGuardThreatKey = (n: number, day: number, slot: number, person: string) => `week-guard-threat:${n}:${day}:${slot}:${person}`;
export const weekGuardStopKey = (n: number, day: number, slot: number, person: string) => `week-guard-stop:${n}:${day}:${slot}:${person}`;
export const weekCareDayKey = (n: number, person: string, day: number) => `week-care-day:${n}:${person}:${day}`;
export const guardCommitKey = (day: number, slot: number, person: string) => `guard-commit:${day}:${slot}:${person}`;

type Books = { day: number; season?: number; money: number; rivalMoney: number; qualities: Record<string, number>; opinion?: Record<string, number> };

export const weekTargetOf = (day: number, season: number): number => weekTargetOfWeek(season, weekNoOf(day));

/** 旱周：这一关的线比上一关低。第 2 季起第 3 关是旱周 —— 前两周把能买的都买了一遍，
 *  十天购买间隔把客人挡住，地板上是空的，线要跟着这一周真有的客源走。 */
export const isDryWeek = (season: number, day: number): boolean => {
  const n = weekNoOf(day);
  if (n <= 1) return false;
  const targets = seasonTargetsOf(season);
  return targets[n - 1]! < targets[n - 2]!;
};
/** 旱周早会上念的那一句；不是旱周就是空串。 */
export const dryWeekNote = (season: number, day: number): string => {
  if (!isDryWeek(season, day)) return "";
  const target = weekTargetOf(day, season);
  return `这周多数客人还在十天间隔里，业绩线只压到 ¥${target.toLocaleString("zh-CN")}；这几天把力气放在客情和守客上。`;
};
export const weekMoneyOf = (w: Books): number => w.money - (w.qualities[WEEK_START_MONEY] ?? 0);
export const weekRivalOf = (w: Books): number => w.rivalMoney - (w.qualities[WEEK_START_RIVAL] ?? 0);
const peopleAt = (w: Books, prefix: string): PersonId[] => Object.entries(w.qualities)
  .filter(([k, v]) => k.startsWith(prefix) && v === 1).map(([k]) => k.slice(prefix.length));
export const weekCarePeople = (w: Books): PersonId[] => peopleAt(w, `week-care:${weekNoOf(w.day)}:`)
  .filter(id => w.opinion === undefined || (w.opinion[id] ?? 0) >= CARE_TRUST_MIN);
export const weekGuardedPeople = (w: Books): PersonId[] => peopleAt(w, `week-guard-person:${weekNoOf(w.day)}:`);
export const weekCareOf = (w: Books): number => weekCarePeople(w).length;
/** 本周挡下的不同顾客；重复照应同一人仍挡住对手，但不刷星。 */
export const weekGuardOf = (w: Books): number => weekGuardedPeople(w).length;
export const weekGuardThreatsOf = (w: Books): number => peopleAt(w, `week-guard-threat:${weekNoOf(w.day)}:`).length;
export const weekGuardStopsOf = (w: Books): number => peopleAt(w, `week-guard-stop:${weekNoOf(w.day)}:`).length;
export const weekGuardRateOf = (w: Books): number => weekGuardThreatsOf(w) ? weekGuardStopsOf(w) / weekGuardThreatsOf(w) : 0;
export const weekCareDaysOf = (w: Books, person: string): number => peopleAt(w, `week-care-day:${weekNoOf(w.day)}:${person}:`).length;
/** 本周只亲自照应过一天、还没算进客情的人。下周会重新从零记两天，
 *  所以周报不能把「只差一天」说成「下周再点一次就补完」。 */
export const weekCareNearPeople = (w: Books): PersonId[] => {
  const n = weekNoOf(w.day), prefix = `week-care-day:${n}:`;
  const days = new Map<PersonId, number>();
  for (const [key, value] of Object.entries(w.qualities)) {
    if (value !== 1 || !key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const sep = rest.lastIndexOf(":");
    if (sep <= 0) continue;
    const id = rest.slice(0, sep);
    days.set(id, (days.get(id) ?? 0) + 1);
  }
  return [...days.entries()]
    .filter(([id, count]) => count === 1 && !w.qualities[weekCareKey(n, id)]
      && (w.opinion === undefined || (w.opinion[id] ?? 0) >= CARE_TRUST_MIN))
    .map(([id]) => id);
};
export const weekCareNearOf = (w: Books): number => weekCareNearPeople(w).length;
/** 同一顾客本周只算一次，打招呼和被动围观不算。 */
export const markWeekCare = <W extends Books>(w: W, person: string): W =>
  ({ ...w, qualities: { ...w.qualities, [weekCareKey(weekNoOf(w.day), person)]: 1 } });
/** 一周同一人只算一次公开的反制；目标被照应后，不因重进结算多得分。 */
export const markWeekGuard = <W extends Books & { slot: number }>(w: W, person: PersonId): W =>
  ({ ...w, qualities: { ...w.qualities, [weekGuardPersonKey(weekNoOf(w.day), person)]: 1,
    [weekGuardStopKey(weekNoOf(w.day), w.day, w.slot, person)]: 1 } });
export const markWeekThreat = <W extends Books & { slot: number }>(w: W, person: PersonId): W =>
  ({ ...w, qualities: { ...w.qualities, [weekGuardThreatKey(weekNoOf(w.day), w.day, w.slot, person)]: 1 } });
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

export type WeekResult = { route: WeekRoute; stars: number; made: number; rival: number; target: number;
  care: number; guard: number; guardThreats: number; guardStops: number; guardRate: number;
  sales: WeekStars; careStars: number; guardStars: number };
export function weekResultOf(w: Books): WeekResult {
  const made = weekMoneyOf(w), rival = weekRivalOf(w), target = weekTargetOf(w.day, w.season ?? 1);
  const care = weekCareOf(w), guard = weekGuardOf(w);
  const guardThreats = weekGuardThreatsOf(w), guardStops = weekGuardStopsOf(w), guardRate = weekGuardRateOf(w);
  const sales = weekStarsOf(made, rival, target);
  const careStars = CARE_STEPS.filter(n => care >= n).length;
  const guardStars = GUARD_STEPS.filter((n, i) => guard >= n && guardRate >= GUARD_RATE_STEPS[i]).length;
  // 同星优先展示原来的业绩线，再是客情、守客；但任一路达到门槛都能过关。
  const best = Math.max(sales.stars, careStars, guardStars);
  const route: WeekRoute = sales.stars === best ? "sales" : careStars === best ? "care" : "guard";
  return { route, stars: best, made, rival, target, care, guard, guardThreats, guardStops, guardRate, sales, careStars, guardStars };
}

/** 周日结算屏那句「下一周先改什么」：只从这一周的实际差距里挑离门槛最近的一条，
 *  给一句下周能直接做的动作；不新增状态，也不替玩家许诺。 */
export function nextWeekHint(w: Books & { season?: number }): string {
  const n = weekNoOf(w.day), s = weekResultOf(w);
  const last = n >= SEASON_WEEKS;
  const nextSeason = (w.season ?? 1) + (last ? 1 : 0);
  const nextDay = last ? 1 : w.day + 1;
  const nextTarget = weekTargetOfWeek(nextSeason, last ? 1 : n + 1);
  const rule = WEEK_RULES.find(r => r.id === weekRuleOf(nextSeason, nextDay));
  const ruleWord = rule ? ` · ${last ? "下季" : "下周"}${rule.word}` : "";
  const prefix = last ? `下季第 1 关 ¥${nextTarget.toLocaleString("zh-CN")}` : `下周目标 ¥${nextTarget.toLocaleString("zh-CN")}`;
  if (s.stars) return `${prefix}${ruleWord}。这周凭${ROUTE_WORD[s.route]}过关，可以继续，也可以换一条更稳的。`;
  const near = weekCareNearOf(w);
  const gaps = [
    { ratio: (s.target - s.made) / s.target,
      line: `先追业绩：还差 ¥${(s.target - s.made).toLocaleString("zh-CN")}，先接住有预算的公开目标。` },
    { ratio: (CARE_STEPS[0] - s.care) / CARE_STEPS[0],
      line: near > 0
        ? `先补客情：还差 ${CARE_STEPS[0] - s.care} 位；本周有 ${near} 位只差一天，但下周要从头记两天，先给他们排两次见面。`
        : `先补客情：还差 ${CARE_STEPS[0] - s.care} 位；同一位客人要在两个不同日子亲自办过事才算，先找能见两次的人。` },
    { ratio: (GUARD_STEPS[0] - s.guard) / GUARD_STEPS[0],
      line: `先守客：还差 ${GUARD_STEPS[0] - s.guard} 位；开场先看对面盯上谁，接待或托同事照看都算。` },
  ];
  const best = gaps.reduce((a, b) => b.ratio < a.ratio ? b : a);
  return `${prefix}${ruleWord}；${best.line}`;
}

/** 周日打烊结账：落三格、动柜位、罗曼说一句。返回给引擎拼进日志的那句话。 */
export function settleWeek<W extends Books & { standing: number; opinion: Record<string, number> }>(w: W): { world: W; line: string } {
  const n = weekNoOf(w.day);
  const s = weekResultOf(w);
  const { made, rival, target } = s;
  const passed = s.stars > 0;
  const standing = Math.max(0, Math.min(100, w.standing + (passed ? WEEK_HIT_STANDING : 0)));
  const boss = Math.max(-100, Math.min(100, (w.opinion[WEEK_BOSS] ?? 0) + (passed ? WEEK_HIT_ROMAN : WEEK_MISS_ROMAN)));
  const world = { ...w, standing, opinion: { ...w.opinion, [WEEK_BOSS]: boss }, qualities: { ...w.qualities,
    [weekMadeKey(n)]: made, [weekRivalKey(n)]: rival, [weekStarsKey(n)]: s.stars,
    [weekRouteKey(n)]: ROUTE_CODE[s.route], [weekCareCountKey(n)]: s.care } };
  const yuan = (x: number) => `¥${x.toLocaleString("zh-CN")}`;
  const achievement = s.route === "sales" ? `${yuan(made)} / ${yuan(target)}`
    : s.route === "care" ? `跨天照应 ${s.care} 位不同客人` : `从陆遥手里守住 ${s.guard} 位不同客人`;
  const line = passed
    ? `第 ${n} 关对账：${ROUTE_WORD[s.route]}线 ${achievement}，过关，${"★".repeat(s.stars)}${"☆".repeat(WEEK_STARS_MAX - s.stars)}。她在排班表上你那一栏打了个勾。`
    : `第 ${n} 关对账：业绩 ${yuan(made)} / ${yuan(target)}、客情 ${s.care} / ${CARE_STEPS[0]}、守客 ${s.guard} / ${GUARD_STEPS[0]}，都还没到线。罗曼没说话，把你的名字往后挪了一格。`;
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
  `¥${weekMoneyOf(w).toLocaleString("zh-CN")} / ¥${weekTargetOf(w.day, w.season ?? 1).toLocaleString("zh-CN")}`;
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

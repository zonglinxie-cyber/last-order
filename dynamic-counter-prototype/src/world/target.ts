// 每周一关：人情场开局缺的那个"看得见的目标"，也是过关感和胜负欲落地的地方。
// 旧五日版一进门就是「五日 ¥21,000」，玩家知道自己在追什么；人情场只说"看看谁会回来"，
// 真人试玩第一句反馈就是"没有头绪"。这里补的是中间那一层：一季四周 = 四关，
// 周一早会罗曼报三条过关路线；周日只取表现最好的一条盖星。
// 过关柜位涨、罗曼记你一笔好；没过罗曼记着；季末把四关的星加起来，档案记最好的一季。
//
// 纯数据纯函数，不 import 引擎（与 weeks.ts 同理，免得绕成环）。引擎在周一早会记下这周的起点、
// 周日打烊结账；界面和模拟器只读这里。
import { WEEK_RULES, weekEndOf, weekNoOf, weekRuleOf } from "./weeks.ts";
import { rivalNameOf } from "./branches.ts";
import { BUY_INTERVAL_DAYS, lastPurchaseDay } from "./purchases.ts";
import { lifeAwayKey } from "./life-sales.ts";
import type { Person, PersonId, World } from "./types.ts";

/** 一季四关各要多少。
 *  2026-10-23 按「货架开始对她说话」之后的那版盲策重定（20 种子 × 2 季）。
 *  旧档 13k/14k/16k/18k 是照 10-21 那版盲策量的，而那一版量的其实也不准 ——
 *  它的注释写着「第 2–4 关约 7/8/9 过」，实测却是 3/20、0/20、13/20：第 2、3 关那条线是墙。
 *  现在这一季按实测重定：
 *  第 1 季（学徒档）**14k / 10k / 8k / 16k** —— 进账中位 ¥18,430 / ¥10,520 / ¥10,110 / ¥18,750，
 *  销售线「过关/三星」= **20/11、10/6、17/2、16/6**（20 副牌）。
 *  第 2 季（正式档）**24k / 18k / 8k / 20k** —— 进账中位 ¥28,615 / ¥21,820 / ¥8,250 / ¥22,270，
 *  销售线 = **19/6、17/8、12/3、15/3**。
 *  目标值只改判星；来访、对手和结算不跟着变。 */
export const WEEK_TARGETS = [14_000, 10_000, 8_000, 16_000] as const;
export const SEASON_WEEKS = WEEK_TARGETS.length;

/** 每季一档目标线。第 1 季是学徒档（第 1 关 14k 低于那一关的 P25 ¥17,740，留给新手那七天）；
 *  第 2 季起是正式档：客人的池子到那一季就饱和了（第 3 季的供给与第 2 季差在一成上下），
 *  所以正式档只定一档，之后的季沿用它。
 *  正式档每一关都不低于学徒档（24k/18k/8k/20k ≥ 14k/10k/8k/16k）—— 正式档只能更难，不能更松。 */
export const SEASON_TARGETS: Record<number, readonly number[]> = {
  1: WEEK_TARGETS,
  2: [24_000, 18_000, 8_000, 20_000],
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
/** 每一关的业绩线要落在哪个区间（比例）—— 这是「目标线没失效」的判据本身。
 *  下限「不是墙」：至少四成的人过得去（客情与守客是另外两条路，业绩线自己成墙，这一关就变成死关）；
 *  上限「不是白送」：不是人人都拿得到三星。
 *  这条判据由盲策模拟器现读现量 —— 读的就是这里的目标线与这里的区间，
 *  生产里改了线而量不过，模拟器退出码非零（tests/consult-sim.ts）。 */
export const WEEK_PASS_MIN = 0.4;
export const WEEK_STARS_MIN = 0.05;
export const WEEK_STARS_MAX_RATE = 0.9;
export const CARE_STEPS = [9, 12, 15] as const;
/** 守客三星线从 8 落到 7：她一周最多撬七个（SHAKE_MAX_TOTAL），旱周抢客威胁中位只有 0，
 *  8 那条线在旱周根本够不着，守客这一格只能出两星。7 = 她撬满的名单刚好被你一格不落地守住。 */
export const GUARD_STEPS = [3, 5, 7] as const;
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
export const weekShakeKey = (n: number, person: string) => `week-shake:${n}:${person}`;
export const weekShakeTotalKey = (n: number) => `week-shake-total:${n}`;
/** 这一周她撬过这个人几次；超上限她换人，名单才铺得开。 */
export const weekShakeCountOf = (w: Books, person: string): number => w.qualities[weekShakeKey(weekNoOf(w.day), person)] ?? 0;
/** 这一周她一共撬了几个人。 */
export const weekShakeTotalOf = (w: Books): number => w.qualities[weekShakeTotalKey(weekNoOf(w.day))] ?? 0;

type Books = { day: number; season?: number; money: number; rivalMoney: number; qualities: Record<string, number>; opinion?: Record<string, number> };

export const weekTargetOf = (day: number, season: number): number => weekTargetOfWeek(season, weekNoOf(day));

/** 这一关实际在用的线，落在存档里的那个键。
 *  旱周那一关的线在周一早会按供给定下来（见 dryWeekTargetOf）；别的关按季节的档定，不走这一条。 */
export const weekTargetKey = (n: number) => `week-target:${n}`;
/** 这一关实际在用的线：存档里写着的那条；没有（还没到周一早会）就按季节的档算。 */
export const weekTargetIn = (w: Books, n: number): number =>
  w.qualities[weekTargetKey(n)] ?? weekTargetOfWeek(w.season ?? 1, n);

/** 哪几关是旱周：十天购买间隔把客人挡住的那几周，地板上是空的。
 *
 *  这一张表是**供给的事实**，不是从目标线的高低推出来的 —— 两者会打架：
 *  第 2 季第 2 关的线（18k）比第 1 关（24k）低，但那一周的进账中位还有 ¥21,820，不是旱周；
 *  第 1 季第 2、3 关的线虽然低，可那是学徒档本来就低，供给上却是实打实的旱周
 *  （进账中位 ¥10,520 / ¥10,110，只有第 1 关 ¥18,430 的六成）。
 *  玩家看得见的是「这周来的人少、钱进不来」，不是目标线的高低 —— 所以这张表单独写。 */
export const DRY_WEEKS: Record<number, readonly number[]> = { 1: [2, 3], 2: [3] };
/** 某一季的旱周关号；没单独定过的季沿用正式档（第 2 季）。 */
export const dryWeeksOf = (season: number): readonly number[] => DRY_WEEKS[season] ?? DRY_WEEKS[2]!;
export const isDryWeek = (season: number, day: number): boolean => dryWeeksOf(season).includes(weekNoOf(day));

/** 旱周那一关的线：按「这一周还有多少人能掏钱」定。
 *
 *  旱周的难处从来不是线高，是**能买的人少**：十天购买间隔把最近买过的人整个挡在
 *  门外（引擎的自然到场根本不按间隔拦人 —— 间隔拦的是「成交」不是「到场」——
 *  所以来的还是那几十位，只是她们掏不出钱），你前两周卖得越好，第三周能买的人越少。
 *  固定 ¥8,000 的线碰上这样的供给，就成了墙（盲策那一关只过得去 35%，
 *  长线里 honest 那一列最差的一季只有 31%）。
 *
 *  所以旱周的线**跟着地板走**：线 = 这一周能买的人 × 每人多少（系数是量出来的，
 *  见 `docs/人情场设计.md` 第 54 轮）。旱周还是旱周 —— 钱照样少、客情照样难攒；
 *  只是这一关不再是一堵墙：别的关线在 P25 之下，这一关也一样。 */
export const DRY_LINE_PER_HEAD = 400;
export const DRY_LINE_MIN = 1_500;
export const DRY_LINE_MAX = 10_000;

/** 这个人这一周里有没有能掏钱的时候：十天间隔到期那天落在这一周之内就算。
 *  买过一次就一定买过（b > 0），从没买过的（b = 0）随时能买。 */
const canBuyInWeek = (world: World, id: PersonId, weekEnd: number): boolean => {
  const b = lastPurchaseDay(world, id);
  return b === 0 || b + BUY_INTERVAL_DAYS <= weekEnd;
};

/** 这一周还能买的人：不在十天间隔里、也没被冷落的客人。
 *
 *  分母不能取「周一早会那一刻还锁着多少人」—— 那是快照，会把本周中才解禁的人算成不能来：
 *  探针实测（3 副牌 × 3 季）第 3 关那一周，周一还锁着 17~28 位，可整周下来到场的有 29~31 位。
 *  按快照算，人均产出被撑到 ¥1,100~¥3,000；按整周能买的人算，落到 ¥360~¥580（盲策 20 副牌）—— 稳得多。
 *  这一版就是按整周能买的人算的。 */
export function drySupplyOf(world: World, people: Person[]): number {
  const weekEnd = weekEndOf(world.day);
  return people.filter(p => p.role === "customer"
    && world.qualities[lifeAwayKey(p.id)] !== 1
    && canBuyInWeek(world, p.id, weekEnd)).length;
}

/** 客人池有多大（这一层楼上的常客总数）。 */
export const dryPoolOf = (people: Person[]): number => people.filter(p => p.role === "customer").length;

/** 旱周那一关的线：周一早会那一刻按还能买的人数定下来，周日结账读它。
 *  封顶按「那一关本来的线」：旱周是钱少，不是钱难赚 —— 这条线永远不高于那一关本来的档。 */
export const dryWeekTargetOf = (world: World, people: Person[]): number => {
  const raw = drySupplyOf(world, people) * DRY_LINE_PER_HEAD;
  const cap = Math.min(DRY_LINE_MAX, weekTargetOfWeek(world.season ?? 1, weekNoOf(world.day)));
  return Math.max(DRY_LINE_MIN, Math.min(cap, Math.round(raw / 100) * 100));
};

/** 旱周早会上念的那一句；不是旱周就是空串。
 *  线是周一早会按供给定出来的，所以这句话里带的是这一周真正在用的那条线，
 *  也把「为什么」说清楚：多少人这整周都在十天间隔里、掏不出钱。 */
export const dryWeekNote = (season: number, day: number,
  info?: { head: number; pool: number; target: number }): string => {
  if (!isDryWeek(season, day)) return "";
  const target = info?.target ?? weekTargetOf(day, season);
  const who = info
    ? `${info.pool} 位客人里只有 ${info.head} 位这周能掏钱（其余的还在十天间隔里，或者被你冷落了）`
    : "这周多数客人还在十天间隔里";
  return `${who} —— 业绩线压到 ¥${target.toLocaleString("zh-CN")}；这几天把力气放在客情和守客上。`;
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
  const made = weekMoneyOf(w), rival = weekRivalOf(w), target = weekTargetIn(w, weekNoOf(w.day));
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
  // 旱周那一关的线是周一早会按「还有多少人能来」定的 —— 提前念一个数就是骗人，
  // 那就说明它到时候才定。
  const nextIsDry = isDryWeek(nextSeason, nextDay);
  const prefix = nextIsDry
    ? `${last ? "下季第 1 关" : "下周"}是旱周，线周一早会按客人数定`
    : last ? `下季第 1 关 ¥${nextTarget.toLocaleString("zh-CN")}` : `下周目标 ¥${nextTarget.toLocaleString("zh-CN")}`;
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
    : s.route === "care" ? `跨天照应 ${s.care} 位不同客人` : `从${rivalNameOf(w)}手里守住 ${s.guard} 位不同客人`;
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
  `¥${weekMoneyOf(w).toLocaleString("zh-CN")} / ¥${weekTargetIn(w, weekNoOf(w.day)).toLocaleString("zh-CN")}`;
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

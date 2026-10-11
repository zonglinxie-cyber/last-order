// 「本周规矩」：一季四周，每周一条轮换的规矩（docs/长线玩法提案.md §3）。
// 为什么要有它：第 1 季那 28 天里，中间那三周最容易变成重复劳动 —— 同样的时段、同样的动作、
// 同样的分数。换一条规矩就要换一种打法（Hades 每一轮的变化靠的是规则轮换，不是靠新内容）。
// 口径与自选加难（heat.ts）同一套：**只调现成的旋钮**，不新增机制、不新增数值面板。
// 这一份同样是纯数据 + 纯函数：不 import engine（免得绕成环），读的是传进来的 qualities。
//
// 落地：周一早会罗曼念一句并把这一周那条落进 `week:<id>`，周日打烊清掉；
// 换季不带着走（`week:` 不在 CARRIED_QUALITY 里），因为下一季的第 1 周会重新落一条别的。

export const WEEK_RULES = [
  {
    id: "training",
    word: "品牌培训周",
    knobs: ["energySlotOf"],
    line: "早会罗曼把课表摊在柜台上：这周品牌培训，每一格少给一点劲，先把话听完。",
    note: "每格发的精力 20 → 15：一天四格，少掉的那一截就是坐在培训教室里的时间。",
  },
  {
    id: "patrol",
    word: "商场巡查周",
    knobs: ["hardSellComplianceNow", "cleanWeightOf"],
    line: "早会罗曼压低声音：这周商场巡查，硬推被抓到台账加倍扣，别往枪口上撞。",
    note: "硬推一次的台账扣分 -4 → -8；方敏那张「今天一单都别硬推」的委托出现得更勤。",
  },
  {
    id: "rival-off",
    word: "对面休假周",
    knobs: ["poachMaxOpinionNow"],
    line: "早会罗曼说陆遥这周休假：只带走本来就不想待着的那几位，别高兴太早，下周她回来。",
    note: "她这一周只请走看法低于 20 的人（平时是低于 40），概率照旧 —— 漏掉的人还在漏，只是她懒得一个个请。",
  },
  {
    id: "member-day",
    word: "会员日周",
    knobs: ["verbEnergyNow"],
    line: "早会罗曼举着排班表晃一下：这周会员日，加微信不花精力，能留几位是几位。",
    note: "「加微信」那一下的精力 4 → 0：一天里可以多留住几个人。",
  },
] as const;

export type WeekId = (typeof WEEK_RULES)[number]["id"];

export const WEEK_IDS: readonly WeekId[] = WEEK_RULES.map(r => r.id);
export const WEEK_COUNT = WEEK_RULES.length;
/** 一季四周（28 天）；与 SEASON_DAYS 对齐由 tests/world-weeks.test.ts 逐日核对。 */
export const WEEK_DAYS = 7;

export const weekKey = (id: WeekId): string => `week:${id}`;
export const isWeekKey = (key: string): boolean => key.startsWith("week:");
export const isWeekId = (x: unknown): x is WeekId => typeof x === "string" && WEEK_IDS.includes(x as WeekId);

/** 第几天是这一季的第几周（1..4）。 */
export const weekNoOf = (day: number): number => Math.floor((day - 1) / WEEK_DAYS) + 1;
export const isMonday = (day: number): boolean => (day - 1) % WEEK_DAYS === 0;
export const isSunday = (day: number): boolean => (day - 1) % WEEK_DAYS === WEEK_DAYS - 1;

/** 这一周轮到哪条：周号定序、季号错开一格（连着玩四季，每一季的第 1 周都不是同一条），
 *  而**起点定在会员日周**：第 1 季第 1 周是新手那七天，开局就撞上"每格少 5 点劲"的培训周，
 *  教出来的第一印象是这游戏克我 —— 扣劲与翻倍扣分那两条排到后面几周（第 1 季顺序：会员日 → 培训 → 巡查 → 休假）。
 *  那条口径由 tests/world-weeks.test.ts 钉着：改动这个 +2，红的是"第 1 季第 1 周念哪一句"。 */
export const weekRuleOf = (season: number, day: number): WeekId => {
  const index = (weekNoOf(day) - 1 + (season - 1) + 3) % WEEK_COUNT;
  return WEEK_IDS[index]!;
};

/** 此刻生效的那一条（没落上就是 null：周一以前或规矩被清掉的空档）。 */
export const weekNow = (qualities: Record<string, number>): WeekId | null => {
  for (const id of WEEK_IDS) if (qualities[weekKey(id)]) return id;
  return null;
};

const on = (qualities: Record<string, number>, id: WeekId): boolean => !!qualities[weekKey(id)];
/** 这一周每格发多少精力（培训周少给一格的四分之一）。 */
export const energyPerSlotOf = (qualities: Record<string, number>, base: number): number =>
  on(qualities, "training") ? base - 5 : base;
/** 这一周硬推一次的台账扣分（巡查周翻倍）。 */
export const hardSellComplianceOf = (qualities: Record<string, number>, base: number): number =>
  on(qualities, "patrol") ? base * 2 : base;
/** 这一周陆遥请走"看法低于多少"的人（休假周把门槛收到 20：只带走本来就想走的）。
 *  概率不动 —— 清零会让这一周变成"谁都必赢"，模拟器那张 规矩周 × 风格 就是抓这个的（第 48 轮）。 */
export const poachMaxOpinionOf = (qualities: Record<string, number>, base: number): number =>
  on(qualities, "rival-off") ? 20 : base;
/** 这一周加微信花不花精力（会员日免费）。 */
export const wechatEnergyOf = (qualities: Record<string, number>, base: number): number =>
  on(qualities, "member-day") ? 0 : base;
/** 这一周方敏那张「别硬推」的委托权重（巡查周翻倍——她自己也盯着台账）。 */
export const cleanWeightOf = (qualities: Record<string, number>, base: number): number =>
  on(qualities, "patrol") ? base * 2 : base;

/** 界面顶栏那一行念的名字。 */
export const weekWordOf = (qualities: Record<string, number>): string => {
  const id = weekNow(qualities);
  return id ? WEEK_RULES.find(r => r.id === id)!.word : "";
};

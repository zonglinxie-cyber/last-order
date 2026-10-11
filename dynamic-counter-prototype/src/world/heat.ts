// 「自选加难」的规矩表（docs/长线玩法提案.md §6）。这一份只有数据与 id 校验，不 import 引擎：
// 旋钮的真实数值留在 engine.ts / requests.ts 那五颗常量上（START_SAMPLES、SAMPLES_PER_NIGHT、
// START_COMPLIANCE、POACH_CHANCE、WECHAT_MIN_OPINION、QUOTA_MIN/QUOTA_TOP），这边只回答"勾了哪几条"。
// 为什么要这么分：加难必须改的是现成的数，不是再长一套并行机制 —— 空档（一条都不勾）下每一个数
// 与加这一刀之前逐字节相同，那条不变量由 tests/world-heat.test.ts 钉着。
// 玩家勾的结果存在 `World.heat`（可选字段、跨季带着走、进存档）；档案里"最难拿到过几条"存 progress。

export const HEAT_RULES = [
  {
    id: "thin-samples",
    word: "小样减半",
    note: "起手与换季那一次只发一半（8 → 4），每晚品牌补的也减半（4 → 2）—— 伸手给人东西的那一步不再管够。",
  },
  {
    id: "roman-tough",
    word: "罗曼多要一件",
    note: "件数那把阶梯整档上移：季初就要 3 件，第 15 天起要 4 件。差一件照样算失约、照样扣柜位。",
  },
  {
    id: "luyao-hungry",
    word: "陆遥更狠",
    note: "她请走你没顾上那一位的概率从四成提到五成五，被请去对面照样当场成一单记进她的账。",
  },
  {
    id: "no-wechat",
    word: "不许加微信",
    note: "柜上不再放出「加微信」那一下：往后那些晚上回流、带熟人都没有了，只能靠人站在柜前这一回。",
  },
  {
    id: "cold-ledger",
    word: "台账起点更低",
    note: "开局台账从 55 起变成 40 起，换季往回折也折到 40 那一档 —— 硬推的余地更大，出事时也更容易掉到下限以下。",
  },
] as const;

export type HeatId = (typeof HEAT_RULES)[number]["id"];

export const HEAT_MAX = HEAT_RULES.length;
export const HEAT_IDS: readonly HeatId[] = HEAT_RULES.map(r => r.id);

export const isHeatId = (x: unknown): x is HeatId => typeof x === "string" && HEAT_IDS.includes(x as HeatId);

/** 档案里那一枚章的念法：勾了几条规矩拿到的。0 条不盖章。 */
export const heatStampWord = (n: number): string => n > 0 ? `最难：勾 ${n} 条拿到` : "";

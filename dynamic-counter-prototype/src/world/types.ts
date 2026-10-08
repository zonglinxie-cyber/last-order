// 人情场的数据契约。设计见 docs/人情场设计.md。
// 引擎（engine.ts）只读这里的类型；人物与故事碎片（content/）只写成这里的数据。
// 卖货的判断复用 campaign.ts 的 Demand / ProductId / fitScore，不另起一套。
import type { Demand, Trait } from "../campaign.ts";

export type PersonId = string;
/** 玩家自己在关系网上的节点 id。 */
export const PLAYER: PersonId = "player";

export type Role = "customer" | "staff" | "rival" | "mall";

/** 脾气：决定她传不传话、信不信传话、被推销时怎么反应。每人 1~2 个。 */
export type Temper =
  | "face"     // 爱面子：当众被拆穿记仇更深
  | "wary"     // 多疑：听来的话打折，自己见到的才算
  | "warm"     // 热心：愿意替你带人来
  | "gossip"   // 爱八卦：碰到熟人就传话
  | "thrifty"  // 精打细算：对价钱和赠品敏感
  | "hasty"    // 急性子：等不了，耐心短
  | "loyal"    // 念旧：好坏都记得久
  | "proud"    // 好胜：不愿被比下去
  | "shy";     // 怕被推销：围上去就走

export type Zone = "counter" | "rival" | "atrium" | "cashier" | "lounge" | "backroom" | "entrance";
/** 一天四个时段：0 上午 · 1 午后 · 2 傍晚 · 3 晚高峰 */
export type Slot = 0 | 1 | 2 | 3;

export type BondKind = "family" | "friend" | "partner" | "colleague" | "mentor" | "rival" | "client" | "fan";
/** 初始关系，有向：a 对 b 的冷暖。双向关系写两条。 */
export type Bond = { to: PersonId; kind: BondKind; warmth: number /* -100..100 */ };

export type Visits = {
  /** 哪些日子会来："any" 任意一天，或一周中的第几天（1~7）列表 */
  days: "any" | number[];
  slots: Slot[];
  /** 满足日子和时段时出现的概率 0..1；0 表示只在被效果安排时才来 */
  chance: number;
  /** 从第几天起才会出现（含） */
  fromDay?: number;
  /** 节日 id 列表：只在这些节日的窗口里出现 */
  festivals?: string[];
  /** 节日窗口开着时，来访概率换成 chance × 这个数（压回 0..1）。
      >1 过节更常来，<1 过节反而躲着她；不填 festivals 也对任何节日生效。 */
  festivalBoost?: number;
};

export type Skin = {
  demands: Demand[];
  veto?: { trait: Trait; below: number; note: string };
  budget: number;
  maxUnits: number;
  /** 东西是买给谁的。替别人买时，看她的脸会看错。 */
  buysFor?: PersonId;
};

/** 每个人自己的口吻。{player} 会被换成玩家名，{x} 换成话题里那个人的名字。 */
export type Voice = {
  greet: string;      // 进门第一句
  pleased: string;    // 被好好对待
  hurt: string;       // 被冒犯或被硬推
  praise: string;     // 跟熟人夸你："{player} 那人还行……"
  complain: string;   // 跟熟人说你坏话
};

export type Person = {
  id: PersonId;
  name: string;
  role: Role;
  age: number;
  /** 一句话身份 */
  descriptor: string;
  tempers: Temper[];
  skin?: Skin;
  visits: Visits;
  bonds: Bond[];
  /** 秘密：满足条件后玩家才知道 */
  secret?: { text: string; reveal: Cond[] };
  voice: Voice;
  /** 已有立绘时填资源路径；没有则 artBrief 给画师 */
  portrait?: string;
  artBrief?: string;
};

// —— 世界状态 ——

export type Memory = {
  day: number;
  /** 谁记着 */
  holder: PersonId;
  /** 记的是谁的事（多数是 PLAYER） */
  subject: PersonId;
  /** 事件代号，如 "hard-sell"、"honest-advice"、"kept-secret"、"took-my-client" */
  act: string;
  valence: -2 | -1 | 0 | 1 | 2;
  /** 听谁说的；自己亲眼见的为空 */
  heardFrom?: PersonId;
};

export type LogEntry = { day: number; slot: Slot; text: string; who?: PersonId[] };

export type World = {
  seed: string;
  /** 第几季：从 1 起，nextSeason +1。旧存档缺这个字段按 1 读。 */
  season: number;
  day: number;
  slot: Slot;
  money: number;
  standing: number;    // 柜位：0..100
  compliance: number;  // 台账：0..100
  energy: number;      // 今天还剩的精力
  samples: number;
  /** 每个人对玩家的看法 -100..100；没见过也可能有（听来的） */
  opinion: Record<PersonId, number>;
  /** NPC 之间冷暖的当前值，键为 "a>b"；缺省取 Person.bonds 的初始值 */
  bonds: Record<string, number>;
  /** 运行时才建立的关系类型（介绍认识、反目成仇），键同 bonds；缺省取 Person.bonds 声明的 kind */
  bondKinds?: Record<string, BondKind>;
  memories: Memory[];
  /** 故事碎片用的进度值（QBN 的 quality），如 "arc:anjie"；引擎自己也记 "storyteller:heat"。
      没写过的 key 一律读作 0 —— 条件和效果都不用先初始化。 */
  qualities: Record<string, number>;
  /** 本时段在场的人和所在区域 */
  present: Record<PersonId, Zone>;
  /** 本时段玩家已经招呼过的人：陆遥只挑没被招呼过的顾客下手 */
  touched: PersonId[];
  /** 当前节日 id（节日表由内容侧维护）；Visits.festivals 和 Cond {festival} 都读它 */
  festival?: string;
  /** 已消耗的抽数：每个随机决定都从 seed+rngCalls 推导，存档往返后确定性不断 */
  rngCalls: number;
  /** 被效果排定的来访："第几天 第几时段 谁来，带谁"；reason 记她为什么来（退货要退款） */
  appointments: Array<{ day: number; slot: Slot; person: PersonId; bring?: PersonId[]; reason?: "visit" | "refund" | "wechat"; amount?: number }>;
  /** 故事碎片的使用记录：id -> 最近一次触发的天 */
  fired: Record<string, number>;
  log: LogEntry[];
};

// —— 条件与效果（内容作者写的就是这些数据） ——

/** 人的引用：具体 id，或者故事碎片里的角色槽名（以 "$" 开头，如 "$a"） */
export type Ref = PersonId | `$${string}`;

export type Cond =
  | { present: Ref; zone?: Zone }
  | { absent: Ref }
  | { opinion: Ref; gte?: number; lte?: number }
  | { bond: [Ref, Ref]; gte?: number; lte?: number; kind?: BondKind }
  | { quality: string; gte?: number; lte?: number; eq?: number }
  /** holder 记着一件事；act/valence/subject 过滤是哪种事，heard 区分亲眼还是听来的，from 钉死"是听谁说的"。 */
  | { remembers: Ref; act?: string; valence?: "good" | "bad"; subject?: Ref; heard?: boolean; from?: Ref }
  /** 玩家是否已经知道她的秘密（引擎写 secret-known:<id>，beginSlot 自动揭开和 reveal 效果都算） */
  | { knowsSecret: Ref }
  | { temper: Ref; is: Temper }
  | { role: Ref; is: Role }
  | { day: { gte?: number; lte?: number } }
  | { slot: Slot[] }
  | { festival: string }
  | { stat: "money" | "standing" | "compliance" | "energy" | "samples"; gte?: number; lte?: number }
  | { any: Cond[] }
  | { not: Cond };

export type Effect =
  | { opinion: Ref; delta: number }
  /** 冷暖加减。同一个 bond 效果里 delta 和 set 二选一，不能同时给。 */
  | { bond: [Ref, Ref]; delta: number; kind?: never; set?: never }
  /** 新建关系或改关系种类（介绍认识、对头和好成朋友）：kind 写种类；set 把冷暖钉到这个值，
      不给 set 保持现状；两个都不给只算"从此认识"。与 delta 二选一。 */
  | { bond: [Ref, Ref]; kind?: BondKind; set?: number; delta?: never }
  | { quality: string; delta?: number; set?: number }
  | { stat: "money" | "standing" | "compliance" | "energy" | "samples"; delta: number }
  /** 让她记住一件事；heardFrom 写"是听谁说的"，不写就是当场见闻。 */
  | { remember: { holder: Ref; act: string; valence: -2 | -1 | 0 | 1 | 2; subject?: Ref; heardFrom?: Ref } }
  /** 让某人在若干天后再来，可以带上别人 */
  | { appoint: { person: Ref; inDays: number; slot?: Slot; bring?: Ref[] } }
  /** 把在场的人挪到别的区（被请去休息区、被带去收银）；人不在场就不动 */
  | { move: { person: Ref; zone: Zone } }
  /** 玩家当场知道某人的秘密：写 secret-known:<id>，口径和 beginSlot 自动揭开的那条一致 */
  | { reveal: Ref }
  /** 当场离开 */
  | { leave: Ref }
  | { log: string };

/** 角色槽：引擎从在场或全体人物里找满足条件的人填进去 */
export type CastSlot = {
  /** 钉死成某个具体的人（个人线主角）；不填则按 where 从在场或全体里找 */
  id?: PersonId;
  /** 填槽的人必须满足这些条件，where 里的每一条都要成立（全部满足才算数；
      要"或者"就在其中一条里写 { any: [...] }）。条件里可以用 "$self" 指这个槽的人，也可以引用前面的槽 */
  where: Cond[];
  /** 默认 true：必须在场 */
  mustBePresent?: boolean;
};

export type Choice = {
  label: string;
  /** 不满足就不显示这个选项 */
  when?: Cond[];
  effects: Effect[];
  /** 选完以后念的一句结果 */
  result: string;
};

export type Storylet = {
  id: string;
  /** 通用社交局 or 个人线 */
  kind: "social" | "arc" | "floor";
  /** 角色槽，按声明顺序绑定。个人线一般把主角钉成具体 id。 */
  cast: Record<string, CastSlot>;
  /** 整张卡的出现条件（在角色槽绑定之后求值） */
  when: Cond[];
  /** 说书人挑卡的基础权重 */
  weight: number;
  /** 张力：-1 缓和 · 0 平常 · 1 起冲突。说书人用它控制节奏 */
  tension: -1 | 0 | 1;
  once?: boolean;
  /** 冷却天数 */
  cooldown?: number;
  /** 正文，可以用 {$a} {$b} 引用角色槽的人名，{player} 是玩家名 */
  text: string;
  choices: Choice[];
};

/** 玩家在楼层上对人做的动作（引擎实现规则，界面只列出可用的） */
export type Verb =
  | "greet"       // 招呼
  | "serve"       // 接待：进入卖货判断
  | "sample"      // 送小样
  | "introduce"   // 介绍两个人认识（需要两个目标）
  | "mediate"     // 去打圆场（两个在场的人关系差时）
  | "handoff"     // 托同事接手
  | "help"        // 帮同事一把
  | "wechat"      // 加微信
  | "keep"        // 替人保密
  | "tell";       // 把话传出去（对 b 说 a 的事）

export type Festival = { id: string; name: string; fromDay: number; toDay: number };

// 人情场引擎：纯 TypeScript，不碰界面。所有函数都是纯函数 —— 入参 World，返回新 World。
// 设计见 docs/人情场设计.md，数据契约见同目录 types.ts。随机数全部来自 rng.ts 的
// (seed, rngCalls) 推导，所以同一种子、同一串操作结果逐位相同，存档往返也不断。
//
// 卖货判断走人情场自己的货架 shelf.ts（八支货、六个价位）：适配公式与阈值仍与 campaign.ts 同口径，
// 但货不进旧五日版，旧版那些钉死的路线金额不受影响。
import { draw, drawIndex, drawInt, drawWeighted } from "./rng.ts";
import {
  bestShelf, PERFECT_MATCH, PERFECT_MATCH_OPINION, SHELF, shelfFitTier, shelfUnits,
  fitOfPerson, type ShelfId,
} from "./shelf.ts";
import { clearQuarrel, exchanges } from "./exchanges.ts";
import { openDay, seenKey, settleRequests, soldUnitsKey } from "./requests.ts";
import type {
  BondKind, Cond, Effect, Festival, LogEntry, Memory, Person, PersonId, Ref, Slot,
  Storylet, Verb, Visits, World, WorldRequest, Zone,
} from "./types.ts";
import { PLAYER, SEASON_DAYS } from "./types.ts";
import { ta } from "./pronoun.ts";

// —— 可调常量（引擎拍的数值，主控定平衡） ——

export const PLAYER_NAME = "许愿";

export const ENERGY_PER_DAY = 100;
/** 精力按格子发：一早不再一次给满，每个时段开头补一格，未花完的攒着（封顶 ENERGY_PER_DAY）。
    四格一共 80，比旧版一早那 100 少 20 —— 少的这一截是付给节奏的价钱：旧版每季 25% 的时段
    空有劲没处花（末两档只剩 20 / 1 点），按格发之后那些时段重新做得有事。 */
export const ENERGY_PER_SLOT = 20;
export const START_STANDING = 50;
export const START_COMPLIANCE = 55;
export const START_SAMPLES = 8;
export const SAMPLES_MAX = 8;
/** 每晚品牌补小样。 */
export const SAMPLES_PER_NIGHT = 4;
/** 同时在场的顾客上限（手机屏幕放不下更多）。同事、对手、商场方不占这个名额。
 *  这个数不能超过各区客位的总数（下面的 ZONE_GUEST_CAPACITY 加起来），否则要么有人站不下、
 *  要么界面上两个人叠在同一个坐标。world-engine.test.ts 钉着这条。
 *  7 位里柜台只摆得下 5 位，另外两位由下面的权重散去中庭 / 休息区 / 收银 / 入口 —— 这就是"错峰"：
 *  场上热热闹闹，柜台那一条线还是看得清、点得中。 */
export const MAX_PRESENT_CUSTOMERS = 7;
/** 每个时段至少有这么多位客人在场：空场对新玩家是最差的第一眼。 */
export const MIN_PRESENT_CUSTOMERS = 2;
/** 开局那个上午先来的两位：和五日版第一天同一道题——两个人，只能先接住一个。 */
export const OPENING_GUESTS: PersonId[] = ["shen", "mei"];

/** 白天传话：A 在场、对 B 有正冷暖时开口的概率。爱八卦再加。 */
export const GOSSIP_BASE = 0.25;
export const GOSSIP_TEMPER_BONUS = 0.35;
/** 听来一件 valence 的事，对玩家看法动多少。 */
export const GOSSIP_OPINION = 8;
/** 多疑的人把听来的话打这个折。 */
export const WARY_HEARSAY_MULT = 0.5;
/** 夜里微信群传话：概率比白天低，沿关系网走、不限在场。 */
export const NIGHT_GOSSIP_BASE = 0.1;
export const NIGHT_GOSSIP_TEMPER_BONUS = 0.2;

/** 陆遥抢客：每时段一次，挑走到我柜台上、没被玩家招呼过、对玩家看法最低的顾客。 */
export const POACH_CHANCE = 0.4;
/** 漏单的口子只在柜台和收银这两个区：在中庭闲逛、在休息区坐着的人不算你错过的生意。 */
export const POACH_ZONES: Zone[] = ["counter", "cashier"];
/** 看法高过这条线的顾客请不动。 */
export const POACH_MAX_OPINION = 40;
export const POACH_OPINION = -3;

/** 卖货：判断对了入账记 +2，硬推当场入账但记 -2、过两天来退。 */
export const SERVE_GOOD_OPINION = 8;
export const SERVE_MIXED_OPINION = 4;
export const SERVE_MISS_OPINION = -3;
/** 对症却超预算：她没怪你选错，怪的是兜里那个数。比推错轻，但这一单的精力照样白花。 */
export const PRICE_MISS_OPINION = -1;
export const HARD_SELL_OPINION = -12;
export const HARD_SELL_COMPLIANCE = -4;
export const HARD_SELL_STANDING = -1;
export const REFUND_OPINION = -8;
export const REFUND_MIN_DAYS = 2;
export const REFUND_MAX_DAYS = 3;

/** 各动作花的精力。
 *  接待从 20 降到 12 是为了跟一格 20 点对上：开一单（12）之后手上还剩 8，正好是"帮一次同事"（8）
 *  或"打一个圆场"的零头。按格发精力之后一格只够一件事，柜位那一天一次的人情（socialStanding）
 *  就被接待整格吃掉 —— 量出来老实人每季帮同事从 25 次掉到 1 次，柜位中位 85 → 62（见设计文档"柜位这一路谁在加"）。 */
export const VERB_ENERGY: Record<Verb, number> = {
  greet: 3, sample: 6, serve: 12, introduce: 10, mediate: 12,
  handoff: 6, help: 8, wechat: 4, keep: 2, tell: 4,
};

export const GREET_FIRST = 3;
export const GREET_REPEAT = 1;
/** 怕被推销的人同一天被招呼第二次起，每次扣这些。 */
export const GREET_SHY_REPEAT = -3;
export const SAMPLE_OPINION = 6;
export const SAMPLE_THRIFTY_OPINION = 10;
export const WECHAT_MIN_OPINION = 15;
export const WECHAT_OPINION = 2;
/** 加了微信的人每晚回流的概率；可能带熟人。 */
export const WECHAT_RETURN_CHANCE = 0.25;
export const WECHAT_BRING_CHANCE = 0.4;
export const WECHAT_BRING_MIN_WARMTH = 20;

export const INTRODUCE_MIN_OPINION = 10;
export const INTRODUCE_WARMTH = 20;
export const INTRODUCE_OPINION = 4;
/** 两个好胜的人被介绍到一起：不交朋友，结一对 -10 的对头。 */
export const INTRODUCE_PROUD_WARMTH = -10;
export const INTRODUCE_FAIL_OPINION = -4;

/** 打圆场：两人冷暖低于这条线才接得起来。 */
export const MEDIATE_COLD_LIMIT = -20;
export const MEDIATE_BASE = 0.35;
export const MEDIATE_MIN = 0.1;
export const MEDIATE_MAX = 0.9;
export const MEDIATE_WARMTH = 30;
export const MEDIATE_OK_OPINION = 4;
export const MEDIATE_FAIL_OPINION = -6;

export const HANDOFF_STAFF_OPINION = 4;
export const HANDOFF_CUSTOMER_OPINION = 2;
/** 托同事接手能成交的门槛：同事对你够熟才肯替你开这单，一个同事一天最多一单。 */
export const HANDOFF_SALE_MIN_OPINION = 20;
/** 柜位不只认卖货：同事看在眼里的人情也算。一天里只有第一次人情动作加柜位，免得刷。 */
const socialStanding = (w: World, delta: number): World =>
  qualityOf(w, "standing:social-day") === w.day ? w
    : setQuality({ ...w, standing: clamp(w.standing + delta, 0, 100) }, "standing:social-day", w.day);
export const HELP_STANDING = 1;
export const MEDIATE_STANDING = 2;
export const INTRODUCE_STANDING = 1;
export const HELP_OPINION = 6;
export const HELP_REPEAT_OPINION = 2;

/** 看法低过这条线，她连接待都不愿意 —— 关系坏了连开单的机会都没有。 */
export const SERVE_REFUSE_OPINION = -30;
/** 台账或柜位见底就开不了单（合规 0 或柜位 0）。 */
export const SERVE_STAT_FLOOR = 0;
/** 硬推出去的货，她预约退货的概率；剩下的她认了，当买个教训。 */
export const RETURN_PROBABILITY = 0.8;
/** 加了微信 / 被约回来的人，看法够高且你有她正解的货时会自己带一支。 */
export const RETURN_BUY_MIN_OPINION = 5;
/** 顾客不是无限钱包：买过一次，这几天内不再买。硬推不管这条 —— 多卖的照样会退。 */
export const BUY_INTERVAL_DAYS = 10;
/** 盟友替你拉客：热心或念旧、看法 ≥40 的人夜里可能约个朋友来。 */
export const REFERRAL_ALLY_OPINION = 40;
export const REFERRAL_CHANCE = 0.15;

export const KEEP_OPINION = 10;
export const TELL_OPINION = 5;
export const TELL_GOSSIP_OPINION = 8;
/** a 发现自己被传出去时（和听过秘密的人同场），每个时段的察觉概率。 */
export const SECRET_BLOWBACK = 0.5;
export const SECRET_BETRAY_OPINION = -25;
/** 先答应保密又传出去，仇记更深。 */
export const SECRET_BETRAY_KEPT_OPINION = -35;

/** 在场、和目标有关系的人算"看见了"：看法按 valence×这个数×对目标的亲疏动。 */
export const WITNESS_OPINION = 4;

/** 说书人节奏：冲突多就压 tension=1 的卡、抬 tension=-1 的，太平久了反过来。 */
export const STORY_HEAT_DECAY = 0.7;
export const STORY_HEAT_MAX = 3;

/** 同事开柜时在柜台后的概率；其余去员工通道。人还在场，只是换个区站着。
 *  原来是 0.7 —— 六位同事每位 70% 站柜台，实测柜台上平均 4.20 位同事对 0.00 位客人，
 *  「柜台人物太多了，顾客太少」说的就是这一格。0.35 配下面的名额与权重，实测柜台上
 *  1.79 位客人对 1.60 位同事（24 种子 × 28 天，开门那一刻的均值）。 */
export const STAFF_COUNTER_CHANCE = 0.35;
/** 柜台后同时站得下的同事数（ui/zones.ts 的 ZONE_STAFF_SPOTS.counter 只有四个点，
 *  再多是叠着站）。超出的去员工通道，不占柜台。 */
export const STAFF_COUNTER_MAX = 2;
/** 客人进来落在哪一区。柜台排第一：来买东西的人是走到柜前站定的，不是在中庭看热闹。
 *   lounge / cashier / entrance 三档的权重不动 —— 有卡的锚点条件写着 {zone:"lounge"}、
 *  {zone:"cashier"}（各两处），从它们碗里分走会把这些卡饿掉；分走的是中庭那份。 */
export const CUSTOMER_ZONE_WEIGHTS: Array<[Zone, number]> = [
  ["counter", 0.45], ["atrium", 0.1], ["lounge", 0.2], ["cashier", 0.15], ["entrance", 0.1],
];
/** 各区摆得下几位客人 —— 必须等于 ui/zones.ts 里 ZONE_SPOTS 的坐标数，
 *  一个点站一个人，站满了不再往里派（引擎不 import 界面，所以数值抄在这里，
 *  对不上由 world-engine.test.ts 报红）。柜台那一格是 5 不是 7：手机最窄一档上
 *  六个点就要叠在一起，点得着的人数反而变少。 */
export const ZONE_GUEST_CAPACITY: Record<Zone, number> = {
  counter: 5, cashier: 3, rival: 4, atrium: 5, lounge: 3, entrance: 4, backroom: 3,
};

const bondKey = (a: PersonId, b: PersonId) => `${a}>${b}`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp100 = (v: number) => clamp(v, -100, 100);

// —— 基础读写 ——

export const personOf = (people: Person[], id: PersonId) => people.find(p => p.id === id);
export const hasTemper = (person: Person | undefined, t: Person["tempers"][number]) =>
  !!person && person.tempers.includes(t);

export const opinionOf = (world: World, id: PersonId) => world.opinion[id] ?? 0;

/** a 对 b 的冷暖：运行时改过的取 World.bonds，否则取 Person.bonds 的初始值，都没有是 0。 */
export function warmthOf(world: World, people: Person[], a: PersonId, b: PersonId): number {
  const key = bondKey(a, b);
  if (key in world.bonds) return world.bonds[key];
  return personOf(people, a)?.bonds.find(x => x.to === b)?.warmth ?? 0;
}

export function kindOf(world: World, people: Person[], a: PersonId, b: PersonId): BondKind | undefined {
  return world.bondKinds?.[bondKey(a, b)] ?? personOf(people, a)?.bonds.find(x => x.to === b)?.kind;
}

/** a 和 b 之间认不认识：哪一头的 bonds 里有记录就算。 */
export function related(world: World, people: Person[], a: PersonId, b: PersonId): boolean {
  if (bondKey(a, b) in world.bonds || bondKey(b, a) in world.bonds) return true;
  if (world.bondKinds && (bondKey(a, b) in world.bondKinds || bondKey(b, a) in world.bondKinds)) return true;
  return !!(personOf(people, a)?.bonds.some(x => x.to === b) || personOf(people, b)?.bonds.some(x => x.to === a));
}

const isPresent = (world: World, id: PersonId) => id in world.present;
/** 玩家够得着：在场，且没被带到对面维珞。 */
const reachable = (world: World, id: PersonId) => isPresent(world, id) && world.present[id] !== "rival";

/** 抽一次：返回 [0..1 的值, 前进过 rngCalls 的新 World]。 */
export const roll = (w: World): [number, World] => [draw(w.seed, w.rngCalls), { ...w, rngCalls: w.rngCalls + 1 }];

export const addOpinion = (w: World, id: PersonId, delta: number): World =>
  ({ ...w, opinion: { ...w.opinion, [id]: clamp100(opinionOf(w, id) + Math.round(delta)) } });

export const addWarmth = (w: World, people: Person[], a: PersonId, b: PersonId, delta: number): World =>
  ({ ...w, bonds: { ...w.bonds, [bondKey(a, b)]: clamp100(warmthOf(w, people, a, b) + delta) } });

const setBond = (w: World, a: PersonId, b: PersonId, kind: BondKind, warmth: number): World =>
  ({ ...w, bonds: { ...w.bonds, [bondKey(a, b)]: clamp100(warmth) },
     bondKinds: { ...(w.bondKinds ?? {}), [bondKey(a, b)]: kind } });

export const remember = (w: World, holder: PersonId, act: string, valence: Memory["valence"], subject: PersonId = PLAYER, heardFrom?: PersonId): World =>
  ({ ...w, memories: [...w.memories, { day: w.day, holder, subject, act, valence, ...(heardFrom ? { heardFrom } : {}) }] });

export const say = (w: World, text: string, who?: PersonId[]): World =>
  ({ ...w, log: [...w.log, { day: w.day, slot: w.slot, text, ...(who?.length ? { who } : {}) }] });

export const setQuality = (w: World, key: string, value: number): World =>
  ({ ...w, qualities: { ...w.qualities, [key]: value } });

export const qualityOf = (w: World, key: string) => w.qualities[key] ?? 0;

/** 她算不算"回头客"：这一季你招呼过她（served:）、她从你柜上带过货（bought:），
 *  或者上一季就加过微信（wechat: 是这三条里唯一跨季留着的）。served: 由接待动作记，
 *  bought: 由成交、赴约回流和托单记，wechat: 由加微信记；换季时前两条清零。
 *  楼层名牌上「新客 / 回头客」只读这一个判据，界面不许自己再拼一遍。 */
export const isReturningGuest = (w: World, id: PersonId) =>
  qualityOf(w, `served:${id}`) > 0 || qualityOf(w, `bought:${id}`) > 0 || qualityOf(w, `wechat:${id}`) > 0;

// —— 线索本 ——
// 玩家手里"对得上号"的一条事实。引擎只认 id 和记下的那天，文案在内容侧 content/clues.ts。
// 一条线什么时候算翻过来，也是内容用 quality「thread:<id>」钉的，引擎不猜。

export const CLUE_PREFIX = "clue:";
/** 整局走到现在的绝对天：第 1 季第 1 天是 1。线索记的是这个数，换季不改。 */
export const absDay = (w: World) => (w.season - 1) * SEASON_DAYS + w.day;
export const hasClue = (w: World, id: string) => qualityOf(w, `${CLUE_PREFIX}${id}`) > 0;
/** 记一条线索。已经记过就原样留着 —— 第一眼的日期才算数。 */
export const learnClue = (w: World, id: string): World =>
  hasClue(w, id) ? w : setQuality(w, `${CLUE_PREFIX}${id}`, absDay(w));
/** 本子里的线索，按记下的先后排。 */
export const clueIds = (w: World): string[] =>
  Object.entries(w.qualities)
    .filter(([key, v]) => key.startsWith(CLUE_PREFIX) && v > 0)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key.slice(CLUE_PREFIX.length));

export function newWorld(seed: string, _people: Person[]): World {
  return {
    seed, season: 1, day: 1, slot: 0, money: 0, rivalMoney: 0, rivalWins: 0,
    standing: START_STANDING, compliance: START_COMPLIANCE,
    energy: 0, samples: START_SAMPLES,
    opinion: {}, bonds: {}, bondKinds: {}, memories: [], qualities: {},
    present: {}, touched: [], rngCalls: 0, appointments: [], requests: [], fired: {}, log: [],
    opinionAtSeasonStart: {},
    statsAtSeasonStart: { standing: START_STANDING, compliance: START_COMPLIANCE },
  };
}

// —— 条件求值 ——

type Binding = Record<string, PersonId>;

const resolveRef = (ref: Ref, binding: Binding, self?: PersonId): PersonId | undefined => {
  if (ref === "$self") return self;
  if (ref.startsWith("$")) return binding[ref.slice(1)];
  return ref;
};

export function evalCond(world: World, people: Person[], cond: Cond, binding: Binding = {}, self?: PersonId): boolean {
  const at = (ref: Ref) => resolveRef(ref, binding, self);
  if ("present" in cond) {
    const id = at(cond.present);
    return !!id && isPresent(world, id) && (cond.zone === undefined || world.present[id] === cond.zone);
  }
  if ("absent" in cond) { const id = at(cond.absent); return !id || !isPresent(world, id); }
  if ("opinion" in cond) {
    const id = at(cond.opinion); if (!id) return false;
    const v = opinionOf(world, id);
    return (cond.gte === undefined || v >= cond.gte) && (cond.lte === undefined || v <= cond.lte);
  }
  if ("bond" in cond) {
    const a = at(cond.bond[0]), b = at(cond.bond[1]); if (!a || !b) return false;
    if (cond.kind !== undefined && kindOf(world, people, a, b) !== cond.kind) return false;
    const v = warmthOf(world, people, a, b);
    return (cond.gte === undefined || v >= cond.gte) && (cond.lte === undefined || v <= cond.lte);
  }
  if ("quality" in cond) {
    const v = qualityOf(world, cond.quality);
    return (cond.gte === undefined || v >= cond.gte) && (cond.lte === undefined || v <= cond.lte)
      && (cond.eq === undefined || v === cond.eq);
  }
  if ("remembers" in cond) {
    const holder = at(cond.remembers); if (!holder) return false;
    const subject = cond.subject ? at(cond.subject) : undefined;
    if (cond.subject && !subject) return false;
    const from = cond.from ? at(cond.from) : undefined;
    if (cond.from && !from) return false;
    return world.memories.some(m => m.holder === holder
      && (cond.act === undefined || m.act === cond.act)
      && (cond.valence === undefined || (cond.valence === "good" ? m.valence > 0 : m.valence < 0))
      && (subject === undefined || m.subject === subject)
      && (cond.heard === undefined || (cond.heard ? m.heardFrom !== undefined : m.heardFrom === undefined))
      && (from === undefined || m.heardFrom === from));
  }
  if ("knowsSecret" in cond) {
    const id = at(cond.knowsSecret);
    return !!id && !!qualityOf(world, `secret-known:${id}`);
  }
  if ("clue" in cond) return hasClue(world, cond.clue);
  if ("temper" in cond) { const id = at(cond.temper); return !!id && hasTemper(personOf(people, id), cond.is); }
  if ("role" in cond) { const id = at(cond.role); return !!id && personOf(people, id)?.role === cond.is; }
  if ("gender" in cond) { const id = at(cond.gender); return !!id && personOf(people, id)?.gender === cond.is; }
  if ("season" in cond) return (cond.season.gte === undefined || world.season >= cond.season.gte) && (cond.season.lte === undefined || world.season <= cond.season.lte);
  if ("day" in cond) return (cond.day.gte === undefined || world.day >= cond.day.gte) && (cond.day.lte === undefined || world.day <= cond.day.lte);
  if ("slot" in cond) return cond.slot.includes(world.slot);
  if ("festival" in cond) return world.festival === cond.festival;
  if ("stat" in cond) {
    const v = world[cond.stat];
    return (cond.gte === undefined || v >= cond.gte) && (cond.lte === undefined || v <= cond.lte);
  }
  if ("any" in cond) return cond.any.some(c => evalCond(world, people, c, binding, self));
  if ("not" in cond) return !evalCond(world, people, cond.not, binding, self);
  return false;
}

// —— 文本替换 ——

export function substitute(text: string, binding: Binding, people: Person[]): string {
  return text.replace(/\{(player|\$[A-Za-z_]\w*)\}/g, (_, name: string) => {
    if (name === "player") return PLAYER_NAME;
    const id = binding[name.slice(1)];
    return id ? (personOf(people, id)?.name ?? id) : name;
  });
}

// —— 效果执行 ——

function applyEffect(world: World, people: Person[], effect: Effect, binding: Binding): World {
  const at = (ref: Ref) => resolveRef(ref, binding);
  if ("opinion" in effect) {
    const id = at(effect.opinion); return id ? addOpinion(world, id, effect.delta) : world;
  }
  if ("bond" in effect) {
    const a = at(effect.bond[0]), b = at(effect.bond[1]);
    if (!a || !b) return world;
    const d = effect.delta;
    if (d !== undefined) return addWarmth(world, people, a, b, d);
    // 建档 / 改种类：set 给就把冷暖钉到这个值，不给保持现状；kind 没给且两边都没声明过种类时
    // 只写冷暖——bonds 里有这条记录就足够让 related() 认"两人认识"。
    const kind = effect.kind ?? kindOf(world, people, a, b);
    const warmth = clamp100(effect.set ?? warmthOf(world, people, a, b));
    return kind === undefined
      ? { ...world, bonds: { ...world.bonds, [bondKey(a, b)]: warmth } }
      : setBond(world, a, b, kind, warmth);
  }
  if ("quality" in effect) {
    return setQuality(world, effect.quality, effect.set ?? qualityOf(world, effect.quality) + (effect.delta ?? 0));
  }
  if ("stat" in effect) {
    const v = world[effect.stat] + effect.delta;
    const capped = effect.stat === "standing" || effect.stat === "compliance" ? clamp(v, 0, 100)
      : effect.stat === "energy" || effect.stat === "samples" ? Math.max(0, v) : v;
    return { ...world, [effect.stat]: capped };
  }
  if ("remember" in effect) {
    const holder = at(effect.remember.holder); if (!holder) return world;
    const subject = effect.remember.subject ? at(effect.remember.subject) : PLAYER;
    const heardFrom = effect.remember.heardFrom ? at(effect.remember.heardFrom) : undefined;
    return subject ? remember(world, holder, effect.remember.act, effect.remember.valence, subject, heardFrom) : world;
  }
  if ("appoint" in effect) {
    const person = at(effect.appoint.person); if (!person) return world;
    const slot: Slot = effect.appoint.slot ?? personOf(people, person)?.visits.slots[0] ?? 0;
    const bring = effect.appoint.bring?.map(at).filter((x): x is PersonId => !!x);
    return { ...world, appointments: [...world.appointments,
      { day: world.day + effect.appoint.inDays, slot, person, ...(bring?.length ? { bring } : {}), reason: "visit" }] };
  }
  if ("move" in effect) {
    const id = at(effect.move.person);
    if (!id || !isPresent(world, id)) return world;
    return { ...world, present: { ...world.present, [id]: effect.move.zone } };
  }
  if ("reveal" in effect) {
    const id = at(effect.reveal); if (!id) return world;
    const person = personOf(people, id);
    if (person?.secret && !qualityOf(world, `secret-known:${id}`))
      world = say(world, `你听说了${person.name}的事：${person.secret.text}`, [id]);
    return setQuality(world, `secret-known:${id}`, 1);
  }
  if ("clue" in effect) return learnClue(world, effect.clue);
  if ("leave" in effect) {
    const id = at(effect.leave); if (!id || !isPresent(world, id)) return world;
    const present = { ...world.present }; delete present[id];
    return { ...world, present };
  }
  if ("log" in effect) return say(world, substitute(effect.log, binding, people));
  return world;
}

// —— 来访调度 ——

/** 当天被对面请走的人：今天不再回到这层楼上。 */
const awayToday = (w: World, id: PersonId) => qualityOf(w, `away:${id}`) === w.day;

/** 这一天落在哪个节日窗口里；不在任何窗口里返回 undefined。 */
export const festivalOn = (day: number, festivals: Festival[]): string | undefined =>
  festivals.find(f => day >= f.fromDay && day <= f.toDay)?.id;

/** 她此刻的来访概率：节日窗口开着、她又写了 festivalBoost 时按 chance×boost 算（压回 0..1），否则就是 chance。 */
const visitChance = (v: Visits, festival: string | undefined): number =>
  festival !== undefined && v.festivalBoost !== undefined ? clamp(v.chance * v.festivalBoost, 0, 1) : v.chance;

/** 这一刻的精力上限：一天四个格子按发到手算，一个都没花就该有这个数。界面判"今天动过手没有"问它，别自己写死 ENERGY_PER_DAY。 */
export const energyCeiling = (slot: Slot): number =>
  Math.min(ENERGY_PER_DAY, ENERGY_PER_SLOT * (slot + 1));

/** 开一个时段。festivals 给了就按当天日期设置 World.festival —— Visits.festivals 与 {festival} 条件都读它。 */
export function beginSlot(world: World, people: Person[], festivals?: Festival[]): World {
  let w: World = { ...world, present: {}, touched: [], energy: Math.min(ENERGY_PER_DAY, world.energy + ENERGY_PER_SLOT) };
  if (festivals) w = { ...w, festival: festivalOn(w.day, festivals) };
  const dayOfWeek = ((w.day - 1) % 7) + 1;
  const present: Record<PersonId, Zone> = {};

  // 过期的预约清掉（没来就是没来）；本时段的预约先在场内落位。
  const due = w.appointments.filter(a => a.day === w.day && a.slot === w.slot);
  w = { ...w, appointments: w.appointments.filter(a => a.day > w.day || (a.day === w.day && a.slot > w.slot)) };

  const placeCustomer = (id: PersonId, zone: Zone) => { present[id] = zone; };
  let customerCount = 0;

  // 客人落在哪一区：按权重抽，但只往还站得下的区派 —— 一个坐标站一个人，
  // 站满了还往里塞，界面上就是两个人叠在同一个点上，看不出是两个人。
  const drawGuestZone = (): Zone => {
    const used = new Map<Zone, number>();
    for (const [id, zone] of Object.entries(present))
      if (personOf(people, id)?.role === "customer") used.set(zone, (used.get(zone) ?? 0) + 1);
    const pool = CUSTOMER_ZONE_WEIGHTS.filter(([zone]) => (used.get(zone) ?? 0) < ZONE_GUEST_CAPACITY[zone]);
    let r: number; [r, w] = roll(w);
    const total = pool.reduce((a, [, weight]) => a + weight, 0);
    let acc = 0;
    for (const [zone, weight] of pool) { acc += weight; if (r * total < acc) return zone; }
    return pool[pool.length - 1][0];
  };

  // 常驻：同事在柜台或员工通道，对面维珞的人在 rival 区，商场方在中庭。
  let staffAtCounter = 0;
  for (const person of people) {
    if (person.role === "rival") { present[person.id] = "rival"; }
    else if (person.role === "mall") { present[person.id] = "atrium"; }
    else if (person.role === "staff") {
      let r: number; [r, w] = roll(w);
      // 柜台后只留得下两个人的位置：概率过了还要看名额，多出来的同事去员工通道。
      if (r < STAFF_COUNTER_CHANCE && staffAtCounter < STAFF_COUNTER_MAX) { present[person.id] = "counter"; staffAtCounter++; }
      else present[person.id] = "backroom";
    }
  }

  // 如约而至的人站柜台前；退货的单在她进门这一刻退款。
  for (const ap of due) {
    const person = personOf(people, ap.person);
    if (!person || person.role !== "customer") continue;
    if (customerCount >= MAX_PRESENT_CUSTOMERS) continue;
    placeCustomer(ap.person, "counter"); customerCount++;
    w = say(w, `${person.name}如约来了。`, [ap.person]);
    if (ap.reason === "refund" && ap.amount) {
      w = { ...w, money: w.money - ap.amount };
      w = addOpinion(w, ap.person, REFUND_OPINION);
      w = remember(w, ap.person, "returned-goods", -2);
      w = say(w, `${person.name}把那单硬推的货退了回来，退回 ¥${ap.amount}。`, [ap.person]);
    } else if ((ap.reason === "wechat" || ap.reason === "visit") && person.skin
      && opinionOf(w, ap.person) >= RETURN_BUY_MIN_OPINION) {
      // 为你回来的人：看法够高、你有她的正解，她顺手带一支 —— 关系是真金白银。
      const product = bestFit(person);
      const boughtDay = qualityOf(w, `bought:${ap.person}`);
      if (!(boughtDay > 0 && w.day - boughtDay < BUY_INTERVAL_DAYS)
        && shelfFitTier(fitFor(person, product)) === "positive") {
        const amount = SHELF[product].price;
        w = { ...w, money: w.money + amount };
        w = setQuality(w, `bought:${ap.person}`, w.day);
        w = setQuality(w, soldUnitsKey(w.day), qualityOf(w, soldUnitsKey(w.day)) + 1);
        w = remember(w, ap.person, "came-back-bought", 1);
        w = say(w, `${person.name}回来又带了一支${SHELF[product].name}，进账 ¥${amount}。`, [ap.person]);
      }
    }
    for (const bid of ap.bring ?? []) {
      const bp = personOf(people, bid);
      if (bp && bp.role === "customer" && !(bid in present) && customerCount < MAX_PRESENT_CUSTOMERS) {
        placeCustomer(bid, "counter"); customerCount++;
        w = say(w, `${bp.name}跟着${person.name}一起来了。`, [bid]);
      }
    }
  }

  // 开局那个上午：先到的两位站在柜台前。
  if (w.day === 1 && w.slot === 0) {
    for (const id of OPENING_GUESTS) {
      if (customerCount >= MAX_PRESENT_CUSTOMERS || id in present) continue;
      if (personOf(people, id)?.role === "customer") { placeCustomer(id, "counter"); customerCount++; }
    }
  }

  // 按 Visits 规律来的人：日子 = 一周第几天 ((day-1)%7)+1，时段要在她的 slots 里。
  const candidates: Array<{ id: PersonId; r: number }> = [];
  for (const person of people) {
    if (person.role !== "customer" || person.id in present || awayToday(w, person.id)) continue;
    const v = person.visits;
    if (v.days !== "any" && !v.days.includes(dayOfWeek)) continue;
    if (!v.slots.includes(w.slot)) continue;
    if (v.fromDay !== undefined && w.day < v.fromDay) continue;
    if (v.festivals && (!w.festival || !v.festivals.includes(w.festival))) continue;
    let r: number; [r, w] = roll(w);
    if (r < visitChance(v, w.festival)) candidates.push({ id: person.id, r });
  }
  // 超出上限时谁留下由抽数排序决定 —— 同一个种子挑出同一批人。
  candidates.sort((x, y) => x.r - y.r);
  for (const c of candidates) {
    if (customerCount >= MAX_PRESENT_CUSTOMERS) break;
    placeCustomer(c.id, drawGuestZone()); customerCount++;
  }

  // 场子不能空：按规律来的人不够 MIN_PRESENT_CUSTOMERS 时，从"这几天本来就可能来"的人里补
  // （fromDay 已到、不是只在节日才来的），按各自的来访概率加权抽，同一个种子补出同一批人。
  while (customerCount < MIN_PRESENT_CUSTOMERS) {
    const pool = people.filter(p => p.role === "customer" && !(p.id in present) && !awayToday(w, p.id)
      && (p.visits.fromDay === undefined || w.day >= p.visits.fromDay)
      && (!p.visits.festivals || (!!w.festival && p.visits.festivals.includes(w.festival)))
      && visitChance(p.visits, w.festival) > 0);
    if (!pool.length) break;
    const i = drawWeighted(w.seed, w.rngCalls, pool.map(p => visitChance(p.visits, w.festival)));
    w = { ...w, rngCalls: w.rngCalls + 1 };
    if (i < 0) break;
    placeCustomer(pool[i].id, drawGuestZone()); customerCount++;
  }

  w = { ...w, present };

  // 在场的人盖"今天来过"的章：委托判定（她来没来）与别的按天算的事都读它。
  for (const person of people)
    if (person.role === "customer" && person.id in present) w = setQuality(w, seenKey(person.id), w.day);

  // 秘密揭开：reveal 条件满足（多数是她对你够熟了）且她本人在场时，记成 quality。
  for (const person of people) {
    if (!person.secret || !(person.id in present) || qualityOf(w, `secret-known:${person.id}`)) continue;
    if (person.secret.reveal.every(c => evalCond(w, people, c, {}, person.id))) {
      w = setQuality(w, `secret-known:${person.id}`, 1);
      w = say(w, `你听说了${person.name}的事：${person.secret.text}`, [person.id]);
    }
  }

  // 开门第一件事：今天谁托你做什么（每天一次，slot 0 落定之后）。
  if (w.slot === 0) w = openDay(w, people);
  return w;
}

/** 一天四个时段走完了就这样推进一格；界面在每个时段开头调 beginSlot。 */
export const advanceSlot = (world: World): World =>
  ({ ...world, slot: ((world.slot + 1) % 4) as Slot });

// —— 在场的人自己互动 ——

/** A 把记着的一件关于玩家的事讲给 B 听。白天黑夜同一条规则，概率不同。 */
function passWord(w: World, people: Person[], a: Person, b: Person, memory: Memory): World {
  // 同一件事她已经知道（自己见过、或 A 已经讲过）就不重复记；另一个人再讲是 corroboration。
  const known = w.memories.some(m => m.holder === b.id && m.subject === memory.subject && m.act === memory.act
    && (m.heardFrom === a.id || m.heardFrom === undefined));
  if (known) return w;
  const trust = 0.2 + 0.8 * ((clamp(warmthOf(w, people, b.id, a.id), -100, 100) + 100) / 200);
  const discount = hasTemper(b, "wary") ? WARY_HEARSAY_MULT : 1;
  w = addOpinion(w, b.id, memory.valence * GOSSIP_OPINION * trust * discount);
  w = remember(w, b.id, memory.act, memory.valence, memory.subject, a.id);
  const line = memory.valence > 0 ? a.voice.praise : a.voice.complain;
  return say(w, `${a.name}对${b.name}说：「${line.replaceAll("{player}", PLAYER_NAME).replaceAll("{x}", b.name)}」`, [a.id, b.id]);
}

function gossipRound(w: World, people: Person[], pairs: Array<[Person, Person]>, base: number, bonus: number, mems: Memory[]): World {
  for (const [a, b] of pairs) {
    const own = mems.filter(m => m.holder === a.id && m.subject === PLAYER && m.valence !== 0);
    if (!own.length) continue;
    if (warmthOf(w, people, a.id, b.id) <= 0) continue;
    let r: number; [r, w] = roll(w);
    if (r >= base + (hasTemper(a, "gossip") ? bonus : 0)) continue;
    // 挑最有分量的一件讲（极端优先、新的优先），不消耗抽数，保证确定。
    const telling = own.slice().sort((x, y) => Math.abs(y.valence) - Math.abs(x.valence) || y.day - x.day)[0];
    w = passWord(w, people, a, b, telling);
  }
  return w;
}

export function ambient(world: World, people: Person[]): World {
  let w = world;
  const here = people.filter(p => p.id in w.present);
  const pairs: Array<[Person, Person]> = [];
  for (const a of here) for (const b of here) if (a.id !== b.id) pairs.push([a, b]);
  w = gossipRound(w, people, pairs, GOSSIP_BASE, GOSSIP_TEMPER_BONUS, w.memories);

  // 陆遥抢客（时段末结算）：挑一位走到我柜台上、这个时段玩家没顾上、对玩家看法最低的顾客带去维珞，她当天不再回来。
  // 只从柜台和收银两个区里挑：在中庭闲逛、在休息区坐着的人本来就不是来买东西的，
  // 把她算成"你漏掉的一单"既说不通，也会让场上客人一多比分就必然输（名额是 7 位，精力只够接四五位）。
  const rival = here.find(p => p.role === "rival");
  if (rival) {
    const marks = here.filter(p => p.role === "customer" && w.present[p.id] !== "rival"
      && POACH_ZONES.includes(w.present[p.id]) && !w.touched.includes(p.id));
    if (marks.length) {
      const mark = marks.reduce((lo, p) => (opinionOf(w, p.id) < opinionOf(w, lo.id) ? p : lo));
      if (opinionOf(w, mark.id) < POACH_MAX_OPINION) {
        let r: number; [r, w] = roll(w);
        if (r < POACH_CHANCE) {
          w = { ...w, present: { ...w.present, [mark.id]: "rival" } };
          w = addOpinion(w, mark.id, POACH_OPINION);
          w = remember(w, mark.id, "heard-rival-pitch", -1, PLAYER, rival.id);
          w = setQuality(w, `away:${mark.id}`, w.day);
          // 被截走不是"今天她没来"那么轻：对面货全、不限精力，她在那边把单开满了。
          // 比分要有得输，玩家才知道自己漏掉的是钱，不是人次。
          const sale = poachSale(mark);
          if (sale.units) w = { ...w, rivalMoney: w.rivalMoney + sale.amount, rivalWins: w.rivalWins + 1 };
          w = say(w, `你没顾上${mark.name}，${rival.name}把${ta(mark)}请去了对面维珞：${sale.word}，今天不会再回来。`, [rival.id, mark.id]);
        }
      }
    }
  }

  // 传出去的秘密回流：a 在场，听过秘密的 b 也在场，a 有概率对上号。
  for (const a of here) {
    if (!qualityOf(w, `secret-out:${a.id}`) || qualityOf(w, `secret-backfired:${a.id}`)) continue;
    const blabbed = here.find(b => b.id !== a.id && w.memories.some(m => m.holder === b.id && m.subject === a.id && m.act === "secret"));
    if (!blabbed) continue;
    let r: number; [r, w] = roll(w);
    if (r < SECRET_BLOWBACK) {
      const kept = qualityOf(w, `secret-kept:${a.id}`);
      w = addOpinion(w, a.id, kept ? SECRET_BETRAY_KEPT_OPINION : SECRET_BETRAY_OPINION);
      w = remember(w, a.id, "betrayed", -2);
      w = setQuality(w, `secret-backfired:${a.id}`, 1);
      w = say(w, `${a.name}从${blabbed.name}嘴里听到了自己的秘密，${kept ? "你答应过保密的" : `${ta(a)}知道是你说的`}。`, [a.id, blabbed.id]);
    }
  }

  // 在场的人之间自己长出来的事：闲聊、拌嘴、较劲、替你说话、背后抱怨、拉人 ——
  // 规则在 exchanges.ts。放在最后，前面几步（传话、抢客、对号）的抽数位置不动。
  return exchanges(w, people);
}

// —— 说书人 ——

export type DrawnStorylet = { storylet: Storylet; binding: Record<string, PersonId> };

// 角色槽按声明顺序回溯绑定：同一个人不进两个槽；前面的槽换人能让后面的槽成立时就换，
// 整张卡的 when 也算进搜索里。每个槽从一个由种子定下的起点轮着试，所以同种子结果逐位相同，
// 而且每张卡只消耗"槽数"次随机，不随回溯的步数增长。
function bindCast(w: World, people: Person[], storylet: Storylet): [Binding | null, World] {
  const slots = Object.entries(storylet.cast);
  const base = w.rngCalls;
  const next = { ...w, rngCalls: w.rngCalls + slots.length };
  const binding: Binding = {};
  const search = (depth: number): boolean => {
    if (depth === slots.length) return storylet.when.every(c => evalCond(w, people, c, binding));
    const [name, slot] = slots[depth];
    const pool = slot.id !== undefined ? people.filter(p => p.id === slot.id) : people;
    const bound = new Set(Object.values(binding));
    const candidates = pool.filter(p =>
      !bound.has(p.id)
      && (slot.mustBePresent === false || p.id in w.present)
      && slot.where.every(c => evalCond(w, people, c, binding, p.id)));
    if (!candidates.length) return false;
    const start = drawIndex(w.seed, base + depth, candidates.length);
    for (let k = 0; k < candidates.length; k++) {
      binding[name] = candidates[(start + k) % candidates.length].id;
      if (search(depth + 1)) return true;
    }
    delete binding[name];
    return false;
  };
  return [search(0) ? binding : null, next];
}

/** 写了剧情的卡优先：个人线和主线都比路过的社交局更该被讲。 */
export const ARC_WEIGHT_MULT = 3;
/** 续章优先：一个人已经走进自己的线（arc:<id> ≥1 且还没落到终点），
 *  钉着她 id 的下一张卡再乘这个数。管的是她人在场上、但没站到柜前的那些时段。 */
export const ARC_FOLLOW_MULT = 6;
/** 站柜前的人先开口：她的个人线第一张（线还没开头）在她站到柜台前时再抬这个数。
 *  一季只抽得出一百来张卡，谁站在柜前就该讲谁的事，不然第一章永远埋在两百张牌里。 */
export const ARC_COUNTER_MULT = 3;
/** 一天最多讲几章个人线（不管是不是如约来的）。不设这一档，说书人整晚只讲挂在柜前那几个人：实测主线本子上少一条线索
 *  （honest 2/4 → 3/4）、台账 med 少 10 点（64 → 74）、八面玲珑在结局榜上少赢三颗种子。
 *  代价是老实人的比分从 18 领先回到 16 —— 留两个时段给别的事。 */
export const ARC_CHAPTERS_PER_DAY = 2;
const SPINE_KINDS: Storylet["kind"][] = ["arc", "mainline"];

/** 这张卡是不是某条已经开过头、还没收尾的线的续章（个人线把主角钉在 cast 的 id 上）。 */
const isFollowUp = (storylet: Storylet, world: World) =>
  Object.values(storylet.cast).some(slot => {
    const id = slot.id;
    return id !== undefined && (world.qualities[`arc:${id}`] ?? 0) >= 1 && (world.qualities[`arc:${id}:end`] ?? 0) < 1;
  });

/** 这条线的主角此刻就站在柜台前，而且这条线还没开头（开了头的走 isDueChapter 那一档）。 */
const isAtCounter = (storylet: Storylet, world: World) =>
  Object.values(storylet.cast).some(slot =>
    slot.id !== undefined && world.present[slot.id] === "counter" && (world.qualities[`arc:${slot.id}`] ?? 0) < 1);

/** 这一柜该讲的那一章：她已经开了头、还没收尾，而且她这一柜就是为你回来的（站在柜台前）。 */
const isDueChapter = (storylet: Storylet, world: World) =>
  storylet.kind === "arc" && isFollowUp(storylet, world) &&
  Object.values(storylet.cast).some(slot => slot.id !== undefined && world.present[slot.id] === "counter");

/** 这条线还没开头，她人已经在楼层上：这一柜可以是那条线的第 1 张。
 *  不等她站到柜前 —— 续章才要「如约站到柜前」，那一句是她答应过的（上一章末尾的 appoint）。
 *  量过（20 种子 × 2 季 × 4 风格，只认柜前的那一版）：第 1 季九条里掉两条（沈薇 honest 19/20、
 *  梅女士 social 19/20），第 2 季尹小洁 78/80、段小姐 79/80，honest 比分从 16 领先退回 14。
 *  倒是赵宁（一天只来午后那一格）72/80 对 75/80 —— 她卡的不是这道门，别把她的账记在这条上。 */
const isOpeningChapter = (storylet: Storylet, world: World) =>
  storylet.kind === "arc" && Object.values(storylet.cast).some(slot => {
    const id = slot.id;
    return id !== undefined && world.present[id] !== undefined && (world.qualities[`arc:${id}`] ?? 0) < 1;
  });

/** 这一柜的那一章：她已经开了头、还没收尾，而且她这一柜就是为你回来的（站在柜台前）；
 *  或者这条线还没开头，她人已经在楼层上。两处让路，都量在同一套验收牌上（十二副 / 三十六副，
 *  每张抽出来的卡都落一手，判据见 tests/world-content.test.ts「梅女士的十分钟」）：
 *  1) 当天已经讲过一章以后，第二格先给还没开头的线。十二副验收牌上只给续章开门：
 *     梅女士 11/12、米朵 11/12（108 个落点只到 106）；开了开头这一档以后 108/108，三十六副 324/324。
 *  2) 等开头的先叫站在柜前那一位（atDesk 收窄）。同一套牌不收窄（整层楼都在这一档里）实测 323/324：
 *     米朵有一副整季没开张。收窄以后 324/324。她线一开头就退出这一档（isAtCounter 认 arc:<id> 未置起来），
 *     所以收窄不会把续章挤到身后。 */
const pickDue = (eligible: Array<{ storylet: Storylet; binding: Binding }>, world: World, toldToday: number) => {
  const pending = eligible.filter(e => isDueChapter(e.storylet, world));
  const opening = eligible.filter(e => isOpeningChapter(e.storylet, world));
  const atDesk = opening.filter(e => isAtCounter(e.storylet, world));
  const door = atDesk.length ? atDesk : opening;
  return door.length > 0 && (!pending.length || toldToday >= 1) ? door : pending;
};

const storyWeight = (storylet: Storylet, heat: number, world: World): number => {
  let w = Math.max(0, storylet.weight) * (SPINE_KINDS.includes(storylet.kind) ? ARC_WEIGHT_MULT : 1);
  if (storylet.kind === "arc" && isFollowUp(storylet, world)) w *= ARC_FOLLOW_MULT;
  else if (storylet.kind === "arc" && isAtCounter(storylet, world)) w *= ARC_COUNTER_MULT;
  if (storylet.tension === 1) return w * (1 + Math.max(0, -heat)) / (1 + Math.max(0, heat));
  if (storylet.tension === -1) return w * (1 + Math.max(0, heat)) / (1 + Math.max(0, -heat));
  return w;
};

/** 这一刻桌上有哪些卡可讲、各自多重；返回值连同"逐张探绑定"走完之后的 rngCalls 位置。
 *  drawStorylet 两样都要（抽那一下的索引必须接着 cursor 走，否则整副牌换个顺序）；
 *  读数表只取 eligible 并把 cursor 丢掉，所以它对外是纯读：不消耗随机流。
 *  绑定的搜索会推进 cursor.rngCalls（每张卡按槽数计），跳过的那张（once / 冷却）不算 ——
 *  这两条判据原本就写在 drawStorylet 的循环里，一起搬过来才不会改抽样。 */
export function storyDeck(
  world: World, people: Person[], storylets: Storylet[], heat: number,
): { eligible: Array<{ storylet: Storylet; binding: Binding; weight: number }>; cursor: World } {
  const eligible: Array<{ storylet: Storylet; binding: Binding; weight: number }> = [];
  let w = world;
  for (const storylet of storylets) {
    if (storylet.once && storylet.id in w.fired) continue;
    if (storylet.cooldown && storylet.id in w.fired && w.day - w.fired[storylet.id] < storylet.cooldown) continue;
    let binding: Binding | null;
    [binding, w] = bindCast(w, people, storylet);
    if (!binding) continue;
    eligible.push({ storylet, binding, weight: storyWeight(storylet, heat, w) });
  }
  return { eligible, cursor: w };
}

export function drawStorylet(world: World, people: Person[], storylets: Storylet[]): { world: World; drawn: DrawnStorylet | null } {
  // 热度先衰减，再用它调权。
  const cooled = setQuality(world, "storyteller:heat", qualityOf(world, "storyteller:heat") * STORY_HEAT_DECAY);
  const deck = storyDeck(cooled, people, storylets, qualityOf(cooled, "storyteller:heat"));
  const eligible = deck.eligible;
  let w = deck.cursor;
  // 有人如约站到柜前 —— 这一柜先从这些里挑（一天最多 ARC_CHAPTERS_PER_DAY 章，见 pickDue）。
  const toldToday = storylets.reduce((n, s) => n + (s.kind === "arc" && w.fired[s.id] === w.day ? 1 : 0), 0);
  const due = toldToday >= ARC_CHAPTERS_PER_DAY ? [] as typeof eligible : pickDue(eligible, w, toldToday);
  const i = drawWeighted(w.seed, w.rngCalls, due.length ? due.map(() => 1) : eligible.map(e => e.weight));
  w = { ...w, rngCalls: w.rngCalls + 1 };
  if (i < 0) return { world: w, drawn: null };
  const pick = (due.length ? due : eligible)[i];
  return { world: w, drawn: { storylet: pick.storylet, binding: pick.binding } };
}

export function applyChoice(world: World, people: Person[], drawn: DrawnStorylet, choiceIndex: number): World {
  const { storylet, binding } = drawn;
  const choice = storylet.choices[choiceIndex];
  if (!choice) return world;
  if (choice.when && !choice.when.every(c => evalCond(world, people, c, binding))) return world;
  let w = world;
  for (const effect of choice.effects) w = applyEffect(w, people, effect, binding);
  w = say(w, substitute(choice.result, binding, people), Object.values(binding));
  w = { ...w, fired: { ...w.fired, [storylet.id]: w.day } };
  w = setQuality(w, "storyteller:heat", clamp(qualityOf(w, "storyteller:heat") + storylet.tension, -STORY_HEAT_MAX, STORY_HEAT_MAX));
  return w;
}

/** 界面拿这个出选项文案：不满足 when 的选项不显示。 */
export const choiceVisible = (world: World, people: Person[], drawn: DrawnStorylet, choice: { when?: Cond[] }) =>
  !choice.when || choice.when.every(c => evalCond(world, people, c, drawn.binding));

// —— 玩家动作 ——

export type VerbArgs = { product?: ShelfId; units?: number; force?: boolean };

const greetCountToday = (w: World, id: PersonId) =>
  w.memories.filter(m => m.holder === id && m.act === "greeted" && m.day === w.day).length;

export function availableVerbs(world: World, people: Person[], targets: PersonId[]): Verb[] {
  const t = targets;
  const p = (i: number) => t[i] && personOf(people, t[i]);
  const ok = (verb: Verb) => world.energy >= VERB_ENERGY[verb];
  const out: Verb[] = [];
  if (!t.length) return out;
  const a = p(0), b = p(1);
  if (!a) return out;

  if (a.role === "customer" && reachable(world, a.id)) {
    if (ok("greet")) out.push("greet");
    if (ok("sample") && world.samples > 0) out.push("sample");
    if (ok("serve") && a.skin && world.compliance > SERVE_STAT_FLOOR && world.standing > SERVE_STAT_FLOOR) out.push("serve");
    if (ok("wechat") && opinionOf(world, a.id) >= WECHAT_MIN_OPINION && !qualityOf(world, `wechat:${a.id}`)) out.push("wechat");
  }
  if (a.role === "staff" && isPresent(world, a.id)) {
    if (ok("help")) out.push("help");
  }
  if (b && a.role !== "rival" && b.role !== "rival" && reachable(world, a.id)) {
    if (reachable(world, b.id)) {
      if (ok("introduce") && !related(world, people, a.id, b.id)) out.push("introduce");
      if (ok("mediate") && Math.min(warmthOf(world, people, a.id, b.id), warmthOf(world, people, b.id, a.id)) < MEDIATE_COLD_LIMIT) out.push("mediate");
      if (ok("handoff") && a.role === "staff" && b.role === "customer") out.push("handoff");
    }
    // 把话传出去：听众要在场，事主人不在场也能说 —— 本来就是在背后讲。
    if (ok("tell") && qualityOf(world, `secret-known:${b.id}`) && !qualityOf(world, `secret-out:${b.id}`)
      && related(world, people, a.id, b.id)) out.push("tell");
  }
  // 替人保密：对秘密本人说。a 本人要在场，且已经知道她的事。
  if (a.role === "customer" && reachable(world, a.id) && ok("keep")
    && qualityOf(world, `secret-known:${a.id}`) && !qualityOf(world, `secret-kept:${a.id}`)) out.push("keep");
  return out;
}

export type VerbCall = { verb: Verb; targets: PersonId[] };

/** 枚举此刻全部合法动作，给模拟器和"能做些什么"的界面列表用。 */
export function verbOptions(world: World, people: Person[]): VerbCall[] {
  const out: VerbCall[] = [];
  const here = people.filter(p => p.id in world.present);
  for (const p of here)
    for (const verb of availableVerbs(world, people, [p.id])) out.push({ verb, targets: [p.id] });
  for (const a of here) for (const b of here) {
    if (a.id === b.id) continue;
    for (const verb of availableVerbs(world, people, [a.id, b.id])) {
      // introduce/mediate 是无向的，只报 a<b 一次；handoff/tell 有向，两个方向都算。
      if ((verb === "introduce" || verb === "mediate") && a.id > b.id) continue;
      out.push({ verb, targets: [a.id, b.id] });
    }
  }
  // tell 的事主可以不在场：听众在场、秘密揭开、两人有关系就能说。
  for (const listener of here) for (const subj of people) {
    if (subj.id === listener.id || subj.id in world.present) continue;
    if (availableVerbs(world, people, [listener.id, subj.id]).includes("tell"))
      out.push({ verb: "tell", targets: [listener.id, subj.id] });
  }
  return out;
}

/** 在场、和目标有关系的人"看见了"：形成一手记忆，看法按对她的亲疏动。 */
function witnessed(w: World, people: Person[], targets: PersonId[], act: string, valence: Memory["valence"]): World {
  if (valence === 0) return w;
  for (const wit of people) {
    if (!(wit.id in w.present) || targets.includes(wit.id)) continue;
    const focus = targets.find(t => related(w, people, wit.id, t));
    if (!focus) continue;
    // 记忆本身照原样记（听不听是传话时的事）；看法按她和当事人的亲疏动。
    const warmth = Math.max(0, warmthOf(w, people, wit.id, focus));
    w = addOpinion(w, wit.id, valence * WITNESS_OPINION * (0.5 + warmth / 200));
    w = remember(w, wit.id, act, valence);
  }
  return w;
}

export function doVerb(world: World, people: Person[], verb: Verb, targets: PersonId[], args: VerbArgs = {}): World {
  if (!availableVerbs(world, people, targets).includes(verb)) return world;
  const [aId, bId] = targets;
  const a = personOf(people, aId)!;
  const b = bId ? personOf(people, bId) : undefined;
  if (verb === "serve") {
    const product = args.product ?? bestFit(a);
    return resolveServe(world, people, aId, product, args.units ?? a.skin?.maxUnits ?? 1, args.force ?? false);
  }
  let w: World = { ...world,
    energy: world.energy - VERB_ENERGY[verb],
    touched: [...new Set([...world.touched, ...targets])] };

  switch (verb) {
    case "greet": {
      const seen = greetCountToday(w, aId);
      const shy = hasTemper(a, "shy");
      if (seen === 0) {
        w = addOpinion(w, aId, GREET_FIRST);
        w = say(w, `你招呼${a.name}：${a.voice.greet.replaceAll("{player}", PLAYER_NAME)}`, [aId]);
      } else if (shy) {
        w = addOpinion(w, aId, GREET_SHY_REPEAT);
        w = remember(w, aId, "pestered", -1);
        w = say(w, `${a.name}被反复招呼，往旁边躲了躲。`, [aId]);
      } else {
        w = addOpinion(w, aId, GREET_REPEAT);
      }
      w = remember(w, aId, "greeted", 0);
      return w;
    }
    case "sample": {
      const bonus = hasTemper(a, "thrifty") ? SAMPLE_THRIFTY_OPINION : SAMPLE_OPINION;
      w = { ...w, samples: w.samples - 1 };
      w = addOpinion(w, aId, bonus);
      w = remember(w, aId, "got-sample", 1);
      w = say(w, `你塞给${a.name}一支小样${hasTemper(a, "thrifty") ? `，${ta(a)}拿得很仔细` : ""}。`, [aId]);
      return witnessed(w, people, targets, "got-sample", 1);
    }
    case "introduce": {
      const pa = opinionOf(w, aId), pb = opinionOf(w, bId!);
      if (pa >= INTRODUCE_MIN_OPINION && pb >= INTRODUCE_MIN_OPINION) {
        if (hasTemper(a, "proud") && hasTemper(b!, "proud")) {
          w = setBond(w, aId, bId!, "rival", INTRODUCE_PROUD_WARMTH);
          w = setBond(w, bId!, aId, "rival", INTRODUCE_PROUD_WARMTH);
          w = remember(w, aId, "one-upping", -1, bId!);
          w = remember(w, bId!, "one-upping", -1, aId);
          w = say(w, `你介绍${a.name}和${b!.name}认识，两句话不到就较上了劲。`, targets);
        } else {
          w = setBond(w, aId, bId!, "friend", INTRODUCE_WARMTH);
          w = setBond(w, bId!, aId, "friend", INTRODUCE_WARMTH);
          w = socialStanding(w, INTRODUCE_STANDING);
          w = remember(w, aId, "introduced", 1, bId!);
          w = remember(w, bId!, "introduced", 1, aId);
          w = say(w, `你介绍${a.name}和${b!.name}认识，两个人聊开了。`, targets);
        }
        w = addOpinion(w, aId, INTRODUCE_OPINION);
        w = addOpinion(w, bId!, INTRODUCE_OPINION);
      } else {
        w = addOpinion(w, aId, INTRODUCE_FAIL_OPINION);
        w = addOpinion(w, bId!, INTRODUCE_FAIL_OPINION);
        w = remember(w, aId, "awkward-intro", -1);
        w = remember(w, bId!, "awkward-intro", -1);
        w = say(w, `你把${a.name}和${b!.name}拉到一起，场面有点僵。`, targets);
      }
      return w;
    }
    case "mediate": {
      const chance = clamp(MEDIATE_BASE + (opinionOf(w, aId) + opinionOf(w, bId!)) / 200, MEDIATE_MIN, MEDIATE_MAX);
      let r: number; [r, w] = roll(w);
      if (r < chance) {
        w = addWarmth(w, people, aId, bId!, MEDIATE_WARMTH);
        w = addWarmth(w, people, bId!, aId, MEDIATE_WARMTH);
        w = clearQuarrel(w, aId, bId!); // 劝成了：两人头顶的火气收掉
        w = socialStanding(w, MEDIATE_STANDING);
        w = addOpinion(w, aId, MEDIATE_OK_OPINION);
        w = addOpinion(w, bId!, MEDIATE_OK_OPINION);
        w = remember(w, aId, "mediated", 2);
        w = remember(w, bId!, "mediated", 2);
        w = say(w, `你在${a.name}和${b!.name}之间打了圆场，两个人脸色都缓下来。`, targets);
      } else {
        w = addOpinion(w, aId, MEDIATE_FAIL_OPINION);
        w = addOpinion(w, bId!, MEDIATE_FAIL_OPINION);
        w = remember(w, aId, "botched-mediation", -1);
        w = remember(w, bId!, "botched-mediation", -1);
        w = say(w, `你刚开口劝，${a.name}和${b!.name}把火撒到你身上。`, targets);
      }
      return w;
    }
    case "handoff": {
      w = addOpinion(w, aId, HANDOFF_STAFF_OPINION);
      w = addOpinion(w, bId!, HANDOFF_CUSTOMER_OPINION);
      w = remember(w, bId!, "looked-after", 1);
      // 同事对你够熟、客人又有正解的货，她替你开一单：一天最多一单，保守开一件。
      const gate = `handoff-sale:${aId}:${w.day}`;
      if (b?.skin && opinionOf(w, aId) >= HANDOFF_SALE_MIN_OPINION && !qualityOf(w, gate)
        && !(qualityOf(w, `bought:${b.id}`) > 0 && w.day - qualityOf(w, `bought:${b.id}`) < BUY_INTERVAL_DAYS)) {
        const product = bestFit(b);
        if (shelfFitTier(fitFor(b, product)) === "positive") {
          const amount = SHELF[product].price;
          w = { ...w, money: w.money + amount };
          w = setQuality(w, gate, 1);
          w = setQuality(w, `bought:${b.id}`, w.day);
          w = setQuality(w, soldUnitsKey(w.day), qualityOf(w, soldUnitsKey(w.day)) + 1);
          w = say(w, `你请${a.name}照看${b.name}，${ta(a)}替你开出了一支${SHELF[product].name}，进账 ¥${amount}。`, targets);
          return w;
        }
      }
      w = say(w, `你请${a.name}先照看${b!.name}，自己腾出手来。`, targets);
      return w;
    }
    case "help": {
      const helped = w.memories.some(m => m.holder === aId && m.act === "helped-out" && m.day === w.day);
      w = addOpinion(w, aId, helped ? HELP_REPEAT_OPINION : HELP_OPINION);
      if (!helped) w = socialStanding(w, HELP_STANDING);
      w = remember(w, aId, "helped-out", 1);
      w = say(w, `你帮${a.name}把手上的活接了一截。`, [aId]);
      return w;
    }
    case "wechat": {
      w = setQuality(w, `wechat:${aId}`, 1);
      w = addOpinion(w, aId, WECHAT_OPINION);
      w = remember(w, aId, "added-wechat", 1);
      w = say(w, `${a.name}加了你微信。`, [aId]);
      return w;
    }
    case "keep": {
      w = setQuality(w, `secret-kept:${aId}`, 1);
      w = addOpinion(w, aId, KEEP_OPINION);
      w = remember(w, aId, "kept-secret", 2);
      w = say(w, `你跟${a.name}说：那件事到我为止。`, [aId]);
      return w;
    }
    case "tell": {
      // targets = [b 听众, a 事主]。听的人觉得你跟她掏心窝子，事主那边记一笔"传出去了"。
      w = addOpinion(w, aId, hasTemper(a, "gossip") ? TELL_GOSSIP_OPINION : TELL_OPINION);
      w = remember(w, aId, "secret", 0, bId!, PLAYER);
      w = setQuality(w, `secret-out:${bId!}`, 1);
      w = say(w, `你把${b!.name}的事说给了${a.name}听。`, targets);
      // 事主本人若在场，她的账走"对上了号"那条，不算围观群众。
      return witnessed(w, people.filter(p => p.id !== bId), [aId], "told-secret", 1);
    }
  }
  return w;
}

// —— 卖货 ——

export const fitFor = (person: Person, product: ShelfId) => fitOfPerson(person, product);
export const bestFit = (person: Person): ShelfId => bestShelf(person);

/** 对面那一单开多大：维珞不缺货、不限精力，按她自己的正解开单，件数仍受她的预算和用量上限约束。
 *  漏掉一位客人，账上少的就是这个数 —— 比分要算钱，不算人次。
 *  预算连一支都够不着的那几位，谁来都开不了单（units 为 0），人照样被请走。 */
export function poachSale(person: Person): { product: ShelfId; units: number; amount: number; word: string } {
  const product = bestFit(person);
  // skin 是可选的（同事/对手没有诉求表）：没有这张表就没人能被说服，对面也开不了单。
  const units = shelfUnits(person, product, shelfFitTier(fitFor(person, product)), person.skin?.maxUnits ?? 0);
  const amount = units * SHELF[product].price;
  return { product, units, amount,
    word: units ? `那边开了 ${units} 件${SHELF[product].name}，进账 ¥${amount}` : `那边一支也没卖出去` };
}

export function resolveServe(world: World, people: Person[], personId: PersonId, productId: ShelfId, units: number, force = false): World {
  const person = personOf(people, personId);
  if (!person?.skin || !reachable(world, personId) || world.energy < VERB_ENERGY.serve) return world;
  // 台账或柜位见底，开不了单。
  if (world.compliance <= SERVE_STAT_FLOOR || world.standing <= SERVE_STAT_FLOOR) return world;
  let w: World = { ...world,
    energy: world.energy - VERB_ENERGY.serve,
    touched: [...new Set([...world.touched, personId])] };
  const score = fitFor(person, productId);
  const tier = shelfFitTier(score);
  const price = SHELF[productId].price;
  w = setQuality(w, `served:${personId}`, qualityOf(w, `served:${personId}`) + 1);

  // 看法坏到这份上，她连接待都不愿意：精力照花，单开不出来。
  if (opinionOf(w, personId) <= SERVE_REFUSE_OPINION && !force) {
    w = say(w, `${person.name}理都不理你，直接走了。`, [personId]);
    return w;
  }

  const boughtDay = qualityOf(w, `bought:${personId}`);
  const recentlyBought = boughtDay > 0 && w.day - boughtDay < BUY_INTERVAL_DAYS;
  // 她前不久才买过，正常推荐她不买（硬推不管这个）。
  if (recentlyBought && !force) {
    w = say(w, `${person.name}上次带的还没用完，今天只聊了聊。`, [personId]);
    return w;
  }

  const wanted = recentlyBought ? 0 : shelfUnits(person, productId, tier, units);
  const sold = Math.min(Math.max(1, units), person.skin.maxUnits);

  if (force && sold > wanted) {
    // 硬推不看她的预算，也不看她的真实需求：当场入账。退货那天她只退多出来的那几件 —
    // 货完全不对是整单退（wanted=0）；货对但件数虚高，她留下想要的那件。
    const amount = price * sold;
    w = { ...w, money: w.money + amount,
      standing: clamp(w.standing + HARD_SELL_STANDING, 0, 100),
      compliance: clamp(w.compliance + HARD_SELL_COMPLIANCE, 0, 100) };
    w = addOpinion(w, personId, HARD_SELL_OPINION);
    w = remember(w, personId, "hard-sell", -2);
    const refundUnits = sold - wanted;
    let r: number; [r, w] = roll(w);
    if (r < RETURN_PROBABILITY) {
      let d: number; [d, w] = roll(w);
      const inDays = REFUND_MIN_DAYS + (d < 0.5 ? 1 : 0);
      let s: number; [s, w] = roll(w);
      const slots = person.visits.slots.length ? person.visits.slots : [1 as Slot];
      w = { ...w, appointments: [...w.appointments,
        { day: w.day + Math.min(inDays, REFUND_MAX_DAYS), slot: slots[Math.floor(s * slots.length)],
          person: personId, reason: "refund", amount: price * refundUnits }] };
      w = say(w, `你硬是把${person.name}的${SHELF[productId].name}开出了 ${sold} 件，进账 ¥${amount}。`, [personId]);
    } else {
      w = say(w, `你硬是把${SHELF[productId].name}塞给了${person.name}，${sold} 件 ¥${amount}，${ta(person)}认了。`, [personId]);
    }
    w = setQuality(w, `bought:${personId}`, w.day);
    w = setQuality(w, soldUnitsKey(w.day), qualityOf(w, soldUnitsKey(w.day)) + sold);
    return witnessed(w, people, [personId], "hard-sell", -2);
  }

  if (wanted <= 0) {
    if (tier !== "negative") {
      // 对症、可她兜里那点数不上 —— 这是另一件事，不能说成"这解决不了我的事"。
      // 八支货、六个价位之后这条会真的走到（¥400 的人面前摆着 ¥2,280 的正解）。
      w = addOpinion(w, personId, PRICE_MISS_OPINION);
      w = remember(w, personId, "price-miss", -1);
      w = say(w, `${SHELF[productId].name}是对症的，${person.name}看了看价签没说话：${ta(person)}今天只留了 ¥${person.skin.budget}。`, [personId]);
      return witnessed(w, people, [personId], "price-miss", -1);
    }
    w = addOpinion(w, personId, SERVE_MISS_OPINION);
    w = remember(w, personId, "wrong-pick", -1);
    w = say(w, `你推荐的是${SHELF[productId].name}，${person.name}摇头：这解决不了我的事。`, [personId]);
    return witnessed(w, people, [personId], "wrong-pick", -1);
  }
  const amount = price * wanted;
  w = { ...w, money: w.money + amount, standing: clamp(w.standing + 1, 0, 100) };
  w = setQuality(w, `bought:${personId}`, w.day);
  w = setQuality(w, soldUnitsKey(w.day), qualityOf(w, soldUnitsKey(w.day)) + wanted);
  if (tier === "positive") {
    // 八支货里"过线"和"正中"是两件事：过线的那支也成交，但只有把她每一条诉求都接满的那支，
    // 她才会觉得你懂她 —— 多给的这一笔看法决定她下次肯多说几条（serve-talk.ts 的两条门槛）。
    const perfect = score >= PERFECT_MATCH;
    w = addOpinion(w, personId, SERVE_GOOD_OPINION + (perfect ? PERFECT_MATCH_OPINION : 0));
    w = remember(w, personId, "honest-advice", 2);
    w = say(w, `${person.name}试了${SHELF[productId].name}，${perfect ? `${ta(person)}要的每条都被接住了，` : ""}带走 ${wanted} 件，进账 ¥${amount}。`, [personId]);
    return witnessed(w, people, [personId], "honest-advice", 2);
  }
  w = addOpinion(w, personId, SERVE_MIXED_OPINION);
  w = remember(w, personId, "sold-anyway", 1);
  w = say(w, `${person.name}勉强带走了 ${wanted} 件${SHELF[productId].name}，进账 ¥${amount}。`, [personId]);
  return witnessed(w, people, [personId], "sold-anyway", 1);
}

// —— 夜里：微信群传话、加过微信的人约回来、精力重置 ——

/** 柜位这一晚不回落。原来每晚收走离起点差距的一成（STANDING_DRIFT_RATE = 0.1）：
 *  涨到 85 那天起，一天的净涨幅就抵不过夜里那 −3.5（(85−50)×0.1），柜位被钉死在 85 上下 ——
 *  赢的分留不住，输掉的三分过三天又自己长回来。现在这一季之内只有做错事才掉分
 *  （硬推 / 退货 / 失约各带自己的扣数），往起点收回去是换季那一次的事（nextSeason 折一半）。
 *  去掉回落之后实测（20 种子 × 2 季，第 1 季柜位）：会玩的 honest min 72 / med 90 / max 98，
 *  硬推的 pushy med 27、八面玲珑的 social med 31 —— 没有一季钉在 100，掉下去也真掉下去了。 */
export function endDay(world: World, people: Person[]): World {
  let w = world;
  // 到期的委托在今夜结账：做到了的记人情，失约的记"说好的事没做" ——
  // 放在传话快照之前，这条坏话今晚就能被带出去。
  w = settleRequests(w, people);
  const mems = w.memories; // 今晚读的记忆快照：夜里讲出去的话不当晚再传。
  const nightPairs: Array<[Person, Person]> = [];
  for (const a of people) for (const b of people) {
    if (a.id === b.id) continue;
    if (a.id in w.present && b.id in w.present) continue; // 同场的白天已经聊过了
    if (warmthOf(w, people, a.id, b.id) > 0) nightPairs.push([a, b]);
  }
  w = gossipRound(w, people, nightPairs, NIGHT_GOSSIP_BASE, NIGHT_GOSSIP_TEMPER_BONUS, mems);

  // 加了微信的人夜里约回来，有时带上熟人。
  for (const person of people) {
    if (!qualityOf(w, `wechat:${person.id}`)) continue;
    if (w.appointments.some(ap => ap.person === person.id && ap.day > w.day)) continue;
    let r: number; [r, w] = roll(w);
    if (r >= WECHAT_RETURN_CHANCE) continue;
    let d: number; [d, w] = [drawInt(w.seed, w.rngCalls, 1, 3), { ...w, rngCalls: w.rngCalls + 1 }];
    const slots = person.visits.slots.length ? person.visits.slots : [1 as Slot];
    let si: number; [si, w] = [drawIndex(w.seed, w.rngCalls, slots.length), { ...w, rngCalls: w.rngCalls + 1 }];
    const friends = people.filter(q => q.id !== person.id && q.role === "customer"
      && Math.max(warmthOf(w, people, person.id, q.id), warmthOf(w, people, q.id, person.id)) >= WECHAT_BRING_MIN_WARMTH);
    let bring: PersonId[] | undefined;
    if (friends.length) {
      let f: number; [f, w] = roll(w);
      if (f < WECHAT_BRING_CHANCE) {
        let fi: number; [fi, w] = [drawIndex(w.seed, w.rngCalls, friends.length), { ...w, rngCalls: w.rngCalls + 1 }];
        bring = [friends[fi].id];
      }
    }
    w = { ...w, appointments: [...w.appointments,
      { day: w.day + d, slot: slots[si], person: person.id, ...(bring ? { bring } : {}), reason: "wechat" }] };
    w = say(w, `${person.name}在微信里说过几天再来${bring ? "，还带个朋友" : ""}。`, [person.id]);
  }

  // 盟友替你拉客：热心或念旧、看法够高的人，夜里可能约个熟人明天来。
  for (const person of people) {
    if (person.role !== "customer" || opinionOf(w, person.id) < REFERRAL_ALLY_OPINION) continue;
    if (!hasTemper(person, "warm") && !hasTemper(person, "loyal")) continue;
    if (w.appointments.some(ap => ap.person === person.id && ap.day > w.day)) continue;
    const friends = people.filter(q => q.id !== person.id && q.role === "customer"
      && Math.max(warmthOf(w, people, person.id, q.id), warmthOf(w, people, q.id, person.id)) >= WECHAT_BRING_MIN_WARMTH);
    if (!friends.length) continue;
    let r: number; [r, w] = roll(w);
    if (r >= REFERRAL_CHANCE) continue;
    let fi: number; [fi, w] = [drawIndex(w.seed, w.rngCalls, friends.length), { ...w, rngCalls: w.rngCalls + 1 }];
    const friend = friends[fi];
    const slots = friend.visits.slots.length ? friend.visits.slots : [1 as Slot];
    let si: number; [si, w] = [drawIndex(w.seed, w.rngCalls, slots.length), { ...w, rngCalls: w.rngCalls + 1 }];
    w = { ...w, appointments: [...w.appointments,
      { day: w.day + 1, slot: slots[si], person: friend.id, reason: "visit" }] };
    w = say(w, `${person.name}跟朋友说这层有个靠谱的人，${friend.name}明天会来。`, [person.id, friend.id]);
  }

  w = { ...w,
    // 过夜不回满：一天的劲改成四个时段各发一格（见 beginSlot），这里只把昨天没花完的清掉。
    energy: 0,
    samples: Math.min(SAMPLES_MAX, w.samples + SAMPLES_PER_NIGHT),
    day: w.day + 1, slot: 0, present: {}, touched: [] };
  return say(w, `—— 第 ${w.day} 天 ——`);
}

// —— 换季 ——

/** 跨季留下的 quality：个人线进度与落点（arc:*）、秘密这条线已经发生的事实
 * （知道/答应过/说出去了/被事主对上了 —— secret-* 那一族）、微信（wechat:*）、
 * 本子上的线索（clue:*）、已经翻过来的线（thread:*）和主线走到第几幕（mainline:*）。
 * 按天算的（away:/bought:/handoff-sale:/standing:social-day）、按季计的（served:、
 * storyteller:heat）都清零 —— 天数回到 1，那些数再留着会骗过当天的判断。
 * 线索、落点和幕号跨季不清：这一季埋下的那条，下一季才翻得过来，
 * 而主线不能每开一季就从第一幕重讲一遍。 */
const CARRIED_QUALITY = ["arc:", "wechat:", "secret-", "clue:", "thread:", "mainline:"] as const;
const carriedAcrossSeasons = (key: string) => CARRIED_QUALITY.some(p => key.startsWith(p));

/** 下一季的开局：人和关系网带过去，但旧情会淡（看法往 0 收一半）、柜位台账往起点收一半。
 *  账上的钱、手里的精力小样、还没赴的约都清零 —— 那是上一季的事。
 *  世界之外的人（名单里已经没有的 id）连同关于她的看法、关系和记忆一起放下。 */
export function nextSeason(world: World, people: Person[]): World {
  const roster = new Set(people.map(p => p.id));
  const bothKnown = (key: string) => key.split(">").every(id => roster.has(id));
  const opinion: Record<PersonId, number> = {};
  for (const [id, v] of Object.entries(world.opinion))
    if (roster.has(id)) opinion[id] = Math.trunc(v / 2);
  const bonds: Record<string, number> = {};
  for (const [key, v] of Object.entries(world.bonds)) if (bothKnown(key)) bonds[key] = v;
  const bondKinds: Record<string, BondKind> = {};
  for (const [key, kind] of Object.entries(world.bondKinds ?? {})) if (bothKnown(key)) bondKinds[key] = kind;
  const qualities: Record<string, number> = {};
  for (const [key, v] of Object.entries(world.qualities)) if (carriedAcrossSeasons(key)) qualities[key] = v;
  const season = world.season + 1;
  const standing = Math.round(START_STANDING + (world.standing - START_STANDING) / 2);
  const compliance = Math.round(START_COMPLIANCE + (world.compliance - START_COMPLIANCE) / 2);
  return {
    seed: world.seed, season, day: 1, slot: 0, money: 0, rivalMoney: 0, rivalWins: 0,
    standing, compliance,
    energy: 0, samples: START_SAMPLES,
    opinion, bonds, bondKinds,
    memories: world.memories.filter(m => roster.has(m.holder) && Math.abs(m.valence) === 2),
    qualities, present: {}, touched: [], rngCalls: world.rngCalls,
    appointments: [], requests: [], fired: {},
    log: [{ day: 1, slot: 0, text: `第 ${season} 季开始。` }],
    // 季初快照记的是新季开局那一刻：看法收过一半之后的样子。
    opinionAtSeasonStart: { ...opinion },
    statsAtSeasonStart: { standing, compliance },
  };
}

// —— 一季盘点 ——

export type SeasonSummary = {
  day: number; money: number; standing: number; compliance: number;
  allies: PersonId[]; enemies: PersonId[];
  /** 每条个人线的 quality 落点：约定 content 写 "arc:<person>:<name>"，归到人名下。 */
  arcs: Record<PersonId, Record<string, number>>;
};

export function seasonSummary(world: World, people: Person[]): SeasonSummary {
  const arcs: Record<PersonId, Record<string, number>> = {};
  for (const [key, value] of Object.entries(world.qualities)) {
    const parts = key.split(":");
    if (parts[0] !== "arc" || parts.length < 2) continue;
    const owner = parts.length >= 3 ? parts[1] : "_";
    const name = parts.length >= 3 ? parts.slice(2).join(":") : parts[1];
    (arcs[owner] ??= {})[name] = value;
  }
  return {
    day: world.day, money: world.money, standing: world.standing, compliance: world.compliance,
    allies: people.filter(p => opinionOf(world, p.id) >= 40).map(p => p.id),
    enemies: people.filter(p => opinionOf(world, p.id) <= -30).map(p => p.id),
    arcs,
  };
}

// —— 存档 ——

export const WORLD_SAVE_VERSION = 1;
export const SAVE_KEY = "last-order-world-v1";

export function serializeWorld(world: World): string {
  return JSON.stringify({ version: WORLD_SAVE_VERSION, world });
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isInt = (x: unknown): x is number => isNum(x) && Number.isInteger(x);
const isStr = (x: unknown): x is string => typeof x === "string";
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isNumRecord = (x: unknown): x is Record<string, number> => isRecord(x) && Object.values(x).every(isNum);
const isStrArray = (x: unknown): x is string[] => Array.isArray(x) && x.every(isStr);
const ZONES: Zone[] = ["counter", "rival", "atrium", "cashier", "lounge", "backroom", "entrance"];
const KINDS: BondKind[] = ["family", "friend", "partner", "colleague", "mentor", "rival", "client", "fan"];

/** 坏数据整份丢弃：字段缺一、类型不对、版本不符都返回 null，不做老档合并。 */
export function parseWorld(data: unknown): World | null {
  let raw: unknown = data;
  if (typeof data === "string") { try { raw = JSON.parse(data); } catch { return null; } }
  if (!isRecord(raw) || raw.version !== WORLD_SAVE_VERSION || !isRecord(raw.world)) return null;
  const w = raw.world;
  if (!isStr(w.seed) || !isInt(w.day) || w.day < 1) return null;
  if (w.season !== undefined && (!isInt(w.season) || w.season < 1)) return null;
  if (!isInt(w.slot) || w.slot < 0 || w.slot > 3) return null;
  for (const k of ["money", "standing", "compliance", "energy", "samples", "rngCalls"] as const)
    if (!isNum(w[k])) return null;
  if (!isInt(w.rngCalls) || w.rngCalls < 0) return null;
  if (!isNumRecord(w.opinion) || !isNumRecord(w.bonds) || !isNumRecord(w.qualities) || !isNumRecord(w.fired)) return null;
  if (w.bondKinds !== undefined && !(isRecord(w.bondKinds) && Object.values(w.bondKinds).every(v => isStr(v) && KINDS.includes(v as BondKind)))) return null;
  if (w.festival !== undefined && !isStr(w.festival)) return null;
  if (!isStrArray(w.touched)) return null;
  if (!isRecord(w.present) || !Object.values(w.present).every(v => isStr(v) && ZONES.includes(v as Zone))) return null;
  if (!Array.isArray(w.memories) || !w.memories.every((m: unknown) => isRecord(m)
    && isInt((m as Memory).day) && isStr((m as Memory).holder) && isStr((m as Memory).subject) && isStr((m as Memory).act)
    && [-2, -1, 0, 1, 2].includes((m as Memory).valence)
    && ((m as Memory).heardFrom === undefined || isStr((m as Memory).heardFrom)))) return null;
  if (!Array.isArray(w.appointments) || !w.appointments.every((a: unknown) => isRecord(a)
    && isInt((a as { day: number }).day) && isInt((a as { slot: number }).slot) && (a as { slot: number }).slot >= 0 && (a as { slot: number }).slot <= 3
    && isStr((a as { person: string }).person)
    && ((a as { bring?: string[] }).bring === undefined || isStrArray((a as { bring?: string[] }).bring))
    && ((a as { reason?: string }).reason === undefined || ["visit", "refund", "wechat"].includes((a as { reason?: string }).reason!))
    && ((a as { amount?: number }).amount === undefined || isNum((a as { amount?: number }).amount)))) return null;
  if (w.requests !== undefined && !(Array.isArray(w.requests) && w.requests.every((r: unknown) => isRecord(r)
    && isStr((r as WorldRequest).id) && ["quota", "keep", "samples", "pair", "clean", "rebook"].includes((r as WorldRequest).kind)
    && isStr((r as WorldRequest).by) && isInt((r as WorldRequest).day) && (r as WorldRequest).day >= 1
    && isInt((r as WorldRequest).due) && (r as WorldRequest).due >= (r as WorldRequest).day
    && ((r as WorldRequest).target === undefined || isStr((r as WorldRequest).target))
    && ((r as WorldRequest).n === undefined || isInt((r as WorldRequest).n))
    && ((r as WorldRequest).goal === undefined || ["introduce", "mediate"].includes((r as WorldRequest).goal!))
    && ["open", "done", "failed", "declined", "void"].includes((r as WorldRequest).state)
    && isStr((r as WorldRequest).text) && isStr((r as WorldRequest).reward)))) return null;
  if (!Array.isArray(w.log) || !w.log.every((l: unknown) => isRecord(l)
    && isInt((l as LogEntry).day) && isInt((l as LogEntry).slot) && isStr((l as LogEntry).text)
    && ((l as LogEntry).who === undefined || isStrArray((l as LogEntry).who)))) return null;
  if (w.opinionAtSeasonStart !== undefined && !isNumRecord(w.opinionAtSeasonStart)) return null;
  for (const k of ["rivalMoney", "rivalWins"] as const)
    if (w[k] !== undefined && !isNum(w[k])) return null;
  if (w.statsAtSeasonStart !== undefined && !(isRecord(w.statsAtSeasonStart)
    && isNum(w.statsAtSeasonStart.standing) && isNum(w.statsAtSeasonStart.compliance))) return null;
  const world = w as unknown as World;
  world.bondKinds ??= {};
  world.requests ??= []; // 旧存档没有委托：按今天没人提读
  world.season ??= 1; // 旧存档没有这个字段：那是第一季写的
  world.opinionAtSeasonStart ??= {}; // 旧存档没有季初快照：按空读，变化榜只认这季攒下的
  world.rivalMoney ??= 0; // 对面这本账是后来加的：老档缺字段按"那一季她还没开张"读，不为一个新字段丢整份档
  world.rivalWins ??= 0;
  return world;
}

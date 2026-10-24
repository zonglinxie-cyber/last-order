// 职业阶梯：一年一次年终评估，过了就升一级 —— 升上去以后玩法真的会变，不是多几个数字。
// 级别存在 World 的 qualities 里（"career:rank" = 1/2/3/4），跨季带着走，只升不降：
// 赢了的分留得住，和「这一季之内柜位不回落」是同一条道理 —— 升上去的本事不该一夜之间收回去。
//
// 评估在年末（新年份开季那一刻）做一次，四项考核：柜位、台账、这一年的比分、客情。
// 判据只用已有的读数，不新开状态：柜位与台账在 World 上，比分按季记，客情读看法。
//
// 第 4 级是**分支**：过线以后不是多一笔数值，而是三条路摆在你面前选一条
// （区域督导／跳去维珞／自己开店，见 branches.ts）。选了以后每年还要过一次同一张考卷 ——
// 过了这条线接着走；没过，就被换掉（被换掉与走完是两种职业终局，见 ending.ts）。
import { SEASONS_PER_YEAR, isNewYear } from "./years.ts";
import { BRANCHES, branchOf, type CareerBranch } from "./branches.ts";
import type { PersonId, World } from "./types.ts";

export const CAREER_RANKS = [1, 2, 3, 4] as const;
export type CareerRank = typeof CAREER_RANKS[number];

export const CAREER_RANK_KEY = "career:rank";
/** 这一年里赢过对面几季（一年四季，赢两季才算站住了）。 */
export const CAREER_WINS_KEY = "career:wins";
/** 做过几次年终评估（一年一次）。 */
export const CAREER_YEARS_KEY = "career:years";
/** 走了分支以后又过了几次考卷（第 2 次 = 这条线走完了一遍）。 */
export const CAREER_BRANCH_AUDITS_KEY = "career:branch-audits";
/** 这段职业生涯结束了（被换掉）：值 1。 */
export const CAREER_ENDED_KEY = "career:ended";
/** 这条线走完了一遍（可以收摊开新局，也可以接着干）：值 1。 */
export const CAREER_DONE_KEY = "career:done";
/** 被换掉那一夜，日志里说的那句。 */
export const CAREER_REPLACED_WORD = "这一层不再等你了 —— 你的名字从排班表上撤下来。";

export const RANK_NAME: Record<CareerRank, string> = {
  1: "新人 BA", 2: "正式 BA", 3: "柜长", 4: "第 4 级",
};
/** 这一级手上是怎么过的 —— 升上去以后，玩家该感觉得出差别在哪。
 *  第 4 级的名字与手感句按分支走（选了哪条线，就叫什么、怎么过），没选时是占位。 */
export const RANK_LINE: Record<CareerRank, string> = {
  1: "一个时段只够接一位客人，剩下的力气顾人。",
  2: "一个时段的劲更足：接一位客人，还能再照应一个人。",
  3: "同屏的人更多，柜台前更热闹；对面想从你手里抢人，得先过你的人。",
  4: "三条路摆在你面前 —— 选了才算数。",
};

/** 现在这一级叫什么（界面上只念它，别处不许各拼一份）。 */
export const rankNameOf = (world: Pick<World, "qualities">): string => {
  const rank = careerRankOf(world);
  if (rank < 4) return RANK_NAME[rank];
  const b = branchOf(world);
  return b ? BRANCHES[b].name : "还没选";
};
/** 现在这一级手上是怎么过的。 */
export const rankLineOf = (world: Pick<World, "qualities">): string => {
  const rank = careerRankOf(world);
  if (rank < 4) return RANK_LINE[rank];
  const b = branchOf(world);
  return b ? BRANCHES[b].line : "三条路摆在你面前 —— 选了才算数。";
};

/** 升到第几级要过哪几关。 */
export type CareerGate = {
  standing: number;
  compliance: number;
  /** 这一年要赢过对面几季 */
  wins: number;
  /** 客情：这两个同事里至少一个认你（看法到这条线） */
  trust?: { person: PersonId; min: number };
  /** 客情的实际分数线；不写就用 TRUST_MIN。 */
  trustMin?: number;
};
export const CAREER_GATE: Record<2 | 3 | 4, CareerGate> = {
  2: { standing: 55, compliance: 55, wins: 2 },
  3: { standing: 75, compliance: 70, wins: 3, trust: { person: "suman", min: 40 } },
  4: { standing: 80, compliance: 70, wins: 3, trust: { person: "suman", min: 45 }, trustMin: 45 },
};
/** 客情那一项看的是这两位里有没有一个认你（苏蔓或唐可，谁认都行）。 */
export const TRUST_PEOPLE: PersonId[] = ["suman", "tangke"];
export const TRUST_MIN = 40;

export const careerRankOf = (world: Pick<World, "qualities">): CareerRank => {
  const raw = world.qualities[CAREER_RANK_KEY] ?? 1;
  return (CAREER_RANKS.includes(raw as CareerRank) ? raw : 1) as CareerRank;
};
/** 这一年赢过几季。 */
export const careerWinsOf = (world: Pick<World, "qualities">): number =>
  world.qualities[CAREER_WINS_KEY] ?? 0;

/** 第 4 级到了、但还没选分支 —— 界面在这一屏上把三条路摆出来。 */
export const branchPending = (world: Pick<World, "qualities">): boolean =>
  careerRankOf(world) >= 4 && !branchOf(world);
/** 这段职业生涯是不是已经结束了（被换掉）。 */
export const careerEnded = (world: Pick<World, "qualities">): boolean =>
  world.qualities[CAREER_ENDED_KEY] === 1;
/** 这条线是不是已经走完了一遍（可以收摊，也可以接着干）。 */
export const careerDone = (world: Pick<World, "qualities">): boolean =>
  world.qualities[CAREER_DONE_KEY] === 1;
/** 走完的判词看过了，但玩家选择接着干 —— 那一屏不再挡路（「走完」这件事本身还记着）。 */
export const CAREER_CONTINUED_KEY = "career:continued";
export const careerContinued = (world: Pick<World, "qualities">): boolean =>
  world.qualities[CAREER_CONTINUED_KEY] === 1;
/** 看完判词接着干：只记「这一屏看过了」，不动别的账。 */
export function keepGoing<W extends Pick<World, "qualities">>(world: W): W {
  return { ...world, qualities: { ...world.qualities, [CAREER_CONTINUED_KEY]: 1 } };
}
/** 走了分支以后过了几关。 */
export const careerBranchAuditsOf = (world: Pick<World, "qualities">): number =>
  world.qualities[CAREER_BRANCH_AUDITS_KEY] ?? 0;

/* ── 长线读数用的三把尺 ──────────────────────────────────────────────
   「连玩十年最多升几级」这句话，只能从这三把尺上算出来，不能在文档和读数里
   各手写一遍 —— 上一版读数就是手抄了个「4」，把 10 季说成了 10 年，
   读数替引擎撒了谎。这三把尺都从 years.ts 的换算数出来，改一年几季、
   改评估频率，三把尺自己跟着变。 */

/** 到第 season 季为止做过几次年终评估（第 1 年是教学年，没有评估）。
 *  评估在新年份开季那一刻做（引擎里的 freshYear），所以次数只能从 isNewYear 数。 */
export const careerEvalsOf = (season: number): number => {
  let n = 0;
  for (let s = 2; s <= season; s++) if (isNewYear(s)) n++;
  return n;
};

/** 最高能到第几级 —— 职级表就那么长，到顶就停在顶。 */
export const careerCeiling = (): CareerRank => CAREER_RANKS[CAREER_RANKS.length - 1];

/** 连玩 years 年最多升几级：评估次数够不够是一头，职级表有多长是另一头，取小的。 */
export const careerMaxPromotionsIn = (years: number): number =>
  Math.min(careerEvalsOf(years * SEASONS_PER_YEAR), CAREER_RANKS.length - 1);

/** 撞顶在第几年（第 N 次评估落在第 N 个新年份开局）。还没撞顶就是 null。 */
export const careerCeilingYear = (): number | null => {
  const need = CAREER_RANKS.length - 1;
  for (let year = 1; ; year++) {
    if (careerEvalsOf(year * SEASONS_PER_YEAR) >= need) return year;
  }
};

/** 升一级以后动哪几颗旋钮。只写差量，底数在引擎那边。 */
export type CareerMods = { energy: number; guests: number; poach: number; yearResist: number };
export const careerModsOf = (world: Pick<World, "qualities">): CareerMods => {
  const rank = careerRankOf(world);
  return {
    energy: rank >= 2 ? 5 : 0,
    guests: rank >= 3 ? 1 : 0,
    poach: rank >= 3 ? 0.05 : 0,
    // 第 4 级：年景里跟你过不去的那几条，劲道减半 —— 位置稳了，商场那些风浪对你的柜子影响小了。
    yearResist: rank >= 4 ? 0.5 : 1,
  };
};

export type CareerCheck = { label: string; ok: boolean; detail: string };
export type CareerAudit = {
  rank: CareerRank;
  /** 能升到哪一级；已经是最高就是 null */
  next: CareerRank | null;
  passed: boolean;
  checks: CareerCheck[];
  /** 评估那一夜说的那句话 */
  word: string;
  /** 没过的话：差在哪儿 */
  gap: string;
  /** 明年这一关叫什么（升到哪一级 / 守住这个位置） */
  goal: string;
  /** 第 4 级：这一关没过就被换掉了 —— 这条线到此为止 */
  replaced: boolean;
  /** 第 4 级：这一关过了 —— 这条线走完了一遍 */
  done: boolean;
};

/** 年终评估：读完这一年，判能不能升一级。只读已有读数，不动状态。
 *  winsOverride：季末那一屏要把「这一季算不算赢」先算进去 —— 真正评估是在换季那一刻做的，
 *  那时这一季已经记过一笔；界面上早半拍说，才不会让人以为白赢了一季。不传就按存档里那个数。 */
export function careerAudit(world: Pick<World, "qualities" | "standing" | "compliance" | "opinion">, winsOverride?: number): CareerAudit {
  const rank = careerRankOf(world);
  // 第 4 级是顶，但顶上也照样每年考一次 —— 考的是"守住这个位置"，不是"再往上升"。
  const atTop = rank >= 4;
  const next: CareerRank | null = atTop ? null : (rank + 1) as CareerRank;
  const gate = CAREER_GATE[(next ?? 4) as 2 | 3 | 4];
  const wins = winsOverride ?? careerWinsOf(world);
  const trustMin = gate.trustMin ?? TRUST_MIN;
  const trustPerson = TRUST_PEOPLE.find(id => (world.opinion[id] ?? 0) >= trustMin);
  const checks: CareerCheck[] = [
    { label: "柜位", ok: world.standing >= gate.standing,
      detail: `${world.standing} / ${gate.standing}` },
    { label: "台账", ok: world.compliance >= gate.compliance,
      detail: `${world.compliance} / ${gate.compliance}` },
    { label: "这一年赢过对面", ok: wins >= gate.wins,
      detail: `${wins} / ${gate.wins} 季` },
  ];
  if (gate.trust) {
    checks.push({ label: "客情", ok: !!trustPerson,
      detail: trustPerson ? `${trustPerson} 认你` : `苏蔓和唐可都不认你（要 ${trustMin}）` });
  }
  const failed = checks.filter(c => !c.ok);
  const passed = failed.length === 0;
  const goal = atTop ? "守住这个位置" : `升到${RANK_NAME[next!]}`;
  let word: string;
  if (atTop) word = passed ? "这个位置你坐住了。" : "换人了。";
  else word = passed
    ? next === 2 ? "明年你带这个柜。" : next === 3 ? "这一层从明年起你说了算。" : "明年这个位置给你。"
    : "明年还是你一个人站。";
  const gap = failed.length
    ? `差在${failed.map(c => `${c.label}（${c.detail}）`).join("、")}。`
    : "";
  return { rank, next, passed, checks, word, gap, goal,
    replaced: atTop && !passed, done: atTop && passed };
}

/** 年终评估那一夜，罗曼和方敏拿出那张纸 —— 日志与界面都读这两句。 */
export const careerAuditLines = (audit: CareerAudit): string[] => {
  if (!audit.checks.length) return [audit.word];
  return [
    `年终评估：${audit.checks.map(c => `${c.label}${c.ok ? "过了" : "没过"}（${c.detail}）`).join("、")}。`,
    `${audit.word}${audit.gap}`,
  ];
};

/** 评估过了就升一级；没过也不降（第 4 级除外：那儿没过就是被换掉）。赢的比分在这一年里重新从零记。 */
export function applyCareerAudit<W extends Pick<World, "qualities" | "standing" | "compliance" | "opinion">>(world: W): W {
  const audit = careerAudit(world);
  const qualities = { ...world.qualities };
  qualities[CAREER_YEARS_KEY] = (world.qualities[CAREER_YEARS_KEY] ?? 0) + 1;
  if (audit.passed && audit.next) qualities[CAREER_RANK_KEY] = audit.next;
  if (audit.rank >= 4) {
    // 第 4 级起每年考的是"守住这个位置"：过了接着走，没过就被换掉。
    if (audit.passed) {
      const n = careerBranchAuditsOf(world) + 1;
      qualities[CAREER_BRANCH_AUDITS_KEY] = n;
      if (n >= 2) qualities[CAREER_DONE_KEY] = 1;
    } else {
      qualities[CAREER_ENDED_KEY] = 1;
    }
  }
  // 新的一年从零再记赢了几季。
  qualities[CAREER_WINS_KEY] = 0;
  return { ...world, qualities };
}

/** 记一季的胜负：这一季赢了对面就记一笔（一年要赢两季才升得上）。 */
export function markSeasonWin<W extends Pick<World, "qualities" | "money" | "rivalMoney">>(world: W): W {
  if (world.money <= world.rivalMoney) return world;
  return { ...world, qualities: { ...world.qualities,
    [CAREER_WINS_KEY]: (world.qualities[CAREER_WINS_KEY] ?? 0) + 1 } };
}

/** 眼下走的是哪条分支（没走到第 4 级就没有）。 */
export const careerBranchOf = (world: Pick<World, "qualities">): CareerBranch | null => branchOf(world);

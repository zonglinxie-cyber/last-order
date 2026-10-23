// 职业阶梯：一年一次年终评估，过了就升一级 —— 升上去以后玩法真的会变，不是多几个数字。
// 级别存在 World 的 qualities 里（"career:rank" = 1/2/3），跨季带着走，只升不降：
// 赢了的分留得住，和「这一季之内柜位不回落」是同一条道理 —— 升上去的本事不该一夜之间收回去。
//
// 评估在年末（新年份开季那一刻）做一次，四项考核：柜位、台账、这一年的比分、客情。
// 判据只用已有的读数，不新开状态：柜位与台账在 World 上，比分按季记，客情读看法。
import type { PersonId, World } from "./types.ts";

export const CAREER_RANKS = [1, 2, 3] as const;
export type CareerRank = typeof CAREER_RANKS[number];

export const CAREER_RANK_KEY = "career:rank";
/** 这一年里赢过对面几季（一年四季，赢两季才算站住了）。 */
export const CAREER_WINS_KEY = "career:wins";
/** 做过几次年终评估（一年一次）。 */
export const CAREER_YEARS_KEY = "career:years";

export const RANK_NAME: Record<CareerRank, string> = { 1: "新人 BA", 2: "正式 BA", 3: "柜长" };
/** 这一级手上是怎么过的 —— 升上去以后，玩家该感觉得出差别在哪。 */
export const RANK_LINE: Record<CareerRank, string> = {
  1: "一个时段只够接一位客人，剩下的力气顾人。",
  2: "一个时段的劲更足：接一位客人，还能再照应一个人。",
  3: "同屏的人更多，柜台前更热闹；对面想从你手里抢人，得先过你的人。",
};

/** 升到第几级要过哪几关。 */
export type CareerGate = {
  standing: number;
  compliance: number;
  /** 这一年要赢过对面几季 */
  wins: number;
  /** 客情：这两个同事里至少一个认你（看法到这条线） */
  trust?: { person: PersonId; min: number };
};
export const CAREER_GATE: Record<2 | 3, CareerGate> = {
  2: { standing: 55, compliance: 55, wins: 2 },
  3: { standing: 75, compliance: 70, wins: 3, trust: { person: "suman", min: 40 } },
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

/** 升一级以后动哪几颗旋钮。只写差量，底数在引擎那边。 */
export type CareerMods = { energy: number; guests: number; poach: number };
export const careerModsOf = (world: Pick<World, "qualities">): CareerMods => {
  const rank = careerRankOf(world);
  return { energy: rank >= 2 ? 5 : 0, guests: rank >= 3 ? 1 : 0, poach: rank >= 3 ? 0.05 : 0 };
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
};

/** 年终评估：读完这一年，判能不能升一级。只读已有读数，不动状态。
 *  winsOverride：季末那一屏要把「这一季算不算赢」先算进去 —— 真正评估是在换季那一刻做的，
 *  那时这一季已经记过一笔；界面上早半拍说，才不会让人以为白赢了一季。不传就按存档里那个数。 */
export function careerAudit(world: Pick<World, "qualities" | "standing" | "compliance" | "opinion">, winsOverride?: number): CareerAudit {
  const rank = careerRankOf(world);
  const next: CareerRank | null = rank >= 3 ? null : (rank + 1) as CareerRank;
  if (!next) {
    return { rank, next: null, passed: false, checks: [],
      word: "这一层现在你说了算。明年这面柜怎么排，你定。",
      gap: "已经到顶了 —— 往下的路不是升，是自己选。" };
  }
  const gate = CAREER_GATE[next as 2 | 3];
  const wins = winsOverride ?? careerWinsOf(world);
  const trustPerson = TRUST_PEOPLE.find(id => (world.opinion[id] ?? 0) >= TRUST_MIN);
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
      detail: trustPerson ? `${trustPerson} 认你` : "苏蔓和唐可都不认你" });
  }
  const failed = checks.filter(c => !c.ok);
  const passed = failed.length === 0;
  const word = passed
    ? next === 2 ? "明年你带这个柜。" : "这一层从明年起你说了算。"
    : "明年还是你一个人站。";
  const gap = failed.length
    ? `差在${failed.map(c => `${c.label}（${c.detail}）`).join("、")}。`
    : "";
  return { rank, next, passed, checks, word, gap };
}

/** 年终评估那一夜，罗曼和方敏拿出那张纸 —— 日志与界面都读这两句。 */
export const careerAuditLines = (audit: CareerAudit): string[] => {
  if (!audit.checks.length) return [audit.word];
  return [
    `年终评估：${audit.checks.map(c => `${c.label}${c.ok ? "过了" : "没过"}（${c.detail}）`).join("、")}。`,
    `${audit.word}${audit.gap}`,
  ];
};

/** 评估过了就升一级；没过也不降。赢的比分在这一年里重新从零记。 */
export function applyCareerAudit<W extends Pick<World, "qualities" | "standing" | "compliance" | "opinion">>(world: W): W {
  const audit = careerAudit(world);
  const qualities = { ...world.qualities };
  qualities[CAREER_YEARS_KEY] = (world.qualities[CAREER_YEARS_KEY] ?? 0) + 1;
  if (audit.passed && audit.next) qualities[CAREER_RANK_KEY] = audit.next;
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

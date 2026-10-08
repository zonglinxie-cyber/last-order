// 人情场的跨季「档案」规则层：存档键 last-order-world-progress-v1，与一季本身（SAVE_KEY）分开。
// 只增不减：这一季见过谁、对她知道到哪一步，不会因为换一季就被抹掉。全是纯函数，
// localStorage 读写只放在最下面两个浏览器侧包装里；坏数据整份丢弃，不做半份图鉴。
// 规则口径见 docs/人情场设计.md；读的是 engine 写进 World 的 quality 旗，不改引擎。
import { ENDINGS } from "./ending.ts";
import { PEOPLE } from "./content/index.ts";
import type { PersonId, World } from "./types.ts";

export const WORLD_PROGRESS_KEY = "last-order-world-progress-v1";
export const WORLD_PROGRESS_VERSION = 1;

/** 个人线主角。落点 = quality「arc:<id>:end」被 set 到的那一档（各线 1~4 个）。
 *  前四条是第 1 季，后四条从第 2 季才开。 */
export const ARC_PEOPLE: PersonId[] = ["shen", "anjie", "luyao", "suman", "tangke", "roman", "fangmin", "qiaowan"];

const PERSON_IDS = new Set<PersonId>(PEOPLE.map(p => p.id));
const ENDING_IDS = new Set<string>(ENDINGS.map(e => e.id));

export type WorldProgress = {
  version: number;
  /** 在场过的所有人（含同事、对手、商场方）：进过这张卡一次就算见过 */
  seen: PersonId[];
  /** 秘密被揭开的她（quality「secret-known:<id>」） */
  secretKnown: PersonId[];
  /** 她最好时怎么看你：跨所有存档见过的最高看法，只升不降 */
  bestOpinion: Record<PersonId, number>;
  /** 她最差时怎么看你：跨所有存档见过的最低看法，只降不升 */
  worstOpinion: Record<PersonId, number>;
  /** 每条个人线走到过的落点序号（同一季只会落一个，多季可累积多个） */
  arcEnds: Record<PersonId, number[]>;
  /** 拿到的结局 id（seasonEnding 的 id） */
  endings: string[];
};

export const emptyWorldProgress = (): WorldProgress =>
  ({ version: WORLD_PROGRESS_VERSION, seen: [], secretKnown: [], bestOpinion: {}, worstOpinion: {}, arcEnds: {}, endings: [] });

const clampOpinion = (v: number): number => Math.max(-100, Math.min(100, v));

/**
 * 把一份世界读数并进档案：只增不减。
 * seen 认 present 里的人；secretKnown 认「secret-known:<id>」旗；
 * 看法取这一份 world.opinion 里的每个值去撑大最好 / 压差最差的那一档；
 * arcEnds 认「arc:<id>:end」旗；endingId 是 seasonEnding 的 id（只在收季时传）。
 */
export function observeWorldProgress(progress: WorldProgress, world: World, endingId?: string): WorldProgress {
  const seen = new Set(progress.seen);
  for (const id of Object.keys(world.present)) if (PERSON_IDS.has(id)) seen.add(id);

  const secretKnown = new Set(progress.secretKnown);
  for (const id of PERSON_IDS) if (world.qualities[`secret-known:${id}`]) secretKnown.add(id);

  const bestOpinion = { ...progress.bestOpinion };
  const worstOpinion = { ...progress.worstOpinion };
  for (const [id, raw] of Object.entries(world.opinion) as Array<[PersonId, number]>) {
    if (!PERSON_IDS.has(id) || !Number.isFinite(raw)) continue;
    const v = clampOpinion(raw);
    bestOpinion[id] = bestOpinion[id] === undefined ? v : Math.max(bestOpinion[id], v);
    worstOpinion[id] = worstOpinion[id] === undefined ? v : Math.min(worstOpinion[id], v);
  }

  const arcEnds: Record<PersonId, number[]> = {};
  for (const id of ARC_PEOPLE) arcEnds[id] = [...(progress.arcEnds[id] ?? [])];
  for (const id of ARC_PEOPLE) {
    const landed = world.qualities[`arc:${id}:end`];
    if (Number.isInteger(landed) && (landed as number) >= 1 && !arcEnds[id].includes(landed)) arcEnds[id].push(landed as number);
  }

  const endings = endingId && ENDING_IDS.has(endingId) && !progress.endings.includes(endingId)
    ? [...progress.endings, endingId]
    : [...progress.endings];

  return {
    version: WORLD_PROGRESS_VERSION,
    seen: [...seen],
    secretKnown: [...secretKnown],
    bestOpinion,
    worstOpinion,
    arcEnds,
    endings,
  };
}

const isStr = (x: unknown): x is string => typeof x === "string";
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isIdList = (x: unknown): x is PersonId[] => Array.isArray(x) && new Set(x).size === x.length && x.every(id => PERSON_IDS.has(id as PersonId));

/** 落点序号列表：不重复、每个都是 ≥1 的整数。 */
const isLandingList = (x: unknown): x is number[] => {
  if (!Array.isArray(x)) return false;
  const nums = x as unknown[];
  return new Set(nums).size === nums.length && nums.every(v => typeof v === "number" && Number.isInteger(v) && v >= 1);
};

/** 看法表：键是已知人、值是 -100..100 的整数。最差那一档不许反超最好那一档。 */
const isOpinionTable = (x: unknown): x is Record<PersonId, number> =>
  isRecord(x) && Object.entries(x).every(([id, v]) => PERSON_IDS.has(id) && typeof v === "number" && Number.isInteger(v) && v >= -100 && v <= 100);

/** 类型不对整份丢弃（和 parseWorld 同口径）：缺一字段、id 未知、看法越界、结局不认，都返回 null。 */
export function parseWorldProgress(raw: string | null): WorldProgress | null {
  if (raw == null) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!isRecord(parsed) || parsed.version !== WORLD_PROGRESS_VERSION) return null;
  if (!isIdList(parsed.seen) || !isIdList(parsed.secretKnown)) return null;
  if (!isOpinionTable(parsed.bestOpinion) || !isOpinionTable(parsed.worstOpinion)) return null;
  if (!isRecord(parsed.arcEnds)) return null;
  for (const [id, list] of Object.entries(parsed.arcEnds)) {
    if (!ARC_PEOPLE.includes(id) || !isLandingList(list)) return null;
  }
  if (!Array.isArray(parsed.endings) || !parsed.endings.every(isStr) || new Set(parsed.endings).size !== parsed.endings.length) return null;
  if (!parsed.endings.every(id => ENDING_IDS.has(id))) return null;

  const best = parsed.bestOpinion as Record<PersonId, number>;
  const worst = parsed.worstOpinion as Record<PersonId, number>;
  for (const id of new Set([...Object.keys(best), ...Object.keys(worst)])) {
    if ((worst[id] ?? -Infinity) > (best[id] ?? Infinity)) return null;
  }

  return {
    version: WORLD_PROGRESS_VERSION,
    seen: [...parsed.seen as PersonId[]],
    secretKnown: [...parsed.secretKnown as PersonId[]],
    bestOpinion: { ...best },
    worstOpinion: { ...worst },
    arcEnds: Object.fromEntries(Object.entries(parsed.arcEnds).map(([id, list]) => [id, [...list as number[]]])),
    endings: [...parsed.endings as string[]],
  };
}

// —— 浏览器侧薄包装，规则测试不经过它们 ——

export function readWorldProgress(): WorldProgress {
  try {
    return parseWorldProgress(window.localStorage.getItem(WORLD_PROGRESS_KEY)) ?? emptyWorldProgress();
  } catch {
    return emptyWorldProgress();
  }
}

/** 每次存档调一次：读旧档、并进当前世界读数、写回。私密模式或配额满了不该把游戏弄崩。 */
export function commitWorldProgress(world: World, endingId?: string): void {
  try {
    window.localStorage.setItem(WORLD_PROGRESS_KEY, JSON.stringify(observeWorldProgress(readWorldProgress(), world, endingId)));
  } catch {
    // 存不下就什么都不做，游戏照旧能玩。
  }
}

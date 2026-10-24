import { HEAT_MAX } from "./heat.ts";
import { SEASON_DAYS, type World } from "./types.ts";

/** 同一段经历的每季对局；run 只用于区分新档，不在界面显示。 */
export type RivalSeason = { run: string; season: number; money: number; rivalMoney: number; heat: number };
export type RivalOutcome = "win" | "draw" | "loss";
export const rivalOutcome = (r: Pick<RivalSeason, "money" | "rivalMoney">): RivalOutcome =>
  r.money > r.rivalMoney ? "win" : r.money < r.rivalMoney ? "loss" : "draw";
/** 对手那一位的名字由界面传进来（跳去维珞以后是周敏）—— 战绩这一屏要跟着换名。 */
export const rivalOutcomeWord = (r: Pick<RivalSeason, "money" | "rivalMoney">, name = "陆遥") =>
  ({ win: "你赢了", loss: `${name}赢了`, draw: "打成平手" })[rivalOutcome(r)];
export const rivalYear = (season: number) => Math.floor((season - 1) / 4) + 1;

export function validRivalSeason(value: unknown): value is RivalSeason {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return typeof r.run === "string" && r.run.length > 0 && Number.isInteger(r.season) && Number(r.season) >= 1
    && typeof r.money === "number" && Number.isFinite(r.money)
    && typeof r.rivalMoney === "number" && Number.isFinite(r.rivalMoney)
    && Number.isInteger(r.heat) && Number(r.heat) >= 0 && Number(r.heat) <= HEAT_MAX;
}

/** 只认第28天真正打烊后的账。打开季末夹具、季中浏览档案都不能提前记胜。 */
export function closedRivalSeason(world: World): RivalSeason | null {
  if (world.day !== SEASON_DAYS + 1) return null;
  const r = { run: world.seed, season: world.season, money: world.money, rivalMoney: world.rivalMoney, heat: world.heat?.length ?? 0 };
  return validRivalSeason(r) ? r : null;
}

/** 同一局同一季只保留首次真实收季；刷新、反复进出档案不会累计胜场。 */
export function recordRivalSeason(records: RivalSeason[], next: RivalSeason | null): RivalSeason[] {
  if (!next || records.some(r => r.run === next.run && r.season === next.season)) return [...records];
  return [...records, { ...next }];
}

export function rivalYearResult(records: RivalSeason[], run: string, season: number, name = "陆遥") {
  const year = rivalYear(season), first = (year - 1) * 4 + 1;
  const rows = records.filter(r => r.run === run && r.season >= first && r.season < first + 4).sort((a, b) => a.season - b.season);
  const wins = rows.filter(r => rivalOutcome(r) === "win").length;
  const losses = rows.filter(r => rivalOutcome(r) === "loss").length;
  const draws = rows.length - wins - losses;
  const missing = Array.from({ length: 4 }, (_, i) => first + i).filter(n => !rows.some(r => r.season === n));
  const complete = missing.length === 0;
  // 只在前三季完整留下时说“提前锁定”；缺失旧比分不能拿来算剩余赛程。
  const playedThrough = Math.max(first - 1, ...rows.map(r => r.season));
  const contiguous = rows.length === playedThrough - first + 1;
  const remaining = first + 3 - playedThrough;
  const locked = contiguous && Math.abs(wins - losses) > remaining;
  const verdict = complete || locked ? wins > losses ? "你赢下这一年" : wins < losses ? `${name}赢下这一年` : "这一年打成平手" : null;
  return { year, rows, wins, losses, draws, missing, complete, locked, verdict };
}

/** 只跨连续季数计连胜/连败；平局与没有留下的比分都会断开。 */
export function rivalStreak(records: RivalSeason[], run: string, season: number) {
  const last = records.find(r => r.run === run && r.season === season);
  if (!last) return { outcome: null, count: 0 };
  const outcome = rivalOutcome(last);
  if (outcome === "draw") return { outcome, count: 1 };
  let count = 0;
  for (let n = season; n >= 1; n--) {
    const r = records.find(x => x.run === run && x.season === n);
    if (!r || rivalOutcome(r) !== outcome) break;
    count++;
  }
  return { outcome, count };
}

export function rivalReply(record: RivalSeason, records: RivalSeason[]) {
  const streak = rivalStreak(records, record.run, record.season), outcome = rivalOutcome(record);
  const previous = records.find(r => r.run === record.run && r.season === record.season - 1);
  if (outcome === "draw") return "「一分都没分出来。下季还在这层楼，咱们接着比。」";
  if (outcome === "win" && previous && rivalOutcome(previous) === "loss") return "「上季是我，这季轮到你。扳回来了？下季柜前见。」";
  if (outcome === "win" && streak.count > 1) return `「连着 ${streak.count} 季都让你赢了。这账我记着，下季还在对面等你。」`;
  return outcome === "win" ? "「这季算你赢。下季我还在对面，别松劲。」" : "「这季是我。别只盯着差了多少钱，想想下回先接谁。下季见。」";
}

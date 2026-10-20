// 同条件对照：1 位已记客情 + 8 位本周只照应过一天，周日同一副盘在改前/改后读到的下周动作。
// 跑法：node --experimental-strip-types tests/care-near-probe.ts
// 改前对照：在 4cc9b21 的临时 worktree 里跑同一个文件。
import { newWorld } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { CARE_TRUST_MIN, WEEK_START_MONEY, WEEK_START_RIVAL, weekCareDayKey, weekCareKey, weekCareOf, weekResultOf, nextWeekHint } from "../src/world/target.ts";
import type { World } from "../src/world/types.ts";

const base = newWorld("care-near", PEOPLE);
const customers = PEOPLE.filter(p => p.role === "customer");
const counted = customers[0]!.id;
const near = customers.slice(1, 9).map(p => p.id);
const qualities: Record<string, number> = { ...base.qualities, [WEEK_START_MONEY]: 0, [WEEK_START_RIVAL]: 0 };
const opinion: Record<string, number> = { ...base.opinion };
qualities[weekCareKey(1, counted)] = 1;
qualities[weekCareDayKey(1, counted, 6)] = 1;
qualities[weekCareDayKey(1, counted, 7)] = 1;
opinion[counted] = CARE_TRUST_MIN;
for (const id of near) { qualities[weekCareDayKey(1, id, 7)] = 1; opinion[id] = CARE_TRUST_MIN; }
const w: World = { ...base, day: 7, slot: 3, money: 1_000, rivalMoney: 9_000, qualities, opinion };
const r = weekResultOf(w);
console.log(JSON.stringify({
  countedCare: weekCareOf(w),
  oneDayPeople: near.length,
  sales: r.made, care: r.care, guard: r.guard,
  hint: nextWeekHint(w),
}, null, 2));

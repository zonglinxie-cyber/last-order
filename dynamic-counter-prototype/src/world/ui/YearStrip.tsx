// 楼层上那一行：今年是什么年景，你现在站在哪一级。
// 判据全在 years.ts 与 career.ts，这里只摆；一句话的说法也只在那两个模块里写一次。
import { RANK_LINE, RANK_NAME, careerAudit, careerRankOf, careerWinsOf } from "../career.ts";
import { YEAR_SCENES, yearOfSeason, yearScenesOf } from "../years.ts";
import type { World } from "../types.ts";

/** 页顶那一行里的职级。 */
export const careerWord = (world: Pick<World, "qualities">): string => RANK_NAME[careerRankOf(world)];

/** 今年是什么年景：一条一条念出来。第 1 年没有年景，就什么都不摆。 */
export function YearStrip({ world }: { world: World }) {
  const scenes = yearScenesOf(world);
  if (!scenes.length) return null;
  return <section className="world-year-strip" aria-label="今年是什么年景">
    <b>第 {yearOfSeason(world.season)} 年</b>
    {scenes.map(id => <span key={id}>{YEAR_SCENES[id].word}</span>)}
  </section>;
}

/** 职级那一档：现在几级、这一级手上是怎么过的（升上去以后玩家该感觉得出差别），
 *  以及明年这一关还差什么 —— 长线那一层只有一条目标清单，得让人看得见。 */
export function CareerCard({ world }: { world: World }) {
  const rank = careerRankOf(world);
  // 这一季算不算赢，先算进去：真正评估在换季那一刻做，那时这一季已经记过一笔。
  const wins = careerWinsOf(world) + (world.money > world.rivalMoney ? 1 : 0);
  const audit = careerAudit(world, wins);
  return <section className="career-card" aria-label="职级">
    <b>{RANK_NAME[rank]}</b>
    <p>{RANK_LINE[rank]}</p>
    {audit.next && <div className="career-next">
      <small>明年这一关 · 升到{RANK_NAME[audit.next]}</small>
      <p>{audit.checks.map(c => `${c.label} ${c.detail}`).join(" · ")}</p>
      <p>{audit.passed ? "四项都过了 —— 明年升一级。" : audit.gap}</p>
    </div>}
  </section>;
}

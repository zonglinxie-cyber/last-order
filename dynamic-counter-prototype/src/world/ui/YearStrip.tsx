// 楼层上那一行：今年是什么年景，你现在站在哪一级。
// 判据全在 years.ts 与 career.ts，这里只摆；一句话的说法也只在那两个模块里写一次。
import { RANK_LINE, RANK_NAME, careerAudit, careerDone, careerRankOf, careerWinsOf, rankLineOf, rankNameOf } from "../career.ts";
import { YEAR_SCENES, yearOfSeason, yearScenesOf } from "../years.ts";
import type { World } from "../types.ts";

/** 页顶那一行里的职级。第 4 级按分支换名与换手感句。 */
export const careerWord = (world: Pick<World, "qualities">): string => rankNameOf(world);

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
 *  以及明年这一关还差什么 —— 长线那一层只有一条目标清单，得让人看得见。
 *  第 4 级不再往上考，考的是"守住这个位置"：过了接着走，没过就被换掉。 */
export function CareerCard({ world }: { world: World }) {
  const rank = careerRankOf(world);
  // 这一季算不算赢，先算进去：真正评估在换季那一刻做，那时这一季已经记过一笔。
  const wins = careerWinsOf(world) + (world.money > world.rivalMoney ? 1 : 0);
  const audit = careerAudit(world, wins);
  const top = rank >= 4;
  return <section className="career-card" aria-label="职级">
    <b>{rankNameOf(world)}</b>
    <p>{rankLineOf(world)}</p>
    {(audit.next || top) && <div className="career-next">
      <small>{top ? `明年这一关 · ${audit.goal}` : `明年这一关 · 升到${RANK_NAME[audit.next!]}`}</small>
      <p>{audit.checks.map(c => `${c.label} ${c.detail}`).join(" · ")}</p>
      <p>{top
        ? (audit.passed ? "四项都过了 —— 这个位置你坐住了。" : `${audit.gap}这一关没过，你就换人了。`)
        : (audit.passed ? "四项都过了 —— 明年升一级。" : audit.gap)}</p>
    </div>}
    {careerDone(world) && <p className="career-done">这条线你已经走完一遍了 —— 收摊开新局，或者接着往下干。</p>}
  </section>;
}

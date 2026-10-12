// 每周一关的三块界面：楼层页顶那条进度、周日打烊那一屏的结算、季末那一排四关战绩。
// 判据全在 target.ts，这里只摆。
import {
  SEASON_WEEKS, WEEK_EXCEED_RATE, WEEK_HIT_STANDING, WEEK_STARS_MAX, WEEK_TARGETS,
  seasonStarsOf, starWords, weekGoalTail, weekGoalWord, weekLevelWord, weekMadeKey, weekMoneyOf, weekRivalKey,
  weekRivalOf, weekStarsKey, weekStarsOf, weekTargetOf,
} from "../target.ts";
import { WEEK_RULES, weekRuleOf } from "../weeks.ts";
import type { World } from "../types.ts";

const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
const starRow = (n: number) => "★".repeat(n) + "☆".repeat(WEEK_STARS_MAX - n);

/** 楼层页顶下面那一条：第几关、钱到哪了、离过关还差多少、对面这周多少。 */
export function GoalStrip({ world, lit }: { world: World; lit: boolean }) {
  const made = weekMoneyOf(world), rival = weekRivalOf(world), target = weekTargetOf(world.day);
  const top = Math.ceil(target * WEEK_EXCEED_RATE);
  const live = weekStarsOf(made, rival, target);
  const pct = Math.min(100, (made / top) * 100);
  const mark = (target / top) * 100;
  return <div className={`world-goal${live.hit ? " is-passed" : ""}${lit ? " is-hit" : ""}`} role="group" aria-label="本周目标">
    <div className="wg-row">
      <b>{weekLevelWord(world)}</b>
      <span className={`wg-tail${rival > made ? " is-trail" : made > 0 ? " is-lead" : ""}`}>{weekGoalTail(world)}</span>
    </div>
    <div className="wg-track" aria-hidden="true">
      <i style={{ width: `${pct}%` }} />
      <s style={{ left: `${mark}%` }} />
    </div>
    <div className="wg-row wg-foot">
      <span className="wg-money">{weekGoalWord(world)}</span>
      <span className="wg-stars" aria-label={`眼下 ${live.stars} 颗星`}>{live.hit ? starRow(live.stars) : `还差 ${yuan(target - made)} 过关`}</span>
    </div>
  </div>;
}

/** 周日打烊那一屏顶上的结算：过没过、几颗星、三颗星各自怎么来的、跟对面比、下一关要多少。 */
export function LevelResult({ world, day }: { world: World; day: number }) {
  const n = Math.min(SEASON_WEEKS, Math.floor((day - 1) / 7) + 1);
  const made = world.qualities[weekMadeKey(n)] ?? 0;
  const rival = world.qualities[weekRivalKey(n)] ?? 0;
  const target = WEEK_TARGETS[n - 1];
  const s = weekStarsOf(made, rival, target);
  const stars = world.qualities[weekStarsKey(n)] ?? s.stars;
  const rule = WEEK_RULES.find(r => r.id === weekRuleOf(world.season, day));
  const words = starWords(target);
  const max = Math.max(made, rival, 1);
  return <section className={`report-level ${s.hit ? "pass" : "fail"}`} aria-label={`第 ${n} 关结算`}>
    <p className="rl-eyebrow">第 {n} 关{rule ? ` · ${rule.word}` : ""}</p>
    <h1 className="rl-stamp">{s.hit ? "过关" : "没过"}</h1>
    <p className="rl-stars" aria-label={`${stars} 颗星`}>{starRow(stars)}</p>
    <ul className="rl-checks">
      <li className={s.hit ? "ok" : ""}>{s.hit ? "✓" : "✗"} {words[0]}</li>
      <li className={s.hit && s.beatRival ? "ok" : ""}>{s.beatRival ? "✓" : "✗"} {words[1]}</li>
      <li className={s.hit && s.exceeded ? "ok" : ""}>{s.exceeded ? "✓" : "✗"} {words[2]}</li>
    </ul>
    <div className="rl-versus">
      <p><span>你</span><i style={{ width: `${(made / max) * 100}%` }} /><b>{yuan(made)}</b></p>
      <p className="rival"><span>对面</span><i style={{ width: `${(rival / max) * 100}%` }} /><b>{yuan(rival)}</b></p>
    </div>
    <p className="rl-note">{s.hit ? `柜位 +${WEEK_HIT_STANDING} · 罗曼记了你一笔` : "罗曼记着这一周"}{n < SEASON_WEEKS ? ` · 下一关要 ${yuan(WEEK_TARGETS[n])}` : " · 这是这一季最后一关"}</p>
  </section>;
}

/** 季末那一排：四关各几颗星、一季加起来多少、是不是新纪录。 */
export function SeasonLevels({ world, prevBest }: { world: World; prevBest: number | null }) {
  const stars = seasonStarsOf(world);
  const total = stars.reduce((a, b) => a + b, 0);
  const passed = stars.filter(x => x > 0).length;
  const record = prevBest !== null && total > prevBest;
  return <section className="recap-block recap-levels" aria-label="四关战绩">
    <h2>四关战绩</h2>
    <ol className="rl-season">
      {Array.from({ length: SEASON_WEEKS }, (_, i) => {
        const v = world.qualities[weekStarsKey(i + 1)];
        return <li key={i} className={v ? "pass" : "fail"}>
          <small>第 {i + 1} 关</small><b>{v === undefined ? "—" : starRow(v)}</b>
          <em>{yuan(world.qualities[weekMadeKey(i + 1)] ?? 0)}</em>
        </li>;
      })}
    </ol>
    <p className="rl-total">过了 {passed} / {SEASON_WEEKS} 关 · 一共 {total} / {SEASON_WEEKS * WEEK_STARS_MAX} 颗星
      {record ? <strong className="rl-record">新纪录</strong> : prevBest ? <small>（最好的一季 {Math.max(prevBest, total)} 颗）</small> : null}</p>
  </section>;
}

import { closedRivalSeason, recordRivalSeason, rivalOutcomeWord, rivalReply, rivalStreak, rivalYear, rivalYearResult, type RivalSeason } from "../rival-history.ts";
import { rivalNameOf } from "../branches.ts";
import type { World } from "../types.ts";
import "./rival-history.css";

const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
function YearStanding({ records, run, season, name }: { records: RivalSeason[]; run: string; season: number; name?: string }) {
  const year = rivalYearResult(records, run, season, name);
  const absent = year.missing.filter(n => n < season);
  return <div className="rival-year-standing">
    <h3>第 {year.year} 年 · 四季交锋</h3>
    <p>已留下 {year.rows.length} / 4 季战绩 · {year.wins} 胜 {year.draws} 平 {year.losses} 负</p>
    {year.verdict ? <p className="rival-year-verdict">{year.complete ? year.verdict : `提前锁定：${year.verdict}`}</p>
      : <p>四季比赢下的季数，打成平手各记一平。</p>}
    {absent.length > 0 && <p className="rival-history-gap">第 {absent.join("、")} 季的比分没有留下，年度胜负仍待完整记录。</p>}
  </div>;
}

export function RivalSeasonRecap({ world, records, onHistory }: { world: World; records: RivalSeason[]; onHistory: () => void }) {
  const closing = closedRivalSeason(world);
  if (!closing) return null;
  const current = records.find(r => r.run === closing.run && r.season === closing.season) ?? closing;
  const replay = current.money !== closing.money || current.rivalMoney !== closing.rivalMoney || current.heat !== closing.heat;
  const all = recordRivalSeason(records, current), streak = rivalStreak(all, current.run, current.season);
  const name = rivalNameOf(world);
  return <section className="recap-block rival-season-recap" aria-label={`这一季与${name}的交锋`}>
    <h2>{replay ? "这季首次交锋，" : "这一次，"}{rivalOutcomeWord(current)}</h2>
    {replay && <p>本季交锋已经收录，年赛沿用首次结果；本次重玩不重复记胜。本次收入见当季账目。</p>}
    <p>你 {yuan(current.money)} · {name} {yuan(current.rivalMoney)}</p>
    {streak.count > 1 && <p>{streak.outcome === "win" ? `你已连赢 ${streak.count} 季` : `${name}已连赢 ${streak.count} 季`}</p>}
    <blockquote><b>{replay ? `${name}当时收起账本` : `${name}收起账本`}</b><p>{rivalReply(current, all)}</p></blockquote>
    <YearStanding records={all} run={current.run} season={current.season} name={name} />
    <button type="button" className="world-archive-entry" onClick={onHistory}>翻看交锋战绩</button>
  </section>;
}

export function RivalHistoryList({ records, currentRun, name = "陆遥" }: { records: RivalSeason[]; currentRun?: string; name?: string }) {
  const runs = [...new Set(records.map(r => r.run))];
  if (!runs.length) return <section className="rival-history-empty">
    <h2>你和{name}的四季交锋</h2>
    <p>完整打完一季，双方比分就会留在这里。</p>
    <p>每四季比一次赢下的季数，看这一年谁赢得更多。</p>
  </section>;
  return <section className="rival-history-list" aria-label="交锋战绩">{[...runs].reverse().map(run => {
    const rows = records.filter(r => r.run === run).sort((a, b) => a.season - b.season);
    const years = [...new Set(rows.map(r => rivalYear(r.season)))].reverse();
    return <article className="rival-history-run" key={run}>
      <h2>{run === currentRun ? "这段经历" : `第 ${runs.indexOf(run) + 1} 段经历`}</h2>
      {years.map(year => {
        const yearly = rows.filter(r => rivalYear(r.season) === year);
        return <section className="rival-history-year" key={year}>
          <YearStanding records={records} run={run} season={yearly.at(-1)!.season} name={name} />
          <ol>{[...yearly].reverse().map(r => <li key={r.season}>
            <div><b>第 {r.season} 季 · {rivalOutcomeWord(r, name)}</b><small>{r.heat ? `${r.heat} 条规矩` : "标准难度"}</small></div>
            <p>你 {yuan(r.money)} · {name} {yuan(r.rivalMoney)}</p>
          </li>)}</ol>
        </section>;
      })}
    </article>;
  })}</section>;
}

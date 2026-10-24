// 人情场跨季「档案」：见过谁、对她知道到哪一步、几条线走到哪里、拿到过哪种散场。
// 只读 progress 与内容，不做任何判断；配色与 archive.css / web.css 同源。
import { ta } from "../pronoun.ts";
import { useMemo, useState } from "react";
import { MobileScroll } from "../../mobile";
import { ENDINGS, rank } from "../ending.ts";
import { endingHint } from "../ending-hints.ts";
import { heatStampWord } from "../heat.ts";
import { ARC_PEOPLE, arcLandings, emptyWorldProgress, parseWorldProgress, readWorldProgress, threadLandings, WORLD_PROGRESS_KEY, type WorldProgress } from "../progress.ts";
import { CAREER_RANKS, RANK_LINE, RANK_NAME } from "../career.ts";
import { BRANCHES, BRANCH_IDS, isBranchId } from "../branches.ts";
import { YEAR_SCENES, YEAR_IDS } from "../years.ts";
import { CLUES, CLUE_THREADS, PEOPLE, STORYLETS } from "../content/index.ts";
import type { PersonId } from "../types.ts";
import { opinionWord } from "./words.ts";
import "./archive-base.css";
import "./world-archive.css";
import { RivalHistoryList } from "./RivalHistory.tsx";

type Tab = "people" | "arcs" | "book" | "endings" | "rival" | "career";

const nameOf = (id: PersonId): string => PEOPLE.find(p => p.id === id)?.name ?? id;

/** 读存档：优先 parse 出的档，坏档退回空档（和界面自己兜空一致）。 */
function loadProgress(): WorldProgress {
  try {
    return parseWorldProgress(window.localStorage.getItem(WORLD_PROGRESS_KEY)) ?? readWorldProgress();
  } catch {
    return emptyWorldProgress();
  }
}

export function WorldArchive({ onBack, initialTab = "people", currentRun, rivalName }: { onBack: () => void; initialTab?: Tab; currentRun?: string; rivalName?: string }) {
  const progress = useMemo(loadProgress, []);
  const bestRank = Math.min(CAREER_RANKS.length, Math.max(1, progress.bestCareerRank ?? 1));
  const bestBranch = progress.bestCareerBranch && isBranchId(progress.bestCareerBranch)
    ? progress.bestCareerBranch : null;
  // 第 4 级的名字与手感句按分支走 —— 到过哪条线，档案里就写哪条线。
  const rankName = (rank: number): string =>
    rank >= 4 ? (bestBranch ? BRANCHES[bestBranch].name : "第 4 级") : RANK_NAME[rank as 1 | 2 | 3];
  const rankLine = (rank: number): string =>
    rank >= 4 ? (bestBranch ? BRANCHES[bestBranch].line : RANK_LINE[4]) : RANK_LINE[rank as 1 | 2 | 3];
  const bestRankName = bestRank >= 4 && bestBranch ? BRANCHES[bestBranch].name : RANK_NAME[bestRank as 1 | 2 | 3];
  const [tab, setTab] = useState<Tab>(initialTab);
  const metCount = progress.seen.length;
  const landedCount = ARC_PEOPLE.reduce((n, id) => n + (progress.arcEnds[id]?.length ?? 0), 0);
  const achievedCount = progress.endings.length;

  const sortedEndings = useMemo(() => [...ENDINGS].sort((a, b) => rank(a.id) - rank(b.id)), []);

  return <div className="app-screen archive-page world-archive-page">
    <header className="archive-head">
      <button className="archive-back" type="button" aria-label="返回" onClick={onBack}>‹</button>
      <div>
        <b>档案</b>
        <small>{tab === "people" ? `这层楼上见过 ${metCount} / ${PEOPLE.length} 位`
          : tab === "arcs" ? `几条线落过 ${landedCount} 处`
          : tab === "book" ? `本子上攒了 ${progress.clues.length} / ${CLUES.length} 条`
          : tab === "rival" ? `留下 ${progress.rivalSeasons.length} 季交锋`
          : tab === "career" ? `到过 ${RANK_NAME[(progress.bestCareerRank ?? 1) as 1 | 2 | 3]}`
          : `散过场 ${achievedCount} / ${ENDINGS.length} 种`}</small>
      </div>
    </header>
    <div className="archive-tabs" role="group" aria-label="档案分页">
      <button type="button" className={tab === "people" ? "active" : ""} onClick={() => setTab("people")}>人物</button>
      <button type="button" className={tab === "arcs" ? "active" : ""} onClick={() => setTab("arcs")}>个人线</button>
      <button type="button" className={tab === "book" ? "active" : ""} onClick={() => setTab("book")}>本子</button>
      <button type="button" className={tab === "endings" ? "active" : ""} onClick={() => setTab("endings")}>结局</button>
      <button type="button" className={tab === "rival" ? "active" : ""} onClick={() => setTab("rival")}>对手</button>
      <button type="button" className={tab === "career" ? "active" : ""} onClick={() => setTab("career")}>职级</button>
    </div>

    <MobileScroll className="archive-scroll world-archive-scroll">
      {tab === "rival" && <RivalHistoryList records={progress.rivalSeasons} currentRun={currentRun} name={rivalName} />}
      {tab === "people" && <section className="archive-list">{PEOPLE.map(person => {
        const seen = progress.seen.includes(person.id);
        return <article className={"archive-card" + (seen ? "" : " unmet")} key={person.id}>
          <span className="archive-portrait">
            {person.portrait
              ? <img src={person.portrait} alt={seen ? `${person.name}立绘` : ""} aria-hidden={seen ? undefined : true} />
              : <b className="wa-letter" aria-hidden="true">{person.name.slice(0, 1)}</b>}
          </span>
          <div className="archive-body">
            <b className="archive-name">{person.name}</b>
            {seen ? <>
              <p className="archive-descriptor">{person.descriptor}</p>
              <div className="wa-lines">
                <p className="wa-line wa-secret">
                  <small>秘密</small>
                  {progress.secretKnown.includes(person.id)
                    ? <span>{person.secret?.text ?? `${ta(person)}这一层没有藏着的事。`}</span>
                    : <span className="wa-locked">还没在{ta(person)}跟前揭开过。</span>}
                </p>
                <p className="wa-line"><small>{ta(person)}最好的时候</small><span>{opinionWord(progress.bestOpinion[person.id])}</span></p>
                <p className="wa-line"><small>{ta(person)}最差的时候</small><span>{opinionWord(progress.worstOpinion[person.id])}</span></p>
              </div>
            </> : <p className="archive-unmet">还没在这层楼上碰到过。</p>}
          </div>
        </article>;
      })}</section>}

      {tab === "arcs" && <section className="wa-arcs">{ARC_PEOPLE.map(id => {
        const landings = arcLandings(STORYLETS, id);
        const reached = progress.arcEnds[id] ?? [];
        return <article className="wa-arc" key={id}>
          <h3>{nameOf(id)}</h3>
          <div className="wa-arc-rows">{landings.map(l => {
            const lit = reached.includes(l.landing);
            return <p key={l.landing} className={"wa-arc-row" + (lit ? " lit" : "")}>
              <span className="wa-arc-dot" aria-hidden="true" />
              <b>{lit ? l.title : "？？？"}</b>
              {!lit && <small>这一支还没走到过。</small>}
            </p>;
          })}</div>
        </article>;
      })}</section>}

      {tab === "book" && <section className="wa-arcs">{CLUE_THREADS.map(thread => {
        const clues = CLUES.filter(c => c.thread === thread.id);
        const reached = progress.threadEnds[thread.id] ?? [];
        const landings = threadLandings(STORYLETS, thread.id);
        const heldCount = clues.filter(c => progress.clues.includes(c.id)).length;
        return <article className="wa-arc" key={thread.id}>
          <h3>{thread.name}</h3>
          <p className="wa-line wa-secret">
            <small>{heldCount === clues.length ? "弄清了" : "还没弄清"}</small>
            <span>{thread.question}</span>
          </p>
          <div className="wa-arc-rows">{clues.map(c => {
            const lit = progress.clues.includes(c.id);
            return <p key={c.id} className={"wa-arc-row" + (lit ? " lit" : "")}>
              <span className="wa-arc-dot" aria-hidden="true" />
              <b>{lit ? c.text : "？？？"}</b>
              {!lit && <small>这一条没攒到过。</small>}
            </p>;
          })}</div>
          <div className="wa-arc-rows">{landings.map(l => {
            const lit = reached.includes(l.landing);
            return <p key={l.landing} className={"wa-arc-row" + (lit ? " lit" : "")}>
              <span className="wa-arc-dot" aria-hidden="true" />
              <b>{lit ? l.title : "？？？"}</b>
              {!lit && <small>这一种收法还没落到过。</small>}
            </p>;
          })}</div>
        </article>;
      })}</section>}

      {tab === "career" && <section className="wa-arcs">
        <p className="wa-line wa-secret">
          <small>到过的最高一级</small>
          <span>{bestRankName}</span>
        </p>
        <p className="wa-line wa-secret">
          <small>怎么升</small>
          <span>一年一次年终评估：柜位、台账、这一年赢过对面几季、客情四项都过线才升一级。只升不降。到第 4 级以后不再往上升 —— 考的是"守住这个位置"，过了接着走，没过就被换掉。</span>
        </p>
        {CAREER_RANKS.map(rank => {
          const reached = bestRank >= rank;
          return <article className="wa-arc" key={rank}>
            <h3>{reached ? rankName(rank) : "？？？"}</h3>
            <p className="wa-line wa-secret"><small>{reached ? "升上去以后" : "还没站到这一级"}</small>
              <span>{reached ? rankLine(rank) : "这一级的做法，你还没摸过。"}</span></p>
          </article>;
        })}
        {bestRank >= 4 && <article className="wa-arc">
          <h3>第 4 级 · 三条路</h3>
          <p className="wa-line wa-secret"><small>选一条，往后的日子按那本账过</small>
            <span>{BRANCH_IDS.map(id => BRANCHES[id].name).join(" / ")}</span></p>
          {BRANCH_IDS.map(id => <p className="wa-line" key={id}><small>{BRANCHES[id].name}</small>
            <span>{BRANCHES[id].line}</span></p>)}
        </article>}
        <article className="wa-arc">
          <h3>年景</h3>
          <p className="wa-line wa-secret"><small>第 1 年之后，一年一换</small>
            <span>同一批人，换个场子：</span></p>
          {YEAR_IDS.map(id => <p className="wa-line" key={id}><small>{YEAR_SCENES[id].knob}</small>
            <span>{YEAR_SCENES[id].word}</span></p>)}
        </article>
      </section>}

      {tab === "endings" && <section className="archive-endings">{sortedEndings.map(ending => {
        const achieved = progress.endings.includes(ending.id);
        const stamp = heatStampWord(progress.endingsAtHeat[ending.id] ?? 0);
        return <article className={"ending-row" + (achieved ? " achieved" : " locked")} key={ending.id}>
          <b>{achieved ? ending.title : "？？？"}{achieved && stamp ? <small className="ending-heat">{stamp}</small> : null}</b>
          <p>{achieved ? ending.body : endingHint(ending.id)}</p>
        </article>;
      })}</section>}
    </MobileScroll>
  </div>;
}

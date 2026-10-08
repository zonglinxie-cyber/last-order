// 人情场跨季「档案」：见过谁、对她知道到哪一步、几条线走到哪里、拿到过哪种散场。
// 只读 progress 与内容，不做任何判断；配色与 archive.css / web.css 同源。
import { ta } from "../pronoun.ts";
import { useMemo, useState } from "react";
import { MobileScroll } from "../../mobile";
import { ENDINGS, rank } from "../ending.ts";
import { endingHint } from "../ending-hints.ts";
import { ARC_PEOPLE, arcLandings, emptyWorldProgress, parseWorldProgress, readWorldProgress, WORLD_PROGRESS_KEY, type WorldProgress } from "../progress.ts";
import { PEOPLE, STORYLETS } from "../content/index.ts";
import type { PersonId } from "../types.ts";
import { opinionWord } from "./words.ts";
import "../../archive.css";
import "./world-archive.css";

type Tab = "people" | "arcs" | "endings";

const nameOf = (id: PersonId): string => PEOPLE.find(p => p.id === id)?.name ?? id;

/** 读存档：优先 parse 出的档，坏档退回空档（和界面自己兜空一致）。 */
function loadProgress(): WorldProgress {
  try {
    return parseWorldProgress(window.localStorage.getItem(WORLD_PROGRESS_KEY)) ?? readWorldProgress();
  } catch {
    return emptyWorldProgress();
  }
}

export function WorldArchive({ onBack }: { onBack: () => void }) {
  const progress = useMemo(loadProgress, []);
  const [tab, setTab] = useState<Tab>("people");
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
          : `散过场 ${achievedCount} / ${ENDINGS.length} 种`}</small>
      </div>
    </header>
    <div className="archive-tabs" role="group" aria-label="档案分页">
      <button type="button" className={tab === "people" ? "active" : ""} onClick={() => setTab("people")}>人物</button>
      <button type="button" className={tab === "arcs" ? "active" : ""} onClick={() => setTab("arcs")}>个人线</button>
      <button type="button" className={tab === "endings" ? "active" : ""} onClick={() => setTab("endings")}>结局</button>
    </div>

    <MobileScroll className="archive-scroll world-archive-scroll">
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

      {tab === "endings" && <section className="archive-endings">{sortedEndings.map(ending => {
        const achieved = progress.endings.includes(ending.id);
        return <article className={"ending-row" + (achieved ? " achieved" : " locked")} key={ending.id}>
          <b>{achieved ? ending.title : "？？？"}</b>
          <p>{achieved ? ending.body : endingHint(ending.id)}</p>
        </article>;
      })}</section>}
    </MobileScroll>
  </div>;
}

import { useMemo, useState } from "react";
import { MobileScroll } from "./mobile";
import { archiveEntries, endingEntries, readStoredProgress } from "./progress.ts";
import "./archive.css";

type Tab = "customers" | "endings";

export function Archive({ onBack }: { onBack: () => void }) {
  const progress = useMemo(() => readStoredProgress(), []);
  const entries = useMemo(() => archiveEntries(progress), [progress]);
  const endings = useMemo(() => endingEntries(progress), [progress]);
  const [tab, setTab] = useState<Tab>("customers");
  const metCount = entries.filter(entry => entry.met).length;
  const achievedCount = endings.filter(ending => ending.achieved).length;

  return <div className="app-screen archive-page">
    <header className="archive-head">
      <button className="archive-back" type="button" aria-label="返回" onClick={onBack}>‹</button>
      <div>
        <b>档案</b>
        <small>{tab === "customers" ? `柜台前见过 ${metCount} / ${entries.length} 位` : `收过摊 ${achievedCount} / ${endings.length} 种`}</small>
      </div>
    </header>
    <div className="archive-tabs" role="group" aria-label="档案分页">
      <button type="button" className={tab === "customers" ? "active" : ""} onClick={() => setTab("customers")}>顾客图鉴</button>
      <button type="button" className={tab === "endings" ? "active" : ""} onClick={() => setTab("endings")}>结局图鉴</button>
    </div>
    <MobileScroll className="archive-scroll">
      {tab === "customers" ? <section className="archive-list">{entries.map(entry => entry.met
        ? <article className="archive-card" key={entry.key}>
            <span className="archive-portrait"><img src={entry.portrait} alt={`${entry.name}面部近景`} /></span>
            <div className="archive-body">
              <b className="archive-name">{entry.name}</b>
              {entry.visits.map(visit => <div className="archive-visit" key={visit.id}>
                <small>{visit.visitWord}</small>
                <p className="archive-descriptor">{visit.descriptor}</p>
                <p className="archive-opening">「{visit.opening}」</p>
                {visit.outcomeWords.map(word => <p className="archive-outcome" key={word}>{word}</p>)}
                {visit.need
                  ? <p className="archive-need">她真正要的：{visit.need}</p>
                  : <p className="archive-need locked">她真正要的那一句，还没在你柜台前说出口。</p>}
              </div>)}
            </div>
          </article>
        : <article className="archive-card unmet" key={entry.key}>
            <span className="archive-portrait"><img src={entry.portrait} alt="" aria-hidden="true" /></span>
            <div className="archive-body">
              <b className="archive-name">{entry.name}</b>
              <p className="archive-unmet">还没来过柜台</p>
            </div>
          </article>)}
      </section> : <section className="archive-endings">{endings.map(ending => <article className={"ending-row" + (ending.achieved ? " achieved" : " locked")} key={ending.title}>
        <b>{ending.achieved ? ending.title : "？？？"}</b>
        <p>{ending.hint}</p>
      </article>)}</section>}
    </MobileScroll>
  </div>;
}

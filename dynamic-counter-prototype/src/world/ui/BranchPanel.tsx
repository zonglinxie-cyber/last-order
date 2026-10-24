// 第 4 级那三块界面：三条路挑一条、职业终局、今天在哪个柜。
// 说法与判据都在 branches.ts / district.ts / career.ts 里，这里只摆。
import { BRANCHES, BRANCH_IDS, type CareerBranch } from "../branches.ts";
import { DISTRICT_SPEC, DISTRICT_ZONES, districtChosenToday, districtZoneOf, type DistrictZone } from "../district.ts";
import type { World } from "../types.ts";

/** 三选一：拿到第 4 级那一夜，路摆在你面前。选完就定死 —— 往后的日子按那本账过。 */
export function BranchChoice({ world, onPick }: { world: World; onPick: (id: CareerBranch) => void }) {
  return <div className="app-screen world-app world-branch-screen">
    <section className="world-branch-card" aria-label="三条路">
      <p className="world-branch-eyebrow">年终评估 · 过了</p>
      <h1>三条路</h1>
      <p className="world-branch-copy">明年这个位置给你。三条路摆在你面前 —— 选了，往后的日子按那本账过。</p>
      <div className="world-branch-options">
        {BRANCH_IDS.map(id => <button key={id} type="button" className="world-branch-option"
          onClick={() => onPick(id)} aria-label={`${BRANCHES[id].name}：${BRANCHES[id].line}`}>
          <b>{BRANCHES[id].name}</b>
          <span>{BRANCHES[id].line}</span>
          <small>{BRANCHES[id].effect}</small>
        </button>)}
      </div>
      <p className="world-branch-note">选之前，这一年的账已经算完了；选完，这一条就不能回头。</p>
    </section>
  </div>;
}

/** 职业终局：这段职业生涯怎么收场。 */
export function CareerEndPanel({ title, body, onRestart, canKeepGoing, onKeepGoing }
  : { title: string; body: string; onRestart: () => void; canKeepGoing?: boolean; onKeepGoing?: () => void }) {
  return <div className="app-screen world-app world-career-screen">
    <section className="world-career-card" aria-label="职业终局">
      <p className="world-career-eyebrow">职业终局</p>
      <h1>{title}</h1>
      <p className="world-career-body">{body}</p>
      <div className="world-career-actions">
        {canKeepGoing && onKeepGoing
          ? <><button className="world-primary" type="button" onClick={onKeepGoing}>接着干</button>
            <button className="world-ghost" type="button" onClick={onRestart}>收摊，开新局</button></>
          : <button className="world-primary" type="button" onClick={onRestart}>开新局</button>}
      </div>
    </section>
  </div>;
}

/** 今天在哪个柜：每天早上定一个，定完当天不再改。 */
export function DistrictPicker({ world, onPick }: { world: World; onPick: (zone: DistrictZone) => void }) {
  const zone = districtZoneOf(world);
  const locked = districtChosenToday(world);
  return <section className="world-district" aria-label="今天在哪个柜">
    <div className="world-district-head">
      <b>今天在{DISTRICT_SPEC[zone].name}</b>
      <span>{locked ? "今天定住了" : "还没定"}</span>
    </div>
    <p>{DISTRICT_SPEC[zone].word}</p>
    <div className="world-district-row">
      {DISTRICT_ZONES.map(z => <button key={z} type="button"
        className={`world-district-btn${z === zone ? " is-on" : ""}`}
        disabled={locked}
        onClick={() => onPick(z)}>{DISTRICT_SPEC[z].name}</button>)}
    </div>
  </section>;
}

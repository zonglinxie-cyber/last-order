// 七日周目（?mode=run）的薄壳：种子开局、局间增幅三选一、周结算后的下一周，都在这里接；
// 接待、楼层、账目渲染全部交给 ClassicPrototype（meta 钩子只接管存档槽、开局、跨天与结局出口）。
import { useMemo, useState } from "react";
import { KeyboardInput, MobileScroll } from "./mobile";
import { flag, startNextDay, type Campaign } from "./campaign.ts";
import { ClassicPrototype, type ClassicMeta } from "./Prototype.tsx";
import {
  applyRunPerk, loadRun, nextRunSeed, perkChoices, perkPending, RUN_SAVE_KEY, saveRun, startRun, type RunSeed,
} from "./run.ts";
import "./run.css";

// 种子就是周目号的来源：week-<第几周>:<索引>，下一周顺延一格。
const randomSeed = (): RunSeed => `week-1:${Math.floor(Math.random() * 9999)}`;

export default function RunGame() {
  const restored = useMemo(loadRun, []);
  const [campaign, setCampaign] = useState<Campaign | null>(restored);
  const resume = Boolean(restored);
  const [draftSeed, setDraftSeed] = useState("");

  const onCampaign = (next: Campaign) => { setCampaign(next); saveRun(next); };
  const meta: ClassicMeta = {
    saveKey: RUN_SAVE_KEY,
    resume,
    weekLabel: campaign?.runSeed?.startsWith("week-") ? `七日周目 · 第 ${campaign.runSeed.slice(5).split(":")[0]} 周` : "七日周目",
    // 牌桌重开仍用同一颗种子（重新排一周是新周的事，不是"重新开始"这颗按钮的事）。
    fresh: () => startRun(campaign?.runSeed ?? randomSeed()),
    targetLabel: "本周目标",
    finaleLabel: "结算这一周 · 开下一周",
    lastDayLabel: "查看本周结算",
    // 天推进仍走 startNextDay，只是多挂一面 perk-pending：增幅屏由这面旗撑起来，刷新不会吃掉那一选。
    nextDay: s => {
      const next = startNextDay(s);
      return next.finished ? next : { ...next, flags: flag(next, "perk-pending") };
    },
    onFinale: s => {
      const seed = nextRunSeed(s) ?? randomSeed();
      const next = startRun(seed);
      saveRun(next);
      setCampaign(next);
    },
  };

  // 第一周（或刚开过新一周）：先让她定这一周的种子，再进品牌那一屏。
  if (campaign === null) {
    const begin = (seed: RunSeed) => { const next = startRun(seed); saveRun(next); setCampaign(next); };
    return <MobileScroll className="app-screen run-seed-screen"><main className="run-seed">
      <p className="run-eyebrow">AURORA · 绮光</p>
      <h1>七日周目</h1>
      <p className="run-seed-copy">同一颗种子排出同一周的客流与目标。打满五天结算，局间选一条增幅，下一周接着开。</p>
      <form className="run-seed-form" onSubmit={event => { event.preventDefault(); if (draftSeed.trim()) begin(`week-1:${draftSeed.trim()}`); }}>
        <KeyboardInput aria-label="输入周目种子" placeholder="随便输几个字，例如 0713" value={draftSeed} onChange={event => setDraftSeed(event.target.value)} />
        <button className="primary-action" type="submit" disabled={!draftSeed.trim()}>用这颗种子开第一周</button>
      </form>
      <button className="text-action" type="button" onClick={() => begin(randomSeed())}>随机开一周</button>
    </main></MobileScroll>;
  }

  const perks = perkPending(campaign) ? perkChoices(campaign) : [];
  return <>
    <ClassicPrototype campaign={campaign} onCampaign={onCampaign} meta={meta} />
    {perks.length > 0 && <div className="run-perk-veil"><main className="run-perk-screen" role="dialog" aria-label="局间增幅">
      <p className="run-eyebrow">第 {campaign.day - 1} 天收工</p>
      <h1>选一条增幅带进明天</h1>
      <p className="run-perk-copy">一周只能拿一次的那件小事。选完就开明天的档。</p>
      <div className="run-perk-list">{perks.map(perk => (
        <button type="button" className="run-perk-card" key={perk.id} onClick={() => onCampaign(applyRunPerk(campaign, perk.id))}>
          <b>{perk.label}</b><small>{perk.detail}</small>
        </button>
      ))}</div>
    </main></div>}
  </>;
}

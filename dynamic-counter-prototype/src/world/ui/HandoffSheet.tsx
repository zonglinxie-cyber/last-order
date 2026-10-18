import { BottomSheet, MobileScroll } from "../../mobile";
import { HANDOFF_SALE_MIN_OPINION } from "../engine.ts";
import { handoffPreview, type HandoffMode } from "../handoff.ts";
import type { Person, PersonId, World } from "../types.ts";

// 托单的经营选择：目标已在选人层定好，这里只读公开预览，让玩家明确选"只照看"还是"合适就代卖一件"。
// 打开/取消不扣精力；每个模式按钮就是一次确认，交给 onConfirm 走 doVerb（引擎只在合法且未扣过时才收费）。
// draftPaid 由上层读 consults 里该顾客的 begun 传入：已付过接待精力时不能再谎称"省12"。
export function HandoffSheet({ world, people, targets, draftPaid, onConfirm, onClose }: {
  world: World; people: Person[]; targets: PersonId[]; draftPaid: boolean;
  onConfirm: (mode: HandoffMode) => void; onClose: () => void;
}) {
  const p = handoffPreview(world, people, targets);
  const facts: string[] = [
    `${p.energyCost} 精力 · ${p.staffName}每天限照看一位。`,
    `对你的看法 ${p.staffTrust} → ${p.staffTrustAfterHandoff}；代卖需 ${HANDOFF_SALE_MIN_OPINION}。`,
  ];
  if (!p.staffWatchFree) facts.push(`${p.staffName}今天已经照看过一位客人，这个名额用掉了。`);

  const blocked = p.can ? null : `这会儿托不动：${p.staffWatchFree ? "精力或在场不对" : `${p.staffName}今天的照看名额已经用掉了`}。`;

  return <BottomSheet open title={`托${p.staffName}照看${p.customerName}`}
    description="这一单，由你决定怎么接" snap={0.8}
    onOpenChange={open => { if (!open) onClose(); }}>
    <div className="world-routes handoff-sheet">
      <MobileScroll className="routes-scroll">
        <ul className="handoff-facts">{facts.map((line, i) => <li key={i}>{line}</li>)}</ul>
        {p.sellNotes.length > 0 && <p className="handoff-caution">这次只能照看：{p.sellNotes.join(" ")}</p>}
        {draftPaid && <p className="handoff-caution">这单接待已花 12 精力。接着谈不再收费，代卖也不退回。</p>}
        {blocked && <p className="handoff-caution" role="status">{blocked}</p>}
        <button type="button" className="handoff-choice" data-handoff-mode="watch" disabled={!p.can}
          onClick={() => onConfirm("watch")}>
          <b>只照看，我来开单</b>
          <small>不代卖，留你亲自接、多件成交的机会。要在本时段接待，不替你留到下一时段。</small>
        </button>
        <button type="button" className="handoff-choice" data-handoff-mode="sell" disabled={!p.can || !p.sellOfferable}
          onClick={() => onConfirm("sell")}>
          <b>照看，合适就代卖一件</b>
          <small>{!draftPaid && "省下亲自接待的 12 精力。"}不保证成交；卖出后这几天不会再重复买。</small>
        </button>
      </MobileScroll>
      <button type="button" className="routes-close handoff-cancel" onClick={onClose}>先不托</button>
    </div>
  </BottomSheet>;
}

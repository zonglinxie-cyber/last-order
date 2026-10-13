import { useEffect, useRef } from "react";
import { BottomSheet, MobileScroll } from "../../mobile";
import { asset } from "../../base.ts";
import { hasOpenedSale, VERB_ENERGY } from "../engine.ts";
import {
  TRAIT_LABEL, TRIED_MARK, askHer, budgetWord, lookAt, offerEvidence, patienceWord, plateOf,
  priceWord, questionsOf, spotsOf, stillHolding, tryOn, type Consult,
} from "../consult.ts";
import { SHELF, SHELF_LINES, type ShelfId } from "../shelf.ts";
import type { Person, World } from "../types.ts";
import type { SaleFeedback } from "../sales-feedback.ts";
import { ta } from "../pronoun.ts";
import { unsaidWord } from "../serve-talk.ts";
import { servePickWord } from "./words.ts";
import "./consult.css";

type Props = {
  world: World; person: Person; consult: Consult;
  onChange: (patch: Partial<Pick<Consult, "stage" | "product" | "units">>) => void;
  onAct: (step: (c: Consult) => Consult) => void;
  onCommit: (force: boolean) => void; onLeave: () => void; onClose: () => void;
};
const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;

export function ConsultPanel({ world, person, consult: c, onChange, onAct, onCommit, onLeave, onClose }: Props) {
  const plate = plateOf(person), offer = c.stage === "offer", product = c.product;
  const panelRef = useRef<HTMLDivElement>(null);
  const evidence = product ? offerEvidence(c, person, product, c.units) : [];
  // 最后一次探问后会追加「该开单了」，反应仍显示真正的回答。
  const lastReply = c.lines.at(c.patience === 0 && c.begun ? -2 : -1);
  useEffect(() => {
    panelRef.current?.querySelector(".consult-scroll .mobile-scroll")?.scrollTo({ top: 0 });
  }, [c.lines.length]);
  const said = <div className="serve-lines" aria-live="polite">
    {c.lines.length ? c.lines.map((line, i) => <p key={i} className={i === c.lines.length - 1 && c.begun ? "fresh" : ""}>{line}</p>)
      : <p>「{person.voice.greet}」</p>}
    {stillHolding(c, person) && <p className="serve-hold">{unsaidWord(person.gender)}</p>}
  </div>;
  return <BottomSheet open title={`${person.name} · 柜台接待`} description="问清一件事，再做一次判断。切换页面不耗耐心。"
    snap={0.92} onOpenChange={open => { if (!open) onClose(); }}>
    <div className="world-serve" ref={panelRef}>
      <div className="consult-status">
        <div><strong>{c.patience > 0 ? `还可探 ${c.patience} 次` : "现在做决定"}</strong><span>{patienceWord(c, person)}</span></div>
        <button type="button" className="pc-close" aria-label="关闭人物卡" onClick={onClose}>×</button>
      </div>
      <p className="serve-meta">{budgetWord(c, person)} · {c.begun ? "本单精力已付" : `第一次看 / 问 / 试才花 ${VERB_ENERGY.serve} 精力`}</p>
      <div className="consult-tabs" role="tablist" aria-label="接待步骤" onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const stage = event.key === "Home" ? "listen" : event.key === "End" ? "offer" : offer ? "listen" : "offer";
        onChange({ stage });
        event.currentTarget.querySelector<HTMLButtonElement>(`#consult-${stage}-tab`)?.focus();
      }}>
        <button type="button" role="tab" tabIndex={offer ? -1 : 0} aria-selected={!offer} aria-controls="consult-listen" id="consult-listen-tab" onClick={() => onChange({ stage: "listen" })}>了解客人</button>
        <button type="button" role="tab" tabIndex={offer ? 0 : -1} aria-selected={offer} aria-controls="consult-offer" id="consult-offer-tab" onClick={() => onChange({ stage: "offer" })}>挑货开单</button>
      </div>
      <MobileScroll key={c.stage} className="consult-scroll">
        <div className="consult-notes" aria-label="已知需求">
          <span>已知</span>{c.known.map(t => <b key={t}>{TRAIT_LABEL[t]}</b>)}
          {!c.known.length && <span>还没问到具体需求</span>}
          {c.vetoKnown && person.skin?.veto && <p className="serve-veto">底线：{person.skin.veto.note}</p>}
        </div>
        {!offer ? <section id="consult-listen" role="tabpanel" aria-labelledby="consult-listen-tab">
          {said}
          <p className="consult-cost">看一处、问一句或试一支，各花 1 次耐心。留一次给试用也可以。</p>
          {plate ? <div className="serve-face" role="group" aria-label="看"
            style={{ backgroundImage: `url(${asset(plate.src)})`, backgroundPositionY: `${plate.cropY}%` }}>
            {spotsOf(person).map(spot => <button key={spot.key} type="button" aria-label={`看${ta(person)}的${spot.label}`}
              className={`face-spot${c.looked.includes(spot.key) ? " found" : ""}`} style={{ left: `${spot.at!.x}%`, top: `${spot.at!.y}%` }}
              disabled={c.patience <= 0 || c.looked.includes(spot.key)}
              onClick={() => onAct(v => lookAt(v, person, spot.key))}><i aria-hidden="true" /><span>{spot.label}</span></button>)}
          </div> : <div className="serve-probe" aria-label="看"><span>看</span>
            {spotsOf(person).map(spot => <button key={spot.key} type="button" disabled={c.patience <= 0 || c.looked.includes(spot.key)}
              onClick={() => onAct(v => lookAt(v, person, spot.key))}>{spot.label}</button>)}
          </div>}
          <div className="serve-probe" aria-label="问"><span>问</span>
            {questionsOf(person).map(q => <button key={q.key} type="button" disabled={c.patience <= 0 || c.asked.includes(q.key)}
              onClick={() => onAct(v => askHer(v, person, q.key))}>{q.label}</button>)}
          </div>
          {c.begun && <p className="consult-memory">已知需求已经记下，下次见面还在。</p>}
        </section> : <section id="consult-offer" role="tabpanel" aria-labelledby="consult-offer-tab">
          {c.begun && <p className="consult-reaction" aria-live="polite">{lastReply}</p>}
          {SHELF_LINES.map(line => <div key={line.word} className="serve-line" role="group" aria-label={line.word}>
            <span className="serve-line-word">{line.word}</span><div className="serve-products">{line.ids.map(pid => {
              const tried = c.tried[pid];
              return <button key={pid} type="button" aria-pressed={product === pid}
                className={`${product === pid ? "on" : ""}${tried ? ` tried-${tried}` : ""}`} onClick={() => onChange({ product: pid })}>
                <b>{SHELF[pid].short}</b><small>{tried ? `${ta(person)}${TRIED_MARK[tried]}` : yuan(SHELF[pid].price)}</small><em>{SHELF[pid].tag}</em></button>;
            })}</div>
          </div>)}
          <p className="serve-note">{product ? priceWord(person, product) : servePickWord(ta(person), !hasOpenedSale(world))}</p>
          {product && <ul className="offer-evidence" aria-label="开单前的判断">{evidence.map(line => <li key={line}>{line}</li>)}</ul>}
          <p className="consult-force-note">硬推多出的货会伤人情、扣台账，之后还可能退货。</p>
          <details className="consult-history"><summary>翻看这次谈话</summary>{said}</details>
        </section>}
      </MobileScroll>
      <div className="serve-foot">
        {offer ? <>
          <p className="offer-total">{product ? `${SHELF[product].short} × ${c.units} · 报价 ${yuan(SHELF[product].price * c.units)}` : "先挑一支，再决定带几件"}</p>
          {product && <p className="offer-signal" role="status">{evidence[0]}</p>}
          <div className="serve-units" role="group" aria-label="推荐件数">{[1, 2, 3, 4].map(u => <button key={u} type="button" aria-pressed={c.units === u}
            className={c.units === u ? "on" : ""} onClick={() => onChange({ units: u })}>{u} 件</button>)}</div>
          <div className="serve-actions">
            <button className="serve-try" type="button" disabled={!product || c.patience <= 0 || !!c.tried[product]}
              onClick={() => product && onAct(v => tryOn(v, person, product))}>试一下</button>
            <button className="serve-commit" type="button" disabled={!product} onClick={() => onCommit(false)}>开给{ta(person)}</button>
            <button className="serve-force" type="button" disabled={!product} onClick={() => onCommit(true)}>硬推</button>
          </div>
        </> : <button className="consult-next" type="button" onClick={() => onChange({ stage: "offer" })}>{c.patience ? "去挑货，试试判断" : "去挑货，做决定"}</button>}
        <button type="button" className="consult-leave" onClick={onLeave}>今天先不卖</button>
      </div>
    </div>
  </BottomSheet>;
}

export function SaleReceipt({ person, product, feedback: f, onClose }: {
  person: Person; product: ShelfId; feedback: SaleFeedback; onClose: () => void;
}) {
  const signed = (n: number) => n > 0 ? `+${n}` : `${n}`;
  return <BottomSheet open title={f.title} description={`${person.name} · ${SHELF[product].name}`} snap={0.78}
    onOpenChange={open => { if (!open) onClose(); }}>
    <div className={`sale-receipt ${f.tone}`}>
      <MobileScroll className="receipt-scroll">
        <p className="receipt-amount">{f.amount ? `+${yuan(f.amount)}` : "没有进账"}<small>{f.units > 0 ? `实际带走 ${f.units} 件` : "今天的判断，留给下一次"}</small></p>
        <dl className="receipt-deltas"><div><dt>人情</dt><dd>{signed(f.opinion)}</dd></div><div><dt>柜位</dt><dd>{signed(f.standing)}</dd></div><div><dt>台账</dt><dd>{signed(f.compliance)}</dd></div></dl>
        <p className="receipt-why">{f.explanation}</p><p className="receipt-goal">{f.goal}</p>
        <div className="receipt-lesson"><b>下一单，用得上的事</b><p>{f.lesson}</p></div>
        <details className="consult-history"><summary>这单的现场记录</summary>{f.lines.map((line, i) => <p key={i}>{line}</p>)}</details>
      </MobileScroll>
      <button className="consult-next" type="button" onClick={onClose}>回到楼层</button>
    </div>
  </BottomSheet>;
}

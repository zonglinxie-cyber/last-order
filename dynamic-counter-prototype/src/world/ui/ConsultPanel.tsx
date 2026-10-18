import { Fragment, useEffect, useRef, useState } from "react";
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
import { visitContext } from "../visits.ts";
import type { ArrivalNote } from "../arrivals.ts";
import { companionCost, companionUsed, COMPANION_ENERGY, type companionOptions } from "../companion.ts";
import "./consult.css";

type Props = {
  world: World; person: Person; consult: Consult;
  arrival?: ArrivalNote | null;
  companions: ReturnType<typeof companionOptions>;
  onCompanion: (id: string) => void;
  onChange: (patch: Partial<Pick<Consult, "stage" | "product" | "units">>) => void;
  onAct: (step: (c: Consult) => Consult) => void;
  onCommit: (force: boolean) => void; onLeave: () => void; onClose: () => void;
};
const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;

export function ConsultPanel({ world, person, consult: c, arrival, companions, onCompanion, onChange, onAct, onCommit, onLeave, onClose }: Props) {
  const plate = plateOf(person), offer = c.stage === "offer", product = c.product;
  const context = visitContext(world, person);
  const panelRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLDivElement>(null);
  const [probe, setProbe] = useState<{ kind: "look" | "ask"; key: string; lines: number } | null>(null);
  // 只定位这一次动作的回应；翻页试货、恢复接待后不把旧提问冒认成最新动作。
  const liveProbe = probe?.lines === c.lines.length ? probe : null;
  const probeAct = (kind: "look" | "ask", key: string, step: (v: Consult) => Consult) => onAct(v => {
    const next = step(v);
    if (next !== v) setProbe({ kind, key, lines: next.lines.length });
    return next;
  });
  const evidence = product ? offerEvidence(c, person, product, c.units) : [];
  // 最后一次探问后会追加「该开单了」，反应仍显示真正的回答。
  const lastReply = c.lines.at(c.patience === 0 && c.begun ? -2 : -1);
  useEffect(() => {
    if (c.stage === "offer") panelRef.current?.querySelector(".consult-scroll .mobile-scroll")?.scrollTo({ top: 0 });
    else replyRef.current?.scrollIntoView({ block: "nearest" });
  }, [c.lines.length, c.stage, liveProbe?.key, liveProbe?.kind]);
  const reply = c.begun && <div className="probe-reply" ref={replyRef} role="status">
    <b>{liveProbe?.kind === "look" ? "你看到的" : "刚刚的回应"}</b><p>{lastReply}</p>
    {stillHolding(c, person) && <small>{unsaidWord(person.gender)}</small>}
    {c.patience === 0 && <small>{c.lines.at(-1)}</small>}
  </div>;
  const said = <div className="serve-lines">
    {c.lines.length ? c.lines.map((line, i) => <p key={i} className={i === c.lines.length - 1 && c.begun ? "fresh" : ""}>{line}</p>)
      : <p>「{person.voice.greet}」</p>}
    {stillHolding(c, person) && <p className="serve-hold">{unsaidWord(person.gender)}</p>}
  </div>;
  const companion = companions.length > 0 && <section className="consult-companion" aria-label="请熟人搭话">
    {companionUsed(world, person.id) ? <p>今天已经请熟人替{person.name}问过了，接着挑货或试用。</p> : <>
      <b>熟人也在楼上</b>
      <p>替你问清一件事，不耗耐心，每位客人每天一次。搭话 {COMPANION_ENERGY} 精力{!c.begun && `，另算接待 ${VERB_ENERGY.serve} 精力`}。</p>
      {companions.map(({ person: helper, reason }) => <div key={helper.id}>
        <button type="button" disabled={!!reason} aria-describedby={`companion-${helper.id}`}
          onClick={() => { setProbe(null); onCompanion(helper.id); }}>请{helper.name}搭话 · {companionCost(c)} 精力</button>
        <p id={`companion-${helper.id}`}>{reason ?? `${helper.name}和${person.name}相熟，也信得过你。`}</p>
      </div>)}
    </>}
  </section>;
  return <BottomSheet open title={`${person.name} · 柜台接待`} description="问清一件事，再做一次判断。切换页面不耗耐心。"
    snap={0.92} onOpenChange={open => { if (!open) onClose(); }}>
    <div className="world-serve" ref={panelRef}>
      <div className="consult-status">
        <div><strong>{c.patience > 0 ? `还可探 ${c.patience} 次` : "现在做决定"}</strong><span>{patienceWord(c, person)}</span></div>
        <button type="button" className="pc-close" aria-label="关闭人物卡" onClick={onClose}>×</button>
      </div>
      <p className="serve-meta">{context ? `${context.title} · ` : ""}{budgetWord(c, person)} · {c.begun ? "本单精力已付" : `第一次看 / 问 / 试才花 ${VERB_ENERGY.serve} 精力`}</p>
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
        {arrival && !offer && <section className="arrival-note" aria-label="来访缘由">
          <h3>{arrival.title}</h3><p>{arrival.line}</p>
        </section>}
        <div className="consult-notes" aria-label="已知需求">
          <span>已知</span>{c.known.map(t => <b key={t}>{TRAIT_LABEL[t]}</b>)}
          {!c.known.length && <span>还没问到具体需求</span>}
          {c.focus && <p className={`serve-focus${c.focusKnown ? "" : " is-unknown"}`}>
            {c.focusKnown ? `今天的重点：${TRAIT_LABEL[c.focus]}` : "今天的重点还没摸清 —— 看一处或问一句。"}
          </p>}
          {c.vetoKnown && person.skin?.veto && <p className="serve-veto">底线：{person.skin.veto.note}</p>}
        </div>
        {!offer ? <section id="consult-listen" role="tabpanel" aria-labelledby="consult-listen-tab">
          {!c.begun && said}
          {c.begun && !liveProbe && reply}
          {companion}
          <p className="consult-cost">看一处、问一句或试一支，各花 1 次耐心。留一次给试用也可以。</p>
          {plate ? <div className="serve-face" role="group" aria-label="看"
            style={{ backgroundImage: `url(${asset(plate.src)})`, backgroundPositionY: `${plate.cropY}%` }}>
            {spotsOf(person).map(spot => <button key={spot.key} type="button" aria-label={`看${ta(person)}的${spot.label}`}
              className={`face-spot${c.looked.includes(spot.key) ? " found" : ""}`} style={{ left: `${spot.at!.x}%`, top: `${spot.at!.y}%` }}
              disabled={c.patience <= 0 || c.looked.includes(spot.key)}
              onClick={() => probeAct("look", spot.key, v => lookAt(v, person, spot.key))}><i aria-hidden="true" /><span>{spot.label}</span></button>)}
          </div> : <div className="serve-probe" aria-label="看"><span>看</span>
            {spotsOf(person).map(spot => <button key={spot.key} type="button" disabled={c.patience <= 0 || c.looked.includes(spot.key)}
              onClick={() => probeAct("look", spot.key, v => lookAt(v, person, spot.key))}>{spot.label}</button>)}
          </div>}
          {liveProbe?.kind === "look" && reply}
          <div className="serve-probe" aria-label="问"><span>问</span>
            {questionsOf(person).map(q => <Fragment key={q.key}>
              <button type="button" className={liveProbe?.kind === "ask" && liveProbe.key === q.key ? "probe-active" : undefined}
                disabled={c.patience <= 0 || c.asked.includes(q.key)}
                onClick={() => probeAct("ask", q.key, v => askHer(v, person, q.key))}>{q.label}</button>
              {liveProbe?.kind === "ask" && liveProbe.key === q.key && reply}
            </Fragment>)}
          </div>
          {c.begun && <details className="consult-history consult-listen-history">
            <summary>回看这次谈话</summary>{said}
          </details>}
          {c.begun && <p className="consult-memory">长期偏好已记下，下次见面还用得上{context ? "；今天的用途按这次来意判断" : ""}。</p>}
        </section> : <section id="consult-offer" role="tabpanel" aria-labelledby="consult-offer-tab">
          {c.begun && <p className="consult-reaction" aria-live="polite">{lastReply}</p>}
          {companion}
          {SHELF_LINES.map(line => <div key={line.word} className="serve-line" role="group" aria-label={line.word}>
            <span className="serve-line-word">{line.word}</span><div className="serve-products">{line.ids.map(pid => {
              const tried = c.tried[pid];
              return <button key={pid} type="button" aria-pressed={product === pid}
                className={`${product === pid ? "on" : ""}${tried ? ` tried-${tried}` : ""}`} onClick={() => onChange({ product: pid })}>
                <b>{SHELF[pid].short}</b><small>{tried ? `${ta(person)}${TRIED_MARK[tried]} · ${yuan(SHELF[pid].price)}` : yuan(SHELF[pid].price)}</small><em>{SHELF[pid].tag}</em></button>;
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

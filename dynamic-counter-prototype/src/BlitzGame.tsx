import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  BUNDLES, canLeaveSample, CUSTOMERS, fitOf, PRODUCTS, revealOf, TRAIT_LABELS, unknownDemands,
  type BundleId, type CueId, type ProductId,
} from "./campaign";
import { DUEL_BUNDLE_AT, DUEL_CLOSE_MIN, DUEL_CUES, duelUnlockedBundles, type DuelCard, type DuelSide } from "./duel";
import {
  BLITZ_SECONDS, blitzClose, blitzLeft, blitzLook, blitzMulligan, blitzPlay,
  blitzSendAway, blitzTrial, loadBlitzBest, loadBlitzRun, saveBlitzBest, saveBlitzRun,
  startBlitz, type BlitzRun, type BlitzSummary,
} from "./blitz";
import { sfx, sfxMute, sfxMuted } from "./sfx";
import "./blitz.css";

type BlitzScreen = "intro" | "play" | "settle";

const PRODUCT_IDS: ProductId[] = ["soft", "glow", "repair"];
const BUNDLE_ORDER: BundleId[] = ["single", "pair", "set", "bulk"];
const CARD_TAG: Record<DuelCard["kind"], string> = { ask: "问", catch: "接", sample: "样", overpromise: "夸", pitch: "讲", rival: "应" };
const CARD_HINT: Partial<Record<DuelCard["kind"], string>> = { catch: "+8", sample: "+10 · 1 支" };
const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// 与 DuelGame 同一套坐标：咨询近景板 853×1844，三个线索点与面部中线的图片坐标由
// art/blender-export.md 锁死，热区按 object-fit:cover 的实际缩放换算回容器像素。
const FACE_PLATE = { w: 853, h: 1844 };
const FACE_FOCUS_Y = 0.41;
const CUE_SPOTS: Record<CueId, { x: number; y: number }> = {
  eyes: { x: 278, y: 686 }, cheek: { x: 618, y: 834 }, nose: { x: 432, y: 815 },
};
const FACE_MIDLINE_X = 432;

function facePoint(spot: { x: number; y: number }, box: { w: number; h: number }) {
  const scale = Math.max(box.w / FACE_PLATE.w, box.h / FACE_PLATE.h);
  return {
    x: spot.x * scale + (box.w - FACE_PLATE.w * scale) * 0.5,
    y: spot.y * scale + (box.h - FACE_PLATE.h * scale) * FACE_FOCUS_Y,
  };
}

const freshSeed = () => {
  const fromUrl = new URLSearchParams(window.location.search).get("seed");
  return fromUrl ?? Math.random().toString(36).slice(2, 10);
};

export default function BlitzGame() {
  const [run, setRun] = useState<BlitzRun | null>(null);
  const [screen, setScreen] = useState<BlitzScreen>("intro");
  const [muted, setMuted] = useState(sfxMuted());
  const [closeArmed, setCloseArmed] = useState(false);
  const [armedProduct, setArmedProduct] = useState<ProductId | null>(null);
  const [ghost, setGhost] = useState<{ product: ProductId; x: number; y: number } | null>(null);
  const [faceBox, setFaceBox] = useState<{ w: number; h: number } | null>(null);
  const [best, setBest] = useState<BlitzSummary | null>(() => {
    try { return loadBlitzBest(window.localStorage); } catch { return null; }
  });
  const [isNewBest, setIsNewBest] = useState(false);
  const faceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ product: ProductId; x: number; y: number } | null>(null);
  const savedRef = useRef(false);
  const lastRun = (() => {
    try { return loadBlitzRun(window.localStorage); } catch { return null; }
  })();

  const blitz = run?.blitz ?? null;
  const duel = blitz?.duel ?? null;
  const customer = duel ? CUSTOMERS[duel.customerId] : null;
  const session = run?.campaign.activeSession ?? null;

  // 脸框实际尺寸由 flex 决定：量出来，点位才能按图片坐标换算。
  const inPlay = screen === "play" && duel !== null;
  useLayoutEffect(() => {
    if (!inPlay) return;
    const el = faceRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setFaceBox({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [inPlay, duel?.customerId]);

  // 计时归零或队伍打空 → 结算，同一出口只落一次盘。
  useEffect(() => {
    if (!blitz?.over || savedRef.current) return;
    savedRef.current = true;
    sfx("bell");
    try {
      saveBlitzRun(window.localStorage, blitz);
      const record = saveBlitzBest(window.localStorage, blitz);
      setBest(record.best);
      setIsNewBest(record.isNew);
    } catch { /* 私密模式存不进就不存 */ }
    setScreen("settle");
  }, [blitz]);

  const begin = () => {
    savedRef.current = false;
    setIsNewBest(false);
    setCloseArmed(false);
    setArmedProduct(null);
    setRun(startBlitz(freshSeed()));
    setScreen("play");
    sfx("register");
  };

  const applyRun = (res: BlitzRun | null, sound: "tap" | "card" | "brush" = "card") => {
    if (!res || !duel) return;
    sfx(sound);
    const before = duel.interest;
    const after = res.blitz.duel?.interest;
    if (after !== undefined && after > before) sfx("up");
    else if (after !== undefined && after < before) sfx("down");
    setRun(res);
  };

  const look = (cue: CueId) => { if (run) applyRun(blitzLook(run, cue), "tap"); };
  const playCard = (card: DuelCard) => { if (run) applyRun(blitzPlay(run, card.id)); };
  const mulligan = () => { if (run) applyRun(blitzMulligan(run)); };
  const sendAway = () => { if (run) applyRun(blitzSendAway(run)); };
  const tryClose = (bundle: BundleId) => {
    if (!run) return;
    const res = blitzClose(run, bundle);
    if (!res) return;
    sfx("register");
    setCloseArmed(false);
    setRun(res.run);
  };

  // 拖拽上脸：与 duel 同一手势，位移小于 8px 当作点选（点产品再点半张脸）。
  const productDown = (e: ReactPointerEvent<HTMLElement>, product: ProductId) => {
    if (!duel || duel.walked || duel.lastCall) return;
    if (duel.trials.left === product || duel.trials.right === product) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { product, x: e.clientX, y: e.clientY };
    setGhost({ product, x: e.clientX, y: e.clientY });
  };
  const productMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    setGhost(g => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
  };
  const productUp = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setGhost(null);
    if (!drag) return;
    const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
    if (moved < 8) { setArmedProduct(drag.product); return; }
    const rect = faceRef.current?.getBoundingClientRect();
    if (!rect || e.clientY < rect.top || e.clientY > rect.bottom || e.clientX < rect.left || e.clientX > rect.right) return;
    if (!run) return;
    applyRun(blitzTrial(run, drag.product, e.clientX < rect.left + rect.width / 2 ? "left" : "right"), "brush");
    setArmedProduct(null);
  };

  if (screen === "intro") {
    return <main className="blitz-intro">
      <p className="duel-eyebrow">最后一单 · 速诊</p>
      <h1>四分钟，一个接一个</h1>
      <p className="duel-copy">顾客排队进，没有楼层也没有明天：看脸、出牌、把产品拖上她的半张脸，每人最多三个回合。成交的总额、接待的人数、干净的单，都记在这一局。</p>
      {best && <p className="duel-ledger-line">最高纪录 {yuan(best.sales)} · 接待 {best.served} 位 · 干净 {best.clean} 单</p>}
      {!best && lastRun && <p className="duel-ledger-line">上一局 {yuan(lastRun.sales)} · 接待 {lastRun.served} 位</p>}
      <button className="duel-primary" type="button" onClick={begin}>开一局 · 4:00</button>
    </main>;
  }

  if (screen === "settle" && blitz) {
    return <main className="blitz-settle">
      <p className="duel-eyebrow">速诊 · 结算</p>
      <h1>今日快诊 {yuan(blitz.score.sales)}</h1>
      {isNewBest && <div className="blitz-newbest">新纪录</div>}
      <div className="blitz-stats">
        <span><b>{blitz.score.served}</b>接待</span>
        <span><b>{blitz.score.clean}</b>干净成交</span>
        <span><b>{blitz.served.filter(item => item.outcome.units > 0).length}</b>开单</span>
        <span><b>{blitz.walked.length}</b>没等到</span>
      </div>
      <section className="duel-ledger receipt">
        <b>这一局的小票</b>
        {blitz.served.map((item, i) => <p key={i}>{item.outcome.title}{item.outcome.units > 0 ? ` · ${yuan(item.outcome.amount)}` : ""}</p>)}
        {blitz.walked.map(id => <p key={id}>{CUSTOMERS[id].name}没等到你</p>)}
      </section>
      {best && <p className="duel-ledger-line">最高纪录 {yuan(best.sales)} · 接待 {best.served} 位 · 干净 {best.clean} 单</p>}
      <button className="duel-primary" type="button" onClick={begin}>再来一局</button>
    </main>;
  }

  if (screen === "play" && run && blitz && duel && customer && session) {
    const closable = duel.interest >= DUEL_CLOSE_MIN && session.tested;
    const known = revealOf(customer, session.discovered, session.revealed);
    const knownTags = customer.demands.filter(d => known.has(d.trait));
    const unknownCount = unknownDemands(customer, known).length;
    const lastLine = [...duel.log].reverse().find(entry => entry.text)?.text ?? customer.opening;
    const ticker = [...blitz.log].reverse().find(entry => entry.text)?.text ?? null;
    const floats = duel.log.map((entry, i) => ({ entry, i })).filter(item => item.entry.delta).slice(-4);
    const halfClass = (side: DuelSide) => {
      const p = duel.trials[side];
      return p ? `half-${p} half-${fitOf(customer, p).tier}` : "";
    };
    const canAct = !duel.walked && !duel.lastCall && duel.round < duel.rounds;
    const cardDisabled = (card: DuelCard) =>
      (card.kind === "sample" && !canLeaveSample(run.campaign, duel.customerId))
      || (card.kind === "pitch" && (duel.pitchUsed || !duel.current)) || !canAct;
    const upcoming = blitz.queue.slice(blitz.customerIndex, blitz.customerIndex + 3);
    return <div className="duel-screen blitz-screen">
      <header className="duel-top">
        <b>{customer.name}</b><span>{customer.descriptor}</span>
        <i className="duel-rounds" aria-label={`第 ${duel.round + 1} 回合，共 ${duel.rounds} 回合`}>
          {Array.from({ length: duel.rounds }, (_, i) => <em key={i} className={i < duel.round ? "used" : ""} />)}
        </i>
        <button className="duel-mute" type="button" aria-label={muted ? "开声音" : "静音"} onClick={() => { const next = !muted; sfxMute(next); setMuted(next); }}>{muted ? "静" : "声"}</button>
      </header>
      <div className="blitz-clock" aria-label={`还剩 ${clock(blitz.secondsLeft)}`}>
        <div className="blitz-clock-track"><div className="blitz-clock-fill" style={{ width: `${blitz.secondsLeft / BLITZ_SECONDS * 100}%` }} /></div>
        <b>{clock(blitz.secondsLeft)}</b>
        <span className="blitz-score-chip">{yuan(blitz.score.sales)}</span>
        {ticker && <span className="blitz-ticker">{ticker}</span>}
      </div>
      <div className="blitz-queue" aria-label={`队伍还剩 ${blitzLeft(blitz)} 位`}>
        {upcoming.map(id => <span key={id} className="blitz-next"><img src={CUSTOMERS[id].portrait} alt="" aria-hidden="true" draggable={false} /><i>{CUSTOMERS[id].name}</i></span>)}
        {blitzLeft(blitz) > 0 && <em>还有 {blitzLeft(blitz)} 位在等</em>}
      </div>
      <div className="duel-interest" aria-label={`兴趣 ${duel.interest}`}>
        <div className="duel-track">
          <div className="duel-fill" style={{ width: `${duel.interest}%` }} />
          {BUNDLE_ORDER.slice(0, 3).map(bundle => <i key={bundle} className={`duel-tick ${duel.interest >= DUEL_BUNDLE_AT[bundle] ? "on" : ""}`} style={{ left: `${DUEL_BUNDLE_AT[bundle]}%` }}><u>{bundle === "single" ? "成交" : bundle === "pair" ? "两件" : "整套"}</u></i>)}
          {floats.map(({ entry, i }) => <span key={i} className={`duel-float ${(entry.delta ?? 0) > 0 ? "up" : "down"}`}>{(entry.delta ?? 0) > 0 ? "+" : ""}{entry.delta}</span>)}
        </div>
      </div>
      <div className={`duel-face ${armedProduct ? "armed" : ""} ${ghost ? "dragging" : ""} ${duel.lastCall ? "lastcall" : ""}`} ref={faceRef}>
        <img className="duel-portrait" src={customer.portrait} alt={`${customer.name}面部特写`} draggable={false} />
        {(["left", "right"] as DuelSide[]).map(side => <button type="button" key={side}
          className={`duel-half ${side} ${halfClass(side)} ${armedProduct && !duel.trials[side] ? "droppable" : ""}`}
          aria-label={`${side === "left" ? "左" : "右"}半张脸${duel.trials[side] ? `已试${PRODUCTS[duel.trials[side]!].short}` : armedProduct ? "，点这里上脸" : ""}`}
          disabled={duel.lastCall}
          onClick={() => {
            if (!armedProduct || duel.trials[side] || !run) return;
            applyRun(blitzTrial(run, armedProduct, side), "brush");
            setArmedProduct(null);
          }}>
          {duel.trials[side] && <img src={customer.portrait} alt="" aria-hidden="true" draggable={false} />}
        </button>)}
        <i className="duel-split" aria-hidden="true" style={faceBox ? { left: facePoint({ x: FACE_MIDLINE_X, y: 0 }, faceBox).x } : undefined} />
        {DUEL_CUES.map(cue => {
          const spot = faceBox ? facePoint(CUE_SPOTS[cue], faceBox) : null;
          return <button type="button" key={cue} data-cue={cue}
            className={`duel-cue ${session.discovered.includes(cue) ? "found" : ""}`}
            style={spot ? { left: spot.x, top: spot.y } : { visibility: "hidden" }}
            disabled={duel.lastCall}
            aria-label={`看${customer.cues[cue].label}`} aria-pressed={session.discovered.includes(cue)}
            onClick={() => look(cue)}><i /></button>;
        })}
        <div className="duel-bubble" key={duel.log.length}>{lastLine}</div>
        <div className="duel-traits">
          {knownTags.map(d => <span key={d.trait}>{TRAIT_LABELS[d.trait]}</span>)}
          {Array.from({ length: unknownCount }, (_, i) => <span key={`u${i}`} className="unknown">？</span>)}
        </div>
      </div>
      <div className="duel-tray" data-scroll-drag="ignore">
        {PRODUCT_IDS.map(product => {
          const used = duel.trials.left === product || duel.trials.right === product;
          return <div key={product} data-product={product}
            className={`duel-product ${used ? "used" : ""} ${armedProduct === product ? "armed" : ""}`}
            role="button" aria-label={`试用${PRODUCTS[product].name}${used ? "（已上过脸）" : ""}`}
            onPointerDown={e => productDown(e, product)} onPointerMove={productMove} onPointerUp={productUp}>
            <span className={`product-art product-art-${product}`} /><b>{PRODUCTS[product].short}</b>
          </div>;
        })}
        <p className="duel-tray-hint">{armedProduct ? "点她左脸或右脸" : "拖一支到她脸上"}</p>
      </div>
      <div className={`duel-hand ${duel.hand.length > 4 ? "tight" : ""}`}>
        {duel.hand.map(card => {
          const hint = card.hint ?? CARD_HINT[card.kind];
          return <button type="button" key={card.id} data-card-id={card.id} data-kind={card.kind} className={`duel-card kind-${card.kind}`}
            disabled={cardDisabled(card)} onClick={() => playCard(card)}>
            <i>{CARD_TAG[card.kind]}</i><b>{card.title}</b>
            {hint && <small>{hint}</small>}
          </button>;
        })}
      </div>
      {duel.lastCall && <div className="duel-rival-note lastcall-note">最后一句：说个数，或者目送她走。</div>}
      <footer className="duel-foot">
        {closable && <div className="duel-bundles" role="group" aria-label="连带档位">
          {BUNDLE_ORDER.map(bundle => {
            const open = duelUnlockedBundles(duel).includes(bundle);
            return <button type="button" key={bundle} disabled={!open || !closeArmed}
              className={`duel-bundle ${open ? "open" : ""}`} onClick={() => tryClose(bundle)}>
              <b>{BUNDLES[bundle].label}</b><small>{open ? "选这档成交" : `兴趣 ≥${DUEL_BUNDLE_AT[bundle]}`}</small>
            </button>;
          })}
        </div>}
        <div className="duel-buttons">
          <button type="button" className="duel-primary duel-close" disabled={!closable}
            onClick={() => setCloseArmed(v => !v)}>{closeArmed ? "收起档位" : "提出成交"}</button>
          {duel.lastCall
            ? <button type="button" className="duel-ghost-btn" onClick={sendAway}>送她走</button>
            : <button type="button" className="duel-ghost-btn" disabled={!canAct || duel.mulliganUsed} onClick={mulligan}>换话题 · −3</button>}
        </div>
        {!session.tested && <p className="duel-foot-hint">她还没在脸上见过任何一支——先拖一支上去。</p>}
      </footer>
      {ghost && <div className="duel-ghost" style={{ left: ghost.x, top: ghost.y }}><span className={`product-art product-art-${ghost.product}`} /></div>}
    </div>;
  }

  return null;
}

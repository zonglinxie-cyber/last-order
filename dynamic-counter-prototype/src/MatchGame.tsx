// 对抗局（?mode=match）：上半楼层双方抢同一批顾客，下半接待面复用 duel 牌局的
// 视觉语言（同一套 .duel-* 选择器，样式由 match.css @import duel.css 继承）。
// DuelGame.tsx 本身没动：它绑死 duel 存档，这里只把接待四块（提示、手牌、试用、日志）
// 按原样搬进来，数据全走 match.ts 的 MatchState。
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MobileScroll } from "./mobile";
import {
  BUNDLES, canLeaveSample, CUSTOMERS, ENERGY_LOCK, fitOf, patienceLeft, PRODUCTS,
  revealOf, RIVAL_IDS, TRAIT_LABELS, unknownDemands,
  type BundleId, type CustomerId, type CueId, type ProductId, type SaleOutcome,
} from "./campaign.ts";
import {
  DUEL_BUNDLE_AT, DUEL_CLOSE_MIN, DUEL_CUES, duelClose, duelForce, duelLook, duelMulligan,
  duelPlay, duelSendAway, duelTrial, duelTriggerRival, duelUnlockedBundles,
  type DuelCard, type DuelSide, type DuelState,
} from "./duel.ts";
import {
  advanceMatchTick, MATCH_TICK_MS, MATCH_TICKS, matchBeginConsult, matchCustomerState,
  matchOnFloor, matchResolveConsult, matchSummary, saveMatchResult, loadMatchBest,
  startMatch, type MatchState,
} from "./match.ts";
import { sfx, sfxMute, sfxMuted } from "./sfx";
import "./match.css";

type MatchScreen = "floor" | "duel" | "result" | "walked" | "summary";

const PRODUCT_IDS: ProductId[] = ["soft", "glow", "repair"];
const BUNDLE_ORDER: BundleId[] = ["single", "pair", "set", "bulk"];
const CARD_TAG: Record<DuelCard["kind"], string> = { ask: "问", catch: "接", sample: "样", overpromise: "夸", pitch: "讲", rival: "应" };
const CARD_HINT: Partial<Record<DuelCard["kind"], string>> = { catch: "+8", sample: "+10 · 1 支", overpromise: "+25 · 合规 −8" };
const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;

// 与 DuelGame 同一份脸上坐标：853×1844 咨询近景板，点位按图片坐标换算回容器像素。
const FACE_PLATE = { w: 853, h: 1844 };
const FACE_FOCUS_Y = 0.41;
const CUE_SPOTS: Record<CueId, { x: number; y: number }> = {
  eyes: { x: 278, y: 686 }, cheek: { x: 618, y: 834 }, nose: { x: 432, y: 815 },
};
const FACE_MIDLINE_X = 432;
function facePoint(spot: { x: number; y: number }, box: { w: number; h: number }) {
  const scale = Math.max(box.w / FACE_PLATE.w, box.h / FACE_PLATE.h);
  const dw = FACE_PLATE.w * scale, dh = FACE_PLATE.h * scale;
  const ox = (box.w - dw) / 2, oy = (box.h - dh) * FACE_FOCUS_Y;
  return { x: ox + spot.x * scale, y: oy + spot.y * scale };
}

export default function MatchGame() {
  const [seed, setSeed] = useState(() => new URLSearchParams(window.location.search).get("seed") ?? `${Date.now()}`);
  const [match, setMatch] = useState<MatchState>(() => startMatch(seed));
  const [screen, setScreen] = useState<MatchScreen>("floor");
  const [outcome, setOutcome] = useState<SaleOutcome | null>(null);
  const [resultProduct, setResultProduct] = useState<ProductId | null>(null);
  const [muted, setMuted] = useState(sfxMuted());
  const [closeArmed, setCloseArmed] = useState(false);
  const [armedProduct, setArmedProduct] = useState<ProductId | null>(null);
  const [ghost, setGhost] = useState<{ product: ProductId; x: number; y: number } | null>(null);
  const [shownAmount, setShownAmount] = useState(0);
  const [faceBox, setFaceBox] = useState<{ w: number; h: number } | null>(null);
  const faceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ product: ProductId; x: number; y: number } | null>(null);

  const duel = match.duel;
  const session = match.campaign.activeSession;
  const customer = duel ? CUSTOMERS[duel.customerId] : null;
  const summary = matchSummary(match);
  const best = (() => { try { return loadMatchBest(); } catch { return null; } })();

  // 楼层时钟：每 MATCH_TICK_MS 走一格，接待中也照走——陆遥在你谈单的时候也在签单。
  useEffect(() => {
    if (match.finished) return;
    const timer = setInterval(() => setMatch(prev => advanceMatchTick(prev)), MATCH_TICK_MS);
    return () => clearInterval(timer);
  }, [match.finished]);

  // 战绩落盘只认 finished 翻转那一刻，不挑屏——结果卡上放着的这次也要写。
  const savedRef = useRef(false);
  useEffect(() => {
    if (!match.finished || savedRef.current) return;
    savedRef.current = true;
    saveMatchResult(match);
  }, [match.finished, match]);

  // 收工即结算屏；结果卡/走人卡正在念的时候不打断，按钮自己会过去。
  useEffect(() => {
    if (!match.finished || screen === "summary" || screen === "result" || screen === "walked") return;
    sfx("register");
    setScreen("summary");
  }, [match.finished, screen, match]);

  // 点了接待但那位刚被陆遥锁住（matchBeginConsult 返回 null）：回楼层，别停在空接待屏。
  useEffect(() => {
    if (screen === "duel" && !match.duel && !match.lastOutcome) setScreen("floor");
  }, [screen, match.duel, match.lastOutcome]);

  const inDuel = screen === "duel";
  useLayoutEffect(() => {
    if (!inDuel) return;
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
  }, [inDuel, duel?.customerId]);

  useEffect(() => {
    if (screen !== "result" || !outcome) return;
    setShownAmount(0);
    const target = outcome.amount;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 700);
      setShownAmount(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [screen, outcome]);

  // duel 动作全部走函数式更新：tick 与出牌可能同帧，函数式保证两边都不丢。
  // 结算值（收银卡/走人）没法从 updater 里掏出来，由 match.lastOutcome / duel.walked 经 effect 换屏。
  const applyDuel = (fn: (m: MatchState) => { campaign: MatchState["campaign"]; duel: DuelState } | null, sound: "tap" | "card" | "brush" = "card") => {
    sfx(sound);
    setMatch(prev => {
      if (!prev.duel) return prev;
      const res = fn(prev);
      return res ? matchResolveConsult(prev, res.campaign, res.duel) : prev;
    });
  };
  // 成交/硬推这类会收单的函数：把 outcome 随 matchResolveConsult 带回状态里。
  const applySettle = (fn: (m: MatchState, d: DuelState) => { campaign: MatchState["campaign"]; outcome: SaleOutcome } | null) => {
    setMatch(prev => {
      const d = prev.duel;
      if (!d) return prev;
      // 竞品顾客没应对过就先触发插话——这单不能直接开。
      if (RIVAL_IDS.includes(d.customerId) && !d.rivalDone && !d.rivalPending) {
        const trig = duelTriggerRival(d);
        return trig ? matchResolveConsult(prev, prev.campaign, trig) : prev;
      }
      const res = fn(prev, d);
      return res ? matchResolveConsult(prev, res.campaign, null, res.outcome, d.current) : prev;
    });
  };

  // 收单 → 结果屏；她走了 → 走人卡。两个换屏都由状态驱动，不靠 updater 外的时差。
  useEffect(() => {
    if (screen === "duel" && match.lastOutcome) {
      setOutcome(match.lastOutcome.outcome);
      setResultProduct(match.lastOutcome.product);
      sfx("register");
      setScreen("result");
    } else if (screen === "duel" && match.duel?.walked) {
      sfx("bell");
      setScreen("walked");
    }
  }, [screen, match]);

  // 能开才进接待屏：函数式更新吃最新 match，被陆遥先坐下的（null）不换屏、也不吞 tick；
  // 开不起来时上面的 effect 会把 duel 屏弹回楼层。
  const beginCustomer = (id: CustomerId) => {
    sfx("tap");
    setMatch(prev => matchBeginConsult(prev, id) ?? prev);
    setOutcome(null);
    setCloseArmed(false);
    setArmedProduct(null);
    setScreen("duel");
  };

  const look = (cue: CueId) => applyDuel(m => duelLook(m.campaign, m.duel!, cue), "tap");
  const playCard = (card: DuelCard) => applyDuel(m => duelPlay(m.campaign, m.duel!, card.id));
  const mulligan = () => applyDuel(m => duelMulligan(m.campaign, m.duel!));
  const applyTrial = (product: ProductId, side: DuelSide) => {
    applyDuel(m => duelTrial(m.campaign, m.duel!, product, side), "brush");
    setArmedProduct(null);
  };

  const tryClose = (bundle: BundleId) => applySettle((m, d) => duelClose(m.campaign, d, bundle));
  const tryForce = () => applySettle((m, d) => duelForce(m.campaign, d));
  const sendAway = () => applyDuel(m => duelSendAway(m.campaign, m.duel!));

  const backToFloor = () => {
    setMatch(prev => prev.duel || prev.lastOutcome ? { ...prev, duel: null, lastOutcome: null } : prev);
    setOutcome(null);
    setCloseArmed(false);
    setArmedProduct(null);
    setScreen(match.finished ? "summary" : "floor");
  };

  // 拖拽上脸：与 DuelGame 同一套手势——拖动过半脸界分用左右，轻点变成"选中再点脸"。
  const productDown = (e: ReactPointerEvent<HTMLElement>, product: ProductId) => {
    if (!duel || duel.rivalPending || duel.walked || duel.lastCall) return;
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
    applyTrial(drag.product, e.clientX < rect.left + rect.width / 2 ? "left" : "right");
  };

  // ── 楼层：同一片队列、同一个抽屉、右上迷你比分 ──
  if (screen === "floor") {
    const left = MATCH_TICKS - match.tick;
    const lockout = match.campaign.energy < ENERGY_LOCK;
    const rivalLine = match.rival.serving
      ? `正在接待${CUSTOMERS[match.rival.serving].name}`
      : match.rival.cooldown > 0 ? "在收拾台面" : "在打量下一位";
    return <div className="duel-page match-floor-page">
      <main className="duel-floor match-floor">
        <header className="duel-floor-head match-head">
          <div className="match-head-row">
            <p className="duel-eyebrow">对抗局 · 打烊倒数 {left}</p>
            <div className="match-score" aria-label={`你的业绩 ${summary.playerSales}，陆遥 ${summary.rivalSales}`}>
              <span>你 <b>{yuan(summary.playerSales)}</b></span>
              <span className="match-rival-score">陆遥 <b>{yuan(summary.rivalSales)}</b></span>
            </div>
          </div>
          <h1>同一片客流，谁先接住是谁的</h1>
        </header>
        <div className="duel-stage match-stage">
          <img className="duel-stage-bg" src="/assets/game/counter-stage-toy.png" alt="" aria-hidden="true" draggable={false} />
          <div className="match-rival" aria-live="polite">
            <img src="/assets/game/staff-portraits/luyao.png" alt="" aria-hidden="true" draggable={false} />
            <div className="match-rival-info">
              <b>陆遥</b>
              <span>{rivalLine}</span>
              {match.rival.serving && <i className="match-rival-ticks" aria-label={`这单还剩 ${match.rival.ticksLeft} 格`}>
                {Array.from({ length: 3 }, (_, i) => <em key={i} className={i < 3 - match.rival.ticksLeft ? "used" : ""} />)}
              </i>}
            </div>
            <strong className="match-rival-sales">{yuan(summary.rivalSales)}</strong>
          </div>
          <div className="duel-stage-row match-stage-row">
            {matchOnFloor(match).map(id => {
              const her = CUSTOMERS[id];
              const state = matchCustomerState(match, id);
              const patience = patienceLeft(match.campaign, id);
              const hearts = Math.ceil(Math.min(1, Math.max(0, patience / her.patience)) * 5);
              const low = hearts <= 1 && state === "waiting";
              const disabled = state !== "waiting" || lockout;
              const note = state === "rival" ? "陆遥在接待" : state === "you" ? "你在接待"
                : lockout ? "体力见底" : low ? "她快等不住了" : her.descriptor;
              return <button type="button" key={id} disabled={disabled}
                className={`duel-stander match-stander ${low ? "low" : ""} ${state === "rival" ? "locked" : ""}`}
                onClick={() => beginCustomer(id)}>
                <img src={her.portrait} alt="" aria-hidden="true" draggable={false} />
                <span className="duel-stander-tag">
                  <b>{her.name}</b>
                  <span className="duel-hearts" aria-label={disabled && state === "waiting" ? note : `耐心还剩约 ${Math.ceil(patience)} 分钟`}>
                    {Array.from({ length: 5 }, (_, i) => <i key={i} className={i < hearts ? "on" : ""} />)}
                  </span>
                  <em>{note}</em>
                </span>
              </button>;
            })}
          </div>
        </div>
      </main>
      <footer className="duel-page-foot match-foot">
        <span className="match-feed">{match.rival.log.length ? match.rival.log[match.rival.log.length - 1] : "她还没出手——客流不会等你。"}</span>
        <button className="duel-ghost-btn" type="button" onClick={() => { const next = !muted; sfxMute(next); setMuted(next); }}>{muted ? "开声音" : "静音"}</button>
      </footer>
    </div>;
  }

  // ── 接待：duel 牌局四块原样复用，顶部多一条陆遥动线 ──
  if (screen === "duel" && duel && customer && session) {
    const closable = duel.interest >= DUEL_CLOSE_MIN && session.tested && !duel.rivalPending;
    const known = revealOf(customer, session.discovered, session.revealed);
    const knownTags = customer.demands.filter(d => known.has(d.trait));
    const unknownCount = unknownDemands(customer, known).length;
    const lastLine = [...duel.log].reverse().find(entry => entry.text)?.text ?? customer.opening;
    const floats = duel.log.map((entry, i) => ({ entry, i })).filter(item => item.entry.delta).slice(-4);
    const halfClass = (side: DuelSide) => {
      const p = duel.trials[side];
      return p ? `half-${p} half-${fitOf(customer, p).tier}` : "";
    };
    const canAct = !duel.rivalPending && !duel.walked && !duel.lastCall && duel.round < duel.rounds;
    const cardDisabled = (card: DuelCard) =>
      duel.rivalPending ? card.kind !== "rival"
        : card.kind === "rival" || (card.kind === "sample" && !canLeaveSample(match.campaign, duel.customerId))
          || (card.kind === "pitch" && (duel.pitchUsed || !duel.current)) || duel.round >= duel.rounds || duel.lastCall;
    return <div className="duel-screen match-duel-screen">
      <header className="duel-top">
        <b>{customer.name}</b><span>{customer.descriptor}</span>
        <i className="duel-rounds" aria-label={`第 ${duel.round + 1} 回合，共 ${duel.rounds} 回合`}>
          {Array.from({ length: duel.rounds }, (_, i) => <em key={i} className={i < duel.round ? "used" : ""} />)}
        </i>
        <span className="match-mini">{match.rival.serving ? `陆遥:${CUSTOMERS[match.rival.serving].name}` : "陆遥:柜台"}</span>
      </header>
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
          onClick={() => { if (armedProduct && !duel.trials[side]) applyTrial(armedProduct, side); }}>
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
      <div className={`duel-hand ${duel.rivalPending ? "rival" : ""} ${duel.hand.length > 4 ? "tight" : ""}`}>
        {duel.hand.map(card => {
          const hint = card.hint ?? CARD_HINT[card.kind];
          return <button type="button" key={card.id} data-card-id={card.id} data-kind={card.kind} className={`duel-card kind-${card.kind}`}
            disabled={cardDisabled(card)} onClick={() => playCard(card)}>
            <i>{CARD_TAG[card.kind]}</i><b>{card.title}</b>
            {hint && <small>{hint}</small>}
          </button>;
        })}
      </div>
      {duel.rivalPending && <div className="duel-rival-note">陆遥插话——先打一张应对牌</div>}
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
          <button type="button" className="duel-ghost-btn danger" disabled={!session.tested || duel.rivalPending} onClick={tryForce}>硬推</button>
        </div>
        {!session.tested && <p className="duel-foot-hint">她还没在脸上见过任何一支——先拖一支上去。</p>}
      </footer>
      {ghost && <div className="duel-ghost" style={{ left: ghost.x, top: ghost.y }}><span className={`product-art product-art-${ghost.product}`} /></div>}
    </div>;
  }

  if (screen === "walked" && duel) {
    const her = CUSTOMERS[duel.customerId];
    return <MobileScroll className="app-screen duel-scroll"><main className="duel-result walked">
      <p className="duel-eyebrow">对抗局 · 她走了</p>
      <div className="duel-result-face"><img src={her.portrait} alt="" aria-hidden="true" draggable={false} /></div>
      <h1>{her.name}没等到你</h1>
      <p className="duel-copy">{her.lostLine}</p>
      <button className="duel-primary" type="button" onClick={backToFloor}>回到队列</button>
    </main></MobileScroll>;
  }

  if (screen === "result" && outcome) {
    const her = CUSTOMERS[match.campaign.dayServed[match.campaign.dayServed.length - 1] ?? "shen"];
    return <MobileScroll className="app-screen duel-scroll"><main className={`duel-result ${outcome.units > 0 ? "good" : "bad"}`}>
      <p className="duel-eyebrow">对抗局 · 收银提示</p>
      <div className="duel-result-face"><img src={her.portrait} alt="" aria-hidden="true" draggable={false} /></div>
      <h1>{outcome.title}</h1>
      {outcome.units > 0 && <div className="duel-result-line">
        {resultProduct && <span className={`product-art product-art-${resultProduct}`} />}
        <b>{PRODUCTS[resultProduct ?? "soft"].name} × {outcome.units} 件</b>
      </div>}
      <strong className="duel-amount">+ ¥{shownAmount.toLocaleString("zh-CN")}</strong>
      <div className={`duel-seal ${outcome.units > 0 ? "stamp" : ""}`}>{outcome.units > 0 ? "记在你名下" : "没买成"}</div>
      <p className="duel-copy">{outcome.body}</p>
      <button className="duel-primary" type="button" onClick={backToFloor}>{match.finished ? "看结算" : "回到队列"}</button>
    </main></MobileScroll>;
  }

  // ── 结算：同一本账拆两边 ──
  const verdict = summary.winner === "player" ? "你压过了陆遥" : summary.winner === "rival" ? "陆遥压过了你" : "打了个平手";
  const ledger = match.campaign.history.slice(-14);
  return <MobileScroll className="app-screen duel-scroll"><main className="duel-summary match-summary">
    <p className="duel-eyebrow">对抗局 · 打烊</p>
    <h1>{verdict}</h1>
    <div className="match-scoreboard">
      <div className={summary.winner === "player" ? "win" : ""}><span>许愿</span><b>{yuan(summary.playerSales)}</b><small>{summary.playerServed} 位 · {summary.playerUnits} 件</small></div>
      <div className={summary.winner === "rival" ? "win" : ""}><span>陆遥</span><b>{yuan(summary.rivalSales)}</b><small>{summary.rivalServed} 位 · {summary.rivalUnits} 件</small></div>
    </div>
    <p className="duel-ledger-line">当日盘面 {yuan(summary.pot)}，柜台总共吃下 {yuan(match.campaign.sales)}。</p>
    {match.rival.log.length > 0 && <section className="duel-ledger"><b>她的动线</b>{match.rival.log.map((line, i) => <p key={i}>{line}</p>)}</section>}
    <section className="duel-ledger receipt"><b>今天的账</b>{ledger.map(item => <p key={item.text}>{item.text}</p>)}</section>
    {best && best.summary.playerSales > 0 && <p className="duel-copy">历史最佳：{yuan(best.summary.playerSales)}</p>}
    <button className="duel-primary" type="button" onClick={() => {
      const nextSeed = `${Date.now()}`;
      setSeed(nextSeed);
      setMatch(startMatch(nextSeed));
      setOutcome(null);
      setScreen("floor");
      sfx("tap");
    }}>再开一局</button>
  </main></MobileScroll>;
}

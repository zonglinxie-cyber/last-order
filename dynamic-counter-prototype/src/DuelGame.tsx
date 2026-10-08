import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MobileScroll } from "./mobile";
import {
  addMember, availableCustomers, BUNDLES, canAddMember, canLeaveSample, complianceWord,
  COMPLIANCE_RISK, counterVerdict, CUSTOMERS, DAYS, dayEvent, dawnNotices, endingTitle,
  ENERGY_LOCK, fitOf, historyByDay, INITIAL, openFloorState, parseCampaign, patienceLeft,
  PRODUCTS, progressTarget, relationText, revealOf, RIVAL_IDS, settleDayEvent, SPLIT_WORD,
  startNextDay, structureLine, TARGET, todayHistory, TRAIT_LABELS, unknownDemands,
  visibleChoices, type BundleId, type Campaign, type CueId, type CustomerId, type EventChoice,
  type ProductId, type SaleOutcome,
} from "./campaign";
import {
  DUEL_BUNDLE_AT, DUEL_CUES, DUEL_CLOSE_MIN, DUEL_GUIDE_KEY, DUEL_SAVE_KEY,
  duelClose, duelForce, duelLook, duelMulligan, duelPlay, duelSendAway, duelTrial, duelTriggerRival,
  duelUnlockedBundles, startDuel, type DuelCard, type DuelSide, type DuelState,
} from "./duel";
import { sfx, sfxMute, sfxMuted } from "./sfx";
import "./duel.css";

type DuelScreen = "intro" | "brief" | "floor" | "duel" | "result" | "walked" | "event" | "summary" | "finale";

const PRODUCT_IDS: ProductId[] = ["soft", "glow", "repair"];
const BUNDLE_ORDER: BundleId[] = ["single", "pair", "set", "bulk"];
const CARD_TAG: Record<DuelCard["kind"], string> = { ask: "问", catch: "接", sample: "样", overpromise: "夸", pitch: "讲", rival: "应" };
const CARD_HINT: Partial<Record<DuelCard["kind"], string>> = { catch: "+8", sample: "+10 · 1 支", overpromise: "+25 · 合规 −8" };

// 咨询近景板是 853×1844，三个线索点与面部中线的图片坐标由 art/blender-export.md 锁死。
// 脸上热区不按容器百分比贴：先算 object-fit:cover 的实际缩放与裁切，再换算回容器像素。
const FACE_PLATE = { w: 853, h: 1844 };
const FACE_FOCUS_Y = 0.41; // object-position 的纵向锚点：取景以眼下—鼻翼—脸颊这一段的中心为准
const FACE_OBJECT_POSITION = `50% ${Math.round(FACE_FOCUS_Y * 100)}%`;
const CUE_SPOTS: Record<CueId, { x: number; y: number }> = {
  eyes: { x: 278, y: 686 }, cheek: { x: 618, y: 834 }, nose: { x: 432, y: 815 },
};
const FACE_MIDLINE_X = 432;

// object-fit:cover + object-position 50% f% 的换算：图片坐标 (x,y) → 容器像素。
function facePoint(spot: { x: number; y: number }, box: { w: number; h: number }) {
  const scale = Math.max(box.w / FACE_PLATE.w, box.h / FACE_PLATE.h);
  return {
    x: spot.x * scale + (box.w - FACE_PLATE.w * scale) * 0.5,
    y: spot.y * scale + (box.h - FACE_PLATE.h * scale) * FACE_FOCUS_Y,
  };
}

function loadDuel(): Campaign | null {
  try { return parseCampaign(window.localStorage.getItem(DUEL_SAVE_KEY)); } catch { return null; }
}
function saveDuel(s: Campaign) {
  try { window.localStorage.setItem(DUEL_SAVE_KEY, JSON.stringify(s)); } catch { /* 私密模式存不进就不存 */ }
}
const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;

export default function DuelGame() {
  // 落盘只在两位顾客之间：对局开始前存一份快照，刷新回到那一手；对局过程不落盘。
  const restored = useMemo(() => {
    const saved = loadDuel();
    return saved ? openFloorState(saved) : null;
  }, []);
  const [campaign, setCampaign] = useState<Campaign>(restored ?? INITIAL);
  const [screen, setScreen] = useState<DuelScreen>(() =>
    !restored ? "intro" : restored.finished ? "finale"
      : restored.eventDoneDays.includes(restored.day) ? "summary" : "floor");
  const [duel, setDuel] = useState<DuelState | null>(null);
  const [outcome, setOutcome] = useState<SaleOutcome | null>(null);
  const [chosenEvent, setChosenEvent] = useState<EventChoice | null>(null);
  const [muted, setMuted] = useState(sfxMuted());
  const [closeArmed, setCloseArmed] = useState(false);
  const [armedProduct, setArmedProduct] = useState<ProductId | null>(null);
  const [ghost, setGhost] = useState<{ product: ProductId; x: number; y: number } | null>(null);
  const [guideStep, setGuideStep] = useState<number>(() => {
    try { return window.localStorage.getItem(DUEL_GUIDE_KEY) ? 9 : 0; } catch { return 0; }
  });
  const faceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ product: ProductId; x: number; y: number } | null>(null);
  const [shownAmount, setShownAmount] = useState(0);
  const [faceBox, setFaceBox] = useState<{ w: number; h: number } | null>(null);
  const [resultProduct, setResultProduct] = useState<ProductId | null>(null);

  // 脸框实际尺寸是 flex 决定的：量出来，点位才能按图片坐标换算。
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

  const story = DAYS[campaign.day - 1] ?? DAYS[DAYS.length - 1];
  const available = availableCustomers(campaign);
  const customer = duel ? CUSTOMERS[duel.customerId] : null;
  const session = campaign.activeSession;

  useEffect(() => {
    if (screen === "duel" || screen === "intro") return;
    saveDuel(campaign);
  }, [campaign, screen]);

  // 没人可接就直接进闭店事件，不需要玩家发现"点谁都没反应"。
  useEffect(() => {
    if (screen === "floor" && !available.length) setScreen("event");
  }, [screen, available.length]);

  // 她走了 → 灰屏，门铃。
  useEffect(() => {
    if (duel?.walked && screen === "duel") { sfx("bell"); setScreen("walked"); }
  }, [duel, screen]);

  // 金额滚上去的那一下。
  useEffect(() => {
    if (screen !== "result" || !outcome) return;
    sfx("register");
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

  const doneGuide = () => {
    setGuideStep(9);
    try { window.localStorage.setItem(DUEL_GUIDE_KEY, "1"); } catch { /* 同上 */ }
  };
  const guiding = guideStep < 3 && campaign.day === 1;

  const playDeltaSfx = (before: number, after: number) => {
    if (after > before) sfx("up");
    else if (after < before) sfx("down");
  };
  const applyDuelResult = (res: { campaign: Campaign; duel: DuelState } | null, sound: "tap" | "card" | "brush" = "card") => {
    if (!res || !duel) return;
    sfx(sound);
    playDeltaSfx(duel.interest, res.duel.interest);
    setCampaign(res.campaign);
    setDuel(res.duel);
  };

  const beginCustomer = (id: CustomerId) => {
    saveDuel(campaign); // 对局前的快照：刷新就回到这一手。
    const started = startDuel(campaign, id);
    if (!started) return;
    setCampaign(started.campaign);
    setDuel(started.duel);
    setOutcome(null);
    setCloseArmed(false);
    setArmedProduct(null);
    setScreen("duel");
    sfx("tap");
  };

  const look = (cue: CueId) => {
    if (!duel) return;
    applyDuelResult(duelLook(campaign, duel, cue), "tap");
    if (guiding && guideStep === 0) setGuideStep(1);
  };

  const playCard = (card: DuelCard) => {
    if (!duel) return;
    applyDuelResult(duelPlay(campaign, duel, card.id));
    if (guiding && guideStep <= 1) setGuideStep(2);
  };

  const applyTrial = (product: ProductId, side: DuelSide) => {
    if (!duel) return;
    applyDuelResult(duelTrial(campaign, duel, product, side), "brush");
    setArmedProduct(null);
    if (guiding) doneGuide();
  };

  const mulligan = () => { if (duel) applyDuelResult(duelMulligan(campaign, duel)); };

  const isRival = duel ? RIVAL_IDS.includes(duel.customerId) : false;
  const ensureRival = () => {
    if (!duel || !isRival || duel.rivalDone) return false;
    const triggered = duelTriggerRival(duel);
    if (triggered) { sfx("down"); setDuel(triggered); return true; }
    return false;
  };
  const tryClose = (bundle: BundleId) => {
    if (!duel || ensureRival()) return;
    const res = duelClose(campaign, duel, bundle);
    if (!res) return;
    setResultProduct(duel.current);
    setCampaign(res.campaign);
    setOutcome(res.outcome);
    setDuel(null);
    setScreen("result");
  };
  const tryForce = () => {
    if (!duel || ensureRival()) return;
    const res = duelForce(campaign, duel);
    if (!res) return;
    setResultProduct(duel.current);
    setCampaign(res.campaign);
    setOutcome(res.outcome);
    setDuel(null);
    setScreen("result");
  };
  const sendAway = () => {
    if (!duel) return;
    applyDuelResult(duelSendAway(campaign, duel), "card");
  };

  const backToFloor = () => {
    setDuel(null);
    setOutcome(null);
    setScreen(availableCustomers(campaign).length ? "floor" : "event");
  };
  const chooseEvent = (id: string) => {
    const pick = visibleChoices(campaign, dayEvent(campaign)).find(choice => choice.id === id);
    if (!pick) return;
    setChosenEvent(pick);
    setCampaign(state => settleDayEvent(state, id));
  };
  const nextDay = () => {
    const next = startNextDay(campaign);
    setChosenEvent(null);
    setCampaign(next);
    setScreen(next.finished ? "finale" : "brief");
  };

  // 拖拽上脸：pointer capture 让拖动轨迹落在半张脸上；位移小于 8px 当作点选（退路是点产品再点半张脸）。
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

  if (screen === "intro") {
    return <MobileScroll className="app-screen duel-scroll"><main className="duel-intro">
      <p className="duel-eyebrow">最后一单 · 话术牌局</p>
      <h1>把话说进她心里</h1>
      <p className="duel-copy">每一位顾客是一场牌局：看脸找线索，打牌接话，把产品拖上她的半张脸。她肯不肯掏卡，看她信你几分。</p>
      <button className="duel-primary" type="button" onClick={() => { sfx("register"); setCampaign(INITIAL); setScreen("brief"); }}>开始新品活动周</button>
      {restored && !restored.finished && <button className="duel-ghost-btn" type="button" onClick={() => setScreen("floor")}>继续上次 · 第 {restored.day} 天</button>}
    </main></MobileScroll>;
  }

  if (screen === "brief") {
    const notices = dawnNotices(campaign).slice(0, 3);
    const need = progressTarget(campaign.day - 1);
    return <div className="duel-page"><MobileScroll className="duel-scroll"><main className="duel-brief">
      <p className="duel-eyebrow">DAY {campaign.day} / 5 · 晨会</p>
      <h1>{story.title}</h1>
      <p className="duel-subtitle">{story.subtitle}</p>
      <p className="duel-copy">{story.brief}</p>
      {need > 0 && <p className="duel-ledger-line">昨天收工的线是 {yuan(need)}，你账上 {yuan(campaign.sales)}。</p>}
      <ul className="duel-notices">{notices.map((note, i) => <li key={i}><b>{note.speaker}</b><span>{note.body}</span></li>)}</ul>
      <div className="duel-brief-stage"><img src="/assets/game/counter-stage-toy.png" alt="" aria-hidden="true" draggable={false} /><i>绮光专柜 · 早班</i></div>
    </main></MobileScroll>
      <footer className="duel-page-foot"><button className="duel-primary" type="button" onClick={() => { setCampaign(state => openFloorState(state)); setScreen("floor"); }}>开始营业</button></footer>
    </div>;
  }

  if (screen === "floor") {
    return <div className="duel-page duel-floor-page">
      <main className="duel-floor">
        <header className="duel-floor-head">
          <p className="duel-eyebrow">DAY {campaign.day} · {story.title}</p>
          <h1>{story.subtitle}</h1>
          <p className="duel-ledger-line">{campaign.sales < TARGET ? `五日目标还差 ${yuan(TARGET - campaign.sales)}` : `五日 ${yuan(TARGET)} 已经做到`}</p>
        </header>
        <div className="duel-stage">
          <img className="duel-stage-bg" src="/assets/game/counter-stage-toy.png" alt="" aria-hidden="true" draggable={false} />
          <div className="duel-stage-row">
            {available.map(id => {
              const her = CUSTOMERS[id];
              const left = patienceLeft(campaign, id);
              const locked = campaign.energy < ENERGY_LOCK;
              const hearts = Math.ceil(Math.min(1, Math.max(0, left / her.patience)) * 5);
              const low = hearts <= 1;
              return <button type="button" className={`duel-stander ${low ? "low" : ""}`} key={id} disabled={locked} onClick={() => beginCustomer(id)}>
                <img src={her.portrait} alt="" aria-hidden="true" draggable={false} />
                <span className="duel-stander-tag">
                  <b>{her.name}</b>
                  <span className="duel-hearts" aria-label={locked ? "体力见底，接不了下一位" : `耐心还剩约 ${Math.ceil(left)} 分钟`}>
                    {Array.from({ length: 5 }, (_, i) => <i key={i} className={i < hearts ? "on" : ""} />)}
                  </span>
                  <em>{locked ? "体力见底" : low ? "她快等不住了" : her.descriptor}</em>
                </span>
              </button>;
            })}
          </div>
        </div>
      </main>
      <footer className="duel-page-foot duel-mute-row"><button className="duel-ghost-btn" type="button" onClick={() => { const next = !muted; sfxMute(next); setMuted(next); }}>{muted ? "开声音" : "静音"}</button></footer>
    </div>;
  }

  if (screen === "duel" && duel && customer && session) {
    const closable = duel.interest >= DUEL_CLOSE_MIN && session.tested && !duel.rivalPending;
    const known = revealOf(customer, session.discovered, session.revealed);
    const knownTags = customer.demands.filter(d => known.has(d.trait));
    const unknownCount = unknownDemands(customer, known).length;
    const lastLine = [...duel.log].reverse().find(entry => entry.text)?.text ?? customer.opening;
    const floats = duel.log.map((entry, i) => ({ entry, i })).filter(item => item.entry.delta).slice(-4);
    const halfClass = (side: DuelSide) => {
      const p = duel.trials[side];
      if (!p) return "";
      return `half-${p} half-${fitOf(customer, p).tier}`;
    };
    const canAct = !duel.rivalPending && !duel.walked && !duel.lastCall && duel.round < duel.rounds;
    const cardDisabled = (card: DuelCard) =>
      duel.rivalPending ? card.kind !== "rival"
        : card.kind === "rival" || (card.kind === "sample" && !canLeaveSample(campaign, duel.customerId)) || (card.kind === "pitch" && (duel.pitchUsed || !duel.current)) || duel.round >= duel.rounds || duel.lastCall;
    const guideText = ["点她脸上一处，找她在意什么", "打一张牌接住她", "把一支产品拖到她半张脸"][guideStep] ?? null;
    return <div className="duel-screen">
      <header className="duel-top">
        <b>{customer.name}</b><span>{customer.descriptor}</span>
        <i className="duel-rounds" aria-label={`第 ${duel.round + 1} 回合，共 ${duel.rounds} 回合`}>
          {Array.from({ length: duel.rounds }, (_, i) => <em key={i} className={i < duel.round ? "used" : ""} />)}
        </i>
        <button className="duel-mute" type="button" aria-label={muted ? "开声音" : "静音"} onClick={() => { const next = !muted; sfxMute(next); setMuted(next); }}>{muted ? "静" : "声"}</button>
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
      {guiding && guideText && <div className="duel-guide"><p>{guideText}</p><button type="button" onClick={doneGuide}>跳过引导</button></div>}
      {ghost && <div className="duel-ghost" style={{ left: ghost.x, top: ghost.y }}><span className={`product-art product-art-${ghost.product}`} /></div>}
    </div>;
  }

  if (screen === "walked" && duel) {
    const her = CUSTOMERS[duel.customerId];
    return <MobileScroll className="app-screen duel-scroll"><main className="duel-result walked">
      <p className="duel-eyebrow">DAY {campaign.day} · 她走了</p>
      <div className="duel-result-face"><img src={her.portrait} alt="" aria-hidden="true" draggable={false} /></div>
      <h1>{her.name}没等到你</h1>
      <p className="duel-copy">{her.lostLine}</p>
      <button className="duel-primary" type="button" onClick={backToFloor}>回到柜台</button>
    </main></MobileScroll>;
  }

  if (screen === "result" && outcome) {
    const her = CUSTOMERS[campaign.dayServed[campaign.dayServed.length - 1] ?? "shen"];
    return <MobileScroll className="app-screen duel-scroll"><main className={`duel-result ${outcome.units > 0 ? "good" : "bad"}`}>
      <p className="duel-eyebrow">DAY {campaign.day} · 收银提示</p>
      <div className="duel-result-face"><img src={her.portrait} alt="" aria-hidden="true" draggable={false} /></div>
      <h1>{outcome.title}</h1>
      {outcome.units > 0 && <div className="duel-result-line">
        {resultProduct && <span className={`product-art product-art-${resultProduct}`} />}
        <b>{PRODUCTS[resultProduct ?? "soft"].name} × {outcome.units} 件</b>
      </div>}
      <strong className="duel-amount">+ ¥{shownAmount.toLocaleString("zh-CN")}</strong>
      <div className={`duel-seal ${outcome.units > 0 ? "stamp" : ""}`}>{outcome.units > 0 ? (outcome.shared ? SPLIT_WORD : "记在你名下") : "没买成"}</div>
      <p className="duel-copy">{outcome.body}</p>
      {canAddMember(campaign, her.id) && <button className="duel-ghost-btn" type="button" onClick={() => setCampaign(s => addMember(s, her.id))}>加微信 · 占 1 分钟</button>}
      <button className="duel-primary" type="button" onClick={backToFloor}>{availableCustomers(campaign).length ? "回到现场" : "处理闭店事件"}</button>
    </main></MobileScroll>;
  }

  if (screen === "event") {
    const event = dayEvent(campaign);
    const shownChoices = visibleChoices(campaign, event);
    const speakerImg = event.speakerStaff ? `/assets/game/staff-portraits/${event.speakerStaff}.png`
      : event.speakerCustomer ? CUSTOMERS[event.speakerCustomer].portrait : null;
    return <div className="duel-page"><MobileScroll className="duel-scroll"><main className="duel-event">
      <p className="duel-eyebrow">闭店后 · {event.speaker}</p>
      {speakerImg && <div className="duel-speaker"><img src={speakerImg} alt="" aria-hidden="true" draggable={false} /><b>{event.speaker}</b></div>}
      <h1>{event.title}</h1>
      <p className="duel-copy">{event.body}</p>
      {!chosenEvent ? <div className="duel-event-choices">{shownChoices.map(choice => (
        <button type="button" key={choice.id} className="duel-choice" onClick={() => chooseEvent(choice.id)}>
          <b>{choice.label}</b><span>{choice.detail}</span>
        </button>))}</div>
        : <section className="duel-event-result"><b>{chosenEvent.label}</b><p className="duel-copy">{chosenEvent.result}</p></section>}
    </main></MobileScroll>
      {chosenEvent && <footer className="duel-page-foot"><button className="duel-primary" type="button" onClick={() => setScreen("summary")}>查看今日账单</button></footer>}
    </div>;
  }

  if (screen === "summary") {
    const tomorrow = campaign.day < 5 ? progressTarget(campaign.day + 1) : null;
    return <MobileScroll className="app-screen duel-scroll"><main className="duel-summary">
      <p className="duel-eyebrow">DAY {campaign.day} · 今日结束</p>
      <div className="duel-speaker"><img src="/assets/game/staff-portraits/xuyuan.png" alt="" aria-hidden="true" draggable={false} /><b>许愿 · 收工</b></div>
      <h1>今日流水 {yuan(campaign.daySales)}</h1>
      {tomorrow !== null && <p className="duel-ledger-line">明天收工前累计要到 {yuan(tomorrow)}，你账上 {yuan(campaign.sales)}。</p>}
      <section className="duel-ledger receipt"><b>今天留下的事</b>{todayHistory(campaign).map(item => <p key={item.text}>{item.text}</p>)}</section>
      <p className={`duel-compliance ${campaign.compliance < COMPLIANCE_RISK ? "at-risk" : ""}`}>{complianceWord(campaign.compliance)}</p>
      <button className="duel-primary" type="button" onClick={nextDay}>{campaign.day === 5 ? "查看活动周结局" : "进入下一天"}</button>
    </main></MobileScroll>;
  }

  const title = endingTitle(campaign);
  const counter = counterVerdict(campaign);
  return <div className="duel-page"><MobileScroll className="duel-scroll"><main className="duel-finale">
    <p className="duel-eyebrow">新品活动周 · 最终档案</p>
    <h1>{title}</h1>
    <div className="duel-final-score"><span>销售</span><b>{yuan(campaign.sales)}</b><small>{campaign.sales >= TARGET ? "完成五日目标" : `目标 ${yuan(TARGET)}`}</small></div>
    <p className="duel-copy">{structureLine(campaign)}</p>
    <p className="duel-copy">苏蔓：{relationText(campaign.relations.suman)}；唐可：{relationText(campaign.relations.tangke)}。</p>
    <p className="duel-compliance"><b>柜位 · {counter.label}</b>{counter.body}</p>
    <section className="duel-ledger">{historyByDay(campaign).map(group => <div key={group.day}><b>{group.title}</b>{group.items.map(item => <p key={item.text}>{item.text}</p>)}</div>)}</section>
    <button className="duel-primary" type="button" onClick={() => { try { window.localStorage.removeItem(DUEL_SAVE_KEY); } catch { /* 同上 */ } setCampaign(INITIAL); setScreen("intro"); }}>再打一周</button>
  </main></MobileScroll></div>;
}

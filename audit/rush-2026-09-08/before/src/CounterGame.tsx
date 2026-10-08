import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  advanceFloorTime, askService, availableCustomers, closeService, CUSTOMERS, DAYS, dayEvent,
  dawnNotices, endingTitle, ENERGY_LOCK, hasFlag, historyByDay, INITIAL, leaveSample,
  observeService, openFloorState, orderQuote, parseCampaign, PRODUCTS, QUESTIONS, REACTIONS,
  relationText, releaseService, requestStaffHelp, respondToRival, RIVAL_IDS, RIVAL_INTERRUPTIONS,
  SAVE_KEY, selectServiceProduct, settleDayEvent, spendAttention, startNextDay, startService,
  TARGET, trialService, type Campaign, type CueId, type CustomerId, type ProductId, type SaleOutcome,
} from "../dynamic-counter-prototype/src/campaign";
import { asset } from "./sim/asset";
import "./rescue.css";

type Screen = "intro" | "brief" | "floor" | "consultation" | "result" | "event" | "summary" | "finale";
type StaffId = "player" | "luyao" | "roman" | "suman" | "tangke";
type Focus = CustomerId | StaffId;
const STAFF: Record<StaffId, { name: string; role: string; art: string; x: number; y: number }> = {
  player: { name: "许愿", role: "试用期柜姐 · 你", art: "xuyuan", x: 25, y: 66 },
  luyao: { name: "陆遥", role: "竞品销冠", art: "luyao", x: 69, y: 47 },
  roman: { name: "罗曼", role: "柜长", art: "roman", x: 48, y: 27 },
  suman: { name: "苏蔓", role: "资深柜姐", art: "suman", x: 13, y: 60 },
  tangke: { name: "唐可", role: "同期新人", art: "tangke", x: 58, y: 76 },
};
const CUES: Array<{ id: CueId; label: string }> = [
  { id: "eyes", label: "眼下" }, { id: "cheek", label: "脸颊" }, { id: "nose", label: "鼻翼" },
];
const money = (value: number) => "¥" + value.toLocaleString("zh-CN");
const isCustomer = (id: Focus): id is CustomerId => Object.hasOwn(CUSTOMERS, id);
const portrait = (id: CustomerId) => asset("assets/aurora/" + CUSTOMERS[id].portrait.split("/").at(-1));
const customerArt = (id: CustomerId) => asset("assets/chibi/" + (id === "returning" ? "shen" : id === "zhou2" ? "zhou" : id) + ".png");
function load() {
  try { const saved = parseCampaign(localStorage.getItem(SAVE_KEY)); return saved ? openFloorState(saved) : null; }
  catch { return null; }
}
function restoredScreen(game: Campaign): Screen {
  if (game.finished) return "finale";
  if (game.eventDoneDays.includes(game.day)) return "summary";
  if (game.activeSession && availableCustomers(game).includes(game.activeSession.customerId)) return "consultation";
  return availableCustomers(game).length ? "floor" : "event";
}
function Quote({ game, id, product }: { game: Campaign; id: CustomerId; product: ProductId }) {
  const quote = orderQuote(id, product, game.activeSession?.rivalChoice === "yield");
  return <section className="order-quote" aria-label="本单报价">
    <div><b>本单报价</b><span>{quote.shared ? "与陆遥各记一半" : "记入你的业绩"}</span></div>
    {quote.lines.map(line => <p key={line.label}><span>{line.label}</span><span>{money(line.amount)}</span></p>)}
    <p className="quote-total"><span>整单 {money(quote.total)}</span><strong>你入账 {money(quote.amount)}</strong></p>
    {quote.risky && <small>试用反应不佳。强推会留下售后风险，小样不改变产品适配。</small>}
  </section>;
}

export default function CounterGame() {
  const [saved] = useState(load);
  const [game, setGame] = useState<Campaign>(saved ?? INITIAL);
  const [screen, setScreen] = useState<Screen>(() => saved ? restoredScreen(saved) : "intro");
  const [focus, setFocus] = useState<Focus>(saved?.activeSession?.customerId ?? (saved ? availableCustomers(saved)[0] : "shen") ?? "player");
  const [speed, setSpeed] = useState<0 | 1 | 2 | 4>(0);
  const [draft, setDraft] = useState("");
  const [revising, setRevising] = useState(false);
  const [outcome, setOutcome] = useState<SaleOutcome | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [sceneSize, setSceneSize] = useState({ width: 900, height: 480 });
  const [mapRatio, setMapRatio] = useState(1.55);
  const latest = useRef(game);
  latest.current = game;
  const session = game.activeSession;
  const customer = session ? CUSTOMERS[session.customerId] : null;
  const selectedCustomer = isCustomer(focus) ? CUSTOMERS[focus] : null;
  const selectedStaff = !isCustomer(focus) ? STAFF[focus] : null;
  const available = availableCustomers(game);
  const todayIds = [...new Set([...DAYS[game.day - 1].customers, ...available, ...game.dayServed, ...game.lost])];
  const story = DAYS[game.day - 1], event = dayEvent(game), notices = dawnNotices(game);
  const pendingRival = Boolean(session?.tested && RIVAL_IDS.includes(session.customerId) && !session.rivalChoice);
  const rival = customer && RIVAL_IDS.includes(customer.id) ? RIVAL_INTERRUPTIONS[customer.id as keyof typeof RIVAL_INTERRUPTIONS] : null;
  const lastCue = session?.discovered.at(-1);
  const showProducts = Boolean(session && session.askedQuestion !== null && (!session.tested || revising) && !pendingRival);
  const stage = !session || session.discovered.length < 2 ? 0 : session.askedQuestion === null ? 1 : !session.tested ? 2 : 3;
  const clockMinutes = 19 * 60 + game.shiftMinutes;
  const clock = String(Math.floor(clockMinutes / 60) % 24).padStart(2, "0") + ":" + String(Math.floor(clockMinutes % 60)).padStart(2, "0");

  useEffect(() => {
    if (screen === "intro") return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); setSaveError(false); } catch { setSaveError(true); }
  }, [game, screen]);
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) setSpeed(0);
      if (screen !== "intro") {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(latest.current)); } catch { setSaveError(true); }
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onHide); };
  }, [screen]);
  useEffect(() => {
    if (screen !== "floor" || speed === 0) return;
    const timer = window.setInterval(() => { if (!document.hidden) setGame(value => advanceFloorTime(value, speed)); }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, speed]);
  useEffect(() => {
    if (screen === "floor" && available.length === 0) { setSpeed(0); setScreen("event"); }
  }, [screen, available.length]);
  useEffect(() => {
    if (!sceneRef.current) return;
    const observer = new ResizeObserver(([entry]) => setSceneSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(sceneRef.current);
    return () => observer.disconnect();
  }, []);

  const begin = () => { setGame(INITIAL); setFocus("shen"); setScreen("brief"); setSpeed(0); setOutcome(null); setConfirmRestart(false); };
  const openFloor = () => { setGame(value => openFloorState(value)); setScreen("floor"); setSpeed(1); };
  const beginCustomer = (id: CustomerId) => {
    if (session && session.customerId !== id) return;
    const next = startService(game, id);
    if (next.activeSession?.customerId !== id) return;
    setGame(next); setFocus(id); setScreen("consultation"); setRevising(false); setDraft("");
  };
  const ask = (text: string, index?: number) => { setGame(value => askService(value, text, index)); setDraft(""); };
  const close = (force = false) => {
    const result = closeService(game, force);
    if (!result) return;
    setGame(result.campaign); setOutcome(result.outcome); setScreen("result"); setRevising(false);
  };
  const endFloor = () => {
    setGame(value => spendAttention(value, null, Math.max(1, ...availableCustomers(value).map(id => value.waitMeters[id] ?? CUSTOMERS[id].patience))));
    setSpeed(0); setScreen("event");
  };
  const nextDay = () => {
    const next = startNextDay(game);
    setGame(next); setSpeed(0); setOutcome(null); setDraft(""); setCamera({ x: 0, y: 0 });
    setFocus(availableCustomers(next)[0] ?? "player"); setScreen(next.finished ? "finale" : "brief");
  };
  const moveCamera = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setCamera({ x: drag.current.cx + e.clientX - drag.current.x, y: drag.current.cy + e.clientY - drag.current.y });
  };
  const customerStatus = (id: CustomerId) => game.dayServed.includes(id) ? "已接待" : game.lost.includes(id) ? "已离开" :
    session?.customerId === id ? "接待中" : (game.waitMeters[id] ?? CUSTOMERS[id].patience) <= 2 ? "开始看表" : "正在等你";
  const customerPoint = (id: CustomerId, index: number) => {
    if (game.dayServed.includes(id)) return { x: 43 + index * 6, y: 38 };
    if (game.lost.includes(id)) return CUSTOMERS[id].rival ? { x: 73, y: 62 } : { x: 66 + index * 5, y: 88 };
    return index === 0 ? { x: 40, y: 65 } : { x: 47, y: 75 };
  };
  const contestedId = available.find(id => CUSTOMERS[id].rival);
  const contestedPoint = contestedId ? customerPoint(contestedId, todayIds.indexOf(contestedId)) : null;
  const pressure = contestedId ? Math.max(0, Math.min(1, 1 - ((game.waitMeters[contestedId] ?? CUSTOMERS[contestedId].patience) - game.floorSeconds / 20) / CUSTOMERS[contestedId].patience)) : 0;
  const canHelp = !hasFlag(game, "help:suman:" + game.day) && game.energy >= 6 && (hasFlag(game, "covered-suman") || game.relations.suman >= 60);

  return <div className={"rescue-game screen-" + screen}>
    <header className="rescue-topbar">
      <div className="rescue-brand"><span className="brand-monogram">AU</span><div><b>最后一单 <span>绮光专柜</span></b><small>第 {game.day} / 5 天 · {story.title}</small></div></div>
      <div className="shift-clock"><strong>{clock}</strong><span>{screen === "floor" ? speed === 0 ? "现场已暂停" : "营业中" : screen === "consultation" ? "接待按动作计时" : "待命"}</span></div>
      <div className="top-score"><span>还差 <b>{money(Math.max(0, TARGET - game.sales))}</b></span><small className={saveError ? "save-failed" : ""}>{saveError ? "保存失败，请勿关闭页面" : screen === "intro" ? "五日销售与人情账" : "已保存到本机"}</small></div>
    </header>
    <div className="rescue-workspace">
      <main ref={sceneRef} className="rescue-scene" aria-label={screen === "consultation" && customer ? "接待" + customer.name : "专柜现场"}>
        {(screen === "floor" || screen === "intro" || screen === "brief") && <>
          <div className="map-viewport" onPointerDown={e => {
            if ((e.target as HTMLElement).closest("button")) return;
            drag.current = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y }; e.currentTarget.setPointerCapture(e.pointerId);
          }} onPointerMove={moveCamera} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <div className="rescue-world" style={{ width: Math.min(sceneSize.width, sceneSize.height * mapRatio), aspectRatio: mapRatio, transform: "translate(" + camera.x + "px," + camera.y + "px)" }}>
              <img className="floor-art" src={asset("assets/scenes/aurora-floor.jpg")} alt="绮光与维珞专柜" onLoad={e => setMapRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} draggable={false} />
              {(Object.keys(STAFF) as StaffId[]).map(id => {
                const staff = STAFF[id];
                const point = id === "luyao" && contestedPoint ? { x: staff.x + (contestedPoint.x + 8 - staff.x) * pressure, y: staff.y + (contestedPoint.y - staff.y) * pressure } : staff;
                return <button key={id} className={"rescue-pawn staff-pawn " + (focus === id ? "selected" : "")} aria-label={"查看" + staff.name} onClick={() => setFocus(id)} style={{ left: point.x + "%", top: point.y + "%", zIndex: Math.round(point.y) }}>
                  {id === "luyao" && pressure > .4 && <span className="pawn-bubble">这位我也可以接。</span>}
                  <img src={asset("assets/chibi/" + staff.art + ".png")} alt="" draggable={false} /><span className="pawn-name">{staff.name}</span>
                </button>;
              })}
              {todayIds.map((id, index) => {
                const c = CUSTOMERS[id], point = customerPoint(id, index), gone = game.lost.includes(id), done = game.dayServed.includes(id);
                return <button key={id} className={"rescue-pawn customer-pawn " + (focus === id ? "selected " : "") + (gone ? "departed" : done ? "served" : "")} aria-label={"查看" + c.name} onClick={() => setFocus(id)} style={{ left: point.x + "%", top: point.y + "%", zIndex: Math.round(point.y) + 1 }}>
                  {!gone && !done && <span className="pawn-bubble">{(game.waitMeters[id] ?? c.patience) <= 2 ? "我真的要走了。" : id === "shen" ? "先说好，我不缺粉底。" : id === "mei" ? "我只有十分钟。" : c.opening}</span>}
                  <img src={customerArt(id)} alt="" draggable={false} /><span className="pawn-name">{c.name}<small>{customerStatus(id)}</small></span>
                </button>;
              })}
            </div>
          </div>
          {screen === "floor" && <div className="scene-controls"><div className="time-controls" aria-label="现场时间">{([0, 1, 2, 4] as const).map(value => <button key={value} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value === 0 ? "暂停" : value + "×"}</button>)}</div><button onClick={() => setCamera({ x: 0, y: 0 })}>复位视角</button><span>选人了解情况，再开始接待</span></div>}
          {(screen === "intro" || screen === "brief") && <section className="shift-intro">
            <span className="eyebrow">{screen === "intro" ? "美妆销售 · 人情博弈" : "DAY " + game.day + " / 5"}</span><h1>{screen === "intro" ? "最后一单" : story.title}</h1>
            <p>{screen === "intro" ? "你是试用期柜姐许愿。五天内补齐业绩，也要记住每笔订单背后的人。" : story.brief}</p>
            {notices.map((note, index) => <blockquote key={index}><b>{note.speaker}</b>{note.body}</blockquote>)}
            <div className="brief-target"><span>五日目标 <b>{money(TARGET)}</b></span><span>已完成 <b>{money(game.sales)}</b></span></div>
            <p className="small-copy">现场等待会消耗耐心。接待时可以仔细想，观察、提问和试用各花一分钟。</p>
            <button className="gold-button" onClick={screen === "intro" ? begin : openFloor}>{screen === "intro" ? "开始新品活动周" : "开始营业"}</button>
          </section>}
        </>}
        {screen === "consultation" && customer && session && <div className="consult-scene">
          <div className="portrait-window"><div className="portrait-plate">
            <img src={portrait(customer.id)} alt={customer.name + "面部近景"} />
            {CUES.map(cue => <button key={cue.id} aria-label={"面部线索：" + cue.label} className={"portrait-cue cue-" + cue.id + (session.discovered.includes(cue.id) ? " found" : "")} onClick={() => setGame(value => observeService(value, cue.id))}><span>{session.discovered.includes(cue.id) ? "✓" : "+"}</span></button>)}
          </div><button className="back-floor" onClick={() => setScreen("floor")}>返回现场</button></div>
          <section className="customer-reading"><span className="eyebrow">{customer.descriptor}</span><h1>{customer.name}</h1><blockquote>{session.chat.at(-1)?.text ?? customer.opening}</blockquote>
            {lastCue && <p className="reading-finding"><b>{customer.cues[lastCue].label}</b>{customer.cues[lastCue].finding}</p>}
            <div className="outside-pressure"><b>柜台另一边</b>{available.filter(id => id !== customer.id).map(id => <p key={id}>{CUSTOMERS[id].name} · {customerStatus(id)}</p>)}{available.length === 1 && <p>其他机会已经结束。这一位仍在等你的判断。</p>}</div>
          </section>
        </div>}
        {screen === "result" && outcome && <section className={"story-panel sale-panel " + (outcome.good ? "sale-good" : "sale-risky")}><span className="eyebrow">本次接待 · 收银记录</span><h1>{outcome.title}</h1><strong className="large-number">+ {money(outcome.amount)}</strong><p>{outcome.body}</p><div className="result-metrics"><span>信任 <b>{relationText(game.trust)}</b></span><span>体力 <b>{game.energy} / 100</b></span><span>小样 <b>{game.samples} 份</b></span></div></section>}
        {screen === "event" && <section className="story-panel event-panel"><span className="eyebrow">闭店 · {event.speaker}</span><h1>{event.title}</h1><p>{event.body}</p><span className="story-footnote">这次选择会进入账本，并改变之后几天的现场。</span></section>}
        {(screen === "summary" || screen === "finale") && <section className="story-panel ledger-panel">
          <span className="eyebrow">{screen === "finale" ? "新品活动周 · 最终结算" : "DAY " + game.day + " · 今日账本"}</span><h1>{screen === "finale" ? endingTitle(game) : "今天的单，明天的账"}</h1><strong className="large-number">{money(game.sales)} <small>/ {money(TARGET)}</small></strong>
          <div className="ledger-book" aria-label="因果账本">{historyByDay(game).filter(group => screen === "finale" || group.day === game.day).map(group => <section key={group.day}><h2>DAY {group.day} · {group.title}</h2>{group.items.map((item, index) => <p key={index}>{item.text}</p>)}</section>)}
            {game.orders.filter(order => screen === "finale" || order.day === game.day).map((order, index) => <p className="order-line" key={index}>D{order.day} · {CUSTOMERS[order.customerId].name} · {PRODUCTS[order.product].short} · {money(order.amount)}{order.shared ? "（拼单后入账）" : ""}{order.risky ? " · 售后风险已记录" : ""}</p>)}
          </div>
        </section>}
      </main>
      <aside className="rescue-rail">
        <section className="shift-overview"><span className="eyebrow">今天的柜台</span><p className="rail-sales">{money(game.daySales)} <small>今日净业绩</small></p><div className="target-track"><i style={{ width: Math.min(100, game.sales / TARGET * 100) + "%" }} /></div><p className="rail-detail">体力 {game.energy} · 小样 {game.samples} · 合规 {game.compliance}</p></section>
        <section className="customer-list"><span className="eyebrow">顾客</span>{todayIds.map(id => <button key={id} onClick={() => setFocus(id)} className={focus === id ? "is-selected" : ""}><img src={portrait(id)} alt="" /><span><b>{CUSTOMERS[id].name}</b><small>{customerStatus(id)}</small></span><span className={"status-dot " + (game.lost.includes(id) ? "lost" : game.dayServed.includes(id) ? "done" : "")} /></button>)}</section>
        <section className="floor-journal"><span className="eyebrow">刚刚发生</span>{game.history.slice(-5).reverse().map((entry, index) => <p key={index}><small>D{entry.day}</small>{entry.text}</p>)}{game.history.length === 0 && <p>陆遥正在留意入口。先接谁，由你决定。</p>}</section>
        <button className="restart-link" onClick={() => { setSpeed(0); setConfirmRestart(true); }}>重新开始</button>
      </aside>
    </div>
    <footer className="rescue-dock">
      <section className="dock-person"><img src={screen === "consultation" && customer ? portrait(customer.id) : selectedCustomer ? portrait(selectedCustomer.id) : asset("assets/aurora/" + (selectedStaff?.art ?? "xuyuan") + ".png")} alt="" /><div><small>{screen === "consultation" && customer ? customer.descriptor : selectedCustomer?.descriptor ?? selectedStaff?.role}</small><h2>{screen === "consultation" && customer ? customer.name : selectedCustomer?.name ?? selectedStaff?.name}</h2><p>{screen === "consultation" && session ? session.discovered.length + " / 3 处线索 · 体力 " + game.energy : selectedCustomer ? customerStatus(selectedCustomer.id) : "选择与人情都会留下记录"}</p></div></section>
      <div className="dock-content">
        {screen === "floor" && selectedCustomer && <div className="floor-inspect"><div><span className="eyebrow">她正在说</span><p>{selectedCustomer.opening}</p></div>
          {available.includes(selectedCustomer.id) ? <div className="floor-actions">
            <button className="gold-button" disabled={(!session && game.energy < ENERGY_LOCK) || Boolean(session && session.customerId !== selectedCustomer.id)} onClick={() => beginCustomer(selectedCustomer.id)}>{session?.customerId === selectedCustomer.id ? "继续接待" + selectedCustomer.name : "接待" + selectedCustomer.name}</button>
            <button disabled={game.samples <= 0 || hasFlag(game, "sample:" + selectedCustomer.id)} onClick={() => setGame(value => leaveSample(value, selectedCustomer.id))}>留小样 · {game.samples}</button>
            {canHelp && <button onClick={() => setGame(value => requestStaffHelp(value, selectedCustomer.id))}>请苏蔓帮忙留客</button>}
            {session && session.customerId !== selectedCustomer.id && <p>你还在接待{CUSTOMERS[session.customerId].name}。<button className="text-button" onClick={() => beginCustomer(session.customerId)}>回去接待</button><button className="text-button" onClick={() => setGame(releaseService)}>放下这笔单</button></p>}
            {!session && game.energy < ENERGY_LOCK && <p>体力不足以接新人。<button onClick={endFloor}>结束今日接待</button></p>}
          </div> : <p className="muted">这次机会已经结束。请选择另一位顾客。</p>}
        </div>}
        {screen === "floor" && selectedStaff && <div className="staff-inspect"><h3>{focus === "luyao" ? "她在争取你还没接住的人" : focus === "suman" ? "愿不愿意帮忙，要看之前的账" : focus === "tangke" ? "她也在为转正凑最后的数字" : focus === "roman" ? "业绩与赠品记录，她都在盯" : "看清现场，再决定把时间给谁"}</h3><p>{focus === "suman" ? "关系：" + relationText(game.relations.suman) + (canHelp ? "。她愿意替你多留客一会儿。" : "。帮忙需要之前的人情，这班最多一次。") : story.threat}</p><div className="floor-actions">{available.map(id => <button key={id} onClick={() => setFocus(id)}>看看{CUSTOMERS[id].name}</button>)}</div></div>}
        {screen === "consultation" && customer && session && <section className="service-actions">
          <ol className="service-steps">{["观察", "提问", "试用", "成交"].map((step, index) => <li key={step} className={index === stage ? "current" : index < stage ? "done" : ""}>{index + 1} · {step}</li>)}</ol>
          {stage === 0 && <><h3>先看清两处线索</h3><div className="cue-actions">{CUES.map(cue => <button key={cue.id} aria-label={"观察" + cue.label} aria-pressed={session.discovered.includes(cue.id)} onClick={() => setGame(value => observeService(value, cue.id))}>观察{cue.label}{session.discovered.includes(cue.id) ? " ✓" : ""}</button>)}</div><p className="service-feedback">{lastCue ? customer.cues[lastCue].finding : "点脸部线索，或用上面的按钮观察。另一位客人仍在等你。"}</p></>}
          {stage === 1 && <><h3>问清她真正介意的事</h3><div className="question-choices">{QUESTIONS[customer.id].map((q, index) => <button key={q.label} onClick={() => ask(q.label, index)}>{q.label}</button>)}</div><form className="question-composer" onSubmit={e => { e.preventDefault(); ask(draft); }}><input aria-label="对顾客说" value={draft} onChange={e => setDraft(e.target.value)} maxLength={280} placeholder="也可以用自己的话问她" /><button type="submit" disabled={!draft.trim()}>开口问</button></form></>}
          {showProducts && <><div className="product-choices">{(Object.keys(PRODUCTS) as ProductId[]).map(id => <button key={id} aria-label={PRODUCTS[id].short + " " + money(PRODUCTS[id].price)} aria-pressed={session.selectedProduct === id} onClick={() => { setGame(value => selectServiceProduct(value, id)); setRevising(false); }}><i className={"rescue-product-art product-" + id} /><span><b>{PRODUCTS[id].short}</b><small>{money(PRODUCTS[id].price)} / 件</small><em>{PRODUCTS[id].note}</em></span></button>)}</div><button className="gold-button trial-button" disabled={!session.selectedProduct || session.tested} onClick={() => setGame(trialService)}>为{customer.name}试用</button></>}
          {pendingRival && rival && <div className="rival-decision" aria-label="竞品打断"><div><img src={asset("assets/aurora/luyao.png")} alt="陆遥" /><p><b>{rival.headline}</b><span>“{rival.quote}”</span></p></div><div className="rival-choices">
            <button aria-label="先登记接待" onClick={() => setGame(value => respondToRival(value, "record"))}><b>先登记接待</b><small>留证据 · 体力 −3</small></button><button aria-label="让顾客确认需求" onClick={() => setGame(value => respondToRival(value, "clarify"))}><b>让顾客确认需求</b><small>守住信任 · 体力 −7</small></button><button aria-label="让她演示" onClick={() => setGame(value => respondToRival(value, "yield"))}><b>让她演示</b><small>共同成交 · 业绩各半</small></button>
          </div></div>}
          {session.tested && !pendingRival && !revising && session.selectedProduct && <div className="close-review"><div><p className={"trial-reaction " + session.reaction}>{REACTIONS[session.selectedProduct][session.reaction ?? "negative"]}</p><div className="closing-buttons">
            {session.reaction === "negative" ? <><button onClick={() => setRevising(true)}>换一款</button><button disabled={game.samples <= 0 || hasFlag(game, "sample:" + customer.id)} onClick={() => setGame(value => leaveSample(value, customer.id))}>留小样 · {game.samples}</button><button onClick={() => close(false)}>接受拒绝</button><button className="risk-button" onClick={() => close(true)}>强推成交</button></> : <><button disabled={session.claimed} onClick={() => setGame(value => ({ ...value, activeSession: value.activeSession ? { ...value.activeSession, claimed: true } : null }))}>{session.claimed ? "已登记归属" : "登记我的接待"}</button><button className="gold-button" onClick={() => close()}>提出成交</button></>}
          </div></div><Quote game={game} id={customer.id} product={session.selectedProduct} /></div>}
        </section>}
        {screen === "result" && outcome && <div className="result-next"><p>{available.length ? "还有 " + available.length + " 位顾客。刚才的接待也花掉了她们的等待时间。" : "今天的接待结束了，柜台还有一件事要处理。"}</p><button className="gold-button" onClick={() => { setScreen(available.length ? "floor" : "event"); setFocus(available[0] ?? "suman"); }}>{available.length ? "回到现场" : "处理闭店事件"}</button></div>}
        {screen === "event" && <div className="event-options">{event.choices.filter(choice => !choice.visible || choice.visible(game)).map(choice => <button key={choice.id} onClick={() => { setGame(value => settleDayEvent(value, choice.id)); setScreen("summary"); }}><b>{choice.label}</b><span>{choice.detail}</span></button>)}</div>}
        {screen === "summary" && <div className="result-next"><p>今天的选择已经保存。下一天会带着这些结果开始。</p><button className="gold-button" onClick={nextDay}>{game.day === 5 ? "查看活动周结局" : "进入下一天"}</button></div>}
        {screen === "finale" && <div className="result-next"><p>信任 {relationText(game.trust)} · 合规 {game.compliance} · 苏蔓 {relationText(game.relations.suman)}</p><button className="gold-button" onClick={() => setConfirmRestart(true)}>重新开始 · 换一种活法</button></div>}
        {(screen === "intro" || screen === "brief") && <div className="welcome-note"><h3>看现场 → 选顾客 → 判断与试用 → 守住订单</h3><p>每一笔销售，都决定谁欠你、谁恨你、谁会回来。</p></div>}
      </div>
    </footer>
    {confirmRestart && <div className="dialog-backdrop"><section role="dialog" aria-modal="true" aria-label="重新开始" className="restart-dialog"><h2>重新开始这五天？</h2><p>本机当前进度会被新的一局替换。</p><div><button onClick={() => setConfirmRestart(false)}>继续当前进度</button><button className="gold-button" onClick={begin}>开始新一局</button></div></section></div>}
  </div>;
}

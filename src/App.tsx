import { PointerEvent, useEffect, useMemo, useRef, useState, WheelEvent } from "react";
import { PRODUCTS } from "./sim/cast";
import { CounterSim, roomOf } from "./sim/engine";
import type { Actor, ActorId, ProductId, Speed } from "./sim/types";

const sim = new CounterSim();

function near(a?: Actor | null, b?: Actor | null, range = 10) {
  if (!a || !b) return false;
  return Math.hypot(a.x - b.x, a.y - b.y) < range;
}

function IntentLine({ from, to, kind }: { from: Actor; to: { x: number; y: number }; kind: "gold" | "hot" | "claim" }) {
  return (
    <svg className={`intent ${kind}`} viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
    </svg>
  );
}

function Pawn({ actor, selected, claimed, onSelect }: { actor: Actor; selected: boolean; claimed?: boolean; onSelect: () => void }) {
  const moving = Math.hypot(actor.destX - actor.x, actor.destY - actor.y) > 0.6 || actor.path.length > 0;
  return (
    <button
      type="button"
      className={`pawn ${selected ? "is-selected" : ""} ${moving ? "is-moving" : ""} ${actor.kind} ${actor.status} ${actor.rival ? "is-rival" : ""} ${actor.threatLeft > 0 ? "is-threat" : ""} ${claimed ? "is-claim" : ""}`}
      style={{ left: `${actor.x}%`, top: `${actor.y}%`, zIndex: 20 + Math.round(actor.y) }}
      onClick={onSelect}
      aria-label={actor.kind === "customer" ? `查看${actor.name}` : `查看${actor.name}`}
    >
      {actor.speech ? <span className="bubble">{actor.speech}</span> : null}
      {actor.threatLeft > 0 ? <i className="threat"><em>{Math.ceil(actor.threatLeft)}</em></i> : null}
      <i className="shade" />
      <img src={actor.art} alt="" />
      <span className="tag">{actor.name}</span>
    </button>
  );
}

export default function App() {
  const [snap, setSnap] = useState(() => sim.snapshot());
  const [cam, setCam] = useState(() => ({
    x: 0,
    y: 0,
    zoom: typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches ? 0.78 : 1.08,
  }));
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const camRef = useRef(cam);
  camRef.current = cam;
  const selected = useMemo(() => snap.actors.find(item => item.id === snap.selectedId) ?? snap.actors[0], [snap]);
  const you = useMemo(() => snap.actors.find(item => item.id === "xuyuan"), [snap]);
  const luyao = useMemo(() => snap.actors.find(item => item.id === "luyao"), [snap]);
  const ordered = useMemo(() => snap.actors.find(item => item.id === snap.orderId), [snap]);
  const hunted = useMemo(() => snap.actors.find(item => item.id === snap.huntId), [snap]);
  const tangke = useMemo(() => snap.actors.find(item => item.id === "tangke"), [snap]);
  const claimed = useMemo(() => snap.actors.find(item => item.id === snap.claimId), [snap]);
  const customer = selected?.kind === "customer" ? selected : null;
  const live = Boolean(customer && customer.status !== "sold" && customer.status !== "lost" && !snap.close && !snap.finale);
  const beside = near(you, customer, 10);
  const canSell = Boolean(live && customer && customer.status !== "refund" && beside);
  const canProbe = Boolean(live && customer && customer.clues.length < customer.cluePool.length);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      sim.tick(Math.min(48, now - last));
      last = now;
      frame = requestAnimationFrame(loop);
    };
    const unsub = sim.subscribe(() => setSnap(sim.snapshot()));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") sim.cancel();
    };
    const media = window.matchMedia("(max-width: 800px)");
    const onMedia = () => setPhone(media.matches);
    media.addEventListener("change", onMedia);
    window.addEventListener("keydown", onKey);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      unsub();
      window.removeEventListener("keydown", onKey);
      media.removeEventListener("change", onMedia);
    };
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".pawn")) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: camRef.current.zoom };
      drag.current = null;
    } else {
      pinch.current = null;
      drag.current = { x: event.clientX, y: event.clientY, cx: cam.x, cy: cam.y };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const next = Math.max(0.55, Math.min(1.8, pinch.current.zoom * (dist / pinch.current.dist)));
      setCam(value => ({ ...value, zoom: next }));
      return;
    }
    if (!drag.current) return;
    setCam(value => ({
      ...value,
      x: drag.current!.cx + (event.clientX - drag.current!.x),
      y: drag.current!.cy + (event.clientY - drag.current!.y),
    }));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      drag.current = null;
      return;
    }
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    if ((event.target as HTMLElement).closest(".pawn")) return;
    const slop = phone ? 12 : 6;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < slop) sim.cancel();
  };

  const onPawn = (id: ActorId) => {
    const actor = snap.actors.find(item => item.id === id);
    if (actor?.kind === "staff" || phone) {
      sim.select(id);
      return;
    }
    if (snap.selectedId === id) sim.command(id);
    else sim.select(id);
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const next = Math.max(0.9, Math.min(1.7, cam.zoom + (event.deltaY > 0 ? -0.08 : 0.08)));
    setCam(value => ({ ...value, zoom: next }));
  };

  const speeds: Speed[] = [0, 1, 2, 4];
  const remain = Math.max(0, snap.target - snap.sales);

  return (
    <div className="ops">
      <header className="topbar">
        <div className="brand">
          <i>AU</i>
          <div>
            <span>还差 ¥{remain.toLocaleString("zh-CN")} · 今晚 {snap.kept}/{snap.tonight} · 赠品 {snap.gifts}</span>
            <b>DAY {snap.day} · {snap.title}</b>
          </div>
        </div>
        <div className="clock">
          <small>{snap.phase.toUpperCase()}</small>
          <strong>{snap.clock}</strong>
        </div>
        <div className="speeds">
          {speeds.map(value => (
            <button type="button" key={value} className={snap.speed === value ? "is-on" : ""} onClick={() => sim.setSpeed(value)}>
              {value === 0 ? "STOP" : `${value}X`}
            </button>
          ))}
        </div>
      </header>

      <div className="workspace">
        <section className="stage-wrap">
          <div
            className="stage"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
          >
            <div className="world" style={{ transform: `translate(calc(-50% + ${cam.x}px), calc(-50% + ${cam.y}px)) scale(${cam.zoom})` }}>
              <img className="office" src="/assets/scenes/aurora-floor.jpg" alt="绮光与维珞专柜" />
              {you && ordered ? <IntentLine from={you} to={ordered} kind="gold" /> : null}
              {luyao && hunted ? <IntentLine from={luyao} to={hunted} kind="hot" /> : null}
              {tangke && claimed ? <IntentLine from={tangke} to={claimed} kind="claim" /> : null}
              <span className="room-label" style={{ left: "14%", top: "14%" }}>AURORA</span>
              <span className="room-label" style={{ left: "40%", top: "20%" }}>CHECKOUT</span>
              <span className="room-label" style={{ left: "30%", top: "58%" }}>TESTER</span>
              <span className="room-label" style={{ left: "52%", top: "48%" }}>AISLE</span>
              <span className="room-label" style={{ left: "74%", top: "30%" }}>VELORA</span>
              <span className="room-label" style={{ left: "44%", top: "88%" }}>ENTRANCE</span>
              <span className="room-label atrium" style={{ left: "58%", top: "8%" }}>MALL</span>
              <span className={`prop-gift ${snap.gifts > 0 ? "" : "is-empty"}`} style={{ left: "22%", top: "36%" }}>{snap.gifts > 0 ? "GIFT" : "空窗"}</span>
              {snap.actors.map(actor => (
                <Pawn key={actor.id} actor={actor} selected={actor.id === snap.selectedId} claimed={actor.id === snap.claimId} onSelect={() => onPawn(actor.id)} />
              ))}
            </div>
          </div>
          <p className="hint">{phone ? "点人选中 · 底栏去接 · 单指拖动 · 双指缩放" : "点人选中 · 再点去接 · 点同事是许愿的应对 · 唐可会来接你放下的人"}</p>
          <div className="mobile-strip">
            <span>{snap.logs[0] ? `${snap.logs[0].title} · ${snap.logs[0].detail}` : "晚高峰"}</span>
            <div>
              {snap.actors.filter(item => item.kind === "customer").map(item => (
                <button type="button" key={item.id} className={item.id === snap.selectedId ? "is-on" : item.threatLeft > 0 || item.id === snap.claimId ? "is-hot" : ""} onClick={() => sim.select(item.id)}>
                  {item.name} {item.status === "sold" ? "成交" : item.status === "lost" ? "走了" : item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="rail">
          <section>
            <b>OVERVIEW</b>
            <div className="minimap mall-mini">
              <img src="/assets/scenes/aurora-floor.jpg" alt="" />
              {snap.actors.map(actor => (
                <i key={actor.id} className={actor.id === snap.selectedId ? "is-on" : actor.id === "luyao" ? "is-hot" : ""} style={{ left: `${actor.x}%`, top: `${actor.y}%` }} />
              ))}
            </div>
            <p className="score">还差 ¥{remain.toLocaleString("zh-CN")}<small> 今日 +¥{snap.daySales.toLocaleString("zh-CN")}</small></p>
          </section>
          <section>
            <b>DOC CAM</b>
            <ul className="log">
              {snap.logs.map(item => (
                <li key={item.id}>
                  <span>{item.clock}</span>
                  <strong>{item.title}</strong>
                  <em>{item.detail}</em>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <b>PARTY</b>
            <ul className="party">
              {snap.actors.map(actor => (
                <li key={actor.id}>
                  <button type="button" className={actor.id === snap.selectedId ? "is-on" : ""} onClick={() => sim.select(actor.id as ActorId)}>
                    <strong>{actor.name}</strong>
                    <span>{actor.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <footer className="inspect">
        <img className="face" src={selected?.portrait || selected?.art} alt="" />
        <div className="who">
          <small>{selected?.role}</small>
          <h2>{selected?.name}</h2>
          <p>{selected ? roomOf(selected) : ""} · {selected?.label}</p>
          <blockquote>{selected?.speech || selected?.opening}</blockquote>
          {customer?.clues.map(line => <p key={line} className="clue">看见：{line}</p>)}
          {live && customer && customer.maxPatience > 0 && customer.status !== "refund" ? (
            <label className="wait">
              <span>还会等</span>
              <i><em style={{ width: `${Math.max(6, (customer.patience / customer.maxPatience) * 100)}%` }} /></i>
            </label>
          ) : null}
        </div>
        <div className={`meters sell-dock ${canSell ? "is-sell" : ""}`}>
          {snap.huddleLeft > 0 && !snap.close ? (
            <>
              <b>柜长开会 · {snap.huddleLeft.toFixed(0)}s</b>
              <p className="close-body">陆遥还在过道上走。听完，或先走开赶人。</p>
              <button className="possess" type="button" onClick={() => sim.leaveHuddle()}>先走开</button>
            </>
          ) : live && customer?.status === "refund" ? (
            <>
              <b>退货</b>
              <p className="close-body">她站在收银。许愿过去，这单的钱会从账上扣回。</p>
              <button className="possess" type="button" onClick={() => sim.command(customer.id)}>去收银</button>
            </>
          ) : canSell ? (
            <>
              <b>给她试哪一件</b>
              <div className="skus">
                {PRODUCTS.map(product => (
                  <button type="button" key={product.id} disabled={customer?.tried.includes(product.id)} onClick={() => sim.sell(product.id as ProductId)}>
                    <strong>{product.short} ¥{product.price}</strong>
                    <span>{customer?.tried.includes(product.id) ? "刚试过" : product.note}</span>
                  </button>
                ))}
              </div>
              {snap.gifts > 0 ? (
                <button className="possess" type="button" onClick={() => sim.gift()}>塞赠品 · 还剩 {snap.gifts}</button>
              ) : null}
            </>
          ) : selected?.kind === "staff" && snap.acts.length && !snap.close && !snap.finale ? (
            <>
              <b>许愿可以</b>
              <div className="skus">
                {snap.acts.map(item => (
                  <button type="button" key={item.id} onClick={() => sim.act(item.id)}>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </button>
                ))}
              </div>
            </>
          ) : live ? (
            <>
              <b>{snap.probeLeft > 0 ? `在看 · ${snap.probeLeft.toFixed(1)}s` : "先到她身边"}</b>
              <p className="close-body">{customer?.opening}</p>
              <div className="skus">
                <button type="button" onClick={() => sim.command(customer!.id)}>
                  <strong>去接</strong>
                  <span>派许愿走过去</span>
                </button>
                {canProbe ? (
                  <button type="button" onClick={() => sim.probe()}>
                    <strong>看一眼</strong>
                    <span>走近才看得到线索</span>
                  </button>
                ) : null}
                {snap.gifts > 0 ? (
                  <button type="button" onClick={() => sim.gift()}>
                    <strong>塞赠品</strong>
                    <span>打断陆遥，或盖过一次错货</span>
                  </button>
                ) : null}
              </div>
            </>
          ) : snap.close && !snap.closePicked ? (
            <>
              <b>{snap.close.title}</b>
              <p className="close-body">{snap.close.body}</p>
              <div className="skus">
                {snap.close.choices.map(choice => (
                  <button type="button" key={choice.id} onClick={() => sim.pickClose(choice.id)}>
                    <strong>{choice.label}</strong>
                    <span>{choice.detail}</span>
                  </button>
                ))}
              </div>
            </>
          ) : snap.closePicked && !snap.finale ? (
            <>
              <b>{snap.closePicked.label}</b>
              <p className="close-body">{snap.closePicked.result}</p>
              <button className="possess" type="button" onClick={() => sim.nextDay()}>{snap.day >= 5 ? "看五日账本" : "进入下一天"}</button>
            </>
          ) : snap.finale ? (
            <>
              <b>{snap.sales >= snap.target ? "你留下了数字" : "数字没有够"}</b>
              <p className="close-body">五日共 ¥{snap.sales.toLocaleString("zh-CN")} / ¥{snap.target.toLocaleString("zh-CN")}</p>
              <ul className="ledger">{snap.history.map(item => <li key={`${item.day}-${item.text}`}>D{item.day} {item.text}</li>)}</ul>
              <button className="possess" type="button" onClick={() => sim.restart()}>再开一局</button>
            </>
          ) : (
            <>
              <b>现场</b>
              <p className="close-body">点人选中，再点去接。陆遥头上出现数字时，赶过去还能抢回来。</p>
            </>
          )}
        </div>
        <div className="bonds">
          <b>TODAY</b>
          {snap.actors.filter(item => item.kind === "customer").map(item => (
            <p key={item.id}>
              <span>{item.name}</span>
              <strong>{item.status === "sold" ? "成交" : item.status === "lost" ? "走了" : item.status === "refund" ? "退货" : item.label}</strong>
            </p>
          ))}
          {snap.queued > 0 ? <p><span>还在路上</span><strong>{snap.queued} 人</strong></p> : null}
        </div>
      </footer>
    </div>
  );
}

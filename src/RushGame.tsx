import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { CUSTOMERS, PRODUCTS, type ProductId } from "../dynamic-counter-prototype/src/campaign";
import { createRush, parseRush, rushReducer, RUSH_BEST_KEY, RUSH_SAVE_KEY, RUSH_SECONDS, STATIONS, WORLD, type Guest, type Point } from "./rush-rules";
import { asset } from "./sim/asset";
import { customerPortrait, productArtwork } from "./experience-art";
import "./rush.css";

const REQUESTS: Record<ProductId, string> = { soft: "来补一瓶柔焦，镜头前要轻薄。", repair: "修护用完了，帮我拿一瓶。", glow: "今晚要上台，拿我常用的持妆。" };
const order = ["soft", "glow", "repair"] as const;
const place = (p: Point): CSSProperties => ({ left: `${p.x / WORLD.width * 100}%`, top: `${p.y / WORLD.height * 100}%` });
const art = (name: string) => asset(`assets/chibi/${name}.png`);
function ProductArt({ product }: { product: ProductId }) {
  return <span className={`rush-product-image product-${product}`} aria-hidden="true"><img src={productArtwork} alt="" draggable={false} /></span>;
}
function initialState() {
  try { return parseRush(localStorage.getItem(RUSH_SAVE_KEY)) ?? createRush(); } catch { return createRush(); }
}
function initialBest() {
  try { const value = Number(localStorage.getItem(RUSH_BEST_KEY)); return Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : 0; } catch { return 0; }
}

export default function RushGame() {
  const [game, dispatch] = useReducer(rushReducer, undefined, initialState);
  const [best, setBest] = useState(initialBest);
  const [sound, setSound] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [boardWidth, setBoardWidth] = useState(950);
  const [arenaWidth, setArenaWidth] = useState(950);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const latest = useRef(game), keys = useRef(new Set<string>()), stage = useRef<HTMLDivElement>(null);
  const audio = useRef<AudioContext | null>(null), lastSound = useRef(game.served), muted = useRef(false);
  const modal = useRef<HTMLDivElement>(null), exiting = useRef(false);
  latest.current = game; muted.current = !sound;
  exiting.current = exitConfirm || restartConfirm;
  const paused = game.phase === "paused", finished = game.phase === "finished", ready = game.phase === "ready";
  const seconds = Math.max(0, Math.ceil(RUSH_SECONDS - game.elapsed));
  const active = game.phase === "playing";
  const finalRush = game.elapsed >= 70;
  const bestTarget = best > 0 ? Math.max(1000, best + 100) : 1500;
  const cameraLimit = Math.max(0, (boardWidth - arenaWidth) / 2);
  const cameraX = Math.max(-cameraLimit, Math.min(cameraLimit, boardWidth / 2 - game.player.x / WORLD.width * boardWidth));

  function beep(success = false) {
    try {
      if (muted.current) return;
      if (!audio.current || audio.current.state === "closed") audio.current = new AudioContext();
      const ctx = audio.current;
      void ctx.resume().catch(() => {});
      const notes = success ? [523.25, 659.25, 783.99] : [392, 523.25];
      notes.forEach((frequency, index) => {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain(), time = ctx.currentTime + index * .065;
        oscillator.type = "sine"; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.06, time + .01); gain.gain.exponentialRampToValueAtTime(.001, time + .15);
        oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(time); oscillator.stop(time + .16);
      });
    } catch { /* Audio is an enhancement; browser audio restrictions must not interrupt a run. */ }
  }
  useEffect(() => {
    if (game.served > lastSound.current) beep(true);
    lastSound.current = game.served;
  }, [game.served]);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setArenaWidth(width);
      setBoardWidth(window.matchMedia("(max-width: 760px)").matches ? Math.max(width, height * 16 / 9) : Math.min(width, height * 16 / 9));
    });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!active) { keys.current.clear(); return; }
    let frame = 0, previous = 0;
    const tick = (now: number) => {
      if (previous && !document.hidden) dispatch({ type: "tick", dt: (now - previous) / 1000, direction: {
        x: Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft")),
        y: Number(keys.current.has("s") || keys.current.has("arrowdown")) - Number(keys.current.has("w") || keys.current.has("arrowup")),
      } });
      previous = now; frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  useEffect(() => {
    const save = () => {
      try { localStorage.setItem(RUSH_SAVE_KEY, JSON.stringify(latest.current)); setSaveError(false); } catch { setSaveError(true); }
    };
    const hide = () => {
      if (document.hidden) { keys.current.clear(); dispatch({ type: "pause" }); save(); }
    };
    const blur = () => { keys.current.clear(); dispatch({ type: "pause" }); };
    const interval = window.setInterval(save, 1000);
    document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", save); window.addEventListener("blur", blur);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", save); window.removeEventListener("blur", blur); save(); };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(RUSH_SAVE_KEY, JSON.stringify(latest.current));
      if (finished) { const record = Math.max(initialBest(), game.score); localStorage.setItem(RUSH_BEST_KEY, String(record)); setBest(record); }
      setSaveError(false);
    } catch { setSaveError(true); }
  }, [game.phase]);
  useEffect(() => {
    if (paused || finished || exitConfirm || restartConfirm) modal.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [paused, finished, exitConfirm, restartConfirm]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (key === "tab" && modal.current) {
        const buttons = [...modal.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (exiting.current) {
        if (key === "escape") { event.preventDefault(); setExitConfirm(false); setRestartConfirm(false); }
        return;
      }
      if (latest.current.phase !== "playing" && !["p", "escape"].includes(key)) return;
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "e", "p", "escape", "1", "2", "3"].includes(key)) event.preventDefault();
      if (event.repeat) return;
      keys.current.add(key);
      if (key === "p" || key === "escape") dispatch({ type: latest.current.phase === "paused" ? "resume" : "pause" });
      if (key === " ") dispatch({ type: "dash" });
      if (key === "e") dispatch({ type: "interact" });
      const station = STATIONS.find(s => s.key === key);
      if (station) dispatch({ type: "go", point: station, destination: { kind: "station", product: station.product } });
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useEffect(() => () => { void audio.current?.close().catch(() => {}); }, []);

  const take = (product: ProductId) => {
    const station = STATIONS.find(s => s.product === product)!;
    dispatch({ type: "go", point: station, destination: { kind: "station", product } });
  };
  const send = (guest: Guest) => dispatch({ type: "go", point: guest, destination: { kind: "guest", id: guest.id } });
  const exit = () => { const url = new URL(window.location.href); url.searchParams.delete("mode"); window.location.assign(url.href); };
  const restart = () => {
    dispatch({ type: "restart" });
    setRestartConfirm(false);
  };
  const soundToggle = () => { if (!sound) { muted.current = false; beep(); } setSound(!sound); };

  return <div className={`rush-shell ${game.fever > 0 ? "is-fever" : ""} ${finalRush ? "is-final-rush" : ""} phase-${game.phase}`}>
    <header className="rush-header">
      <a className="rush-brand" href="?mode=rush"><span>最后一单<span className="rush-brand-slash"> / </span></span><b>闭店大作战</b><small>AFTER HOURS</small></a>
      <div className="rush-clock" role="timer" aria-label={`还剩 ${seconds} 秒`}><small>离闭店还剩</small><strong>{String(Math.floor(seconds / 60)).padStart(2, "0")}<i>:</i>{String(seconds % 60).padStart(2, "0")}</strong></div>
      <div className="rush-score" aria-label={`本局得分 ${game.score}`}><small>本局得分</small><strong>{game.score.toLocaleString()}</strong></div>
      <nav className="rush-header-actions" aria-label="挑战控制">
        <button onClick={soundToggle} aria-label={sound ? "关闭音效" : "开启音效"}>{sound ? "音效 开" : "音效 关"}</button>
        <button disabled={ready || finished || exitConfirm || restartConfirm} onClick={() => dispatch({ type: paused ? "resume" : "pause" })}>{paused ? "继续" : "暂停"}</button>
        <button disabled={exitConfirm || restartConfirm} onClick={() => { if (active || paused) { dispatch({ type: "pause" }); setExitConfirm(true); } else exit(); }}>五日故事</button>
      </nav>
    </header>

    <div className="rush-stage-grid">
      <main className="rush-arena" ref={stage} aria-label="闭店大作战现场">
        <div className="rush-world" style={{ width: boardWidth, transform: `translateX(${cameraX}px)` }} onClick={e => {
          if ((e.target as HTMLElement).closest("button, a")) return;
          const rect = e.currentTarget.getBoundingClientRect();
          dispatch({ type: "go", point: { x: (e.clientX - rect.left) / rect.width * WORLD.width, y: (e.clientY - rect.top) / rect.height * WORLD.height } });
        }}>
          <img className="rush-floor-art" src={asset("assets/scenes/aurora-floor.jpg")} alt="两家专柜之间的商场通道" draggable={false} />
          <div className="rush-floor-tint" />
          <div className="rush-location-label">绮光专柜 <small>新品周 · 最后 90 秒</small></div>
          <div className="rush-rival-sign">维珞专柜 <small>陆遥也在冲单</small></div>
          {STATIONS.map(station => <button key={station.product} aria-label={`去取${PRODUCTS[station.product].short}`} disabled={!active} onClick={() => take(station.product)} className={`rush-station tone-${station.product} ${game.destination?.kind === "station" && game.destination.product === station.product ? "targeted" : ""}`} style={place(station)}>
            <ProductArt product={station.product} /><span><kbd>{station.key}</kbd>{PRODUCTS[station.product].short}</span>
          </button>)}
          {game.path.length > 0 && <div className="rush-destination" style={place(game.path.at(-1)!)} aria-hidden="true" />}
          {game.guests.map(guest => <button key={guest.id} disabled={!active} className={`rush-actor rush-guest tone-${guest.product} ${guest.patience < 7 ? "impatient" : ""} ${game.rivalTarget === guest.id && game.rivalHold > 0 ? "being-stolen" : ""}`} aria-label={`送给${CUSTOMERS[guest.who].name}：${PRODUCTS[guest.product].short}`} style={{ ...place(guest), zIndex: Math.round(guest.y) }} onClick={() => send(guest)}>
            <span className="rush-request-bubble"><b>{PRODUCTS[guest.product].short}</b><span>{guest.patience < 7 ? "我快走了！" : "帮我拿一件"}</span></span>
            <img className="rush-sprite" src={art(guest.who)} alt="" draggable={false} />
            <span className="rush-actor-name">{CUSTOMERS[guest.who].name}</span>
            <span className="rush-patience"><i style={{ width: `${guest.patience / guest.maximum * 100}%` }} /></span>
          </button>)}
          <div className={`rush-actor rush-rival ${game.stunned > 0 ? "stunned" : active && game.elapsed >= 10 ? "running" : ""}`} style={{ ...place(game.rival), zIndex: Math.round(game.rival.y) }}>
            <span className="rush-rival-bubble">{game.stunned > 0 ? "你怎么这么快？！" : game.rivalHold > 0 ? "跟我去对面吧。" : "这单，我也想要。"}</span>
            <img className="rush-sprite" src={art("luyao")} alt="陆遥" draggable={false} /><span className="rush-actor-name">陆遥</span>
            {game.rivalHold > 0 && <span className="rush-steal-meter"><i style={{ width: `${game.rivalHold / 3.5 * 100}%` }} /></span>}
          </div>
          <div className={`rush-actor rush-player ${active && (game.path.length || keys.current.size) ? "running" : ""} ${game.dash > 0 ? "dashing" : ""}`} style={{ ...place(game.player), zIndex: Math.round(game.player.y) + 1 }} aria-label={`许愿${game.carrying ? "拿着" + PRODUCTS[game.carrying].short : "空手"}`}>
            <span className="rush-you">你</span><img className="rush-sprite" src={art("xuyuan")} alt="许愿" draggable={false} />
            {game.carrying && <span className={`rush-carried tone-${game.carrying}`}><ProductArt product={game.carrying} /></span>}
            <span className="rush-actor-name">许愿</span>
          </div>
        </div>
        {!ready && !finished && <div className="rush-stage-top"><span className={`rush-phase-pill ${game.fever > 0 ? "fever-pill" : ""}`}>{game.fever > 0 ? `高光时刻 ×2 · ${Math.ceil(game.fever)}s` : finalRush ? "最后 20 秒 · 全场冲刺" : game.elapsed >= 30 ? "下班高峰 · 眼疾手快" : "热身开场 · 先接住第一单"}</span><span className="rush-combo"><b>{game.combo}</b> 连单</span></div>}
        {active && game.toastLife > 0 && <p className="rush-toast" role="status" key={game.effect}>{game.toast}</p>}

        {ready && <section className="rush-cover" aria-label="挑战介绍"><div className="rush-cover-copy"><span className="rush-kicker">A LITTLE CHAOS. A LAST-MINUTE WIN.</span><h1>闭店<br /><em>大作战</em><span>90 SEC.</span></h1><p>客人快走了，陆遥又来抢单。<br />拿对货，跑快一点。今晚的销冠是你吗？</p><button className="rush-primary" onClick={() => { beep(); dispatch({ type: "start" }); }}>开跑 <span>90 秒</span></button><div className="rush-mini-rules"><span><b>01</b> 点货台拿货</span><span><b>02</b> 点顾客送达</span><span><b>03</b> 空格加速抢单</span></div><small className="rush-best-line">个人最佳 {best.toLocaleString()} 分 · 每局顾客需求会变化</small></div><div className="rush-cover-cast" aria-hidden="true"><span className="rush-cover-quote">“这单，是我的。”</span><img className="cover-luyao" src={art("luyao")} alt="" /><img className="cover-xuyuan" src={art("xuyuan")} alt="" /><span className="rush-cover-sticker">READY<br />TO RUSH?</span></div></section>}
        {paused && !exitConfirm && !restartConfirm && <section className="rush-modal-overlay"><div ref={modal} className="rush-modal" role="dialog" aria-modal="true" aria-labelledby="rush-pause-title"><span className="rush-kicker">TAKE A BREATH</span><h2 id="rush-pause-title">先喘口气。</h2><p>还剩 {seconds} 秒，{game.guests.length} 位客人在等你。<br />{saveError ? "本机保存未成功，请保留页面。" : "这一局已暂停，刷新后也可以接着跑。"}</p><button className="rush-primary" onClick={() => { beep(); dispatch({ type: "resume" }); }}>继续冲单</button><button className="rush-secondary" onClick={() => setRestartConfirm(true)}>重开本局</button></div></section>}
        {restartConfirm && <section className="rush-modal-overlay"><div ref={modal} className="rush-modal" role="dialog" aria-modal="true" aria-labelledby="rush-restart-title"><h2 id="rush-restart-title">重新跑一局？</h2><p>当前 {game.score.toLocaleString()} 分尚未结算，重开后不计入个人纪录。已完成的最佳纪录会保留。</p><button className="rush-primary" onClick={restart}>确定重开</button><button className="rush-secondary" onClick={() => setRestartConfirm(false)}>留在这局</button></div></section>}
        {exitConfirm && <section className="rush-modal-overlay"><div ref={modal} className="rush-modal" role="dialog" aria-modal="true" aria-labelledby="rush-exit-title"><h2 id="rush-exit-title">回五日故事？</h2><p>本局已暂停并保存在本机。下次打开挑战继续跑。</p><button className="rush-primary" onClick={exit}>保存并返回故事</button><button className="rush-secondary" onClick={() => setExitConfirm(false)}>留在这局</button></div></section>}
        {finished && <section className="rush-modal-overlay rush-finish-overlay"><div ref={modal} className="rush-modal rush-finish" role="dialog" aria-modal="true" aria-labelledby="rush-result-title"><span className="rush-kicker">SHIFT COMPLETE / 打烊啦</span><h2 id="rush-result-title">{game.score >= 3500 ? "闭店传奇。" : game.score >= 1500 ? "今晚，你很闪。" : game.served > 0 ? "接住了，就不算晚。" : "明天再抢回来。"}</h2><strong className="rush-final-score">{game.score.toLocaleString()}<small>分</small></strong><div className="rush-result-stats"><span><b>{game.served}</b>送达</span><span><b>{game.bestCombo}</b>最高连单</span><span><b>{game.lost}</b>流失</span><span><b>{game.mistakes}</b>送错</span></div><p>{game.bestCombo < 3 ? "试试连续送对 3 单，进入 8 秒高光时刻。" : "冲刺不只跑得快，靠近陆遥还能打断她抢客。"}</p><button className="rush-primary" onClick={restart}>再来一局 <span>挑战 {Math.max(game.score + 100, 1500)} 分</span></button><button className="rush-secondary" onClick={exit}>回到五日故事</button><small className="rush-best-line">个人最佳 {best.toLocaleString()} 分 · 挑战积分独立记录</small></div></section>}
      </main>

      <aside className="rush-tickets" aria-label="等待中的顾客"><div className="rush-tickets-title"><span>待接住的单</span><b>{game.guests.length.toString().padStart(2, "0")}</b></div><p className="rush-ticket-hint">看好需求，点她就出发。</p><div className="rush-ticket-list">{game.guests.map(guest => <button key={guest.id} className={`rush-ticket tone-${guest.product} ${guest.patience < 7 ? "impatient" : ""}`} disabled={!active} onClick={() => send(guest)} aria-label={`前往${CUSTOMERS[guest.who].name}，需要${PRODUCTS[guest.product].short}`}>
        <div className="rush-ticket-person"><img src={customerPortrait(guest.who, true)} alt="" /><div><b>{CUSTOMERS[guest.who].name}</b><small>{game.rivalTarget === guest.id && game.rivalHold > 0 ? "陆遥正在抢单" : `${Math.ceil(guest.patience)} 秒后离开`}</small></div><span className="rush-ticket-product">{PRODUCTS[guest.product].short}</span></div><p>{REQUESTS[guest.product]}</p><span className="rush-ticket-progress"><i style={{ width: `${guest.patience / guest.maximum * 100}%` }} /></span>
      </button>)}</div><div className="rush-side-note"><span>YOUR NEXT HIGH</span><strong>{bestTarget.toLocaleString()} <small>分</small></strong><p>连对 3 单 = 8 秒高光<br />加速跑动，得分翻倍。</p></div></aside>
    </div>

    {saveError && <p className="rush-save-warning" role="alert">本机保存失败，请保留页面。</p>}
    <footer className="rush-console">
      <div className={`rush-inventory ${game.carrying ? `tone-${game.carrying}` : ""}`} aria-live="polite"><span className="rush-hand-art">{game.carrying ? <ProductArt product={game.carrying} /> : <img src={art("xuyuan")} alt="" />}</span><div><small>你手里拿着</small><b>{game.carrying ? PRODUCTS[game.carrying].name : "空手，先去拿货"}</b><span>{game.carrying ? "点需要它的顾客送过去" : "点商品按钮，自动跑去取"}</span></div></div>
      <div className="rush-quick-stock" aria-label="快捷取货">{order.map((product, index) => <button key={product} disabled={!active} onClick={() => take(product)} className={`tone-${product} ${game.carrying === product ? "is-held" : ""}`} aria-label={`快捷取货：${PRODUCTS[product].short}`}><kbd>{index + 1}</kbd><ProductArt product={product} /><span>{PRODUCTS[product].short}</span></button>)}</div>
      <button className="rush-dash-button" disabled={!active || game.cooldown > 0} onClick={() => dispatch({ type: "dash" })}><strong>{game.cooldown > 0 ? `${game.cooldown.toFixed(1)}s` : "冲 刺"}</strong><small>{game.cooldown > 0 ? "马上就好" : "SPACE / 点一下"}</small><i style={{ transform: `scaleX(${1 - game.cooldown / 3})` }} /></button>
      <div className="rush-control-hint"><span>点地面移动 · 点人送货</span><span>WASD 走路 · E 互动 · P 暂停</span><small className={saveError ? "rush-save-error" : ""}>{saveError ? "保存失败，请保留页面" : "本机自动保存 · 切后台暂停"}</small></div>
    </footer>
  </div>;
}

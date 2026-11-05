import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BottomSheet, MobileScroll, useKeyboard, useKeyboardInsets } from "../../mobile";
import { asset } from "../../base.ts";
import { sfx, sfxMute, sfxMuted } from "../../sfx.ts";
import { CUSTOMERS, LEAGUES, PERKS, PRODUCTS, STYLES, TRAIT_LABELS } from "./content.ts";
import {
  act, choosePerk, closeDeal, continueRun, leaveDeal, META_KEY,
  parseProfile, parseRun, pickCustomer, quote, recordResult, resultOf, SAVE_KEY,
  selectDiscount, selectProduct, serializeRun, startRun, TOTAL_DAYS,
} from "./engine.ts";
import type { Action, Customer, Product, Profile, Run, StyleId } from "./types.ts";
import "./counter.css";

const money = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
const customerOf = (id: string) => CUSTOMERS.find(c => c.id === id)!;
const perkOf = (id: string) => PERKS.find(p => p.id === id)!;
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const phaseWord = (run: Run) => ({ select: "选下一位客人", deal: "这笔谈单还在", receipt: "这单已经结账", draft: "还有一项能力待选", result: "七天战绩已结算" })[run.phase];
const leagueBrief = ["读懂需求，守住利润。", "至少九折，或试用证明价值。", "要求更高，不能只卖个差不多。", "只有两次交谈，先问哪句？", "急客、严要求、价格战，一起应对。"];
const actionLabels: Record<Action, string> = { "ask-need": "问需求", "ask-budget": "问预算", listen: "聊近况", trial: "试这支" };

function Portrait({ customer, className = "" }: { customer: Customer; className?: string }) {
  return <img className={`c-portrait ${className}`} src={asset(customer.portrait)} alt="" draggable={false} />;
}
function Bottle({ product, small = false }: { product: Product; small?: boolean }) {
  return <span aria-hidden="true" className={`c-bottle ${small ? "is-small" : ""} bottle-${product.id}`} style={{ "--bottle": product.color } as CSSProperties}>
    <i /><b>{product.name.slice(0, 2)}<small>RENQING</small></b>
  </span>;
}
function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return <div className="c-section-title">{eyebrow && <span className="c-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{children && <p>{children}</p>}</div>;
}
function Scroll({ children, reset }: { children: ReactNode; reset?: string }) {
  return <div className="c-scroll-wrap"><MobileScroll key={reset}><div className="c-pad">{children}</div></MobileScroll></div>;
}
function Footer({ children }: { children: ReactNode }) { return <footer className="c-footer">{children}</footer>; }
function Score({ run }: { run: Run }) {
  const delta = run.money - run.rivalMoney;
  const total = Math.max(run.money + run.rivalMoney, 1);
  return <section className="c-score" aria-label="双方净收益">
    <div className="c-score-numbers"><span>你的净收益<strong>{money(run.money)}</strong></span><b className={delta >= 0 ? "c-ahead" : "c-behind"}>{delta >= 0 ? "领先" : "落后"}<small>{money(Math.abs(delta))}</small></b><span>{LEAGUES[run.rank]!.rival}<strong>{money(run.rivalMoney)}</strong></span></div>
    <div className="c-score-track" aria-hidden="true"><i style={{ width: `${run.money / total * 100}%` }} /></div>
  </section>;
}

type StageProps = { run: Run; update: (fn: (r: Run) => Run) => void };
function CustomerQueue({ run, update }: StageProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const candidate = run.board.find(o => o.id === selected);
  return <>
    <Scroll>
      <SectionTitle eyebrow={`DAY ${String(run.day).padStart(2, "0")} / 07 · ${run.turn === 0 ? "开门迎客" : "还有一个名额"}`} title={run.turn === 0 ? "今天，先接谁？" : "把机会留给谁？"}>
        每天接待两位。剩下的那位，生意归对手。
      </SectionTitle>
      <div className="c-day-strip" aria-label={`第 ${run.day} 天，共 7 天`}>{Array.from({ length: TOTAL_DAYS }, (_, i) => <span key={i} className={i + 1 === run.day ? "current" : i + 1 < run.day ? "done" : ""}>{i + 1 < run.day ? "✓" : i + 1}</span>)}</div>
      <div className="c-customers" aria-label="今天的顾客">
        {run.board.map(op => {
          const customer = customerOf(op.customerId);
          return <button type="button" className={`c-customer ${selected === op.id ? "selected" : ""}`} key={op.id} aria-pressed={selected === op.id} aria-label={`选择${customer.name}`} onClick={() => setSelected(op.id)}>
            <div className="c-portrait-frame"><Portrait customer={customer} /><span>{op.returning ? "熟客" : "新面孔"}</span></div>
            <div className="c-customer-info"><div className="c-customer-title"><h2>{customer.name}</h2><span>{op.wanted === 3 ? "不想将就" : "日常实用"}</span></div><small>{customer.role}</small>
              <p>{op.opening}</p><div className="c-customer-price"><b>{money(op.budgetLow)}–{op.budgetHigh}</b><span>若留给对手 +{money(op.rivalValue)}</span></div>
            </div><span className="c-choice-check" aria-hidden="true">{selected === op.id ? "✓" : "+"}</span>
          </button>;
        })}
      </div>
      <div className="c-rival-note"><span>↗</span><p>对手今天的自有客源已进账 <b>{money(run.dayRival)}</b>。你没接住的机会，还会让对手多赚。</p></div>
      {run.day === 1 && run.turn === 0 && <p className="c-soft-note">先读她的话，再看预算。不是预算最高的，就一定最值得接。</p>}
    </Scroll>
    <Footer><div className="c-foot-note">{candidate ? `这次接待${customerOf(candidate.customerId).name} · 今天剩 ${2 - run.turn} 个名额` : "点一位客人，看看这笔生意值不值得争"}</div><button className="c-primary" type="button" disabled={!candidate} onClick={() => candidate && update(r => pickCustomer(r, candidate.id))}>{candidate ? `接待${customerOf(candidate.customerId).name}` : "先选一位客人"}<span>→</span></button></Footer>
  </>;
}

function Negotiation({ run, update }: StageProps) {
  const d = run.active!;
  const customer = customerOf(d.opportunity.customerId);
  const [tab, setTab] = useState<"talk" | "shelf">("talk");
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const replyRef = useRef<HTMLDivElement>(null);
  const product = PRODUCTS.find(p => p.id === d.product);
  const noTime = d.patience <= 0;
  const trialDisabled = noTime || !product || run.samples <= 0 || d.tried.includes(product.id);
  const paid = quote(run);
  // Only learned needs enter this preview. The opportunity's hidden needs never filter the shelf.
  const knownFit = product ? d.known.reduce((sum, trait, i) => sum + product.traits[trait] * (i === 0 ? 2 : 1), 0) : 0;
  const threshold = d.opportunity.wanted * 2 + 2 + Number(run.rank === 2 || run.rank === 4);
  const preview = !d.known.length ? "需求还没问清，先别只看价格。" : product && product.traits[d.known[0]!] === 0 ? "这支解决不了已知的首要需求，倾听和试用也不能替代。" : d.known.length < 2 ? `已知部分匹配 ${knownFit} 分，另一个需求还没确认。` : `已知匹配 ${knownFit}/9 · 这单说服门槛 ${threshold} 分`;
  const doAct = (action: Action) => update(r => act(r, action));
  useEffect(() => { if (tab === "talk" && d.lines.length > 1) replyRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [d.lines.length, tab]);
  return <>
    <div className="c-deal-top"><div><b>{customer.name}</b><span>{d.opportunity.returning ? "她又回来了" : customer.role}</span></div><div className="c-patience" aria-label={`剩余 ${d.patience} 次交谈`}><span>{noTime ? "该做决定了" : `还能聊 ${d.patience} 次`}</span><div aria-hidden="true">{Array.from({ length: d.maxPatience }, (_, i) => <i key={i} className={i < d.patience ? "on" : ""} />)}</div></div></div>
    <div className="c-tabs" role="tablist" aria-label="接待步骤">
      <button type="button" role="tab" id="c-talk-tab" aria-controls="c-talk-panel" aria-selected={tab === "talk"} onClick={() => setTab("talk")}>01 听她说</button>
      <button type="button" role="tab" id="c-shelf-tab" aria-controls="c-shelf-panel" aria-selected={tab === "shelf"} onClick={() => setTab("shelf")}>02 挑货报价</button>
    </div>
    <Scroll reset={tab}>
      <div className="c-evidence" aria-label="已掌握的信息"><span>{d.budgetKnown ? `预算 ${money(d.opportunity.budget)}${run.perks.includes("budget-room") ? "（可说明价值 +30）" : ""}` : `预算约 ${money(d.opportunity.budgetLow)}–${d.opportunity.budgetHigh}`}</span>
        {d.known.map((t, i) => <b key={t}>{i === 0 ? "首要" : "其次"} · {TRAIT_LABELS[t]}</b>)}{d.known.length < 2 && <small>{2 - d.known.length} 条需求待确认</small>}</div>
      {tab === "talk" ? <section id="c-talk-panel" role="tabpanel" aria-labelledby="c-talk-tab">
        <div className="c-conversation"><Portrait customer={customer} /><div className="c-speech"><span>{d.opportunity.returning ? "这次，她有新的打算" : "客人开口了"}</span><p>{d.opportunity.opening}</p></div></div>
        {d.lines.length > 1 && <div className="c-live-reply" role="status" ref={replyRef}><span>刚刚听到的</span>{d.lines.slice(-2).filter(line => line !== d.opportunity.opening).map((line, i) => <p key={`${i}:${line}`}>{line}</p>)}</div>}
        <div className="c-action-heading"><b>你想怎么接这句话？</b><span>每次消耗 1 交谈</span></div>
        <div className="c-talk-actions">
          <button type="button" disabled={noTime || d.known.length === 2} onClick={() => doAct("ask-need")}><span>◎</span><b>{actionLabels["ask-need"]}</b><small>{d.known.length === 2 ? "需求已确认" : "最在意什么？"}</small></button>
          <button type="button" disabled={noTime || d.budgetKnown} onClick={() => doAct("ask-budget")}><span>¥</span><b>{actionLabels["ask-budget"]}</b><small>{d.budgetKnown ? "预算已确认" : "心里的上限是多少？"}</small></button>
          <button type="button" disabled={noTime || d.listened} onClick={() => doAct("listen")}><span>♡</span><b>{actionLabels.listen}</b><small>{d.listened ? "这份心意记住了" : "建立关系，也增加说服"}</small></button>
          <button type="button" onClick={() => setTab("shelf")}><span>◇</span><b>拿一支试试</b><small>先挑货，再花小样验证</small></button>
        </div>
        <p className="c-soft-note">不用把问题问完。留一次试用，或凭线索直接判断，都由你决定。</p>
      </section> : <section id="c-shelf-panel" role="tabpanel" aria-labelledby="c-shelf-tab">
        <div className="c-action-heading"><b>六支货，没有万能答案</b><span>特性 0–3 格</span></div>
        <div className="c-products" aria-label="货架">{PRODUCTS.map(p => <button type="button" key={p.id} className={`c-product ${p.id === d.product ? "selected" : ""}`} aria-pressed={p.id === d.product} aria-label={`选择${p.name}`} onClick={() => update(r => selectProduct(r, p.id))}>
          <div className="c-product-top"><Bottle product={p} /><span><b>{money(p.price)}</b><small>成本 {money(p.cost)}</small>{d.tried.includes(p.id) && <em>已试用</em>}</span></div>
          <h3>{p.name}</h3><div className="c-product-traits">{Object.entries(p.traits).filter(([, value]) => value > 0).map(([trait, value]) => <span key={trait}>{TRAIT_LABELS[trait as keyof typeof TRAIT_LABELS]} <b>{"▰".repeat(value)}{"▱".repeat(3 - value)}</b></span>)}</div>
        </button>)}</div>
        {product && <section className="c-product-detail" aria-label="报价判断"><b>{product.name}</b><p>{product.note}</p><p>{preview}</p>{d.listened && <small>倾听说服 +{run.perks.includes("deep-listen") ? 2 : 1}</small>}
          {d.trialNotes[product.id] && <p role="status" className="c-trial-result">{d.trialNotes[product.id]}</p>}
          {(run.rank === 1 || run.rank === 4) && <p className="c-caution">本场须至少九折，或试用最终报价的产品。</p>}
        </section>}
      </section>}
      <details className="c-details"><summary>这次谈话的记录</summary>{d.lines.map((line, i) => <p key={i}>{line}</p>)}</details>
      <button type="button" className="c-text-button c-leave" onClick={() => setLeaveConfirm(true)}>这笔先不争了</button>
    </Scroll>
    <Footer>{tab === "talk" ? <><div className="c-foot-note">{noTime ? "交谈次数用完了，仍可挑货和报价" : `还剩 ${d.patience} 次交谈 · 小样 ${run.samples} 份`}</div><button type="button" className="c-primary" onClick={() => setTab("shelf")}>去挑货，做判断<span>→</span></button></> : <>
      <div className="c-price-options" role="group" aria-label="报价折扣">{([0, 10, 20] as const).map(discount => <button type="button" key={discount} aria-pressed={d.discount === discount} onClick={() => update(r => selectDiscount(r, discount))}>{discount === 0 ? "原价" : discount === 10 ? "九折" : "八折"}</button>)}</div>
      <div className="c-quote-row"><div><small>{product ? `单品毛利 ${money(paid - product.cost)} · 奖金另计` : "选好商品，再决定是否让价"}</small><b>{product ? `报价 ${money(paid)}` : "还没选货"}</b></div><button type="button" className="c-trial-button" disabled={trialDisabled} onClick={() => doAct("trial")}>{product && d.tried.includes(product.id) ? "这支已试过" : "试这支"}<small>{run.samples <= 0 ? "没有小样了" : noTime ? "交谈已用完" : "1 交谈 · 1 小样"}</small></button></div>
      {product && d.trialNotes[product.id] && <p className="c-footer-feedback" role="status">{d.trialNotes[product.id]}</p>}
      <button type="button" className="c-primary" disabled={!product} onClick={() => update(closeDeal)}>就这样报价<span>→</span></button>
    </>}</Footer>
    <BottomSheet open={leaveConfirm} title="放下这笔生意？" description="没有产品成本；信誉 −1，机会转给对手。已聊出的关系保留，并补回小样。" snap={0.45} onOpenChange={setLeaveConfirm}>
      <div className="c-sheet-actions"><button type="button" className="c-primary" onClick={() => { setLeaveConfirm(false); update(leaveDeal); }}>确认送客</button><button type="button" className="c-secondary" onClick={() => setLeaveConfirm(false)}>再想一下</button></div>
    </BottomSheet>
  </>;
}

function ReceiptScreen({ run, update }: StageProps) {
  const r = run.receipt!;
  const customer = customerOf(r.customerId);
  const sold = r.outcome === "sold";
  const ended = run.reputation <= 0 || (run.day === TOTAL_DAYS && run.turn === 2);
  return <>
    <Scroll><div className={`c-receipt ${sold ? "sold" : "lost"}`}>
      <span className="c-eyebrow">{sold ? "DEAL CLOSED · 成交" : "NOT THIS TIME · 留个教训"}</span><h1>{sold ? "这单，接住了。" : r.outcome === "leave" ? "有些生意，先放下。" : "这次，没接住。"}</h1>
      <div className="c-receipt-amount">{sold ? `+${money(r.profit)}` : "没有进账"}<small>{sold ? "真正留下的净收益" : `对手接下机会 +${money(r.rivalGain)}`}</small></div>
      <div className="c-receipt-person"><Portrait customer={customer} /><div><b>{customer.name}</b><p>“{r.quote}”</p></div></div>
      <div className="c-receipt-stats"><span>关系<b>+{r.relationDelta}</b></span><span>信誉<b>{r.reputationDelta > 0 ? "+" : ""}{r.reputationDelta}</b></span><span>实际收入<b>{money(r.revenue)}</b></span></div>
      <section className="c-lesson"><span>下次，我可以这样做</span><p>{r.lesson}</p></section>
      <details className="c-details" open={!sold}><summary>为什么是这个结果？</summary><p>{r.explanation}</p>{r.breakdown.map(line => <p key={line}>{line}</p>)}</details>
    </div></Scroll>
    <Footer><button type="button" className="c-primary" onClick={() => update(continueRun)}>{ended ? "看这轮战绩" : run.turn === 2 ? "收柜，选明天的能力" : "还有一位，继续接客"}<span>→</span></button></Footer>
  </>;
}

function DraftScreen({ run, update }: StageProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const today = run.history.filter(r => r.day === run.day);
  return <>
    <Scroll><SectionTitle eyebrow={`DAY ${String(run.day).padStart(2, "0")} · 收柜之后`} title="明天，用什么赢？">三选一，整轮生效。把小优势连成你的打法。</SectionTitle>
      <div className="c-day-recap"><span>今天成交 <b>{today.filter(r => r.outcome === "sold").length} / 2</b></span><span>今天净赚 <b>{money(today.reduce((sum, r) => sum + r.profit, 0))}</b></span></div>
      <div className="c-perk-options">{run.draft.map(id => {
        const p = perkOf(id), same = run.perks.filter(key => perkOf(key).category === p.category).length;
        return <button type="button" className={`c-perk-card ${selected === id ? "selected" : ""}`} key={id} aria-pressed={selected === id} aria-label={`选择能力${p.name}`} onClick={() => setSelected(id)}><span className="c-perk-icon">{p.icon}</span><div><span className="c-eyebrow">{p.category}{same > 0 ? ` · 已有 ${same} 项同系能力` : " · 开拓新打法"}</span><h2>{p.name}</h2><p>{p.description}</p></div><span className="c-choice-check" aria-hidden="true">{selected === id ? "✓" : "+"}</span></button>;
      })}</div>
      <div className="c-kit"><h2>你已经练成的</h2><div>{run.perks.map(id => <span key={id}>{perkOf(id).icon} {perkOf(id).name}</span>)}</div></div>
    </Scroll>
    <Footer><div className="c-foot-note">明天补给小样 +2，关系和净收益继续保留</div><button type="button" className="c-primary" disabled={!selected} onClick={() => selected && update(r => choosePerk(r, selected))}>{selected ? `带上「${perkOf(selected).name}」` : "选一项经营能力"}<span>→</span></button></Footer>
  </>;
}

function ResultScreen({ run, profile, onHome }: { run: Run; profile: Profile; onHome: () => void }) {
  const result = resultOf(run);
  const next = LEAGUES[run.rank + 1];
  return <>
    <Scroll><div className={`c-finish ${result.won ? "won" : ""}`}><span className="c-finish-symbol" aria-hidden="true">{result.won ? "✦" : "↻"}</span><span className="c-eyebrow">{LEAGUES[run.rank]!.name} · 本轮结算</span><h1>{result.won ? "这一柜，赢得漂亮。" : "差一点，换个办法。"}</h1><p>{result.reason}</p></div>
      <div className="c-result-stats"><span><b>{result.sales}</b>笔成交</span><span><b>{result.returningSales}</b>笔熟客生意</span><span><b>{result.perfectSales}</b>笔高匹配</span></div>
      <section className="c-lesson"><span>不是熬更久，是换一种赢法</span><p>{result.lesson}</p></section>
      {result.won && next && <div className="c-next-league"><span>下一场已解锁</span><h2>{next.name}</h2><p>{leagueBrief[next.id]}</p></div>}
      {result.won && !next && <div className="c-next-league"><span>五级联赛已完成</span><h2>换个流派，再赢一次？</h2><p>当前原型的联赛到这里。可换风格、换新客局挑战纪录，不用重复读旧剧情。</p></div>}
      <div className="c-kit"><h2>这轮的经营手感</h2><div>{run.perks.map(id => <span key={id}>{perkOf(id).icon} {perkOf(id).name}</span>)}</div><p>已完成 {profile.runs} 轮 · 胜出 {profile.wins} 轮</p></div>
    </Scroll>
    <Footer><button type="button" className="c-primary" onClick={onHome}>{result.won && next ? "去看看下一位对手" : "重新选打法，再来一轮"}<span>→</span></button></Footer>
  </>;
}

export default function CounterGame() {
  const keyboard = useKeyboard();
  const { bottomInset } = useKeyboardInsets();
  const [boot] = useState(() => { const raw = read(SAVE_KEY); const saved = parseRun(raw); return { run: saved, corrupt: !!raw && !saved }; });
  const [run, setRun] = useState<Run | null>(boot.run);
  const [profile, setProfile] = useState(() => parseProfile(read(META_KEY)));
  const [playing, setPlaying] = useState(false);
  const [style, setStyle] = useState<StyleId>(boot.run?.style ?? "reader");
  const [rank, setRank] = useState(() => Math.min(boot.run?.rank ?? profile.unlocked, profile.unlocked));
  const [menu, setMenu] = useState(false);
  const [replace, setReplace] = useState(false);
  const [muted, setMuted] = useState(sfxMuted);
  const [storageError, setStorageError] = useState(false);
  const league = LEAGUES[rank]!;
  const hasLiveRun = run && run.phase !== "result";
  const update = (fn: (r: Run) => Run) => { keyboard.hide(); setRun(prev => prev ? fn(prev) : prev); sfx("tap"); };
  const launch = () => {
    keyboard.hide();
    const seed = `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0]!.toString(36)}`;
    setRun(startRun(seed, Math.min(rank, profile.unlocked), style)); setPlaying(true); setReplace(false); sfx("up");
  };
  useEffect(() => {
    if (!run || !playing) return;
    try { localStorage.setItem(SAVE_KEY, serializeRun(run)); setStorageError(false); } catch { setStorageError(true); }
    if (run.phase === "result") setProfile(p => recordResult(p, run));
  }, [run, playing]);
  useEffect(() => {
    try { localStorage.setItem(META_KEY, JSON.stringify(profile)); } catch { setStorageError(true); }
  }, [profile]);
  const home = () => { keyboard.hide(); setPlaying(false); setMenu(false); setRank(p => Math.max(p, profile.unlocked)); };
  const shownRun = playing ? run : null;
  return <main className="counter-app" style={{ paddingBottom: bottomInset }} data-testid="counter-game" data-phase={shownRun?.phase ?? "lobby"}>
    <header className="c-header"><button type="button" className="c-brand" onClick={() => { keyboard.hide(); if (playing) setMenu(true); }} aria-label="人情场 · 赛程菜单"><span>人情场<i>LAST ORDER</i></span><b>七天争柜</b></button><button className="c-menu-button" type="button" aria-label="查看玩法与经营能力" onClick={() => { keyboard.hide(); setMenu(true); }}>☷</button></header>
    {storageError && <p className="c-storage-warning" role="alert">浏览器暂时无法保存，关闭页面可能丢失这轮进度。</p>}
    {shownRun && <><div className="c-run-status"><span>第 {shownRun.day} / 7 天 · {LEAGUES[shownRun.rank]!.name}</span><span aria-label={`信誉 ${shownRun.reputation}，小样 ${shownRun.samples}`}>♡ {shownRun.reputation} <i /> ◇ {shownRun.samples}</span></div><Score run={shownRun} /></>}
    {!shownRun ? <>
      <Scroll>
        <section className="c-hero"><span className="c-eyebrow">一场生意，一段人情。</span><h1>卖得漂亮，<br />不如赢得漂亮。</h1><p>七天，十四次选择。<br />把陌生人变成熟客，把你的打法练成招牌。</p><div className="c-hero-shelf">{[PRODUCTS[0]!, PRODUCTS[3]!, PRODUCTS[5]!].map(p => <Bottle key={p.id} product={p} />)}</div><span className="c-hero-number" aria-hidden="true">07</span><div className="c-hero-tag">有限交谈 · 真实利润 · 每局新打法</div></section>
        {boot.corrupt && !run && <p className="c-storage-warning" role="status">上次新版进度无法读取。原数据未删除，开始新局才会覆盖；旧版存档不受影响。</p>}
        {hasLiveRun && <button type="button" className="c-resume" onClick={() => { keyboard.hide(); setPlaying(true); }}><span><b>继续第 {run.day} 天</b><small>{phaseWord(run)} · {LEAGUES[run.rank]!.name}</small></span><span>→</span></button>}
        <div className="c-action-heading"><h2>先选你的销售风格</h2><span>不是职业限制</span></div>
        <div className="c-styles" role="group" aria-label="销售风格">{STYLES.map(s => <button type="button" key={s.id} aria-pressed={style === s.id} className={style === s.id ? "selected" : ""} onClick={() => setStyle(s.id)}><span>{s.icon}</span><b>{s.name}</b><small>{perkOf(s.perk).name}</small></button>)}</div>
        <p className="c-style-note">{STYLES.find(s => s.id === style)!.description}</p>
        <div className="c-action-heading"><h2>这次，争哪一柜？</h2><span>胜出才晋级</span></div>
        <div className="c-leagues" role="group" aria-label="联赛选择">{LEAGUES.map(l => <button type="button" key={l.id} disabled={l.id > profile.unlocked} aria-pressed={rank === l.id} aria-label={`${l.name}${l.id > profile.unlocked ? "，尚未解锁" : ""}`} className={rank === l.id ? "selected" : ""} onClick={() => setRank(l.id)}><span>{l.id > profile.unlocked ? "·" : `0${l.id + 1}`}</span><b>{l.name}</b><small>{l.id > profile.unlocked ? "赢下前一场解锁" : leagueBrief[l.id]}</small></button>)}</div>
        <p className="c-prototype-note">全新玩法试玩版 · 独立保存，不覆盖旧版进度。<br />一轮不是全通关，五场联赛的规则会改变。</p>
      </Scroll>
      <Footer><div className="c-foot-note">{league.name} · 7 天净收益超过对手，且信誉不能归零</div><button type="button" className="c-primary" onClick={() => hasLiveRun ? setReplace(true) : launch()}>{hasLiveRun ? "换打法，开始新一轮" : "开柜，迎接第一位客人"}<span>→</span></button></Footer>
    </> : <div className="c-stage" key={`${shownRun.day}:${shownRun.turn}:${shownRun.phase}`}>
      {shownRun.phase === "select" && <CustomerQueue run={shownRun} update={update} />}
      {shownRun.phase === "deal" && <Negotiation run={shownRun} update={update} />}
      {shownRun.phase === "receipt" && <ReceiptScreen run={shownRun} update={update} />}
      {shownRun.phase === "draft" && <DraftScreen run={shownRun} update={update} />}
      {shownRun.phase === "result" && <ResultScreen run={shownRun} profile={profile} onHome={home} />}
    </div>}
    <BottomSheet open={menu} title="这一柜，怎么赢？" description="少做机械操作，多做值得的决定。" snap={0.83} onOpenChange={setMenu}>
      <div className="c-menu-content"><MobileScroll><div className="c-menu-pad"><ol className="c-rules"><li><b>挑人</b>每天三位机会，只接两位；剩下的归对手。</li><li><b>谈单</b>用有限交谈确认需求、预算，或留一次试用。倾听能建立关系。</li><li><b>报价</b>收入减成本，才是利润。折扣能救单，也会吃掉利润；能力奖金单独列明。</li><li><b>成长</b>每天收柜三选一能力。真实熟客会带着新需求回来。</li><li><b>争柜</b>信誉耗尽提前出局；七天后净收益严格超过对手才赢，平局不算。</li></ol>
        <details className="c-details"><summary>本场的完整规则与匹配算法</summary><p>{LEAGUES[shownRun?.rank ?? rank]!.rule}</p><p>商品特性为 0–3 格。首要需求至少 1 格才有资格成交，不能靠加成弥补完全不对应。首要需求算两倍，次要算一倍；试用和倾听增加说服分，但不能替代预算。日常顾客门槛 6，不能将就的顾客门槛 8；高要求联赛再加 1。只有问出的需求和真实试用结果会在报价前显示。</p><p>每日基础客源收入为 220 + 天数×20 + 级别×15；已计入对手账。剩余和失败机会再单独计入，对手不会凭空加隐藏分。</p></details>
        {run && <div className="c-kit"><h2>你的经营能力</h2>{run.perks.map(id => <section key={id}><b>{perkOf(id).icon} {perkOf(id).name}</b><p>{perkOf(id).description}</p></section>)}</div>}
        <button type="button" className="c-secondary" onClick={() => { const next = !muted; sfxMute(next); setMuted(next); }}>{muted ? "打开音效" : "关闭音效"}</button>
        {playing && <button type="button" className="c-secondary" onClick={home}>保存并回到开柜页</button>}
      </div></MobileScroll></div><button type="button" className="c-primary" onClick={() => setMenu(false)}>知道了，回柜台</button>
    </BottomSheet>
    <BottomSheet open={replace} title="开始另一轮？" description="当前这一轮会被替换，联赛解锁与胜场保留。旧版存档不变。" snap={0.45} onOpenChange={setReplace}><div className="c-sheet-actions"><button type="button" className="c-primary" onClick={launch}>确认开始新一轮</button><button type="button" className="c-secondary" onClick={() => setReplace(false)}>保留这轮，先不换</button></div></BottomSheet>
  </main>;
}

import { useEffect, useMemo, useState } from "react";
import { MobileScroll } from "./mobile";
import {
  applyFinale, applyQuestion, applyRival, CUSTOMERS, DAYS, dayEvent, dawnNotices, ENERGY_LOCK, endingTitle,
  floorCustomers, hasFlag, historyByDay, INITIAL, leaveSample, openFloorState, parseCampaign, PRODUCTS, QUESTIONS,
  REACTIONS, relationText, resolveSale, RIVAL_IDS, RIVAL_INTERRUPTIONS, SAVE_KEY, spendAttention, startNextDay,
  TARGET, todayHistory, type Campaign, type CueId, type Customer, type CustomerId, type CustomerSession,
  type ProductId, type RivalChoice, type SaleOutcome, type StaffKey,
} from "./campaign";

type Screen = "intro" | "brief" | "floor" | "consultation" | "result" | "event" | "summary" | "finale";
type CharacterVisual = { name: string; role: string; sheet: "player" | "rival" | "manager"; portrait?: string };

const STAFF: Record<StaffKey, CharacterVisual> = {
  player: { name: "许愿", role: "试用期柜姐", sheet: "player", portrait: "/assets/game/staff-portraits/xuyuan.png" },
  luyao: { name: "陆遥", role: "竞品销冠", sheet: "rival", portrait: "/assets/game/staff-portraits/luyao.png" },
  roman: { name: "罗曼", role: "柜长", sheet: "manager", portrait: "/assets/game/staff-portraits/roman.png" },
  suman: { name: "苏蔓", role: "资深柜姐", sheet: "player", portrait: "/assets/game/staff-portraits/suman.png" },
  tangke: { name: "唐可", role: "同期新人", sheet: "rival", portrait: "/assets/game/staff-portraits/tangke.png" },
  fangmin: { name: "方敏", role: "合规负责人", sheet: "manager", portrait: "/assets/game/staff-portraits/fangmin.png" },
};

function loadCampaign(): Campaign | null {
  try {
    return parseCampaign(window.localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

function CharacterFace({ visual, className = "" }: { visual: CharacterVisual; className?: string }) {
  return <span className={`character-face face-${visual.sheet} ${className}`} role="img" aria-label={`${visual.name} · ${visual.role}`}>{visual.portrait ? <img src={visual.portrait} alt="" aria-hidden="true" /> : <i />}</span>;
}

function CustomerMapFigure({ customer }: { customer: Customer }) {
  return <span className={`map-character map-character-${customer.mapVariant}`}><i /><img src={customer.portrait} alt="" aria-hidden="true" /></span>;
}

export default function Prototype() {
  const saved = useMemo(loadCampaign, []);
  const [campaign, setCampaign] = useState<Campaign>(saved ?? INITIAL);
  const [screen, setScreen] = useState<Screen>("intro");
  const [customerId, setCustomerId] = useState<CustomerId | null>(null);
  const [selectedCue, setSelectedCue] = useState<CueId | null>(null);
  const [discovered, setDiscovered] = useState<CueId[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductId | null>(null);
  const [tested, setTested] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [interruption, setInterruption] = useState(false);
  const [interruptionHandled, setInterruptionHandled] = useState(false);
  const [askedQuestion, setAskedQuestion] = useState<number | null>(null);
  const [reaction, setReaction] = useState<"positive" | "negative" | null>(null);
  const [revisions, setRevisions] = useState(0);
  const [rivalChoice, setRivalChoice] = useState<RivalChoice | null>(null);
  const [serviceMotion, setServiceMotion] = useState<"inspect" | "trial" | "scan" | null>(null);
  const [outcome, setOutcome] = useState<SaleOutcome | null>(null);
  const [eventChoiceId, setEventChoiceId] = useState<string | null>(null);
  const [floorNotice, setFloorNotice] = useState<string | null>(null);

  const story = DAYS[campaign.day - 1];
  const customer = customerId ? CUSTOMERS[customerId] : null;
  const dayCustomerIds = floorCustomers(campaign);
  const available = dayCustomerIds.filter(id => !campaign.dayServed.includes(id) && !campaign.lost.includes(id));
  const remaining = Math.max(0, TARGET - campaign.sales);
  const event = dayEvent(campaign);
  const visibleChoices = event.choices.filter(choice => !choice.visible || choice.visible(campaign));
  const chosenEvent = visibleChoices.find(choice => choice.id === eventChoiceId) ?? null;
  const tired = campaign.energy < ENERGY_LOCK;
  const waitingOther = available.find(id => id !== customerId);
  const notices = dawnNotices(campaign);
  const ledger = historyByDay(campaign);
  const rival = customerId && (customerId === "shen" || customerId === "zhou" || customerId === "returning") ? RIVAL_INTERRUPTIONS[customerId] : null;

  useEffect(() => { if (screen !== "intro") window.localStorage.setItem(SAVE_KEY, JSON.stringify(campaign)); }, [campaign, screen]);
  useEffect(() => { requestAnimationFrame(() => { const frame = document.querySelector<HTMLElement>(".device-screen"); if (frame) frame.scrollTop = 0; }); }, [screen]);

  const beginNew = () => { window.localStorage.removeItem(SAVE_KEY); setCampaign(INITIAL); setEventChoiceId(null); setFloorNotice(null); setScreen("brief"); };
  const continueGame = () => {
    const current = openFloorState(campaign);
    if (current !== campaign) setCampaign(current);
    const ids = floorCustomers(current);
    const dayResolved = ids.every(id => current.dayServed.includes(id) || current.lost.includes(id));
    if (current.eventDoneDays.includes(current.day)) setScreen("summary");
    else if (dayResolved) setScreen("event");
    else setScreen("brief");
  };
  const restoreSession = (session: CustomerSession) => {
    setCustomerId(session.customerId);
    setDiscovered(session.discovered);
    setSelectedCue(session.discovered.at(-1) ?? null);
    setAskedQuestion(session.askedQuestion);
    setSelectedProduct(session.selectedProduct);
    setTested(session.tested);
    setReaction(session.reaction);
    setRevisions(session.revisions);
    setClaimed(session.claimed);
    setRivalChoice(session.rivalChoice);
    setInterruption(session.tested && RIVAL_IDS.includes(session.customerId) && !session.rivalChoice);
    setInterruptionHandled(Boolean(session.rivalChoice));
  };
  const beginCustomer = (id: CustomerId) => {
    const existing = campaign.activeSession?.customerId === id ? campaign.activeSession : null;
    if (!existing && tired) {
      setFloorNotice("你站得发黑。先把手头的接待做完，或结束今天。");
      return;
    }
    setFloorNotice(null);
    if (existing) restoreSession(existing);
    else {
      setCustomerId(id); setSelectedCue(null); setDiscovered([]); setAskedQuestion(null); setSelectedProduct(null);
      setTested(false); setReaction(null); setRevisions(0); setClaimed(false); setRivalChoice(null);
      setInterruption(false); setInterruptionHandled(false);
    }
    setScreen("consultation");
  };
  const saveSession = (patch: Partial<CustomerSession>) => setCampaign(s => {
    const base = s.activeSession?.customerId === customerId ? s.activeSession : { customerId: customerId!, discovered: [], askedQuestion: null, selectedProduct: null, tested: false, reaction: null, revisions: 0, claimed: false, rivalChoice: null };
    return { ...s, activeSession: { ...base, ...patch } };
  });
  const advanceFloor = (cost: number) => {
    if (!customerId) return;
    setCampaign(s => spendAttention(s, customerId, cost));
  };
  const inspect = (cue: CueId) => {
    setServiceMotion("inspect"); window.setTimeout(() => setServiceMotion(null), 360);
    setSelectedCue(cue); if (discovered.includes(cue)) return;
    const next = [...discovered, cue]; setDiscovered(next); advanceFloor(1); saveSession({ discovered: next });
  };
  const ask = (index: number) => {
    if (askedQuestion !== null || !customer) return;
    setAskedQuestion(index); advanceFloor(1); saveSession({ askedQuestion: index });
    setCampaign(s => applyQuestion(s, customer.id, index));
  };
  const selectProduct = (id: ProductId) => {
    setSelectedProduct(id);
    if (tested && id !== selectedProduct) {
      setRevisions(v => v + 1); setTested(false); setReaction(null);
      setCampaign(s => ({ ...s, energy: Math.max(0, s.energy - 5) }));
      saveSession({ selectedProduct: id, tested: false, reaction: null, revisions: revisions + 1 });
    } else {
      setTested(false); setReaction(null); saveSession({ selectedProduct: id, tested: false, reaction: null });
    }
  };
  const tryProduct = () => {
    if (!selectedProduct || !customer) return;
    advanceFloor(1); setServiceMotion("trial"); window.setTimeout(() => setServiceMotion(null), 650);
    const nextReaction = selectedProduct === customer.bestProduct ? "positive" : "negative";
    setTested(true); setReaction(nextReaction); saveSession({ tested: true, reaction: nextReaction, selectedProduct });
    if (RIVAL_IDS.includes(customer.id)) setInterruption(true);
  };
  const handleRival = (choice: RivalChoice) => {
    setRivalChoice(choice); setInterruptionHandled(true); setClaimed(choice === "record" ? true : claimed);
    saveSession({ rivalChoice: choice, claimed: choice === "record" ? true : claimed });
    setCampaign(s => applyRival(s, choice));
  };
  const sendSample = () => {
    if (!customer) return;
    setCampaign(s => leaveSample(s, customer.id));
  };
  const closeSale = (force = false) => {
    if (!customer || !selectedProduct || !tested) return;
    setServiceMotion("scan"); window.setTimeout(() => setServiceMotion(null), 520);
    const resolved = resolveSale(campaign, { customerId: customer.id, selectedProduct, tested, askedQuestion, claimed, interruption, interruptionHandled, force });
    if (!resolved) return;
    setCampaign(resolved.campaign);
    setOutcome(resolved.outcome);
    setScreen("result");
  };
  const afterResult = () => { if (available.filter(id => id !== customerId).length > 0) { setCustomerId(null); setScreen("floor"); } else setScreen("event"); };
  const chooseEvent = (id: string) => {
    const choice = visibleChoices.find(item => item.id === id);
    if (!choice) return;
    setEventChoiceId(id);
    setCampaign(s => {
      const applied = choice.apply(s);
      return { ...applied, eventDoneDays: applied.eventDoneDays.includes(applied.day) ? applied.eventDoneDays : [...applied.eventDoneDays, applied.day] };
    });
  };
  const finishDay = () => setScreen("summary");
  const nextDay = () => {
    if (campaign.day >= 5) {
      setCampaign(s => applyFinale(s));
      setScreen("finale");
      return;
    }
    setCampaign(s => startNextDay(s));
    setEventChoiceId(null); setCustomerId(null); setFloorNotice(null); setScreen("brief");
  };
  const resetGame = () => { window.localStorage.removeItem(SAVE_KEY); setCampaign(INITIAL); setEventChoiceId(null); setScreen("intro"); };
  const openFloor = () => setCampaign(s => openFloorState(s));

  if (screen === "intro") return <MobileScroll className="app-screen intro-scroll"><main className="intro-screen">
    <img src="/assets/game/counter-stage-toy.png" alt="绮光专柜" /><div className="intro-shade" /><div className="intro-brand"><span>AURORA · 绮光</span><b>新品活动周</b></div>
    <section className="intro-copy"><p>美妆销售 · 人情博弈 · 五日章节</p><h1>最后一单</h1><h2>你是试用期柜姐许愿。<br />每一笔销售，都决定谁欠你、谁恨你、谁会回来。</h2>
      <div className="shift-brief"><span><small>五日销售目标</small><b>¥{TARGET.toLocaleString("zh-CN")}</b></span><span><small>真正的考核</small><b>业绩与后果</b></span></div>
      <p className="intro-rule">观察面容、判断需求、守住订单。顾客会复购或退货，同事会记住你留下的每条记录。</p>
      <button className="primary-action" type="button" onClick={saved ? continueGame : beginNew}>{saved ? `继续第 ${campaign.day} 天` : "开始新品活动周"}</button>
      {saved && <button className="text-action" type="button" onClick={beginNew}>重新开始</button>}
    </section></main></MobileScroll>;

  if (screen === "brief") return <MobileScroll className="app-screen brief-scroll"><main className="brief-screen">
    <header><span>DAY {campaign.day} / 5</span><b>¥{campaign.sales.toLocaleString("zh-CN")} <small>/ ¥{TARGET.toLocaleString("zh-CN")}</small></b></header>
    <section className="brief-hero"><p>{story.subtitle}</p><h1>{story.title}</h1><div className="day-track">{DAYS.map(d => <i key={d.day} className={d.day < campaign.day ? "done" : d.day === campaign.day ? "now" : ""} />)}</div></section>
    <section className="brief-card"><b>今日现场</b><p>{story.brief}</p><em>{story.threat}</em></section>
    <section className="brief-orders"><span><small>今天必须守住</small><b>{dayCustomerIds.map(id => CUSTOMERS[id].name).join(" / ")}</b></span><span><small>可用小样</small><b>{campaign.samples}</b></span></section>
    {notices.map(note => <section className="message-preview" key={`${note.speaker}-${note.body}`}><b>{note.speaker}</b><p>{note.body}</p></section>)}
    <section className="message-preview"><b>罗曼 · 08:52</b><p>{story.threat}</p></section>
    <button className="primary-action" type="button" onClick={() => { openFloor(); setScreen("floor"); }}>开始营业</button>
  </main></MobileScroll>;

  if (screen === "consultation" && customer) {
    const canTest = discovered.length >= 2 && askedQuestion !== null && selectedProduct;
    const currentReaction = reaction && selectedProduct ? REACTIONS[selectedProduct][reaction] : null;
    const otherMeter = waitingOther ? campaign.waitMeters[waitingOther] ?? CUSTOMERS[waitingOther].patience : null;
    return <MobileScroll className="app-screen consultation-scroll"><main className={`consultation-game ${selectedCue ? "is-focusing" : ""} reaction-${reaction ?? "none"}`} aria-label={`接待${customer.name}`}>
      <img className="customer-portrait" src={customer.portrait} alt={`${customer.name}面部近景`} /><div className="portrait-grade" />
      <header className="consultation-hud"><button className="icon-button" type="button" onClick={() => { saveSession({ discovered, askedQuestion, selectedProduct, tested, reaction, revisions, claimed, rivalChoice }); setScreen("floor"); }} aria-label="返回现场">‹</button><div><strong>{customer.name}</strong><span>{customer.descriptor}</span></div><time>{waitingOther && otherMeter != null ? `${CUSTOMERS[waitingOther].name} ${otherMeter}/${CUSTOMERS[waitingOther].patience}` : `DAY ${campaign.day}`}</time></header>
      <div className="customer-speech"><span>{customer.opening}</span></div>
      <button type="button" className={`face-cue cue-eyes ${discovered.includes("eyes") ? "found" : ""}`} onClick={() => inspect("eyes")} aria-label="观察眼下"><i /></button>
      <button type="button" className={`face-cue cue-cheek ${discovered.includes("cheek") ? "found" : ""}`} onClick={() => inspect("cheek")} aria-label="观察脸颊"><i /></button>
      <button type="button" className={`face-cue cue-nose ${discovered.includes("nose") ? "found" : ""}`} onClick={() => inspect("nose")} aria-label="观察鼻翼"><i /></button>
      {selectedCue && <aside className="finding-card"><b>{customer.cues[selectedCue].label}</b><span>{customer.cues[selectedCue].finding}</span></aside>}
      {serviceMotion && <div className={`service-hand ${serviceMotion}`} aria-hidden="true"><i /><span>{serviceMotion === "inspect" ? "观察" : serviceMotion === "trial" ? "试妆" : "登记"}</span></div>}
      {interruption && !interruptionHandled && rival && <div className="rival-interruption multi"><div className="event-character-inline"><CharacterFace visual={STAFF.luyao} /><div><b>{rival.headline}</b><span>“{rival.quote}”</span></div></div><div className="rival-actions"><button type="button" onClick={() => handleRival("record")}>先登记接待</button><button type="button" onClick={() => handleRival("clarify")}>让顾客确认需求</button><button type="button" onClick={() => handleRival("yield")}>让她演示</button></div></div>}
      <section className="consultation-dock"><div className="consult-steps"><i className="done">观察</i><i className={askedQuestion !== null ? "done" : ""}>询问</i><i className={tested ? "done" : ""}>试用</i><i>成交</i></div><div className="insight-strip"><span>{discovered.length}/3 线索</span><b>{currentReaction ?? (discovered.length >= 2 ? customer.need : "点按面部线索，先看再问")}</b></div>
        {discovered.length >= 2 && askedQuestion === null ? <div className="question-options">{QUESTIONS[customer.id].map((q, index) => <button type="button" key={q.label} onClick={() => ask(index)}>{q.label}</button>)}</div> : askedQuestion !== null && !tested ? <div className="question-answer"><b>{QUESTIONS[customer.id][askedQuestion].response}</b></div> : null}
        <div className="product-options">{(Object.keys(PRODUCTS) as ProductId[]).map(id => <button type="button" key={id} className={selectedProduct === id ? "active" : ""} onClick={() => selectProduct(id)}><i className={`product-art product-art-${id}`} /><span>{PRODUCTS[id].short}</span><small>¥{PRODUCTS[id].price}</small></button>)}</div>
        {selectedProduct && <p className="product-note">{PRODUCTS[selectedProduct].note}</p>}
        {!tested ? <button className="primary-action" type="button" disabled={!canTest} onClick={tryProduct}>{canTest ? `为${customer.name}试用` : discovered.length < 2 ? "先观察两处面部线索" : askedQuestion === null ? "再问一个关键问题" : "选择产品开始试用"}</button> : reaction === "negative" ? <div className="recovery-actions"><button type="button" onClick={sendSample} disabled={campaign.samples <= 0 || hasFlag(campaign, `sample:${customer.id}`)}>留小样 · {campaign.samples}</button><b>反应不对：换一款，或承担拒绝风险</b></div> : null}
        {tested && reaction === "negative" ? <div className="close-actions negative-close"><button type="button" onClick={() => closeSale(false)}>接受拒绝</button><button className="primary-action" type="button" onClick={() => closeSale(true)}>强推成交</button></div> : tested ? <div className="close-actions"><button className={claimed ? "claimed" : ""} type="button" onClick={() => { setClaimed(!claimed); saveSession({ claimed: !claimed }); }}>{claimed ? "已登记归属" : "登记我的接待"}</button><button className="primary-action" type="button" onClick={() => closeSale(false)}>提出成交</button></div> : null}
      </section></main></MobileScroll>;
  }

  if (screen === "result" && outcome) return <MobileScroll className="app-screen result-scroll"><main className={`sale-result ${outcome.good ? "good" : "risky"}`}><div className="result-light" /><p>DAY {campaign.day} · 收银提示</p><span className="result-seal">{outcome.good ? "✓" : "!"}</span><h1>{outcome.title}</h1><strong>+ ¥{outcome.amount.toLocaleString("zh-CN")}</strong><p className="result-copy">{outcome.body}</p><div className="consequence-list"><span><b>顾客信任</b><em>{relationText(campaign.trust)}</em></span><span><b>订单留痕</b><em>{claimed ? "已登记" : "可能争议"}</em></span><span><b>剩余体力</b><em>{tired ? "几乎站不住" : campaign.energy >= 50 ? "还能再接" : "开始发沉"}</em></span></div><button className="primary-action" type="button" onClick={afterResult}>{available.filter(id => id !== customerId).length > 0 ? "回到现场" : "处理闭店事件"}</button></main></MobileScroll>;

  if (screen === "event") {
    const eventVisual = event.speakerStaff ? STAFF[event.speakerStaff] : null;
    const eventCustomer = event.speakerCustomer ? CUSTOMERS[event.speakerCustomer] : null;
    return <MobileScroll className="app-screen event-scroll"><main className="event-screen"><header><span>闭店后 · {event.speaker}</span><b>DAY {campaign.day}</b></header><section className="event-speaker-portrait">{eventCustomer ? <img src={eventCustomer.portrait} alt={`${eventCustomer.name}人物形象`} /> : eventVisual ? <CharacterFace visual={eventVisual} /> : null}<div><span>{event.speaker}</span><b>{eventCustomer ? eventCustomer.descriptor : eventVisual?.role}</b></div></section><p>{event.title}</p><h1>{event.body}</h1>{chosenEvent === null ? <div className="event-choices">{visibleChoices.map(choice => <button type="button" key={choice.id} onClick={() => chooseEvent(choice.id)}><b>{choice.label}</b><span>{choice.detail}</span></button>)}</div> : <section className="event-result"><b>{chosenEvent.label}</b><p>{chosenEvent.result}</p><button className="primary-action" type="button" onClick={finishDay}>查看今日账单</button></section>}</main></MobileScroll>;
  }

  if (screen === "summary") return <MobileScroll className="app-screen summary-scroll"><main className="summary-screen"><p>DAY {campaign.day} · 今日结束</p><h1>{campaign.daySales >= 3000 ? "数字涨了，账也留下了" : "不是每一天都能赢数字"}</h1><div className="summary-sale"><small>今日销售</small><b>¥{campaign.daySales.toLocaleString("zh-CN")}</b><span>累计 ¥{campaign.sales.toLocaleString("zh-CN")} / ¥{TARGET.toLocaleString("zh-CN")}</span></div><section className="ledger"><b>今天留下的事</b>{todayHistory(campaign).map(item => <p key={`${item.day}-${item.text}`}>{item.text}</p>)}</section><div className="summary-metrics"><span>信任 <b>{relationText(campaign.trust)}</b></span><span>合规 <b>{campaign.compliance >= 50 ? "还压得住" : "已经危险"}</b></span><span>证据 <b>{campaign.evidence}</b></span></div><button className="primary-action" type="button" onClick={nextDay}>{campaign.day === 5 ? "查看活动周结局" : "进入下一天"}</button></main></MobileScroll>;

  if (screen === "finale") {
    const salesWin = campaign.sales >= TARGET;
    const safe = campaign.compliance >= 50;
    const trusted = campaign.trust >= 55;
    const title = endingTitle(campaign);
    return <MobileScroll className="app-screen finale-scroll"><main className="finale-screen"><p>新品活动周 · 最终档案</p><h1>{title}</h1><div className="final-score"><span>销售</span><b>¥{campaign.sales.toLocaleString("zh-CN")}</b><small>{salesWin ? "完成五日目标" : "未完成五日目标"}</small></div><section className="ending-copy"><p>{salesWin ? "你证明了自己能成交。" : "罗曼没有给你漂亮的数字评价。"}{safe ? "合规记录没有把你单独钉在缺口上。" : "但赠品与订单记录已经构成一条危险的线。"}</p><p>{trusted ? "沈薇和几位顾客仍愿意直接找你。" : "顾客记得你卖出去的东西，却未必相信你会负责到底。"}</p><p>苏蔓：{relationText(campaign.relations.suman)}；唐可：{relationText(campaign.relations.tangke)}。</p></section>
      <section className="ledger-book" aria-label="五日因果账本"><b>五日因果账本</b>{ledger.map(group => <div className="ledger-day" key={group.day}><span>DAY {group.day} · {group.title}</span>{group.items.map(item => <p key={`${item.day}-${item.text}`}>{item.text}</p>)}</div>)}</section>
      <blockquote>真正的最后一单，不是付款成功的那一刻，而是它回来找你的那一天。</blockquote><button className="primary-action" type="button" onClick={resetGame}>重新开始 · 换一种活法</button></main></MobileScroll>;
  }

  const latestLost = campaign.lost.at(-1);
  return <MobileScroll className="app-screen stage-scroll"><main className="counter-game" aria-label={`${story.title}营业现场`}><img className="counter-background" src="/assets/game/counter-stage-toy.png" alt="绮光专柜" /><div className="stage-wash" /><header className="game-hud"><div><span>DAY {campaign.day} · {story.title}</span><b>许愿在柜台后</b></div><div className="target-mini"><span>距五日目标</span><b>¥{remaining.toLocaleString("zh-CN")}</b></div></header><div className="sales-progress"><i style={{ width: `${Math.min(100, campaign.sales / TARGET * 100)}%` }} /></div>
    <div className={`ambient-staff staff-rival pressure-${campaign.waitMeters.shen ?? campaign.waitMeters.zhou ?? 4}`}><CharacterFace visual={STAFF.luyao} /><p><b>陆遥</b>{available.some(id => CUSTOMERS[id].rival) ? "正在判断你先接谁" : "在对面观察"}</p></div><div className="ambient-staff staff-manager"><CharacterFace visual={STAFF.roman} /><p><b>罗曼</b>今日排名已更新</p></div>
    {available.map((id, index) => {
      const c = CUSTOMERS[id];
      const resumed = campaign.activeSession?.customerId === id;
      const meter = campaign.waitMeters[id] ?? c.patience;
      const locked = tired && !resumed;
      return <button type="button" key={id} className={`customer-presence character-presence ${index % 2 ? "customer-mei" : "customer-shen"} ${resumed ? "is-resumable" : ""} ${locked ? "is-locked" : ""}`} onClick={() => beginCustomer(id)} aria-label={`观察${c.name}`} disabled={locked}><CustomerMapFigure customer={c} /><span className="presence-copy"><b>{c.name}</b><small>{resumed ? "继续接待" : locked ? "你需要先缓一缓" : c.descriptor.split(" · ")[1] || c.descriptor}</small></span><i className={`patience-meter ${meter <= 2 ? "is-urgent" : ""}`}><span style={{ width: `${Math.max(0, meter / c.patience) * 100}%` }} /></i></button>;
    })}
    {latestLost && <div className="lost-opportunity"><b>机会已消失</b><span>{CUSTOMERS[latestLost].lostLine}</span></div>}
    <section className="player-console compact"><div className="player-identity"><CharacterFace visual={STAFF.player} /><div><strong>许愿 · 试用期柜姐</strong><b>{campaign.activeSession ? `${CUSTOMERS[campaign.activeSession.customerId].name}的接待还没结束` : tired ? "体力见底，接不了新人" : story.threat}</b><small>{floorNotice ?? (campaign.activeSession ? "返回不会清空判断；另一边仍在流失" : "点一位顾客，把注意力交给她")}</small></div></div><p>{available.length > 1 ? "每次观察、提问、试用，都会让另一位客人继续流失" : tired ? `剩余体力 ${campaign.energy} · 低于 ${ENERGY_LOCK} 时不能新开接待` : "顾客会记住你的判断，也会记住你的承诺。"}</p></section>
  </main></MobileScroll>;
}

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { KeyboardInput, MobileScroll, useKeyboard, useKeyboardInsets, useMobileDevice } from "./mobile";
import {
  addMember, advanceFloorTime, applyQuestion, applyRival, applyTouch, BUNDLES, BUNDLE_MINUTE_HINT, bundleMinutesWord, canAddMember, canCheckCounter, canLeaveSample, canPullOver, canTransferVia, CHECK_COUNTER_NOTE, checkCounter, checkCounterLabel, complianceWord, COMPLIANCE_RISK, consultationRecord, counterVerdict, CUSTOMERS, DAYS, dayEvent, dawnNotices, demandBudgetWord, ENERGY_LOCK, endingTitle, energyWord, evidenceWord, EXPIRED_SAMPLING,
  fitOf, FACE_TRIAL_MINUTES, FACE_TRIAL_RETURN, faceTrialReveal, floorCustomers, historyByDay, inferUseful, INITIAL, LEAVE_SAMPLE_RETURN, leaveSample, openFloorState, parseCampaign, PRODUCTS, pullOver, pullOverLabel, PULL_OVER_RETURN, QUESTIONS, canClaim, CLAIM_LABEL, CLAIM_NOTE,
  orderQuote, OBSERVE_MIN, offerTransfer, REACTIONS, relationText, resolveSale, RIVAL_IDS, RIVAL_INTERRUPTIONS, SAVE_KEY, settleDayEvent, spendAttention, startNextDay, startService,
  TARGET, tonightTouches, touchReply, touchesLeft, touchThreads, transferLabel, transferStock, structureLine, TRAIT_LABELS, todayHistory, unitsWanted, visibleChoices, type BundleId, type Campaign, type ChatLine, type CueId, type Customer, type CustomerId, type CustomerSession,
  type ProductId, type RivalChoice, type SaleOutcome, type StaffKey, type TransferChannel, type Trait,
} from "./campaign";
import { requestConsultReply } from "./consultChat";
import {
  customerAction, customerHome, customerMood, customerSpeech, defaultFocus, formatClock,
  isWalking, partyLines, poseAt, rivalApproach, rivalHome, SHIFT_START, staffAction, staffSpeech,
  staffMood, staffRelation, stepPose, voiceTarget, waitCopy, WAYPOINTS, type ActorPose, type FloorFocus,
  type FloorSpeed, type FloorStaffId,
} from "./floorLife";

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

function StaffMapFigure({ visual }: { visual: CharacterVisual }) {
  return <span className={`map-character map-staff map-staff-${visual.sheet}`}><i /></span>;
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
  const [reaction, setReaction] = useState<"positive" | "mixed" | "negative" | null>(null);
  const [bundle, setBundle] = useState<BundleId>("single");
  const [revealed, setRevealed] = useState<Trait[]>([]);
  const [faceTrialled, setFaceTrialled] = useState(false);
  const [faceTrialShown, setFaceTrialShown] = useState<Trait | null>(null);
  const [revisions, setRevisions] = useState(0);
  const [rivalChoice, setRivalChoice] = useState<RivalChoice | null>(null);
  const [serviceMotion, setServiceMotion] = useState<"inspect" | "trial" | "scan" | null>(null);
  const [outcome, setOutcome] = useState<SaleOutcome | null>(null);
  const [eventChoiceId, setEventChoiceId] = useState<string | null>(null);
  const [floorNotice, setFloorNotice] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [talking, setTalking] = useState(false);
  const [floorFocus, setFloorFocus] = useState<FloorFocus | null>(null);
  const [floorBeat, setFloorBeat] = useState(0);
  const [floorSpeed, setFloorSpeed] = useState<FloorSpeed>(1);
  const floorClock = SHIFT_START + campaign.shiftMinutes;
  const floorElapsed = campaign.shiftMinutes + campaign.floorSeconds / 20;
  const [poses, setPoses] = useState<Record<string, ActorPose>>({});
  const keyboard = useKeyboard();
  const { bottomInset } = useKeyboardInsets();
  const { device } = useMobileDevice();
  const floorSim = useRef({ available: [] as CustomerId[], waitMeters: INITIAL.waitMeters, contested: false, elapsed: 0 });

  const story = DAYS[campaign.day - 1];
  const customer = customerId ? CUSTOMERS[customerId] : null;
  const dayCustomerIds = floorCustomers(campaign);
  const available = dayCustomerIds.filter(id => !campaign.dayServed.includes(id) && !campaign.lost.includes(id));
  const remaining = Math.max(0, TARGET - campaign.sales);
  const event = dayEvent(campaign);
  const shownChoices = visibleChoices(campaign, event);
  // 已经按下的那一格要按 id 回全量列表找：visible 是按当下状态算的，垫货那一格按下去自己就会翻假
  // （进度追平、或旗子落下），那时确认屏读不到它就等于把玩家丢回选择列表。
  const chosenEvent = event.choices.find(choice => choice.id === eventChoiceId) ?? null;
  const tired = campaign.energy < ENERGY_LOCK;
  const waitingOther = available.find(id => id !== customerId);
  const notices = dawnNotices(campaign);
  const ledger = historyByDay(campaign);
  const rival = customerId && (customerId === "shen" || customerId === "zhou" || customerId === "returning") ? RIVAL_INTERRUPTIONS[customerId] : null;

  useEffect(() => { if (screen !== "intro") window.localStorage.setItem(SAVE_KEY, JSON.stringify(campaign)); }, [campaign, screen]);
  useEffect(() => { requestAnimationFrame(() => { const frame = document.querySelector<HTMLElement>(".device-screen"); if (frame) frame.scrollTop = 0; }); }, [screen]);
  useEffect(() => {
    setFloorBeat(0);
    setPoses({});
    setFloorSpeed(1);
    setFloorFocus(null);
  }, [campaign.day]);
  useEffect(() => {
    const pause = () => { if (document.hidden) setFloorSpeed(0); };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  useEffect(() => {
    if (screen === "floor" && available.length === 0) setScreen("event");
  }, [screen, available.length]);
  useEffect(() => {
    if (screen !== "floor") return;
    setFloorFocus(current => current ?? defaultFocus(available, campaign.waitMeters));
  }, [screen, campaign.day, campaign.dayServed.join("|"), campaign.lost.join("|")]);
  floorSim.current = { available, waitMeters: campaign.waitMeters, contested: available.some(id => CUSTOMERS[id].rival), elapsed: floorElapsed };
  useEffect(() => {
    if (screen !== "floor") return;
    setPoses(current => {
      const next = { ...current };
      available.forEach((id, index) => {
        if (next[id]) return;
        const home = customerHome(index, campaign.waitMeters[id] ?? CUSTOMERS[id].patience, CUSTOMERS[id].patience);
        next[id] = poseAt(home);
      });
      if (!next.luyao) next.luyao = poseAt(rivalHome(0), WAYPOINTS.rivalHold);
      if (!next.roman) next.roman = poseAt(WAYPOINTS.checkout, { left: 72, top: 61 });
      return next;
    });
  }, [screen, available.join("|")]);
  useEffect(() => {
    if (screen !== "floor" || floorSpeed === 0) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const { available: ids, waitMeters, contested: hot, elapsed } = floorSim.current;
      setCampaign(value => advanceFloorTime(value, .38 * floorSpeed));
      setFloorBeat(value => {
        const beat = value + 1;
        setPoses(current => {
          const next = { ...current };
          ids.forEach((id, index) => {
            const meter = waitMeters[id] ?? CUSTOMERS[id].patience;
            const home = customerHome(index, meter, CUSTOMERS[id].patience);
            const pose = next[id] ?? poseAt(home);
            const dest = beat % 8 === 0 && meter > 2 ? (index === 0 ? WAYPOINTS.testerSide : WAYPOINTS.openLow) : home;
            next[id] = stepPose({ ...pose, destLeft: dest.left, destTop: dest.top }, floorSpeed);
          });
          const luyaoDest = hot ? rivalHome(rivalApproach(ids, waitMeters, elapsed)) : WAYPOINTS.rivalHold;
          const romanDest = beat % 12 < 7 ? WAYPOINTS.checkout : WAYPOINTS.romanSide;
          next.luyao = stepPose({ ...(next.luyao ?? poseAt(luyaoDest)), destLeft: luyaoDest.left, destTop: luyaoDest.top }, floorSpeed);
          next.roman = stepPose({ ...(next.roman ?? poseAt(romanDest)), destLeft: romanDest.left, destTop: romanDest.top }, floorSpeed);
          return next;
        });
        return beat;
      });
    }, 380);
    return () => window.clearInterval(timer);
  }, [screen, floorSpeed]);

  const beginNew = () => { window.localStorage.removeItem(SAVE_KEY); setCampaign(INITIAL); setEventChoiceId(null); setFloorNotice(null); setScreen("brief"); };
  const continueGame = () => {
    const current = openFloorState(campaign);
    if (current !== campaign) setCampaign(current);
    const ids = floorCustomers(current);
    const dayResolved = ids.every(id => current.dayServed.includes(id) || current.lost.includes(id));
    if (current.finished) setScreen("finale");
    else if (current.eventDoneDays.includes(current.day)) setScreen("summary");
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
    setBundle(session.bundle);
    setRevealed(session.revealed);
    setFaceTrialled(session.faceTrialled);
    setFaceTrialShown(session.faceTrialRevealed);
    setRevisions(session.revisions);
    setClaimed(session.claimed);
    setRivalChoice(session.rivalChoice);
    setChat(session.chat ?? []);
    setDraft("");
    setTalking(false);
    setInterruption(session.tested && RIVAL_IDS.includes(session.customerId) && !session.rivalChoice);
    setInterruptionHandled(Boolean(session.rivalChoice));
  };
  const beginCustomer = (id: CustomerId) => {
    if (campaign.activeSession && campaign.activeSession.customerId !== id) {
      setFloorNotice(`你还在接待${CUSTOMERS[campaign.activeSession.customerId].name}，先完成这一笔。`);
      setFloorFocus({ kind: "customer", id: campaign.activeSession.customerId });
      return;
    }
    const existing = campaign.activeSession?.customerId === id ? campaign.activeSession : null;
    if (!existing && tired) {
      setFloorNotice("你站得发黑。先把手头的接待做完，或结束今天。");
      return;
    }
    setFloorNotice(null);
    if (existing) restoreSession(existing);
    else {
      setCampaign(s => startService(s, id));
      setCustomerId(id); setSelectedCue(null); setDiscovered([]); setAskedQuestion(null); setSelectedProduct(null);
      setTested(false); setReaction(null); setRevisions(0); setClaimed(false); setRivalChoice(null); setChat([]);
      setBundle("single"); setRevealed([]);
      setFaceTrialled(false); setFaceTrialShown(null);
      setDraft(""); setTalking(false);
      setInterruption(false); setInterruptionHandled(false);
    }
    setScreen("consultation");
  };
  const saveSession = (patch: Partial<CustomerSession>) => setCampaign(s => {
    const base = s.activeSession?.customerId === customerId ? s.activeSession : { customerId: customerId!, discovered: [], askedQuestion: null, selectedProduct: null, bundle: "single" as BundleId, revealed: [] as Trait[], tested: false, reaction: null, faceTrialled: false, faceTrialRevealed: null as Trait | null, revisions: 0, claimed: false, rivalChoice: null, chat: [] };
    return { ...s, activeSession: { ...base, ...patch } };
  });
  const advanceFloor = (cost: number) => {
    if (!customerId) return;
    setCampaign(s => spendAttention(s, customerId, cost));
  };
  const inspect = (cue: CueId) => {
    setServiceMotion("inspect"); window.setTimeout(() => setServiceMotion(null), 360);
    setSelectedCue(cue); if (discovered.includes(cue)) return;
    const next = [...discovered, cue]; setDiscovered(next); advanceFloor(1);
    const nextRevealed = [...new Set([...revealed, ...(customer?.cues[cue].reveals ?? [])])]; setRevealed(nextRevealed);
    saveSession({ discovered: next, revealed: nextRevealed });
  };
  const ask = (index: number) => {
    if (!customer || talking) return;
    void speak(QUESTIONS[customer.id][index].label, index);
  };
  const speak = async (text: string, chipIndex: number | null = null) => {
    if (!customer || talking) return;
    const message = text.trim();
    if (!message) return;
    const firstAsk = askedQuestion === null;
    const useful = chipIndex != null ? Boolean(QUESTIONS[customer.id][chipIndex].useful) : inferUseful(customer.id, message);
    const index = chipIndex ?? (useful ? 0 : 1);
    const canned = chipIndex != null ? QUESTIONS[customer.id][chipIndex].response : (useful ? QUESTIONS[customer.id].find(question => question.useful)?.response : "你要是只想完成任务，我现在就可以走。") ?? customer.opening;
    const playerLine: ChatLine = { role: "player", text: message };
    const customerLine: ChatLine = { role: "customer", text: canned };
    const nextChat = [...chat, playerLine, customerLine].slice(-8);
    setChat(nextChat);
    setDraft("");
    keyboard.hide();
    const nextRevealed = [...new Set([...revealed, ...(QUESTIONS[customer.id][index]?.reveals ?? [])])];
    setRevealed(nextRevealed);
    if (firstAsk) {
      setAskedQuestion(index);
      advanceFloor(1);
      saveSession({ askedQuestion: index, chat: nextChat, revealed: nextRevealed });
      setCampaign(s => applyQuestion(s, customer.id, index));
    } else {
      advanceFloor(1);
      saveSession({ chat: nextChat, revealed: nextRevealed });
      setCampaign(s => ({ ...s, energy: Math.max(0, s.energy - 3) }));
    }
    setTalking(true);
    try {
      const result = await requestConsultReply({ customerId: customer.id, playerMessage: message, discovered, chat: nextChat, day: campaign.day });
      if (result.reply && result.source === "model") {
        const updated = [...nextChat.slice(0, -1), { role: "customer" as const, text: result.reply }];
        setChat(updated);
        saveSession({ chat: updated, askedQuestion: firstAsk ? index : askedQuestion });
      }
    } finally {
      setTalking(false);
    }
  };
  const selectProduct = (id: ProductId) => {
    if (id === selectedProduct) return;
    setSelectedProduct(id);
    // 换一支等于重新上脸；她上脸时说出口的那件事留着，不用重新试。
    setFaceTrialled(false);
    if (tested && id !== selectedProduct) {
      setRevisions(v => v + 1); setTested(false); setReaction(null);
      setCampaign(s => ({ ...s, energy: Math.max(0, s.energy - 5) }));
      saveSession({ selectedProduct: id, tested: false, reaction: null, revisions: revisions + 1, faceTrialled: false });
    } else {
      setTested(false); setReaction(null); saveSession({ selectedProduct: id, tested: false, reaction: null, faceTrialled: false });
    }
  };
  const tryProduct = () => {
    if (!selectedProduct || !customer || tested || discovered.length < 2 || askedQuestion === null) return;
    setSelectedCue(null);
    advanceFloor(1); setServiceMotion("trial"); window.setTimeout(() => setServiceMotion(null), 650);
    const nextReaction = fitOf(customer, selectedProduct).tier;
    setTested(true); setReaction(nextReaction); saveSession({ tested: true, reaction: nextReaction, selectedProduct });
    if (RIVAL_IDS.includes(customer.id)) setInterruption(true);
  };
  const faceTrial = () => {
    if (!customer || !tested || faceTrialled) return;
    const shown = faceTrialReveal(customer, discovered, revealed);
    setFaceTrialled(true); setFaceTrialShown(shown); setSelectedCue(null);
    setServiceMotion("trial"); window.setTimeout(() => setServiceMotion(null), 650);
    advanceFloor(FACE_TRIAL_MINUTES);
    const nextRevealed = shown ? [...new Set([...revealed, shown])] : revealed;
    setRevealed(nextRevealed);
    saveSession({ faceTrialled: true, faceTrialRevealed: shown, revealed: nextRevealed });
  };
  const handleRival = (choice: RivalChoice) => {
    if (interruptionHandled) return;
    setRivalChoice(choice); setInterruptionHandled(true); setClaimed(choice === "record" ? true : claimed);
    saveSession({ rivalChoice: choice, claimed: choice === "record" ? true : claimed });
    setCampaign(s => applyRival(s, choice));
  };
  const sendSample = () => {
    if (!customer) return;
    setCampaign(s => leaveSample(s, customer.id));
  };
  // 打电话这三分钟是从排队的人头上扣的，手上这位不能一起扣——她还在柜台前等你回来。
  const callStock = (channel: TransferChannel) => {
    if (!selectedProduct) return;
    setCampaign(s => transferStock(s, selectedProduct, channel, customerId));
  };
  const closeSale = (force = false, claim = false) => {
    if (!customer || !selectedProduct || !tested) return;
    setServiceMotion("scan"); window.setTimeout(() => setServiceMotion(null), 520);
    const resolved = resolveSale(campaign, { customerId: customer.id, selectedProduct, bundle, revealed, tested, askedQuestion, claimed, interruption, interruptionHandled, force, claim, faceTrialled, rivalChoice });
    if (!resolved) return;
    setCampaign(resolved.campaign);
    setOutcome(resolved.outcome);
    setScreen("result");
  };
  const afterResult = () => { if (available.filter(id => id !== customerId).length > 0) { setCustomerId(null); setScreen("floor"); } else setScreen("event"); };
  const chooseEvent = (id: string) => {
    const choice = shownChoices.find(item => item.id === id);
    if (!choice) return;
    setEventChoiceId(id);
    setCampaign(s => settleDayEvent(s, id));
  };
  const finishDay = () => setScreen("summary");
  const nextDay = () => {
    if (campaign.day >= 5) {
      setCampaign(s => startNextDay(s));
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
    <section className="brief-orders"><span><small>今天必须守住</small><b>{dayCustomerIds.map(id => CUSTOMERS[id].name).join(" / ")}</b></span><span><small>小样 / 私域名单</small><b>{campaign.samples} 份 · {campaign.members.length} 人</b></span></section>
    {notices.map(note => <section className="message-preview" key={`${note.speaker}-${note.body}`}><b>{note.speaker}</b><p>{note.body}</p></section>)}
    {/* 今日现场的风险那一行上面已经念过；这里再造一条"罗曼 · 08:52"是把规则提示安到别人头上，同一屏还读两遍。 */}
    {campaign.day >= EXPIRED_SAMPLING.fromDay && <section className="brief-check">
      <button type="button" disabled={!canCheckCounter(campaign)} onClick={() => setCampaign(s => checkCounter(s))}>{checkCounterLabel(campaign)}</button>
      <p>{CHECK_COUNTER_NOTE}</p>
    </section>}
    <button className="primary-action" type="button" onClick={() => { openFloor(); setScreen("floor"); }}>开始营业</button>
  </main></MobileScroll>;

  if (screen === "consultation" && customer) {
    const canTest = discovered.length >= OBSERVE_MIN && askedQuestion !== null && selectedProduct;
    const currentReaction = reaction && selectedProduct ? REACTIONS[selectedProduct][reaction] : null;
    const otherMeter = waitingOther ? campaign.waitMeters[waitingOther] ?? CUSTOMERS[waitingOther].patience : null;
    const pendingRival = interruption && !interruptionHandled;
    // 抽屉里还剩几支，是报价单的第四道闸：先量现货，再报件数。
    const stockLeft = selectedProduct ? campaign.stock[selectedProduct] : 0;
    const quote = selectedProduct ? orderQuote(customer.id, selectedProduct, bundle, rivalChoice === "yield", stockLeft) : null;
    const record = consultationRecord(customer, discovered, revealed, tested);
    // 没看的点、答出来的要求、还没问到的条数、问到才知道的底线：合成一句，没说的部分不占行。
    const saidLine = [record.face, record.said.length ? `她在意：${record.said.join(" · ")}` : "", record.blind, record.veto ? `底线：${record.veto}` : ""].filter(Boolean).join(" · ");
    return <div className="app-screen consultation-shell"><main className={`consultation-game ${selectedCue ? "is-focusing" : ""} reaction-${reaction ?? "none"}`} aria-label={`接待${customer.name}`}>
      <img className="customer-portrait" src={customer.portrait} alt={`${customer.name}面部近景`} /><div className="portrait-grade" />
      <header className="consultation-hud" style={{ paddingTop: device.geometry.safeArea.top + 7, paddingBottom: 8 }}><button className="icon-button" type="button" onClick={() => { keyboard.hide(); saveSession({ discovered, askedQuestion, selectedProduct, bundle, revealed, tested, reaction, revisions, claimed, rivalChoice, chat }); setScreen("floor"); }} aria-label="返回现场">‹</button><div><strong>{customer.name}</strong><span>{customer.descriptor}</span></div><time>{waitingOther && otherMeter != null ? `${CUSTOMERS[waitingOther].name} ${otherMeter}/${CUSTOMERS[waitingOther].patience}` : `DAY ${campaign.day}`}</time></header>
      <div className="customer-speech" style={{ top: device.geometry.safeArea.top + 72 }}><span>{chat.at(-1)?.role === "customer" ? chat.at(-1)?.text : customer.opening}</span></div>
      {/* 点位按脸的位置摆，名字用她自己给的那句：观察按钮说「灯光」时，读到的也是灯光。 */}
      {(["eyes", "cheek", "nose"] as const).map(cue => <button key={cue} type="button" className={`face-cue cue-${cue} ${discovered.includes(cue) ? "found" : ""}`} onClick={() => inspect(cue)} aria-label={`观察${customer.cues[cue].label}`} aria-pressed={discovered.includes(cue)}><i /></button>)}
      {selectedCue && discovered.length < 2 && <aside className="finding-card"><b>{customer.cues[selectedCue].label}</b><span>{customer.cues[selectedCue].finding}</span></aside>}
      {serviceMotion && <div className={`service-hand ${serviceMotion}`} aria-hidden="true"><i /><span>{serviceMotion === "inspect" ? "观察" : serviceMotion === "trial" ? "试妆" : "登记"}</span></div>}
      {pendingRival && rival && <div className="rival-interruption multi"><p className="rival-trial-result">{currentReaction}</p><div className="event-character-inline"><CharacterFace visual={STAFF.luyao} /><div><b>{rival.headline}</b><span>“{rival.quote}”</span></div></div><div className="rival-actions"><button type="button" onClick={() => handleRival("record")}>先登记接待</button><button type="button" onClick={() => handleRival("clarify")}>让顾客确认需求</button><button type="button" aria-label="让她演示" onClick={() => handleRival("yield")}>让她演示<small>业绩各半</small></button></div></div>}
      {/* 两档高度都是量出来的：还没观察到两处线索时 20%（脚下的动作行要 59 设计像素，17% 那一档她念第一条线索的那句话会被压在折线下 12 像素；
          19% 刚好贴线、只剩 1 像素，自由输入那一档她的句子可能更长，所以留到 10 像素），
          其余阶段 46%（再抬就把脸颊、鼻翼两枚面部线索盖进抽屉里，脸才是主玩面）。
          这里以前有第三档「成交 48%」，但它被 CSS 的 max-height:46% 夹住、从来没渲染过：量到的一直是 45.8%。删掉的是那条 max-height，不是这个决定。 */}
      {!pendingRival && <section className="consultation-dock" style={{ bottom: 10 + bottomInset, height: discovered.length < 2 ? "20%" : "46%" }}><MobileScroll className="consultation-controls"><div className="consult-steps"><i className={discovered.length >= 2 ? "done" : ""}>观察</i><i className={askedQuestion !== null ? "done" : ""}>询问</i><i className={tested ? "done" : ""}>试用</i><i>成交</i></div><div className="insight-strip"><b>{currentReaction ?? (discovered.length >= 2 ? (askedQuestion !== null ? "听她的反应，再选产品试用" : "开口问她真正在意什么") : "点按面部线索，先看再问")}</b></div>
        {/* 不再是「2/3 线索 · 诉求 1/3」：她答出来的用原话念，没问到的只报条数。 */}
        {saidLine && <p className="demand-said">{saidLine}</p>}
        {chat.length > 0 && !tested && <div className="consult-chat" aria-label="接待对话">{chat.slice(-1).map((line, index) => <p key={`${line.role}-${index}`} className={line.role}>{line.role === "player" ? "你" : customer.name}：{line.text}</p>)}</div>}
        {discovered.length >= 2 && askedQuestion === null ? <div className="question-options">{QUESTIONS[customer.id].map((q, index) => <button type="button" key={q.label} onClick={() => ask(index)} disabled={talking}>{q.label}</button>)}</div> : null}
        {discovered.length >= 2 && !tested && <form className="consult-composer" onSubmit={(event) => { event.preventDefault(); void speak(draft); }}>
          <KeyboardInput aria-label="对顾客说" placeholder={askedQuestion === null ? "用你的话问她" : "继续跟她说"} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={talking} />
          <button type="submit" disabled={talking || !draft.trim()}>{talking ? "在听" : "开口"}</button>
        </form>}
        {askedQuestion !== null && (!tested || reaction === "negative" || reaction === "mixed") && <div className="product-options">{(Object.keys(PRODUCTS) as ProductId[]).map(id => <button type="button" key={id} className={selectedProduct === id ? "active" : ""} onClick={() => selectProduct(id)}><i className={`product-art product-art-${id}`} /><span>{PRODUCTS[id].short}</span><small>¥{PRODUCTS[id].price}</small></button>)}</div>}
        {selectedProduct && !tested && <p className="product-note">{PRODUCTS[selectedProduct].note}</p>}
        {tested && !faceTrialled && <button type="button" className="face-trial-action" onClick={faceTrial}><b>半脸上妆 · 多占 {FACE_TRIAL_MINUTES} 分钟</b><small>{FACE_TRIAL_RETURN}</small></button>}
        {faceTrialShown && <p className="face-trial-said">妆面压在她脸上，她才承认：{TRAIT_LABELS[faceTrialShown]}</p>}
        {tested && faceTrialled && !faceTrialShown && <p className="face-trial-said">这半张脸没有新东西：该说的刚才都说了。</p>}
        {tested && quote && <section className="mobile-order-quote" aria-label="本单报价">{quote.lines.map(line => <p key={line.label}><span>{line.label}</span><span>¥{line.amount.toLocaleString("zh-CN")}</span></p>)}{quote.note && <small>{quote.note}</small>}<b>整单 ¥{quote.total.toLocaleString("zh-CN")} · 你入账 ¥{quote.amount.toLocaleString("zh-CN")}{quote.shared ? "（各半）" : ""} · 现场 {quote.minutes} 分</b></section>}
        {selectedProduct && tested && quote && offerTransfer(campaign, selectedProduct, quote) && <div className="stock-transfer">{(["official", "tangke"] as TransferChannel[]).map(channel => <button type="button" key={channel} disabled={!canTransferVia(campaign, selectedProduct, channel)} onClick={() => callStock(channel)}>{transferLabel(campaign, selectedProduct, channel)}</button>)}</div>}
        {/* 手机版这一屏没有第二格念得下她的预算与上限：成交那一档连带四格的下沿离脚只剩 4 设计像素（量出来的），
            再加一行就要把四格推到脚下，所以这两句在这里合成一行；沙盘把它们拆给诉求板和连带行两个槽。措辞都由 campaign.ts 一处出。 */}
        {selectedProduct && tested && reaction === "positive" && <div className="bundle-row" role="group" aria-label="连带件数">{(Object.keys(BUNDLES) as BundleId[]).map(id => {
          const units = unitsWanted(customer, selectedProduct, id, "positive", stockLeft);
          return <button type="button" key={id} className={bundle === id ? "active" : ""} disabled={!units} onClick={() => { setBundle(id); saveSession({ bundle: id }); }}><span>{BUNDLES[id].label}</span><small>{units ? `${units} 件 ¥${(units * PRODUCTS[selectedProduct].price).toLocaleString("zh-CN")} · ${bundleMinutesWord(id, units)}` : stockLeft ? "她不会多拿" : "柜上这一支断了"}</small></button>;
        })}<em>{demandBudgetWord(customer)} · {BUNDLE_MINUTE_HINT}</em></div>}
      </MobileScroll>
        {/* 手上这一步做什么，做成抽屉的脚：它是 MobileScroll 之外的同级固定层，不跟着滚，所以断货那一屏也永远按得到「提出成交」。
            高度、代价与量法都写在 prototype.css 那一段注释里。 */}
        <div className="consultation-foot">{!tested ? <button className="primary-action" type="button" disabled={!canTest} onClick={tryProduct}>{canTest ? `为${customer.name}试用` : discovered.length < 2 ? "先观察两处面部线索" : askedQuestion === null ? "再问一个关键问题" : "选择产品开始试用"}</button> : reaction === "negative" ? <div className="recovery-actions"><button type="button" onClick={sendSample} disabled={!canLeaveSample(campaign, customer.id)}>留小样 · {campaign.samples}</button><b>反应不对：换一款，或承担拒绝风险</b>{canLeaveSample(campaign, customer.id) && <small>{LEAVE_SAMPLE_RETURN}</small>}</div> : null}
        {tested && reaction === "negative" ? <div className="close-actions negative-close"><button type="button" onClick={() => closeSale(false)}>接受拒绝</button><button className="primary-action" type="button" onClick={() => closeSale(true)}>强推成交</button>{selectedProduct && canClaim(campaign, customer.id, selectedProduct, bundle) ? <button className="claim-action" type="button" onClick={() => closeSale(true, true)}><b>{CLAIM_LABEL}</b><small>{CLAIM_NOTE}</small></button> : null}</div> : tested ? <div className="close-actions"><button className={claimed ? "claimed" : ""} type="button" onClick={() => { setClaimed(!claimed); saveSession({ claimed: !claimed }); }}>{claimed ? "已登记归属" : "登记我的接待"}</button><button className="primary-action" type="button" onClick={() => closeSale(false)}>提出成交</button></div> : null}</div>
      </section>}</main></div>;
  }

  if (screen === "result" && outcome) return <MobileScroll className="app-screen result-scroll"><main className={`sale-result ${outcome.good ? "good" : "risky"}`}><div className="result-light" /><p>DAY {campaign.day} · 收银提示</p><span className="result-seal">{outcome.good ? "✓" : "!"}</span><h1>{outcome.title}</h1><strong>+ ¥{outcome.amount.toLocaleString("zh-CN")}</strong><p className="result-copy">{outcome.body}</p><div className="consequence-list"><span><b>顾客信任</b><em>{relationText(campaign.trust)}</em></span><span><b>订单留痕</b><em>{claimed ? "已登记" : "可能争议"}</em></span><span><b>剩余体力</b><em>{energyWord(campaign.energy)}</em></span></div><button className="primary-action" type="button" onClick={afterResult}>{available.filter(id => id !== customerId).length > 0 ? "回到现场" : "处理闭店事件"}</button></main></MobileScroll>;

  if (screen === "event") {
    const eventVisual = event.speakerStaff ? STAFF[event.speakerStaff] : null;
    const eventCustomer = event.speakerCustomer ? CUSTOMERS[event.speakerCustomer] : null;
    const threads = touchThreads(campaign), touchedTonight = tonightTouches(campaign);
    return <MobileScroll className="app-screen event-scroll"><main className="event-screen"><header><span>闭店后 · {event.speaker}</span><b>DAY {campaign.day}</b></header><section className="event-speaker-portrait">{eventCustomer ? <img src={eventCustomer.portrait} alt={`${eventCustomer.name}人物形象`} /> : eventVisual ? <CharacterFace visual={eventVisual} /> : null}<div><span>{event.speaker}</span><b>{eventCustomer ? eventCustomer.descriptor : eventVisual?.role}</b></div></section><p>{event.title}</p><h1>{event.body}</h1>{chosenEvent === null && threads.length > 0 && <section className="evening-touch"><h2>今晚跟一句 · 还能发 {touchesLeft(campaign)} 条</h2>{touchedTonight.length === 0 && <p>小样发出去、微信加上，都不算完。今晚问一句使用感，她才会再推开这个门；一个人整周只跟一次。</p>}<div className="touch-list">{threads.map(thread => <button type="button" key={thread.id} disabled={touchesLeft(campaign) <= 0} onClick={() => setCampaign(state => applyTouch(state, thread.id))}><b>{CUSTOMERS[thread.id].name}</b><span>{thread.detail}</span></button>)}</div>{touchedTonight.map(id => <p className="touch-reply" key={id}>{touchReply(campaign, id)}</p>)}</section>}{chosenEvent === null ? <div className="event-choices">{shownChoices.map(choice => <button type="button" key={choice.id} onClick={() => chooseEvent(choice.id)}><b>{choice.label}</b><span>{choice.detail}</span></button>)}</div> : <section className="event-result"><b>{chosenEvent.label}</b><p>{chosenEvent.result}</p><button className="primary-action" type="button" onClick={finishDay}>查看今日账单</button></section>}</main></MobileScroll>;
  }

  if (screen === "summary") return <MobileScroll className="app-screen summary-scroll"><main className="summary-screen"><p>DAY {campaign.day} · 今日结束</p><h1>{campaign.daySales >= 3000 ? "数字涨了，账也留下了" : "不是每一天都能赢数字"}</h1><div className="summary-sale"><small>今日销售</small><b>¥{campaign.daySales.toLocaleString("zh-CN")}</b><span>累计 ¥{campaign.sales.toLocaleString("zh-CN")} / ¥{TARGET.toLocaleString("zh-CN")}</span></div><section className="ledger"><b>今天留下的事</b>{todayHistory(campaign).map(item => <p key={`${item.day}-${item.text}`}>{item.text}</p>)}</section><div className="summary-metrics"><span>信任 <b>{relationText(campaign.trust)}</b></span><span>记录本 <b>{evidenceWord(campaign.evidence)}</b></span></div><p className={"summary-compliance" + (campaign.compliance < COMPLIANCE_RISK ? " at-risk" : "")}>{complianceWord(campaign.compliance)}</p><button className="primary-action" type="button" onClick={nextDay}>{campaign.day === 5 ? "查看活动周结局" : "进入下一天"}</button></main></MobileScroll>;

  if (screen === "finale") {
    const salesWin = campaign.sales >= TARGET;
    const safe = campaign.compliance >= COMPLIANCE_RISK;
    const trusted = campaign.trust >= 55;
    const title = endingTitle(campaign);
    const counter = counterVerdict(campaign);
    return <MobileScroll className="app-screen finale-scroll"><main className="finale-screen"><p>新品活动周 · 最终档案</p><h1>{title}</h1><div className="final-score"><span>销售</span><b>¥{campaign.sales.toLocaleString("zh-CN")}</b><small>{salesWin ? "完成五日目标" : "未完成五日目标"}</small></div><p className="week-structure">{structureLine(campaign)}</p><section className="ending-copy"><p>{salesWin ? "你证明了自己能成交。" : "罗曼没有给你漂亮的数字评价。"}{safe ? "合规记录没有把你单独钉在缺口上。" : "但赠品与订单记录已经构成一条危险的线。"}</p><p>{trusted ? "沈薇和几位顾客仍愿意直接找你。" : "顾客记得你卖出去的东西，却未必相信你会负责到底。"}</p><p>苏蔓：{relationText(campaign.relations.suman)}；唐可：{relationText(campaign.relations.tangke)}。</p><p className="counter-verdict"><b>柜位 · {counter.label}</b>{counter.body}</p></section>
      <section className="ledger-book" aria-label="五日因果账本"><b>五日因果账本</b>{ledger.map(group => <div className="ledger-day" key={group.day}><span>DAY {group.day} · {group.title}</span>{group.items.map(item => <p key={`${item.day}-${item.text}`}>{item.text}</p>)}</div>)}</section>
      <blockquote>真正的最后一单，不是付款成功的那一刻，而是它回来找你的那一天。</blockquote><button className="primary-action" type="button" onClick={resetGame}>重新开始 · 换一种活法</button></main></MobileScroll>;
  }

  const latestLost = campaign.lost.at(-1);
  const contested = available.some(id => CUSTOMERS[id].rival);
  const focus = floorFocus ?? defaultFocus(available, campaign.waitMeters);
  const focusCustomer = focus?.kind === "customer" ? CUSTOMERS[focus.id] : null;
  const focusStaff = focus?.kind === "staff" ? STAFF[focus.id] : null;
  const fallbackFocus = defaultFocus(available, campaign.waitMeters);
  const serveId = focusCustomer?.id ?? (fallbackFocus?.kind === "customer" ? fallbackFocus.id : null);
  const serveCustomer = serveId ? CUSTOMERS[serveId] : null;
  const focusMeter = focusCustomer ? campaign.waitMeters[focusCustomer.id] ?? focusCustomer.patience : 0;
  const focusResumed = focusCustomer ? campaign.activeSession?.customerId === focusCustomer.id : false;
  const serveLocked = Boolean(serveCustomer && tired && campaign.activeSession?.customerId !== serveCustomer.id);
  const inspectVisual = focusCustomer ? { name: focusCustomer.name, role: focusCustomer.descriptor, sheet: "player" as const, portrait: focusCustomer.portrait } : focusStaff;
  const inspectNow = focusCustomer
    ? customerAction(focusCustomer, focusMeter, focusResumed, contested && focusCustomer.rival)
    : focus?.kind === "staff" ? staffAction(focus.id, contested) : story.threat;
  const inspectMood = focusCustomer
    ? customerMood(focusCustomer, focusMeter)
    : focus?.kind === "staff" ? staffMood(focus.id, focus.id === "luyao" ? campaign.relations.luyao : campaign.relations.roman) : "当班";
  const closeness = rivalApproach(available, campaign.waitMeters, floorElapsed);
  const inspectQuote = focusCustomer
    ? customerSpeech(focusCustomer, focusMeter, focusResumed, closeness > .4 && focusCustomer.rival, true)
    : focus?.kind === "staff" ? staffSpeech(focus.id, contested) : "点现场里的人，先看她在做什么。";
  const liveFeed = partyLines(available, campaign, contested);
  // 控制台只列顶上那行和身份块没念过的人：同一个人的状态在一屏里说两遍，面板就只剩占地方——而它正压着站在柜台前的人。
  const focusName = focusCustomer?.name ?? focusStaff?.name ?? null;
  // 页顶那行也不报面板已经点名的人：它是"还有谁在等"，不是她的第二份状态。现场只剩她一个时才回到她身上。
  const ambient = contested ? [`陆遥 · ${staffAction("luyao", true)}`, ...liveFeed] : liveFeed;
  const notFocused = (line: string) => !focusName || !line.startsWith(`${focusName} · `);
  const feedLine = ambient.find(notFocused) ?? ambient[0];
  const otherLines = liveFeed.filter(line => line !== feedLine && notFocused(line));
  const poseOf = (id: string, fallback: { left: number; top: number; face: 1 | -1 }) => poses[id] ?? { ...fallback, destLeft: fallback.left, destTop: fallback.top };
  // 体力这一句只留一个槽：身份块在念它的时候，面板最下面那行让给那句承诺，同一屏不能出现两个"还剩几位"。
  const energyLine = energyWord(campaign.energy);
  const energyInIdentity = !floorNotice && tired && !campaign.activeSession;
  const identityNote = floorNotice ?? (energyInIdentity ? energyLine : focusCustomer ? `${inspectMood} · ${waitCopy(focusMeter, focusCustomer.patience)}` : focus?.kind === "staff" ? `${inspectMood} · ${staffRelation(campaign, focus.id)}` : "点人看她在做什么，再决定接谁");
  const floorHint = available.length > 1 ? "每次观察、提问、试用，都会让另一位客人继续流失"
    : tired && !energyInIdentity ? energyLine : "顾客会记住你的判断，也会记住你的承诺。";
  const staffOnFloor: FloorStaffId[] = ["luyao", "roman"];
  const customerPose = (id: CustomerId, index: number): ActorPose => {
    const patience = campaign.waitMeters[id] ?? CUSTOMERS[id].patience;
    const home = customerHome(index, patience, CUSTOMERS[id].patience);
    const placed = poses[id];
    // 还没落位那一帧人也在门口、正往自己那一格走：兜底若用家里的位置，名牌会先从柜台那头瞬移回门口再走回来（穿过整块沙盘），
    // 墙上那句和点亮的名牌就对不上；若连"要去哪儿"都不带，两位一起进场的客人就会在门口叠成一块牌。
    if (placed) return placed;
    return { ...WAYPOINTS.entrance, destLeft: home.left, destTop: home.top, face: home.left < 40 ? 1 : -1 };
  };
  const staffPose = (id: FloorStaffId) => poseOf(id, {
    ...(id === "luyao" ? rivalHome(rivalApproach(available, campaign.waitMeters, floorElapsed)) : WAYPOINTS.checkout),
    face: id === "luyao" ? 1 : -1,
  });
  // 一次只让一个人开口，并且把这句话放在人群上方的空墙上：390 宽的柜台上，气泡压在别人身上就两败俱伤。
  // 开口的还是"面板没点中的那个人"（P21），但挑人改成看现场、不看拍子：陆遥靠过来就轮到她，否则轮到耐心最少的那一位。
  // 按拍子轮一圈等于一句话只闪 380 毫秒，读不完，也答不出这一屏真正要问的"该先看谁"。
  const focusKey = `${focus?.kind}:${focus?.id}`;
  const meterLeft = (id: CustomerId) => campaign.waitMeters[id] ?? CUSTOMERS[id].patience;
  const othersOnFloor: FloorFocus[] = [...available.map(id => ({ kind: "customer" as const, id })), ...staffOnFloor.map(id => ({ kind: "staff" as const, id }))]
    .filter(entry => `${entry.kind}:${entry.id}` !== focusKey);
  const speaker = voiceTarget(othersOnFloor, campaign.waitMeters, closeness);
  const speaking = speaker?.kind === "customer"
    ? {
      left: customerPose(speaker.id, available.indexOf(speaker.id)).left,
      line: customerSpeech(CUSTOMERS[speaker.id], meterLeft(speaker.id), campaign.activeSession?.customerId === speaker.id, closeness > .4 && CUSTOMERS[speaker.id].rival),
    }
    : speaker?.kind === "staff"
      ? { left: staffPose(speaker.id).left, line: staffSpeech(speaker.id, contested) }
      : null;

  return <MobileScroll className="app-screen stage-scroll"><main className="counter-game" aria-label={`${story.title}营业现场`}>
    <img className="counter-background" src="/assets/game/counter-stage-toy.png" alt="绮光专柜" /><div className="stage-wash" />
    <header className="game-hud">
      <div><span>DAY {campaign.day} · {story.title}</span><b>{formatClock(floorClock)}</b></div>
      <div className="target-mini"><span>距五日目标</span><b>¥{remaining.toLocaleString("zh-CN")}</b></div>
    </header>
    <div className="floor-feed-row">
      <p className="floor-feed">{feedLine}</p>
      <div className="speed-rail" role="group" aria-label="现场时间">{([0, 1, 2, 4] as FloorSpeed[]).map(value => <button type="button" key={value} className={floorSpeed === value ? "is-on" : ""} onClick={() => setFloorSpeed(value)}>{value === 0 ? "停" : `${value}x`}</button>)}</div>
    </div>
    <div className="floor-stage">
      {available.map((id, index) => {
        const c = CUSTOMERS[id];
        const pose = customerPose(id, index);
        const resumed = campaign.activeSession?.customerId === id;
        const meter = campaign.waitMeters[id] ?? c.patience;
        const selected = focus?.kind === "customer" && focus.id === id;
        const walking = isWalking(pose) || meter <= 2;
        return <button type="button" key={id} className={`floor-actor is-customer ${walking ? "is-walking" : "is-idle"} ${meter <= 2 ? "is-urgent" : ""} ${resumed ? "is-resumable" : ""} ${selected ? "is-selected" : ""} ${speaker?.kind === "customer" && speaker.id === id ? "is-speaking" : ""}`} style={{ left: `${pose.left}%`, top: `${pose.top}%`, zIndex: 32 + Math.round(pose.top) }} onClick={() => setFloorFocus({ kind: "customer", id })} aria-label={`查看${c.name}`}>
          <span className="actor-body"><span className="actor-sprite" style={{ transform: `scaleX(${pose.face})` }}><CustomerMapFigure customer={c} /></span></span>
          <span className="actor-tag">{c.name}</span>
        </button>;
      })}
      {staffOnFloor.map(staffId => {
        const pose = staffPose(staffId);
        const selected = focus?.kind === "staff" && focus.id === staffId;
        return <button type="button" key={staffId} className={`floor-actor is-staff staff-${staffId} ${isWalking(pose) ? "is-walking" : "is-idle"} ${selected ? "is-selected" : ""} ${speaker?.kind === "staff" && speaker.id === staffId ? "is-speaking" : ""}`} style={{ left: `${pose.left}%`, top: `${pose.top}%`, zIndex: 16 + Math.round(pose.top) }} onClick={() => setFloorFocus({ kind: "staff", id: staffId })} aria-label={`查看${STAFF[staffId].name}`}>
          <span className="actor-body"><span className="actor-sprite" style={{ transform: `scaleX(${pose.face})` }}><StaffMapFigure visual={STAFF[staffId]} /></span></span>
          <CharacterFace visual={STAFF[staffId]} className="floor-face" />
          <span className="actor-tag">{STAFF[staffId].name}</span>
        </button>;
      })}
      {speaking && <span className={`actor-bubble stage-bubble ${speaking.left > 50 ? "from-right" : ""}`} style={{ "--bubble-x": `${Math.max(20, Math.min(80, speaking.left))}%` } as CSSProperties}>{speaking.line}</span>}
    </div>
    {latestLost && <div className="lost-opportunity"><b>机会已消失</b><span>{CUSTOMERS[latestLost].lostLine}</span></div>}
    <section className="player-console compact inspect-dock">
      <div className="console-head">
        <div className="player-identity">
          <CharacterFace visual={STAFF.player} className="player-chip" />
          {inspectVisual && inspectVisual.name !== STAFF.player.name ? <CharacterFace visual={inspectVisual} /> : null}
          <div>
            {/* 名字要在标题行里：下面那一行不再重复念她，控制台得自己说清"这是谁"。 */}
            <strong>{focusCustomer ? `${focusCustomer.name} · ${focusCustomer.descriptor}` : focusStaff ? `${focusStaff.name} · ${focusStaff.role}` : "许愿 · 试用期柜姐"}</strong>
            <b>{inspectNow}</b>
            <small>{identityNote}</small>
          </div>
        </div>
        <blockquote className="inspect-quote">{inspectQuote}</blockquote>
        {otherLines.length > 0 && <ul className="party-list">{otherLines.map(line => <li key={line}>{line}</li>)}</ul>}
      </div>
      <div className="dock-actions">
        {serveCustomer && <button className="primary-action" type="button" disabled={serveLocked} aria-label={`观察${serveCustomer.name}`} onClick={() => beginCustomer(serveCustomer.id)}>{campaign.activeSession?.customerId === serveCustomer.id ? `继续接待${serveCustomer.name}` : `观察${serveCustomer.name}`}</button>}
        {focusCustomer && <button className="member-action" type="button" disabled={!canAddMember(campaign, focusCustomer.id)} aria-label={`加微信${focusCustomer.name}`} onClick={() => setCampaign(s => addMember(s, focusCustomer.id))}>{campaign.members.includes(focusCustomer.id) ? `${focusCustomer.name}已在名单` : canAddMember(campaign, focusCustomer.id) ? "加微信 · 1 分钟" : "加微信 · 要先有接触"}</button>}
        {/* 她已经往中庭那边走过去了：这一条整行放，按钮上直接写清楚花什么、什么时候轮得到；请得动的时候下面一行写买到什么。 */}
        {focusCustomer && !campaign.dayServed.includes(focusCustomer.id) && !campaign.lost.includes(focusCustomer.id) && <button className="member-action pull-action" type="button" disabled={!canPullOver(campaign, focusCustomer.id)} aria-label={canPullOver(campaign, focusCustomer.id) ? `迎上去 ${focusCustomer.name} · ${PULL_OVER_RETURN}` : `迎上去 ${focusCustomer.name}`} onClick={() => setCampaign(s => pullOver(s, focusCustomer.id))}>{pullOverLabel(campaign, focusCustomer.id)}{canPullOver(campaign, focusCustomer.id) && <small>{PULL_OVER_RETURN}</small>}</button>}
      </div>
      <p>{floorHint}</p>
    </section>
  </main></MobileScroll>;
}

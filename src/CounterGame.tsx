import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  advanceFloorTime, addMember, askService, availableCustomers, BUNDLES, canAddMember, chooseBundle, closeService, complianceWord, COMPLIANCE_RISK, counterVerdict, CUSTOMERS, DAYS, dayEvent,
  dawnNotices, endingTitle, ENERGY_LOCK, FACE_TRIAL_MINUTES, faceTrialService, FLOOR_SECONDS_PER_ACTION, hasFlag, historyByDay, INITIAL, leaveSample,
  observeService, openFloorState, orderQuote, parseCampaign, PRODUCTS, progressTarget, REACTIONS, relationText, releaseService, requestStaffHelp,
  respondToRival, RIVAL_IDS, RIVAL_INTERRUPTIONS, SAVE_KEY, selectServiceProduct, settleDayEvent, spendAttention, standingWord,
  startNextDay, startService, STANDING_RISK, TARGET, TRAIT_LABELS, trialService, unitsWanted, visibleChoices,
  type BundleId, type Campaign, type CueId, type CustomerId, type ProductId, type SaleOutcome,
} from "../dynamic-counter-prototype/src/campaign";
import { asset } from "./sim/asset";
import { customerPortrait as portrait } from "./experience-art";
import { BAG_SPOTS, BROWSE_BEATS, EXIT_SPOTS, STAFF_BEATS, STAGE_SPOTS, TIGHT_PLATE_SCALE, blend, poseOn, standBeside, standing, worldToPercent, worldZ, type Pose } from "./floor-stage";
import { WORLD, type Point } from "./rush-rules";
import "./rescue.css";
import { CHAPTER_HOOKS, ChapterTrack, ConsultationNotes, DemandBoard, GameDialog, questionChoices, ShiftHandbook } from "./Experience";
import "./experience.css";

type Screen = "intro" | "brief" | "floor" | "consultation" | "result" | "event" | "summary" | "finale";
type StaffId = "player" | "luyao" | "roman" | "suman" | "tangke";
type Focus = CustomerId | StaffId;
const STAFF: Record<StaffId, { name: string; role: string; art: keyof typeof STAFF_BEATS }> = {
  player: { name: "许愿", role: "试用期柜姐 · 你", art: "xuyuan" },
  luyao: { name: "陆遥", role: "竞品销冠", art: "luyao" },
  roman: { name: "罗曼", role: "柜长", art: "roman" },
  suman: { name: "苏蔓", role: "资深柜姐", art: "suman" },
  tangke: { name: "唐可", role: "同期新人", art: "tangke" },
};
// 每个人错开半拍，免得整层楼同时迈步。
const wanderPhase = (key: string) => (key.charCodeAt(0) + key.length * 7) % 11 * 0.6;
// 三个点位按脸的位置摆放，但每个顾客给它们的叫法不一样（灯光、清单、手机）：念出来要念她的那句。
const CUES: CueId[] = ["eyes", "cheek", "nose"];
const money = (value: number) => "¥" + value.toLocaleString("zh-CN");
const isCustomer = (id: Focus): id is CustomerId => Object.hasOwn(CUSTOMERS, id);
// 复购角色是同一个人，不是新人物：她们共用原来的立绘和近景，只有当天要多问的东西不一样。
const ART_ALIAS: Partial<Record<CustomerId, string>> = { returning: "shen", zhou2: "zhou", anjie2: "anjie" };
const customerArt = (id: CustomerId) => asset("assets/chibi/" + (ART_ALIAS[id] ?? id) + ".png");
// 名牌单独一层，永远画在所有人之上：站在前面的人挡不住后面那个人的名字。
const LABEL_Z = 1000;
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
  const session = game.activeSession;
  const quote = orderQuote(id, product, session?.bundle ?? "single", session?.rivalChoice === "yield");
  return <section className="order-quote" aria-label="本单报价">
    <div><b>本单报价</b><span>{quote.shared ? "与陆遥各记一半" : "记入你的业绩"}</span></div>
    {quote.lines.map(line => <p key={line.label}><span>{line.label}</span><span>{money(line.amount)}</span></p>)}
    {!quote.lines.length && <p><span>{PRODUCTS[product].name}</span><span>她不会带走</span></p>}
    <p className="quote-total"><span>整单 {money(quote.total)}</span><strong>你入账 {money(quote.amount)}</strong></p>
    <p className="quote-time"><span>开单与讲搭配</span><span>{quote.minutes} 分钟 · 另一边还在等</span></p>
    {quote.note && <small className="quote-note">{quote.note + "。"}</small>}
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
  const [askingAgain, setAskingAgain] = useState(false);
  const [outcome, setOutcome] = useState<SaleOutcome | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [handbook, setHandbook] = useState(false);
  const dockRef = useRef<HTMLElement>(null);
  const dialogOrigin = useRef<HTMLElement | null>(null);
  const modalOpen = confirmRestart || handbook;
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const panned = useRef(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [sceneSize, setSceneSize] = useState({ width: 900, height: 480 });
  const [controlBand, setControlBand] = useState(0);
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
  const picked = session?.selectedProduct ?? null;
  const showProducts = Boolean(session && session.askedQuestion !== null && !askingAgain && (!session.tested || revising) && !pendingRival);
  const stage = !session || session.discovered.length < 2 ? 0 : session.askedQuestion === null || askingAgain ? 1 : !session.tested || revising ? 2 : 3;
  const chapter = CHAPTER_HOOKS[game.day - 1];
  const eventResponse = game.history.filter(entry => entry.day === game.day && entry.text.startsWith("回应 · ")).at(-1)?.text.slice(5);
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
  // 底部控制条吃掉多少高度只写在 CSS 里，这里量回来：窄屏的沙盘要从可见带里让出这一截。
  // 控制条在右上角的档位量出来是 0，本来就不用让。
  useEffect(() => {
    const measure = () => {
      const scene = sceneRef.current?.getBoundingClientRect(), bar = controlsRef.current?.getBoundingClientRect();
      setControlBand(scene && bar && scene.bottom - bar.bottom <= 14 ? Math.max(0, Math.round(scene.bottom - bar.top)) : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (sceneRef.current) observer.observe(sceneRef.current);
    if (controlsRef.current) observer.observe(controlsRef.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [screen]);

  useEffect(() => { dockRef.current?.scrollTo({ top: 0 }); }, [screen, stage, pendingRival, revising]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && screen === "floor" && !modalOpen) setSpeed(0);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [screen, modalOpen]);

  const begin = () => { setGame(INITIAL); setFocus("shen"); setScreen("brief"); setSpeed(0); setOutcome(null); setConfirmRestart(false); setAskingAgain(false); };
  const showHandbook = () => { dialogOrigin.current = document.activeElement as HTMLElement; setSpeed(0); setHandbook(true); };
  const showRestart = () => { dialogOrigin.current = document.activeElement as HTMLElement; setSpeed(0); setConfirmRestart(true); };
  const openFloor = () => { setGame(value => openFloorState(value)); setScreen("floor"); setSpeed(1); };
  const beginCustomer = (id: CustomerId) => {
    if (session && session.customerId !== id) return;
    const next = startService(game, id);
    if (next.activeSession?.customerId !== id) return;
    setGame(next); setFocus(id); setScreen("consultation"); setRevising(false); setAskingAgain(false); setDraft("");
  };
  const ask = (text: string, index?: number) => { setGame(value => askService(value, text, index)); setDraft(""); setAskingAgain(false); };
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
  // 底部控制条（手机上）叠在沙盘下缘，正好盖住门口那一排名牌的两行下摆（名牌下缘会超出脚下约 20px），
  // 所以从沙盘里划出这一截：地图只在带以上居中，按钮永远在带以下。带多高按 DOM 量，不写死。
  // 只在"横向铺满"那一档让出这截：整张图收进来时地图比屏幕窄，按钮本来就落在两侧的留白里，不该白扣高度。
  const pannable = sceneSize.width < sceneSize.height * mapRatio;
  const controlInset = pannable ? controlBand : 0;
  const bandHeight = sceneSize.height - controlInset;
  // 沙盘画多大只在这里算一次。上下裁会把人脚下的名牌裁掉半截，所以只裁左右：沙盘本来就靠拖着看。
  const worldWidth = pannable ? bandHeight * mapRatio : Math.min(sceneSize.width, bandHeight * mapRatio);
  // 铺满了还容不下一张名牌（横屏手机这类又扁又矮的窗口）才收起路人牌子，只留选中/开口的那张：
  // 宁可少两个名字，也不要人名压人名。
  const tightPlates = worldWidth / WORLD.width < TIGHT_PLATE_SCALE;
  const moveCamera = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // 起手先不抓 pointer capture：抓住了点击就不会落到人身上（手机上人挤人，落点常常就是立绘）。
    // 真的拖起来（>6px）之后再抓，这样拖出沙盘边界也还能继续挪镜头。
    if (Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) > 6) {
      panned.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // 能拖到的边界就是地图超出可见带的那截：门口的人不能被永久裁在屏幕外。
    const limitX = Math.max(0, (worldWidth - sceneSize.width) / 2), limitY = Math.max(0, (worldWidth / mapRatio - bandHeight) / 2);
    setCamera({ x: Math.max(-limitX, Math.min(limitX, drag.current.cx + e.clientX - drag.current.x)), y: Math.max(-limitY, Math.min(limitY, drag.current.cy + e.clientY - drag.current.y)) });
  };
  // 手机上常常是从某个人的立绘上起手拖镜头：拖过一下就不算"点她"，松手不该顺手换掉选中的人。
  const pickActor = (id: Focus) => { if (!panned.current) setFocus(id); };
  const waitLabel = (id: CustomerId) => {
    const remaining = Math.max(0, (game.waitMeters[id] ?? CUSTOMERS[id].patience) - game.floorSeconds / 20);
    return Math.ceil(remaining) + " 分钟耐心";
  };
  const customerStatus = (id: CustomerId) => game.dayServed.includes(id) ? "已接待" : game.lost.includes(id) ? "已离开" :
    session?.customerId === id ? "接待中" : (game.waitMeters[id] ?? CUSTOMERS[id].patience) <= 2 ? "开始看表" : "正在等你";
  const stageMinutes = game.shiftMinutes + game.floorSeconds / FLOOR_SECONDS_PER_ACTION;
  // 晨会念的是"到昨天为止应该做到多少"，界面上只说人话，不再挂一条进度条。
  const progressNeed = progressTarget(game.day - 1);
  const counter = counterVerdict(game);
  const patienceLeft = (id: CustomerId) => Math.max(0, (game.waitMeters[id] ?? CUSTOMERS[id].patience) - game.floorSeconds / 20);
  const customerPose = (id: CustomerId, index: number): Pose => {
    // 每个人的门口位置按当天序号分配：走了的人、正在往外挪的人，都不会挤在同一格。
    const doorway = EXIT_SPOTS[index % EXIT_SPOTS.length];
    if (game.lost.includes(id)) return poseOn(standing(doorway), 0);
    if (game.dayServed.includes(id)) return poseOn(standing(BAG_SPOTS[index % BAG_SPOTS.length]), 0);
    if (session?.customerId === id) return poseOn(standing(STAGE_SPOTS.mirror), 0);
    const browse = poseOn(BROWSE_BEATS[index % BROWSE_BEATS.length], stageMinutes, wanderPhase(id));
    // 耐心在倒数，她也一点一点往自己那格门口挪。直线从维珞柜台的下方过道穿过，不必再绕等待位。
    return { ...browse, point: blend(browse.point, doorway, 1 - patienceLeft(id) / CUSTOMERS[id].patience) };
  };
  const contestedId = available.find(id => CUSTOMERS[id].rival);
  const contestedPose = contestedId ? customerPose(contestedId, todayIds.indexOf(contestedId)) : null;
  const pressure = contestedId ? Math.max(0, Math.min(1, 1 - patienceLeft(contestedId) / CUSTOMERS[contestedId].patience)) : 0;
  const staffPose = (id: StaffId): Pose => {
    const beat = STAFF_BEATS[STAFF[id].art];
    if (id === "player") return session ? poseOn(standing(STAGE_SPOTS.makeupStool), 0) : poseOn(beat, stageMinutes, wanderPhase(id));
    const base = poseOn(beat, stageMinutes, wanderPhase(id));
    // 客人快守不住时，陆遥会离开自己那条线迎上去。
    if (id === "luyao" && contestedPose && pressure > 0.15) {
      const meet = blend(base.point, standBeside(base.point, contestedPose.point), Math.min(.85, pressure));
      return { ...base, point: meet, facing: contestedPose.point.x < base.point.x ? -1 : 1 };
    }
    return base;
  };
  const canHelp = !hasFlag(game, "help:suman:" + game.day) && game.energy >= 6 && (hasFlag(game, "covered-suman") || game.relations.suman >= 60);
  const customerLine = (id: CustomerId) => {
    const c = CUSTOMERS[id];
    return (game.waitMeters[id] ?? c.patience) <= 2 ? "我真的要走了。" : id === "shen" ? "先说好，我不缺粉底。" : id === "mei" ? "我只有十分钟。" : c.opening;
  };
  // 一次只让一个人开口，话落在柜台外的空地上：气泡飘在人头上一律会压住旁边那个人的名字。
  const voiceId: Focus | null = contestedId && pressure > .4 ? "luyao" : available.includes(focus as CustomerId) ? focus : null;
  const speaking = voiceId && {
    id: voiceId,
    name: voiceId === "luyao" ? STAFF.luyao.name : CUSTOMERS[voiceId as CustomerId].name,
    line: voiceId === "luyao" ? "这位我也可以接。" : customerLine(voiceId as CustomerId),
  };
  // 立绘和名牌分成两层画：站在前面的人不会再挡住后面那个人的名字，名字也永远点得动。
  // 同一套状态要写在两层上，所以先算一次，别在两个 map 里各写一遍。
  const pawnCls = (id: Focus, pose: Pose, gone = false, done = false) => (focus === id ? "selected " : "") + (speaking?.id === id ? "is-speaking " : "") + (pose.moving ? "walking " : "") + (pose.facing < 0 ? "facing-left " : "") + (gone ? "departed " : done ? "served " : "");
  const actors: Array<{ id: Focus; name: string; art: string; note?: string; point: Point; at: ReturnType<typeof worldToPercent>; z: number; cls: string }> = [
    ...(Object.keys(STAFF) as StaffId[]).map(id => {
      const pose = staffPose(id);
      return { id, name: STAFF[id].name, art: asset("assets/chibi/" + STAFF[id].art + ".png"), point: pose.point, at: worldToPercent(pose.point), z: worldZ(pose.point), cls: "staff-pawn " + pawnCls(id, pose) };
    }),
    ...todayIds.map((id, index) => {
      const pose = customerPose(id, index), gone = game.lost.includes(id);
      return { id, name: CUSTOMERS[id].name, art: customerArt(id), note: customerStatus(id), point: pose.point, at: worldToPercent(pose.point), z: worldZ(pose.point) + 1, cls: "customer-pawn " + pawnCls(id, pose, gone, !gone && game.dayServed.includes(id)) };
    }),
  ];
  // 沙盘比可见带大（手机竖屏超出左右、横屏超出上下）时，选中谁就把镜头挪到她身上，否则点了名字却看不见人。
  // 只跟着"换了谁"和窗口变化走，不用实时位置当依赖，不然镜头会一直和自己的手指抢。
  const castRef = useRef(actors);
  castRef.current = actors;
  useEffect(() => {
    if (!pannable) return;
    const actor = castRef.current.find(entry => entry.id === focus);
    if (!actor) return;
    const limitX = Math.max(0, (worldWidth - sceneSize.width) / 2);
    const limitY = Math.max(0, (worldWidth / mapRatio - bandHeight) / 2);
    const clampTo = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
    setCamera({ x: clampTo((0.5 - actor.point.x / WORLD.width) * worldWidth, limitX), y: clampTo((0.5 - actor.point.y / WORLD.height) * (worldWidth / mapRatio), limitY) });
  }, [focus, pannable, worldWidth, mapRatio, sceneSize.width, bandHeight]);

  return <div className={"rescue-game screen-" + screen}>
    <header className="rescue-topbar" inert={modalOpen}>
      <div className="rescue-brand"><span className="brand-monogram">AU</span><div><b>最后一单 <span>绮光专柜</span></b><small>第 {game.day} / 5 天 · {story.title}</small></div></div>
      <nav className="experience-nav" aria-label="游戏菜单"><button onClick={showHandbook}>值班手册</button><a className="rush-mode-link" href="?mode=rush">闭店大作战 <small>90 秒挑战 · 独立计分</small></a></nav>
      <div className="shift-clock"><strong>{clock}</strong><span>{screen === "floor" ? speed === 0 ? "现场已暂停" : "营业中" : screen === "consultation" ? "接待按动作计时" : "待命"}</span></div>
      <div className="top-score"><span>还差 <b>{money(Math.max(0, TARGET - game.sales))}</b></span><small className={saveError ? "save-failed" : ""}>{saveError ? "保存失败，请勿关闭页面" : screen === "intro" ? "五日销售与人情账" : "已保存到本机"}</small></div>
    </header>
    <div className="rescue-workspace" inert={modalOpen}>
      <main ref={sceneRef} className={"rescue-scene" + (tightPlates ? " tight-plates" : "")} aria-label={screen === "consultation" && customer ? "接待" + customer.name : "专柜现场"}>
        {(screen === "floor" || screen === "intro" || screen === "brief") && <>
          <div className="map-viewport" style={controlInset ? { bottom: controlInset } : undefined} onPointerDown={e => {
            // 沙盘里的一切（立绘、名牌）都要能拖着走：只有覆盖层上的按钮（选客条、时间按钮）才不该带动镜头。
            if ((e.target as HTMLElement).closest("button") && !(e.target as HTMLElement).closest(".rescue-world")) return;
            panned.current = false;
            drag.current = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
          }} onPointerMove={moveCamera} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <div className="rescue-world" style={{ width: worldWidth, aspectRatio: mapRatio, transform: "translate(" + camera.x + "px," + camera.y + "px)" }}>
              <img className="floor-art" src={asset("assets/scenes/aurora-floor.jpg")} alt="绮光与维珞专柜" onLoad={e => setMapRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} draggable={false} />
              {actors.map(actor => <div key={actor.id} className={"rescue-pawn " + actor.cls} aria-hidden="true" onClick={() => pickActor(actor.id)} style={{ ...actor.at, zIndex: actor.z }}>
                <img src={actor.art} alt="" draggable={false} />
              </div>)}
              {actors.map(actor => <button key={actor.id} className={"pawn-name " + actor.cls} aria-label={"查看" + actor.name} onClick={() => pickActor(actor.id)} style={{ ...actor.at, zIndex: LABEL_Z + actor.z }}>{actor.name}{actor.note && <small>{actor.note}</small>}</button>)}
            </div>
          </div>
          {screen === "floor" && <><div className="floor-hud"><div className="floor-mission"><span className="eyebrow">DAY {game.day} / 你的选择</span><b>{story.subtitle}</b></div>{speaking && <p className="floor-voice"><b>{speaking.name}</b>“{speaking.line}”</p>}</div><nav className="floor-queue" aria-label="现场选客">{available.map(id => <button key={id} aria-label={"选择顾客" + CUSTOMERS[id].name} aria-pressed={focus === id} onClick={() => setFocus(id)}><b>{CUSTOMERS[id].name}</b><small>{session?.customerId === id ? "接待中" : waitLabel(id)}</small></button>)}</nav></>}
          {screen === "floor" && <div className="scene-controls" ref={controlsRef}><div className="time-controls" aria-label="现场时间">{([0, 1, 2, 4] as const).map(value => <button key={value} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value === 0 ? "暂停" : value + "×"}</button>)}</div><button onClick={() => setCamera({ x: 0, y: 0 })}>复位视角</button><span>选人了解情况，再开始接待</span></div>}
          {(screen === "intro" || screen === "brief") && <section className={"shift-intro editorial-intro " + (screen === "intro" ? "opening-cover" : "chapter-cover")}>
            <div className="intro-copy"><span className="eyebrow">{screen === "intro" ? "A COUNTER FULL OF SECRETS / 职场叙事游戏" : "CHAPTER 0" + game.day + " / 新品活动周"}</span>
              <h1>{screen === "intro" ? <>最后<span>一单</span><em>LAST ORDER</em></> : story.title}</h1>
              <h2>{screen === "intro" ? "卖的是美妆，算的是人情。" : story.subtitle}</h2>
              <p>{screen === "intro" ? "你叫许愿，试用期还剩五天。柜长要业绩，前辈要人情，对面的销冠要你的客人。两万一的目标之外，你还想保住一点自己。" : story.brief}</p>
              <blockquote className="chapter-quote"><b>{chapter.speaker}</b>“{chapter.line}”</blockquote>
              {screen === "brief" && notices.map((note, index) => <blockquote className="dawn-note" key={index}><b>{note.speaker}</b>{note.body}</blockquote>)}
              <div className="intro-actions"><button className="gold-button" onClick={screen === "intro" ? begin : openFloor}>{screen === "intro" ? "开始新品活动周" : "开始营业"}<span aria-hidden="true"> ↗</span></button><span>{screen === "intro" ? "五天 · 多种结局 · 本机存档" : "阅读不计时，开始营业后计时"}</span></div>
              <ChapterTrack day={game.day} />
            </div>
            <div className="intro-art" aria-hidden="true"><div className="intro-art-frame"><img src={asset("assets/aurora/xuyuan.png")} alt="" /><span className="intro-art-label">许愿 <small>BEAUTY ADVISOR / 试用期</small></span></div><span className="intro-art-stamp">05 DAYS<br />¥21,000</span></div>
            <div className="intro-bottom"><span>{screen === "intro" ? "一笔成交，是故事的开始，不是结束。" : chapter.question}</span><b>{screen === "intro" ? "绮光百货 · 晚班 19:00" : "晨会要看到 " + money(progressNeed)}</b></div>
          </section>}
        </>}
        {screen === "consultation" && customer && session && <div className="consult-scene">
          <div className="portrait-window"><div className="portrait-plate">
            <img src={portrait(customer.id)} alt={customer.name + "面部近景"} />
            {CUES.map(cue => <button key={cue} aria-label={"面部线索：" + customer.cues[cue].label} className={"portrait-cue cue-" + cue + (session.discovered.includes(cue) ? " found" : "")} onClick={() => setGame(value => observeService(value, cue))}><span>{session.discovered.includes(cue) ? "✓" : "+"}</span></button>)}
          </div><button className="back-floor" onClick={() => setScreen("floor")}>返回现场</button></div>
          <section className="customer-reading"><span className="eyebrow">{customer.descriptor}</span><h1>{customer.name}</h1><blockquote>{session.chat.at(-1)?.text ?? customer.opening}</blockquote>
            {lastCue && <p className="reading-finding"><b>{customer.cues[lastCue].label}</b>{customer.cues[lastCue].finding}</p>}
            <DemandBoard game={game} />
            <ConsultationNotes game={game} />
            <div className="outside-pressure"><b>柜台另一边 · 每次新动作都会消耗等待</b>{available.filter(id => id !== customer.id).map(id => <p key={id}>{CUSTOMERS[id].name} · {waitLabel(id)}</p>)}{available.length === 1 && <p>其他机会已经结束。这一位仍在等你的判断。</p>}</div>
          </section>
        </div>}
        {screen === "result" && outcome && <section className={"story-panel sale-panel " + (outcome.good ? "sale-good" : "sale-risky")}><span className="eyebrow">本次接待 · 收银记录</span><h1>{outcome.title}</h1><strong className="large-number">+ {money(outcome.amount)}</strong>{outcome.units > 0 && <p className="result-units">{outcome.units} 件 · 整单 {money(outcome.total)}{outcome.shared ? " · 与陆遥各半" : ""} · 占用现场 {outcome.minutes} 分钟</p>}<p>{outcome.body}</p><div className="result-metrics"><span>信任 <b>{relationText(game.trust)}</b></span><span>体力 <b>{game.energy} / 100</b></span><span>小样 <b>{game.samples} 份</b></span></div></section>}
        {screen === "event" && <section className="story-panel event-panel"><div className="event-speaker"><img src={event.speakerCustomer ? portrait(event.speakerCustomer, true) : asset("assets/aurora/" + (event.speakerStaff === "player" ? "xuyuan" : event.speakerStaff ?? "roman") + ".png")} alt="" /><span>柜台关灯以后<br /><b>{event.speaker}</b></span></div><span className="eyebrow">闭店 · {event.speaker}</span><h1>{event.title}</h1><p>{event.body}</p><span className="story-footnote">这次选择会进入账本，并改变之后几天的现场。</span></section>}
        {(screen === "summary" || screen === "finale") && <section className="story-panel ledger-panel">
          <span className="eyebrow">{screen === "finale" ? "新品活动周 · 最终结算" : "DAY " + game.day + " · 今日账本"}</span><h1>{screen === "finale" ? endingTitle(game) : "今天的单，明天的账"}</h1><strong className="large-number">{money(game.sales)} <small>/ {money(TARGET)}</small></strong>
          {screen === "summary" && eventResponse && <blockquote className="decision-response"><span className="eyebrow">你的选择，得到了回应</span><p>{eventResponse}</p></blockquote>}
          {screen === "finale" && <div className="ending-checks"><span>业绩 <b>{game.sales >= TARGET ? "达标" : "未达标"}</b></span><span>信任 <b>{game.trust >= 55 ? "留下了口碑" : "仍需重建"}</b></span><span>合规 <b>{complianceWord(game.compliance)}</b></span><span>柜位 <b>{counter.label}</b></span></div>}
          {screen === "finale" && <p className="counter-verdict">{counter.body}</p>}
          <div className="ledger-book" aria-label="因果账本">{historyByDay(game).filter(group => screen === "finale" || group.day === game.day).map(group => <section key={group.day}><h2>DAY {group.day} · {group.title}</h2>{group.items.filter(item => screen === "finale" || !item.text.startsWith("回应 · ")).map((item, index) => <p key={index}>{item.text}</p>)}</section>)}
            {game.orders.filter(order => screen === "finale" || order.day === game.day).map((order, index) => <p className="order-line" key={index}>D{order.day} · {CUSTOMERS[order.customerId].name} · {PRODUCTS[order.product].short} × {order.units} · {money(order.amount)}{order.shared ? "（拼单后入账）" : ""}{order.risky ? " · 售后风险已记录" : ""}</p>)}
          </div>
        </section>}
      </main>
      <aside className="rescue-rail">
        <section className="shift-overview"><span className="eyebrow">今天的柜台</span><p className="rail-sales">{money(game.daySales)} <small>今日净业绩</small></p><div className="target-track"><i style={{ width: Math.min(100, game.sales / TARGET * 100) + "%" }} /></div><p className="rail-detail">体力 {game.energy} · 小样 {game.samples} · 名单 {game.members.length}</p><p className={"rail-standing" + (game.standing < STANDING_RISK ? " at-risk" : "")}>{standingWord(game.standing)}</p><p className={"rail-compliance" + (game.compliance < COMPLIANCE_RISK ? " at-risk" : "")}>{complianceWord(game.compliance)}</p></section>
        <section className="customer-list"><span className="eyebrow">顾客</span>{todayIds.map(id => <button key={id} onClick={() => setFocus(id)} className={focus === id ? "is-selected" : ""}><img src={portrait(id, true)} alt="" /><span><b>{CUSTOMERS[id].name}</b><small>{customerStatus(id)}</small></span><span className={"status-dot " + (game.lost.includes(id) ? "lost" : game.dayServed.includes(id) ? "done" : "")} /></button>)}</section>
        <section className="floor-journal"><span className="eyebrow">刚刚发生</span>{game.history.slice(-5).reverse().map((entry, index) => <p key={index}><small>D{entry.day}</small>{entry.text}</p>)}{game.history.length === 0 && <p>陆遥正在留意入口。先接谁，由你决定。</p>}</section>
        <button className="restart-link" onClick={showRestart}>重新开始</button>
      </aside>
    </div>
    <footer ref={dockRef} className="rescue-dock" inert={modalOpen}>
      <section className="dock-person"><img src={screen === "consultation" && customer ? portrait(customer.id, true) : selectedCustomer ? portrait(selectedCustomer.id, true) : asset("assets/aurora/" + (selectedStaff?.art ?? "xuyuan") + ".png")} alt="" /><div><small>{screen === "consultation" && customer ? customer.descriptor : selectedCustomer?.descriptor ?? selectedStaff?.role}</small><h2>{screen === "consultation" && customer ? customer.name : selectedCustomer?.name ?? selectedStaff?.name}</h2><p>{screen === "consultation" && session ? session.discovered.length + " / 3 处线索 · 体力 " + game.energy : selectedCustomer ? customerStatus(selectedCustomer.id) : "选择与人情都会留下记录"}</p></div></section>
      <div className="dock-content">
        {screen === "floor" && selectedCustomer && <div className="floor-inspect"><div><span className="eyebrow">她正在说</span><p>{selectedCustomer.opening}</p></div>
          {available.includes(selectedCustomer.id) ? <div className="floor-actions">
            <button className="gold-button" disabled={(!session && game.energy < ENERGY_LOCK) || Boolean(session && session.customerId !== selectedCustomer.id)} onClick={() => beginCustomer(selectedCustomer.id)}>{session?.customerId === selectedCustomer.id ? "继续接待" + selectedCustomer.name : "接待" + selectedCustomer.name}</button>
            <button disabled={game.samples <= 0 || hasFlag(game, "sample:" + selectedCustomer.id)} onClick={() => setGame(value => leaveSample(value, selectedCustomer.id))}>留小样 · {game.samples}</button>
            <button disabled={!canAddMember(game, selectedCustomer.id)} onClick={() => setGame(value => addMember(value, selectedCustomer.id))} aria-label={"加微信 " + selectedCustomer.name}>{game.members.includes(selectedCustomer.id) ? "已在名单" : "加微信 · 1 分钟"}</button>
            {canHelp && <button onClick={() => setGame(value => requestStaffHelp(value, selectedCustomer.id))}>请苏蔓帮忙留客</button>}
            {!game.members.includes(selectedCustomer.id) && !canAddMember(game, selectedCustomer.id) && !game.lost.includes(selectedCustomer.id) && <p>她还没接到过你的东西。先留一支小样，或者接完这一单，再要微信。</p>}
            {session && session.customerId !== selectedCustomer.id && <p>你还在接待{CUSTOMERS[session.customerId].name}。<button className="text-button" onClick={() => beginCustomer(session.customerId)}>回去接待</button><button className="text-button" onClick={() => setGame(releaseService)}>放下这笔单</button></p>}
            {!session && game.energy < ENERGY_LOCK && <p>体力不足以接新人。<button onClick={endFloor}>结束今日接待</button></p>}
          </div> : <p className="muted">这次机会已经结束。请选择另一位顾客。</p>}
        </div>}
        {screen === "floor" && selectedStaff && <div className="staff-inspect"><h3>{focus === "luyao" ? "她在争取你还没接住的人" : focus === "suman" ? "愿不愿意帮忙，要看之前的账" : focus === "tangke" ? "她也在为转正凑最后的数字" : focus === "roman" ? "业绩与赠品记录，她都在盯" : "看清现场，再决定把时间给谁"}</h3><p>{focus === "suman" ? "关系：" + relationText(game.relations.suman) + (canHelp ? "。她愿意替你多留客一会儿。" : "。帮忙需要之前的人情，这班最多一次。") : story.threat}</p><div className="floor-actions">{available.map(id => <button key={id} onClick={() => setFocus(id)}>看看{CUSTOMERS[id].name}</button>)}</div></div>}
        {screen === "consultation" && customer && session && <section className="service-actions">
          <div className="action-cost"><span>阅读暂停 · 新观察 / 提问 / 试用各花 1 分钟</span><span>{available.filter(id => id !== customer.id).map(id => CUSTOMERS[id].name + "还等 " + Math.ceil(game.waitMeters[id] ?? CUSTOMERS[id].patience) + " 分钟").join(" · ") || "专心接住眼前这一位"}</span></div>
          <ol className="service-steps">{["观察", "提问", "试用", "成交"].map((step, index) => <li key={step} className={index === stage ? "current" : index < stage ? "done" : ""}>{index + 1} · {step}</li>)}</ol>
          {stage === 0 && <><h3>先看清两处线索</h3><div className="cue-actions">{CUES.map(cue => <button key={cue} aria-pressed={session.discovered.includes(cue)} onClick={() => setGame(value => observeService(value, cue))}>观察{customer.cues[cue].label}{session.discovered.includes(cue) && <span aria-hidden="true"> ✓</span>}</button>)}</div><p className="service-feedback">{lastCue ? customer.cues[lastCue].finding : "点脸部线索，或用上面的按钮观察。另一位客人仍在等你。"}</p></>}
          {stage === 1 && <><h3>问清她真正介意的事</h3><div className="question-choices">{questionChoices(customer.id).map(q => <button key={q.label} onClick={() => ask(q.label, q.index)}>{q.label}</button>)}</div><form className="question-composer" onSubmit={e => { e.preventDefault(); ask(draft); }}><input aria-label="对顾客说" value={draft} onChange={e => setDraft(e.target.value)} maxLength={280} placeholder="用自己的话问 · 本地剧本回复" /><button type="submit" disabled={!draft.trim()}>开口问</button></form>{askingAgain && <button className="text-button" onClick={() => setAskingAgain(false)}>不追问了，继续选品</button>}</>}
          {showProducts && <><p className="product-guidance">根据线索选，不按价格猜。试用花 1 分钟，她肯让你上脸的话还能再要 {FACE_TRIAL_MINUTES} 分钟{revising ? "；换款另花 5 体力" : ""}。</p><div className="product-choices">{(Object.keys(PRODUCTS) as ProductId[]).map(id => <button key={id} aria-label={PRODUCTS[id].short + " " + money(PRODUCTS[id].price)} aria-pressed={session.selectedProduct === id} onClick={() => { setGame(value => selectServiceProduct(value, id)); setRevising(false); }}><i className={"rescue-product-art product-" + id} /><span><b>{PRODUCTS[id].short}</b><small>{money(PRODUCTS[id].price)} / 件</small><em>{PRODUCTS[id].note}</em></span></button>)}</div><div className="trial-actions"><button className="gold-button trial-button" disabled={!session.selectedProduct || session.tested} onClick={() => setGame(trialService)}>为{customer.name}试用</button>{!session.tested && <button className="text-button" onClick={() => setAskingAgain(true)}>再问一句 · 1 分钟</button>}</div></>}
          {pendingRival && rival && <div className="rival-decision" aria-label="竞品打断"><div><img src={asset("assets/aurora/luyao.png")} alt="陆遥" /><p><b>{rival.headline}</b><span>“{rival.quote}”</span></p></div><div className="rival-choices">
            <button aria-label="先登记接待" onClick={() => setGame(value => respondToRival(value, "record"))}><b>先登记接待</b><small>留证据 · 体力 −3</small></button><button aria-label="让顾客确认需求" onClick={() => setGame(value => respondToRival(value, "clarify"))}><b>让顾客确认需求</b><small>守住信任 · 体力 −7</small></button><button aria-label="让她演示" onClick={() => setGame(value => respondToRival(value, "yield"))}><b>让她演示</b><small>共同成交 · 业绩各半</small></button>
          </div></div>}
          {session.tested && !pendingRival && !revising && picked && <div className="close-review"><div>
            <p className={"trial-reaction " + (session.reaction ?? "negative")}>{REACTIONS[picked][session.reaction ?? "negative"]}</p>
            {!session.faceTrialled && <button type="button" className="face-trial-button" onClick={() => setGame(faceTrialService)}>半脸上妆 · 多占 {FACE_TRIAL_MINUTES} 分钟</button>}
            {session.faceTrialRevealed && <p className="face-trial-said">妆面压在她脸上，她才承认：{TRAIT_LABELS[session.faceTrialRevealed]}</p>}
            {session.faceTrialled && !session.faceTrialRevealed && <p className="face-trial-said">这半张脸没有新东西：该说的刚才都说了。</p>}
            {session.reaction === "positive" && <div className="bundle-choices" role="group" aria-label="连带件数">
              <span className="eyebrow">她愿意带走几件 <small>预算 {customer.budget.toLocaleString("zh-CN")} · 上限 {customer.maxUnits} 件</small></span>
              {(Object.keys(BUNDLES) as BundleId[]).map(id => {
                const units = unitsWanted(customer, picked, id, session.reaction ?? "negative");
                return <button key={id} aria-pressed={session.bundle === id} disabled={!units} onClick={() => setGame(value => chooseBundle(value, id))}><b>{BUNDLES[id].label}</b><small>{units ? <><span className="bundle-price">{money(units * PRODUCTS[picked].price)}</span><span className="bundle-minutes">占 {BUNDLES[id].units} 分钟</span></> : "她不会多拿"}</small></button>;
              })}
            </div>}
            <div className="closing-buttons">
            {session.reaction === "negative" ? <><button onClick={() => setRevising(true)}>换一款</button><button disabled={game.samples <= 0 || hasFlag(game, "sample:" + customer.id)} onClick={() => setGame(value => leaveSample(value, customer.id))}>留小样 · {game.samples}</button><button onClick={() => close(false)}>接受拒绝</button><button className="risk-button" onClick={() => close(true)}>强推成交</button></> : <><button disabled={session.claimed} onClick={() => setGame(value => ({ ...value, activeSession: value.activeSession ? { ...value.activeSession, claimed: true } : null }))}>{session.claimed ? "已登记归属" : "登记我的接待"}</button><button className="gold-button" onClick={() => close()}>提出成交</button>{session.reaction === "mixed" && <button onClick={() => setRevising(true)}>换一款再试</button>}</>}
          </div></div><Quote game={game} id={customer.id} product={picked} /></div>}
        </section>}
        {screen === "result" && outcome && <div className="result-next"><p>{available.length ? "还有 " + available.length + " 位顾客。刚才这单占掉她们 " + outcome.minutes + " 分钟的等待。" : "今天的接待结束了，柜台还有一件事要处理。"}</p><button className="gold-button" onClick={() => { setScreen(available.length ? "floor" : "event"); setFocus(available[0] ?? "suman"); }}>{available.length ? "回到现场" : "处理闭店事件"}</button></div>}
        {screen === "event" && <div className="event-options">{visibleChoices(game, event).map(choice => <button key={choice.id} onClick={() => { setGame(value => settleDayEvent(value, choice.id)); setScreen("summary"); }}><b>{choice.label}</b><span>{choice.detail}</span></button>)}</div>}
        {screen === "summary" && <div className="result-next"><p>今天的选择已经保存。下一天会带着这些结果开始。</p><button className="gold-button" onClick={nextDay}>{game.day === 5 ? "查看活动周结局" : "进入下一天"}</button></div>}
        {screen === "finale" && <div className="result-next"><p>信任 {relationText(game.trust)} · 苏蔓 {relationText(game.relations.suman)}</p><button className="gold-button" onClick={showRestart}>重新开始 · 换一种活法</button></div>}
        {(screen === "intro" || screen === "brief") && <div className="welcome-note"><h3>看现场 → 选顾客 → 判断与试用 → 守住订单</h3><p>每一笔销售，都决定谁欠你、谁恨你、谁会回来。</p></div>}
      </div>
    </footer>
    {handbook && <GameDialog title="值班手册" returnFocus={dialogOrigin.current} onClose={() => setHandbook(false)}><ShiftHandbook game={game} onRestart={() => { setHandbook(false); setConfirmRestart(true); }} /></GameDialog>}
    {confirmRestart && <GameDialog title="重新开始" returnFocus={dialogOrigin.current} onClose={() => setConfirmRestart(false)}><div className="handbook-body"><h3>重新开始这五天？</h3><p>本机当前进度会被新的一局替换，挑战最佳纪录不受影响。</p><div className="floor-actions"><button onClick={() => setConfirmRestart(false)}>继续当前进度</button><button className="gold-button" onClick={begin}>开始新一局</button></div></div></GameDialog>}
  </div>;
}

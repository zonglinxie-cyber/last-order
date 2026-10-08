// 人情场楼层界面（?mode=world）：一天四个时段的循环、可左右拖的横版大地图、
// 点人开抽屉做事、说书人的卡。规则全部问 engine.ts —— 这里只摆人、摆按钮、
// 念 engine 写进 log 的句子；世界状态走 serializeWorld/parseWorld 落盘。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { MobileScroll } from "../../mobile";
import { demandBudgetWord, PRODUCTS, TRAIT_LABELS, type Customer, type ProductId } from "../../campaign.ts";
import { asset } from "../../base.ts";
import { sfx, sfxMute, sfxMuted } from "../../sfx.ts";
import {
  advanceSlot, ambient, applyChoice, availableVerbs, beginSlot, choiceVisible, doVerb,
  drawStorylet, endDay, newWorld, nextSeason, parseWorld, resolveServe, seasonSummary, substitute,
  verbOptions, ENERGY_PER_DAY, SAVE_KEY, VERB_ENERGY, WORLD_SAVE_VERSION,
  type DrawnStorylet, type VerbCall,
} from "../engine.ts";
import { quarrelPairs } from "../exchanges.ts";
import { askedToday, dueToday, resolveRequestChoice } from "../requests.ts";
import type { Festival, Person, PersonId, Slot, Verb, World, Zone } from "../types.ts";
import { PEOPLE, STORYLETS, festivalsFor } from "../content/index.ts";
import { ta } from "../pronoun.ts";
import { ZONE_LABEL, ZONE_SPOTS, ZONE_STAFF_SPOTS, type Spot } from "./zones.ts";
import { PersonCard } from "./PersonCard.tsx";
import { RequestsCard, RequestsPanel } from "./Requests.tsx";
import { Passersby } from "./Passersby.tsx";
import { WebView } from "./WebView.tsx";
import { WorldArchive } from "./WorldArchive.tsx";
import {
  COACH_KEY, coachAlive, coachAnchorSelector, coachPoached, coachTip, coachUrgency,
  markCoachSeen, parseCoachSeen, serializeCoachSeen, skipCoachSeen,
  type CoachStep, type CoachTip, type CoachView,
} from "./coach.ts";
import { SLOT_WORD } from "./words.ts";
import { seasonEnding } from "../ending.ts";
import { commitWorldProgress } from "../progress.ts";
import "./world.css";

const SEASON_DAYS = 28; // 与 content/festivals.ts 的一季同长
const PRODUCT_IDS: ProductId[] = ["soft", "glow", "repair"];
// public/assets/game/chibi/ 里按 id 对得上的小人图；对不上的用「头像圆牌 + 通用身体」。
const CHIBI = new Set(["anjie", "duan", "fangmin", "luyao", "mei", "roman", "shen", "suman", "tangke", "xiaoyu", "zhao", "zhou"]);
const TWO_TARGET: Verb[] = ["introduce", "mediate", "handoff", "tell"];
// 代词按人物性别念（pronoun.ts 的 ta），不写死"她"。
const verbWord = (verb: Verb, person: Person): string => ({
  greet: "招呼", serve: "接待", sample: "送小样", introduce: "介绍认识", mediate: "打圆场",
  handoff: `托${ta(person)}照看`, help: "帮一把", wechat: "加微信", keep: `替${ta(person)}保密`, tell: "说件私事",
} satisfies Record<Verb, string>)[verb];
const pickHint = (verb: Verb, a: Person) => {
  if (verb === "introduce") return `再点一个人，介绍给${a.name}认识`;
  if (verb === "mediate") return `再点一个人，替${a.name}和对方打圆场`;
  if (verb === "handoff") return a.role === "staff" ? `点一位客人，交给${a.name}照看` : `点一位同事，把${a.name}交过去`;
  return `把谁的私事说给${a.name}听`;
};

// —— 存档：serializeWorld/parseWorld 的信封里多塞一格 ui（parseWorld 只认 version+world，多余字段不拦）——

type DayBase = { day: number; money: number; opinion: Record<PersonId, number> };
type DayReport = {
  day: number;
  moneyDelta: number;
  movers: Array<{ id: PersonId; delta: number; now: number }>;
  tomorrow: Array<{ name: string; slot: Slot }>;
  week: boolean;
};
type UiState = {
  screen?: "play" | "report" | "season";
  pending?: { id: string; binding: Record<string, PersonId> };
  report?: DayReport;
  dayBase?: DayBase;
  /** 哪天看过「今天的请求」卡：同一天刷新不重弹 */
  reqSeen?: number;
};

const restore = (): { world: World; ui: UiState } | null => {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    const world = parseWorld(raw);
    if (!raw || !world) return null;
    const env = JSON.parse(raw) as { ui?: UiState };
    return { world, ui: env.ui ?? {} };
  } catch { return null; }
};

// —— 每个时段开头：落位 → 说书人抽一张。在场的人自己互动（传话、陆遥抢客）放在时段末，
//     先让玩家动手：你这个时段没顾上的人，陆遥才带得走。
const runPipeline = (w: World): { world: World; drawn: DrawnStorylet | null } => {
  const next = beginSlot(w, PEOPLE, festivalsFor(w.season));
  const r = drawStorylet(next, PEOPLE, STORYLETS);
  return { world: r.world, drawn: r.drawn };
};

const nameOf = (id: PersonId) => PEOPLE.find(p => p.id === id)?.name ?? id;
const festivalName = (festivals: Festival[], id?: string) => festivals.find(f => f.id === id)?.name;
const shorten = (text: string) => (text.length > 30 ? `${text.slice(0, 29)}…` : text);
const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;

/** 站在哪一区的人各就各位：同事/对手/商场方站前段，顾客站后段，同区按 id 排稳定序。 */
function layOut(world: World): Map<PersonId, Spot> {
  const out = new Map<PersonId, Spot>();
  const byZone = new Map<Zone, { staff: PersonId[]; guests: PersonId[] }>();
  for (const [id, zone] of Object.entries(world.present)) {
    const bag = byZone.get(zone) ?? { staff: [], guests: [] };
    const person = PEOPLE.find(p => p.id === id);
    (person?.role === "customer" ? bag.guests : bag.staff).push(id);
    byZone.set(zone, bag);
  }
  for (const [zone, bag] of byZone) {
    // 柜台后只站得下四个人：多出来的同事站到收银台后面，不叠在同一个点上。
    const overflow = zone === "counter" ? ZONE_STAFF_SPOTS.cashier : ZONE_SPOTS[zone];
    bag.staff.sort().forEach((id, i) => {
      const list = ZONE_STAFF_SPOTS[zone];
      out.set(id, i < list.length ? list[i] : overflow[(i - list.length) % overflow.length]);
    });
    bag.guests.sort().forEach((id, i) => {
      const list = ZONE_SPOTS[zone];
      out.set(id, list[i % list.length]);
    });
  }
  return out;
}

function buildReport(before: World, after: World, base: DayBase): DayReport {
  const ids = new Set([...Object.keys(base.opinion), ...Object.keys(after.opinion)]);
  const movers = [...ids]
    .map(id => ({ id, delta: (after.opinion[id] ?? 0) - (base.opinion[id] ?? 0), now: after.opinion[id] ?? 0 }))
    .filter(m => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
  const tomorrow = after.appointments
    .filter(a => a.day === after.day)
    .map(a => ({ name: nameOf(a.person), slot: a.slot }));
  return { day: before.day, moneyDelta: after.money - base.money, movers, tomorrow, week: before.day % 7 === 0 };
}

// —— 音效：五个时刻。看法动到这个数才算"明显"，招呼那点 +3 不响 ——
const OPINION_CUE = 5;
const cueOutcome = (before: World, after: World) => {
  let up = 0, down = 0;
  const ids = new Set([...Object.keys(before.opinion), ...Object.keys(after.opinion)]);
  for (const id of ids) {
    const d = (after.opinion[id] ?? 0) - (before.opinion[id] ?? 0);
    if (d > up) up = d;
    if (d < down) down = d;
  }
  // 看法明显变坏最该被听见（硬推当场也入账，但先让她翻脸的声音出来），然后才轮到进账。
  if (down <= -OPINION_CUE) sfx("down");
  else if (after.money > before.money) sfx("register");
  else if (up >= OPINION_CUE) sfx("up");
};

// —— 苏蔓的新手引导：一句一个固定层气泡，指着它在说的那个东西 ——

type CoachPos = { left: number; top: number; arrowX: number; below: boolean };

function CoachLayer({ view, world }: { view: CoachView; world: World }) {
  const [seen, setSeen] = useState<CoachStep[]>(() => {
    try { return parseCoachSeen(window.localStorage.getItem(COACH_KEY)); } catch { return []; }
  });
  const [active, setActive] = useState<{ tip: CoachTip; stamp: string } | null>(null);
  const [pos, setPos] = useState<CoachPos | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const stamp = `${world.day}:${world.slot}`;
  const suggested = coachTip(view, world, PEOPLE, seen);
  const commit = (step: CoachStep) => setSeen(prev => {
    const next = markCoachSeen(prev, step);
    try { window.localStorage.setItem(COACH_KEY, serializeCoachSeen(next)); } catch { /* 存不进就算 */ }
    return next;
  });

  // 一句的生命周期：念出来那刻就算看过；更贴当下的新句插队（顶掉的不是"没看"，是看过）；
  // 它说的那个场面翻篇就收掉。「知道了」/「跳过引导」走下面按钮。
  useEffect(() => {
    if (!active) {
      if (suggested) { commit(suggested.step); setActive({ tip: suggested, stamp }); }
      return;
    }
    if (suggested && suggested.step !== active.tip.step && coachUrgency(suggested.step) < coachUrgency(active.tip.step))
      { commit(suggested.step); setActive({ tip: suggested, stamp }); }
    else if (active.stamp !== stamp || !coachAlive(active.tip, view)) setActive(null);
  });

  // 整个层卸载（换屏）时正在念的那句也按看过落盘 —— 出现过就算出现过。
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => () => {
    const a = activeRef.current;
    if (!a) return;
    try {
      const seen = markCoachSeen(parseCoachSeen(window.localStorage.getItem(COACH_KEY)), a.tip.step);
      window.localStorage.setItem(COACH_KEY, serializeCoachSeen(seen));
    } catch { /* 存不进就算 */ }
  }, []);

  // 气泡贴着锚点摆：元素没了就收掉这句。每一帧 + 定时都量一次 —— 人会走动、地图能拖。
  useLayoutEffect(() => {
    if (!active) { setPos(null); return; }
    const measure = () => {
      const layer = layerRef.current, bubble = bubbleRef.current;
      const el = layer?.parentElement?.querySelector(coachAnchorSelector(active.tip.anchor));
      if (!layer || !bubble || !el) { commit(active.tip.step); setActive(null); return; }
      const lr = layer.getBoundingClientRect(), ar = el.getBoundingClientRect(), br = bubble.getBoundingClientRect();
      const cx = ar.left - lr.left + ar.width / 2;
      const below = active.tip.side === "below";
      const left = Math.min(Math.max(cx - br.width / 2, 8), Math.max(8, lr.width - br.width - 8));
      const t = below ? ar.bottom - lr.top + 10 : ar.top - lr.top - 10 - br.height;
      const top = Math.min(Math.max(t, 8), Math.max(8, lr.height - br.height - 8));
      const arrowX = Math.min(Math.max(cx - left, 16), Math.max(16, br.width - 16));
      setPos(prev => prev && prev.left === left && prev.top === top && prev.arrowX === arrowX && prev.below === below
        ? prev : { left, top, arrowX, below });
    };
    measure();
    const timer = window.setInterval(measure, 300);
    return () => window.clearInterval(timer);
  });

  return <div className="world-coach-layer" ref={layerRef}>
    {active && <div className={`world-coach wc-${active.tip.side}`} ref={bubbleRef} role="dialog" aria-label="苏蔓的提示"
        style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }}>
      <i className="wc-arrow" style={pos ? { left: pos.arrowX } : undefined} aria-hidden="true" />
      <header className="wc-head">
        <img src={asset("/assets/game/staff-portraits/suman.png")} alt="" aria-hidden="true" /><b>苏蔓</b>
      </header>
      <p className="wc-text">{active.tip.text}</p>
      <div className="wc-actions">
        <button type="button" className="wc-ok" onClick={() => { commit(active.tip.step); setActive(null); }}>知道了</button>
        <button type="button" className="wc-skip" onClick={() => {
          const next = skipCoachSeen();
          try { window.localStorage.setItem(COACH_KEY, serializeCoachSeen(next)); } catch { /* 存不进就算 */ }
          setSeen(next); setActive(null);
        }}>跳过引导</button>
      </div>
    </div>}
  </div>;
}

export default function WorldGame() {
  const boot = useMemo(restore, []);
  const [world, setWorld] = useState<World>(() => boot?.world ?? newWorld("empty", PEOPLE));
  const [phase, setPhase] = useState<"intro" | "play" | "report" | "season">("intro");
  const [pending, setPending] = useState<DrawnStorylet | null>(null);
  const [report, setReport] = useState<DayReport | null>(boot?.ui.report ?? null);
  const [dayBase, setDayBase] = useState<DayBase | null>(boot?.ui.dayBase ?? null);
  const [selected, setSelected] = useState<PersonId | null>(null);
  const [pick, setPick] = useState<{ verb: Verb; calls: VerbCall[] } | null>(null);
  const [serving, setServing] = useState(false);
  const [serveProduct, setServeProduct] = useState<ProductId | null>(null);
  const [serveUnits, setServeUnits] = useState(1);
  const [webOpen, setWebOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [muted, setMuted] = useState(sfxMuted());
  const [reqSeenDay, setReqSeenDay] = useState(boot?.ui.reqSeen ?? 0);
  const [reqPanelOpen, setReqPanelOpen] = useState(false);

  const person = selected ? PEOPLE.find(p => p.id === selected) : undefined;
  const spots = useMemo(() => layOut(world), [world]);
  // 正在拌嘴的人头顶冒火气；点其中一个，打圆场就在动作排里。
  const quarreling = useMemo(() => new Set(quarrelPairs(world).flat()), [world]);
  const calls = useMemo(() => (selected ? verbOptions(world, PEOPLE).filter(c => c.targets.includes(selected)) : []),
    [world, selected]);
  const verbs = selected ? availableVerbs(world, PEOPLE, [selected]) : [];
  const pairVerbs = TWO_TARGET.filter(v => calls.some(c => c.verb === v));
  const pickTargets = useMemo(() => {
    if (!pick || !selected) return [] as PersonId[];
    return [...new Set(pick.calls.map(c => c.targets.find(t => t !== selected)!))];
  }, [pick, selected]);

  // 本时段新产生的 log：气泡冒在当事人头上，整条收进「刚刚发生」。
  const slotLogs = useMemo(() => world.log
    .map((entry, i) => ({ entry, i }))
    .filter(x => x.entry.day === world.day && x.entry.slot === world.slot && x.entry.who?.length), [world.log, world.day, world.slot]);
  const bubbles = slotLogs.slice(-5);
  const dayLogs = useMemo(() => world.log.filter(l => l.day === world.day), [world.log, world.day]);
  // 今天要结的委托：「现场」栏的小标记按这份数念「委托 n/m」。
  const dueReqs = useMemo(() => dueToday(world), [world]);

  // —— 落盘 ——
  const envelope = useMemo(() => JSON.stringify({
    version: WORLD_SAVE_VERSION, world,
    ui: {
      screen: phase === "intro" ? undefined : phase === "play" ? "play" : phase === "report" ? "report" : "season",
      pending: pending ? { id: pending.storylet.id, binding: pending.binding } : undefined,
      report: report ?? undefined,
      dayBase: dayBase ?? undefined,
      reqSeen: reqSeenDay || undefined,
    } satisfies UiState,
  }), [phase, world, pending, report, dayBase, reqSeenDay]);
  useEffect(() => {
    if (phase === "intro") return;
    try { window.localStorage.setItem(SAVE_KEY, envelope); } catch { /* 私密模式存不进就不存 */ }
    // 每次存档顺手并一次跨季档案；收季那一档才把结局 id 记进去。
    commitWorldProgress(world, phase === "season" ? seasonEnding(world, PEOPLE).id : undefined);
  }, [envelope, phase, world]);
  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => setResult(null), 3800);
    return () => window.clearTimeout(timer);
  }, [result]);
  // 人走了（被请去对面、故事卡里离开）就把抽屉收掉；够不着的留着卡给人看。
  useEffect(() => {
    if (selected && !(selected in world.present)) { setSelected(null); setServing(false); setPick(null); }
  }, [world.present, selected]);

  // —— 开局 / 继续 ——
  const startNew = () => {
    const fresh = newWorld(`world-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`, PEOPLE);
    const base: DayBase = { day: fresh.day, money: fresh.money, opinion: { ...fresh.opinion } };
    setDayBase(base);
    const { world: w, drawn } = runPipeline(fresh);
    setWorld(w); setPending(drawn); setReport(null);
    setSelected(null); setPick(null); setServing(false); setWebOpen(false); setResult(null);
    if (drawn) sfx("card");
    setPhase("play");
  };
  const continueGame = () => {
    const saved = restore();
    if (!saved) { startNew(); return; }
    const { world: w, ui } = saved;
    setDayBase(ui.dayBase ?? { day: w.day, money: w.money, opinion: { ...w.opinion } });
    setReqSeenDay(ui.reqSeen ?? 0);
    setWorld(w);
    setSelected(null); setPick(null); setServing(false); setWebOpen(false); setResult(null);
    if (ui.screen === "season") { setPhase("season"); return; }
    if (ui.screen === "report" && ui.report) { setReport(ui.report); setPhase("report"); return; }
    const card = ui.pending ? STORYLETS.find(s => s.id === ui.pending!.id) : undefined;
    setPending(card ? { storylet: card, binding: ui.pending!.binding } : null);
    setReport(null);
    setPhase("play");
  };

  // —— 时段推进 ——
  const nextTurn = () => {
    setSelected(null); setPick(null); setServing(false); setResult(null);
    const settled = ambient(world, PEOPLE); // 这个时段末：在场的人互相传话，陆遥带走你没顾上的人
    if (coachPoached(settled, PEOPLE) && !coachPoached(world, PEOPLE)) sfx("down");
    else cueOutcome(world, settled);
    sfx("bell");
    if (world.slot === 3) {
      const w = endDay(settled, PEOPLE);
      const rep = buildReport(world, w, dayBase ?? { day: world.day, money: 0, opinion: {} });
      setDayBase({ day: w.day, money: w.money, opinion: { ...w.opinion } });
      setWorld(w);
      setPending(null);
      if (w.day > SEASON_DAYS) { setReport(null); setPhase("season"); }
      else { setReport(rep); setPhase("report"); }
      return;
    }
    const { world: w, drawn } = runPipeline(advanceSlot(settled));
    setWorld(w); setPending(drawn);
    if (drawn) sfx("card");
  };
  const startNextDay = () => {
    const { world: w, drawn } = runPipeline(world);
    setWorld(w); setPending(drawn); setReport(null);
    if (drawn) sfx("card");
    setPhase("play");
  };
  // 季末「进入第 N+1 季」：人和关系网带过去，天数回到 1，从开季那个上午接着玩。
  const startNextSeason = () => {
    const next = nextSeason(world, PEOPLE);
    setDayBase({ day: next.day, money: next.money, opinion: { ...next.opinion } });
    const { world: w, drawn } = runPipeline(next);
    setWorld(w); setPending(drawn); setReport(null);
    if (drawn) sfx("card");
    setSelected(null); setPick(null); setServing(false); setWebOpen(false); setResult(null);
    setPhase("play");
  };

  // —— 楼层上的动作 ——
  const apply = (call: VerbCall) => {
    const next = doVerb(world, PEOPLE, call.verb, call.targets);
    if (next === world) return;
    cueOutcome(world, next);
    setWorld(next); setPick(null);
    setResult(next.log.at(-1)?.text ?? null);
  };
  const tapPerson = (id: PersonId) => {
    sfx("tap");
    if (pick) {
      const call = pick.calls.find(c => c.targets.includes(id));
      if (call) { apply(call); return; }
      setPick(null); // 点的不是目标：退出选人，照常开她的卡
    }
    setSelected(id); setServing(false); setServeProduct(null); setServeUnits(1);
  };
  const doServe = (force: boolean) => {
    if (!selected || !serveProduct) return;
    const next = resolveServe(world, PEOPLE, selected, serveProduct, serveUnits, force);
    if (next === world) return;
    cueOutcome(world, next);
    setWorld(next); setServing(false);
    setResult(next.log.at(-1)?.text ?? null);
  };
  const chooseStory = (index: number) => {
    if (!pending) return;
    const next = applyChoice(world, PEOPLE, pending, index);
    if (next === world) return;
    cueOutcome(world, next);
    setWorld(next); setPending(null);
  };
  // 委托卡上当场能答的（唐可借小样）：应下/回绝都算一句话的事。
  const answerRequest = (reqId: string, accept: boolean) => {
    const next = resolveRequestChoice(world, PEOPLE, reqId, accept);
    if (next === world) return;
    cueOutcome(world, next);
    setWorld(next);
  };

  // —— 大地图横拖 ——
  const viewRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ view: 0, map: 0 });
  const [panX, setPanX] = useState(0);
  const centered = useRef(false);
  const drag = useRef({ id: -1, startX: 0, startPan: 0, moved: false });
  const clampPan = (x: number, b = bounds) => Math.min(0, Math.max(Math.min(0, b.view - b.map), x));
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const sync = () => {
      const map = mapRef.current;
      const b = { view: el.clientWidth, map: map?.offsetWidth ?? 0 };
      setBounds(b);
      if (!centered.current && b.view && b.map) {
        centered.current = true;
        setPanX(clampPan(b.view * 0.5 - b.map * 0.3, b));
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onPanDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { id: event.pointerId, startX: event.clientX, startPan: panX, moved: false };
  };
  const onPanMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d.id !== event.pointerId) return;
    const dx = event.clientX - d.startX;
    if (Math.abs(dx) > 6) d.moved = true;
    if (!d.moved) return;
    // 超过阈值才算拖动，这时再捕获指针；在 down 就捕获会把小人按钮的 click 劫走。
    try { event.currentTarget.setPointerCapture(d.id); } catch { /* 指针已抬起 */ }
    setPanX(clampPan(d.startPan + dx));
  };
  const onPanUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current.id === event.pointerId) drag.current.id = -1;
  };

  // —— 屏 ——
  if (phase === "intro") {
    return <div className="app-screen world-app world-intro-screen">
      <img className="world-intro-bg" src={asset("/assets/game/mall-floor.jpg")} alt="" aria-hidden="true" />
      <div className="world-intro-shade" />
      <section className="world-intro-card">
        <p className="world-intro-eyebrow">AURORA · 绮光</p>
        <h1>人情场</h1>
        <p className="world-intro-copy">商场一层是一整张人情网。你在柜上怎么待一个人，会顺着这张网传出去。没有关卡，一季 28 天，看看最后谁还会回来。</p>
        <button className="world-primary" type="button" onClick={boot ? continueGame : startNew}>
          {boot ? `继续 · 第 ${boot.world.season} 季 · 第 ${boot.world.day} 天 ${SLOT_WORD[boot.world.slot]}` : "开这一季"}
        </button>
        {boot && <button className="world-ghost" type="button" onClick={startNew}>重新开一季</button>}
        <button className="world-archive-entry" type="button" onClick={() => setArchiveOpen(true)}>档案</button>
      </section>
      {archiveOpen && <WorldArchive onBack={() => setArchiveOpen(false)} />}
    </div>;
  }

  if (phase === "season") {
    const s = seasonSummary(world, PEOPLE);
    const arcRows = Object.entries(s.arcs).filter(([, arc]) => Object.keys(arc).length);
    return <div className="app-screen world-app world-report-page">
      <MobileScroll className="world-report-scroll"><main className="world-report">
        <p className="report-eyebrow">第 {world.season} 季 · {SEASON_DAYS} 天散场</p>
        <h1>这一季散场了</h1>
        <div className="report-numbers">
          <span><small>这一季进账</small><b>{yuan(s.money)}</b></span>
          <span><small>柜位</small><b>{s.standing}</b></span>
          <span><small>台账</small><b>{s.compliance}</b></span>
        </div>
        <section className="report-block">
          <h2>谁是你的人</h2>
          {s.allies.length ? <p>{s.allies.map(nameOf).join("、")}</p> : <p>没有一个人把你当自己人。</p>}
        </section>
        <section className="report-block">
          <h2>谁记了你的仇</h2>
          {s.enemies.length ? <p>{s.enemies.map(nameOf).join("、")}</p> : <p>没人跟你结仇。</p>}
        </section>
        <section className="report-block">
          <h2>几条线走到哪里了</h2>
          {arcRows.length ? arcRows.map(([id, arc]) => <p key={id}><b>{nameOf(id)}</b>：{Object.entries(arc).map(([k, v]) => `${k} · ${v}`).join("，")}</p>) : <p>谁的线都没走起来。</p>}
        </section>
      </main></MobileScroll>
      <div className="report-foot">
        <button className="world-archive-entry" type="button" onClick={() => setArchiveOpen(true)}>档案</button>
        <button className="world-primary" type="button" onClick={startNextSeason}>进入第 {world.season + 1} 季</button>
        <button className="world-ghost" type="button" onClick={startNew}>重开一季</button>
      </div>
      {archiveOpen && <WorldArchive onBack={() => setArchiveOpen(false)} />}
    </div>;
  }

  if (phase === "report" && report) {
    const allies = PEOPLE.filter(p => (world.opinion[p.id] ?? 0) >= 40);
    const enemies = PEOPLE.filter(p => (world.opinion[p.id] ?? 0) <= -30);
    return <div className="app-screen world-app world-report-page">
      <MobileScroll className="world-report-scroll"><main className="world-report">
        <p className="report-eyebrow">第 {report.day} 天 · {report.week ? "一周盘点" : "今日收工"}</p>
        <h1>{report.week ? "这一周过去了" : "今天打烊了"}</h1>
        <div className="report-numbers">
          <span><small>今天进账</small><b>{report.moneyDelta === 0 ? "没开单" : `${report.moneyDelta > 0 ? "+" : "−"}${yuan(Math.abs(report.moneyDelta))}`}</b></span>
          <span><small>累计</small><b>{yuan(world.money)}</b></span>
          <span><small>柜位 / 台账</small><b>{world.standing} / {world.compliance}</b></span>
        </div>
        <section className="report-block">
          <h2>谁对你的看法变了</h2>
          {report.movers.length
            ? report.movers.map(m => <p key={m.id}><b>{nameOf(m.id)}</b>{m.delta > 0 ? "对你更近了" : "对你更远了"}</p>)
            : <p>今天没人改主意。</p>}
        </section>
        <section className="report-block">
          <h2>明天约好了的</h2>
          {report.tomorrow.length
            ? <p>{report.tomorrow.map(t => `${t.name}（${SLOT_WORD[t.slot]}）`).join("、")}说来</p>
            : <p>明天没人约好。谁肯替你约人，得看今晚这张网。</p>}
        </section>
        {report.week && <section className="report-block">
          <h2>这一周的网</h2>
          <p>{allies.length ? `把你当自己人的：${allies.map(p => p.name).join("、")}` : "还没有人把你当自己人"}{enemies.length ? `；记仇的：${enemies.map(p => p.name).join("、")}` : ""}</p>
        </section>}
      </main></MobileScroll>
      <div className="report-foot"><button className="world-primary" type="button" onClick={startNextDay}>进入第 {world.day} 天</button></div>
      <CoachLayer world={world} view={{ screen: "report", reportDay: report.day, storyOpen: false, webOpen: false, cardOpen: false, acted: false }} />
    </div>;
  }

  const storyChoices = pending
    ? pending.storylet.choices.map((c, i) => ({ c, i })).filter(x => choiceVisible(world, PEOPLE, pending, x.c))
    : [];

  // 开门那张「今天的请求」卡：第一个时段、没别的层压着、今天还没看过才弹。
  const reqCardOpen = world.slot === 0 && !pending && !selected && !webOpen && !reqPanelOpen
    && reqSeenDay !== world.day && askedToday(world).length > 0;

  return <div className="app-screen world-app">
    <header className="world-bar">
      <div className="world-bar-info">
        <b>第 {world.season} 季 · 第 {world.day} 天 · {SLOT_WORD[world.slot]}{world.festival ? ` · ${festivalName(festivalsFor(world.season), world.festival)}` : ""}</b>
        <span>{yuan(world.money)}</span><span>精力 {Math.round(world.energy)}</span><span>小样 {world.samples}</span>
      </div>
      <button className="world-mute" type="button" aria-label={muted ? "开声音" : "静音"} aria-pressed={muted}
        onClick={() => { const next = !muted; sfxMute(next); setMuted(next); }}>{muted ? "🔇" : "🔊"}</button>
      <button className="world-web-btn" type="button" aria-label="人情网" onClick={() => setWebOpen(true)}>人情网</button>
      <button className="world-next" type="button" onClick={nextTurn}>下一时段{world.slot === 3 ? <small>收工</small> : null}</button>
    </header>

    <div className="world-map-view" ref={viewRef}
      onPointerDown={onPanDown} onPointerMove={onPanMove} onPointerUp={onPanUp} onPointerCancel={onPanUp}
      onClickCapture={e => { if (drag.current.moved) { e.stopPropagation(); e.preventDefault(); drag.current.moved = false; } }}>
      <div className="world-map" ref={mapRef} style={{ transform: `translateX(${panX}px)` }}>
        <img className="wf-floor" src={asset("/assets/game/mall-floor.jpg")} alt="商场一层" draggable={false} />
        <Passersby slot={world.slot} festival={!!world.festival} />
        {Object.entries(ZONE_LABEL).map(([zone, label]) =>
          <span key={zone} className="wf-zone" aria-hidden="true" style={{ left: `${label.x}%`, top: `${label.y}%` }}>{label.word}</span>)}
        {Object.keys(world.present).map((id, index) => {
          const p = PEOPLE.find(x => x.id === id);
          if (!p) return null;
          const spot = spots.get(id);
          if (!spot) return null;
          const isTarget = pickTargets.includes(id);
          return <button type="button" key={id} data-pid={id}
            className={`wf-actor${selected === id ? " is-sel" : ""}${isTarget ? " is-target" : ""}`}
            style={{ left: `${spot.x}%`, top: `${spot.y}%`, zIndex: 20 + Math.round(spot.y) } as CSSProperties}
            aria-label={`${pick ? "选" : "查看"}${p.name}`}
            onClick={() => tapPerson(id)}>
            {quarreling.has(id) && <i className="wf-heat" aria-hidden="true" />}
            <span className="wf-tag">{p.name}</span>
            <span className="wf-figure" style={{ animationDelay: `${(index % 7) * 0.37}s` }}>
              {CHIBI.has(id)
                ? <img className="wf-chibi" src={asset(`/assets/game/chibi/${id}.png`)} alt="" aria-hidden="true" draggable={false} />
                : <span className="wf-token">{p.portrait ? <img src={p.portrait} alt="" aria-hidden="true" /> : <b aria-hidden="true">{p.name.slice(0, 1)}</b>}</span>}
            </span>
            <i className="wf-glow" aria-hidden="true" />
          </button>;
        })}
        {bubbles.map((x, bi) => {
          const anchor = x.entry.who!.map(id => spots.get(id)).find((s): s is Spot => !!s);
          if (!anchor) return null;
          return <span key={`${x.entry.day}-${x.entry.slot}-${x.i}`} className="wf-bubble"
            style={{ left: `${anchor.x}%`, top: `${anchor.y}%`, animationDelay: `${bi * 0.7}s` }}>{shorten(x.entry.text)}</span>;
        })}
      </div>
    </div>

    <section className="world-scene" aria-label="现场">
      <h2>现场 · {Object.keys(world.present).filter(id => PEOPLE.find(p => p.id === id)?.role === "customer").length} 位客人
        {dueReqs.length > 0 && <button type="button" className="req-chip" aria-label="查看委托进度"
          onClick={() => setReqPanelOpen(true)}>委托 {dueReqs.filter(r => r.state === "done").length}/{dueReqs.length}</button>}
      </h2>
      <MobileScroll className="world-feed">
        {dayLogs.length === 0 && <p className="feed-empty">这个时段还没什么动静。点地图上的人，看看是谁、对你什么看法。</p>}
        {[...dayLogs].reverse().slice(0, 14).map((l, i) => <p key={`${l.day}-${l.slot}-${dayLogs.length - i}`}><small>{SLOT_WORD[l.slot]}</small>{l.text}</p>)}
      </MobileScroll>
    </section>

    {/* 抽屉盖住了「现场」栏，动作的结果才在这里说一遍；抽屉收起时就只在现场栏里念。 */}
    {result && person && <p className="world-toast" role="status">{result}</p>}

    {person && <div className="world-drawer">
      <PersonCard person={person} world={world} people={PEOPLE} onClose={() => { setSelected(null); setServing(false); setPick(null); }} />
      {pick ? <div className="world-pick">
        <p>{pickHint(pick.verb, person)}</p>
        <div className="pick-targets">
          {pickTargets.map(id => <button key={id} type="button" onClick={() => tapPerson(id)}>{nameOf(id)}{id in world.present ? "" : " · 不在场"}</button>)}
          <button type="button" className="pick-cancel" onClick={() => setPick(null)}>算了</button>
        </div>
      </div> : serving && person.skin ? <div className="world-serve">
        <p className="serve-said">{ta(person)}说过：{person.skin.demands.map(d => TRAIT_LABELS[d.trait]).join(" · ")}</p>
        <p className="serve-meta">{demandBudgetWord(person.skin as Customer)} · 「{person.voice.greet}」</p>
        <div className="serve-products">{PRODUCT_IDS.map(pid => <button key={pid} type="button" className={serveProduct === pid ? "on" : ""} onClick={() => setServeProduct(pid)}><i className={`product-art product-art-${pid}`} /><b>{PRODUCTS[pid].short}</b><small>{yuan(PRODUCTS[pid].price)}</small></button>)}</div>
        <div className="serve-units">{Array.from({ length: Math.min(4, person.skin.maxUnits) }, (_, i) => i + 1).map(u => <button key={u} type="button" className={serveUnits === u ? "on" : ""} onClick={() => setServeUnits(u)}>{u} 件</button>)}</div>
        <div className="serve-actions">
          <button className="serve-commit" type="button" disabled={!serveProduct} onClick={() => doServe(false)}>开给{ta(person)}</button>
          <button className="serve-force" type="button" disabled={!serveProduct} onClick={() => doServe(true)}>硬推</button>
        </div>
      </div> : <div className="world-verbs">
        {verbs.map(v => <button key={v} type="button" onClick={() => v === "serve" ? (setServing(true), setServeProduct(null), setServeUnits(1)) : apply({ verb: v, targets: [person.id] })}><b>{verbWord(v, person)}</b><small>{VERB_ENERGY[v]} 精力</small></button>)}
        {pairVerbs.map(v => <button key={v} type="button" className="pair" onClick={() => setPick({ verb: v, calls: calls.filter(c => c.verb === v) })}><b>{verbWord(v, person)}</b><small>{VERB_ENERGY[v]} 精力 · 再点一人</small></button>)}
        {verbs.length + pairVerbs.length === 0 && <p className="verbs-empty">{world.present[person.id] === "rival" ? `${ta(person)}被请去了对面，这个时段够不着。` : `这会儿对${ta(person)}做不了什么，或者精力不够了。`}</p>}
      </div>}
    </div>}

    {reqCardOpen && <RequestsCard world={world} people={PEOPLE} onAnswer={answerRequest}
      onClose={() => setReqSeenDay(world.day)} />}
    {reqPanelOpen && <RequestsPanel world={world} people={PEOPLE} onAnswer={answerRequest}
      onClose={() => setReqPanelOpen(false)} />}

    {pending && <div className="world-story" role="dialog" aria-label="发生的事">
      <article className="story-card">
        <p className="story-text">{substitute(pending.storylet.text, pending.binding, PEOPLE)}</p>
        <div className="story-choices">
          {storyChoices.length
            ? storyChoices.map(x => <button key={x.i} type="button" onClick={() => chooseStory(x.i)}>{substitute(x.c.label, pending.binding, PEOPLE)}</button>)
            : <button type="button" onClick={() => setPending(null)}>先记下这一幕</button>}
        </div>
      </article>
    </div>}

    {webOpen && <div className="world-web">
      <div className="world-web-bar"><button type="button" onClick={() => setWebOpen(false)}>‹ 返回楼层</button></div>
      <div className="world-web-body"><WebView world={world} people={PEOPLE} /></div>
    </div>}

    <CoachLayer world={world} view={{ screen: "floor", storyOpen: !!pending, webOpen, cardOpen: !!person, acted: world.energy < ENERGY_PER_DAY }} />
  </div>;
}

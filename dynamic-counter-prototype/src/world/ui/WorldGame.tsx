// 人情场楼层界面（默认入口）：一天四个时段的循环、可左右拖的横版大地图、
// 点人开抽屉做事、说书人的卡。规则全部问 engine.ts —— 这里只摆人、摆按钮、
// 念 engine 写进 log 的句子；世界状态走 serializeWorld/parseWorld 落盘。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { MobileScroll } from "../../mobile";
import { asset } from "../../base.ts";
import { sfx, sfxMute, sfxMuted } from "../../sfx.ts";
import {
  advanceSlot, ambient, applyChoice, availableVerbs, beginSlot, choiceVisible, doVerb, inviteRivalGuest, rivalInviteBlock, prepareWeekendOrder,
  beginServe, drawStorylet, endDay, isReturningGuest, leaveServe, newWorld, nextSeason, parseWorld, resolveServe, settleServe, substitute,
  verbOptions, verbEnergyNow, singleVerbReason, energyCeiling, rivalTargets, rivalShakes, rivalThreats, rivalGuarded, rivalPlanWord, SAVE_KEY, VERB_ENERGY, WORLD_SAVE_VERSION,
  type DrawnStorylet, type VerbCall,
} from "../engine.ts";
import { seasonRecap } from "../recap.ts";
import { quarrelPairs } from "../exchanges.ts";
import { askedToday, dueToday, resolveRequestChoice } from "../requests.ts";
import type { Festival, Person, PersonId, Slot, Verb, World, Zone } from "../types.ts";
import { PEOPLE, STORYLETS, festivalsFor } from "../content/index.ts";
import { ta } from "../pronoun.ts";
import { GoalStrip, LevelResult, RoutesSheet, SeasonLevels, weekGapWord } from "./Levels.tsx";
import { YearStrip, CareerCard, careerWord } from "./YearStrip.tsx";
import { CARE_STEPS, GUARD_RATE_STEPS, GUARD_STEPS, ROUTE_WORD, WEEK_EXCEED_RATE, weekDaysLeft, weekGuardedPeople, weekGoalWord, weekLevelWord, weekResultOf, weekStarsKey } from "../target.ts";
import { readWorldProgress } from "../progress.ts";
import { RivalSeasonRecap } from "./RivalHistory.tsx";
import { openConsult, rememberConsult, restoreConsults, saveConsults, type Consult } from "../consult.ts";
import { BUY_INTERVAL_DAYS, purchaseCooldownOf } from "../purchases.ts";
import { askCompanion, companionOptions } from "../companion.ts";
import type { ShelfId } from "../shelf.ts";
import { saleFeedback, type SaleFeedback } from "../sales-feedback.ts";
import { visitPerson } from "../visits.ts";
import { ConsultPanel, SaleReceipt } from "./ConsultPanel.tsx";
import { appointmentTime, currentArrival, publicAppointments } from "../arrivals.ts";
import { CONTACT_INVITE_ENERGY, contactInviteBlock, inviteContact, planContactInvite } from "../engine.ts";
import { rivalBookingNow } from "../rival-business.ts";
import { currentWeekendOrder, WEEKEND_RESULT, WEEKEND_SPONSOR_RESPONSE } from "../weekend-orders.ts";
import { WeekendOrderSheet, WeekendReview } from "./WeekendOrder.tsx";
import { HandoffSheet } from "./HandoffSheet.tsx";
import type { HandoffMode } from "../handoff.ts";
import { returnPoint } from "./return-context.ts";
import { BACKROOM_CHIP, ZONE_LABEL, ZONE_SPOTS, ZONE_STAFF_SPOTS, type Spot } from "./zones.ts";
import { PersonCard, type ContactInvitation } from "./PersonCard.tsx";
import { RequestsCard, RequestsPanel } from "./Requests.tsx";
import { WebView } from "./WebView.tsx";
import { WorldArchive } from "./WorldArchive.tsx";
import {
  COACH_KEY, coachAlive, coachAnchorSelector, coachPoached, coachTip, coachUrgency,
  markCoachSeen, parseCoachSeen, serializeCoachSeen, skipCoachSeen,
  type CoachStep, type CoachTip, type CoachView,
} from "./coach.ts";
import { guestKindWord, momentWord, newGuestWord, opinionWord, scoreBrief, scoreWord, SLOT_WORD, verbsEmptyWord } from "./words.ts";
import { byPriority, momentAnchor, momentSound, worldMoments, type Moment } from "./cues.ts";
import { seasonEnding } from "../ending.ts";
import { HEAT_MAX, HEAT_RULES, isHeatId, type HeatId } from "../heat.ts";
import { weekNoOf } from "../weeks.ts";
import { commitWorldProgress } from "../progress.ts";
import "./base.css";
import "./world.css";

const SEASON_DAYS = 28; // 与 content/festivals.ts 的一季同长
// public/assets/game/chibi/ 里按 id 对得上的小人图（WebP 透明底）；对不上的用头像圆牌。
const CHIBI = new Set(["anjie", "baijie", "caiaiyi", "cenning", "chendao", "chenke", "dongayi", "duan", "fangmin", "gaoyuan", "guyan", "hanlei", "heqing", "huojie", "jiangning", "laokang", "liangxia", "ligui", "lina", "linyi", "luyao", "mei", "miduo", "peilan", "qianjie", "qiaowan", "roman", "ruanxiaoman", "shen", "songjie", "suman", "suxiao", "tangke", "tangtang", "tanwan", "wulaoshi", "xiaoyu", "yenushi", "yinxiaojie", "zhao", "zhaoning", "zhou"]);
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
  tomorrow: Array<{ name: string; slot: Slot; detail?: string }>;
  week: boolean;
  lastOrder?: { name: string; result: string; sponsor?: { name: string; line: string } };
};
/** 「自选加难」的勾选：存在自己的钥匙里（与 COACH_KEY 同类），刷新与重开一季都记得。
 *  真正生效的是 World.heat —— 这里只记"下一季想勾哪几条"。 */
const HEAT_PICK_KEY = "last-order-world-heat-v1";
const readHeatPick = (): HeatId[] => {
  try {
    const raw = window.localStorage.getItem(HEAT_PICK_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isHeatId) ? [...new Set(parsed)] : [];
  } catch { return []; }
};
const writeHeatPick = (heat: HeatId[]): void => {
  try { window.localStorage.setItem(HEAT_PICK_KEY, JSON.stringify(heat)); } catch { /* 存不进就算，勾着玩这一季 */ }
};

/** 开季前那排勾选。aria-pressed 的按压式开关（与静音那颗同一形状），选中那条的说明念在下面。 */
function HeatPicker({ heat, onChange }: { heat: HeatId[]; onChange: (next: HeatId[]) => void }) {
  const toggle = (id: HeatId) => {
    const next = heat.includes(id) ? heat.filter(x => x !== id) : [...heat, id];
    writeHeatPick(next);
    onChange(next);
  };
  return <div className="world-heat" role="group" aria-label="自选加难">
    <p className="world-heat-title">要给自己加点难度吗（勾 {heat.length} / {HEAT_MAX} 条）</p>
    <div className="world-heat-chips">
      {HEAT_RULES.map(rule => <button key={rule.id} type="button" className="world-heat-chip"
        aria-pressed={heat.includes(rule.id)} onClick={() => toggle(rule.id)}>{rule.word}</button>)}
    </div>
    {heat.length === 0
      ? <p className="world-heat-note">一条都不勾，就是平时的柜上。</p>
      : <ul className="world-heat-note">{HEAT_RULES.filter(r => heat.includes(r.id)).map(r => <li key={r.id}>{r.word}：{r.note}</li>)}</ul>}
  </div>;
}

type UiState = {
  screen?: "play" | "report" | "season";
  pending?: { id: string; binding: Record<string, PersonId> };
  report?: DayReport;
  dayBase?: DayBase;
  /** 哪天看过「今天的请求」卡：同一天刷新不重弹 */
  reqSeen?: number;
  consults?: unknown;
  /** 只记真正开着且已经开始的接待；主动关掉后清除，不把旧谈话强行重开。 */
  resumeConsult?: PersonId;
  /** 首日上午先接触客人；第一段柜上故事等接待收尾或主动推进时才抽。 */
  openingPending?: boolean;
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

/** 键上有档、但这一版读不出来：存档格式换过，或者系统在写一半的时候把这一页收了。 */
const unreadableSave = (): boolean => {
  try { const raw = window.localStorage.getItem(SAVE_KEY); return !!raw && !parseWorld(raw); } catch { return false; }
};

// —— 每个时段开头：落位 → 说书人抽一张。在场的人自己互动（传话、陆遥抢客）放在时段末，
//     先让玩家动手：你这个时段没顾上的人，陆遥才带得走。
const runPipeline = (w: World, deferStory = false): { world: World; drawn: DrawnStorylet | null } => {
  const next = beginSlot(w, PEOPLE, festivalsFor(w.season));
  if (deferStory) return { world: next, drawn: null };
  const r = drawStorylet(next, PEOPLE, STORYLETS);
  return { world: r.world, drawn: r.drawn };
};

const nameOf = (id: PersonId) => PEOPLE.find(p => p.id === id)?.name ?? id;
const festivalName = (festivals: Festival[], id?: string) => festivals.find(f => f.id === id)?.name;
const shorten = (text: string) => (text.length > 30 ? `${text.slice(0, 29)}…` : text);
const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;

/** 站在哪一区的人各就各位：同事/对手/商场方站前段，顾客站后段，同区按 id 排稳定序。 */
/** 员工通道里的同事、对手、商场方不画在地图上，收进那枚牌子（BACKROOM_CHIP）。 */
const inBackroomChip = (world: World, id: PersonId): boolean =>
  world.present[id] === "backroom" && PEOPLE.find(p => p.id === id)?.role !== "customer";

function layOut(world: World): Map<PersonId, Spot> {
  const out = new Map<PersonId, Spot>();
  const byZone = new Map<Zone, { staff: PersonId[]; guests: PersonId[] }>();
  for (const [id, zone] of Object.entries(world.present)) {
    // 收进牌子的人：气泡与引导都指着牌子那一处。
    if (inBackroomChip(world, id)) { out.set(id, BACKROOM_CHIP); continue; }
    const bag = byZone.get(zone) ?? { staff: [], guests: [] };
    const person = PEOPLE.find(p => p.id === id);
    (person?.role === "customer" ? bag.guests : bag.staff).push(id);
    byZone.set(zone, bag);
  }
  for (const [zone, bag] of byZone) {
    // 一个点只站一个人：先按各自那一段排，排满了从这一区还空着的点里挑，再不够才挪到隔壁的收银后面。
    const taken = new Set<Spot>();
    const free = (list: Spot[]) => list.find(s => !taken.has(s));
    const put = (id: PersonId, s: Spot | undefined) => { if (!s) return; taken.add(s); out.set(id, s); };
    bag.guests.sort().forEach(id => put(id, free(ZONE_SPOTS[zone]) ?? free(ZONE_STAFF_SPOTS[zone])));
    bag.staff.sort().forEach(id => put(id, free(ZONE_STAFF_SPOTS[zone]) ?? free(ZONE_SPOTS[zone]) ?? free(ZONE_STAFF_SPOTS.cashier)));
  }
  return out;
}

/** hide：同事的名牌实在没处放（最窄那一档、柜台前站满）就先收起来，点人照样点得到；客人的名牌永远留着。 */
type TagShift = { dx: number; dy: number; hide?: true };
/** 名牌避让：先排客人（离镜头近的先），再排同事。每块名牌在头顶、头侧、再往上几格里挑第一处
 *  既不压别人的名牌、也不压别人身子的位置，挑不到就取叠得最少的那处。坐标从站位百分比与元素自身尺寸现算，
 *  不读 getBoundingClientRect —— 人换位置有 0.9 秒过渡，过渡中途量出来的是半路上的位置。 */
function placeTags(map: HTMLElement, spots: Map<PersonId, Spot>, guestIds: Set<PersonId>): Record<PersonId, TagShift> {
  const W = map.offsetWidth, H = map.offsetHeight;
  type Box = [number, number, number, number];
  const items = [...map.querySelectorAll<HTMLElement>(".wf-actor")].flatMap(el => {
    const id = el.dataset.pid!, s = spots.get(id);
    const tag = el.querySelector<HTMLElement>(".wf-tag"), fig = el.querySelector<HTMLElement>(".wf-figure");
    if (!s || !tag || !fig) return [];
    const x = (s.x / 100) * W, y = (s.y / 100) * H;
    return [{ id, x, y, tw: tag.offsetWidth, th: tag.offsetHeight, fw: fig.offsetWidth, fh: fig.offsetHeight }];
  });
  const bodies: Array<{ id: PersonId; box: Box }> = items.map(i => ({ id: i.id, box: [i.x - i.fw / 2, i.y - i.fh, i.x + i.fw / 2, i.y] }));
  const area = (a: Box, b: Box) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const order = [...items].sort((a, b) => Number(guestIds.has(b.id)) - Number(guestIds.has(a.id)) || b.y - a.y);
  const placed: Box[] = [];
  // 员工通道那枚牌子也算一块：名牌不往它底下钻。
  const chip = map.querySelector<HTMLElement>(".wf-backroom");
  if (chip) {
    const m = map.getBoundingClientRect(), c = chip.getBoundingClientRect();
    placed.push([c.left - m.left, c.top - m.top, c.right - m.left, c.bottom - m.top]);
  }
  const out: Record<PersonId, TagShift> = {};
  for (const it of order) {
    const base: Box = [it.x - it.tw / 2, it.y - it.fh - 2 - it.th, it.x + it.tw / 2, it.y - it.fh - 2];
    const side = it.tw / 2 + it.fw / 2, lift = it.th + 3;
    const tries: TagShift[] = [
      { dx: 0, dy: 0 }, { dx: side, dy: it.th * 0.9 }, { dx: -side, dy: it.th * 0.9 },
      { dx: 0, dy: -lift }, { dx: side, dy: 0 }, { dx: -side, dy: 0 }, { dx: 0, dy: -2 * lift },
      { dx: side, dy: -lift }, { dx: -side, dy: -lift },
      // 最后一招：挂到脚下 —— 柜台前那一排人的脚下往往是空地。
      { dx: 0, dy: it.fh + it.th + 4 },
    ];
    let best = tries[0], bestCost = Infinity;
    for (const t of tries) {
      const box: Box = [base[0] + t.dx, base[1] + t.dy, base[2] + t.dx, base[3] + t.dy];
      if (box[1] < 2) continue; // 名牌不许顶出地图上沿
      if (box[2] > W - 2 || box[0] < 2 || box[3] > H - 2) continue; // 也不许挤出地图左右与下沿
      // 离她越远越难认出是谁的：挪得越远加一点代价，叠一点点比飘到半空强。
      const drift = (Math.abs(t.dx) + Math.abs(t.dy)) * it.th * 0.15;
      const cost = drift + placed.reduce((c, p) => c + 2 * area(box, p), 0)
        // 压到别人身上比压到名牌更糟：身子是手指点的地方。
        + bodies.reduce((c, b) => c + (b.id === it.id ? 0 : 4 * area(box, b.box)), 0);
      if (cost < bestCost) { best = t; bestCost = cost; }
      if (cost === drift && cost === 0) break;
    }
    const clash = bestCost - (Math.abs(best.dx) + Math.abs(best.dy)) * it.th * 0.15;
    if (clash > 0 && !guestIds.has(it.id)) { out[it.id] = { dx: 0, dy: 0, hide: true }; continue; }
    placed.push([base[0] + best.dx, base[1] + best.dy, base[2] + best.dx, base[3] + best.dy]);
    if (best.dx || best.dy) out[it.id] = { dx: Math.round(best.dx), dy: Math.round(best.dy) };
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
  const tomorrow = publicAppointments(after, PEOPLE, after.day);
  const order = after.weekendOrder;
  const lastOrder = order?.due === before.day && order.outcome ? { name: nameOf(order.person), result: WEEKEND_RESULT[order.outcome],
    ...(order.sponsor && PEOPLE.some(p => p.id === order.sponsor) ? { sponsor: { name: nameOf(order.sponsor), line: WEEKEND_SPONSOR_RESPONSE[order.outcome].line } } : {}) } : undefined;
  return { day: before.day, moneyDelta: after.money - base.money, movers, tomorrow, week: before.day % 7 === 0, lastOrder };
}

// —— 音效：看法动到这个数才算"明显"，招呼那点 +3 不响 ——
// 成交 / 回头客 / 比分那三个时刻不在这里判（见 ui/cues.ts）：那些是"一次状态变化"的事，
// 由下面那个 watch world 的 effect 统一出声，所以早晨老客自己回柜那一笔也听得到。
// 这里只补看法那一动，并且晚一拍 —— 同一格里钱和脸一起变时两段音不叠成一团。
const OPINION_CUE = 5;
const cueOpinion = (before: World, after: World, at: number) => {
  let up = 0, down = 0;
  const ids = new Set([...Object.keys(before.opinion), ...Object.keys(after.opinion)]);
  for (const id of ids) {
    const d = (after.opinion[id] ?? 0) - (before.opinion[id] ?? 0);
    if (d > up) up = d;
    if (d < down) down = d;
  }
  if (down <= -OPINION_CUE) sfx("down", at);
  else if (up >= OPINION_CUE) sfx("up", at);
};

// —— 苏蔓的新手引导：一句一个固定层气泡，指着它在说的那个东西 ——

type CoachPos = { left: number; top: number; arrowX: number; below: boolean };

function CoachLayer({ view, world, onServe }: { view: CoachView; world: World; onServe?: (id: PersonId) => void }) {
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
      const header = layer.parentElement?.querySelector(".world-bar")?.getBoundingClientRect();
      const top = Math.min(Math.max(t, header ? header.bottom - lr.top + 8 : 8), Math.max(8, lr.height - br.height - 8));
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
      {active.tip.step === "open" && active.tip.anchor.kind === "actor" && onServe
        && availableVerbs(world, PEOPLE, [active.tip.anchor.id]).includes("serve") && <button type="button" className="wc-start"
          onClick={() => {
            if (active.tip.anchor.kind !== "actor") return;
            const id = active.tip.anchor.id;
            commit(active.tip.step); setActive(null); onServe(id);
          }}>接待{nameOf(active.tip.anchor.id)}</button>}
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
  const stale = useMemo(unreadableSave, []);
  const [world, setWorld] = useState<World>(() => boot?.world ?? newWorld("empty", PEOPLE));
  const [phase, setPhase] = useState<"intro" | "play" | "report" | "season">("intro");
  const [pending, setPending] = useState<DrawnStorylet | null>(null);
  const [openingPending, setOpeningPending] = useState(() => boot?.ui.openingPending === true
    && boot.world.season === 1 && boot.world.day === 1 && boot.world.slot === 0);
  const [report, setReport] = useState<DayReport | null>(boot?.ui.report ?? null);
  const [dayBase, setDayBase] = useState<DayBase | null>(boot?.ui.dayBase ?? null);
  const [selected, setSelected] = useState<PersonId | null>(null);
  const [pick, setPick] = useState<{ verb: Verb; calls: VerbCall[] } | null>(null);
  // 托单先选好同事+客人，再在表单里明确选"只照看"或"合适就代卖"；这里只存已定的目标，点开不扣精力。
  const [handoffTargets, setHandoffTargets] = useState<PersonId[] | null>(null);
  const [serving, setServing] = useState(false);
  // 这一时段柜上谈到一半的接待：关掉抽屉再点回来接着谈，翻时段清空（她走了，话也就断了）。
  const [consults, setConsults] = useState<Record<PersonId, Consult>>(() => boot ? restoreConsults(boot.ui.consults, boot.world, PEOPLE) : {});
  const [receipt, setReceipt] = useState<{ person: Person; product: ShelfId; feedback: SaleFeedback } | null>(null);
  const [webOpen, setWebOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rivalArchive, setRivalArchive] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [muted, setMuted] = useState(sfxMuted());
  const [reqSeenDay, setReqSeenDay] = useState(boot?.ui.reqSeen ?? 0);
  // 勾着开下一季：读盘里已经生效的那几条（继续玩时），没档就读上次勾选的。
  const [heat, setHeat] = useState<HeatId[]>(() => boot ? [...boot.world.heat ?? []] : readHeatPick());
  const [reqPanelOpen, setReqPanelOpen] = useState(false);
  const [weekendOpen, setWeekendOpen] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(false);
  // 收季那一刻之前的最好成绩：季末那排四关战绩拿它判"新纪录"（存档一并进档案以后就分不出来了）。
  const [prevBest, setPrevBest] = useState<number | null>(null);
  const bestStars = useMemo(() => readWorldProgress().bestSeasonStars, [phase]);

  const person = selected ? PEOPLE.find(p => p.id === selected) : undefined;
  const salePerson = person ? visitPerson(world, person) : undefined;
  const spots = useMemo(() => layOut(world), [world]);
  // 正在拌嘴的人头顶冒火气；点其中一个，打圆场就在动作排里。
  const quarreling = useMemo(() => new Set(quarrelPairs(world).flat()), [world]);
  // 在场客人和其中还没接过你手的几位 —— 名牌上那一行和「现场」标题读同一份。
  const [guests, freshGuests] = useMemo(() => {
    const list = Object.keys(world.present).filter(id => PEOPLE.find(p => p.id === id)?.role === "customer");
    return [list, list.filter(id => !isReturningGuest(world, id)).length] as const;
  }, [world]);
  const calls = useMemo(() => (selected ? verbOptions(world, PEOPLE).filter(c => c.targets.includes(selected)) : []),
    [world, selected]);
  const verbs = selected ? availableVerbs(world, PEOPLE, [selected]) : [];
  const pairVerbs = TWO_TARGET.filter(v => calls.some(c => c.verb === v));
  // 单人动作常驻：付不起/今天做不了的也留着，用一句原因把「接待为什么不见了」说清楚。
  const singleVerbs = useMemo(() => {
    if (!person) return [] as Verb[];
    if (person.role === "customer") return [
      "greet" as const,
      ...(person.skin ? ["sample" as const, "serve" as const] : []),
      "wechat" as const,
      ...(world.qualities[`secret-known:${person.id}`] ? ["keep" as const] : []),
    ];
    if (person.role === "staff") return ["help" as const];
    return [] as Verb[];
  }, [person, world.qualities]);
  const verbRows = useMemo(() => person
    ? singleVerbs.map(v => ({ verb: v, reason: singleVerbReason(world, PEOPLE, person.id, v) }))
    : [], [person, singleVerbs, world]);
  // 接待那一屏：看 / 问 / 试 的判定全在 consult.ts；没摸出来的诉求照样参与 fitScore。
  const consult = serving && person?.skin ? consults[person.id] ?? null : null;
  const midConsult = person ? consults[person.id]?.begun ?? false : false;
  const invitationFor = (p: Person): ContactInvitation | undefined => {
    if (p.role !== "customer" || !p.skin || !world.qualities[`wechat:${p.id}`]) return undefined;
    const next = planContactInvite(world, p);
    return { when: next ? appointmentTime(world, next) : undefined, cost: CONTACT_INVITE_ENERGY,
      blocked: contactInviteBlock(world, PEOPLE, p.id), onInvite: () => setWorld(w => inviteContact(w, PEOPLE, p.id)) };
  };
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
      consults: saveConsults(world, consults),
      resumeConsult: consult?.begun ? consult.person : undefined,
      openingPending: openingPending || undefined,
    } satisfies UiState,
  }), [phase, world, pending, report, dayBase, reqSeenDay, consults, consult, openingPending]);
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
  // —— 一次状态变化就是"发生了一件事"：成交、回头客、比分反超都从这里出声音、亮一处动画、念一句牌。
  // 挂在这里而不是各动作函数里，是因为早晨老客自己回柜那一笔（beginSlot 里的赴约回流）不经过任何按钮。
  const [moments, setMoments] = useState<Moment[]>([]);
  const [bump, setBump] = useState<string | null>(null);
  const prevWorld = useRef<World | null>(null);
  useEffect(() => {
    const before = prevWorld.current;
    prevWorld.current = world;
    // 开局 / 继续 / 换季那几次不算发生了一件事：玩家还没动手，不能替他响一声。
    if (!before || before === world) return;
    const found = worldMoments(before, world);
    if (found.length) sfx(momentSound[byPriority(found)[0]!.kind]);
    // 看法那一动晚一拍：同一格里钱和脸一起变（硬推那一单）时两段音不叠成一团。
    cueOpinion(before, world, found.length ? 0.28 : 0);
    if (found.length) setMoments(found);
    // 客情 / 守客涨了没有收银声，也要在页顶那条上冒一下，不然玩家不知道刚才那一下算数了。
    if (weekNoOf(before.day) === weekNoOf(world.day)) {
      const a = weekResultOf(before), b = weekResultOf(world);
      const up = [b.care > a.care ? `客情 +${b.care - a.care}` : "", b.guard > a.guard ? `守客 +${b.guard - a.guard}` : ""].filter(Boolean).join(" ");
      if (up) setBump(up);
    }
  }, [world]);
  useEffect(() => {
    if (!bump) return;
    const timer = window.setTimeout(() => setBump(null), 1900);
    return () => window.clearTimeout(timer);
  }, [bump]);
  useEffect(() => {
    if (!moments.length) return;
    const timer = window.setTimeout(() => setMoments([]), 1900);
    return () => window.clearTimeout(timer);
  }, [moments]);
  const lit = useMemo(() => {
    const out = { money: false, goal: false, score: null as null | "is-lead" | "is-trail", person: null as PersonId | null };
    for (const m of byPriority(moments)) for (const at of momentAnchor[m.kind]) {
      if (at === "money") out.money = true;
      else if (at === "goal") out.goal = true;
      else if (at === "score") out.score ??= m.kind === "lead" ? "is-lead" : "is-trail";
      else if (m.who && !out.person) out.person = m.who;
    }
    return out;
  }, [moments]);
  const topMoment = moments.length ? byPriority(moments)[0]! : null;
  // 人走了（被请去对面、故事卡里离开）就把抽屉收掉；够不着的留着卡给人看。
  useEffect(() => {
    if (selected && !(selected in world.present)) { setSelected(null); setServing(false); setPick(null); setHandoffTargets(null); }
  }, [world.present, selected]);

  // —— 开局 / 继续 ——
  const startNew = () => {
    const fresh = newWorld(`world-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`, PEOPLE, heat);
    writeHeatPick(heat);
    const base: DayBase = { day: fresh.day, money: fresh.money, opinion: { ...fresh.opinion } };
    setDayBase(base);
    const { world: w, drawn } = runPipeline(fresh, true);
    setOpeningPending(true);
    prevWorld.current = w;
    setWorld(w); setPending(drawn); setReport(null);
    setSelected(null); setPick(null); setServing(false); setWebOpen(false); setResult(null); setConsults({});
    if (drawn) sfx("card");
    setPhase("play");
  };
  const continueGame = () => {
    const saved = restore();
    if (!saved) { startNew(); return; }
    const { world: w, ui } = saved;
    setOpeningPending(ui.openingPending === true && w.season === 1 && w.day === 1 && w.slot === 0);
    prevWorld.current = w;
    setDayBase(ui.dayBase ?? { day: w.day, money: w.money, opinion: { ...w.opinion } });
    setReqSeenDay(ui.reqSeen ?? 0);
    setWorld(w);
    const restored = restoreConsults(ui.consults, w, PEOPLE);
    setSelected(null); setPick(null); setServing(false); setWebOpen(false); setResult(null); setConsults(restored);
    if (ui.screen === "season") { setPhase("season"); return; }
    if (ui.screen === "report" && ui.report) { setReport(ui.report); setPhase("report"); return; }
    const card = ui.pending ? STORYLETS.find(s => s.id === ui.pending!.id) : undefined;
    const point = returnPoint(w, { screen: ui.screen, hasStory: !!card, consults: restored, focusedConsult: ui.resumeConsult }, PEOPLE);
    if (point.kind === "consult" && point.person) { setSelected(point.person); setServing(true); }
    setPending(card ? { storylet: card, binding: ui.pending!.binding } : null);
    setReport(null);
    setPhase("play");
  };

  // —— 时段推进 ——
  const showOpeningStory = (w: World) => {
    if (!openingPending) return;
    const next = drawStorylet(w, PEOPLE, STORYLETS);
    setOpeningPending(false); setWorld(next.world); setPending(next.drawn);
    if (next.drawn) sfx("card");
  };
  const nextTurn = () => {
    setSelected(null); setPick(null); setServing(false); setResult(null); setConsults({}); setHandoffTargets(null);
    let closed = Object.values(consults).filter(c => c.begun).reduce((w, c) => leaveServe(w, PEOPLE, c.person, c.mood), world);
    // 可以不接待直接往下玩，但先把这时段的故事讲完，不暗中丢掉首张卡。
    if (openingPending) {
      const next = drawStorylet(closed, PEOPLE, STORYLETS);
      setOpeningPending(false);
      if (next.drawn) { setWorld(next.world); setPending(next.drawn); sfx("card"); return; }
      // 没有合法卡也带上抽数结果，再走正常时段结算。
      closed = next.world;
    }
    const settled = ambient(closed, PEOPLE); // 这个时段末：在场的人互相传话，陆遥带走你没顾上的人
    // 客人被对面请走是这一档唯一要在这里补的一声：它不改钱也不改比分，世界那一侧的时刻判据认不出它。
    if (coachPoached(settled, PEOPLE) && !coachPoached(world, PEOPLE)) sfx("down");
    sfx("bell");
    if (world.slot === 3) {
      const w = endDay(settled, PEOPLE);
      const rep = buildReport(world, w, dayBase ?? { day: world.day, money: 0, opinion: {} });
      // 周日对账那一下：过关一声亮的，没过一声沉的（结算屏同时盖章）。
      if (rep.week) sfx((w.qualities[weekStarsKey(weekNoOf(world.day))] ?? 0) > 0 ? "lead" : "down", 0.45);
      setDayBase({ day: w.day, money: w.money, opinion: { ...w.opinion } });
      setWorld(w);
      setPending(null);
      if (w.day > SEASON_DAYS) { setPrevBest(readWorldProgress().bestSeasonStars); setReport(null); setPhase("season"); }
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
    const next = nextSeason(world, PEOPLE, heat);
    setDayBase({ day: next.day, money: next.money, opinion: { ...next.opinion } });
    const { world: w, drawn } = runPipeline(next);
    prevWorld.current = w;
    setWorld(w); setPending(drawn); setReport(null);
    if (drawn) sfx("card");
    setSelected(null); setPick(null); setServing(false); setWebOpen(false); setResult(null); setConsults({});
    setPhase("play");
  };

  // —— 楼层上的动作 ——
  const apply = (call: VerbCall) => {
    const next = doVerb(world, PEOPLE, call.verb, call.targets);
    if (next === world) return;
    setWorld(next); setPick(null);
    setResult(next.log.at(-1)?.text ?? null);
  };
  // 托单确认：带着已定的同事+客人与所选模式走一次 doVerb，只在真的发生时扣一次费、念一次结果。
  const confirmHandoff = (mode: HandoffMode) => {
    if (!handoffTargets) return;
    const next = doVerb(world, PEOPLE, "handoff", handoffTargets, { handoffMode: mode });
    setHandoffTargets(null);
    if (next === world) return;
    setWorld(next);
    setResult(next.log.at(-1)?.text ?? null);
  };
  const tapPerson = (id: PersonId) => {
    sfx("tap");
    if (pick) {
      const call = pick.calls.find(c => c.targets.includes(id));
      if (call) {
        // 托单不再点一下就自动代卖：先定好同事+客人，再到表单里明确选"只照看"或"合适就代卖"。
        if (pick.verb === "handoff") { setPick(null); setHandoffTargets(call.targets); return; }
        apply(call); return;
      }
      setPick(null); // 点的不是目标：退出选人，照常开她的卡
    }
    setSelected(id); setServing(false);
  };
  const openServe = (id = selected) => {
    const guest = PEOPLE.find(p => p.id === id);
    if (!guest?.skin || (!consults[guest.id]?.begun && !availableVerbs(world, PEOPLE, [guest.id]).includes("serve"))) return;
    setSelected(guest.id); setPick(null);
    if (!consults[guest.id]) setConsults(m => ({ ...m, [guest.id]: openConsult(world, guest) }));
    setServing(true);
  };
  // 看 / 问 / 试的第一下才算正式接手：精力在这一刻花（beginServe），之后再点不重复扣。
  const consultAct = (step: (c: Consult) => Consult) => {
    if (!person || !salePerson || !consult) return;
    const next = step(consult);
    if (next === consult) return;
    const w = consult.begun ? world : beginServe(world, PEOPLE, person.id);
    if (!consult.begun && w === world) return;
    setWorld(rememberConsult(w, person, next));
    sfx("tap");
    setConsults(m => ({ ...m, [person.id]: next }));
  };
  const doServe = (force: boolean) => {
    if (!selected || !person || !salePerson || !consult?.product) return;
    const serveProduct = consult.product, serveUnits = consult.units;
    const c = consults[selected];
    const next = c?.begun
      ? settleServe(world, PEOPLE, selected, serveProduct, serveUnits, force, c.mood)
      : resolveServe(world, PEOPLE, selected, serveProduct, serveUnits, force);
    if (next === world) return;
    setWorld(next); setServing(false);
    setConsults(m => { const { [selected]: _, ...rest } = m; return rest; });
    setResult(next.log.at(-1)?.text ?? null);
    setReceipt({ person: salePerson, product: serveProduct, feedback: saleFeedback(world, next, salePerson, serveProduct, serveUnits, c?.mood ?? 0, c?.risked === true) });
  };
  const stopServe = () => {
    if (!person || !consult) return;
    const next = consult.begun ? leaveServe(world, PEOPLE, person.id, consult.mood) : world;
    setWorld(next);
    setConsults(m => { const { [person.id]: _, ...rest } = m; return rest; });
    setSelected(null); setServing(false);
    if (consult.begun) showOpeningStory(next);
  };
  const chooseStory = (index: number) => {
    if (!pending) return;
    const next = applyChoice(world, PEOPLE, pending, index);
    if (next === world) return;
    setWorld(next); setPending(null);
  };
  // 委托卡上当场能答的（唐可借小样）：应下/回绝都算一句话的事。
  const answerRequest = (reqId: string, accept: boolean) => {
    const next = resolveRequestChoice(world, PEOPLE, reqId, accept);
    if (next === world) return;
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
  // 名牌避让与员工通道那枚牌子（见 placeTags / BACKROOM_CHIP）。
  const [tagShift, setTagShift] = useState<Record<PersonId, TagShift>>({});
  const [backroomOpen, setBackroomOpen] = useState(false);
  const guestSet = useMemo(() => new Set(guests), [guests]);
  const backroomIds = useMemo(() => Object.keys(world.present).filter(id => inBackroomChip(world, id)).sort(), [world]);
  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const run = () => {
      const next = placeTags(map, spots, guestSet);
      setTagShift(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    };
    run();
    // 字体晚到一拍会把名牌撑宽：到了再排一遍。
    void document.fonts?.ready.then(run);
  }, [spots, guestSet, bounds.map, phase, backroomIds.length]);
  useEffect(() => { setBackroomOpen(false); }, [world.day, world.slot]);
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
    const point = boot ? returnPoint(boot.world, {
      screen: boot.ui.screen, reportDay: boot.ui.report?.day,
      hasStory: !!boot.ui.pending && STORYLETS.some(s => s.id === boot.ui.pending!.id),
      focusedConsult: boot.ui.resumeConsult, consults: restoreConsults(boot.ui.consults, boot.world, PEOPLE),
    }, PEOPLE) : null;
    return <div className="app-screen world-app world-intro-screen">
      <img className="world-intro-bg" src={asset("/assets/game/mall-floor.jpg")} alt="" aria-hidden="true" />
      <div className="world-intro-shade" />
      <section className="world-intro-card">
        <MobileScroll className="world-intro-scroll">
          <p className="world-intro-eyebrow">AURORA · 绮光</p>
          <h1>人情场</h1>
          {point ? <section className="world-return-context" aria-label="上次停在这里">
            <p className="world-return-eyebrow">上次停在这里</p>
            <h2>{point.title}</h2><p>{point.detail}</p>
          </section> : <><p className="world-intro-hook">这一单怎么卖，整层楼都会记得。</p>
          <p className="world-intro-copy">看懂客人的心事，接住对手抢的人。周末算业绩，也算谁还愿意回来。</p>
          <p className="world-intro-copy world-intro-sub">一季四关，一周一关。做业绩、养熟客、守住客人，三条路任选。</p></>}
          {bestStars > 0 && <p className="world-intro-best">最好的一季：{bestStars} / 12 颗星</p>}
          {stale && <p className="world-intro-stale">柜上留过一份记录，这一版读不出来了：存档格式换过，或是上一次存到一半被打断。开新一季，旧的那一份就接不回来了。</p>}
          <details className="world-intro-details">
            <summary>怎么过关</summary>
            <p>每周三条线，任选一条过关：业绩到罗曼报的数；客情让 {CARE_STEPS[0]} 位不同客人信得过你；守客从陆遥手里接住 {GUARD_STEPS[0]} 位不同客人。</p>
            <p>客情到 {CARE_STEPS.slice(1).join(" / ")} 位加星；守客到 {GUARD_STEPS.slice(1).join(" / ")} 位、并挡住 {GUARD_RATE_STEPS.slice(1).map(x => `${Math.round(x * 100)}%`).join(" / ")} 的公开威胁加星；业绩赢对面、超额 {Math.round((WEEK_EXCEED_RATE - 1) * 100)}% 也加星。具体进度随时点楼层页顶查看。</p>
          </details>
          <details className="world-intro-details">
            <summary>本季规矩 · {heat.length ? `已选 ${heat.length} 条` : "标准难度"}</summary>
            <HeatPicker heat={heat} onChange={setHeat} />
          </details>
        </MobileScroll>
        <div className="world-intro-foot">
          <button className="world-primary" type="button" onClick={boot ? continueGame : startNew}>
            {point?.button ?? "开这一季"}
          </button>
          {!boot && <p className="world-intro-entry-note">先接一位客人，边做边学。</p>}
          {boot && <button className="world-ghost" type="button" onClick={startNew}>重新开一季</button>}
          <button className="world-archive-entry" type="button" onClick={() => setArchiveOpen(true)}>档案</button>
        </div>
      </section>
      {archiveOpen && <WorldArchive onBack={() => setArchiveOpen(false)} />}
    </div>;
  }

  if (phase === "season") {
    const ending = seasonEnding(world, PEOPLE);
    const recap = seasonRecap(world, PEOPLE, STORYLETS);
    const person = (id: PersonId) => PEOPLE.find(p => p.id === id);
    const avatar = (id: PersonId, key?: string | number) => {
      const p = person(id);
      return <span key={key} className={"recap-avatar" + (p?.portrait ? "" : " letter")} aria-hidden="true">
        {p?.portrait ? <img src={p.portrait} alt="" /> : <b>{(p?.name ?? id).slice(0, 1)}</b>}
      </span>;
    };
    const personRow = (r: { id: PersonId; line: string; day?: number }) => {
      const p = person(r.id);
      return <li className="recap-person" key={r.id}>
        {avatar(r.id)}
        <div className="recap-person-main">
          <b>{nameOf(r.id)}{r.day !== undefined ? <small>第 {r.day} 天</small> : null}</b>
          <p>{p ? `${ta(p)}` : ""}{r.line}</p>
        </div>
      </li>;
    };
    return <div className="app-screen world-app world-report-page world-recap-page">
      <MobileScroll className="world-report-scroll"><main className="world-report world-recap">
        <p className="report-eyebrow">第 {world.season} 季 · {SEASON_DAYS} 天散场</p>
        <h1 className="recap-ending">{ending.title}</h1>
        <p className="recap-ending-body">{ending.body}</p>
        <SeasonLevels world={world} prevBest={prevBest} />
        <CareerCard world={world} />
        <RivalSeasonRecap world={world} records={readWorldProgress().rivalSeasons}
          onHistory={() => { setRivalArchive(true); setArchiveOpen(true); }} />

        <section className="recap-block">
          <h2>这一季的高光</h2>
          <ol className="recap-timeline">
            {recap.highlights.map((h, i) => <li key={i}>
              <span className="recap-day">第 {h.day} 天</span>
              <div className="recap-timeline-main">
                <p>{h.text}</p>
                {h.who.length ? <span className="recap-who">{h.who.map(id => avatar(id, id))}</span> : null}
              </div>
            </li>)}
          </ol>
        </section>

        <section className="recap-block">
          <h2>你的人</h2>
          {recap.allies.length
            ? <ul className="recap-people">{recap.allies.map(personRow)}</ul>
            : <p className="recap-empty">没有一个人把你当自己人。</p>}
        </section>
        {recap.remembered.length ? <section className="recap-block">
          <h2>记着你的人</h2>
          <ul className="recap-people recap-people-grudge">{recap.remembered.map(personRow)}</ul>
        </section> : null}

        <section className="recap-block">
          <h2>这一季谁变了</h2>
          {recap.movers.length ? <ul className="recap-people recap-movers">{recap.movers.map(m => <li className="recap-person" key={m.id}>
            {avatar(m.id)}
            <div className="recap-person-main">
              <b>{nameOf(m.id)}</b>
              {/* 看法只用话说（opinionWord），不把数值摊给玩家。 */}
              <p>{m.from === undefined ? `开季还没认识，如今${opinionWord(m.to)}` : `从「${opinionWord(m.from)}」到「${opinionWord(m.to)}」`}</p>
            </div>
            <span className={"recap-delta" + (m.to - (m.from ?? 0) < 0 ? " down" : "")} aria-hidden="true">{m.to - (m.from ?? 0) > 0 ? "近了" : "远了"}</span>
          </li>)}</ul> : <p className="recap-empty">这一季没人改主意。</p>}
        </section>

        <section className="recap-block">
          <h2>走完的线</h2>
          {recap.arcs.length
            ? <ul className="recap-arcs">{recap.arcs.map(a => <li key={a.id}>
              <b>{nameOf(a.id)}</b><span>「{a.title}」</span>{a.day !== undefined ? <small>第 {a.day} 天落定</small> : null}
            </li>)}</ul>
            : <p className="recap-empty">谁的线都没走到头。</p>}
        </section>

        <section className="recap-block">
          <h2>本子上的事</h2>
          {recap.threads.length
            ? <ul className="recap-arcs">{recap.threads.map(t => <li key={t.id}>
              <b>{t.name}</b>
              <span>{t.landing >= 1
                ? `翻过来了：「${t.title ?? `第 ${t.landing} 档`}」`
                : `${t.question}本子上攒到 ${t.held.length} 条。`}</span>
              {t.landing >= 1
                ? t.carriesOn ? <small>这一页没合上，下一季还有人认它</small> : null
                : <small>下季还有人认得</small>}
            </li>)}</ul>
            : <p className="recap-empty">这一季本子上没添新的一页。</p>}
        </section>

        {world.weekendOrder?.due === SEASON_DAYS && world.weekendOrder.outcome && <section className="recap-block recap-weekend">
          <h2>最后那一单，话还没说完</h2>
          <p>{nameOf(world.weekendOrder.person)} · {WEEKEND_RESULT[world.weekendOrder.outcome]}</p>
          <WeekendReview order={world.weekendOrder} />
          <p>下一季开门后，会回来聊那次的事。</p>
        </section>}
        <section className="recap-block recap-numbers-block">
          <h2>三本账</h2>
          <div className="report-numbers recap-numbers">
            <span><small>这一季进账</small><b>{yuan(recap.stats.money.value)}</b><em>{recap.stats.money.line}</em></span>
            <span><small>柜位</small><b>{recap.stats.standing.value}</b><em>{recap.stats.standing.line}</em></span>
            <span><small>台账</small><b>{recap.stats.compliance.value}</b><em>{recap.stats.compliance.line}</em></span>
          </div>
          <p className="recap-score">对面维珞这一季做成 {world.rivalWins} 单、进账 {yuan(world.rivalMoney)} —— {scoreWord(world.money, world.rivalMoney)}。</p>
        </section>
      </main></MobileScroll>
      <div className="report-foot recap-foot">
        <button className="world-primary" type="button" onClick={startNextSeason}>进入第 {world.season + 1} 季</button>
        <HeatPicker heat={heat} onChange={setHeat} />
        <div className="recap-foot-row">
          <button className="world-archive-entry" type="button" onClick={() => setArchiveOpen(true)}>档案</button>
          <button className="world-ghost" type="button" onClick={startNew}>重开一季</button>
        </div>
      </div>
      {archiveOpen && <WorldArchive initialTab={rivalArchive ? "rival" : "people"} currentRun={world.seed}
        onBack={() => { setArchiveOpen(false); setRivalArchive(false); }} />}
    </div>;
  }

  if (phase === "report" && report) {
    const allies = PEOPLE.filter(p => (world.opinion[p.id] ?? 0) >= 40);
    const enemies = PEOPLE.filter(p => (world.opinion[p.id] ?? 0) <= -30);
    const cooling = PEOPLE.filter(p => p.role === "customer" && purchaseCooldownOf(world, p.id));
    const coolingLeft = cooling.length
      ? Math.min(...cooling.map(p => purchaseCooldownOf(world, p.id)!.left)) : 0;
    return <div className="app-screen world-app world-report-page">
      <MobileScroll className="world-report-scroll"><main className="world-report">
        <p className="report-eyebrow">第 {report.day} 天 · {report.week ? "周日对账" : "今日收工"}</p>
        {report.lastOrder && <section className="report-block report-last-order" aria-label="周末最后一单的结果">
          <h2>最后那一单</h2><p>{report.lastOrder.name} · {report.lastOrder.result}</p>
          {world.weekendOrder?.due === report.day && <WeekendReview order={world.weekendOrder} />}
          {report.lastOrder.sponsor && <p className="report-sponsor">{report.lastOrder.sponsor.name}的回应：{report.lastOrder.sponsor.line}</p>}
        </section>}
        {report.week ? <LevelResult world={world} day={report.day} /> : <h1>今天打烊了</h1>}
        <div className="report-numbers">
          <span><small>今天进账</small><b>{report.moneyDelta === 0 ? "没开单" : `${report.moneyDelta > 0 ? "+" : "−"}${yuan(Math.abs(report.moneyDelta))}`}</b></span>
          {report.week
            ? <span><small>这一季累计</small><b>{yuan(world.money)}</b></span>
            : <span><small>{weekLevelWord(world)}</small><b>{weekGoalWord(world)}</b><em>{weekGapWord(world) ? `${weekGapWord(world)} · 还剩 ${weekDaysLeft(world.day)} 天，任一条到线就过` : `已凭${ROUTE_WORD[weekResultOf(world).route]}过关`}</em></span>}
          <span><small>对面这一季</small><b>{yuan(world.rivalMoney)}</b><em>{scoreWord(world.money, world.rivalMoney)}</em></span>
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
            ? report.tomorrow.map((t, i) => <p className="report-appointment" key={`${t.name}-${t.slot}-${i}`}>
              <strong>{t.name} · {SLOT_WORD[t.slot]}</strong><span>{typeof t.detail === "string" && t.detail ? t.detail : "说好了来看看"}</span>
            </p>)
            : <p>明天没人约好。谁肯替你约人，得看今晚这张网。</p>}
          {cooling.length > 0 && <p className="report-cooldown">
            还有 {cooling.length} 位客人还在 {BUY_INTERVAL_DAYS} 天购买间隔里，最早 {coolingLeft} 天后回来
            {cooling.length <= 4 ? `（${cooling.map(p => p.name).join("、")}）` : ""}。
          </p>}
        </section>
        {report.week && <section className="report-block">
          <h2>这一周的网</h2>
          <p>{allies.length ? `把你当自己人的：${allies.map(p => p.name).join("、")}` : "还没有人把你当自己人"}{enemies.length ? `；记仇的：${enemies.map(p => p.name).join("、")}` : ""}</p>
        </section>}
      </main></MobileScroll>
      <div className="report-foot"><button className="world-primary" type="button" onClick={startNextDay}>进入第 {world.day} 天</button></div>
      <CoachLayer world={world} view={{ screen: "report", reportDay: report.day, webOpen: false, cardOpen: false, acted: false }} />
    </div>;
  }

  const storyChoices = pending
    ? pending.storylet.choices.map((c, i) => ({ c, i })).filter(x => choiceVisible(world, PEOPLE, pending, x.c))
    : [];

  // 开门那张「今天的请求」卡：第一个时段、没别的层压着、今天还没看过才弹。
  const reqCardOpen = world.slot === 0 && !pending && !selected && !webOpen && !reqPanelOpen && !routesOpen && !weekendOpen
    && reqSeenDay !== world.day && askedToday(world).length > 0;
  // 陆遥这一时段公开盯上的人：开场就亮出来，点一下直接开她的卡。挡没挡住、记不记分都按引擎的判据念。
  const rivalWord = rivalPlanWord(world);
  const rivalMarks = rivalThreats(world).flatMap(id => {
    const person = PEOPLE.find(p => p.id === id && p.id in world.present);
    return person ? [person] : [];
  });
  const rivalShakeIds = new Set(rivalShakes(world));

  const booking = rivalBookingNow(world);
  const bookingPerson = booking && !booking.outcome && booking.person in world.present ? PEOPLE.find(p => p.id === booking.person) : undefined;
  const bookingBlock = rivalInviteBlock(world);
  const bookingWon = !!booking && world.qualities[`bought:${booking.person}`] === world.day;
  const weekend = currentWeekendOrder(world);
  const weekendPerson = weekend ? PEOPLE.find(p => p.id === weekend.person) : undefined;
  const showWeekend = !!weekendPerson && !booking?.weekend;
  return <div className={`app-screen world-app${rivalMarks.length > 1 ? " has-double-rival" : ""}`}>
    <header className="world-bar">
      <div className="world-bar-info">
        <div className="world-bar-summary">
          <b>第 {world.season} 季 · 第 {world.day} 天 · {SLOT_WORD[world.slot]} · {careerWord(world)}{world.festival ? ` · ${festivalName(festivalsFor(world.season), world.festival)}` : ""}</b>
          <div className="world-bar-score"><span className={lit.money ? "world-money is-hit" : "world-money"}>我方 {yuan(world.money)}</span><span className={`world-score${lit.score ? ` ${lit.score}` : ""}`}>{scoreBrief(world.rivalMoney)}</span></div>
        </div>
        <div className="world-bar-resources"><span>精力 {Math.round(world.energy)}</span><span>小样 {world.samples}</span></div>
      </div>
      <button className="world-mute" type="button" aria-label={muted ? "开声音" : "静音"} aria-pressed={muted}
        onClick={() => { const next = !muted; sfxMute(next); setMuted(next); }}>{muted ? "🔇" : "🔊"}</button>
      <button className="world-web-btn" type="button" aria-label="人情网" onClick={() => setWebOpen(true)}>人情网</button>
      <button className="world-next" type="button" onClick={nextTurn}>下一时段{world.slot === 3 ? <small>收工</small> : null}</button>
    </header>
    <GoalStrip world={world} lit={lit.goal || !!bump} bump={bump} onOpen={() => { sfx("tap"); setRoutesOpen(true); }} />
    <YearStrip world={world} />
    {rivalWord && rivalMarks.length > 0 && <section className="world-rival-plans" aria-label="陆遥的公开动作">
      {rivalMarks.length > 1 && <p className="world-rival-choice">同时盯上两位 · 精力 {Math.round(world.energy)} · 先顾谁？</p>}
      {rivalMarks.map(mark => {
        const held = rivalGuarded(world, mark.id);
        const counted = weekGuardedPeople(world).includes(mark.id);
        const shake = rivalShakeIds.has(mark.id);
        return <button key={mark.id} type="button" className={`world-rival-plan${held ? " is-guarded" : ""}${world.rivalPlan?.tactic === "compare" ? " is-compare" : ""}${shake ? " is-shake" : ""}`}
          onClick={() => tapPerson(mark.id)} aria-label={`${rivalWord.title}：${mark.name}。${held ? "已接住" : rivalWord.howTo}`}>
          <b>{held ? "✓ 已接住" : rivalMarks.length > 1 ? world.rivalPlan?.tactic === "compare" ? "比货" : "邀客" : rivalWord.title} · {mark.name}</b>
          <span>{held ? counted ? `本周已记过${ta(mark)}，不重复加` : "时段结束守客 +1" : rivalMarks.length > 1 ? world.rivalPlan?.tactic === "compare" ? "亲自对症成交" : "接待或托同事照看" : rivalWord.howTo.split("；")[0]}</span>
        </button>;
      })}
    </section>}

    {(bookingPerson || showWeekend) && <div className={`world-opportunities${bookingPerson && showWeekend ? " has-weekend" : ""}`}>
    {booking && bookingPerson && <button type="button" className="world-rival-booking"
      aria-label={bookingWon ? `已接下预约：${bookingPerson.name}` : `对面预约：${bookingPerson.name}，预计 ${yuan(booking.amount)}，本时段结束结账`}
      onClick={() => tapPerson(booking.person)}>
      <b>{bookingWon ? "✓ 预约接下" : booking.weekend ? "最后一单" : booking.invited ? "已邀来比货" : "对面预约"} · {bookingPerson.name}</b>
      <span>{bookingWon ? "已在你这边成交" : `${yuan(booking.amount)} · ${booking.invited ? "等你成交" : "可争取 ›"}`}</span>
    </button>}
    {showWeekend && weekend && weekendPerson && <button type="button" className="weekend-preview" aria-label={`周末约单：${weekendPerson.name}，第 ${weekend.due} 天晚高峰`}
      onClick={() => { setSelected(null); setWeekendOpen(true); }}>
      <b>{bookingPerson ? "周末约单 ›" : `周末约单 · ${weekendPerson.name}`}</b>
      <span>{weekend.outcome ? WEEKEND_RESULT[weekend.outcome] : weekend.prepared ? weekend.sponsor ? `${nameOf(weekend.sponsor)}已牵线` : "已确认时间" : `第 ${weekend.due} 天晚高峰`}</span>
    </button>}
    </div>}

    <div className="world-map-view" ref={viewRef}
      onPointerDown={onPanDown} onPointerMove={onPanMove} onPointerUp={onPanUp} onPointerCancel={onPanUp}
      onClickCapture={e => { if (drag.current.moved) { e.stopPropagation(); e.preventDefault(); drag.current.moved = false; } }}>
      <div className="world-map" ref={mapRef} style={{ transform: `translateX(${panX}px)` }}>
        <img className="wf-floor" src={asset("/assets/game/mall-floor.jpg")} alt="商场一层" draggable={false} />
        {Object.entries(ZONE_LABEL).filter(([zone]) => !(zone === "backroom" && backroomIds.length)).map(([zone, label]) =>
          <span key={zone} className="wf-zone" aria-hidden="true" style={{ left: `${label.x}%`, top: `${label.y}%` }}>{label.word}</span>)}
        {Object.keys(world.present).map((id, index) => {
          const p = PEOPLE.find(x => x.id === id);
          if (!p) return null;
          const spot = spots.get(id);
          if (!spot || inBackroomChip(world, id)) return null;
          const isTarget = pickTargets.includes(id);
          // 客人分新客与回头客：同事、对手、商场方不戴这一行（他们本来就不算客人）。
          const back = p.role === "customer" && isReturningGuest(world, id);
          const kind = p.role === "customer" ? guestKindWord(back) : "";
          return <button type="button" key={id} data-pid={id}
            className={`wf-actor${selected === id ? " is-sel" : ""}${isTarget ? " is-target" : ""}${lit.person === id ? " is-back-in" : ""}`}
            style={{ left: `${spot.x}%`, top: `${spot.y}%`, zIndex: 20 + Math.round(spot.y) } as CSSProperties}
            aria-label={`${pick ? "选" : "查看"}${p.name}${kind ? ` ${kind}` : ""}`}
            onClick={() => tapPerson(id)}>
            {quarreling.has(id) && <i className="wf-heat" aria-hidden="true" />}
            <span className={`wf-tag${tagShift[id]?.hide && selected !== id ? " is-tucked" : ""}`} style={tagShift[id] && !tagShift[id].hide ? { translate: `${tagShift[id].dx}px ${tagShift[id].dy}px` } : undefined}>{p.name}{kind && <i className={`wf-kind ${back ? "is-back" : "is-new"}`} aria-hidden="true">{kind}</i>}</span>
            <span className="wf-figure" style={{ animationDelay: `${(index % 7) * 0.37}s` }}>
              {CHIBI.has(id)
                ? <img className="wf-chibi" src={asset(`/assets/game/chibi/${id}.webp`)} alt="" aria-hidden="true" draggable={false} />
                : <span className="wf-token">{p.portrait ? <img src={p.portrait} alt="" aria-hidden="true" /> : <b aria-hidden="true">{p.name.slice(0, 1)}</b>}</span>}
            </span>
            <i className="wf-glow" aria-hidden="true" />
          </button>;
        })}
        {backroomIds.length > 0 && <div className="wf-backroom-wrap" style={{ left: `${BACKROOM_CHIP.x}%`, top: `${BACKROOM_CHIP.y}%` }}>
          <button type="button" data-pids={backroomIds.join(",")} className={`wf-backroom${backroomIds.some(id => pickTargets.includes(id)) ? " is-target" : ""}`}
            aria-expanded={backroomOpen} aria-label={`员工通道 · ${backroomIds.length} 位`}
            onClick={() => { sfx("tap"); setBackroomOpen(o => !o); }}>
            <span className="wb-faces" aria-hidden="true">{backroomIds.slice(0, 3).map(id => {
              const p = PEOPLE.find(x => x.id === id);
              return p?.portrait ? <img key={id} src={p.portrait} alt="" draggable={false} /> : <b key={id}>{nameOf(id).slice(0, 1)}</b>;
            })}</span>
            <span className="wb-word">员工通道<b>{backroomIds.length}</b></span>
          </button>
          {backroomOpen && <div className="wf-backroom-list" role="group" aria-label="员工通道里的人">
            {backroomIds.map(id => <button key={id} type="button" data-pid={id} className={pickTargets.includes(id) ? "is-target" : ""}
              aria-label={`${pick ? "选" : "查看"}${nameOf(id)}`} onClick={() => { setBackroomOpen(false); tapPerson(id); }}>{nameOf(id)}</button>)}
          </div>}
        </div>}
        {bubbles.map((x, bi) => {
          const anchor = x.entry.who!.map(id => spots.get(id)).find((s): s is Spot => !!s);
          if (!anchor) return null;
          return <span key={`${x.entry.day}-${x.entry.slot}-${x.i}`} className="wf-bubble"
            style={{ left: `${anchor.x}%`, top: `${anchor.y}%`, animationDelay: `${bi * 0.7}s` }}>{shorten(x.entry.text)}</span>;
        })}
      </div>
      {/* 这一层的三刻：成交 / 回头客 / 比分翻面。只贴一个标签，钱数与件数归引擎那行流水，这里不重复报数。 */}
      {topMoment && <p className={`world-moment wm-${topMoment.kind}`} role="status" aria-live="polite"
        >{momentWord(topMoment.kind, topMoment.who ? nameOf(topMoment.who) : undefined)}</p>}
    </div>

    <section className="world-scene" aria-label="现场">
      <h2>现场 · {guests.length} 位客人{newGuestWord(freshGuests)}
        {dueReqs.length > 0 && <button type="button" className="req-chip" aria-label="查看委托进度"
          onClick={() => setReqPanelOpen(true)}>委托 {dueReqs.filter(r => r.state === "done").length}/{dueReqs.length}</button>}
      </h2>
      <MobileScroll className="world-feed">
        {dayLogs.length === 0 && <p className="feed-empty">这个时段还没什么动静。点地图上的人，看看是谁、对你什么看法。</p>}
        {[...dayLogs].reverse().slice(0, 14).map((l, i) => <p key={`${l.day}-${l.slot}-${dayLogs.length - i}`}><small>{SLOT_WORD[l.slot]}</small>{l.text}</p>)}
      </MobileScroll>
    </section>

    {person && !serving && !receipt && <div className="world-drawer">
      {/* 抽屉盖住「现场」时在人物卡正文念结果，不遮住动作按钮。 */}
      <PersonCard person={person} world={world} people={PEOPLE} feedback={result}
        invitation={invitationFor(person)}
        booking={booking && bookingPerson?.id === person.id ? { amount: booking.amount, invited: booking.invited, won: bookingWon, blocked: bookingBlock, weekend: booking.weekend } : undefined}
        rival={rivalWord && rivalThreats(world).includes(person.id) ? { title: rivalWord.title, howTo: rivalWord.howTo, held: rivalGuarded(world, person.id) } : undefined}
        onClose={() => { setSelected(null); setServing(false); setPick(null); }} />
      {pick ? <div className="world-pick">
        <p>{pickHint(pick.verb, person)}</p>
        <div className="pick-targets">
          {pickTargets.map(id => <button key={id} type="button" onClick={() => tapPerson(id)}>{nameOf(id)}{id in world.present ? "" : " · 不在场"}</button>)}
          <button type="button" className="pick-cancel" onClick={() => setPick(null)}>算了</button>
        </div>
      </div> : <div className="world-verbs">
        {booking && bookingPerson?.id === person.id && !booking.invited && !bookingWon && <button type="button" disabled={!!bookingBlock}
          onClick={() => { const next = inviteRivalGuest(world, PEOPLE); setWorld(next); setResult(next.log.at(-1)?.text ?? null); }}>
          <b>邀来比货</b><small>6 精力 · 1 份小样</small>
        </button>}
        {midConsult && <button type="button" className="resume" onClick={() => openServe()}><b>接着谈</b><small>这一单的劲已经花过</small></button>}
        {verbRows.filter(row => !(midConsult && row.verb === "serve")).map(row => <button key={row.verb} type="button" disabled={!!row.reason}
          onClick={() => { if (row.reason) return; if (row.verb === "serve") openServe(); else apply({ verb: row.verb, targets: [person.id] }); }}>
          <b>{verbWord(row.verb, person)}</b><small>{row.reason ?? `${verbEnergyNow(world, row.verb)} 精力`}</small>
        </button>)}
        {pairVerbs.map(v => <button key={v} type="button" className="pair" onClick={() => setPick({ verb: v, calls: calls.filter(c => c.verb === v) })}><b>{verbWord(v, person)}</b><small>{verbEnergyNow(world, v)} 精力 · 再点一人</small></button>)}
        {!midConsult && bookingPerson?.id !== person.id && verbs.length + pairVerbs.length === 0 && <p className="verbs-empty">{verbsEmptyWord(person, world.energy < VERB_ENERGY.greet, world.present[person.id] === "rival")}</p>}
      </div>}
    </div>}

    {salePerson && consult && <ConsultPanel world={world} person={salePerson} consult={consult}
      companions={companionOptions(world, PEOPLE, consult)}
      onCompanion={helper => {
        const next = askCompanion(world, PEOPLE, consult, helper);
        if (next.world === world) return;
        setWorld(next.world); setConsults(m => ({ ...m, [consult.person]: next.consult })); sfx("tap");
      }}
      arrival={booking?.person === salePerson.id && booking.invited && !bookingWon
        ? { title: "这笔预约还在比较", line: "「我先比比看，还没决定买哪边。」本时段结束前成交才能接下。", scene: "" }
        : currentArrival(world, salePerson.id, PEOPLE)}
      onAct={consultAct} onCommit={doServe} onLeave={stopServe}
      onChange={patch => setConsults(m => ({ ...m, [salePerson.id]: { ...m[salePerson.id], ...patch } }))}
      onClose={() => { setServing(false); setSelected(null); }} />}
    {receipt && <SaleReceipt {...receipt} onClose={() => { setReceipt(null); setSelected(null); showOpeningStory(world); }} />}

    {reqCardOpen && <RequestsCard world={world} people={PEOPLE} onAnswer={answerRequest}
      onClose={() => setReqSeenDay(world.day)} />}
    {routesOpen && <RoutesSheet world={world} onClose={() => setRoutesOpen(false)}
      onHistory={() => { setRoutesOpen(false); setRivalArchive(true); setArchiveOpen(true); }} />}
    {archiveOpen && <WorldArchive initialTab="rival" currentRun={world.seed}
      onBack={() => { setArchiveOpen(false); setRivalArchive(false); }} />}
    {weekendOpen && weekendPerson && <WeekendOrderSheet world={world} person={weekendPerson} people={PEOPLE}
      onPrepare={sponsor => setWorld(prepareWeekendOrder(world, PEOPLE, sponsor))} onClose={() => setWeekendOpen(false)} />}
    {handoffTargets && <HandoffSheet world={world} people={PEOPLE} targets={handoffTargets}
      draftPaid={consults[handoffTargets[1]]?.begun ?? false}
      onConfirm={confirmHandoff} onClose={() => setHandoffTargets(null)} />}
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
      <div className="world-web-body"><WebView world={world} people={PEOPLE} invitationFor={invitationFor} /></div>
    </div>}

    {/* 委托卡/进度面板开着时引导先等着：同一屏只让一层东西说话。 */}
    {!pending && !reqCardOpen && !reqPanelOpen && !routesOpen && !weekendOpen && !archiveOpen && !serving && !receipt && <CoachLayer onServe={openServe} world={world} view={{ screen: "floor", webOpen, cardOpen: !!person, acted: world.energy < energyCeiling(world.slot) }} />}
  </div>;
}

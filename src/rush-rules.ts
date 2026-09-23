import type { CustomerId, ProductId } from "../dynamic-counter-prototype/src/campaign";

// Arcade points only. Campaign orders, prices and saves remain owned by campaign.ts.
export const RUSH_SECONDS = 90;
export const RUSH_SAVE_KEY = "last-order-rush-v1";
export const RUSH_BEST_KEY = "last-order-rush-best-v1";
export const WORLD = { width: 1000, height: 562.5 };
export type Point = { x: number; y: number };
export const STATIONS: Array<Point & { product: ProductId; key: string }> = [
  { product: "soft", key: "1", x: 255, y: 435 },
  { product: "glow", key: "2", x: 470, y: 325 },
  { product: "repair", key: "3", x: 560, y: 210 },
];
const SLOTS: Point[] = [{ x: 655, y: 290 }, { x: 675, y: 475 }, { x: 470, y: 505 }, { x: 875, y: 510 }];
const CAST: CustomerId[] = ["shen", "mei", "xiaoyu", "zhou", "zhao", "anjie", "duan"];
const PRODUCT_IDS: ProductId[] = ["soft", "repair", "glow"];
// The counter footprints are slightly expanded to keep characters' feet off the furniture.
export const OBSTACLES = [
  { left: 203, right: 405, top: 215, bottom: 396 },
  { left: 358, right: 492, top: 151, bottom: 278 },
  { left: 723, right: 966, top: 208, bottom: 458 },
];
export type Guest = Point & { id: number; who: CustomerId; product: ProductId; patience: number; maximum: number; slot: number };
export type Destination = { kind: "station"; product: ProductId } | { kind: "guest"; id: number } | { kind: "floor" };
export type RushState = {
  version: 1; phase: "ready" | "playing" | "paused" | "finished"; elapsed: number; seed: number;
  player: Point; path: Point[]; destination: Destination | null; carrying: ProductId | null;
  rival: Point; rivalTarget: number | null; rivalHold: number; stunned: number;
  guests: Guest[]; nextGuest: number; spawnIn: number;
  score: number; served: number; lost: number; mistakes: number; combo: number; bestCombo: number;
  fever: number; dash: number; cooldown: number; toast: string; toastLife: number; effect: number;
};
export type RushAction = { type: "tick"; dt: number; direction?: Point } | { type: "go"; point: Point; destination?: Destination }
  | { type: "interact" } | { type: "dash" } | { type: "pause" } | { type: "resume" } | { type: "start" } | { type: "restart"; seed?: number };
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const bounded = (p: Point): Point => ({ x: clamp(p.x, 100, 940), y: clamp(p.y, 192, 534) });
export function walkable(p: Point) {
  return p.x >= 100 && p.x <= 940 && p.y >= 192 && p.y <= 534 && !OBSTACLES.some(r => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom);
}
export function clearLine(a: Point, b: Point) {
  if (!walkable(a) || !walkable(b)) return false;
  // Exact segment/rectangle intersection: sampled lines can miss a corner and
  // leave a moving actor inside furniture, which also invalidates its save.
  for (const r of OBSTACLES) {
    let enter = 0, leave = 1, intersects = true;
    for (const [origin, delta, low, high] of [[a.x, b.x - a.x, r.left, r.right], [a.y, b.y - a.y, r.top, r.bottom]]) {
      if (Math.abs(delta) < 1e-9) {
        if (origin <= low || origin >= high) { intersects = false; break; }
      } else {
        const near = (low - origin) / delta, far = (high - origin) / delta;
        enter = Math.max(enter, Math.min(near, far)); leave = Math.min(leave, Math.max(near, far));
        if (enter >= leave) { intersects = false; break; }
      }
    }
    if (intersects && enter < leave) return false;
  }
  return true;
}
export function route(from: Point, to: Point): Point[] {
  to = bounded(to);
  if (!walkable(to)) return [];
  if (clearLine(from, to)) return [to];
  const corners = OBSTACLES.flatMap(r => [
    { x: r.left - 9, y: r.top - 9 }, { x: r.right + 9, y: r.top - 9 },
    { x: r.left - 9, y: r.bottom + 9 }, { x: r.right + 9, y: r.bottom + 9 },
  ]).filter(walkable);
  const nodes = [from, to, ...corners], costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), seen = new Set<number>();
  costs[0] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!seen.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) {
      const path: Point[] = [];
      for (let i = 1; i !== 0; i = previous[i]) path.unshift(nodes[i]);
      return path;
    }
    seen.add(current);
    for (let i = 0; i < nodes.length; i++) {
      if (seen.has(i) || !clearLine(nodes[current], nodes[i])) continue;
      const cost = costs[current] + distance(nodes[current], nodes[i]);
      if (cost < costs[i]) { costs[i] = cost; previous[i] = current; }
    }
  }
  return [];
}
function random(state: RushState) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}
function spawn(state: RushState) {
  const slot = SLOTS.findIndex((_, index) => !state.guests.some(guest => guest.slot === index));
  if (slot < 0) return;
  const who = CAST[state.nextGuest % CAST.length];
  const product = state.nextGuest === 0 ? "soft" : state.nextGuest === 1 ? "repair" : PRODUCT_IDS[Math.floor(random(state) * 3)];
  const maximum = state.elapsed < 12 ? 32 : state.elapsed >= 70 ? 18 : 24;
  state.guests.push({ ...SLOTS[slot], id: state.nextGuest++, who, product, patience: maximum, maximum, slot });
}
export function createRush(seed = Date.now()): RushState {
  const state: RushState = {
    version: 1, phase: "ready", elapsed: 0, seed: seed >>> 0,
    player: { x: 420, y: 454 }, path: [], destination: null, carrying: null,
    rival: { x: 915, y: 498 }, rivalTarget: null, rivalHold: 0, stunned: 0,
    guests: [], nextGuest: 0, spawnIn: 8, score: 0, served: 0, lost: 0, mistakes: 0,
    combo: 0, bestCombo: 0, fever: 0, dash: 0, cooldown: 0,
    toast: "先拿柔焦，再送给沈薇。", toastLife: 6, effect: 0,
  };
  spawn(state); spawn(state);
  return state;
}
function say(state: RushState, text: string) { state.toast = text; state.toastLife = 2.8; state.effect++; }
function deliver(state: RushState, guest: Guest) {
  if (!state.carrying) { say(state, "两手空空！先去取一件货。"); return; }
  if (state.carrying !== guest.product) {
    state.mistakes++; state.combo = 0; state.fever = 0;
    state.score = Math.max(0, state.score - 30);
    guest.patience = Math.max(1, guest.patience - 3);
    say(state, "“这不是我要的。” 换一件，再来！−30");
    return;
  }
  state.combo++; state.served++; state.bestCombo = Math.max(state.bestCombo, state.combo);
  const points = (100 + Math.ceil(guest.patience) * 2) * Math.min(3, 1 + Math.floor((state.combo - 1) / 3)) * (state.fever > 0 ? 2 : 1);
  state.score += points; state.carrying = null;
  state.guests = state.guests.filter(g => g.id !== guest.id);
  if (state.combo % 3 === 0) state.fever = 8;
  state.spawnIn = Math.min(state.spawnIn, 1.4);
  say(state, state.combo % 3 === 0 ? `连对 ${state.combo} 单！高光时刻 · 得分翻倍 +${points}` : `漂亮！${state.combo} 连单 +${points}`);
}
function interact(state: RushState, destination: Destination | null) {
  if (destination?.kind === "station") {
    const station = STATIONS.find(s => s.product === destination.product)!;
    if (distance(state.player, station) < 38) {
      state.carrying = station.product;
      say(state, "拿到了！点顾客送过去。");
    }
    return;
  }
  if (destination?.kind === "guest") {
    const guest = state.guests.find(g => g.id === destination.id);
    if (guest && distance(state.player, guest) < 40) deliver(state, guest);
    else if (!guest) say(state, "她已经离开了，接下一位！");
    return;
  }
  const nearbyGuest = state.guests.filter(g => distance(state.player, g) < 65).sort((a, b) => distance(state.player, a) - distance(state.player, b))[0];
  if (nearbyGuest) { deliver(state, nearbyGuest); return; }
  const station = STATIONS.find(s => distance(state.player, s) < 65);
  if (station) interact(state, { kind: "station", product: station.product });
  else say(state, "靠近货台或顾客，按 E 互动。");
}
function moveAlong(point: Point, path: Point[], travel: number): { point: Point; path: Point[] } {
  let result = { ...point };
  const remaining = [...path];
  while (remaining.length && travel > 0) {
    const goal = remaining[0], length = distance(result, goal);
    if (length <= travel) { result = goal; remaining.shift(); travel -= length; }
    else { result = { x: result.x + (goal.x - result.x) / length * travel, y: result.y + (goal.y - result.y) / length * travel }; travel = 0; }
  }
  return { point: result, path: remaining };
}
export function rushReducer(current: RushState, action: RushAction): RushState {
  if (action.type === "restart") return current.phase === "finished" || current.phase === "paused" ? createRush(action.seed) : current;
  if (action.type === "pause") return current.phase === "playing" ? { ...current, phase: "paused" } : current;
  if (action.type === "resume") return current.phase === "paused" ? { ...current, phase: "playing" } : current;
  if (action.type === "start") return current.phase === "ready" ? { ...current, phase: "playing" } : current;
  if (current.phase !== "playing") return current;
  const state = { ...current, player: { ...current.player }, rival: { ...current.rival }, guests: current.guests.map(g => ({ ...g })) };
  if (action.type === "go") {
    state.path = route(state.player, action.point); state.destination = state.path.length ? action.destination ?? { kind: "floor" } : null;
    if (!state.path.length) say(state, "那边是柜台，点旁边的通道。");
    return state;
  }
  if (action.type === "interact") { interact(state, null); return state; }
  if (action.type === "dash") {
    if (state.cooldown > 0) return current;
    state.dash = .55; state.cooldown = 3;
    if (distance(state.player, state.rival) < 150) { state.stunned = 3; state.rivalHold = 0; say(state, "“这位我来！” 陆遥愣住了 3 秒。"); }
    return state;
  }
  const dt = Math.min(.1, Math.max(0, Number.isFinite(action.dt) ? action.dt : 0), RUSH_SECONDS - state.elapsed);
  state.elapsed += dt;
  const speed = 165 * (state.dash > 0 ? 2.8 : state.fever > 0 ? 1.5 : 1);
  state.dash = Math.max(0, state.dash - dt); state.cooldown = Math.max(0, state.cooldown - dt);
  state.fever = Math.max(0, state.fever - dt); state.stunned = Math.max(0, state.stunned - dt); state.toastLife = Math.max(0, state.toastLife - dt);
  const direction = action.direction;
  if (direction && (direction.x || direction.y)) {
    state.path = []; state.destination = null;
    const length = Math.hypot(direction.x, direction.y), dx = direction.x / length * speed * dt, dy = direction.y / length * speed * dt;
    // Substeps prevent a dash from crossing a thin obstacle at a low frame rate.
    const steps = Math.ceil(speed * dt / 4);
    for (let i = 0; i < steps; i++) {
      const x = bounded({ x: state.player.x + dx / steps, y: state.player.y });
      if (walkable(x)) state.player = x;
      const y = bounded({ x: state.player.x, y: state.player.y + dy / steps });
      if (walkable(y)) state.player = y;
    }
  } else if (state.path.length) {
    const next = moveAlong(state.player, state.path, speed * dt);
    state.player = next.point; state.path = next.path;
    if (!state.path.length) { interact(state, state.destination); state.destination = null; }
  }
  for (const guest of state.guests) guest.patience -= dt;
  const expired = state.guests.filter(g => g.patience <= 0);
  if (expired.length) {
    state.lost += expired.length; state.combo = 0; state.fever = 0;
    state.guests = state.guests.filter(g => g.patience > 0);
    say(state, "等太久，她走了。连单中断。");
  }
  if (state.stunned === 0 && state.elapsed >= 10 && state.guests.length) {
    const target = state.guests.find(g => g.id === state.rivalTarget) ?? [...state.guests].sort((a, b) => a.patience - b.patience)[0];
    if (state.rivalTarget !== target.id) { state.rivalTarget = target.id; state.rivalHold = 0; }
    if (distance(state.rival, target) > 30) {
      const path = route(state.rival, target);
      state.rival = moveAlong(state.rival, path, (state.elapsed >= 70 ? 66 : 44) * dt).point;
    } else {
      state.rivalHold += dt;
      if (state.rivalHold >= 3.5) {
        state.guests = state.guests.filter(g => g.id !== target.id); state.lost++; state.combo = 0; state.fever = 0;
        state.rivalTarget = null; state.rivalHold = 0;
        say(state, "陆遥抢走一位！靠近她冲刺，可以打断。");
      }
    }
  } else if (!state.guests.length) { state.rivalTarget = null; state.rivalHold = 0; }
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) { spawn(state); state.spawnIn = state.elapsed >= 70 ? 3.6 : state.elapsed >= 30 ? 5.5 : 8; }
  if (current.elapsed < 30 && state.elapsed >= 30) say(state, "下班客涌入！同时照顾好几位。");
  if (current.elapsed < 70 && state.elapsed >= 70) say(state, "最后 20 秒！全场冲刺。");
  if (state.elapsed >= RUSH_SECONDS) { state.phase = "finished"; state.path = []; state.destination = null; }
  return state;
}

export function parseRush(raw: string | null): RushState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as RushState;
    if (!s || s.version !== 1 || !["ready", "playing", "paused", "finished"].includes(s.phase)) return null;
    const finite = (n: unknown, max: number) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
    for (const key of ["score", "served", "lost", "mistakes", "combo", "bestCombo", "nextGuest", "effect"] as const) if (!finite(s[key], 1_000_000) || !Number.isInteger(s[key])) return null;
    for (const key of ["elapsed", "spawnIn", "fever", "dash", "cooldown", "stunned", "rivalHold", "toastLife"] as const) if (!finite(s[key], 90)) return null;
    if (!finite(s.seed, 4294967295) || !Number.isInteger(s.seed) || s.elapsed > RUSH_SECONDS || typeof s.toast !== "string" || s.toast.length > 200) return null;
    const point = (p: Point) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && walkable(p);
    if (!point(s.player) || !point(s.rival) || !Array.isArray(s.path) || s.path.length > 20 || !s.path.every(point)) return null;
    if (s.carrying !== null && !PRODUCT_IDS.includes(s.carrying)) return null;
    if (!Array.isArray(s.guests) || s.guests.length > 4) return null;
    if (!s.guests.every(g => point(g) && Number.isInteger(g.id) && g.id >= 0 && g.id < s.nextGuest && CAST.includes(g.who) && PRODUCT_IDS.includes(g.product) && finite(g.patience, 32) && finite(g.maximum, 32) && g.maximum > 0 && g.patience <= g.maximum && Number.isInteger(g.slot) && g.slot >= 0 && g.slot < 4 && distance(g, SLOTS[g.slot]) < .01)) return null;
    if (new Set(s.guests.map(g => g.id)).size !== s.guests.length || new Set(s.guests.map(g => g.slot)).size !== s.guests.length) return null;
    if (s.rivalTarget !== null && (!Number.isInteger(s.rivalTarget) || s.rivalTarget < 0)) return null;
    const d = s.destination;
    if (d !== null && (!d || !(d.kind === "floor" || d.kind === "station" && PRODUCT_IDS.includes(d.product) || d.kind === "guest" && Number.isInteger(d.id) && d.id >= 0))) return null;
    // Restored routes are recalculated by the next click. Reloading always pauses.
    return { ...s, path: [], destination: null, phase: s.elapsed >= RUSH_SECONDS ? "finished" : s.phase === "playing" ? "paused" : s.phase };
  } catch { return null; }
}

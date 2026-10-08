// 人情场无界面模拟器：四种玩法风格 × N 个种子 × 28 天 × 可选多季，量"结果有多少种"。
// 跑法：node --experimental-strip-types tests/world-sim.ts [种子数，默认 16] [季数，默认 1]
// 季数 ≥2 时第 2 季起用 nextSeason 接着上一季的世界跑，并报告相对上一季谁倒戈了。
// 内容目录 src/world/content/ 存在时吃正式内容（导出 PEOPLE/STORYLETS 或 people/storylets），否则用测试夹具。
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drawIndex } from "../src/world/rng.ts";
import {
  ambient, applyChoice, beginSlot, bestFit, choiceVisible, doVerb, drawStorylet, endDay,
  newWorld, nextSeason, seasonSummary, verbOptions, type VerbArgs, type VerbCall,
} from "../src/world/engine.ts";
import { rank, seasonEnding } from "../src/world/ending.ts";
import { EXCHANGE_ACTS, exchangeTally } from "../src/world/exchanges.ts";
import { INSTANT_KINDS, resolveRequestChoice } from "../src/world/requests.ts";
import type { Festival, Person, PersonId, RequestState, Slot, Storylet, World } from "../src/world/types.ts";
import { PRODUCTS, type ProductId } from "../src/campaign.ts";
import { FIXTURE_PEOPLE, FIXTURE_STORYLETS } from "./fixtures/world-fixture.ts";

type Style = "honest" | "pushy" | "social" | "random";
const STYLES: Style[] = ["honest", "pushy", "social", "random"];
const DAYS = 28;
const ACTIONS_PER_SLOT = 5;
const PRODUCT_IDS: ProductId[] = ["soft", "glow", "repair"];
const PRICE_DESC = [...PRODUCT_IDS].sort((a, b) => PRODUCTS[b].price - PRODUCTS[a].price);

const personOf = (people: Person[], id: PersonId) => people.find(p => p.id === id)!;

/** 从世界自己的种子抽一次 —— 模拟器的决定也走 rngCalls，同样确定。 */
const simDraw = (w: World): [number, World] => {
  const v = w.rngCalls;
  return [drawIndex(w.seed, v, 1_000_000) / 1_000_000, { ...w, rngCalls: v + 1 }];
};
const simIndex = (w: World, n: number): [number, World] => {
  const i = drawIndex(w.seed, w.rngCalls, n);
  return [i, { ...w, rngCalls: w.rngCalls + 1 }];
};

/** 各风格在 verbOptions 里挑下一个动作。返回 null = 这个时段收手。 */
function pickAction(style: Style, w: World, people: Person[]): [{ call: VerbCall; args?: VerbArgs } | null, World] {
  const options = verbOptions(w, people);
  const first = (verb: VerbCall["verb"], pred?: (c: VerbCall) => boolean) =>
    options.find(c => c.verb === verb && (!pred || pred(c)));
  const untouched = (c: VerbCall) => !w.touched.includes(c.targets[0]);
  switch (style) {
    case "honest": {
      const serve = first("serve", untouched);
      if (serve) {
        const p = personOf(people, serve.targets[0]);
        return [{ call: serve, args: { product: bestFit(p), units: p.skin!.maxUnits } }, w];
      }
      for (const verb of ["keep", "mediate", "greet", "wechat", "sample", "help"] as const) {
        const c = first(verb, untouched);
        if (c) return [{ call: c }, w];
      }
      return [null, w];
    }
    case "pushy": {
      const serve = first("serve", untouched);
      if (serve) {
        const p = personOf(people, serve.targets[0]);
        return [{ call: serve, args: { product: bestFit(p), units: p.skin!.maxUnits, force: true } }, w];
      }
      return [null, w];
    }
    case "social": {
      // 先经营关系网（劝和、帮同事、牵线），再把客人托给肯开单的同事。
      // 托单放在前面的话，客人一多五次动作全花在托单上，人情动作一次都轮不到。
      for (const verb of ["mediate", "help", "introduce"] as const) {
        const c = first(verb, untouched);
        if (c) return [{ call: c }, w];
      }
      const sale = options.find(c => c.verb === "handoff" && personOf(people, c.targets[1]).skin);
      if (sale) return [{ call: sale }, w];
      for (const verb of ["keep", "tell", "wechat", "sample", "greet"] as const) {
        const c = first(verb, untouched);
        if (c) return [{ call: c }, w];
      }
      return [null, w];
    }
    case "random": {
      if (!options.length) return [null, w];
      let i: number; [i, w] = simIndex(w, options.length);
      const call = options[i];
      if (call.verb === "serve") {
        let p: number; [p, w] = simIndex(w, PRODUCT_IDS.length);
        let u: number; [u, w] = simIndex(w, 4);
        let f: number; [f, w] = simDraw(w);
        return [{ call, args: { product: PRODUCT_IDS[p], units: u + 1, force: f < 0.5 } }, w];
      }
      return [{ call }, w];
    }
  }
}

/** 当场可答的委托（唐可借小样）各风格怎么选：老实做人和经营关系的都借，硬推的舍不得。 */
function answerRequests(style: Style, w: World, people: Person[]): World {
  for (const req of w.requests.filter(r => r.state === "open" && INSTANT_KINDS.includes(r.kind))) {
    if (style === "pushy") w = resolveRequestChoice(w, people, req.id, false);
    else if (style === "random") { let x: number; [x, w] = simDraw(w); w = resolveRequestChoice(w, people, req.id, x < 0.5); }
    else w = resolveRequestChoice(w, people, req.id, w.samples >= (req.n ?? 1));
  }
  return w;
}

function takeTurns(style: Style, w: World, people: Person[]): World {
  for (let n = 0; n < ACTIONS_PER_SLOT; n++) {
    let action: { call: VerbCall; args?: VerbArgs } | null;
    [action, w] = pickAction(style, w, people);
    if (!action) break;
    const before = w;
    w = doVerb(w, people, action.call.verb, action.call.targets, action.args ?? {});
    if (w === before) break; // 动作没生效（精力不够之类）就收手
  }
  return w;
}

/** 每种风格下每张卡被抽到的次数（跨种子、跨季累计），用来找"写了却永远出不来"的卡。 */
const fireCount = new Map<Style, Map<string, number>>();

function playSeason(style: Style, w: World, people: Person[], storylets: Storylet[], festivals: Festival[]): World {
  while (w.day <= DAYS) {
    for (let s = 0; s < 4; s++) {
      w = { ...w, slot: s as Slot };
      w = beginSlot(w, people, festivals);
      w = answerRequests(style, w, people); // 开门提的当场类委托，先答了再抽卡做动作
      const { world: w2, drawn } = drawStorylet(w, people, storylets);
      w = w2;
      if (drawn) {
        const counts = fireCount.get(style) ?? new Map<string, number>();
        counts.set(drawn.storylet.id, (counts.get(drawn.storylet.id) ?? 0) + 1);
        fireCount.set(style, counts);
        const visibleIdx = drawn.storylet.choices.map((c, i) => i)
          .filter(i => choiceVisible(w, people, drawn, drawn.storylet.choices[i]));
        let k: number; [k, w] = simIndex(w, Math.max(1, visibleIdx.length));
        w = applyChoice(w, people, drawn, visibleIdx[k] ?? 0);
      }
      w = takeTurns(style, w, people);
      w = ambient(w, people); // 时段末：传话、陆遥带走没顾上的人（与界面同一个顺序）
    }
    w = endDay(w, people);
  }
  return w;
}

// —— 内容加载 ——

type FestivalsFor = (season: number) => Festival[];

async function loadContent(): Promise<{ people: Person[]; storylets: Storylet[]; festivalsFor: FestivalsFor; source: string }> {
  const url = new URL("../src/world/content/index.ts", import.meta.url);
  if (existsSync(fileURLToPath(url))) {
    const mod = await import(url.href) as Record<string, unknown>;
    const people = (mod.PEOPLE ?? mod.people ?? (mod.default as { people?: Person[] })?.people) as Person[] | undefined;
    const storylets = (mod.STORYLETS ?? mod.storylets ?? (mod.default as { storylets?: Storylet[] })?.storylets) as Storylet[] | undefined;
    const flat = mod.FESTIVALS as Festival[] | undefined;
    const festivalsFor = (mod.festivalsFor as FestivalsFor | undefined) ?? (flat ? () => flat : () => []);
    if (people?.length && storylets?.length) return { people, storylets, festivalsFor, source: "src/world/content" };
  }
  return { people: FIXTURE_PEOPLE, storylets: FIXTURE_STORYLETS, festivalsFor: () => [], source: "tests/fixtures/world-fixture.ts" };
}

// —— 统计 ——

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const dist = (xs: number[]) =>
  `min ${Math.min(...xs)} / med ${median(xs)} / max ${Math.max(...xs)}`;

const { people, storylets, festivalsFor, source } = await loadContent();
const N = Math.max(1, Number(process.argv[2]) || 16);
const SEASON_COUNT = Math.max(1, Number(process.argv[3]) || 1);
console.log(`== 人情场模拟 · 内容来源 ${source} · ${people.length} 人 · ${storylets.length} 张卡 ==`);
console.log(`== ${N} 个种子 × ${DAYS} 天${SEASON_COUNT > 1 ? ` × ${SEASON_COUNT} 季` : ""} × ${STYLES.length} 种风格 ==\n`);

type Result = {
  style: Style; seed: string; money: number; standing: number; compliance: number;
  signature: string; ending: string; arcs: Record<PersonId, Record<string, number>>;
};
type Flip = { style: Style; seed: string; allyToEnemy: PersonId[]; enemyToAlly: PersonId[] };
const resultOf = (style: Style, seed: string, w: World): Result => {
  const s = seasonSummary(w, people);
  const ending = seasonEnding(w, people);
  return {
    style, seed, money: w.money, standing: w.standing, compliance: w.compliance,
    signature: `盟友[${[...s.allies].sort().join(",")}] 仇人[${[...s.enemies].sort().join(",")}]`,
    ending: ending.id, arcs: s.arcs,
  };
};
const results: Result[] = [];
/** 自主社交动作的发生次数：每跑完一季记一行（exn: 计数换季自动清零，一行就是一季）。 */
const exTallies: Array<{ style: Style; tally: Record<string, number> }> = [];
/** 委托结算：每季一行（状态 -> 次数），再加每模板的明细。 */
const reqTallies: Array<{ style: Style; tally: Record<RequestState, number>; byKind: Record<string, Record<RequestState, number>> }> = [];
const tallyRequests = (w: World): { tally: Record<RequestState, number>; byKind: Record<string, Record<RequestState, number>> } => {
  const tally = { open: 0, done: 0, failed: 0, declined: 0, void: 0 } as Record<RequestState, number>;
  const byKind: Record<string, Record<RequestState, number>> = {};
  for (const r of w.requests) {
    tally[r.state]++;
    (byKind[r.kind] ??= { open: 0, done: 0, failed: 0, declined: 0, void: 0 })[r.state]++;
  }
  return { tally, byKind };
};
/** 第 2 季起每季一格：结局与"相对上一季谁倒戈了"。 */
const later: Array<{ season: number; results: Result[]; flips: Flip[] }> = [];
for (const style of STYLES) {
  for (let i = 0; i < N; i++) {
    const seed = `sim-${i}`;
    let w = playSeason(style, newWorld(seed, people), people, storylets, festivalsFor(1));
    exTallies.push({ style, tally: exchangeTally(w) });
    reqTallies.push({ style, ...tallyRequests(w) });
    let s = seasonSummary(w, people);
    results.push(resultOf(style, seed, w));
    for (let k = 2; k <= SEASON_COUNT; k++) {
      w = playSeason(style, nextSeason(w, people), people, storylets, festivalsFor(k));
      exTallies.push({ style, tally: exchangeTally(w) });
      reqTallies.push({ style, ...tallyRequests(w) });
      const next = seasonSummary(w, people);
      const bag = (later[k - 2] ??= { season: k, results: [], flips: [] });
      bag.results.push(resultOf(style, seed, w));
      bag.flips.push({
        style, seed,
        allyToEnemy: s.allies.filter(id => next.enemies.includes(id)),
        enemyToAlly: s.enemies.filter(id => next.allies.includes(id)),
      });
      s = next;
    }
  }
}

console.log("风格      不同签名数   钱 (min/med/max)              柜位 (min/med/max)   台账 (min/med/max)");
for (const style of STYLES) {
  const rs = results.filter(r => r.style === style);
  const signatures = new Set(rs.map(r => r.signature));
  console.log(`${style.padEnd(9)} ${String(signatures.size).padStart(4)}/${N}    ${dist(rs.map(r => r.money)).padEnd(30)} ${dist(rs.map(r => r.standing)).padEnd(22)} ${dist(rs.map(r => r.compliance))}`);
}

const ended = (r: Result, id: PersonId) => (r.arcs[id]?.end ?? 0) >= 1;
console.log("\n结局分布（rank 越小越好）:");
for (const style of STYLES) {
  const rs = results.filter(r => r.style === style);
  const counts = new Map<string, number>();
  for (const r of rs) counts.set(r.ending, (counts.get(r.ending) ?? 0) + 1);
  const line = [...counts.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1])
    .map(([id, n]) => `${id}(r${rank(id)})×${n}`)
    .join(" · ");
  console.log(`  ${style.padEnd(8)} ${line}`);
}

console.log("\n个人线走到终点（end≥1）:");
for (const id of ["shen", "anjie", "luyao", "suman"] as const) {
  const bits = STYLES.map(style => {
    const rs = results.filter(r => r.style === style);
    const n = rs.filter(r => ended(r, id)).length;
    return `${style} ${n}/${N}`;
  });
  console.log(`  ${id.padEnd(8)} ${bits.join(" · ")}`);
}

// 每个种子里结局更好的风格是谁（rank 越小越好）；并列都算赢。
const wins: Record<Style, number> = { honest: 0, pushy: 0, social: 0, random: 0 };
for (let i = 0; i < N; i++) {
  const seed = `sim-${i}`;
  const mine = results.filter(r => r.seed === seed);
  const best = Math.min(...mine.map(r => rank(r.ending)));
  for (const r of mine.filter(r => rank(r.ending) === best)) wins[r.style]++;
}
const dominant = STYLES.filter(s => wins[s] === N);
console.log(`\n按种子算账（结局更好者赢，并列都算）: ${STYLES.map(s => `${s} ${wins[s]}/${N}`).join(" · ")}`);
console.log(dominant.length
  ? `⚠ ${dominant.join(",")} 在所有种子上都最优 —— 规则可能写坏了`
  : `没有哪种风格在所有种子上都最优`);

// 每日委托：每种风格说到做到的比例（作废与还没到期的不算进分母）。
console.log("\n每日委托（done / 已结算，未到期与作废不计）:");
for (const style of STYLES) {
  const rows = reqTallies.filter(r => r.style === style);
  const sum = (pick: (t: (typeof rows)[number]["tally"]) => number) => rows.reduce((a, r) => a + pick(r.tally), 0);
  const done = sum(t => t.done), failed = sum(t => t.failed), declined = sum(t => t.declined);
  const open = sum(t => t.open), vd = sum(t => t.void);
  const settled = done + failed + declined;
  console.log(`  ${style.padEnd(8)} ${settled ? `${Math.round(done * 100 / settled)}%` : "-"}`
    + `（done ${done} · failed ${failed} · declined ${declined} · 未到期 ${open} · 作废 ${vd}）`);
}
const REQ_KINDS = ["quota", "keep", "samples", "pair", "clean", "rebook"] as const;
console.log("  分模板（各风格 done/已结算）:");
for (const kind of REQ_KINDS) {
  const bits = STYLES.map(style => {
    const rows = reqTallies.filter(r => r.style === style).map(r => r.byKind[kind]).filter(Boolean);
    const sum = (s: RequestState) => rows.reduce((a, t) => a + (t?.[s] ?? 0), 0);
    const settled = sum("done") + sum("failed") + sum("declined");
    return `${style} ${settled ? `${Math.round(sum("done") * 100 / settled)}%(${sum("done")}/${settled})` : "-"}`;
  });
  console.log(`    ${kind.padEnd(8)} ${bits.join(" · ")}`);
}

// 自主社交动作：每种动作一季平均发生几次（跨种子、跨季平均）。
console.log("\n自主社交（每种动作一季平均几次）:");
for (const act of EXCHANGE_ACTS) {
  const bits = STYLES.map(style => {
    const xs = exTallies.filter(r => r.style === style).map(r => r.tally[act] ?? 0);
    const avg = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    return `${style} ${avg.toFixed(1)}`;
  });
  console.log(`  ${act.padEnd(8)} ${bits.join(" · ")}`);
}

// 每条个人线的落点分布（跨风格合计）。
const arcTable = new Map<PersonId, Map<string, number>>();
for (const r of results) {
  for (const p of people) {
    const arc = r.arcs[p.id];
    const key = arc && Object.keys(arc).length
      ? Object.entries(arc).map(([k, v]) => `${k}=${v}`).join(",") : "（未触发）";
    if (!arcTable.has(p.id)) arcTable.set(p.id, new Map());
    const row = arcTable.get(p.id)!;
    row.set(key, (row.get(key) ?? 0) + 1);
  }
}
console.log("\n每条个人线的落点分布（全风格合计）:");
for (const p of people) {
  const row = arcTable.get(p.id)!;
  console.log(`  ${p.id.padEnd(8)} ${[...row.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(" · ")}`);
}

// 第 2 季起：接着上一季的世界再跑一季，报结局分布和"谁倒戈了"。
for (const { season, results: rs2, flips } of later) {
  console.log(`\n== 第 ${season} 季（接着上一季的世界再跑 ${DAYS} 天）==`);
  console.log("风格      不同签名数   钱 (min/med/max)              柜位 (min/med/max)   台账 (min/med/max)");
  for (const style of STYLES) {
    const rs = rs2.filter(r => r.style === style);
    const signatures = new Set(rs.map(r => r.signature));
    console.log(`${style.padEnd(9)} ${String(signatures.size).padStart(4)}/${N}    ${dist(rs.map(r => r.money)).padEnd(30)} ${dist(rs.map(r => r.standing)).padEnd(22)} ${dist(rs.map(r => r.compliance))}`);
  }
  console.log("结局分布（rank 越小越好）:");
  for (const style of STYLES) {
    const rs = rs2.filter(r => r.style === style);
    const counts = new Map<string, number>();
    for (const r of rs) counts.set(r.ending, (counts.get(r.ending) ?? 0) + 1);
    const line = [...counts.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1])
      .map(([id, n]) => `${id}(r${rank(id)})×${n}`)
      .join(" · ");
    console.log(`  ${style.padEnd(8)} ${line}`);
  }
  console.log("倒戈（相对上一季盘点）:");
  for (const style of STYLES) {
    const fs = flips.filter(f => f.style === style);
    const tally = (key: "allyToEnemy" | "enemyToAlly") => {
      const ids = fs.flatMap(f => f[key]);
      const c = new Map<PersonId, number>();
      for (const id of ids) c.set(id, (c.get(id) ?? 0) + 1);
      const names = [...c.entries()].map(([id, n]) => (n > 1 ? `${id}×${n}` : id)).join(", ");
      return `${ids.length} 人次 / ${fs.filter(f => f[key].length).length} 个种子${names ? `（${names}）` : ""}`;
    };
    console.log(`  ${style.padEnd(8)} 盟友→仇人 ${tally("allyToEnemy")} · 仇人→盟友 ${tally("enemyToAlly")}`);
  }
  console.log("个人线走到终点（end≥1）:");
  for (const id of ["tangke", "roman", "fangmin", "qiaowan"] as const) {
    const bits = STYLES.map(style => {
      const rs = rs2.filter(r => r.style === style);
      const n = rs.filter(r => (r.arcs[id]?.end ?? 0) >= 1).length;
      return `${style} ${n}/${N}`;
    });
    const all = rs2.filter(r => (r.arcs[id]?.end ?? 0) >= 1).length;
    const ends = [1, 2, 3, 4].map(n => `end=${n} ${rs2.filter(r => r.arcs[id]?.end === n).length}`).join(" ");
    console.log(`  ${id.padEnd(8)} ${bits.join(" · ")} · 合计 ${all}/${rs2.length} · ${ends}`);
  }
  console.log("第 2 季新结局:");
  for (const id of ["names-stay", "own-sentence", "file-and-sheet"]) {
    const hits = rs2.filter(r => r.ending === id);
    const styles = STYLES.filter(style => hits.some(r => r.style === style));
    console.log(`  ${id.padEnd(16)} ${hits.length}/${rs2.length}（${styles.join(", ") || "无"}）`);
  }
}

// 卡的覆盖面：每种风格抽到过几张；所有风格合起来都没抽到过的卡单独列出来 —— 写了却出不来，要么条件写死，要么引擎没接上。
console.log("\n故事碎片覆盖（抽到过的张数 / 总张数）:");
for (const style of STYLES) console.log(`  ${style.padEnd(8)} ${fireCount.get(style)?.size ?? 0}/${storylets.length}`);
const everFired = new Set(STYLES.flatMap(style => [...(fireCount.get(style)?.keys() ?? [])]));
const never = storylets.filter(s => !everFired.has(s.id));
console.log(never.length ? `  从没出现过 ${never.length} 张：${never.map(s => s.id).join(" ")}` : "  每张卡都至少出现过一次");

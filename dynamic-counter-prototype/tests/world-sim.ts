// 人情场无界面模拟器：四种玩法风格 × N 个种子 × 28 天，量"结果有多少种"。
// 跑法：node --experimental-strip-types tests/world-sim.ts [种子数，默认 16]
// 内容目录 src/world/content/ 存在时吃正式内容（导出 PEOPLE/STORYLETS 或 people/storylets），否则用测试夹具。
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drawIndex } from "../src/world/rng.ts";
import {
  ambient, applyChoice, beginSlot, bestFit, choiceVisible, doVerb, drawStorylet, endDay,
  newWorld, seasonSummary, verbOptions, type VerbArgs, type VerbCall,
} from "../src/world/engine.ts";
import type { Festival, Person, PersonId, Slot, Storylet, World } from "../src/world/types.ts";
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
      // 优先能把关系变成钱的：同事肯开单就先托她；再经营关系网。
      const sale = options.find(c => c.verb === "handoff" && personOf(people, c.targets[1]).skin);
      if (sale) return [{ call: sale }, w];
      for (const verb of ["mediate", "keep", "tell", "help", "introduce", "wechat", "sample", "greet"] as const) {
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

/** 每种风格下每张卡被抽到的次数（跨种子累计），用来找"写了却永远出不来"的卡。 */
const fireCount = new Map<Style, Map<string, number>>();

function playSeason(style: Style, seed: string, people: Person[], storylets: Storylet[], festivals: Festival[]): World {
  let w = newWorld(seed, people);
  while (w.day <= DAYS) {
    for (let s = 0; s < 4; s++) {
      w = { ...w, slot: s as Slot };
      w = beginSlot(w, people, festivals);
      w = ambient(w, people);
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
    }
    w = endDay(w, people);
  }
  return w;
}

// —— 内容加载 ——

async function loadContent(): Promise<{ people: Person[]; storylets: Storylet[]; festivals: Festival[]; source: string }> {
  const url = new URL("../src/world/content/index.ts", import.meta.url);
  if (existsSync(fileURLToPath(url))) {
    const mod = await import(url.href) as Record<string, unknown>;
    const people = (mod.PEOPLE ?? mod.people ?? (mod.default as { people?: Person[] })?.people) as Person[] | undefined;
    const storylets = (mod.STORYLETS ?? mod.storylets ?? (mod.default as { storylets?: Storylet[] })?.storylets) as Storylet[] | undefined;
    const festivals = (mod.FESTIVALS ?? []) as Festival[];
    if (people?.length && storylets?.length) return { people, storylets, festivals, source: "src/world/content" };
  }
  return { people: FIXTURE_PEOPLE, storylets: FIXTURE_STORYLETS, festivals: [], source: "tests/fixtures/world-fixture.ts" };
}

// —— 统计 ——

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const dist = (xs: number[]) =>
  `min ${Math.min(...xs)} / med ${median(xs)} / max ${Math.max(...xs)}`;

const { people, storylets, festivals, source } = await loadContent();
const N = Math.max(1, Number(process.argv[2]) || 16);
console.log(`== 人情场模拟 · 内容来源 ${source} · ${people.length} 人 · ${storylets.length} 张卡 ==`);
console.log(`== ${N} 个种子 × ${DAYS} 天 × ${STYLES.length} 种风格 ==\n`);

type Result = { style: Style; seed: string; money: number; standing: number; compliance: number; signature: string; arcs: Record<PersonId, Record<string, number>> };
const results: Result[] = [];
for (const style of STYLES) {
  for (let i = 0; i < N; i++) {
    const seed = `sim-${i}`;
    const w = playSeason(style, seed, people, storylets, festivals);
    const s = seasonSummary(w, people);
    results.push({
      style, seed, money: w.money, standing: w.standing, compliance: w.compliance,
      signature: `盟友[${[...s.allies].sort().join(",")}] 仇人[${[...s.enemies].sort().join(",")}]`,
      arcs: s.arcs,
    });
  }
}

console.log("风格      不同签名数   钱 (min/med/max)              柜位 (min/med/max)   台账 (min/med/max)");
for (const style of STYLES) {
  const rs = results.filter(r => r.style === style);
  const signatures = new Set(rs.map(r => r.signature));
  console.log(`${style.padEnd(9)} ${String(signatures.size).padStart(4)}/${N}    ${dist(rs.map(r => r.money)).padEnd(30)} ${dist(rs.map(r => r.standing)).padEnd(22)} ${dist(rs.map(r => r.compliance))}`);
}

// 每个种子里钱最多的风格是谁；有没有一种风格横扫全部种子。
const wins: Record<Style, number> = { honest: 0, pushy: 0, social: 0, random: 0 };
for (let i = 0; i < N; i++) {
  const seed = `sim-${i}`;
  const mine = results.filter(r => r.seed === seed);
  const best = Math.max(...mine.map(r => r.money));
  for (const r of mine.filter(r => r.money === best)) wins[r.style]++;
}
const dominant = STYLES.filter(s => wins[s] === N);
console.log(`\n按种子算账（并列都算赢）: ${STYLES.map(s => `${s} ${wins[s]}/${N}`).join(" · ")}`);
console.log(dominant.length
  ? `⚠ ${dominant.join(",")} 在所有种子上都最优 —— 规则可能写坏了`
  : `没有哪种风格在所有种子上都最优`);

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

// 卡的覆盖面：每种风格抽到过几张；所有风格合起来都没抽到过的卡单独列出来 —— 写了却出不来，要么条件写死，要么引擎没接上。
console.log("\n故事碎片覆盖（抽到过的张数 / 总张数）:");
for (const style of STYLES) console.log(`  ${style.padEnd(8)} ${fireCount.get(style)?.size ?? 0}/${storylets.length}`);
const everFired = new Set(STYLES.flatMap(style => [...(fireCount.get(style)?.keys() ?? [])]));
const never = storylets.filter(s => !everFired.has(s.id));
console.log(never.length ? `  从没出现过 ${never.length} 张：${never.map(s => s.id).join(" ")}` : "  每张卡都至少出现过一次");

// 同条件对照：同一批客人、同一支先点头的货、同一个换支选择，旧规则与「换支有代价」规则的成交后看法。
// 这是一次性测量脚本，不是游戏规则；跑法：
//   node --experimental-strip-types tests/second-try-choice-probe.ts
// 旧版对照：在 HEAD 的临时 worktree 里跑同一个文件（见 audit/second-try-2026-10-20/README.md）。
import { beginServe, newWorld, settleServe, VERB_ENERGY } from "../src/world/engine.ts";
import { openConsult, tryOn } from "../src/world/consult.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { SHELF, SHELF_IDS, TAG_WORD, affordableUnits, fitOfPerson, isPerfectMatch, shelfFitTier, type ShelfId } from "../src/world/shelf.ts";
import { visitPerson } from "../src/world/visits.ts";
import type { Consult } from "../src/world/consult.ts";
import type { Person, World } from "../src/world/types.ts";

const skinned = PEOPLE.filter(p => p.skin);
const atCounter = (id: string): World => ({ ...newWorld(`choice-${id}`, PEOPLE), day: 2, slot: 1, energy: 20,
  present: { [id]: "counter" }, opinion: { [id]: 0 } });
const affordable = (p: Person, id: ShelfId) => !!p.skin && affordableUnits(p, id) >= 1;
const tierOf = (p: Person, id: ShelfId) => shelfFitTier(fitOfPerson(p, id));
const positiveButNotPerfect = (p: Person, id: ShelfId) => affordable(p, id) && tierOf(p, id) === "positive" && !isPerfectMatch(p, id);
const rank = (p: Person, id: ShelfId) => {
  const t = tierOf(p, id);
  return t === "positive" && isPerfectMatch(p, id) ? 4 : t === "positive" ? 3 : t === "mixed" ? 2 : 1;
};

/** 有限信息：只看她主动说出的需求、今天的重点、货架 tag 与价格；不读适配分。 */
const tagTraits = (id: ShelfId): Set<string> => {
  const out = new Set<string>();
  for (const word of SHELF[id].tag.split("·")) if (TAG_WORD[word]) out.add(TAG_WORD[word]!);
  return out;
};
function publicRank(p: Person, c: Consult): ShelfId[] {
  const budget = p.skin?.budget ?? 0;
  return SHELF_IDS
    .filter(id => SHELF[id].price <= budget)
    .map(id => {
      const tags = tagTraits(id);
      const cover = c.known.filter(t => tags.has(t)).length;
      let score = cover * 100;
      if (c.known.length && cover === 0) score -= 40;
      if (c.focusKnown && c.focus) score += tags.has(c.focus) ? 50 : -80;
      score += tags.size;
      return { id, score, price: SHELF[id].price };
    })
    .sort((a, b) => b.score - a.score || a.price - b.price || SHELF_IDS.indexOf(a.id) - SHELF_IDS.indexOf(b.id))
    .map(x => x.id);
}

type Row = { id: string; name: string; first: ShelfId; alt: ShelfId; altTier: string; close: number; retry: number; delta: number; perfectUpside: boolean };
const fullRows: Row[] = [];
const finiteRows: Row[] = [];
let finitePerfectFirst = 0;

for (const p of skinned) {
  // —— 全知上限：知道适配分，挑最好的一支先点头，再挑最好的第二支（只作参考上限）。 ——
  const positives = SHELF_IDS.filter(id => positiveButNotPerfect(p, id));
  if (positives.length) {
    const first = positives[0]!;
    const alternatives = SHELF_IDS.filter(id => id !== first && affordable(p, id));
    if (alternatives.length) {
      const alt = alternatives.reduce((a, b) => rank(p, b) > rank(p, a) ? b : a);
      const base = beginServe(atCounter(p.id), PEOPLE, p.id);
      if (base.energy === 20 - VERB_ENERGY.serve) {
        const nod = tryOn(openConsult(base, p), p, first);
        if (nod.tried[first] === "positive") {
          const retry = tryOn(nod, p, alt);
          const sell = retry.tried[alt] === "perfect" || retry.tried[alt] === "positive" ? alt : first;
          const close = settleServe(base, PEOPLE, p.id, first, 1, false, nod.mood);
          const afterRetry = settleServe(base, PEOPLE, p.id, sell, 1, false, retry.mood);
          const closeOpinion = close.opinion[p.id] ?? 0, retryOpinion = afterRetry.opinion[p.id] ?? 0;
          fullRows.push({ id: p.id, name: p.name, first, alt, altTier: retry.tried[alt] ?? tierOf(p, alt),
            close: closeOpinion, retry: retryOpinion, delta: retryOpinion - closeOpinion,
            perfectUpside: retry.tried[alt] === "perfect" });
        }
      }
    }
  }

  // —— 有限信息策略：按公开标签一支支试，试到点头；再看第二支公开排名最高的货。 ——
  const base = beginServe(atCounter(p.id), PEOPLE, p.id);
  if (base.energy !== 20 - VERB_ENERGY.serve) continue;
  const live = visitPerson(base, p);
  let c = openConsult(base, p);
  let first: ShelfId | null = null;
  while (c.patience > 0) {
    const next = publicRank(live, c).find(id => !c.tried[id]);
    if (!next) break;
    c = tryOn(c, live, next);
    const tier = c.tried[next];
    if (tier === "perfect") { finitePerfectFirst++; break; }
    if (tier === "positive") { first = next; break; }
  }
  if (!first) continue;
  const alt = publicRank(live, c).find(id => !c.tried[id] && affordable(live, id));
  if (!alt) continue;
  const close = settleServe(base, PEOPLE, p.id, first, 1, false, c.mood);
  const retry = tryOn(c, live, alt);
  const sell = retry.tried[alt] === "perfect" || retry.tried[alt] === "positive" ? alt : first;
  const afterRetry = settleServe(base, PEOPLE, p.id, sell, 1, false, retry.mood);
  const closeOpinion = close.opinion[p.id] ?? 0, retryOpinion = afterRetry.opinion[p.id] ?? 0;
  finiteRows.push({ id: p.id, name: p.name, first, alt, altTier: retry.tried[alt] ?? tierOf(live, alt),
    close: closeOpinion, retry: retryOpinion, delta: retryOpinion - closeOpinion,
    perfectUpside: retry.tried[alt] === "perfect" });
}

const count = (rows: Row[], f: (r: Row) => boolean) => rows.filter(f).length;
const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(0)}%`;
const yuan = (id: ShelfId) => `¥${SHELF[id].price}`;
const table = (rows: Row[]) => {
  console.log("| 客人 | 先点头 | 换的那支 | 换支结果 | 收手 | 换支后收 | 差 |");
  console.log("|---|---|---|---|---:|---:|---:|");
  for (const r of [...rows].sort((a, b) => a.delta - b.delta)) {
    console.log(`| ${r.name} | ${SHELF[r.first].short} ${yuan(r.first)} | ${SHELF[r.alt].short} ${yuan(r.alt)} | ${r.altTier} | +${r.close} | +${r.retry} | ${r.delta >= 0 ? "+" : ""}${r.delta} |`);
  }
};

console.log("# 点头后换一支：同条件成交后看法（先卖回原来点头那一支）");
console.log(`样本：${skinned.length} 位有诉求的客人。旧规则 = HEAD；新规则 = 第一次换支没试到正中，普通人 -2、好胜/多疑/急性 -3；试到正中不罚，同单只结一次。`);
console.log("");
console.log("## 有限信息策略（只看她说的需求、今天的重点、货架 tag 与价格）");
console.log(`走到「先点头、还有第二支可换」的客人：${finiteRows.length} 位；其中第一次就认准、不需要换支：${finitePerfectFirst} 位。`);
console.log("");
table(finiteRows);
console.log("");
console.log(`换到正中、值得冒险：${count(finiteRows, r => r.perfectUpside)} 位（${pct(count(finiteRows, r => r.perfectUpside), finiteRows.length)}）`);
console.log(`换空要少人情、收手更稳：${count(finiteRows, r => r.delta < 0)} 位（${pct(count(finiteRows, r => r.delta < 0), finiteRows.length)}）`);
console.log(`换支不改变看法：${count(finiteRows, r => r.delta === 0)} 位`);
console.log("");
console.log("## 全知上限（知道适配分，挑第二支里最好的；只作参考上限）");
console.log(`样本：${fullRows.length} 位；换到正中 ${count(fullRows, r => r.perfectUpside)} 位，换空 ${count(fullRows, r => r.delta < 0)} 位。`);
console.log("");
table(fullRows);

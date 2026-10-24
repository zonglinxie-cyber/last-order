// 熟客每次回来有眼下的用途。旧笔记仍是真的，但这次哪一条最要紧会变。
// 来访情境在开时段时定下，当天不因一次问话/成交突然换口径；不额外消耗随机数。
import { lifePerson } from "./life-sales.ts";
import { branchModsOf } from "./branches.ts";
import { yearBudgetOf } from "./years.ts";
import { POSITIVE_FIT, SHELF, bestShelf, fitOfPerson } from "./shelf.ts";
import { SEASON_DAYS, type Demand, type Person, type PersonId, type Trait, type World } from "./types.ts";

export type VisitContext = { kind: "event" | "recovery"; focus: Trait; title: string; word: string; line: string; focusLine: string };

const CONTEXT_DAY = (id: PersonId) => `visit-context-day:${id}`;
const CONTEXT_CODE = (id: PersonId) => `visit-context-code:${id}`;
export const LAST_MET = (id: PersonId) => `last-met:${id}`;
export const absoluteDay = (world: Pick<World, "season" | "day">) => (world.season - 1) * SEASON_DAYS + world.day;

const VARIANTS = [
  { kind: "event", focus: "correct", title: "赶场", word: "当天见效" },
  { kind: "event", focus: "wear", title: "赶场", word: "长效持妆" },
  { kind: "recovery", focus: "soothe", title: "修护", word: "舒缓泛红" },
  { kind: "recovery", focus: "steady", title: "修护", word: "温和不闷" },
] as const;

const hash = (id: string) => [...id].reduce((n, ch) => n * 31 + ch.codePointAt(0)!, 0) >>> 0;
const budgetOf = (person: Person, kind: VisitContext["kind"]) =>
  kind === "event" ? Math.round(person.skin!.budget * 1.5 / 10) * 10 : person.skin!.budget;

/** 当天情境落在她身上的样子：今天的重点提到头等（want 2、权重 2），其余几条的分量压到 1。
 *  她本来没有这一条，就添上（want 1）—— 于是她今天多了一件事要办。
 *  导出是为了让探针与守卫读同一份，别各处抄一遍。 */
export function variantPerson(person: Person, code: number): Person {
  if (!person.skin || code < 1 || code > VARIANTS.length) return person;
  const variant = VARIANTS[code - 1]!;
  const demands: Demand[] = person.skin.demands.filter(d => d.trait !== variant.focus)
    .map(d => ({ ...d, weight: 1 }));
  const old = person.skin.demands.find(d => d.trait === variant.focus);
  demands.push(old ? { ...old, want: 2, weight: 2 } : { trait: variant.focus, want: 1, weight: 2 });
  return { ...person, skin: { ...person.skin, demands, budget: budgetOf(person, variant.kind) } };
}

/** 这个情境给不给她：挑中的那一刻，她得还有一支买得起的对症货 —— 挑不出好答案的今天，就没这个今天。
 *  选情境与货架守卫都读这一份，别各处抄一遍（抄的那份会跟改掉的那份漂掉）。 */
export const variantViable = (person: Person, code: number): boolean => {
  if (!person.skin || code < 1 || code > VARIANTS.length) return false;
  const p = variantPerson(person, code);
  const best = bestShelf(p);
  return SHELF[best].price <= p.skin!.budget && fitOfPerson(p, best) >= POSITIVE_FIT;
};

/** 只从有买得起的对症货的情境中选；优先让旧首选不再是今天的首选。
 *  基线是"走到第几步的她"：人生那一步改过的诉求和预算，就是今天情境要对照的旧首选。 */
function chooseCode(world: World, person: Person): number {
  if (!person.skin) return 0;
  const week = Math.floor((world.day - 1) / 7);
  const kind = (hash(person.id) + world.season + week) % 2 ? "event" : "recovery";
  const base = lifePerson(world, person);
  const oldBest = bestShelf(base);
  const viable = VARIANTS.map((v, i) => ({ v, code: i + 1, p: variantPerson(base, i + 1) }))
    .filter(x => x.v.kind === kind)
    .map(x => ({ ...x, best: bestShelf(x.p) }))
    .filter(x => SHELF[x.best].price <= x.p.skin!.budget && fitOfPerson(x.p, x.best) >= POSITIVE_FIT);
  const options = viable.length ? viable : VARIANTS.map((v, i) => ({ v, code: i + 1, p: variantPerson(base, i + 1) }))
    .filter(x => x.v.kind === "recovery")
    .map(x => ({ ...x, best: bestShelf(x.p) }))
    .filter(x => SHELF[x.best].price <= x.p.skin!.budget && fitOfPerson(x.p, x.best) >= POSITIVE_FIT);
  const changed = options.filter(x => x.best !== oldBest);
  const pool = changed.length ? changed : options;
  return pool.length ? pool[hash(`${person.id}:${world.season}:${week}`) % pool.length]!.code : 0;
}

/** 每位来客当天第一次在场时，按此前真实接触判断是不是熟客。当天的情境随后锁定。 */
export function assignVisitContexts(world: World, people: Person[]): World {
  const today = absoluteDay(world);
  const qualities = { ...world.qualities };
  for (const person of people) {
    if (!person.skin || !(person.id in world.present) || qualities[CONTEXT_DAY(person.id)] === today) continue;
    const met = qualities[LAST_MET(person.id)] ?? 0;
    const earlier = met > 0 && met < today;
    const oldSave = met === 0 && (qualities[`bought:${person.id}`] ?? 0) > 0
      && world.day > qualities[`bought:${person.id}`];
    const oldNotes = met === 0 && (qualities[`wechat:${person.id}`] === 1
      || Object.keys(qualities).some(k => k.startsWith(`client-note:${person.id}:`)));
    qualities[CONTEXT_DAY(person.id)] = today;
    qualities[CONTEXT_CODE(person.id)] = earlier || oldSave || oldNotes ? chooseCode(world, person) : 0;
  }
  return { ...world, qualities };
}

export function visitContext(world: World, person: Person): VisitContext | null {
  if (!person.skin || world.qualities[CONTEXT_DAY(person.id)] !== absoluteDay(world)) return null;
  const code = world.qualities[CONTEXT_CODE(person.id)] ?? 0;
  const variant = VARIANTS[code - 1];
  if (!variant) return null;
  const budget = yearBudgetOf(world, budgetOf(lifePerson(world, person), variant.kind)).toLocaleString("zh-CN");
  return { ...variant,
    line: variant.kind === "event"
      ? `今天要赶一个场合，预算是 ¥${budget}；有件最要紧的事，你帮我看看先顾哪一头。`
      : "今天想先把状态稳住；有件最要紧的事，你帮我看看先顾哪一头。",
    focusLine: variant.kind === "event"
      ? `今天要赶一个场合，预算是 ¥${budget}；这次最在意${variant.word}。以前的偏好还在，先按今天的事挑货。`
      : `今天想先把状态稳住；这次最在意${variant.word}。以前的偏好还在，先按今天的事挑货。` };
}

/** 年景「今年商场做活动」那一档：她今天带的钱松一点。叠在情境与人生那一步之后 —— 那是她出门时带的数。 */
const yearBudgeted = (world: Pick<World, "qualities">, person: Person): Person =>
  person.skin ? { ...person, skin: { ...person.skin, budget: yearBudgetOf(world, person.skin.budget) } } : person;

/** 分支与柜那一层：客人的钱袋子还受你站的地方影响（区域督导换柜：东柜薄、西柜松）。 */
const branchBudgeted = (world: Pick<World, "qualities" | "season" | "day">, person: Person): Person => {
  const m = branchModsOf(world).budget;
  if (m === 1 || !person.skin) return person;
  return { ...person, skin: { ...person.skin, budget: Math.round(person.skin.budget * m) } };
};

/** 今天进门的她：先叠「人生走到第几步」，再叠当天的来访情境，然后是年景，最后是你这条分支与今天的柜。
 *  卖货侧所有读数（适配、预算、件数、诉求条数）都读这一层，不在界面拼句子。 */
export const visitPerson = (world: World, person: Person): Person => {
  const code = world.qualities[CONTEXT_DAY(person.id)] === absoluteDay(world)
    ? world.qualities[CONTEXT_CODE(person.id)] ?? 0 : 0;
  return branchBudgeted(world, yearBudgeted(world, variantPerson(lifePerson(world, person), code)));
};

/** 日志与接待只记玩家真的接触过的人。 */
export const markMet = <W extends World>(world: W, id: PersonId): W =>
  ({ ...world, qualities: { ...world.qualities, [LAST_MET(id)]: absoluteDay(world) } });

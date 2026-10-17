// 熟人当面替你问一句：买到的是信息，不是保证成交，也不替代接待成本。
import { beginServe, kindOf, opinionOf, SERVE_STAT_FLOOR, VERB_ENERGY, warmthOf } from "./engine.ts";
import { rememberConsult, type Consult } from "./consult.ts";
import { demandWords } from "./serve-talk.ts";
import { absoluteDay, markMet, visitPerson } from "./visits.ts";
import type { Person, PersonId, World } from "./types.ts";

export const COMPANION_ENERGY = 6;
export const COMPANION_TRUST = 20;
export const COMPANION_WARMTH = 20;
const usedKey = (id: PersonId) => `companion-question:${id}`;
export const companionUsed = (world: World, id: PersonId) => world.qualities[usedKey(id)] === absoluteDay(world);
const here = (w: World, id: PersonId) => !!w.present[id] && w.present[id] !== "rival";
export const companionCost = (c: Consult) => COMPANION_ENERGY + (c.begun ? 0 : VERB_ENERGY.serve);

function closeTo(world: World, people: Person[], buyer: PersonId, helper: Person) {
  return helper.id !== buyer && helper.role === "customer"
    && kindOf(world, people, buyer, helper.id) !== "rival"
    && kindOf(world, people, helper.id, buyer) !== "rival"
    && warmthOf(world, people, buyer, helper.id) >= COMPANION_WARMTH
    && warmthOf(world, people, helper.id, buyer) >= COMPANION_WARMTH;
}

// 优先确认今天的重点，再问没说过的诉求、底线或数量。回应由顾客本人说，熟人不泄露秘密。
function question(c: Consult, person: Person): { reply: string; patch: Partial<Consult> } | null {
  const skin = person.skin;
  if (!skin) return null;
  const focus = c.focus && !c.focusKnown ? skin.demands.find(d => d.trait === c.focus) : undefined;
  const demand = focus ?? skin.demands.find(d => !c.known.includes(d.trait));
  if (demand) return {
    reply: `${focus ? "今天最要紧的是这个：" : "还有一件："}${demandWords(person.id, demand)}。`,
    patch: { known: [...new Set([...c.known, demand.trait])], focusKnown: c.focusKnown || c.focus === demand.trait },
  };
  if (skin.veto && !c.vetoKnown) return { reply: `${skin.veto.note}。`, patch: { vetoKnown: true } };
  if (!c.unitsKnown) return { reply: `这次最多带 ${skin.maxUnits} 件，再多用不完。`, patch: { unitsKnown: true } };
  return null;
}

/** 公开可见的关系与在场情况决定入口；灰按钮解释为什么现在不能托这句话。 */
export function companionOptions(world: World, people: Person[], c: Consult) {
  return people.filter(p => here(world, p.id) && closeTo(world, people, c.person, p))
    .map(person => ({ person, reason: companionBlock(world, people, c, person.id) }));
}

export function companionBlock(world: World, people: Person[], c: Consult, helperId: PersonId): string | null {
  const buyer = people.find(p => p.id === c.person), helper = people.find(p => p.id === helperId);
  if (!buyer?.skin || !helper || !here(world, buyer.id) || !here(world, helper.id)) return "两个人都在楼上时才能搭话";
  if (!closeTo(world, people, buyer.id, helper)) return "两个人还没熟到能搭这句话";
  if (opinionOf(world, helper.id) < COMPANION_TRUST) return `${helper.name}还不够信任你，先熟悉起来`;
  if (companionUsed(world, buyer.id)) return "今天已经请人替这位客人问过了";
  if (c.patience <= 0) return "客人已经等着你做决定，别再托人问了";
  if (world.standing <= SERVE_STAT_FLOOR || world.compliance <= SERVE_STAT_FLOOR) return "先把柜台恢复营业";
  if (c.begun && !world.touched.includes(buyer.id)) return "请重新打开这次接待";
  if (!question(c, visitPerson(world, buyer))) return "需求都已经问清，可以挑货或试用了";
  if (world.energy < companionCost(c)) return `需要 ${companionCost(c)} 精力${c.begun ? "" : "（含接待 12）"}`;
  return null;
}

/** 合并进原谈话；拒绝与重复调用不扣费、不改状态、不消耗随机数。 */
export function askCompanion(world: World, people: Person[], c: Consult, helperId: PersonId): { world: World; consult: Consult } {
  const unchanged = { world, consult: c };
  if (companionBlock(world, people, c, helperId)) return unchanged;
  const buyer = people.find(p => p.id === c.person)!, helper = people.find(p => p.id === helperId)!;
  const answer = question(c, visitPerson(world, buyer))!;
  const begun = c.begun ? world : beginServe(world, people, buyer.id);
  if (!c.begun && begun === world) return unchanged;
  const consult: Consult = { ...c, ...answer.patch, begun: true,
    lines: [...c.lines, `${helper.name}替你问：「还有什么想先说清的？」${buyer.name}接过话：「${answer.reply}」`] };
  const next = markMet({ ...begun, energy: begun.energy - COMPANION_ENERGY,
    qualities: { ...begun.qualities, [usedKey(buyer.id)]: absoluteDay(world) } }, helperId);
  return { world: rememberConsult(next, buyer, consult), consult };
}

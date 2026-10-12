// 人情场的接待：看 → 问 → 试 → 开单。玩法从旧五日版的接待搬过来（观察线索、挑一个问题问、
// 试用看反应、按她说过的上限开口要件数），但数据全部读人情场自己的人物表与货架，
// 所以 32 位有诉求表的客人都能这样接，不必一人手写一套。旧版手写过的那 7 位
// （content/consult-lines.ts）用手写的线索、问话和近景大图，其余的人按诉求生成。
//
// 这一层只管"你知道了她什么"和"她还肯听你说几句"，钱、看法、退货仍由 engine.ts 的
// beginServe / settleServe 结账。界面只读这里的句子，不在 JSX 里拼。
import type { FitTier, Trait } from "../campaign.ts";
import { demandWords, serveTalk, SECRET_KNOWN_KEY } from "./serve-talk.ts";
import { SHELF, PERFECT_MATCH, fitOfPerson, shelfFitTier, type ShelfId } from "./shelf.ts";
import type { Person, PersonId, World } from "./types.ts";
import { ta } from "./pronoun.ts";
import { HAND_CONSULT, PLATE_CROP, PLATE_POINTS, PLATE_SIZE } from "./content/consult-lines.ts";

/** 她肯听你说几句。每看一处、问一句、试一支都花一句；花完了只剩开单。 */
export const CONSULT_PATIENCE = 4;
/** 熟起来的人多给你一句。 */
export const CONSULT_WARM_OPINION = 10;
/** 推销味的那一问，开单时一起结的看法。 */
export const PUSH_QUESTION_MOOD = -3;

/** at：落在近景横幅上的位置（百分比），只有手写那几位有。 */
export type ConsultSpot = { key: string; label: string; finding: string; reveals: Trait[]; at?: { x: number; y: number } };
/** trait = 按诉求生成的问话；line = 手写的问话（reply 是她的原话）；units / push 两句人人都有。 */
export type ConsultQuestion = { key: string; label: string; kind: "trait" | "line" | "units" | "push"; trait?: Trait; reply?: string; reveals?: Trait[] };

export type Consult = {
  person: PersonId;
  /** 还肯听几句 */
  patience: number;
  /** 第一下动作才算正式接手（精力在那一刻花），在那之前关掉抽屉不花劲 */
  begun: boolean;
  looked: string[];
  asked: string[];
  /** 已经摆上台面的诉求 */
  known: Trait[];
  vetoKnown: boolean;
  unitsKnown: boolean;
  tried: Partial<Record<ShelfId, FitTier>>;
  /** 试到了她每条都接得住的那一支：没说出口的那几条也就不用再摸了 */
  matched: boolean;
  /** 这一单里你看到的、她说出口的，按先后 */
  lines: string[];
  /** 攒着开单时一起结的看法 */
  mood: number;
};

const hash = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) % 1_000_003;
  return h;
};

/** 每条诉求在脸上（或身上）露出来的样子。替别人买的人，看她的脸看不出来。 */
const SPOT_WORDS: Record<Trait, { label: string; finding: string }> = {
  natural: { label: "眼下", finding: "眼下已经有一层细卡纹 —— 再往上叠厚的，只会更显。" },
  correct: { label: "气色", finding: "肤色发暗、气色撑不起来 —— 要的是当天照镜子就看得出变化。" },
  soothe: { label: "脸颊", finding: "两颊干燥泛红，靠近能看见一点脱皮。" },
  steady: { label: "下巴", finding: "下巴和鼻翼冒着几颗闭口，闷一下就会爆。" },
  wear: { label: "T 区", finding: "中午补过的妆已经斑驳了，这张脸要撑一整天。" },
};
const SPOT_BLANKS = [
  { label: "手上", finding: "指甲修得很干净，手背没什么可看的。" },
  { label: "发际线", finding: "发际线一圈干干净净，看不出什么。" },
  { label: "唇周", finding: "唇周没有起皮，问题不在这儿。" },
];
const SPOT_PROXY = { label: "手机", finding: "一直在翻手机里的照片 —— 东西不是买给自己的，看这张脸会看错。" };

/** 柜台上能看的三处：她的诉求按轻重排，看得出的露在脸上，不够三处的用"没什么可看的"补齐。 */
export function spotsOf(person: Person): ConsultSpot[] {
  if (!person.skin) return [];
  const hand = HAND_CONSULT[person.id];
  if (hand) {
    return hand.spots.map(sp => ({ key: `hand-${sp.at}`, label: sp.label, finding: sp.finding, reveals: [...sp.reveals],
      at: { x: (PLATE_POINTS[sp.at].x / PLATE_SIZE.w) * 100,
        y: ((PLATE_POINTS[sp.at].y - PLATE_CROP.top) / (PLATE_CROP.bottom - PLATE_CROP.top)) * 100 } }));
  }
  if (person.skin.buysFor) {
    return [{ key: "proxy", ...SPOT_PROXY, reveals: [] },
      ...SPOT_BLANKS.slice(0, 2).map((b, i) => ({ key: `blank-${i}`, ...b, reveals: [] }))];
  }
  const traits = [...person.skin.demands].sort((a, b) => b.weight - a.weight).map(d => d.trait).slice(0, 3);
  const spots: ConsultSpot[] = traits.map(t => ({ key: `spot-${t}`, ...SPOT_WORDS[t], reveals: [t] }));
  for (let i = 0; spots.length < 3; i++) {
    const b = SPOT_BLANKS[(hash(person.id) + i) % SPOT_BLANKS.length];
    spots.push({ key: `blank-${i}`, ...b, reveals: [] });
  }
  // 按人洗一次牌：三处的位置不能永远是"头等事在最左边"。
  const h = hash(`${person.id}:spots`);
  return spots.map((s, i) => ({ s, k: (h + i * 7919) % 101 })).sort((a, b) => a.k - b.k).map(x => x.s);
}

const TRAIT_QUESTION: Record<Trait, string> = {
  natural: "你最怕别人看出什么？",
  correct: "要当天就看得出效果吗？",
  soothe: "最近脸上会干、会红吗？",
  steady: "用东西容易闷痘、过敏吗？",
  wear: "要从早撑到晚吗？",
};
export const UNITS_QUESTION = "这一次大概想带几支？";
export const PUSH_QUESTION = "要不要直接看套装？";
const TRAIT_ORDER: Trait[] = ["natural", "correct", "soothe", "steady", "wear"];

/** 能问的五句：三句问诉求（她在意的和不在意的掺在一起）、一句问件数、一句推销味的。 */
export function questionsOf(person: Person): ConsultQuestion[] {
  if (!person.skin) return [];
  const hand = HAND_CONSULT[person.id];
  if (hand) {
    // 手写那几句按原来的顺序摆（旧版就是这么排的），件数那一句接在最后；没写推销味那一句的补一句通用的。
    const list: ConsultQuestion[] = hand.questions.map((q, i) => q.push
      ? { key: `hand-${i}`, label: q.label, kind: "push" as const, reply: q.reply }
      : { key: `hand-${i}`, label: q.label, kind: "line" as const, reply: q.reply, reveals: [...q.reveals] });
    if (!list.some(q => q.kind === "push")) list.push({ key: "ask-push", label: PUSH_QUESTION, kind: "push" });
    list.push({ key: "ask-units", label: UNITS_QUESTION, kind: "units" });
    return list;
  }
  const mine = [...person.skin.demands].sort((a, b) => a.weight - b.weight).map(d => d.trait);
  const others = TRAIT_ORDER.filter(t => !mine.includes(t));
  // 先放她的忌讳那一条（只有问到才肯讲），再放她在意的里头分量轻的（重的那条她多半已经自己说了），
  // 最后拿一条她不在意的掺进去。
  const veto = person.skin.veto?.trait;
  const pickMine = [...new Set([...(veto ? [veto] : []), ...mine.slice(0, mine.length > 1 ? mine.length - 1 : 1)])].slice(0, 2);
  const pickOther = others.length ? [others[hash(person.id) % others.length]] : [];
  const traits = [...pickMine, ...pickOther];
  for (const t of [...mine, ...others]) if (traits.length < 3 && !traits.includes(t)) traits.push(t);
  const list: ConsultQuestion[] = [
    ...traits.map(t => ({ key: `ask-${t}`, label: TRAIT_QUESTION[t], kind: "trait" as const, trait: t })),
    { key: "ask-units", label: UNITS_QUESTION, kind: "units" },
    { key: "ask-push", label: PUSH_QUESTION, kind: "push" },
  ];
  const h = hash(`${person.id}:ask`);
  return list.map((q, i) => ({ q, k: (h + i * 104729) % 97 })).sort((a, b) => a.k - b.k).map(x => x.q);
}

/** 近景大图（手写那几位才有）与横幅从原图哪一段裁（百分比，给 background-position 用）。 */
export function plateOf(person: Person): { src: string; cropY: number } | null {
  const hand = HAND_CONSULT[person.id];
  if (!hand) return null;
  const visible = PLATE_CROP.bottom - PLATE_CROP.top;
  return { src: hand.plate, cropY: (PLATE_CROP.top / (PLATE_SIZE.h - visible)) * 100 };
}

/** 她一开口就肯说的那几条（看法越高越多），回头客的件数你心里有数。 */
export function openConsult(world: World, person: Person): Consult {
  const opinion = world.opinion[person.id] ?? 0;
  const talk = person.skin
    ? serveTalk(person.skin.demands, opinion, !!world.qualities[SECRET_KNOWN_KEY(person.id)], person.skin.veto)
    : { said: [], unsaid: 0, vetoNote: null };
  const lines = talk.said.map(d => `「${demandWords(person.id, d)}」`);
  if (talk.vetoNote) lines.push(`「${talk.vetoNote}」`);
  return {
    person: person.id,
    patience: consultPatience(person, opinion),
    begun: false,
    looked: [], asked: [],
    known: talk.said.map(d => d.trait),
    vetoKnown: !!talk.vetoNote,
    unitsKnown: (world.qualities[`bought:${person.id}`] ?? 0) > 0,
    tried: {},
    matched: false,
    lines,
    mood: 0,
  };
}

/** 急性子少一句；熟起来的人多一句。 */
export function consultPatience(person: Person, opinion: number): number {
  return CONSULT_PATIENCE
    - (person.tempers.includes("hasty") ? 1 : 0)
    + (opinion >= CONSULT_WARM_OPINION ? 1 : 0);
}

const spend = (c: Consult, person: Person, line: string, patch: Partial<Consult> = {}): Consult => {
  const next = { ...c, ...patch, begun: true, patience: c.patience - 1, lines: [...c.lines, line] };
  return next.patience <= 0 ? { ...next, lines: [...next.lines, outOfPatienceWord(person)] } : next;
};
export const outOfPatienceWord = (person: Person) => `${ta(person)}看了眼表：「你直接说吧，开哪支？」`;

export function lookAt(c: Consult, person: Person, key: string): Consult {
  const spot = spotsOf(person).find(s => s.key === key);
  if (!spot || c.patience <= 0 || c.looked.includes(key)) return c;
  return spend(c, person, `你看${ta(person)}的${spot.label}：${spot.finding}`, { looked: [...c.looked, key], known: learn(c, person, spot.reveals) });
}

/** 摆上台面的诉求只认她真有的那几条。 */
const learn = (c: Consult, person: Person, traits: Trait[]): Trait[] =>
  [...new Set([...c.known, ...traits.filter(t => person.skin?.demands.some(d => d.trait === t))])];

const SHRUGS = ["「这个我倒不太在意。」", "「还好，这不是我的事。」", "「没有，你问偏了。」"];

export function askHer(c: Consult, person: Person, key: string): Consult {
  const q = questionsOf(person).find(x => x.key === key);
  if (!q || !person.skin || c.patience <= 0 || c.asked.includes(key)) return c;
  const asked = [...c.asked, key];
  if (q.kind === "units") {
    return spend(c, person, `「${person.skin.maxUnits === 1 ? "一支就够，多了用不完" : `最多 ${person.skin.maxUnits} 支，再多就用不完了`}。」`,
      { asked, unitsKnown: true });
  }
  if (q.kind === "push") {
    return spend(c, person, `「${q.reply ?? person.voice.hurt}」`, { asked, mood: c.mood + PUSH_QUESTION_MOOD });
  }
  if (q.kind === "line") {
    const veto = person.skin.veto && q.reveals?.includes(person.skin.veto.trait) ? person.skin.veto : undefined;
    return spend(c, person, `「${q.reply}」${veto && !c.vetoKnown ? `（底线：${veto.note}）` : ""}`, {
      asked, known: learn(c, person, q.reveals ?? []), vetoKnown: c.vetoKnown || !!veto });
  }
  const demand = person.skin.demands.find(d => d.trait === q.trait);
  if (!demand) return spend(c, person, SHRUGS[hash(`${person.id}:${key}`) % SHRUGS.length], { asked });
  const veto = person.skin.veto?.trait === q.trait ? person.skin.veto : undefined;
  const line = `「${demandWords(person.id, demand)}${veto ? `。${veto.note}` : ""}。」`;
  return spend(c, person, line, {
    asked,
    known: c.known.includes(demand.trait) ? c.known : [...c.known, demand.trait],
    vetoKnown: c.vetoKnown || !!veto,
  });
}

/** 试一支在她手背上：她的反应把这一支落在哪一档说出来。碰到她的忌讳，忌讳也一起露出来。 */
export function tryOn(c: Consult, person: Person, id: ShelfId): Consult {
  if (!person.skin || c.patience <= 0 || c.tried[id]) return c;
  const score = fitOfPerson(person, id);
  const tier = shelfFitTier(score);
  const veto = person.skin.veto;
  const hitVeto = !!veto && SHELF[id].traits[veto.trait] < veto.below;
  const she = ta(person);
  const lead = `你把${SHELF[id].short}抹在${she}手背上，${she}`;
  const line = hitVeto ? `${lead}一下就缩回去了：「${veto!.note}。」`
    : tier === "positive" && score >= PERFECT_MATCH ? `${lead}看了好一会儿：「就是这个感觉。」`
    : tier === "positive" ? `${lead}点点头：「这个可以。」`
    : tier === "mixed" ? `${lead}犹豫了一下：「还行吧，不是最想要的。」`
    : `${lead}摇头：「这个解决不了我的事。」`;
  return spend(c, person, line, { tried: { ...c.tried, [id]: tier }, vetoKnown: c.vetoKnown || hitVeto,
    matched: c.matched || (!hitVeto && tier === "positive" && score >= PERFECT_MATCH) });
}

/** 那句"她像是还有顾虑"还念不念：诉求没摸全、也还没试到正中那一支。 */
export const stillHolding = (c: Consult, person: Person): boolean =>
  !!person.skin && !c.matched && c.known.length < person.skin.demands.length;

/** 一句话说她还肯听多少：不报数。 */
export function patienceWord(c: Consult, person: Person): string {
  const she = ta(person);
  return c.patience >= 4 ? `${she}还愿意慢慢听你说`
    : c.patience === 3 ? `${she}还肯听你说几句`
    : c.patience === 2 ? `${she}开始看表了`
    : c.patience === 1 ? `${she}只肯再听一句`
    : "该开单了";
}

/** 预算与件数那一行：件数没问出来之前不报。 */
export function budgetWord(c: Consult, person: Person): string {
  if (!person.skin) return "";
  const budget = `预算 ¥${person.skin.budget.toLocaleString("zh-CN")}`;
  return c.unitsKnown ? `${budget} · 上限 ${person.skin.maxUnits} 件` : `${budget} · 想带几件还没问`;
}

/** 选中一支货时那句：这一支她的预算够几件。件数上限不在这里漏 —— 那要问出来。 */
export function priceWord(person: Person, id: ShelfId): string {
  if (!person.skin) return "";
  const n = Math.floor(person.skin.budget / SHELF[id].price);
  return n > 0 ? `${SHELF[id].note} · 这个价${ta(person)}的预算够 ${n} 件` : `${SHELF[id].note} · 这个价超出${ta(person)}的预算了`;
}

/** 试过的货在格子上留一个字。 */
export const TRIED_MARK: Record<FitTier, string> = { positive: "点头", mixed: "犹豫", negative: "摇头" };

// 人情场的接待：看 → 问 → 试 → 开单。玩法从旧五日版的接待搬过来（观察线索、挑一个问题问、
// 试用看反应、按她说过的上限开口要件数），但数据全部读人情场自己的人物表与货架，
// 所以 32 位有诉求表的客人都能这样接，不必一人手写一套。旧版手写过的那 7 位
// （content/consult-lines.ts）用手写的线索、问话和近景大图，其余的人按诉求生成。
//
// 这一层只管"你知道了她什么"和"她还肯听你说几句"，钱、看法、退货仍由 engine.ts 的
// beginServe / settleServe 结账。界面只读这里的句子，不在 JSX 里拼。
import { demandWords, serveTalk, SECRET_KNOWN_KEY } from "./serve-talk.ts";
import { SHELF, PERFECT_MATCH, fitOfPerson, perfectShelf, shelfFitTier, type FitTier, type ShelfId } from "./shelf.ts";
import type { Person, PersonId, Trait, World } from "./types.ts";
import { ta } from "./pronoun.ts";
import { HAND_CONSULT, PLATE_CROP, PLATE_POINTS, PLATE_SIZE } from "./content/consult-lines.ts";
import { visitContext, visitPerson } from "./visits.ts";
import { lifePerson } from "./life-sales.ts";

/** 她肯听你说几句。每看一处、问一句、试一支都花一句；花完了只剩开单。 */
export const CONSULT_PATIENCE = 4;
/** 熟起来的人多给你一句。 */
export const CONSULT_WARM_OPINION = 10;
/** 推销味的那一问，开单时一起结的看法。 */
export const PUSH_QUESTION_MOOD = -3;
/** 她已经点过头，再换一支却没试到正中：普通人觉得你拿不准，好胜/多疑/急性的人更介意。
 *  只在第一次换支时结一次；这是「继续摸」的真实代价，不是每多试一支都叠一层。 */
export const SECOND_TRY_MOOD = -2;
export const SECOND_TRY_HARD_MOOD = -3;
const SECOND_TRY_HARD_TEMPERS = new Set(["proud", "hasty", "wary"]);

/** at：落在近景横幅上的位置（百分比），只有手写那几位有。 */
export type ConsultSpot = { key: string; label: string; finding: string; reveals: Trait[]; at?: { x: number; y: number } };
/** trait = 按诉求生成的问话；line = 手写的问话（reply 是她的原话）；units / push 两句人人都有。 */
export type ConsultQuestion = { key: string; label: string; kind: "trait" | "line" | "units" | "push"; trait?: Trait; reply?: string; reveals?: Trait[] };

/** 试用留在格子上的字比货架三档多一格：正中（每条都接得住）单独记下，
 *  开单前才分得清「这个可以」与「就是这个感觉」；结账仍按 FitTier 三档走。 */
export type TrialTier = FitTier | "perfect";

export type Consult = {
  person: PersonId;
  stage: "listen" | "offer";
  product: ShelfId | null;
  units: number;
  /** 还肯听几句 */
  patience: number;
  /** 第一下动作才算正式接手（精力在那一刻花），在那之前关掉抽屉不花劲 */
  begun: boolean;
  looked: string[];
  asked: string[];
  /** 已经摆上台面的诉求 */
  known: Trait[];
  /** 问过、看过后确认她不在意的方向。只在本单里有效：下一位客人、下一单都可能不同。 */
  excluded: Trait[];
  /** 今天最要紧的那一条。存在不等于已经知道是哪条：老客的长期偏好可能全在 `known` 里，今天的重点仍要问。 */
  focus: Trait | null;
  focusKnown: boolean;
  vetoKnown: boolean;
  unitsKnown: boolean;
  tried: Partial<Record<ShelfId, TrialTier>>;
  /** 试到了她每条都接得住的那一支：没说出口的那几条也就不用再摸了 */
  matched: boolean;
  /** 已经为「点头后又换一支」结过一次人情代价：同一单不再叠罚。旧档缺省按 false。 */
  risked: boolean;
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

/** 今天那条重点能不能靠现有的看 / 问摸出来。手写客人没有覆盖到的，仍按旧版直接说出来，避免死胡同。 */
const focusRevealable = (person: Person, focus: Trait): boolean => {
  const hand = HAND_CONSULT[person.id];
  if (!hand) return true;
  return hand.spots.some(s => s.reveals.includes(focus))
    || hand.questions.some(q => q.reveals?.includes(focus));
};

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
    // 今天最要紧的那条如果不在手写线索里，补一句按诉求生成的问法，保证它问得出来。
    const focus = person.skin.demands.find(d => d.weight === 2);
    const covered = !!focus && (hand.spots.some(s => s.reveals.includes(focus.trait))
      || hand.questions.some(q => q.reveals?.includes(focus.trait)));
    if (focus && !covered) list.push({ key: "ask-focus", label: TRAIT_QUESTION[focus.trait], kind: "trait", trait: focus.trait });
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

/** 传原始人物；眼下的用途只在这里换算一次。公开说出的新诉求也属于已知线索。
 *  老客的长期偏好可能已经全知道，但今天最要紧的那条仍要自己看 / 问出来：开场只说她今天有件要紧事。 */
export function openConsult(world: World, person: Person): Consult {
  const context = visitContext(world, person);
  person = visitPerson(world, person);
  const opinion = world.opinion[person.id] ?? 0;
  const talk = person.skin
    ? serveTalk(person.skin.demands, opinion, !!world.qualities[SECRET_KNOWN_KEY(person.id)], person.skin.veto)
    : { said: [], unsaid: 0, vetoNote: null };
  const revealable = !!context && focusRevealable(person, context.focus);
  // 高关系时她自己把底线说出来，而底线正好是今天的重点：这条也算已经说破，别让面板再说"还没摸清"。
  const vetoLeaksFocus = !!context && !!talk.vetoNote && person.skin?.veto?.trait === context.focus;
  const hideFocus = revealable && !vetoLeaksFocus;
  // 今天的重点先不混进"她主动说的"：看 / 问揭开之前，连高关系的老客也不能白拿。
  const said = hideFocus ? talk.said.filter(d => d.trait !== context.focus) : talk.said;
  const lines = said.map(d => `「${demandWords(person.id, d)}」`);
  if (context) lines.unshift(hideFocus ? context.line : context.focusLine);
  if (talk.vetoNote) lines.push(`「${talk.vetoNote}」`);
  const notes = clientNotes(world, person);
  return {
    person: person.id,
    stage: "listen", product: null, units: 1,
    patience: consultPatience(person, opinion),
    begun: false,
    looked: [], asked: [],
    known: [...new Set([...notes.known, ...said.map(d => d.trait)])],
    excluded: [],
    focus: context?.focus ?? null,
    focusKnown: !!context && (!revealable || vetoLeaksFocus),
    vetoKnown: notes.vetoKnown || !!talk.vetoNote,
    unitsKnown: notes.unitsKnown || (world.qualities[`bought:${person.id}`] ?? 0) > 0,
    tried: {},
    matched: false,
    risked: false,
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

/** 没有新事实的那一下不扣耐心：玩家仍然花掉一次提问/观察的机会，但不该为「已经知道」再付一次钱。 */
const spend = (c: Consult, person: Person, line: string, patch: Partial<Consult> = {}, cost = true): Consult => {
  const next = { ...c, ...patch, begun: true, patience: c.patience - (cost ? 1 : 0), lines: [...c.lines, line] };
  return cost && next.patience <= 0 ? { ...next, lines: [...next.lines, outOfPatienceWord(person)] } : next;
};
export const outOfPatienceWord = (person: Person) => `${ta(person)}看了眼表：「你直接说吧，开哪支？」`;

const NO_NEW_FACT = "（这条你已经知道，不算一次探问。）";
const NOTHING_SEEN = "（没看出新的，不算一次探问。）";
const NOTHING_ASKED = "（这句话没问出新的事实，不算一次探问。）";
const ALREADY_UNITS = "（件数你已经知道，不算一次探问。）";
const SHE_DOES_NOT_CARE = "（她不在意这一条；你排除了一个方向，不算一次探问。）";
const SHE_DOES_NOT_CARE_AGAIN = "（她不在意这一条，也不算一次探问。）";

/** 摆上台面的诉求只认她真有的那几条。 */
const learn = (c: Consult, person: Person, traits: Trait[]): Trait[] =>
  [...new Set([...c.known, ...traits.filter(t => person.skin?.demands.some(d => d.trait === t))])];

/** 问/看里确认「不是她」的方向。只记她真没有的诉求，已经知道的不能再算排除。
 *  底线也是一条「她有意见」的方向，不能混进「她不在意」。 */
const exclude = (c: Consult, person: Person, traits: Trait[]): Trait[] => {
  const mine = new Set(person.skin?.demands.map(d => d.trait) ?? []);
  if (person.skin?.veto) mine.add(person.skin.veto.trait);
  return [...new Set([...c.excluded, ...traits.filter(t => !mine.has(t) && !c.known.includes(t))])];
};

export function lookAt(c: Consult, person: Person, key: string): Consult {
  const spot = spotsOf(person).find(s => s.key === key);
  if (!spot || c.patience <= 0 || c.looked.includes(key)) return c;
  const known = learn(c, person, spot.reveals);
  const focusKnown = c.focusKnown || (!!c.focus && spot.reveals.includes(c.focus));
  const progress = known.length > c.known.length || focusKnown !== c.focusKnown;
  const note = progress ? "" : (spot.reveals.some(t => c.known.includes(t)) ? NO_NEW_FACT : NOTHING_SEEN);
  return spend(c, person, `你看${ta(person)}的${spot.label}：${spot.finding}${note}`, {
    looked: [...c.looked, key], known, focusKnown }, progress);
}

const SHRUGS = ["「这个我倒不太在意。」", "「还好，这不是我的事。」", "「没有，你问偏了。」"];

export function askHer(c: Consult, person: Person, key: string): Consult {
  const q = questionsOf(person).find(x => x.key === key);
  if (!q || !person.skin || c.patience <= 0 || c.asked.includes(key)) return c;
  const asked = [...c.asked, key];
  if (q.kind === "units") {
    const progress = !c.unitsKnown;
    return spend(c, person, `「${person.skin.maxUnits === 1 ? "一支就够，多了用不完" : `最多 ${person.skin.maxUnits} 支，再多就用不完了`}。」${progress ? "" : ALREADY_UNITS}`,
      { asked, unitsKnown: true }, progress);
  }
  if (q.kind === "push") {
    return spend(c, person, `「${q.reply ?? person.voice.hurt}」`, { asked, mood: c.mood + PUSH_QUESTION_MOOD });
  }
  if (q.kind === "line") {
    const veto = person.skin.veto && q.reveals?.includes(person.skin.veto.trait) ? person.skin.veto : undefined;
    const known = learn(c, person, q.reveals ?? []);
    const vetoKnown = c.vetoKnown || !!veto;
    const focusKnown = c.focusKnown || (!!c.focus && !!q.reveals?.includes(c.focus));
    const excluded = exclude(c, person, q.reveals ?? []);
    // 只有「她真有这条 / 今天重点 / 底线」才花耐心；只排除一个方向不算一次探问。
    const cost = known.length > c.known.length || vetoKnown !== c.vetoKnown || focusKnown !== c.focusKnown;
    const note = cost ? "" : excluded.length > c.excluded.length ? "（这句话排除了一个方向，不算一次探问。）" : NOTHING_ASKED;
    return spend(c, person, `「${q.reply}」${veto && !c.vetoKnown ? `（底线：${veto.note}）` : ""}${note}`, {
      asked, known, vetoKnown, focusKnown, excluded }, cost);
  }
  const demand = person.skin.demands.find(d => d.trait === q.trait);
  if (!demand) {
    const excluded = exclude(c, person, [q.trait!]);
    const added = excluded.length > c.excluded.length;
    return spend(c, person, `${SHRUGS[hash(`${person.id}:${key}`) % SHRUGS.length]}${added ? SHE_DOES_NOT_CARE : SHE_DOES_NOT_CARE_AGAIN}`,
      { asked, excluded }, false);
  }
  const veto = person.skin.veto?.trait === q.trait ? person.skin.veto : undefined;
  const line = `「${demandWords(person.id, demand)}${veto ? `。${veto.note}` : ""}。」`;
  const known = c.known.includes(demand.trait) ? c.known : [...c.known, demand.trait];
  const vetoKnown = c.vetoKnown || !!veto;
  const focusKnown = c.focusKnown || (!!c.focus && q.trait === c.focus);
  const progress = known.length > c.known.length || vetoKnown !== c.vetoKnown || focusKnown !== c.focusKnown;
  return spend(c, person, `${line}${progress ? "" : NO_NEW_FACT}`, {
    asked, known, vetoKnown, focusKnown,
  }, progress);
}

/** 她已经点头/认准之后，第一次换一支试的风险：只在换的那支没试到正中时结。
 *  普通人 -2，好胜/多疑/急性的人 -3；文案在点上「试一下」之前就能看见，不藏。 */
export type SecondTryRisk = { mood: number; line: string };
export function secondTryRisk(c: Consult, person: Person, id: ShelfId): SecondTryRisk | null {
  if (!person.skin || c.patience <= 0 || c.tried[id] || c.risked) return null;
  const prior = Object.entries(c.tried);
  if (!prior.length) return null;
  const [triedId, tier] = prior[prior.length - 1]!;
  if (tier !== "positive" && tier !== "perfect") return null;
  const hard = person.tempers.some(t => SECOND_TRY_HARD_TEMPERS.has(t));
  const mood = hard ? SECOND_TRY_HARD_MOOD : SECOND_TRY_MOOD;
  const she = ta(person);
  return { mood, line: tier === "perfect"
    ? `${she}已经认准${SHELF[triedId as ShelfId].short}。再换一支若没试到正中，${she}会觉得你不信自己的判断（人情 ${mood}）。`
    : `${she}已经点过头。再换一支若没试到正中，${she}会觉得你拿不准（人情 ${mood}）。` };
}

/** 试一支在她手背上：她的反应把这一支落在哪一档说出来。碰到她的忌讳，忌讳也一起露出来。 */
export function tryOn(c: Consult, person: Person, id: ShelfId): Consult {
  if (!person.skin || c.patience <= 0 || c.tried[id]) return c;
  const score = fitOfPerson(person, id);
  const tier = shelfFitTier(score);
  const veto = person.skin.veto;
  const hitVeto = !!veto && SHELF[id].traits[veto.trait] < veto.below;
  const best = perfectShelf(person);
  const perfect = !hitVeto && tier === "positive" && best === id;
  const cheaperPerfect = !hitVeto && !perfect && tier === "positive" && score >= PERFECT_MATCH
    && !!best && SHELF[best].price < SHELF[id].price;
  const she = ta(person);
  const lead = `你把${SHELF[id].short}抹在${she}手背上，${she}`;
  const line = hitVeto ? `${lead}一下就缩回去了：「${veto!.note}。」`
    : perfect ? `${lead}看了好一会儿：「就是这个感觉。」`
    : cheaperPerfect ? `${lead}点点头：「这个也可以，不过还有一支更省。」`
    : tier === "positive" ? `${lead}点点头：「这个可以。」`
    : tier === "mixed" ? `${lead}犹豫了一下：「还行吧，不是最想要的。」`
    : `${lead}摇头：「这个解决不了我的事。」`;
  const mark: TrialTier = perfect ? "perfect" : tier;
  const risk = secondTryRisk(c, person, id);
  const risky = !!risk && mark !== "perfect";
  const reacted = risky ? `${line} ${she}把话收回去：「刚才那支不是挺好吗？」` : line;
  return spend(c, person, reacted, { tried: { ...c.tried, [id]: mark }, vetoKnown: c.vetoKnown || hitVeto,
    mood: c.mood + (risky ? risk!.mood : 0), risked: c.risked || risky,
    matched: c.matched || mark === "perfect" });
}

/** 那句"她像是还有顾虑"还念不念：诉求没摸全、今天的重点没摸清，也还没试到正中那一支。 */
export const stillHolding = (c: Consult, person: Person): boolean =>
  !!person.skin && !c.matched && (c.known.length < person.skin.demands.length || (!!c.focus && !c.focusKnown));

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

/** 试过的货在格子上留一个字：正中那支与「这个可以」分开写，货架格子与开单提示共用这份措辞。 */
export const TRIED_MARK: Record<TrialTier, string> = { perfect: "认准了", positive: "点头", mixed: "犹豫", negative: "摇头" };

// 客情笔记是玩家实际听见的事实，不存预算与试用的最优答案。人物表变动时按当前需求过滤。
export const CLIENT_NOTE_PREFIX = "client-note:";
const noteKey = (id: PersonId, fact: string) => `${CLIENT_NOTE_PREFIX}${id}:${fact}`;
export const TRAIT_LABEL: Record<Trait, string> = {
  natural: "轻薄自然", correct: "当天见效", soothe: "舒缓泛红", steady: "温和不闷", wear: "长效持妆",
};
export function clientNotes(world: World, person: Person): Pick<Consult, "known" | "vetoKnown" | "unitsKnown"> {
  return {
    known: (person.skin?.demands ?? []).filter(d => world.qualities[noteKey(person.id, d.trait)] === 1).map(d => d.trait),
    vetoKnown: !!person.skin?.veto && world.qualities[noteKey(person.id, "veto")] === 1,
    unitsKnown: world.qualities[noteKey(person.id, "units")] === 1,
  };
}

/** 第一次实际观察/询问/试用后记笔记；只打开面板不能免费获知新事实。
 *  过滤按"她这个人"的长期诉求表（含人生那一步添上的），不按当天情境临时添的那一条 ——
 *  否则她走到新一步以后多出来的头等事，玩家问出来了也记不住，明天又得重新问一遍。 */
export function rememberConsult(world: World, person: Person, consult: Consult): World {
  if (!consult.begun || consult.person !== person.id) return world;
  const permanent = lifePerson(world, person);
  const facts = [...consult.known.filter(t => permanent.skin?.demands.some(d => d.trait === t)),
    ...(consult.vetoKnown && permanent.skin?.veto ? ["veto"] : []), ...(consult.unitsKnown ? ["units"] : [])];
  const added = facts.filter(f => world.qualities[noteKey(person.id, f)] !== 1);
  return added.length ? { ...world, qualities: { ...world.qualities,
    ...Object.fromEntries(added.map(f => [noteKey(person.id, f), 1])) } } : world;
}

/** 开单前只对照玩家已经知道的事实；不调用完整适配分，不泄露隐藏诉求或未来退货抽签。 */
export function offerEvidence(c: Consult, person: Person, id: ShelfId, units: number): string[] {
  if (!person.skin) return [];
  const item = SHELF[id], lines: string[] = [];
  const risk = secondTryRisk(c, person, id);
  if (risk) lines.push(risk.line);
  const missed = c.known.filter(t => item.traits[t] === 0);
  if (missed.length) lines.push(`已知缺口：这支接不住「${missed.map(t => TRAIT_LABEL[t]).join("、")}」。`);
  const veto = person.skin.veto;
  if (c.vetoKnown && veto && item.traits[veto.trait] < veto.below) lines.push(`碰到已知底线：${veto.note}`);
  if (item.price > person.skin.budget) lines.push("一件就超预算，正常推荐也开不成。可以换便宜的，或今天先不卖。");
  else if (item.price * units > person.skin.budget) lines.push(`总价超预算，正常推荐最多买得起 ${Math.floor(person.skin.budget / item.price)} 件。`);
  if (c.unitsKnown && units > person.skin.maxUnits) lines.push(`只想带 ${person.skin.maxUnits} 件；多开口不会多卖，还会伤人情。`);
  if (c.tried[id]) lines.push(`试用反应：${ta(person)}${TRIED_MARK[c.tried[id]!] }。`);
  else lines.push("这支还没试过，可以花 1 次耐心验证，也可以直接开口推荐。");
  if (c.focus && !c.focusKnown) lines.push("今天的重点还没摸清：看一处或问一句，可能就在她今天的状态里。");
  if (!perfectShelf(person)) lines.push("她今天没有一支能全接住；最接近的一支也只能到「对症」，不会到「正中」。");
  if (stillHolding(c, person)) lines.push("还有没说出的顾虑，已知线索对上也不保证成交。");
  return lines;
}

type SavedConsults = { season: number; day: number; slot: number; entries: Record<PersonId, Consult> };
export const saveConsults = (world: World, entries: Record<PersonId, Consult>): SavedConsults =>
  ({ season: world.season, day: world.day, slot: world.slot, entries });
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** 旧档没有这一格仍可继续；坏记录只丢当前接待，不丢整季。日期不同绝不续用已付费状态。 */
export function restoreConsults(data: unknown, world: World, people: Person[]): Record<PersonId, Consult> {
  if (!record(data) || data.season !== world.season || data.day !== world.day || data.slot !== world.slot || !record(data.entries)) return {};
  const out: Record<PersonId, Consult> = {};
  for (const [id, value] of Object.entries(data.entries)) {
    const p = people.find(x => x.id === id);
    if (!p?.skin || !world.present[id] || !record(value) || value.person !== id) continue;
    const live = visitPerson(world, p);
    const v = value;
    const strList = (x: unknown): x is string[] => Array.isArray(x) && x.length <= 64 && x.every(y => typeof y === "string" && y.length < 2000);
    if (v.stage !== "listen" && v.stage !== "offer" || v.product !== null && (typeof v.product !== "string" || !Object.hasOwn(SHELF, v.product))) continue;
    if (!Number.isInteger(v.units) || Number(v.units) < 1 || Number(v.units) > 4 || !Number.isInteger(v.patience) || Number(v.patience) < 0 || Number(v.patience) > CONSULT_PATIENCE + 1) continue;
    if (typeof v.begun !== "boolean" || v.begun && !world.touched.includes(id)) continue;
    if (![v.vetoKnown, v.unitsKnown, v.matched].every(x => typeof x === "boolean") || !strList(v.looked) || !strList(v.asked) || !strList(v.known) || !strList(v.lines)) continue;
    if (v.risked !== undefined && typeof v.risked !== "boolean") continue;
    // 旧存档没有 focus / focusKnown：按"这一单没有今天的重点"接上，不丢整段接待。
    if (v.focus !== undefined && v.focus !== null
      && (!TRAIT_ORDER.includes(v.focus as Trait) || !live.skin!.demands.some(d => d.trait === v.focus))) continue;
    if (v.focusKnown !== undefined && typeof v.focusKnown !== "boolean") continue;
    if (!v.looked.every(k => spotsOf(live).some(s => s.key === k)) || !v.asked.every(k => questionsOf(live).some(q => q.key === k)) || !v.known.every(t => live.skin!.demands.some(d => d.trait === t))) continue;
    // 旧存档没有 excluded：按「还没排除过」接上；有这一格就必须是真的诉求词，且不能和她真有的需求打架。
    const excluded = v.excluded === undefined ? [] : Array.isArray(v.excluded) && v.excluded.every(t => TRAIT_ORDER.includes(t as Trait))
      ? [...new Set(v.excluded as Trait[])] : null;
    if (!excluded || excluded.some(t => live.skin!.demands.some(d => d.trait === t)
      || live.skin!.veto?.trait === t || (v.known as string[]).includes(t))) continue;
    if (!record(v.tried) || !Object.entries(v.tried).every(([k, tier]) => Object.hasOwn(SHELF, k)
      && typeof tier === "string" && ["perfect", "positive", "mixed", "negative"].includes(tier))) continue;
    if (typeof v.mood !== "number" || !Number.isFinite(v.mood) || v.mood > 0 || v.mood < -30) continue;
    out[id] = { ...v, excluded, focus: (v.focus as Trait | null | undefined) ?? null,
      focusKnown: v.focusKnown === true && !!v.focus, risked: v.risked === true } as Consult;
  }
  return out;
}

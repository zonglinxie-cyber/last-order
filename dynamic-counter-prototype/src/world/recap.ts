// 季末回顾的规则层：从 World + 人物 + 故事碎片算出这一季值得记住的事，全是纯函数。
// WorldGame 的季末页只念这里给出的句子，不自己拼。
//
// 高光时刻的挑选规则（定一次，别处照念）：
//   六类优先，按这个顺序挑、每类最多两条 —— 个人线落点、拿到或失去盟友的那一刻、
//   秘密揭开或泄露、大单成交、被陆遥请走的人里你最在意的那位（这一类只留一条）、
//   委托做到或失约的大事。总数封顶 8 条；六类挑完不足 5 条时，用其他"有记性"的
//   现场句子补 —— 退货、拌嘴、牵线、劝和、背后嘀咕、搭把手、小样、开口托事、
//   说好要来、看走眼，各小类同样不超两条。挑完按天排：时间轴从第 1 天讲到散场。
//   个人线落点和委托优先用 log 里的原句；原句认不回来（多槽卡的绑定没留下）就合成一句。
import { opinionOf, personOf, PLAYER_NAME } from "./engine.ts";
import { ARC_PEOPLE, arcLandings } from "./progress.ts";
import { actWord } from "./ui/words.ts";
import type { Choice, LogEntry, Person, PersonId, Storylet, World } from "./types.ts";
import { PLAYER } from "./types.ts";

/** 盟友/仇人这条线，和 seasonSummary 同一个口径。 */
export const RECAP_ALLY_OPINION = 40;
export const RECAP_ENEMY_OPINION = -30;
/** 高光总数：挑满封顶、挑不满的下限（不足就是这一季真的没发生什么）。 */
export const RECAP_HIGHLIGHT_MAX = 8;
export const RECAP_HIGHLIGHT_MIN = 5;
/** 变化榜取前三个。 */
export const RECAP_MOVERS = 3;

export type HighlightKind = "arc" | "ally" | "secret" | "sale" | "poach" | "request" | "beat";

export type RecapHighlight = {
  kind: HighlightKind;
  day: number;
  text: string;
  /** 这条事里的人（log 自带的 who，或委托/落点合成时的当事人）。 */
  who: PersonId[];
};

/** 你的人 / 记着你的人：每人一句 —— 她记着的关于你的最重那条记忆。 */
export type RecapPerson = {
  id: PersonId;
  /** actWord 念出的那句话；听来的一句前面有「听 X 说」。 */
  line: string;
  /** 那件事发生在第几天。 */
  day: number;
};

export type RecapMover = {
  id: PersonId;
  /** 季初快照里的看法；快照里没有这个人（新面孔或旧档）按没见过念。 */
  from?: number;
  to: number;
};

export type RecapArc = {
  id: PersonId;
  /** 档案里同一个落点标题（progress.ts 的 arcLandings）。 */
  title: string;
  /** 落到这一档的那一天；上一季落定的（fired 已被换季清掉）没有这天。 */
  day?: number;
};

export type RecapStat = { value: number; line: string };

export type SeasonRecap = {
  highlights: RecapHighlight[];
  allies: RecapPerson[];
  remembered: RecapPerson[];
  movers: RecapMover[];
  arcs: RecapArc[];
  stats: { money: RecapStat; standing: RecapStat; compliance: RecapStat };
};

// —— 挑选高光：候选 -> 限类 -> 限数 ——

type Cand = {
  /** 限类按这个 key 数：六个优先类各一 key，补位的 beat 各小类各一 key。 */
  group: string;
  kind: HighlightKind;
  pri: number;   // 组内谁先谁后，越小越先
  day: number;
  slot: number;
  seq: number;   // log 里的序号，同一天同 slot 按先后定序
  text: string;
  who: PersonId[];
};

const nameOf = (people: Person[], id: PersonId): string => personOf(people, id)?.name ?? id;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 卡的结果句回到 log 里找原句：钉死的槽还成真人名，没钉死的槽用短通配。 */
function matchLogLine(world: World, choice: Choice, day: number): LogEntry | undefined {
  const src = choice.result.split(/(\{player\}|\{\$\w+\})/g).map(part =>
    part === "{player}" ? escapeRe(PLAYER_NAME)
      : /^\{\$\w+\}$/.test(part) ? ".{1,14}?" : escapeRe(part)).join("");
  const re = new RegExp(`^${src}$`);
  return world.log.find(l => l.day === day && re.test(l.text));
}

/** 个人线落点那一幕：把「arc:<id>:end」钉到当前档的那张卡，fired 里找得到才算这一季的事。 */
function arcMoment(world: World, people: Person[], storylets: Storylet[], id: PersonId, end: number): Cand | undefined {
  const key = `arc:${id}:end`;
  const title = arcLandings(storylets, id).find(l => l.landing === end)?.title;
  let best: Cand | undefined;
  for (const st of storylets) {
    const day = world.fired[st.id];
    if (day === undefined) continue;
    for (const choice of st.choices) {
      if (!choice.effects.some(e => "quality" in e && e.quality === key && e.set === end)) continue;
      const hit = matchLogLine(world, choice, day);
      const cand: Cand = {
        group: "arc", kind: "arc", pri: 0, day,
        slot: hit?.slot ?? 0, seq: hit ? world.log.indexOf(hit) : -1,
        text: hit?.text ?? `${nameOf(people, id)}的这条线落到了「${title ?? `第 ${end} 档`}」。`,
        who: hit?.who ?? [id],
      };
      // 同一条线可能几张卡都能落到这一档：认得出原句的优先，其次看哪张是后来开的。
      const score = (c: Cand) => (c.seq >= 0 ? 1_000 : 0) + c.day;
      if (!best || score(cand) > score(best)) best = cand;
    }
  }
  return best;
}

// log 里哪一类：先落进六类优先，落不进的看补位白名单，都不行就是流水账。
const SALE_RE = /进账 ¥([\d,]+)/;
const POACH_RE = /请去了对面维珞/;
const SECRET_RES: Array<[RegExp, number]> = [
  [/嘴里听到了自己的秘密/, 0], // 漏出去的回了头
  [/的事说给了.+?听/, 1],      // 你亲口说出去的
  [/你听说了.+?的事/, 2],      // 当场揭开
];
const ALLY_RES: Array<[RegExp, number]> = [
  [/替你说了句好话/, 0],
  [/这层有个靠谱的人/, 0],
  [/沉着脸要走/, 0],           // 气走：失去盟友的那一刻
  [/理都不理你/, 0],           // 翻脸不认人
  [/加了你微信/, 1],           // 加微信是"站你这边"的仪式，但比上面几件轻
];
const BEAT_RES: Array<[string, RegExp]> = [
  ["refund", /把那单硬推的货退了回来/],
  ["quarrel", /当场拌起了嘴/],
  ["introduce", /聊开了|较上了劲|场面有点僵/],
  ["mediate", /打了圆场|把火撒到你身上/],
  ["backbite", /嘀咕你/],
  ["help", /接了一截/],
  ["sample", /塞给.+小样/],
  ["ask", /点了你的名|把你拉到一边|凑过来小声说|拉了你一下|跟你说：这层|压低声音|发来微信/],
  ["return", /在微信里说过几天再来|如约来了/],
  ["miss", /解决不了我的事/],
];

function classify(entry: LogEntry): { group: string; kind: HighlightKind; pri: number } | undefined {
  if (POACH_RE.test(entry.text)) return { group: "poach", kind: "poach", pri: 0 };
  const sale = SALE_RE.exec(entry.text);
  if (sale) return { group: "sale", kind: "sale", pri: -Number(sale[1]!.replaceAll(",", "")) }; // 金额越大越先
  for (const [re, pri] of SECRET_RES) if (re.test(entry.text)) return { group: "secret", kind: "secret", pri };
  for (const [re, pri] of ALLY_RES) if (re.test(entry.text)) return { group: "ally", kind: "ally", pri };
  for (const [sub, re] of BEAT_RES) if (re.test(entry.text)) return { group: `beat:${sub}`, kind: "beat", pri: 0 };
  return undefined;
}

function highlightCandidates(world: World, people: Person[], storylets: Storylet[]): Cand[] {
  const out: Cand[] = [];
  const usedLines = new Set<number>();

  // 个人线落点：fired 里找得到当天的才算这一季的高光；落点在走完的线里照样念。
  for (const id of ARC_PEOPLE) {
    const end = world.qualities[`arc:${id}:end`] ?? 0;
    if (end < 1) continue;
    const c = arcMoment(world, people, storylets, id, end);
    if (!c) continue;
    if (c.seq >= 0) usedLines.add(c.seq);
    out.push(c);
  }

  // log 里逐条归类；已被落点认走的句子不再进别的类。
  world.log.forEach((entry, seq) => {
    if (usedLines.has(seq)) return;
    const hit = classify(entry);
    if (!hit) return;
    out.push({ ...hit, day: entry.day, slot: entry.slot, seq, text: entry.text, who: entry.who ?? [] });
  });

  // 被陆遥请走的人里，只留"你最在意"的一位：季末她对你看法最高的那个。
  const poached = out.filter(c => c.kind === "poach");
  if (poached.length > 1) {
    const caredId = (c: Cand): PersonId | undefined => {
      // log 里 who 是 [陆遥, 被请走的她]；没写 who 就从「你没顾上 X」把名字对回来。
      const byWho = c.who.find(id => personOf(people, id)?.role !== "rival");
      if (byWho) return byWho;
      const name = /你没顾上(.+?)，/.exec(c.text)?.[1];
      return name ? people.find(p => p.name === name)?.id : undefined;
    };
    const keep = poached.reduce((a, b) =>
      opinionOf(world, caredId(b) ?? "") > opinionOf(world, caredId(a) ?? "") ? b : a);
    for (const c of poached) if (c !== keep) out.splice(out.indexOf(c), 1);
  }

  // 委托做到或失约：从 requests 合成（一句话里要有托付人 + 原文 + 结果），日期记到期那天。
  const settled = world.requests.filter(r => r.state === "done" || r.state === "failed");
  const pick: typeof settled = [];
  const doneLatest = settled.filter(r => r.state === "done").sort((a, b) => b.due - a.due)[0];
  const failLatest = settled.filter(r => r.state === "failed").sort((a, b) => b.due - a.due)[0];
  if (doneLatest) pick.push(doneLatest);
  if (failLatest) pick.push(failLatest);
  for (const r of settled.sort((a, b) => b.due - a.due)) {
    if (pick.length >= 2) break;
    if (!pick.includes(r)) pick.push(r);
  }
  for (const r of pick) {
    out.push({
      group: "request", kind: "request", pri: r.state === "done" ? 0 : 1,
      day: r.due, slot: 3, seq: -1,
      text: `${nameOf(people, r.by)}托你「${r.text}」，${r.state === "done" ? "你做到了" : "你失约了"}。`,
      who: [r.by, ...(r.target ? [r.target] : [])],
    });
  }
  return out;
}

/** 限类限数挑高光：六类优先按顺序各取 ≤2（poach 只有一位），不够 5 条再拿补位句凑。 */
export function pickHighlights(world: World, people: Person[], storylets: Storylet[]): RecapHighlight[] {
  const cands = highlightCandidates(world, people, storylets);
  const count = new Map<string, number>();
  const taken: Cand[] = [];
  const capOf = (group: string) => (group === "poach" ? 1 : 2);
  const take = (c: Cand) => {
    const n = count.get(c.group) ?? 0;
    if (taken.length >= RECAP_HIGHLIGHT_MAX || n >= capOf(c.group)) return false;
    count.set(c.group, n + 1);
    taken.push(c);
    return true;
  };
  // 六类优先：按类的固定顺序过一遍，类内按 pri 再按天。
  for (const group of ["arc", "ally", "secret", "sale", "poach", "request"] as const) {
    for (const c of cands.filter(x => x.group === group).sort((a, b) => a.pri - b.pri || a.day - b.day || a.seq - b.seq)) take(c);
  }
  // 不足下限就用别的"有记性"的句子补，按天先后来。
  if (taken.length < RECAP_HIGHLIGHT_MIN) {
    for (const c of cands.filter(x => x.kind === "beat").sort((a, b) => a.day - b.day || a.seq - b.seq)) {
      if (taken.length >= RECAP_HIGHLIGHT_MIN) break;
      take(c);
    }
  }
  return taken
    .sort((a, b) => a.day - b.day || a.slot - b.slot || a.seq - b.seq)
    .map(({ kind, day, text, who }) => ({ kind, day, text, who }));
}

// —— 你的人 / 记着你的人 ——

/** 她记着的最重那一条关于你的记忆：极端的先算，新的先算。
    行只出 actWord 那半句（主语是"你"），"她记着你"/"她听 X 说"由界面接在人名后面。 */
function reasonLine(world: World, people: Person[], id: PersonId, sign: 1 | -1): RecapPerson | undefined {
  const mems = world.memories.filter(m => m.holder === id && m.subject === PLAYER
    && (sign === 1 ? m.valence > 0 : m.valence < 0));
  if (!mems.length) return undefined;
  const top = mems.sort((a, b) => Math.abs(b.valence) - Math.abs(a.valence) || b.day - a.day)[0]!;
  return {
    id,
    line: `${top.heardFrom ? `听${nameOf(people, top.heardFrom)}说，` : "记着"}你${actWord(top.act)}`,
    day: top.day,
  };
}

// —— 三个数字的一句话 ——

const moneyWord = (money: number): string =>
  money <= 0 ? "一单没开，柜上的账是空的"
    : money >= 40_000 ? "够得上这面柜少见的大季"
    : money >= 20_000 ? "柜上的日子过下来了"
    : "一单是一单，都记在小票上";

/** 「比开季高了 12」那一句；旧档没有季初快照就只念收在哪个位置。 */
const deltaWord = (now: number, start?: number): string =>
  start === undefined
    ? now >= 60 ? "散场时在这层站住了" : now >= 40 ? "不上不下，下一季再做" : "塌下去了，下一季从头抬"
    : now > start ? `比开季高了 ${now - start}`
    : now < start ? `比开季低了 ${start - now}`
    : "和开季齐平";

// —— 一季回顾 ——

export function seasonRecap(world: World, people: Person[], storylets: Storylet[]): SeasonRecap {
  const snapshot = world.opinionAtSeasonStart ?? {};

  const allies = people
    .filter(p => opinionOf(world, p.id) >= RECAP_ALLY_OPINION)
    .sort((a, b) => opinionOf(world, b.id) - opinionOf(world, a.id) || a.id.localeCompare(b.id))
    .map(p => reasonLine(world, people, p.id, 1)
      ?? { id: p.id, line: "说不上哪一件事，就是认你这个人", day: world.day });
  const remembered = people
    .filter(p => opinionOf(world, p.id) <= RECAP_ENEMY_OPINION)
    .sort((a, b) => opinionOf(world, a.id) - opinionOf(world, b.id) || a.id.localeCompare(b.id))
    .map(p => reasonLine(world, people, p.id, -1)
      ?? { id: p.id, line: "说不上哪一件事，就是跟你合不来", day: world.day });

  const movers = people
    .map(p => ({ id: p.id, from: snapshot[p.id], to: opinionOf(world, p.id) }))
    .filter(m => (m.from ?? 0) !== m.to)
    .sort((a, b) => Math.abs(b.to - (b.from ?? 0)) - Math.abs(a.to - (a.from ?? 0)) || a.id.localeCompare(b.id))
    .slice(0, RECAP_MOVERS);

  const arcs: RecapArc[] = [];
  for (const id of ARC_PEOPLE) {
    const end = world.qualities[`arc:${id}:end`] ?? 0;
    if (end < 1) continue;
    const title = arcLandings(storylets, id).find(l => l.landing === end)?.title ?? `第 ${end} 档`;
    const moment = arcMoment(world, people, storylets, id, end);
    arcs.push({ id, title, day: moment?.day });
  }
  arcs.sort((a, b) => (b.day ?? 0) - (a.day ?? 0) || a.id.localeCompare(b.id));

  const statsStart = world.statsAtSeasonStart;
  return {
    highlights: pickHighlights(world, people, storylets),
    allies, remembered, movers, arcs,
    stats: {
      money: { value: world.money, line: moneyWord(world.money) },
      standing: { value: world.standing, line: deltaWord(world.standing, statsStart?.standing) },
      compliance: { value: world.compliance, line: deltaWord(world.compliance, statsStart?.compliance) },
    },
  };
}

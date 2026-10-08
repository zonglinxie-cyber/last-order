// 在场的人自己动手：NPC 对 NPC 的自主社交动作，ambient 在时段末调一次。
// 参照 Comme il Faut 的社交物理：每种动作只写"谁会对谁做、做完改什么"，触发不看剧本，
// 看两人的脾气、关系和记忆。同一种子结果逐位相同 —— 所有抽数都走 (seed, rngCalls)。
// 约束：每个时段最多 MAX_EXCHANGES_PER_SLOT 次；同一对人同一天同一种动作只来一次。
// 这里的 helpers 全部从 engine.ts 拿（同一个物理），两个文件互相 import，但谁都不在
// 模块顶层调对方的函数，加载顺序无所谓。
import {
  GOSSIP_OPINION, PLAYER_NAME, WARY_HEARSAY_MULT,
  addOpinion, addWarmth, hasTemper, kindOf, opinionOf, personOf, qualityOf, related,
  remember, roll, say, setQuality, warmthOf,
} from "./engine.ts";
import { drawIndex } from "./rng.ts";
import type { BondKind, Person, PersonId, World } from "./types.ts";
import { PLAYER } from "./types.ts";

// —— 六种动作与它们的旋钮 ——

export type ExchangeAct = "pull" | "quarrel" | "backbite" | "oneup" | "vouch" | "chat";
/** 同对人凑出候选时按这个顺序排（前面的先被抽到）；也是模拟器报数的顺序。 */
export const EXCHANGE_ACTS: ExchangeAct[] = ["pull", "quarrel", "backbite", "oneup", "vouch", "chat"];

/** 每个时段最多触发这么多次，免得楼层上全是别人在做戏。 */
export const MAX_EXCHANGES_PER_SLOT = 2;

// 拉人：对你怨气攒够的顾客待不下去要走，她的闺蜜/家人/伴侣跟着一起走 —— "走一双"。
export const PULL_OPINION = -35;        // a 对你的看法低过这条线才会甩头走
export const PULL_MIN_WARMTH = 30;      // b 跟她够亲（任意一头到这线）才跟着走
export const PULL_FOLLOW_OPINION = -3;  // 跟着走的人把你的账也记了一笔
export const PULL_CHANCE = 0.7;
const PULL_KINDS: BondKind[] = ["family", "friend", "partner"];

// 拌嘴：任意一头冷到这条线以下，同场就压不住火；记下 quarrel:<a>:<b>=当天，楼层冒火、可打圆场。
export const QUARREL_WARMTH = -20;
export const QUARREL_WARMTH_DROP = 6;
export const QUARREL_CHANCE = 0.5;

// 背后抱怨：对你结了怨的人向她的熟人嚼舌根，生成一条"听来的"负面记忆，传话系统接着往下传。
export const BACKBITE_OPINION = -30;    // a 对你的看法低过这条线才开口抱怨
export const BACKBITE_CHANCE = 0.55;

// 较劲：两个好胜的人同场就杠；谁对你看法高，另一个觉得你向着她，对你也降一点。
export const ONE_UP_WARMTH_DROP = 4;
export const ONE_UP_OPINION = -3;
export const ONE_UP_CHANCE = 0.45;

// 替你说话：看法够高的热心肠/念旧的人，对一个对你有戒心的熟人替你美言；对方多疑就打折。
export const VOUCH_MIN_OPINION = 40;
export const VOUCH_TARGET_OPINION = 0;  // 对方对你看法低于这条线才有得劝
export const VOUCH_OPINION = 8;
export const VOUCH_CHANCE = 0.5;

// 闲聊：双向都不冷的熟人凑在一起，冷暖慢慢变暖。今天刚拌过嘴的聊不起来。
export const CHAT_MIN_WARMTH = 10;
export const CHAT_WARMTH = 3;
export const CHAT_CHANCE = 0.55;

// —— 键：dedup、计数、拌嘴状态 ——

const pairOf = (a: PersonId, b: PersonId): [PersonId, PersonId] => (a < b ? [a, b] : [b, a]);
/** "同一对人"不分方向：dedup 与冒火都用排序后的 key。 */
export const quarrelKey = (a: PersonId, b: PersonId) => `quarrel:${pairOf(a, b).join(":")}`;
const doneKey = (act: ExchangeAct, a: PersonId, b: PersonId) => `ex:${act}:${pairOf(a, b).join(":")}`;
const tallyKey = (act: ExchangeAct) => `exn:${act}`;

/** 此刻正在拌嘴的两对人：当天记下、且两人都还在场（走了就不冒火）。 */
export function quarrelPairs(world: World): Array<[PersonId, PersonId]> {
  const out: Array<[PersonId, PersonId]> = [];
  for (const [key, v] of Object.entries(world.qualities)) {
    if (!key.startsWith("quarrel:") || v !== world.day) continue;
    const [, a, b] = key.split(":");
    if (a && b && a in world.present && b in world.present) out.push([a, b]);
  }
  return out;
}

/** 这个人有没有正在跟人拌嘴 —— 有的话返回对方 id，界面靠它冒火。 */
export const quarrelPartner = (world: World, id: PersonId): PersonId | undefined =>
  quarrelPairs(world).find(([a, b]) => a === id || b === id)?.find(p => p !== id);

/** 圆场打成（或别的什么把这页翻过去）时摘掉火气标记；明天再来它就是旧账，自动不算数。 */
export const clearQuarrel = (w: World, a: PersonId, b: PersonId): World => {
  const key = quarrelKey(a, b);
  if (!(key in w.qualities)) return w;
  const qualities = { ...w.qualities };
  delete qualities[key];
  return { ...w, qualities };
};

/** 每种动作这一季发生了几次。exn: 不在跨季保留名单里，换季自动清零。 */
export function exchangeTally(world: World): Record<ExchangeAct, number> {
  const out = {} as Record<ExchangeAct, number>;
  for (const act of EXCHANGE_ACTS) out[act] = qualityOf(world, tallyKey(act));
  return out;
}

// —— 各动作的门槛与后果 ——

const minWays = (w: World, people: Person[], a: PersonId, b: PersonId) =>
  Math.min(warmthOf(w, people, a, b), warmthOf(w, people, b, a));
/** 听的人信不信，看她跟说的人亲不亲 —— 和传话同一条信任公式。 */
const trustOf = (w: World, people: Person[], listener: PersonId, speaker: PersonId) =>
  0.2 + 0.8 * ((Math.min(100, Math.max(-100, warmthOf(w, people, listener, speaker))) + 100) / 200);

type Spec = {
  chance: number;
  /** 有向动作同一对人可以出两个朝向的候选；dedup 保证同一天只做一次。 */
  directed?: boolean;
  ok: (w: World, people: Person[], a: PersonId, b: PersonId) => boolean;
  run: (w: World, people: Person[], a: PersonId, b: PersonId) => World;
};

const SPECS: Record<ExchangeAct, Spec> = {
  pull: {
    chance: PULL_CHANCE, directed: true,
    ok: (w, people, a, b) => {
      const pa = personOf(people, a), pb = personOf(people, b);
      if (pa?.role !== "customer" || pb?.role !== "customer") return false;
      // 已经被请去对面的不算"要走" —— 她人都不在你这边了。
      if (w.present[a] === "rival" || w.present[b] === "rival") return false;
      if (opinionOf(w, a) > PULL_OPINION) return false;
      const kind = kindOf(w, people, a, b) ?? kindOf(w, people, b, a);
      return !!kind && PULL_KINDS.includes(kind)
        && Math.max(warmthOf(w, people, a, b), warmthOf(w, people, b, a)) >= PULL_MIN_WARMTH;
    },
    run: (w, people, a, b) => {
      const pa = personOf(people, a)!, pb = personOf(people, b)!;
      const present = { ...w.present };
      delete present[a]; delete present[b];
      w = { ...w, present };
      // 今天不再回来 —— 和陆遥带走人用的是同一条 away 记法。
      w = setQuality(w, `away:${a}`, w.day);
      w = setQuality(w, `away:${b}`, w.day);
      w = remember(w, a, "walked-out", -1);
      w = addOpinion(w, b, PULL_FOLLOW_OPINION);
      w = remember(w, b, "stormed-off", -1); // 她就在场看着，算亲眼所见
      return say(w, `${pa.name}沉着脸要走，${pb.name}抓起东西跟着她一起走了。`, [a, b]);
    },
  },
  quarrel: {
    chance: QUARREL_CHANCE,
    ok: (w, people, a, b) => minWays(w, people, a, b) < QUARREL_WARMTH,
    run: (w, people, a, b) => {
      const pa = personOf(people, a)!, pb = personOf(people, b)!;
      w = addWarmth(w, people, a, b, -QUARREL_WARMTH_DROP);
      w = addWarmth(w, people, b, a, -QUARREL_WARMTH_DROP);
      w = setQuality(w, quarrelKey(a, b), w.day);
      w = remember(w, a, "quarreled", -1, b);
      w = remember(w, b, "quarreled", -1, a);
      return say(w, `${pa.name}和${pb.name}当场拌起了嘴，谁也不让谁。`, [a, b]);
    },
  },
  backbite: {
    chance: BACKBITE_CHANCE, directed: true,
    ok: (w, people, a, b) => opinionOf(w, a) <= BACKBITE_OPINION && warmthOf(w, people, a, b) > 0,
    run: (w, people, a, b) => {
      const pa = personOf(people, a)!, pb = personOf(people, b)!;
      w = addOpinion(w, b, -GOSSIP_OPINION * trustOf(w, people, b, a) * (hasTemper(pb, "wary") ? WARY_HEARSAY_MULT : 1));
      w = remember(w, b, "badmouthed", -1, PLAYER, a);
      const line = pa.voice.complain.replaceAll("{player}", PLAYER_NAME).replaceAll("{x}", pb.name);
      return say(w, `${pa.name}拉着${pb.name}嘀咕你：「${line}」`, [a, b]);
    },
  },
  oneup: {
    chance: ONE_UP_CHANCE,
    ok: (w, people, a, b) => hasTemper(personOf(people, a), "proud") && hasTemper(personOf(people, b), "proud"),
    run: (w, people, a, b) => {
      const pa = personOf(people, a)!, pb = personOf(people, b)!;
      w = addWarmth(w, people, a, b, -ONE_UP_WARMTH_DROP);
      w = addWarmth(w, people, b, a, -ONE_UP_WARMTH_DROP);
      w = remember(w, a, "one-upping", -1, b);
      w = remember(w, b, "one-upping", -1, a);
      const oa = opinionOf(w, a), ob = opinionOf(w, b);
      if (oa === ob) return say(w, `${pa.name}和${pb.name}暗暗较上了劲，谁也不服谁。`, [a, b]);
      const loser = oa < ob ? pa : pb;
      w = addOpinion(w, loser.id, ONE_UP_OPINION);
      return say(w, `${pa.name}和${pb.name}暗暗较上了劲，${loser.name}觉得你更向着对方。`, [a, b]);
    },
  },
  vouch: {
    chance: VOUCH_CHANCE, directed: true,
    ok: (w, people, a, b) =>
      opinionOf(w, a) >= VOUCH_MIN_OPINION && opinionOf(w, b) < VOUCH_TARGET_OPINION
      && (hasTemper(personOf(people, a), "warm") || hasTemper(personOf(people, a), "loyal"))
      && warmthOf(w, people, b, a) > 0,
    run: (w, people, a, b) => {
      const pa = personOf(people, a)!, pb = personOf(people, b)!;
      w = addOpinion(w, b, VOUCH_OPINION * trustOf(w, people, b, a) * (hasTemper(pb, "wary") ? WARY_HEARSAY_MULT : 1));
      w = remember(w, b, "vouched-for", 1, PLAYER, a);
      const line = pa.voice.praise.replaceAll("{player}", PLAYER_NAME).replaceAll("{x}", pb.name);
      return say(w, `${pa.name}在${pb.name}面前替你说了句好话：「${line}」`, [a, b]);
    },
  },
  chat: {
    chance: CHAT_CHANCE,
    ok: (w, people, a, b) => related(w, people, a, b) && minWays(w, people, a, b) >= CHAT_MIN_WARMTH
      && qualityOf(w, quarrelKey(a, b)) !== w.day,
    run: (w, people, a, b) => {
      const pa = personOf(people, a)!, pb = personOf(people, b)!;
      w = addWarmth(w, people, a, b, CHAT_WARMTH);
      w = addWarmth(w, people, b, a, CHAT_WARMTH);
      return say(w, `${pa.name}和${pb.name}凑在一起聊了一阵，看着更熟了。`, [a, b]);
    },
  },
};

export type ExchangeCandidate = { act: ExchangeAct; a: PersonId; b: PersonId };

/** 此刻全部够格的候选：同对人的候选排在一起（按 EXCHANGE_ACTS 序），有向动作两个朝向都试。 */
export function exchangeCandidates(world: World, people: Person[]): ExchangeCandidate[] {
  const here = people.filter(p => p.id in world.present);
  const out: ExchangeCandidate[] = [];
  for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {
    const a = here[i].id, b = here[j].id;
    for (const act of EXCHANGE_ACTS) {
      const spec = SPECS[act];
      if (qualityOf(world, doneKey(act, a, b)) === world.day) continue;
      if (spec.ok(world, people, a, b)) out.push({ act, a, b });
      if (spec.directed && spec.ok(world, people, b, a)) out.push({ act, a: b, b: a });
    }
  }
  return out;
}

/** 时段末由 ambient 调一次：在够格的候选里抽着做，最多 MAX_EXCHANGES_PER_SLOT 次。 */
export function exchanges(world: World, people: Person[]): World {
  let w = world;
  const cands = exchangeCandidates(w, people);
  if (!cands.length) return w;
  // 从种子定下的起点轮着试 —— 不是总按名单顺序先动谁，同种子仍逐位相同。
  const start = drawIndex(w.seed, w.rngCalls, cands.length);
  w = { ...w, rngCalls: w.rngCalls + 1 };
  const usedPairs = new Set<string>();
  let fired = 0;
  for (let k = 0; k < cands.length && fired < MAX_EXCHANGES_PER_SLOT; k++) {
    const c = cands[(start + k) % cands.length];
    if (usedPairs.has(pairOf(c.a, c.b).join(":"))) continue;
    // 中间有人被拉走/请走的话，后面的候选可能已经不成立 —— 按当下状态重判。
    if (!(c.a in w.present) || !(c.b in w.present)) continue;
    const spec = SPECS[c.act];
    if (qualityOf(w, doneKey(c.act, c.a, c.b)) === w.day || !spec.ok(w, people, c.a, c.b)) continue;
    let r: number; [r, w] = roll(w);
    if (r >= spec.chance) continue;
    w = spec.run(w, people, c.a, c.b);
    w = setQuality(w, doneKey(c.act, c.a, c.b), w.day);
    w = setQuality(w, tallyKey(c.act), qualityOf(w, tallyKey(c.act)) + 1);
    usedPairs.add(pairOf(c.a, c.b).join(":"));
    fired++;
  }
  return w;
}

// 人情场接待：她越信你，说得越多。这条规则只写在这里，界面（WorldGame 的 serve-said）只读不算。
// 卖货判断照旧走 campaign.ts 的 fitScore —— 没说出口的诉求一样参与算分，这里买的只是信息。
import type { Demand, Trait } from "../campaign.ts";
import type { Gender } from "./types.ts";

/** 看法到 10，她肯多讲一条；到 40，全讲，连忌讳也自己说出来。 */
export const TALK_WARM = 10;
export const TALK_OPEN = 40;
export const SPOKEN_WARY = 1;
export const SPOKEN_WARM = 2;
/** ≥40 她这一单要什么都摆出来。 */
export const SPOKEN_ALL = Number.MAX_SAFE_INTEGER;
/** 你知道她的事，她觉得你懂你 —— 在档上多说一条。 */
export const SECRET_EXTRA = 1;

/** 引擎揭开秘密时写的 quality 键（engine 的 beginSlot 与 reveal 效果都是这一串）。 */
export const SECRET_KNOWN_KEY = (id: string) => `secret-known:${id}`;

export const opinionOfTalk = (opinion: number) =>
  opinion >= TALK_OPEN ? SPOKEN_ALL : opinion >= TALK_WARM ? SPOKEN_WARM : SPOKEN_WARY;

/** 她肯说出口的那几条诉求 + 忌讳；unsaid 只用来决定要不要念那句"还有没说的"，界面上不出这个数。 */
export type ServeTalk = { said: Demand[]; unsaid: number; vetoNote: string | null };

export function serveTalk(demands: Demand[], opinion: number, secretKnown: boolean, veto?: { note: string } | null): ServeTalk {
  // 权重高的先说；同权重按她自己的排法。sort 稳定，不会打乱原有次序。
  const ordered = demands.map((demand, i) => ({ demand, i })).sort((a, b) => b.demand.weight - a.demand.weight || a.i - b.i).map(x => x.demand);
  const cap = Math.min(ordered.length, opinionOfTalk(opinion) + (secretKnown ? SECRET_EXTRA : 0));
  return {
    said: ordered.slice(0, cap),
    unsaid: ordered.length - cap,
    vetoNote: opinion >= TALK_OPEN && veto ? veto.note : null,
  };
}

/** 每个 Trait 的口语说法：want=2 是她这一单的头等事，want=1 是顺带一提。这一份表是唯一出处。 */
export const DEMAND_WORDS: Record<Trait, Record<1 | 2, string[]>> = {
  natural: {
    2: [
      "一厚就假，我要看不出来化过",
      "化完得像没化，一眼被看出厚我就不带",
      "我不要人家说我今天妆重，要的是看不出来",
    ],
    1: [
      "顺手就行，别假面",
      "薄一点更好，但不至于为它挑死",
    ],
  },
  correct: {
    2: [
      "当天出门前就要看出变化，慢慢养的我等不了",
      "我要抹完照镜子就有东西，别的听不进去",
    ],
    1: [
      "当天能看点效果，我更愿意带",
      "有点立竿见影的意思，算加分",
    ],
  },
  soothe: {
    2: [
      "两颊干燥泛红，先求把它稳住，别急着盖",
      "脸一干燥泛红就顶不住，这一步不做后面白搭",
      "干燥泛红是我眼下最大的事，别拿厚东西糊我",
    ],
    1: [
      "偶尔干燥泛红，能舒坦点就行",
      "不那么干燥泛红就好，不是头一位",
    ],
  },
  steady: {
    2: [
      "我不敢冒痘，一闷就完，这条我先说",
      "皮肤认生，刺激的我一律不碰",
      "先求不闹脸，闷的东西我不能带",
    ],
    1: [
      "温和点就行，我懒得闹脸",
      "别太冲，这是我顺带的要求",
    ],
  },
  wear: {
    2: [
      "从早带到晚不能斑驳，这是我第一条",
      "一天补不了妆，花了我当场就难看",
    ],
    1: [
      "能撑到下班就够用",
      "别太早花，持妆我没到苛求",
    ],
  },
};

/** 同一条需要，不同的人说法不一样：按人 + 诉求定一个说法，同一副牌重开还是那句。 */
export const demandWords = (personId: string, demand: Demand): string => {
  const list = DEMAND_WORDS[demand.trait][demand.want];
  let h = 0;
  for (const ch of `${personId}:${demand.trait}`) h = (h * 31 + ch.codePointAt(0)!) % 1_000_003;
  return list[h % list.length];
};

/** 没说出口的那部分只说一句话，不报条数。代词按人物性别念。 */
export const unsaidWord = (gender: Gender) => `${gender === "m" ? "他" : "她"}像是还有顾虑，没说出来。`;

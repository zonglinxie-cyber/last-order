// 线索本与主线：贯穿几季的那条悬念，以及玩家一块一块攒出来的证据。
// 契约见 types.ts：效果 {clue:"id"} 记进本子，条件 {clue:"id"} 认本子里有没有。
// 引擎只认 id，文案全在这张表里 —— 界面（档案的「本子」页、季末回顾）也只读这张表。
//
// 一条线什么时候算翻过来，由内容用 quality「thread:<id>」钉：0 是没弄清，≥1 是落点。
// 幕号用 quality「mainline:act」：开局卡把它抬到 1，翻面卡抬到 2，下一幕的卡只在 2 才合法。
// 这样主线不会一次烧完：上一幕没走完，下一幕的卡根本不出现在牌堆里。
import type { PersonId } from "../types.ts";

export const MAINLINE_ACT_KEY = "mainline:act";
export const threadKey = (id: string) => `thread:${id}`;

export type ClueThread = {
  id: string;
  /** 本子上那一栏的名字 */
  name: string;
  /** 这条线抛给你的那句问话 —— 没弄清的时候，档案和回顾都念这一句 */
  question: string;
};

export type Clue = {
  id: string;
  thread: string;
  /** 本子上的一行：一句报处境，不写结论 */
  text: string;
  /** 这条线索牵住谁 */
  about: PersonId[];
};

/** 第 1 幕到第 4 幕的说法。幕号超过这张表就是内容还没写到。 */
export const MAINLINE_ACTS: Array<{ act: number; name: string }> = [
  { act: 1, name: "一张署了别人名字的单子" },
  { act: 2, name: "名字在谁手里" },
  { act: 3, name: "那一行是谁的手写的" },
  { act: 4, name: "谁在写单子" },
];

/** 贯穿四季的那条线只有一个 id，结局要认它，所以在这里钉死一份。 */
export const MAINLINE_THREAD = "return-slip";

export const CLUE_THREADS: ClueThread[] = [
  {
    id: "return-slip",
    name: "那张退货单",
    question: "单子上写的是沈薇，退的不是她。那是谁？",
  },
];

export const CLUES: Clue[] = [
  {
    id: "slip-hand",
    thread: "return-slip",
    text: "退货单上的日期比她那一单晚三天。那三天她没上过这层楼。",
    about: ["shen", "fangmin"],
  },
  {
    id: "slip-borrowed",
    thread: "return-slip",
    text: "群里那句「沈薇退的」，名字是宋姐借出去的，货还在群里转。",
    about: ["songjie", "shen"],
  },
  {
    id: "slip-tape",
    thread: "return-slip",
    text: "她包带里那支还开着。录进去的是你的原话，不是别人的。",
    about: ["yinxiaojie"],
  },
  {
    id: "slip-gap",
    thread: "return-slip",
    text: "赠品领用表那一行有名字。方敏按住了它，一直在等你先开口。",
    about: ["fangmin"],
  },
  {
    // 第 3 幕的那条：前两幕只说得出「名字是借的」，这一条才说得出「单子是谁做的」。
    id: "slip-roster",
    thread: "return-slip",
    text: "那三天柜上是你顶的班。领用、退款、进台账，三步都在同一页上。",
    about: ["fangmin", "shen"],
  },
  {
    // 第 4 幕的那条：第 3 幕答出「是谁的手写的」，这一条才答得出「这一栏为什么每季都得有人」。
    id: "slip-desk",
    thread: "return-slip",
    text: "第四页那一栏每季空着，等一个当时顶班的号。要它的不是楼上，是这张表自己。",
    about: ["fangmin", "peilan"],
  },
];

const CLUE_IDS = new Set(CLUES.map(c => c.id));
const THREAD_IDS = new Set(CLUE_THREADS.map(t => t.id));

export const clueOf = (id: string): Clue | undefined => CLUES.find(c => c.id === id);
export const threadOf = (id: string): ClueThread | undefined => CLUE_THREADS.find(t => t.id === id);
/** 这条线的落点：0 = 还没弄清。 */
export const threadLanding = (qualities: Record<string, number>, id: string): number => qualities[threadKey(id)] ?? 0;
/** 本子上有没有这一条（给界面和体检用，规则判定走引擎 hasClue）。 */
export const isClueId = (id: string) => CLUE_IDS.has(id);
export const isThreadId = (id: string) => THREAD_IDS.has(id);
/** 这条线攒到了第几条：一条没攒就不在「还没弄清」里念它。 */
export const cluesOnThread = (held: string[], thread: string): string[] =>
  held.filter(id => clueOf(id)?.thread === thread);

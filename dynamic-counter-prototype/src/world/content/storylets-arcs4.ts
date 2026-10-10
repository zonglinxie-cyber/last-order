// 第 2 季顾客个人线（第二批）：尹小姐、段小姐、赵宁。每人四张，开头不早于第 5 天，第 2 季才开。
// 为什么排第 2 季：第 1 季已经挂着九条线，一柜最多两章，等开头的人全挤在同一扇门里；
// 第 2 季原来只有四条线（唐可、罗曼、方敏、乔晚），那一季的门是空的 —— 玩家翻到第二季看到的是一层楼在重播。
// 而这三条线读的全是第 1 季带过来的东西（梅女士那单的对家、宿舍那几位、赵宁她妈那一行），挪到第 2 季不是硬延后。
// 三条线各自的反转不撞车：尹小姐翻的是「她在挑你的话」，段小姐翻的是「她不是来买的」，赵宁翻的是「她不是来挑的」。
// 第 1 张定进门的样子，第 2 张把她身边那个人拉进来，第 3 张翻面（reveal 写在这里），第 4 张读前三张攒下的东西。
import type { Storylet } from "../types.ts";

type Slot = Storylet["cast"][string];

const yin: Slot = { id: "yinxiaojie", where: [] };
const duan: Slot = { id: "duan", where: [] };
const zn: Slot = { id: "zhaoning", where: [] };

/** 段小姐旁边：宿舍那几位女性朋友，或柜上任何一位同事。同事每时段都在，线不会停在等人上。 */
const duanWith: Slot = {
  where: [
    { gender: "$self", is: "f" },
    { any: [
      { bond: ["$self", "duan"], kind: "friend" },
      { role: "$self", is: "staff" },
    ] },
  ],
};

export const STORYLETS_ARCS4: Storylet[] = [
  // —— 尹小姐：包带里那句话。她的秘密（录音笔）本来由「你说满了一句」自动揭开，反转卡再钉一次 ——

  {
    id: "arc-yin-ask",
    kind: "arc",
    cast: { a: yin },
    when: [
      { season: { gte: 2 } },
      { day: { gte: 5 } },
      { not: { quality: "arc:yinxiaojie", gte: 1 } },
    ],
    weight: 30, tension: 0, once: true,
    text: "{$a}进门先看价签，不看人。她问的那一句在备案以外：斑到底能不能淡。",
    choices: [
      {
        label: "说回干燥和泛红",
        effects: [
          { quality: "arc:yinxiaojie", set: 1 },
          { appoint: { person: "yinxiaojie", inDays: 1, slot: 1 } },
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "said-plain", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "那两行她没有点头。{$a}带走一支，说这一句她带回去给人看。",
      },
      {
        label: "把那两行说满",
        effects: [
          { quality: "arc:yinxiaojie", set: 1 },
          { appoint: { person: "yinxiaojie", inDays: 1, slot: 1 } },
          { opinion: "$a", delta: -6 },
          { stat: "compliance", delta: -5 },
          { remember: { holder: "$a", act: "hard-sell", valence: -2, subject: "player" } },
        ],
        result: "淡得掉，两周见效。{$a}听完只问了一句：这句话写不写在单子上。",
      },
      {
        label: "问她要这句做什么",
        when: [{ opinion: "yinxiaojie", gte: 2 }],
        effects: [
          { quality: "arc:yinxiaojie", set: 1 },
          { appoint: { person: "yinxiaojie", inDays: 1, slot: 1 } },
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "asked-proof", valence: 1, subject: "player" } },
        ],
        result: "{$a}把屏幕按掉。她说这一句不是她自己要听的。",
      },
    ],
  },
  {
    id: "arc-yin-second",
    kind: "arc",
    cast: { a: yin },
    when: [
      { quality: "arc:yinxiaojie", gte: 1 },
      { not: { quality: "arc:yinxiaojie", gte: 2 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "第二次她坐在午后那一柜。上一句被人念回来了，这一趟她要柜上给第二句。",
    choices: [
      {
        label: "原话再说一遍，不加不删",
        effects: [
          { quality: "arc:yinxiaojie", set: 2 },
          { appoint: { person: "yinxiaojie", inDays: 1, slot: 2 } },
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "carried-line", valence: 1, subject: "player" } },
        ],
        result: "一字不差。{$a}说上一句也是这么说的，后来不是这个意思。",
      },
      {
        label: "顺着她那句补一点",
        effects: [
          { quality: "arc:yinxiaojie", set: 2 },
          { appoint: { person: "yinxiaojie", inDays: 1, slot: 2 } },
          { opinion: "$a", delta: -5 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "hard-sell", valence: -1, subject: "player" } },
        ],
        result: "你替她把那句话讲得更满。{$a}没有记，只把包带往里收了收。",
      },
      {
        label: "给她两支小样带走",
        effects: [
          { quality: "arc:yinxiaojie", set: 2 },
          { appoint: { person: "yinxiaojie", inDays: 1, slot: 2 } },
          { opinion: "$a", delta: 2 },
          { stat: "samples", delta: -2 },
          { remember: { holder: "$a", act: "lent-samples", valence: 1, subject: "player" } },
        ],
        result: "两支小样，不是两支正装。{$a}把其中一支直接放进包里，说那一支不归她试。",
      },
    ],
  },
  {
    // 这两格往本子上落一条主线的线索（`slip-tape`）。不是顺手加的：那条事实原来只有两张主线卡写得进，
    // 而每张都是"三格里的一格"，实测（格在可见格间均匀随机）24 副只落到 10 副 —— 抽到那张卡不等于点到那一格。
    // 她这条线本来就在讲那支笔（本卡把笔摊在柜面上，三格里前两格就是听她说里头录的是什么），
    // 所以由她把这条补进本子，比再往牌堆里塞一张新卡便宜：牌堆不动，抽卡顺序不动。
    // `learnClue` 认过就不改写（engine.ts:257），已经知道的人不会被再念一遍。
    id: "arc-yin-tape",
    kind: "arc",
    cast: { a: yin },
    when: [
      { quality: "arc:yinxiaojie", gte: 2 },
      { not: { quality: "arc:yinxiaojie", gte: 3 } },
    ],
    weight: 32, tension: 1, once: true,
    text: "柜上要收摊。{$a}把包带摊在柜面上，里面那条不是清单，是一支录音笔。她要听的从来不是这一瓶。",
    choices: [
      {
        label: "问那两支后来去了哪",
        effects: [
          { quality: "arc:yinxiaojie", set: 3 },
          { clue: "slip-tape" },
          { reveal: "yinxiaojie" },
          { appoint: { person: "yinxiaojie", inDays: 2, slot: 1 } },
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "asked-where", valence: 1, subject: "player" } },
        ],
        result: "一支用完了，一支没开封。{$a}说没开封的那支她要退，退的正是当初听来的那句。用完那一支她按了回放给你听：录进去的是你开口那句，不是别人转的。",
      },
      {
        label: "把能退的那句话教给她",
        effects: [
          { quality: "arc:yinxiaojie", set: 3 },
          { clue: "slip-tape" },
          { reveal: "yinxiaojie" },
          { appoint: { person: "yinxiaojie", inDays: 2, slot: 1 } },
          { opinion: "$a", delta: 8 },
          { bond: ["yinxiaojie", "player"], kind: "client", set: 30 },
          { remember: { holder: "$a", act: "taught-return", valence: 2, subject: "player" } },
        ],
        result: "退要有原话，原话要有日子。{$a}把这一句记进笔的那一头，说这一句她不拿去给别人。那一头转起来的时候她没挡：里头是你的原话，一个字不是她替你添的。",
      },
      {
        label: "这一单照卖，不管她那支笔",
        effects: [
          { quality: "arc:yinxiaojie", set: 3 },
          { reveal: "yinxiaojie" },
          { appoint: { person: "yinxiaojie", inDays: 2, slot: 1 } },
          { opinion: "$a", delta: -8 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "pen-held", valence: -2, subject: "player" } },
        ],
        result: "{$a}把笔收回去。她说这一句留着，下一回用得上。",
      },
      {
        label: "把自己那张小票摊开",
        when: [{ opinion: "yinxiaojie", gte: 10 }, { remembers: "yinxiaojie", act: "asked-proof" }],
        effects: [
          { quality: "arc:yinxiaojie", set: 3 },
          { reveal: "yinxiaojie" },
          { appoint: { person: "yinxiaojie", inDays: 2, slot: 1 } },
          { opinion: "$a", delta: 10 },
          { bond: ["yinxiaojie", "player"], kind: "friend", set: 22 },
          { remember: { holder: "$a", act: "showed-slip", valence: 2, subject: "player" } },
        ],
        result: "你那张也写着同一家柜。{$a}看完把自己那张折起来，两张一起收进包里。",
      },
    ],
  },
  {
    id: "arc-yin-end",
    kind: "arc",
    cast: { a: yin },
    when: [
      { quality: "arc:yinxiaojie", gte: 3 },
      { not: { quality: "arc:yinxiaojie:end", gte: 1 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "第三回她不带问题。柜上问这一句要不要写在单子上，她等你先开口。",
    choices: [
      {
        label: "照她的原话写进单子",
        when: [
          { knowsSecret: "yinxiaojie" },
          { opinion: "yinxiaojie", gte: 8 },
          { not: { remembers: "yinxiaojie", act: "hard-sell", valence: "bad" } },
        ],
        effects: [
          { quality: "arc:yinxiaojie:end", set: 1 },
          { appoint: { person: "yinxiaojie", inDays: 3, slot: 1, bring: ["duan"] } },
          { stat: "standing", delta: 2 },
          { opinion: "$a", delta: 8 },
          { remember: { holder: "$a", act: "line-on-order", valence: 2, subject: "player" } },
        ],
        result: "单子上是那句原话，也写着日子。{$a}说这一支她不退了，下回带一个要退的人来。",
      },
      {
        label: "她把那句留着等下一个柜",
        when: [{ remembers: "yinxiaojie", act: "pen-held", valence: "bad" }],
        effects: [
          { quality: "arc:yinxiaojie:end", set: 2 },
          { opinion: "$a", delta: -10 }, { opinion: "wulaoshi", delta: -3 },
          { bond: ["yinxiaojie", "player"], kind: "rival", set: -25 },
          { leave: "$a" },
        ],
        result: "{$a}走的时候说，这一句她不作废。隔壁柜听见了，也都记着。",
      },
      {
        label: "那支笔她不带进这面柜了",
        when: [
          { knowsSecret: "yinxiaojie" },
          { remembers: "yinxiaojie", act: "taught-return" },
        ],
        effects: [
          { quality: "arc:yinxiaojie:end", set: 3 },
          { appoint: { person: "yinxiaojie", inDays: 4, slot: 2 } },
          { opinion: "$a", delta: 6 },
          { remember: { holder: "$a", act: "tape-gone", valence: 2, subject: "player" } },
        ],
        result: "{$a}这一趟两手空着。她说那句能退的话她已经拿到了，剩下的事她自己办。",
      },
      {
        label: "这单做完，不问她那支笔",
        effects: [
          { quality: "arc:yinxiaojie:end", set: 4 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "nothing-asked", valence: 0, subject: "player" } },
          { leave: "$a" },
        ],
        result: "两支一起包好。{$a}付了钱，一句也没有留在这面柜上。",
      },
    ],
  },

  // —— 段小姐：拆平了带回来的那支。她的秘密（相册里那张是室友的过敏记录）在反转卡上钉开 ——

  {
    id: "arc-duan-look",
    kind: "arc",
    cast: { a: duan },
    when: [
      { season: { gte: 2 } },
      { day: { gte: 5 } },
      { not: { quality: "arc:duan", gte: 1 } },
    ],
    weight: 30, tension: 0, once: true,
    text: "{$a}站在柜前说只是看看。她问的第一句是闷痘，第二句还是闷痘。",
    choices: [
      {
        label: "只答她问的那一句",
        effects: [
          { quality: "arc:duan", set: 1 },
          { appoint: { person: "duan", inDays: 1, slot: 2 } },
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "kept-looking", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "一支讲完。{$a}说这一支不是她自己要用，说完就要走。",
      },
      {
        label: "三连并成一单开给她",
        effects: [
          { quality: "arc:duan", set: 1 },
          { appoint: { person: "duan", inDays: 1, slot: 2 } },
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "hard-sell", valence: -1, subject: "player" } },
        ],
        result: "{$a}只带走最小的那一支。室友比她更容易闷痘，这句她说得很熟。",
      },
      {
        label: "问这一支给谁",
        effects: [
          { quality: "arc:duan", set: 1 },
          { appoint: { person: "duan", inDays: 1, slot: 2 } },
          { opinion: "$a", delta: 1 },
          { remember: { holder: "$a", act: "asked-whofor", valence: 1, subject: "player" } },
        ],
        result: "{$a}报了名字，不是她的。",
      },
    ],
  },
  {
    id: "arc-duan-row",
    kind: "arc",
    cast: { a: duan, b: duanWith },
    when: [
      { quality: "arc:duan", gte: 1 },
      { not: { quality: "arc:duan", gte: 2 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "{$b}在旁边等。{$a}那一行写的是别人的名字，连注意事项都替别人念完了。",
    choices: [
      {
        label: "照她报的那一行开",
        effects: [
          { quality: "arc:duan", set: 2 },
          { appoint: { person: "duan", inDays: 1, slot: 2 } },
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "name-on-row", valence: 0, subject: "player" } },
        ],
        result: "单子上是那个名字。{$a}付得很快，没有再看第二遍。",
      },
      {
        label: "请她把自己那一行也写出来",
        when: [{ opinion: "duan", gte: 4 }],
        effects: [
          { quality: "arc:duan", set: 2 },
          { appoint: { person: "duan", inDays: 1, slot: 2 } },
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "asked-whofor", valence: 2, subject: "player" } },
        ],
        result: "{$a}停了很久。她说那一行不用写，写了这层楼就都知道她的脸。",
      },
      {
        label: "先留两支小样，试完再开单",
        effects: [
          { quality: "arc:duan", set: 2 },
          { stat: "samples", delta: -2 },
          { appoint: { person: "duan", inDays: 1, slot: 3 } },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "lent-samples", valence: 1, subject: "player" } },
        ],
        result: "两支小样。{$a}拿了一支在耳后按了按，说这一回不是替别人试。",
      },
      {
        label: "按室友那一行劝她别买",
        effects: [
          { quality: "arc:duan", set: 2 },
          { appoint: { person: "duan", inDays: 1, slot: 2 } },
          { opinion: "$a", delta: -2 },
          { remember: { holder: "$a", act: "turned-away", valence: -1, subject: "player" } },
        ],
        result: "{$a}把包带拉好就走了。这句话她记住了，不是记成好话。",
      },
    ],
  },
  {
    id: "arc-duan-back",
    kind: "arc",
    cast: { a: duan },
    when: [
      { quality: "arc:duan", gte: 2 },
      { not: { quality: "arc:duan", gte: 3 } },
    ],
    weight: 32, tension: 1, once: true,
    text: "这一次她没有问价。{$a}把上一支拆平了放在柜上，内管还是满的，用了两天，起了片。",
    choices: [
      {
        label: "照她自己的名字登记这笔退货",
        effects: [
          { quality: "arc:duan", set: 3 },
          { reveal: "duan" },
          { appoint: { person: "duan", inDays: 2, slot: 2 } },
          { opinion: "$a", delta: 6 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "took-back", valence: 2, subject: "player" } },
        ],
        result: "记录是室友那种脸，主意是{$a}出的。这一行她自己签，签完人还站着。",
      },
      {
        label: "按室友那一行走，名字不落在这面柜",
        effects: [
          { quality: "arc:duan", set: 3 },
          { reveal: "duan" },
          { appoint: { person: "duan", inDays: 2, slot: 2 } },
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "row-blank", valence: -1, subject: "player" } },
        ],
        result: "退货写成换货，那一行没人认领。{$a}把拆平的包装收进包里，道了声谢，声音很低。",
      },
      {
        label: "旧的那支不提，这趟算新开一单",
        effects: [
          { quality: "arc:duan", set: 3 },
          { reveal: "duan" },
          { appoint: { person: "duan", inDays: 2, slot: 2 } },
          { opinion: "$a", delta: -6 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "counted-new", valence: -2, subject: "player" } },
        ],
        result: "{$a}没有再说话。新的一支她带走了，拆平的那个包装留在柜台上。",
      },
      {
        label: "你已经知道相册里那张",
        when: [{ knowsSecret: "duan" }],
        effects: [
          { quality: "arc:duan", set: 3 },
          { reveal: "duan" },
          { appoint: { person: "duan", inDays: 2, slot: 2 } },
          { opinion: "$a", delta: 8 },
          { bond: ["duan", "player"], kind: "friend", set: 18 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "你没有把那张记录念出来。{$a}自己说了：记录是室友的，主意是她出的。",
      },
    ],
  },
  {
    id: "arc-duan-end",
    kind: "arc",
    cast: { a: duan },
    when: [
      { quality: "arc:duan", gte: 3 },
      { not: { quality: "arc:duan:end", gte: 1 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "换货的日子到了。{$a}一个人来，手上还是那张拆平的包装。",
    choices: [
      {
        label: "她把那一行改成了自己的名字",
        when: [
          { opinion: "duan", gte: 8 },
          { remembers: "duan", act: "took-back" },
        ],
        effects: [
          { quality: "arc:duan:end", set: 1 },
          { appoint: { person: "duan", inDays: 3, slot: 3, bring: ["zhaoning"] } },
          { stat: "standing", delta: 1 },
          { opinion: "$a", delta: 6 },
          { remember: { holder: "$a", act: "own-name", valence: 2, subject: "player" } },
        ],
        result: "这一支她按自己的脸开。{$a}把那页撕下来带走，说下回不用先问室友。",
      },
      {
        label: "那一行还是空的",
        when: [{ remembers: "duan", act: "row-blank", valence: "bad" }],
        effects: [
          { quality: "arc:duan:end", set: 2 },
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "row-blank", valence: -1, subject: "player" } },
          { leave: "$a" },
        ],
        result: "旧的包装留下，新的一支没有开封。{$a}说这一趟不算她来的。",
      },
      {
        label: "柜上那一支还在原处",
        when: [{ remembers: "duan", act: "counted-new", valence: "bad" }],
        effects: [
          { quality: "arc:duan:end", set: 3 },
          { opinion: "$a", delta: -8 },
          { bond: ["duan", "player"], kind: "rival", set: -20 },
          { leave: "$a" },
        ],
        result: "{$a}再进门的时候绕开这面柜。旧的那一支谁也没有登记。",
      },
      {
        label: "这一次她先报自己的名字",
        effects: [
          { quality: "arc:duan:end", set: 4 },
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "own-name", valence: 1, subject: "player" } },
        ],
        result: "{$a}开口先报名字，是她自己的。那一支开成最小的一支。",
      },
    ],
  },

  // —— 赵宁：来说「不」的那个人。她的秘密（那一格是她写的）在反转卡上钉开 ——

  {
    id: "arc-zn-alone",
    kind: "arc",
    cast: { a: zn },
    when: [
      { season: { gte: 2 } },
      { day: { gte: 5 } },
      { not: { quality: "arc:zhaoning", gte: 1 } },
    ],
    weight: 30, tension: 0, once: true,
    text: "赵女士今天没来。{$a}一个人站在午后那一柜，屏幕亮着，上面是一列手写的字。",
    choices: [
      {
        label: "按她这一柜的自己接待",
        effects: [
          { quality: "arc:zhaoning", set: 1 },
          { appoint: { person: "zhaoning", inDays: 1, slot: 1 } },
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "came-alone", valence: 2, subject: "player" } },
        ],
        result: "{$a}先说了一句：让她别替我说。那一列字是她自己敲的。",
      },
      {
        label: "先问她妈妈今天怎么没来",
        effects: [
          { quality: "arc:zhaoning", set: 1 },
          { appoint: { person: "zhaoning", inDays: 1, slot: 1 } },
          { opinion: "$a", delta: -3 },
          { remember: { holder: "$a", act: "asked-about-mother", valence: -1, subject: "player" } },
        ],
        result: "{$a}把屏幕按掉。她说这一趟不是替她妈妈来看的。",
      },
      {
        label: "把赵女士的旧单翻出来给她看",
        effects: [
          { quality: "arc:zhaoning", set: 1 },
          { appoint: { person: "zhaoning", inDays: 1, slot: 1 } },
          { opinion: "$a", delta: -2 }, { opinion: "zhao", delta: 1 },
          { remember: { holder: "$a", act: "showed-old-order", valence: -1, subject: "player" } },
        ],
        result: "旧单上那一行是别人替她挑的。{$a}看了，没说这一行对不对。",
      },
    ],
  },
  {
    id: "arc-zn-list",
    kind: "arc",
    cast: { a: zn },
    when: [
      { quality: "arc:zhaoning", gte: 1 },
      { not: { quality: "arc:zhaoning", gte: 2 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "第二次她还是一个人。清单摊在柜面上：香精那一行画了圈，旁边注了一句一碰就红。",
    choices: [
      {
        label: "对的是她写的那一行",
        effects: [
          { quality: "arc:zhaoning", set: 2 },
          { appoint: { person: "zhaoning", inDays: 1, slot: 1 } },
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "list-held", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "{$a}点头。她说这一行她写了两年，柜上头一回照着念。",
      },
      {
        label: "把她那一行念成她妈妈的口味",
        effects: [
          { quality: "arc:zhaoning", set: 2 },
          { appoint: { person: "zhaoning", inDays: 1, slot: 1 } },
          { opinion: "$a", delta: -5 },
          { remember: { holder: "$a", act: "list-mixed", valence: -2, subject: "player" } },
        ],
        result: "{$a}把纸收起来。她说你又在问妈妈喜欢哪一支。",
      },
      {
        label: "先试一支小样，不上柜",
        effects: [
          { quality: "arc:zhaoning", set: 2 },
          { stat: "samples", delta: -1 },
          { appoint: { person: "zhaoning", inDays: 1, slot: 1 } },
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "got-sample", valence: 1, subject: "player" } },
        ],
        result: "小样抹在耳后。等的那十分钟她自己数着，没有喊妈妈。",
      },
      {
        label: "这一行你在别处已经听过",
        when: [{ remembers: "zhao", act: "daughter-row" }],
        effects: [
          { quality: "arc:zhaoning", set: 2 },
          { appoint: { person: "zhaoning", inDays: 1, slot: 1 } },
          { opinion: "$a", delta: 6 },
          { bond: ["zhao", "zhaoning"], delta: 3 },
          { remember: { holder: "$a", act: "list-held", valence: 2, subject: "player" } },
        ],
        result: "同一行你在赵女士那一柜听过一遍。{$a}听完只说：那你们说的是同一行。",
      },
    ],
  },
  {
    id: "arc-zn-stop",
    kind: "arc",
    cast: { a: zn },
    when: [
      { quality: "arc:zhaoning", gte: 2 },
      { not: { quality: "arc:zhaoning", gte: 3 } },
    ],
    weight: 32, tension: 1, once: true,
    text: "这一次她把那一支推回柜里。{$a}说这一支不是她要买的，是妈妈今天要给她买的。她今天是来说不。",
    choices: [
      {
        label: "那一支不开，话记在她这一栏",
        effects: [
          { quality: "arc:zhaoning", set: 3 },
          { reveal: "zhaoning" },
          { appoint: { person: "zhaoning", inDays: 2, slot: 1 } },
          { opinion: "$a", delta: 6 },
          { remember: { holder: "$a", act: "sale-stopped", valence: 2, subject: "player" } },
        ],
        result: "单子上那一栏空着。{$a}站了一会儿说，她自己会挑，只是今天不买。",
      },
      {
        label: "旧单照开，她那句等她自己说完",
        effects: [
          { quality: "arc:zhaoning", set: 3 },
          { reveal: "zhaoning" },
          { appoint: { person: "zhaoning", inDays: 2, slot: 1 } },
          { opinion: "$a", delta: -6 },
          { remember: { holder: "$a", act: "sale-forced", valence: -2, subject: "player" } },
        ],
        result: "那支还是包进了袋子。{$a}提着它站了一会儿，说这一支她会原样放回去。",
      },
      {
        label: "请她下一次带妈妈一起来说",
        when: [{ opinion: "zhaoning", gte: 3 }],
        effects: [
          { quality: "arc:zhaoning", set: 3 },
          { reveal: "zhaoning" },
          { appoint: { person: "zhaoning", inDays: 2, slot: 1, bring: ["zhao"] } },
          { opinion: "$a", delta: 3 }, { opinion: "zhao", delta: 2 },
          { remember: { holder: "$a", act: "both-come", valence: 1, subject: "player" } },
        ],
        result: "{$a}想了很久，说好。她说这一句要当面说，不能由柜上转。",
      },
      {
        label: "妈妈背串的那一行你没有当众讲",
        when: [{ knowsSecret: "zhaoning" }, { opinion: "zhaoning", gte: 8 }],
        effects: [
          { quality: "arc:zhaoning", set: 3 },
          { reveal: "zhaoning" },
          { appoint: { person: "zhaoning", inDays: 2, slot: 1 } },
          { opinion: "$a", delta: 8 },
          { bond: ["zhaoning", "player"], kind: "friend", set: 20 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "{$a}把自己的清单折好，放进包的最外层，没有再往妈妈那一栏看。",
      },
    ],
  },
  {
    id: "arc-zn-end",
    kind: "arc",
    cast: { a: zn },
    when: [
      { quality: "arc:zhaoning", gte: 3 },
      { not: { quality: "arc:zhaoning:end", gte: 1 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "柜上问这一单写谁的名字。{$a}把手机推过来，屏幕上那行字是她自己敲的。",
    choices: [
      {
        label: "按她那一行开，妈妈那一栏空着",
        when: [
          { knowsSecret: "zhaoning" },
          { opinion: "zhaoning", gte: 8 },
          { not: { remembers: "zhaoning", act: "sale-forced", valence: "bad" } },
        ],
        effects: [
          { quality: "arc:zhaoning:end", set: 1 },
          { appoint: { person: "zhaoning", inDays: 3, slot: 1, bring: ["duan"] } },
          { stat: "standing", delta: 2 },
          { opinion: "$a", delta: 8 }, { opinion: "zhao", delta: -2 },
          { bond: ["zhao", "zhaoning"], delta: 4 },
          { remember: { holder: "$a", act: "own-name", valence: 2, subject: "player" } },
        ],
        result: "最小的一支，写在她的名字下。{$a}走的时候说下一回她自己来问。",
      },
      {
        label: "那支还是写在妈妈那一栏",
        when: [{ remembers: "zhaoning", act: "sale-forced", valence: "bad" }],
        effects: [
          { quality: "arc:zhaoning:end", set: 2 },
          { opinion: "$a", delta: -10 },
          { bond: ["zhao", "zhaoning"], delta: -6 }, { bond: ["zhaoning", "player"], kind: "rival", set: -22 },
          { leave: "$a" },
        ],
        result: "袋子提在她手里，单子写在别人名下。{$a}没有回头。",
      },
      {
        label: "这一单不开，等她自己来问",
        when: [{ remembers: "zhaoning", act: "sale-stopped" }],
        effects: [
          { quality: "arc:zhaoning:end", set: 3 },
          { appoint: { person: "zhaoning", inDays: 5, slot: 1, bring: ["zhao"] } },
          { opinion: "$a", delta: 5 }, { opinion: "zhao", delta: 3 },
          { remember: { holder: "$a", act: "came-alone", valence: 2, subject: "player" } },
        ],
        result: "柜上少开一单。隔一天{$a}自己来了，第一句问的是那一行怎么改。",
      },
      {
        label: "那一行没有念出来",
        effects: [
          { quality: "arc:zhaoning:end", set: 4 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "nothing-asked", valence: 0, subject: "player" } },
          { leave: "$a" },
        ],
        result: "{$a}把手机收回包里。那一行她背得出，一个字也没有说。",
      },
    ],
  },
];

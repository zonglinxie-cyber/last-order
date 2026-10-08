// 第 1 季顾客个人线：小雨、周姐、赵女士、米朵。每人四张，开头不早于第 5 天。
// 主角用 CastSlot.id 钉住。每段结束用 appoint 把下一段要的人约来。
// 终点读她的圈子：熟人怎么看你、她记着哪件事、秘密揭开没有、你介绍过谁。
import type { Storylet } from "../types.ts";

const xiaoyu: Storylet["cast"][string] = { id: "xiaoyu", where: [] };
const zhou: Storylet["cast"][string] = { id: "zhou", where: [] };
const zhao: Storylet["cast"][string] = { id: "zhao", where: [] };
const miduo: Storylet["cast"][string] = { id: "miduo", where: [] };

/** 小雨旁边：宿舍的女性朋友，或柜上任何一位同事。同事每时段都在，线不会停在等人上。 */
const xiaoyuWith: Storylet["cast"][string] = {
  where: [
    { gender: "$self", is: "f" },
    { any: [
      { bond: ["$self", "xiaoyu"], kind: "friend" },
      { role: "$self", is: "staff" },
    ] },
  ],
};

/** 周姐圈子：陆遥、唐可一直在楼层上，梅女士、叶女士按自己的日子来。 */
const zhouCircle: Storylet["cast"][string] = {
  where: [
    { gender: "$self", is: "f" },
    { any: [
      { bond: ["$self", "zhou"], kind: "client" },
      { bond: ["$self", "zhou"], kind: "friend" },
    ] },
  ],
};

/** 赵女士旁边：女儿和女性朋友，或柜上任何一位同事。同事每时段都在，线不会停在等人上。 */
const zhaoWith: Storylet["cast"][string] = {
  where: [
    { gender: "$self", is: "f" },
    { any: [
      { bond: ["$self", "zhao"], kind: "family" },
      { bond: ["$self", "zhao"], kind: "friend" },
      { role: "$self", is: "staff" },
    ] },
  ],
};

/** 米朵这边：沈薇、唐糖、何清、岑宁、梁夏、吴老师。 */
const miduoCircle: Storylet["cast"][string] = {
  where: [
    { gender: "$self", is: "f" },
    { any: [
      { bond: ["$self", "miduo"], kind: "colleague" },
      { bond: ["$self", "miduo"], kind: "friend" },
      { bond: ["$self", "miduo"], kind: "fan" },
      { bond: ["$self", "miduo"], kind: "rival" },
    ] },
  ],
};

const nextXiaoyu = (bring?: string[]): Storylet["choices"][number]["effects"] => [
  { appoint: { person: "xiaoyu", inDays: 1, slot: 2, ...(bring ? { bring } : {}) } },
];
const nextZhou = (bring?: string[]): Storylet["choices"][number]["effects"] => [
  { appoint: { person: "zhou", inDays: 1, slot: 1, ...(bring ? { bring } : {}) } },
];
const nextZhao = (bring?: string[]): Storylet["choices"][number]["effects"] => [
  { appoint: { person: "zhao", inDays: 1, slot: 1, ...(bring ? { bring } : {}) } },
];
const nextMiduo = (bring?: string[]): Storylet["choices"][number]["effects"] => [
  { appoint: { person: "miduo", inDays: 1, slot: 2, ...(bring ? { bring } : {}) } },
];

export const STORYLETS_ARCS3: Storylet[] = [

  // —— 小雨：一千块，明天面试。宿舍的代买想把她并进去 ——

  {
    id: "arc-xiaoyu-budget",
    kind: "arc",
    cast: { a: xiaoyu },
    when: [
      { season: { gte: 1 } },
      { day: { gte: 5 } },
      { not: { quality: "arc:xiaoyu", gte: 1 } },
    ],
    weight: 46, tension: 0, once: true,
    text: "{$a}把一千放在柜面上。明天面试。颊上有一颗还在冒的痘，她说这一支不能闷。",
    choices: [
      {
        label: "按一千开，不往上加",
        effects: [
          { quality: "arc:xiaoyu", set: 1 },
          ...nextXiaoyu(["suxiao"]),
          { opinion: "$a", delta: 5 },
          { remember: { holder: "$a", act: "budget-kept", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "一千够这一支。{$a}把面试的事留在自己的单上，没有再加。",
      },
      {
        label: "再加一支，面试要看起来精神",
        effects: [
          { quality: "arc:xiaoyu", set: 1 },
          ...nextXiaoyu(["suxiao"]),
          { opinion: "$a", delta: -5 },
          { remember: { holder: "$a", act: "over-budget", valence: -2, subject: "player" } },
        ],
        result: "单子过了一千。{$a}没有把面试群的名字给你。",
      },
      {
        label: "先留小样，面试前再定",
        effects: [
          { quality: "arc:xiaoyu", set: 1 },
          ...nextXiaoyu(["suxiao"]),
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "got-sample", valence: 1, subject: "player" } },
        ],
        result: "小样留下了。这一支她还没有付，痘也还没有被闷住。",
      },
    ],
  },
  {
    id: "arc-xiaoyu-dorm",
    kind: "arc",
    cast: { a: xiaoyu, b: xiaoyuWith },
    when: [
      { quality: "arc:xiaoyu", gte: 1 },
      { not: { quality: "arc:xiaoyu", gte: 2 } },
    ],
    weight: 46, tension: 0, once: true,
    text: "{$b}在旁边。宿舍的备忘录摊在{$a}旁边，字迹不是她的。{$a}说面试这一支要单独开。",
    choices: [
      {
        label: "面试单独开，宿舍的不并进来",
        effects: [
          { quality: "arc:xiaoyu", set: 2 },
          ...nextXiaoyu(["duan"]),
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "budget-kept", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "两张单。{$a}的面试不进宿舍那一栏。{$b}听见了这个分法。",
      },
      {
        label: "请{$b}先到休息区",
        when: [{ role: "$b", is: "customer" }],
        effects: [
          { quality: "arc:xiaoyu", set: 2 },
          ...nextXiaoyu(["duan"]),
          { move: { person: "$b", zone: "lounge" } },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "budget-kept", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "{$b}先去休息区。面试这一支只留{$a}自己的一千。",
      },
      {
        label: "按备忘录并成一单",
        effects: [
          { quality: "arc:xiaoyu", set: 2 },
          ...nextXiaoyu(["duan"]),
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "over-budget", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "wrong-face", valence: -1, subject: "player", heardFrom: "$b" } },
        ],
        result: "宿舍的数并成一张。{$a}的一千写进了别人的字迹。",
      },
      {
        label: "介绍她认识江宁，两笔预算分开",
        effects: [
          { quality: "arc:xiaoyu", set: 2 },
          ...nextXiaoyu(["duan"]),
          { bond: ["xiaoyu", "jiangning"], kind: "friend", set: 12 },
          { bond: ["jiangning", "xiaoyu"], kind: "friend", set: 12 },
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "introduced", valence: 1, subject: "jiangning" } },
          { remember: { holder: "jiangning", act: "introduced", valence: 1, subject: "xiaoyu" } },
        ],
        result: "江宁的四百和{$a}的一千没有并。你让她们先认识，单还是两张。",
      },
    ],
  },
  {
    id: "arc-xiaoyu-room",
    kind: "arc",
    cast: { a: xiaoyu, b: xiaoyuWith },
    when: [
      { quality: "arc:xiaoyu", gte: 2 },
      { not: { quality: "arc:xiaoyu", gte: 3 } },
    ],
    weight: 46, tension: 0, once: true,
    text: "{$b}在听。{$a}把痘指给你看，不肯让宿舍的人替她答。",
    choices: [
      {
        label: "让她自己说完",
        when: [{ knowsSecret: "duan" }],
        effects: [
          { quality: "arc:xiaoyu", set: 3 },
          ...nextXiaoyu(),
          { opinion: "$a", delta: 4 }, { opinion: "duan", delta: 3 },
          { remember: { holder: "duan", act: "kept-secret", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "你没有要相册。段小姐那张不是自拍的事，没有拿到{$a}脸上用。",
      },
      {
        label: "让她自己说完",
        when: [{ not: { knowsSecret: "duan" } }],
        effects: [
          { quality: "arc:xiaoyu", set: 3 },
          ...nextXiaoyu(),
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "{$a}把面试说完了。相册没有被打开。",
      },
      {
        label: "按宿舍说的，把痘压住",
        effects: [
          { quality: "arc:xiaoyu", set: 3 },
          ...nextXiaoyu(),
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "hard-sell", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "over-budget", valence: -1, subject: "player", heardFrom: "$b" } },
        ],
        result: "痘被说成能压住。{$a}记下这句是宿舍的人想听的，不是她的脸。",
      },
      {
        label: "顾言的代买不写进这一支",
        when: [{ opinion: "guyan", gte: 5 }],
        effects: [
          { quality: "arc:xiaoyu", set: 3 },
          ...nextXiaoyu(),
          { opinion: "$a", delta: 3 }, { opinion: "guyan", delta: 2 },
          { bond: ["guyan", "xiaoyu"], delta: 4 },
          { remember: { holder: "guyan", act: "budget-kept", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "budget-kept", valence: 1, subject: "player", heardFrom: "guyan" } },
        ],
        result: "四支代买还是顾言的。{$a}这一支没有并进去。",
      },
    ],
  },
  {
    id: "arc-xiaoyu-end",
    kind: "arc",
    cast: { a: xiaoyu },
    when: [
      { quality: "arc:xiaoyu", gte: 3 },
      { not: { quality: "arc:xiaoyu:end", gte: 1 } },
    ],
    weight: 46, tension: 0, once: true,
    text: "面试过去了。{$a}回来，问这一支还算不算她自己的。宿舍的人怎么说你，她都听见了。",
    choices: [
      {
        label: "面试群还提你的名字",
        when: [
          { opinion: "xiaoyu", gte: 4 },
          { not: { remembers: "xiaoyu", act: "hard-sell", valence: "bad" } },
          { any: [
            { opinion: "suxiao", gte: 5 },
            { opinion: "duan", gte: 5 },
            { opinion: "guyan", gte: 5 },
            { remembers: "xiaoyu", act: "budget-kept", valence: "good" },
            { knowsSecret: "duan" },
          ] },
        ],
        effects: [
          { quality: "arc:xiaoyu:end", set: 1 },
          { opinion: "$a", delta: 4 },
          { appoint: { person: "suxiao", inDays: 3, slot: 3, bring: ["xiaoyu"] } },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "群里还提你。{$a}下次来，带的是自己的预算，不是宿舍的备忘录。",
      },
      {
        label: "你介绍的人还跟她来",
        when: [{ remembers: "xiaoyu", act: "introduced" }],
        effects: [
          { quality: "arc:xiaoyu:end", set: 2 },
          { opinion: "$a", delta: 3 }, { opinion: "jiangning", delta: 2 },
          { appoint: { person: "jiangning", inDays: 3, slot: 2, bring: ["xiaoyu"] } },
          { remember: { holder: "$a", act: "brought-friend", valence: 1, subject: "player" } },
        ],
        result: "江宁若再来，和{$a}是两张单。你介绍过的那个人还认这个分法。",
      },
      {
        label: "宿舍把她的单收回去了",
        when: [{ any: [
          { remembers: "xiaoyu", act: "hard-sell", valence: "bad" },
          { remembers: "xiaoyu", act: "over-budget", valence: "bad" },
          { opinion: "guyan", lte: -5 },
          { remembers: "xiaoyu", act: "badmouthed", from: "suxiao", heard: true },
        ] }],
        effects: [
          { quality: "arc:xiaoyu:end", set: 3 },
          { opinion: "$a", delta: -3 },
          { bond: ["suxiao", "xiaoyu"], delta: -4 },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
          { leave: "$a" },
        ],
        result: "宿舍不再让她单独来。{$a}的一千，以后写在别人的备忘录里。",
      },
      {
        label: "这一支用完，不约下次",
        effects: [
          { quality: "arc:xiaoyu:end", set: 4 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
        ],
        result: "面试用过了。没有人把下一次的预算留在这面柜上。",
      },
    ],
  },

  // —— 周姐：二十分钟。对面一句持妆，手机里还有同事的一条 ——

  {
    id: "arc-zhou-compare",
    kind: "arc",
    cast: { a: zhou },
    when: [
      { season: { gte: 1 } },
      { day: { gte: 5 } },
      { not: { quality: "arc:zhou", gte: 1 } },
    ],
    weight: 28, tension: 0, once: true,
    text: "{$a}把试色盘扣上。对面说持妆会暗沉。她只有二十分钟，手机里还有同事的一条。",
    choices: [
      {
        label: "先答会不会暗沉",
        effects: [
          { quality: "arc:zhou", set: 1 },
          ...nextZhou(["mei"]),
          { opinion: "$a", delta: 4 }, { opinion: "luyao", delta: 1 },
          { remember: { holder: "$a", act: "own-face", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "二十分钟用在她自己的脸上。同事那条还在手机里，没有打开。",
      },
      {
        label: "先看同事那条",
        effects: [
          { quality: "arc:zhou", set: 1 },
          ...nextZhou(["mei"]),
          { opinion: "$a", delta: -2 },
          { remember: { holder: "$a", act: "colleague-need", valence: 1, subject: "player" } },
        ],
        result: "同事的需求先念完了。{$a}自己会不会暗沉，这二十分钟没有答。",
      },
      {
        label: "去对对面那句",
        when: [{ not: { knowsSecret: "luyao" } }],
        effects: [
          { quality: "arc:zhou", set: 1 },
          ...nextZhou(["mei"]),
          { opinion: "$a", delta: -4 }, { opinion: "luyao", delta: -4 },
          { bond: ["luyao", "zhou"], delta: -4 },
          { remember: { holder: "$a", act: "took-client", valence: -1, subject: "player" } },
          { remember: { holder: "luyao", act: "took-client", valence: -1, subject: "player" } },
        ],
        result: "你在赢对面。{$a}要的那句回答，没有落在她自己的脸上。",
      },
      {
        label: "去对对面那句",
        when: [{ knowsSecret: "luyao" }],
        effects: [
          { quality: "arc:zhou", set: 1 },
          ...nextZhou(["mei"]),
          { opinion: "$a", delta: -4 }, { opinion: "luyao", delta: -6 },
          { bond: ["luyao", "zhou"], delta: -4 },
          { remember: { holder: "$a", act: "took-client", valence: -1, subject: "player" } },
          { remember: { holder: "luyao", act: "broke-warning", valence: -2, subject: "player" } },
        ],
        result: "你知道对面厌烦被人截，还是去对了。{$a}要的那句回答，没有落在她自己的脸上。",
      },
      {
        label: "这句不拿去截",
        when: [{ knowsSecret: "luyao" }],
        effects: [
          { quality: "arc:zhou", set: 1 },
          ...nextZhou(["mei"]),
          { opinion: "$a", delta: 3 }, { opinion: "luyao", delta: 2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
          { remember: { holder: "luyao", act: "kept-warning", valence: 1, subject: "player" } },
        ],
        result: "你没把对面那句接过来。{$a}把对比表折上，说这句她自己留着。",
      },
    ],
  },
  {
    id: "arc-zhou-split",
    kind: "arc",
    cast: { a: zhou, b: zhouCircle },
    when: [
      { quality: "arc:zhou", gte: 1 },
      { not: { quality: "arc:zhou", gte: 2 } },
    ],
    weight: 28, tension: 0, once: true,
    text: "{$b}在听。{$a}把同事的需求翻出来，说这回不是她自用。两张脸不是同一张。",
    choices: [
      {
        label: "两张脸分开开",
        when: [{ remembers: "zhou", act: "introduced" }],
        effects: [
          { quality: "arc:zhou", set: 2 },
          ...nextZhou(["yenushi"]),
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "own-face", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "colleague-need", valence: 1, subject: "player", heardFrom: "$b" } },
        ],
        result: "同事是经你认识的。{$a}的单和同事的单没有并。",
      },
      {
        label: "两张脸分开开",
        when: [{ not: { remembers: "zhou", act: "introduced" } }],
        effects: [
          { quality: "arc:zhou", set: 2 },
          ...nextZhou(["yenushi"]),
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "own-face", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "同事的需求和{$a}自己的，你分开写了。{$b}听见的是两句。",
      },
      {
        label: "按她的脸开同事的",
        effects: [
          { quality: "arc:zhou", set: 2 },
          ...nextZhou(["yenushi"]),
          { opinion: "$a", delta: -3 }, { opinion: "mei", delta: -3 },
          { remember: { holder: "$a", act: "wrong-face", valence: -2, subject: "player" } },
          { remember: { holder: "mei", act: "wrong-face", valence: -1, subject: "player", heardFrom: "zhou" } },
        ],
        result: "同事拿到的是{$a}的脸。梅女士若再传这句话，传的是这一句。",
      },
      {
        label: "请{$b}先到休息区",
        when: [{ role: "$b", is: "customer" }],
        effects: [
          { quality: "arc:zhou", set: 2 },
          ...nextZhou(["yenushi"]),
          { move: { person: "$b", zone: "lounge" } },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -1 },
          { remember: { holder: "$a", act: "own-face", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "二十分钟只答{$a}。{$b}的话留到休息区，没有插进这单。",
      },
    ],
  },
  {
    id: "arc-zhou-word",
    kind: "arc",
    cast: { a: zhou, b: zhouCircle },
    when: [
      { quality: "arc:zhou", gte: 2 },
      { not: { quality: "arc:zhou", gte: 3 } },
    ],
    weight: 28, tension: 0, once: true,
    text: "{$b}还在。{$a}问：同事那条要是开错了，是她担保，还是你担保。",
    choices: [
      {
        label: "错了算你，不让她担保",
        effects: [
          { quality: "arc:zhou", set: 3 },
          ...nextZhou(),
          { opinion: "$a", delta: 4 }, { opinion: "mei", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { remember: { holder: "mei", act: "kept-word", valence: 1, subject: "player", heardFrom: "zhou" } },
        ],
        result: "担保写在你名下。{$a}不用拿自己的脸去替同事认。",
      },
      {
        label: "让她跟同事说是你推的",
        effects: [
          { quality: "arc:zhou", set: 3 },
          ...nextZhou(),
          { opinion: "$a", delta: -4 }, { opinion: "mei", delta: -2 },
          { remember: { holder: "$a", act: "broke-word", valence: -2, subject: "player" } },
          { remember: { holder: "mei", act: "broke-word", valence: -1, subject: "player", heardFrom: "zhou" } },
        ],
        result: "同事听到的是{$a}在替你说话。错了，她得自己去圆。",
      },
      {
        label: "让{$b}把对面那句说完",
        effects: [
          { quality: "arc:zhou", set: 3 },
          ...nextZhou(),
          { opinion: "$b", delta: 2 }, { opinion: "$a", delta: 1 },
          { remember: { holder: "$a", act: "rival-line", valence: 0, subject: "player", heardFrom: "$b" } },
        ],
        result: "对面那句是{$b}复述的。{$a}听见了，也听见是谁告诉她的。",
      },
      {
        label: "同事的单交给苏蔓对",
        when: [{ opinion: "suman", gte: 5 }],
        effects: [
          { quality: "arc:zhou", set: 3 },
          ...nextZhou(),
          { bond: ["zhou", "suman"], kind: "client", set: 16 },
          { bond: ["suman", "zhou"], kind: "client", set: 16 },
          { opinion: "$a", delta: 2 }, { opinion: "suman", delta: 3 },
          { remember: { holder: "$a", act: "introduced", valence: 1, subject: "suman" } },
          { remember: { holder: "suman", act: "introduced", valence: 1, subject: "zhou" } },
        ],
        result: "同事这条你介绍给苏蔓。{$a}自己的二十分钟，没有拿去担保。",
      },
    ],
  },
  {
    id: "arc-zhou-end",
    kind: "arc",
    cast: { a: zhou },
    when: [
      { quality: "arc:zhou", gte: 3 },
      { not: { quality: "arc:zhou:end", gte: 1 } },
    ],
    weight: 28, tension: 0, once: true,
    text: "二十分钟又到了。{$a}还站在两面柜中间。她问下一回对比，人还来不来你这边。",
    choices: [
      {
        label: "她还来你这边对比",
        when: [
          { opinion: "zhou", gte: 4 },
          { not: { remembers: "zhou", act: "took-client", valence: "bad" } },
          { any: [
            { knowsSecret: "luyao" },
            { remembers: "zhou", act: "kept-secret", valence: "good" },
            { opinion: "mei", gte: 5 },
            { remembers: "zhou", act: "own-face", valence: "good" },
            { remembers: "zhou", act: "honest-advice", valence: "good" },
          ] },
        ],
        effects: [
          { quality: "arc:zhou:end", set: 1 },
          { opinion: "$a", delta: 4 },
          { bond: ["luyao", "zhou"], delta: 3 },
          { appoint: { person: "zhou", inDays: 4, slot: 1, bring: ["mei"] } },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "对比还在你这边做。同事的需求若再来，不并进她自己的脸。",
      },
      {
        label: "对面那句她带走了",
        when: [{ any: [
          { remembers: "zhou", act: "rival-line", from: "luyao", heard: true },
          { remembers: "zhou", act: "took-client", valence: "bad" },
          { opinion: "luyao", lte: -8 },
          { remembers: "zhou", act: "hard-sell", valence: "bad" },
        ] }],
        effects: [
          { quality: "arc:zhou:end", set: 2 },
          { opinion: "$a", delta: -3 }, { opinion: "luyao", delta: 2 },
          { bond: ["luyao", "zhou"], delta: 4 },
          { remember: { holder: "$a", act: "yielded-client", valence: -1, subject: "player" } },
          { leave: "$a" },
        ],
        result: "下一回对比，{$a}先去对面。你这边留下的是没答完的那二十分钟。",
      },
      {
        label: "同事的单不再经过她",
        when: [{ any: [
          { opinion: "mei", lte: -4 },
          { remembers: "mei", act: "wrong-face", valence: "bad" },
          { remembers: "mei", act: "broke-word", valence: "bad" },
          { remembers: "zhou", act: "colleague-need", from: "mei", heard: true },
        ] }],
        effects: [
          { quality: "arc:zhou:end", set: 3 },
          { opinion: "$a", delta: -2 }, { opinion: "mei", delta: -2 },
          { bond: ["mei", "zhou"], delta: -5 },
          { remember: { holder: "mei", act: "refused-intro", valence: -1, subject: "player" } },
        ],
        result: "同事不再让{$a}带需求过来。她自己还可以来，担保这一句没有了。",
      },
      {
        label: "二十分钟用完，人不留",
        effects: [
          { quality: "arc:zhou:end", set: 4 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
        ],
        result: "对比做完了。没有下一句，也没有同事的名字留下。",
      },
    ],
  },

  // —— 赵女士：她背的那一格，和女儿写在屏幕上的不是同一行 ——

  {
    id: "arc-zhao-screen",
    kind: "arc",
    cast: { a: zhao },
    when: [
      { season: { gte: 1 } },
      { day: { gte: 5 } },
      { not: { quality: "arc:zhao", gte: 1 } },
    ],
    weight: 46, tension: 0, once: true,
    text: "{$a}把手机扣着。她说别看她的脸，东西是买给女儿的。她背的那一格，和屏幕亮起时不是同一行。",
    choices: [
      {
        label: "看屏幕，不看她的脸",
        when: [{ knowsSecret: "zhao" }],
        effects: [
          { quality: "arc:zhao", set: 1 },
          ...nextZhao(["zhaoning"]),
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "daughter-row", valence: 2, subject: "player" } },
        ],
        result: "你知道那一格是她记错的。这单按屏幕上的开，不按她背的。",
      },
      {
        label: "看屏幕，不看她的脸",
        when: [{ not: { knowsSecret: "zhao" } }],
        effects: [
          { quality: "arc:zhao", set: 1 },
          ...nextZhao(["zhaoning"]),
          { reveal: "zhao" },
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "daughter-row", valence: 1, subject: "player" } },
        ],
        result: "屏幕转过来了。她背的那一格和上面写的不是同一行。",
      },
      {
        label: "按她背的那一格开",
        effects: [
          { quality: "arc:zhao", set: 1 },
          ...nextZhao(["zhaoning"]),
          { opinion: "$a", delta: 2 }, { opinion: "zhaoning", delta: -4 },
          { remember: { holder: "$a", act: "mother-say", valence: -1, subject: "player" } },
          { remember: { holder: "zhaoning", act: "wrong-face", valence: -1, subject: "player", heardFrom: "zhao" } },
        ],
        result: "单按{$a}的嘴开了。女儿写的那一行还扣在手机里。",
      },
      {
        label: "先不看脸，也不猜那一格",
        effects: [
          { quality: "arc:zhao", set: 1 },
          ...nextZhao(["zhaoning"]),
          { opinion: "$a", delta: 1 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
        ],
        result: "两行都还没对。{$a}把手机又扣上了。",
      },
    ],
  },
  {
    id: "arc-zhao-row",
    kind: "arc",
    cast: { a: zhao, b: zhaoWith },
    when: [
      { quality: "arc:zhao", gte: 1 },
      { not: { quality: "arc:zhao", gte: 2 } },
    ],
    weight: 46, tension: 0, once: true,
    text: "{$b}在旁边。{$a}还想替女儿说。屏幕上那一行，和她嘴里的不是同一格。",
    choices: [
      {
        label: "按屏幕那一行",
        when: [{ knowsSecret: "zhao" }],
        effects: [
          { quality: "arc:zhao", set: 2 },
          ...nextZhao(["anjie"]),
          { opinion: "$a", delta: 2 }, { opinion: "zhaoning", delta: 4 },
          { remember: { holder: "$a", act: "daughter-row", valence: 2, subject: "player" } },
          { remember: { holder: "zhaoning", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "开的是屏幕上那一行。{$a}背错的那一格，没有进单。",
      },
      {
        label: "按屏幕那一行",
        when: [{ not: { knowsSecret: "zhao" } }],
        effects: [
          { quality: "arc:zhao", set: 2 },
          ...nextZhao(["anjie"]),
          { reveal: "zhao" },
          { opinion: "$a", delta: 1 }, { opinion: "zhaoning", delta: 3 },
          { remember: { holder: "$a", act: "daughter-row", valence: 1, subject: "player", heardFrom: "$b" } },
        ],
        result: "{$b}在旁边。屏幕和{$a}嘴里的对不上，你按屏幕开了。",
      },
      {
        label: "听{$a}的，屏幕先扣上",
        effects: [
          { quality: "arc:zhao", set: 2 },
          ...nextZhao(["anjie"]),
          { opinion: "$a", delta: 3 }, { opinion: "zhaoning", delta: -3 },
          { remember: { holder: "$a", act: "mother-say", valence: -2, subject: "player" } },
          { remember: { holder: "zhaoning", act: "mother-say", valence: -1, subject: "player", heardFrom: "zhao" } },
        ],
        result: "{$a}说了算。女儿写的那一行，这单没有用。",
      },
      {
        label: "请{$a}先到休息区，让{$b}说",
        when: [{ bond: ["$b", "zhao"], kind: "family" }],
        effects: [
          { quality: "arc:zhao", set: 2 },
          ...nextZhao(["anjie"]),
          { move: { person: "$a", zone: "lounge" } },
          { opinion: "zhaoning", delta: 5 }, { opinion: "$a", delta: -2 },
          { remember: { holder: "zhaoning", act: "daughter-row", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "daughter-row", valence: 1, subject: "player", heardFrom: "zhaoning" } },
        ],
        result: "{$a}先离开镜子。这一行是{$b}自己念的，不是母亲背的。",
      },
    ],
  },
  {
    id: "arc-zhao-two",
    kind: "arc",
    cast: { a: zhao, b: zhaoWith },
    when: [
      { quality: "arc:zhao", gte: 2 },
      { not: { quality: "arc:zhao", gte: 3 } },
    ],
    weight: 46, tension: 0, once: true,
    text: "{$b}在旁边。{$a}问刚才那一格，能不能也用在{$b}的单上。",
    choices: [
      {
        label: "这一格只给她女儿",
        effects: [
          { quality: "arc:zhao", set: 3 },
          ...nextZhao(),
          { opinion: "$a", delta: 2 }, { opinion: "zhaoning", delta: 3 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "daughter-row", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "not-my-return", valence: 1, subject: "player" } },
        ],
        result: "这一格留在女儿的单上。{$b}的单另写，没有借这一行。",
      },
      {
        label: "两家用同一句",
        when: [{ role: "$b", is: "customer" }],
        effects: [
          { quality: "arc:zhao", set: 3 },
          ...nextZhao(),
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: -3 }, { opinion: "zhaoning", delta: -2 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$b", act: "wrong-face", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "mother-say", valence: -1, subject: "player" } },
        ],
        result: "两家并成一句。{$b}记下的是自己的单被别人的一格盖过了。",
      },
      {
        label: "让林姨和女儿对一下，不并成一格",
        effects: [
          { quality: "arc:zhao", set: 3 },
          ...nextZhao(),
          { bond: ["zhaoning", "linyi"], kind: "friend", set: 12 },
          { bond: ["linyi", "zhaoning"], kind: "friend", set: 12 },
          { opinion: "$a", delta: 2 }, { opinion: "linyi", delta: 2 },
          { remember: { holder: "$a", act: "introduced", valence: 1, subject: "linyi" } },
          { remember: { holder: "zhaoning", act: "introduced", valence: 1, subject: "linyi" } },
        ],
        result: "你介绍她们对清单。女儿的一格和林姨要买的那支，没有并。",
      },
    ],
  },
  {
    id: "arc-zhao-end",
    kind: "arc",
    cast: { a: zhao },
    when: [
      { quality: "arc:zhao", gte: 3 },
      { not: { quality: "arc:zhao:end", gte: 1 } },
    ],
    weight: 46, tension: 0, once: true,
    text: "{$a}又来了。手机还扣着。她问女儿那一格，以后还由不受她说。",
    choices: [
      {
        label: "女儿还让她来买",
        when: [
          { any: [
            { knowsSecret: "zhao" },
            { remembers: "zhao", act: "daughter-row", from: "zhaoning", heard: true },
          ] },
          { not: { remembers: "zhao", act: "mother-say", valence: "bad" } },
          { any: [
            { opinion: "zhaoning", gte: 4 },
            { remembers: "zhaoning", act: "honest-advice", valence: "good" },
            { remembers: "zhao", act: "daughter-row", valence: "good" },
          ] },
        ],
        effects: [
          { quality: "arc:zhao:end", set: 1 },
          { opinion: "$a", delta: 3 }, { opinion: "zhaoning", delta: 3 },
          { appoint: { person: "zhaoning", inDays: 4, slot: 1, bring: ["zhao"] } },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "以后还由她来买。开的时候对屏幕，不对她背的那一格。",
      },
      {
        label: "她按自己说的买，女儿不认",
        when: [{ any: [
          { remembers: "zhao", act: "mother-say", valence: "bad" },
          { remembers: "zhaoning", act: "wrong-face", valence: "bad" },
          { opinion: "zhaoning", lte: -4 },
        ] }],
        effects: [
          { quality: "arc:zhao:end", set: 2 },
          { opinion: "$a", delta: -2 }, { opinion: "zhaoning", delta: -3 },
          { bond: ["zhao", "zhaoning"], delta: -6 },
          { remember: { holder: "zhaoning", act: "broke-word", valence: -1, subject: "player" } },
          { leave: "$a" },
        ],
        result: "女儿不认这单。{$a}以后再来，手机里的那一行不会再交给你对。",
      },
      {
        label: "清单对过，两家不并成一格",
        when: [{ any: [
          { remembers: "zhao", act: "introduced" },
          { remembers: "zhaoning", act: "introduced" },
          { bond: ["zhaoning", "linyi"], kind: "friend", gte: 8 },
        ] }],
        effects: [
          { quality: "arc:zhao:end", set: 3 },
          { opinion: "$a", delta: 2 }, { opinion: "linyi", delta: 2 },
          { appoint: { person: "linyi", inDays: 4, slot: 1 } },
          { remember: { holder: "$a", act: "brought-friend", valence: 1, subject: "player" } },
        ],
        result: "两家的清单还分开。你介绍对过的人，下次不借女儿这一格。",
      },
      {
        label: "这单结束，屏幕扣上",
        effects: [
          { quality: "arc:zhao:end", set: 4 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
        ],
        result: "手机又扣上了。女儿的一行和她背的一行，都没有留下一句。",
      },
    ],
  },

  // —— 米朵：灯开着。她要两周能看出来，台账要的是另一句 ——

  {
    id: "arc-miduo-lamp",
    kind: "arc",
    cast: { a: miduo },
    when: [
      { season: { gte: 1 } },
      { day: { gte: 5 } },
      { not: { quality: "arc:miduo", gte: 1 } },
    ],
    weight: 28, tension: 0, once: true,
    text: "{$a}把灯架在镜边。她说你就讲两周能看出来，后面她剪。两颊是红的。这句进了切片，就收不回来。",
    choices: [
      {
        label: "只说备案里有的",
        effects: [
          { quality: "arc:miduo", set: 1 },
          ...nextMiduo(["shen"]),
          { stat: "compliance", delta: 3 },
          { opinion: "$a", delta: -3 },
          { remember: { holder: "$a", act: "claim-held", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "off-camera", valence: 1, subject: "player" } },
        ],
        result: "灯还开着。两周这句没有说。{$a}能剪的，只剩备案里有的。",
      },
      {
        label: "顺着说两周能看出来",
        effects: [
          { quality: "arc:miduo", set: 1 },
          ...nextMiduo(["shen"]),
          { stat: "compliance", delta: -4 },
          { opinion: "$a", delta: 5 },
          { remember: { holder: "$a", act: "claim-full", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "on-camera", valence: -1, subject: "player" } },
        ],
        result: "切片当晚就能用。台账上对不上的，就是这一句。",
      },
      {
        label: "灯偏开，这句话留在镜头外",
        effects: [
          { quality: "arc:miduo", set: 1 },
          ...nextMiduo(["shen"]),
          { stat: "compliance", delta: 1 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "off-camera", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "claim-held", valence: 1, subject: "player" } },
        ],
        result: "灯偏开了。{$a}要的那句留在镜头外，没有进切片。",
      },
    ],
  },
  {
    id: "arc-miduo-retake",
    kind: "arc",
    cast: { a: miduo, b: miduoCircle },
    when: [
      { quality: "arc:miduo", gte: 1 },
      { not: { quality: "arc:miduo", gte: 2 } },
    ],
    weight: 28, tension: 0, once: true,
    text: "{$b}听见灯还开着。{$a}要你把刚才那句再说一遍，好剪。",
    choices: [
      {
        label: "这句不进切片",
        when: [{ remembers: "miduo", act: "claim-full" }],
        effects: [
          { quality: "arc:miduo", set: 2 },
          ...nextMiduo(["cenning"]),
          { stat: "compliance", delta: 2 },
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "claim-held", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "已经说满的那句，你让她剪掉。{$b}听见你改了口。",
      },
      {
        label: "这句不进切片",
        when: [{ not: { remembers: "miduo", act: "claim-full" } }],
        effects: [
          { quality: "arc:miduo", set: 2 },
          ...nextMiduo(["cenning"]),
          { stat: "compliance", delta: 2 },
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "claim-held", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "claim-held", valence: 1, subject: "player", heardFrom: "$b" } },
        ],
        result: "这句从一开始就没进切片。{$b}可以替你证明灯开着时你没说满。",
      },
      {
        label: "再讲一遍两周",
        effects: [
          { quality: "arc:miduo", set: 2 },
          ...nextMiduo(["cenning"]),
          { stat: "compliance", delta: -3 },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "claim-full", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "on-camera", valence: -1, subject: "player" } },
        ],
        result: "两周又说了一遍。{$b}若把这句带出去，带的是你说满的那句。",
      },
      {
        label: "请{$b}离开镜头",
        effects: [
          { quality: "arc:miduo", set: 2 },
          ...nextMiduo(["cenning"]),
          { move: { person: "$b", zone: "atrium" } },
          { opinion: "$a", delta: -1 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$b", act: "off-camera", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "off-camera", valence: 1, subject: "player" } },
        ],
        result: "{$b}离开镜头。灯还对着产品，没有对着旁边这个人。",
      },
    ],
  },
  {
    id: "arc-miduo-two",
    kind: "arc",
    cast: { a: miduo, b: miduoCircle },
    when: [
      { quality: "arc:miduo", gte: 2 },
      { not: { quality: "arc:miduo", gte: 3 } },
    ],
    weight: 28, tension: 0, once: true,
    text: "{$b}要一句能留住的。{$a}要一句能播的。两句不能是同一句。",
    choices: [
      {
        label: "给能对上的，切片不保证",
        effects: [
          { quality: "arc:miduo", set: 3 },
          ...nextMiduo(),
          { stat: "compliance", delta: 2 },
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$b", act: "claim-held", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "claim-held", valence: 1, subject: "player", heardFrom: "$b" } },
        ],
        result: "留下的是能对上的那句。{$a}的切片，你不保证还能用。",
      },
      {
        label: "给能播的，台账上你认",
        effects: [
          { quality: "arc:miduo", set: 3 },
          ...nextMiduo(),
          { stat: "compliance", delta: -3 },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "claim-full", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "on-camera", valence: -1, subject: "player", heardFrom: "miduo" } },
        ],
        result: "能播的那句进了灯。台账对不上的地方，算你认的。",
      },
      {
        label: "团队的灯不对着这句",
        when: [{ knowsSecret: "shen" }],
        effects: [
          { quality: "arc:miduo", set: 3 },
          ...nextMiduo(),
          { opinion: "shen", delta: 3 }, { opinion: "$a", delta: -2 },
          { bond: ["shen", "miduo"], delta: 3 },
          { remember: { holder: "shen", act: "kept-warning", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "claim-held", valence: 1, subject: "player", heardFrom: "shen" } },
        ],
        result: "你知道团队那句不该说满。灯还在，这句话没有对着{$a}的切片。",
      },
      {
        label: "团队的灯不对着这句",
        when: [{ not: { knowsSecret: "shen" } }],
        effects: [
          { quality: "arc:miduo", set: 3 },
          ...nextMiduo(),
          { opinion: "shen", delta: 2 }, { opinion: "$a", delta: -1 },
          { remember: { holder: "shen", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "claim-held", valence: 1, subject: "player" } },
        ],
        result: "团队的下一句你没有说满。沈薇不在这盏灯里，{$a}的切片也少了这一句。",
      },
      {
        label: "请方敏来听，这句进台账",
        effects: [
          { quality: "arc:miduo", set: 3 },
          ...nextMiduo(),
          { move: { person: "fangmin", zone: "counter" } },
          { bond: ["miduo", "fangmin"], kind: "client", set: 12 },
          { bond: ["fangmin", "miduo"], kind: "client", set: 12 },
          { stat: "compliance", delta: 2 },
          { opinion: "$a", delta: -2 }, { opinion: "fangmin", delta: 3 },
          { remember: { holder: "$a", act: "introduced", valence: 1, subject: "fangmin" } },
          { remember: { holder: "fangmin", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "方敏听到的和灯里的是同一句。你把{$a}介绍到台账这边，切片不再另说。",
      },
    ],
  },
  {
    id: "arc-miduo-end",
    kind: "arc",
    cast: { a: miduo },
    when: [
      { quality: "arc:miduo", gte: 3 },
      { not: { quality: "arc:miduo:end", gte: 1 } },
    ],
    weight: 28, tension: 0, once: true,
    text: "灯又架上了。{$a}问这句还播不播。播了，切片有。不播，她这趟白架。",
    choices: [
      {
        label: "灯还来，切片里没有那句",
        when: [
          { remembers: "miduo", act: "claim-held" },
          { not: { remembers: "miduo", act: "claim-full", valence: "bad" } },
          { any: [
            { stat: "compliance", gte: 50 },
            { opinion: "shen", gte: 4 },
            { remembers: "miduo", act: "claim-held", from: "shen", heard: true },
            { knowsSecret: "shen" },
          ] },
        ],
        effects: [
          { quality: "arc:miduo:end", set: 1 },
          { stat: "compliance", delta: 2 },
          { opinion: "$a", delta: 2 }, { opinion: "shen", delta: 2 },
          { appoint: { person: "miduo", inDays: 4, slot: 2, bring: ["cenning"] } },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "灯还会来。两周这句不在切片里，台账对得上今天说的。",
      },
      {
        label: "切片用了，台账对不上",
        when: [{ any: [
          { remembers: "miduo", act: "claim-full", valence: "bad" },
          { stat: "compliance", lte: 40 },
          { remembers: "shen", act: "on-camera", valence: "bad" },
        ] }],
        effects: [
          { quality: "arc:miduo:end", set: 2 },
          { stat: "compliance", delta: -2 },
          { opinion: "$a", delta: 2 }, { opinion: "fangmin", delta: -2 },
          { remember: { holder: "$a", act: "claim-full", valence: -1, subject: "player" } },
          { remember: { holder: "fangmin", act: "broke-warning", valence: -1, subject: "player" } },
        ],
        result: "切片留着两周那句。台账上少的，就是灯开着时你说满的那一下。",
      },
      {
        label: "你介绍的人站在镜头外",
        when: [{ any: [
          { remembers: "miduo", act: "introduced" },
          { bond: ["miduo", "fangmin"], kind: "client" },
          { opinion: "cenning", gte: 5 },
        ] }],
        effects: [
          { quality: "arc:miduo:end", set: 3 },
          { opinion: "$a", delta: 1 }, { opinion: "fangmin", delta: 2 },
          { appoint: { person: "cenning", inDays: 4, slot: 2 } },
          { remember: { holder: "$a", act: "off-camera", valence: 1, subject: "player" } },
        ],
        result: "你介绍到这面柜的人还来。灯对着产品的时候，人不进切片。",
      },
      {
        label: "灯关了，这单不留",
        effects: [
          { quality: "arc:miduo:end", set: 4 },
          { opinion: "$a", delta: -2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
          { leave: "$a" },
        ],
        result: "灯收了。没有切片，也没有一句留在台账上的话。",
      },
    ],
  },
];

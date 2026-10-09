// 主线第 1 幕「一张署了别人名字的单子」→ 第 2 幕「名字在谁手里」。
// 悬念用的是人物圣经里已经埋下的四条秘密（沈薇的退货单、宋姐群里借出去的名字、
// 尹小姐包带里的录音笔、方敏按住不念的那一行）。翻面的每一个落点都必须先有本子上的
// 线索才按得出来 —— 反转不许凭空掉下来的这条，由 tests/world-content.test.ts 钉住。
// 幕号走 quality「mainline:act」，落点走 quality「thread:return-slip」，文案在 content/clues.ts。
import type { Storylet } from "../types.ts";

const ACT = (eq: number) => ({ quality: "mainline:act", eq } as const);
const OPEN = { not: { quality: "thread:return-slip", gte: 1 } } as const;

export const STORYLETS_MAINLINE: Storylet[] = [
  {
    id: "main-slip-open",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] } },
    when: [ACT(0), { day: { gte: 4 } }, { present: "fangmin" }],
    weight: 32,
    tension: 1,
    once: true,
    text: "{$a}把一张退货单压在镜边。名字那一栏写的是沈薇，退款已经进了柜位的账。她只问一句：这张脸你接没接过。",
    choices: [
      {
        label: "照实说：这季没来接过这张脸",
        effects: [
          { quality: "mainline:act", set: 1 },
          { remember: { holder: "fangmin", act: "same-as-record", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 4 },
          { stat: "compliance", delta: 3 },
        ],
        result: "{$a}在单子角上写了一个「问」。这一页今天翻不过去，但它留在柜上了。",
      },
      {
        label: "先问这单是哪一天进来的",
        effects: [
          { quality: "mainline:act", set: 1 },
          { clue: "slip-hand" },
          { remember: { holder: "fangmin", act: "slip-asked-date", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 2 },
        ],
        result: "日期比她那一单晚三天。{$a}把这一行指给你看，什么都没说。你把日子记在本子上。",
      },
      {
        label: "说这单也许是别处退的",
        effects: [
          { quality: "mainline:act", set: 1 },
          { remember: { holder: "fangmin", act: "slip-punted", valence: -2, subject: "player" } },
          { opinion: "fangmin", delta: -5 },
          { opinion: "shen", delta: -6 },
          { stat: "compliance", delta: -6 },
        ],
        result: "{$a}把那张纸收回档案袋，没有再问第二遍。名字没落在你身上，落在了还没开口的人身上。",
      },
    ],
  },
  {
    id: "main-slip-shen",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] } },
    when: [
      ACT(1), OPEN, { present: "shen" }, { day: { gte: 6 } },
      { any: [{ knowsSecret: "shen" }, { quality: "arc:shen", gte: 1 }, { clue: "slip-gap" }, { clue: "slip-borrowed" }] },
    ],
    weight: 26,
    tension: 0,
    once: true,
    text: "{$a}看见镜边那张单子的复印件。她停了停，问你那一栏的字是谁写的。这句话她没打算当着别人问。",
    choices: [
      {
        label: "把日期指给她看",
        effects: [
          { clue: "slip-hand" },
          { remember: { holder: "shen", act: "not-my-return", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 6 },
        ],
        result: "她看完那三个笔画，说她那三天在别的城市。这句她留给你，不留给群里。",
      },
      {
        label: "让她自己去跟柜上说",
        effects: [
          { clue: "slip-hand" },
          { remember: { holder: "shen", act: "slip-not-mine", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 3 },
          { opinion: "fangmin", delta: -2 },
        ],
        result: "她说她自己会去。你不是她的嘴。日期你顺手记下了。",
      },
      {
        label: "替她把这一栏抄下来",
        effects: [
          { clue: "slip-hand" },
          { remember: { holder: "shen", act: "not-my-return", valence: 1, subject: "player" } },
          { bond: ["shen", "player"], kind: "client", set: 30 },
          { stat: "compliance", delta: -2 },
        ],
        result: "她说抄下来也没用，名字不在你手里。笔迹对上了，你多了一条不在档案里的东西。",
      },
    ],
  },
  {
    id: "main-slip-song",
    kind: "mainline",
    cast: { a: { id: "songjie", where: [] } },
    when: [
      ACT(1), OPEN, { present: "songjie" },
      // 每条线索卡都留着「拿着本子上已有那条再问下去」这条路：不认识她也能顺着问。
      { any: [{ knowsSecret: "songjie" }, { opinion: "songjie", gte: 15 }, { clue: "slip-hand" }, { clue: "slip-gap" }] },
    ],
    weight: 24,
    tension: 1,
    once: true,
    text: "{$a}在你跟前翻她的群。置顶那条是退货的截图，名字写的是沈薇。她抬头看你，等你先开口。",
    choices: [
      {
        label: "问这个名字是谁给的",
        effects: [
          { clue: "slip-borrowed" },
          { remember: { holder: "songjie", act: "slip-named-group", valence: -2, subject: "player" } },
          { opinion: "songjie", delta: -6 },
          { bond: ["songjie", "player"], delta: -10 },
        ],
        result: "她说名字是群里借的，货在群里转了一圈。这句话出了她的口，今晚就在别人的手机上。",
      },
      {
        label: "不说破，只把截图那行日子记下",
        effects: [
          { clue: "slip-borrowed" },
          { remember: { holder: "songjie", act: "slip-name-held", valence: 1, subject: "player" } },
          { opinion: "songjie", delta: 5 },
        ],
        result: "她松了一口气，把手机扣过去。你手里多了一条没被任何人念过的。",
      },
      {
        label: "让她把截图删了",
        effects: [
          { remember: { holder: "songjie", act: "slip-name-held", valence: -1, subject: "player" } },
          { opinion: "songjie", delta: -3 },
          { opinion: "shen", delta: 4 },
        ],
        result: "她笑着说删了也截过。你没拿到那条，倒是没把它变成你的。",
      },
    ],
  },
  {
    id: "main-slip-yin",
    kind: "mainline",
    cast: { a: { id: "yinxiaojie", where: [] } },
    when: [
      ACT(1), OPEN, { present: "yinxiaojie" },
      { any: [{ knowsSecret: "yinxiaojie" }, { remembers: "yinxiaojie", act: "hard-sell", valence: "bad" }, { clue: "slip-hand" }, { clue: "slip-borrowed" }] },
    ],
    weight: 22,
    tension: 1,
    once: true,
    text: "{$a}把包搁在柜台上，包带没合。她问这支是不是两周就能看出来，语气跟上次一模一样。",
    choices: [
      {
        label: "只说备案里写得下的",
        effects: [
          { clue: "slip-tape" },
          { remember: { holder: "yinxiaojie", act: "claim-held", valence: 1, subject: "player" } },
          { opinion: "yinxiaojie", delta: 5 },
          { stat: "compliance", delta: 2 },
        ],
        result: "她「嗯」了一声。包带里那点红灯灭了，这一句她录不录都在你这边。",
      },
      {
        label: "把两周那句话说满",
        effects: [
          { clue: "slip-tape" },
          { remember: { holder: "yinxiaojie", act: "claim-full", valence: -2, subject: "player" } },
          { opinion: "yinxiaojie", delta: -10 },
          { stat: "compliance", delta: -6 },
        ],
        result: "她点头点得很慢。你后来才知道，那晚柜上多出来的那句话是从这条录音里出去的。",
      },
      {
        label: "问她包带里是不是还开着",
        effects: [
          { clue: "slip-tape" },
          { remember: { holder: "yinxiaojie", act: "slip-asked-tape", valence: -1, subject: "player" } },
          { opinion: "yinxiaojie", delta: -4 },
        ],
        result: "她把包拎回去，说她想录的是别家。这句话你不信，她也不信你信了。",
      },
    ],
  },
  {
    id: "main-slip-fang",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] } },
    when: [
      ACT(1), OPEN, { present: "fangmin" },
      { any: [{ knowsSecret: "fangmin" }, { remembers: "fangmin", act: "named-colleague", valence: "bad" }, { clue: "slip-hand" }, { clue: "slip-borrowed" }] },
    ],
    weight: 20,
    tension: 0,
    once: true,
    text: "{$a}从档案袋里抽出一张赠品领用表。缺口那一行有名字，她用手指按住，不念。",
    choices: [
      {
        label: "问这一行跟那张单子是不是同一件事",
        effects: [
          { clue: "slip-gap" },
          { remember: { holder: "fangmin", act: "slip-asked-gap", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 4 },
          { stat: "compliance", delta: 2 },
        ],
        result: "她说：你自己看日期。名字她还是不念，但表没有收回去。",
      },
      {
        label: "说缺口那事你认",
        effects: [
          { clue: "slip-gap" },
          { remember: { holder: "fangmin", act: "slip-owned-line", valence: 2, subject: "player" } },
          { opinion: "fangmin", delta: 6 },
          { stat: "compliance", delta: 5 },
          { stat: "standing", delta: -3 },
        ],
        result: "她把表推到你这边。认了的那一行今晚就进了档案，不再是一张纸。",
      },
      {
        label: "把手从表上收回来，不碰那一行",
        effects: [
          { remember: { holder: "fangmin", act: "slip-name-held", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: -2 },
        ],
        result: "她把表放回袋里。这一行今天没人念过，包括你。",
      },
    ],
  },
  {
    id: "main-slip-turn",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] }, b: { id: "fangmin", where: [], mustBePresent: false } },
    when: [
      ACT(1), OPEN, { present: "shen" }, { day: { gte: 12 } },
      { clue: "slip-hand" },
      { any: [{ clue: "slip-borrowed" }, { clue: "slip-tape" }] },
    ],
    weight: 36,
    tension: 1,
    once: true,
    // 翻面：第 1 季挂在柜位名下那笔退款，不是顾客反悔。
    // 是有人拿你说过满的那句话，在群里换了一次人情，名字借的是她的。
    text: "本子上那几条对到了一起：退货那晚的话不是这面镜子里说的，是从{$b}那句「两周能看出来」里长出去的；名字从群里借，货在群里转。{$a}站在镜子前，第一次没有把手机递给你。",
    choices: [
      {
        label: "把日期、笔迹和你自己那句一起交出去",
        effects: [
          { quality: "thread:return-slip", set: 1 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "fangmin", act: "slip-owned-line", valence: 2, subject: "player" } },
          { remember: { holder: "shen", act: "slip-owned-line", valence: 2, subject: "player" } },
          { remember: { holder: "songjie", act: "slip-named-group", valence: -2, subject: "player" } },
          { opinion: "fangmin", delta: 10 },
          { opinion: "shen", delta: 8 },
          { opinion: "songjie", delta: -8 },
          { stat: "compliance", delta: 8 },
          { stat: "standing", delta: 4 },
          { appoint: { person: "songjie", inDays: 2, slot: 2 } },
        ],
        result: "{$b}收下那几页，把你的原话排在最前面。柜位的数少了一笔，名字第一次写在「说清的人」那一栏。宋姐两天后会上楼来。",
      },
      {
        label: "只说名字是从群里借的",
        effects: [
          { quality: "thread:return-slip", set: 2 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "songjie", act: "slip-named-group", valence: -2, subject: "player" } },
          { remember: { holder: "fangmin", act: "slip-named-group", valence: 1, subject: "player" } },
          { opinion: "songjie", delta: -14 },
          { opinion: "shen", delta: 4 },
          { opinion: "fangmin", delta: 2 },
          { bond: ["songjie", "player"], kind: "client", set: -25 },
          { stat: "compliance", delta: 3 },
        ],
        result: "名字出了口。{$a}没有谢你，她说那句「不会再帮你带货」原来不是对她自己说的。群里今晚少了一个人，柜上多了一个知道你怎么用名字的人。",
      },
      {
        label: "等档案自己走到台面上，今天不开口",
        effects: [
          { quality: "thread:return-slip", set: 3 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "shen", act: "slip-waited", valence: -1, subject: "player" } },
          { remember: { holder: "fangmin", act: "slip-waited", valence: -1, subject: "player" } },
          { opinion: "shen", delta: -5 },
          { opinion: "fangmin", delta: -6 },
          { stat: "compliance", delta: -4 },
        ],
        result: "你把本子合上。{$a}替你挡过一次，你没告诉她你知道。这一页没有人写过，它就一直挂在这面镜子前。",
      },
      {
        when: [{ not: { knowsSecret: "shen" } }],
        label: "这单就是沈薇退的",
        effects: [
          { quality: "thread:return-slip", set: 4 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "fangmin", act: "slip-punted", valence: -2, subject: "player" } },
          { remember: { holder: "shen", act: "slip-punted", valence: -2, subject: "player" } },
          { opinion: "shen", delta: -20 },
          { opinion: "fangmin", delta: -10 },
          { stat: "compliance", delta: -12 },
          { stat: "standing", delta: -6 },
        ],
        result: "本子上的日期和笔迹你一个字都没念。这句话进了档案，也进了{$a}的群。",
      },
      {
        when: [{ knowsSecret: "shen" }],
        label: "这单就是沈薇退的",
        effects: [
          { quality: "thread:return-slip", set: 4 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "fangmin", act: "slip-punted", valence: -2, subject: "player" } },
          { remember: { holder: "shen", act: "slip-punted", valence: -2, subject: "player" } },
          { opinion: "shen", delta: -22 },
          { opinion: "fangmin", delta: -12 },
          { stat: "compliance", delta: -12 },
          { stat: "standing", delta: -6 },
        ],
        result: "你问过那一栏是谁写的。现在你把这个名字又说了一遍。{$a}听完只说一句：那我以后不自己来。",
      },
    ],
  },
  {
    id: "main-slip-filed",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] } },
    when: [ACT(1), OPEN, { present: "shen" }, { day: { gte: 24 } }],
    weight: 30,
    tension: -1,
    once: true,
    // 幕一不能卡死：一季快过完还没攒够线索，这条线就以「你没开口」收掉，
    // 本子上的那几条留在档案里，下一季还有人对得上号。
    text: "{$a}进门没有看镜子。她说那张单子昨天并进了柜位的账，从今天起没人再问，也不用你答。",
    choices: [
      {
        label: "说好",
        effects: [
          { quality: "thread:return-slip", set: 5 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "shen", act: "slip-waited", valence: -1, subject: "player" } },
          { opinion: "shen", delta: -4 },
        ],
        result: "她点头，走得比来时快。本子上那几条还在，只是今晚没有一句被说出来。",
      },
      {
        label: "问她能不能再等一天",
        effects: [
          { quality: "thread:return-slip", set: 5 },
          { quality: "mainline:act", set: 2 },
          { stat: "standing", delta: -2 },
          { remember: { holder: "fangmin", act: "slip-waited", valence: -1, subject: "player" } },
          { opinion: "fangmin", delta: -3 },
        ],
        result: "她说等不等不归她定。你这句话没有传到人那里，柜位那一栏自己往下掉了一点。",
      },
    ],
  },
  {
    id: "main-slip-after-own",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] }, b: { id: "suman", where: [], mustBePresent: false } },
    when: [ACT(2), { quality: "thread:return-slip", eq: 1 }, { present: "fangmin" }],
    weight: 22,
    tension: -1,
    once: true,
    text: "{$a}把那张退货单从柜位名下抽出来，改成一句话的说明，署名是你。{$b}路过时看了一眼，没有停。",
    choices: [
      {
        label: "把说明的日期写清楚",
        effects: [
          { remember: { holder: "fangmin", act: "same-as-record", valence: 2, subject: "player" } },
          { opinion: "fangmin", delta: 6 },
          { stat: "compliance", delta: 4 },
          { stat: "standing", delta: 3 },
        ],
        result: "她说这一份可以摊在桌上给人看。数少了那一笔，柜上今晚没有人替你说话，也没有人踩你。",
      },
      {
        label: "问她下一个缺口是谁的",
        effects: [
          { clue: "slip-gap" },
          { remember: { holder: "fangmin", act: "slip-asked-gap", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: -2 },
        ],
        result: "她说：你刚交完一份，就要下一份？这一行她还是没念，但你手里多了一条。",
      },
    ],
  },
  {
    id: "main-slip-after-name",
    kind: "mainline",
    cast: { a: { id: "songjie", where: [] } },
    when: [ACT(2), { quality: "thread:return-slip", eq: 2 }, { present: "songjie" }],
    weight: 24,
    tension: 1,
    once: true,
    text: "{$a}上楼来了。她把手机屏幕朝下扣在柜台上，问你：群里那句话，是不是你放的。",
    choices: [
      {
        label: "说是你说的",
        effects: [
          { remember: { holder: "songjie", act: "slip-named-group", valence: -2, subject: "player" } },
          { opinion: "songjie", delta: -12 },
          { bond: ["songjie", "player"], kind: "rival", set: -40 },
          { stat: "standing", delta: -4 },
        ],
        result: "她说她以后不在这层楼问任何人。这句话今晚就传出去了，用的是你的名字。",
      },
      {
        label: "说是档案里本来就有",
        effects: [
          { remember: { holder: "songjie", act: "slip-waited", valence: -1, subject: "player" } },
          { remember: { holder: "fangmin", act: "slip-name-held", valence: -1, subject: "player", heardFrom: "songjie" } },
          { opinion: "songjie", delta: -4 },
          { stat: "compliance", delta: -3 },
        ],
        result: "她笑了一下：原来你的名字也会挪地方。她没有再问第二次。",
      },
      {
        label: "把自己的名字给她看",
        effects: [
          { remember: { holder: "songjie", act: "slip-owned-line", valence: 1, subject: "player" } },
          { opinion: "songjie", delta: 8 },
          { bond: ["songjie", "player"], kind: "client", set: 10 },
          { stat: "standing", delta: -2 },
        ],
        result: "她说：行，那你欠我一句道歉，不欠她们。这一条她记下，也还你一条。",
      },
    ],
  },
  {
    id: "main-slip-after-quiet",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] } },
    when: [ACT(2), { quality: "thread:return-slip", gte: 3 }, { present: "shen" }],
    weight: 22,
    tension: 0,
    once: true,
    text: "{$a}又来了，还是一个人。她看镜子的时间比看你长。她说她想问一句：那张单子，后来在你这儿算谁的。",
    choices: [
      {
        label: "说算柜上的",
        effects: [
          { remember: { holder: "shen", act: "slip-waited", valence: -1, subject: "player" } },
          { opinion: "shen", delta: -5 },
        ],
        result: "她说柜上是个什么地方：谁都不在里面。团队那句她还是没有收，只是往后推。",
      },
      {
        label: "把本子上的几条念给她",
        effects: [
          { remember: { holder: "shen", act: "slip-not-mine", valence: 2, subject: "player" } },
          { opinion: "shen", delta: 10 },
          { stat: "standing", delta: 2 },
          { appoint: { person: "miduo", inDays: 2, slot: 2 } },
        ],
        result: "她听完只说：你留着这些，却一直没开口。她把日期拿走了，下一场灯的事她自己安排。",
      },
      {
        label: "说这一句现在说不说都一样",
        effects: [
          { remember: { holder: "shen", act: "slip-punted", valence: -2, subject: "player" } },
          { opinion: "shen", delta: -10 },
          { bond: ["shen", "player"], kind: "client", set: -20 },
        ],
        result: "她点头，说这确实是她们的相处方式。出门时她没有回头。",
      },
    ],
  },
];

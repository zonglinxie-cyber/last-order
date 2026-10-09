// 第 3 季顾客个人线（第三批）：宋姐、白姐。每人四张，开头不早于第 5 天，第 3 季才开。
// 为什么排第 3 季：前 16 条线在第 2 季末全部收完，第 3 季起只有过路社交 —— 翻到第三季看到的是一层楼在歇班。
// 这两条读的全是前两季带过来的东西：宋姐那条读主线本子上「名字是从群里借的」那一句和她自己那笔垫付，
// 白姐那条读第 1 季安姐婚礼线的落点（arc:anjie:end 1~4），两条之间再互读（群里先问一句的人就是她）。
// 反转不撞主线第 3 幕：那一幕答的是「那一行是谁的手写的」，宋姐这条答的是「那笔钱是谁垫的、图是谁拍的」。
import type { Storylet } from "../types.ts";

type Slot = Storylet["cast"][string];

const songjie: Slot = { id: "songjie", where: [] };
const baijie: Slot = { id: "baijie", where: [] };

/** 群里先问那一句的人：宋姐的女性熟客、女性对头，或柜上任何一位女同事。
 *  同事每时段都在，线不会停在等人上；钉成女性是因为这一张卡里{$b}要用「她」念。 */
const groupSpeaker: Slot = {
  where: [
    { gender: "$self", is: "f" },
    { any: [
      { bond: ["songjie", "$self"], kind: "client" },
      { bond: ["songjie", "$self"], kind: "rival" },
      { role: "$self", is: "staff" },
    ] },
  ],
};

export const STORYLETS_ARCS5: Storylet[] = [
  // —— 个人线：宋姐。第 3 季才开，读主线的名字和她自己那一栏垫付 ——

  {
    id: "arc-sj-shot",
    kind: "arc",
    cast: { a: songjie },
    when: [
      { season: { gte: 3 } },
      { day: { gte: 5 } },
      { not: { quality: "arc:songjie", gte: 1 } },
    ],
    weight: 30, tension: 0, once: true,
    text: "{$a}把手机屏幕朝下扣在柜面上。群里这一季在翻旧账，问那一单到底是谁退的。她第一句先说：这不是柜上的事。",
    choices: [
      {
        label: "先问那张截图是谁拍的",
        effects: [
          { quality: "arc:songjie", set: 1 },
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "group-asked-shot", valence: 2, subject: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1 } },
        ],
        result: "{$a}说这一句她回去问。手机没有翻过来，可是她没有走。",
      },
      {
        label: "群里的事柜上不管",
        effects: [
          { quality: "arc:songjie", set: 1 },
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "group-not-asked", valence: 1, subject: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1 } },
        ],
        result: "{$a}点头。她说柜上只管自己这一页，这句她本来也打算这么说。",
      },
      {
        label: "把群里那句当场念出来",
        effects: [
          { quality: "arc:songjie", set: 1 },
          { opinion: "$a", delta: -8 }, { opinion: "shen", delta: -3 },
          { bond: ["songjie", "player"], kind: "rival", set: -18 },
          { remember: { holder: "$a", act: "group-read-out", valence: -2, subject: "player" } },
          { remember: { holder: "shen", act: "group-read-out", valence: -2, subject: "songjie", heardFrom: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1 } },
        ],
        result: "「沈薇退的」这句在柜上响了一遍。{$a}收起手机，走的时候说这一句她自己会还。",
      },
    ],
  },
  {
    id: "arc-sj-book",
    kind: "arc",
    cast: { a: songjie },
    when: [
      { quality: "arc:songjie", gte: 1 },
      { not: { quality: "arc:songjie", gte: 2 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "第二次她放下的不是手机，是一沓小票。不是退货单 —— 是她替群里垫的钱，三个月，一笔都没有进柜上的账。",
    choices: [
      {
        label: "照小票一笔一笔对上",
        effects: [
          { quality: "arc:songjie", set: 2 },
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "group-book-matched", valence: 2, subject: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1 } },
        ],
        result: "票对票，{$a}在旁边念日期。这一沓第一次被人按数目排开，没有排进别人名下。",
      },
      {
        label: "问她这一沓跟柜上什么关系",
        effects: [
          { quality: "arc:songjie", set: 2 },
          { opinion: "$a", delta: -3 },
          { remember: { holder: "$a", act: "group-book-asked", valence: -1, subject: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1 } },
        ],
        result: "{$a}说：没关系。她说完把最上面那一支抽出来，压在柜面下面。",
      },
      {
        label: "替她把这一沓并进柜上的账",
        effects: [
          { quality: "arc:songjie", set: 2 },
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -5 },
          { bond: ["songjie", "fangmin"], delta: -4 },
          { remember: { holder: "$a", act: "group-book-merged", valence: -2, subject: "player" } },
          { remember: { holder: "fangmin", act: "group-book-merged", valence: -2, subject: "songjie", heardFrom: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1 } },
        ],
        result: "票上的名字改写成柜位的。{$a}看着那一行没有说话 —— 这一沓从此进得了账，也出不了事。",
      },
      {
        label: "那张截图是你自己拍的吧",
        when: [{ remembers: "songjie", act: "slip-named-group", valence: "bad" }],
        effects: [
          { quality: "arc:songjie", set: 2 },
          { opinion: "$a", delta: 6 },
          { reveal: "songjie" },
          { remember: { holder: "$a", act: "group-shot-known", valence: 2, subject: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1 } },
        ],
        result: "{$a}把小票推回去，只说了一句：图是我拍的，名字是我借的。这一季她等你把这两句分开听。",
      },
    ],
  },
  {
    id: "arc-sj-who",
    kind: "arc",
    cast: { a: songjie, b: groupSpeaker },
    when: [
      { quality: "arc:songjie", gte: 2 },
      { not: { quality: "arc:songjie", gte: 3 } },
      { present: "$b" },
    ],
    weight: 32, tension: 1, once: true,
    text: "她把群翻到那一页给你看。{$a}说的是第一句：截图不是她发的。那天在群里先问「这不是沈薇退的吗」的是{$b}，图才传开的。柜上一认这笔，{$b}就要她退。",
    choices: [
      {
        label: "这一页由她自己跟{$b}说",
        effects: [
          { quality: "arc:songjie", set: 3 },
          { opinion: "$a", delta: 4 },
          { bond: ["songjie", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "group-told-herself", valence: 2, subject: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1, bring: ["$b"] } },
        ],
        result: "{$a}想了很久，说好。她说这一句得当面说，不能由柜上转一句给她。",
      },
      {
        label: "柜上替她把那一笔退掉",
        effects: [
          { quality: "arc:songjie", set: 3 },
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: 5 },
          { stat: "money", delta: -980 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "group-paid-by-counter", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "group-paid-by-counter", valence: 1, subject: "songjie", heardFrom: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1 } },
        ],
        result: "那一笔从柜上走出去，{$a}没有数。她说下次垫出去的钱她自己也这样要回来 —— 这句你听得出不是谢。",
      },
      {
        label: "把{$b}的名字念给柜上听",
        effects: [
          { quality: "arc:songjie", set: 3 },
          { opinion: "$a", delta: -10 }, { opinion: "$b", delta: -6 },
          { bond: ["songjie", "$b"], delta: -12 },
          { remember: { holder: "$a", act: "group-client-named", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "group-named-out", valence: -2, subject: "songjie", heardFrom: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1 } },
        ],
        result: "{$a}把手机按灭。她说那一沓垫付里有一笔是{$b}的 —— 现在两笔都记在你嘴里。",
      },
      {
        label: "先问她那一栏到底记在谁名下",
        when: [{ knowsSecret: "songjie" }],
        effects: [
          { quality: "arc:songjie", set: 3 },
          { opinion: "$a", delta: 8 },
          { bond: ["songjie", "player"], kind: "client", set: 32 },
          { remember: { holder: "$a", act: "group-money-known", valence: 2, subject: "player" } },
          { appoint: { person: "songjie", inDays: 2, slot: 1 } },
        ],
        result: "「记在一个能退货的名字上。」{$a}把小票收进包的最外层。借名字不是为了躲退货，是为了让垫出去的钱有一栏可退。",
      },
    ],
  },
  {
    id: "arc-sj-end",
    kind: "arc",
    cast: { a: songjie },
    when: [
      { quality: "arc:songjie", gte: 3 },
      { not: { quality: "arc:songjie:end", gte: 1 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "群里那张截图过期了。柜上问她这一季的名字还挂不挂在熟客那一栏，以及那一沓垫付要不要留一个说法。",
    choices: [
      {
        label: "那一笔写回她自己名下",
        when: [
          { knowsSecret: "songjie" },
          { opinion: "songjie", gte: 8 },
          { not: { remembers: "songjie", act: "group-client-named", valence: "bad" } },
        ],
        effects: [
          { quality: "arc:songjie:end", set: 1 },
          { opinion: "$a", delta: 8 }, { stat: "standing", delta: 3 },
          { bond: ["songjie", "player"], kind: "client", set: 45 },
          { remember: { holder: "$a", act: "group-own-name", valence: 2, subject: "player" } },
          { appoint: { person: "songjie", inDays: 3, slot: 2 } },
        ],
        result: "垫付那一栏从此写宋姐。群里还在问那一单是谁退的，她这一次没有答，也没有撤群。",
      },
      {
        label: "她们自己把那一笔对完了",
        when: [{ remembers: "songjie", act: "group-told-herself" }],
        effects: [
          { quality: "arc:songjie:end", set: 2 },
          { opinion: "$a", delta: 3 }, { stat: "standing", delta: 2 },
          { remember: { holder: "$a", act: "group-settled", valence: 2, subject: "player" } },
          { appoint: { person: "songjie", inDays: 4, slot: 1 } },
        ],
        result: "那一笔最后是{$a}跟群里对完的。柜上少了一个替她开口的名目，台账上多了一行没人认领的旧数。",
      },
      {
        label: "柜上那一笔她不再要了",
        when: [{ remembers: "songjie", act: "group-paid-by-counter" }],
        effects: [
          { quality: "arc:songjie:end", set: 3 },
          { opinion: "$a", delta: 4 }, { stat: "standing", delta: -2 },
          { bond: ["songjie", "player"], kind: "friend", set: 25 },
          { remember: { holder: "$a", act: "group-owed-stays", valence: 2, subject: "player" } },
        ],
        result: "{$a}说这一季柜上替她走过一回，那一笔她就不按旧账算了。这句话她记着，你也会记着。",
      },
      {
        label: "她退群，这柜不替群里开单",
        when: [{ remembers: "songjie", act: "group-client-named", valence: "bad" }],
        effects: [
          { quality: "arc:songjie:end", set: 4 },
          { opinion: "$a", delta: -12 },
          { bond: ["songjie", "player"], kind: "rival", set: -35 },
          { leave: "$a" },
        ],
        result: "{$a}把群退了，代购那一栏从此不走你这面柜。名字被念出去那天起，她就没有打算再给你看那一沓票。",
      },
      {
        label: "这一页谁也没念",
        effects: [
          { quality: "arc:songjie:end", set: 5 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "group-nothing-said", valence: 0, subject: "player" } },
          { leave: "$a" },
        ],
        result: "{$a}把小票一张一张收回去。那一沓她背得出数目，一个字也没有说。",
      },
    ],
  },

  // —— 个人线：白姐。第 3 季才开，读第 1 季安姐婚礼线的落点 ——

  {
    id: "arc-bj-six",
    kind: "arc",
    cast: { a: baijie },
    when: [
      { season: { gte: 3 } },
      { day: { gte: 5 } },
      { not: { quality: "arc:baijie", gte: 1 } },
    ],
    weight: 30, tension: 0, once: true,
    text: "{$a}一个人上楼，工具包放在凳边，比上次轻。她这一季问的不是色号，是六个色能不能都在她脸上过一遍。",
    choices: [
      {
        label: "六个色一个一个答",
        effects: [
          { quality: "arc:baijie", set: 1 },
          { opinion: "$a", delta: 5 },
          { remember: { holder: "$a", act: "case-six-shades", valence: 2, subject: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0 } },
        ],
        result: "六个色分开念完。{$a}在纸上记了六行，每一行后面写的是脸，不是价。",
      },
      {
        label: "按她的预算只开一支",
        effects: [
          { quality: "arc:baijie", set: 1 },
          { opinion: "$a", delta: -5 },
          { remember: { holder: "$a", act: "case-shade-short", valence: -2, subject: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0 } },
        ],
        result: "一支 ¥980 推过去。{$a}说好，把其余五行划掉 —— 她划的那几行不是价，是当天要上的脸。",
      },
      {
        label: "问她这一次替谁选",
        effects: [
          { quality: "arc:baijie", set: 1 },
          { opinion: "$a", delta: 2 },
          { bond: ["baijie", "anjie"], delta: 2 },
          { remember: { holder: "$a", act: "case-asked-whofor", valence: 1, subject: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0 } },
        ],
        result: "「这一次不替别人。」{$a}说完把工具包的拉链拉上，没有再解释。",
      },
    ],
  },
  {
    id: "arc-bj-chair",
    kind: "arc",
    cast: { a: baijie },
    when: [
      { quality: "arc:baijie", gte: 1 },
      { not: { quality: "arc:baijie", gte: 2 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "第二次她还是一个人。那场婚礼定了别人 —— {$a}只说色还没试完，没有说定的是谁。",
    choices: [
      {
        label: "那场婚礼台子还在你柜上",
        when: [{ quality: "arc:anjie:end", eq: 1 }],
        effects: [
          { quality: "arc:baijie", set: 2 },
          { opinion: "$a", delta: -2 }, { opinion: "anjie", delta: 3 },
          { bond: ["baijie", "anjie"], delta: 5 },
          { remember: { holder: "$a", act: "case-chair-named", valence: 2, subject: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0 } },
        ],
        result: "安姐那场还是交给你柜的。{$a}那天只上了半天，其余时间她在楼下等一个没排到她的名额。",
      },
      {
        label: "定的人是苏蔓那边",
        when: [{ quality: "arc:anjie:end", eq: 2 }],
        effects: [
          { quality: "arc:baijie", set: 2 },
          { opinion: "$a", delta: 3 }, { opinion: "suman", delta: 2 },
          { bond: ["baijie", "suman"], kind: "colleague", set: 10 },
          { remember: { holder: "$a", act: "case-chair-named", valence: 2, subject: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0 } },
        ],
        result: "{$a}点头。她说换的是镜位不是手，这一句她讲得平平，没有要谁难堪。",
      },
      {
        label: "案例是她自己撤下来的",
        when: [{ quality: "arc:anjie:end", eq: 3 }],
        effects: [
          { quality: "arc:baijie", set: 2 },
          { opinion: "$a", delta: 5 },
          { bond: ["baijie", "player"], delta: -3 },
          { remember: { holder: "$a", act: "case-chair-pulled", valence: 2, subject: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0 } },
        ],
        result: "那一场她没上。{$a}把案例图撤下来的那天，跟谁都没说 —— 这季她是来补那六行的。",
      },
      {
        label: "那一场所谓的婚礼跟她无关",
        effects: [
          { quality: "arc:baijie", set: 2 },
          { opinion: "$a", delta: 1 },
          { remember: { holder: "$a", act: "case-chair-plain", valence: 1, subject: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0 } },
        ],
        result: "{$a}说好。她说那场她本来就没被叫，只把六色那一张纸留在柜面上。",
      },
    ],
  },
  {
    id: "arc-bj-kit",
    kind: "arc",
    cast: { a: baijie },
    when: [
      { quality: "arc:baijie", gte: 2 },
      { not: { quality: "arc:baijie", gte: 3 } },
    ],
    weight: 32, tension: 1, once: true,
    text: "{$a}第一次要一次开四支：六个色得都在包里。她自己报的预算只够一支。她说这不是囤货，是上台的家当。",
    choices: [
      {
        label: "按一支开，色号记她名下",
        effects: [
          { quality: "arc:baijie", set: 3 },
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "kit-one-kept", valence: 2, subject: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0 } },
        ],
        result: "一支，票上写她的名字。{$a}结账时没有讲价，走的时候把那张色号纸带走了。",
      },
      {
        label: "四支都开，票分开打",
        effects: [
          { quality: "arc:baijie", set: 3 },
          { opinion: "$a", delta: 6 }, { opinion: "fangmin", delta: -4 },
          { stat: "standing", delta: 3 }, { stat: "compliance", delta: -5 },
          { bond: ["baijie", "fangmin"], delta: -4 },
          { remember: { holder: "$a", act: "kit-split-ticket", valence: -2, subject: "player" } },
          { remember: { holder: "fangmin", act: "kit-split-ticket", valence: -2, subject: "baijie", heardFrom: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0 } },
        ],
        result: "四支出门，票打成一客四张。台账那一页对上的是四个名字，{$a}说这才叫上台。",
      },
      {
        label: "拿试色小样替她凑齐六色",
        effects: [
          { quality: "arc:baijie", set: 3 },
          { opinion: "$a", delta: 4 },
          { stat: "samples", delta: -3 }, { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "kit-samples-filled", valence: 2, subject: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0 } },
        ],
        result: "六色凑齐了，货架上少三支小样。{$a}把每一支压在自己的色号纸上，没有动零售那几支。",
      },
      {
        label: "问她群里那张图上的色",
        when: [{ opinion: "songjie", gte: 3 }],
        effects: [
          { quality: "arc:baijie", set: 3 },
          { opinion: "$a", delta: 5 }, { opinion: "songjie", delta: -5 },
          { bond: ["baijie", "songjie"], delta: -6 },
          { remember: { holder: "$a", act: "case-group-shot", valence: 2, subject: "player" } },
          { remember: { holder: "songjie", act: "group-named-out", valence: -2, subject: "baijie", heardFrom: "player" } },
          { appoint: { person: "baijie", inDays: 2, slot: 0, bring: ["songjie"] } },
        ],
        result: "图是{$a}那天拍的。她说她只是问了一句，第二天就成了别人退的 —— 这句话和宋姐那一沓票对得上。",
      },
    ],
  },
  {
    id: "arc-bj-end",
    kind: "arc",
    cast: { a: baijie },
    when: [
      { quality: "arc:baijie", gte: 3 },
      { not: { quality: "arc:baijie:end", gte: 1 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "柜上问下一次上台，色还给不给留。{$a}把工具包提在手里，没有像上次那样放在凳边。",
    choices: [
      {
        label: "六个色留下一次上台",
        when: [
          { remembers: "baijie", act: "kit-samples-filled" },
          { opinion: "baijie", gte: 6 },
          { not: { remembers: "baijie", act: "kit-split-ticket", valence: "bad" } },
        ],
        effects: [
          { quality: "arc:baijie:end", set: 1 },
          { opinion: "$a", delta: 6 },
          { bond: ["baijie", "player"], kind: "client", set: 42 },
          { remember: { holder: "$a", act: "case-chair-kept", valence: 2, subject: "player" } },
          { appoint: { person: "baijie", inDays: 4, slot: 0 } },
        ],
        result: "六色留在她名下，下一场她自己排时间。{$a}走的时候说，上台的人报的是这个柜，不是这个牌子。",
      },
      {
        label: "那一笔还是按一支开完",
        when: [{ remembers: "baijie", act: "kit-one-kept" }],
        effects: [
          { quality: "arc:baijie:end", set: 2 },
          { opinion: "$a", delta: -2 }, { stat: "standing", delta: 2 }, { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "case-record-as-said", valence: 1, subject: "player" } },
        ],
        result: "台账是齐的。{$a}认这一笔按一支算，只是从此不再把当天的色号纸留在你柜上。",
      },
      {
        label: "她带着别人来试色",
        when: [{ opinion: "anjie", gte: 5 }],
        effects: [
          { quality: "arc:baijie:end", set: 3 },
          { opinion: "$a", delta: 3 }, { opinion: "anjie", delta: 2 },
          { bond: ["baijie", "anjie"], delta: 5 },
          { remember: { holder: "$a", act: "case-brought-client", valence: 2, subject: "player" } },
          { appoint: { person: "baijie", inDays: 3, slot: 0, bring: ["anjie"] } },
        ],
        result: "{$a}把安姐带来试第二个色。台上的人她不带，带的是还在挑的人 —— 这面柜多了一个报得出的名字。",
      },
      {
        label: "群里那句由她自己收回去",
        when: [{ remembers: "baijie", act: "case-group-shot" }],
        effects: [
          { quality: "arc:baijie:end", set: 4 },
          { opinion: "$a", delta: 4 }, { opinion: "songjie", delta: 6 },
          { bond: ["baijie", "songjie"], delta: 8 },
          { remember: { holder: "$a", act: "case-group-pulled", valence: 2, subject: "player" } },
        ],
        result: "{$a}在群里把那一句收了回去，写的是「色是我问的，退货不是她退的」。宋姐那一沓票少了一个追问的人。",
      },
      {
        label: "工具包不再放这个凳边",
        effects: [
          { quality: "arc:baijie:end", set: 5 },
          { opinion: "$a", delta: -3 },
          { bond: ["baijie", "player"], delta: -5 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
          { leave: "$a" },
        ],
        result: "{$a}把包提走，凳边空出来。六个色她后来在楼下另一面柜试完了，一次也没报你这个柜。",
      },
    ],
  },
];

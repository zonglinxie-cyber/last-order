// 故事碎片第二批。口吻沿用 content/storylets.ts：短、具体、克制，一句话只做一件事。
// 这一批专门吃引擎新补的写法：bond 的 kind/set（新建关系、改种类）、
// remember 的 heardFrom（把来源钉进去）、remembers 的 from（问话问到是谁传的）、
// move（当场挪人）、reveal（当场揭开秘密）、knowsSecret（玩家已经知道）。
// 社交局只用角色槽；楼层小事按第一批的老规矩可以点到具体人。
import type { Storylet } from "../types.ts";

export const STORYLETS_SOCIAL2: Storylet[] = [
  // —— 通用社交局 ——

  {
    id: "social-intro-mirror",
    kind: "social",
    cast: {
      a: { where: [{ opinion: "$self", gte: 10 }] },
      b: { where: [{ opinion: "$self", gte: 10 }, { bond: ["$a", "$self"], lte: 0 }, { bond: ["$self", "$a"], lte: 0 }] },
    },
    when: [{ present: "$b" }],
    weight: 5, tension: 0, cooldown: 5,
    text: "{$a}和{$b}头一回站进同一面试妆镜。两个人都肯跟你多聊两句，彼此还没说过话。",
    choices: [
      {
        label: "把两个人引到同一面镜子前",
        when: [{ not: { temper: "$a", is: "wary" } }, { not: { temper: "$b", is: "wary" } }, { any: [{ not: { temper: "$a", is: "proud" } }, { not: { temper: "$b", is: "proud" } }] }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 20 }, { bond: ["$b", "$a"], kind: "friend", set: 20 },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "introduced", valence: 1, subject: "$b" } },
          { remember: { holder: "$b", act: "introduced", valence: 1, subject: "$a" } },
        ],
        result: "你把{$a}和{$b}引到同一面镜子前，互相报了名字。两个人聊开了，记下的是你搭的这一句。",
      },
      {
        label: "把两个人引到同一面镜子前",
        when: [{ temper: "$a", is: "proud" }, { temper: "$b", is: "proud" }],
        effects: [
          { bond: ["$a", "$b"], kind: "rival", set: -10 }, { bond: ["$b", "$a"], kind: "rival", set: -10 },
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "one-upping", valence: -1, subject: "$b" } },
          { remember: { holder: "$b", act: "one-upping", valence: -1, subject: "$a" } },
        ],
        result: "你把{$a}和{$b}引到同一面镜子前。两句话不到，两个人就较上了劲。介绍是同一句，各记各的输。",
      },
      {
        label: "把两个人引到同一面镜子前",
        when: [{ any: [{ temper: "$a", is: "wary" }, { temper: "$b", is: "wary" }] }, { any: [{ not: { temper: "$a", is: "proud" } }, { not: { temper: "$b", is: "proud" } }] }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 5 }, { bond: ["$b", "$a"], kind: "friend", set: 5 },
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "awkward-intro", valence: -1, subject: "$b" } },
          { remember: { holder: "$b", act: "awkward-intro", valence: -1, subject: "$a" } },
        ],
        result: "你把{$a}和{$b}引到同一面镜子前。认识是认识了，话停在客气上。两个人都把这次介绍记成了尴尬的一句。",
      },
      {
        label: "不把两个人往一处引",
        effects: [
          { bond: ["$a", "$b"], delta: 2 }, { bond: ["$b", "$a"], delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1 } },
        ],
        result: "你没介绍。镜子让{$a}和{$b}自己用。两个人记下：你没有硬把人拉到一处。",
      },
    ],
  },
  {
    id: "social-hearsay-asked",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", subject: "player", valence: "bad", heard: true }] },
      b: { where: [{ remembers: "$a", subject: "player", valence: "bad", heard: true, from: "$self" }] },
    },
    when: [{ remembers: "$a", subject: "player", valence: "bad", heard: true, from: "$b" }],
    weight: 5, tension: 1, cooldown: 4,
    text: "{$a}进门就问：外头那句，是你说的吗？{$a}看着你，{$b}站在侧后方。",
    choices: [
      {
        label: "认，不扯{$b}",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "那次是你做的，你认了。{$b}知道自己没添油。{$a}记下的是：你没有把这件事推到{$b}身上。",
      },
      {
        label: "否认，说这话是{$b}添过的",
        when: [{ bond: ["$a", "$b"], gte: 20 }],
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: -6 },
          { bond: ["$a", "$b"], delta: -10 }, { bond: ["$b", "$a"], delta: -6 },
          { remember: { holder: "$a", act: "broke-word", valence: -1 } },
          { remember: { holder: "$b", act: "public-shame", valence: -2 } },
        ],
        result: "{$a}和{$b}本来就近。你一否认，{$a}不信你，先怪传话的{$b}。",
      },
      {
        label: "认下来，约{$a}过两天自己来看一遍",
        when: [{ temper: "$a", is: "wary" }],
        effects: [
          { opinion: "$a", delta: 6 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1 } },
          { appoint: { person: "$a", inDays: 2, slot: 1 } },
        ],
        result: "你认了那次，约{$a}过两天自己来看。{$a}要亲眼再对一遍，才肯把听来的那句放下。{$a}答应了。",
      },
    ],
  },
  {
    id: "social-argument-move",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { where: [{ bond: ["$a", "$self"], lte: -10 }] },
    },
    when: [{ bond: ["$a", "$b"], lte: -10 }, { bond: ["$b", "$a"], lte: -10 }],
    weight: 4, tension: 1, cooldown: 4,
    text: "{$a}和{$b}越说越硬。两句话都还在柜上，谁也不肯先停。",
    choices: [
      {
        label: "把{$a}请到休息区坐下",
        effects: [
          { move: { person: "$a", zone: "lounge" } },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -1 },
          { bond: ["$a", "$b"], delta: 6 }, { bond: ["$b", "$a"], delta: 3 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
          { remember: { holder: "$b", act: "sidelined", valence: -1 } },
        ],
        result: "你把{$a}请到休息区坐下。当着柜的吵停了。{$a}记下你给了个地方坐，{$b}记下自己还站在原地。",
      },
      {
        label: "把{$b}带到收银台那边把钱结了",
        effects: [
          { move: { person: "$b", zone: "cashier" } },
          { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 }, { bond: ["$b", "$a"], delta: 4 },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "你把{$b}带到收银台把钱结了。{$b}记下你把该结的结了，剩下那句没人再接。",
      },
      {
        label: "原地劝一句，旧账别在柜上翻",
        when: [{ any: [{ temper: "$a", is: "proud" }, { temper: "$b", is: "proud" }] }],
        effects: [
          { bond: ["$a", "$b"], delta: -6 }, { bond: ["$b", "$a"], delta: -4 },
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$a", act: "botched-mediation", valence: -1 } },
          { remember: { holder: "$b", act: "botched-mediation", valence: -1 } },
        ],
        result: "你就在柜上劝了一句：旧账别在这儿翻。{$a}和{$b}都不听，把火转到你身上。",
      },
    ],
  },
  {
    id: "social-checkout-step",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "shy" }, { opinion: "$self", gte: 5 }] },
      b: { where: [{ not: { temper: "$self", is: "shy" } }, { any: [{ temper: "$self", is: "hasty" }, { temper: "$self", is: "gossip" }] }] },
    },
    when: [{ temper: "$a", is: "shy" }],
    weight: 4, tension: -1, cooldown: 4,
    text: "{$a}把小票捏在手里，还没走到收银。{$b}在后面催了一句，{$a}停在那儿。",
    choices: [
      {
        label: "陪{$a}到收银台，把单写完",
        effects: [
          { move: { person: "$a", zone: "cashier" } },
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 2 } },
          { appoint: { person: "$a", inDays: 4, slot: 2 } },
        ],
        result: "这一单收得安静。{$a}记下你陪着写完。下次{$a}自己进来，不一定再跟{$b}走一路。",
      },
      {
        label: "留在原地再多聊两句",
        when: [{ temper: "$b", is: "gossip" }],
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "crowded", valence: -1 } },
        ],
        result: "你留在原地又聊了两句，有一句是{$b}替{$a}接的。{$a}点头点得很快，走得也快。",
      },
      {
        label: "让{$b}先走，你陪{$a}收",
        effects: [
          { move: { person: "$a", zone: "cashier" } }, { leave: "$b" },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { bond: ["$a", "$b"], delta: -2 },
          { remember: { holder: "$a", act: "looked-after", valence: 1 } },
        ],
        result: "你让{$b}先走。{$a}把小票写完，抬头说了句谢谢，声音很小。",
      },
    ],
  },
  {
    id: "social-third-hand-secret",
    kind: "social",
    cast: {
      a: { where: [{ knowsSecret: "$self" }] },
      b: { where: [{ bond: ["$a", "$self"], gte: 5 }] },
    },
    when: [{ knowsSecret: "$a" }, { bond: ["$a", "$b"], gte: 5 }],
    weight: 4, tension: 1, cooldown: 6,
    text: "{$b}凑近半步，问{$a}那件事。{$a}在镜子那头，听得见。",
    choices: [
      {
        label: "那件事到我为止",
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2 } },
          { remember: { holder: "$b", act: "kept-secret", valence: 1 } },
        ],
        result: "你没把{$a}的事告诉{$b}。{$a}在镜子那头看见你把话收住了。{$b}没拿到新的一句。",
      },
      {
        label: "告诉{$b}，说是你自己说的",
        when: [{ bond: ["$a", "$b"], gte: 20 }],
        effects: [
          { opinion: "$b", delta: 5 },
          { remember: { holder: "$b", act: "secret", valence: 0, subject: "$a", heardFrom: "player" } },
        ],
        result: "你告诉了{$b}，说这话是你自己的。{$b}拿走完整的一句，也知道是你说的。",
      },
      {
        label: "把话头挪到今天的活动上",
        effects: [
          { opinion: "$b", delta: 1 }, { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
        ],
        result: "你把话头转到今天的活动上。{$b}没问完。{$a}没抬头，也没走。",
      },
    ],
  },
  {
    id: "social-secret-surface",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { where: [{ temper: "$self", is: "gossip" }, { bond: ["$a", "$self"], gte: 5 }] },
    },
    when: [{ not: { knowsSecret: "$a" } }, { bond: ["$a", "$b"], gte: 5 }],
    weight: 4, tension: 1, cooldown: 6,
    text: "{$b}话说一半，扭头看你。剩下那半句，是{$a}的事。",
    choices: [
      {
        label: "让{$b}把后半句说完",
        effects: [
          { reveal: "$a" },
          { opinion: "$a", delta: -8 }, { opinion: "$b", delta: 1 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "public-shame", valence: -2 } },
          { remember: { holder: "$b", act: "leaked", valence: -1, subject: "$a" } },
        ],
        result: "你让{$b}把后半句说完。{$a}记下的是你点了头，不只是{$b}的嘴。",
      },
      {
        label: "你先接过来，替{$a}把话说轻",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { reveal: "$a" },
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "kept-word", valence: 2 } },
        ],
        result: "{$a}的事还是说出来了。你接过来，把话说轻了。{$a}记下：已经有人听见，你没有把话说重。",
      },
      {
        label: "岔开，只说柜上的事",
        effects: [
          { opinion: "$b", delta: -3 }, { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
        ],
        result: "你岔开，只说柜上的事。{$b}那半句没人接。{$a}看见你没顺着听下去。",
      },
    ],
  },
  {
    id: "social-rival-mend",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { where: [{ bond: ["$a", "$self"], lte: -10 }] },
    },
    when: [
      { any: [{ bond: ["$a", "$b"], kind: "rival" }, { bond: ["$b", "$a"], kind: "rival" }] },
      { bond: ["$a", "$b"], lte: -10 }, { bond: ["$b", "$a"], lte: -10 },
    ],
    weight: 5, tension: -1, cooldown: 6,
    text: "{$a}和{$b}的过节是旧账。今天两个人的事撞在同一班，谁也不肯先让半步。",
    choices: [
      {
        label: "把今天这一件拆成两半，一人一半",
        when: [{ any: [{ temper: "$a", is: "warm" }, { temper: "$a", is: "loyal" }, { temper: "$b", is: "warm" }, { temper: "$b", is: "loyal" }] }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 20 }, { bond: ["$b", "$a"], kind: "friend", set: 20 },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "mediated", valence: 2 } },
          { remember: { holder: "$b", act: "mediated", valence: 2 } },
        ],
        result: "你把今天这一件拆成两半，一人一半。{$a}和{$b}各拿各的，从今天起先当朋友。",
      },
      {
        label: "各劝一句，见面先当同事",
        effects: [
          { bond: ["$a", "$b"], kind: "colleague", set: 5 }, { bond: ["$b", "$a"], kind: "colleague", set: 5 },
          { remember: { holder: "$a", act: "mediated", valence: 1 } },
          { remember: { holder: "$b", act: "mediated", valence: 1 } },
        ],
        result: "你各劝了一句。旧账没有翻篇。{$a}和{$b}见面先点头，过节还留着。",
      },
      {
        label: "柜上不判旧账",
        effects: [
          { bond: ["$a", "$b"], delta: 2 }, { bond: ["$b", "$a"], delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "你不在柜上判这笔旧账。这一班没人提。{$a}和{$b}还是对头，只是今天没新添一句。",
      },
    ],
  },
  {
    id: "social-shared-sidelined",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", act: "sidelined", valence: "bad", subject: "player" }] },
      b: { where: [{ remembers: "$self", act: "sidelined", valence: "bad", subject: "player" }, { bond: ["$a", "$self"], lte: 15 }] },
    },
    when: [{ remembers: "$a", act: "sidelined", valence: "bad", subject: "player" }, { remembers: "$b", act: "sidelined", valence: "bad", subject: "player" }],
    weight: 4, tension: -1, cooldown: 5,
    text: "{$a}和{$b}都有一次被你在忙的时候晾过。今天两个人一起站着，看你开不开口。",
    choices: [
      {
        label: "一人补一句，把上次晾下的话说清",
        when: [{ bond: ["$a", "$b"], gte: -10 }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 15 }, { bond: ["$b", "$a"], kind: "friend", set: 15 },
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 5 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "你跟{$a}、{$b}各补了一句。同一件事认了两遍，两个人是一块儿走的。",
      },
      {
        label: "先紧着{$a}那次",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -5 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$b", act: "sidelined", valence: -2 } },
        ],
        result: "你先跟{$a}把那次说清。{$b}在旁边听完，自己那次还空着。",
      },
      {
        label: "旧账你不提，两人先都坐下",
        effects: [
          { bond: ["$a", "$b"], delta: 3 }, { bond: ["$b", "$a"], delta: 3 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0 } },
          { remember: { holder: "$b", act: "stood-aside", valence: 0 } },
        ],
        result: "你没提那两次。{$a}和{$b}先并排坐下了。",
      },
    ],
  },
  {
    id: "social-lounge-two-cold",
    kind: "social",
    cast: {
      a: { where: [{ present: "$self", zone: "lounge" }] },
      b: { where: [{ present: "$self", zone: "lounge" }, { bond: ["$a", "$self"], lte: 0 }] },
    },
    when: [{ present: "$a", zone: "lounge" }, { present: "$b", zone: "lounge" }, { bond: ["$b", "$a"], lte: 0 }],
    weight: 4, tension: 0, cooldown: 4,
    text: "休息区那张沙发，{$a}坐了半边。{$b}过来，坐在另一头，谁也不先开口。",
    choices: [
      {
        label: "一人一张色卡，让两个人各说各的",
        when: [{ not: { temper: "$a", is: "wary" } }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 10 }, { bond: ["$b", "$a"], kind: "friend", set: 10 },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "mediated", valence: 1 } },
          { remember: { holder: "$b", act: "mediated", valence: 1 } },
        ],
        result: "你没劝和。一人一张色卡，{$a}和{$b}各说各的，从这一天起算认识。",
      },
      {
        label: "带{$a}回柜上，别干坐着",
        effects: [
          { move: { person: "$a", zone: "counter" } },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$b", act: "sidelined", valence: -1 } },
        ],
        result: "你带{$a}回了柜，说柜上有事。{$b}一个人留在沙发上，把手机翻出来，记下自己被留在这儿。",
      },
      {
        label: "坐着听，不接话",
        effects: [
          { bond: ["$a", "$b"], delta: 2 }, { bond: ["$b", "$a"], delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
        ],
        result: "你坐着听，没接话。两个人说了几句零碎的，没说成一件事。散的时候不算熟，也没更难看。",
      },
    ],
  },
  {
    id: "social-queue-impatient",
    kind: "social",
    cast: {
      a: { where: [{ present: "$self", zone: "cashier" }, { temper: "$self", is: "hasty" }] },
      b: { where: [{ role: "$self", is: "customer" }, { temper: "$self", is: "shy" }] },
    },
    when: [{ present: "$a", zone: "cashier" }, { role: "$b", is: "customer" }, { temper: "$b", is: "shy" }],
    weight: 3, tension: 0, cooldown: 4,
    text: "{$a}在收银台敲了第三次。{$b}还站在镜子前，手里的两支没定。",
    choices: [
      {
        label: "把{$a}带过来，一张镜子两张单",
        when: [{ bond: ["$a", "$self"], gte: 0 }],
        effects: [
          { move: { person: "$a", zone: "counter" } },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1 } },
        ],
        result: "你把{$a}带到镜子前，两张单分开写。{$a}不用在收银台干等。{$b}被催着，先定了第一支。",
      },
      {
        label: "把{$b}带去收银，先让队走",
        effects: [
          { move: { person: "$b", zone: "cashier" } },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$b", act: "looked-after", valence: 1 } },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
        ],
        result: "你把{$b}带到收银台，队往前走了。{$b}把第二支也定了，没再回镜子前。",
      },
      {
        label: "先顾{$b}，请{$a}再等一分钟",
        effects: [
          { opinion: "$b", delta: 5 }, { opinion: "$a", delta: -6 },
          { remember: { holder: "$a", act: "sidelined", valence: -2 } },
          { leave: "$a" },
        ],
        result: "{$a}不等了，人走了。{$b}把那两支定完，抬头问你刚才那位是不是生气了。",
      },
    ],
  },
  {
    id: "social-mentor-open",
    kind: "social",
    cast: {
      a: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "loyal" }] },
      b: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "shy" }, { bond: ["$a", "$self"], lte: 0 }] },
    },
    when: [{ role: "$a", is: "staff" }, { role: "$b", is: "staff" }, { bond: ["$b", "$a"], lte: 0 }],
    weight: 4, tension: -1, cooldown: 6,
    text: "{$b}在员工通道背话术，背到第三句卡住。{$a}路过，脚步没停。",
    choices: [
      {
        label: "请{$a}带{$b}走一圈",
        when: [{ opinion: "$a", gte: 0 }],
        effects: [
          { bond: ["$a", "$b"], kind: "mentor", set: 25 }, { bond: ["$b", "$a"], kind: "mentor", set: 25 },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 5 },
          { remember: { holder: "$b", act: "introduced", valence: 1, subject: "$a" } },
        ],
        result: "你请{$a}带{$b}走了一圈。卡住的那句，第二遍是{$a}听{$b}说完的。从今天起，{$b}有人肯带。",
      },
      {
        label: "你自己陪{$b}背完",
        effects: [
          { opinion: "$b", delta: 4 }, { stat: "energy", delta: -4 },
          { remember: { holder: "$b", act: "helped-out", valence: 1 } },
        ],
        result: "第三句你陪{$b}过了两遍。{$b}记下的是这段只有你们两个的班。",
      },
      {
        label: "让{$b}自己找{$a}问",
        effects: [
          { bond: ["$a", "$b"], delta: 4 }, { bond: ["$b", "$a"], delta: 4 },
          { opinion: "$b", delta: -2 },
          { remember: { holder: "$b", act: "stood-aside", valence: 1 } },
        ],
        result: "你让{$b}自己去问{$a}。{$b}自己走了一趟，问到了。这一步是{$b}自己迈的。",
      },
    ],
  },
  {
    id: "social-secret-corner",
    kind: "social",
    cast: {
      a: { where: [{ knowsSecret: "$self" }, { opinion: "$self", gte: 5 }] },
      b: { where: [{ temper: "$self", is: "gossip" }] },
    },
    when: [{ knowsSecret: "$a" }, { temper: "$b", is: "gossip" }],
    weight: 4, tension: 1, cooldown: 6,
    text: "{$a}那件事你先知道。今天{$a}站在镜子那头，手指一直在掐掌心的边。{$b}已经开口问了一半。",
    choices: [
      {
        label: "把{$a}请到员工通道那边说",
        effects: [
          { move: { person: "$a", zone: "backroom" } },
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2 } },
        ],
        result: "你把{$a}请到员工通道。这件事没有当着{$b}说。{$a}只对你认了。",
      },
      {
        label: "当着柜子把那半句收住",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1 } },
        ],
        result: "你当着柜子把{$b}那半句收住了。{$b}没往下说。{$a}没听见全部，听见的是你收住的这一下。",
      },
      {
        label: "先问{$a}：这句你自己说，还是我替你说",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { opinion: "$a", delta: 8 }, { opinion: "$b", delta: -1 },
          { remember: { holder: "$a", act: "kept-word", valence: 2 } },
          { appoint: { person: "$a", inDays: 2, slot: 1 } },
        ],
        result: "你问{$a}：自己说，还是你替说。{$a}自己开了口，答应过两天再来。",
      },
    ],
  },
  {
    id: "social-scuffle-throwdown",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { where: [{ bond: ["$a", "$self"], lte: -10 }] },
    },
    when: [{ bond: ["$a", "$b"], lte: -10 }, { bond: ["$b", "$a"], lte: -10 }],
    weight: 4, tension: 1, cooldown: 5,
    text: "{$b}那句急了：「{$a}那事，你以为我不知道？」中庭安静了一拍。",
    choices: [
      {
        label: "不接这句，把{$a}挪开半步",
        effects: [
          { move: { person: "$a", zone: "lounge" } },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -6 }, { bond: ["$b", "$a"], delta: -3 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
        ],
        result: "你没接这句，把{$a}从当场挪开，人去了休息区。{$b}那半句没有人接。{$a}记下你把人拉开了。",
      },
      {
        label: "顺着{$b}，把{$a}的事说开",
        when: [{ temper: "$b", is: "proud" }],
        effects: [
          { reveal: "$a" },
          { opinion: "$a", delta: -10 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -12 },
          { remember: { holder: "$a", act: "public-shame", valence: -2 } },
          { remember: { holder: "$b", act: "talked-down", valence: -1, subject: "$a" } },
        ],
        result: "你顺着{$b}接了下去，{$a}的事在中庭说开了。往后这层见面，谁也没法当没听见。",
      },
      {
        label: "请{$b}到你面前来说",
        effects: [
          { move: { person: "$b", zone: "counter" } },
          { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$b", act: "no-snatch", valence: 1 } },
        ],
        result: "{$b}走到你面前，压着声音说完了。{$a}在那头没听到，没有能接上的话。",
      },
    ],
  },
  {
    id: "social-festival-lineup",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "thrifty" }] },
      b: { where: [{ opinion: "$self", gte: 5 }, { bond: ["$a", "$self"], lte: 0 }, { bond: ["$self", "$a"], lte: 0 }] },
    },
    when: [{ festival: "618" }, { role: "$b", is: "customer" }],
    weight: 5, tension: 0, cooldown: 6,
    text: "618 的队排到柱子里。{$a}凑过来问拼不拼得成，后头的{$b}没搭腔。",
    choices: [
      {
        label: "把两个人凑成一台货",
        when: [{ not: { any: [{ temper: "$a", is: "wary" }, { temper: "$b", is: "wary" }, { temper: "$a", is: "proud" }, { temper: "$b", is: "proud" }] } }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 15 }, { bond: ["$b", "$a"], kind: "friend", set: 15 },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "introduced", valence: 1, subject: "$b" } },
          { remember: { holder: "$b", act: "introduced", valence: 1, subject: "$a" } },
        ],
        result: "你把{$a}和{$b}凑成一台货。数各记各的。这一班两个人是拼过单的。",
      },
      {
        label: "只报今日能拼的数，不递名字",
        effects: [
          { bond: ["$a", "$b"], delta: 3 }, { bond: ["$b", "$a"], delta: 3 },
          { opinion: "$a", delta: 1 },
          { remember: { holder: "$a", act: "price-plain", valence: 1 } },
        ],
        result: "你只报了今天能拼的数，没说名字。拼不拼，归{$a}和{$b}自己商量。",
      },
      {
        label: "让两个人各排各的",
        effects: [
          { bond: ["$a", "$b"], delta: -3 },
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "broke-word", valence: -1 } },
        ],
        result: "你让两个人各排各的。队各自往前挪。{$a}记住你今天不肯帮着开口。",
      },
    ],
  },
  {
    id: "social-client-friend",
    kind: "social",
    cast: {
      a: { where: [{ role: "$self", is: "customer" }] },
      b: { where: [{ role: "$self", is: "staff" }, { bond: ["$self", "$a"], kind: "client", gte: 20 }] },
    },
    when: [{ bond: ["$b", "$a"], kind: "client", gte: 20 }],
    weight: 4, tension: -1, cooldown: 6,
    text: "{$a}这班不是来开单的，手里拿的是{$b}上次随口答应的那支。{$b}在理货。",
    choices: [
      {
        label: "让{$b}下来，三人坐休息区说",
        when: [{ bond: ["$b", "$a"], gte: 30 }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 40 }, { bond: ["$b", "$a"], kind: "friend", set: 40 },
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 4 },
          { move: { person: "$b", zone: "lounge" } },
          { remember: { holder: "$a", act: "turned-friend", valence: 2 } },
        ],
        result: "你让{$b}下来，三个人坐在休息区把那支说完了。这一班没开张。{$a}下次进门找的是{$b}这个人，不是这一单。",
      },
      {
        label: "你自己按单接",
        effects: [
          { bond: ["$a", "$b"], delta: -5 },
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "sidelined", valence: -1 } },
        ],
        result: "单记在柜上。{$a}走的时候说，下回还是找{$b}，不是找这个柜。",
      },
      {
        label: "叫{$b}下来当面把那支说清",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 6 },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "你叫{$b}下来，把那支当面说清了。{$a}还是熟客，记下你把人叫下来了。",
      },
    ],
  },
  {
    id: "social-hearsay-confront",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", subject: "player", valence: "bad", heard: true }] },
      b: { where: [{ remembers: "$a", subject: "player", valence: "bad", heard: true, from: "$self" }] },
    },
    when: [{ remembers: "$a", subject: "player", valence: "bad", heard: true, from: "$b" }],
    weight: 4, tension: 1, cooldown: 5,
    text: "{$a}问话的时候，眼睛在{$b}和你之间来回。那句是从{$b}嘴里出去的，{$a}等你确认。",
    choices: [
      {
        label: "让{$b}自己认这句",
        effects: [
          { opinion: "$b", delta: -3 }, { opinion: "$a", delta: 3 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$b", act: "talked-down", valence: -1 } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1 } },
        ],
        result: "话是谁出口，今天对上了号。{$b}认的时候不情愿，但认了。",
      },
      {
        label: "替{$b}接住这句",
        when: [{ opinion: "$b", gte: 0 }],
        effects: [
          { opinion: "$b", delta: 6 }, { opinion: "$a", delta: -2 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
          { remember: { holder: "$a", act: "broke-word", valence: -1 } },
        ],
        result: "你替{$b}把这句接住了，认的是你自己那次，没让{$a}点{$b}的名。{$b}记下你挡住了。{$a}记下你们俩在对口径。",
      },
      {
        label: "不接，让两个人自己说",
        effects: [
          { bond: ["$a", "$b"], delta: -6 }, { bond: ["$b", "$a"], delta: -4 },
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$b", act: "sidelined", valence: -1 } },
        ],
        result: "你退开半步。那句落回{$a}和{$b}中间。谁传的，变成两个人自己的事。",
      },
    ],
  },
  {
    id: "social-witness-call",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", subject: "player", valence: "bad", heard: false }] },
      b: { where: [{ remembers: "$self", subject: "player", valence: "bad", heard: true }, { bond: ["$self", "$a"], gte: 5 }] },
    },
    when: [{ remembers: "$b", subject: "player", valence: "bad", heard: true }, { bond: ["$b", "$a"], gte: 5 }],
    weight: 4, tension: 0, cooldown: 5,
    text: "{$b}听来的版本已经拐了两个弯。{$b}扭头问{$a}：你当时在，是不是这样。{$a}看着你。",
    choices: [
      {
        label: "请{$a}说一句亲眼看见的",
        effects: [
          { remember: { holder: "$b", act: "honest-advice", valence: 1, heardFrom: "$a" } },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 3 },
        ],
        result: "{$a}说了亲眼看见的那句。{$b}把这笔记在{$a}名下，不再当耳闻。",
      },
      {
        label: "你自己认，不拉人作证",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "那次是你的，你自己认了。{$a}记下你没有拿{$a}当凭据。",
      },
      {
        label: "否认，说{$b}听岔了",
        when: [{ opinion: "$b", lte: 0 }],
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: -4 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$b", act: "broke-word", valence: -1 } },
          { remember: { holder: "$a", act: "broke-word", valence: -1 } },
        ],
        result: "{$a}亲眼看见过，又当面听见你否认。这一笔，{$b}见谁都会讲。",
      },
    ],
  },
  {
    id: "social-first-hearsay",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", subject: "player", valence: "good", heard: true }, { not: { remembers: "$self", subject: "player", heard: false } }] },
      b: { where: [{ remembers: "$a", subject: "player", valence: "good", heard: true, from: "$self" }] },
    },
    when: [{ remembers: "$a", subject: "player", valence: "good", heard: true, from: "$b" }, { not: { remembers: "$a", subject: "player", heard: false } }],
    weight: 4, tension: -1, cooldown: 6,
    text: "{$a}进门就说，是听{$b}说你实在。{$b}跟在后面，知道自己传的是哪句。",
    choices: [
      {
        label: "认下这句，再补{$a}没听到的那半",
        when: [{ not: { temper: "$a", is: "wary" } }],
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1 } },
        ],
        result: "{$a}第一次坐下，你把没听到的那半也补上了。{$a}带走的是自己听见的一段，不再只是听来的。",
      },
      {
        label: "先谢{$b}这句",
        effects: [
          { remember: { holder: "$a", act: "passed-word", valence: 1, subject: "$b" } },
          { bond: ["$a", "$b"], delta: 4 },
          { opinion: "$b", delta: 4 },
        ],
        result: "你先谢了{$b}。好话记回传话的人头上。{$a}听见你说谢谢的时候，{$b}在笑。",
      },
      {
        label: "别拿{$b}当凭据，让{$a}自己看",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -2 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1 } },
        ],
        result: "你不拿{$b}的话当凭据，让{$a}自己看。{$a}坐下来对的是你。{$b}记下自己的好话没被你接着用。",
      },
    ],
  },

  // —— 楼层小事 ——

  {
    id: "floor-corridor-overtime",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "wary" }, { temper: "$self", is: "loyal" }] },
      b: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "hasty" }] },
    },
    when: [{ role: "$a", is: "staff" }, { role: "$b", is: "staff" }],
    weight: 4, tension: 0, cooldown: 5,
    text: "{$b}今晚不在，赠品那行空着。{$a}拿着文件夹，问你补不补，谁补的写谁。",
    choices: [
      {
        label: "你补，写明是你",
        effects: [
          { remember: { holder: "$a", act: "covered-gap", valence: 1, subject: "$b", heardFrom: "player" } },
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: 3 },
        ],
        result: "文件夹收了这笔。{$a}记下那句是你说的，不是替{$b}圆场的。",
      },
      {
        label: "不补，这行留给{$b}",
        effects: [
          { remember: { holder: "$a", act: "refused-gap", valence: 1, subject: "$b", heardFrom: "player" } },
          { opinion: "$b", delta: 3 },
          { stat: "compliance", delta: -2 },
        ],
        result: "空行还是空的。{$b}回来得自己补，先看见这一行没人写。",
      },
      {
        label: "把今天看见的原样写下",
        when: [{ stat: "compliance", gte: 40 }],
        effects: [
          { remember: { holder: "$a", act: "same-as-record", valence: 2 } },
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: 2 },
        ],
        result: "你把今天看见的原样写下。{$a}对过票，是同一件事。这行过了{$a}的眼。",
      },
    ],
  },
  {
    id: "floor-door-quiet",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "mall" }, { temper: "$self", is: "loyal" }, { temper: "$self", is: "wary" }] },
      b: { where: [{ role: "$self", is: "customer" }, { temper: "$self", is: "hasty" }] },
    },
    when: [{ role: "$a", is: "mall" }],
    weight: 4, tension: 1, cooldown: 4,
    text: "{$b}把没说完的话摔在门里，人已经往外走。{$a}手搭在门上，等你一句话。",
    choices: [
      {
        label: "你自己出去把人请回来",
        effects: [
          { move: { person: "$b", zone: "entrance" } },
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 4 },
          { remember: { holder: "$a", act: "helped-out", valence: 1 } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1 } },
          { appoint: { person: "$b", inDays: 1, slot: 0 } },
        ],
        result: "你自己出去，在门口把{$b}请住了。没说完的那句你接住了。{$b}答应明天上午自己进来，把它说完。",
      },
      {
        label: "托{$a}看着，别让人往里挤",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: -5 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$b", act: "crowded", valence: -2 } },
          { remember: { holder: "$a", act: "broke-word", valence: -1 } },
          { leave: "$b" },
        ],
        result: "你托{$a}看着，不让人往里挤。{$b}正往外走，在门口被挡了一下，当是被撵的，人走了。{$a}记下：这层的门不该拿来管卖货的事。",
      },
      {
        label: "请{$b}先到休息区坐两分钟",
        effects: [
          { move: { person: "$b", zone: "lounge" } },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
        ],
        result: "你请{$b}到休息区坐了两分钟。门里没人再摔话。{$b}回来，把声音压着说完了。",
      },
    ],
  },
  {
    id: "floor-record-nod",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "wary" }] },
      b: { where: [{ role: "$self", is: "staff" }, { bond: ["$a", "$self"], kind: "colleague" }] },
    },
    when: [{ role: "$a", is: "staff" }, { role: "$b", is: "staff" }, { bond: ["$a", "$b"], kind: "colleague" }],
    weight: 4, tension: 1, cooldown: 6,
    text: "{$a}翻到上一班那页，抬头看了{$b}一眼。那一行写的是{$b}，{$a}没出声。",
    choices: [
      {
        label: "把话带给{$b}，说是你告诉的",
        effects: [
          { remember: { holder: "$b", act: "named-colleague", valence: -1, subject: "$a", heardFrom: "player" } },
          { opinion: "$b", delta: -4 }, { opinion: "$a", delta: 2 },
          { bond: ["$a", "$b"], delta: -8 }, { bond: ["$b", "$a"], delta: -6 },
        ],
        result: "{$b}知道自己被写进哪一行，也知道是你说的。这一页今晚摊在两个人中间。",
      },
      {
        label: "让{$a}自己把那行改了",
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "$b" } },
        ],
        result: "你让{$a}自己把那行改了。{$a}没答应改。那一行今晚还开着，你没有替{$b}把名字定死。",
      },
      {
        label: "把这页合上，两人先分开",
        effects: [
          { move: { person: "$b", zone: "backroom" } },
          { bond: ["$a", "$b"], kind: "colleague", set: 5 }, { bond: ["$b", "$a"], kind: "colleague", set: 5 },
          { remember: { holder: "$b", act: "stood-aside", valence: 1 } },
        ],
        result: "你把这页合上，把{$b}挪开了。那一行还在纸上。两个人今晚先当同事，不把这页摊开。",
      },
    ],
  },
  {
    id: "floor-entrance-swap",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "mall" }, { temper: "$self", is: "hasty" }, { temper: "$self", is: "face" }] },
      b: { where: [{ role: "$self", is: "staff" }] },
    },
    when: [{ role: "$a", is: "mall" }],
    weight: 4, tension: 0, cooldown: 5,
    text: "入口少一个人。{$a}要{$b}过去顶，{$b}手上还有半单没写完。",
    choices: [
      {
        label: "你先顶上，让{$b}写完",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 5 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$b", act: "helped-out", valence: 2 } },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
          { stat: "energy", delta: -6 },
        ],
        result: "你先去入口顶上，{$b}把半单写完了。入口有人，单也没断。{$b}回来时，先谢了你替顶的这一阵。",
      },
      {
        label: "把{$b}挪到入口，柜上你看着",
        effects: [
          { move: { person: "$b", zone: "entrance" } },
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$b", act: "sidelined", valence: -1 } },
          { stat: "standing", delta: 1 },
        ],
        result: "你把{$b}挪到入口，柜上你看着。入口站住了人，{$a}拿着单子去交差。那半单是你替{$b}收完的。",
      },
      {
        label: "柜上走不开，让楼层自己想办法",
        effects: [
          { opinion: "$a", delta: -6 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "broke-word", valence: -1 } },
        ],
        result: "你说柜上走不开。{$a}自己去调别层的人。下次入口缺人，不会先来问你这一柜。",
      },
    ],
  },
  {
    id: "floor-notebook-echo",
    kind: "floor",
    cast: {
      a: { id: "qiaowan", where: [] },
      b: { where: [{ role: "$self", is: "customer" }, { temper: "$self", is: "wary" }] },
    },
    when: [{ role: "$b", is: "customer" }, { temper: "$b", is: "wary" }],
    weight: 4, tension: 1, cooldown: 6,
    text: "{$b}要找教这句的人。{$a}站在你侧边，纸条从袖口露出半截。",
    choices: [
      {
        label: "把{$a}袖口的纸条当场说开",
        effects: [
          { reveal: "$a" },
          { opinion: "$a", delta: -6 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "public-shame", valence: -2 } },
          { remember: { holder: "$b", act: "same-as-record", valence: 1 } },
        ],
        result: "你把纸条翻开，当着{$b}念了。{$b}对上了那句是谁教的。{$a}记下你是当着人念的。",
      },
      {
        label: "私下拦一句，让{$a}自己认",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
        ],
        result: "你私下拦了{$a}一句，让{$a}自己去认。{$b}当场没拿到是谁教的。{$a}记下你没有当着人说。",
      },
      {
        label: "这句你不接",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "copied-line", valence: -1 } },
        ],
        result: "你不接这句。{$b}要的人没找到，把这句记在你和{$a}头上。{$a}记下那句又被原样放过去了。",
      },
    ],
  },
  {
    id: "floor-atrium-table",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "mall" }, { temper: "$self", is: "hasty" }] },
      b: { where: [{ role: "$self", is: "staff" }, { bond: ["$a", "$self"], lte: 0 }] },
    },
    when: [{ role: "$a", is: "mall" }, { role: "$b", is: "staff" }, { bond: ["$b", "$a"], lte: 0 }],
    weight: 4, tension: -1, cooldown: 5,
    text: "中庭拼桌，{$a}要人，{$b}手上还有一堆没拆的赠品。两个人各让了半步，都没让完。",
    choices: [
      {
        label: "让两个人各让半步，把桌子拼上",
        effects: [
          { bond: ["$a", "$b"], kind: "colleague", set: 10 }, { bond: ["$b", "$a"], kind: "colleague", set: 10 },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "mediated", valence: 1 } },
          { remember: { holder: "$b", act: "mediated", valence: 1 } },
        ],
        result: "你让两个人各让半步，桌子拼成了。谁也不觉得吃亏。以后这层碰见，先当同事。",
      },
      {
        label: "把{$a}请到入口那边等",
        effects: [
          { move: { person: "$a", zone: "entrance" } },
          { opinion: "$a", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "no-snatch", valence: 1 } },
        ],
        result: "你把{$a}请到入口等。那堆赠品没被催着拆。{$a}等到{$b}空出来，两个人把这件事说完了，你没有当场把人拉走。",
      },
      {
        label: "柜上今天不借人",
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "broke-word", valence: -1 } },
        ],
        result: "你说柜上今天不借人。{$b}没挪窝。{$a}自己去别处调人，这笔记在你这一柜。",
      },
    ],
  },
];

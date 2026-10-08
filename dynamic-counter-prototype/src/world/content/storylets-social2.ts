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
        when: [{ not: { any: [{ temper: "$a", is: "proud" }, { temper: "$b", is: "proud" }, { temper: "$a", is: "wary" }, { temper: "$b", is: "wary" }] } }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 20 }, { bond: ["$b", "$a"], kind: "friend", set: 20 },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "introduced", valence: 1, subject: "$b" } },
          { remember: { holder: "$b", act: "introduced", valence: 1, subject: "$a" } },
        ],
        result: "两句都在场说清。她们聊开了，记的是你搭的这一句。",
      },
      {
        label: "两个都要强的，你也递这句",
        when: [{ temper: "$a", is: "proud" }, { temper: "$b", is: "proud" }],
        effects: [
          { bond: ["$a", "$b"], kind: "rival", set: -10 }, { bond: ["$b", "$a"], kind: "rival", set: -10 },
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "one-upping", valence: -1, subject: "$b" } },
          { remember: { holder: "$b", act: "one-upping", valence: -1, subject: "$a" } },
        ],
        result: "两句话不到就较上了劲。介绍是同一句，她们各记各的输。",
      },
      {
        label: "带着一位多疑的，你先只报柜上的事",
        when: [{ any: [{ temper: "$a", is: "wary" }, { temper: "$b", is: "wary" }] }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 5 }, { bond: ["$b", "$a"], kind: "friend", set: 5 },
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "awkward-intro", valence: -1, subject: "$b" } },
          { remember: { holder: "$b", act: "awkward-intro", valence: -1, subject: "$a" } },
        ],
        result: "关系是建起来了，冷暖钉在客气那一档。多疑的那位留了半句没信。",
      },
      {
        label: "不牵这句",
        effects: [
          { bond: ["$a", "$b"], delta: 2 }, { bond: ["$b", "$a"], delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1 } },
        ],
        result: "你把镜子让给两个人自己用。没递线，也就没有回头可怪的那句。",
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
    text: "{$a}进门就问：外头那句你说的是真的？她看着你，{$b}在她侧后方。",
    choices: [
      {
        label: "认，不扯{$b}",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "那次确实做过。{$b}知道自己没添油，{$a}记下的是你没把她推出去。",
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
        result: "{$a}跟{$b}本来就近。你那句否认，先砸在传话的人身上。",
      },
      {
        label: "认下来，再约她自己来看一遍",
        when: [{ temper: "$a", is: "wary" }],
        effects: [
          { opinion: "$a", delta: 6 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1 } },
          { appoint: { person: "$a", inDays: 2, slot: 1 } },
        ],
        result: "多疑的人要自己核对。你认下那次，她答应隔天来亲眼再看一遍。",
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
    text: "{$a}和{$b}的话越说越硬。两句都还听得见，谁也没打算先收。",
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
        result: "沙发比柜台安静。这句没说完，但今天不会再往硬里走。",
      },
      {
        label: "把{$b}带到收银台那边把钱结了",
        effects: [
          { move: { person: "$b", zone: "cashier" } },
          { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 }, { bond: ["$b", "$a"], delta: 4 },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "手里有单，火就小一半。{$b}结账去了，剩下那句没人接。",
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
        result: "你刚开口，两边的火就都找到了新地方。",
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
    text: "{$a}把小票捏在手里，还没走到收银。{$b}在后面催了一句，她停在那儿。",
    choices: [
      {
        label: "陪她到收银台，把单写完",
        effects: [
          { move: { person: "$a", zone: "cashier" } },
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 2 } },
          { appoint: { person: "$a", inDays: 4, slot: 2 } },
        ],
        result: "这一单收得安静。她下次自己进来，不一定再跟{$b}走一路。",
      },
      {
        label: "留在原地再多聊两句",
        when: [{ temper: "$b", is: "gossip" }],
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "crowded", valence: -1 } },
        ],
        result: "两句里有一句是{$b}替她接的。她点头点得很快，走得也快。",
      },
      {
        label: "让{$b}先走，你陪她收",
        effects: [
          { move: { person: "$a", zone: "cashier" } }, { leave: "$b" },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { bond: ["$a", "$b"], delta: -2 },
          { remember: { holder: "$a", act: "looked-after", valence: 1 } },
        ],
        result: "催的人被你请开了。{$a}把小票写完，抬头说了句谢谢，声音很小。",
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
    text: "{$b}凑近半步，问的是{$a}那件事。{$a}在镜子那头，听得见这个距离。",
    choices: [
      {
        label: "那件事到我为止",
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2 } },
          { remember: { holder: "$b", act: "kept-secret", valence: 1 } },
        ],
        result: "没给出新的一句。{$a}不知道细节，但她看见你把话收住了。",
      },
      {
        label: "顺口告诉{$b}，来源写你自己",
        when: [{ bond: ["$a", "$b"], gte: 20 }],
        effects: [
          { opinion: "$b", delta: 5 },
          { remember: { holder: "$b", act: "secret", valence: 0, subject: "$a", heardFrom: "player" } },
        ],
        result: "{$b}拿走的是完整的一句，而且知道是从你这儿出的口。",
      },
      {
        label: "把话头挪到今天的活动上",
        effects: [
          { opinion: "$b", delta: 1 }, { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
        ],
        result: "活动单接住了那句没问完的。{$a}那边没抬头，也没走。",
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
        label: "让她把后半句说完",
        effects: [
          { reveal: "$a" },
          { opinion: "$a", delta: -8 }, { opinion: "$b", delta: 1 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "public-shame", valence: -2 } },
          { remember: { holder: "$b", act: "leaked", valence: -1, subject: "$a" } },
        ],
        result: "后半句落地了。{$a}记的是你点的头，不只是{$b}的嘴。",
      },
      {
        label: "你先接过来，替她把话说轻",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { reveal: "$a" },
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "kept-word", valence: 2 } },
        ],
        result: "事是她的，说法是你替她挡的。多少人已听见，她知道；你怎么说的，她也知道。",
      },
      {
        label: "岔开，只说柜上的事",
        effects: [
          { opinion: "$b", delta: -3 }, { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
        ],
        result: "那句悬在半空没人接。{$b}少了一个听众，{$a}今天多一句话。",
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
    text: "{$a}和{$b}这过节是老账。今天两件事撞在同一班，谁也不肯先挪半步。",
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
        result: "对头今天没成。他们从同一张单上各自拿走一半，先按朋友那一档处。",
      },
      {
        label: "各劝一句，先回到同事那一档",
        effects: [
          { bond: ["$a", "$b"], kind: "colleague", set: 5 }, { bond: ["$b", "$a"], kind: "colleague", set: 5 },
          { remember: { holder: "$a", act: "mediated", valence: 1 } },
          { remember: { holder: "$b", act: "mediated", valence: 1 } },
        ],
        result: "过节没翻篇，先钉回同事。见面点头，账留着。",
      },
      {
        label: "柜上不判旧账",
        effects: [
          { bond: ["$a", "$b"], delta: 2 }, { bond: ["$b", "$a"], delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "旧账这一班没人提。对面还是对面，只是今天没新的一句。",
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
    text: "{$a}和{$b}都被你在忙的时候晾过一句。今天两个人一起站着，先看你开不开口。",
    choices: [
      {
        label: "一人一句，当把那次说清",
        when: [{ bond: ["$a", "$b"], gte: -10 }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 15 }, { bond: ["$b", "$a"], kind: "friend", set: 15 },
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 5 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "同一件事认两遍。两个人走的时候是一块儿走的。",
      },
      {
        label: "先紧着{$a}那次",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -5 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$b", act: "sidelined", valence: -2 } },
        ],
        result: "{$b}在旁边听完了一份迟到的道歉。她那句还空着。",
      },
      {
        label: "旧账你不提，两人先都坐下",
        effects: [
          { bond: ["$a", "$b"], delta: 3 }, { bond: ["$b", "$a"], delta: 3 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0 } },
          { remember: { holder: "$b", act: "stood-aside", valence: 0 } },
        ],
        result: "两笔账你没翻，先让两个人并排坐下了。",
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
        label: "一人一张色卡，让她们各说各的",
        when: [{ not: { temper: "$a", is: "wary" } }],
        effects: [
          { bond: ["$a", "$b"], kind: "friend", set: 10 }, { bond: ["$b", "$a"], kind: "friend", set: 10 },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "mediated", valence: 1 } },
          { remember: { holder: "$b", act: "mediated", valence: 1 } },
        ],
        result: "没劝和。两张色卡把一截安静填上了，认识从这一档开始算。",
      },
      {
        label: "带{$a}回柜上，别让她干坐着",
        effects: [
          { move: { person: "$a", zone: "counter" } },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$b", act: "sidelined", valence: -1 } },
        ],
        result: "柜上有事，这句有了正当的理由。{$b}一个人留在沙发上，把手机翻了出来。",
      },
      {
        label: "坐着听，不接话",
        effects: [
          { bond: ["$a", "$b"], delta: 2 }, { bond: ["$b", "$a"], delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
        ],
        result: "零碎两句没有拼成一句完整的。散场时不算熟，也没更难看。",
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
        result: "两张单分开写。{$a}不用在收银台干等，{$b}被催着定了第一支。",
      },
      {
        label: "把{$b}带去收银，先让队走",
        effects: [
          { move: { person: "$b", zone: "cashier" } },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$b", act: "looked-after", valence: 1 } },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
        ],
        result: "队动了。{$b}在收银台把第二支也定了，没再回来站到镜子前。",
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
        label: "请{$a}带她走一圈",
        when: [{ opinion: "$a", gte: 0 }],
        effects: [
          { bond: ["$a", "$b"], kind: "mentor", set: 25 }, { bond: ["$b", "$a"], kind: "mentor", set: 25 },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 5 },
          { remember: { holder: "$b", act: "introduced", valence: 1, subject: "$a" } },
        ],
        result: "这层从这一天起有人肯给她带路。那句卡住的话，第二遍是{$a}听她说完的。",
      },
      {
        label: "你自己陪她背完",
        effects: [
          { opinion: "$b", delta: 4 }, { stat: "energy", delta: -4 },
          { remember: { holder: "$b", act: "helped-out", valence: 1 } },
        ],
        result: "第三句你陪她过了两遍。{$b}记下的是这段没人看见的班。",
      },
      {
        label: "让{$b}自己找{$a}问",
        effects: [
          { bond: ["$a", "$b"], delta: 4 }, { bond: ["$b", "$a"], delta: 4 },
          { opinion: "$b", delta: -2 },
          { remember: { holder: "$b", act: "stood-aside", valence: 1 } },
        ],
        result: "怕开口的人自己走了一趟。问没问成不好说，这一步是她自己迈的。",
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
    text: "{$a}那件事你先知道。今天她站在镜子那头，手指一直在掐掌心的边。{$b}已经开口问了一半。",
    choices: [
      {
        label: "把{$a}请到员工通道那边说",
        effects: [
          { move: { person: "$a", zone: "backroom" } },
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2 } },
        ],
        result: "这句话没在中庭落地。她自己认了那件事，认的时候旁边只有你。",
      },
      {
        label: "当着柜子把那半句收住",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1 } },
        ],
        result: "{$b}缩回去了。{$a}没听见全部，但听见了收住的那半句。",
      },
      {
        label: "先问{$a}：这句你自己说，还是我替你说",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { opinion: "$a", delta: 8 }, { opinion: "$b", delta: -1 },
          { remember: { holder: "$a", act: "kept-word", valence: 2 } },
          { appoint: { person: "$a", inDays: 2, slot: 1 } },
        ],
        result: "说与不说交给她。她自己开了口，下一班这层说的就是另一个版本。",
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
    text: "{$b}那句急了：「她那事你以为我不知道？」中庭安静了一拍。",
    choices: [
      {
        label: "不接这句，把{$a}挪开半步",
        effects: [
          { move: { person: "$a", zone: "lounge" } },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -6 }, { bond: ["$b", "$a"], delta: -3 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1 } },
        ],
        result: "那一拍没人接。中庭各忙各的，{$b}那半句没有观众。",
      },
      {
        label: "顺过去，今天把这层纸捅破",
        when: [{ temper: "$b", is: "proud" }],
        effects: [
          { reveal: "$a" },
          { opinion: "$a", delta: -10 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -12 },
          { remember: { holder: "$a", act: "public-shame", valence: -2 } },
          { remember: { holder: "$b", act: "talked-down", valence: -1, subject: "$a" } },
        ],
        result: "纸破了，谁都说不了它不厚。往后这层见面，这段没人当没发生。",
      },
      {
        label: "请{$b}到自己面前来说",
        effects: [
          { move: { person: "$b", zone: "counter" } },
          { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$b", act: "no-snatch", valence: 1 } },
        ],
        result: "她走过来压着说完了。{$a}在那头，没拿到能接的版本。",
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
        result: "一台货两个人分，数各记各的。这一班她们是拼过单的关系。",
      },
      {
        label: "只报今日能拼的数，不递名字",
        effects: [
          { bond: ["$a", "$b"], delta: 3 }, { bond: ["$b", "$a"], delta: 3 },
          { opinion: "$a", delta: 1 },
          { remember: { holder: "$a", act: "price-plain", valence: 1 } },
        ],
        result: "数说了，名字没说。拼没拼成归她们自己商量。",
      },
      {
        label: "让她各排各的",
        effects: [
          { bond: ["$a", "$b"], delta: -3 },
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "broke-word", valence: -1 } },
        ],
        result: "两条队各自往前挪。{$a}记住了你今天不肯开口。",
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
        result: "这一班没开张。她下次进门喊的是人，不是单。",
      },
      {
        label: "你自己按单接",
        effects: [
          { bond: ["$a", "$b"], delta: -5 },
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "sidelined", valence: -1 } },
        ],
        result: "单记在柜上。{$a}走的时候说，下回她还是找{$b}，不是找这个柜。",
      },
      {
        label: "叫{$b}下来当面把那支说清",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 6 },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "那支的事当面说清。还是熟客，但多记了一句你帮她传到了。",
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
    text: "{$a}问话的时候，眼睛在{$b}和你之间来回。那句是从{$b}嘴里出去的，她等你确认。",
    choices: [
      {
        label: "让{$b}自己认这句",
        effects: [
          { opinion: "$b", delta: -3 }, { opinion: "$a", delta: 3 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$b", act: "talked-down", valence: -1 } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1 } },
        ],
        result: "话是谁出口，今天对上了号。{$b}认得不情愿，但认了。",
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
        result: "你认的是你自己那次，没让她点名。{$b}记下你挡住了，{$a}记下你们俩在对口径。",
      },
      {
        label: "不接，让她们自己说",
        effects: [
          { bond: ["$a", "$b"], delta: -6 }, { bond: ["$b", "$a"], delta: -4 },
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$b", act: "sidelined", valence: -1 } },
        ],
        result: "你退开半步，那句落回她们中间。谁传的，变成她们自己的事。",
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
    text: "{$b}听来的版本已经拐了两个弯。她扭头问{$a}：你当时在，是不是这样。{$a}看着你。",
    choices: [
      {
        label: "请{$a}说一句她亲眼看见的",
        effects: [
          { remember: { holder: "$b", act: "honest-advice", valence: 1, heardFrom: "$a" } },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 3 },
        ],
        result: "一句原样落回一句听来的。{$b}把这笔记在{$a}名下，没记成耳闻。",
      },
      {
        label: "你自己认，不拉人作证",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
          { remember: { holder: "$b", act: "kept-word", valence: 1 } },
        ],
        result: "那次是你的，你自己认。{$a}记下的是你没把她当凭据用。",
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
        result: "看见过的人当面听见你否认。这一笔从今往后，{$b}见谁都会讲。",
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
    text: "{$a}进门就说，是听{$b}说你实在。{$b}跟在她后面，知道自己传的是哪句。",
    choices: [
      {
        label: "认下这句，再补她没听到的那半",
        when: [{ not: { temper: "$a", is: "wary" } }],
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1 } },
        ],
        result: "第一次坐下，你多说了那半句。她带走的是亲眼的一段，不再只是听来的。",
      },
      {
        label: "先谢{$b}这句",
        effects: [
          { remember: { holder: "$a", act: "passed-word", valence: 1, subject: "$b" } },
          { bond: ["$a", "$b"], delta: 4 },
          { opinion: "$b", delta: 4 },
        ],
        result: "好话记回传话的人头上。{$a}听见你说谢谢的时候，{$b}在笑。",
      },
      {
        label: "别拿{$b}当凭据，让她自己看",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -2 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1 } },
        ],
        result: "你不把传话的人垫在话底下。{$a}坐下来，自己对这张脸。",
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
        result: "空行还是空的。{$b}回来自己补，她得先看见这个洞。",
      },
      {
        label: "把今天看见的原样写下",
        when: [{ stat: "compliance", gte: 40 }],
        effects: [
          { remember: { holder: "$a", act: "same-as-record", valence: 2 } },
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: 2 },
        ],
        result: "她核了一遍，和票上是同一件事。这行过了她的眼。",
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
    text: "{$b}把那半句摔在门里，人已经往外走。{$a}的手搭在门上，等你一句话。",
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
        result: "门没响。那半句你在门口接住，她答应明天上午自己进来把它说完。",
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
        result: "你让保安替你把人请了出去。{$b}记的是那扇门，{$a}记的是这层的门不该管卖货的事。",
      },
      {
        label: "请{$b}先到休息区坐两分钟",
        effects: [
          { move: { person: "$b", zone: "lounge" } },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
        ],
        result: "门里没人摔话了。她坐了两分钟，回来把声音压着说完了。",
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
    text: "{$a}翻到上一班那页，抬头看了{$b}一眼。那句写的是{$b}，但她没出声。",
    choices: [
      {
        label: "把话带给{$b}，来源写你自己",
        effects: [
          { remember: { holder: "$b", act: "named-colleague", valence: -1, subject: "$a", heardFrom: "player" } },
          { opinion: "$b", delta: -4 }, { opinion: "$a", delta: 2 },
          { bond: ["$a", "$b"], delta: -8 }, { bond: ["$b", "$a"], delta: -6 },
        ],
        result: "她知道自己被写进哪一行，也知道话是从哪儿听来的。这一页今晚就摊在两个人中间。",
      },
      {
        label: "让{$a}自己把那行改了",
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "$b" } },
        ],
        result: "她没答应，但那一行今晚还开着。你替{$b}留了个没被钉死的口子。",
      },
      {
        label: "把这页合上，两人先分开",
        effects: [
          { move: { person: "$b", zone: "backroom" } },
          { bond: ["$a", "$b"], kind: "colleague", set: 5 }, { bond: ["$b", "$a"], kind: "colleague", set: 5 },
          { remember: { holder: "$b", act: "stood-aside", valence: 1 } },
        ],
        result: "页合上了，人挪开了。那行留在纸上，先回到同事这一档。",
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
    text: "中庭摆台少一个人。{$a}要{$b}过去，{$b}手上还有半单没写完。",
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
        result: "摆台有人，那半单也没断。{$b}回来时把欠的那句先补给了你。",
      },
      {
        label: "把{$b}挪到入口，柜上你看着",
        effects: [
          { move: { person: "$b", zone: "entrance" } },
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$b", act: "sidelined", valence: -1 } },
          { stat: "standing", delta: 1 },
        ],
        result: "入口站住了人，{$a}拿着单子就去交差。那半单是你替她收尾的。",
      },
      {
        label: "柜上走不开，让楼层自己想办法",
        effects: [
          { opinion: "$a", delta: -6 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "broke-word", valence: -1 } },
        ],
        result: "{$a}自己去调别层的人。下次摆台的缺口，不会先来问你这一柜。",
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
    text: "{$b}要找『教她这句的人』。{$a}站在你侧边，纸条在她袖口露着半截。",
    choices: [
      {
        label: "这本账你说开，把{$a}的事当场讲明白",
        effects: [
          { reveal: "$a" },
          { opinion: "$a", delta: -6 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "public-shame", valence: -2 } },
          { remember: { holder: "$b", act: "same-as-record", valence: 1 } },
        ],
        result: "纸条翻过来了。{$b}对上了那句的出处，{$a}记住的是你当着人念出来的那半页。",
      },
      {
        label: "私下拦一句，让{$a}自己认",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 1 } },
        ],
        result: "那句在袖子那儿停住了。{$b}没拿到出处，{$a}拿到了自己开口的那一分钟。",
      },
      {
        label: "这句你不接",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "copied-line", valence: -1 } },
        ],
        result: "没人接，那句就在柜上挂着。{$b}把这份账记在你俩头上，谁也没跑掉。",
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
        label: "把两人钉回同事这一档，各让半步",
        effects: [
          { bond: ["$a", "$b"], kind: "colleague", set: 10 }, { bond: ["$b", "$a"], kind: "colleague", set: 10 },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "mediated", valence: 1 } },
          { remember: { holder: "$b", act: "mediated", valence: 1 } },
        ],
        result: "桌子拼成了，谁也不欠谁一句。以后这层碰见，先按同事这一档处。",
      },
      {
        label: "把{$a}请到入口那边等",
        effects: [
          { move: { person: "$a", zone: "entrance" } },
          { opinion: "$a", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "no-snatch", valence: 1 } },
        ],
        result: "那堆赠品没被催散。{$a}在入口等到{$b}空出来，两个人说成了半小时的那档。",
      },
      {
        label: "柜上今天不借人",
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "broke-word", valence: -1 } },
        ],
        result: "{$b}今天没挪窝。{$a}自己去别处调人，账记到你这柜头上了。",
      },
    ],
  },
];

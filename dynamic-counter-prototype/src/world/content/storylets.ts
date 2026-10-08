// 故事碎片。社交局只用角色槽，不写死人物 id。
// 个人线用 quality「arc:<id>」推进，落点写在「arc:<id>:end」（至少两个不同的 set）。
// 契约没有「这个槽就是某人」。主角靠唯一的职位或唯一的关系钉住。
import type { Storylet } from "../types.ts";

// 个人线的主角直接钉 id（CastSlot.id），不再靠"唯一的关系或脾气组合"去绕。
const shen: Storylet["cast"][string] = { id: "shen", where: [] };
const anjie: Storylet["cast"][string] = { id: "anjie", where: [] };
const luyao: Storylet["cast"][string] = { id: "luyao", where: [] };
const suman: Storylet["cast"][string] = { id: "suman", where: [] };

export const STORYLETS: Storylet[] = [
  // —— 通用社交局 ——

  {
    id: "social-friends-rumor",
    kind: "social",
    cast: {
      b: { where: [{ not: { remembers: "$self", act: "hard-sell", valence: "bad" } }] },
      a: { where: [{ remembers: "$self", act: "hard-sell", valence: "bad" }, { bond: ["$self", "$b"], kind: "friend", gte: 20 }] },
    },
    when: [{ bond: ["$a", "$b"], kind: "friend" }],
    weight: 5, tension: 1, cooldown: 4,
    text: "{$a}进门就说，听说你推得很狠。{$b}还没表态，人站在她旁边。",
    choices: [
      {
        label: "先问{$b}，那句先放下",
        effects: [
          { opinion: "$b", delta: 6 }, { opinion: "$a", delta: -3 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
          { log: "你先听了还没听说过的那位。听说过的人记住你躲了。" },
        ],
        result: "{$b}把自己的事说完了。{$a}没有再提那句，也没有帮你。",
      },
      {
        label: "当着{$b}把那次认了",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { opinion: "$a", delta: -6 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "public-shame", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "{$a}要面子。你当众认，她记的是下不来台，不是你诚实。",
      },
      {
        label: "认了，请她自己再看一次",
        when: [{ not: { temper: "$a", is: "face" } }],
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 3, slot: 2 } },
        ],
        result: "{$a}要自己看见。{$b}听见你没躲，下回还肯跟她一起来。",
      },
      {
        label: "还是按{$a}进门要的那支推",
        effects: [
          { opinion: "$a", delta: -6 }, { opinion: "$b", delta: -4 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "hard-sell", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "hard-sell", valence: -1, subject: "player" } },
        ],
        result: "{$b}现在也有了这句。她们回去会说的是同一个人。",
      },
    ],
  },
  {
    id: "social-family-split",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { where: [{ bond: ["$a", "$self"], kind: "family" }] },
    },
    when: [{ bond: ["$a", "$b"], kind: "family" }],
    weight: 5, tension: 1, cooldown: 4,
    text: "{$a}要按自己嘴里的买。{$b}拦着，两个人说的不是同一张脸。",
    choices: [
      {
        label: "两个人的话分开记",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 5 },
          { bond: ["$a", "$b"], delta: 6 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "两句都留在柜上。谁的脸，谁的单。",
      },
      {
        label: "听{$a}的",
        when: [{ bond: ["$a", "$b"], gte: 20 }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -8 },
          { bond: ["$a", "$b"], delta: -12 },
          { remember: { holder: "$b", act: "wrong-face", valence: -2, subject: "player" } },
          { appoint: { person: "$b", inDays: 2, slot: 1 } },
        ],
        result: "家里本来热。{$b}回头会自己来，来退的是你按{$a}开的那支。",
      },
      {
        label: "听{$a}的，他们本来就说不到一块",
        when: [{ bond: ["$a", "$b"], lte: 19 }],
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -3 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "这家里本来就冷。{$b}不跟你约下次，只是不再替{$a}说话。",
      },
      {
        label: "给{$a}台阶，私下按{$b}改",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 4 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "面子留给{$a}。真正开出去的，是{$b}那句。",
      },
    ],
  },
  {
    id: "social-couple-row",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { where: [{ bond: ["$self", "$a"], kind: "partner" }] },
    },
    when: [{ bond: ["$a", "$b"], kind: "partner" }],
    weight: 5, tension: 1, cooldown: 4,
    text: "{$a}和{$b}在镜子前说不到一块。你问一句，两个人都听得见。",
    choices: [
      {
        label: "两张小票，当面分开",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 4 },
          { bond: ["$a", "$b"], delta: 6 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "谁的脸谁的单。他们吵归吵，这句没有并成「我们看看」。",
      },
      {
        label: "合成一单",
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: -5 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "wrong-face", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "wrong-face", valence: -2, subject: "player" } },
        ],
        result: "一张票出去。回去改口的时候，两个人都会找到你。",
      },
      {
        label: "别在镜子前分对错",
        when: [{ any: [{ temper: "$a", is: "face" }, { temper: "$b", is: "face" }] }],
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 2, slot: 2, bring: ["$b"] } },
        ],
        result: "当场没有人下不来台。单停着，他们改天一起来，或只来一个。",
      },
      {
        label: "让他们先出去说",
        when: [{ bond: ["$a", "$b"], lte: 20 }],
        effects: [
          { bond: ["$a", "$b"], delta: -6 },
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
          { leave: "$b" },
        ],
        result: "冷的那对被你推出镜子。{$b}走了，账还在两个人中间。",
      },
    ],
  },
  {
    id: "social-regular-plus-one",
    kind: "social",
    cast: {
      a: { where: [{ opinion: "$self", gte: 15 }] },
      b: { where: [{ opinion: "$self", lte: 5 }, { bond: ["$a", "$self"], kind: "friend" }] },
    },
    when: [{ bond: ["$a", "$b"], kind: "friend" }],
    weight: 4, tension: -1, cooldown: 4,
    text: "{$a}带了{$b}来。{$b}第一次站到这面镜子前，眼睛在看你怎么对待熟客。",
    choices: [
      {
        label: "先跟{$b}说话",
        effects: [
          { opinion: "$b", delta: 6 }, { opinion: "$a", delta: -2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { appoint: { person: "$b", inDays: 4, slot: 2 } },
        ],
        result: "{$b}被当成另一个人。{$a}少了点面子，人还是她带来的。",
      },
      {
        label: "按{$a}上次的用法给{$b}",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -5 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$b", act: "wrong-face", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "hard-sell", valence: -1, subject: "player" } },
        ],
        result: "熟客高兴。新来的记住：你看的是带来的人，不是她。",
      },
      {
        label: "{$b}已经听说了，你先认",
        when: [{ remembers: "$b", act: "hard-sell", valence: "bad" }],
        effects: [
          { opinion: "$b", delta: 5 }, { opinion: "$a", delta: -4 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "带人来的那位没想到你先认。{$b}肯留下，是因为你没有再推一次。",
      },
      {
        label: "退开，让{$a}介绍",
        when: [{ temper: "$b", is: "shy" }],
        effects: [
          { opinion: "$b", delta: 5 }, { opinion: "$a", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$b", act: "stood-aside", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 3, slot: 1, bring: ["$b"] } },
        ],
        result: "怕被围的人没有被围。下次还是{$a}带她来，她自己也会进门。",
      },
    ],
  },
  {
    id: "social-gossip-third",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "gossip" }] },
      b: { where: [{ bond: ["$a", "$self"] }] },
    },
    when: [{ temper: "$a", is: "gossip" }],
    weight: 4, tension: 1, cooldown: 3,
    text: "{$a}压低声音，说你上次那单。{$b}站在听得见的地方。",
    choices: [
      {
        label: "岔开，只谈今天柜上的事",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -2 },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
        ],
        result: "话没有传完。{$a}觉得你挡了她，{$b}还没拿到可以转述的句子。",
      },
      {
        label: "把原话补全",
        when: [{ remembers: "$a", valence: "bad", subject: "player" }],
        effects: [
          { opinion: "$b", delta: -2 }, { opinion: "$a", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$b", act: "hard-sell", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "leaked", valence: -1, subject: "$b" } },
        ],
        result: "{$b}拿走的是补全之后的坏话。下一张桌子，说的人会换成她。",
      },
      {
        label: "让{$b}自己看，别信耳闻",
        when: [{ temper: "$b", is: "wary" }],
        effects: [
          { opinion: "$b", delta: 6 }, { opinion: "$a", delta: -4 },
          { bond: ["$a", "$b"], delta: -5 },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "多疑的人不收转述。{$a}少了一个肯传话的人。",
      },
      {
        label: "让这句说到{$b}面前",
        effects: [
          { opinion: "$b", delta: -5 }, { opinion: "$a", delta: 1 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$a", act: "talked-down", valence: -1, subject: "$b" } },
          { remember: { holder: "$b", act: "leaked", valence: -1, subject: "player" } },
        ],
        result: "{$b}知道是谁在说她。这句还能再传，而且带着名字。",
      },
    ],
  },
  {
    id: "social-rival-snatch",
    kind: "social",
    cast: {
      a: { where: [{ role: "$self", is: "rival" }] },
      b: { where: [{ role: "$self", is: "customer" }] },
    },
    when: [{ role: "$a", is: "rival" }, { role: "$b", is: "customer" }],
    weight: 6, tension: 1, cooldown: 3,
    text: "{$a}已经靠到凳子边。{$b}还坐在你这边，脸朝着你们两个。",
    choices: [
      {
        label: "把区别说清，不抢她的句子",
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -2 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "no-snatch", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "{$b}留下听你的。{$a}没截成，她记下你没有当面压她。",
      },
      {
        label: "当着{$b}把{$a}压过去",
        when: [{ temper: "$b", is: "face" }],
        effects: [
          { opinion: "$a", delta: -8 }, { opinion: "$b", delta: -8 },
          { bond: ["$a", "$b"], delta: -10 },
          { remember: { holder: "$b", act: "public-shame", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
        ],
        result: "爱面子的客人先走。{$a}记的是你当着人把她压了。",
      },
      {
        label: "当着{$b}把区别说死",
        when: [{ not: { temper: "$b", is: "face" } }],
        effects: [
          { opinion: "$a", delta: -8 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "{$b}要一个清楚的答案，她留下了。{$a}记住这单是被你截回去的。",
      },
      {
        label: "把人让给{$a}",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -4 },
          { bond: ["$a", "$b"], delta: 8 },
          { remember: { holder: "$a", act: "yielded-client", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "yielded-client", valence: -1, subject: "player" } },
          { leave: "$b" },
        ],
        result: "人跟{$a}走了。她欠你一个下次会先说一声的理由，客人认的是她。",
      },
    ],
  },
  {
    id: "social-staff-bump",
    kind: "social",
    cast: {
      a: { where: [{ role: "$self", is: "staff" }] },
      b: { where: [{ role: "$self", is: "staff" }, { bond: ["$self", "$a"], kind: "colleague" }] },
      c: { where: [{ role: "$self", is: "customer" }] },
    },
    when: [{ role: "$c", is: "customer" }],
    weight: 5, tension: 1, cooldown: 4,
    text: "{$a}和{$b}都说{$c}先问过自己。客人还坐着，名字还没写。",
    choices: [
      {
        label: "问{$c}今天认谁",
        effects: [
          { opinion: "$c", delta: 5 }, { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 1 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$c", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "名字按客人的嘴写。同事两个都听见了，谁也不用猜。",
      },
      {
        label: "写在{$a}名下",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -6 }, { opinion: "$c", delta: -2 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$b", act: "took-order", valence: -2, subject: "player" } },
          { remember: { holder: "$c", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "{$b}没有当场争。她记住的是：客人还在，你已经写了另一个名字。",
      },
      {
        label: "客人面前先不分",
        when: [{ bond: ["$a", "$b"], lte: 0 }],
        effects: [
          { bond: ["$a", "$b"], delta: 6 },
          { opinion: "$c", delta: 3 }, { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$c", act: "kept-secret", valence: 1, subject: "player" } },
        ],
        result: "冷着的两个人没有在客人面前再裂一寸。单先停着。",
      },
      {
        label: "提议对半",
        when: [{ bond: ["$a", "$b"], gte: 20 }],
        effects: [
          { bond: ["$a", "$b"], delta: 5 },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 3 }, { opinion: "$c", delta: 1 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "本来就一班的人接受了对半。客人知道这单不是抢来的。",
      },
    ],
  },
  {
    id: "social-enemies-meet",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { where: [{ bond: ["$self", "$a"], kind: "rival", lte: -10 }] },
    },
    when: [{ bond: ["$b", "$a"], kind: "rival", lte: 0 }],
    weight: 5, tension: 1, cooldown: 4,
    text: "{$a}和{$b}对上了。两个人都没打算先开口，柜子就这么大。",
    choices: [
      {
        label: "支到镜子两边",
        effects: [
          { bond: ["$a", "$b"], delta: 6 }, { bond: ["$b", "$a"], delta: 4 },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "没有和解。至少这单没有变成他们的战场。",
      },
      {
        label: "先听{$a}",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -7 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$b", act: "sidelined", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "took-client", valence: 1, subject: "$b" } },
        ],
        result: "你站了{$a}。{$b}把这单记成你帮着对方。",
      },
      {
        label: "旧账别在柜上翻",
        when: [{ bond: ["$a", "$b"], lte: -30 }],
        effects: [
          { bond: ["$a", "$b"], delta: 4 },
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
        ],
        result: "恨得深的那对没有新的一句。他们仍然不对盘，只是今天没加码。",
      },
      {
        label: "让{$a}把那句当着{$b}说完",
        when: [{ temper: "$a", is: "gossip" }],
        effects: [
          { opinion: "$b", delta: -6 }, { opinion: "$a", delta: 2 },
          { bond: ["$a", "$b"], delta: -10 },
          { remember: { holder: "$a", act: "talked-down", valence: -2, subject: "$b" } },
          { remember: { holder: "$b", act: "leaked", valence: -2, subject: "player" } },
        ],
        result: "爱传话的人得到一个听众。{$b}记住是你让这句落地的。",
      },
    ],
  },
  {
    id: "social-photo-proxy",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { mustBePresent: false, where: [{ any: [{ bond: ["$a", "$self"], kind: "family" }, { bond: ["$a", "$self"], kind: "partner" }] }] },
    },
    when: [{ absent: "$b" }, { any: [{ bond: ["$a", "$b"], kind: "family" }, { bond: ["$a", "$b"], kind: "partner" }] }],
    weight: 5, tension: 0, cooldown: 4,
    text: "{$a}把手机递过来。相册里是{$b}，人没在凳子上。",
    choices: [
      {
        label: "按照片上的脸说",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 4 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { appoint: { person: "$b", inDays: 3, slot: 1 } },
        ],
        result: "单按不在场的那张脸开。{$b}之后会自己来对，不一定跟{$a}一起来。",
      },
      {
        label: "按{$a}嘴里的颜色开",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -6 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "wrong-face", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "wrong-face", valence: -2, subject: "player" } },
          { appoint: { person: "$b", inDays: 2, slot: 2 } },
        ],
        result: "{$a}拿走她要的东西。{$b}回来的时候，退的是这张脸。",
      },
      {
        label: "等{$b}自己来，今天不包",
        when: [{ temper: "$a", is: "hasty" }],
        effects: [
          { opinion: "$a", delta: -5 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
          { appoint: { person: "$b", inDays: 2, slot: 1, bring: ["$a"] } },
          { leave: "$a" },
        ],
        result: "急性子的人走了。{$b}被你约来，带来的那位不一定肯再陪。",
      },
      {
        label: "当面改口会让她下不来台，你先收起手机",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 1 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 2, slot: 2, bring: ["$b"] } },
        ],
        result: "面子留着。你约的是两个人一起来，颜色等{$b}自己说。",
      },
    ],
  },
  {
    id: "social-face-stage",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "face" }] },
      b: { where: [{ any: [{ bond: ["$self", "$a"], kind: "friend" }, { bond: ["$self", "$a"], kind: "colleague" }] }] },
    },
    when: [{ temper: "$a", is: "face" }],
    weight: 5, tension: 1, cooldown: 4,
    text: "{$b}当着柜子把{$a}的话拆了。{$a}还笑着，手已经离开镜子。",
    choices: [
      {
        label: "给{$a}台阶，拉回产品",
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: -3 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "爱面子的人留下来。拆台的那位少了一句能往外说的。",
      },
      {
        label: "顺着{$b}把实话说完",
        effects: [
          { opinion: "$a", delta: -10 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -12 },
          { remember: { holder: "$a", act: "public-shame", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "talked-down", valence: -1, subject: "$a" } },
        ],
        result: "实话在。{$a}记的是当众被拆，这比产品错了更久。",
      },
      {
        label: "私下补一句，当场只谈产品",
        when: [{ bond: ["$a", "$b"], gte: 40 }],
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
        ],
        result: "关系还热的两个人都听见了真话，只是没有听见对方被压。",
      },
      {
        label: "这句你不接",
        when: [{ bond: ["$a", "$b"], lte: 10 }],
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "本来就淡的同伴关系又冷一截。{$a}觉得你也看着她下不来台。",
      },
    ],
  },
  {
    id: "social-mentor-split",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { where: [{ bond: ["$a", "$self"], kind: "mentor" }] },
    },
    when: [{ bond: ["$a", "$b"], kind: "mentor" }],
    weight: 4, tension: 0, cooldown: 4,
    text: "{$a}要{$b}照她的句子说。{$b}想自己问，嘴已经张开了。",
    choices: [
      {
        label: "让{$b}问完",
        effects: [
          { opinion: "$b", delta: 6 }, { opinion: "$a", delta: -3 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "徒弟问出了自己的一句。带的人觉得你拆了她的场。",
      },
      {
        label: "让{$a}把句子说完",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$b", act: "copied-line", valence: -1, subject: "player" } },
        ],
        result: "{$b}把那句背下去了。下一张脸，她还会原样说。",
      },
      {
        label: "你补一句，问题仍由{$b}问",
        when: [{ temper: "$b", is: "shy" }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 4 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "怕开口的人问完了自己的问题。带她的人没有被当众放下。",
      },
    ],
  },
  {
    id: "social-warm-invite",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "warm" }] },
      b: { mustBePresent: false, where: [{ bond: ["$a", "$self"], kind: "friend" }] },
    },
    when: [{ temper: "$a", is: "warm" }, { absent: "$b" }, { bond: ["$a", "$b"], kind: "friend" }],
    weight: 4, tension: -1, cooldown: 5,
    text: "{$a}说，{$b}也该来看看。人今天不在，她问你收不收。",
    choices: [
      {
        label: "让她把{$b}约来",
        effects: [
          { opinion: "$a", delta: 6 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "brought-friend", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 2, slot: 2, bring: ["$b"] } },
        ],
        result: "热心的人得到一个日子。来的时候她会把{$b}带在身边。",
      },
      {
        label: "今天说柜上没位",
        effects: [
          { opinion: "$a", delta: -4 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "refused-intro", valence: -1, subject: "player" } },
        ],
        result: "她不再主动带人。{$b}若自己来，也不会提她的名字。",
      },
      {
        label: "先让她问过{$b}",
        when: [{ temper: "$b", is: "shy" }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
          { appoint: { person: "$b", inDays: 4, slot: 1 } },
        ],
        result: "怕被推销的人不会被突然带来。她若来，是自己走进来的。",
      },
    ],
  },
  {
    id: "social-shy-crowd",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "shy" }] },
      b: { where: [{ not: { temper: "$self", is: "shy" } }, { any: [{ temper: "$self", is: "hasty" }, { temper: "$self", is: "gossip" }] }] },
    },
    when: [{ temper: "$a", is: "shy" }],
    weight: 4, tension: 1, cooldown: 3,
    text: "{$b}往前送了一步。{$a}已经说了别围，肩还对着通道。",
    choices: [
      {
        label: "退开",
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 2, subject: "player" } },
          { appoint: { person: "$a", inDays: 3, slot: 2 } },
        ],
        result: "怕被围的人把话说完了。她肯再来，是因为你退过。",
      },
      {
        label: "让{$b}先说完",
        effects: [
          { opinion: "$b", delta: 3 }, { opinion: "$a", delta: -6 },
          { bond: ["$a", "$b"], delta: -5 },
          { remember: { holder: "$a", act: "crowded", valence: -2, subject: "player" } },
          { leave: "$a" },
        ],
        result: "{$a}走了。{$b}还在，她会把「一围就走」说给下一个人。",
      },
      {
        label: "把{$b}请开，不当她的面说",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { opinion: "$a", delta: 8 }, { opinion: "$b", delta: -3 },
          { bond: ["$a", "$b"], delta: -2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "又怕又要面子的人留了下来。这句没有变成{$b}的谈资。",
      },
    ],
  },
  {
    id: "social-thrifty-price",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "thrifty" }] },
      b: { where: [{ bond: ["$a", "$self"], kind: "friend" }] },
    },
    when: [{ temper: "$a", is: "thrifty" }, { bond: ["$a", "$b"], kind: "friend" }],
    weight: 4, tension: 0, cooldown: 4,
    text: "{$a}当着{$b}问柜台和旗舰店差多少。她要一个能带出去的数。",
    choices: [
      {
        label: "把差价说清楚",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "price-plain", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "price-plain", valence: 1, subject: "player" } },
        ],
        result: "数是公开的。{$b}带出去的也是这个数，补不了，也赖不了。",
      },
      {
        label: "用小样把差补上",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -3 },
          { stat: "compliance", delta: -4 }, { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "price-pad", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "price-pad", valence: -1, subject: "player" } },
        ],
        result: "{$a}今天满意。{$b}看见了垫进去的那一只，说法会变。",
      },
      {
        label: "别让{$b}把价带出去",
        when: [{ temper: "$b", is: "gossip" }],
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -4 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "leaked", valence: -1, subject: "player" } },
        ],
        result: "爱传话的人被你挡住。她跟{$a}之间少了一句能一起说的价。",
      },
    ],
  },
  {
    id: "social-loyal-memory",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "loyal" }, { remembers: "$self", subject: "player" }] },
      b: { where: [{ bond: ["$a", "$self"], kind: "friend" }] },
    },
    when: [{ temper: "$a", is: "loyal" }],
    weight: 4, tension: -1, cooldown: 5,
    text: "{$a}跟{$b}提起你以前的一次。她说得很慢，像这句还算数。",
    choices: [
      {
        label: "让她把好的那次说完",
        when: [{ remembers: "$a", valence: "good", subject: "player" }],
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 5 },
          { bond: ["$a", "$b"], delta: 5 },
          { remember: { holder: "$b", act: "brought-friend", valence: 1, subject: "player" } },
          { appoint: { person: "$b", inDays: 3, slot: 1 } },
        ],
        result: "念旧的人把好话给了{$b}。{$b}下次来，不是空手听来的。",
      },
      {
        label: "把当时的限制补上",
        when: [{ remembers: "$a", valence: "bad", subject: "player" }],
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "坏的那次还在。限制补上之后，{$b}听到的不是一句断语。",
      },
      {
        label: "把话接开",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: 1 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-secret", valence: 0, subject: "player" } },
        ],
        result: "念旧的人觉得你不想认。{$b}没有新的句子，也没有新的信任。",
      },
    ],
  },
  {
    id: "social-proud-slight",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "proud" }] },
      b: { where: [{ role: "$self", is: "customer" }, { opinion: "$self", gte: 8 }, { not: { temper: "$self", is: "proud" } }] },
    },
    when: [{ temper: "$a", is: "proud" }, { role: "$b", is: "customer" }],
    weight: 4, tension: 1, cooldown: 4,
    text: "{$a}看见你把更好的那支留在{$b}那边。她没有出声，手离开了试妆盘。",
    choices: [
      {
        label: "跟她说两张脸不是一回事",
        when: [{ temper: "$a", is: "wary" }],
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { bond: ["$a", "$b"], delta: 2 },
        ],
        result: "多疑又好胜的人要自己核对。你把两张脸分开，她肯听。",
      },
      {
        label: "当场说{$b}更适合",
        when: [{ not: { temper: "$a", is: "wary" } }],
        effects: [
          { opinion: "$a", delta: -7 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$a", act: "public-shame", valence: -2, subject: "player" } },
        ],
        result: "好胜的人被比下去了。这句她会拿去跟别人说。",
      },
      {
        label: "把同样的说法也给{$a}",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -4 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "hard-sell", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "两个人听到同一句。适合的那位觉得自己被抹平了。",
      },
      {
        label: "让{$b}自己说不是在比",
        when: [{ bond: ["$a", "$b"], kind: "friend" }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "朋友替你把「不是比」说了。好胜的人收的是熟人的话，不是你的。",
      },
    ],
  },
  {
    id: "social-hasty-clock",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "hasty" }] },
      b: { where: [{ not: { temper: "$self", is: "hasty" } }] },
    },
    when: [{ temper: "$a", is: "hasty" }],
    weight: 4, tension: 1, cooldown: 3,
    text: "{$a}在看表。{$b}的话还没说完，分钟已经从另一头走。",
    choices: [
      {
        label: "先收{$a}，跟{$b}说还剩几分钟",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
          { appoint: { person: "$b", inDays: 1, slot: 2 } },
          { leave: "$a" },
        ],
        result: "急性子的人走成了。{$b}被你约到明天，今天这句是断的。",
      },
      {
        label: "让{$a}等，先听完{$b}",
        effects: [
          { opinion: "$a", delta: -6 }, { opinion: "$b", delta: 5 },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "sidelined", valence: -2, subject: "player" } },
          { leave: "$a" },
        ],
        result: "{$a}不等了。她走的时候{$b}还在，外面的人会看见谁被留下。",
      },
      {
        label: "请{$b}先接{$a}的时间",
        when: [{ role: "$b", is: "staff" }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 4 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "同事接过这几分钟。{$a}认的是谁接的，单上也得是那个名字。",
      },
    ],
  },
  {
    id: "social-wary-hearsay",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "wary" }] },
      b: { where: [{ temper: "$self", is: "gossip" }, { bond: ["$self", "$a"], kind: "friend" }, { remembers: "$self", act: "honest-advice", valence: "good", subject: "player" }] },
    },
    when: [{ temper: "$a", is: "wary" }],
    weight: 4, tension: 0, cooldown: 4,
    text: "{$b}说你上次帮过她。{$a}看着你，没有接这句话。",
    choices: [
      {
        label: "让{$a}自己试",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "多疑的人只认自己看见的。{$b}的好话没有被你拿来用。",
      },
      {
        label: "让{$b}再说一遍",
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "耳闻被你加了一遍。{$a}更不信，{$b}却觉得你站在她那边。",
      },
      {
        label: "跟她说这是听来的",
        when: [{ remembers: "$a", valence: "good", heard: true, subject: "player" }],
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "leaked", valence: -1, subject: "player" } },
        ],
        result: "她本来就把听来的打折。你承认这是耳闻，她才肯自己看。",
      },
    ],
  },
  {
    id: "social-gossip-collide",
    kind: "social",
    cast: {
      b: { where: [] },
      a: { where: [{ temper: "$self", is: "gossip" }, { remembers: "$self", subject: "$b", valence: "bad" }] },
    },
    when: [{ remembers: "$a", subject: "$b", valence: "bad" }],
    weight: 5, tension: 1, cooldown: 5,
    text: "{$a}上次说的那个人，就是现在站在柜台里的{$b}。两个人都看见了你。",
    choices: [
      {
        label: "截住，只说产品",
        effects: [
          { opinion: "$b", delta: 5 }, { opinion: "$a", delta: -4 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "坏话没有当面对上。{$b}知道你挡过，{$a}少了一个场子。",
      },
      {
        label: "让{$a}当着{$b}说完",
        effects: [
          { opinion: "$b", delta: -8 }, { opinion: "$a", delta: 2 },
          { bond: ["$a", "$b"], delta: -12 },
          { remember: { holder: "$b", act: "public-shame", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "leaked", valence: -2, subject: "$b" } },
        ],
        result: "句子落地了。{$b}记的是你让它落地，不只是{$a}说了。",
      },
      {
        label: "请{$b}自己答",
        when: [{ bond: ["$a", "$b"], kind: "friend", gte: 20 }],
        effects: [
          { opinion: "$b", delta: 6 }, { opinion: "$a", delta: -2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "还是朋友的两个人，由被说的那位自己收口。你没有替谁传。",
      },
    ],
  },
  {
    id: "social-client-handoff",
    kind: "social",
    cast: {
      a: { where: [{ role: "$self", is: "staff" }] },
      b: { where: [{ bond: ["$a", "$self"], kind: "client", gte: 20 }] },
    },
    when: [{ bond: ["$a", "$b"], kind: "client", gte: 20 }],
    weight: 5, tension: -1, cooldown: 4,
    text: "{$b}进门先看{$a}。{$a}没说话，把位置留给你。",
    choices: [
      {
        label: "请{$a}先过来",
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: 6 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "老客还认{$a}。她肯把下一句交给你，是因为你没有抢这一个坐下。",
      },
      {
        label: "你自己接",
        effects: [
          { opinion: "$a", delta: -6 }, { opinion: "$b", delta: 1 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "单可以是你的。{$a}下一回不会再把人往你这边让。",
      },
      {
        label: "先问{$a}这句该不该你说",
        when: [{ opinion: "$a", gte: 10 }],
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 5 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "她跟你还有一点信任。问过再开口，老客留在这个柜，不跟着她走。",
      },
    ],
  },
  {
    id: "social-fan-room",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { where: [{ bond: ["$self", "$a"], kind: "fan", gte: 30 }] },
    },
    when: [{ bond: ["$b", "$a"], kind: "fan", gte: 30 }],
    weight: 4, tension: 0, cooldown: 4,
    text: "{$b}跟着{$a}进来，话都替她说。{$a}自己还没开口。",
    choices: [
      {
        label: "先问{$a}",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -2 },
          { bond: ["$b", "$a"], delta: -3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "被跟着的人说了自己的话。粉丝少了一次替她做主的机会。",
      },
      {
        label: "让{$b}复述上次",
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -4 },
          { bond: ["$b", "$a"], delta: -5 },
          { remember: { holder: "$a", act: "wrong-face", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "copied-line", valence: -1, subject: "player" } },
        ],
        result: "复述变成了这一单。{$a}的脸没有进这句话。",
      },
      {
        label: "两张单分开",
        when: [{ temper: "$a", is: "proud" }],
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "好胜的人不肯被别人的妆盖住。分开之后，粉丝还在，单不是同一张。",
      },
    ],
  },
  {
    id: "social-520-unopened",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { mustBePresent: false, where: [{ bond: ["$a", "$self"], kind: "partner" }] },
    },
    when: [{ festival: "520" }, { bond: ["$a", "$b"], kind: "partner" }],
    weight: 6, tension: 0, cooldown: 6,
    text: "520 的礼盒还封着。{$a}说颜色已经定了，{$b}的原话不在这张嘴上。",
    choices: [
      {
        label: "不拆，按相册留可退",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 5 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$b", inDays: 1, slot: 2 } },
        ],
        result: "盒子还在。{$b}来对的时候，退不退由她自己说。",
      },
      {
        label: "按{$a}说的拆开",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -7 },
          { bond: ["$a", "$b"], delta: -10 },
          { remember: { holder: "$b", act: "wrong-face", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "hard-sell", valence: -1, subject: "player" } },
          { appoint: { person: "$b", inDays: 1, slot: 1 } },
        ],
        result: "礼盒作废。{$b}明天来，来的是退，不是谢。",
      },
      {
        label: "让{$b}自己说",
        when: [{ present: "$b" }],
        effects: [
          { opinion: "$b", delta: 8 }, { opinion: "$a", delta: -2 },
          { bond: ["$a", "$b"], delta: 6 },
          { remember: { holder: "$b", act: "honest-advice", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "人在场，猜的那句就作废。{$a}少了一次做主，色是对的。",
      },
      {
        label: "打电话问",
        when: [{ absent: "$b" }, { temper: "$a", is: "wary" }],
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 4 },
          { bond: ["$a", "$b"], delta: 5 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 2, bring: ["$b"] } },
          { stat: "energy", delta: -1 },
        ],
        result: "多疑的人肯等一个亲自的回答。这一分钟从柜上另一头扣。",
      },
    ],
  },
  {
    id: "social-618-channel",
    kind: "social",
    cast: {
      a: { where: [{ temper: "$self", is: "thrifty" }] },
      b: { where: [{ role: "$self", is: "customer" }, { not: { temper: "$self", is: "thrifty" } }] },
    },
    when: [{ festival: "618" }, { role: "$b", is: "customer" }],
    weight: 6, tension: 1, cooldown: 6,
    text: "618。{$a}要一个能发到群里的价。{$b}站在旁边，听得见你把哪一种开法说出来。",
    choices: [
      {
        label: "说清两种开法，不发会员价",
        effects: [
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: 3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "price-plain", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "price-plain", valence: 1, subject: "player" } },
          { bond: ["$a", "$b"], delta: 3 },
        ],
        result: "价没有进群。{$b}听见的是公开的那种，回头对得上。",
      },
      {
        label: "把会员价给{$a}",
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: -4 },
          { bond: ["$a", "$b"], delta: -6 },
          { stat: "compliance", delta: -6 },
          { remember: { holder: "$a", act: "leaked", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "leaked", valence: -1, subject: "player" } },
        ],
        result: "截图会出门。{$b}若跟别人说，说的是你给过。",
      },
      {
        label: "别当着{$b}谈价",
        when: [{ temper: "$b", is: "face" }],
        effects: [
          { opinion: "$b", delta: 5 }, { opinion: "$a", delta: -3 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "要面子的人没有被当成代购的听众。{$a}今天没有拿到能发的图。",
      },
      {
        label: "说明你们是两种开法",
        when: [{ bond: ["$a", "$b"], kind: "rival" }],
        effects: [
          { bond: ["$a", "$b"], delta: 6 },
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "对头听见自己不是同一种客。价没有混，仇也没有借这句变深。",
      },
    ],
  },
  {
    id: "social-qixi-frame",
    kind: "social",
    cast: {
      a: { where: [{ any: [{ temper: "$self", is: "gossip" }, { temper: "$self", is: "proud" }] }] },
      b: { where: [{ temper: "$self", is: "shy" }] },
    },
    when: [{ festival: "qixi" }],
    weight: 6, tension: 1, cooldown: 6,
    text: "七夕，灯是暖的。{$a}想让这面镜子进画面。{$b}的第一句是把手机放下。",
    choices: [
      {
        label: "镜头只对着产品",
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 8 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$b", act: "off-camera", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "off-camera", valence: -1, subject: "player" } },
        ],
        result: "画面里没有{$b}的脸。{$a}少一段完播，人还在你凳子上。",
      },
      {
        label: "让{$b}出镜",
        effects: [
          { opinion: "$b", delta: -10 }, { opinion: "$a", delta: 6 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$b", act: "on-camera", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "on-camera", valence: 1, subject: "$b" } },
        ],
        result: "切片有了。{$b}今晚就会让认识她的人知道，是你让镜头对着她。",
      },
      {
        label: "给{$b}一个镜头外面的位置",
        when: [{ temper: "$b", is: "face" }],
        effects: [
          { opinion: "$b", delta: 7 }, { opinion: "$a", delta: -2 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$b", act: "kept-secret", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
        ],
        result: "又怕又要面子的人没有被拍到。灯还开着，只是没有对着她。",
      },
    ],
  },
  {
    id: "social-cold-table",
    kind: "social",
    cast: {
      a: { where: [] },
      b: { where: [{ bond: ["$self", "$a"], lte: 5 }] },
    },
    when: [{ bond: ["$a", "$b"], lte: 5 }, { bond: ["$b", "$a"], lte: 5 }],
    weight: 3, tension: -1, cooldown: 4,
    text: "{$a}和{$b}并排站着，谁也不看谁。冷是早就有的，不是今天才开始。",
    choices: [
      {
        label: "让他们留个名字",
        effects: [
          { bond: ["$a", "$b"], delta: 8 }, { bond: ["$b", "$a"], delta: 6 },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "brought-friend", valence: 1, subject: "$b" } },
          { remember: { holder: "$b", act: "brought-friend", valence: 1, subject: "$a" } },
        ],
        result: "冷暖动了。他们算认识你介绍的人，原来的关系种类还是原来的。",
      },
      {
        label: "放到镜子两边，不介绍",
        effects: [
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
          { remember: { holder: "$b", act: "stood-aside", valence: 0, subject: "player" } },
        ],
        result: "你没有撮合。两个人都松了一点，也没有新的称呼。",
      },
      {
        label: "旧账别翻",
        when: [{ bond: ["$a", "$b"], kind: "rival" }],
        effects: [
          { bond: ["$a", "$b"], delta: 4 }, { bond: ["$b", "$a"], delta: 3 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
        ],
        result: "对头还是对头。今天没有新的一句可以拿去说给别人。",
      },
    ],
  },
  {
    id: "social-proxy-return",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", act: "wrong-face", valence: "bad" }] },
      b: { mustBePresent: false, where: [{ any: [{ bond: ["$self", "$a"], kind: "family" }, { bond: ["$self", "$a"], kind: "partner" }] }] },
    },
    when: [{ remembers: "$a", act: "wrong-face", valence: "bad" }],
    weight: 5, tension: 1, cooldown: 5,
    text: "{$a}回来了，手里是按别人的嘴开出去的那支。{$b}是当时点头的人。",
    choices: [
      {
        label: "退，按{$a}的脸重开",
        effects: [
          { opinion: "$a", delta: 8 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: 3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "用的人留下了。当时做主的那位少了一点面子，单改到了该在的脸上。",
      },
      {
        label: "说是{$b}当时同意的",
        when: [{ present: "$b" }],
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: -6 },
          { bond: ["$a", "$b"], delta: -10 },
          { remember: { holder: "$a", act: "leaked", valence: -2, subject: "$b" } },
          { remember: { holder: "$b", act: "public-shame", valence: -2, subject: "player" } },
        ],
        result: "两个人当着你的面裂开。退货还在，责任被你推到了他们中间。",
      },
      {
        label: "把{$b}约来自己说",
        when: [{ absent: "$b" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$b", inDays: 1, slot: 1, bring: ["$a"] } },
          { bond: ["$a", "$b"], delta: -3 },
        ],
        result: "人还没对上。{$a}肯等一天，等的是你没有再替谁做主。",
      },
      {
        label: "限制写进小票再退",
        when: [{ temper: "$a", is: "loyal" }],
        effects: [
          { opinion: "$a", delta: 6 },
          { bond: ["$a", "$b"], delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "念旧的人要的是同一句话还在。退了，她还肯把下一句留给你。",
      },
    ],
  },

  // —— 楼层小事 ——

  {
    id: "floor-swept-sample",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "mall" }, { temper: "$self", is: "gossip" }] },
      b: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "proud" }, { temper: "$self", is: "hasty" }] },
    },
    when: [{ role: "$a", is: "mall" }],
    weight: 4, tension: 0, cooldown: 4,
    text: "{$a}捡到一只没封口的小样，问这算客人落下的，还是算柜上的空位。{$b}在旁边等你一句话。",
    choices: [
      {
        label: "算落物，交回去",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "price-plain", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "袋子回到该在的地方。{$a}有一句能交差的，{$b}没有多一个赠品缺口。",
      },
      {
        label: "塞进今天的赠品",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: -4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "leaked", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "price-pad", valence: -1, subject: "player" } },
        ],
        result: "数好看一点。扫地的人看见了，这句她会说给同层的人。",
      },
      {
        label: "先问{$b}，别当着{$a}定",
        when: [{ temper: "$b", is: "face" }],
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: 1 },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "柜上的面子留着。{$a}少了一句今天就能传的。",
      },
    ],
  },
  {
    id: "floor-door",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "mall" }, { temper: "$self", is: "loyal" }, { temper: "$self", is: "wary" }] },
      b: { where: [{ role: "$self", is: "customer" }, { temper: "$self", is: "hasty" }] },
    },
    when: [{ role: "$a", is: "mall" }],
    weight: 4, tension: 1, cooldown: 3,
    text: "{$b}卡在门口，{$a}的手按在对讲机上。他等你说：要人，还是要这扇门安静。",
    choices: [
      {
        label: "你自己出去接",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1, subject: "player" } },
          { stat: "energy", delta: -1 },
        ],
        result: "门没有变成柜台。{$b}进来了，{$a}不用替你说话。",
      },
      {
        label: "让{$a}把人请走",
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: -6 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$b", act: "crowded", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
          { leave: "$b" },
        ],
        result: "保安替你做了拒绝。{$b}记住的是这扇门，不是你的判断。",
      },
      {
        label: "请{$b}等两分钟，你去跟{$a}说清",
        when: [{ bond: ["$a", "$b"], gte: 10 }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 1 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "他们本来认识。你把规则说给门口，没有把人推回去。",
      },
    ],
  },
  {
    id: "floor-atrium-quota",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "mall" }, { temper: "$self", is: "hasty" }, { temper: "$self", is: "face" }] },
      b: { where: [{ role: "$self", is: "staff" }] },
    },
    when: [{ slot: [0, 1] }],
    weight: 4, tension: 0, cooldown: 4,
    text: "{$a}拿着中庭的活动单。这一小时要一个人，柜上{$b}还在，她问你空不空得出来。",
    choices: [
      {
        label: "你去，柜留给{$b}",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { stat: "energy", delta: -1 },
        ],
        result: "中庭有人。柜上的名字是{$b}，回来你得认。",
      },
      {
        label: "柜上不能空，活动你去回",
        effects: [
          { opinion: "$a", delta: -5 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "{$a}要自己去跟楼层解释。下次活动单不会先送到你手上。",
      },
      {
        label: "两人错开，先跟{$a}说谁留下",
        when: [{ bond: ["$a", "$b"], gte: 10 }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "楼层和柜上都有名字。没有人被临时抛下。",
      },
    ],
  },
  {
    id: "floor-intern-repeats",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "shy" }, { temper: "$self", is: "loyal" }] },
      b: { where: [{ role: "$self", is: "customer" }] },
    },
    when: [{ day: { gte: 8 } }],
    weight: 5, tension: 1, cooldown: 4,
    text: "{$a}把你上午那句原样说给{$b}。客人已经皱眉，她还在等你点头。",
    choices: [
      {
        label: "私下拦，让她换一句",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "错句没有落地。{$a}记下的是你拦的方式，不是那句本身。",
      },
      {
        label: "当着{$b}说她学错了",
        when: [{ temper: "$b", is: "face" }],
        effects: [
          { opinion: "$a", delta: -8 }, { opinion: "$b", delta: -4 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$a", act: "public-shame", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "copied-line", valence: -1, subject: "player" } },
        ],
        result: "客人要面子，新人也要。两个人都记住你是当众说的。",
      },
      {
        label: "让她自己把这句说完",
        effects: [
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: -5 },
          { remember: { holder: "$a", act: "copied-line", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "hard-sell", valence: -2, subject: "player" } },
        ],
        result: "句子进了{$b}的耳朵。错记在你名下，{$a}下次还会这么说。",
      },
    ],
  },
  {
    id: "floor-folder",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "wary" }, { temper: "$self", is: "loyal" }] },
    },
    when: [{ role: "$a", is: "staff" }],
    weight: 5, tension: 1, cooldown: 5,
    text: "{$a}把赠品那一行转过来。空着。她问这行写谁的原话，不写态度。",
    choices: [
      {
        label: "写你自己看见的",
        effects: [
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { remember: { holder: "suman", act: "kept-word", valence: 0, subject: "player" } },
        ],
        result: "文件夹收下这句。谁的缺口还在原处，没有被你写到别人头上。",
      },
      {
        label: "写成同事忙忘了",
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "suman", delta: -8 },
          { bond: ["fangmin", "suman"], delta: -8 },
          { remember: { holder: "$a", act: "named-colleague", valence: -2, subject: "suman" } },
          { remember: { holder: "suman", act: "named-colleague", valence: -2, subject: "player" } },
        ],
        result: "记录对她有用。被点到的人今天不在这个点，话已经进了文件夹。",
      },
      {
        label: "这行先空着",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "空行还是空的。她记下你不愿意写原话。",
      },
    ],
  },
  {
    id: "floor-board",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "proud" }, { temper: "$self", is: "hasty" }] },
      b: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "proud" }, { temper: "$self", is: "loyal" }] },
    },
    when: [{ slot: [0, 1] }],
    weight: 4, tension: 0, cooldown: 4,
    text: "{$a}把晚班的空格推到你面前。{$b}还没来，格子上已经有人想写自己的名字。",
    choices: [
      {
        label: "晚班留给{$b}一整天",
        effects: [
          { opinion: "$b", delta: 6 }, { opinion: "$a", delta: -2 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$b", act: "fair-split", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { appoint: { person: "$b", inDays: 1, slot: 2 } },
        ],
        result: "同期看见格子是满的，而且不是你一个人的。她会把下一句提前告诉你。",
      },
      {
        label: "黄金档写你自己",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -5 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$b", act: "took-order", valence: -1, subject: "player" } },
        ],
        result: "数会好看。{$b}看表，不提醒你门口那辆不属于商场的车。",
      },
      {
        label: "先问{$a}这格算不算数",
        when: [{ opinion: "$a", gte: 5 }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "柜长要的是格子有人。你问过再写，两个人都还在这张表上。",
      },
    ],
  },
  {
    id: "floor-drawer-favor",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "proud" }, { temper: "$self", is: "loyal" }] },
    },
    when: [{ slot: [2, 3] }],
    weight: 4, tension: 1, cooldown: 4,
    text: "{$a}的抽屉和你的并着。她说有一支断了，问你今晚告不告诉她是谁退的。",
    choices: [
      {
        label: "告诉她谁退了",
        effects: [
          { opinion: "$a", delta: 6 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 2 } },
        ],
        result: "她肯把下一支放到你这边。条件是这句你没有留到以后。",
      },
      {
        label: "退货的名字你不说",
        effects: [
          { opinion: "$a", delta: -5 },
          { remember: { holder: "$a", act: "broke-word", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
        ],
        result: "客人的名字留下了。她下次断货，不会再把自己的一支放过来。",
      },
      {
        label: "只说色号，不说是谁",
        when: [{ opinion: "$a", gte: 0 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "货的事她知道了。人的事没有出门，她记你一笔，不多。",
      },
    ],
  },
  {
    id: "floor-mother-watches",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "mall" }, { temper: "$self", is: "warm" }, { temper: "$self", is: "gossip" }] },
      b: { where: [{ bond: ["$a", "$self"], kind: "family" }] },
    },
    when: [{ bond: ["$a", "$b"], kind: "family" }, { slot: [3] }],
    weight: 5, tension: -1, cooldown: 5,
    text: "{$a}的车就停在通道口。{$b}第一次自己站到镜子前，颈上还挂着后勤的绳子。",
    choices: [
      {
        label: "退开，让{$b}把看看说完",
        effects: [
          { opinion: "$b", delta: 7 }, { opinion: "$a", delta: 5 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$b", act: "stood-aside", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "母亲看见你没有围。她会把这句说给后勤那头，女儿自己还肯再来。",
      },
      {
        label: "照常推",
        effects: [
          { opinion: "$b", delta: -7 }, { opinion: "$a", delta: -6 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$b", act: "crowded", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "talked-down", valence: -1, subject: "$b" } },
          { leave: "$b" },
        ],
        result: "{$b}走了。{$a}打扫到这层的时候，不会再把人往你这边指。",
      },
      {
        label: "先跟{$a}说今天不围",
        when: [{ temper: "$b", is: "shy" }],
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 5 },
          { bond: ["$a", "$b"], delta: 6 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
        ],
        result: "怕被围的人听见你跟她妈说了。这单可以很小，人会留下。",
      },
    ],
  },
  {
    id: "floor-region-walks",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "staff" }, { temper: "$self", is: "wary" }, { temper: "$self", is: "face" }] },
      b: { where: [{ role: "$self", is: "mall" }, { temper: "$self", is: "face" }, { temper: "$self", is: "hasty" }] },
    },
    when: [{ day: { gte: 12 } }],
    weight: 5, tension: 0, cooldown: 6,
    text: "{$a}停在入口，不进柜。她只问{$b}一句：晚班现在是谁在看。",
    choices: [
      {
        label: "说晚班你自己看",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
          { bond: ["$a", "$b"], delta: 2 },
        ],
        result: "她没有进柜。楼层经理听见的名字，和你之后要守的班是同一个。",
      },
      {
        label: "把名字让给同事",
        effects: [
          { opinion: "$a", delta: -2 }, { opinion: "suman", delta: 3 }, { opinion: "tangke", delta: -2 },
          { remember: { holder: "$a", act: "yielded-client", valence: 0, subject: "player" } },
          { bond: ["peilan", "suman"], delta: 4 },
        ],
        result: "她记下的不是你。被让到的人没有被问过，下一季的表上会先出现她。",
      },
      {
        label: "说今天的原话在记录里",
        when: [{ remembers: "fangmin", act: "same-as-record" }],
        effects: [
          { opinion: "$a", delta: 6 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { bond: ["peilan", "fangmin"], delta: 3 },
        ],
        result: "她要的是对得上的句子。记录在，她这一趟不再多问。",
      },
    ],
  },
  {
    id: "floor-lights",
    kind: "floor",
    cast: {
      a: { where: [{ role: "$self", is: "mall" }, { temper: "$self", is: "warm" }] },
      b: { where: [{ role: "$self", is: "mall" }, { temper: "$self", is: "hasty" }] },
    },
    when: [{ slot: [3] }],
    weight: 3, tension: -1, cooldown: 4,
    text: "灯该收了。{$a}在等地面空出来，{$b}还拿着没签完的活动单。",
    choices: [
      {
        label: "先收灯，单明天早上签",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
          { appoint: { person: "$b", inDays: 1, slot: 0 } },
        ],
        result: "地面能拖了。活动单留到早上，{$b}会来要一个名字。",
      },
      {
        label: "灯先开着，把单签了",
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -4 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
          { stat: "energy", delta: -1 },
        ],
        result: "楼层的单完了。扫地的人多等了一截，明天她不一定还替你看着落物。",
      },
      {
        label: "两人一起收，单只签到货的那行",
        when: [{ bond: ["$a", "$b"], gte: 0 }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "晚班没有只顾一头。她们之间那点冷淡，今晚没有再加。",
      },
    ],
  },

  // —— 个人线：沈薇。落点看你怎么待她，也看米朵和唐糖怎么看你 ——

  {
    id: "arc-shen-team",
    kind: "arc",
    cast: {
      a: shen,
      b: { where: [{ bond: ["$self", "shen"], kind: "fan" }] },
    },
    when: [{ not: { quality: "arc:shen", gte: 1 } }],
    weight: 8, tension: 0, once: true,
    text: "{$a}把{$b}带进镜子。她说团队要同一句，{$b}的脸还没被你看过。",
    choices: [
      {
        label: "分开说，两张脸不是一套",
        effects: [
          { quality: "arc:shen", set: 1 },
          { opinion: "$a", delta: 8 }, { opinion: "$b", delta: 4 },
          { bond: ["$a", "$b"], delta: 5 },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "shen", act: "not-my-return", valence: 1, subject: "player" } },
        ],
        result: "{$a}肯把退货那件事留到以后说。{$b}知道自己不会被化成别人。",
      },
      {
        label: "按团队一套开",
        effects: [
          { quality: "arc:shen", set: 1 },
          { opinion: "$a", delta: -6 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "hard-sell", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "hard-sell", valence: -1, subject: "player" } },
        ],
        result: "数是一套的。{$a}觉得你没听，{$b}会把这句带回去。",
      },
      {
        label: "先问{$b}，让{$a}等",
        when: [{ temper: "$b", is: "hasty" }],
        effects: [
          { quality: "arc:shen", set: 1 },
          { opinion: "$b", delta: 6 }, { opinion: "$a", delta: -3 },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "急性子的队员先说完了。{$a}记住你让她等，团队的下一句还没给。",
      },
    ],
  },
  {
    id: "arc-shen-camera",
    kind: "arc",
    cast: {
      a: shen,
      b: { where: [{ bond: ["$self", "shen"], kind: "fan" }, { temper: "$self", is: "gossip" }] },
    },
    when: [{ quality: "arc:shen", gte: 1 }, { not: { quality: "arc:shen", gte: 2 } }],
    weight: 8, tension: 1, once: true,
    text: "{$b}把灯架在镜边，要你说两周能看出来。{$a}在旁边，不准备出镜。",
    choices: [
      {
        label: "镜头里只说备案里有的",
        effects: [
          { quality: "arc:shen", set: 2 }, { appoint: { person: "shen", inDays: 3, slot: 1, bring: ["tangtang"] } },
          { opinion: "$b", delta: -4 }, { opinion: "$a", delta: 6 },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { bond: ["$a", "$b"], delta: 3 },
        ],
        result: "完播会掉。{$a}听见你没有说满，她还把人放在你这边。",
      },
      {
        label: "顺着说两周能看出来",
        effects: [
          { quality: "arc:shen", set: 2 }, { appoint: { person: "shen", inDays: 3, slot: 1, bring: ["tangtang"] } },
          { opinion: "$b", delta: 8 }, { opinion: "$a", delta: -8 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "hard-sell", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "on-camera", valence: 1, subject: "player" } },
        ],
        result: "切片当晚就能用。{$a}不会再让团队的下一句经过这面镜子。",
      },
      {
        label: "灯偏开，修护只留给{$b}本人",
        effects: [
          { quality: "arc:shen", set: 2 }, { appoint: { person: "shen", inDays: 3, slot: 1, bring: ["tangtang"] } },
          { opinion: "$b", delta: -3 }, { opinion: "$a", delta: 4 },
          { remember: { holder: "$b", act: "off-camera", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { bond: ["$b", "$a"], delta: 2 },
        ],
        result: "灯还在，脸不在句子里。{$b}冷一点，{$a}没有被你拖进画面。",
      },
    ],
  },
  {
    id: "arc-shen-copy",
    kind: "arc",
    cast: {
      a: shen,
      b: { where: [{ bond: ["$self", "shen"], kind: "fan" }, { temper: "$self", is: "face" }] },
    },
    when: [{ quality: "arc:shen", gte: 2 }, { not: { quality: "arc:shen", gte: 3 } }],
    weight: 8, tension: 1, once: true,
    text: "{$b}要复刻{$a}上次的妆。她两颊是红的，{$a}说你记得。",
    choices: [
      {
        label: "说明不能复刻",
        effects: [
          { quality: "arc:shen", set: 3 },
          { opinion: "$b", delta: -3 }, { opinion: "$a", delta: 8 },
          { bond: ["$a", "$b"], delta: 6 },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
        ],
        result: "{$b}当场没化成一样。{$a}不取消下一句，也不加单。",
      },
      {
        label: "按上次的妆给她",
        effects: [
          { quality: "arc:shen", set: 3 },
          { opinion: "$b", delta: 6 }, { opinion: "$a", delta: -6 },
          { bond: ["$a", "$b"], delta: -12 },
          { remember: { holder: "$a", act: "hard-sell", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "copied-line", valence: -1, subject: "player" } },
        ],
        result: "看起来像了。{$a}当晚就会停掉团队的下一批。",
      },
      {
        label: "让{$a}自己看{$b}的脸",
        effects: [
          { quality: "arc:shen", set: 3 },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "决定是{$a}做的。你没有替她们把两张脸并成一句。",
      },
    ],
  },
  {
    id: "arc-shen-end",
    kind: "arc",
    cast: { a: shen },
    when: [{ quality: "arc:shen", gte: 3 }, { not: { quality: "arc:shen:end", gte: 1 } }],
    weight: 8, tension: -1, once: true,
    text: "{$a}一个人来。团队的下一句给不给你，她说看米朵和唐糖回来怎么讲你。",
    choices: [
      {
        label: "团队还把人交给你",
        when: [{ opinion: "shen", gte: 8 }, { opinion: "tangtang", gte: 0 }, { not: { remembers: "shen", act: "hard-sell", valence: "bad" } }],
        effects: [
          { quality: "arc:shen:end", set: 1 },
          { opinion: "$a", delta: 6 },
          { bond: ["shen", "miduo"], delta: 4 },
          { appoint: { person: "tangtang", inDays: 4, slot: 2, bring: ["shen"] } },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "下一句还经过你。唐糖会跟着来，来的不是复刻。",
      },
      {
        label: "下一批取消",
        when: [{ remembers: "shen", act: "hard-sell", valence: "bad" }],
        effects: [
          { quality: "arc:shen:end", set: 2 },
          { opinion: "$a", delta: -6 },
          { bond: ["shen", "miduo"], delta: -6 },
          { bond: ["shen", "tangtang"], delta: -4 },
          { remember: { holder: "$a", act: "broke-word", valence: -2, subject: "player" } },
          { leave: "$a" },
        ],
        result: "她不取消你这个人，取消的是团队还来这面镜子。",
      },
      {
        label: "米朵还来，她不来",
        when: [{ opinion: "miduo", gte: 6 }, { opinion: "shen", lte: 4 }],
        effects: [
          { quality: "arc:shen:end", set: 3 },
          { opinion: "miduo", delta: 3 }, { opinion: "$a", delta: -3 },
          { appoint: { person: "miduo", inDays: 3, slot: 2 } },
          { remember: { holder: "miduo", act: "brought-friend", valence: 0, subject: "player" } },
        ],
        result: "灯还会来。指定你的人换成了拿灯的那个，不是{$a}。",
      },
      {
        label: "这单做完，不约下次",
        effects: [
          { quality: "arc:shen:end", set: 4 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
        ],
        result: "没有承诺。她走的时候没有把下一个人的名字留下。",
      },
    ],
  },

  // —— 个人线：安姐 ——

  {
    id: "arc-anjie-risk",
    kind: "arc",
    cast: {
      a: anjie,
      b: suman,
    },
    when: [{ not: { quality: "arc:anjie", gte: 1 } }],
    weight: 8, tension: 0, once: true,
    text: "{$b}把{$a}让到你这边。婚礼前的脸是红的，{$a}说这套不能出错。",
    choices: [
      {
        label: "先说泛红，不换全套",
        effects: [
          { quality: "arc:anjie", set: 1 }, { appoint: { person: "anjie", inDays: 3, slot: 1, bring: ["liangxia"] } },
          { opinion: "$a", delta: 8 }, { opinion: "$b", delta: 4 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "{$b}的老客还在这个柜。{$a}敢把后面的人交给你，是从这句开始的。",
      },
      {
        label: "推全套",
        effects: [
          { quality: "arc:anjie", set: 1 }, { appoint: { person: "anjie", inDays: 3, slot: 1, bring: ["liangxia"] } },
          { opinion: "$a", delta: -8 }, { opinion: "$b", delta: -4 },
          { bond: ["$a", "$b"], delta: -10 },
          { remember: { holder: "$a", act: "hard-sell", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "客单好看。{$b}不会再把这种错不起的人往你凳子上让。",
      },
      {
        label: "请{$b}先说一句",
        effects: [
          { quality: "arc:anjie", set: 1 }, { appoint: { person: "anjie", inDays: 3, slot: 1, bring: ["liangxia"] } },
          { opinion: "$b", delta: 6 }, { opinion: "$a", delta: 4 },
          { bond: ["$a", "$b"], delta: 5 },
          { remember: { holder: "$b", act: "kept-word", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "第一句是认识她的人说的。你接的是后面的判断，不是抢来的坐下。",
      },
    ],
  },
  {
    id: "arc-anjie-camera",
    kind: "arc",
    cast: {
      a: anjie,
      b: { where: [{ bond: ["anjie", "$self"], kind: "friend", gte: 70 }] },
    },
    when: [{ quality: "arc:anjie", gte: 1 }, { not: { quality: "arc:anjie", gte: 2 } }],
    weight: 8, tension: 1, once: true,
    text: "{$b}进门就把手机按住。{$a}不在句子里，交代只有一句：别再上镜。",
    choices: [
      {
        label: "放下手机，按上班八小时看",
        effects: [
          { quality: "arc:anjie", set: 2 }, { appoint: { person: "anjie", inDays: 3, slot: 1, bring: ["baijie"] } },
          { opinion: "$b", delta: 8 }, { opinion: "$a", delta: 6 },
          { bond: ["$a", "$b"], delta: 5 },
          { remember: { holder: "$b", act: "off-camera", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "伴娘没有被拍。{$a}的指定还在你这里，不回到别人手里。",
      },
      {
        label: "让{$b}出镜",
        effects: [
          { quality: "arc:anjie", set: 2 }, { appoint: { person: "anjie", inDays: 3, slot: 1, bring: ["baijie"] } },
          { opinion: "$b", delta: -10 }, { opinion: "$a", delta: -12 },
          { bond: ["$a", "suman"], delta: -8 },
          { remember: { holder: "$b", act: "on-camera", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "on-camera", valence: -2, subject: "$b" } },
          { remember: { holder: "suman", act: "broke-word", valence: -2, subject: "player" } },
        ],
        result: "{$a}不会发消息给你。她发给还肯听那句交代的人。",
      },
      {
        label: "只拍产品，不拍脸",
        effects: [
          { quality: "arc:anjie", set: 2 }, { appoint: { person: "anjie", inDays: 3, slot: 1, bring: ["baijie"] } },
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: 3 },
          { remember: { holder: "$b", act: "off-camera", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "灯可以留着。脸不在画面里，交代算你听到了。",
      },
    ],
  },
  {
    id: "arc-anjie-artist",
    kind: "arc",
    cast: {
      a: anjie,
      b: { where: [{ bond: ["$self", "anjie"], kind: "client" }, { temper: "$self", is: "hasty" }] },
    },
    when: [{ quality: "arc:anjie", gte: 2 }, { not: { quality: "arc:anjie", gte: 3 } }],
    weight: 8, tension: 1, once: true,
    text: "{$b}把工具包放在凳边，问的是色号，不是四支一样的货。抽屉今天只够先开一边。",
    choices: [
      {
        label: "色号分开答，不把她当囤货",
        effects: [
          { quality: "arc:anjie", set: 3 },
          { opinion: "$b", delta: 8 }, { opinion: "$a", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$b", act: "honest-advice", valence: 2, subject: "player" } },
        ],
        result: "{$b}会再带一个唇周干的人来。那是案例，不是清库存。",
      },
      {
        label: "按四支一样的开",
        effects: [
          { quality: "arc:anjie", set: 3 },
          { opinion: "$b", delta: -10 }, { opinion: "$a", delta: -4 },
          { bond: ["$b", "songjie"], delta: -6 },
          { remember: { holder: "$b", act: "hard-sell", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "包很大，单像代购。{$b}不再把台上换人的问题带给你。",
      },
      {
        label: "今天先开{$a}这边",
        effects: [
          { quality: "arc:anjie", set: 3 },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
          { appoint: { person: "$b", inDays: 2, slot: 0 } },
        ],
        result: "婚礼这边先保住。跟妆的人记下你选了谁，下次她自己排时间。",
      },
    ],
  },
  {
    id: "arc-anjie-end",
    kind: "arc",
    cast: { a: anjie },
    when: [{ quality: "arc:anjie", gte: 3 }, { not: { quality: "arc:anjie:end", gte: 1 } }],
    weight: 8, tension: -1, once: true,
    text: "{$a}不复盘婚礼。她只问一句：后面的人，还交不交给你。",
    choices: [
      {
        label: "她还指定你",
        when: [{ opinion: "anjie", gte: 12 }, { not: { remembers: "anjie", act: "on-camera", valence: "bad" } }],
        effects: [
          { quality: "arc:anjie:end", set: 1 },
          { opinion: "$a", delta: 5 },
          { bond: ["anjie", "suman"], delta: 3 },
          { appoint: { person: "liangxia", inDays: 5, slot: 1 } },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "指定还在你名下。伴娘若再来，找的是你，不是「这个柜」。",
      },
      {
        label: "指定回到苏蔓",
        when: [{ any: [{ remembers: "anjie", act: "on-camera", valence: "bad" }, { opinion: "anjie", lte: -4 }] }],
        effects: [
          { quality: "arc:anjie:end", set: 2 },
          { opinion: "$a", delta: -4 }, { opinion: "suman", delta: 4 },
          { bond: ["anjie", "suman"], delta: 8 },
          { remember: { holder: "suman", act: "took-client", valence: 1, subject: "anjie" } },
          { leave: "$a" },
        ],
        result: "名字跟着苏蔓走。你这边的镜子，她不再指定。",
      },
      {
        label: "白姐不再带案例",
        when: [{ opinion: "baijie", lte: -4 }],
        effects: [
          { quality: "arc:anjie:end", set: 3 },
          { opinion: "baijie", delta: -3 }, { opinion: "$a", delta: -2 },
          { bond: ["baijie", "anjie"], delta: -4 },
          { remember: { holder: "baijie", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "婚礼的人还可以来。台上那些换人的问题，不会再经过你。",
      },
      {
        label: "这单结束，谁也不交",
        effects: [
          { quality: "arc:anjie:end", set: 4 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
        ],
        result: "婚礼过去了。没有人被你推开，也没有下一句被留下。",
      },
    ],
  },

  // —— 个人线：陆遥 ——

  {
    id: "arc-luyao-snatch",
    kind: "arc",
    cast: {
      a: luyao,
      b: { where: [{ role: "$self", is: "customer" }] },
    },
    when: [{ not: { quality: "arc:luyao", gte: 1 } }],
    weight: 8, tension: 1, once: true,
    text: "{$a}只问一句，人还在你凳子上。{$b}看着你们两个的工牌。",
    choices: [
      {
        label: "把区别说清，不抢她的句子",
        effects: [
          { quality: "arc:luyao", set: 1 },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: -2 },
          { remember: { holder: "$a", act: "no-snatch", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "她没截成。她厌烦的那个词，这一次没有被你按回去。",
      },
      {
        label: "当着{$b}压过她",
        effects: [
          { quality: "arc:luyao", set: 1 },
          { opinion: "$a", delta: -10 }, { opinion: "$b", delta: -3 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
        ],
        result: "人留下了。{$a}记住你用的还是她被写进评价的那个办法。",
      },
      {
        label: "把人让给她",
        effects: [
          { quality: "arc:luyao", set: 1 },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -4 },
          { bond: ["$a", "$b"], delta: 6 },
          { remember: { holder: "$a", act: "yielded-client", valence: 1, subject: "player" } },
          { leave: "$b" },
        ],
        result: "今天这单不是你的。她没有谢你，只是下次会先说一声。",
      },
    ],
  },
  {
    id: "arc-luyao-warn",
    kind: "arc",
    cast: { a: luyao },
    when: [{ quality: "arc:luyao", gte: 1 }, { not: { quality: "arc:luyao", gte: 2 } }],
    weight: 8, tension: 0, once: true,
    text: "{$a}在通道里拦住你。她说有一句别在灯前面讲，讲完她不等你回答。",
    choices: [
      {
        label: "那句不说",
        effects: [
          { quality: "arc:luyao", set: 2 },
          { opinion: "$a", delta: 8 },
          { remember: { holder: "$a", act: "kept-warning", valence: 2, subject: "player" } },
          { bond: ["luyao", "roman"], delta: 2 },
        ],
        result: "她把「能截」换成了提前说。这句你若守住，她调过来之后还肯先开口。",
      },
      {
        label: "你还是说了",
        effects: [
          { quality: "arc:luyao", set: 2 },
          { opinion: "$a", delta: -12 },
          { remember: { holder: "$a", act: "broke-warning", valence: -2, subject: "player" } },
        ],
        result: "切片可以是别人的。她不再提前告诉你任何一句。",
      },
      {
        label: "问她这句是替谁留的",
        effects: [
          { quality: "arc:luyao", set: 2 },
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "她不回答。你问了，她知道你没有把这句当成她的示弱。",
      },
    ],
  },
  {
    id: "arc-luyao-badge",
    kind: "arc",
    cast: {
      a: luyao,
      b: { where: [{ bond: ["luyao", "$self"], kind: "client", gte: 20 }] },
    },
    when: [{ quality: "arc:luyao", gte: 2 }, { not: { quality: "arc:luyao", gte: 3 } }],
    weight: 8, tension: 1, once: true,
    text: "{$b}找{$a}。工牌还没换完，人已经站在你们这边。今天这单写谁的名字，要你开口。",
    choices: [
      {
        label: "先不开进你名下",
        effects: [
          { quality: "arc:luyao", set: 3 },
          { opinion: "$a", delta: 8 }, { opinion: "$b", delta: 4 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "yielded-client", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "今天你没有这笔。{$b}以后回来找的是她，她还肯跟你商量这个人。",
      },
      {
        label: "开成你的",
        effects: [
          { quality: "arc:luyao", set: 3 },
          { opinion: "$a", delta: -10 }, { opinion: "$b", delta: -2 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "took-order", valence: -1, subject: "player" } },
        ],
        result: "数进了你的。工牌换完那天，复购不会经过你。",
      },
      {
        label: "等工牌换完再开",
        effects: [
          { quality: "arc:luyao", set: 3 },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 2 },
          { appoint: { person: "$b", inDays: 2, slot: 1, bring: ["$a"] } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "今天谁也没有这单。她们会一起回来，名字等到牌换完。",
      },
    ],
  },
  {
    id: "arc-luyao-end",
    kind: "arc",
    cast: { a: luyao },
    when: [{ quality: "arc:luyao", gte: 3 }, { not: { quality: "arc:luyao:end", gte: 1 } }],
    weight: 8, tension: -1, once: true,
    text: "{$a}不跟你说以后。她只问晚班还争不争，争之前她还告不告诉你。",
    choices: [
      {
        label: "同班，各看一边",
        when: [{ opinion: "luyao", gte: 12 }, { remembers: "luyao", act: "kept-warning" }, { not: { remembers: "luyao", act: "took-client", valence: "bad" } }],
        effects: [
          { quality: "arc:luyao:end", set: 1 },
          { opinion: "$a", delta: 5 },
          { bond: ["luyao", "roman"], delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { appoint: { person: "$a", inDays: 2, slot: 2 } },
        ],
        result: "晚班你们各看一边。她还是会争，争之前会先说一声。",
      },
      {
        label: "她拿走柜上的位置，你还在镜前",
        when: [{ remembers: "luyao", act: "took-client", valence: "bad" }],
        effects: [
          { quality: "arc:luyao:end", set: 2 },
          { opinion: "$a", delta: -2 }, { opinion: "roman", delta: -2 },
          { bond: ["luyao", "roman"], delta: 4 },
          { remember: { holder: "$a", act: "took-order", valence: -1, subject: "player" } },
        ],
        result: "位置可以是她的。你还站这面镜子，她不再把老客的事跟你商量。",
      },
      {
        label: "她问你去不去对面",
        when: [{ remembers: "luyao", act: "kept-warning" }, { opinion: "luyao", gte: 8 }, { not: { remembers: "luyao", act: "took-client", valence: "bad" } }],
        effects: [
          { quality: "arc:luyao:end", set: 3 },
          { opinion: "$a", delta: 4 },
          { bond: ["luyao", "shen"], delta: -2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 3, slot: 3 } },
        ],
        result: "对面那一米她开口了。去不去是下一句的事，这句她没有拿你的客去换。",
      },
      {
        label: "她仍只在对面截",
        effects: [
          { quality: "arc:luyao:end", set: 4 },
          { opinion: "$a", delta: -3 },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "评价栏上还是那两个字。她不告诉你下一句，你也不欠她一个位置。",
      },
    ],
  },

  // —— 个人线：苏蔓 ——

  {
    id: "arc-suman-gap",
    kind: "arc",
    cast: { a: suman },
    when: [{ not: { quality: "arc:suman", gte: 1 } }],
    weight: 8, tension: 1, once: true,
    text: "{$a}说赠品那行空了，让你记到刚才的单上。她是把老客交给你的人。",
    choices: [
      {
        label: "你补上，写明是你补的",
        effects: [
          { quality: "arc:suman", set: 1 },
          { opinion: "$a", delta: 6 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "covered-gap", valence: 1, subject: "player" } },
          { remember: { holder: "fangmin", act: "same-as-record", valence: 0, subject: "player" } },
        ],
        result: "她欠你一次。档案里这行是你的字，不是一笔说不清的空。",
      },
      {
        label: "不补",
        effects: [
          { quality: "arc:suman", set: 1 },
          { opinion: "$a", delta: -5 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "refused-gap", valence: -1, subject: "player" } },
        ],
        result: "记录干净。她不再把你当成可以交代一句的人。",
      },
      {
        label: "当着人点她的名字",
        effects: [
          { quality: "arc:suman", set: 1 },
          { opinion: "$a", delta: -14 },
          { bond: ["suman", "fangmin"], delta: -12 },
          { remember: { holder: "$a", act: "named-colleague", valence: -2, subject: "player" } },
          { remember: { holder: "fangmin", act: "named-colleague", valence: -2, subject: "suman" } },
        ],
        result: "文件夹有用了。她不吵。老客也不会再从她手里交到你手里。",
      },
    ],
  },
  {
    id: "arc-suman-word",
    kind: "arc",
    cast: {
      a: suman,
      b: { where: [{ bond: ["$self", "suman"], kind: "mentor" }, { temper: "$self", is: "shy" }] },
    },
    when: [{ quality: "arc:suman", gte: 1 }, { not: { quality: "arc:suman", gte: 2 } }],
    weight: 8, tension: 0, once: true,
    text: "{$a}把一句交代给你：有人进门，让她先坐，{$b}不能先开口。",
    choices: [
      {
        label: "你自己记住",
        effects: [
          { quality: "arc:suman", set: 2 },
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: 1 },
          { bond: ["suman", "anjie"], delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "这句话没有交给第二张嘴。她还肯把下一位老客的名字告诉你。",
      },
      {
        label: "交给{$b}去说",
        effects: [
          { quality: "arc:suman", set: 2 },
          { opinion: "$a", delta: -8 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "broke-word", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "copied-line", valence: -1, subject: "player" } },
        ],
        result: "{$b}会背。背错的时候，{$a}算的是你没把交代留在自己身上。",
      },
      {
        label: "问她这句能不能让{$b}听见",
        when: [{ opinion: "$a", gte: 8 }],
        effects: [
          { quality: "arc:suman", set: 2 },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
        ],
        result: "她自己决定{$b}听不听。你没有把老客的交代当成教材。",
      },
    ],
  },
  {
    id: "arc-suman-clash",
    kind: "arc",
    cast: {
      a: suman,
      b: { where: [{ bond: ["$self", "suman"], kind: "colleague" }, { temper: "$self", is: "proud" }, { temper: "$self", is: "loyal" }] },
      c: { where: [{ role: "$self", is: "customer" }] },
    },
    when: [{ quality: "arc:suman", gte: 2 }, { not: { quality: "arc:suman", gte: 3 } }],
    weight: 8, tension: 1, once: true,
    text: "{$c}先问过{$b}。{$a}的老客档和这单撞在一起，名字还空着。",
    choices: [
      {
        label: "单记{$b}",
        effects: [
          { quality: "arc:suman", set: 3 },
          { opinion: "$b", delta: 8 }, { opinion: "$a", delta: 3 }, { opinion: "$c", delta: 2 },
          { bond: ["$a", "$b"], delta: 6 },
          { remember: { holder: "$b", act: "fair-split", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "名字是先问过的人。{$a}没有丢老客，{$b}晚上还肯把断的色号告诉你。",
      },
      {
        label: "记成你自己的",
        effects: [
          { quality: "arc:suman", set: 3 },
          { opinion: "$b", delta: -8 }, { opinion: "$a", delta: -5 },
          { bond: ["$a", "$b"], delta: -8 },
          { remember: { holder: "$b", act: "took-order", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "took-client", valence: -1, subject: "player" } },
        ],
        result: "两个人都少了一句肯提前告诉你的话。客人不关心名字，同事关心。",
      },
      {
        label: "问{$c}今天认谁",
        effects: [
          { quality: "arc:suman", set: 3 },
          { opinion: "$c", delta: 5 }, { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { remember: { holder: "$c", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "名字按客人的嘴。{$a}和{$b}都没法说你私自写了谁。",
      },
    ],
  },
  {
    id: "arc-suman-end",
    kind: "arc",
    cast: { a: suman },
    when: [{ quality: "arc:suman", gte: 3 }, { not: { quality: "arc:suman:end", gte: 1 } }],
    weight: 8, tension: -1, once: true,
    text: "{$a}不谈柜长。她只说老客还交不交，交的话人留在哪一张镜子前。",
    choices: [
      {
        label: "老客留在这个柜",
        when: [{ opinion: "suman", gte: 12 }, { not: { remembers: "suman", act: "named-colleague", valence: "bad" } }],
        effects: [
          { quality: "arc:suman:end", set: 1 },
          { opinion: "$a", delta: 5 },
          { bond: ["suman", "anjie"], delta: 4 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { appoint: { person: "dongayi", inDays: 3, slot: 1 } },
        ],
        result: "她不拦你。认她的人还来这三米，下一句她可以交给你。",
      },
      {
        label: "她调走，名字跟着走",
        when: [{ any: [{ remembers: "suman", act: "named-colleague", valence: "bad" }, { opinion: "suman", lte: 0 }] }],
        effects: [
          { quality: "arc:suman:end", set: 2 },
          { opinion: "$a", delta: -4 },
          { bond: ["suman", "anjie"], delta: 6 },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
          { appoint: { person: "$a", inDays: 6, slot: 1 } },
        ],
        result: "人还在商场，不在你这三米。安姐的名字跟她走。",
      },
      {
        label: "她看柜，你留在下面接人",
        when: [{ opinion: "suman", gte: 8 }, { remembers: "suman", act: "fair-split" }],
        effects: [
          { quality: "arc:suman:end", set: 3 },
          { opinion: "$a", delta: 4 }, { opinion: "qiaowan", delta: 2 },
          { bond: ["suman", "qiaowan"], delta: 4 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "排班归她。你看晚班，新人归她调，老客还认这面镜子。",
      },
      {
        label: "老客她不交，也不骂",
        effects: [
          { quality: "arc:suman:end", set: 4 },
          { opinion: "$a", delta: -2 },
          { remember: { holder: "$a", act: "stood-aside", valence: -1, subject: "player" } },
        ],
        result: "没有吵。下一张熟客的脸，她自己接，不告诉你前因。",
      },
    ],
  },
];

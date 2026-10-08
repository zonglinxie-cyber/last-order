// 第 2 季故事碎片。节日窗口见 content/festivals.ts：双 11、双 12、年终盘点。
// 个人线只在第 2 季开（开头那张 { season: { gte: 2 } }），读第 1 季带过来的
// arc:<id>:end、秘密和 valence ±2 的记忆。同名选项必须互斥且全覆盖。
// 角色槽可能落到男顾客身上，正文不写死「她」。
import type { Storylet } from "../types.ts";

const tangke: Storylet["cast"][string] = { id: "tangke", where: [] };
const roman: Storylet["cast"][string] = { id: "roman", where: [] };
const fangmin: Storylet["cast"][string] = { id: "fangmin", where: [] };
const qiaowan: Storylet["cast"][string] = { id: "qiaowan", where: [] };
const guest: Storylet["cast"][string] = { where: [{ role: "$self", is: "customer" }] };

export const STORYLETS_SEASON2: Storylet[] = [
  // —— 双 11：预售核销、比价、到手价 ——

  {
    id: "s2-d11-redeem",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "double11" }],
    weight: 10, tension: 0, cooldown: 5,
    text: "双 11。{$a}把预售码放在柜上。系统里这单还是未核销。",
    choices: [
      {
        label: "等核销对上再收尾款",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "presale-matched", valence: 1, subject: "player" } },
        ],
        result: "码留下了。尾款等核销对上再收。{$a}今天没有空付一笔。",
      },
      {
        label: "先收尾款",
        effects: [
          { opinion: "$a", delta: -5 },
          { stat: "compliance", delta: -5 },
          { remember: { holder: "$a", act: "presale-forced", valence: -2, subject: "player" } },
        ],
        result: "尾款进了柜。核销还是未完成。{$a}记下的是你先收了钱。",
      },
      {
        label: "先把码拍下来，尾款明天对",
        when: [{ opinion: "$a", gte: 8 }],
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 1 } },
        ],
        result: "码拍进记录。{$a}明天来对尾款，今天这单不收。",
      },
    ],
  },
  {
    id: "s2-d11-compare",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [{ festival: "double11" }],
    weight: 10, tension: 0, cooldown: 5,
    text: "双 11。{$a}把别的店的价签摊开。{$b}站在旁边，听得见你认不认这个价。",
    choices: [
      {
        label: "把两个价都说清楚",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 3 },
          { stat: "compliance", delta: 2 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "price-plain", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "price-plain", valence: 1, subject: "player" } },
        ],
        result: "标价和那张价签都说完了。{$b}听见的是公开的数。",
      },
      {
        label: "拿小样补上这个差",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -3 },
          { stat: "compliance", delta: -4 },
          { bond: ["$a", "$b"], delta: -4 },
          { remember: { holder: "$a", act: "price-pad", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "price-pad", valence: -1, subject: "player" } },
        ],
        result: "差价用小样垫上了。{$b}看见柜上肯为这张价签让一步。",
      },
      {
        label: "分开说，两单各开各的",
        when: [{ bond: ["$a", "$b"], kind: "rival" }],
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 3 },
          { bond: ["$a", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "price-plain", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "价没有混在一起。{$a}和{$b}各自听见自己那一单怎么开。",
      },
    ],
  },
  {
    id: "s2-d11-hand",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "double11" }],
    weight: 10, tension: 0, cooldown: 5,
    text: "双 11。{$a}问线上到手价。券后的数和柜上的标价差一截。",
    choices: [
      {
        label: "把到手价念完",
        when: [{ temper: "$a", is: "thrifty" }],
        effects: [
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "hand-price", valence: 2, subject: "player" } },
        ],
        result: "券后的数和标价都念完了。{$a}把两个价都记进手机。",
      },
      {
        label: "把到手价念完",
        when: [{ not: { temper: "$a", is: "thrifty" } }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "hand-price", valence: 1, subject: "player" } },
        ],
        result: "到手价念完了。这单仍按柜上的标价，券的事{$a}自己回去对。",
      },
      {
        label: "只报柜上的标价",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "price-plain", valence: -1, subject: "player" } },
        ],
        result: "标价说了。到手价没有出口。{$a}拿着手机上的数离开这一截。",
      },
    ],
  },

  // —— 双 12：过期尾款、截图价、赠品对不上 ——

  {
    id: "s2-d12-tail",
    kind: "social",
    cast: {
      a: guest,
      b: { where: [{ role: "$self", is: "staff" }] },
    },
    when: [{ festival: "double12" }],
    weight: 10, tension: 0, cooldown: 5,
    text: "双 12。{$a}来付双 11 没核完的尾款。日期已经过了。{$b}看着系统那一行。",
    choices: [
      {
        label: "这单按过期重开",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: 3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "presale-matched", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "旧码作废。尾款不收。{$b}看见系统里这行按过期关了。",
      },
      {
        label: "还认这张码",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -4 },
          { stat: "compliance", delta: -5 },
          { remember: { holder: "$a", act: "presale-forced", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "presale-forced", valence: -1, subject: "player" } },
        ],
        result: "过期的码收了尾款。{$b}记下系统日期和你收的钱对不上。",
      },
      {
        label: "让{$b}改日期之前先别收",
        when: [{ opinion: "$b", gte: 0 }],
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 4 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 2 } },
        ],
        result: "钱今天不进。{$a}明天再来，日期改不改由{$b}在系统里写。",
      },
    ],
  },
  {
    id: "s2-d12-shot",
    kind: "social",
    cast: {
      a: guest,
      b: { mustBePresent: false, where: [{ role: "$self", is: "customer" }] },
    },
    when: [{ festival: "double12" }],
    weight: 10, tension: 0, cooldown: 5,
    text: "双 12。{$a}把群里的截图递过来。图上是券后到手价，要你按这个数开。",
    choices: [
      {
        label: "把截图价和标价都说完",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "hand-price", valence: 2, subject: "player" } },
        ],
        result: "两个价都说完了。截图留在{$a}手机里，柜上按标价。",
      },
      {
        label: "按截图上的数开",
        effects: [
          { opinion: "$a", delta: 6 },
          { stat: "compliance", delta: -6 },
          { remember: { holder: "$a", act: "price-pad", valence: -2, subject: "player" } },
        ],
        result: "这单按截图收了。标价和到手价的差没有写进记录。",
      },
      {
        label: "别当着{$b}对这个价",
        when: [{ present: "$b" }],
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -2 },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "价没有当众对。{$a}的截图还在，{$b}没有听见那个数。",
      },
    ],
  },
  {
    id: "s2-d12-gift",
    kind: "social",
    cast: {
      a: guest,
      b: { where: [{ role: "$self", is: "staff" }] },
    },
    when: [{ festival: "double12" }],
    weight: 10, tension: 0, cooldown: 5,
    text: "双 12。线上那单写了赠品。抽屉里这支没有。{$a}等你一句，{$b}站在记录这边。",
    choices: [
      {
        label: "写明没有，不另补",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: 4 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "refused-gap", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "赠品这行写成没有。{$a}今天不拿这支。记录和抽屉是同一件事。",
      },
      {
        label: "从自己的小样里补上",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -3 },
          { stat: "compliance", delta: -4 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "covered-gap", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "covered-gap", valence: -1, subject: "player" } },
        ],
        result: "小样补进了袋子。线上写的那支，抽屉里还是没有。",
      },
      {
        label: "让{$b}把这行空着",
        when: [{ opinion: "$b", gte: 4 }],
        effects: [
          { opinion: "$b", delta: 2 }, { opinion: "$a", delta: 1 },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 1 } },
        ],
        result: "这行先空着。{$a}明天再来，补不补等记录有字。",
      },
    ],
  },

  // —— 年终盘点 ——

  {
    id: "s2-year-ticket",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "yearend" }],
    weight: 10, tension: 0, cooldown: 5,
    text: "年终盘点。{$a}把小票按在柜上。系统里的数和票上差一支。",
    choices: [
      {
        label: "照票改系统",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "ledger-matched", valence: 2, subject: "player" } },
        ],
        result: "系统改成票上的数。差的那一支写明没有售出。",
      },
      {
        label: "补一行票上没有的说明",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: -6 },
          { remember: { holder: "$a", act: "ledger-padded", valence: -2, subject: "player" } },
        ],
        result: "说明补上了。小票上没有这一行。{$a}把票收回去。",
      },
      {
        label: "票先留下，明天对",
        when: [{ opinion: "$a", gte: 6 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 0 } },
        ],
        result: "票留在柜上。{$a}明天来听系统改没改。",
      },
    ],
  },
  {
    id: "s2-year-gap",
    kind: "floor",
    cast: { a: fangmin, b: guest },
    when: [{ festival: "yearend" }],
    weight: 10, tension: 0, once: true,
    text: "年终表上赠品那行是空的。方敏等你写。{$b}的小票还在柜上。",
    choices: [
      {
        label: "照小票写，名字空着",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 2 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "ledger-matched", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "这行照票写了。名字空着。方敏把这一页收进文件夹。",
      },
      {
        label: "把缺口写到同事头上",
        effects: [
          { opinion: "$a", delta: -6 }, { opinion: "tangke", delta: -4 },
          { stat: "compliance", delta: -4 },
          { quality: "arc:fangmin:named", set: 1 },
          { remember: { holder: "$a", act: "named-colleague", valence: -2, subject: "player" } },
          { remember: { holder: "tangke", act: "named-colleague", valence: -2, subject: "player", heardFrom: "fangmin" } },
        ],
        result: "名字写上了。方敏没有改你的字。唐可这行是听记录来的。",
      },
      {
        label: "上季那个名字，这行还用",
        when: [{ remembers: "fangmin", act: "named-colleague", valence: "bad" }],
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "ledger-padded", valence: -1, subject: "player" } },
        ],
        result: "上季点过的名字又进了年终表。方敏把这一页单独夹出来。",
      },
    ],
  },
  {
    id: "s2-year-peilan",
    kind: "floor",
    cast: {
      a: { id: "peilan", where: [] },
      b: guest,
    },
    when: [{ festival: "yearend" }],
    weight: 12, tension: 0, once: true,
    text: "年终盘点。裴岚进柜，把记录翻开。她问这三天的原话在不在。{$b}还站在镜子前。",
    choices: [
      {
        label: "把记录摊开",
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: 1 },
          { stat: "compliance", delta: 3 },
          { move: { person: "$a", zone: "counter" } },
          { remember: { holder: "$a", act: "records-opened", valence: 2, subject: "player" } },
        ],
        result: "裴岚看到的是写下的原话。{$b}这单没有被写进解释。",
      },
      {
        label: "把记录合上",
        effects: [
          { opinion: "$a", delta: -6 },
          { stat: "compliance", delta: -3 },
          { move: { person: "$b", zone: "lounge" } },
          { remember: { holder: "$a", act: "records-held", valence: -2, subject: "player" } },
        ],
        result: "记录合上了。裴岚这趟没有看到原话。{$b}被请到休息区等。",
      },
      {
        label: "翻到方敏收过的那一页",
        when: [{ remembers: "fangmin", act: "same-as-record" }],
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "fangmin", delta: 3 },
          { bond: ["peilan", "fangmin"], delta: 4 },
          { move: { person: "$a", zone: "counter" } },
          { remember: { holder: "$a", act: "records-opened", valence: 2, subject: "player" } },
        ],
        result: "裴岚停在方敏收过的那一页。这一趟她不再往下翻。",
      },
    ],
  },

  // —— 回来了：第 1 季留下的大事 ——

  {
    id: "s2-back-advice",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", act: "honest-advice", valence: "good", subject: "player", heard: false }] },
    },
    when: [
      { season: { gte: 2 } },
      { opinion: "$a", gte: 6 },
      { remembers: "$a", act: "honest-advice", valence: "good", subject: "player", heard: false },
    ],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}把空瓶放上台面。之前你当面给过的那句，{$a}要你再对一遍。",
    choices: [
      {
        label: "按之前那句再对一遍",
        effects: [
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "那句又说了一遍，和之前是同一句。{$a}把空瓶带走。",
      },
      {
        label: "这句先放下，看今天的脸",
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
        ],
        result: "旧句放下了。今天只看{$a}现在这一张脸。",
      },
      {
        label: "把当时没说满的限制补上",
        when: [{ opinion: "$a", gte: 16 }],
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "限制补上了。{$a}知道那句当时停在哪里。",
      },
    ],
  },
  {
    id: "s2-back-push",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", act: "hard-sell", valence: "bad", subject: "player", heard: false }] },
    },
    when: [
      { season: { gte: 2 } },
      { opinion: "$a", lte: 4 },
      { remembers: "$a", act: "hard-sell", valence: "bad", subject: "player", heard: false },
    ],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}把之前那支硬推的货放回柜上。盒子还在，{$a}要一句说法。",
    choices: [
      {
        label: "认，那次不该推",
        effects: [
          { opinion: "$a", delta: 6 },
          { stat: "standing", delta: -1 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "你认了那次硬推。{$a}把盒子留下，今天不另开。",
      },
      {
        label: "说那次{$a}自己点的头",
        effects: [
          { opinion: "$a", delta: -6 },
          { remember: { holder: "$a", act: "came-for-last", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "broke-word", valence: -2, subject: "player" } },
        ],
        result: "说法推回去了。{$a}把盒子拿走，这季不再把空瓶带到你这。",
      },
      {
        label: "把当时的原话再对一遍",
        when: [{ opinion: "$a", lte: -8 }],
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "原话对过了。{$a}听到的和盒子上的不是两件事。",
      },
    ],
  },
  {
    id: "s2-back-kept",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", act: "kept-secret", valence: "good", subject: "player" }] },
    },
    when: [
      { season: { gte: 2 } },
      { opinion: "$a", gte: 4 },
      { remembers: "$a", act: "kept-secret", valence: "good", subject: "player" },
    ],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}进门先看你有没有旁人。之前那件你答应收到你为止的事，{$a}还记着。",
    choices: [
      {
        label: "那件还是到你为止",
        effects: [
          { opinion: "$a", delta: 5 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "你又说了一遍：到此为止。{$a}今天肯把人往你这边带。",
      },
      {
        label: "这件换你自己保管",
        effects: [
          { opinion: "$a", delta: -4 },
          { remember: { holder: "$a", act: "came-for-last", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "保管交回去了。{$a}不再把下一件私事留在你这。",
      },
      {
        label: "约{$a}人少的时候再来",
        when: [{ opinion: "$a", gte: 12 }],
        effects: [
          { opinion: "$a", delta: 3 },
          { appoint: { person: "$a", inDays: 2, slot: 0 } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "今天不谈那件。{$a}换一个人少的时段再来。",
      },
    ],
  },
  {
    id: "s2-back-mediate",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", act: "mediated", valence: "good", subject: "player" }] },
    },
    when: [
      { season: { gte: 2 } },
      { opinion: "$a", gte: 4 },
      { remembers: "$a", act: "mediated", valence: "good", subject: "player" },
    ],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}说，之前你圆过的那一句，今天还有人问。{$a}来听你还认不认。",
    choices: [
      {
        label: "那句还认",
        effects: [
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "mediated", valence: 1, subject: "player" } },
        ],
        result: "你认了那次圆场。{$a}去回问的人：那句还在。",
      },
      {
        label: "那次只圆到当场",
        effects: [
          { opinion: "$a", delta: -3 },
          { remember: { holder: "$a", act: "came-for-last", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "stood-aside", valence: -1, subject: "player" } },
        ],
        result: "圆场停在当场。{$a}不再拿你的名字去回那个人。",
      },
      {
        label: "让问的人自己来",
        when: [{ opinion: "$a", gte: 14 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { appoint: { person: "$a", inDays: 2, slot: 2 } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "你不经{$a}的嘴转述。问的人要来，自己来。",
      },
    ],
  },
  {
    id: "s2-back-heard",
    kind: "social",
    cast: {
      b: { mustBePresent: false, where: [{ remembers: "$self", subject: "player", valence: "bad" }] },
      a: { where: [{ remembers: "$self", subject: "player", valence: "bad", heard: true, from: "$b" }] },
    },
    when: [
      { season: { gte: 2 } },
      { opinion: "$a", lte: 8 },
      { remembers: "$a", subject: "player", valence: "bad", heard: true, from: "$b" },
    ],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}进门就问之前那句。{$a}说是听{$b}讲的，要你自己认。",
    choices: [
      {
        label: "认，不扯{$b}",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "你认了。{$b}的转述停在{$a}这一问，没有再加一句。",
      },
      {
        label: "说{$b}传过了头",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: -5 },
          { bond: ["$a", "$b"], delta: -6 },
          { remember: { holder: "$a", act: "came-for-last", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "talked-down", valence: -2, subject: "player", heardFrom: "player" } },
        ],
        result: "你把过了头的部分推给{$b}。{$a}记下的是你没有自己认。",
      },
      {
        label: "约{$a}当面再听一遍",
        when: [{ opinion: "$a", lte: -6 }],
        effects: [
          { opinion: "$a", delta: 3 },
          { appoint: { person: "$a", inDays: 2, slot: 1 } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "今天不跟转述争。{$a}过两天自己来听你说。",
      },
    ],
  },
  {
    id: "s2-back-refund",
    kind: "social",
    cast: {
      a: { where: [{ remembers: "$self", act: "returned-goods", valence: "bad", subject: "player" }] },
    },
    when: [
      { season: { gte: 2 } },
      { opinion: "$a", lte: 6 },
      { remembers: "$a", act: "returned-goods", valence: "bad", subject: "player" },
    ],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}又来了。之前退掉的那单，{$a}要你把原因再说一遍。小票还在{$a}手里。",
    choices: [
      {
        label: "照小票把原因再说一遍",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "ledger-matched", valence: 1, subject: "player" } },
        ],
        result: "原因和票上是同一句。{$a}把票收好，今天不另开。",
      },
      {
        label: "说退货是{$a}改了主意",
        effects: [
          { opinion: "$a", delta: -5 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "came-for-last", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "ledger-padded", valence: -2, subject: "player" } },
        ],
        result: "原因改成了改主意。票上不是这句。{$a}把票扣上。",
      },
      {
        label: "这单重开，按今天的脸",
        when: [{ opinion: "$a", gte: -4 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 2 } },
        ],
        result: "旧单停在退货。{$a}明天来，看的是今天这张脸。",
      },
    ],
  },

  // —— 个人线：唐可。第 2 季才开，读苏蔓、陆遥的落点 ——

  {
    id: "arc-tangke-sheet",
    kind: "arc",
    cast: { a: tangke },
    when: [{ season: { gte: 2 } }, { not: { quality: "arc:tangke", gte: 1 } }],
    weight: 22, tension: 0, once: true,
    text: "唐可把这季的周目标摊开。还是一张表。她问名字先写谁。",
    choices: [
      {
        label: "先写她的名字",
        effects: [
          { quality: "arc:tangke", set: 1 },
          { opinion: "$a", delta: 6 },
          { remember: { holder: "$a", act: "fair-split", valence: 2, subject: "player" } },
          { appoint: { person: "tangke", inDays: 2, slot: 2 } },
        ],
        result: "表上先是唐可。她把你的名字写在旁边，没有划掉。",
      },
      {
        label: "先写你自己",
        effects: [
          { quality: "arc:tangke", set: 1 },
          { opinion: "$a", delta: -8 },
          { remember: { holder: "$a", act: "took-order", valence: -2, subject: "player" } },
          { appoint: { person: "tangke", inDays: 2, slot: 2 } },
        ],
        result: "名字先是你的。唐可把笔放下。这张表她没有签。",
      },
      {
        label: "问罗曼这张表谁定的",
        effects: [
          { quality: "arc:tangke", set: 1 },
          { opinion: "$a", delta: 2 }, { opinion: "roman", delta: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "tangke", inDays: 2, slot: 2, bring: ["roman"] } },
        ],
        result: "名字先空着。唐可去问罗曼。后天下午她把答复带到柜上。",
      },
    ],
  },
  {
    id: "arc-tangke-stock",
    kind: "arc",
    cast: { a: tangke },
    when: [{ quality: "arc:tangke", gte: 1 }, { not: { quality: "arc:tangke", gte: 2 } }],
    weight: 22, tension: 0, once: true,
    text: "柜上断了一支。唐可包里有一支没进系统的。她问你这支报不报。",
    choices: [
      {
        label: "写进记录",
        effects: [
          { quality: "arc:tangke", set: 2 },
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { appoint: { person: "tangke", inDays: 2, slot: 2 } },
        ],
        result: "这支进了记录。唐可少了一支能私下周转的货，账是齐的。",
      },
      {
        label: "先别写",
        effects: [
          { quality: "arc:tangke", set: 2 },
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
          { appoint: { person: "tangke", inDays: 2, slot: 2 } },
        ],
        result: "这支没有进系统。唐可知道你替她压下了这一行。",
      },
      {
        label: "告诉方敏",
        effects: [
          { quality: "arc:tangke", set: 2 },
          { opinion: "$a", delta: -8 }, { opinion: "fangmin", delta: 3 },
          { remember: { holder: "$a", act: "named-colleague", valence: -2, subject: "player" } },
          { remember: { holder: "fangmin", act: "named-colleague", valence: -2, subject: "tangke", heardFrom: "player" } },
          { appoint: { person: "tangke", inDays: 2, slot: 2 } },
        ],
        result: "方敏知道这支是谁的。唐可这季不再把没入账的货放在你看得到的地方。",
      },
    ],
  },
  {
    id: "arc-tangke-seat",
    kind: "arc",
    cast: { a: tangke },
    when: [{ quality: "arc:tangke", gte: 2 }, { not: { quality: "arc:tangke", gte: 3 } }],
    weight: 22, tension: 0, once: true,
    text: "调岗表上下来一个名额。柜上的老客档还空着一截。唐可问这截写不写她。",
    choices: [
      {
        label: "这截按苏蔓留下的档写",
        when: [{ any: [{ quality: "arc:suman:end", eq: 1 }, { quality: "arc:suman:end", eq: 3 }] }],
        effects: [
          { quality: "arc:tangke", set: 3 },
          { opinion: "$a", delta: 4 }, { opinion: "suman", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 2, subject: "player" } },
          { appoint: { person: "tangke", inDays: 2, slot: 2 } },
        ],
        result: "空着的那截按苏蔓上季留下的档写了。唐可知道哪些人还来这三米。",
      },
      {
        label: "名字跟苏蔓走了，这截不写",
        when: [{ quality: "arc:suman:end", eq: 2 }],
        effects: [
          { quality: "arc:tangke", set: 3 },
          { opinion: "$a", delta: 1 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1, subject: "player" } },
          { appoint: { person: "tangke", inDays: 2, slot: 2 } },
        ],
        result: "这截没有写进唐可的表。跟苏蔓走的名字，你没有再分一次。",
      },
      {
        label: "先空着，等罗曼签",
        effects: [
          { quality: "arc:tangke", set: 3 },
          { opinion: "$a", delta: 2 }, { opinion: "roman", delta: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "tangke", inDays: 2, slot: 2 } },
        ],
        result: "老客档先空着。唐可等罗曼的字。名额还在表上。",
      },
    ],
  },
  {
    id: "arc-tangke-end",
    kind: "arc",
    cast: { a: tangke },
    when: [{ quality: "arc:tangke", gte: 3 }, { not: { quality: "arc:tangke:end", gte: 1 } }],
    weight: 22, tension: 0, once: true,
    text: "唐可不谈以后怎么处。她问这季的表上还有没有她的名字。",
    choices: [
      {
        label: "她留下，名字并排",
        when: [{ opinion: "tangke", gte: 8 }, { not: { remembers: "tangke", act: "took-order", valence: "bad" } }],
        effects: [
          { quality: "arc:tangke:end", set: 1 },
          { opinion: "$a", delta: 5 },
          { remember: { holder: "$a", act: "posted-stay", valence: 2, subject: "player" } },
          { bond: ["tangke", "roman"], delta: 3 },
        ],
        result: "唐可还在这面柜。周目标上你们两个的名字并排，她签了。",
      },
      {
        label: "这季她调走",
        effects: [
          { quality: "arc:tangke:end", set: 2 },
          { opinion: "$a", delta: -4 },
          { remember: { holder: "$a", act: "posted-out", valence: -2, subject: "player" } },
          { bond: ["tangke", "roman"], delta: -4 },
        ],
        result: "表上这季没有唐可。她的班你接着看。名字不跟她走。",
      },
      {
        label: "她去陆遥那边",
        when: [{ quality: "arc:luyao:end", gte: 1 }, { not: { remembers: "luyao", act: "took-client", valence: "bad" } }],
        effects: [
          { quality: "arc:tangke:end", set: 3 },
          { opinion: "$a", delta: 2 }, { opinion: "luyao", delta: 2 },
          { bond: ["tangke", "luyao"], kind: "colleague", set: 12 },
          { remember: { holder: "$a", act: "posted-out", valence: -1, subject: "player" } },
        ],
        result: "唐可去了陆遥那边。争之前陆遥会说一声的那条线，她跟着去看。",
      },
      {
        label: "名额先悬着",
        effects: [
          { quality: "arc:tangke:end", set: 4 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "stood-aside", valence: 0, subject: "player" } },
        ],
        result: "名额没有签出去。唐可还站这面柜，表上的名字谁也不划。",
      },
    ],
  },

  // —— 个人线：罗曼 ——

  {
    id: "arc-roman-columns",
    kind: "arc",
    cast: { a: roman },
    when: [{ season: { gte: 2 } }, { not: { quality: "arc:roman", gte: 1 } }],
    weight: 22, tension: 0, once: true,
    text: "罗曼把第 2 季的表拍在柜上。个人一列，团队一列。她问你先看哪一列。",
    choices: [
      {
        label: "先看团队那一列",
        effects: [
          { quality: "arc:roman", set: 1 },
          { opinion: "$a", delta: 5 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { appoint: { person: "roman", inDays: 2, slot: 0 } },
        ],
        result: "你先看了团队那一列。罗曼没有催你报个人的数。",
      },
      {
        label: "先看个人那一列",
        effects: [
          { quality: "arc:roman", set: 1 },
          { opinion: "$a", delta: -4 },
          { remember: { holder: "$a", act: "took-order", valence: -1, subject: "player" } },
          { appoint: { person: "roman", inDays: 2, slot: 0 } },
        ],
        result: "你先看了自己的数。罗曼把团队那一列折到后面。",
      },
      {
        label: "问她这两列是谁定的",
        effects: [
          { quality: "arc:roman", set: 1 },
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "roman", inDays: 2, slot: 0 } },
        ],
        result: "两列都还摊着。罗曼说这句她明天自己讲。你约了她上午来。",
      },
    ],
  },
  {
    id: "arc-roman-quota",
    kind: "arc",
    cast: { a: roman },
    when: [{ quality: "arc:roman", gte: 1 }, { not: { quality: "arc:roman", gte: 2 } }],
    weight: 22, tension: 0, once: true,
    text: "罗曼说，转正名额那句不是总部的文。是她写在表上的。她问你这句还传不传。",
    choices: [
      {
        label: "这句不往下传",
        effects: [
          { quality: "arc:roman", set: 2 },
          { opinion: "$a", delta: 6 },
          { remember: { holder: "$a", act: "quota-held", valence: 2, subject: "player" } },
          { appoint: { person: "roman", inDays: 2, slot: 0 } },
        ],
        result: "名额的来历停在你和她之间。罗曼知道你没有拿这句去压人。",
      },
      {
        label: "告诉唐可",
        effects: [
          { quality: "arc:roman", set: 2 },
          { opinion: "$a", delta: -3 }, { opinion: "tangke", delta: 4 },
          { remember: { holder: "tangke", act: "quota-said", valence: 2, subject: "player", heardFrom: "roman" } },
          { remember: { holder: "$a", act: "quota-said", valence: -1, subject: "player" } },
          { appoint: { person: "roman", inDays: 2, slot: 0 } },
        ],
        result: "唐可知道名额不是总部定的。这句话是罗曼的，经你的嘴到了她那里。",
      },
      {
        label: "告诉乔晚",
        effects: [
          { quality: "arc:roman", set: 2 },
          { opinion: "$a", delta: -4 }, { opinion: "qiaowan", delta: -2 },
          { remember: { holder: "qiaowan", act: "copied-line", valence: -2, subject: "player", heardFrom: "roman" } },
          { remember: { holder: "$a", act: "quota-said", valence: -2, subject: "player" } },
          { appoint: { person: "roman", inDays: 2, slot: 0 } },
        ],
        result: "乔晚把这句背上了。罗曼没有让你传。下一张脸她也可能这么说。",
      },
    ],
  },
  {
    id: "arc-roman-late",
    kind: "arc",
    cast: { a: roman },
    when: [{ quality: "arc:roman", gte: 2 }, { not: { quality: "arc:roman", gte: 3 } }],
    weight: 22, tension: 0, once: true,
    text: "晚班表空着一格。罗曼问陆遥上季那条线，要不要写在这格旁边。",
    choices: [
      {
        label: "写上她争之前会说",
        when: [{ quality: "arc:luyao:end", eq: 1 }],
        effects: [
          { quality: "arc:roman", set: 3 },
          { opinion: "$a", delta: 3 }, { opinion: "luyao", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { appoint: { person: "roman", inDays: 2, slot: 0 } },
        ],
        result: "这格旁边写了：陆遥争之前会说一声。罗曼按你上季听到的那句记。",
      },
      {
        label: "陆遥这格不写",
        effects: [
          { quality: "arc:roman", set: 3 },
          { opinion: "$a", delta: 1 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1, subject: "player" } },
          { appoint: { person: "roman", inDays: 2, slot: 0 } },
        ],
        result: "晚班这格没有陆遥的名字。罗曼只留了空位。",
      },
      {
        label: "把名额的来历写进表注",
        when: [{ any: [{ remembers: "roman", act: "quota-held" }, { remembers: "tangke", act: "quota-said", from: "roman" }] }],
        effects: [
          { quality: "arc:roman", set: 3 },
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { appoint: { person: "roman", inDays: 2, slot: 0 } },
        ],
        result: "表注写了：名额不是总部的文。罗曼自己的字还在，你没有替她改口。",
      },
    ],
  },
  {
    id: "arc-roman-end",
    kind: "arc",
    cast: { a: roman },
    when: [{ quality: "arc:roman", gte: 3 }, { not: { quality: "arc:roman:end", gte: 1 } }],
    weight: 22, tension: 0, once: true,
    text: "罗曼把晚班表推过来。她问这季名额那句，还留不留在表上。",
    choices: [
      {
        label: "表交给你，名额那句收回",
        effects: [
          { quality: "arc:roman:end", set: 1 },
          { opinion: "$a", delta: 5 },
          { remember: { holder: "$a", act: "quota-held", valence: 2, subject: "player" } },
          { bond: ["roman", "tangke"], delta: 3 },
        ],
        result: "晚班表在你这边。转正名额那句从这张表上拿掉了。",
      },
      {
        label: "两列数字照旧",
        effects: [
          { quality: "arc:roman:end", set: 2 },
          { opinion: "$a", delta: -2 },
          { remember: { holder: "$a", act: "took-order", valence: -1, subject: "player" } },
        ],
        result: "个人一列，团队一列。名额那句还在。罗曼没有收回。",
      },
      {
        label: "你去顶她的班",
        when: [{ opinion: "roman", gte: 10 }],
        effects: [
          { quality: "arc:roman:end", set: 3 },
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "posted-stay", valence: 1, subject: "player" } },
          { bond: ["roman", "qiaowan"], delta: 2 },
        ],
        result: "罗曼把你报上去顶晚班。她撤半步。表还是她的格式。",
      },
      {
        label: "表还是她的",
        when: [{ opinion: "roman", lte: 2 }],
        effects: [
          { quality: "arc:roman:end", set: 4 },
          { opinion: "$a", delta: -3 },
          { remember: { holder: "$a", act: "stood-aside", valence: -1, subject: "player" } },
        ],
        result: "晚班表没有交出来。你还看镜子前。两列数字她自己盯。",
      },
    ],
  },

  // —— 个人线：方敏 ——

  {
    id: "arc-fangmin-line",
    kind: "arc",
    cast: { a: fangmin },
    when: [{ season: { gte: 2 } }, { not: { quality: "arc:fangmin", gte: 1 } }],
    weight: 22, tension: 0, once: true,
    text: "方敏把文件夹放回你面前。里面有一行是你的字。她问这行还认不认。",
    choices: [
      {
        label: "这行还认",
        effects: [
          { quality: "arc:fangmin", set: 1 },
          { opinion: "$a", delta: 6 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { appoint: { person: "fangmin", inDays: 2, slot: 0 } },
        ],
        result: "你认了那一行。方敏没有把这页抽走。",
      },
      {
        label: "说那行过期了",
        effects: [
          { quality: "arc:fangmin", set: 1 },
          { opinion: "$a", delta: -5 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "broke-word", valence: -2, subject: "player" } },
          { appoint: { person: "fangmin", inDays: 2, slot: 0 } },
        ],
        result: "你说那行过期。方敏把这一页夹进不再引用的那一叠。",
      },
      {
        label: "问她缺口到底是谁的",
        effects: [
          { quality: "arc:fangmin", set: 1 },
          { opinion: "$a", delta: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "fangmin", inDays: 2, slot: 0 } },
        ],
        result: "她没有在这一页上回答。她说先认你自己的字。人你约了她再来。",
      },
    ],
  },
  {
    id: "arc-fangmin-name",
    kind: "arc",
    cast: { a: fangmin },
    when: [{ quality: "arc:fangmin", gte: 1 }, { not: { quality: "arc:fangmin", gte: 2 } }],
    weight: 22, tension: 0, once: true,
    text: "裴岚要来之前，方敏问你：群里那句，点不点名。",
    choices: [
      {
        label: "不点名",
        effects: [
          { quality: "arc:fangmin", set: 2 },
          { opinion: "$a", delta: 5 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
          { appoint: { person: "fangmin", inDays: 2, slot: 0 } },
        ],
        result: "群里没有名字。方敏知道缺口是谁，这句仍然不出口。",
      },
      {
        label: "点出是谁",
        effects: [
          { quality: "arc:fangmin", set: 2 },
          { quality: "arc:fangmin:named", set: 1 },
          { opinion: "$a", delta: -8 },
          { remember: { holder: "$a", act: "named-colleague", valence: -2, subject: "player" } },
          { appoint: { person: "fangmin", inDays: 2, slot: 0 } },
        ],
        result: "名字进了她的记录。方敏没有拦。这行以后可以引用。",
      },
      {
        label: "原话给她，名字空着",
        effects: [
          { quality: "arc:fangmin", set: 2 },
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
          { appoint: { person: "fangmin", inDays: 2, slot: 0 } },
        ],
        result: "原话在，名字空着。方敏把这一行收进裴岚来之前要看的那页。",
      },
    ],
  },
  {
    id: "arc-fangmin-who",
    kind: "arc",
    cast: { a: fangmin },
    when: [{ quality: "arc:fangmin", gte: 2 }, { not: { quality: "arc:fangmin", gte: 3 } }],
    weight: 22, tension: 0, once: true,
    text: "方敏说，缺口是谁她已经知道。她问你还要不要听这个名字。",
    choices: [
      {
        label: "问她缺口是谁的",
        when: [{ knowsSecret: "fangmin" }],
        effects: [
          { quality: "arc:fangmin", set: 3 },
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
          { appoint: { person: "fangmin", inDays: 2, slot: 3 } },
        ],
        result: "名字你已经知道。你问的是进不进档案。方敏说这一页仍然不写。",
      },
      {
        label: "问她缺口是谁的",
        when: [{ not: { knowsSecret: "fangmin" } }],
        effects: [
          { quality: "arc:fangmin", set: 3 },
          { opinion: "$a", delta: 1 },
          { reveal: "fangmin" },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
          { appoint: { person: "fangmin", inDays: 2, slot: 3 } },
        ],
        result: "她说了缺口是谁，又说群里仍然不点。这句到你为止。",
      },
      {
        label: "先别问是谁",
        effects: [
          { quality: "arc:fangmin", set: 3 },
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1, subject: "player" } },
          { appoint: { person: "fangmin", inDays: 2, slot: 3 } },
        ],
        result: "你没有问名字。方敏把文件夹合上。这页她还留在你看得到的地方。",
      },
    ],
  },
  {
    id: "arc-fangmin-end",
    kind: "arc",
    cast: { a: fangmin },
    when: [{ quality: "arc:fangmin", gte: 3 }, { not: { quality: "arc:fangmin:end", gte: 1 } }],
    weight: 22, tension: 0, once: true,
    text: "方敏问这季的文件夹跟不跟你。跟的话，下一季她还认哪几行。",
    choices: [
      {
        label: "原话留下，下一季她还认",
        when: [{ opinion: "fangmin", gte: 0 }, { not: { quality: "arc:fangmin:named", gte: 1 } }],
        effects: [
          { quality: "arc:fangmin:end", set: 1 },
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "folder-kept", valence: 2, subject: "player" } },
        ],
        result: "文件夹留在你桌上。方敏说下一季她还认你写下的原话。",
      },
      {
        label: "缺口写进档案，用你供的名字",
        when: [{ quality: "arc:fangmin:named", gte: 1 }],
        effects: [
          { quality: "arc:fangmin:end", set: 2 },
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "named-colleague", valence: -2, subject: "player" } },
        ],
        result: "名字进了年终能引用的那一页。文件夹不跟你。方敏认的是这行字。",
      },
      {
        label: "不点名，你不在抄送里",
        when: [{ knowsSecret: "fangmin" }, { not: { quality: "arc:fangmin:named", gte: 1 } }],
        effects: [
          { quality: "arc:fangmin:end", set: 3 },
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "名字没有进档案。抄送里没有你。方敏自己留着那一页。",
      },
      {
        label: "这季的句子她不收",
        effects: [
          { quality: "arc:fangmin:end", set: 4 },
          { opinion: "$a", delta: -2 },
          { remember: { holder: "$a", act: "stood-aside", valence: -1, subject: "player" } },
        ],
        result: "文件夹合上了。这季你写的句子，她没有收进下一季要认的那一叠。",
      },
    ],
  },

  // —— 个人线：乔晚 ——

  {
    id: "arc-qiaowan-parrot",
    kind: "arc",
    cast: { a: qiaowan, b: guest },
    when: [{ season: { gte: 2 } }, { not: { quality: "arc:qiaowan", gte: 1 } }],
    weight: 22, tension: 0, once: true,
    text: "乔晚把你上一季的一句原样说给{$b}。{$b}看着你。乔晚等你点头。",
    choices: [
      {
        label: "等{$b}走了再纠正",
        effects: [
          { quality: "arc:qiaowan", set: 1 },
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 2 },
          { move: { person: "$b", zone: "atrium" } },
          { remember: { holder: "$a", act: "unlearned", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { appoint: { person: "qiaowan", inDays: 2, slot: 1 } },
        ],
        result: "{$b}先离开镜子。乔晚听见你把那句改了，客人没有听见这一改。",
      },
      {
        label: "当着{$b}改口",
        effects: [
          { quality: "arc:qiaowan", set: 1 },
          { opinion: "$a", delta: -6 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "public-shame", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { appoint: { person: "qiaowan", inDays: 2, slot: 1 } },
        ],
        result: "句子当着{$b}改了。乔晚的脸还在镜子里。她记下是你当众说她学错了。",
      },
      {
        label: "让她把这句说完",
        effects: [
          { quality: "arc:qiaowan", set: 1 },
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$a", act: "copied-line", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "copied-line", valence: -1, subject: "player" } },
          { appoint: { person: "qiaowan", inDays: 2, slot: 1 } },
        ],
        result: "乔晚说完了。{$b}拿走的是你上一季的句子。下一张脸她还会用。",
      },
    ],
  },
  {
    id: "arc-qiaowan-face",
    kind: "arc",
    cast: { a: qiaowan, b: guest },
    when: [{ quality: "arc:qiaowan", gte: 1 }, { not: { quality: "arc:qiaowan", gte: 2 } }],
    weight: 22, tension: 0, once: true,
    text: "{$b}在凳子上。乔晚问你，她准备的那句能不能用在这张脸上。",
    choices: [
      {
        label: "只看{$b}今天这张脸",
        effects: [
          { quality: "arc:qiaowan", set: 2 },
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 4 },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
          { appoint: { person: "qiaowan", inDays: 2, slot: 1 } },
        ],
        result: "这句按{$b}今天的脸说。乔晚把背好的那句收起来了。",
      },
      {
        label: "让她继续背你的句子",
        effects: [
          { quality: "arc:qiaowan", set: 2 },
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "copied-line", valence: -2, subject: "player" } },
          { appoint: { person: "qiaowan", inDays: 2, slot: 1 } },
        ],
        result: "乔晚又背了一遍。{$b}听到的不是自己的脸。乔晚记下这句还能用。",
      },
      {
        label: "叫苏蔓来听这句",
        when: [{ any: [{ quality: "arc:suman:end", eq: 1 }, { quality: "arc:suman:end", eq: 3 }] }],
        effects: [
          { quality: "arc:qiaowan", set: 2 },
          { opinion: "$a", delta: 3 }, { opinion: "suman", delta: 2 },
          { bond: ["suman", "qiaowan"], delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "qiaowan", inDays: 2, slot: 1 } },
        ],
        result: "这句等苏蔓来听。老客还留在这面柜的那条线，乔晚没有自己拿去用。",
      },
    ],
  },
  {
    id: "arc-qiaowan-unload",
    kind: "arc",
    cast: { a: qiaowan },
    when: [{ quality: "arc:qiaowan", gte: 2 }, { not: { quality: "arc:qiaowan", gte: 3 } }],
    weight: 22, tension: 0, once: true,
    text: "乔晚说她还背着一句不该说的。她问这句还用不用。",
    choices: [
      {
        label: "让她把那句卸掉",
        when: [{ knowsSecret: "qiaowan" }],
        effects: [
          { quality: "arc:qiaowan", set: 3 },
          { opinion: "$a", delta: 5 },
          { remember: { holder: "$a", act: "unlearned", valence: 2, subject: "player" } },
          { appoint: { person: "qiaowan", inDays: 2, slot: 1 } },
        ],
        result: "那句你知道是哪句。乔晚当着你把它从下一张脸上拿掉了。",
      },
      {
        label: "让她把那句卸掉",
        when: [{ not: { knowsSecret: "qiaowan" } }],
        effects: [
          { quality: "arc:qiaowan", set: 3 },
          { opinion: "$a", delta: 3 },
          { reveal: "qiaowan" },
          { remember: { holder: "$a", act: "unlearned", valence: 2, subject: "player" } },
          { appoint: { person: "qiaowan", inDays: 2, slot: 1 } },
        ],
        result: "她把背下的那句说出来。是你的话。你让她停，下一张脸不再用。",
      },
      {
        label: "先留着，下一张脸再用",
        effects: [
          { quality: "arc:qiaowan", set: 3 },
          { opinion: "$a", delta: -2 },
          { remember: { holder: "$a", act: "copied-line", valence: -2, subject: "player" } },
          { appoint: { person: "qiaowan", inDays: 2, slot: 1 } },
        ],
        result: "那句还在她嘴里。乔晚知道下一张脸你仍然让她用。",
      },
    ],
  },
  {
    id: "arc-qiaowan-end",
    kind: "arc",
    cast: { a: qiaowan, b: guest },
    when: [{ quality: "arc:qiaowan", gte: 3 }, { not: { quality: "arc:qiaowan:end", gte: 1 } }],
    weight: 22, tension: 0, once: true,
    text: "{$b}起身要走。乔晚看着你。这一句她问还是你说。",
    choices: [
      {
        label: "让她用自己的句子",
        effects: [
          { quality: "arc:qiaowan:end", set: 1 },
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "own-line", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "送走{$b}的那句是乔晚自己的。你没有在后面补。",
      },
      {
        label: "她还背你的，背错算你",
        when: [{ remembers: "qiaowan", act: "copied-line", valence: "bad" }],
        effects: [
          { quality: "arc:qiaowan:end", set: 2 },
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "copied-line", valence: -2, subject: "player" } },
        ],
        result: "乔晚还在背。{$b}听到的错处，算在你交给乔晚的那句上。",
      },
      {
        label: "晚班的句子归苏蔓",
        when: [{ quality: "arc:suman:end", eq: 3 }],
        effects: [
          { quality: "arc:qiaowan:end", set: 3 },
          { opinion: "$a", delta: 2 }, { opinion: "suman", delta: 3 },
          { bond: ["suman", "qiaowan"], delta: 4 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "晚班乔晚听苏蔓的。你教过的句子停在这一季，不跟她上晚班。",
      },
      {
        label: "实习条还在，她不单独开口",
        effects: [
          { quality: "arc:qiaowan:end", set: 4 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "stood-aside", valence: -1, subject: "player" } },
        ],
        result: "{$b}走的时候乔晚没有单独说一句。实习条还在，句子还等你点头。",
      },
    ],
  },
];

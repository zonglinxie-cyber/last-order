// 第 3 季（春）故事碎片。节日窗口见 content/festivals.ts：情人节、三八节、换季。
// 季内反转靠普通 quality（s3:proxy / s3:group / s3:yield），换季会清掉。
// 老玩家的回响放在选项上，读第 1、2 季带过来的 ±2 记忆和 arc:<id>:end。
// 角色槽可能落到男顾客身上，正文不写死「她」。同名选项不在这季使用。
import type { Storylet } from "../types.ts";

const guest: Storylet["cast"][string] = { where: [{ role: "$self", is: "customer" }] };
const rival: Storylet["cast"][string] = { where: [{ role: "$self", is: "rival" }] };
const roman: Storylet["cast"][string] = { id: "roman", where: [] };
const suman: Storylet["cast"][string] = { id: "suman", where: [] };
const tangke: Storylet["cast"][string] = { id: "tangke", where: [] };
const fangmin: Storylet["cast"][string] = { id: "fangmin", where: [] };
const luyao: Storylet["cast"][string] = { id: "luyao", where: [] };

const spring = { season: { gte: 3, lte: 3 } } as const;

export const STORYLETS_SEASON3: Storylet[] = [
  // —— 情人节：代买、礼袋、退货权。s3:proxy / s3:yield 在这里埋 ——

  {
    id: "s3-val-proxy",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "valentine" }],
    weight: 18, tension: 1, cooldown: 3,
    text: "情人节。{$a}把手机里的照片按在柜上。人没来，{$a}要按照片开，不看今天这张脸。",
    choices: [
      {
        label: "按照片开，票写{$a}",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { quality: "s3:proxy", set: 1 },
          { remember: { holder: "$a", act: "wrong-face", valence: -2, subject: "player" } },
        ],
        result: "货按照片走了。票上是{$a}。要这支的人今天不在柜前。",
      },
      {
        label: "只开在场这张脸",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: 3 },
          { quality: "s3:proxy", set: 1 },
          { remember: { holder: "$a", act: "own-face", valence: 2, subject: "player" } },
        ],
        result: "照片收起来了。这单只认{$a}今天这张脸。{$a}说人会不高兴。",
      },
      {
        label: "票先空着，把人请来",
        when: [{ opinion: "$a", gte: 8 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { quality: "s3:proxy", set: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 2, slot: 2 } },
        ],
        result: "钱今天不收满。{$a}过两天把人带来。照片先夹在记录里。",
      },
    ],
  },
  {
    id: "s3-val-couple",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [{ festival: "valentine" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "情人节。{$a}把卡递过来，{$b}已经坐到镜子前。今天这两张脸只能开一盒。",
    choices: [
      {
        label: "按付钱的人开",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -4 },
          { bond: ["$a", "$b"], delta: -3 },
          { remember: { holder: "$b", act: "wrong-face", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "took-order", valence: -1, subject: "player" } },
        ],
        result: "盒子按{$a}的卡走。{$b}试过的那张脸没有进这单。",
      },
      {
        label: "按镜子前的人开",
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -3 },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "own-face", valence: 1, subject: "player" } },
        ],
        result: "这盒按{$b}的脸。{$a}的卡还在，名字没有写上去。",
      },
      {
        label: "一盒礼，两张脸分开记",
        when: [{ bond: ["$a", "$b"], kind: "partner" }],
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "盒子只有一个。两张脸都写进记录，谁付的、谁用的分开。",
      },
    ],
  },
  {
    id: "s3-val-wrap",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "valentine" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "情人节。{$a}要你把价格从袋子上揭掉。小票还在你这边，{$a}不让写到袋子上。",
    choices: [
      {
        label: "价格只留在小票上",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "price-plain", valence: 2, subject: "player" } },
        ],
        result: "袋子上没有价。小票上的数还在。{$a}把袋子先合上。",
      },
      {
        label: "当众把价格念出来",
        effects: [
          { opinion: "$a", delta: -5 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "public-shame", valence: -2, subject: "player" } },
        ],
        result: "价格当众说了。{$a}把袋子推回来。礼没有包成。",
      },
      {
        label: "小票撕了，只留袋子",
        when: [{ opinion: "$a", gte: 6 }],
        effects: [
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: -5 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "小票撕了。袋子上没有数。这单以后对不上。",
      },
    ],
  },
  {
    id: "s3-val-receipt",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "valentine" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "情人节。{$a}要把票开在自己名下，说好退的时候用得上。收礼的人还没点头。",
    choices: [
      {
        label: "票写{$a}，方便退",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "sold-anyway", valence: -2, subject: "player" } },
        ],
        result: "票在{$a}名下。礼还没被收下，退货的路已经开了。",
      },
      {
        label: "等人点头再开票",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "票没有开。{$a}把卡收回去。礼先停在柜上。",
      },
      {
        label: "约收礼的人自己来",
        when: [{ opinion: "$a", gte: 8 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "brought-friend", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 2, slot: 1 } },
        ],
        result: "名字先空着。{$a}过两天把收礼的人带来。今天这单不封。",
      },
    ],
  },
  {
    id: "s3-val-budget",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "valentine" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "情人节。{$a}纸条上写了一个数。这个礼盒过了那个数，{$a}问你还开不开。",
    choices: [
      {
        label: "按纸条上的数停",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "budget-kept", valence: 2, subject: "player" } },
        ],
        result: "礼盒没有开过那个数。纸条还在。{$a}的礼短了一截。",
      },
      {
        label: "过了也照开",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "over-budget", valence: -2, subject: "player" } },
        ],
        result: "礼盒开过了纸条上的数。{$a}把纸条折起来，没有再对。",
      },
      {
        label: "换成纸条够得着的",
        when: [{ temper: "$a", is: "thrifty" }],
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "budget-kept", valence: 1, subject: "player" } },
        ],
        result: "礼换成纸条里那个数打得住的一支。盒子小了，数是齐的。",
      },
    ],
  },
  {
    id: "s3-val-card",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "valentine" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "情人节。贺卡上写了你没说过的效果。{$a}要你把这句留在卡上，人等着看。",
    choices: [
      {
        label: "把这句划掉",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
        ],
        result: "贺卡上的那句划了。{$a}得自己再写。你没认那句效果。",
      },
      {
        label: "贺卡原样装进袋子",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "hard-sell", valence: -2, subject: "player" } },
        ],
        result: "贺卡原样进了袋子。那句效果不是你说的，袋子还是合上了。",
      },
      {
        label: "改成你今天的原话",
        when: [{ opinion: "$a", gte: 10 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "贺卡改成你今天的原话。{$a}看过，才让你夹进去。",
      },
    ],
  },
  {
    id: "s3-val-rival",
    kind: "floor",
    cast: { a: luyao, b: guest },
    when: [{ festival: "valentine" }],
    weight: 18, tension: 1, cooldown: 3,
    text: "情人节。陆遥把一支玫瑰搁在你的凳子边上。{$b}还没决定礼盒算哪边。",
    choices: [
      {
        label: "这单让给对面",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { stat: "standing", delta: -1 },
          { quality: "s3:yield", set: 1 },
          { remember: { holder: "$a", act: "yielded-client", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "yielded-client", valence: -1, subject: "player" } },
        ],
        result: "礼盒跟玫瑰去了对面。{$b}这单不写你的名字。",
      },
      {
        label: "当着{$b}把玫瑰拿开",
        effects: [
          { opinion: "$a", delta: -5 }, { opinion: "$b", delta: 3 },
          { quality: "s3:yield", set: 1 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "took-client", valence: 1, subject: "player" } },
        ],
        result: "玫瑰不在凳子上了。{$b}留在这边。陆遥记下你当众拿开。",
      },
      {
        label: "先问{$b}要哪边",
        when: [{ opinion: "luyao", gte: 6 }],
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 2 },
          { quality: "s3:yield", set: 1 },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "no-snatch", valence: 2, subject: "player" } },
        ],
        result: "问完了。{$b}自己说算哪边。玫瑰还在，你没有先拿。",
      },
    ],
  },

  // —— 三八节：团购、专票。s3:group 在这里埋，情人节的照片在这里翻 ——

  {
    id: "s3-w8-list",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "womens" }],
    weight: 18, tension: 1, cooldown: 4,
    text: "三八节。{$a}把公司名单摊开，要一个抬头、很多袋子。名单上的人今天不在。",
    choices: [
      {
        label: "按名单开，领货人空着",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 3 },
          { quality: "s3:group", set: 1 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "抬头是公司。袋子按名单装。领的人没有名字。",
      },
      {
        label: "名单收起，只开在场这位",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "standing", delta: -1 },
          { quality: "s3:group", set: 1 },
          { remember: { holder: "$a", act: "own-face", valence: 1, subject: "player" } },
        ],
        result: "名单没有收进这单。只开了{$a}自己那一份。公司那截空着。",
      },
      {
        label: "名单留下，明天对着领",
        when: [{ opinion: "$a", gte: 6 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { quality: "s3:group", set: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 1 } },
        ],
        result: "名单留在柜上。{$a}明天带人来领。今天不一次性开完。",
      },
    ],
  },
  {
    id: "s3-w8-invoice",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "womens" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "三八节。{$a}要专票。抬头上的名字，和站在柜前的人不是同一个。",
    choices: [
      {
        label: "抬头写公司",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 4 },
          { quality: "s3:group", set: 1 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "专票抬头是公司。柜前这个人没有进这一行。",
      },
      {
        label: "抬头写成{$a}",
        effects: [
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: -5 },
          { quality: "s3:group", set: 1 },
          { remember: { holder: "$a", act: "took-order", valence: -2, subject: "player" } },
        ],
        result: "专票写成{$a}。公司和这行对不上。{$a}把票收进包里。",
      },
      {
        label: "等盖章说明再开",
        when: [{ stat: "compliance", gte: 40 }],
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 2 },
          { quality: "s3:group", set: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 0 } },
        ],
        result: "票今天不打。{$a}去拿盖章的说明。抬头先空着。",
      },
    ],
  },
  {
    id: "s3-w8-both",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [{ festival: "womens" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "三八节。{$a}拿着名单，{$b}是名单上的一个名字，已经坐下来了。{$b}不要这支色号。",
    choices: [
      {
        label: "按名单的色号装",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -4 },
          { remember: { holder: "$b", act: "wrong-face", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "colleague-need", valence: -1, subject: "player" } },
        ],
        result: "袋子按名单封了。{$b}要的那支没有换。{$a}的单还在。",
      },
      {
        label: "给{$b}换色号",
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -4 },
          { remember: { holder: "$b", act: "own-face", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "色号换了。名单上那格和袋子里的不是同一支。{$a}看见了。",
      },
      {
        label: "这一份分开，其余照名单",
        when: [{ bond: ["$a", "$b"], kind: "colleague" }],
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 2 },
          { bond: ["$a", "$b"], delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 2, subject: "player" } },
        ],
        result: "{$b}这一份单独写。名单上其余的照旧。两行不混在一起。",
      },
    ],
  },
  {
    id: "s3-w8-shade",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "womens" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "三八节。{$a}指着一支色号，说是福利指定的。脸上并不要这支。",
    choices: [
      {
        label: "福利指定就按指定开",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "hard-sell", valence: -1, subject: "player" } },
        ],
        result: "这支按指定装进袋子。{$a}的脸没有改这一行。",
      },
      {
        label: "改成脸上要的",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "own-face", valence: 2, subject: "player" } },
        ],
        result: "指定那支放下了。袋子里是{$a}脸上的色号。福利那行对不上。",
      },
      {
        label: "对上情人节那张照片",
        when: [{ quality: "s3:proxy", gte: 1 }],
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
        ],
        result: "情人节那张照片对上了。指定色号是第三个人的。{$a}今天这张脸不在那两行里。",
      },
    ],
  },
  {
    id: "s3-w8-sample",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "womens" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "三八节。{$a}要你把小样塞进每个员工袋子。抽屉里的小样不够名单上的人数。",
    choices: [
      {
        label: "不够就不塞",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "refused-gap", valence: -1, subject: "player" } },
        ],
        result: "小样没有塞。名单上写了人数，抽屉里没有那么多。",
      },
      {
        label: "有多少塞多少，不写人数",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -4 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "covered-gap", valence: -1, subject: "player" } },
        ],
        result: "塞进去的小样没有写人数。名单上的人和袋子对不齐。",
      },
      {
        label: "写明只够这两份",
        when: [{ stat: "samples", gte: 2 }],
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 2 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "记录写了只够两份。其余的袋子没有小样。{$a}拿着这行去回公司。",
      },
    ],
  },
  {
    id: "s3-w8-blank",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "womens" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "三八节。{$a}让领货人那一格空着，说人多，回头再补名字。钱今天要进。",
    choices: [
      {
        label: "空着也收",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "refused-gap", valence: -2, subject: "player" } },
        ],
        result: "钱进了。领货人是空的。以后谁来认这袋，记录上没有名字。",
      },
      {
        label: "有名字才收",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "这单没收。{$a}把钱收回去。空格还空着。",
      },
      {
        label: "先收定金，名字明天补",
        when: [{ opinion: "$a", gte: 8 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 2 } },
        ],
        result: "定金留下。名字明天补。整单今天不封口。",
      },
    ],
  },
  {
    id: "s3-w8-rival",
    kind: "floor",
    cast: { a: luyao, b: guest },
    when: [{ festival: "womens" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "三八节。陆遥把单价写在你这边看得到的牌上。{$b}的名单还摊着，问你认不认这个价。",
    choices: [
      {
        label: "把两个价都说完",
        effects: [
          { opinion: "$b", delta: 2 }, { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$b", act: "price-plain", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "price-plain", valence: -1, subject: "player" } },
        ],
        result: "牌上的价和柜上的价都说了。{$b}自己比。名单还在你这边。",
      },
      {
        label: "按对面的单价改这单",
        effects: [
          { opinion: "$b", delta: 5 }, { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -5 },
          { remember: { holder: "$b", act: "price-pad", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "yielded-client", valence: 1, subject: "player" } },
        ],
        result: "这单按对面的单价走了。差价没有写进记录。陆遥看见名单还在你柜上。",
      },
      {
        label: "名单留在这边，价不改",
        when: [{ opinion: "$b", gte: 8 }],
        effects: [
          { opinion: "$b", delta: -1 }, { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "no-snatch", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "price-plain", valence: 1, subject: "player" } },
        ],
        result: "价没有改。名单留在你这边。{$b}知道对面有一个更低的数。",
      },
    ],
  },
  {
    id: "s3-w8-fangmin",
    kind: "floor",
    cast: { a: fangmin, b: guest },
    when: [{ festival: "womens" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "三八节。方敏把发票那一页翻开。{$b}的抬头和领货人不是同一行。方敏等你落笔。",
    choices: [
      {
        label: "两行都照看见的写",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "两行都写上了。对不上的地方空着，没有补成同一个人。",
      },
      {
        label: "改成同一行",
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -5 },
          { stat: "compliance", delta: -5 },
          { remember: { holder: "$a", act: "took-order", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "took-order", valence: 1, subject: "player" } },
        ],
        result: "两行写成了一个名字。方敏没有改你的字。页边留着原来那行。",
      },
      {
        label: "照方敏收过的那页写",
        when: [{ remembers: "fangmin", act: "same-as-record" }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "folder-kept", valence: 1, subject: "player" } },
        ],
        result: "这一页照方敏收过的写法。抬头和领货人仍是两行。",
      },
    ],
  },

  // —— 换季：礼退回来，陆遥把你的句子拿去用 ——

  {
    id: "s3-spr-back",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "spring" }],
    weight: 18, tension: 1, cooldown: 3,
    text: "换季。{$a}把一只礼盒放回柜上。盒子是三八节的，{$a}说自己没领过。",
    choices: [
      {
        label: "照盒子上的名字退",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "退的是盒子上的名字。{$a}今天不另开。记录和盒子是同一行。",
      },
      {
        label: "当成新单重开",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "sold-anyway", valence: -2, subject: "player" } },
        ],
        result: "盒子留下，新单开了。原来那行没有冲掉。{$a}拿的是另一支。",
      },
      {
        label: "对上三八那份名单",
        when: [{ quality: "s3:group", gte: 1 }],
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
        ],
        result: "名单对上了。货领走的是抬头上的人，不是格子里的名字。{$a}这盒没有进过手。",
      },
    ],
  },
  {
    id: "s3-spr-skin",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "spring" }],
    weight: 16, tension: 0, cooldown: 3,
    text: "换季。{$a}把冬天那支空瓶放上来。说现在闷，要你照旧再开一支。",
    choices: [
      {
        label: "照旧再开一支",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "sold-anyway", valence: -1, subject: "player" } },
        ],
        result: "又开了冬天那支。闷不闷没有写进这单。{$a}把空瓶带走。",
      },
      {
        label: "换成现在这张脸要的",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "own-face", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
        ],
        result: "冬天那支没有再开。{$a}看的是现在这张脸。空瓶留在柜上。",
      },
      {
        label: "把上次那句再对一遍",
        when: [{ remembers: "$a", act: "honest-advice", valence: "good" }],
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "上次那句又说了一遍。空瓶还在。这单按那句，不按冬天的瓶子。",
      },
    ],
  },
  {
    id: "s3-spr-old",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "spring" }],
    weight: 16, tension: -1, cooldown: 3,
    text: "换季。{$a}把用剩的半支放上来，要你认不认上次开的那支。",
    choices: [
      {
        label: "认，上次那支不对",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "standing", delta: -1 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
        ],
        result: "你认了上次那支。{$a}把半支留下。今天不另开。",
      },
      {
        label: "说上次是{$a}自己点的",
        effects: [
          { opinion: "$a", delta: -5 },
          { remember: { holder: "$a", act: "broke-word", valence: -2, subject: "player" } },
        ],
        result: "说法推回去了。{$a}把半支拿走。这季不再把空瓶带到你这。",
      },
      {
        label: "把硬推那次的原话对上",
        when: [{ remembers: "$a", act: "hard-sell", valence: "bad" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "原话对上了。那次是硬推。{$a}听见的和盒子上的是同一件事。",
      },
    ],
  },
  {
    id: "s3-spr-rival",
    kind: "floor",
    cast: { a: luyao, b: guest },
    when: [{ festival: "spring" }],
    weight: 18, tension: 1, once: true,
    text: "换季。陆遥对着{$b}说了一句你听过的话。{$b}问这句原来是谁的。",
    choices: [
      {
        label: "说这句是你的",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "took-client", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "rival-line", valence: 1, subject: "player" } },
        ],
        result: "你认了这句。{$b}知道原话在这边。陆遥没有改口。",
      },
      {
        label: "让这句算对面的",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$a", act: "yielded-client", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "yielded-client", valence: -2, subject: "player" } },
        ],
        result: "这句归了对面。{$b}跟着那句走。你没有争。",
      },
      {
        label: "把情人节那次对上",
        when: [{ quality: "s3:yield", gte: 1 }],
        effects: [
          { opinion: "$b", delta: 1 }, { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$b", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "rival-line", valence: -1, subject: "player" } },
        ],
        result: "情人节那次对上了。陆遥用的是你当时的句子。{$b}说先听到的是对面。",
      },
    ],
  },
  {
    id: "s3-spr-front",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [{ festival: "spring" }],
    weight: 16, tension: 1, cooldown: 3,
    text: "换季。{$a}要把一只礼盒当众退掉。{$b}就是当初付钱的人，还站在旁边。",
    choices: [
      {
        label: "当着{$b}办退",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -4 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$b", act: "public-shame", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "退货当着{$b}办了。礼没有留住。{$b}这单的名字还在票上。",
      },
      {
        label: "请到边上再退",
        effects: [
          { opinion: "$b", delta: 2 }, { opinion: "$a", delta: -2 },
          { remember: { holder: "$b", act: "kept-secret", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "stood-aside", valence: -1, subject: "player" } },
        ],
        result: "退货没有当众办。{$b}先没看见。盒子还是退了，名字以后对得上。",
      },
      {
        label: "说这盒不是照片上的人",
        when: [{ quality: "s3:proxy", gte: 1 }],
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "wrong-face", valence: -1, subject: "player" } },
        ],
        result: "说出来了。盒子里的色号对的是照片，不是{$a}。{$b}的钱买的是第三张脸。",
      },
    ],
  },
  {
    id: "s3-spr-set",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "spring" }],
    weight: 16, tension: 0, cooldown: 3,
    text: "换季。套装里缺了春天这支。{$a}要你用别的补上，还是把这一套拆开卖。",
    choices: [
      {
        label: "拆开，缺的不补",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "refused-gap", valence: -1, subject: "player" } },
        ],
        result: "套装拆了。缺的那支没有补。{$a}只拿走有的。",
      },
      {
        label: "用小样把缺的补上",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "covered-gap", valence: -1, subject: "player" } },
        ],
        result: "缺口用小样补上了。套装看起来是齐的。记录里没有这支。",
      },
      {
        label: "写明缺一支，明天再补",
        when: [{ opinion: "$a", gte: 6 }],
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 1 } },
        ],
        result: "这行写了缺一支。{$a}明天再来。今天不把别的算进去。",
      },
    ],
  },
  {
    id: "s3-spr-suman",
    kind: "floor",
    cast: { a: suman, b: guest },
    when: [{ festival: "spring" }],
    weight: 16, tension: -1, once: true,
    text: "换季。苏蔓把老客的空瓶收成一排。{$b}的瓶子也在里面。苏蔓问这瓶还算不算老客。",
    choices: [
      {
        label: "还算苏蔓的人",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "looked-after", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "这瓶仍算苏蔓的人。{$b}今天的单不写你的新客。空瓶归到那一排。",
      },
      {
        label: "算你这季的新单",
        effects: [
          { opinion: "$a", delta: -5 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "took-client", valence: 1, subject: "player" } },
        ],
        result: "空瓶从那一排拿出来了。这单写你的名字。苏蔓没有再把{$b}往回放。",
      },
      {
        label: "按上季留下的档归",
        when: [{ any: [{ quality: "arc:suman:end", eq: 1 }, { quality: "arc:suman:end", eq: 3 }] }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "这瓶按上季苏蔓留下的档归。{$b}还是那一排的人。你没有另开一格。",
      },
    ],
  },

  // —— 春日通用局：不绑节日，只在第 3 季 ——

  {
    id: "s3-soc-shot",
    kind: "social",
    cast: { a: guest },
    when: [spring],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}把聊天记录递过来。里面有一句你没说过的承诺。{$a}要你照这个办。",
    choices: [
      {
        label: "照记录里的办",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "hard-sell", valence: -2, subject: "player" } },
        ],
        result: "记录里那句办了。你没说过的承诺进了这单。{$a}把屏幕收起来。",
      },
      {
        label: "说这句不是你的",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
        ],
        result: "这句你没有认。聊天记录还在{$a}手机里。这单按你今天说的走。",
      },
      {
        label: "把你认过的那句再念一遍",
        when: [{ remembers: "$a", act: "kept-word", valence: "good" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "记录里那句放下了。你念的是之前认过的。{$a}听见两句不是同一句。",
      },
    ],
  },
  {
    id: "s3-soc-bring",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [spring],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}身边站着{$b}。{$a}说把人带来了，要你照{$a}的脸给{$b}开。",
    choices: [
      {
        label: "照{$a}的脸给{$b}开",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$b", act: "wrong-face", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "brought-friend", valence: 1, subject: "player" } },
        ],
        result: "{$b}这单照的是{$a}的脸。人带来了，脸没有分开。",
      },
      {
        label: "只看{$b}今天的脸",
        effects: [
          { opinion: "$b", delta: 3 }, { opinion: "$a", delta: -3 },
          { remember: { holder: "$b", act: "own-face", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "人是{$a}带来的。货按{$b}今天的脸开。{$a}要的那张没有用上。",
      },
      {
        label: "人带来了，脸仍分开",
        when: [{ remembers: "$a", act: "brought-friend" }],
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "brought-friend", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "人对上了。你仍看{$b}的脸，不照{$a}的。答应带来的是人，不是那张脸。",
      },
    ],
  },
  {
    id: "s3-soc-first",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [spring],
    weight: 7, tension: 1, cooldown: 6,
    text: "{$a}先到，{$b}后到，两个人都看着你。先顾一个，另一个就得等。",
    choices: [
      {
        label: "先顾{$a}",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "looked-after", valence: 1, subject: "player" } },
        ],
        result: "先顾的是{$a}。{$b}还站着。顺序按先来的走。",
      },
      {
        label: "先顾{$b}",
        effects: [
          { opinion: "$b", delta: 3 }, { opinion: "$a", delta: -4 },
          { remember: { holder: "$a", act: "sidelined", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "took-client", valence: 1, subject: "player" } },
        ],
        result: "先顾的是后到的{$b}。{$a}看见自己被放下。这单从{$b}开始。",
      },
      {
        label: "两人等同一面镜子",
        when: [{ bond: ["$a", "$b"], gte: 20 }],
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 1 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "两人等到同一面镜子。谁先谁后没有写成两单。",
      },
    ],
  },
  {
    id: "s3-soc-chat",
    kind: "social",
    cast: { a: guest },
    when: [spring],
    weight: 7, tension: -1, cooldown: 6,
    text: "{$a}要加你微信，说色号回去再定。人还站在柜前，单今天可以开。",
    choices: [
      {
        label: "先加微信，单明天再开",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "added-wechat", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 2 } },
        ],
        result: "微信加上了。这单今天不收。{$a}明天按记下的色号来。",
      },
      {
        label: "今天就开，微信不加",
        effects: [
          { opinion: "$a", delta: -2 },
          { remember: { holder: "$a", act: "sold-anyway", valence: -1, subject: "player" } },
        ],
        result: "单今天开了。微信没有加。色号就停在这一笔。",
      },
      {
        label: "微信里只记色号",
        when: [{ opinion: "$a", gte: 12 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "added-wechat", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 1 } },
        ],
        result: "微信里只有色号。别的{$a}没让你存。单仍等明天。",
      },
    ],
  },
  {
    id: "s3-soc-quiet",
    kind: "social",
    cast: { a: guest },
    when: [spring],
    weight: 7, tension: 1, cooldown: 6,
    text: "{$a}压低声音，不让你告诉付钱的人真实色号。钱已经在柜上。",
    choices: [
      {
        label: "色号照实写进记录",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "色号写进记录了。付钱的人以后对得上。{$a}没有再压声音。",
      },
      {
        label: "记录按{$a}的说法写",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "记录按{$a}的说法写了。付钱的人看到的不是脸上的色号。",
      },
      {
        label: "钱先退回，当面再定",
        when: [{ opinion: "$a", gte: 10 }],
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 2, slot: 2 } },
        ],
        result: "钱退回去了。色号等两个人都在再写。今天不封这一笔。",
      },
    ],
  },
  {
    id: "s3-soc-aisle",
    kind: "social",
    cast: { a: guest, b: rival },
    when: [spring],
    weight: 8, tension: 1, cooldown: 6,
    text: "对面{$b}把同款礼盒的价写在牌上。{$a}两头看，等你认不认这个数。",
    choices: [
      {
        label: "两个价都说完",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "price-plain", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "price-plain", valence: 1, subject: "player" } },
        ],
        result: "两个价都说完了。{$a}自己比。牌还在对面，人还在你这边。",
      },
      {
        label: "用小样补上这个差",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { stat: "compliance", delta: -3 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "price-pad", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "price-pad", valence: -1, subject: "player" } },
        ],
        result: "差价用小样垫上了。{$b}看见你认了牌上的数。记录里没有这一截。",
      },
      {
        label: "让{$a}自己去对面看",
        when: [{ opinion: "$b", gte: 4 }],
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 3 },
          { remember: { holder: "$b", act: "yielded-client", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "你没有拦。{$a}走到对面看了那个数。人还可能回来，这单先不写。",
      },
    ],
  },
  {
    id: "s3-soc-elder",
    kind: "social",
    cast: { a: guest },
    when: [spring],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}要给长辈买。纸条上的色号和{$a}自己的脸不是一回事。{$a}说别问那么多。",
    choices: [
      {
        label: "按纸条开",
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "wrong-face", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "sold-anyway", valence: -1, subject: "player" } },
        ],
        result: "按纸条开了。长辈的脸不在柜前。{$a}把问题按住了。",
      },
      {
        label: "只开你看得到的",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
        ],
        result: "纸条放下了。你只肯开{$a}自己用得上的。长辈那支没有走。",
      },
      {
        label: "两支分开写",
        when: [{ temper: "$a", is: "loyal" }],
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "两支分开写了。{$a}自己一笔，长辈一笔。纸条上的色号留在该在的那笔。",
      },
    ],
  },
  {
    id: "s3-soc-fast",
    kind: "social",
    cast: { a: guest },
    when: [spring],
    weight: 7, tension: 1, cooldown: 6,
    text: "{$a}说只有两分钟。记录还没写，{$a}要把货先拿走。",
    choices: [
      {
        label: "先写再给",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "货还在柜上。记录写完{$a}才拿走。两分钟已经过了。",
      },
      {
        label: "先给，记录后补",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "refused-gap", valence: -2, subject: "player" } },
        ],
        result: "货先走了。记录上这行是后补的。{$a}已经不在镜子前。",
      },
      {
        label: "只开一支，原话写短",
        when: [{ temper: "$a", is: "hasty" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "只开了一支。原话很短，写进记录了。其余的{$a}没有带走。",
      },
    ],
  },
  {
    id: "s3-soc-again",
    kind: "social",
    cast: { a: guest },
    when: [spring],
    weight: 8, tension: -1, cooldown: 6,
    text: "{$a}进门先停一下，要你认不认之前那句。人还没坐下。",
    choices: [
      {
        label: "认之前那句",
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "你认了。{$a}这才坐下。今天的单还没开。",
      },
      {
        label: "说先看今天",
        effects: [
          { opinion: "$a", delta: -2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "旧句放下了。{$a}听见你要看的是今天。人还站着。",
      },
      {
        label: "认，那次不该推",
        when: [{ remembers: "$a", act: "hard-sell", valence: "bad" }],
        effects: [
          { opinion: "$a", delta: 5 },
          { stat: "standing", delta: -1 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
        ],
        result: "你认了那次硬推。{$a}把旧盒子留下。今天这句和那次分开。",
      },
    ],
  },
  {
    id: "s3-soc-half",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [spring],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}和{$b}要分同一套。钱是一笔，两个人都要名字写在票上。",
    choices: [
      {
        label: "票只写{$a}",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -4 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$b", act: "sidelined", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "took-order", valence: -1, subject: "player" } },
        ],
        result: "票上只有{$a}。{$b}拿走了一半货，名字不在这张票上。",
      },
      {
        label: "写成两行各一半",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { stat: "compliance", delta: -2 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "票拆成两行。货仍然是一套。记录上看着像两单。",
      },
      {
        label: "名字写长辈那一笔",
        when: [{ bond: ["$a", "$b"], kind: "family" }],
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "名字写在长辈那行。两人拿走的是同一套里的不同支。记录没有拆成两单。",
      },
    ],
  },
  {
    id: "s3-soc-lens",
    kind: "social",
    cast: { a: guest },
    when: [spring],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}把镜头对着脸。要你在画面里把这支说满。人还没点头买。",
    choices: [
      {
        label: "镜头只对着产品",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "off-camera", valence: 2, subject: "player" } },
        ],
        result: "镜头挪开了。你说的是产品，不是{$a}的脸。画面里没有那句满话。",
      },
      {
        label: "对着脸把话说满",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "on-camera", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "claim-full", valence: -2, subject: "player" } },
        ],
        result: "镜头对着脸。那句说满了。{$a}还没点头，画面已经出去了。",
      },
      {
        label: "先关镜头再说话",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "off-camera", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "镜头关了。话是关了以后说的。{$a}要的那句没有进画面。",
      },
    ],
  },
  {
    id: "s3-soc-hold",
    kind: "social",
    cast: { a: guest },
    when: [spring],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}把袋子留在柜上，说明天来付。货已经包好，记录上还没有这笔。",
    choices: [
      {
        label: "袋子留下，写明未付",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 1 } },
        ],
        result: "袋子留下了。记录写着未付。{$a}明天来，这笔才算数。",
      },
      {
        label: "让{$a}先拿走",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "sold-anyway", valence: -2, subject: "player" } },
        ],
        result: "袋子拿走了。记录上没有这笔。明天付不付，柜上已经空了一支。",
      },
      {
        label: "只留小样，正装明天再包",
        when: [{ opinion: "$a", gte: 14 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "got-sample", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 2 } },
        ],
        result: "正装还在抽屉里。{$a}带走的是小样。明天来，再决定包不包。",
      },
    ],
  },
  {
    id: "s3-soc-owe",
    kind: "social",
    cast: { a: guest },
    when: [spring],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}说你欠一支色号，上次没给够。柜上没有那次的记录。",
    choices: [
      {
        label: "没有记录就不补",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "refused-gap", valence: -1, subject: "player" } },
        ],
        result: "没有补。记录上没有那一支。{$a}把这话带走了。",
      },
      {
        label: "补上，写明是你补的",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "covered-gap", valence: 2, subject: "player" } },
        ],
        result: "补上了。记录写明是你补的，不是上次那笔。{$a}把这支拿走。",
      },
      {
        label: "把上次的小样对上",
        when: [{ remembers: "$a", act: "got-sample" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "对上了。上次留下的是小样，不是这支正装。{$a}听见两件不是一件。",
      },
    ],
  },

  // —— 同事：罗曼、苏蔓、唐可、方敏、陆遥 ——

  {
    id: "s3-work-roman",
    kind: "floor",
    cast: { a: roman, b: guest },
    when: [spring],
    weight: 14, tension: 0, once: true,
    text: "罗曼把这季的表摊开。团购的数要进哪一列，笔在你这边。{$b}的名单还在柜上。",
    choices: [
      {
        label: "写进团队那一列",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -1 },
          { stat: "standing", delta: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "数进了团队那一列。你的名字在附注。罗曼把这一行收进表。",
      },
      {
        label: "写进你自己那一列",
        effects: [
          { opinion: "$a", delta: -5 },
          { stat: "standing", delta: -1 },
          { remember: { holder: "$a", act: "took-order", valence: -2, subject: "player" } },
        ],
        result: "数在你的列上。罗曼把团队那一列折到后面。{$b}的名单没有被签。",
      },
      {
        label: "表在你这边，这行仍写团队",
        when: [{ quality: "arc:roman:end", eq: 1 }],
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
        ],
        result: "这行仍写团队。表在你这边，罗曼没有把数改回个人列。",
      },
    ],
  },
  {
    id: "s3-work-suman",
    kind: "floor",
    cast: { a: suman, b: guest },
    when: [spring],
    weight: 14, tension: 0, once: true,
    text: "苏蔓把认的人圈出来。{$b}也在圈里。公司礼盒要算新客的话，这一圈就被拆开。",
    choices: [
      {
        label: "礼盒不算新客",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "looked-after", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "礼盒没有写成新客。{$b}还在苏蔓圈里。这单的数不进你的新名字。",
      },
      {
        label: "从圈里划出来",
        effects: [
          { opinion: "$a", delta: -6 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "took-client", valence: 1, subject: "player" } },
        ],
        result: "{$b}从圈里划出来了。礼盒算你这季的。苏蔓把笔放下。",
      },
      {
        label: "按上季的档留在圈里",
        when: [{ any: [{ quality: "arc:suman:end", eq: 1 }, { quality: "arc:suman:end", eq: 3 }] }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "{$b}留在圈里。这是上季苏蔓留下的档。礼盒另写一行，不拆这一圈。",
      },
    ],
  },
  {
    id: "s3-work-tangke",
    kind: "floor",
    cast: { a: tangke, b: guest },
    when: [spring],
    weight: 14, tension: 1, once: true,
    text: "唐可把一箱礼盒放在员工通道。这箱没进系统。唐可问这箱今天报不报。",
    choices: [
      {
        label: "写进记录",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "这箱进了记录。唐可少了一箱能私下周转的。账是齐的。",
      },
      {
        label: "先别写",
        effects: [
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "这箱没有进系统。唐可知道你替这箱压下了这一行。",
      },
      {
        label: "按调走之前的名字入",
        when: [{ quality: "arc:tangke:end", eq: 2 }],
        effects: [
          { opinion: "$a", delta: -1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
        ],
        result: "名字按调走之前那行入。箱子不进你的新客。唐可看见这箱没有算成你的。",
      },
    ],
  },
  {
    id: "s3-work-fangmin",
    kind: "floor",
    cast: { a: fangmin, b: guest },
    when: [spring],
    weight: 14, tension: 0, once: true,
    text: "方敏把文件夹放到你面前。里面有一行空着，是这季礼盒的领货人。{$b}还在等这行怎么写。",
    choices: [
      {
        label: "照看见的写，空着就空着",
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: -2 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "空着的还空着。方敏把这一页收进去。{$b}没有被写成别的名字。",
      },
      {
        label: "把空行写成{$b}",
        effects: [
          { opinion: "$b", delta: 3 }, { opinion: "$a", delta: -5 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "took-order", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "took-order", valence: 1, subject: "player" } },
        ],
        result: "空行写成{$b}。文件夹里原来没有这个名字。方敏没有当场改。",
      },
      {
        label: "这行不再点同事的名字",
        when: [{ remembers: "fangmin", act: "named-colleague", valence: "bad" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "同事的名字没有再写上。空行还空着。方敏把上季那页和这一页夹在一起。",
      },
    ],
  },
  {
    id: "s3-work-luyao",
    kind: "floor",
    cast: { a: luyao, b: guest },
    when: [spring, { day: { gte: 10 } }],
    weight: 14, tension: 1, once: true,
    text: "陆遥站在绳子边上，问{$b}要不要过来看同款。人还坐在你的凳子上。",
    choices: [
      {
        label: "让{$b}自己决定",
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "no-snatch", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "你没有拦，也没有推。{$b}自己看着绳子那边。凳子还是你的。",
      },
      {
        label: "当着{$b}把话压回去",
        effects: [
          { opinion: "$a", delta: -5 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "public-shame", valence: -1, subject: "player" } },
        ],
        result: "话压回去了。{$b}听见两边都在争。陆遥退开一步，记下这一次。",
      },
      {
        label: "情人节那句，今天还认",
        when: [{ quality: "s3:yield", gte: 1 }],
        effects: [
          { opinion: "$a", delta: -1 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$b", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "rival-line", valence: -1, subject: "player" } },
        ],
        result: "你把情人节那句又说了一遍。陆遥用的是同一句。{$b}听见先说的人是谁。",
      },
    ],
  },
];

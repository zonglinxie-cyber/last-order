// 第 4 季（秋）故事碎片。节日窗口见 content/festivals.ts：开学季、中秋、国庆。
// 季内反转靠普通 quality（s4:campus / s4:box / s4:side），换季会清掉。
// 春天照着别人的脸开过的货，靠 wrong-face 那条 ±2 记忆活到这一季。
// 角色槽可能落到男顾客身上，正文不写死「她」。同名选项不在这季使用。
import type { Storylet } from "../types.ts";

const guest: Storylet["cast"][string] = { where: [{ role: "$self", is: "customer" }] };
const rival: Storylet["cast"][string] = { where: [{ role: "$self", is: "rival" }] };
const roman: Storylet["cast"][string] = { id: "roman", where: [] };
const suman: Storylet["cast"][string] = { id: "suman", where: [] };
const tangke: Storylet["cast"][string] = { id: "tangke", where: [] };
const fangmin: Storylet["cast"][string] = { id: "fangmin", where: [] };
const luyao: Storylet["cast"][string] = { id: "luyao", where: [] };

const autumn = { season: { gte: 4, lte: 4 } } as const;

export const STORYLETS_SEASON4: Storylet[] = [
  // —— 开学季：预算、宿舍、兼职。s4:campus / s4:side 在这里埋 ——

  {
    id: "s4-sch-budget",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "school" }],
    weight: 18, tension: 0, cooldown: 3,
    text: "开学季。{$a}把预算写在备忘录第一行。套装过了这一行，{$a}问学生价还认不认。",
    choices: [
      {
        label: "按备忘录停",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 3 },
          { quality: "s4:campus", set: 1 },
          { remember: { holder: "$a", act: "budget-kept", valence: 2, subject: "player" } },
        ],
        result: "套装停在备忘录那一行。学生价认了，礼短了一截。",
      },
      {
        label: "过了也按学生价开",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -3 },
          { quality: "s4:campus", set: 1 },
          { remember: { holder: "$a", act: "over-budget", valence: -2, subject: "player" } },
        ],
        result: "套装开过了备忘录。学生价写成了这单的理由。数对不上。",
      },
      {
        label: "换成备忘录打得住的",
        when: [{ temper: "$a", is: "thrifty" }],
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: 2 },
          { quality: "s4:campus", set: 1 },
          { remember: { holder: "$a", act: "budget-kept", valence: 1, subject: "player" } },
        ],
        result: "换成备忘录里那个数打得住的小支。套装没有开。{$a}把第一行勾上了。",
      },
    ],
  },
  {
    id: "s4-sch-room",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [{ festival: "school" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "开学季。{$a}和{$b}把钱凑在一笔里。两个人都要名字，货只有一套。",
    choices: [
      {
        label: "票写{$a}",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -4 },
          { quality: "s4:campus", set: 1 },
          { remember: { holder: "$b", act: "sidelined", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "took-order", valence: -1, subject: "player" } },
        ],
        result: "票上只有{$a}。{$b}出了钱，名字不在这张票上。",
      },
      {
        label: "拆成两行",
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { stat: "compliance", delta: -2 },
          { quality: "s4:campus", set: 1 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "一笔钱拆成两行。货还是一套。记录上看着像两单。",
      },
      {
        label: "一套货，名字写在备注",
        when: [{ bond: ["$a", "$b"], gte: 15 }],
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { stat: "compliance", delta: 2 },
          { quality: "s4:campus", set: 1 },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 2, subject: "player" } },
        ],
        result: "货仍是一套。两个名字写在备注，不拆成两单。钱是谁凑的，备注里看得见。",
      },
    ],
  },
  {
    id: "s4-sch-parent",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [{ festival: "school" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "开学季。{$a}捏着卡，{$b}已经点好色号。付钱的人和用的人不是同一个。",
    choices: [
      {
        label: "按捏卡的人开",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$b", act: "wrong-face", valence: -2, subject: "player" } },
          { remember: { holder: "$a", act: "took-order", valence: -1, subject: "player" } },
        ],
        result: "单按{$a}的卡走。{$b}点的色号没有进这张票。",
      },
      {
        label: "按点色号的人开",
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -3 },
          { remember: { holder: "$b", act: "own-face", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "色号是{$b}的。卡还在{$a}手里，名字没有跟着色号走。",
      },
      {
        label: "卡和色号分开写",
        when: [{ bond: ["$a", "$b"], kind: "family" }],
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "卡是谁的、色号是谁的，写成两行。货可以是一套，名字不混。",
      },
    ],
  },
  {
    id: "s4-sch-mini",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "school" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "开学季。{$a}问的是正装的价，要拿走的是小样。正装{$a}说等生活费，先不买。",
    choices: [
      {
        label: "只给小样，正装不走",
        effects: [
          { opinion: "$a", delta: -1 },
          { stat: "compliance", delta: 2 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "got-sample", valence: 1, subject: "player" } },
        ],
        result: "小样给了。正装还在抽屉里。{$a}知道这两件不是一件。",
      },
      {
        label: "小样算进正装的价",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "price-pad", valence: -2, subject: "player" } },
        ],
        result: "小样拿走了，价却写成正装。记录里这支对不上抽屉。",
      },
      {
        label: "小样留下，正装等生活费",
        when: [{ opinion: "$a", gte: 6 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 3, slot: 2 } },
        ],
        result: "小样先带走。正装等生活费。{$a}过几天再来，这支还写在记录里。",
      },
    ],
  },
  {
    id: "s4-sch-cut",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "school" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "开学季。{$a}说能把宿舍的人带来，要你从每单里留一截，不写进记录。",
    choices: [
      {
        label: "不留这截，人自己来",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "refused-gap", valence: -1, subject: "player" } },
        ],
        result: "这一截没有留。{$a}没有答应带人。记录里也不该有这一行。",
      },
      {
        label: "留一截，不写进记录",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -6 },
          { stat: "standing", delta: -1 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "每单留了一截。记录里没有这一行。宿舍的人以后算谁的，对不上。",
      },
      {
        label: "人可以带来，钱不从单里扣",
        when: [{ opinion: "$a", gte: 8 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "brought-friend", valence: 2, subject: "player" } },
          { appoint: { person: "$a", inDays: 2, slot: 2 } },
        ],
        result: "人可以带来。钱不从单里扣。{$a}过两天把宿舍的人带到柜前，单仍各写各的。",
      },
    ],
  },
  {
    id: "s4-sch-note",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "school" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "开学季。{$a}纸条上的色号和脸上的不是一支。{$a}说纸条是别人写的，别改。",
    choices: [
      {
        label: "按纸条开",
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "wrong-face", valence: -2, subject: "player" } },
        ],
        result: "按纸条开了。{$a}脸上的那支没有进这单。纸条是谁写的，记录里看不出。",
      },
      {
        label: "按今天这张脸开",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "own-face", valence: 2, subject: "player" } },
        ],
        result: "纸条放下了。这单按{$a}今天的脸。别人写的那支没有走。",
      },
      {
        label: "纸条和脸分成两笔",
        when: [{ temper: "$a", is: "loyal" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "两笔分开。纸条上一笔，{$a}的脸一笔。谁用哪支，写在该在的那行。",
      },
    ],
  },
  {
    id: "s4-sch-rival",
    kind: "floor",
    cast: { a: luyao, b: guest },
    when: [{ festival: "school" }],
    weight: 18, tension: 1, cooldown: 3,
    text: "开学季。陆遥递给{$b}一张兼职的纸条，让{$b}去数宿舍的人。{$b}问你这张纸条接不接。",
    choices: [
      {
        label: "让{$b}把纸条接了",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 1 },
          { stat: "standing", delta: -1 },
          { quality: "s4:side", set: 1 },
          { remember: { holder: "$a", act: "yielded-client", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "yielded-client", valence: -1, subject: "player" } },
        ],
        result: "纸条接了。{$b}去对面数人。你这边少了一条把人带回来的路。",
      },
      {
        label: "把纸条按下",
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: -2 },
          { quality: "s4:side", set: 1 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "纸条没有接。{$b}留在凳子上。陆遥记下你当众按下。",
      },
      {
        label: "留一句你的，不拿对面的数",
        when: [{ opinion: "$b", gte: 6 }],
        effects: [
          { opinion: "$b", delta: 2 }, { opinion: "$a", delta: -1 },
          { quality: "s4:side", set: 1 },
          { remember: { holder: "$b", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "no-snatch", valence: 2, subject: "player" } },
        ],
        result: "{$b}不拿那张纸条。你留下一句自己的，让{$b}回去说。数不归对面。",
      },
    ],
  },

  // —— 中秋：礼盒写给谁。开学的预算在这里翻 ——

  {
    id: "s4-moon-box",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "midautumn" }],
    weight: 18, tension: 1, cooldown: 4,
    text: "中秋。{$a}要一只礼盒，盒子上写妈妈。{$a}又说别把客户和这行写在一起。",
    choices: [
      {
        label: "盒子上只写妈妈",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -3 },
          { quality: "s4:box", set: 1 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "盒子上写了妈妈。{$a}说的客户没有进这一行。",
      },
      {
        label: "问清是客户还是家里",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { quality: "s4:box", set: 1 },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
        ],
        result: "问了。{$a}把盒子推回来。妈妈那行没有落笔。",
      },
      {
        label: "两只盒子各写各的",
        when: [{ opinion: "$a", gte: 8 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { quality: "s4:box", set: 1 },
          { remember: { holder: "$a", act: "fair-split", valence: 2, subject: "player" } },
        ],
        result: "两只分开了。妈妈一只，客户一只。卡够不够，是下一句的事。",
      },
    ],
  },
  {
    id: "s4-moon-mom",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [{ festival: "midautumn" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "中秋。{$a}付钱，{$b}挑礼。{$a}说这是家里的，{$b}说钱是自己的。",
    choices: [
      {
        label: "按付钱的人写",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "took-order", valence: -1, subject: "player" } },
        ],
        result: "名字写的是{$a}。{$b}挑的礼进了别人的票。",
      },
      {
        label: "按挑礼的人写",
        effects: [
          { opinion: "$b", delta: 3 }, { opinion: "$a", delta: -3 },
          { remember: { holder: "$b", act: "own-face", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "broke-word", valence: -1, subject: "player" } },
        ],
        result: "名字写的是{$b}。{$a}的钱还在，家里那句没有落在票上。",
      },
      {
        label: "对上开学那笔预算",
        when: [{ quality: "s4:campus", gte: 1 }],
        effects: [
          { opinion: "$b", delta: -2 }, { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$b", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "budget-kept", valence: 1, subject: "player" } },
        ],
        result: "开学那行对上了。备忘录里的数是家里的礼金，{$b}只是经手。自己的钱这句话对不上。",
      },
    ],
  },
  {
    id: "s4-moon-invoice",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "midautumn" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "中秋。{$a}要把月饼和礼盒开在同一张专票上。月饼不是柜上的货。",
    choices: [
      {
        label: "专票只开礼盒",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "专票上只有礼盒。月饼没有进这一行。{$a}得自己去解释那一截。",
      },
      {
        label: "月饼也写进这张票",
        effects: [
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: -6 },
          { remember: { holder: "$a", act: "took-order", valence: -2, subject: "player" } },
        ],
        result: "月饼写进了柜上的专票。这行和抽屉对不上。{$a}把票收走了。",
      },
      {
        label: "两张单分开",
        when: [{ stat: "compliance", gte: 45 }],
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "礼盒一张。月饼不在这本里。{$a}得另找地方开那一截。",
      },
    ],
  },
  {
    id: "s4-moon-two",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "midautumn" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "中秋。{$a}要两只礼盒，给两位长辈。预算只够一只把名字写满。",
    choices: [
      {
        label: "名字只写满一只",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "budget-kept", valence: 2, subject: "player" } },
        ],
        result: "只有一只写了名字。另一只还在柜上。{$a}得自己去说谁没有这份。",
      },
      {
        label: "两只都写，预算撑开",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "over-budget", valence: -2, subject: "player" } },
        ],
        result: "两只都写了名字。预算那行被撑开。{$a}没有再对那个数。",
      },
      {
        label: "另一只写明下次",
        when: [{ temper: "$a", is: "loyal" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 2, slot: 1 } },
        ],
        result: "这一只名字写满了。另一只写明下次。{$a}过两天再来，不会把两只混成一笔。",
      },
    ],
  },
  {
    id: "s4-moon-label",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "midautumn" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "中秋。{$a}要把化妆品塞进食品礼盒。盒子上的品名和里面的不是一类。",
    choices: [
      {
        label: "品名改成里面的",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "品名改了。盒子看起来不像原来那只。里面和外面是同一类。",
      },
      {
        label: "盒子照旧封上",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -5 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "盒子照旧封上了。品名还是食品。里面不是。{$a}把这只带走。",
      },
      {
        label: "分成两只盒子",
        when: [{ opinion: "$a", gte: 6 }],
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "食品一只，化妆品一只。品名各写各的。{$a}得拿两只走。",
      },
    ],
  },
  {
    id: "s4-moon-face",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "midautumn" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "中秋。{$a}要你别说这是便宜的那套。旁边有人在听。",
    choices: [
      {
        label: "照实说是哪套",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "price-plain", valence: 2, subject: "player" } },
        ],
        result: "哪套说了。旁边的人听见了。{$a}把礼盒往回推了推。",
      },
      {
        label: "不说价格，只说盒子",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 1, subject: "player" } },
        ],
        result: "价格没有出口。旁边的人只听见盒子。便宜的那套没有被点破。",
      },
      {
        label: "请到边上再说",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "price-plain", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "stood-aside", valence: 1, subject: "player" } },
          { move: { person: "$a", zone: "lounge" } },
        ],
        result: "人请到边上。哪套在边上说了。柜台前没有听见这个数。",
      },
    ],
  },
  {
    id: "s4-moon-rival",
    kind: "floor",
    cast: { a: luyao, b: guest },
    when: [{ festival: "midautumn" }],
    weight: 16, tension: 1, cooldown: 4,
    text: "中秋。陆遥在礼盒上多搁了一块月饼。{$b}问你这边有没有同样的。",
    choices: [
      {
        label: "说没有，价照柜上",
        effects: [
          { opinion: "$b", delta: -2 }, { opinion: "$a", delta: -1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$b", act: "price-plain", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "no-snatch", valence: 1, subject: "player" } },
        ],
        result: "月饼这截你说了没有。价仍是柜上的。{$b}看着对面的盒子。",
      },
      {
        label: "也搁一块，不写进单",
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$b", act: "covered-gap", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "price-pad", valence: -1, subject: "player" } },
        ],
        result: "盒子上多了一块。单里没有这一行。陆遥看见你跟着搁。",
      },
      {
        label: "让{$b}把两个盒子都打开",
        when: [{ opinion: "$b", gte: 8 }],
        effects: [
          { opinion: "$b", delta: 2 }, { opinion: "$a", delta: 1 },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "no-snatch", valence: 2, subject: "player" } },
        ],
        result: "两个盒子都打开了。{$b}自己看里面差什么。你没有先认对面的加法。",
      },
    ],
  },
  {
    id: "s4-moon-fangmin",
    kind: "floor",
    cast: { a: fangmin, b: guest },
    when: [{ festival: "midautumn" }],
    weight: 16, tension: 0, cooldown: 4,
    text: "中秋。方敏对礼盒的品名。{$b}要的那行和盒子里的货对不上。",
    choices: [
      {
        label: "照盒子里的写",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "refused-gap", valence: -1, subject: "player" } },
        ],
        result: "品名照盒子里的货写了。{$b}要的那行没有补上。方敏把这一页收好。",
      },
      {
        label: "照{$b}要的写",
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -5 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "took-order", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "covered-gap", valence: 1, subject: "player" } },
        ],
        result: "这一行照{$b}要的写了。盒子里并不是这只。方敏没有当场划掉。",
      },
      {
        label: "翻到收过的那页照写",
        when: [{ remembers: "fangmin", act: "same-as-record" }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "folder-kept", valence: 1, subject: "player" } },
        ],
        result: "这一页照方敏收过的写法。品名和盒子里的货仍是同一行。",
      },
    ],
  },

  // —— 国庆：队、截图、退回来的盒子。兼职和礼盒在这里翻 ——

  {
    id: "s4-nat-line",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [{ festival: "national" }],
    weight: 18, tension: 1, cooldown: 3,
    text: "国庆。{$a}和{$b}挤在同一条绳子里。两个人都说自己先到。你只能先接一个。",
    choices: [
      {
        label: "先接{$a}",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "looked-after", valence: 1, subject: "player" } },
        ],
        result: "先接的是{$a}。{$b}还在绳子里。先到的那句没有写成记录。",
      },
      {
        label: "先接{$b}",
        effects: [
          { opinion: "$b", delta: 3 }, { opinion: "$a", delta: -4 },
          { remember: { holder: "$a", act: "sidelined", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "took-client", valence: 1, subject: "player" } },
        ],
        result: "先接的是{$b}。{$a}看见绳子没有保住自己的位置。",
      },
      {
        label: "问是不是对面数来的",
        when: [{ quality: "s4:side", gte: 1 }],
        effects: [
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: -1 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "rival-line", valence: -1, subject: "player" } },
        ],
        result: "问出来了。{$a}口袋里还有开学那张纸条。这条队是对面数来的，不是路过。",
      },
    ],
  },
  {
    id: "s4-nat-tour",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "national" }],
    weight: 16, tension: 1, cooldown: 3,
    text: "国庆。{$a}说团只停十分钟。一整团要同一支，{$a}自己的脸并不要这支。",
    choices: [
      {
        label: "按团开同一支",
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "wrong-face", valence: -2, subject: "player" } },
        ],
        result: "一整团开成同一支。{$a}的脸没有进这单。十分钟够把货拿走。",
      },
      {
        label: "只开{$a}的脸",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "own-face", valence: 2, subject: "player" } },
        ],
        result: "团那支没有开。只看了{$a}的脸。人走的时候，其余的没有带走。",
      },
      {
        label: "十分钟只开一支，写明没试",
        when: [{ temper: "$a", is: "hasty" }],
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "只开了一支。记录写明没试。团要的和{$a}的脸没有混成一句。",
      },
    ],
  },
  {
    id: "s4-nat-shot",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "national" }],
    weight: 16, tension: 0, cooldown: 3,
    text: "国庆。{$a}把活动截图递过来。图上的到手价和柜上的标价差一截。",
    choices: [
      {
        label: "两个价都说完",
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "hand-price", valence: 2, subject: "player" } },
        ],
        result: "到手价和标价都说了。截图留在{$a}手机里。柜上仍按标价。",
      },
      {
        label: "按截图上的数开",
        effects: [
          { opinion: "$a", delta: 5 },
          { stat: "compliance", delta: -5 },
          { remember: { holder: "$a", act: "price-pad", valence: -2, subject: "player" } },
        ],
        result: "这单按截图收了。标价和到手价的差没有写进记录。",
      },
      {
        label: "这个数只对这一单",
        when: [{ temper: "$a", is: "thrifty" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "hand-price", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "price-plain", valence: 1, subject: "player" } },
        ],
        result: "截图上的数只停在{$a}这一单。没有写成今天柜上的价。",
      },
    ],
  },
  {
    id: "s4-nat-rival",
    kind: "floor",
    cast: { a: luyao, b: guest },
    when: [{ festival: "national" }],
    weight: 18, tension: 1, once: true,
    text: "国庆。陆遥沿着绳子把人往对面带。{$b}已经跟着走了两步，又回头看你。",
    choices: [
      {
        label: "把{$b}留住",
        effects: [
          { opinion: "$b", delta: 2 }, { opinion: "$a", delta: -4 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "looked-after", valence: 1, subject: "player" } },
        ],
        result: "{$b}停在你这边。那两步没有走完。陆遥记下你把人留住。",
      },
      {
        label: "让这截队过去",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { stat: "standing", delta: -1 },
          { remember: { holder: "$a", act: "yielded-client", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "yielded-client", valence: -1, subject: "player" } },
        ],
        result: "这截队过去了。{$b}的单不写你的名字。绳子那边今天人更多。",
      },
      {
        label: "开学那张纸条今天对上",
        when: [{ quality: "s4:side", gte: 1 }],
        effects: [
          { opinion: "$b", delta: 1 }, { opinion: "$a", delta: -2 },
          { remember: { holder: "$b", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "rival-line", valence: -1, subject: "player" } },
        ],
        result: "纸条对上了。{$b}是开学季被对面数去的人。跟着走的这两步，不是今天才开始的。",
      },
    ],
  },
  {
    id: "s4-nat-stock",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "national" }],
    weight: 16, tension: 0, cooldown: 3,
    text: "国庆。{$a}点的那支抽屉里没有。{$a}要你先答应，人多，不能空着手走。",
    choices: [
      {
        label: "没有就说没有",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "refused-gap", valence: -1, subject: "player" } },
        ],
        result: "这支说了没有。{$a}空着手离开这一截。记录里没有补一支别的。",
      },
      {
        label: "用别的先顶上",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "sold-anyway", valence: -2, subject: "player" } },
        ],
        result: "别的顶上了。{$a}没有空着手走。点的那支仍然不在这单里。",
      },
      {
        label: "写下这支，明天留一支",
        when: [{ opinion: "$a", gte: 6 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 1 } },
        ],
        result: "这支写下了。{$a}明天来取。今天不拿别的顶。",
      },
    ],
  },
  {
    id: "s4-nat-back",
    kind: "social",
    cast: { a: guest },
    when: [{ festival: "national" }],
    weight: 18, tension: 1, cooldown: 3,
    text: "国庆。{$a}把中秋的礼盒退回来。盒子上写着妈妈，{$a}说人没收到。",
    choices: [
      {
        label: "照盒子上的名字退",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
        ],
        result: "退的是盒子上的名字。{$a}今天不另开。妈妈那行还在。",
      },
      {
        label: "换成{$a}的新单",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "sold-anyway", valence: -2, subject: "player" } },
        ],
        result: "盒子留下，新单开了。妈妈那行没有冲掉。{$a}拿的是另一支。",
      },
      {
        label: "对上中秋那行客户",
        when: [{ quality: "s4:box", gte: 1 }],
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
        ],
        result: "中秋那行对上了。妈妈是拿来过目的名字。盒子是给客户的，客户没签收。",
      },
    ],
  },
  {
    id: "s4-nat-roman",
    kind: "floor",
    cast: { a: roman, b: guest },
    when: [{ festival: "national" }],
    weight: 16, tension: 0, once: true,
    text: "国庆。罗曼把加班表推过来。晚班空着一格。{$b}还在绳子里，人走不完。",
    choices: [
      {
        label: "你留下看晚班",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 1 },
          { stat: "standing", delta: 1 },
          { stat: "energy", delta: -6 },
          { remember: { holder: "$a", act: "helped-out", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "looked-after", valence: 1, subject: "player" } },
        ],
        result: "你留下了。晚班这格写了你的名字。{$b}还在，绳子短了一截。",
      },
      {
        label: "这格不写你",
        effects: [
          { opinion: "$a", delta: -3 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "stood-aside", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "晚班没有你。罗曼把表收回去。{$b}还在绳子里。",
      },
      {
        label: "这格仍按罗曼的格式",
        when: [{ quality: "arc:roman:end", eq: 1 }],
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
        ],
        result: "晚班这格按罗曼留下的格式写。表在你这边，空格没有改成你的个人列。",
      },
    ],
  },

  // —— 秋日通用局：只在第 4 季 ——

  {
    id: "s4-soc-dorm",
    kind: "social",
    cast: { a: guest },
    when: [autumn],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}把宿舍的名单摊在柜上。每个人要的色号不一样，钱却是一笔。",
    choices: [
      {
        label: "一笔钱只开一个色号",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "wrong-face", valence: -1, subject: "player" } },
        ],
        result: "一笔钱一个色号。名单上其余的人没有进这单。{$a}得回去解释。",
      },
      {
        label: "按名单逐个写",
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "名单逐个写了。钱仍是一笔。记录上看着像很多单。",
      },
      {
        label: "人来一个写一个",
        when: [{ opinion: "$a", gte: 6 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 2, slot: 2 } },
        ],
        result: "名单留下了。人来一个，写一个。今天不把整张一次开完。",
      },
    ],
  },
  {
    id: "s4-soc-empty",
    kind: "social",
    cast: { a: guest },
    when: [autumn],
    weight: 7, tension: -1, cooldown: 6,
    text: "{$a}把空瓶放上来。说开学了，照上次那支再来一支。",
    choices: [
      {
        label: "照空瓶再开",
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "sold-anyway", valence: -1, subject: "player" } },
        ],
        result: "又开了空瓶上那支。今天的脸没有改这一笔。{$a}把空瓶带走。",
      },
      {
        label: "看今天的脸",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "own-face", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
        ],
        result: "空瓶留下了。这单看的是今天的脸。上次那支没有自动再开。",
      },
      {
        label: "上次那句还在",
        when: [{ remembers: "$a", act: "honest-advice", valence: "good" }],
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "上次那句又说了一遍。空瓶还在。这单按那句，不按瓶子上的色号。",
      },
    ],
  },
  {
    id: "s4-soc-stool",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [autumn],
    weight: 7, tension: 1, cooldown: 6,
    text: "{$a}占着凳子，{$b}站在后面。凳子只有一个，两个人都要先试。",
    choices: [
      {
        label: "凳子留给先坐下的",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -3 },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
          { remember: { holder: "$a", act: "looked-after", valence: 1, subject: "player" } },
        ],
        result: "凳子还是{$a}的。{$b}站着等。先试的是先坐下的人。",
      },
      {
        label: "让站着的人先试",
        effects: [
          { opinion: "$b", delta: 3 }, { opinion: "$a", delta: -4 },
          { remember: { holder: "$a", act: "public-shame", valence: -1, subject: "player" } },
          { remember: { holder: "$b", act: "took-client", valence: 1, subject: "player" } },
        ],
        result: "先试的是{$b}。{$a}还坐着，脸没有被先看。凳子变成了等的地方。",
      },
      {
        label: "两人轮，单先不开",
        when: [{ bond: ["$a", "$b"], gte: 10 }],
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 1 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "两人轮着试。单先不开。凳子没有变成谁的位子。",
      },
    ],
  },
  {
    id: "s4-soc-class",
    kind: "social",
    cast: { a: guest },
    when: [autumn],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}亮出同学的付款截图。要你按那个价，说一整间屋子都是这个数。",
    choices: [
      {
        label: "截图和标价都说完",
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "hand-price", valence: 2, subject: "player" } },
        ],
        result: "两个价都说了。一整间屋子的价没有成立。{$a}这单仍看标价。",
      },
      {
        label: "按截图开这单",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "price-pad", valence: -2, subject: "player" } },
        ],
        result: "这单按截图开了。一整间屋子的价没有写进记录，差价却进了这支。",
      },
      {
        label: "这个数只停在这一单",
        when: [{ temper: "$a", is: "thrifty" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "price-plain", valence: 1, subject: "player" } },
        ],
        result: "这个数只停在{$a}这一单。屋子里别人的价没有写成柜上的规矩。",
      },
    ],
  },
  {
    id: "s4-soc-roomprice",
    kind: "social",
    cast: { a: guest, b: guest },
    when: [autumn],
    weight: 7, tension: 1, cooldown: 6,
    text: "{$a}不让你把成交价告诉{$b}。{$b}就在两步外，听得见你开口不开口。",
    choices: [
      {
        label: "价当众说完",
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "price-plain", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "price-plain", valence: 2, subject: "player" } },
        ],
        result: "价说完了。{$b}听见的和{$a}付的是同一个数。{$a}没有再压声音。",
      },
      {
        label: "价只告诉{$a}",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "sidelined", valence: -1, subject: "player" } },
        ],
        result: "价只进了{$a}的耳朵。{$b}站在两步外，没有听见这个数。",
      },
      {
        label: "两个人听到同一个数",
        when: [{ any: [{ bond: ["$a", "$b"], kind: "friend" }, { bond: ["$a", "$b"], kind: "family" }] }],
        effects: [
          { opinion: "$a", delta: 1 }, { opinion: "$b", delta: 2 },
          { stat: "compliance", delta: 2 },
          { bond: ["$a", "$b"], delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "price-plain", valence: 1, subject: "player" } },
        ],
        result: "同一个数说了两遍。{$a}和{$b}听见的没有差。这单不再分成两套说法。",
      },
    ],
  },
  {
    id: "s4-soc-aisle",
    kind: "social",
    cast: { a: guest, b: rival },
    when: [autumn],
    weight: 8, tension: 1, cooldown: 6,
    text: "对面{$b}把礼盒叠在价牌旁边。{$a}问你这边的盒子里是不是少了东西。",
    choices: [
      {
        label: "照实说少了什么",
        effects: [
          { opinion: "$a", delta: -2 }, { opinion: "$b", delta: 1 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "price-plain", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "no-snatch", valence: 1, subject: "player" } },
        ],
        result: "少的那截说了。{$a}知道两只盒子不是一样满。价仍按你柜上的。",
      },
      {
        label: "用小样把盒子凑齐",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { stat: "compliance", delta: -3 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "price-pad", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "price-pad", valence: -1, subject: "player" } },
        ],
        result: "盒子用小样凑齐了。看起来和对面一样满。记录里没有这截。",
      },
      {
        label: "两个盒子都打开看",
        when: [{ opinion: "$b", gte: 4 }],
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "no-snatch", valence: 1, subject: "player" } },
        ],
        result: "两只都打开了。{$a}自己看少什么。你没有先认对面的加法。",
      },
    ],
  },
  {
    id: "s4-soc-family",
    kind: "social",
    cast: { a: guest },
    when: [autumn],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}给家里买和给自己买混在一句话里。你问是哪一张脸，{$a}说都一样。",
    choices: [
      {
        label: "按{$a}的脸开全部",
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "wrong-face", valence: -1, subject: "player" } },
        ],
        result: "全部按{$a}的脸开了。家里那张脸不在柜前。{$a}说都一样，你照做了。",
      },
      {
        label: "只开说得清的那张",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "honest-advice", valence: 2, subject: "player" } },
        ],
        result: "说不清的那张没有开。{$a}只拿走对得上脸的一支。家里那句先放下。",
      },
      {
        label: "家里和自己分成两笔",
        when: [{ temper: "$a", is: "loyal" }],
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "fair-split", valence: 2, subject: "player" } },
        ],
        result: "两笔分开。自己一笔，家里一笔。都一样这句话没有写进记录。",
      },
    ],
  },
  {
    id: "s4-soc-rush",
    kind: "social",
    cast: { a: guest },
    when: [autumn],
    weight: 7, tension: 1, cooldown: 6,
    text: "{$a}说后面还有人等。试用可以省，货要先包。",
    choices: [
      {
        label: "不试不包",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "货没有包。{$a}还在等的队伍里。脸没有试，单也没有开。",
      },
      {
        label: "不试也包",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "sold-anyway", valence: -2, subject: "player" } },
        ],
        result: "货包走了。脸没有试。后面的人往前走了一步，这单已经封上。",
      },
      {
        label: "试一处再包，写明只试了这里",
        when: [{ temper: "$a", is: "hasty" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "honest-advice", valence: 1, subject: "player" } },
        ],
        result: "只试了一处就包了。记录写明只试了这里。其余的没有说满。",
      },
    ],
  },
  {
    id: "s4-soc-again",
    kind: "social",
    cast: { a: guest },
    when: [autumn],
    weight: 8, tension: -1, cooldown: 6,
    text: "{$a}说你之前照着别人的脸开过错。要你今天先认，再谈这单。",
    choices: [
      {
        label: "先认再谈",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "standing", delta: -1 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
        ],
        result: "你先认了。{$a}这才把今天的脸转过来。单还没开。",
      },
      {
        label: "先看今天的脸",
        effects: [
          { opinion: "$a", delta: -3 },
          { remember: { holder: "$a", act: "own-face", valence: 1, subject: "player" } },
        ],
        result: "旧账放下了。{$a}听见你要看的是今天。人还站着，没有坐下。",
      },
      {
        label: "把那次的照片对上",
        when: [{ remembers: "$a", act: "wrong-face", valence: "bad" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "same-as-record", valence: 1, subject: "player" } },
        ],
        result: "那次对上了。货是照着别人的脸开的。{$a}今天这张脸你先看，再决定开不开。",
      },
    ],
  },
  {
    id: "s4-soc-split",
    kind: "social",
    cast: { a: guest },
    when: [autumn],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}要把一套拆开，便宜的留下，贵的退。小票是一整套。",
    choices: [
      {
        label: "整套退，不拆",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "整套退了。便宜的那支也没有留下。小票和货还是一件事。",
      },
      {
        label: "拆开，只退贵的",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "price-pad", valence: -2, subject: "player" } },
        ],
        result: "贵的退了，便宜的留下。小票仍是一整套。抽屉和票对不齐。",
      },
      {
        label: "明天拿齐再对",
        when: [{ opinion: "$a", gte: 8 }],
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 1, slot: 0 } },
        ],
        result: "今天不拆。{$a}明天把一套拿齐再对。小票先留在柜上。",
      },
    ],
  },
  {
    id: "s4-soc-unbox",
    kind: "social",
    cast: { a: guest },
    when: [autumn],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}要开箱拍。镜头先对着你的工牌，再对着脸。人还没说买。",
    choices: [
      {
        label: "工牌可以，脸不行",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 1 },
          { remember: { holder: "$a", act: "off-camera", valence: 2, subject: "player" } },
        ],
        result: "工牌进了画面。脸没有。{$a}要的那句满话没有对着脸说。",
      },
      {
        label: "脸也让拍",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -3 },
          { remember: { holder: "$a", act: "on-camera", valence: -2, subject: "player" } },
        ],
        result: "脸进了画面。人还没买，镜头已经出去。工牌和脸在同一段里。",
      },
      {
        label: "关了镜头再转工牌",
        when: [{ temper: "$a", is: "face" }],
        effects: [
          { opinion: "$a", delta: 2 },
          { remember: { holder: "$a", act: "off-camera", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
        ],
        result: "镜头关了。工牌是关了以后给看的。这段画面里没有脸。",
      },
    ],
  },
  {
    id: "s4-soc-hold",
    kind: "social",
    cast: { a: guest },
    when: [autumn],
    weight: 7, tension: -1, cooldown: 6,
    text: "{$a}说生活费下周到。这支先放在柜上，名字要先写上。",
    choices: [
      {
        label: "名字写下，货不拿走",
        effects: [
          { opinion: "$a", delta: -1 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { appoint: { person: "$a", inDays: 3, slot: 2 } },
        ],
        result: "名字写下了。货还在抽屉里。记录写明未付。{$a}下周来，这笔才算走。",
      },
      {
        label: "先拿走，记录下周补",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "sold-anyway", valence: -2, subject: "player" } },
        ],
        result: "货拿走了。名字写在一张还没付款的纸上。下周补不补，抽屉已经少一支。",
      },
      {
        label: "小样先占这个色号",
        when: [{ opinion: "$a", gte: 10 }],
        effects: [
          { opinion: "$a", delta: 2 },
          { stat: "compliance", delta: 2 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "got-sample", valence: 1, subject: "player" } },
          { appoint: { person: "$a", inDays: 3, slot: 1 } },
        ],
        result: "正装还在。{$a}带走的是小样，占的是这个色号。生活费到了再开正装。",
      },
    ],
  },
  {
    id: "s4-soc-owe",
    kind: "social",
    cast: { a: guest },
    when: [autumn],
    weight: 7, tension: 0, cooldown: 6,
    text: "{$a}说开学那张名单上少了自己。名单不在你手里，{$a}要你补一支。",
    choices: [
      {
        label: "名单不在就不补",
        effects: [
          { opinion: "$a", delta: -4 },
          { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "refused-gap", valence: -1, subject: "player" } },
        ],
        result: "没有补。名单不在柜上。{$a}要的那支没有因为一句话就走。",
      },
      {
        label: "补上，写明是补的",
        effects: [
          { opinion: "$a", delta: 3 },
          { stat: "compliance", delta: -2 },
          { remember: { holder: "$a", act: "covered-gap", valence: 2, subject: "player" } },
        ],
        result: "补上了。记录写明是补的，不是开学那张名单。{$a}把这支拿走。",
      },
      {
        label: "对上开学那份预算",
        when: [{ quality: "s4:campus", gte: 1 }],
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
        ],
        result: "开学那份对上了。{$a}的名字在备忘录里，不在一份公司名单上。少的是预算，不是这一支。",
      },
    ],
  },

  // —— 同事 ——

  {
    id: "s4-work-roman",
    kind: "floor",
    cast: { a: roman, b: guest },
    when: [autumn],
    weight: 14, tension: 0, once: true,
    text: "罗曼把开学这周的数和后面的班放在一起。要你先看哪一格。{$b}还在柜台前。",
    choices: [
      {
        label: "先看这周的数",
        effects: [
          { opinion: "$a", delta: -3 },
          { stat: "standing", delta: -1 },
          { remember: { holder: "$a", act: "took-order", valence: -1, subject: "player" } },
        ],
        result: "你先看了自己的数。后面的班还空着。罗曼把那一格折到后面。",
      },
      {
        label: "先看后面的班",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "helped-out", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "looked-after", valence: 1, subject: "player" } },
        ],
        result: "你先看了班。这周的数还摊着。罗曼没有催你报个人的那一列。",
      },
      {
        label: "表在你这边，数仍先看团队",
        when: [{ quality: "arc:roman:end", eq: 1 }],
        effects: [
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "kept-word", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
        ],
        result: "数仍先看团队那一列。表在你这边，罗曼没有把这周改成你一个人的。",
      },
    ],
  },
  {
    id: "s4-work-suman",
    kind: "floor",
    cast: { a: suman, b: guest },
    when: [autumn],
    weight: 14, tension: 0, once: true,
    text: "苏蔓把要送礼的老客圈出来。{$b}在圈里，也在你今天的新客里。两本不能都算。",
    choices: [
      {
        label: "留在苏蔓的圈里",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -2 },
          { remember: { holder: "$a", act: "looked-after", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "stood-aside", valence: 1, subject: "player" } },
        ],
        result: "{$b}留在圈里。礼盒不算你的新客。苏蔓把这一本收好。",
      },
      {
        label: "算你今天的新客",
        effects: [
          { opinion: "$a", delta: -5 }, { opinion: "$b", delta: 2 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "took-client", valence: 1, subject: "player" } },
        ],
        result: "{$b}从圈里划出来了。今天这单写你的名字。苏蔓没有再把人放回去。",
      },
      {
        label: "按留下的档，礼盒另写一行",
        when: [{ any: [{ quality: "arc:suman:end", eq: 1 }, { quality: "arc:suman:end", eq: 3 }] }],
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "{$b}还在上季留下的档里。礼盒另写一行，不拆这一圈，也不算你的新名字。",
      },
    ],
  },
  {
    id: "s4-work-tangke",
    kind: "floor",
    cast: { a: tangke, b: guest },
    when: [autumn],
    weight: 14, tension: 1, once: true,
    text: "唐可说这季礼盒会不够。一箱还放在通道里，仍没进系统。唐可问现在报不报。",
    choices: [
      {
        label: "现在就入账",
        effects: [
          { opinion: "$a", delta: -2 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
        ],
        result: "这箱进了系统。唐可少了一箱能先垫上的货。账在断货之前就是齐的。",
      },
      {
        label: "等断了再报",
        effects: [
          { opinion: "$a", delta: 4 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "kept-secret", valence: 2, subject: "player" } },
        ],
        result: "箱子还在通道里。系统里没有这一行。断了的时候，它才算数。",
      },
      {
        label: "按上季那行名字入",
        when: [{ quality: "arc:tangke:end", gte: 1 }],
        effects: [
          { opinion: "$a", delta: 1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "came-for-last", valence: 1, subject: "player" } },
          { remember: { holder: "$a", act: "fair-split", valence: 1, subject: "player" } },
        ],
        result: "箱子按上季那行名字入。没有写成你这季的新货。唐可看见那行还在。",
      },
    ],
  },
  {
    id: "s4-work-fangmin",
    kind: "floor",
    cast: { a: fangmin, b: guest },
    when: [autumn],
    weight: 14, tension: 0, once: true,
    text: "方敏把报销那一页抽出来。{$b}想把不是柜上的货写进行里。方敏等你拦不拦。",
    choices: [
      {
        label: "这行不收",
        effects: [
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: -3 },
          { stat: "compliance", delta: 4 },
          { remember: { holder: "$a", act: "same-as-record", valence: 2, subject: "player" } },
          { remember: { holder: "$b", act: "refused-gap", valence: -1, subject: "player" } },
        ],
        result: "这行没有收。不是柜上的货没有写进报销。{$b}把那张纸拿走了。",
      },
      {
        label: "写进去",
        effects: [
          { opinion: "$b", delta: 4 }, { opinion: "$a", delta: -5 },
          { stat: "compliance", delta: -5 },
          { remember: { holder: "$a", act: "took-order", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "covered-gap", valence: 1, subject: "player" } },
        ],
        result: "写进去了。这一行和抽屉对不上。方敏把页留下，没有当场划掉。",
      },
      {
        label: "不点同事，这行退回",
        when: [{ remembers: "fangmin", act: "named-colleague", valence: "bad" }],
        effects: [
          { opinion: "$a", delta: 2 }, { opinion: "$b", delta: -1 },
          { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "kept-word", valence: 2, subject: "player" } },
        ],
        result: "同事的名字没有再点。这行退回去了。方敏把上季那页和这一页夹在一起。",
      },
    ],
  },
  {
    id: "s4-work-luyao",
    kind: "floor",
    cast: { a: luyao, b: guest },
    when: [autumn, { day: { gte: 10 } }],
    weight: 14, tension: 1, once: true,
    text: "陆遥把一根绳子拉到你的凳子边上。{$b}站在绳子这头，人还没进对面。",
    choices: [
      {
        label: "绳子退回去",
        effects: [
          { opinion: "$a", delta: -4 }, { opinion: "$b", delta: 1 },
          { remember: { holder: "$a", act: "took-client", valence: -2, subject: "player" } },
          { remember: { holder: "$b", act: "looked-after", valence: 1, subject: "player" } },
        ],
        result: "绳子退回去了。{$b}还在你这边。陆遥记下这头没有让出来。",
      },
      {
        label: "人跟着绳子走",
        effects: [
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: -2 },
          { stat: "standing", delta: -1 },
          { remember: { holder: "$a", act: "yielded-client", valence: 1, subject: "player" } },
          { remember: { holder: "$b", act: "yielded-client", valence: -2, subject: "player" } },
        ],
        result: "{$b}跟着绳子走了。这单不写你的名字。凳子空出来一截。",
      },
      {
        label: "开学那张纸条还在",
        when: [{ quality: "s4:side", gte: 1 }],
        effects: [
          { opinion: "$b", delta: 1 }, { opinion: "$a", delta: -1 },
          { remember: { holder: "$b", act: "came-for-last", valence: 2, subject: "player" } },
          { remember: { holder: "$a", act: "rival-line", valence: -1, subject: "player" } },
        ],
        result: "纸条还在。{$b}不是今天才站到这头的。陆遥数过这个人。",
      },
    ],
  },
];

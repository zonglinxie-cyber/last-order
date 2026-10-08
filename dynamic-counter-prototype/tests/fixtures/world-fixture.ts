// 引擎测试与模拟器的夹具：10 个人、8 张故事碎片。只给测试用 —
// 正式内容由 content/ 目录提供，不要拿这份当正式内容。
import type { Person, Storylet } from "../../src/world/types.ts";

const voice = (greet: string, pleased: string, hurt: string, praise: string, complain: string) =>
  ({ greet, pleased, hurt, praise, complain });

export const FIXTURE_PEOPLE: Person[] = [
  {
    id: "suman", name: "苏蔓", role: "staff", age: 34, descriptor: "同柜老柜姐 · 肯帮人",
    tempers: ["warm", "loyal"], visits: { days: "any", slots: [0, 1, 2, 3], chance: 1 },
    bonds: [{ to: "tangke", kind: "colleague", warmth: 40 }],
    voice: voice("我来盯着，你去忙。", "多亏你。", "这话说的。", "{player}这人靠得住。", "{player}最近有点变味了。"),
  },
  {
    id: "tangke", name: "唐可", role: "staff", age: 28, descriptor: "隔壁柜柜姐 · 手里有货",
    tempers: ["thrifty", "proud"], visits: { days: "any", slots: [0, 1, 2, 3], chance: 1 },
    bonds: [{ to: "suman", kind: "colleague", warmth: 40 }],
    voice: voice("有事说事。", "算你会来事。", "你什么意思？", "{player}手脚麻利。", "{player}就会占便宜。"),
  },
  {
    id: "luyao", name: "陆遥", role: "rival", age: 30, descriptor: "对面维珞的王牌",
    tempers: ["proud", "gossip"], visits: { days: "any", slots: [0, 1, 2, 3], chance: 1 },
    bonds: [{ to: "shen", kind: "client", warmth: 30 }],
    voice: voice("客人可都是长眼睛的。", "算你识相。", "你等着。", "{player}那点手法还行。", "{player}就会硬推，客人都跟我说了。"),
  },
  {
    id: "mei", name: "梅女士", role: "customer", age: 45, descriptor: "下班客 · 总是赶时间",
    tempers: ["hasty", "loyal"], visits: { days: [1, 3, 5], slots: [1, 2], chance: 0.9 },
    skin: {
      demands: [{ trait: "natural", want: 2, weight: 3 }, { trait: "steady", want: 1, weight: 2 }, { trait: "correct", want: 1, weight: 1 }],
      budget: 1800, maxUnits: 1,
    },
    bonds: [],
    voice: voice("我只有十分钟。", "今天谢谢你。", "浪费我时间。", "{player}推荐得准。", "{player}根本没听我说话。"),
  },
  {
    id: "shen", name: "沈薇", role: "customer", age: 29, descriptor: "熟客博主 · 嘴上不饶人",
    tempers: ["face", "gossip"], visits: { days: "any", slots: [0, 1], chance: 0.6 },
    skin: {
      demands: [{ trait: "wear", want: 2, weight: 3 }, { trait: "correct", want: 2, weight: 2 }, { trait: "natural", want: 1, weight: 1 }],
      budget: 3200, maxUnits: 3,
    },
    bonds: [{ to: "he", kind: "friend", warmth: 45 }],
    voice: voice("先说好，我不缺粉底。", "算你懂行。", "你刚才那是什么意思？", "{player}那人还行，推荐得准。", "{player}就会硬推，别信她。"),
  },
  {
    id: "he", name: "何太", role: "customer", age: 52, descriptor: "沈薇的老姐妹 · 不轻易信人",
    tempers: ["wary", "loyal"], visits: { days: "any", slots: [0, 1], chance: 0.7 },
    bonds: [{ to: "shen", kind: "friend", warmth: 45 }, { to: "qiu", kind: "friend", warmth: 25 }],
    voice: voice("我就随便看看。", "眼见为实。", "我记住这句话了。", "{player}看着是个实诚人。", "都说{player}硬推，我得自己看看。"),
  },
  {
    id: "peng", name: "彭姐", role: "customer", age: 48, descriptor: "会所常客 · 什么都要赢",
    tempers: ["proud", "face"], visits: { days: [2, 4], slots: [0, 3], chance: 0.8 },
    skin: {
      demands: [{ trait: "correct", want: 2, weight: 3 }, { trait: "wear", want: 1, weight: 2 }],
      budget: 5000, maxUnits: 4,
    },
    bonds: [{ to: "zhao", kind: "rival", warmth: -35 }],
    voice: voice("你们柜最好的拿出来。", "这还差不多。", "你敢这么跟我说话？", "{player}识货。", "{player}那点水平也配推荐？"),
  },
  {
    id: "zhao", name: "赵阿姨", role: "customer", age: 55, descriptor: "给女儿挑礼物 · 精打细算",
    tempers: ["warm", "thrifty"], visits: { days: [2, 4], slots: [0, 3], chance: 0.8 },
    skin: {
      demands: [{ trait: "soothe", want: 2, weight: 3 }, { trait: "steady", want: 2, weight: 2 }, { trait: "natural", want: 1, weight: 1 }],
      budget: 2000, maxUnits: 2,
    },
    bonds: [{ to: "peng", kind: "rival", warmth: -35 }],
    secret: { text: "给女儿买礼物，娘俩半年没说话了", reveal: [{ opinion: "$self", gte: 10 }] },
    voice: voice("我替我女儿看。", "闺女你真贴心。", "你这也太贵了吧。", "{player}实在，不坑人。", "{player}专挑贵的推。"),
  },
  {
    id: "qiu", name: "邱太", role: "customer", age: 50, descriptor: "老主顾 · 心气高疑心重",
    tempers: ["proud", "wary"], visits: { days: "any", slots: [2, 3], chance: 0.6 },
    bonds: [{ to: "he", kind: "friend", warmth: 25 }],
    secret: { text: "对外说女儿在国外，其实两人早断了联系", reveal: [{ opinion: "$self", gte: 10 }] },
    voice: voice("老样子。", "你比别人用心。", "我没想到你是这种人。", "{player}还算尽心。", "{player}嘴不严。"),
  },
  {
    id: "duan", name: "小段", role: "customer", age: 23, descriptor: "实习生 · 头一回进这层",
    tempers: ["shy", "thrifty"], visits: { days: "any", slots: [0, 1, 2, 3], chance: 0.5 },
    skin: {
      demands: [{ trait: "natural", want: 2, weight: 3 }, { trait: "steady", want: 2, weight: 2 }],
      budget: 1000, maxUnits: 1,
    },
    bonds: [],
    secret: { text: "攒了三个月工资才敢上这层", reveal: [{ remembers: "$self", act: "got-sample" }] },
    voice: voice("我……我就看看。", "谢谢姐。", "我、我先走了。", "{player}姐人好。", "{player}老围着我转。"),
  },
];

export const FIXTURE_STORYLETS: Storylet[] = [
  {
    id: "st-warm-welcome", kind: "social", tension: 0, weight: 2,
    cast: { a: { where: [{ role: "$self", is: "customer" }, { opinion: "$self", gte: 10 }] } },
    when: [],
    text: "{$a}走到柜台前，像是专门来找你的。",
    choices: [
      { label: "放下手头的活陪她聊", effects: [{ opinion: "$a", delta: 3 }, { stat: "energy", delta: -2 }],
        result: "{$a}跟你聊了两句，走的时候心情不错。" },
      { label: "点头笑笑继续忙", effects: [], result: "你点点头，{$a}自己逛去了。" },
    ],
  },
  {
    id: "st-heard-rumor", kind: "social", tension: 1, weight: 3,
    cast: {
      a: { where: [{ remembers: "$self", valence: "bad" }] },
      b: { where: [{ present: "$self" }, { bond: ["$a", "$self"], gte: 10 }] },
    },
    when: [{ present: "$a" }],
    text: "{$a}当着{$b}的面提起你的事，语气不太好。",
    choices: [
      { label: "认下来，说开了", effects: [{ opinion: "$a", delta: 6 }, { stat: "standing", delta: 1 }],
        result: "你把事情原委说开，{$a}脸色缓了些。" },
      { label: "岔开话题", effects: [{ opinion: "$b", delta: -2 }],
        result: "你扯开话题，{$b}看在眼里。" },
    ],
  },
  {
    id: "st-rival-jab", kind: "floor", tension: 1, weight: 2,
    cast: { r: { id: "luyao", where: [] } },
    when: [{ present: "$r" }],
    text: "{$r}隔着柜台扬声：又有一单差点被对面抢走？",
    choices: [
      { label: "笑着顶回去", effects: [{ quality: "arc:luyao:clash", delta: 1 }, { stat: "standing", delta: 1 }],
        result: "你顶了回去，楼层里几个人看过来。" },
      { label: "不接招", effects: [{ stat: "standing", delta: -1 }],
        result: "你没接，{$r}自讨没趣。" },
    ],
  },
  {
    id: "st-mei-arc-1", kind: "arc", tension: 0, weight: 4, once: true,
    cast: { m: { id: "mei", where: [] } },
    when: [{ opinion: "$m", gte: 25 }],
    text: "{$m}难得不赶时间，在柜台前多站了一会儿。",
    choices: [
      { label: "把她当朋友看，不急着开单", effects: [
          { quality: "arc:mei:trust", set: 1 }, { opinion: "$m", delta: 10 },
          { remember: { holder: "$m", act: "felt-seen", valence: 2 } }],
        result: "{$m}愣了一下，把你当成了这层楼里少数能说上话的人。" },
    ],
  },
  {
    id: "st-mei-arc-good", kind: "arc", tension: -1, weight: 4, once: true,
    cast: { m: { id: "mei", where: [] } },
    when: [{ quality: "arc:mei:trust", gte: 1 }, { opinion: "$m", gte: 40 }],
    text: "{$m}把她同事也带来了，说你们柜的人信得过。",
    choices: [
      { label: "照旧好好待她", effects: [{ quality: "arc:mei:end", set: 2 }, { stat: "standing", delta: 3 }],
        result: "{$m}成了你在商场里逢人就提的老朋友。" },
    ],
  },
  {
    id: "st-mei-arc-bad", kind: "arc", tension: 1, weight: 4, once: true,
    cast: { m: { id: "mei", where: [] } },
    when: [{ quality: "arc:mei:trust", gte: 1 }, { opinion: "$m", lte: -10 }],
    text: "{$m}在门口站了一会儿，没进来。",
    choices: [
      { label: "由她去", effects: [{ quality: "arc:mei:end", set: -1 }],
        result: "{$m}后来再没在这一层出现过。" },
    ],
  },
  {
    id: "st-sister-quarrel", kind: "social", tension: 1, weight: 3, cooldown: 3,
    cast: {
      a: { where: [{ present: "$self" }, { role: "$self", is: "customer" }] },
      b: { where: [{ present: "$self" }, { any: [
          { bond: ["$a", "$self"], lte: -20 }, { bond: ["$self", "$a"], lte: -20 }] }] },
    },
    when: [],
    text: "{$a}和{$b}在中庭碰上了，两句话就呛起来。",
    choices: [
      { label: "上去各递一杯水", effects: [{ bond: ["$a", "$b"], delta: 10 }, { bond: ["$b", "$a"], delta: 10 }],
        result: "你各递了一杯水，两个人总算分开走。" },
      { label: "装没看见", effects: [], result: "两个人吵了几句，各自散开。" },
    ],
  },
  {
    id: "st-quiet-day", kind: "social", tension: -1, weight: 1,
    cast: { a: { where: [{ present: "$self" }] } },
    when: [],
    text: "{$a}安静地逛了一圈。",
    choices: [{ label: "随她去", effects: [], result: "楼层难得清静了一会儿。" }],
  },
];

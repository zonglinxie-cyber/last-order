// 人情网视图的自编 fixture：12 个人、一圈关系、几笔记忆（含听来的）。
// 只按 src/world/types.ts 的数据形状写，不接引擎；?mode=web 的预览和 world-web 走查都用这一份。
import { asset } from "../../src/base";
import type { Person, Visits, World } from "../../src/world/types.ts";

const ANY_VISITS: Visits = { days: "any", slots: [0, 1, 2, 3], chance: 0.4 };

const voice = (greet: string, pleased: string, hurt: string, praise: string, complain: string) =>
  ({ greet, pleased, hurt, praise, complain });

export const WEB_PEOPLE: Person[] = [
  {
    id: "shen", name: "沈薇", role: "customer", age: 29,
    descriptor: "熟客博主 · 竞品也认识她", tempers: ["proud", "wary"],
    visits: ANY_VISITS, portrait: asset("/assets/game/customer-shen-consultation.png"),
    voice: voice("我先到先问。", "行，{player} 那人还行。", "你别当众说这个。", "{player} 那次给我讲得很实在。", "她后来还是推了。"),
    bonds: [
      { to: "luyao", kind: "rival", warmth: -60 },
      { to: "xiaoyu", kind: "friend", warmth: 50 },
      { to: "helan", kind: "friend", warmth: 30 },
    ],
  },
  {
    id: "luyao", name: "陆遥", role: "rival", age: 31,
    descriptor: "对面维珞的销冠", tempers: ["proud", "hasty"],
    visits: ANY_VISITS, portrait: asset("/assets/game/staff-portraits/luyao.png"),
    voice: voice("哟，还在这儿站着呢。", "今天算你规矩。", "你抢我客人试试。", "{player} 这次手底下留了情面。", "{player} 把我的客人截走了。"),
    bonds: [{ to: "shen", kind: "rival", warmth: -55 }, { to: "tangke", kind: "mentor", warmth: 20 }],
  },
  {
    id: "tangke", name: "唐可", role: "staff", age: 24,
    descriptor: "同期新人 · 消息灵通", tempers: ["warm", "gossip"],
    visits: ANY_VISITS, portrait: asset("/assets/game/staff-portraits/tangke.png"),
    voice: voice("姐你可来了。", "有你罩着我就快了。", "我嘴上没把门的嘛。", "{player} 那人实在，还教我话术。", "{player} 那天在柜台凶我。"),
    bonds: [
      { to: "suman", kind: "colleague", warmth: 40 },
      { to: "helan", kind: "friend", warmth: 45 },
      { to: "luyao", kind: "mentor", warmth: 15 },
    ],
  },
  {
    id: "suman", name: "苏蔓", role: "staff", age: 34,
    descriptor: "资深柜姐 · 记人好坏都久", tempers: ["loyal"],
    visits: ANY_VISITS, portrait: asset("/assets/game/staff-portraits/suman.png"),
    voice: voice("慢慢来，别慌。", "你用心，我都看着。", "当众说我没意思。", "{player} 肯替人兜底。", "{player} 上手太急了。"),
    bonds: [{ to: "tangke", kind: "colleague", warmth: 35 }, { to: "roman", kind: "colleague", warmth: 30 }],
  },
  {
    id: "roman", name: "罗曼", role: "staff", age: 38,
    descriptor: "柜长 · 要的是场面好看", tempers: ["face"],
    visits: ANY_VISITS, portrait: asset("/assets/game/staff-portraits/roman.png"),
    voice: voice("今天柜台交给你。", "做得体面，我记着。", "别让我在楼层上难看。", "{player} 撑得住场面。", "{player} 那天差点让我下不来台。"),
    bonds: [{ to: "fangmin", kind: "colleague", warmth: 25 }, { to: "chengyi", kind: "colleague", warmth: 10 }],
  },
  {
    id: "fangmin", name: "方敏", role: "staff", age: 41,
    descriptor: "合规负责人 · 只认台账", tempers: ["wary", "thrifty"],
    visits: ANY_VISITS, portrait: asset("/assets/game/staff-portraits/fangmin.png"),
    voice: voice("台账带了吗。", "规矩人不必多话。", "别拿人情压我。", "{player} 台账做得干净。", "{player} 那几笔小样没登记。"),
    bonds: [{ to: "roman", kind: "colleague", warmth: 20 }],
  },
  {
    id: "mei", name: "梅女士", role: "customer", age: 45,
    descriptor: "下班客 · 十分钟后离店", tempers: ["thrifty", "hasty"],
    visits: ANY_VISITS, portrait: asset("/assets/game/customer-mei-consultation.png"),
    voice: voice("快点啊，我要赶车。", "你算得清楚，我就买。", "催我我就走。", "{player} 那回给我省了钱。", "{player} 一张嘴就是三件套装。"),
    bonds: [{ to: "zhou", kind: "friend", warmth: 45 }, { to: "anjie", kind: "friend", warmth: 35 }],
  },
  {
    id: "zhou", name: "周姐", role: "customer", age: 37,
    descriptor: "对比维珞 · 只有二十分钟", tempers: ["wary"],
    visits: ANY_VISITS, portrait: asset("/assets/game/customer-zhou-consultation.png"),
    voice: voice("我先看看你们这边。", "你不绕弯子，我再待会儿。", "少拿话堵我。", "{player} 讲得还算明白。", "听梅女士说，{player} 上来就推套装。"),
    bonds: [{ to: "mei", kind: "friend", warmth: 40 }, { to: "luyao", kind: "client", warmth: 30 }],
  },
  {
    id: "anjie", name: "安姐", role: "customer", age: 33,
    descriptor: "婚前试妆 · 高价值老客", tempers: ["loyal", "face"],
    visits: ANY_VISITS, portrait: asset("/assets/game/customer-anjie-consultation.png"),
    voice: voice("你还记得我啊。", "你懂我，钱不是问题。", "别提我素颜的事。", "{player} 嘴严，事也办得漂亮。", "{player} 那天眼力不够。"),
    bonds: [{ to: "mei", kind: "friend", warmth: 30 }, { to: "xiaoyu", kind: "client", warmth: 20 }],
  },
  {
    id: "xiaoyu", name: "小雨", role: "customer", age: 22,
    descriptor: "第一次买高端美妆 · 预算有限", tempers: ["shy"],
    visits: ANY_VISITS, portrait: asset("/assets/game/customer-xiaoyu-consultation.png"),
    voice: voice("我随便看看……", "你别围着我。", "我、我先走了。", "{player} 没逼我买。", "{player} 站太近了。"),
    bonds: [{ to: "shen", kind: "friend", warmth: 45 }],
  },
  {
    id: "helan", name: "贺岚", role: "mall", age: 27,
    descriptor: "中庭服装柜员 · 全场消息中转站", tempers: ["gossip"],
    visits: ANY_VISITS,
    artBrief: "中庭服装柜员 · 短发 · 工牌挂绳是红绳",
    voice: voice("二楼都晓得你哦。", "你对我好，我就帮你传。", "我传话还传错了？", "{player} 出手大方，小样都给。", "{player} 那天把梅女士说急了。"),
    bonds: [
      { to: "tangke", kind: "friend", warmth: 45 },
      { to: "shen", kind: "friend", warmth: 30 },
      { to: "zhou", kind: "friend", warmth: 35 },
    ],
  },
  {
    id: "chengyi", name: "程一", role: "mall", age: 52,
    descriptor: "夜班保安 · 谁几点来的他都记得", tempers: ["wary", "loyal"],
    visits: ANY_VISITS,
    artBrief: "夜班保安 · 制服外套旧了 · 保温杯不离手",
    voice: voice("今天人不多。", "你客气，我就多提醒你一句。", "别打听我的事。", "{player} 下班还帮我带口热水。", "{player} 鬼精鬼精的。"),
    bonds: [{ to: "roman", kind: "colleague", warmth: 10 }, { to: "fangmin", kind: "colleague", warmth: 5 }],
  },
];

export const WEB_WORLD: World = {
  seed: "fixture-web",
  day: 3,
  slot: 1,
  money: 12_400,
  standing: 58,
  compliance: 66,
  energy: 12,
  samples: 4,
  // 没见过面也可能有看法（听来的）；fangmin/xiaoyu/chengyi 三条缺席 = 最外圈压暗。
  opinion: {
    shen: 65,
    luyao: -80,
    tangke: 30,
    suman: 12,
    roman: 0,
    mei: -55,
    zhou: -18,
    anjie: 48,
    helan: 8,
  },
  // World.bonds 是当前值，覆盖 Person.bonds 的初始值；这里刻意改写三条给视图看。
  bonds: {
    "shen>luyao": -78,
    "tangke>suman": 52,
    "mei>zhou": 26,
  },
  memories: [
    { day: 2, holder: "shen", subject: "player", act: "honest-advice", valence: 2 },
    { day: 3, holder: "shen", subject: "player", act: "sample-gift", valence: 1, heardFrom: "tangke" },
    { day: 3, holder: "shen", subject: "luyao", act: "bad-recommend", valence: -1 },
    { day: 1, holder: "tangke", subject: "player", act: "kept-secret", valence: 1 },
    { day: 3, holder: "suman", subject: "player", act: "honest-advice", valence: 1, heardFrom: "tangke" },
    { day: 1, holder: "mei", subject: "player", act: "hard-sell", valence: -2 },
    { day: 2, holder: "zhou", subject: "player", act: "hard-sell", valence: -1, heardFrom: "mei" },
    { day: 3, holder: "luyao", subject: "player", act: "took-my-client", valence: -2 },
    { day: 2, holder: "anjie", subject: "player", act: "kept-secret", valence: 2 },
    { day: 3, holder: "helan", subject: "player", act: "sample-gift", valence: 1, heardFrom: "tangke" },
  ],
  qualities: { "arc:shen": 2 },
  present: { shen: "counter", luyao: "rival", tangke: "backroom", mei: "entrance", roman: "cashier" },
  appointments: [{ day: 3, slot: 2, person: "anjie", bring: ["mei"] }],
  fired: { "social-two-friends": 2 },
  log: [
    { day: 2, slot: 1, text: "沈薇离柜时说了句公道话。", who: ["shen"] },
    { day: 3, slot: 0, text: "梅女士把套装的事讲给了周姐。", who: ["mei", "zhou"] },
  ],
};

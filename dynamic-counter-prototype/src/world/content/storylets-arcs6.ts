// 第 4 季顾客个人线（第四批）：裴岚、梁夏。每人四张，第 4 季才开。
// 为什么排第 4 季：模拟器量到的内容燃烧是「半池 29 天 / 八成 60 天 / 第 1 季重复率 48%」——
// 第 4 季（第 85~112 天）牌堆里一张新个人线、一张主线卡都没有，愿意连玩四季的人看到的是一层楼在念旧稿。
// 这两条读的全是前三季带下来的东西：裴岚那条读主线本子上「方敏按住了领用表那一行」和她每季都带来的那三张表，
// 梁夏那条读第 1 季安姐婚礼的落点（arc:anjie:end 1~5）和苏蔓那句「别让梁夏上镜」，两条之间再互读（名单上那个名字就是她）。
// 反转不撞主线第 3 幕：那一幕答的是「那一行是谁的手写的」，裴岚这条答的是「是谁每季都要那一页」。
// 同事不用 appoint：engine 的赴约队列只管顾客（engine.ts:468），appoint 裴岚是按不动的。
import type { Storylet } from "../types.ts";

type Slot = Storylet["cast"][string];

const peilan: Slot = { id: "peilan", where: [] };
const liangxia: Slot = { id: "liangxia", where: [] };

/** 名单上要写的那个名字：柜上的同事，或跟你处到 20 以上的那位女顾客。
 *  钉成女性是因为这一张卡里 {$b} 要用「她」念；同事每时段都在，线不会停在等人上。 */
const listedName: Slot = {
  where: [
    { gender: "$self", is: "f" },
    { any: [
      { role: "$self", is: "staff" },
      { opinion: "$self", gte: 20 },
    ] },
  ],
};

export const STORYLETS_ARCS6: Storylet[] = [
  // —— 个人线：裴岚。第 4 季才开，读主线的领用表和她自己那三张表 ——

  {
    id: "arc-pl-table",
    kind: "arc",
    cast: { a: peilan },
    when: [
      { season: { gte: 4 } },
      { day: { gte: 4 } },
      { not: { quality: "arc:peilan", gte: 1 } },
    ],
    weight: 30, tension: 0, once: true,
    text: "{$a}这一季不带表来问。她把三张表摊在柜面上，说四季的数都在里面，只有一行她每季都抄一遍，那一行不是钱。",
    choices: [
      {
        label: "先问那一行是什么",
        effects: [
          { quality: "arc:peilan", set: 1 },
          { opinion: "$a", delta: 4 },
          { remember: { holder: "$a", act: "quarter-row-asked", valence: 2, subject: "player" } },
        ],
        result: "{$a}把最上面那张推过来。赠品领用表，第四页，同一行。她说这一行她按了四季，今年想让你看一眼。",
      },
      {
        label: "按她的老规矩，把今天的原话留下",
        effects: [
          { quality: "arc:peilan", set: 1 },
          { opinion: "$a", delta: 2 }, { stat: "compliance", delta: 3 },
          { remember: { holder: "$a", act: "quarter-words-kept", valence: 1, subject: "player" } },
        ],
        result: "{$a}点头。她说四季节的表她念得出，唯独你柜上那一行她每次都要重看一遍才知道是谁写的。",
      },
      {
        label: "柜上的数自己会说话",
        effects: [
          { quality: "arc:peilan", set: 1 },
          { opinion: "$a", delta: -5 }, { stat: "standing", delta: -2 },
          { remember: { holder: "$a", act: "quarter-numbers-only", valence: -2, subject: "player" } },
        ],
        result: "{$a}把三张表收回去两张。她说只看数的人她见过，第二个季度就不在楼上了。",
      },
    ],
  },
  {
    id: "arc-pl-who",
    kind: "arc",
    cast: { a: peilan },
    when: [
      { quality: "arc:peilan", gte: 1 },
      { not: { quality: "arc:peilan", gte: 2 } },
    ],
    weight: 32, tension: 1, once: true,
    text: "第二次她只带一张。{$a}说这一页是上面每季跟她要的，不是她要的：「谁按住的我说不出，谁要的我每年都签一次。」",
    choices: [
      {
        label: "那一页是你自己按住的",
        when: [{ clue: "slip-gap" }],
        effects: [
          { quality: "arc:peilan", set: 2 },
          { opinion: "$a", delta: 7 }, { opinion: "fangmin", delta: 4 },
          { reveal: "peilan" },
          { remember: { holder: "$a", act: "quarter-held-known", valence: 2, subject: "player" } },
        ],
        result: "{$a}没有否认。她说这一行上了表就要有人离开这层楼，她按住它四季，按的是这个，不是数。",
      },
      {
        label: "方敏那一行到底记在谁名下",
        when: [{ any: [{ quality: "thread:return-slip", gte: 7 }, { knowsSecret: "fangmin" }] }],
        effects: [
          { quality: "arc:peilan", set: 2 },
          { clue: "slip-roster" },
          { opinion: "$a", delta: 5 }, { opinion: "fangmin", delta: -3 },
          { stat: "compliance", delta: -4 },
          { remember: { holder: "$a", act: "quarter-row-named", valence: 2, subject: "player" } },
        ],
        result: "「记在一个当时顶班的人手上。」{$a}把这句话说得很慢。她知道是谁的手写的，这一季她才说这是她要的那一页。那一页上领用、退款、进台账三笔，落的是同一个顶班的号。",
      },
      {
        label: "这一页柜上不管区域的事",
        effects: [
          { quality: "arc:peilan", set: 2 },
          { opinion: "$a", delta: -4 }, { stat: "compliance", delta: 2 },
          { remember: { holder: "$a", act: "quarter-page-refused", valence: -1, subject: "player" } },
        ],
        result: "{$a}说好。她把那一页折回原样，说自己每季都听见这一句，听四季了。",
      },
    ],
  },
  {
    id: "arc-pl-list",
    kind: "arc",
    cast: { a: peilan, b: listedName },
    when: [
      { quality: "arc:peilan", gte: 2 },
      { not: { quality: "arc:peilan", gte: 3 } },
      { present: "$b" },
    ],
    weight: 32, tension: 1, once: true,
    text: "{$a}把笔放在柜面上。下一季这层楼要留几个人，区域只看这一张名单，而名单上还差一个名字。她说：你写{$b}，还是你写自己，她自己都不管 —— 她只管明年这时候还在不在。",
    choices: [
      {
        label: "写{$b}",
        effects: [
          { quality: "arc:peilan", set: 3 },
          { opinion: "$a", delta: 3 }, { opinion: "$b", delta: 6 },
          { bond: ["peilan", "$b"], delta: 6 },
          { remember: { holder: "$a", act: "quarter-list-named", valence: 2, subject: "$b" } },
          { remember: { holder: "$b", act: "listed-by-counter", valence: 2, subject: "player", heardFrom: "peilan" } },
        ],
        result: "{$a}把名字抄进总表。她说这一格明年这时候会兑现成一条排班，不会兑现成一句谢。",
      },
      {
        label: "写自己",
        effects: [
          { quality: "arc:peilan", set: 3 },
          { opinion: "$a", delta: -3 }, { stat: "standing", delta: 4 },
          { bond: ["peilan", "player"], kind: "colleague", set: 20 },
          { remember: { holder: "$a", act: "quarter-list-self", valence: 1, subject: "player" } },
        ],
        result: "{$a}照抄，字很小。她说写了自己的人她见得多了，第二年还在的不到一半。",
      },
      {
        label: "这一格空着",
        effects: [
          { quality: "arc:peilan", set: 3 },
          { opinion: "$a", delta: -6 },
          { bond: ["peilan", "player"], delta: -5 },
          { remember: { holder: "$a", act: "quarter-list-blank", valence: -2, subject: "player" } },
        ],
        result: "{$a}把笔收进包里。她说空一格她就按上一季的人数报，报多少是多少，这一格不替谁留。",
      },
    ],
  },
  {
    id: "arc-pl-end",
    kind: "arc",
    cast: { a: peilan, b: listedName },
    when: [
      { quality: "arc:peilan", gte: 3 },
      { not: { quality: "arc:peilan:end", gte: 1 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "换季前最后一次。{$a}站在入口不进柜，说这一季的表她要收走了，只问一句：明年这时候这面柜是谁站。",
    choices: [
      {
        label: "那一页由柜上自己抄上去",
        when: [
          { remembers: "peilan", act: "quarter-held-known" },
          { opinion: "peilan", gte: 8 },
          { not: { remembers: "peilan", act: "quarter-numbers-only", valence: "bad" } },
        ],
        effects: [
          { quality: "arc:peilan:end", set: 1 },
          { opinion: "$a", delta: 8 }, { stat: "standing", delta: 5 }, { stat: "compliance", delta: -3 },
          { bond: ["peilan", "player"], kind: "friend", set: 40 },
          { remember: { holder: "$a", act: "quarter-row-carried", valence: 2, subject: "player" } },
        ],
        result: "{$a}把那一页留在你柜上，收走其余三张。她说这一行从此有人认，不用再按第四季。",
      },
      {
        label: "名单上那个名字留下了",
        when: [{ remembers: "peilan", act: "quarter-list-named", subject: "$b" }],
        effects: [
          { quality: "arc:peilan:end", set: 2 },
          { opinion: "$a", delta: 4 }, { opinion: "$b", delta: 4 },
          { stat: "standing", delta: 2 },
          { bond: ["peilan", "$b"], delta: 4 },
          { remember: { holder: "$a", act: "quarter-list-good", valence: 2, subject: "player" } },
        ],
        result: "{$b}明年这时候还在楼上。{$a}说这一格是四季里她唯一一格格得正的。",
      },
      {
        label: "她的名字按上一季报",
        when: [{ remembers: "peilan", act: "quarter-list-self" }],
        effects: [
          { quality: "arc:peilan:end", set: 3 },
          { opinion: "$a", delta: 2 }, { stat: "standing", delta: 3 },
          { remember: { holder: "$a", act: "quarter-list-as-is", valence: 1, subject: "player" } },
        ],
        result: "{$a}把那张小字抄进总表，一个字没改。她说这一季表很好看，明年见不见得到另说。",
      },
      {
        label: "她不替这面柜写下一季",
        when: [
          { any: [{ remembers: "peilan", act: "quarter-list-blank", valence: "bad" }, { remembers: "peilan", act: "quarter-numbers-only", valence: "bad" }] },
        ],
        effects: [
          { quality: "arc:peilan:end", set: 4 },
          { opinion: "$a", delta: -10 }, { stat: "standing", delta: -6 },
          { bond: ["peilan", "player"], kind: "rival", set: -30 },
          { remember: { holder: "$a", act: "quarter-table-closed", valence: -2, subject: "player" } },
        ],
        result: "{$a}三张一起收走。她说下一季的表她会带去别的面柜，那一页她也一并带走。",
      },
      {
        label: "这一页谁也没念",
        effects: [
          { quality: "arc:peilan:end", set: 5 },
          { opinion: "$a", delta: -2 },
          { remember: { holder: "$a", act: "quarter-nothing-said", valence: 0, subject: "player" } },
        ],
        result: "{$a}把表页对齐，塞进包最里层。她说这一格空着也是她的字，跟谁都没关系。",
      },
    ],
  },

  // —— 个人线：梁夏。第 4 季才开，读第 1 季那场婚礼和苏蔓那句「别让梁夏上镜」 ——

  {
    id: "arc-lx-shoot",
    kind: "arc",
    cast: { a: liangxia },
    when: [
      { season: { gte: 4 } },
      { day: { gte: 5 } },
      { not: { quality: "arc:liangxia", gte: 1 } },
    ],
    weight: 30, tension: 0, once: true,
    text: "{$a}这一季自己来的，手里没按别人的手机。她说她接了跟妆的活，要一张能挂在主页上的照片 —— 上一次这层楼的人躲镜头的是她。",
    choices: [
      {
        label: "拍，灯偏开",
        effects: [
          { quality: "arc:liangxia", set: 1 },
          { opinion: "$a", delta: 6 },
          { remember: { holder: "$a", act: "camera-asked-shoot", valence: 2, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 2, slot: 1 } },
        ],
        result: "{$a}把头发理了一下才站好。她说偏开就行，她要的是上班八小时那张脸，不是被拍到的那张。",
      },
      {
        label: "先问安姐那一场后来怎样",
        effects: [
          { quality: "arc:liangxia", set: 1 },
          { opinion: "$a", delta: 2 }, { opinion: "anjie", delta: 2 },
          { bond: ["liangxia", "anjie"], delta: 3 },
          { remember: { holder: "$a", act: "camera-asked-wedding", valence: 1, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 2, slot: 1 } },
        ],
        result: "{$a}说那场早过去了。她说完自己笑了一下 —— 这一季她开口问的是拍她，不是别让谁拍。",
      },
      {
        label: "柜上不拍人",
        effects: [
          { quality: "arc:liangxia", set: 1 },
          { opinion: "$a", delta: -6 },
          { remember: { holder: "$a", act: "camera-shoot-refused", valence: -2, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 2, slot: 1 } },
        ],
        result: "{$a}说好，把手机收回包里。她说这一句她四年前也听人说过，那时她是躲在后面的那个。",
      },
    ],
  },
  {
    id: "arc-lx-set",
    kind: "arc",
    cast: { a: liangxia },
    when: [
      { quality: "arc:liangxia", gte: 1 },
      { not: { quality: "arc:liangxia", gte: 2 } },
    ],
    weight: 32, tension: 1, once: true,
    text: "第二次她把手机递过来，相册停在一个旧文件夹。那场婚礼的原图在她手里，四季了没删。{$a}说：当年传出去的那些不是我发的，是我拍的。",
    choices: [
      {
        label: "这套图你一直留着",
        when: [{ knowsSecret: "suman" }],
        effects: [
          { quality: "arc:liangxia", set: 2 },
          { opinion: "$a", delta: 7 }, { opinion: "suman", delta: -2 },
          { remember: { holder: "$a", act: "camera-set-kept", valence: 2, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 2, slot: 1 } },
        ],
        result: "{$a}说删不掉。那一句「别让梁夏上镜」是她自己听见了才要苏蔓转的 —— 躲镜头的人自己按了快门，这一句她没跟谁说过。",
      },
      {
        label: "那张图是谁传出去的",
        effects: [
          { quality: "arc:liangxia", set: 2 },
          { opinion: "$a", delta: 3 }, { opinion: "miduo", delta: -3 },
          { remember: { holder: "$a", act: "camera-set-spread", valence: 1, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 2, slot: 1 } },
        ],
        result: "{$a}报了个群名，不是柜上的群。她说这一页她记着，但今年不打算拿它找任何人。",
      },
      {
        label: "删了吧，往后只看这一季",
        effects: [
          { quality: "arc:liangxia", set: 2 },
          { opinion: "$a", delta: -4 },
          { bond: ["liangxia", "player"], delta: -3 },
          { remember: { holder: "$a", act: "camera-set-deleted", valence: -2, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 2, slot: 1 } },
        ],
        result: "{$a}把屏幕按灭，没有删。她说你连别人的旧图都要替人做主 —— 这句她讲得平，你听得出不平。",
      },
    ],
  },
  {
    id: "arc-lx-base",
    kind: "arc",
    cast: { a: liangxia },
    when: [
      { quality: "arc:liangxia", gte: 2 },
      { not: { quality: "arc:liangxia", gte: 3 } },
    ],
    weight: 32, tension: 1, once: true,
    text: "{$a}这一次不是来聊旧事。她接了活，一天上三张脸，自己那张脸从早上七点到晚上十点。她要一支「八小时不斑驳」的底，预算两千二，最多两支。",
    choices: [
      {
        label: "按她的否决只开自然的那支",
        effects: [
          { quality: "arc:liangxia", set: 3 },
          { opinion: "$a", delta: 6 },
          { stat: "samples", delta: -1 },
          { remember: { holder: "$a", act: "camera-base-natural", valence: 2, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 3, slot: 2 } },
        ],
        result: "一支，薄的那支。{$a}在半张脸上等了一下午才走 —— 她回来的时候说，这一支是她自己敢挂主页的。",
      },
      {
        label: "礼盒那一支遮得更好",
        effects: [
          { quality: "arc:liangxia", set: 3 },
          { opinion: "$a", delta: -9 },
          { remember: { holder: "$a", act: "hard-sell", valence: -2, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 3, slot: 2 } },
        ],
        result: "她买了。第三天{$a}回来退货，说厚的那支在镜头下像一层壳 —— 这一单她本来不打算开口。",
      },
      {
        label: "先上半脸，八小时以后再说",
        effects: [
          { quality: "arc:liangxia", set: 3 },
          { opinion: "$a", delta: 3 },
          { remember: { holder: "$a", act: "camera-base-trialled", valence: 1, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 3, slot: 2 } },
        ],
        result: "{$a}同意只上一半。她说这四年她一直看别人上脸，第一次是自己坐着等。",
      },
      {
        label: "问她的活是从哪里接来的",
        when: [{ any: [{ quality: "wechat:liangxia", gte: 1 }, { opinion: "liangxia", gte: 10 }] }],
        effects: [
          { quality: "arc:liangxia", set: 3 },
          { opinion: "$a", delta: 5 }, { stat: "standing", delta: 2 },
          { remember: { holder: "$a", act: "camera-asked-source", valence: 2, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 3, slot: 2 } },
        ],
        result: "第一场是{$a}自己拍自己那张挂上去的。她说这层楼有人替她写了「还在」那一格，她就有人敢问价。",
      },
    ],
  },
  {
    id: "arc-lx-end",
    kind: "arc",
    cast: { a: liangxia },
    when: [
      { quality: "arc:liangxia", gte: 3 },
      { not: { quality: "arc:liangxia:end", gte: 1 } },
    ],
    weight: 32, tension: 0, once: true,
    text: "换季前{$a}最后一次来。她把主页打开给你看，第一张是柜上拍的那张，灯偏开。她说下个月有一场跟妆，问这面柜要不要在她的照片里露一行字。",
    choices: [
      {
        label: "行字写柜位",
        when: [
          { remembers: "liangxia", act: "camera-base-natural" },
          { opinion: "liangxia", gte: 8 },
          { not: { remembers: "liangxia", act: "hard-sell", valence: "bad" } },
        ],
        effects: [
          { quality: "arc:liangxia:end", set: 1 },
          { opinion: "$a", delta: 7 }, { stat: "standing", delta: 6 },
          { bond: ["liangxia", "player"], kind: "client", set: 45 },
          { remember: { holder: "$a", act: "camera-counter-named", valence: 2, subject: "player" } },
          { appoint: { person: "liangxia", inDays: 4, slot: 1 } },
        ],
        result: "照片下面多了这一面柜的一行字。{$a}说她终于把那场婚礼欠的镜头还回去了 —— 这一次是她自己愿意被看见。",
      },
      {
        label: "不露行字，人回来就行",
        when: [{ remembers: "liangxia", act: "camera-base-trialled" }],
        effects: [
          { quality: "arc:liangxia:end", set: 2 },
          { opinion: "$a", delta: 4 }, { stat: "money", delta: 980 },
          { bond: ["liangxia", "player"], delta: 6 },
          { remember: { holder: "$a", act: "camera-no-sign", valence: 1, subject: "player" } },
        ],
        result: "{$a}说好。她把手机收起来，说这一句她喜欢 —— 不挂名字的那种信任她四年没被人给过。",
      },
      {
        label: "那一页旧图先跟安姐说清",
        when: [{ remembers: "liangxia", act: "camera-set-kept" }],
        effects: [
          { quality: "arc:liangxia:end", set: 3 },
          { opinion: "anjie", delta: 5 }, { opinion: "$a", delta: 2 },
          { bond: ["liangxia", "anjie"], delta: 8 },
          { remember: { holder: "$a", act: "camera-set-told", valence: 2, subject: "player" } },
          { appoint: { person: "anjie", inDays: 3, slot: 1, bring: ["liangxia"] } },
        ],
        result: "{$a}把那套原图给安姐看了，只在安姐面前。她说这一句说完她就不用再删了。",
      },
      {
        label: "柜上不上别人的主页",
        when: [{ remembers: "liangxia", act: "camera-shoot-refused", valence: "bad" }],
        effects: [
          { quality: "arc:liangxia:end", set: 4 },
          { opinion: "$a", delta: -8 },
          { bond: ["liangxia", "player"], kind: "rival", set: -25 },
          { remember: { holder: "$a", act: "camera-shot-closed", valence: -2, subject: "player" } },
          { leave: "$a" },
        ],
        result: "{$a}把手机拿回去，自己拍了那张。她说这一面柜的灯偏不开，她去楼下那一柜偏。",
      },
      {
        label: "她退回那支厚的",
        when: [{ remembers: "liangxia", act: "hard-sell", valence: "bad" }],
        effects: [
          { quality: "arc:liangxia:end", set: 5 },
          { opinion: "$a", delta: -5 }, { stat: "standing", delta: -3 },
          { remember: { holder: "$a", act: "camera-returned", valence: -2, subject: "player" } },
          { leave: "$a" },
        ],
        result: "退货单上写的是她的名字，这一回没有别人替她签。{$a}走的时候说，她终于不用躲镜头了，也不用再来。",
      },
      {
        label: "那一场跟她无关",
        effects: [
          { quality: "arc:liangxia:end", set: 6 },
          { opinion: "$a", delta: -1 },
          { remember: { holder: "$a", act: "camera-stood-aside", valence: 0, subject: "player" } },
        ],
        result: "{$a}点头，把主页翻回上一屏。她说这一季她本来也没打算让谁看见。",
      },
    ],
  },
];

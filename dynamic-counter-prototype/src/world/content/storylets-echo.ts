// 引力井：走完的个人线原地留下的「回访卡」。第 25 轮。
// 为什么要这一批：模拟器量到每季抽到的故事卡是 47 / 31 / 11 / 11 次（占本季抽牌 42% / 28% / 10% / 10%），
// 而第 1 季那九条线在 40 副牌里全部 40/40 走到了落点 —— 走完以后那条线一张卡都不剩（`isFollowUp` 认
// `arc:<人>:end < 1`，落过点的人整条线退出牌堆），池子于是每季净缩水，后两季只剩过场在重演。
// 这一批不改那条判据，也不补新线：每张卡认的是「她这一季已经走完了」，把她当年怎么收的（`arc:<人>:end`
// 落到第几档）当成她这次回来的理由 —— 玩家上一季的选法决定她这一季长什么样，这是"人物线走得完"之后
// 剩下的那一半：走完了还得能回头。
// 口径：一张卡一季最多演一次（`cooldown: 28`，`fired` 换季清空；一季 28 天，冷却要**大于**首尾那对
// 天数差 —— 上一版写 27，于是第 1 天演过、第 28 天还能再演一次（28 − 1 = 27，不小于 27 就放行）。
// 同一副内容把冷却改回 27 再数一遍：1,266 次回访里有 73 回是"同一张卡一季演两次"（5.8%）；
// 补到 28 以后 1,264 回全部只演一次，并由确定性用例钉住）。
// 都不给钱（`stat: money`）—— 本轮的回归要跟上一轮的钱数逐行比，经济一条线不许动。
// 本轮写 12 张，覆盖第 1 季那九条 + 第 2 季的三条（尹小姐、段小姐、赵宁）。还差 8 条：
// 唐可、罗曼、方敏、乔晚（第 2 季开）、宋姐、白姐（第 3 季开）落点都在本季末以前，本来回得来，本轮未写；
// 裴岚、梁夏（第 4 季开）的落点在第四季末，四季之内没有下一季可回 —— 它们要等「四季以后去哪」那一刀。
//
// 第 26 轮在下面追加三张「第二回」：它们不补密度，补的是**主线的一条事实**。量到的洞是六条线索里
// 只有 `slip-borrowed`（「群里那句『沈薇退的』，名字是宋姐借出去的，货还在群里转」）拿不全 ——
// 40 副牌 naive 走法 22/40，其余五条里四条 40/40、`slip-tape` 39/40（同一把尺子的对照读数，摘掉这三张重跑一遍量的），
// 而主线有五张卡的 `when` 读着它（`main-slip-shen` /
// `-yin` / `-fang` / `-turn` / `-turn-desk`）。原因很直白：真能把它写进本子的是 `main-slip-song` 那一张，
// 而那张要宋姐本人站在楼上、又 `once`（另有两张主线卡的第二格也写它，naive 走法永远取不到第一格以后）。这一条是整条退货单的反转枢纽
// （名字是借的 ⇒ 单子不是沈薇退的），漏掉它等于 45% 的人玩到的故事少一节。于是让走完的线替主线作证：
// 沈薇、小雨、周姐各自回第二趟，把她在群里看见的那一笔带回来 —— 门是**看法**（第一张回访卡认的是落点档，
// 第二张认的是她这一季跟你熟不熟），而写线索那一格只在**本子上还没有这条**时才露出来。
import type { Storylet } from "../types.ts";

type Slot = Storylet["cast"][string];

const shen: Slot = { id: "shen", where: [] };
const anjie: Slot = { id: "anjie", where: [] };
const luyao: Slot = { id: "luyao", where: [] };
const suman: Slot = { id: "suman", where: [] };
const xiaoyu: Slot = { id: "xiaoyu", where: [] };
const zhou: Slot = { id: "zhou", where: [] };
const zhao: Slot = { id: "zhao", where: [] };
const miduo: Slot = { id: "miduo", where: [] };
const mei: Slot = { id: "mei", where: [] };
const yinxiaojie: Slot = { id: "yinxiaojie", where: [] };
const duan: Slot = { id: "duan", where: [] };
const zhaoning: Slot = { id: "zhaoning", where: [] };
/** 回访卡里被带来的那个人：在场的女性顾客或同事，看法不低。 */
const brought: Slot = {
  where: [
    { gender: "$self", is: "f" },
    { any: [{ role: "$self", is: "staff" }, { opinion: "$self", gte: 10 }] },
  ],
};

export const STORYLETS_ECHO: Storylet[] = [
  // —— 沈薇：团队那条线走完以后，她第一次一个人来 ——
  {
    id: "echo-shen",
    kind: "arc",
    cast: { a: shen, b: brought },
    when: [{ season: { gte: 2 } }, { quality: "arc:shen:end", gte: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}这一季第一次一个人站在镜子前，身后没有跟着要同一句话的人。她说那一栏她还空着，今天来是想问一句：还在不在。",
    choices: [
      {
        label: "那一栏一直给她留着",
        when: [{ quality: "arc:shen:end", eq: 1 }],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 },
          { bond: ["shen", "player"], delta: 6 },
        ],
        result: "{$a}把带来的{$b}往前推了半步，说这孩子这季跟谁都不跟，只跟这一柜。",
      },
      {
        label: "照这一季的人数报给她",
        when: [{ any: [{ quality: "arc:shen:end", eq: 4 }, { quality: "arc:shen:end", eq: 2 }] }],
        effects: [{ opinion: "$a", delta: -5 }, { stat: "standing", delta: -2 }],
        result: "{$a}点头，说自己不是来要格子的，是来看这一柜还讲不讲那句准话。讲不讲她都带人来。",
      },
      {
        label: "先问她今天一个人来做什么",
        effects: [{ opinion: "$a", delta: 3 }, { bond: ["shen", "player"], delta: 3 }],
        result: "{$a}说她自己的脸也想被人看一次，不用替谁问，也不用等谁点头。",
      },
    ],
  },

  // —— 安姐：婚礼过了一年，她自己坐到镜前 ——
  {
    id: "echo-anjie",
    kind: "arc",
    cast: { a: anjie },
    when: [{ season: { gte: 2 } }, { quality: "arc:anjie:end", gte: 1 }],
    weight: 28, tension: -1, cooldown: 28,
    text: "{$a}坐下来先把镯子摘了。她说那场婚礼过去整整一年，今天没有名单、没有伴娘，只问她自己的脸要不要紧。",
    choices: [
      {
        label: "按她自己的脸开这一单",
        when: [{ quality: "arc:anjie:end", eq: 1 }, { opinion: "anjie", gte: 6 }],
        effects: [{ opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }],
        result: "{$a}说这一支她自己挑，挑完还要请你看看她眼角——那句她一年没跟谁说过。",
      },
      {
        label: "把去年那套原样再配一次",
        when: [{ any: [{ quality: "arc:anjie:end", eq: 2 }, { quality: "arc:anjie:end", eq: 3 }] }],
        effects: [{ opinion: "$a", delta: 2 }, { bond: ["anjie", "player"], delta: 2 }],
        result: "{$a}说你记性比她好，她今年只负责来取，手别的东西都不管了。",
      },
      {
        label: "今天不给她开单，先听她说",
        effects: [{ opinion: "$a", delta: -3 }],
        result: "{$a}把镯子戴回去，说一年就等到一句「今天没名单我不做」，她起身走得比来时快。",
      },
    ],
  },

  // —— 陆遥：对面那一柜第一次把人往你这边指 ——
  {
    id: "echo-luyao",
    kind: "arc",
    cast: { a: luyao, b: brought },
    when: [{ season: { gte: 2 } }, { quality: "arc:luyao:end", gte: 1 }],
    weight: 30, tension: 1, cooldown: 28,
    text: "{$a}隔着通道叫你一声，说的不是抢人的话。她手边那位{$b}她报不上需求，让你接过去讲清楚，她这一柜今天不接这一单。",
    choices: [
      {
        label: "接过来，当着她的面讲",
        when: [{ quality: "arc:luyao:end", eq: 1 }],
        effects: [
          { opinion: "$a", delta: 5 }, { opinion: "$b", delta: 4 }, { stat: "standing", delta: 2 },
          { bond: ["luyao", "player"], kind: "friend", set: 25 },
        ],
        result: "{$a}把手插在兜里听完，末了说这一柜她今年只让一次，别记成第二次。",
      },
      {
        label: "让她先把人留下再谈",
        when: [{ any: [{ quality: "arc:luyao:end", eq: 2 }, { quality: "arc:luyao:end", eq: 3 }] }],
        effects: [{ opinion: "$a", delta: -4 }, { stat: "standing", delta: 1 }],
        result: "{$a}笑了一下，说这才像话，人她照放，账她照记，谁也别装。",
      },
      {
        label: "这一单你不接",
        when: [{ quality: "arc:luyao:end", gte: 4 }],
        effects: [{ opinion: "$a", delta: -6 }, { opinion: "$b", delta: -4 }],
        result: "{$a}领{$b}回自己那柜，一路说这一柜的规矩她早就摸清了。",
      },
      {
        label: "先把她自己那单做完",
        effects: [{ opinion: "$a", delta: 2 }, { bond: ["luyao", "player"], delta: 3 }],
        result: "{$a}愣了一下，说自己今天没打算买，说完耳朵红了，站在你柜前不走。",
      },
    ],
  },

  // —— 苏蔓：她在收银那边替你留住一个老客 ——
  {
    id: "echo-suman",
    kind: "arc",
    cast: { a: suman },
    when: [{ season: { gte: 2 } }, { quality: "arc:suman:end", gte: 1 }],
    weight: 26, tension: -1, cooldown: 28,
    text: "{$a}在收银那头抬了下巴，说有位老客在楼下站了十分钟，她没报自己名字，只说找这一柜。",
    choices: [
      {
        label: "过去接她",
        when: [{ quality: "arc:suman:end", eq: 1 }],
        effects: [{ opinion: "$a", delta: 5 }, { stat: "standing", delta: 2 }],
        result: "{$a}说她这季还是不上你的镜台，但楼下那位她肯替你领上来。",
      },
      {
        label: "请她替你先问清来意",
        when: [{ any: [{ quality: "arc:suman:end", eq: 3 }, { quality: "arc:suman:end", eq: 4 }] }],
        effects: [{ opinion: "$a", delta: -4 }],
        result: "{$a}说可以，问完她自己上来回一句：那位是来问你有没有换人的。",
      },
      {
        label: "先把手上这一位做完",
        effects: [{ opinion: "$a", delta: 2 }, { bond: ["suman", "player"], delta: 3 }],
        result: "{$a}点头，说这一柜的次序她还记得，那位她替你留着。",
      },
    ],
  },

  // —— 小雨：面试那件事有了下文 ——
  {
    id: "echo-xiaoyu",
    kind: "arc",
    cast: { a: xiaoyu },
    when: [{ season: { gte: 2 } }, { quality: "arc:xiaoyu:end", gte: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}把钱一张一张放在柜面上，数到第三张才停。她说这次不是宿舍凑的了，她自己那份，脸上那颗痘还在。",
    choices: [
      {
        label: "按她自己那份开",
        when: [{ quality: "arc:xiaoyu:end", eq: 1 }],
        effects: [{ opinion: "$a", delta: 6 }, { stat: "standing", delta: 1 }],
        result: "{$a}说群里那句他们还在提，提的是这一柜，她说她答得上来。",
      },
      {
        label: "先把那支不能闷的那句问回来",
        when: [{ any: [{ quality: "arc:xiaoyu:end", eq: 3 }, { quality: "arc:xiaoyu:end", eq: 2 }] }],
        effects: [{ opinion: "$a", delta: 3 }, { bond: ["xiaoyu", "player"], delta: 3 }],
        result: "{$a}说她这次记得了，是自己来问的，回去不打算再跟谁报数。",
      },
      {
        label: "劝她省下这一笔",
        when: [{ quality: "arc:xiaoyu:end", gte: 4 }],
        effects: [{ opinion: "$a", delta: -5 }],
        result: "{$a}把钱收回去，说这一柜现在连她该花多少都要替她定了。",
      },
      {
        label: "照她说的件数开",
        effects: [{ opinion: "$a", delta: 2 }],
        result: "{$a}说了个数又改口，改成少一件，说她现在会自己算了。",
      },
    ],
  },

  // —— 周姐：二十分钟那条规矩换到她这边了 ——
  {
    id: "echo-zhou",
    kind: "arc",
    cast: { a: zhou },
    when: [{ season: { gte: 2 } }, { quality: "arc:zhou:end", gte: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}把手机屏幕朝下扣在柜面。她说今天没人催，同事那一栏她不填，只想把自己这一行说清楚。",
    choices: [
      {
        label: "只听她自己那一句",
        when: [{ quality: "arc:zhou:end", eq: 1 }],
        effects: [{ opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }],
        result: "{$a}说她对比了一整年，最后发现差的是这一柜肯不肯替她记一行。",
      },
      {
        label: "把去年那一行念给她听",
        when: [{ any: [{ quality: "arc:zhou:end", eq: 2 }, { quality: "arc:zhou:end", eq: 3 }] }],
        effects: [{ opinion: "$a", delta: 3 }, { bond: ["zhou", "player"], delta: 4 }],
        result: "{$a}听完说没错，就是这句，她今年自己带钱来了。",
      },
      {
        label: "提醒她对面那句还在",
        when: [{ quality: "arc:zhou:end", gte: 4 }],
        effects: [{ opinion: "$a", delta: -4 }],
        result: "{$a}说那一句她早就还过去了，还的时候当着两个柜的人，说完拿起手机就走。",
      },
      {
        label: "给她留出这十分钟",
        effects: [{ opinion: "$a", delta: 2 }],
        result: "{$a}说今天不用限十分钟，她把排在后面的那位让给了别的柜。",
      },
    ],
  },

  // —— 赵女士：屏幕这一季朝上放 ——
  {
    id: "echo-zhao",
    kind: "arc",
    cast: { a: zhao },
    when: [{ season: { gte: 2 } }, { quality: "arc:zhao:end", gte: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}进门把手机屏幕朝上放在柜面，说这一行她自己写的，不是抄谁的。她说这一句先说好：今天买的是她自己的脸。",
    choices: [
      {
        label: "照她自己那一行走",
        when: [{ quality: "arc:zhao:end", eq: 1 }],
        effects: [{ opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }],
        result: "{$a}说她女儿今天没跟来，跟来也不认这一支，这一支她要自己用完。",
      },
      {
        label: "把两家那一栏分开开",
        when: [{ any: [{ quality: "arc:zhao:end", eq: 2 }, { quality: "arc:zhao:end", eq: 3 }] }],
        effects: [{ opinion: "$a", delta: 3 }, { bond: ["zhao", "player"], delta: 3 }],
        result: "{$a}点头说这一柜还是不替她合并，可合并这件事她今年自己想通了。",
      },
      {
        label: "问一句她女儿认不认",
        when: [{ quality: "arc:zhao:end", gte: 4 }],
        effects: [{ opinion: "$a", delta: -6 }],
        result: "{$a}把屏幕扣回去，说这一柜去年就没认她，今年换成问她的也不是她。",
      },
      {
        label: "先看她自己那一格",
        effects: [{ opinion: "$a", delta: 2 }],
        result: "{$a}说她这一格空了两年，今天想填上，填什么她还没想好，站在那儿想了很久。",
      },
    ],
  },

  // —— 米朵：那句被剪进切片的话有了下文 ——
  {
    id: "echo-miduo",
    kind: "arc",
    cast: { a: miduo },
    when: [{ season: { gte: 2 } }, { quality: "arc:miduo:end", gte: 1 }],
    weight: 28, tension: 1, cooldown: 28,
    text: "{$a}把灯架照旧支在镜边，说这一季她只剪两周，剪之前先把话说明白：那句你说过什么，她今天打算自己念一遍。",
    choices: [
      {
        label: "让她把那句原话念完",
        when: [{ quality: "arc:miduo:end", eq: 1 }],
        effects: [{ opinion: "$a", delta: 5 }, { stat: "standing", delta: 1 }, { bond: ["miduo", "player"], delta: 4 }],
        result: "{$a}念完说自己加了字幕，加的是这一柜那天的原话，一个字没改。",
      },
      {
        label: "先把台账那一行对上",
        when: [{ any: [{ quality: "arc:miduo:end", eq: 2 }, { quality: "arc:miduo:end", eq: 4 }] }],
        effects: [{ opinion: "$a", delta: -3 }, { stat: "compliance", delta: 3 }],
        result: "{$a}说行，她把那一格填回去，填完问我这一柜是不是每季都要这一页。",
      },
      {
        label: "今天不让灯进镜",
        when: [{ quality: "arc:miduo:end", gte: 3 }],
        effects: [{ opinion: "$a", delta: -6 }],
        result: "{$a}把灯收进包里，说这一柜去年也是这么讲的，讲完还是签了那张。",
      },
      {
        label: "跟她约好哪些不进片",
        effects: [{ opinion: "$a", delta: 3 }],
        result: "{$a}在单子上画了两条线，说线里随便拍，线外她替这一柜挡。",
      },
    ],
  },

  // —— 梅女士：那十分钟是她自己给自己的 ——
  {
    id: "echo-mei",
    kind: "arc",
    cast: { a: mei },
    when: [{ season: { gte: 2 } }, { quality: "arc:mei:end", gte: 1 }],
    weight: 30, tension: -1, cooldown: 28,
    text: "{$a}今天进来先看了三次表，第四次没看。她说那一支已经用完了，这一柜她排了两周，不为见客户。",
    choices: [
      {
        label: "按她自己的脸讲那一支",
        when: [{ quality: "arc:mei:end", eq: 1 }],
        effects: [{ opinion: "$a", delta: 8 }, { stat: "standing", delta: 2 }, { bond: ["mei", "player"], delta: 6 }],
        result: "{$a}说这句话她去年就想听，去年那一柜她只肯给自己十分钟，今年多出来的都是这一柜的。",
      },
      {
        label: "把柜外那句话澄清",
        when: [{ quality: "arc:mei:end", eq: 2 }],
        effects: [{ opinion: "$a", delta: 4 }],
        result: "{$a}说她听见了，听见那天她没回头，今天回头了，是要看这一柜自己说不说得出口。",
      },
      {
        label: "照客户那一栏开",
        when: [{ any: [{ quality: "arc:mei:end", eq: 3 }, { quality: "arc:mei:end", gte: 4 }] }],
        effects: [{ opinion: "$a", delta: -3 }],
        result: "{$a}把单子推回来，说自己今天不是客户，说完坐了整整二十分钟。",
      },
      {
        label: "今天不报价，先听",
        effects: [{ opinion: "$a", delta: 2 }],
        result: "{$a}说的第一句是「你别拿表看我了」，第二句比第一句慢很多。",
      },
    ],
  },

  // —— 尹小姐：那支笔她带回来了 ——
  {
    id: "echo-yinxiaojie",
    kind: "arc",
    cast: { a: yinxiaojie, b: brought },
    when: [{ season: { gte: 3 } }, { quality: "arc:yinxiaojie:end", gte: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}进门先看价签，不看人。她说这一季带个人来，那人问的那句跟她去年问的一模一样，她答不上来，所以带来给你答。",
    choices: [
      {
        label: "照她的原话答给{$b}",
        when: [{ quality: "arc:yinxiaojie:end", eq: 1 }],
        effects: [
          { opinion: "$a", delta: 6 }, { opinion: "$b", delta: 4 }, { stat: "standing", delta: 1 },
          { bond: ["yinxiaojie", "$b"], delta: 4 },
        ],
        result: "{$a}在旁边听着，听完说她去年就是这句话，只是没人肯当着她再说一遍。",
      },
      {
        label: "让她自己那句拿回去讲",
        when: [{ any: [{ quality: "arc:yinxiaojie:end", eq: 2 }, { quality: "arc:yinxiaojie:end", eq: 3 }] }],
        effects: [{ opinion: "$a", delta: 3 }, { bond: ["yinxiaojie", "player"], delta: 3 }],
        result: "{$a}把那支笔搁在柜面上，说这一句她抄给你，下一柜不用你替她讲。",
      },
      {
        label: "只接她带来的那位",
        when: [{ quality: "arc:yinxiaojie:end", gte: 4 }],
        effects: [{ opinion: "$a", delta: -6 }, { opinion: "$b", delta: 2 }],
        result: "{$a}走到镜台前站住，说这一柜还是只认新的一张脸，她把笔带走。",
      },
      {
        label: "两个一起问",
        effects: [{ opinion: "$a", delta: 2 }, { opinion: "$b", delta: 2 }],
        result: "{$a}先不开口，让{$b}问完，她补的那一句比{$b}那句更狠。",
      },
    ],
  },

  // —— 段小姐：那一行今年填了字 ——
  {
    id: "echo-duan",
    kind: "arc",
    cast: { a: duan },
    when: [{ season: { gte: 3 } }, { quality: "arc:duan:end", gte: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}站在柜前，说的第一句不是闷痘，是她自己的名字。她说这一季她是来买东西的，不是来问东西的。",
    choices: [
      {
        label: "按她自己那一行开",
        when: [{ any: [{ quality: "arc:duan:end", eq: 1 }, { quality: "arc:duan:end", eq: 4 }] }],
        effects: [{ opinion: "$a", delta: 6 }, { stat: "standing", delta: 1 }, { bond: ["duan", "player"], delta: 4 }],
        result: "{$a}念了一遍自己的名字才坐下，说这一年就等这一柜不把她写成别人。",
      },
      {
        label: "先问那一行为什么空着",
        when: [{ quality: "arc:duan:end", eq: 2 }],
        effects: [{ opinion: "$a", delta: 3 }],
        result: "{$a}说空着是她自己不让填的，今年填不填看我这里。",
      },
      {
        label: "把那支还在原处的给她",
        when: [{ quality: "arc:duan:end", eq: 3 }],
        effects: [{ opinion: "$a", delta: -2 }, { stat: "standing", delta: 1 }],
        result: "{$a}说这一柜还是会把货留在柜上等人来问，她今年偏要自己拿走。",
      },
      {
        label: "照她今天说的做",
        effects: [{ opinion: "$a", delta: 2 }],
        result: "{$a}说完自己的名字，又小声加了一句别的，那句比名字还长。",
      },
    ],
  },

  // —— 赵宁：妈妈那一栏她今年自己填 ——
  {
    id: "echo-zhaoning",
    kind: "arc",
    cast: { a: zhaoning },
    when: [{ season: { gte: 3 } }, { quality: "arc:zhaoning:end", gte: 1 }],
    weight: 28, tension: 1, cooldown: 28,
    text: "{$a}一个人来，屏幕亮着，那一行是她自己的字迹。她说她妈妈这一季没来，这一单她想按自己那一行走，问这一柜认不认。",
    choices: [
      {
        label: "认她那一行",
        when: [{ quality: "arc:zhaoning:end", eq: 1 }],
        effects: [{ opinion: "$a", delta: 6 }, { stat: "standing", delta: 1 }, { bond: ["zhaoning", "player"], delta: 5 }],
        result: "{$a}把屏幕推过来让我看日期，那一栏写的不是她妈妈的名字。",
      },
      {
        label: "把两栏都念一遍",
        when: [{ any: [{ quality: "arc:zhaoning:end", eq: 2 }, { quality: "arc:zhaoning:end", eq: 3 }] }],
        effects: [{ opinion: "$a", delta: 3 }],
        result: "{$a}听完说这一柜还是会把两句都讲，讲完还是要她自己选，她这次选得快。",
      },
      {
        label: "劝她等妈妈一起来",
        when: [{ quality: "arc:zhaoning:end", gte: 4 }],
        effects: [{ opinion: "$a", delta: -7 }],
        result: "{$a}把屏幕按掉，说去年这一柜就是这么留的，留到最后那行也没念出来。",
      },
      {
        label: "先问她这一次买给自己什么",
        effects: [{ opinion: "$a", delta: 2 }, { bond: ["zhaoning", "player"], delta: 2 }],
        result: "{$a}想了很久才答，答案短，说完自己先笑了。",
      },
    ],
  },

  // —— 第二回：走完的线替主线作证（第 26 轮）——
  // 三张卡写的是同一条事实：`slip-borrowed`。不是冗余，是给一条只有一个写入方的反转枢纽补三条替代路径；
  // 每一张的露出条件都带 `not: clue`，本子上已经有了这一条的人不会再看一遍同样的话。
  {
    id: "echo2-shen",
    kind: "arc",
    cast: { a: shen },
    when: [{ season: { gte: 2 } }, { quality: "arc:shen:end", gte: 1 }],
    weight: 24, tension: 1, cooldown: 28,
    text: "{$a}这一季又来了一回，站的位置比上回靠里。她说她在群里看见了那条截图，名字是她的，话不是她说的。",
    choices: [
      {
        label: "问那句是谁先发的",
        when: [{ not: { clue: "slip-borrowed" } }, { opinion: "shen", gte: 10 }],
        effects: [{ clue: "slip-borrowed" }, { opinion: "$a", delta: 4 }, { stat: "standing", delta: 1 }],
        result: "{$a}说发的人她认得，名字是群里借的，货在群里转了一圈才转到她跟前。这一句她讲给你，没讲给别人。",
      },
      {
        label: "让她别去群里对那句话",
        when: [{ quality: "arc:shen:end", eq: 1 }],
        effects: [{ opinion: "$a", delta: 3 }, { bond: ["shen", "player"], delta: 4 }],
        result: "{$a}说她没打算对，就对过一次，输的是她。这回她把手机留在兜里。",
      },
      {
        label: "先问她这一季还带不带人来",
        effects: [{ opinion: "$a", delta: 2 }],
        result: "{$a}说带，但这一季她要先把自己那一栏填了，再领别人。",
      },
    ],
  },

  {
    id: "echo2-xiaoyu",
    kind: "arc",
    cast: { a: xiaoyu },
    when: [{ season: { gte: 2 } }, { quality: "arc:xiaoyu:end", gte: 1 }],
    weight: 24, tension: 0, cooldown: 28,
    text: "{$a}把手机举到你跟前，屏幕停在群里那条置顶。她说这一季她学会了一件事：先看清名字是谁打上去的，再决定跟不跟。",
    choices: [
      {
        label: "让她把那条的来处念完",
        when: [{ not: { clue: "slip-borrowed" } }, { opinion: "xiaoyu", gte: 8 }],
        effects: [{ clue: "slip-borrowed" }, { opinion: "$a", delta: 4 }],
        result: "{$a}翻到最早那一层，说名字不是沈薇自己写上去的，是群里借的，货到现在还在群里转。她举着手机等你记。",
      },
      {
        label: "问她这一季还跟不跟那句",
        when: [{ quality: "arc:xiaoyu:end", eq: 1 }],
        effects: [{ opinion: "$a", delta: 3 }, { bond: ["xiaoyu", "player"], delta: 3 }],
        result: "{$a}说不了，说完把屏幕擦了一下，说这一季她把钱花在自己脸上。",
      },
      {
        label: "先给她开这一单",
        effects: [{ opinion: "$a", delta: 2 }],
        result: "{$a}把手机收回去，说单照开，那一栏她自己填。",
      },
    ],
  },

  {
    id: "echo2-zhou",
    kind: "arc",
    cast: { a: zhou },
    when: [{ season: { gte: 3 } }, { quality: "arc:zhou:end", gte: 1 }],
    weight: 24, tension: 1, cooldown: 28,
    text: "{$a}这一季坐下来，第一句不问价。她说同一句话她在对面也听见了一遍，两个柜讲的不是同一个版本。",
    choices: [
      {
        label: "问她在对面那句是谁先说的",
        when: [{ not: { clue: "slip-borrowed" } }, { opinion: "zhou", gte: 6 }],
        effects: [{ clue: "slip-borrowed" }, { opinion: "$a", delta: 4 }, { stat: "standing", delta: 1 }],
        result: "{$a}说对面那句也是从群里来的，名字是借的，货在群里转。她比了一整季，比出来的是这一句。",
      },
      {
        label: "请她把两个版本并排说完",
        when: [{ quality: "arc:zhou:end", eq: 1 }],
        effects: [{ opinion: "$a", delta: 3 }, { bond: ["zhou", "player"], delta: 3 }],
        result: "{$a}一条一条并着说，说完说自己那一份不要了，只要这一柜把日子记对。",
      },
      {
        label: "先把手上那位做完",
        effects: [{ opinion: "$a", delta: 2 }],
        result: "{$a}说行，她等着，说完把自己那一行在手机上又看了一遍。",
      },
    ],
  },
];

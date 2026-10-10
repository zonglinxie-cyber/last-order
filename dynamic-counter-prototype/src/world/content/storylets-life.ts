// 人生一步：走完的线里那个人，这几年里自己的日子往前挪了一格。第 29 轮（任务 26「第 5 季的真新内容」第一刀）。
// 为什么要这一批：模拟器那张「每季的故事卡」量到第 5、6 季各抽到 15 次故事卡、**新演 0 张** ——
// 十四行读数里只有这两行带「这一季一张新剧情都没有」的旗（见 docs/人情场设计.md 的「主线那句只在落地那一季说完」）。
// 回访卡（storylets-echo.ts）买的是"她回得来"，回来的理由仍是她上一季怎么收的 —— 她本人没有往前走。
// 这一批补的是另一半：**她在过自己的日子，而你是她生活里的一个人**（长线玩法提案 §4）。
//
// 口径：
// - 一张卡 = 她人生里的一步。第 5 季那一步写 `life:<人>` = 1（从没走过这一步，门是 `life:<人> ≤ 0`），
//   第 6 季那一步认 `life:<人>` = 1，写到 2。步数是序数，不是分数，谁大谁小没有意义。
// - 同一步怎么落的写 `life:<人>:how`：1 = 她还把这一柜当自己人 · 2 = 只剩生意 · 3 = 这一格她不留了。
//   下一步的三种说法就按这一档开门 —— 玩家上一年的待法决定她下一年长什么样，跟 `arc:<人>:end` 那套一样。
// - 键都以 `life:` 开头，所以换季由引擎原样带走（`CARRIED_QUALITY`），不需要新的存档字段。
// - **都不给钱**（`stat: money` 一次都不出现）：这一批要动的是"第 5 季有没有新剧情"，不是经济。
//   柜位、台账、看法、冷暖照旧只给小的数。
// - 每人一季最多一次：`cooldown: 28`，跟回访卡同一个口径（判据是 `day - fired < cooldown`，
//   一季 28 天，冷却必须 ≥ 28 才封得住整季 —— 第 26 轮那条边界量过）。
// - 年纪不写死数字：界面念的是 `Person.age`（人物表里那个数不随季加），卡里再报一个岁数会对不上。
//   §4 的「每过一年加 1 岁」要连界面一起做，本轮先不做，卡里只说"这几年"。
//
// 名册（20 条第 5 季 + 12 条第 6 季）：写死的名单在 tests/world-content.test.ts 里钉着，
// 补人要在名单上选边，不许悄悄加。第 29 轮那批只有 8 位，第 30 轮把 ARC_PEOPLE 剩下的 12 位补齐 ——
// 凡是有一条个人线的常客，线走完以后在第 5 季都有自己的那一步；第 6 季那一步第 31 轮铺到 12 位，
// 还差 8 位（尹小洁、段小姐、赵宁、罗曼、乔晚、宋姐、白姐、裴岚）—— 她们的第 5 季那一步有两种落法的先补。
// 每人几档落点不一样（4 到 6 档），所以"按落点开门的那几颗合起来必须盖满她全部的档"由名单守卫逐档核。
import type { Storylet } from "../types.ts";

// 本轮出场的八位：全部钉死 id，且都是女性 —— 代词体检（world-lint 那条「槽可能绑到男性时不许用她」）
// 靠这一点放行，卡里才敢写「她」。
const shen = { id: "shen" as const, where: [] };
const anjie = { id: "anjie" as const, where: [] };
const mei = { id: "mei" as const, where: [] };
const xiaoyu = { id: "xiaoyu" as const, where: [] };
const zhou = { id: "zhou" as const, where: [] };
const suman = { id: "suman" as const, where: [] };
const luyao = { id: "luyao" as const, where: [] };
const miduo = { id: "miduo" as const, where: [] };
// 第 30 轮补的十二位：同样全部钉死 id、全部是女性，卡里才敢写「她」。
const zhao = { id: "zhao" as const, where: [] };
const yinxiaojie = { id: "yinxiaojie" as const, where: [] };
const duan = { id: "duan" as const, where: [] };
const zhaoning = { id: "zhaoning" as const, where: [] };
const tangke = { id: "tangke" as const, where: [] };
const roman = { id: "roman" as const, where: [] };
const fangmin = { id: "fangmin" as const, where: [] };
const qiaowan = { id: "qiaowan" as const, where: [] };
const songjie = { id: "songjie" as const, where: [] };
const baijie = { id: "baijie" as const, where: [] };
const peilan = { id: "peilan" as const, where: [] };
const liangxia = { id: "liangxia" as const, where: [] };

/** 落点门：她上几季怎么收的那一档。 */
const end = (id: string, n: number) => ({ quality: `arc:${id}:end`, eq: n });
const endUp = (id: string, n: number) => ({ quality: `arc:${id}:end`, gte: n });
/** 那一步怎么落的。 */
const how = (id: string, n: number) => ({ quality: `life:${id}:how`, eq: n });
const stepped = (id: string) => ({ quality: `life:${id}`, lte: 0 });
/** 同一步的两种说法：你跟她这几年处下来的温差。 */
const warm = (id: string, n: number) => ({ opinion: id, gte: n });
const cold = (id: string, n: number) => ({ opinion: id, lte: n });

export const STORYLETS_LIFE: Storylet[] = [
  // ============ 第 5 季：那一步 ============
  // —— 沈薇：那一栏换了人，她第一次只为自己那一支开口 ——
  {
    id: "life-shen",
    kind: "arc",
    cast: { a: shen },
    when: [{ season: { gte: 5 } }, { quality: "arc:shen:end", gte: 1 }, stepped("shen")],
    weight: 30, tension: 0, cooldown: 28,
    text: "{$a}今天是一个人来的，身后没人要同一句话。她说组里换了个带的人，那一栏如今归在别人名下，她报了三年名字，今年报的是自己那一支。",
    choices: [
      {
        label: "把她当带人的那一位问",
        when: [end("shen", 1), warm("shen", 8)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 },
          { bond: ["shen", "player"], delta: 6 },
          { quality: "life:shen", set: 1 }, { quality: "life:shen:how", set: 1 },
        ],
        result: "{$a}说组里那几个孩子还在问这一柜换没换人，她说没换，替你们把话带回去了。",
      },
      {
        label: "先问她今年还带不带人来",
        when: [endUp("shen", 2)],
        effects: [
          { opinion: "$a", delta: 3 }, { bond: ["shen", "player"], delta: 3 },
          { quality: "life:shen", set: 1 }, { quality: "life:shen:how", set: 1 },
        ],
        result: "{$a}说她带不动了，如今只管自己那张脸，说完把去年那几份名单从包里抽走，没留给你。",
      },
      {
        label: "那一栏已经不归她，就照散客开",
        when: [cold("shen", -3)],
        effects: [
          { opinion: "$a", delta: -5 }, { stat: "standing", delta: -2 },
          { quality: "life:shen", set: 1 }, { quality: "life:shen:how", set: 2 },
        ],
        result: "{$a}点头说她就知道这一柜认的是那一栏不是她，这一支她自己挑，挑完就走。",
      },
      {
        label: "今天只当她是一个客人",
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:shen", set: 1 }, { quality: "life:shen:how", set: 2 },
        ],
        result: "{$a}愣了一下，说这句她等了几年，说完把袖口整了整，坐进镜前没再提组里的事。",
      },
    ],
  },

  // —— 安姐：去年她请你跟妆，今年她替别人来问 ——
  {
    id: "life-anjie",
    kind: "arc",
    cast: { a: anjie },
    when: [{ season: { gte: 5 } }, { quality: "arc:anjie:end", gte: 1 }, stepped("anjie")],
    weight: 30, tension: -1, cooldown: 28,
    text: "{$a}进门先把手里那张单子摊在柜面，上面写的不是她的名字。她说那场婚礼过完这几年，如今别人请她去看妆，她自己坐镜前的次数反倒少了。",
    choices: [
      {
        label: "照她自己的脸开这一支",
        when: [end("anjie", 1), warm("anjie", 8)],
        effects: [
          { opinion: "$a", delta: 8 }, { stat: "standing", delta: 2 },
          { bond: ["anjie", "player"], delta: 5 },
          { quality: "life:anjie", set: 1 }, { quality: "life:anjie:how", set: 1 },
        ],
        result: "{$a}说那一场她替别人看了三年，今天想有人替她看一次，眼角那句她一年没跟谁说过。",
      },
      {
        label: "先问单子上那位要什么",
        when: [end("anjie", 2), end("anjie", 3)],
        effects: [
          { opinion: "$a", delta: 4 }, { stat: "compliance", delta: 2 },
          { quality: "life:anjie", set: 1 }, { quality: "life:anjie:how", set: 1 },
        ],
        result: "{$a}说单子上那孩子只要求一句话：别当着人问她和那场的关系，她把这条替人家守得住。",
      },
      {
        label: "这一单按她的名气要价",
        when: [cold("anjie", -3)],
        effects: [
          { opinion: "$a", delta: -6 }, { stat: "standing", delta: -2 },
          { quality: "life:anjie", set: 1 }, { quality: "life:anjie:how", set: 3 },
        ],
        result: "{$a}把单子收回包里，说她如今也能替人挑柜了，第一句就败在这价钱上，说完人已经转身。",
      },
      {
        label: "那张单子她谁的也不交，自己拿着",
        when: [end("anjie", 4)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "compliance", delta: 1 },
          { quality: "life:anjie", set: 1 }, { quality: "life:anjie:how", set: 3 },
        ],
        result: "{$a}说这一单她不交给谁，看完妆她自己结账，这几年头一回不欠谁一句公道话。",
      },
      {
        label: "先把她自己那支开完",
        effects: [
          { opinion: "$a", delta: 3 }, { bond: ["anjie", "player"], delta: 3 },
          { quality: "life:anjie", set: 1 }, { quality: "life:anjie:how", set: 1 },
        ],
        result: "{$a}说单子上那位下午来，她先在镜前把自己这一支弄完，这几年第一次不赶时间。",
      },
    ],
  },

  // —— 梅女士：那十分钟终于成了一整个下午 ——
  {
    id: "life-mei",
    kind: "arc",
    cast: { a: mei },
    when: [{ season: { gte: 5 } }, { quality: "arc:mei:end", gte: 1 }, stepped("mei")],
    weight: 32, tension: -1, cooldown: 28,
    text: "{$a}今天进门没看表。她说她从那个位置上退下来了，一下午都是自己的，第一次来不是为了见谁，坐下先把包放到镜台边上。",
    choices: [
      {
        label: "把下午排给她一个人",
        when: [end("mei", 1), warm("mei", 8)],
        effects: [
          { opinion: "$a", delta: 8 }, { stat: "standing", delta: 2 },
          { bond: ["mei", "player"], delta: 6 },
          { quality: "life:mei", set: 1 }, { quality: "life:mei:how", set: 1 },
        ],
        result: "{$a}说她以前替别人挑了半辈子，今天想被人问一次自己想要什么，说到这儿她把那一支推回来，要求重挑。",
      },
      {
        label: "先问她退下来以后做什么",
        when: [endUp("mei", 2)],
        effects: [
          { opinion: "$a", delta: 4 },
          { quality: "life:mei", set: 1 }, { quality: "life:mei:how", set: 1 },
        ],
        result: "{$a}说有个老客户把她请去帮忙，还是替人挑，只是这回她自己定价钱，说完自己先笑了。",
      },
      {
        label: "提醒她后面还有客人",
        when: [cold("mei", -4)],
        effects: [
          { opinion: "$a", delta: -6 }, { stat: "standing", delta: -2 },
          { quality: "life:mei", set: 1 }, { quality: "life:mei:how", set: 3 },
        ],
        result: "{$a}把包拿起来，说这一柜几年里给她的那十分钟她一直记着，起身走得比来时慢。",
      },
      {
        label: "照她今天说的件数开",
        effects: [
          { opinion: "$a", delta: 3 },
          { quality: "life:mei", set: 1 }, { quality: "life:mei:how", set: 2 },
        ],
        result: "{$a}说要那一支就行，多的不要，她说退下来以后才明白，替自己省也是省。",
      },
    ],
  },

  // —— 小雨：她不再是那群里的一个名字 ——
  {
    id: "life-xiaoyu",
    kind: "arc",
    cast: { a: xiaoyu },
    when: [{ season: { gte: 5 } }, { quality: "arc:xiaoyu:end", gte: 1 }, stepped("xiaoyu")],
    weight: 30, tension: 0, cooldown: 28,
    text: "{$a}进门穿的是一身工牌还没摘的衣服。她说她现在带两个人，那两人把她往这一柜指，她自己来是把那一行填成自己的名字。",
    choices: [
      {
        label: "把她那两个孩子的需求也问了",
        when: [end("xiaoyu", 1), warm("xiaoyu", 8)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 3 },
          { bond: ["xiaoyu", "player"], delta: 5 },
          { quality: "life:xiaoyu", set: 1 }, { quality: "life:xiaoyu:how", set: 1 },
        ],
        result: "{$a}说群里那句如今提的是这一柜，她替你们接了两个人，条件只有一个：别当着她们的面说她当年那点数。",
      },
      {
        label: "只给她自己那一支",
        when: [endUp("xiaoyu", 2)],
        effects: [
          { opinion: "$a", delta: 4 },
          { quality: "life:xiaoyu", set: 1 }, { quality: "life:xiaoyu:how", set: 1 },
        ],
        result: "{$a}说她今天那份是自己出的钱，那两个孩子的单她不带，说完把工牌翻过去扣在桌上。",
      },
      {
        label: "问她拿不拿得下这个价",
        when: [cold("xiaoyu", -3)],
        effects: [
          { opinion: "$a", delta: -5 }, { quality: "life:xiaoyu", set: 1 }, { quality: "life:xiaoyu:how", set: 2 },
        ],
        result: "{$a}说她现在也能报数了，报完比自己去年那笔多，多的是替别人要的那一份，这句她说得很平。",
      },
      {
        label: "先把她自己那一步问清",
        effects: [
          { opinion: "$a", delta: 3 }, { bond: ["xiaoyu", "player"], delta: 3 },
          { quality: "life:xiaoyu", set: 1 }, { quality: "life:xiaoyu:how", set: 1 },
        ],
        result: "{$a}想了一会儿，说她自己还没想好要什么，只说不想再被人当成凑单的那一个，站着把那支拿起来又放下。",
      },
    ],
  },

  // —— 周姐：去年那二十分钟今年换她给别人 ——
  {
    id: "life-zhou",
    kind: "arc",
    cast: { a: zhou },
    when: [{ season: { gte: 5 } }, { quality: "arc:zhou:end", gte: 1 }, stepped("zhou")],
    weight: 30, tension: 1, cooldown: 28,
    text: "{$a}把手机屏幕朝下扣在柜面，身后跟着两个不肯坐的年轻人。她说组里如今是她排班，那两位的时间她替她们省，她自己这一行还是要来这面镜前对。",
    choices: [
      {
        label: "把那两位先请到镜前",
        when: [end("zhou", 1), warm("zhou", 8)],
        effects: [
          { opinion: "$a", delta: 5 }, { stat: "standing", delta: 3 },
          { bond: ["zhou", "player"], delta: 5 },
          { quality: "life:zhou", set: 1 }, { quality: "life:zhou:how", set: 1 },
        ],
        result: "{$a}说这一柜她还是那句话：她带人来，不为拿人情，为的是那两位不用再被人按着对比一整年。",
      },
      {
        label: "先问她今年还比不比",
        when: [end("zhou", 2), end("zhou", 3)],
        effects: [
          { opinion: "$a", delta: 3 },
          { quality: "life:zhou", set: 1 }, { quality: "life:zhou:how", set: 2 },
        ],
        result: "{$a}说她不比了，如今是她替别人比，问完那两个孩子的需求自己先答了一遍，答得比柜上还细。",
      },
      {
        label: "让那两位自己开口",
        when: [cold("zhou", -3)],
        effects: [
          { opinion: "$a", delta: -5 }, { stat: "standing", delta: -1 },
          { quality: "life:zhou", set: 1 }, { quality: "life:zhou:how", set: 2 },
        ],
        result: "{$a}把手机翻过来，说她去年就是被人这样推出去的，今天轮到她站在外头，那句她没说第二遍。",
      },
      {
        label: "二十分钟用完，留不留让她自己说",
        when: [end("zhou", 4)],
        effects: [
          { opinion: "$a", delta: 3 }, { bond: ["zhou", "player"], delta: 3 },
          { quality: "life:zhou", set: 1 }, { quality: "life:zhou:how", set: 2 },
        ],
        result: "{$a}说时间到了她自己也愣了一下，这几年她都是被人掐着点送走的，今天这句留还是不留轮得到她自己说。",
      },
      {
        label: "今天只给她留时间",
        effects: [
          { opinion: "$a", delta: 4 },
          { quality: "life:zhou", set: 1 }, { quality: "life:zhou:how", set: 1 },
        ],
        result: "{$a}说那两位她送回楼下等，自己坐下来，第一次不把二十分钟挂在嘴上。",
      },
    ],
  },

  // —— 苏蔓：她把老客交出去以后，第一次坐到自己镜前 ——
  {
    id: "life-suman",
    kind: "arc",
    cast: { a: suman },
    when: [{ season: { gte: 5 } }, { quality: "arc:suman:end", gte: 1 }, stepped("suman")],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}今天不在收银那头。她穿着自己的衣服坐在镜前，说这一柜她几年里替别人领了无数趟人，今天轮到她自己的脸没人管。",
    choices: [
      {
        label: "把她当客人，不当同事",
        when: [end("suman", 1), warm("suman", 8)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["suman", "player"], delta: 6 },
          { quality: "life:suman", set: 1 }, { quality: "life:suman:how", set: 1 },
        ],
        result: "{$a}说她那些老客还是只认这一柜，认的是你把他们当人，不是当人数，这句她替你们说了三年。",
      },
      {
        label: "先问那一柜还缺不缺人",
        when: [end("suman", 2), end("suman", 4)],
        effects: [
          { opinion: "$a", delta: -3 }, { stat: "standing", delta: 1 },
          { quality: "life:suman", set: 1 }, { quality: "life:suman:how", set: 2 },
        ],
        result: "{$a}说她今天不是来谈柜上的事的，说完把工牌放进包里，那一下她坐得比方才远。",
      },
      {
        label: "按她自己的脸开",
        when: [end("suman", 3)],
        effects: [
          { opinion: "$a", delta: 4 },
          { quality: "life:suman", set: 1 }, { quality: "life:suman:how", set: 1 },
        ],
        result: "{$a}说她如今管的是别人，自己的这一支拖了几年没管，问你该从哪儿补，问得很实在。",
      },
      {
        label: "先问她今天替谁来",
        effects: [
          { opinion: "$a", delta: -4 }, { bond: ["suman", "player"], delta: -3 },
          { quality: "life:suman", set: 1 }, { quality: "life:suman:how", set: 3 },
        ],
        result: "{$a}说不替谁，就替她自己，这句她说过一遍不想再说第二遍，起身去楼下等下一班电梯。",
      },
    ],
  },

  // —— 陆遥：对面那一柜今年把她自己也算进去了 ——
  {
    id: "life-luyao",
    kind: "arc",
    cast: { a: luyao },
    when: [{ season: { gte: 5 } }, { quality: "arc:luyao:end", gte: 1 }, stepped("luyao")],
    weight: 30, tension: 1, cooldown: 28,
    text: "{$a}站在通道那边没过来。她说楼上今年把她那一柜并给了别人管，她现在的名头跟你的差不多，比的是谁还肯站镜前，不再是谁站在对面。",
    choices: [
      {
        label: "把她那柜的人也算进来",
        when: [end("luyao", 1), warm("luyao", 6)],
        effects: [
          { opinion: "$a", delta: 5 }, { stat: "standing", delta: 2 },
          { bond: ["luyao", "player"], kind: "friend", set: 25 },
          { quality: "life:luyao", set: 1 }, { quality: "life:luyao:how", set: 1 },
        ],
        result: "{$a}说她今年只让一次，让的是她那柜的三个人往你这边送，账照记，谁也别装。",
      },
      {
        label: "问她去不去别处",
        when: [end("luyao", 2), end("luyao", 3)],
        effects: [
          { opinion: "$a", delta: 3 },
          { quality: "life:luyao", set: 1 }, { quality: "life:luyao:how", set: 2 },
        ],
        result: "{$a}说她去过，那边要的是她的数不是她这个人，说完回自己那柜，走了两步又回头补一句：这一柜还在。",
      },
      {
        label: "这一季照旧各看一边",
        when: [cold("luyao", -4)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: -1 },
          { quality: "life:luyao", set: 1 }, { quality: "life:luyao:how", set: 3 },
        ],
        result: "{$a}说好，那她按老规矩来，说完当着你的面把这一季的数抄进她自己那本，一笔没多给你。",
      },
      {
        label: "她仍坐对面那一格，就按对面这格问",
        when: [end("luyao", 4)],
        effects: [
          { opinion: "$a", delta: -2 }, { stat: "standing", delta: 1 },
          { quality: "life:luyao", set: 1 }, { quality: "life:luyao:how", set: 2 },
        ],
        result: "{$a}说对面那一格她今年还坐着，截来的句子照旧给她自己用，你今天不必替这柜多解释一句，她听得懂。",
      },
      {
        label: "先让她把话说完",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["luyao", "player"], delta: 4 },
          { quality: "life:luyao", set: 1 }, { quality: "life:luyao:how", set: 1 },
        ],
        result: "{$a}说她今天不是来争的，是想问一句：如果她那柜散了，你这边收不收人，问完自己先低头笑。",
      },
    ],
  },

  // —— 米朵：她的号做起来了，那份单子的格式像极了谁 ——
  {
    id: "life-miduo",
    kind: "arc",
    cast: { a: miduo },
    when: [{ season: { gte: 5 } }, { quality: "arc:miduo:end", gte: 1 }, stepped("miduo")],
    weight: 30, tension: 1, cooldown: 28,
    text: "{$a}把灯架留在家里，第一次空手来。她说她那号如今有人给她发东西，她挑了三家，第三家是你这柜，来之前她把那三页表拍下来给人看了。",
    choices: [
      {
        label: "把这三页跟她一页一页对",
        when: [end("miduo", 1), warm("miduo", 6)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }, { stat: "compliance", delta: 3 },
          { bond: ["miduo", "player"], delta: 5 },
          { quality: "life:miduo", set: 1 }, { quality: "life:miduo:how", set: 1 },
        ],
        result: "{$a}说对面那两家给的是成品句，只这一柜肯跟她一行一行对，那句她说得很响，旁边柜的同事都抬头了。",
      },
      {
        label: "问她那三页是谁做的表",
        when: [endUp("miduo", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:miduo", set: 1 }, { quality: "life:miduo:how", set: 2 },
        ],
        result: "{$a}说表是楼上统发的，四家同一张，第四页那一栏照旧空着，等一个当时顶班的人签，她这次也没替谁签。",
      },
      {
        label: "让她先把这一柜报进号里",
        when: [cold("miduo", -3)],
        effects: [
          { opinion: "$a", delta: -5 }, { stat: "compliance", delta: -4 },
          { quality: "life:miduo", set: 1 }, { quality: "life:miduo:how", set: 2 },
        ],
        result: "{$a}说行，她把那一页拍给你看，报的是去年那一档，一个字没夸，台账这一格你自己回去补。",
      },
      {
        label: "先问她自己要不要",
        effects: [
          { opinion: "$a", delta: 5 },
          { quality: "life:miduo", set: 1 }, { quality: "life:miduo:how", set: 1 },
        ],
        result: "{$a}想了很久，说这几年都是替别人挑，她自己那张脸多久没被人问过了，问到这儿她把手机扣在桌上。",
      },
    ],
  },

  // ============ 第 6 季：那一步的下一步 ============
  // —— 沈薇：她去年那一支用完以后 ——
  {
    id: "life2-shen",
    kind: "arc",
    cast: { a: shen },
    when: [{ season: { gte: 6 } }, { quality: "arc:shen:end", gte: 1 }, { quality: "life:shen", eq: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}把去年那只空瓶放在柜面上。她说组里那一栏今年干脆没了，她倒把那句话学会了自己念，来问这一柜还认不认她这个人。",
    choices: [
      {
        label: "认，把她写进自己的名单",
        when: [how("shen", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }, { bond: ["shen", "player"], delta: 5 },
          { quality: "life:shen", set: 2 }, { quality: "life:shen:how", set: 1 },
        ],
        result: "{$a}说她不带人了，可她说得出谁需要哪一支，这句她憋了几年，今天说得很慢。",
      },
      {
        label: "按散客那一档报给她",
        when: [how("shen", 2)],
        effects: [
          { opinion: "$a", delta: -3 }, { quality: "life:shen", set: 2 }, { quality: "life:shen:how", set: 2 },
        ],
        result: "{$a}说这一档她去年就听见了，今年再来是想确认一次，确认完拿起瓶子走了，走得跟去年一样。",
      },
      {
        label: "问她还来不来",
        when: [how("shen", 3)],
        effects: [
          { opinion: "$a", delta: 2 }, { bond: ["shen", "player"], delta: 3 },
          { quality: "life:shen", set: 2 }, { quality: "life:shen:how", set: 2 },
        ],
        result: "{$a}说来，说自己来不为那一栏，说完自己先不信，把空瓶在手里转了两圈。",
      },
      {
        label: "先把那支瓶子看完",
        effects: [
          { opinion: "$a", delta: 3 },
          { quality: "life:shen", set: 2 }, { quality: "life:shen:how", set: 1 },
        ],
        result: "{$a}说这一支她用完了，用完才发现不用替谁签字的脸原来是这样的，站在那儿没催你开口。",
      },
    ],
  },

  // —— 安姐：她替别人看了几年，今年有人替她看 ——
  {
    id: "life2-anjie",
    kind: "arc",
    cast: { a: anjie },
    when: [{ season: { gte: 6 } }, { quality: "arc:anjie:end", gte: 1 }, { quality: "life:anjie", eq: 1 }],
    weight: 28, tension: -1, cooldown: 28,
    text: "{$a}坐下以后没摘镯子。她说那场的事早归了别人管，今年是她自己要办一件小得多的事，问这一柜肯不肯把她当客人，别当同行。",
    choices: [
      {
        label: "今天就当客人待",
        when: [how("anjie", 1)],
        effects: [
          { opinion: "$a", delta: 7 }, { stat: "standing", delta: 2 }, { bond: ["anjie", "player"], delta: 5 },
          { quality: "life:anjie", set: 2 }, { quality: "life:anjie:how", set: 1 },
        ],
        result: "{$a}说她那句「眼角要不要紧」今年终于问出口了，问的不是别人的场合，是她自己。",
      },
      {
        label: "按同行那套跟她谈",
        when: [how("anjie", 2)],
        effects: [
          { opinion: "$a", delta: -4 }, { quality: "life:anjie", set: 2 }, { quality: "life:anjie:how", set: 3 },
        ],
        result: "{$a}说好，那她不改行，也不来了，镯子在柜面上放了一下才戴回去，那一下她看得很清楚。",
      },
      {
        label: "先问那是件什么事",
        when: [how("anjie", 3)],
        effects: [
          { opinion: "$a", delta: 4 }, { quality: "life:anjie", set: 2 }, { quality: "life:anjie:how", set: 1 },
        ],
        result: "{$a}说很小，就吃一顿饭，来的人全是她替别人化过妆的，这回没人请她，她自己出钱，只要一张脸别输。",
      },
      {
        label: "把那一支先给她试",
        effects: [
          { opinion: "$a", delta: 3 }, { quality: "life:anjie", set: 2 }, { quality: "life:anjie:how", set: 1 },
        ],
        result: "{$a}试完对着镜子很久没说话，末了说这一支她不问任何人认不认，她自己认。",
      },
    ],
  },

  // —— 梅女士：她自己定价钱的第一年过完了 ——
  {
    id: "life2-mei",
    kind: "arc",
    cast: { a: mei },
    when: [{ season: { gte: 6 } }, { quality: "arc:mei:end", gte: 1 }, { quality: "life:mei", eq: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}进门还是不看表。她说去年那一下午她回去想了很久，今年真把那件事做起来了，人手不多，第一个要办的还是脸上这一套。",
    choices: [
      {
        label: "按她做起来的这件事配",
        when: [how("mei", 1)],
        effects: [
          { opinion: "$a", delta: 7 }, { stat: "standing", delta: 3 }, { bond: ["mei", "player"], delta: 5 },
          { quality: "life:mei", set: 2 }, { quality: "life:mei:how", set: 1 },
        ],
        result: "{$a}说这一回她不带客户，带的是跟她一起干的那两位，那两位她不肯让人对她们说「省一点」。",
      },
      {
        label: "劝她把这笔省下",
        when: [how("mei", 2)],
        effects: [
          { opinion: "$a", delta: -5 }, { quality: "life:mei", set: 2 }, { quality: "life:mei:how", set: 3 },
        ],
        result: "{$a}说这句话去年她也听过一次，去年她听了，今年她不听了，说完照样把那一支写进单里。",
      },
      {
        label: "只当她是一个人来的",
        when: [how("mei", 3)],
        effects: [
          { opinion: "$a", delta: 3 }, { quality: "life:mei", set: 2 }, { quality: "life:mei:how", set: 2 },
        ],
        result: "{$a}说那件事没成，散了，她今天还是来买那一支，买给自己，不为证明什么。",
      },
      {
        label: "先问她那两位要什么",
        effects: [
          { opinion: "$a", delta: 5 }, { stat: "standing", delta: 1 },
          { quality: "life:mei", set: 2 }, { quality: "life:mei:how", set: 1 },
        ],
        result: "{$a}说那两位在楼下等，她替她们问的第一句是这里要不要看表，她说这里不用。",
      },
    ],
  },

  // ============ 第 30 轮补齐的十二位：同一把梯子的第 5 季那一步 ============
  // 每位的落点档数不一样（4 到 6 档），所以按落点开门的那些颗合起来必须盖满她全部的档 ——
  // 这条由 tests/world-content.test.ts 那条名单守卫逐档核，不靠"有一颗没门的兜底"过关。
  // —— 赵女士：替别人拿惯了主意，今年这张单写她自己 ——
  {
    id: "life-zhao",
    kind: "arc",
    cast: { a: zhao },
    when: [{ season: { gte: 5 } }, { quality: "arc:zhao:end", gte: 1 }, stepped("zhao")],
    weight: 30, tension: 0, cooldown: 28,
    text: "{$a}今天报的是自己那张单，没提女儿。她说这几年她把那支厚的用完了，脸上要的东西跟女儿替她要的早不是一回事，这一回她想自己挑完再走。",
    choices: [
      {
        label: "照她自己的脸开，一句不问她女儿",
        when: [end("zhao", 1), warm("zhao", 6)],
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["zhao", "player"], delta: 5 },
          { quality: "life:zhao", set: 1 }, { quality: "life:zhao:how", set: 1 },
        ],
        result: "{$a}说她女儿早不管她这张脸了，倒是要看她这一回自己挑得对不对，说完把镜子往自己这边挪了挪。",
      },
      {
        label: "那一行还是替她写的，先问清",
        when: [end("zhao", 2)],
        effects: [
          { opinion: "$a", delta: -2 }, { stat: "standing", delta: -1 },
          { quality: "life:zhao", set: 1 }, { quality: "life:zhao:how", set: 2 },
        ],
        result: "{$a}点头说这一支她自己认，女儿认不认是女儿的事，写完把单子折上放进自己包里，没递给谁看。",
      },
      {
        label: "两张清单早对过了，就按今天的她",
        when: [endUp("zhao", 3)],
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["zhao", "player"], delta: 3 },
          { quality: "life:zhao", set: 1 }, { quality: "life:zhao:how", set: 1 },
        ],
        result: "{$a}说对过以后她反倒不知道要什么了，今天来是想听你说一句她这个年纪该用什么，说完她自己也觉得这话陌生。",
      },
      {
        label: "先请她坐下",
        effects: [
          { opinion: "$a", delta: 3 },
          { quality: "life:zhao", set: 1 }, { quality: "life:zhao:how", set: 2 },
        ],
        result: "{$a}坐下去那一下比平时慢，说她几年没在这面柜前坐过，一直是站着替别人拿主意。",
      },
    ],
  },

  // —— 尹小姐：包带上那个小东西今年没亮 ——
  {
    id: "life-yinxiaojie",
    kind: "arc",
    cast: { a: yinxiaojie },
    when: [{ season: { gte: 5 } }, { quality: "arc:yinxiaojie:end", gte: 1 }, stepped("yinxiaojie")],
    weight: 30, tension: -1, cooldown: 28,
    text: "{$a}把包放在柜面上，包带上那个小东西今天没亮。她说这几年她录过的柜不止这一处，这一趟不为录你，是想问一句这里改过没有。",
    choices: [
      {
        label: "把去年那句原话再念给她听",
        when: [end("yinxiaojie", 1)],
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["yinxiaojie", "player"], delta: 4 },
          { quality: "life:yinxiaojie", set: 1 }, { quality: "life:yinxiaojie:how", set: 1 },
        ],
        result: "{$a}听完说这一句跟去年一个字不差，她把录音留着的理由少了一个，把包拎起来走了两步又回头站住。",
      },
      {
        label: "问她那支笔如今在哪儿",
        when: [end("yinxiaojie", 3)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:yinxiaojie", set: 1 }, { quality: "life:yinxiaojie:how", set: 2 },
        ],
        result: "{$a}说那支笔收在抽屉里，如今她记下的是自己要用什么，不是拿去比谁把话说得更满。",
      },
      {
        label: "这一柜改了什么，一项项报给她",
        when: [endUp("yinxiaojie", 2)],
        effects: [
          { opinion: "$a", delta: 3 }, { stat: "compliance", delta: 2 },
          { quality: "life:yinxiaojie", set: 1 }, { quality: "life:yinxiaojie:how", set: 2 },
        ],
        result: "{$a}说她听到第三项就明白了，剩下的不必说完，说完她自己在单子上写了一行，写的是她要的那一支。",
      },
      {
        label: "今天不跟她谈那支笔",
        effects: [
          { opinion: "$a", delta: 1 },
          { quality: "life:yinxiaojie", set: 1 }, { quality: "life:yinxiaojie:how", set: 3 },
        ],
        result: "{$a}说你这句话她头一回听见，说完她自己愣了一下，把包换到另一只手，站在柜前没再开口。",
      },
    ],
  },

  // —— 段小姐：三本替人记的册子，自己那一栏空着 ——
  {
    id: "life-duan",
    kind: "arc",
    cast: { a: duan },
    when: [{ season: { gte: 5 } }, { quality: "arc:duan:end", gte: 1 }, stepped("duan")],
    weight: 30, tension: 0, cooldown: 28,
    text: "{$a}今天没带那个本子。她说替人问的那几年她记满了三本，别人过敏的地方她一处不落，自己那一栏到今天还是空的，今年她想先填自己。",
    choices: [
      {
        label: "先按她自己那一栏开",
        when: [end("duan", 1)],
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["duan", "player"], delta: 4 },
          { quality: "life:duan", set: 1 }, { quality: "life:duan:how", set: 1 },
        ],
        result: "{$a}说她名字写上去那一下手是抖的，写了三年别人的名字，轮到自己反倒不会写，让你念一遍给她听。",
      },
      {
        label: "那一行还空着，问她要不要留",
        when: [end("duan", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:duan", set: 1 }, { quality: "life:duan:how", set: 2 },
        ],
        result: "{$a}说留着吧，空着也是她自己空着，总比替别人填满好，说完把笔帽按上没写。",
      },
      {
        label: "柜上那一支一直没挪，给她留着",
        when: [end("duan", 3)],
        effects: [
          { opinion: "$a", delta: 3 }, { stat: "standing", delta: 1 },
          { quality: "life:duan", set: 1 }, { quality: "life:duan:how", set: 1 },
        ],
        result: "{$a}说那支她偷偷试过两回都不合适，如今她知道自己要的不是那一支了，说完笑了一下，笑得很短。",
      },
      {
        label: "先问她身边那个人今年还用不用她操心",
        when: [endUp("duan", 4)],
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["duan", "player"], delta: 3 },
          { quality: "life:duan", set: 1 }, { quality: "life:duan:how", set: 1 },
        ],
        result: "{$a}说那个人今年不用她操心了，她自己来，报的也是自己的名字，报完她在柜前站了一会儿才走。",
      },
    ],
  },

  // —— 赵宁：她妈不再替她拿主意，她自己查了两年成分 ——
  {
    id: "life-zhaoning",
    kind: "arc",
    cast: { a: zhaoning },
    when: [{ season: { gte: 5 } }, { quality: "arc:zhaoning:end", gte: 1 }, stepped("zhaoning")],
    weight: 30, tension: 1, cooldown: 28,
    text: "{$a}自己进来的，身后没跟着人。她说她妈这几年终于不替她拿主意了，她自己查了两年的成分，今天想按自己那一行开一单。",
    choices: [
      {
        label: "按她那一行开，妈妈那一栏不填",
        when: [end("zhaoning", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["zhaoning", "player"], delta: 5 },
          { quality: "life:zhaoning", set: 1 }, { quality: "life:zhaoning:how", set: 1 },
        ],
        result: "{$a}说她查的第一样就是这一支，查到第三个月才敢自己走进来，说完把手机递给你，屏幕上是她自己那份记录。",
      },
      {
        label: "成分表摊开，跟她一条条过",
        when: [end("zhaoning", 3)],
        effects: [
          { opinion: "$a", delta: 4 }, { stat: "compliance", delta: 2 },
          { quality: "life:zhaoning", set: 1 }, { quality: "life:zhaoning:how", set: 1 },
        ],
        result: "{$a}说那一条她标过红，反过来问你是不是也要告诉她别信包装，她说她早就知道了，只是想听你这么说一次。",
      },
      {
        label: "先问一句她妈知不知道她今天来",
        when: [endUp("zhaoning", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:zhaoning", set: 1 }, { quality: "life:zhaoning:how", set: 2 },
        ],
        result: "{$a}说知道，出门前跟她妈讲了是自己来，她妈愣了半天回了一句那挺好，她等这一句等了很久。",
      },
      {
        label: "这一单今天不开，等她自己要清楚",
        when: [end("zhaoning", 4)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: -1 },
          { quality: "life:zhaoning", set: 1 }, { quality: "life:zhaoning:how", set: 3 },
        ],
        result: "{$a}说她自己要清楚什么已经想了一年，你今天不给她开，她明天换个柜开，说完站着没动，过了一会儿才转身。",
      },
    ],
  },

  // —— 唐可：那张周目标不发了，她隔了三层楼 ——
  {
    id: "life-tangke",
    kind: "arc",
    cast: { a: tangke },
    when: [{ season: { gte: 5 } }, { quality: "arc:tangke:end", gte: 1 }, stepped("tangke")],
    weight: 29, tension: 0, cooldown: 28,
    text: "{$a}这趟不是来上班的。她说那张周目标早就不发了，如今她跟自己那几个人对数字，去年她还站你隔壁那一格，今年隔了三层楼。",
    choices: [
      {
        label: "还把她当同一张表上的人",
        when: [end("tangke", 1), warm("tangke", 5)],
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["tangke", "player"], delta: 5 },
          { quality: "life:tangke", set: 1 }, { quality: "life:tangke:how", set: 1 },
        ],
        result: "{$a}说她如今也带一个人，当年她跟你抢的那句她现在原样发给底下的人，说完她自己听了一遍，没笑。",
      },
      {
        label: "她去了对面那一组，就按对面问",
        when: [end("tangke", 3)],
        effects: [
          { opinion: "$a", delta: -2 },
          { quality: "life:tangke", set: 1 }, { quality: "life:tangke:how", set: 2 },
        ],
        result: "{$a}说对面教的她照做，但她在自己那本上记了几条你不记的，不给你看，也不替那边说。",
      },
      {
        label: "那一格空着，问她还回来不",
        when: [endUp("tangke", 2), cold("tangke", -2)],
        effects: [
          { opinion: "$a", delta: -3 }, { stat: "standing", delta: -1 },
          { quality: "life:tangke", set: 1 }, { quality: "life:tangke:how", set: 3 },
        ],
        result: "{$a}说名额早给别人了，她回不回这一层楼她自己都做不了主，说完把工牌翻过去扣在柜面上。",
      },
      {
        label: "先问她如今过得好不好",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["tangke", "player"], delta: 4 },
          { quality: "life:tangke", set: 1 }, { quality: "life:tangke:how", set: 1 },
        ],
        result: "{$a}说这话没人问过她，她们只问数，说完她把自己那支笔压在柜面上没拿走，像是留个再来一趟的理由。",
      },
    ],
  },

  // —— 罗曼：柜长那一栏今年写的不是她 ——
  {
    id: "life-roman",
    kind: "arc",
    cast: { a: roman },
    when: [{ season: { gte: 5 } }, { quality: "arc:roman:end", gte: 1 }, stepped("roman")],
    weight: 29, tension: -1, cooldown: 28,
    text: "{$a}手里那张表换成了薄的一页。她说柜长这一栏今年写的不是她，她还在楼上，只是不再每天念那两个数了。",
    choices: [
      {
        label: "把表交回去那一回，她收回了名额那句",
        when: [end("roman", 1)],
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["roman", "player"], delta: 4 },
          { quality: "life:roman", set: 1 }, { quality: "life:roman:how", set: 1 },
        ],
        result: "{$a}承认那句话是她多说的，她如今不替谁定名额，只把亲眼看到的事写下来，写完自己念一遍。",
      },
      {
        label: "还照去年那两列跟她对",
        when: [end("roman", 2)],
        effects: [
          { opinion: "$a", delta: -2 },
          { quality: "life:roman", set: 1 }, { quality: "life:roman:how", set: 2 },
        ],
        result: "{$a}说这两列她现在只给自己看，你问也没用，说完把那页纸折成四折收进兜里。",
      },
      {
        label: "她那一栏已经不写你的名字",
        when: [endUp("roman", 3)],
        effects: [
          { opinion: "$a", delta: 1 },
          { quality: "life:roman", set: 1 }, { quality: "life:roman:how", set: 2 },
        ],
        result: "{$a}说这一栏归谁她不管，她只管这层楼今天有没有人当面说真话，说完在柜面前站了好一会儿。",
      },
      {
        label: "问她如今还站不站柜",
        effects: [
          { opinion: "$a", delta: 3 }, { stat: "standing", delta: 1 },
          { quality: "life:roman", set: 1 }, { quality: "life:roman:how", set: 1 },
        ],
        result: "{$a}说她一周站两个半天，就为了知道自己报上去的数到底是不是真的，这两年她只信这个办法。",
      },
    ],
  },

  // —— 方敏：那一页档案如今归到别人名下 ——
  {
    id: "life-fangmin",
    kind: "arc",
    cast: { a: fangmin },
    when: [{ season: { gte: 5 } }, { quality: "arc:fangmin:end", gte: 1 }, stepped("fangmin")],
    weight: 29, tension: 1, cooldown: 28,
    text: "{$a}抱来的不是那本厚的档案，是一页复印件。她说这一页去年在这栋楼里传过，如今归到别人名下，她想让你看一眼落地没有。",
    choices: [
      {
        label: "原话还在，认的还是你那一句",
        when: [end("fangmin", 1)],
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["fangmin", "player"], delta: 4 }, { stat: "compliance", delta: 3 },
          { quality: "life:fangmin", set: 1 }, { quality: "life:fangmin:how", set: 1 },
        ],
        result: "{$a}说这一页她留着，不是因为你说得对，是因为这一句写得进去，写完她当着你的面把复印件收好。",
      },
      {
        label: "缺口那一行用的是你供的名字",
        when: [end("fangmin", 2)],
        effects: [
          { opinion: "$a", delta: 1 }, { stat: "compliance", delta: 2 },
          { quality: "life:fangmin", set: 1 }, { quality: "life:fangmin:how", set: 2 },
        ],
        result: "{$a}说名字她按流程报了，报的是当时在场的人，不替谁多写一个也不替谁少写一个，这一条你别往心里去。",
      },
      {
        label: "这一页跟你无关，你不在抄送里",
        when: [endUp("fangmin", 3)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: -1 },
          { quality: "life:fangmin", set: 1 }, { quality: "life:fangmin:how", set: 3 },
        ],
        result: "{$a}说这不是给你看的，是她自己要把流程再走一遍，说完她把复印件收回去，一个字没留。",
      },
      {
        label: "问她今年还收不收句子",
        effects: [
          { opinion: "$a", delta: 3 },
          { quality: "life:fangmin", set: 1 }, { quality: "life:fangmin:how", set: 2 },
        ],
        result: "{$a}说收，只是今年她不替人保管了，写完当场念一遍给说话的那个人听，念不出口的就不算。",
      },
    ],
  },

  // —— 乔晚：她开口第一句不再是你那套 ——
  {
    id: "life-qiaowan",
    kind: "arc",
    cast: { a: qiaowan },
    when: [{ season: { gte: 5 } }, { quality: "arc:qiaowan:end", gte: 1 }, stepped("qiaowan")],
    weight: 29, tension: 0, cooldown: 28,
    text: "{$a}开口第一句不是你那套。她说她在这层楼待了两年，把学来的句子拆开重装，如今按自己那套说，说完看客人的脸不看表。",
    choices: [
      {
        label: "让她用自己的句子，一个字不改",
        when: [end("qiaowan", 1)],
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["qiaowan", "player"], delta: 5 },
          { quality: "life:qiaowan", set: 1 }, { quality: "life:qiaowan:how", set: 1 },
        ],
        result: "{$a}说她那句是你那句改的，改了三回才敢当自己的用，说完有点不好意思，把声音压低了些。",
      },
      {
        label: "她还背你那套，背错算你",
        when: [end("qiaowan", 2)],
        effects: [
          { opinion: "$a", delta: -3 },
          { quality: "life:qiaowan", set: 1 }, { quality: "life:qiaowan:how", set: 2 },
        ],
        result: "{$a}说这一条她背熟了，可客人问她真不真她答不上来，那天她在楼下站了很久，从那以后她不背了。",
      },
      {
        label: "晚班那套句子早不归她了",
        when: [endUp("qiaowan", 3)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:qiaowan", set: 1 }, { quality: "life:qiaowan:how", set: 2 },
        ],
        result: "{$a}说晚班归别人了，如今她上白班，理由是她想看清客人的脸，夜里那几张她记不住。",
      },
      {
        label: "先问她那张实习条还写着不",
        when: [end("qiaowan", 4)],
        effects: [
          { opinion: "$a", delta: -2 }, { stat: "standing", delta: -1 },
          { quality: "life:qiaowan", set: 1 }, { quality: "life:qiaowan:how", set: 3 },
        ],
        result: "{$a}说那张条她留着但没再填，她如今开口不算实习生的份，说完自己找了个位置坐下，没站回那一格。",
      },
    ],
  },

  // —— 宋姐：手机最上面那个群今年没再弹 ——
  {
    id: "life-songjie",
    kind: "arc",
    cast: { a: songjie },
    when: [{ season: { gte: 5 } }, { quality: "arc:songjie:end", gte: 1 }, stepped("songjie")],
    weight: 28, tension: -1, cooldown: 28,
    text: "{$a}今天把手机扣在柜面上，屏幕最上面那个群没再弹。她说这几年她替人带了太多东西，群里问她的还是那几句，她自己想要的没往上添过一行。",
    choices: [
      {
        label: "那一笔写回她自己名下",
        when: [end("songjie", 1)],
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["songjie", "player"], delta: 4 },
          { quality: "life:songjie", set: 1 }, { quality: "life:songjie:how", set: 1 },
        ],
        result: "{$a}说她头一回给自己下单，收货地址填的是她妈那儿，寄过去以后再说，说完她盯着那张单子看了一会儿。",
      },
      {
        label: "她们自己把那一笔对完了",
        when: [end("songjie", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:songjie", set: 1 }, { quality: "life:songjie:how", set: 2 },
        ],
        result: "{$a}说对完了，钱她一分没落，但群里那句公道话是她自己发的，她觉得这一趟值。",
      },
      {
        label: "柜上这一笔她不再要了",
        when: [endUp("songjie", 3)],
        effects: [
          { opinion: "$a", delta: -3 },
          { quality: "life:songjie", set: 1 }, { quality: "life:songjie:how", set: 3 },
        ],
        result: "{$a}说这一柜她以后不来了，不是跟谁闹翻，是她算了算自己这几年赔进去的时间，算完就不来了。",
      },
      {
        label: "先看她那部扣着的手机",
        effects: [
          { opinion: "$a", delta: 4 }, { stat: "standing", delta: 1 },
          { quality: "life:songjie", set: 1 }, { quality: "life:songjie:how", set: 2 },
        ],
        result: "{$a}把手机推过来，屏幕上只有她女儿发来的三条，她问你这个年纪用什么不刺脸，这一句她替别人问过几百回，头一回是问自己的。",
      },
    ],
  },

  // —— 白姐：这回来没带那套工具包 ——
  {
    id: "life-baijie",
    kind: "arc",
    cast: { a: baijie },
    when: [{ season: { gte: 5 } }, { quality: "arc:baijie:end", gte: 1 }, stepped("baijie")],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}这回来没带那套工具包。她说跟妆这几年她替别人上台的次数多了，自己的脸反倒排在最后，今天她想先给自己问一次色号。",
    choices: [
      {
        label: "六个色号留下一次上台用",
        when: [end("baijie", 1)],
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["baijie", "player"], delta: 4 },
          { quality: "life:baijie", set: 1 }, { quality: "life:baijie:how", set: 1 },
        ],
        result: "{$a}说下一场是她表妹，她给自己留的那一支写在最底下，怕别人顺手拿走，写完把纸翻过去扣着。",
      },
      {
        label: "那一笔还是按一支开完",
        when: [end("baijie", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:baijie", set: 1 }, { quality: "life:baijie:how", set: 2 },
        ],
        result: "{$a}说一支就一支，她如今替别人挑得快，给自己挑反倒要人在旁边陪一句，这句话她没说第二遍。",
      },
      {
        label: "她带着别人来试色",
        when: [endUp("baijie", 3)],
        effects: [
          { opinion: "$a", delta: 3 }, { stat: "standing", delta: 1 },
          { quality: "life:baijie", set: 1 }, { quality: "life:baijie:how", set: 2 },
        ],
        result: "{$a}说这几个是她自己带的徒弟，今天她站旁边看她们挑，自己那一支还没定，看得比谁都认真。",
      },
      {
        label: "问那一场婚礼后来怎么样",
        when: [endUp("baijie", 4)],
        effects: [
          { opinion: "$a", delta: -2 },
          { quality: "life:baijie", set: 1 }, { quality: "life:baijie:how", set: 3 },
        ],
        result: "{$a}说那场散了，不是妆的问题，她如今不接那一家的事，说完把包带紧了紧，没再多讲。",
      },
    ],
  },

  // —— 裴岚：这一片的数今年归别人报 ——
  {
    id: "life-peilan",
    kind: "arc",
    cast: { a: peilan },
    when: [{ season: { gte: 5 } }, { quality: "arc:peilan:end", gte: 1 }, stepped("peilan")],
    weight: 29, tension: 1, cooldown: 28,
    text: "{$a}上楼没走正门。她说这一片的数今年归别人报，她还管这几层楼，只是如今她自己站到柜前来试，试完不夸也不记。",
    choices: [
      {
        label: "那一页由柜上自己抄上去",
        when: [end("peilan", 1)],
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["peilan", "player"], delta: 4 },
          { quality: "life:peilan", set: 1 }, { quality: "life:peilan:how", set: 1 },
        ],
        result: "{$a}说这一页她不签了，谁站柜谁写，写完她只念一遍不改字，念的时候站着没坐。",
      },
      {
        label: "名单上那个名字留下了",
        when: [end("peilan", 2)],
        effects: [
          { opinion: "$a", delta: 3 },
          { quality: "life:peilan", set: 1 }, { quality: "life:peilan:how", set: 2 },
        ],
        result: "{$a}说名字在不在她不管，她管的是这层楼有没有人当面说错话，说完自己笑了一下，像是知道自己这话太硬。",
      },
      {
        label: "她的名字按上一季报",
        when: [endUp("peilan", 3)],
        effects: [
          { opinion: "$a", delta: -2 },
          { quality: "life:peilan", set: 1 }, { quality: "life:peilan:how", set: 2 },
        ],
        result: "{$a}说按哪一季报都行，她今年不在这张表上争位置，争的是别的东西，哪一样她不肯讲。",
      },
      {
        label: "她今年不替这面柜写下一季",
        when: [end("peilan", 4)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: -1 },
          { quality: "life:peilan", set: 1 }, { quality: "life:peilan:how", set: 3 },
        ],
        result: "{$a}说下一季她连这一季都不想替谁写，说完把自己那支旧口红拿出来问还有没有，那支早停产了。",
      },
      {
        label: "问她如今还下不下柜台",
        effects: [
          { opinion: "$a", delta: 4 }, { stat: "standing", delta: 1 },
          { quality: "life:peilan", set: 1 }, { quality: "life:peilan:how", set: 1 },
        ],
        result: "{$a}说她一个月站两天，不为数，为她还记得自己是怎么站着跟人说话的，这一条她不肯交给别人替。",
      },
    ],
  },

  // —— 梁夏：她自己那一页到今天还是空的 ——
  {
    id: "life-liangxia",
    kind: "arc",
    cast: { a: liangxia },
    when: [{ season: { gte: 5 } }, { quality: "arc:liangxia:end", gte: 1 }, stepped("liangxia")],
    weight: 29, tension: 0, cooldown: 28,
    text: "{$a}这次没让人拍她。她说安姐那场过去以后，她的名字跟着那张图被转了好几处，她自己那一页到今天还是空的，今天她想写自己的。",
    choices: [
      {
        label: "行字写在柜位那一栏",
        when: [end("liangxia", 1)],
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["liangxia", "player"], delta: 4 },
          { quality: "life:liangxia", set: 1 }, { quality: "life:liangxia:how", set: 1 },
        ],
        result: "{$a}说她那一行不写别人的场合了，写她自己站过的柜位，写完她念了一遍给你听，念得很慢。",
      },
      {
        label: "不露行字，人回来就行",
        when: [end("liangxia", 2)],
        effects: [
          { opinion: "$a", delta: 3 },
          { quality: "life:liangxia", set: 1 }, { quality: "life:liangxia:how", set: 2 },
        ],
        result: "{$a}说不露也好，这几年她被认出来的那几回都不是她自己愿意的，如今她只想安安静静挑一支。",
      },
      {
        label: "那一页旧图先跟安姐说清",
        when: [end("liangxia", 3)],
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["liangxia", "anjie"], delta: 4 },
          { quality: "life:liangxia", set: 1 }, { quality: "life:liangxia:how", set: 1 },
        ],
        result: "{$a}说她去说了，安姐当天就把那张图自己撤了，没让她替谁开口，撤完两个人各吃了一碗面。",
      },
      {
        label: "柜上不上别人的主页",
        when: [endUp("liangxia", 4)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "standing", delta: 1 },
          { quality: "life:liangxia", set: 1 }, { quality: "life:liangxia:how", set: 2 },
        ],
        result: "{$a}说这一柜不上她主页，她反倒放心，往后她来不用先想会不会被拍，说完她第一次自己找了个位置坐。",
      },
      {
        label: "问她那一页写了什么",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["liangxia", "player"], delta: 3 },
          { quality: "life:liangxia", set: 1 }, { quality: "life:liangxia:how", set: 1 },
        ],
        result: "{$a}说她那一页只写了一句，写的是今天她自己走进来的那一下，别的还没想好，没想好就先空着。",
      },
    ],
  },

  // ============ 第 31 轮：第 6 季那一步再铺九位（去年怎么落的，决定今年她说哪一句） ============
  // —— 小雨：工牌摘了才上来，今年那一行她自己填 ——
  {
    id: "life2-xiaoyu",
    kind: "arc",
    cast: { a: xiaoyu },
    when: [{ season: { gte: 6 } }, { quality: "arc:xiaoyu:end", gte: 1 }, { quality: "life:xiaoyu", eq: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}这次把工牌摘了才上来，手里多一张自己的单。她说去年她替那两个孩子来问，今年那一行她自己填，组里把她挪去带新的一批。",
    choices: [
      {
        label: "把她去年替别人要的那一支也给她留着",
        when: [how("xiaoyu", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["xiaoyu", "player"], delta: 5 },
          { quality: "life:xiaoyu", set: 2 }, { quality: "life:xiaoyu:how", set: 1 },
        ],
        result: "{$a}说新的一批里有个孩子跟她去年一模一样，她把那一支的名字写进备注，说这次不用人替她凑单。",
      },
      {
        label: "今年按她自己的名头开，别的不管",
        when: [how("xiaoyu", 2)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "standing", delta: 1 },
          { quality: "life:xiaoyu", set: 2 }, { quality: "life:xiaoyu:how", set: 2 },
        ],
        result: "{$a}说她自己的钱她照付，只是问一句去年那一档今年涨没涨，问完自己先算了个数字出来。",
      },
      {
        label: "先问她自己想要哪一支",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["xiaoyu", "player"], delta: 3 },
          { quality: "life:xiaoyu", set: 2 }, { quality: "life:xiaoyu:how", set: 1 },
        ],
        result: "{$a}说这一回她想先把自己的那张脸弄明白，那两个孩子的她不带，说完把那两张单子推回自己包里。",
      },
    ],
  },

  // —— 周姐：身后那两位今年没来 ——
  {
    id: "life2-zhou",
    kind: "arc",
    cast: { a: zhou },
    when: [{ season: { gte: 6 } }, { quality: "arc:zhou:end", gte: 1 }, { quality: "life:zhou", eq: 1 }],
    weight: 28, tension: -1, cooldown: 28,
    text: "{$a}今天身后那两位没来。她说她排班排到了夜里，那两位被换给别人带了，她自己这一趟是这几年第一次不替谁掐表。",
    choices: [
      {
        label: "把她那两位的位置也留着",
        when: [how("zhou", 1)],
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["zhou", "player"], delta: 5 },
          { quality: "life:zhou", set: 2 }, { quality: "life:zhou:how", set: 1 },
        ],
        result: "{$a}说那两位如今跟别人对比，比完还是把名单发给她，她说这一柜她替她们留着，这句她说得比自己那支还快。",
      },
      {
        label: "今天只算她一个人",
        when: [how("zhou", 2)],
        effects: [
          { opinion: "$a", delta: 3 },
          { quality: "life:zhou", set: 2 }, { quality: "life:zhou:how", set: 2 },
        ],
        result: "{$a}说好，就她一个人，说完把手机留在兜里没扣在柜面上，这一趟她没看时间。",
      },
      {
        label: "问她自己那一支拖了多久",
        effects: [
          { opinion: "$a", delta: 4 }, { stat: "standing", delta: 1 },
          { quality: "life:zhou", set: 2 }, { quality: "life:zhou:how", set: 1 },
        ],
        result: "{$a}说拖到今年才敢问，因为她一直觉得自己那一张不算事，说完她第一次把镜子往自己这边拉过来。",
      },
    ],
  },

  // —— 苏蔓：坐回客人那一侧的第二年 ——
  {
    id: "life2-suman",
    kind: "arc",
    cast: { a: suman },
    when: [{ season: { gte: 6 } }, { quality: "arc:suman:end", gte: 1 }, { quality: "life:suman", eq: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}提着一只小袋子，里面是她自己的东西。她说老客那边今年不再报她的名字，她也不追，这一柜她坐回客人那一侧，坐得很稳。",
    choices: [
      {
        label: "还把她当这一柜的人，账照旧给她看",
        when: [how("suman", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["suman", "player"], delta: 6 },
          { quality: "life:suman", set: 2 }, { quality: "life:suman:how", set: 1 },
        ],
        result: "{$a}说那几个老客今年报不出她的名，就把单子发到她手机上让她看，她说这一柜她还在，只是换个位置坐着。",
      },
      {
        label: "按客人那一档给她排",
        when: [how("suman", 2)],
        effects: [
          { opinion: "$a", delta: 1 },
          { quality: "life:suman", set: 2 }, { quality: "life:suman:how", set: 2 },
        ],
        result: "{$a}说这一档她认，去年是她自己走进来的，今年她不指望柜上记得她是谁，说完自己取了号。",
      },
      {
        label: "那一柜的事别在她面前提",
        when: [how("suman", 3)],
        effects: [
          { opinion: "$a", delta: -3 }, { stat: "standing", delta: -1 },
          { quality: "life:suman", set: 2 }, { quality: "life:suman:how", set: 3 },
        ],
        result: "{$a}说她去年就把话说明白了，今年这一趟是替自己那张脸来的，柜上的事一个字都别往外说。",
      },
      {
        label: "先问她今天想坐多久",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["suman", "player"], delta: 3 },
          { quality: "life:suman", set: 2 }, { quality: "life:suman:how", set: 1 },
        ],
        result: "{$a}说想坐多久就坐多久，这几年她都是替别人掐着点办事，今天这一句轮到她自己说了算。",
      },
    ],
  },

  // —— 陆遥：她那柜散了，人还站在通道这边 ——
  {
    id: "life2-luyao",
    kind: "arc",
    cast: { a: luyao },
    when: [{ season: { gte: 6 } }, { quality: "arc:luyao:end", gte: 1 }, { quality: "life:luyao", eq: 1 }],
    weight: 28, tension: 1, cooldown: 28,
    text: "{$a}这回过了通道走过来，站在你这侧。她说她那柜上个月散了，名头还在，人没地方站，去年她问过的那句她今年再问一遍：你这边收不收人。",
    choices: [
      {
        label: "收，把她那一格并进来",
        when: [how("luyao", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }, { bond: ["luyao", "player"], delta: 6 },
          { quality: "life:luyao", set: 2 }, { quality: "life:luyao:how", set: 1 },
        ],
        result: "{$a}说她不要特殊那一格，跟你在同一张表上就行，截来的句子她以后不发了，说完自己坐到镜前。",
      },
      {
        label: "不收人，给她留一个来问的位子",
        when: [how("luyao", 2)],
        effects: [
          { opinion: "$a", delta: 2 }, { bond: ["luyao", "player"], delta: 3 },
          { quality: "life:luyao", set: 2 }, { quality: "life:luyao:how", set: 2 },
        ],
        result: "{$a}说那她就按散客来问，名头她早不稀罕了，稀罕的是这一柜还肯不肯听她把一句话说完。",
      },
      {
        label: "她自己会找到地方，不用这一柜",
        when: [how("luyao", 3)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: 1 },
          { quality: "life:luyao", set: 2 }, { quality: "life:luyao:how", set: 3 },
        ],
        result: "{$a}点头说她就知道是这一句，去年她问过一次，今年只等一个答案，说完转身回通道那边，脚步比来时快。",
      },
      {
        label: "先让她把那本数放下",
        effects: [
          { opinion: "$a", delta: 3 }, { bond: ["luyao", "player"], delta: 4 },
          { quality: "life:luyao", set: 2 }, { quality: "life:luyao:how", set: 1 },
        ],
        result: "{$a}把那本自己记的数搁在柜面上，说今天不谈这个，站着想了一会儿才说自己今年也累。",
      },
    ],
  },

  // —— 米朵：灯架带来了，没打开 ——
  {
    id: "life2-miduo",
    kind: "arc",
    cast: { a: miduo },
    when: [{ season: { gte: 6 } }, { quality: "arc:miduo:end", gte: 1 }, { quality: "life:miduo", eq: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}把灯架带来了，但没打开。她说今年有三家给她发东西，她把去年那三页表重新拍了一遍，拍之前先问这一柜今年敢不敢让她照着念。",
    choices: [
      {
        label: "敢，你念，我们在旁边听",
        when: [how("miduo", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "compliance", delta: 2 }, { bond: ["miduo", "player"], delta: 5 },
          { quality: "life:miduo", set: 2 }, { quality: "life:miduo:how", set: 1 },
        ],
        result: "{$a}念到第二行自己停了，说这一句去年是别人替她写的，她今年要改成自己的话，说完把灯架打开。",
      },
      {
        label: "让她先把那三页给别人看",
        when: [how("miduo", 2)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "standing", delta: 1 },
          { quality: "life:miduo", set: 2 }, { quality: "life:miduo:how", set: 2 },
        ],
        result: "{$a}说三家她只发这一柜那一页，别的两家给的是成品句，她把手机翻过去扣下，没再往前递。",
      },
      {
        label: "先问她自己那张脸要不要",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["miduo", "player"], delta: 4 },
          { quality: "life:miduo", set: 2 }, { quality: "life:miduo:how", set: 1 },
        ],
        result: "{$a}愣了一会儿才答，说这几年她的号替别人试了几十支，自己那张脸多久没人问过，问到这儿她把灯关掉。",
      },
    ],
  },

  // —— 赵女士：她带了女儿的照片来 ——
  {
    id: "life2-zhao",
    kind: "arc",
    cast: { a: zhao },
    when: [{ season: { gte: 6 } }, { quality: "arc:zhao:end", gte: 1 }, { quality: "life:zhao", eq: 1 }],
    weight: 28, tension: 1, cooldown: 28,
    text: "{$a}把一张照片摆在柜面上，是她女儿，没说话。她说去年她自己挑完那一支以后，女儿反倒来问她用的什么，今年这一单她想跟女儿一起对。",
    choices: [
      {
        label: "两张单子一起对，一行都不并",
        when: [how("zhao", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["zhao", "player"], delta: 5 }, { bond: ["zhao", "zhaoning"], delta: 6 },
          { quality: "life:zhao", set: 2 }, { quality: "life:zhao:how", set: 1 },
        ],
        result: "{$a}说她女儿看完她自己那一行，先把她这一行也填了，填完说妈你这行写得对，这句她等了两年多。",
      },
      {
        label: "她女儿的份让她女儿自己来问",
        when: [how("zhao", 2)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "compliance", delta: 1 },
          { quality: "life:zhao", set: 2 }, { quality: "life:zhao:how", set: 2 },
        ],
        result: "{$a}说好，那就各开各的，她把照片收进包里，说这一句她回家跟女儿讲，女儿能听懂。",
      },
      {
        label: "先问她今年这张脸自己想怎么过",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["zhao", "player"], delta: 4 },
          { quality: "life:zhao", set: 2 }, { quality: "life:zhao:how", set: 1 },
        ],
        result: "{$a}想了很久，说这两年她练的就是自己开口，可一开口还是先想到别人够不够用，说完自己先笑了。",
      },
    ],
  },

  // —— 唐可：新排班表把她挪回这层，条件是她要带人 ——
  {
    id: "life2-tangke",
    kind: "arc",
    cast: { a: tangke },
    when: [{ season: { gte: 6 } }, { quality: "arc:tangke:end", gte: 1 }, { quality: "life:tangke", eq: 1 }],
    weight: 28, tension: 1, cooldown: 28,
    text: "{$a}拿的是一张新排班表。她说楼上把她那一格挪回这层了，条件是她要带两个人 —— 去年那句是她发给底下的人的，今年轮到她自己被人这样发下来。",
    choices: [
      {
        label: "把她那两个孩子也带到这一柜",
        when: [how("tangke", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }, { bond: ["tangke", "player"], delta: 5 },
          { quality: "life:tangke", set: 2 }, { quality: "life:tangke:how", set: 1 },
        ],
        result: "{$a}说她教的第一句就是不把话说满，那两个孩子抬头看她，她把去年从你这里听来的那句原样讲了。",
      },
      {
        label: "只跟她本人对，不带那两位",
        when: [how("tangke", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:tangke", set: 2 }, { quality: "life:tangke:how", set: 2 },
        ],
        result: "{$a}说行，那她自己这一支她自己掏，两位的账她回去照报，不替这边多写一句。",
      },
      {
        label: "那一格本来就不是她的，说清楚",
        when: [how("tangke", 3)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: 1 },
          { quality: "life:tangke", set: 2 }, { quality: "life:tangke:how", set: 3 },
        ],
        result: "{$a}说这话去年她也听过一遍，今年她带了人来，那一格是不是她的她自己心里有数，说完把排班表摊开没折。",
      },
      {
        label: "先问她带的那两个人是谁",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["tangke", "player"], delta: 4 },
          { quality: "life:tangke", set: 2 }, { quality: "life:tangke:how", set: 1 },
        ],
        result: "{$a}报了两个名字，一个去年就在她身后，另一个是上个月新来的，她说这次她想让人记得是她把话教对的。",
      },
    ],
  },

  // —— 方敏：今年她只收当场念出来的句子 ——
  {
    id: "life2-fangmin",
    kind: "arc",
    cast: { a: fangmin },
    when: [{ season: { gte: 6 } }, { quality: "arc:fangmin:end", gte: 1 }, { quality: "life:fangmin", eq: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}这回带的不是复印件，是一本新的。她说去年那一页归到别人名下以后，今年这本她只收当场念出来的句子，念不出口的一律不进。",
    choices: [
      {
        label: "把她自己的名字填进去，当她的面",
        when: [how("fangmin", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "compliance", delta: 3 }, { bond: ["fangmin", "player"], delta: 5 },
          { quality: "life:fangmin", set: 2 }, { quality: "life:fangmin:how", set: 1 },
        ],
        result: "{$a}说自己那一行她留了两年空白，今年要填就填她自己站过的位置，不填哪个柜的名字。",
      },
      {
        label: "按流程办，谁念谁签",
        when: [how("fangmin", 2)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "compliance", delta: 2 },
          { quality: "life:fangmin", set: 2 }, { quality: "life:fangmin:how", set: 2 },
        ],
        result: "{$a}说这一条她给你留着，抄送里有没有人不重要，重要的是当场有没有人敢念，说完把笔搁在你这边。",
      },
      {
        label: "这本不归你抄，别递过来",
        when: [how("fangmin", 3)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: -1 },
          { quality: "life:fangmin", set: 2 }, { quality: "life:fangmin:how", set: 3 },
        ],
        result: "{$a}说去年她就不该抱上来，今年这一句她收回，把本子合上夹在腋下，站在柜前没坐。",
      },
      {
        label: "问她今年还认不认去年那句",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["fangmin", "player"], delta: 4 },
          { quality: "life:fangmin", set: 2 }, { quality: "life:fangmin:how", set: 1 },
        ],
        result: "{$a}说认，但她今年把那句话念给自己听了，不再拿去替谁补一个缺口，说完她把新本子的封面抚平。",
      },
    ],
  },

  // —— 梁夏：那一页第一行写的是这面柜 ——
  {
    id: "life2-liangxia",
    kind: "arc",
    cast: { a: liangxia },
    when: [{ season: { gte: 6 } }, { quality: "arc:liangxia:end", gte: 1 }, { quality: "life:liangxia", eq: 1 }],
    weight: 28, tension: 1, cooldown: 28,
    text: "{$a}自己把那一页开了，第一行写的就是这面柜。她说去年她只敢写一句，今年有人按那句话来找她，她第一次不确定那句还要不要往下写。",
    choices: [
      {
        label: "往下写，写她自己站过的地方",
        when: [how("liangxia", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["liangxia", "player"], delta: 5 }, { bond: ["liangxia", "anjie"], delta: 3 },
          { quality: "life:liangxia", set: 2 }, { quality: "life:liangxia:how", set: 1 },
        ],
        result: "{$a}说安姐教过她一句：写自己站过的位置，别写别人的场合，她把这一行念出来，念完把手机屏幕朝下扣着。",
      },
      {
        label: "不写了，人来就行",
        when: [how("liangxia", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:liangxia", set: 2 }, { quality: "life:liangxia:how", set: 2 },
        ],
        result: "{$a}说那一页她先留着不更新，来这一柜不用先想会不会被拍，说完她把那一页翻回去，没关掉。",
      },
      {
        label: "问她按那句话来找她的是谁",
        effects: [
          { opinion: "$a", delta: 4 }, { stat: "standing", delta: 1 },
          { quality: "life:liangxia", set: 2 }, { quality: "life:liangxia:how", set: 1 },
        ],
        result: "{$a}说是去年站在她旁边那个孩子，问她那句是从哪儿学来的，她想了半天只能说出处在这一柜。",
      },
    ],
  },
];

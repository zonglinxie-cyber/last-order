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
// 名册（20 条第 5 季 + 20 条第 6 季 + 20 条第 7 季）：写死的名单在 tests/world-content.test.ts 里钉着，
// 补人要在名单上选边，不许悄悄加。第 29 轮那批只有 8 位，第 30 轮把 ARC_PEOPLE 剩下的 12 位补齐，
// 第 31、32 轮把第 6 季那一步铺到 20 位，第 33、35 轮把第三格（第 7 季，life:<id> 走到 3）铺到 20 位。
// 第三格不写成"又一年"，写成**前两年怎么待她的账到期**：那颗卡的门读 `life:<id>` = 2，
// 选项按 `life:<id>:how`（去年那一档）分叉 —— 玩家两年的待法要在这里读得出差别。
// **写下一格之前先量上一格写得出哪几档 how**：只有 [1,2] 的人别摆 how=3 的门，
// 那一颗是玩家永远读不到的死格子（第 34 轮那条通用守卫就是抓这个，抓到过第 29 轮遗留的两颗）。
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
        when: [how("shen", 2), cold("shen", -4)],
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
        when: [how("anjie", 3), cold("anjie", -5)],
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

  // ============ 第 32 轮：第 6 季剩下那八位 —— 梯子铺满 20 条线 ============
  // —— 尹小姐：那个小东西她摘下来放在柜面上 ——
  {
    id: "life2-yinxiaojie",
    kind: "arc",
    cast: { a: yinxiaojie },
    when: [{ season: { gte: 6 } }, { quality: "arc:yinxiaojie:end", gte: 1 }, { quality: "life:yinxiaojie", eq: 1 }],
    weight: 28, tension: 1, cooldown: 28,
    text: "{$a}这回把包带上那个小东西摘下来，摆在柜面上。她说如今她自己写一页成分表，谁把话说满她就请谁念一遍，念不出的那一行她自己划掉。",
    choices: [
      {
        label: "把那一页的错处指给她看",
        when: [how("yinxiaojie", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "compliance", delta: 3 }, { bond: ["yinxiaojie", "player"], delta: 5 },
          { quality: "life:yinxiaojie", set: 2 }, { quality: "life:yinxiaojie:how", set: 1 },
        ],
        result: "{$a}听完那两处自己划了一行，说这一柜肯让她划掉的是头一家，划完把那一页留在了柜面上。",
      },
      {
        label: "按她那一张表来报数",
        when: [how("yinxiaojie", 2)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "compliance", delta: 1 },
          { quality: "life:yinxiaojie", set: 2 }, { quality: "life:yinxiaojie:how", set: 2 },
        ],
        result: "{$a}说数她照记，只是她那一页上写得比你多，报完她把纸翻过去扣着，没留下副本。",
      },
      {
        label: "今年不必再跟她对那一张表",
        when: [how("yinxiaojie", 3)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: -1 },
          { quality: "life:yinxiaojie", set: 2 }, { quality: "life:yinxiaojie:how", set: 3 },
        ],
        result: "{$a}点头说她就知道这一柜怕这个，把那个小东西收回兜里，说下一家她慢慢问，说完人已经走了。",
      },
      {
        label: "问她如今还录不录",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["yinxiaojie", "player"], delta: 3 },
          { quality: "life:yinxiaojie", set: 2 }, { quality: "life:yinxiaojie:how", set: 1 },
        ],
        result: "{$a}说不录了，如今她只当场请人念一遍，念不出口的就地划掉，这办法是从去年这一柜学的。",
      },
    ],
  },

  // —— 段小姐：那一栏有了名字以后，只留自己那一页 ——
  {
    id: "life2-duan",
    kind: "arc",
    cast: { a: duan },
    when: [{ season: { gte: 6 } }, { quality: "arc:duan:end", gte: 1 }, { quality: "life:duan", eq: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}今天带的是自己的过敏记录，只有一页。她说那一栏填上名字以后，去年替别人记的那三本她都退回去了，如今身上只留这一页。",
    choices: [
      {
        label: "把她那一页读完再开",
        when: [how("duan", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["duan", "player"], delta: 5 }, { stat: "compliance", delta: 2 },
          { quality: "life:duan", set: 2 }, { quality: "life:duan:how", set: 1 },
        ],
        result: "{$a}说你念到第三行就停了，问她那处今年还过不过敏，她说不过敏了，那句话是写给去年的自己看的。",
      },
      {
        label: "先问她还记不记别人",
        when: [how("duan", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:duan", set: 2 }, { quality: "life:duan:how", set: 2 },
        ],
        result: "{$a}说还记，只是记在自己这本上，替谁操心这件事她今年只留了一个名字，别的她不管了。",
      },
      {
        label: "问那三本退给谁了",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["duan", "player"], delta: 3 },
          { quality: "life:duan", set: 2 }, { quality: "life:duan:how", set: 1 },
        ],
        result: "{$a}说一人还一本，还的时候对方愣了半天，她把那一页举起来晃了晃，说如今她也有一页要人还。",
      },
    ],
  },

  // —— 赵宁：她带了一个同学来，把去年听到的那句说给别人 ——
  {
    id: "life2-zhaoning",
    kind: "arc",
    cast: { a: zhaoning },
    when: [{ season: { gte: 6 } }, { quality: "arc:zhaoning:end", gte: 1 }, { quality: "life:zhaoning", eq: 1 }],
    weight: 28, tension: 1, cooldown: 28,
    text: "{$a}这次不是一个人，身边那个同学跟她一样先自己查了成分才敢进柜。她说那孩子问她这里会不会硬推，她把去年自己听到的那句原样答了一遍。",
    choices: [
      {
        label: "让那孩子自己问，一句不替她答",
        when: [how("zhaoning", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["zhaoning", "player"], delta: 5 },
          { quality: "life:zhaoning", set: 2 }, { quality: "life:zhaoning:how", set: 1 },
        ],
        result: "{$a}说她去年也是这样被人等着问完的，那孩子开口比她去年慢，她一直没催，催的话到了嘴边又咽回去。",
      },
      {
        label: "两人都按各自的行开",
        when: [how("zhaoning", 2)],
        effects: [
          { opinion: "$a", delta: 3 }, { stat: "standing", delta: 1 },
          { quality: "life:zhaoning", set: 2 }, { quality: "life:zhaoning:how", set: 2 },
        ],
        result: "{$a}说各开各的好，她今年不替那孩子拿主意了，去年那事是她妈替她，她不想又变成一个人替另一个人。",
      },
      {
        label: "这一柜今天不接待两个人",
        when: [how("zhaoning", 3)],
        effects: [
          { opinion: "$a", delta: -5 }, { stat: "standing", delta: -1 },
          { quality: "life:zhaoning", set: 2 }, { quality: "life:zhaoning:how", set: 3 },
        ],
        result: "{$a}愣了一下，把那孩子往自己身后挡了半步，说去年也是这一柜教她别等人开口，今年这句她记下了，转身带人下楼。",
      },
      {
        label: "先问她那份记录给谁看过",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["zhaoning", "player"], delta: 4 },
          { quality: "life:zhaoning", set: 2 }, { quality: "life:zhaoning:how", set: 1 },
        ],
        result: "{$a}说她那份如今发到宿舍群里，有三个人问过她同一条，她说她答不上来的就去问柜上，不自己编。",
      },
    ],
  },

  // —— 罗曼：那页薄的表换成一部手机 ——
  {
    id: "life2-roman",
    kind: "arc",
    cast: { a: roman },
    when: [{ season: { gte: 6 } }, { quality: "arc:roman:end", gte: 1 }, { quality: "life:roman", eq: 1 }],
    weight: 28, tension: 0, cooldown: 28,
    text: "{$a}手里那页薄的表不见了，换成一部手机。她说楼上看数如今不用纸，她照样站那两天，只是今年她要问的是这一句有没有人当着客人的面说过。",
    choices: [
      {
        label: "把她那两句当客人的面念一遍",
        when: [how("roman", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "compliance", delta: 3 }, { bond: ["roman", "player"], delta: 5 },
          { quality: "life:roman", set: 2 }, { quality: "life:roman:how", set: 1 },
        ],
        result: "{$a}听完没记手机，说这一句她去年记过，今年她只想知道站在镜前的人听见没有，说完自己点了下头。",
      },
      {
        label: "照数回她，一句不多",
        when: [how("roman", 2)],
        effects: [
          { opinion: "$a", delta: 1 },
          { quality: "life:roman", set: 2 }, { quality: "life:roman:how", set: 2 },
        ],
        result: "{$a}说数她收到，手机里那一列就是给楼上看的，她本人今天不上楼，站着等的是另外那一句。",
      },
      {
        label: "问她如今还管不管这层楼",
        effects: [
          { opinion: "$a", delta: 4 }, { stat: "standing", delta: 1 },
          { quality: "life:roman", set: 2 }, { quality: "life:roman:how", set: 1 },
        ],
        result: "{$a}说管，只是不再用表管，如今她站在旁边听，听见谁把话说满了她就走过去，请那人当着客人再说一遍。",
      },
    ],
  },

  // —— 乔晚：她如今带一个实习生 ——
  {
    id: "life2-qiaowan",
    kind: "arc",
    cast: { a: qiaowan },
    when: [{ season: { gte: 6 } }, { quality: "arc:qiaowan:end", gte: 1 }, { quality: "life:qiaowan", eq: 1 }],
    weight: 28, tension: 1, cooldown: 28,
    text: "{$a}身后跟着一个刚来的实习生。她说去年她把学来的句子拆开重装，今年那孩子把她那一套背得很熟，她正纠结要不要像去年那样让人改。",
    choices: [
      {
        label: "让她自己去劝那孩子改",
        when: [how("qiaowan", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["qiaowan", "player"], delta: 5 },
          { quality: "life:qiaowan", set: 2 }, { quality: "life:qiaowan:how", set: 1 },
        ],
        result: "{$a}说她去年改了三回才敢当自己的用，今年那一句她改了五回，改完先念给那孩子听，念到自己先红了脸。",
      },
      {
        label: "背得熟就照背的算",
        when: [how("qiaowan", 2)],
        effects: [
          { opinion: "$a", delta: -2 },
          { quality: "life:qiaowan", set: 2 }, { quality: "life:qiaowan:how", set: 2 },
        ],
        result: "{$a}说背得熟也没用，客人一问真不真她就答不上来，去年那天她在楼下站了很久，不想看那孩子再站一次。",
      },
      {
        label: "那孩子不归她带",
        when: [how("qiaowan", 3)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: -1 },
          { quality: "life:qiaowan", set: 2 }, { quality: "life:qiaowan:how", set: 3 },
        ],
        result: "{$a}点头说行，那她把自己这套写下来交上去，谁爱用谁用，写完把那半页纸压在柜面上，没递给谁。",
      },
      {
        label: "先问那孩子听的是谁的句子",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["qiaowan", "player"], delta: 4 },
          { quality: "life:qiaowan", set: 2 }, { quality: "life:qiaowan:how", set: 1 },
        ],
        result: "{$a}说一半是她教的，一半是从旧话术里抄的，抄那部分她自己认不出来，站在那儿想了半天怎么开口。",
      },
    ],
  },

  // —— 宋姐：手机最上面那个群换了 ——
  {
    id: "life2-songjie",
    kind: "arc",
    cast: { a: songjie },
    when: [{ season: { gte: 6 } }, { quality: "arc:songjie:end", gte: 1 }, { quality: "life:songjie", eq: 1 }],
    weight: 27, tension: 0, cooldown: 28,
    text: "{$a}把手机放在柜面上，屏幕朝上，最上面那个群换成了她妈的家庭群。她说去年她给自己下了一单，那一单她用完了，今年开口问的第一句终于是她自己要问的。",
    choices: [
      {
        label: "按她自己要的那一句开",
        when: [how("songjie", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["songjie", "player"], delta: 5 },
          { quality: "life:songjie", set: 2 }, { quality: "life:songjie:how", set: 1 },
        ],
        result: "{$a}说她妈看见那一支问了句这不是给自己买的吗，她回了三个字：是给自己。回完她把手机扣下了。",
      },
      {
        label: "群里的账她自己算",
        when: [how("songjie", 2)],
        effects: [
          { opinion: "$a", delta: 1 },
          { quality: "life:songjie", set: 2 }, { quality: "life:songjie:how", set: 2 },
        ],
        result: "{$a}说群里那几她退了，剩下三五个是真要用的，报数不用比来比去，这一趟她只想问一句自己合不合适。",
      },
      {
        label: "这一柜不替群里开单",
        when: [how("songjie", 3)],
        effects: [
          { opinion: "$a", delta: -3 },
          { quality: "life:songjie", set: 2 }, { quality: "life:songjie:how", set: 3 },
        ],
        result: "{$a}说她已经不替群里带了，去年算完那笔时间她就不带了，今天这一句她自己听见了，站着没动。",
      },
      {
        label: "先问她今年想给自己留什么",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["songjie", "player"], delta: 4 },
          { quality: "life:songjie", set: 2 }, { quality: "life:songjie:how", set: 1 },
        ],
        result: "{$a}想了很久，说这几年她连自己那一张脸要什么都没记过，今天她要把第一行写在自己那页上，写完才走。",
      },
    ],
  },

  // —— 白姐：带的是自己的化妆包 ——
  {
    id: "life2-baijie",
    kind: "arc",
    cast: { a: baijie },
    when: [{ season: { gte: 6 } }, { quality: "arc:baijie:end", gte: 1 }, { quality: "life:baijie", eq: 1 }],
    weight: 27, tension: -1, cooldown: 28,
    text: "{$a}这回带的是自己的化妆包，不是那套工具箱。她说徒弟们上台了，她坐到台下，第一次有人问她今天想化哪一种，她答了半天没答上来。",
    choices: [
      {
        label: "把六个色号摊开让她自己挑",
        when: [how("baijie", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 1 }, { bond: ["baijie", "player"], delta: 5 },
          { quality: "life:baijie", set: 2 }, { quality: "life:baijie:how", set: 1 },
        ],
        result: "{$a}挑了三支又都放回，说她给别人化时一眼就定，轮到自己坐在这儿手就慢，最后拿的是最底下那一支。",
      },
      {
        label: "按一支开完，不多问",
        when: [how("baijie", 2)],
        effects: [
          { opinion: "$a", delta: 1 },
          { quality: "life:baijie", set: 2 }, { quality: "life:baijie:how", set: 2 },
        ],
        result: "{$a}说一支够了，她今天不上台，只想把那一场散掉以后第一次坐回镜前这件事办完，办完就走。",
      },
      {
        label: "让她把徒弟也叫来",
        when: [how("baijie", 3)],
        effects: [
          { opinion: "$a", delta: -2 }, { stat: "standing", delta: 1 },
          { quality: "life:baijie", set: 2 }, { quality: "life:baijie:how", set: 3 },
        ],
        result: "{$a}说徒弟们如今不用她带，那一场散了以后她自己也没再接过那家的事，这一趟她只想一个人坐着。",
      },
      {
        label: "问她今年还上不上台",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["baijie", "player"], delta: 4 },
          { quality: "life:baijie", set: 2 }, { quality: "life:baijie:how", set: 1 },
        ],
        result: "{$a}说上还上，只是今年她想先把自己这张脸交代清楚，交代不清上台也是替别人遮，说完把包打开摆在镜前。",
      },
    ],
  },

  // —— 裴岚：上楼走的是正门，手里没拿表 ——
  {
    id: "life2-peilan",
    kind: "arc",
    cast: { a: peilan },
    when: [{ season: { gte: 6 } }, { quality: "arc:peilan:end", gte: 1 }, { quality: "life:peilan", eq: 1 }],
    weight: 28, tension: 1, cooldown: 28,
    text: "{$a}上楼走的是正门，手里没拿表。她说这一片的数今年没人报了，那本空出来的页她不打算交给楼上，她想问这一柜今年自己写不写。",
    choices: [
      {
        label: "写，谁站柜谁签她那一页",
        when: [how("peilan", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }, { bond: ["peilan", "player"], delta: 5 },
          { quality: "life:peilan", set: 2 }, { quality: "life:peilan:how", set: 1 },
        ],
        result: "{$a}说那她按去年那条办：她只念，不改字，念完站着不坐，等柜上的人自己把那行填下去。",
      },
      {
        label: "她那一名还在表上，照旧报",
        when: [how("peilan", 2)],
        effects: [
          { opinion: "$a", delta: 1 },
          { quality: "life:peilan", set: 2 }, { quality: "life:peilan:how", set: 2 },
        ],
        result: "{$a}说名在不在她不管，她今年不管这片的表了，今天来是想看这柜有没有人肯当面说一句不好听的。",
      },
      {
        label: "那一页留给她自己，不写",
        when: [how("peilan", 3)],
        effects: [
          { opinion: "$a", delta: -5 }, { stat: "standing", delta: -1 },
          { quality: "life:peilan", set: 2 }, { quality: "life:peilan:how", set: 3 },
        ],
        result: "{$a}说这一句去年她也听过一遍，今年不意外，把那支早停产的旧口红从兜里拿出来放在柜面上，说还给她算了。",
      },
      {
        label: "问她今年还站不站那两天",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["peilan", "player"], delta: 4 },
          { quality: "life:peilan", set: 2 }, { quality: "life:peilan:how", set: 1 },
        ],
        result: "{$a}说站，从两天改成三天，理由是她发现站着才听得见真话，坐下就只听得见数，说完自己往镜前那边挪了一步。",
      },
    ],
  },

  // ============ 第 33 轮：第 7 季那一格（life:<id> 走到 3）—— 这两年的账在这里结 ============
  // 第 5、6 季那两步把 20 位铺满以后，8 季的读数把空白挪到了第 7、8 季：各 15 次抽到、新演 0 张、13%。
  // 这一格不写成"又一年"，写成**前两年怎么待她的账到期**：how=1 她还认这一柜、how=2 只剩生意、how=3 那一格她不留了。
  // 本轮先给第 1 季那九条与梁夏（共 10 位），其余 10 位照同一写法下一轮补。
  // —— 沈薇：那一栏今年写了别人的名字 ——
  {
    id: "life3-shen",
    kind: "arc",
    cast: { a: shen },
    when: [{ season: { gte: 7 } }, { quality: "arc:shen:end", gte: 1 }, { quality: "life:shen", eq: 2 }],
    weight: 27, tension: -1, cooldown: 28,
    text: "{$a}这次身后跟着一个不肯开口的年轻人。她说组里那一栏今年写了那孩子的名，她自己报了三年的一行空出来，站在这儿才知道空着是什么感觉。",
    choices: [
      {
        label: "当着她的面，把那一行交给那孩子",
        when: [how("shen", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }, { bond: ["shen", "player"], delta: 6 },
          { quality: "life:shen", set: 3 }, { quality: "life:shen:how", set: 1 },
        ],
        result: "{$a}说这句她等了两年，被人当着面讲出来跟被撤下来不是一回事，说完替那孩子把话接了一句就退到旁边。",
      },
      {
        label: "只跟那孩子谈，不提她旧年那一栏",
        when: [how("shen", 2)],
        effects: [
          { opinion: "$a", delta: -2 }, { bond: ["shen", "player"], delta: 2 },
          { quality: "life:shen", set: 3 }, { quality: "life:shen:how", set: 2 },
        ],
        result: "{$a}在旁边站着听完了，说这一柜如今认得她的是那张单不是她这个人，语气平，听不出气话。",
      },
      {
        label: "那一栏的事今天不谈",
        when: [cold("shen", -6)],
        effects: [
          { opinion: "$a", delta: -5 }, { stat: "standing", delta: -1 },
          { quality: "life:shen", set: 3 }, { quality: "life:shen:how", set: 3 },
        ],
        result: "{$a}点头说她不配谈这个，拉着那孩子往别的柜走，走到楼梯口才回头补一句：那一行别空着。",
      },
      {
        label: "先问那孩子敢不敢自己开口",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["shen", "player"], delta: 4 },
          { quality: "life:shen", set: 3 }, { quality: "life:shen:how", set: 1 },
        ],
        result: "{$a}说那孩子跟她去年一模一样，站着等人问，她当年也是这样，这次她先替那孩子把问题留在这儿没答。",
      },
    ],
  },

  // —— 安姐：她今年只替自己接一场 ——
  {
    id: "life3-anjie",
    kind: "arc",
    cast: { a: anjie },
    when: [{ season: { gte: 7 } }, { quality: "arc:anjie:end", gte: 1 }, { quality: "life:anjie", eq: 2 }],
    weight: 27, tension: 0, cooldown: 28,
    text: "{$a}把那张单子翻过来放在柜面上，背面写着她自己的名字。她说今年只接一场，接的是自己的事，别人的请托她退回去了三张。",
    choices: [
      {
        label: "按背面那一张给她开",
        when: [how("anjie", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["anjie", "player"], delta: 5 }, { stat: "standing", delta: 1 },
          { quality: "life:anjie", set: 3 }, { quality: "life:anjie:how", set: 1 },
        ],
        result: "{$a}说这一张她写了又划掉，划掉又写，两年里头一回把自己的名字放在最上头，让你念一遍确认没写错。",
      },
      {
        label: "她退回去的那三张，问是谁",
        when: [cold("anjie", -4)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:anjie", set: 3 }, { quality: "life:anjie:how", set: 2 },
        ],
        result: "{$a}说都是那年婚礼上认识的人，如今她不看那一家的事也不替谁开口，账算得比谁都清。",
      },
      {
        label: "这一柜不替她保管那一张",
        when: [how("anjie", 3)],
        effects: [
          { opinion: "$a", delta: -4 },
          { quality: "life:anjie", set: 3 }, { quality: "life:anjie:how", set: 3 },
        ],
        result: "{$a}把那张单子折好收进自己兜里，说本来就是拿给你看一眼，不留下也不下次再来。",
      },
      {
        label: "问她今年想为谁化",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["anjie", "player"], delta: 4 },
          { quality: "life:anjie", set: 3 }, { quality: "life:anjie:how", set: 1 },
        ],
        result: "{$a}说她想了半年，最后写下的是自己，那一场的化妆台她打算站到结束，不替谁盯妆。",
      },
    ],
  },

  // —— 梅女士：有人请她回去，她来问这一柜答不答应 ——
  {
    id: "life3-mei",
    kind: "arc",
    cast: { a: mei },
    when: [{ season: { gte: 7 } }, { quality: "arc:mei:end", gte: 1 }, { quality: "life:mei", eq: 2 }],
    weight: 27, tension: 1, cooldown: 28,
    text: "{$a}坐下先把包放镜台边上，这一回包里有东西。她说楼上请她回去带一段时间，她没答，先来问这一柜答不答应她把自己那十分钟留着。",
    choices: [
      {
        label: "答应，她那一下午还是这一柜的",
        when: [how("mei", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["mei", "player"], delta: 5 },
          { quality: "life:mei", set: 3 }, { quality: "life:mei:how", set: 1 },
        ],
        result: "{$a}说这一句她没在别人面前提过，答不答应都由这一柜说，说完从包里拿出那张请帖压在柜面上。",
      },
      {
        label: "那一格归楼上，这里只谈生意",
        when: [how("mei", 2)],
        effects: [
          { opinion: "$a", delta: 1 },
          { quality: "life:mei", set: 3 }, { quality: "life:mei:how", set: 2 },
        ],
        result: "{$a}说行，那她按客人那一档来，请帖收回包里，坐下先把今天要问的那一支念出来，一句旧事不提。",
      },
      {
        label: "她回不回楼上都跟这一柜无关",
        when: [how("mei", 3)],
        effects: [
          { opinion: "$a", delta: -3 }, { stat: "standing", delta: 1 },
          { quality: "life:mei", set: 3 }, { quality: "life:mei:how", set: 3 },
        ],
        result: "{$a}说这句她爱听，站起来了才又坐下，说自己原本打算谁都不问，今天来是想看这一柜有没有人留她。",
      },
      {
        label: "先问她自己想不想回去",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["mei", "player"], delta: 4 },
          { quality: "life:mei", set: 3 }, { quality: "life:mei:how", set: 1 },
        ],
        result: "{$a}想了很久，说想回去的是那个能坐一下午的位置，不是那个要签字的名头，这两样她自己也没分干净。",
      },
    ],
  },

  // —— 小雨：她带的那个孩子自己走进来了 ——
  {
    id: "life3-xiaoyu",
    kind: "arc",
    cast: { a: xiaoyu },
    when: [{ season: { gte: 7 } }, { quality: "arc:xiaoyu:end", gte: 1 }, { quality: "life:xiaoyu", eq: 2 }],
    weight: 27, tension: 0, cooldown: 28,
    text: "{$a}这回是一个人，身边那个位置空着。她说她带的那个孩子今天自己走进来的，那句她去年从这一柜听去的，原样讲给那孩子，讲完就让孩子自己来问。",
    choices: [
      {
        label: "把去年那句再讲一遍，让那孩子听见",
        when: [how("xiaoyu", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }, { bond: ["xiaoyu", "player"], delta: 5 },
          { quality: "life:xiaoyu", set: 3 }, { quality: "life:xiaoyu:how", set: 1 },
        ],
        result: "{$a}说她那句被自己讲出来以后就管不着了，说完侧身让孩子站到镜前，自己退半步，跟去年谁退给她的那样。",
      },
      {
        label: "她如今也报数了，按数对",
        when: [how("xiaoyu", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:xiaoyu", set: 3 }, { quality: "life:xiaoyu:how", set: 2 },
        ],
        result: "{$a}说数她报得出来，只是那孩子问她的第一句是会不会被硬推，她答不上来，站着等这一柜替她答。",
      },
      {
        label: "问那孩子今天还来不来",
        when: [cold("xiaoyu", -6)],
        effects: [
          { opinion: "$a", delta: -2 },
          { quality: "life:xiaoyu", set: 3 }, { quality: "life:xiaoyu:how", set: 2 },
        ],
        result: "{$a}说那孩子在楼下等，去年这一柜让她等过一回，她不想让孩子也等，今天这一句问完就走。",
      },
      {
        label: "先问她如今带几个人",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["xiaoyu", "player"], delta: 4 },
          { quality: "life:xiaoyu", set: 3 }, { quality: "life:xiaoyu:how", set: 1 },
        ],
        result: "{$a}说三个，一个跟自己一样先查成分，一个开口比她去年还慢，还有一个什么都不敢问，她说她把这三样都记得。",
      },
    ],
  },

  // —— 周姐：掐表的那个人换成她了 ——
  {
    id: "life3-zhou",
    kind: "arc",
    cast: { a: zhou },
    when: [{ season: { gte: 7 } }, { quality: "arc:zhou:end", gte: 1 }, { quality: "life:zhou", eq: 2 }],
    weight: 27, tension: -1, cooldown: 28,
    text: "{$a}今天手里拿着别人的排班表。她说组里换了个掐表的，如今轮到她提醒别人只有二十分钟，提醒完自己站在这儿，一时想不起今天要办谁的事。",
    choices: [
      {
        label: "提醒她今天是给她自己的",
        when: [how("zhou", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["zhou", "player"], delta: 5 },
          { quality: "life:zhou", set: 3 }, { quality: "life:zhou:how", set: 1 },
        ],
        result: "{$a}说这句她今年听过两回，一回是她自己说的，一回是从别人嘴里听见，第三回想在这一柜听，说完把表收起来。",
      },
      {
        label: "按她那两位的份一起开",
        when: [how("zhou", 2)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "standing", delta: 1 },
          { quality: "life:zhou", set: 3 }, { quality: "life:zhou:how", set: 2 },
        ],
        result: "{$a}说那两位如今不用她带，各人自己来，她把表摊开给这一柜看，说上面只剩她一个人名字，她还不习惯。",
      },
      {
        label: "二十分钟用完，谁也不留",
        when: [cold("zhou", -6)],
        effects: [
          { opinion: "$a", delta: -4 },
          { quality: "life:zhou", set: 3 }, { quality: "life:zhou:how", set: 3 },
        ],
        result: "{$a}说她今天不为留什么，拿别人的表来对一下时间就走，说完看了柜面那口钟一眼，钟早停了，她自己也没注意。",
      },
      {
        label: "问她今年那张脸上要什么",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["zhou", "player"], delta: 4 },
          { quality: "life:zhou", set: 3 }, { quality: "life:zhou:how", set: 1 },
        ],
        result: "{$a}说这两年她学会的第一件事是把自己的名字写在最上头，第二件是开口问，今天这一句就是她练的那第二件。",
      },
    ],
  },

  // —— 苏蔓：老客有人接了，她完全不在这一层 ——
  {
    id: "life3-suman",
    kind: "arc",
    cast: { a: suman },
    when: [{ season: { gte: 7 } }, { quality: "arc:suman:end", gte: 1 }, { quality: "life:suman", eq: 2 }],
    weight: 27, tension: 0, cooldown: 28,
    text: "{$a}上楼直接到镜前，没跟柜上的人打招呼。她说那几个老客如今报得出别人的名了，她听见第一句时愣了半天，愣完反倒松下来。",
    choices: [
      {
        label: "把她那一格的名字还留着",
        when: [how("suman", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["suman", "player"], delta: 6 },
          { quality: "life:suman", set: 3 }, { quality: "life:suman:how", set: 1 },
        ],
        result: "{$a}说留不留她不管了，只是这句话她记着，说完自己笑，笑完坐下去那一侧的凳子比从前挪远了一点。",
      },
      {
        label: "按今天这一位客人待",
        when: [how("suman", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:suman", set: 3 }, { quality: "life:suman:how", set: 2 },
        ],
        result: "{$a}说这样最好，她来这一柜不为证明什么，今天问的这一支她去年替别人挑了十几回，今年第一次是给自己。",
      },
      {
        label: "这一柜不再有她那一格",
        when: [how("suman", 3)],
        effects: [
          { opinion: "$a", delta: -3 },
          { quality: "life:suman", set: 3 }, { quality: "life:suman:how", set: 3 },
        ],
        result: "{$a}说这话去年她也听见了，去年她争，今年不争，站着把要的东西报完，付完钱走，回头的次数一次都没有。",
      },
      {
        label: "问她今年还替谁说话",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["suman", "player"], delta: 4 },
          { quality: "life:suman", set: 3 }, { quality: "life:suman:how", set: 1 },
        ],
        result: "{$a}说今年谁也不替，只替自己问那一句，问完补了一句：这几年她把别人的名字念得太熟，自己的反倒生。",
      },
    ],
  },

  // —— 陆遥：她那柜散了以后，自己开了一个小格 ——
  {
    id: "life3-luyao",
    kind: "arc",
    cast: { a: luyao },
    when: [{ season: { gte: 7 } }, { quality: "arc:luyao:end", gte: 1 }, { quality: "life:luyao", eq: 2 }],
    weight: 27, tension: 1, cooldown: 28,
    text: "{$a}不是从柜前来的，是从楼梯上来的。她说自己在楼下开了一个一格的小柜，没有对面，也没有通道，今天来是问一句这面柜的旧规矩她今年还用不用得着。",
    choices: [
      {
        label: "用得上，她那一名还在这本上",
        when: [how("luyao", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 1 }, { bond: ["luyao", "player"], delta: 6 },
          { quality: "life:luyao", set: 3 }, { quality: "life:luyao:how", set: 1 },
        ],
        result: "{$a}说她那一格连招牌都没挂，只有两面镜，来问的人都是去年被她截过句子的那几个，说完先低头笑。",
      },
      {
        label: "两本账各记各的，别并",
        when: [how("luyao", 2)],
        effects: [
          { opinion: "$a", delta: 1 }, { stat: "standing", delta: 1 },
          { quality: "life:luyao", set: 3 }, { quality: "life:luyao:how", set: 2 },
        ],
        result: "{$a}说就该各记各的，她如今不替谁截话，也不求人把句子给她，站着把那本自己记的数塞回兜里。",
      },
      {
        label: "这面柜没有她的旧规矩",
        when: [how("luyao", 3)],
        effects: [
          { opinion: "$a", delta: -4 },
          { quality: "life:luyao", set: 3 }, { quality: "life:luyao:how", set: 3 },
        ],
        result: "{$a}说这一句正合她意，她本就没打算要这一柜认，今天来是告诉自己那一格早不是她的了，说完上楼就走。",
      },
      {
        label: "问她楼下那一格卖什么",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["luyao", "player"], delta: 5 },
          { quality: "life:luyao", set: 3 }, { quality: "life:luyao:how", set: 1 },
        ],
        result: "{$a}说只卖她自己信的那几支，一支都说不满，客人问她真不真她答得上来 —— 这句去年她答不上，站了很久。",
      },
    ],
  },

  // —— 米朵：她的号如今有人替她做表 ——
  {
    id: "life3-miduo",
    kind: "arc",
    cast: { a: miduo },
    when: [{ season: { gte: 7 } }, { quality: "arc:miduo:end", gte: 1 }, { quality: "life:miduo", eq: 2 }],
    weight: 27, tension: 0, cooldown: 28,
    text: "{$a}带来的不是那三页表，是别人替她做的一本。她说如今有人给她排货、给她写话，她念到第三页念不下去，就带上那本空手来了这一柜。",
    choices: [
      {
        label: "把那一本当着她的面拆开",
        when: [how("miduo", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "compliance", delta: 3 }, { bond: ["miduo", "player"], delta: 5 },
          { quality: "life:miduo", set: 3 }, { quality: "life:miduo:how", set: 1 },
        ],
        result: "{$a}说拆到第七页她就放心了，那本里替她写的句子有一半她不敢念，这一柜没人替她写，她自己念得下去。",
      },
      {
        label: "按她那本上的数开",
        when: [how("miduo", 2)],
        effects: [
          { opinion: "$a", delta: 1 },
          { quality: "life:miduo", set: 3 }, { quality: "life:miduo:how", set: 2 },
        ],
        result: "{$a}说数照那本的，只是她今年要一行自己的，那一行写什么她想了一个月，今天来就是想让这一柜帮她看一眼。",
      },
      {
        label: "她那号的事别在这一柜谈",
        when: [cold("miduo", -6)],
        effects: [
          { opinion: "$a", delta: -3 },
          { quality: "life:miduo", set: 3 }, { quality: "life:miduo:how", set: 3 },
        ],
        result: "{$a}把那一本抱紧了，说就是这一句她在别处天天听，来这里也是听这句，那她回去自己写，说完站着没动。",
      },
      {
        label: "先问她今年还想不想自己挑",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["miduo", "player"], delta: 4 },
          { quality: "life:miduo", set: 3 }, { quality: "life:miduo:how", set: 1 },
        ],
        result: "{$a}说想，就是把灯架搬回家那两年她忘了自己怎么挑，今天她不带那孩子，只带自己那一页。",
      },
    ],
  },

  // —— 赵女士：换成女儿替她拿主意 ——
  {
    id: "life3-zhao",
    kind: "arc",
    cast: { a: zhao },
    when: [{ season: { gte: 7 } }, { quality: "arc:zhao:end", gte: 1 }, { quality: "life:zhao", eq: 2 }],
    weight: 27, tension: 1, cooldown: 28,
    text: "{$a}这回是被女儿带来的。女儿站在旁边替她说话，她站着听了一会儿，把手里那一张推过去，说这一行她自己填，填完再给女儿看。",
    choices: [
      {
        label: "让她自己写完，再给女儿看",
        when: [how("zhao", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["zhao", "player"], delta: 5 }, { bond: ["zhao", "zhaoning"], delta: 5 },
          { quality: "life:zhao", set: 3 }, { quality: "life:zhao:how", set: 1 },
        ],
        result: "{$a}写完念了一遍，念到一半声音低下去，女儿替她把最后半句接上，接得对，她点了下头没让。",
      },
      {
        label: "两张单各填各的，别互相代",
        when: [how("zhao", 2)],
        effects: [
          { opinion: "$a", delta: 3 }, { stat: "standing", delta: 1 },
          { quality: "life:zhao", set: 3 }, { quality: "life:zhao:how", set: 2 },
        ],
        result: "{$a}说这样最好，她这两年练的就是不当着人替女儿拿主意，也不让女儿替她拿，这一句她说得比去年稳。",
      },
      {
        label: "今天这一柜只认她自己",
        when: [cold("zhao", -6)],
        effects: [
          { opinion: "$a", delta: 2 }, { bond: ["zhao", "zhaoning"], delta: -3 },
          { quality: "life:zhao", set: 3 }, { quality: "life:zhao:how", set: 3 },
        ],
        result: "{$a}愣了一下，回头让女儿下楼等，说这一趟她一个人办，说完自己坐到镜前，坐得比几年前慢，但坐下了。",
      },
      {
        label: "先问女儿这一行算谁的",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["zhao", "player"], delta: 4 },
          { quality: "life:zhao", set: 3 }, { quality: "life:zhao:how", set: 1 },
        ],
        result: "{$a}说这一行两年前是她自己开的头，如今女儿想接手，她不挡，只要求那一行按她的用法写，别写成给谁看。",
      },
    ],
  },

  // —— 梁夏：那一页被人抄走，她来说第二行 ——
  {
    id: "life3-liangxia",
    kind: "arc",
    cast: { a: liangxia },
    when: [{ season: { gte: 7 } }, { quality: "arc:liangxia:end", gte: 1 }, { quality: "life:liangxia", eq: 2 }],
    weight: 27, tension: -1, cooldown: 28,
    text: "{$a}那一页去年被人整行抄走，署的是别人的名。她说这次来不为讨那一句，是来写第二行，写完了要当面念一次，抄的人如今就在楼下。",
    choices: [
      {
        label: "让她当面念，这一柜听着",
        when: [how("liangxia", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 1 }, { bond: ["liangxia", "player"], delta: 5 },
          { quality: "life:liangxia", set: 3 }, { quality: "life:liangxia:how", set: 1 },
        ],
        result: "{$a}念得很慢，念完楼下那一位没上来，她把那一页翻到第三页，说第三行她还没想好，先空着。",
      },
      {
        label: "抄走了就由她，第二行自己写",
        when: [how("liangxia", 2)],
        effects: [
          { opinion: "$a", delta: 3 },
          { quality: "life:liangxia", set: 3 }, { quality: "life:liangxia:how", set: 2 },
        ],
        result: "{$a}说她如今不追那一句了，追了两回没结果，第三回她换成写新的，写完那一页就归她自己管。",
      },
      {
        label: "这一柜不掺和她那一页",
        when: [cold("liangxia", -6)],
        effects: [
          { opinion: "$a", delta: -2 }, { bond: ["liangxia", "anjie"], delta: -2 },
          { quality: "life:liangxia", set: 3 }, { quality: "life:liangxia:how", set: 3 },
        ],
        result: "{$a}说这句她也预料到了，本来就没打算请这一柜出面，只是写完想找个地方念一遍，念完就走。",
      },
      {
        label: "问她那一句抄走了什么",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["liangxia", "player"], delta: 4 },
          { quality: "life:liangxia", set: 3 }, { quality: "life:liangxia:how", set: 1 },
        ],
        result: "{$a}说抄走的是话，抄不走的是她站过的那两个柜位，这一句她练了很久，说出来时自己先信了。",
      },
    ],
  },

  // ============ 第 35 轮：第 7 季剩下那十位，第三格铺满 ============
  // 写之前先探针量过每一位去年那张实际写得出哪几档 how（尹小洁、赵宁、唐可、方敏、乔晚、宋姐、白姐、裴岚是 [1,2,3]；
  // 段小姐、罗曼只有 [1,2]）—— 门照那个集合摆，不照顺手写的 [1,2,3] 摆，否则就是第 34 轮抓到的那种死格子。
  // —— 尹小姐：她那一页被人拿着来了 ——
  {
    id: "life3-yinxiaojie",
    kind: "arc",
    cast: { a: yinxiaojie },
    when: [{ season: { gte: 7 } }, { quality: "arc:yinxiaojie:end", gte: 1 }, { quality: "life:yinxiaojie", eq: 2 }],
    weight: 27, tension: 0, cooldown: 28,
    text: "{$a}手里那一页印出来了，薄薄一张，她说如今有十个人拿它去问柜。今天她自己来，是想看这一柜被她那一页问过以后，改成什么样了。",
    choices: [
      {
        label: "把她那一页改过的地方念给她听",
        when: [how("yinxiaojie", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "compliance", delta: 3 }, { bond: ["yinxiaojie", "player"], delta: 5 },
          { quality: "life:yinxiaojie", set: 3 }, { quality: "life:yinxiaojie:how", set: 1 },
        ],
        result: "{$a}听完那两处改法，说自己那一页上还有三行没被人抄走，抄不走的才是真难，说完她当场把那三行又念了一遍。",
      },
      {
        label: "按她那一张的规矩报数",
        when: [how("yinxiaojie", 2)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "compliance", delta: 1 },
          { quality: "life:yinxiaojie", set: 3 }, { quality: "life:yinxiaojie:how", set: 2 },
        ],
        result: "{$a}说数对得上就行，她如今不查谁说了满话，只查哪一句当着人能再说一遍，这一柜过了这一条。",
      },
      {
        label: "她那一张跟这一柜没关系",
        when: [how("yinxiaojie", 3)],
        effects: [
          { opinion: "$a", delta: -3 },
          { quality: "life:yinxiaojie", set: 3 }, { quality: "life:yinxiaojie:how", set: 3 },
        ],
        result: "{$a}把那一张收回兜里，说她本来也没打算给这一柜看，站着把今天要的那一支报完，一个字多余的话没有。",
      },
      {
        label: "问她那十个人如今还问吗",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["yinxiaojie", "player"], delta: 4 },
          { quality: "life:yinxiaojie", set: 3 }, { quality: "life:yinxiaojie:how", set: 1 },
        ],
        result: "{$a}说问，问得比她去年还细，有一个已经会反过来纠正她那一页上的字，她说这句是她今年最得意的一句。",
      },
    ],
  },

  // —— 段小姐：那一页如今是两个人的一页 ——
  {
    id: "life3-duan",
    kind: "arc",
    cast: { a: duan },
    when: [{ season: { gte: 7 } }, { quality: "arc:duan:end", gte: 1 }, { quality: "life:duan", eq: 2 }],
    weight: 27, tension: 1, cooldown: 28,
    text: "{$a}今天带了两个人来，一人手里一张她那一页的复印件。她说自己那一栏填上以后，身边这两个才开始填自己的，她如今是陪人来填的那一个。",
    choices: [
      {
        label: "三张一起对，一张都不替谁填",
        when: [how("duan", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "compliance", delta: 3 }, { bond: ["duan", "player"], delta: 5 },
          { quality: "life:duan", set: 3 }, { quality: "life:duan:how", set: 1 },
        ],
        result: "{$a}说这两个人去年连自己过敏在哪儿都说不清，今天各填各的，她在旁边看着没替谁落笔，这句她等了一年。",
      },
      {
        label: "先问她自己那一栏今年改了什么",
        when: [how("duan", 2)],
        effects: [
          { opinion: "$a", delta: 3 }, { bond: ["duan", "player"], delta: 4 },
          { quality: "life:duan", set: 3 }, { quality: "life:duan:how", set: 1 },
        ],
        result: "{$a}说她那一行划掉过两回又写回去，划掉是因为嫌自己事多，写回去是因为今年有人问她怎么填的。",
      },
      {
        label: "这一柜今天只办她一个人",
        when: [cold("duan", -5)],
        effects: [
          { opinion: "$a", delta: -2 }, { stat: "standing", delta: 1 },
          { quality: "life:duan", set: 3 }, { quality: "life:duan:how", set: 2 },
        ],
        result: "{$a}说好，那两个人她在楼下等，说完真把两个人带下去了，自己上来时手里只剩那一张。",
      },
      {
        label: "问那两张是谁要来的",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["duan", "player"], delta: 3 },
          { quality: "life:duan", set: 3 }, { quality: "life:duan:how", set: 2 },
        ],
        result: "{$a}说一个是她自己拉来的，一个是那人听说了她那一页找上门的，如今轮到别人替她宣传，她还不太习惯。",
      },
    ],
  },

  // —— 赵宁：宿舍群变成一间小课 ——
  {
    id: "life3-zhaoning",
    kind: "arc",
    cast: { a: zhaoning },
    when: [{ season: { gte: 7 } }, { quality: "arc:zhaoning:end", gte: 1 }, { quality: "life:zhaoning", eq: 2 }],
    weight: 27, tension: 0, cooldown: 28,
    text: "{$a}今天带着三个人上来，手里那份记录已经打印过。她说宿舍那间小课开到这学期第五回，来的不再是问她的人，是来给她看自己那一页的。",
    choices: [
      {
        label: "让那三个各自念自己那一页",
        when: [how("zhaoning", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "compliance", delta: 2 }, { bond: ["zhaoning", "player"], delta: 5 },
          { quality: "life:zhaoning", set: 3 }, { quality: "life:zhaoning:how", set: 1 },
        ],
        result: "{$a}站在旁边听完，说她们讲得比她去年好，讲到一半自己插不上嘴，说完那一下她笑得比谁都开。",
      },
      {
        label: "按她那份打印的讲，一条不漏",
        when: [how("zhaoning", 2)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "compliance", delta: 2 },
          { quality: "life:zhaoning", set: 3 }, { quality: "life:zhaoning:how", set: 2 },
        ],
        result: "{$a}说这一份她改了四版，第四版把妈妈那一栏删了，如今这份上只有她自己查来的，删那一行她想了半个月。",
      },
      {
        label: "这一柜不办一间课",
        when: [how("zhaoning", 3)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: -1 },
          { quality: "life:zhaoning", set: 3 }, { quality: "life:zhaoning:how", set: 3 },
        ],
        result: "{$a}说去年这一柜也这么讲过一遍，她记着呢；今年她不带人来了，三个人被她留在楼下，自己上来拿一支就走。",
      },
      {
        label: "问她那份记录如今谁在看",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["zhaoning", "player"], delta: 4 },
          { quality: "life:zhaoning", set: 3 }, { quality: "life:zhaoning:how", set: 1 },
        ],
        result: "{$a}说二十几个人在看，有人在她那页底下写别的，她一条条回，回不完也不删，说这样才对 —— 去年她也被人这样等过。",
      },
    ],
  },

  // —— 唐可：她那一格终于写她自己的名 ——
  {
    id: "life3-tangke",
    kind: "arc",
    cast: { a: tangke },
    when: [{ season: { gte: 7 } }, { quality: "arc:tangke:end", gte: 1 }, { quality: "life:tangke", eq: 2 }],
    weight: 27, tension: 1, cooldown: 28,
    text: "{$a}把排班表反过来推给你，正面写着她自己的名。她说那一格今年归她了，条件还是带人，只是这回她挑了带谁，来这一柜是想问一句这一柜要不要她带的那两个。",
    choices: [
      {
        label: "要，把那两个孩子一起算进来",
        when: [how("tangke", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }, { bond: ["tangke", "player"], delta: 6 },
          { quality: "life:tangke", set: 3 }, { quality: "life:tangke:how", set: 1 },
        ],
        result: "{$a}说她教那两个孩子第一句是不把话说满，第二句是当场念一遍，这两句都是她去年在这一柜听来的。",
      },
      {
        label: "只跟她本人算，那两个孩子另说",
        when: [how("tangke", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:tangke", set: 3 }, { quality: "life:tangke:how", set: 2 },
        ],
        result: "{$a}说行，那两个孩子她带去别处也行，只是这一柜她如今按数来，不按旧情来，这一句她说得很平。",
      },
      {
        label: "她那一格是楼上给的，别当这一柜给的",
        when: [how("tangke", 3)],
        effects: [
          { opinion: "$a", delta: -3 }, { stat: "standing", delta: 1 },
          { quality: "life:tangke", set: 3 }, { quality: "life:tangke:how", set: 3 },
        ],
        result: "{$a}说这句她爱听，楼上给的她不认，她只认自己带人带对了那一次，说完把表翻回正面压在柜面上。",
      },
      {
        label: "先问她挑的那两个人是谁",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["tangke", "player"], delta: 5 },
          { quality: "life:tangke", set: 3 }, { quality: "life:tangke:how", set: 1 },
        ],
        result: "{$a}报的两个名字都不是去年那两位，说去年那一位跟她不是一路人，这回她自己选的，选完才知道挑人这么难。",
      },
    ],
  },

  // —— 罗曼：那两天她不站了 ——
  {
    id: "life3-roman",
    kind: "arc",
    cast: { a: roman },
    when: [{ season: { gte: 7 } }, { quality: "arc:roman:end", gte: 1 }, { quality: "life:roman", eq: 2 }],
    weight: 27, tension: -1, cooldown: 28,
    text: "{$a}这回来没带手机也没带表。她说楼上的数她今年不看了，那两天也没站，如今她是一个来买自己那支的客，坐下先问这一柜还认不认得她。",
    choices: [
      {
        label: "认，按她那一句的老规矩开",
        when: [how("roman", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["roman", "player"], delta: 5 }, { stat: "standing", delta: 1 },
          { quality: "life:roman", set: 3 }, { quality: "life:roman:how", set: 1 },
        ],
        result: "{$a}说她今天就想试一次被人当客人问，不被当柜长问，说完把那句「这个能不能说满」自己先笑了。",
      },
      {
        label: "她今天说的每一句照样进档案",
        when: [how("roman", 2)],
        effects: [
          { opinion: "$a", delta: 1 }, { stat: "compliance", delta: 2 },
          { quality: "life:roman", set: 3 }, { quality: "life:roman:how", set: 2 },
        ],
        result: "{$a}说该进就进，她如今不替这层楼把关了，但她说出口的话还是得自己先担着，这一条她不让。",
      },
      {
        label: "问她今年为什么忽然想买东西",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["roman", "player"], delta: 4 },
          { quality: "life:roman", set: 3 }, { quality: "life:roman:how", set: 1 },
        ],
        result: "{$a}说站了这些年她只给别人推荐过，自己那支拖到现在，今天她想试一次不核对数字、只看镜子里那张脸。",
      },
    ],
  },

  // —— 方敏：她把这一层楼的人叫来一起念 ——
  {
    id: "life3-fangmin",
    kind: "arc",
    cast: { a: fangmin },
    when: [{ season: { gte: 7 } }, { quality: "arc:fangmin:end", gte: 1 }, { quality: "life:fangmin", eq: 2 }],
    weight: 27, tension: 0, cooldown: 28,
    text: "{$a}今天带着这层楼的人一起来，站成一排。她说这本今年当众念过三回，第四回她想带着写的人来，让这一柜听听谁的句子进得来、谁的不进。",
    choices: [
      {
        label: "一个一个念，谁写的谁签",
        when: [how("fangmin", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "compliance", delta: 4 }, { bond: ["fangmin", "player"], delta: 5 },
          { quality: "life:fangmin", set: 3 }, { quality: "life:fangmin:how", set: 1 },
        ],
        result: "{$a}念到自己那一行停了一下，说她这一行去年是抄别人的，今年划了重写，重写的这句她敢当人念。",
      },
      {
        label: "照流程走，这一柜不出面",
        when: [how("fangmin", 2)],
        effects: [
          { opinion: "$a", delta: 2 }, { stat: "compliance", delta: 2 },
          { quality: "life:fangmin", set: 3 }, { quality: "life:fangmin:how", set: 2 },
        ],
        result: "{$a}说这一柜不出面才对，去年就是有人替她出面，她那一句才写得进去；今年她要人自己站出来。",
      },
      {
        label: "这本归她，别拉着一层楼",
        when: [how("fangmin", 3)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "standing", delta: -1 },
          { quality: "life:fangmin", set: 3 }, { quality: "life:fangmin:how", set: 3 },
        ],
        result: "{$a}说这一层楼没人是被拉来的，都是听了三回自己要求的，说完她把那本递给旁边那位，让她自己念。",
      },
      {
        label: "先问她今年还认不认那句原话",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["fangmin", "player"], delta: 4 },
          { quality: "life:fangmin", set: 3 }, { quality: "life:fangmin:how", set: 1 },
        ],
        result: "{$a}说认，只是如今她把那句念给自己听，不再拿去替谁补一个缺口，这两样她分得很清楚。",
      },
    ],
  },

  // —— 乔晚：她那句被写进培训册 ——
  {
    id: "life3-qiaowan",
    kind: "arc",
    cast: { a: qiaowan },
    when: [{ season: { gte: 7 } }, { quality: "arc:qiaowan:end", gte: 1 }, { quality: "life:qiaowan", eq: 2 }],
    weight: 27, tension: 1, cooldown: 28,
    text: "{$a}手里拿的是楼上的培训册，翻到有一行她的字那一页。她说那一句是她改了三回的那句，如今印成一整层人照着念，她来问要不要署她的名。",
    choices: [
      {
        label: "署，当着那孩子念一遍",
        when: [how("qiaowan", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }, { bond: ["qiaowan", "player"], delta: 5 },
          { quality: "life:qiaowan", set: 3 }, { quality: "life:qiaowan:how", set: 1 },
        ],
        result: "{$a}说自己那一行改了三回才敢当自己的用，如今印在纸上还被别人念，她先愣住了，愣完才点头。",
      },
      {
        label: "不署，谁用都一样",
        when: [how("qiaowan", 2)],
        effects: [
          { opinion: "$a", delta: 1 },
          { quality: "life:qiaowan", set: 3 }, { quality: "life:qiaowan:how", set: 2 },
        ],
        result: "{$a}说不署也行，只是她怕的是别人照着念却不问客人那句真不真，去年她就是被人这样念坏的。",
      },
      {
        label: "那一页撤下来，别进册子",
        when: [how("qiaowan", 3)],
        effects: [
          { opinion: "$a", delta: -4 }, { stat: "compliance", delta: 1 },
          { quality: "life:qiaowan", set: 3 }, { quality: "life:qiaowan:how", set: 3 },
        ],
        result: "{$a}说撤就撤，她那句本来也不是为进册子改的，说完把那一页折了个角，没撕，又放回柜面上。",
      },
      {
        label: "先问她如今还站白班不",
        effects: [
          { opinion: "$a", delta: 4 }, { bond: ["qiaowan", "player"], delta: 4 },
          { quality: "life:qiaowan", set: 3 }, { quality: "life:qiaowan:how", set: 1 },
        ],
        result: "{$a}说站，还站三天，多出来的那两天是她自己加的，说印在纸上的句子她得亲自去验一遍灵不灵。",
      },
    ],
  },

  // —— 宋姐：她今年替妈妈问一句 ——
  {
    id: "life3-songjie",
    kind: "arc",
    cast: { a: songjie },
    when: [{ season: { gte: 7 } }, { quality: "arc:songjie:end", gte: 1 }, { quality: "life:songjie", eq: 2 }],
    weight: 27, tension: 0, cooldown: 28,
    text: "{$a}今天把手机留在包里没拿出来。她说那个群早沉下去了，如今她只问自家人要什么，这一趟是替她妈来问的，问完还要给自己留一支。",
    choices: [
      {
        label: "两张单子一起对，先对老人的",
        when: [how("songjie", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["songjie", "player"], delta: 5 },
          { quality: "life:songjie", set: 3 }, { quality: "life:songjie:how", set: 1 },
        ],
        result: "{$a}说她妈那一行她写得比谁细，到自己那一行反倒空着，写到这里她把笔停了一下，说空着也得写上去。",
      },
      {
        label: "按她自己的份开，老人的另说",
        when: [how("songjie", 2)],
        effects: [
          { opinion: "$a", delta: 3 }, { stat: "standing", delta: 1 },
          { quality: "life:songjie", set: 3 }, { quality: "life:songjie:how", set: 2 },
        ],
        result: "{$a}说这几年她替别人问了几百句，如今轮到她把自己那一行放在最前头一次，说完她先把自己的报了。",
      },
      {
        label: "这一柜不替她妈开单",
        when: [how("songjie", 3)],
        effects: [
          { opinion: "$a", delta: -3 },
          { quality: "life:songjie", set: 3 }, { quality: "life:songjie:how", set: 3 },
        ],
        result: "{$a}说好，那她妈那一行她自己回去想办法，今天只办她这一支，办完站起来那一下比往年松。",
      },
      {
        label: "问那个群后来怎么样了",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["songjie", "player"], delta: 4 },
          { quality: "life:songjie", set: 3 }, { quality: "life:songjie:how", set: 1 },
        ],
        result: "{$a}说群还在，她退了一半的接龙，剩下那几个是真要用的，这几年她第一次算清了自己赔进去的时间。",
      },
    ],
  },

  // —— 白姐：今年她坐上镜前那一侧 ——
  {
    id: "life3-baijie",
    kind: "arc",
    cast: { a: baijie },
    when: [{ season: { gte: 7 } }, { quality: "arc:baijie:end", gte: 1 }, { quality: "life:baijie", eq: 2 }],
    weight: 27, tension: -1, cooldown: 28,
    text: "{$a}今天坐在镜前不动手。她说徒弟自己开台了，工具包归那孩子，她今年头一回是被人化那一个，坐着不知手该往哪儿放。",
    choices: [
      {
        label: "把她的手也请上那一台",
        when: [how("baijie", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { bond: ["baijie", "player"], delta: 5 }, { bond: ["baijie", "anjie"], delta: 3 },
          { quality: "life:baijie", set: 3 }, { quality: "life:baijie:how", set: 1 },
        ],
        result: "{$a}说那孩子报色号比她当年准，她坐在旁边看了半年，今天想通了自己缺的不是手准，是肯坐着。",
      },
      {
        label: "按客人那一档给她排",
        when: [how("baijie", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:baijie", set: 3 }, { quality: "life:baijie:how", set: 2 },
        ],
        result: "{$a}说这一档她生疏，被人问要哪种她答了半天，末了反问这一柜去年给她的也是这一档吗，问完自己摇头。",
      },
      {
        label: "那一台归徒弟，与她无关",
        when: [how("baijie", 3)],
        effects: [
          { opinion: "$a", delta: -3 },
          { quality: "life:baijie", set: 3 }, { quality: "life:baijie:how", set: 3 },
        ],
        result: "{$a}说本来就没她的份，她今天只想坐一次那把椅子，坐完就走，不指点也不挑错，这句她说得硬。",
      },
      {
        label: "问她今年还想不想上台",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["baijie", "player"], delta: 4 },
          { quality: "life:baijie", set: 3 }, { quality: "life:baijie:how", set: 1 },
        ],
        result: "{$a}说想，不过她想上台的是给自己那张脸，替别人遮了这些年，如今她只想被一个人认真对待一次。",
      },
    ],
  },

  // —— 裴岚：那一页抄满了，她来要回自己那一行 ——
  {
    id: "life3-peilan",
    kind: "arc",
    cast: { a: peilan },
    when: [{ season: { gte: 7 } }, { quality: "arc:peilan:end", gte: 1 }, { quality: "life:peilan", eq: 2 }],
    weight: 27, tension: 1, cooldown: 28,
    text: "{$a}把那一页抄满的表带来，摊在柜面上指着最底下那行。她说这一行是她去年留白的，如今这层楼都签了，只差她这一行，她今天来是要写还是空着。",
    choices: [
      {
        label: "写，写她自己站过的那两个柜",
        when: [how("peilan", 1)],
        effects: [
          { opinion: "$a", delta: 6 }, { stat: "standing", delta: 2 }, { bond: ["peilan", "player"], delta: 5 },
          { quality: "life:peilan", set: 3 }, { quality: "life:peilan:how", set: 1 },
        ],
        result: "{$a}写完把那支旧口红从兜里摸出来压在纸上，说这一支早停产了，留着不是要用，是提醒自己曾经站过柜。",
      },
      {
        label: "空着也算答复，不用补",
        when: [how("peilan", 2)],
        effects: [
          { opinion: "$a", delta: 2 },
          { quality: "life:peilan", set: 3 }, { quality: "life:peilan:how", set: 2 },
        ],
        result: "{$a}说空着这两年她被人问过四回，每一回她都说再看看，今天这句不用补，她反倒点头点得很快。",
      },
      {
        label: "那一页本来就不归她签",
        when: [how("peilan", 3)],
        effects: [
          { opinion: "$a", delta: -5 }, { stat: "standing", delta: -1 },
          { quality: "life:peilan", set: 3 }, { quality: "life:peilan:how", set: 3 },
        ],
        result: "{$a}说这一句去年她也听过，今年她不争了，把纸推回去，站了一会儿才走，走到门口回头看了那面镜一眼。",
      },
      {
        label: "问她那三天是怎么排出来的",
        effects: [
          { opinion: "$a", delta: 5 }, { bond: ["peilan", "player"], delta: 4 },
          { quality: "life:peilan", set: 3 }, { quality: "life:peilan:how", set: 1 },
        ],
        result: "{$a}说从两天加到三天，多那一天不为数，为她一坐下就听不见真话，这一条她这两年越信越深。",
      },
    ],
  },
];

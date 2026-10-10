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
// 本轮名册（8 条第 5 季 + 3 条第 6 季）：写死的名单在 tests/world-content.test.ts 里钉着，
// 补人要在名单上选边，不许悄悄加。剩下的 12 条（赵女士、尹小姐、段小姐、赵宁、唐可、罗曼、方敏、
// 乔晚、宋姐、白姐、裴岚、梁夏）里，最后四条的落点在第 4 季末，第 5 季才第一次走得完。
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
];

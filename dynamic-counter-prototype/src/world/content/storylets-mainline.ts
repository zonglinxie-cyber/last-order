// 主线第 1 幕「一张署了别人名字的单子」→ 第 2 幕「名字在谁手里」→ 第 3 幕「那一行是谁的手写的」
// → 第 4 幕「谁在写单子」。
// 第 3 幕只在第 3 季以后开（幕号抬到 3 就锁死第 2 幕那三张收法，所以开头那张压到第 10 天）；
// 第 2 季那一段由 main-a2-* 三张接着演 —— 它们不抬幕号，只把第 3 幕要用的线索提前摆上本子；
// 第 4 季那一段先由 main-a4-page 一张收：第 3 幕说完「那一行是谁的手写的」，它问「是谁每季都要那一页」；
// 再由第 4 幕那三张（main-a4-who / -desk / -valve）答这一句：那一栏不挑人，只挑当时顶班的那个号 —— 也就是玩家自己。
// 悬念用的是人物圣经里已经埋下的四条秘密（沈薇的退货单、宋姐群里借出去的名字、
// 尹小姐包带里的录音笔、方敏按住不念的那一行）。翻面的每一个落点都必须先有本子上的
// 线索才按得出来 —— 反转不许凭空掉下来的这条，由 tests/world-content.test.ts 钉住。
// 幕号走 quality「mainline:act」，落点走 quality「thread:return-slip」，文案在 content/clues.ts。
import type { Storylet } from "../types.ts";

const ACT = (eq: number) => ({ quality: "mainline:act", eq } as const);
const OPEN = { not: { quality: "thread:return-slip", gte: 1 } } as const;
/** 这一栏还没有玩家自己落过的名（落点 7/8/9 = 第 3 幕那三张已经收过尾）。 */
const NOT_OWNED = { not: { quality: "thread:return-slip", gte: 7 } } as const;
/** `once` 挡不住跨季重演：nextSeason 把 fired 整份清空（engine.ts:1227），而 mainline:act 和
 *  thread:return-slip 都带着过季 —— 门槛一直成立的收法卡会在每一季把同一句话原样演一遍。
 *  所以每张会跨季重演的卡自己留一个带得过季的记号（`mainline:` 前缀在过季白名单里）。 */
const SEEN = (id: string) => ({ not: { quality: `mainline:seen:${id}`, gte: 1 } } as const);
const MARK = (id: string) => ({ quality: `mainline:seen:${id}`, set: 1 } as const);

export const STORYLETS_MAINLINE: Storylet[] = [
  {
    id: "main-slip-open",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] } },
    when: [ACT(0), { day: { gte: 4 } }, { present: "fangmin" }],
    weight: 32,
    tension: 1,
    once: true,
    text: "{$a}把一张退货单压在镜边。名字那一栏写的是沈薇，退款已经进了柜位的账。她只问一句：这张脸你接没接过。",
    choices: [
      {
        label: "照实说：这季没来接过这张脸",
        effects: [
          { quality: "mainline:act", set: 1 },
          { remember: { holder: "fangmin", act: "same-as-record", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 4 },
          { stat: "compliance", delta: 3 },
        ],
        result: "{$a}在单子角上写了一个「问」。这一页今天翻不过去，但它留在柜上了。",
      },
      {
        label: "先问这单是哪一天进来的",
        effects: [
          { quality: "mainline:act", set: 1 },
          { clue: "slip-hand" },
          { remember: { holder: "fangmin", act: "slip-asked-date", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 2 },
        ],
        result: "日期比她那一单晚三天。{$a}把这一行指给你看，什么都没说。你把日子记在本子上。",
      },
      {
        label: "说这单也许是别处退的",
        effects: [
          { quality: "mainline:act", set: 1 },
          { remember: { holder: "fangmin", act: "slip-punted", valence: -2, subject: "player" } },
          { opinion: "fangmin", delta: -5 },
          { opinion: "shen", delta: -6 },
          { stat: "compliance", delta: -6 },
        ],
        result: "{$a}把那张纸收回档案袋，没有再问第二遍。名字没落在你身上，落在了还没开口的人身上。",
      },
    ],
  },
  {
    id: "main-slip-shen",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] } },
    when: [
      ACT(1), OPEN, { present: "shen" }, { day: { gte: 6 } },
      { any: [{ knowsSecret: "shen" }, { quality: "arc:shen", gte: 1 }, { clue: "slip-gap" }, { clue: "slip-borrowed" }] },
    ],
    weight: 26,
    tension: 0,
    once: true,
    text: "{$a}看见镜边那张单子的复印件。她停了停，问你那一栏的字是谁写的。这句话她没打算当着别人问。",
    choices: [
      {
        label: "把日期指给她看",
        effects: [
          { clue: "slip-hand" },
          { remember: { holder: "shen", act: "not-my-return", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 6 },
        ],
        result: "她看完那三个笔画，说她那三天在别的城市。这句她留给你，不留给群里。",
      },
      {
        label: "让她自己去跟柜上说",
        effects: [
          { clue: "slip-hand" },
          { remember: { holder: "shen", act: "slip-not-mine", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 3 },
          { opinion: "fangmin", delta: -2 },
        ],
        result: "她说她自己会去。你不是她的嘴。日期你顺手记下了。",
      },
      {
        label: "替她把这一栏抄下来",
        effects: [
          { clue: "slip-hand" },
          { remember: { holder: "shen", act: "not-my-return", valence: 1, subject: "player" } },
          { bond: ["shen", "player"], kind: "client", set: 30 },
          { stat: "compliance", delta: -2 },
        ],
        result: "她说抄下来也没用，名字不在你手里。笔迹对上了，你多了一条不在档案里的东西。",
      },
    ],
  },
  {
    id: "main-slip-song",
    kind: "mainline",
    cast: { a: { id: "songjie", where: [] } },
    when: [
      ACT(1), OPEN, { present: "songjie" },
      // 每条线索卡都留着「拿着本子上已有那条再问下去」这条路：不认识她也能顺着问。
      { any: [{ knowsSecret: "songjie" }, { opinion: "songjie", gte: 15 }, { clue: "slip-hand" }, { clue: "slip-gap" }] },
    ],
    // 量过（80 副）：她 21% 的时段在场、门槛过 62%，两个都过的格子每副牌 5.6 个，weight 24 只讲到 38/80。
    // 门（个人线）只占这些格子的 23% —— 卡她的是两百多张牌的抽签，不是那扇门。十二副验收牌：24 → 7/12 副摸到三条以上。
    weight: 38,
    tension: 1,
    once: true,
    text: "{$a}在你跟前翻她的群。置顶那条是退货的截图，名字写的是沈薇。她抬头看你，等你先开口。",
    choices: [
      {
        label: "问这个名字是谁给的",
        effects: [
          { clue: "slip-borrowed" },
          { remember: { holder: "songjie", act: "slip-named-group", valence: -2, subject: "player" } },
          { opinion: "songjie", delta: -6 },
          { bond: ["songjie", "player"], delta: -10 },
        ],
        result: "她说名字是群里借的，货在群里转了一圈。这句话出了她的口，今晚就在别人的手机上。",
      },
      {
        label: "不说破，只把截图那行日子记下",
        effects: [
          { clue: "slip-borrowed" },
          { remember: { holder: "songjie", act: "slip-name-held", valence: 1, subject: "player" } },
          { opinion: "songjie", delta: 5 },
        ],
        result: "她松了一口气，把手机扣过去。你手里多了一条没被任何人念过的。",
      },
      {
        label: "让她把截图删了",
        effects: [
          { remember: { holder: "songjie", act: "slip-name-held", valence: -1, subject: "player" } },
          { opinion: "songjie", delta: -3 },
          { opinion: "shen", delta: 4 },
        ],
        result: "她笑着说删了也截过。你没拿到那条，倒是没把它变成你的。",
      },
    ],
  },
  {
    id: "main-slip-yin",
    kind: "mainline",
    cast: { a: { id: "yinxiaojie", where: [] } },
    when: [
      ACT(1), OPEN, { present: "yinxiaojie" },
      { any: [{ knowsSecret: "yinxiaojie" }, { remembers: "yinxiaojie", act: "hard-sell", valence: "bad" }, { clue: "slip-hand" }, { clue: "slip-borrowed" }] },
    ],
    // 同 main-slip-song：她在场少（原来 9% 的时段）、门槛过 56%，两个都过的格子每副牌只有 2.5 个，weight 22 讲到 23/80。
    // 在场那一边已经把她的工作日补了一格（people.ts），这一边把抽签的那一半补上。
    weight: 36,
    tension: 1,
    once: true,
    text: "{$a}把包搁在柜台上，包带没合。她问这支是不是两周就能看出来，语气跟上次一模一样。",
    choices: [
      {
        label: "只说备案里写得下的",
        effects: [
          { clue: "slip-tape" },
          { remember: { holder: "yinxiaojie", act: "claim-held", valence: 1, subject: "player" } },
          { opinion: "yinxiaojie", delta: 5 },
          { stat: "compliance", delta: 2 },
        ],
        result: "她「嗯」了一声。包带里那点红灯灭了，这一句她录不录都在你这边。",
      },
      {
        label: "把两周那句话说满",
        effects: [
          { clue: "slip-tape" },
          { remember: { holder: "yinxiaojie", act: "claim-full", valence: -2, subject: "player" } },
          { opinion: "yinxiaojie", delta: -10 },
          { stat: "compliance", delta: -6 },
        ],
        result: "她点头点得很慢。你后来才知道，那晚柜上多出来的那句话是从这条录音里出去的。",
      },
      {
        label: "问她包带里是不是还开着",
        effects: [
          { clue: "slip-tape" },
          { remember: { holder: "yinxiaojie", act: "slip-asked-tape", valence: -1, subject: "player" } },
          { opinion: "yinxiaojie", delta: -4 },
        ],
        result: "她把包拎回去，说她想录的是别家。这句话你不信，她也不信你信了。",
      },
    ],
  },
  {
    id: "main-slip-fang",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] } },
    when: [
      ACT(1), OPEN, { present: "fangmin" },
      { any: [{ knowsSecret: "fangmin" }, { remembers: "fangmin", act: "named-colleague", valence: "bad" }, { clue: "slip-hand" }, { clue: "slip-borrowed" }] },
    ],
    weight: 20,
    tension: 0,
    once: true,
    text: "{$a}从档案袋里抽出一张赠品领用表。缺口那一行有名字，她用手指按住，不念。",
    choices: [
      {
        label: "问这一行跟那张单子是不是同一件事",
        effects: [
          { clue: "slip-gap" },
          { clue: "slip-hand" },
          { remember: { holder: "fangmin", act: "slip-asked-gap", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 4 },
          { stat: "compliance", delta: 2 },
        ],
        result: "她把两张纸并排放在柜台上，没有念名字，也没有把日期挡住。你把这两个日子一起抄进本子。",
      },
      {
        label: "说缺口那事你认",
        effects: [
          { clue: "slip-gap" },
          { remember: { holder: "fangmin", act: "slip-owned-line", valence: 2, subject: "player" } },
          { opinion: "fangmin", delta: 6 },
          { stat: "compliance", delta: 5 },
          { stat: "standing", delta: -3 },
        ],
        result: "她把表推到你这边。认了的那一行今晚就进了档案，不再是一张纸。",
      },
      {
        label: "把手从表上收回来，不碰那一行",
        effects: [
          { remember: { holder: "fangmin", act: "slip-name-held", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: -2 },
        ],
        result: "她把表放回袋里。这一行今天没人念过，包括你。",
      },
    ],
  },
  {
    id: "main-slip-turn",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] }, b: { id: "fangmin", where: [], mustBePresent: false } },
    when: [
      ACT(1), OPEN, { present: "shen" }, { day: { gte: 12 } },
      { clue: "slip-hand" },
      { any: [{ clue: "slip-borrowed" }, { clue: "slip-tape" }] },
    ],
    weight: 36,
    tension: 1,
    once: true,
    // 翻面：第 1 季挂在柜位名下那笔退款，不是顾客反悔。
    // 正文只说本子上两条线索加起来那件事（日期差三天 + 名字在楼层外过了一遍手）：
    // 「群里借的名字」只有握着 slip-borrowed 的人才说得出，所以它挪到那颗选项的 when 上。
    text: "本子上那几条对到了一起：单子的日期差着三天，而这个名字在这层楼外面过了一遍手，落的是沈薇。{$a}站在镜子前，第一次没有把手机递给你。",
    choices: [
      {
        label: "把日期、笔迹和你自己那句一起交出去",
        effects: [
          { quality: "thread:return-slip", set: 1 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "fangmin", act: "slip-owned-line", valence: 2, subject: "player" } },
          { remember: { holder: "shen", act: "slip-owned-line", valence: 2, subject: "player" } },
          { remember: { holder: "songjie", act: "slip-named-group", valence: -2, subject: "player" } },
          { opinion: "fangmin", delta: 10 },
          { opinion: "shen", delta: 8 },
          { opinion: "songjie", delta: -8 },
          { stat: "compliance", delta: 8 },
          { stat: "standing", delta: 4 },
          { appoint: { person: "songjie", inDays: 2, slot: 2 } },
        ],
        result: "{$b}收下那几页，把你的原话排在最前面。柜位的数少了一笔，名字第一次写在「说清的人」那一栏。宋姐两天后会上楼来。",
      },
      {
        when: [{ clue: "slip-borrowed" }],
        label: "只说名字是从群里借的",
        effects: [
          { quality: "thread:return-slip", set: 2 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "songjie", act: "slip-named-group", valence: -2, subject: "player" } },
          { remember: { holder: "fangmin", act: "slip-named-group", valence: 1, subject: "player" } },
          { opinion: "songjie", delta: -14 },
          { opinion: "shen", delta: 4 },
          { opinion: "fangmin", delta: 2 },
          { bond: ["songjie", "player"], kind: "client", set: -25 },
          { stat: "compliance", delta: 3 },
        ],
        result: "名字出了口。{$a}没有谢你，她说那句「不会再帮你带货」原来不是对她自己说的。群里今晚少了一个人，柜上多了一个知道你怎么用名字的人。",
      },
      {
        label: "等档案自己走到台面上，今天不开口",
        effects: [
          { quality: "thread:return-slip", set: 3 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "shen", act: "slip-waited", valence: -1, subject: "player" } },
          { remember: { holder: "fangmin", act: "slip-waited", valence: -1, subject: "player" } },
          { opinion: "shen", delta: -5 },
          { opinion: "fangmin", delta: -6 },
          { stat: "compliance", delta: -4 },
        ],
        result: "你把本子合上。{$a}替你挡过一次，你没告诉她你知道。这一页没有人写过，它就一直挂在这面镜子前。",
      },
      {
        when: [{ not: { knowsSecret: "shen" } }],
        label: "这单就是沈薇退的",
        effects: [
          { quality: "thread:return-slip", set: 4 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "fangmin", act: "slip-punted", valence: -2, subject: "player" } },
          { remember: { holder: "shen", act: "slip-punted", valence: -2, subject: "player" } },
          { opinion: "shen", delta: -20 },
          { opinion: "fangmin", delta: -10 },
          { stat: "compliance", delta: -12 },
          { stat: "standing", delta: -6 },
        ],
        result: "本子上的日期和笔迹你一个字都没念。这句话进了档案，也进了{$a}的群。",
      },
      {
        when: [{ knowsSecret: "shen" }],
        label: "这单就是沈薇退的",
        effects: [
          { quality: "thread:return-slip", set: 4 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "fangmin", act: "slip-punted", valence: -2, subject: "player" } },
          { remember: { holder: "shen", act: "slip-punted", valence: -2, subject: "player" } },
          { opinion: "shen", delta: -22 },
          { opinion: "fangmin", delta: -12 },
          { stat: "compliance", delta: -12 },
          { stat: "standing", delta: -6 },
        ],
        result: "你问过那一栏是谁写的。现在你把这个名字又说了一遍。{$a}听完只说一句：那我以后不自己来。",
      },
    ],
  },
  {
    id: "main-slip-turn-desk",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] } },
    when: [
      ACT(1), OPEN, { present: "fangmin" }, { day: { gte: 18 } },
      { clue: "slip-hand" }, { clue: "slip-gap" },
      // 第三条路：本子上只有「日期」和「那一行」时也能翻面，而且不必等沈薇在场。
      // 沈薇一季只在 9.6% 的时段出现，逼着翻面卡也认她，实测三成种子只能落到收档阀门。
      // 日子压到第 18 天：这条是兜底那条，压太早会把「群里那条」「录音那条」的空窗抢掉
      // （第 12 天实测本子中位数从 3 条掉到 2 条，翻面提前=剩下的卡全被幕号关掉）。
      // 握着群里那条或录音那条的人走 main-slip-turn，那一句才说得出「名字是借的」。
      { not: { clue: "slip-borrowed" } }, { not: { clue: "slip-tape" } },
    ],
    weight: 34,
    tension: 1,
    once: true,
    text: "{$a}把赠品领用表摊在柜台上，缺口那一行的日期跟那张退货单并排摆着。她没有再问第二遍，只是把笔放在两行中间。",
    choices: [
      {
        label: "把日期、笔迹和你自己那句一起交出去",
        effects: [
          { quality: "thread:return-slip", set: 1 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "fangmin", act: "slip-owned-line", valence: 2, subject: "player" } },
          { remember: { holder: "shen", act: "slip-owned-line", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 12 },
          { opinion: "shen", delta: 5 },
          { stat: "compliance", delta: 10 },
          { stat: "standing", delta: -2 },
          { appoint: { person: "tangke", inDays: 2, slot: 2 } },
        ],
        result: "{$a}把那一行誊成一份说明，署名是你。柜位的账一分没变，变的是这一行从此有名字。唐可两天后会被叫上楼对货。",
      },
      {
        label: "等档案自己走到台面上，今天不开口",
        effects: [
          { quality: "thread:return-slip", set: 3 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "fangmin", act: "slip-name-held", valence: -1, subject: "player" } },
          { opinion: "fangmin", delta: -8 },
          { stat: "compliance", delta: -6 },
        ],
        result: "她把表收回袋子里。这一行你看见了，她以为你没看见 —— 今晚这一层少了一个肯替你签名的人。",
      },
      {
        when: [{ not: { knowsSecret: "shen" } }],
        label: "这单就是沈薇退的",
        effects: [
          { quality: "thread:return-slip", set: 4 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "fangmin", act: "slip-punted", valence: -2, subject: "player" } },
          { opinion: "fangmin", delta: -14 },
          { opinion: "shen", delta: -18 },
          { stat: "compliance", delta: -15 },
          { stat: "standing", delta: -8 },
        ],
        result: "并排放着的就是她自己的日期。{$a}把表收回去，什么都没说，这一份沉默比写进档案还难办。",
      },
      {
        when: [{ knowsSecret: "shen" }],
        label: "这单就是沈薇退的",
        effects: [
          { quality: "thread:return-slip", set: 4 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "fangmin", act: "slip-punted", valence: -2, subject: "player" } },
          { remember: { holder: "shen", act: "slip-punted", valence: -2, subject: "player" } },
          { opinion: "fangmin", delta: -16 },
          { opinion: "shen", delta: -22 },
          { stat: "compliance", delta: -15 },
          { stat: "standing", delta: -8 },
        ],
        result: "你先问过那一栏是谁写的，现在你指着她的名字说了一遍。{$a}把两张纸分开收好，说以后这一行她自己核。",
      },
    ],
  },
  {
    id: "main-slip-filed",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] } },
    when: [ACT(1), OPEN, { present: "shen" }, { day: { gte: 24 } }],
    weight: 30,
    tension: -1,
    once: true,
    // 幕一不能卡死：一季快过完还没攒够线索，这条线就以「你没开口」收掉，
    // 本子上的那几条留在档案里，下一季还有人对得上号。
    // 但这一档必须是有代价的一档，不是白拿的兜底：她以后不把话带到你这面镜子前（client 关系掉到底），
    // 而这句话会传到方敏那一侧 —— 两处都是引擎里读得到的活状态，不是只扣一次性的分数。
    text: "{$a}进门没有看镜子。她说那张单子昨天并进了柜位的账，从今天起没人再问，也不用你答。",
    choices: [
      {
        label: "说好",
        effects: [
          { quality: "thread:return-slip", set: 5 },
          { quality: "mainline:act", set: 2 },
          { remember: { holder: "shen", act: "slip-waited", valence: -1, subject: "player" } },
          { remember: { holder: "fangmin", act: "slip-waited", valence: -1, subject: "player", heardFrom: "shen" } },
          { bond: ["shen", "player"], kind: "client", set: -25 },
          { opinion: "shen", delta: -4 },
        ],
        result: "她点头，走得比来时快。本子上那几条还在，只是今晚没有一句被说出来。往后她有别的去处。",
      },
      {
        label: "问她能不能再等一天",
        effects: [
          { quality: "thread:return-slip", set: 6 },
          { quality: "mainline:act", set: 2 },
          { stat: "standing", delta: -2 },
          { remember: { holder: "fangmin", act: "slip-waited", valence: -1, subject: "player" } },
          { opinion: "fangmin", delta: -3 },
        ],
        result: "她说等不等不归她定。你这句话没有传到人那里，柜位那一栏自己往下掉了一点。",
      },
    ],
  },
  {
    id: "main-slip-after-own",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] }, b: { id: "suman", where: [], mustBePresent: false } },
    when: [ACT(2), { quality: "thread:return-slip", eq: 1 }, { present: "fangmin" }],
    weight: 22,
    tension: -1,
    once: true,
    text: "{$a}把那张退货单从柜位名下抽出来，改成一句话的说明，署名是你。{$b}路过时看了一眼，没有停。",
    choices: [
      {
        label: "把说明的日期写清楚",
        effects: [
          { remember: { holder: "fangmin", act: "same-as-record", valence: 2, subject: "player" } },
          { opinion: "fangmin", delta: 6 },
          { stat: "compliance", delta: 4 },
          { stat: "standing", delta: 3 },
        ],
        result: "她说这一份可以摊在桌上给人看。数少了那一笔，柜上今晚没有人替你说话，也没有人踩你。",
      },
      {
        label: "问她下一个缺口是谁的",
        effects: [
          { clue: "slip-gap" },
          { remember: { holder: "fangmin", act: "slip-asked-gap", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: -2 },
        ],
        result: "她说：你刚交完一份，就要下一份？这一行她还是没念，但你手里多了一条。",
      },
    ],
  },
  {
    id: "main-slip-after-name",
    kind: "mainline",
    cast: { a: { id: "songjie", where: [] } },
    when: [ACT(2), { quality: "thread:return-slip", eq: 2 }, { present: "songjie" }],
    weight: 24,
    tension: 1,
    once: true,
    text: "{$a}上楼来了。她把手机屏幕朝下扣在柜台上，问你：群里那句话，是不是你放的。",
    choices: [
      {
        label: "说是你说的",
        effects: [
          { remember: { holder: "songjie", act: "slip-named-group", valence: -2, subject: "player" } },
          { opinion: "songjie", delta: -12 },
          { bond: ["songjie", "player"], kind: "rival", set: -40 },
          { stat: "standing", delta: -4 },
        ],
        result: "她说她以后不在这层楼问任何人。这句话今晚就传出去了，用的是你的名字。",
      },
      {
        label: "说是档案里本来就有",
        effects: [
          { remember: { holder: "songjie", act: "slip-waited", valence: -1, subject: "player" } },
          { remember: { holder: "fangmin", act: "slip-name-held", valence: -1, subject: "player", heardFrom: "songjie" } },
          { opinion: "songjie", delta: -4 },
          { stat: "compliance", delta: -3 },
        ],
        result: "她笑了一下：原来你的名字也会挪地方。她没有再问第二次。",
      },
      {
        label: "把自己的名字给她看",
        effects: [
          { remember: { holder: "songjie", act: "slip-owned-line", valence: 1, subject: "player" } },
          { opinion: "songjie", delta: 8 },
          { bond: ["songjie", "player"], kind: "client", set: 10 },
          { stat: "standing", delta: -2 },
        ],
        result: "她说：行，那你欠我一句道歉，不欠她们。这一条她记下，也还你一条。",
      },
    ],
  },
  {
    id: "main-slip-after-quiet",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] } },
    when: [ACT(2), { quality: "thread:return-slip", gte: 3 }, { present: "shen" }],
    weight: 22,
    tension: 0,
    once: true,
    text: "{$a}又来了，还是一个人。她看镜子的时间比看你长。她说她想问一句：那张单子，后来在你这儿算谁的。",
    choices: [
      {
        label: "说算柜上的",
        effects: [
          { remember: { holder: "shen", act: "slip-waited", valence: -1, subject: "player" } },
          { opinion: "shen", delta: -5 },
        ],
        result: "她说柜上是个什么地方：谁都不在里面。团队那句她还是没有收，只是往后推。",
      },
      {
        label: "把本子上的几条念给她",
        effects: [
          { remember: { holder: "shen", act: "slip-not-mine", valence: 2, subject: "player" } },
          { opinion: "shen", delta: 10 },
          { stat: "standing", delta: 2 },
          { appoint: { person: "miduo", inDays: 2, slot: 2 } },
        ],
        result: "她听完只说：你留着这些，却一直没开口。她把日期拿走了，下一场灯的事她自己安排。",
      },
      {
        label: "说这一句现在说不说都一样",
        effects: [
          { remember: { holder: "shen", act: "slip-punted", valence: -2, subject: "player" } },
          { opinion: "shen", delta: -10 },
          { bond: ["shen", "player"], kind: "client", set: -20 },
        ],
        result: "她点头，说这确实是她们的相处方式。出门时她没有回头。",
      },
    ],
  },

  // —— 第 3 幕「那一行是谁的手写的」——
  // 前两幕答的是名字：单子上写的是沈薇，名字是宋姐在群里借的，方敏按住了领用表那一行。
  // 第 3 幕答的是那只手 —— 而且答案早就写在牌堆里：clue「slip-tape」那句是"录进去的是你的原话，
  // 不是别人的"，clue「slip-hand」那句是"那三天她没上过这层楼"。把这两条并起来只有一件事说得通：
  // 那三天站柜的是玩家自己。反转不许凭空掉下来这条，由 tests/world-clues.test.ts 钉住 ——
  // 拧线的卡必须认本子里的线索，只有第 24 天以后那张阀门可以什么都不认。
  // 幕号 eq 3 一抬起来，上面第 2 幕那三张收法（eq 2）就整体退场，所以开头那张压到第 10 天以后，
  // 给第 3 季头几天留一段还能补上第 2 幕收法的空窗。
  {
    id: "main-act3-open",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] } },
    when: [ACT(2), { season: { gte: 3 } }, { day: { gte: 10 } }, { present: "fangmin" }],
    weight: 34,
    tension: 1,
    once: true,
    text: "{$a}把领用表翻到那一页，页脚折了一道。她说要这一页原件的人不是她，是查台账的。她把笔搁在纸上，只多说一句：这一行的字，你认得。",
    choices: [
      {
        label: "把那几天的排班也调出来",
        effects: [
          { clue: "slip-roster" },
          { quality: "mainline:act", set: 3 },
          { remember: { holder: "fangmin", act: "act3-asked-roster", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 4 },
        ],
        result: "那三天柜上写的是你的签到号。{$a}看了一眼那张排班，没有念出声。",
      },
      {
        label: "问她这一页你按了几季",
        effects: [
          { clue: "slip-gap" },
          { quality: "mainline:act", set: 3 },
          { remember: { holder: "fangmin", act: "act3-asked-held", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 2 },
          { stat: "compliance", delta: 1 },
        ],
        result: "「从你接手那一季。」她把页脚折回去，「我不是要护谁。我在等谁自己念。」",
      },
    ],
  },
  {
    id: "main-act3-row",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] }, b: { id: "shen", where: [], mustBePresent: false } },
    when: [
      ACT(3), { present: "fangmin" },
      { any: [{ clue: "slip-roster" }, { clue: "slip-gap" }] },
    ],
    weight: 38,
    tension: 1,
    once: true,
    text: "那一行不是宋姐群里那句话，也不是{$b}的笔。领出去、退回来、进台账，三步都落在同一页上 —— 那页是你顶班那几天。{$a}把笔压在纸上推过来：这一行谁写的，眼下只有你我知道。",
    choices: [
      {
        label: "把自己的名字写回那一行",
        effects: [
          { quality: "thread:return-slip", set: 7 },
          { remember: { holder: "fangmin", act: "act3-own-name", valence: 2, subject: "player" } },
          { remember: { holder: "shen", act: "act3-name-cleared", valence: 2, subject: "player", heardFrom: "fangmin" } },
          { opinion: "fangmin", delta: 10 },
          { opinion: "shen", delta: 8 },
          { bond: ["fangmin", "player"], kind: "friend", set: 55 },
          { stat: "compliance", delta: 12 },
          { stat: "standing", delta: -5 },
        ],
        result: "你写得很慢，写完把纸转给她。{$a}收进文件夹最上面那一层：这一页今晚摊得开。柜位的数少了一笔，少的正好是你名字那一笔。",
      },
      {
        label: "让这一页停在柜位名下",
        effects: [
          { quality: "thread:return-slip", set: 8 },
          { remember: { holder: "fangmin", act: "act3-row-buried", valence: -1, subject: "player" } },
          { opinion: "fangmin", delta: -6 },
          { bond: ["fangmin", "player"], kind: "friend", set: 40 },
          { stat: "compliance", delta: -10 },
          { stat: "standing", delta: 4 },
        ],
        result: "她把纸收回袋里，动作跟按住它的那几季一模一样。从今晚起，按住这一行的成了两个人。",
      },
      {
        when: [{ present: "shen" }],
        label: "把纸带去问沈薇本人",
        effects: [
          { remember: { holder: "shen", act: "act3-asked-herself", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 3 },
          { stat: "compliance", delta: -1 },
          { appoint: { person: "shen", inDays: 1, slot: 1 } },
        ],
        result: "她没看那行字，只问你：这单是我退的吗，你说是就是。你把纸折起来 —— 还没到人那里，也没到桌上。",
      },
    ],
  },
  {
    id: "main-act3-tape",
    kind: "mainline",
    cast: { a: { id: "yinxiaojie", where: [] } },
    when: [ACT(3), { present: "yinxiaojie" }, { clue: "slip-tape" }],
    weight: 32,
    tension: 1,
    once: true,
    // 只有握着录音那条的人才看得见这一幕最硬的一档：那支笔里存的是玩家自己开口的原话，
    // 所以「让原话进台账」这条路必须用 slip-tape 换，不是谁都能按。
    text: "{$a}把包带里那支笔搁在柜面上，笔灯还亮着。她说她要的从来不是那支护手霜，是那句原话。她问你：这一段进不进台账。",
    choices: [
      {
        label: "让她把那句原话交进台账",
        effects: [
          { quality: "thread:return-slip", set: 9 },
          { remember: { holder: "yinxiaojie", act: "act3-tape-filed", valence: 2, subject: "player" } },
          { remember: { holder: "fangmin", act: "act3-tape-filed", valence: 1, subject: "player", heardFrom: "yinxiaojie" } },
          { opinion: "yinxiaojie", delta: 14 },
          { opinion: "fangmin", delta: 4 },
          { stat: "compliance", delta: 16 },
          { stat: "standing", delta: -9 },
        ],
        result: "录进去那句是你的声音，报的是那天的班次。{$a}听完只说一句：原来是你。台账核对那一栏第一次写着你的名字，柜位跟着掉了一格。",
      },
      {
        label: "请她先把笔收回去",
        effects: [
          { remember: { holder: "yinxiaojie", act: "act3-tape-kept", valence: -1, subject: "player" } },
          { opinion: "yinxiaojie", delta: -7 },
          { stat: "compliance", delta: 2 },
          { stat: "standing", delta: 3 },
        ],
        result: "她把它收回包带，说这支笔她留着，留着不是为了你。这一页还在你手上，可你今晚睡得着。",
      },
    ],
  },
  {
    id: "main-act3-signed",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] }, b: { id: "fangmin", where: [], mustBePresent: false } },
    when: [ACT(3), { present: "shen" }, { day: { gte: 24 } }, NOT_OWNED],
    weight: 30,
    tension: -1,
    once: true,
    // 第 3 幕的阀门：幕号抬到 3 却没收过尾的人，在第 24 天以后由这张收掉，
    // 免得这条线永远挂在牌堆里占着一次抽签。它不认本子，所以日子必须压到 20 天以后。
    // NOT_OWNED 这一道不是防刷：落点 7/8/9 是玩家自己那一栏已经签过名（把自己写回那一行、
    // 压进柜位名下、交原话进台账），阀门再落一次就把玩家挣到的那一档盖掉，
    // 季末回顾会念出一句他没做过的话。跟第 1 幕那张阀门认 OPEN 是同一个规矩。
    text: "{$a}自己带了张纸来。她说账已经并完，最后一天没人再翻这一页。她把笔尖朝你这边搁下：那一栏你可以签，也可以不签。",
    choices: [
      {
        label: "由她把这一行认下来",
        effects: [
          { quality: "thread:return-slip", set: 10 },
          { remember: { holder: "shen", act: "act3-she-signed", valence: -1, subject: "player" } },
          { remember: { holder: "fangmin", act: "act3-she-signed", valence: -2, subject: "player", heardFrom: "shen" } },
          { opinion: "shen", delta: -12 },
          { opinion: "fangmin", delta: -8 },
          { bond: ["shen", "player"], kind: "client", set: -30 },
          { stat: "compliance", delta: 2 },
          { stat: "standing", delta: 3 },
        ],
        result: "她签得比你快。{$b}在旁边看着，一句话没说。这一页从此是她的一张纸，不是你本子上一条记过的事。",
      },
      {
        label: "谁都别签这一栏",
        effects: [
          { quality: "thread:return-slip", set: 11 },
          { remember: { holder: "shen", act: "act3-nobody-signed", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 4 },
          { stat: "compliance", delta: -5 },
        ],
        result: "你说这一栏谁都不必写。她把纸折好收进口袋，走到门口回头说一句：那这一页就永远没人写过。",
      },
    ],
  },

  // —— 第 2 幕与第 3 幕之间的那一季 ——
  // 上面三张收法演完，幕号还是 2，而唯一抬幕号的那张压在第 3 季第 10 天。探针量到中间空了 46 天：
  // 玩家在第 1 季就知道"单子上是别人的名字"，然后要等一整个季度才等到下一句。
  // 这三张填那一段 —— 都不抬幕号（第 3 幕仍由 main-act3-open 开），但把第 3 幕要用、
  // 也要反证的那几条线索（slip-gap / slip-tape / slip-hand / slip-borrowed）提前一年摆到本子上，
  // 并把「那一行是谁按下来的」这个反转放在玩家自己开口问的那一格。
  {
    id: "main-a2-audit",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] } },
    when: [ACT(2), { season: { gte: 2 } }, { day: { gte: 6 } }, { present: "fangmin" }],
    weight: 30,
    tension: 1,
    once: true,
    text: "{$a}把一张年检单摊在柜台上，说要上一季那张退货单的原件，查台账的人就在楼下等。她把笔尖压在签名那一栏，没有抬眼。",
    choices: [
      {
        label: "给她原件，自己抄一份",
        effects: [
          { clue: "slip-gap" },
          { remember: { holder: "fangmin", act: "act2-copied-line", valence: 1, subject: "player" } },
          { stat: "compliance", delta: 5 },
          { opinion: "fangmin", delta: 3 },
        ],
        result: "她抄得比你快，快到你来得及看清：领用表那一行和单子上的落款，起笔是同一个手势。原件下去了，你手里剩一份副本。",
      },
      {
        label: "问她这一行为什么按到今年",
        effects: [
          { clue: "slip-borrowed" },
          { remember: { holder: "fangmin", act: "act2-admitted-held", valence: 2, subject: "player" } },
          { stat: "standing", delta: 2 },
          { opinion: "fangmin", delta: -3 },
        ],
        result: "她隔了一会儿才答：按下来就不用问是谁的手。这一行是她自己按的，不是台账要按 —— 楼下那个人今天看不到这一页。",
      },
      {
        label: "说单子早并进柜位账了",
        effects: [
          { remember: { holder: "fangmin", act: "act2-slip-fled", valence: -1, subject: "player" } },
          { stat: "compliance", delta: -2 },
          { opinion: "fangmin", delta: -4 },
        ],
        result: "她说年检不认柜位账，只认那张纸。年检单留在柜台上，她明早再来拿一次。",
      },
    ],
  },
  {
    id: "main-a2-tape",
    kind: "mainline",
    cast: { a: { id: "yinxiaojie", where: [] } },
    when: [ACT(2), { season: { gte: 2 } }, { day: { gte: 8 } }, { present: "yinxiaojie" }],
    weight: 26,
    tension: 1,
    once: true,
    text: "{$a}坐在老位置，包带里没有露出那支录音笔。她说上一季被剪进群里的那句话，她留的是完整的一段。",
    choices: [
      {
        label: "听完整的那段",
        effects: [
          { clue: "slip-tape" },
          { remember: { holder: "yinxiaojie", act: "act2-tape-whole", valence: 1, subject: "player" } },
          { opinion: "yinxiaojie", delta: 6 },
        ],
        result: "完整那段里先开口报名字的不是她。你听清了那句是在谁走了之后才补上的 —— 补的那个人声音你很熟。",
      },
      {
        label: "问她为什么留到现在",
        effects: [
          { clue: "slip-hand" },
          { remember: { holder: "yinxiaojie", act: "act2-tape-why", valence: 1, subject: "player" } },
          { stat: "standing", delta: -1 },
          { opinion: "yinxiaojie", delta: 2 },
        ],
        result: "她说：因为没人问过我。她把笔推过来一寸，说那三天柜上站的是谁，她自己也没查出来。",
      },
      {
        label: "劝她别把这东西拿出来",
        effects: [
          { remember: { holder: "yinxiaojie", act: "act2-tape-hushed", valence: -2, subject: "player" } },
          { stat: "compliance", delta: 2 },
          { opinion: "yinxiaojie", delta: -8 },
        ],
        result: "她把笔收回包带最里面，说这一句她本来就只打算问一次。",
      },
    ],
  },
  {
    id: "main-a2-mirror",
    kind: "mainline",
    cast: { a: { id: "luyao", where: [] } },
    when: [ACT(2), { season: { gte: 2 } }, { present: "luyao" }],
    weight: 28,
    tension: 1,
    once: true,
    text: "{$a}把一张复印的退货单压在你这面柜台的边角，说对面也有一张，落款是同一个名字。她问换不换：她那边的日期，换你这边的字。",
    choices: [
      {
        label: "换",
        effects: [
          { clue: "slip-gap" },
          { remember: { holder: "luyao", act: "act2-traded-slip", valence: 1, subject: "player" } },
          { bond: ["luyao", "player"], delta: 8 },
          { stat: "money", delta: -300 },
        ],
        result: "她把复印件推过来，日期那一格是空的。你说这一张不值三千，她说：值，因为你手里那张也没写日期。",
      },
      {
        label: "问她对面这张是谁给的",
        effects: [
          { clue: "slip-borrowed" },
          { remember: { holder: "luyao", act: "act2-asked-source", valence: 2, subject: "player" } },
          { opinion: "luyao", delta: -4 },
          { stat: "standing", delta: 2 },
        ],
        result: "她说这层楼给过她单子的人不止一个，名字她不念。她把复印件抽回去：那你自己去对那两个字。",
      },
      {
        label: "把自己的那张拿出来给她看",
        effects: [
          { clue: "slip-hand" },
          { remember: { holder: "luyao", act: "act2-showed-own", valence: 1, subject: "player" } },
          { bond: ["luyao", "player"], delta: 12 },
          { stat: "standing", delta: -3 },
        ],
        result: "她看了三秒，说你这张的字和领用表那一行是同一只手。她把复印件留在柜台上，没有带走。",
      },
    ],
  },
  {
    id: "main-a4-page",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] } },
    when: [{ quality: "mainline:act", gte: 2 }, { season: { gte: 4 } }, { day: { gte: 5 } }, { present: "fangmin" }],
    weight: 30,
    tension: 1,
    once: true,
    text: "{$a}把一张抄件放在柜面上，日期写的是这一季。她说区域每季跟她要那一页的抄件，四季了，抄件上一直有那一行 —— 按住的是她，要抄件的不是你。",
    choices: [
      {
        label: "这一季的抄件由你柜上签",
        effects: [
          { clue: "slip-gap" },
          { remember: { holder: "fangmin", act: "act4-signed-copy", valence: 2, subject: "player" } },
          { opinion: "fangmin", delta: 5 },
          { stat: "compliance", delta: 4 },
        ],
        result: "你签的是那一行原本就在表上的这一季。{$a}说这一签之后她不用再一个人按着，也没有说这一签省下的是谁。",
      },
      {
        label: "问那一页每季是谁要的",
        when: [{ any: [{ clue: "slip-roster" }, { quality: "arc:peilan", gte: 1 }] }],
        effects: [
          { clue: "slip-roster" },
          { remember: { holder: "fangmin", act: "act4-quarter-known", valence: 2, subject: "player" } },
          { opinion: "fangmin", delta: -2 },
          { stat: "standing", delta: 3 },
        ],
        result: "{$a}报了裴岚的工号，不是名字。她说这一行不上表是四季里每一季都要的事，要的人从不进柜。",
      },
      {
        label: "把抄件烧了",
        effects: [
          { remember: { holder: "fangmin", act: "act4-copy-burned", valence: -2, subject: "player" } },
          { opinion: "fangmin", delta: -6 },
          { stat: "compliance", delta: -7 },
        ],
        result: "{$a}看着纸角烧起来，没有抢。她说下一季的抄件她会照抄，只是那一行她不再自己写。",
      },
    ],
  },

  // —— 第 4 幕：谁在写单子 ——
  // 前三幕答的是「这单是谁退的」「名字在谁手里」「那一行是谁的手写的」，问的都是这一层楼里的人。
  // 第 4 幕把问题挪到桌子外面：那一栏每季都得长出一个名字，而它不挑人，只挑当时顶班的那个号。
  // 于是"你就是流程"这一笔不是新悬念，是玩家自己四季里签过的字 —— 收法只能引用本子上已有的东西。
  // 落点 12~15 是挣来的（main-a4-desk），16/17 是阀门（main-a4-valve，第 24 天以后兜底，别再盖掉玩家那一档）。
  {
    id: "main-a4-who",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] }, b: { id: "peilan", where: [], mustBePresent: false } },
    when: [
      ACT(3), { quality: "thread:return-slip", gte: 7 },
      { season: { gte: 4 } }, { day: { gte: 6 } }, { present: "fangmin" },
    ],
    weight: 34,
    tension: 1,
    once: true,
    text: "{$a}把这一季的领用表摊到第四页，那一栏空着。她说抄件每季都要这一页，可要它的人从不进这层楼，而空着的这一栏每一季都会自己长出一个名字。{$b}没有翻表，只说一句：今年没人顶班 —— 你接手之后，长出来的是你的号。",
    choices: [
      {
        label: "问这一栏空着是给谁",
        effects: [
          { clue: "slip-desk" },
          { quality: "mainline:act", set: 4 },
          { remember: { holder: "fangmin", act: "row-asked-whose", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 3 },
          { stat: "compliance", delta: 1 },
        ],
        result: "{$a}把表转过来对着你。栏边写的是顶班那个号，不是签字那个人 —— 四季里每一季都有一个号不是你的名字，今年这一个是你。",
      },
      {
        label: "说这一栏今年由你柜上写",
        effects: [
          { clue: "slip-desk" },
          { quality: "mainline:act", set: 4 },
          { remember: { holder: "peilan", act: "row-table-yours", valence: 2, subject: "player" } },
          { opinion: "fangmin", delta: 6 },
          { stat: "standing", delta: -3 },
        ],
        result: "{$a}把笔搁在栏边，没有递给你。{$b}说这一句她每季听见一次，听见四季了 —— 不同的是这一季说话的人站在栏边。",
      },
      {
        // 最硬那一格要本子上的排班，或裴岚那条线已经走到她承认「谁要的我每年都签一次」那一档：
        // 这一格报出的是三个不在楼上了的人，没有这两条来源就凭不了。
        when: [{ any: [{ clue: "slip-roster" }, { quality: "arc:peilan", gte: 2 }] }],
        label: "把前三季那一栏的号念出来",
        effects: [
          { clue: "slip-desk" },
          { quality: "mainline:act", set: 4 },
          { remember: { holder: "fangmin", act: "row-old-numbers", valence: 2, subject: "player" } },
          { opinion: "peilan", delta: 5 },
          { stat: "compliance", delta: 5 },
          { stat: "standing", delta: -4 },
        ],
        result: "{$b}报了三个号，都不是你的名字。{$a}说那三个人今年都不在这层楼上了 —— 这一栏不挑人，它只挑当时顶班的那个号。",
      },
    ],
  },
  {
    id: "main-a4-desk",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] }, b: { id: "peilan", where: [], mustBePresent: false } },
    when: [
      ACT(4), { present: "fangmin" },
      { not: { quality: "thread:return-slip", gte: 12 } },
      { any: [{ clue: "slip-desk" }, { clue: "slip-roster" }] },
    ],
    weight: 40,
    tension: 1,
    once: true,
    text: "第四页那一栏今年还没人写。{$a}把笔压在抄件上：这一栏她可以照旧按住，也可以由你签。她说这两种她四季都见过，只有一种没见过 —— 有人把自己的名字写在别人退的那一单上。{$b}把名单扣在桌上，没有说话。",
    choices: [
      {
        label: "把自己的名字写进那一栏",
        effects: [
          { quality: "thread:return-slip", set: 12 },
          { remember: { holder: "fangmin", act: "row-signed-self", valence: 2, subject: "player" } },
          { remember: { holder: "peilan", act: "row-signed-self", valence: 2, subject: "player", heardFrom: "fangmin" } },
          { opinion: "fangmin", delta: 12 },
          { opinion: "peilan", delta: 6 },
          { bond: ["fangmin", "player"], kind: "friend", set: 62 },
          { stat: "compliance", delta: 14 },
          { stat: "standing", delta: -9 },
        ],
        result: "你写得很慢，写完把纸转给她。{$a}把抄件收进文件夹最上面那一层，说这一页今年不用她按了。柜位的数跟着少一笔 —— 少的正是你名字那一笔。",
      },
      {
        label: "这一栏交给下一任顶班的人",
        effects: [
          { quality: "thread:return-slip", set: 13 },
          { remember: { holder: "fangmin", act: "row-handed-next", valence: -2, subject: "player" } },
          { opinion: "fangmin", delta: -5 },
          { stat: "compliance", delta: -3 },
          { stat: "standing", delta: 4 },
        ],
        result: "{$a}说好，把那一页放回柜面，页脚还是折的那一道。{$b}在门口补一句：这句话她每季听一次，听四季了，只有说的人换过。",
      },
      {
        // 把这一行挪到区域总表上，前提是裴岚本人这一季在楼上，而且她的线已经走到她承认那一页那一段。
        when: [{ present: "peilan" }, { quality: "arc:peilan", gte: 2 }],
        label: "让裴岚把这一行写进区域总表",
        effects: [
          { quality: "thread:return-slip", set: 14 },
          { remember: { holder: "peilan", act: "row-in-total", valence: 2, subject: "player" } },
          { opinion: "peilan", delta: 9 },
          { opinion: "fangmin", delta: 3 },
          { stat: "compliance", delta: 8 },
          { stat: "standing", delta: 2 },
        ],
        result: "{$b}把笔拿过去，写的是她自己的工号。她说这一行上了总表就不再是柜上按不按住的事 —— 它变成一张要追的表，追的人是她。",
      },
      {
        label: "把那一页从表上摘下来",
        effects: [
          { quality: "thread:return-slip", set: 15 },
          { remember: { holder: "fangmin", act: "row-page-pulled", valence: -2, subject: "player" } },
          { opinion: "fangmin", delta: -8 },
          { opinion: "peilan", delta: -4 },
          { stat: "compliance", delta: -12 },
          { stat: "standing", delta: 6 },
        ],
        result: "你起开订书针，第四页少了一栏。{$a}看着那个缺口说她四季抄的都是这一页，从今晚起她不知道要抄第几页 —— 缺的那一页会有人来要。",
      },
    ],
  },
  {
    id: "main-a4-valve",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] }, b: { id: "fangmin", where: [], mustBePresent: false } },
    when: [
      ACT(4), { present: "shen" }, { day: { gte: 24 } },
      { not: { quality: "thread:return-slip", gte: 12 } },
    ],
    weight: 30,
    tension: -1,
    once: true,
    // 第 4 幕的阀门：幕号抬到 4 却一栏没写的人，散场前由这张收掉，主线不许永远挂在牌堆里。
    // 落点 16/17 都 ≥ 12，所以它落过一次之后自己就关掉了，不会跟 main-a4-desk 抢同一档。
    // 认 day gte 24 是同第 3 幕那张的规矩：它不认本子，早演就等于替玩家做决定。
    text: "{$a}自己带了一张空白领用表来。她说第四页那一栏散场之前总得有人写，也可以留给下一季 —— 留给下一季的意思是，明年这时候又有一个人在这里顶班。她把笔尖朝你这边搁下。",
    choices: [
      {
        label: "由她把这一栏填掉",
        effects: [
          { quality: "thread:return-slip", set: 16 },
          { remember: { holder: "shen", act: "row-she-filled", valence: -1, subject: "player" } },
          { remember: { holder: "fangmin", act: "row-she-filled", valence: -2, subject: "player", heardFrom: "shen" } },
          { opinion: "shen", delta: -10 },
          { opinion: "fangmin", delta: -6 },
          { bond: ["shen", "player"], kind: "client", set: -28 },
          { stat: "compliance", delta: 3 },
          { stat: "standing", delta: 2 },
        ],
        result: "她填得很快，写的是一个她不认识的号。{$b}收走抄件时只说一句：这一页从此是别人的一栏，不是你本子上的事。",
      },
      {
        label: "这一栏谁也不写",
        effects: [
          { quality: "thread:return-slip", set: 17 },
          { remember: { holder: "shen", act: "row-nobody", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 4 },
          { stat: "compliance", delta: -6 },
        ],
        result: "你说这一栏不必有人写。她把纸折好收进口袋，走到门口回头说一句：那明年这时候它还是空的，空的这一栏不会自己填。",
      },
    ],
  },
  // ============ 第 5 幕：那一栏今年写谁（第 5 季起，四季那笔账落地之后） ============
  // 第 4 幕答的是「谁在写单子」，第 5 幕接的是下一问：那一栏今年又长出一个名字，这次是谁签的。
  // 三张都在 ACT(4)/ACT(5) 里自我关闭或走 mainline:seen 记号 —— 幕号、线索、落点都跨季带着走，
  // 不补这一层就会有一季原样重演一遍（判据在 tests/world-content.test.ts「主线整段只演一次」）。
  {
    id: "main-a5-open",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] } },
    when: [
      ACT(4), { quality: "thread:return-slip", gte: 12 },
      { season: { gte: 5 } }, { day: { gte: 4 } }, { present: "shen" },
    ],
    weight: 31,
    tension: 1,
    once: true,
    text: "{$a}把这一季的领用表翻到第四页，那一栏没空着，也没写她的名 —— 底下两个字是「待定」，字是新的。她说去年这时候这一栏怎么合上的她全看见了，今年这一栏又开了。",
    choices: [
      {
        label: "问这一栏今年预备给谁",
        effects: [
          { clue: "slip-handover" },
          { quality: "mainline:act", set: 5 },
          { remember: { holder: "shen", act: "a5-row-asked", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 4 }, { stat: "compliance", delta: 1 },
        ],
        result: "{$a}说写「待定」的人连问都不问一句，去年也是这样，一栏空着，等一个当时顶班的号 —— 今年她不想再当那个号。",
      },
      {
        label: "把「待定」两个字划掉给她看",
        effects: [
          { clue: "slip-handover" },
          { quality: "mainline:act", set: 5 },
          { remember: { holder: "shen", act: "a5-row-wiped", valence: 2, subject: "player" } },
          { opinion: "shen", delta: 6 }, { stat: "standing", delta: 1 },
        ],
        result: "{$a}看着那两个字被划掉，说划掉不算，得有人在这行上写自己的名字才算 —— 去年你写过一回，今年这一行是新的。",
      },
      {
        label: "说这一栏与她无关",
        effects: [
          { clue: "slip-handover" },
          { quality: "mainline:act", set: 5 },
          { remember: { holder: "shen", act: "a5-row-refused", valence: -2, subject: "player" } },
          { opinion: "shen", delta: -5 }, { stat: "standing", delta: -1 },
        ],
        result: "{$a}点头说她就知道你会这样答，去年这样答的人今年还在这行上被签着，说完把表推回去，没翻页。",
      },
    ],
  },
  {
    id: "main-a5-names",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] }, b: { id: "peilan", where: [], mustBePresent: false } },
    when: [
      ACT(5), { clue: "slip-handover" },
      { season: { gte: 5 } }, { day: { gte: 12 } }, { present: "shen" },
    ],
    weight: 30,
    tension: 1,
    once: true,
    text: "{$a}拿了一张退单单来，签字那处写着她的名字，日期是这季的。她说她没签过。{$b}在旁听完只问一句：这一年来，这层楼有几个人用过这个名字。",
    choices: [
      {
        label: "去查谁在这一年用她的名字签了字",
        effects: [
          { clue: "slip-signature" },
          { remember: { holder: "shen", act: "a5-who-signed", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 5 }, { stat: "compliance", delta: 2 },
        ],
        result: "查出来是三张，都是她当班的日子，都不是她的手 —— 第三张的笔迹她认得，是那个每季来抄表的人，抄完顺手替她签。",
      },
      {
        label: "先问她自己要不要认这三张",
        effects: [
          { clue: "slip-signature" },
          { remember: { holder: "shen", act: "a5-her-call", valence: 2, subject: "player" } },
          { opinion: "shen", delta: 6 }, { bond: ["shen", "player"], delta: 5 },
        ],
        result: "{$a}说她不认，也不求你替她撕掉 —— 撕了这一张，下一季还会有一张，除非那一栏不再拿她的号去签别人。",
      },
      {
        label: "把三张都收进台账，注明非本人签",
        effects: [
          { clue: "slip-signature" },
          { remember: { holder: "shen", act: "a5-books-noted", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 3 }, { stat: "compliance", delta: 4 }, { stat: "standing", delta: -1 },
        ],
        result: "{$a}看着那行小字被记进台账，说这一本里终于有一句是替她写的，说完把退单单留在柜面上，没带走。",
      },
    ],
  },
  {
    id: "main-a5-desk",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] }, b: { id: "shen", where: [], mustBePresent: false } },
    when: [
      ACT(5), { clue: "slip-signature" },
      { season: { gte: 5 } }, { day: { gte: 20 } }, { present: "fangmin" },
    ],
    weight: 30,
    tension: 1,
    once: true,
    text: "{$a}把那页抄件带来，第四页那一行还写着「待定」，旁边压着三张代签的退单单。她说这一栏今年必须落一个名字，落谁的，她只收当场念得出口的那一句。",
    choices: [
      {
        label: "请她自己在那一栏写下自己的名字",
        effects: [
          { remember: { holder: "fangmin", act: "a5-her-name", valence: 2, subject: "player" } },
          { opinion: "fangmin", delta: 6 }, { stat: "compliance", delta: 3 }, { stat: "standing", delta: 2 },
          { quality: "mainline:a5-row", set: 1 },
        ],
        result: "{$a}念了一遍再落笔，写的是她自己，不是那个号。她说这一栏往后拿她的名字去签，得先问她，这一句她今年说得很响。",
      },
      {
        label: "主张把这一栏撤掉，不许再代签",
        effects: [
          { remember: { holder: "fangmin", act: "a5-row-closed", valence: 1, subject: "player" } },
          { opinion: "fangmin", delta: 4 }, { stat: "compliance", delta: 4 }, { stat: "standing", delta: -2 },
          { quality: "mainline:a5-row", set: 2 },
        ],
        result: "{$a}说撤栏要楼上的表改版，今年办不动；但「不许代签」这一句她可以现在就写进去，写完把笔递过来让你签。",
      },
      {
        label: "那一栏归谁，你说了不算",
        effects: [
          { remember: { holder: "fangmin", act: "a5-nobody-owned", valence: -2, subject: "player" } },
          { opinion: "fangmin", delta: -4 }, { stat: "compliance", delta: -3 },
          { quality: "mainline:a5-row", set: 3 },
        ],
        result: "{$a}点头说这一句她见过四季，每一季都有人说这栏与她无关，写到年底它总有一个名字，今年那个名字还是被借走的。",
      },
    ],
  },
  // 第 5 幕在第 5 季就讲完了，第 6、7 季那条主线整季 0 张（第 37 轮代价 ①，模拟器 7 季那行读得出）。
  // 这两张不抬幕号、不新增落点档 —— 它们把「一幕讲完就停」改成「一幕里按季续写」：
  // 每一季那一张读的是**上一季那一张写下的记号**（`mainline:a5-row` / `mainline:a6-row`，`mainline:` 前缀跨季带着走）。
  // 为什么不读 `remember` 落点：`nextSeason` 只带走 valence 为 ±2 的记忆（engine.ts:1247），
  // 第 5 幕那三格里有一格写的是 valence 1，过季就没了 —— 照它分叉就是一个死档（第 34 轮那条守卫抓的形状）。
  // 兜底那一格不许省：去年那一栏可能压根没落名（没演到 main-a5-desk），三格全部门认档时桌上是空的。
  {
    id: "main-a6-relay",
    kind: "mainline",
    cast: { a: { id: "shen", where: [] } },
    when: [
      ACT(5), { clue: "slip-signature" },
      { season: { gte: 6 } }, { day: { gte: 8 } }, { present: "shen" },
    ],
    weight: 30,
    tension: 1,
    once: true,
    text: "{$a}把这一季的领用表压在柜面上，第四页那一栏今年不是「待定」—— 上面有一个名字，从去年一直写到现在。她说她这季来退一张，柜员抬头看的是栏上那个名字不是她的脸；单子照样开出去，号跟去年一模一样。",
    choices: [
      {
        label: "问那一栏上的名字今年认不认她",
        when: [{ quality: "mainline:a5-row", eq: 1 }],
        effects: [
          { clue: "slip-number" },
          { quality: "mainline:a6-row", set: 1 },
          { remember: { holder: "shen", act: "a6-name-not-row", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 5 }, { stat: "compliance", delta: 2 },
        ],
        result: "{$a}笑了一下说认得 —— 去年那一笔是她自己落的笔，可这一季她站在栏前，柜员念的是名字后头那个号。名字换过一回，号一年没换。",
      },
      {
        label: "去问楼上：撤栏那一步今年办到哪了",
        when: [{ quality: "mainline:a5-row", eq: 2 }],
        effects: [
          { clue: "slip-number" },
          { quality: "mainline:a6-row", set: 2 },
          { remember: { holder: "shen", act: "a6-row-merged", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 4 }, { stat: "standing", delta: 2 }, { stat: "compliance", delta: -1 },
        ],
        result: "{$a}说没撤成，楼上把它并进区域总表，如今那一栏底下签的是另一个不认识的号 —— 你去年写进去那句「不许代签」，今年成了别人手上的章。",
      },
      {
        label: "替今年那个新来的人要一句",
        when: [{ quality: "mainline:a5-row", eq: 3 }],
        effects: [
          { clue: "slip-number" },
          { quality: "mainline:a6-row", set: 3 },
          { remember: { holder: "shen", act: "a6-for-newcomer", valence: 2, subject: "player" } },
          { opinion: "shen", delta: 6 }, { bond: ["shen", "player"], delta: 5 }, { stat: "standing", delta: -1 },
        ],
        result: "{$a}说那一栏今年落到一个才来两周的孩子头上，第一个月就被代签三张 —— 去年你说这一栏与她无关，今年它归了一个更无关的人。",
      },
      {
        label: "先数这一季从这一栏开出去几张",
        effects: [
          { clue: "slip-number" },
          { quality: "mainline:a6-row", set: 4 },
          { remember: { holder: "shen", act: "a6-row-counted", valence: 1, subject: "player" } },
          { opinion: "shen", delta: 3 }, { stat: "compliance", delta: 3 },
        ],
        result: "{$a}说四张，三张的日期都在她当班的日子，最后一张是楼上自己退的那面镜 —— 那一栏不管谁站着，它只往外开单。",
      },
    ],
  },
  {
    id: "main-a7-same",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] }, b: { id: "shen", where: [], mustBePresent: false } },
    when: [
      ACT(5), { clue: "slip-number" },
      { season: { gte: 7 } }, { day: { gte: 16 } }, { present: "fangmin" },
    ],
    weight: 30,
    tension: 1,
    once: true,
    text: "{$a}带来这一季的抄件，第四页那一栏旁边多印了一行小字：上一季同名。她说这一栏今年不用再向楼上要谁，它照着上一季那一栏抄自己。{$b}在旁边只问一句：那行小字今年要写进说明里吗。",
    choices: [
      {
        label: "那一栏还是一个名字，不是表格",
        when: [{ any: [{ quality: "mainline:a6-row", eq: 1 }, { quality: "mainline:a6-row", eq: 2 }] }],
        effects: [
          { clue: "slip-selfrow" },
          { remember: { holder: "fangmin", act: "a7-row-personal", valence: 2, subject: "player" } },
          { quality: "mainline:a7-row", set: 1 },
          { opinion: "fangmin", delta: 5 }, { stat: "compliance", delta: 2 }, { stat: "standing", delta: 1 },
        ],
        result: "{$a}点头说去年也听过这一句，可那两个字去年是她手写的，今年是系统印的 —— 那行小字一加上去，那一栏就再没人手写过了。",
      },
      {
        label: "问这一栏什么时候可以不落人",
        when: [{ quality: "mainline:a6-row", eq: 3 }],
        effects: [
          { clue: "slip-selfrow" },
          { remember: { holder: "fangmin", act: "a7-row-nobody", valence: 1, subject: "player" } },
          { quality: "mainline:a7-row", set: 2 },
          { opinion: "fangmin", delta: 4 }, { stat: "standing", delta: 2 }, { stat: "compliance", delta: -2 },
        ],
        result: "{$a}说撤不掉，它进的是区域总表的表头；今年它连要一个名字都省了 —— 那一栏自己就是一个岗位，谁站过来都得往里签。",
      },
      {
        label: "把去年那四张摊到楼上去",
        when: [{ quality: "mainline:a6-row", eq: 4 }],
        effects: [
          { clue: "slip-selfrow" },
          { remember: { holder: "fangmin", act: "a7-ledger-shown", valence: 1, subject: "player" } },
          { quality: "mainline:a7-row", set: 3 },
          { opinion: "fangmin", delta: 4 }, { stat: "compliance", delta: 5 }, { stat: "standing", delta: -1 },
        ],
        result: "{$a}说台账她收过，收完那一栏照旧开单 —— 你去年数出来的那四张，今年变成抄件上那行小字里的「同名」两季。",
      },
      {
        label: "先问那行小字是谁加上去的",
        effects: [
          { clue: "slip-selfrow" },
          { remember: { holder: "fangmin", act: "a7-who-added", valence: 1, subject: "player" } },
          { quality: "mainline:a7-row", set: 4 },
          { opinion: "fangmin", delta: 3 }, { stat: "compliance", delta: 3 },
        ],
        result: "{$a}说是楼上的模板，去年冬天起就在改，没人签发起 —— 那一栏引用它自己，连一个要问的人都不问了。",
      },
    ],
  },
  // 第 41 轮：主线第 8 季那一张。第 38 轮把主线改成按季续写以后，第 8 季仍是 0 张
  // （第 40 轮补满人物线，那条账就留在「个人线 20 张 / 主线 0 张」这一行上）。这一张把链子接到第 8 季：
  // 读 main-a7-same 写下的 mainline:a7-row（1..4），不抬幕号、不加落点档、一颗钱都不给。
  // 第 8 季的翻面是**那一栏今年空着过完一季，没人补也没人问**：四季都要长出一个名字的栏，
  // 今年没长 —— 说明它从来不是营业的条件，只是让人背着（第 4 幕那句「只挑当时顶班的号」收到这一句）。
  // 这张不许原样重演：门里的 clue:slip-selfrow 过季照样成立，所以它进了「演过就不再演」的名单。
  {
    id: "main-a8-blank",
    kind: "mainline",
    cast: { a: { id: "fangmin", where: [] }, b: { id: "shen", where: [], mustBePresent: false } },
    when: [
      ACT(5), { clue: "slip-selfrow" },
      { season: { gte: 8 } }, { day: { gte: 10 } }, { present: "fangmin" },
    ],
    weight: 30,
    tension: 1,
    once: true,
    text: "{$a}把这季的抄件摊到第四页，那一栏是空的 —— 不是「待定」，是真的一整季没人写。她说没人来问该谁填，也没人催她留白，{$b}站在旁边说这一栏空着比填着更难解释。",
    choices: [
      {
        label: "空着就空着，别替谁补",
        when: [{ any: [{ quality: "mainline:a7-row", eq: 1 }, { quality: "mainline:a7-row", eq: 2 }] }],
        effects: [
          { clue: "slip-blank" },
          { remember: { holder: "fangmin", act: "a8-left-blank", valence: 2, subject: "player" } },
          { quality: "mainline:a8-row", set: 1 },
          { opinion: "fangmin", delta: 5 }, { stat: "standing", delta: 2 }, { stat: "compliance", delta: -1 },
        ],
        result: "{$a}点头说去年她还急着要一个名字，今年她明白了：这一栏空着，柜上照样开门，那一季退的单没人担 —— 它原来不是营业的条件，是有人替它背着。",
      },
      {
        label: "问楼上：这一栏还要不要留着",
        when: [{ any: [{ quality: "mainline:a7-row", eq: 3 }, { quality: "mainline:a7-row", eq: 4 }] }],
        effects: [
          { clue: "slip-blank" },
          { remember: { holder: "fangmin", act: "a8-asked-above", valence: 1, subject: "player" } },
          { quality: "mainline:a8-row", set: 2 },
          { opinion: "fangmin", delta: 4 }, { stat: "compliance", delta: 3 }, { stat: "standing", delta: -1 },
        ],
        result: "{$a}说楼上回了四个字「照旧留着」 —— 留着不填，明年抄件上那行小字还是「上一季同名」，只是同名同的是空白。",
      },
      {
        label: "先问这一季谁本该站过来",
        effects: [
          { clue: "slip-blank" },
          { remember: { holder: "fangmin", act: "a8-who-should-stand", valence: 1, subject: "player" } },
          { quality: "mainline:a8-row", set: 3 },
          { opinion: "fangmin", delta: 3 }, { bond: ["fangmin", "player"], delta: 4 },
        ],
        result: "{$a}翻到名单那一页给这一柜看：今年这一层站过的人都签过别处，轮到谁谁就病 —— 不是躲，是这一栏的名声已经传出去了。",
      },
    ],
  },
];

// 这些卡的门槛在过季之后照样成立（幕号、落点、本子里的线索都带着走），所以每张的每一个分支
// 都自动补一个「已经演过」的记号，并把记号写回门槛 —— 漏掉一格就会有一季原样重演一遍。
// 其余的主线卡靠带着走的 quality 自己关掉：第 1 幕那几张被 OPEN 挡住，第 3 幕的阀门与第 4 幕那两张被落点挡住，
// main-a4-who 抬完幕号就被 ACT(3) 自己挡住。
// 判据在 tests/world-content.test.ts「主线整段只演一次，而且第 2 季还有新的一幕可演」。
for (const id of ["main-slip-after-own", "main-slip-after-name", "main-slip-after-quiet",
  "main-act3-row", "main-act3-tape", "main-a2-audit", "main-a2-tape", "main-a2-mirror", "main-a4-page",
  // 第 5 幕这两张抬完幕号就没人管了：线索发完它自己的门照样成立，不补记号第 6 季会原样再演一遍。
  // main-a5-open 不用补 —— 它把幕号抬到 5，ACT(4) 那道门自己就关上了。
  "main-a5-names", "main-a5-desk",
  // 第 6、7 季那两张的门（season ≥ 6 / ≥ 7 + 本子上的线索）过季照样成立，不发记号就会一季重演一遍。
  "main-a6-relay", "main-a7-same",
  // 第 8 季那一张：门里的 clue:slip-selfrow 过季照样成立，不发记号就会一季重念一遍。
  "main-a8-blank"]) {
  const s = STORYLETS_MAINLINE.find(x => x.id === id)!;
  s.when.push(SEEN(id));
  for (const c of s.choices) c.effects.push(MARK(id));
}

// 主线第 1 幕「一张署了别人名字的单子」→ 第 2 幕「名字在谁手里」→ 第 3 幕「那一行是谁的手写的」。
// 第 3 幕只在第 3 季以后开（幕号抬到 3 就锁死第 2 幕那三张收法，所以开头那张压到第 10 天）。
// 悬念用的是人物圣经里已经埋下的四条秘密（沈薇的退货单、宋姐群里借出去的名字、
// 尹小姐包带里的录音笔、方敏按住不念的那一行）。翻面的每一个落点都必须先有本子上的
// 线索才按得出来 —— 反转不许凭空掉下来的这条，由 tests/world-content.test.ts 钉住。
// 幕号走 quality「mainline:act」，落点走 quality「thread:return-slip」，文案在 content/clues.ts。
import type { Storylet } from "../types.ts";

const ACT = (eq: number) => ({ quality: "mainline:act", eq } as const);
const OPEN = { not: { quality: "thread:return-slip", gte: 1 } } as const;
/** 这一栏还没有玩家自己落过的名（落点 7/8/9 = 第 3 幕那三张已经收过尾）。 */
const NOT_OWNED = { not: { quality: "thread:return-slip", gte: 7 } } as const;

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
];

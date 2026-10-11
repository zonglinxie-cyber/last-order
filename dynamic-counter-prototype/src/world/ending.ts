// 一季结局。只读世界和人物，不改引擎。
// 按目录顺序取第一张对得上的：越靠前越好。rank 就是这个顺序，数字越小越好，两两不同 ——
// 好坏由下标推出来，不写在每张上：手写 rank 在插一张卡时必然漏改后面每一位，而漏改是静默的。
import { seasonSummary, type SeasonSummary } from "./engine.ts";
import { MAINLINE_ACT_KEY, MAINLINE_THREAD, threadLandedSeason, threadLanding } from "./content/clues.ts";
import type { Person, PersonId, World } from "./types.ts";
import { SEASON_DAYS } from "./types.ts";

export type SeasonEnding = { id: string; title: string; body: string };

const endOf = (s: SeasonSummary, id: PersonId) => s.arcs[id]?.end ?? 0;
const has = (ids: PersonId[], id: PersonId) => ids.includes(id);

/** 主线走到第几幕、那条退货单落到哪一档、以及这一季是不是它落地的那一季。
 *  只有最前面那几组读它们，其余各句读不到。 */
type Mainline = { act: number; landing: number; landedThisSeason: boolean; spoke: Record<string, boolean> };

/** 第 5 幕以后主线是**按季续写**的（第 38 轮那三张 + 第 41 轮那一张），每一步都发一条本子上的线索：
 *  slip-signature 第 5 季 / slip-number 第 6 季 / slip-selfrow 第 7 季 / slip-blank 第 8 季。
 *  线索记的是"第几天学到的"那个绝对天（engine 的 absDay），所以"这一步是不是这一季说的"算得出来 ——
 *  结局层不用为新记号改引擎，也不会像旧那四句一样隔一季把同一句话再念一遍。 */
const CHAIN_STEP_CLUES = ["slip-signature", "slip-number", "slip-selfrow", "slip-blank"] as const;
const seasonOfAbsDay = (day: number): number => Math.floor((day - 1) / SEASON_DAYS) + 1;
const spokeThisSeason = (qualities: Record<string, number>, season: number): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  for (const id of CHAIN_STEP_CLUES) {
    const day = qualities[`clue:${id}`] ?? 0;
    out[id] = day > 0 && seasonOfAbsDay(day) === season;
  }
  return out;
};

type Gate = (s: SeasonSummary & Mainline) => boolean;

const CATALOG: Array<SeasonEnding & { when: Gate }> = [
  // —— 第 5 幕以后那四句：一句对应一季，门槛只认"这一步的线索是不是本季学到的"，不认幕号
  //    （幕号停在 5，靠它分不出季）；也不与上面那四句抢 —— 那四句要 `thread:return-slip` 本季落地，
  //    而第 4 季之后落点不再动。
  {
    id: "row-signed-again",
    title: "那一栏今年照旧签",
    body: "今年签在那一栏的还是那个名字，不是补四季的旧账，是照旧 —— 你替她把这一笔记到第五季，台账上多出来的全是别人的日期。",
    when: s => s.spoke["slip-signature"],
  },
  {
    id: "row-numbers-only",
    title: "认的是号，不是名字",
    body: "那一栏去年换过一个名字，号一年没换。这一季的退单还是从那个号开出去：柜位认得它，认不得人。",
    when: s => s.spoke["slip-number"],
  },
  {
    id: "row-copies-itself",
    title: "那一栏抄自己",
    body: "抄件上多了一行小字「上一季同名」。它不再向楼上要谁了 —— 四季都要长出来的那个名字，今年由它自己复制自己。",
    when: s => s.spoke["slip-selfrow"],
  },
  {
    id: "row-blank-season",
    title: "那一栏空着过完一季",
    body: "今年没人写，也没人来问该谁填。柜上照旧开门，退单照旧进账 —— 原来它不是营业的条件，只是有人替它背着，这一年没人背。",
    when: s => s.spoke["slip-blank"],
  },
  // —— 主线第 4 幕那四句：门槛一律带 act >= 4 且 landedThisSeason，所以没跑完四季的人在下面那十三句里落，
  //    跑完的也只在那张退货单落地的那一季落一次 —— 往后的季这一句已经说完，回到下面那十三句。
  //    落点代号见 storylets-mainline.ts 第 4 幕那三张（12~17）。
  {
    id: "page-carried",
    title: "这一页有人认",
    body: "第四页那一栏写的是你自己的号，裴岚把那一页留在柜上、只收走其余三张。四季里每季都要长出来的那个名字，今年有人认，不用再按住第五季。",
    when: s => s.act >= 4 && s.landedThisSeason && s.landing === 12 && endOf(s, "peilan") === 1 && s.compliance >= 45,
  },
  {
    id: "row-is-yours",
    title: "那一栏写的是你",
    body: "你把名字写在别人退的那一单上。台账核对那一栏第一次不用别人替你签 —— 柜位跟着少一笔，少的这一笔你自己念得出来。",
    when: s => s.act >= 4 && s.landedThisSeason && s.landing === 12 && s.compliance >= 50 && s.standing >= 45,
  },
  {
    id: "row-in-total",
    title: "这一行走进总表",
    body: "那一行不再是柜上按不按住的事。裴岚写上去的是她自己的工号，从此它是一张要追的表，追的人每季都上楼。",
    when: s => s.act >= 4 && s.landedThisSeason && s.landing === 14 && s.compliance >= 40,
  },
  {
    id: "row-still-open",
    title: "那一栏今年还是空的",
    body: "四季的故事说完了，那一栏却没写你的名字 —— 交给下一任、把那一页摘下来、散场前由别人填掉，都是这一句。明年这时候它照样空着。",
    when: s => s.act >= 4 && s.landedThisSeason
      && (s.landing === 13 || s.landing === 15 || s.landing === 16 || s.landing === 17)
      && s.compliance >= 25 && s.standing >= 30,
  },
  {
    id: "both-kept",
    title: "两句都留下",
    body: "沈薇说，团队还把人交给你。安姐说，后面的人还指定你。两句都留在这面镜子上。",
    when: s => endOf(s, "shen") === 1 && endOf(s, "anjie") === 1
      && s.compliance >= 40 && s.standing >= 45
      && !has(s.enemies, "shen") && !has(s.enemies, "anjie"),
  },
  {
    id: "names-stay",
    title: "人走了，名字留下",
    body: "唐可的名字不在这季的表上。苏蔓把认她的人留在这三米，下一季还来找你。",
    when: s => endOf(s, "tangke") === 2 && (endOf(s, "suman") === 1 || endOf(s, "suman") === 3)
      && s.compliance >= 32 && s.standing >= 36
      && !has(s.enemies, "suman"),
  },
  {
    id: "own-sentence",
    title: "这句是她自己的",
    body: "乔晚送走客人的那句，是她自己的。罗曼把晚班表交到你这边。上季留下的那条线，还在这面柜上。",
    when: s => endOf(s, "qiaowan") === 1 && endOf(s, "roman") === 1
      && (endOf(s, "shen") >= 1 || endOf(s, "anjie") >= 1 || endOf(s, "luyao") >= 1 || endOf(s, "suman") >= 1)
      && s.compliance >= 32 && s.standing >= 36,
  },
  {
    id: "file-and-sheet",
    title: "文件夹和表各写各的",
    body: "方敏的文件夹里没有缺口的名字。罗曼的表还是两列数字，名额那句还在表上。上季有一条线停在散场。",
    when: s => (endOf(s, "fangmin") === 1 || endOf(s, "fangmin") === 3) && endOf(s, "roman") === 2
      && (endOf(s, "shen") === 4 || endOf(s, "anjie") === 4 || endOf(s, "luyao") === 4 || endOf(s, "suman") === 4)
      && s.compliance >= 28 && s.standing >= 36,
  },
  {
    id: "folder-follows",
    title: "文件夹跟着你",
    body: "方敏把文件夹放到你桌上。她说这季写下来的原话都在里面，下一季她还认。",
    when: s => s.compliance >= 62 && s.standing >= 58 && s.money >= 30_000
      && has(s.allies, "fangmin") && s.enemies.length <= 2,
  },
  {
    id: "speaks-first",
    title: "她先开口",
    body: "陆遥调过来以后先开口。晚班还是各看一边，她争之前会告诉你。",
    when: s => endOf(s, "luyao") === 1 && s.compliance >= 40 && s.standing >= 55
      && !has(s.enemies, "luyao"),
  },
  {
    id: "team-stays",
    title: "团队还在",
    body: "沈薇说，团队还把人交给你。唐糖下次来，不是来复刻。",
    when: s => endOf(s, "shen") === 1 && s.compliance >= 40
      && !has(s.enemies, "shen"),
  },
  {
    id: "still-named",
    title: "她还指定你",
    body: "安姐说，后面的人还指定你。梁夏若再来，找的是你，不是这个柜。",
    when: s => endOf(s, "anjie") === 1 && s.compliance >= 40
      && !has(s.enemies, "anjie"),
  },
  {
    id: "books-hold",
    title: "账还对得上",
    body: "柜位比来的时候高，台账还对得上。团队和婚礼都没有把下一句指定给你。",
    when: s => s.compliance >= 48 && s.standing >= 58 && s.money >= 40_000
      && s.allies.length >= 2 && s.enemies.length <= s.allies.length,
  },
  {
    id: "regulars-stay",
    title: "老客留在这三米",
    body: "苏蔓把老客交给你。你没有把柜位做成自己的数，认她的人还来这三米。",
    when: s => s.standing >= 50 && s.compliance >= 28
      && has(s.allies, "suman") && s.allies.length >= 2,
  },
  {
    id: "nobody-left",
    title: "谁也没交",
    body: "没有人把团队、婚礼或老客交给你。柜还开着，台账没有见底。",
    when: s => s.compliance >= 11 && s.standing >= 35,
  },
  {
    id: "ledger-empty",
    title: "数推完了",
    body: "这季的数推得最高的时候，台账已经见底。退回来的那些单，名字她都记得。方敏的文件夹没有跟你走。",
    when: s => s.compliance <= 10 && s.money >= 5000,
  },
  {
    id: "counter-empty",
    title: "镜子前空了",
    body: "这一季没有对上任何一句留下来的话。柜位和台账，至少有一边已经塌了。",
    when: () => true,
  },
];

export const ENDINGS: readonly SeasonEnding[] = CATALOG.map(({ id, title, body }) => ({ id, title, body }));

/** 结局好坏：它在目录里的位置，数字越小越好。两两不同是全序结构给的，不需要另写一份数。 */
export function rank(id: string): number {
  const hit = CATALOG.findIndex(e => e.id === id);
  if (hit < 0) throw new Error(`未知结局 ${id}`);
  return hit + 1;
}

export function seasonEnding(world: World, people: Person[]): SeasonEnding {
  // 主线那一句只在落点变动的那一季说（记号由 setQuality 在写落点那一刻钉上）。
  // 这一季之后它已经说完，判词让给人物层那十三句 —— 不挡的话，四季跑完以后
  // 每季都原样重念同一句，人物层整季露不出来（第 27 轮 8 副牌 × 6 季量到的那一处）。
  // 落点有值却没有记号 = 这份盘是加记号之前存的档：宁可不念，也不猜它落在哪一季。
  const s: SeasonSummary & Mainline = {
    ...seasonSummary(world, people),
    act: world.qualities[MAINLINE_ACT_KEY] ?? 0,
    landing: threadLanding(world.qualities, MAINLINE_THREAD),
    landedThisSeason: threadLandedSeason(world.qualities, MAINLINE_THREAD) === world.season,
    spoke: spokeThisSeason(world.qualities, world.season),
  };
  const hit = CATALOG.find(e => e.when(s)) ?? CATALOG[CATALOG.length - 1];
  return { id: hit.id, title: hit.title, body: hit.body };
}

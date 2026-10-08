// 一季结局。只读世界和人物，不改引擎。
// 按目录顺序取第一张对得上的：越靠前越好。rank 是这个顺序，数字越小越好，两两不同。
import { seasonSummary, type SeasonSummary } from "./engine.ts";
import type { Person, PersonId, World } from "./types.ts";

export type SeasonEnding = { id: string; title: string; body: string };

const endOf = (s: SeasonSummary, id: PersonId) => s.arcs[id]?.end ?? 0;
const has = (ids: PersonId[], id: PersonId) => ids.includes(id);

type Gate = (s: SeasonSummary) => boolean;

const CATALOG: Array<SeasonEnding & { rank: number; when: Gate }> = [
  {
    id: "both-kept",
    rank: 1,
    title: "两句都留下",
    body: "沈薇说，团队还把人交给你。安姐说，后面的人还指定你。两句都留在这面镜子上。",
    when: s => endOf(s, "shen") === 1 && endOf(s, "anjie") === 1
      && s.compliance >= 40 && s.standing >= 45
      && !has(s.enemies, "shen") && !has(s.enemies, "anjie"),
  },
  {
    id: "folder-follows",
    rank: 2,
    title: "文件夹跟着你",
    body: "方敏把文件夹放到你桌上。她说这季写下来的原话都在里面，下一季她还认。",
    when: s => s.compliance >= 62 && s.standing >= 58 && s.money >= 30_000
      && has(s.allies, "fangmin") && s.enemies.length <= 2,
  },
  {
    id: "speaks-first",
    rank: 3,
    title: "她先开口",
    body: "陆遥调过来以后先开口。晚班还是各看一边，她争之前会告诉你。",
    when: s => endOf(s, "luyao") === 1 && s.compliance >= 40 && s.standing >= 55
      && !has(s.enemies, "luyao"),
  },
  {
    id: "team-stays",
    rank: 4,
    title: "团队还在",
    body: "沈薇说，团队还把人交给你。唐糖下次来，不是来复刻。",
    when: s => endOf(s, "shen") === 1 && s.compliance >= 40
      && !has(s.enemies, "shen"),
  },
  {
    id: "still-named",
    rank: 5,
    title: "她还指定你",
    body: "安姐说，后面的人还指定你。梁夏若再来，找的是你，不是这个柜。",
    when: s => endOf(s, "anjie") === 1 && s.compliance >= 40
      && !has(s.enemies, "anjie"),
  },
  {
    id: "books-hold",
    rank: 6,
    title: "账还对得上",
    body: "柜位比来的时候高，台账还对得上。团队和婚礼都没有把下一句指定给你。",
    when: s => s.compliance >= 48 && s.standing >= 58 && s.money >= 40_000
      && s.allies.length >= 2 && s.enemies.length <= s.allies.length,
  },
  {
    id: "regulars-stay",
    rank: 7,
    title: "老客留在这三米",
    body: "苏蔓把老客交给你。你没有把柜位做成自己的数，认她的人还来这三米。",
    when: s => s.standing >= 50 && s.compliance >= 28
      && has(s.allies, "suman") && s.allies.length >= 2,
  },
  {
    id: "nobody-left",
    rank: 8,
    title: "谁也没交",
    body: "没有人把团队、婚礼或老客交给你。柜还开着，台账没有见底。",
    when: s => s.compliance >= 11 && s.standing >= 35,
  },
  {
    id: "ledger-empty",
    rank: 9,
    title: "数推完了",
    body: "这季的数推得最高的时候，台账已经见底。退回来的那些单，名字她都记得。方敏的文件夹没有跟你走。",
    when: s => s.compliance <= 10 && s.money >= 5000,
  },
  {
    id: "counter-empty",
    rank: 10,
    title: "镜子前空了",
    body: "这一季没有对上任何一句留下来的话。柜位和台账，至少有一边已经塌了。",
    when: () => true,
  },
];

export const ENDINGS: readonly SeasonEnding[] = CATALOG.map(({ id, title, body }) => ({ id, title, body }));

/** 结局好坏。数字越小越好；每个结局一个不相等的整数，排出来是全序。 */
export function rank(id: string): number {
  const hit = CATALOG.find(e => e.id === id);
  if (!hit) throw new Error(`未知结局 ${id}`);
  return hit.rank;
}

export function seasonEnding(world: World, people: Person[]): SeasonEnding {
  const s = seasonSummary(world, people);
  const hit = CATALOG.find(e => e.when(s)) ?? CATALOG[CATALOG.length - 1];
  return { id: hit.id, title: hit.title, body: hit.body };
}

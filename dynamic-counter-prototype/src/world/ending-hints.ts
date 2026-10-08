// 结局档案的「没拿到时那句提示」。与 ending.ts 分开写：别的同事在动引擎，这里不碰 ending.ts。
// id 与 ending.ts CATALOG 对齐，rank 靠 ending.ts 的 rank() 取；这一份只补一句不剧透的话。
import type { SeasonEnding } from "./ending.ts";

/** 还没拿到的结局，档案里只说这一句：给方向，不点破要凑成什么数。 */
export const ENDING_HINTS: Record<string, string> = {
  "both-kept": "有两条线几乎同时朝你点头，还得守住台账和柜位——很少人一次拿到两句。",
  "names-stay": "有人离开这张表，认老柜的人还留在你这三米。",
  "own-sentence": "实习生能自己把一句说完，晚班的表也交到你手里。上季还有一条线留在柜上。",
  "folder-follows": "把数做上去、把账守稳，让最认原话的那个人愿意跟你走。",
  "file-and-sheet": "缺口的名字没有进档案，柜上的表还是两列数字。上季有一条线停在散场。",
  "speaks-first": "对面那个人肯调过来，还先对你开口——这需要先别把她逼成仇家。",
  "team-stays": "让带团队来的人，散场时还把人交在你手里。",
  "still-named": "让错不起的那个人，下一次还只认你这张脸。",
  "books-hold": "数字和台账都稳，可谁也没把哪句话单独指定给你。",
  "regulars-stay": "把老客留在柜上，而不是把柜位做成你自己的数。",
  "nobody-left": "既没把谁变成自己人，也没让台账见底——一个都没交出去的中间地带。",
  "ledger-empty": "数冲得很高，台账却拖到见底；退回来的单子她都记得名字。",
  "counter-empty": "这一季没有对上任何一句留下来的话——最坏的那种散场。",
};

export type EndingHintEntry = SeasonEnding & { hint: string };

export const endingHint = (id: string): string => ENDING_HINTS[id] ?? "还没解锁的结局。";

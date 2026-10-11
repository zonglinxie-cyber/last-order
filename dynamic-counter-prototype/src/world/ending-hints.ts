// 结局档案的「没拿到时那句提示」。与 ending.ts 分开写：别的同事在动引擎，这里不碰 ending.ts。
// id 与 ending.ts CATALOG 对齐，rank 靠 ending.ts 的 rank() 取；这一份只补一句不剧透的话。
import type { SeasonEnding } from "./ending.ts";

/** 还没拿到的结局，档案里只说这一句：给方向，不点破要凑成什么数。 */
export const ENDING_HINTS: Record<string, string> = {
  // —— 主线那十八句（第 4 幕四句 + 第 5 幕以后按季续写的十四句）。第 42、43 轮加的时候只改了 ending.ts，
  //    档案里这十八句一直在念兜底那句「还没解锁的结局。」—— 由 tests/world-ending.test.ts 那条覆盖守卫钉住。
  "row-signed-again": "那一栏上今年有她自己落的一笔。",
  "row-no-proxy": "撤不掉那一栏，但可以把一句「不许代签」当场写进去。",
  "row-borrowed-name": "说那一栏与谁都不相干，年底它照样有一个名字。",
  "row-numbers-only": "名字换成谁的都会认得，那个号一年没人换过。",
  "row-stamp-of-others": "你去岁写进去的那一句，今年在谁的手上。",
  "row-signs-the-young": "那一栏落到一个还没站稳的人头上时，你替不替他要一句。",
  "row-only-counted": "别急着主张什么，先把这一季从那一栏开出去几张数清楚。",
  "row-name-printed": "那一栏上的字还是人手写的吗。",
  "row-is-a-post": "让它不再要一个名字，比撤掉它容易 —— 也难看得多。",
  "row-copies-itself": "把去年那几张摊到楼上去，看它抄谁。",
  "row-nobody-added": "那行小字是谁加上去的，问到底没人认。",
  "row-blank-who-stands": "空着的时候问一句「本该谁站过来」，名单上有答案。",
  "row-blank-asked": "问楼上要不要留着，会拿到四个字。",
  "row-blank-season": "一整季没人写、也没人来问，柜上照样开门。",
  "page-carried": "第四页留在柜上，其余三张被收走 —— 得先有人认这一页。",
  "row-is-yours": "把自己的号写在别人退的那一单上，台账和柜位都得站住。",
  "row-in-total": "那一栏被并进总表，是走得最省事的那一步。",
  "row-still-open": "四季都过去了，那一栏还是空的。",
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

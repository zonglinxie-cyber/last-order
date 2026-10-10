// 三个"该被听见"的时刻：成交、回头客、你超过对面（以及反过来那一下）。
//
// 为什么单独立一个文件：上一版这些反馈散在 WorldGame.tsx 的一条 if 链里（看法跌 ≥5 先响 down，
// 否则进账才响 register），于是**硬推那一单玩家听不见成交的声音**，而早晨老客自己回柜那笔账
// （beginSlot 里的赴约回流）根本不走那条链 —— 一次都没响过。判据、音效、动画落点都在这里一处出，
// 界面只负责挂 class 和念一句，不许在 JSX 里再拼一份。
//
// 这里只判"变了没有"，不动任何状态：全部是 (before, after) 两个盘的差。
import type { SfxKind } from "../../sfx.ts";
import { qualityOf } from "../engine.ts";
import type { PersonId, World } from "../types.ts";

export type MomentKind = "sale" | "regular" | "lead" | "trail";
export type Moment = { kind: MomentKind; who: PersonId | null };

/** 动画落在哪几处：钱那一格、比分那一格、她自己那块名牌。 */
export type MomentAnchor = "money" | "score" | "person";

// 与 engine.ts 写账时用的键同一套前缀（bought: 由成交、赴约回流和托单写）。
const BOUGHT = "bought:";
const WECHAT = "wechat:";

const margin = (w: World) => w.money - w.rivalMoney;

/** 算"回来过"的那一位：这一季已经从你柜上带过货，或者上一季加过微信。
 *  只被招呼过（served:）不算 —— 那是第一次正经接她，不是回头。 */
const cameBackBefore = (w: World, id: PersonId) =>
  qualityOf(w, `${BOUGHT}${id}`) > 0 || qualityOf(w, `${WECHAT}${id}`) > 0;

/** 这一笔进账是谁开的：成交时引擎把 `bought:<她>` 写成今天，所以看这个数变没变。
 *  同一天里第二单写的还是同一个数，认不出人 —— 那一格就只报"成交"，不报错名字。 */
const buyerOf = (before: World, after: World): PersonId | null => {
  for (const [key, value] of Object.entries(after.qualities)) {
    if (!key.startsWith(BOUGHT)) continue;
    if ((after.qualities[key] ?? 0) > (before.qualities[key] ?? 0)) return key.slice(BOUGHT.length) as PersonId;
  }
  return null;
}

/** 一次状态变化里同时出现的时刻按这个顺序出声（只响一个，其余各亮各的动画）。 */
const RANK: Record<MomentKind, number> = { lead: 0, trail: 1, regular: 2, sale: 3 };

export function worldMoments(before: World, after: World): Moment[] {
  const out: Moment[] = [];
  // 只认涨的那一下：退货与扣款走的是别的账，不该有收银声。
  if (after.money > before.money) {
    const who = buyerOf(before, after);
    out.push({ kind: who && cameBackBefore(before, who) ? "regular" : "sale", who });
  }
  // 反超要真的从落后翻上来：0:0 那一拍你先开张， headline 该是「成交」，不是「超过对面了」。
  // 反过来那一下不留这个口子 —— 对面先开张是要紧的警讯，哪怕当时还打平。
  if (margin(before) < 0 && margin(after) > 0) out.push({ kind: "lead", who: null });
  if (margin(before) >= 0 && margin(after) < 0) out.push({ kind: "trail", who: null });
  return out;
}

export const byPriority = (moments: Moment[]): Moment[] =>
  [...moments].sort((a, b) => RANK[a.kind] - RANK[b.kind]);

export const momentSound: Record<MomentKind, SfxKind> = {
  sale: "register", regular: "regular", lead: "lead", trail: "down",
};

export const momentAnchor: Record<MomentKind, MomentAnchor[]> = {
  // 回头客是两件事一起发生：钱到账，而且回来的是她 —— 所以那一格和她那块名牌一起亮。
  sale: ["money"], regular: ["money", "person"], lead: ["score"], trail: ["score"],
};

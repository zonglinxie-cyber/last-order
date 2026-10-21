import type { PersonId, World } from "./types.ts";

/** 两家共用顾客的购买间隔；成交归属分开，不能把对面买家算成自己的熟客。 */
export const BUY_INTERVAL_DAYS = 10;
export const lastPurchaseDay = (world: World, id: PersonId): number =>
  Math.max(world.qualities[`bought:${id}`] ?? 0, world.qualities[`rival-bought:${id}`] ?? 0);
export const recentlyPurchased = (world: World, id: PersonId): boolean => purchaseCooldownOf(world, id) !== null;

/** 最近一次购买还在间隔里时，把「第几天、在哪边买、还差几天」一次读出。
 *  两家共用间隔，来源分开：玩家的成交记 bought:，对面的记 rival-bought:。 */
export type PurchaseCooldown = { day: number; source: "you" | "rival"; left: number };
export const purchaseCooldownOf = (world: World, id: PersonId): PurchaseCooldown | null => {
  const mine = world.qualities[`bought:${id}`] ?? 0;
  const rival = world.qualities[`rival-bought:${id}`] ?? 0;
  const day = Math.max(mine, rival);
  const left = BUY_INTERVAL_DAYS - (world.day - day);
  if (day <= 0 || left <= 0) return null;
  return { day, source: mine >= rival ? "you" : "rival", left };
};

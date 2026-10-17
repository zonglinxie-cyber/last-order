import type { PersonId, World } from "./types.ts";

/** 两家共用顾客的购买间隔；成交归属分开，不能把对面买家算成自己的熟客。 */
export const BUY_INTERVAL_DAYS = 10;
export const lastPurchaseDay = (world: World, id: PersonId): number =>
  Math.max(world.qualities[`bought:${id}`] ?? 0, world.qualities[`rival-bought:${id}`] ?? 0);
export const recentlyPurchased = (world: World, id: PersonId): boolean => {
  const day = lastPurchaseDay(world, id);
  return day > 0 && world.day - day < BUY_INTERVAL_DAYS;
};

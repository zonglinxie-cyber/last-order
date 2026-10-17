import { SHELF } from "./shelf.ts";
import type { Slot, World } from "./types.ts";

export const RIVAL_INVITE_ENERGY = 6;
export const RIVAL_INVITE_SAMPLES = 1;
const BOOKING_SLOTS: readonly Slot[] = [1, 3];
/** 固定营业安排，不读玩家比分。首季第一周只保留原有周末单。 */
export const rivalBookingSlots = (world: Pick<World, "season" | "day">): readonly Slot[] =>
  world.season > 1 || world.day > 7 ? BOOKING_SLOTS : [];
export const rivalBookingNow = (world: World) => world.rivalBooking?.day === world.day
  && world.rivalBooking.slot === world.slot ? world.rivalBooking : undefined;

/** 公示的报价也会参与结账，损坏时不能凭空造一笔收入。缺字段的旧档照常读。 */
export function validRivalBooking(value: unknown): value is NonNullable<World["rivalBooking"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const b = value as Record<string, unknown>;
  const product = typeof b.product === "string" && Object.hasOwn(SHELF, b.product)
    ? SHELF[b.product as keyof typeof SHELF] : undefined;
  return Number.isInteger(b.day) && Number(b.day) >= 1 && BOOKING_SLOTS.includes(b.slot as Slot)
    && (b.weekend === undefined || typeof b.weekend === "boolean")
    && typeof b.person === "string" && b.person.length > 0 && !!product
    && Number.isInteger(b.units) && Number(b.units) > 0
    && b.amount === product.price * Number(b.units) && Number.isSafeInteger(b.amount)
    && typeof b.invited === "boolean"
    && (b.outcome === undefined || b.outcome === "player" || b.outcome === "rival" || b.outcome === "missed");
}

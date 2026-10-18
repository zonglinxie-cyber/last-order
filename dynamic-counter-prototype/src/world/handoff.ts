// 托单的经营选择：一个纯预览函数，只读公开条件，帮玩家决定"只照看"还是"合适就代卖"。
// 不写世界、不掷骰、不算隐藏适配或最优商品 —— 界面据此说明成本与把握，但"可尝试代卖"从不承诺成交。

import type { Person, PersonId, World } from "./types.ts";
import {
  addOpinion, availableVerbs, handoffDayKey, handoffSaleDayKey, HANDOFF_SALE_MIN_OPINION, HANDOFF_STAFF_OPINION,
  opinionOf, personOf, qualityOf, verbEnergyNow,
} from "./engine.ts";
import { recentlyPurchased } from "./purchases.ts";

export type HandoffMode = "watch" | "sell";

export type HandoffPreview = {
  staffId: PersonId; customerId: PersonId;
  staffName: string; customerName: string;
  /** 此刻能不能托这一单（角色、在场、精力、同事当天照看名额）。watch/sell 共用这道门槛。 */
  can: boolean;
  energyCost: number;
  /** 同事当天的照看名额是否还空着；用掉就两样都托不了。 */
  staffWatchFree: boolean;
  staffTrust: number;
  /** 认托单动作本身加的那点看法之后的值，代卖门槛按这个数念。 */
  staffTrustAfterHandoff: number;
  meetsSellThreshold: boolean;
  /** 全柜当日代卖名额是否还空着；用掉了照样能只托人照看。 */
  cabinetSaleFree: boolean;
  needKnown: boolean;
  recentlyBought: boolean;
  /** 公开条件都齐了才有"可以尝试代卖"，仍不代表一定成交（适配与货由柜上判）。 */
  sellOfferable: boolean;
  watchNote: string;
  sellNotes: string[];
};

/** targets 用动作本来的顺序：[同事, 客人]。给反了或不在场，availableVerbs 自然判不可托。 */
export function handoffPreview(world: World, people: Person[], targets: PersonId[]): HandoffPreview {
  const [staffId, customerId] = targets;
  const staff = personOf(people, staffId);
  const customer = personOf(people, customerId);
  const staffName = staff?.name ?? "同事";
  const customerName = customer?.name ?? "客人";
  const energyCost = verbEnergyNow(world, "handoff");
  const can = availableVerbs(world, people, targets).includes("handoff");
  const staffWatchFree = !qualityOf(world, handoffDayKey(world.day, staffId));
  const staffTrust = opinionOf(world, staffId);
  const staffTrustAfterHandoff = opinionOf(addOpinion(world, staffId, HANDOFF_STAFF_OPINION), staffId);
  const meetsSellThreshold = staffTrustAfterHandoff >= HANDOFF_SALE_MIN_OPINION;
  const cabinetSaleFree = !qualityOf(world, handoffSaleDayKey(world.day));
  // 只认托单本来就要读的公开信号：此前问出过诉求或买过 —— 不去碰隐藏适配、最优货或秘密。
  const needKnown = !!customer?.skin && (customer.skin.demands.some(d => qualityOf(world, `client-note:${customer.id}:${d.trait}`) === 1)
    || qualityOf(world, `bought:${customer.id}`) > 0);
  const recentlyBought = !!customer && recentlyPurchased(world, customer.id);
  const hasSkin = !!customer?.skin;
  const sellOfferable = hasSkin && meetsSellThreshold && cabinetSaleFree && needKnown && !recentlyBought;

  const sellNotes: string[] = [];
  if (!hasSkin) sellNotes.push(`${customerName}没留下可照看的诉求，同事没法替你开单。`);
  if (!meetsSellThreshold) sellNotes.push(`${staffName}再熟一点才接得住代卖：托单后看法 ${staffTrustAfterHandoff}，门槛 ${HANDOFF_SALE_MIN_OPINION}。`);
  if (!needKnown && hasSkin) sellNotes.push(`还没问出${customerName}要什么，同事不好替你开这一单。`);
  if (recentlyBought) sellNotes.push(`${customerName}这几天刚买过，先不重复推。`);
  if (!cabinetSaleFree) sellNotes.push("今天柜上已经代卖过一单，这次只能托人照看。");

  return {
    staffId, customerId, staffName, customerName, can, energyCost, staffWatchFree,
    staffTrust, staffTrustAfterHandoff, meetsSellThreshold, cabinetSaleFree, needKnown, recentlyBought,
    sellOfferable,
    watchNote: `${energyCost} 精力 · 只请${staffName}这一时段照看${customerName}，留你亲自接、也留多件成交的机会。照看只守当口，人不替你留到下个时段。`,
    sellNotes,
  };
}

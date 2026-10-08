// 七日周目（?mode=run）的规则层：排程、目标、增幅、存档都在这里，销售经济不动 —
// 成交、耐心、小样、台账仍然全部走 campaign.ts 的公开函数，这一层只负责"这一周是谁、目标多少、局间选什么"。
import {
  CUSTOMERS, hasFlag, history, INITIAL, metersFor, parseCampaign, PRODUCTS, weekOf,
  type Campaign, type CustomerId, type DayStory,
} from "./campaign.ts";
import { duelRandom } from "./duel.ts";

export type RunSeed = string; // 形如 "week-2:7"：<第几周>:<该周的索引>
const RUN_SEED_RE = /^week-(\d+):(\d+)$/;

export const RUN_SAVE_KEY = "last-order-run-v1";

// 链内顾客（returning / zhou2 / anjie2）的会话文本本身就成立，直接进池；
// 生成周不挂动态链 —— floorCustomers 只在 canonical 章节追加 zhou2 / anjie2。
const RUN_POOL: CustomerId[] = Object.keys(CUSTOMERS) as CustomerId[];

// 同一颗种子出同一副周牌：洗池子、人数、每天分几张都读同一个 rand 流。
export function runWeek(seed: RunSeed): DayStory[] {
  const rand = duelRandom(`run:${seed}`);
  const pool = [...RUN_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // 整周客流 7~10 人次：每天先保底 1 位，剩下的按种子轮着加到当天最多 3 位。
  const total = 7 + Math.floor(rand() * 4);
  const sizes = [1, 1, 1, 1, 1];
  for (let extra = total - 5, at = Math.floor(rand() * 5); extra > 0; at = (at + 1) % 5) {
    if (sizes[at] >= 3) continue;
    sizes[at] += 1; extra -= 1;
  }
  const days: DayStory[] = [];
  for (let day = 0; day < 5; day++) {
    const customers = pool.splice(0, sizes[day]);
    days.push({
      day: day + 1,
      title: `活动周 · 第 ${day + 1} 天`,
      subtitle: customers.map(id => CUSTOMERS[id].descriptor).join(" · "),
      brief: `今天柜前排 ${customers.map(id => CUSTOMERS[id].name).join("、")}。客流是这一周的抽牌，不是剧情安排——看准谁走得起、谁等不起。`,
      threat: day === 4 ? "最后一天，没接到的需求不会再回来" : "没接住的顾客当天就走，不会有第二次排期",
      customers,
    });
  }
  return days;
}

// 周目标对着本周顾客预算打 0.65~0.75 折取整百位：这个比例是从 canonical 两条实测路线之间内插的折中 —
// 清洁连带路线做到 ¥22,930（预算合计的 ~0.92），只卖一件的路线只有 ¥13,390（~0.58）；
// 七成上下意味着"接上大多数顾客、连带谈到一半"就够得着，不需要全员清空抽屉。
export function runTarget(seed: RunSeed): number {
  const rand = duelRandom(`target:${seed}`);
  const budget = runWeek(seed).flatMap(day => day.customers).reduce((sum, id) => sum + CUSTOMERS[id].budget, 0);
  return Math.round(budget * (0.65 + rand() * 0.1) / 100) * 100;
}

export function startRun(seed: RunSeed): Campaign {
  const week = runWeek(seed);
  return { ...INITIAL, week, target: runTarget(seed), runSeed: seed, day: 1, waitMeters: metersFor(week[0].customers) };
}

// 局间三选一：全是 flags 里一面旗或一次立即结算，不新开存档字段。
// perk:edge 的阈值由 duel.ts 的 duelBundleGate 读（duelUnlockedBundles / duelClose 同一个数），这里只挂旗。
export type RunPerk = { id: string; label: string; detail: string; gated?: (s: Campaign) => boolean; apply: (s: Campaign) => Campaign };
export const RUN_PERKS: RunPerk[] = [
  { id: "perk:edge", label: "话术手感", detail: "牌局连带档位的兴趣门槛 −15（single 45 / pair 60 / set·bulk 75）", apply: s => s },
  { id: "perk:sample-x2", label: "小样更走心", detail: "每场留小样多 +1 信任", apply: s => s },
  { id: "perk:shift:+5", label: "早到五分钟", detail: "今天在场的每位顾客耐心 +5", gated: s => s.day < weekOf(s).length, apply: s => ({
    ...s, waitMeters: Object.fromEntries(weekOf(s)[s.day - 1].customers.map(id => [id, (s.waitMeters[id] ?? CUSTOMERS[id].patience) + 5])),
  }) },
  { id: "perk:target:-10%", label: "目标九折", detail: "本周目标当场 −10%（取整到百位）", gated: s => s.target !== undefined, apply: s => ({ ...s, target: Math.round(s.target! * 0.9 / 100) * 100 }) },
  { id: "perk:ledger:+6", label: "台账底子", detail: "台账合规 +6", apply: s => ({ ...s, compliance: Math.min(100, s.compliance + 6) }) },
  { id: "perk:energy:+15", label: "多喝一杯美式", detail: "体力 +15（上限 100）", apply: s => ({ ...s, energy: Math.min(100, s.energy + 15) }) },
  { id: "perk:samples:+2", label: "多领两支小样", detail: "手上小样 +2", apply: s => ({ ...s, samples: s.samples + 2 }) },
];

// 没拿过、条件满足的里面取前三条；顺序固定成 RUN_PERKS 的顺序，刷新不换选项。
export function perkChoices(s: Campaign): RunPerk[] {
  return RUN_PERKS.filter(perk => !hasFlag(s, perk.id) && (!perk.gated || perk.gated(s))).slice(0, 3);
}

export function applyRunPerk(s: Campaign, perkId: string): Campaign {
  const perk = RUN_PERKS.find(item => item.id === perkId);
  if (!perk || hasFlag(s, perk.id) || (perk.gated && !perk.gated(s))) return s;
  // 旗子和效果同一处落账：perk-pending 摘掉、perk:<id> 挂上，账本留一行增幅来历。
  const applied = perk.apply({ ...s, flags: [...s.flags.filter(f => f !== "perk-pending"), perk.id] });
  return { ...applied, history: history(applied, `局间增幅 · ${perk.label}`) };
}

export function nextRunSeed(s: Campaign): RunSeed | null {
  const hit = RUN_SEED_RE.exec(s.runSeed ?? "");
  return hit ? `week-${Number(hit[1]) + 1}:${Number(hit[2]) + 1}` : null;
}

// perk-pending 由 RunGame 在 startNextDay 之后挂、applyRunPerk 之前摘：存档落到这一手时，
// 界面重新打开要把三选一摆回她面前，否则那次增幅会被刷新吃掉。第 5 天入场也算（前一晚结束的增幅屏），
// 但周已结算（finished）就不再弹。
export const perkPending = (s: Campaign) => s.week !== undefined && hasFlag(s, "perk-pending") && !s.finished;

export function loadRun(): Campaign | null {
  try { return parseCampaign(window.localStorage.getItem(RUN_SAVE_KEY)); } catch { return null; }
}

export function saveRun(s: Campaign) {
  try { window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(s)); } catch { /* 私密模式存不进就不存 */ }
}

export function clearRun() {
  try { window.localStorage.removeItem(RUN_SAVE_KEY); } catch { /* 同上 */ }
}

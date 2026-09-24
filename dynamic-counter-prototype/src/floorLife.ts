import { CUSTOMERS, relationText, type Campaign, type Customer, type CustomerId, type StaffKey } from "./campaign";

export type FloorStaffId = Exclude<StaffKey, "player">;
export type FloorFocus = { kind: "customer"; id: CustomerId } | { kind: "staff"; id: FloorStaffId };
export type Spot = { left: number; top: number; face: 1 | -1 };
export type ActorPose = Spot & { destLeft: number; destTop: number };
export type FloorSpeed = 0 | 1 | 2 | 4;

export const WAYPOINTS = {
  // 下面这一排是"站得住的下限"：矮到 568 高的手机上，控制台从 61% 开始往上盖，
  // 名牌要留 4px 以上，所以最矮的落点压在 57~58（原来 61~63 时罗曼巡完一圈牌子就滑进面板里了）。
  entrance: { left: 16, top: 58 },
  aisle: { left: 20, top: 56 },
  tester: { left: 27, top: 43 },
  testerSide: { left: 39, top: 50 },
  open: { left: 56, top: 53 },
  openLow: { left: 63, top: 58 },
  exit: { left: 20, top: 58 },
  checkout: { left: 80, top: 57 },
  romanSide: { left: 66, top: 59 },
  rivalHold: { left: 15, top: 54 },
  rivalClose: { left: 26, top: 52 },
};

export function customerHome(index: number, meter: number, max: number): { left: number; top: number } {
  if (meter <= 2) return WAYPOINTS.exit;
  if (index === 0) return meter <= max * 0.5 ? WAYPOINTS.testerSide : WAYPOINTS.tester;
  return meter <= max * 0.5 ? WAYPOINTS.openLow : WAYPOINTS.open;
}

export function rivalHome(approach: number): { left: number; top: number } {
  const t = Math.max(0, Math.min(1, approach));
  return {
    left: WAYPOINTS.rivalHold.left + (WAYPOINTS.rivalClose.left - WAYPOINTS.rivalHold.left) * t,
    top: WAYPOINTS.rivalHold.top + (WAYPOINTS.rivalClose.top - WAYPOINTS.rivalHold.top) * t,
  };
}

export function customerSpot(index: number): Spot {
  const home = customerHome(index, 6, 6);
  return { ...home, face: home.left < 40 ? 1 : -1 };
}

export function rivalSpot(approach: number): Spot {
  const home = rivalHome(approach);
  return { ...home, face: 1 };
}

export function managerSpot(): Spot {
  return { ...WAYPOINTS.checkout, face: -1 };
}

export function poseAt(spot: { left: number; top: number }, from = WAYPOINTS.entrance): ActorPose {
  return { left: from.left, top: from.top, destLeft: spot.left, destTop: spot.top, face: spot.left >= from.left ? 1 : -1 };
}

export function stepPose(pose: ActorPose, speed: number): ActorPose {
  const dx = pose.destLeft - pose.left;
  const dy = pose.destTop - pose.top;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.45) return { ...pose, left: pose.destLeft, top: pose.destTop };
  const move = Math.min(dist, 1.15 * Math.max(1, speed));
  return {
    ...pose,
    left: pose.left + (dx / dist) * move,
    top: pose.top + (dy / dist) * move,
    face: Math.abs(dx) < 0.2 ? pose.face : dx >= 0 ? 1 : -1,
  };
}

export function isWalking(pose: ActorPose) {
  return Math.hypot(pose.destLeft - pose.left, pose.destTop - pose.top) > 0.6;
}

export function rivalApproach(ids: CustomerId[], meters: Campaign["waitMeters"], elapsed = 0) {
  const contested = ids.filter(id => CUSTOMERS[id].rival);
  if (!contested.length) return 0;
  const lowest = Math.min(...contested.map(id => meters[id] ?? CUSTOMERS[id].patience));
  const byMeter = 1 - Math.max(0, Math.min(1, lowest / 4));
  const byTime = Math.max(0, Math.min(0.7, elapsed / 90));
  return Math.max(byMeter, byTime);
}

export function defaultFocus(ids: CustomerId[], meters: Campaign["waitMeters"]): FloorFocus | null {
  if (!ids.length) return null;
  const urgent = [...ids].sort((a, b) => (meters[a] ?? CUSTOMERS[a].patience) - (meters[b] ?? CUSTOMERS[b].patience))[0];
  return { kind: "customer", id: urgent };
}

export function customerAction(customer: Customer, meter: number, resumed: boolean, rivalNear: boolean) {
  if (resumed) return "接待还没结束，人还在柜台前";
  if (rivalNear) return "陆遥已经靠到试妆台";
  if (meter <= 2) return "在往商场通道挪";
  if (customer.rival) return "停在试妆台前对比";
  return "在开放区等你开口";
}

export function customerMood(customer: Customer, meter: number) {
  if (meter <= 2) return "不耐烦";
  if (customer.rival) return "戒备";
  return "观望";
}

/** 现场每一拍是 380 毫秒（`Prototype.tsx` 的 setInterval），而台词中位 12~18 字：
    按拍子轮台词等于一句话只闪 380 毫秒，谁都读不完。所以这里改成"一句台词对一个状态"——
    状态不变，话就不变；话变了，是因为现场真的变了（她开始看表、陆遥靠过来了）。 */
export function firstClause(line: string) {
  const cut = line.indexOf("。");
  return cut < 0 ? line : line.slice(0, cut + 1);
}

export function customerSpeech(customer: Customer, meter: number, resumed: boolean, rivalNear: boolean, whole = false) {
  if (resumed) return "我还在这儿。";
  if (meter <= 1) return "你们还接不接？";
  if (meter <= 2) return "我真的要走了。";
  if (rivalNear) return "对面也在看我。";
  if (meter <= customer.patience * 0.5) return "我时间不多。";
  return whole ? customer.opening : firstClause(customer.opening);
}

/** 从"没被点中的在场人"里挑一个开口的：按"你该先看谁"排，不按拍子轮。
    陆遥靠过来就先听她（这是截胡的预警），否则听耐心最少的那位客人，都没有客人就听同事。 */
export function voiceTarget(candidates: FloorFocus[], meters: Campaign["waitMeters"], closeness: number): FloorFocus | null {
  if (closeness > .4) {
    const luyao = candidates.find(entry => entry.kind === "staff" && entry.id === "luyao");
    if (luyao) return luyao;
  }
  const waiting = candidates.filter(entry => entry.kind === "customer")
    .sort((a, b) => (a.kind === "customer" ? meters[a.id] ?? CUSTOMERS[a.id].patience : 0) - (b.kind === "customer" ? meters[b.id] ?? CUSTOMERS[b.id].patience : 0));
  return waiting[0] ?? candidates[0] ?? null;
}

export function staffAction(id: FloorStaffId, contested: boolean) {
  return id === "luyao" ? (contested ? "正在靠近你的客人" : "在对面观察") : "在收银位看今日排名";
}

export function staffMood(id: FloorStaffId, relation: number) {
  if (id === "luyao") return relation < 40 ? "伺机截胡" : "较劲";
  return relation >= 50 ? "压着场子" : "在盯数字";
}

export function staffSpeech(id: FloorStaffId, contested: boolean) {
  return id === "luyao" ? (contested ? "你要先接谁？" : "我在对面看着。") : "入口位不能空太久。";
}

export function waitCopy(meter: number, max: number) {
  if (meter <= 1) return "马上要走";
  if (meter <= 2) return "已经在看表";
  if (meter <= max * 0.5) return "耐心只剩一半";
  return `还会再等 ${meter} 拍`;
}

export function partyLines(ids: CustomerId[], campaign: Campaign, contested: boolean) {
  const rows = ids.map(id => {
    const customer = CUSTOMERS[id];
    const meter = campaign.waitMeters[id] ?? customer.patience;
    const resumed = campaign.activeSession?.customerId === id;
    return `${customer.name} · ${customerAction(customer, meter, resumed, contested && customer.rival)}`;
  });
  rows.push(`陆遥 · ${staffAction("luyao", contested)}`);
  rows.push(`罗曼 · ${staffAction("roman", contested)}`);
  return rows;
}

export function staffRelation(campaign: Campaign, id: FloorStaffId) {
  if (id === "luyao") return relationText(campaign.relations.luyao);
  if (id === "roman") return relationText(campaign.relations.roman);
  if (id === "suman") return relationText(campaign.relations.suman);
  if (id === "tangke") return relationText(campaign.relations.tangke);
  return relationText(50);
}

export function formatClock(minutes: number) {
  const wrapped = ((Math.floor(minutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export const SHIFT_START = 19 * 60 + 8;

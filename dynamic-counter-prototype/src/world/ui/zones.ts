// 楼层底图（public/assets/game/mall-floor.jpg，1280×720 横图）上各区域的站位。
// 坐标是图面百分比：x 向右、y 向下，人把脚落在点上（元素自己做 translate 对准）。
// 对照底图摆的：左边金色柜是自家柜、中间带收银机的台子是收银、右边紫色柜是维珞、
// 上方橱窗和栏杆那一带是中庭、下沿是入口、左下绿植旁是休息区、左上暗门是员工通道。
import type { Slot, Zone } from "../types.ts";

export type Spot = { x: number; y: number };

// 每区的前段站位留给"自己人"：柜台后面的同事、维珞柜里的陆遥、中庭的商场方。
// 后段才是顾客/客人的站位；WorldGame 按角色把同区的人分进这两段。
export const ZONE_STAFF_SPOTS: Record<Zone, Spot[]> = {
  counter: [{ x: 10.5, y: 66 }, { x: 14, y: 63 }, { x: 17.5, y: 60.5 }, { x: 21, y: 58 }],
  cashier: [{ x: 42, y: 24 }, { x: 46, y: 22 }, { x: 38, y: 26 }],
  rival: [{ x: 80, y: 56 }, { x: 85, y: 52 }],
  atrium: [{ x: 62, y: 22 }, { x: 55, y: 28 }, { x: 69, y: 24 }],
  lounge: [{ x: 10, y: 72 }],
  entrance: [{ x: 51, y: 94 }],
  backroom: [{ x: 3, y: 46 }, { x: 5, y: 53 }, { x: 2.5, y: 40 }],
};

export const ZONE_SPOTS: Record<Zone, Spot[]> = {
  counter: [{ x: 24, y: 77 }, { x: 29, y: 79 }, { x: 34, y: 76 }, { x: 39, y: 73 }, { x: 20, y: 72 }],
  cashier: [{ x: 44, y: 51 }, { x: 48, y: 49 }, { x: 52, y: 53 }],
  rival: [{ x: 66, y: 78 }, { x: 68, y: 66 }, { x: 72, y: 87 }, { x: 64, y: 72 }],
  atrium: [{ x: 62, y: 22 }, { x: 55, y: 28 }, { x: 69, y: 24 }, { x: 58, y: 18 }, { x: 75, y: 20 }],
  lounge: [{ x: 10, y: 72 }, { x: 15, y: 78 }, { x: 7, y: 66 }],
  entrance: [{ x: 51, y: 94 }, { x: 44, y: 92 }, { x: 59, y: 90 }, { x: 66, y: 95 }],
  backroom: [{ x: 3, y: 46 }, { x: 5, y: 53 }, { x: 2.5, y: 40 }],
};

// 路人（纯装饰的一层人流）走的几条通道：坐标同样是图面百分比，按顺序一段段走过去，
// 每条都可以倒着走一遍。都挑的空地：中间那条主通道、维珞柜外侧、下沿到左下休息区、
// 上方那一排橱窗前。站位点让给在场的人物，路人只从它们旁边过。
export type WalkPath = Spot[];

export const WALK_PATHS: WalkPath[] = [
  // 入口 → 中庭：从下沿进门，沿中间的主通道一路走到上方天井那一片
  [{ x: 51, y: 93 }, { x: 51, y: 80 }, { x: 53, y: 66 }, { x: 56, y: 52 }, { x: 59, y: 38 }, { x: 61, y: 27 }],
  // 中庭 → 维珞：从中庭拐下来，贴着维珞柜外侧走到柜前
  [{ x: 61, y: 27 }, { x: 65, y: 36 }, { x: 68, y: 46 }, { x: 69, y: 57 }, { x: 68, y: 68 }],
  // 入口 ↔ 休息区：下沿横穿到左下的绿植那一片
  [{ x: 46, y: 92 }, { x: 36, y: 88 }, { x: 26, y: 84 }, { x: 16, y: 80 }, { x: 9, y: 76 }],
  // 沿橱窗横穿：贴着上方那一排店铺橱窗从左往右穿过去
  [{ x: 50, y: 36 }, { x: 57, y: 32 }, { x: 64, y: 28 }, { x: 72, y: 25 }, { x: 80, y: 24 }, { x: 88, y: 26 }],
];

// 路人的节奏。和通道摆在一起，是因为这几个数只有对着图才量得出来；
// 界面（Passersby.tsx）只读不算，走查用例钉的也是这一份。
/** 四个时段各自的常驻人流：上午冷清，晚高峰最挤。 */
export const PB_BASE: Record<Slot, number> = { 0: 3, 1: 4, 2: 5, 3: 6 };
/** 节日窗口再挤进来两位。 */
export const PB_FESTIVAL_EXTRA = 2;
/** 走路图：两张顾客图 × 两行 = 四种人。 */
export const PB_VARIANTS = 4;
/** 单趟通道压在 16~34 秒之间：太快不像逛街，太慢半天不动地方。 */
export const PB_SECONDS = { min: 16, max: 34, perPercent: 0.44 } as const;
/** 场上少一个人之后，隔多久补一个上来（毫秒）。 */
export const PB_SPAWN_GAP = { min: 300, max: 1200 } as const;

/** 通道越长走得越久。 */
export function pathSeconds(path: number): number {
  const points = WALK_PATHS[path];
  let dist = 0;
  for (let i = 1; i < points.length; i++) dist += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return Math.min(PB_SECONDS.max, Math.max(PB_SECONDS.min, dist * PB_SECONDS.perPercent));
}

/** 每条通道一段 @keyframes：把百分比坐标换算成 cqw/cqh 的位移，交给 transform 走。
    坐标是地图百分比，位移得跟着地图容器的实际尺寸走，所以用容器查询单位而不是像素。 */
export const walkKeyframes = WALK_PATHS.map((points, i) => {
  const [head] = points;
  const stops = points.map((p, k) =>
    `  ${((k / (points.length - 1)) * 100).toFixed(2)}% { transform: translate(calc(${(p.x - head.x).toFixed(2)} * 1cqw), calc(${(p.y - head.y).toFixed(2)} * 1cqh)); }`).join("\n");
  return `@keyframes wf-pb-walk-${i} {\n${stops}\n}`;
}).join("\n");

// 区域名牌钉在图上的位置，纯装饰（aria-hidden）。2026-10-09 对着底图逐点画圈核过一遍。
export const ZONE_LABEL: Record<Zone, { word: string } & Spot> = {
  counter: { word: "绮光", x: 21, y: 4 },
  cashier: { word: "收银", x: 42, y: 16 },
  rival: { word: "维珞", x: 84, y: 27 },
  atrium: { word: "中庭", x: 66, y: 9 },
  lounge: { word: "休息区", x: 8, y: 82 },
  entrance: { word: "入口", x: 51, y: 99 },
  backroom: { word: "员工通道", x: 5, y: 33 },
};

// 带 .ts 后缀是为了这份几何能被 node --experimental-strip-types 的规则测试直接跑。
import { WORLD, route, walkable, type Point } from "./rush-rules.ts";

// 现场与《闭店大作战》共用同一张商场图和同一套可行走几何：坐标只在 rush-rules 里校准一次。
// 间距契约是像素量，不是感觉：名牌是固定 CSS 像素的（实测最宽 64px、两行高 40px），沙盘只是等比缩放。
// 取最窄的"还不收起名牌"那一档 1024×700 = 0.772 px/单位换算：66/0.772 = 86 → 取 90，42/0.772 = 54 → 取 60。
// 于是能同时站定的两个人必须横向差 ≥90 单位或纵向差 ≥60 单位，否则名字会盖在彼此脸上。
export const NAME_X = 90, NAME_Y = 60;
// 反过来算：缩到 66/90 以下时同样的横向间距已经容不下两张最宽名牌，只能把路人牌子收起来。
export const TIGHT_PLATE_SCALE = 66 / NAME_X;
// 站位按这条间距排：柜台前 430、外线 510、门口 530。
export const STAGE_SPOTS = {
  register: { x: 258, y: 432 },
  till: { x: 200, y: 360 },
  stockCorner: { x: 180, y: 435 },
  stockWall: { x: 130, y: 260 },
  stockShelf: { x: 175, y: 195 },
  upperShelf: { x: 560, y: 210 },
  backOffice: { x: 330, y: 200 },
  aisleMid: { x: 560, y: 300 },
  counterGap: { x: 470, y: 300 },
  weiloEdge: { x: 700, y: 230 },
  luyaoPost: { x: 655, y: 290 },
  weilo: { x: 760, y: 470 },
  mirror: { x: 470, y: 430 },
  makeupStool: { x: 415, y: 510 },
  browseA: { x: 560, y: 430 },
  browseB: { x: 505, y: 510 },
  island: { x: 650, y: 430 },
  aisleLow: { x: 595, y: 510 },
} satisfies Record<string, Point>;


// 一个游戏分钟 = 现场 20 秒。这个步速让一次挪位在 1× 下约五秒走完：看得见，但不抢戏。
const UNITS_PER_MINUTE = 800;
const DWELL_MINUTES = 1.6;

export type Beat = { spots: Point[]; dwell?: number; pace?: number };
export type Pose = { point: Point; facing: 1 | -1; moving: boolean };

export const standing = (spot: Point): Beat => ({ spots: [spot], dwell: 999 });

// 员工走内侧补货线，顾客走外侧试妆线；航点两两不重复，站桩时才不会叠成一个人。
export const STAFF_BEATS = {
  xuyuan: { spots: [STAGE_SPOTS.register, STAGE_SPOTS.till, STAGE_SPOTS.stockCorner] },
  luyao: { spots: [STAGE_SPOTS.luyaoPost, STAGE_SPOTS.weilo] },
  roman: { spots: [STAGE_SPOTS.counterGap, STAGE_SPOTS.weiloEdge] },
  suman: { spots: [STAGE_SPOTS.stockWall, STAGE_SPOTS.stockShelf, STAGE_SPOTS.upperShelf] },
  tangke: { spots: [STAGE_SPOTS.backOffice, STAGE_SPOTS.aisleMid] },
} satisfies Record<string, Beat>;

// 一天最多两位顾客在场，所以两条试妆线就够了；两条之间也不共用航点。
export const BROWSE_BEATS: Beat[] = [
  { spots: [STAGE_SPOTS.browseA, STAGE_SPOTS.browseB] },
  { spots: [STAGE_SPOTS.island, STAGE_SPOTS.aisleLow] },
];
// 走掉的人按当天序号各占一个门口位置，不会两个人挤在同一格。
// 一天最多两位顾客在场（`floorCustomers` 的上界），所以这里只要两格；两格之间按 NAME_X 留够一张名牌。
// 最右那格不往地图角落放：手机上沙盘放大后仍然能拖到边，但留点余量总不会错。
export const EXIT_SPOTS: Point[] = [{ x: 690, y: 530 }, { x: 785, y: 530 }];
// 还在等的客人只是"朝自己那格门口挪"，用一条直线挪：直线从维珞柜台下方（y>458）穿过。
// OBSTACLES 本来就是按脚位外扩过的，所以只要线段判定过得了就不会踩进柜台画里；
// 这条判定由 floor-stage 测试用精确线段相交盯着（clearLine），改坐标前先跑它。
// 已成交的人拎着袋子在外线排队，间距同样按一张名牌的宽度留够。
export const BAG_SPOTS: Point[] = [{ x: 150, y: 510 }, { x: 250, y: 510 }];


export const blend = (from: Point, to: Point, weight: number): Point => {
  const w = Math.max(0, Math.min(1, weight));
  return { x: from.x + (to.x - from.x) * w, y: from.y + (to.y - from.y) * w };
};

// 一张名牌的宽度再留一点余量：迎上去的人要站到对方身旁，而不是站进她的名字里。
const NAME_LANE = 95;

/** 离 `from` 较远那一侧的让位点；两侧都塞不进柜台就退回原位，由调用方决定要不要走过去。 */
export function standBeside(from: Point, to: Point): Point {
  const near = to.x <= from.x ? -NAME_LANE : NAME_LANE;
  for (const dx of [near, -near]) {
    const point = { x: Math.max(100, Math.min(940, to.x + dx)), y: to.y };
    if (walkable(point)) return point;
  }
  return to;
}

type Leg = { path: Point[]; length: number; minutes: number };
type Plan = { legs: Leg[]; cycle: number; dwell: number };
const plans = new Map<string, Plan>();

function planOf(beat: Beat): Plan {
  const key = beat.dwell + "|" + beat.pace + "|" + beat.spots.map(spot => spot.x + "," + spot.y).join(";");
  const cached = plans.get(key);
  if (cached) return cached;
  const dwell = beat.dwell ?? DWELL_MINUTES;
  const pace = beat.pace ?? UNITS_PER_MINUTE;
  const legs: Leg[] = beat.spots.map((from, index) => {
    const to = beat.spots[(index + 1) % beat.spots.length];
    const path = [from, ...route(from, to)];
    let length = 0;
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    return { path, length, minutes: length / pace };
  });
  const plan = { legs, cycle: legs.reduce((sum, leg) => sum + leg.minutes + dwell, 0), dwell };
  plans.set(key, plan);
  return plan;
}

/** 沿一条腿走 `travel` 个世界单位；dx 用来决定人物朝向。 */
function along(leg: Leg, travel: number): { point: Point; dx: number } {
  let left = travel;
  for (let i = 1; i < leg.path.length; i++) {
    const from = leg.path[i - 1], to = leg.path[i];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (left <= length || i === leg.path.length - 1) return { point: blend(from, to, length ? left / length : 1), dx: to.x - from.x };
    left -= length;
  }
  return { point: leg.path[0], dx: 0 };
}

/** 位置是现场时间的纯函数：暂停就定住，刷新回到同一格，不需要额外的动画计时器。 */
export function poseOn(beat: Beat, minutes: number, phase = 0): Pose {
  const plan = planOf(beat);
  let left = (((minutes + phase) % plan.cycle) + plan.cycle) % plan.cycle;
  let facing: 1 | -1 = 1;
  for (const leg of plan.legs) {
    if (left <= plan.dwell) return { point: leg.path[0], facing, moving: false };
    left -= plan.dwell;
    if (left < leg.minutes) {
      const moved = along(leg, leg.length * (left / Math.max(0.0001, leg.minutes)));
      return { point: moved.point, facing: moved.dx < 0 ? -1 : 1, moving: true };
    }
    left -= leg.minutes;
    facing = leg.path.at(-1)!.x - leg.path[0].x < 0 ? -1 : 1;
  }
  return { point: beat.spots[0], facing, moving: false };
}

export const worldToPercent = (point: Point) => ({ left: point.x / WORLD.width * 100 + "%", top: point.y / WORLD.height * 100 + "%" });
export const worldZ = (point: Point) => Math.round(point.y);

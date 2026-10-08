// 楼层底图（public/assets/game/mall-floor.jpg，1280×720 横图）上各区域的站位。
// 坐标是图面百分比：x 向右、y 向下，人把脚落在点上（元素自己做 translate 对准）。
// 对照底图摆的：左边金色柜是自家柜、中间带收银机的台子是收银、右边紫色柜是维珞、
// 上方橱窗和栏杆那一带是中庭、下沿是入口、左下绿植旁是休息区、左上暗门是员工通道。
import type { Zone } from "../types.ts";

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

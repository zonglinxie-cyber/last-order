// 楼层底图（public/assets/game/mall-floor.jpg，1280×720 横图）上各区域的站位。
// 坐标是图面百分比：x 向右、y 向下，人把脚落在点上（元素自己做 translate 对准）。
// 对照底图摆的：左边金色柜是自家柜、中间带收银机的台子是收银、右边紫色柜是维珞、
// 上方橱窗和栏杆那一带是中庭、下沿是入口、左下绿植旁是休息区、左上暗门是员工通道。
import type { Zone } from "../types.ts";

export type Spot = { x: number; y: number };

// 每区的前段站位留给"自己人"：柜台后面的同事、维珞柜里的陆遥、中庭的商场方。
// 后段才是顾客/客人的站位；WorldGame 按角色把同区的人分进这两段。
export const ZONE_STAFF_SPOTS: Record<Zone, Spot[]> = {
  counter: [{ x: 25, y: 47 }, { x: 31, y: 44 }, { x: 36, y: 49 }, { x: 28, y: 52 }],
  cashier: [{ x: 44, y: 36 }, { x: 50, y: 33 }],
  rival: [{ x: 88, y: 44 }, { x: 93, y: 50 }],
  atrium: [{ x: 60, y: 12 }, { x: 74, y: 16 }, { x: 85, y: 13 }, { x: 52, y: 15 }],
  lounge: [{ x: 10, y: 62 }],
  entrance: [{ x: 46, y: 82 }],
  backroom: [{ x: 6, y: 15 }, { x: 10, y: 25 }, { x: 5, y: 33 }, { x: 12, y: 18 }],
};

export const ZONE_SPOTS: Record<Zone, Spot[]> = {
  counter: [{ x: 23, y: 63 }, { x: 30, y: 67 }, { x: 37, y: 63 }, { x: 27, y: 73 }, { x: 41, y: 69 }],
  cashier: [{ x: 45, y: 52 }, { x: 51, y: 49 }, { x: 56, y: 55 }],
  rival: [{ x: 76, y: 65 }, { x: 71, y: 71 }, { x: 82, y: 71 }, { x: 77, y: 77 }],
  atrium: [{ x: 55, y: 18 }, { x: 66, y: 14 }, { x: 78, y: 20 }, { x: 89, y: 16 }, { x: 96, y: 22 }],
  lounge: [{ x: 7, y: 71 }, { x: 13, y: 66 }, { x: 17, y: 74 }],
  entrance: [{ x: 38, y: 88 }, { x: 51, y: 92 }, { x: 63, y: 85 }, { x: 72, y: 90 }],
  backroom: [{ x: 5, y: 26 }, { x: 11, y: 34 }, { x: 8, y: 42 }],
};

// 区域名牌钉在图上的位置，纯装饰（aria-hidden）。
export const ZONE_LABEL: Record<Zone, { word: string } & Spot> = {
  counter: { word: "绮光", x: 30, y: 38 },
  cashier: { word: "收银", x: 47, y: 28 },
  rival: { word: "维珞", x: 86, y: 37 },
  atrium: { word: "中庭", x: 72, y: 7 },
  lounge: { word: "休息区", x: 9, y: 57 },
  entrance: { word: "入口", x: 52, y: 80 },
  backroom: { word: "员工通道", x: 6, y: 9 },
};

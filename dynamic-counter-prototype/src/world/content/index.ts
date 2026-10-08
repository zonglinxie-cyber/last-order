// 人情场正式内容的唯一入口：引擎、模拟器和界面都从这里取人物、故事碎片和节日。
import { STORYLETS as STORYLETS_SOCIAL1 } from "./storylets.ts";
import { STORYLETS_SOCIAL2 } from "./storylets-social2.ts";
import { STORYLETS_SEASON2 } from "./storylets-season2.ts";
import { STORYLETS_ARCS3 } from "./storylets-arcs3.ts";
export { PEOPLE } from "./people.ts";
export { FESTIVALS, festivalsFor } from "./festivals.ts";
// 社交碎片、第 2 季碎片、四条顾客个人线合并成唯一的 STORYLETS；引擎、模拟器和界面只读这一份。
export const STORYLETS = [...STORYLETS_SOCIAL1, ...STORYLETS_SOCIAL2, ...STORYLETS_SEASON2, ...STORYLETS_ARCS3];

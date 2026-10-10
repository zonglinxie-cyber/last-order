// 人情场正式内容的唯一入口：引擎、模拟器和界面都从这里取人物、故事碎片和节日。
import { STORYLETS as STORYLETS_SOCIAL1 } from "./storylets.ts";
import { STORYLETS_SOCIAL2 } from "./storylets-social2.ts";
import { STORYLETS_SEASON2 } from "./storylets-season2.ts";
import { STORYLETS_SEASON3 } from "./storylets-season3.ts";
import { STORYLETS_SEASON4 } from "./storylets-season4.ts";
import { STORYLETS_ARCS3 } from "./storylets-arcs3.ts";
import { STORYLETS_ARCS4 } from "./storylets-arcs4.ts";
import { STORYLETS_ARCS5 } from "./storylets-arcs5.ts";
import { STORYLETS_ARCS6 } from "./storylets-arcs6.ts";
import { STORYLETS_MAINLINE } from "./storylets-mainline.ts";
import { STORYLETS_ECHO } from "./storylets-echo.ts";
export { PEOPLE } from "./people.ts";
export { FESTIVALS, festivalsFor } from "./festivals.ts";
export { CLUES, CLUE_THREADS, MAINLINE_ACTS, clueOf, threadOf, threadKey, threadLanding, cluesOnThread, isClueId, isThreadId } from "./clues.ts";
// 社交碎片、第 2 到第 4 季碎片、二十条顾客线（第 1 季九条、第 2 季七条、第 3 季两条、第 4 季两条）、主线四幕、
// 走完的线留下的回访卡，合并成唯一的 STORYLETS；引擎、模拟器和界面只读这一份。
export const STORYLETS = [...STORYLETS_SOCIAL1, ...STORYLETS_SOCIAL2, ...STORYLETS_SEASON2, ...STORYLETS_SEASON3, ...STORYLETS_SEASON4, ...STORYLETS_ARCS3, ...STORYLETS_ARCS4, ...STORYLETS_ARCS5, ...STORYLETS_ARCS6, ...STORYLETS_MAINLINE, ...STORYLETS_ECHO];

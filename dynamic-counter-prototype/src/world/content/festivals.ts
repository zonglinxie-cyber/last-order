// 一季 28 天，节日按季取：第 1 季 520 / 618 / 七夕，第 2 季双 11 / 双 12 / 年终盘点，
// 第 3 季起循环这两套。三个窗口在各季的位置一样：开季那个周末、中段、最后三天。
// 契约里没有季长，28 是每季内容的约定。窗口里的节日卡内容由编剧逐季补。
import type { Festival } from "../types.ts";

const SEASON_ONE: Festival[] = [
  { id: "520", name: "520", fromDay: 6, toDay: 8 },
  { id: "618", name: "618", fromDay: 15, toDay: 19 },
  { id: "qixi", name: "七夕", fromDay: 26, toDay: 28 },
];

const SEASON_TWO: Festival[] = [
  { id: "double11", name: "双 11", fromDay: 6, toDay: 8 },
  { id: "double12", name: "双 12", fromDay: 15, toDay: 19 },
  { id: "yearend", name: "年终盘点", fromDay: 26, toDay: 28 },
];

const SEASONS: Festival[][] = [SEASON_ONE, SEASON_TWO];

/** 这一季的节日表。第 1 季照旧，第 2 季双 11 / 双 12 / 年终盘点，第 3 季起循环。 */
export const festivalsFor = (season: number): Festival[] =>
  SEASONS[(season - 1) % SEASONS.length] ?? SEASON_ONE;

/** 第 1 季的节日表。内容体检钉的是这一季；按季取请用 festivalsFor(season)。 */
export const FESTIVALS: Festival[] = SEASON_ONE;

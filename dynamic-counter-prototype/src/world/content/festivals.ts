// 一季 28 天。三个窗口都落在季内：520 开季那个周末，618 在中段，七夕在最后三天。
// 契约里没有季长，28 是这季内容的约定。
import type { Festival } from "../types.ts";

export const FESTIVALS: Festival[] = [
  { id: "520", name: "520", fromDay: 6, toDay: 8 },
  { id: "618", name: "618", fromDay: 15, toDay: 19 },
  { id: "qixi", name: "七夕", fromDay: 26, toDay: 28 },
];

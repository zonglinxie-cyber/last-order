// 与 src/base.ts 同一个契约的本地副本：设备边框/键盘图也要带 BASE_URL（GitHub Pages 子路径部署）。
// 这里不 import ../base.ts 是刻意的——src/mobile/ 是受保护运行时层，对应用层的依赖要显式可见。
const BASE: string = import.meta.env?.BASE_URL ?? "/";

export const mobileAssets = {
  iphoneBezel: `${BASE}assets/iphone/Bezel.png`,
  iphoneKeyboard: `${BASE}assets/iphone/Keyboard.png`,
  androidKeyboard: `${BASE}assets/android/Keyboard.png`,
  pixel10Bezel: `${BASE}assets/android/Pixel10.png`,
} as const;

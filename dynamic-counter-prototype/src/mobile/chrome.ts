// 手机外框（设备壳、模拟状态栏、设备切换器、底部横条）是给桌面预览用的。真手机上和装到桌面的
// PWA 里一律全屏：判据只在这里算一次，算完同步写到 <html data-phone-chrome>，CSS 和 React 读
// 同一个属性 —— 两边各判一套，版式和实际画出来的东西就会打架。
// ?chrome=frame 强制带框（桌面预览、回归用），?chrome=app 强制按真机走（验收这条用）。
export type PhoneChrome = "frame" | "real";
export type SafeArea = { top: number; bottom: number };

const matches = (query: string) => window.matchMedia(query).matches;

/** 真实刘海和 home 条只有 env() 知道：插一个探针元素把 px 量回来。桌面预览与不留安全区的
    浏览器都量到 0，所以画框那一套预设数字（54 / 34）不参与全屏版式。 */
export const measureSafeArea = (): SafeArea => {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;"
    + "padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(probe);
  const style = window.getComputedStyle(probe);
  const area = { top: Number.parseFloat(style.paddingTop) || 0, bottom: Number.parseFloat(style.paddingBottom) || 0 };
  probe.remove();
  return area;
};

/** 判据本体：三个信号进，一个档位出，不碰 window，好单独测。 */
export const phoneChromeFrom = (signals: {
  standalone: boolean;
  coarse: boolean;
  /** ?chrome= 的原始值；认 "frame"（硬要外框）和 "app"（硬要全屏），其余一律不算表态。 */
  forced?: string | null;
}): PhoneChrome => {
  if (signals.forced === "frame") return "frame";
  if (signals.forced === "app") return "real";
  return signals.standalone || signals.coarse ? "real" : "frame";
};

export const detectPhoneChrome = (): PhoneChrome => phoneChromeFrom({
  // iOS 装到桌面以后不一定报 display-mode，但它给 navigator.standalone。
  standalone: matches("(display-mode: standalone)")
    || (navigator as unknown as { standalone?: boolean }).standalone === true,
  coarse: matches("(hover: none) and (pointer: coarse)"),
  forced: new URLSearchParams(window.location.search).get("chrome"),
});

/** 第一次调用就落属性：CSS 靠它定版式，必须赶在首屏之前，不能先画一帧假外框再收掉。 */
export const usePhoneChrome = (): PhoneChrome => {
  const chrome = detectPhoneChrome();
  if (document.documentElement.dataset.phoneChrome !== chrome) {
    document.documentElement.dataset.phoneChrome = chrome;
  }
  return chrome;
};

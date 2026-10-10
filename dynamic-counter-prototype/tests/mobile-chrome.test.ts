// 全屏那一档的判据与"一处判"契约。
// 判据本体（phoneChromeFrom）三个信号进一个档位出；CSS 侧只认 <html data-phone-chrome>，
// 后面几条扫源码，防止谁再写一套自己的媒体查询，或把 54px 那条假状态栏高度抄回界面里。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { phoneChromeFrom } from "../src/mobile/chrome.ts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("桌面预览才画外框：触屏手机和装到桌面的 PWA 都走全屏", () => {
  assert.equal(phoneChromeFrom({ standalone: false, coarse: false }), "frame");
  // 真手机的浏览器：没有 display-mode，但指针是粗的。
  assert.equal(phoneChromeFrom({ standalone: false, coarse: true }), "real");
  // 装到桌面 / iOS 加到桌面（navigator.standalone 也归到这一个信号）：桌面窗口也可能没触屏。
  assert.equal(phoneChromeFrom({ standalone: true, coarse: false }), "real");
});

test("?chrome= 只认表态的那两个值：其余一律回落到真实信号", () => {
  assert.equal(phoneChromeFrom({ standalone: false, coarse: true, forced: "frame" }), "frame");
  assert.equal(phoneChromeFrom({ standalone: false, coarse: false, forced: "app" }), "real");
  assert.equal(phoneChromeFrom({ standalone: false, coarse: true, forced: "1" }), "real");
  assert.equal(phoneChromeFrom({ standalone: false, coarse: false, forced: "" }), "frame");
});

test("判据只有一处：样式表里不许再自己写媒体查询判全屏", () => {
  const styles = read("../src/styles.css");
  // 全屏的版式改由 html[data-phone-chrome] 驱动；谁再把 pointer:coarse 判一遍，两处就会打架。
  assert.doesNotMatch(styles, /@media[^{]*\b(pointer\s*:\s*coarse|display-mode)\b/);
  assert.match(styles, /html\[data-phone-chrome="real"\]\s+\.phone-scale-box/);
});

test("假状态栏那条 54px 不再写死在界面里：只认 --fake-bar-height", () => {
  const files = ["../src/prototype.css", "../src/duel.css", "../src/blitz.css"];
  const offenders = files
    .map(f => [f, read(f)] as const)
    .filter(([, text]) => /calc\(\s*54px\s*\+\s*env\(safe-area-inset-top\)/.test(text)
      || /18px\s*\+\s*54px/.test(text));
  assert.deepEqual(offenders.map(([f]) => f), [], "这几处还自己写死 54px，全屏时会多出一条空带");
  assert.match(read("../src/prototype.css"), /html\[data-phone-chrome="real"\]\s*\{\s*--fake-bar-height/);
});

test("安全区两个来源不混用：全屏读实测，画框读预设", () => {
  const device = read("../src/mobile/Device.tsx");
  assert.match(device, /chrome === "real"\s*\?\s*\{\s*\.\.\.preset,\s*geometry:\s*\{\s*\.\.\.preset\.geometry,\s*safeArea\s*\}\s*\}/);
  // 画框那一档必须原样用预设，不然桌面预览的设备切换器就失去它要模拟的那两块黑边。
  assert.match(device, /const device = useMemo\(/);
});

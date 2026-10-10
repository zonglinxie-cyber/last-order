import { expect, test, type Page } from "@playwright/test";
import {
  beginSlot, ENERGY_PER_DAY, newWorld, SAVE_KEY, WORLD_SAVE_VERSION,
} from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { World } from "../src/world/types.ts";

// 全屏那一档（任务 22 ③）：真手机上和装到桌面的 PWA 里不画假状态栏、假底部横条、设备壳。
// 判据在 src/mobile/chrome.ts 一处算，落到 <html data-phone-chrome>，CSS 与 React 都只认它。
//
// 三条档位都要被演到，是因为"全屏"和"预览"是一体两面：只测全屏那一头，把外框整块删掉也能绿。
//   · 真手机浏览器 —— 用 isMobile/hasTouch 触发（pointer: coarse 这一支是真信号）。
//   · 装到桌面 —— Chromium 不认 CDP 的 display-mode 仿真（实测无效），改用 iOS 加到桌面时
//     Safari 给的 navigator.standalone 当替身；?chrome=app 是同一支的另一个入口。
//   · 桌面预览 —— 外框必须照旧画出来，这条就是上面两条的反证。
// 真机上刘海到底多高、home 条让不让位，只有真设备量得到；这里能钉的是"假的那两条不再占位"。

const FLOOR_WORLD = (): World => ({
  ...beginSlot(newWorld("fullscreen-seed", PEOPLE), PEOPLE, []),
  day: 1, slot: 0, energy: ENERGY_PER_DAY,
  present: {
    mei: "counter", zhou: "counter", shen: "lounge",
    roman: "counter", suman: "counter", tangke: "backroom", luyao: "rival",
  },
});

/** 直接落到楼层那一屏：把存档摆好，进来点「继续」，不靠引导把界面压住。 */
const enterFloor = async (page: Page, query = "") => {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world: FLOOR_WORLD(), ui: { screen: "play" } })]);
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
    [COACH_KEY, JSON.stringify(COACH_STEPS)]);
  await page.goto(`/?mode=world${query}`);
  await page.getByRole("button", { name: /继续|开这一季/ }).click();
  await expect(page.locator(".world-app")).toBeVisible();
};

const FAKE_CHROME = [".status-bar", ".home-indicator-svg", ".android-navigation-bar",
  ".phone-bezel", ".device-menu-bar", ".device-camera"];

test.describe("真手机那一档 · 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("假外框一件都不画，屏幕就是整个窗口", async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.dataset.phoneChrome)).toBeUndefined();
    await enterFloor(page);
    expect(await page.evaluate(() => document.documentElement.dataset.phoneChrome)).toBe("real");
    for (const selector of FAKE_CHROME) {
      // 是 React 那一侧就不渲染，不是画出来再用 CSS 藏起来 —— 藏起来的节点还占着无障碍树。
      await expect(page.locator(selector), `${selector} 还留在 DOM 里`).toHaveCount(0);
    }
    const screen = await page.locator(".device-screen").boundingBox();
    expect(screen, ".device-screen 没铺满").toBeTruthy();
    expect([Math.round(screen!.x), Math.round(screen!.y), Math.round(screen!.width), Math.round(screen!.height)])
      .toEqual([0, 0, 390, 844]);
    await page.screenshot({ path: "/tmp/f3-real-390.png" });
  });

  test("第一行只让开真实刘海，不再多让一条 54px 假状态栏", async ({ page }) => {
    await enterFloor(page);
    const bar = page.locator(".world-bar");
    await expect(bar, "顶栏不贴到窗口上沿就说明还在让那条假带").toHaveCSS("padding-top", "8px");
    const box = await bar.boundingBox();
    expect(box!.y).toBeCloseTo(0, 0);
    // 底部同理：假横条不再从窗口下沿抠走 34px，动作条的下沿就是屏幕上沿以下的位置。
    expect(await page.locator(".device-screen").evaluate(el =>
      getComputedStyle(el).getPropertyValue("--device-safe-area-bottom").trim())).toBe("0px");
    const verbs = page.locator(".world-verbs");
    await page.getByRole("button", { name: /查看梅女士/ }).first().click();
    await expect(verbs).toBeVisible();
    const verbsBox = await verbs.boundingBox();
    expect(verbsBox!.y + verbsBox!.height, "动作条掉出屏幕").toBeLessThanOrEqual(844 + 1);
  });

  test("省下来的那 46px 给了内容：柜前两位都站在屏内", async ({ page }) => {
    await enterFloor(page);
    const heads = page.locator("[data-pid]");
    expect(await heads.count()).toBeGreaterThan(0);
    for (let i = 0; i < await heads.count(); i++) {
      const b = await heads.nth(i).boundingBox();
      if (!b) continue;
      expect(b.y, `第 ${i} 个人被顶出屏外`).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(844 + 1);
    }
    const map = await page.locator(".world-map-view").boundingBox();
    expect(map!.y + map!.height).toBeLessThanOrEqual(844 + 1);
  });
});

test.describe("装到桌面的 PWA（navigator.standalone 替身）", () => {
  test.use({ viewport: { width: 900, height: 700 } });

  const asInstalled = (page: Page) => page.addInitScript(() => {
    Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
  });

  test("桌面窗口没有触屏信号，但加到桌面这一条就够全屏", async ({ page }) => {
    await asInstalled(page);
    await enterFloor(page);
    expect(await page.evaluate(() => document.documentElement.dataset.phoneChrome)).toBe("real");
    await expect(page.locator(".status-bar")).toHaveCount(0);
    await expect(page.locator(".phone-bezel")).toHaveCount(0);
    const screen = await page.locator(".device-screen").boundingBox();
    expect([Math.round(screen!.x), Math.round(screen!.y), Math.round(screen!.width)])
      .toEqual([0, 0, 900]);
  });

  test("?chrome=app 是同一支的另一条路，?chrome=frame 把它按回去（反证）", async ({ page }) => {
    await enterFloor(page, "&chrome=app");
    expect(await page.evaluate(() => document.documentElement.dataset.phoneChrome)).toBe("real");
    await expect(page.locator(".status-bar")).toHaveCount(0);

    // 同一台桌面窗口、同一份代码，把档位按回预览：假状态栏必须回来，
    // 否则上面那条"不见了"就只是整块删掉了功能，不是全屏那一档生效。
    await enterFloor(page, "&chrome=frame");
    expect(await page.evaluate(() => document.documentElement.dataset.phoneChrome)).toBe("frame");
    await expect(page.locator(".status-bar")).toBeVisible();
    await expect(page.locator(".device-menu-bar")).toBeVisible();
    await expect(page.locator(".world-bar")).toHaveCSS("padding-top", "54px");
  });
});

test.describe("桌面预览那一档不许被顺手改掉", () => {
  test.use({ viewport: { width: 1100, height: 1100 } });

  test("外框、假状态栏、设备切换器照常画，内容照常让开 54px", async ({ page }) => {
    await enterFloor(page);
    expect(await page.evaluate(() => document.documentElement.dataset.phoneChrome)).toBe("frame");
    await expect(page.locator(".status-bar")).toBeVisible();
    await expect(page.locator(".home-indicator-svg")).toBeVisible();
    await expect(page.locator(".phone-bezel")).toBeVisible();
    await expect(page.locator(".device-menu-bar")).toBeVisible();
    await expect(page.locator(".world-bar")).toHaveCSS("padding-top", "54px");
    // 带框时屏幕由预设安全区决定下沿留白，画的是设备自己的 home 条，不是窗口。
    expect(await page.locator(".device-screen").evaluate(el =>
      getComputedStyle(el).getPropertyValue("--device-safe-area-bottom").trim())).toBe("34px");
    const screen = await page.locator(".device-screen").boundingBox();
    // 带框那一档屏幕按预设走（iPhone 的屏是 393 宽，不是 390），窗口里居中缩放。
    expect(screen!.width).toBeCloseTo(393, 0);
    expect(screen!.x).toBeGreaterThan(0);
    await page.screenshot({ path: "/tmp/f3-frame-1100.png" });
  });
});

import { expect, test } from "@playwright/test";
import { newWorld } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { WORLD_PROGRESS_KEY, emptyWorldProgress, observeWorldProgress } from "../src/world/progress.ts";
import type { World } from "../src/world/types.ts";

// 跨季「档案」走查：从 ?mode=world 开场封面的那颗「档案」进去。
// 空档时 42 张全是剪影；种一份玩过几天的进度档以后，见过的人出立绘与三行、走到的落点亮起。
// 断言还是那一套：正文 ≥12px、按钮 ≥44px、390×844 与 320×568 都不横向溢出。

// 手工累积两份世界读数：先把沈薇、梅女士见过（最好那一档），再把沈薇压到最差那一档，
// 顺带揭开沈薇秘密、让她的线落到第 1 档，收一次场。
const seededProgress = (): string => {
  const w1: World = {
    ...newWorld("a", PEOPLE),
    present: { shen: "counter", mei: "entrance" },
    opinion: { shen: 65, mei: 20 },
    qualities: { "secret-known:shen": 1, "arc:shen:end": 1, "arc:shen": 3 },
  };
  const w2: World = { ...newWorld("b", PEOPLE), opinion: { shen: -10 } };
  let p = observeWorldProgress(emptyWorldProgress(), w1);
  p = observeWorldProgress(p, w2, "counter-empty");
  return JSON.stringify(p);
};

const openArchiveFromCover = async (page: import("@playwright/test").Page) => {
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: "档案" }).click();
  await expect(page.locator(".world-archive-page")).toBeVisible();
};

test.describe("档案 · 空档", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("封面进档案：空档时全是剪影、一句「还没在这层楼上碰到过」", async ({ page }) => {
    await openArchiveFromCover(page);
    await expect(page.locator(".archive-card.unmet")).toHaveCount(PEOPLE.length);
    await expect(page.locator(".archive-card:not(.unmet)")).toHaveCount(0);
    await expect(page.getByText("还没在这层楼上碰到过")).not.toHaveCount(0);
    await expect(page.getByText("这层楼上见过 0 / " + PEOPLE.length + " 位")).toBeVisible();
  });
});

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`档案 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [WORLD_PROGRESS_KEY, seededProgress()]);
      await openArchiveFromCover(page);
    });

    test("见过的人出卡片：立绘、descriptor、最好与最差那一档的说法", async ({ page }) => {
      await expect(page.getByText("这层楼上见过 2 / " + PEOPLE.length + " 位")).toBeVisible();
      const shen = page.locator(".archive-card", { hasText: "沈薇" }).first();
      await expect(shen).not.toHaveClass(/unmet/);
      await expect(shen.locator(".archive-descriptor")).toBeVisible();
      // 秘密揭开了才写；看法只说一句话，不报数字。
      await expect(shen.getByText("秘密")).toBeVisible();
      await expect(shen.locator(".wa-secret span")).not.toHaveClass(/wa-locked/);
      await expect(shen.locator(".wa-line", { hasText: "她最好的时候" })).toContainText("把你当自己人");
      await expect(shen.locator(".wa-line", { hasText: "她最差的时候" })).toContainText("对你有戒心");
      // 看法只说一句话，不报数字。
      await expect(shen.locator(".wa-line", { hasText: "她最好的时候" })).not.toContainText(/[-0-9]/);
      // 只在读数里出现、没在场的人仍算没见过
      await expect(page.locator(".archive-card.unmet", { hasText: "安姐" })).toBeVisible();
    });

    test("个人线：走到过的落点亮起，没走到的压成？？？", async ({ page }) => {
      await page.getByRole("button", { name: "个人线" }).click();
      await expect(page.locator(".wa-arc")).toHaveCount(4);
      const shenArc = page.locator(".wa-arc", { hasText: "沈薇" }).first();
      await expect(shenArc.locator(".wa-arc-row.lit")).not.toHaveCount(0);
      await expect(shenArc.locator(".wa-arc-row:not(.lit)")).not.toHaveCount(0);
      await expect(shenArc.locator(".wa-arc-row:not(.lit) b").first()).toHaveText("？？？");
    });

    test("结局：按 rank 排好，拿到的认标题、没拿到的只给不剧透提示", async ({ page }) => {
      await page.getByRole("button", { name: "结局" }).click();
      await expect(page.locator(".ending-row")).toHaveCount(10);
      await expect(page.locator(".ending-row.achieved")).toHaveCount(1);
      await expect(page.locator(".ending-row.achieved b")).toHaveText("镜子前空了");
      await expect(page.locator(".ending-row.locked")).toHaveCount(9);
      await expect(page.locator(".ending-row.locked b").first()).toHaveText("？？？");
      await expect(page.getByText("散过场 1 / 10 种")).toBeVisible();
    });

    test("正文 ≥12px、页签与返回 ≥44px、不横向溢出", async ({ page }) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const outside = await page.evaluate(() => [...document.querySelectorAll(".world-archive-page *")]
        .filter(el => (el as HTMLElement).getBoundingClientRect().width > 0)
        .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
        .map(el => `${el.tagName}:${el.className}`));
      expect(outside).toEqual([]);
      const smallText = await page.evaluate(() => [...document.querySelectorAll(".world-archive-page *")]
        .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()))
        .filter(el => parseFloat(getComputedStyle(el as HTMLElement).fontSize) < 12)
        .map(el => `${el.tagName}:${el.className}`));
      expect(smallText).toEqual([]);
      for (const sel of [".archive-tabs button", ".archive-back"]) {
        const boxes = await page.locator(sel).evaluateAll(els => els.map(el => el.getBoundingClientRect()));
        expect(boxes.length).toBeGreaterThan(0);
        for (const b of boxes) {
          expect(b.width).toBeGreaterThanOrEqual(44);
          expect(b.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test("返回键收起档案、回到封面", async ({ page }) => {
      await page.locator(".archive-back").click();
      await expect(page.locator(".world-archive-page")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "档案" })).toBeVisible();
    });
  });
}

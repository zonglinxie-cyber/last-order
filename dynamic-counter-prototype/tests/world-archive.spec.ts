import { expect, test } from "@playwright/test";
import { newWorld } from "../src/world/engine.ts";
import { CLUES, PEOPLE } from "../src/world/content/index.ts";
import { ARC_PEOPLE, WORLD_PROGRESS_KEY, emptyWorldProgress, observeWorldProgress } from "../src/world/progress.ts";
import { ENDINGS } from "../src/world/ending.ts";
import type { World } from "../src/world/types.ts";

// 跨季「档案」走查：从 ?mode=world 开场封面的那颗「档案」进去。
// 空档时 42 张全是剪影；种一份玩过几天的进度档以后，见过的人出立绘与三行、走到的落点亮起。
// 断言还是那一套：正文 ≥12px、按钮 ≥44px、390×844 与 320×568 都不横向溢出。

// 手工累积两份世界读数：先把沈薇、梅女士见过（最好那一档），再把沈薇压到最差那一档，
// 顺带揭开沈薇秘密、让她的线落到第 1 档、本子上攒两条线索并把那条线拧到第 2 种收法，收一次场。
const seededProgress = (): string => {
  const w1: World = {
    ...newWorld("a", PEOPLE),
    present: { shen: "counter", mei: "entrance" },
    opinion: { shen: 65, mei: 20 },
    qualities: {
      "secret-known:shen": 1, "arc:shen:end": 1, "arc:shen": 3,
      "clue:slip-hand": 4, "clue:slip-borrowed": 9, "thread:return-slip": 2,
    },
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
      // 名单与线索条数一律从内容表推：加线、加线索不该红掉这一屏的走查（名单本身由 world-progress 钉）。
      await expect(page.locator(".wa-arc")).toHaveCount(ARC_PEOPLE.length);
      const shenArc = page.locator(".wa-arc", { hasText: "沈薇" }).first();
      await expect(shenArc.locator(".wa-arc-row.lit")).not.toHaveCount(0);
      await expect(shenArc.locator(".wa-arc-row:not(.lit)")).not.toHaveCount(0);
      await expect(shenArc.locator(".wa-arc-row:not(.lit) b").first()).toHaveText("？？？");
      for (const name of ["小雨", "周姐", "赵女士", "米朵"]) {
        const arc = page.locator(".wa-arc", { hasText: name });
        await arc.scrollIntoViewIfNeeded();
        await expect(arc).toBeVisible();
        await expect(arc.locator(".wa-arc-row")).toHaveCount(4);
        await expect(arc.locator(".wa-arc-row b").first()).toHaveText("？？？");
      }
    });

    test("本子：攒到的线索念得出，没攒到的压成？？？，拧过的收法亮起", async ({ page }) => {
      await page.getByRole("button", { name: "本子" }).click();
      await expect(page.getByText(`本子上攒了 2 / ${CLUES.length} 条`)).toBeVisible();
      const book = page.locator(".wa-arc").first();
      // 那条线抛给玩家的问话，没弄清也照样挂在页上（跨季的钩子）
      await expect(book.getByText("单子上写的是沈薇，退的不是她。那是谁？")).toBeVisible();
      await expect(book.locator(".wa-arc-row.lit")).toHaveCount(3); // 两条线索 + 一种收法
      await expect(book.locator(".wa-arc-row:not(.lit) b")).not.toHaveCount(0);
      await expect(book.locator(".wa-arc-row.lit b").first()).toHaveText("退货单上的日期比她那一单晚三天。那三天她没上过这层楼。");
      await expect(book.locator(".wa-arc-row.lit", { hasText: "只说名字是从群里借的" })).toBeVisible();
      // 没弄清的每一条都压成？？？：档案不许把结论替玩家说出来
      const dimmed = await book.locator(".wa-arc-row:not(.lit) b").allTextContents();
      expect(dimmed.length).toBeGreaterThan(0);
      expect(dimmed.every(t => t === "？？？")).toBe(true);
    });

    test("结局：按 rank 排好，拿到的认标题、没拿到的只给不剧透提示", async ({ page }) => {
      // 这一屏不钉判词条数：写死 13 的那一版在第 4 幕那四句加进来当天红了两遍（两个视口各一次），
      // 而第 13 句以后还会加。一律从 ENDINGS 推，同页顶那句「1 / N 种」。
      await page.getByRole("button", { name: "结局" }).click();
      await expect(page.locator(".ending-row")).toHaveCount(ENDINGS.length);
      await expect(page.locator(".ending-row.achieved")).toHaveCount(1);
      await expect(page.locator(".ending-row.achieved b")).toHaveText("镜子前空了");
      await expect(page.locator(".ending-row.locked")).toHaveCount(ENDINGS.length - 1);
      await expect(page.locator(".ending-row.locked b").first()).toHaveText("？？？");
      await expect(page.getByText(`散过场 1 / ${ENDINGS.length} 种`)).toBeVisible();
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

/**
 * 四季跑到第 4 幕、把自己的名字写进区域总表那一档（落点 14）以后的一份进度。
 * 上面那两份种子停在下标 2 的收法（第 2 幕），本子上从来没有亮过第 4 幕那两条 ——
 * 这一屏要钉的是"玩家自己签过的那一格，档案要念得出名字"。
 */
const act4Progress = (): string => JSON.stringify(observeWorldProgress(emptyWorldProgress(), {
  ...newWorld("a4-ui", PEOPLE),
  season: 4,
  present: { fangmin: "cashier", peilan: "counter" },
  qualities: { "mainline:act": 4, "thread:return-slip": 14, "clue:slip-desk": 1, "clue:slip-roster": 1 },
}));

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`档案 · 第 4 幕那一栏 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("第 6 条线索与总表那一格都亮着，没落过的收法还是？？？", async ({ page }) => {
      await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
        [WORLD_PROGRESS_KEY, act4Progress()]);
      await openArchiveFromCover(page);
      await page.getByRole("button", { name: "本子" }).click();
      const book = page.locator(".wa-arc").first();
      await expect(book.getByText("那张退货单")).toBeVisible();
      await expect(page.getByText(`本子上攒了 2 / ${CLUES.length} 条`)).toBeVisible();
      // 第 4 幕那条线索的原文（本子上最长的一句）
      await expect(book.locator(".wa-arc-row.lit b", { hasText: "第四页那一栏每季空着，等一个当时顶班的号" })).toBeVisible();
      // 收法那一行认的是玩家自己点过的那一格 label
      await expect(book.locator(".wa-arc-row.lit b", { hasText: "让裴岚把这一行写进区域总表" })).toBeVisible();
      // 两条线索 + 一种收法；没落过的那几格连名字都不许露（档案不许替玩家说结论）
      await expect(book.locator(".wa-arc-row.lit")).toHaveCount(3);
      await expect(book.locator(".wa-arc-row.lit b", { hasText: "把自己的名字写进那一栏" })).toHaveCount(0);
      const dimmed = await book.locator(".wa-arc-row:not(.lit) b").allTextContents();
      expect(dimmed.length).toBeGreaterThan(0);
      expect(dimmed.every(t => t === "？？？")).toBe(true);
      // 新加的那一条不许把这一屏挤出右边界、也不许用小于 12px 的字念
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      const smallText = await page.evaluate(() => [...document.querySelectorAll(".world-archive-page *")]
        .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()))
        .filter(el => parseFloat(getComputedStyle(el as HTMLElement).fontSize) < 12)
        .map(el => `${el.tagName}:${el.className}`));
      expect(smallText).toEqual([]);
    });
  });
}

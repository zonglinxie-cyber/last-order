// 设备状态条是叠在内容上的：每个界面的第一行都必须让开它，否则 DAY 和金额会被假时钟压住。
import { expect, test, type Page } from "@playwright/test";
import { INITIAL, SAVE_KEY } from "../src/campaign";

const seed = (page: Page, patch: Record<string, unknown>) => page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
  key: SAVE_KEY, value: { ...INITIAL, ...patch },
});

const screenMarks: Record<string, string> = {
  intro: ".intro-screen", brief: ".brief-screen", floor: ".game-hud", consultation: ".consultation-hud",
  event: ".event-screen", summary: ".summary-screen", finale: ".finale-screen",
};

async function clearOfStatusBar(page: Page, screen: string) {
  // 先确认量的确实是这一块屏，否则"没有遮挡"会是假的绿灯。
  await expect(page.locator(screenMarks[screen])).toBeVisible();
  const bar = await page.locator(".status-bar").boundingBox();
  expect(bar, `${screen} 找不到状态条`).not.toBeNull();
  const crowded = await page.evaluate(rect => [...document.querySelectorAll(".app-screen *")]
    .filter(node => {
      if (node.closest(".status-bar") || !node.textContent.trim()) return false;
      if ([...node.children].some(child => child.textContent!.trim())) return false;
      const box = node.getBoundingClientRect();
      return box.height > 0 && box.bottom > rect.y && box.top < rect.y + rect.height;
    })
    .map(node => `${node.tagName.toLowerCase()}.${node.className} ${node.textContent!.trim().slice(0, 16)}`), bar!);
  expect(crowded, `${screen} 的第一行压进了状态条`).toEqual([]);
}

async function open(page: Page, patch: Record<string, unknown>, day: number) {
  await page.goto("/");
  await seed(page, patch);
  await page.reload();
  await page.getByRole("button", { name: `继续第 ${day} 天` }).click();
}

test("every phone screen starts below the simulated status bar", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await clearOfStatusBar(page, "intro");
  await open(page, { day: 4, sales: 10000, members: ["shen", "mei"] }, 4);
  await clearOfStatusBar(page, "brief");
  await open(page, {}, 1);
  await page.getByRole("button", { name: "开始营业" }).click();
  await clearOfStatusBar(page, "floor");
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await clearOfStatusBar(page, "consultation");
  // 两个人都接完了，恢复界面直接就是闭店那一段。
  await open(page, { dayServed: ["shen", "mei"] }, 1);
  await clearOfStatusBar(page, "event");
  await open(page, { eventDoneDays: [1] }, 1);
  await clearOfStatusBar(page, "summary");
  await open(page, { day: 5, finished: true, sales: 23000, eventDoneDays: [1, 2, 3, 4, 5] }, 5);
  await clearOfStatusBar(page, "finale");
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { beginSlot, newWorld, parseWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE, festivalsFor } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { World } from "../src/world/types.ts";

const audit = process.env.HEADER_AUDIT_DIR ?? "../audit/header-2026-10-18/after";
mkdirSync(audit, { recursive: true });
const saved = (page: Page): Promise<World> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!).world, SAVE_KEY);
async function enter(page: Page, world: World) {
  const payload = JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "play", reqSeen: world.day } });
  expect(parseWorld(payload)).not.toBeNull();
  await page.goto("/");
  await page.evaluate(({ key, payload, coach, steps }) => {
    localStorage.setItem(key, payload); localStorage.setItem(coach, JSON.stringify(steps));
  }, { key: SAVE_KEY, payload, coach: COACH_KEY, steps: COACH_STEPS });
  await page.reload(); await page.getByRole("button", { name: /^继续/ }).click();
  await page.evaluate(() => document.fonts.ready);
}

/** 包括父容器裁切与上层按钮遮挡，不能只看文字的坐标是否在屏幕里。 */
async function readable(loc: Locator) {
  await expect.soft(loc).toBeInViewport({ ratio: 1, timeout: 500 });
  expect.soft(await loc.evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    return [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0).every(r => {
      if (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) return false;
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!hit || !el.contains(hit)) return false;
      for (let p: Element | null = el; p; p = p.parentElement) {
        const s = getComputedStyle(p), box = p.getBoundingClientRect();
        if (/hidden|clip|auto|scroll/.test(s.overflowX) && (r.left < box.left - 0.5 || r.right > box.right + 0.5)) return false;
        if (/hidden|clip|auto|scroll/.test(s.overflowY) && (r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5)) return false;
      }
      return true;
    });
  }), `文字被裁切或遮挡：${await loc.innerText()}`).toBe(true);
}
async function hit(loc: Locator) {
  await loc.click({ trial: true }); await expect(loc).toBeInViewport({ ratio: 1 });
  expect(await loc.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.width >= 44 && r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}
const resources = (page: Page, label: string) => page.locator(".world-bar span").filter({ hasText: new RegExp(`^${label} \\d+$`) });

for (const [width, height] of [[320, 568], [390, 667], [390, 844]] as const) test.describe(`顶栏 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

  test("日期、双方比分与资源不被裁切，拥挤时仍保留可读现场", async ({ page }) => {
    const start = beginSlot(newWorld("header-new", PEOPLE), PEOPLE);
    const friday = beginSlot({ ...newWorld("booking-test", PEOPLE), day: 26, slot: 0 }, PEOPLE);
    const crowded = beginSlot({ ...friday, slot: 1, money: 124380, rivalMoney: 98420,
      appointments: [{ day: 26, slot: 1, person: "shen", reason: "visit" }, { day: 26, slot: 1, person: "mei", reason: "visit" }] }, PEOPLE);
    expect(crowded.rivalBooking).toBeTruthy(); expect(crowded.weekendOrder).toBeTruthy();
    for (const [name, w] of [["opening", start], ["crowded", crowded]] as const) {
      await enter(page, w);
      await page.screenshot({ path: `${audit}/${name}-${width}x${height}.png` });
      const geometry = await page.locator(".world-bar").evaluate(el => [...el.querySelectorAll("b,span,button")].map(e => {
        const r = e.getBoundingClientRect(); return { text: e.textContent, x: r.x, y: r.y, width: r.width, height: r.height };
      }));
      writeFileSync(`${audit}/${name}-${width}x${height}.json`, JSON.stringify(geometry, null, 2));
      for (const loc of [page.locator(".world-bar-info b"), page.locator(".world-money"), page.locator(".world-score"), resources(page, "精力"), resources(page, "小样")]) await readable(loc);
      for (const sel of [".world-mute", ".world-web-btn", ".world-next"]) await hit(page.locator(sel));
      expect.soft(await page.locator(".world-scene").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(96);
      await expect.soft(page.locator(".world-scene")).toBeInViewport({ ratio: 1 });
    }
  });

  test("多位季号、七位金额和节日仍读得全，数字不靠缩写", async ({ page }) => {
    const season = 12, festival = festivalsFor(season)[0]!;
    const w = beginSlot({ ...newWorld("header-long", PEOPLE), season, day: festival.fromDay, slot: 3,
      money: 1234567, rivalMoney: 987654, energy: 60, samples: 8 }, PEOPLE, festivalsFor(season));
    await enter(page, w);
    await expect(page.locator(".world-bar-info")).toContainText(festival.name);
    await expect(page.locator(".world-money")).toContainText("1,234,567");
    await page.screenshot({ path: `${audit}/long-${width}x${height}.png` });
    for (const loc of [page.locator(".world-bar-info b"), page.locator(".world-money"), page.locator(".world-score"), resources(page, "精力"), resources(page, "小样")]) await readable(loc);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test("看见资源后能邀请客人，扣款立即更新，静音与时段按钮不串动", async ({ page }) => {
    const w = beginSlot({ ...newWorld("booking-test", PEOPLE), day: 22, slot: 1 }, PEOPLE);
    await enter(page, w);
    await page.locator(".world-mute").click();
    expect(await saved(page)).toEqual(w);
    await page.locator(".world-rival-booking").click();
    await page.getByRole("button", { name: "邀来比货 6 精力 · 1 份小样", exact: true }).click();
    const invited = await saved(page);
    expect(invited.energy).toBe(w.energy - 6); expect(invited.samples).toBe(w.samples - 1);
    await page.reload(); await page.getByRole("button", { name: /^继续/ }).click();
    await expect(resources(page, "精力")).toHaveText(`精力 ${invited.energy}`);
    await expect(resources(page, "小样")).toHaveText(`小样 ${invited.samples}`);
    await readable(resources(page, "精力")); await readable(resources(page, "小样"));
    await hit(page.locator(".world-web-btn")); await hit(page.locator(".world-next"));
    await page.locator(".world-next").click();
    await expect.poll(async () => (await saved(page)).slot).toBe(2);
    expect((await saved(page)).day).toBe(w.day);
  });
});

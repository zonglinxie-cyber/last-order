import { expect, test, type Page, type Locator } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { ambient, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { SHELF } from "../src/world/shelf.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { World } from "../src/world/types.ts";
const audit = "../audit/contact-invite-2026-10-18";
mkdirSync(audit, { recursive: true });
const saved = (page: Page): Promise<{ world: World; ui: { screen: string } }> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
const base = (): World => ({ ...newWorld("invite-browser", PEOPLE), day: 2, slot: 3, energy: 40,
  opinion: { shen: 40 }, qualities: { "wechat:shen": 1 }, present: { luyao: "rival" } });
async function enter(page: Page, world: World) {
  await page.goto("/?chrome=app");
  await page.evaluate(({ world, key, version, coach, steps }) => {
    localStorage.setItem(key, JSON.stringify({ version, world, ui: { screen: "play", reqSeen: world.day } }));
    localStorage.setItem(coach, JSON.stringify(steps));
  }, { world, key: SAVE_KEY, version: WORLD_SAVE_VERSION, coach: COACH_KEY, steps: COACH_STEPS });
  await page.reload(); await page.getByRole("button", { name: /^继续/ }).click();
}
async function contact(page: Page) {
  await page.getByRole("button", { name: "人情网", exact: true }).click();
  await page.locator('.web-node[aria-label="沈薇"]').click();
  await expect(page.getByLabel("沈薇的人物卡")).toBeVisible();
}
async function hit(button: Locator) {
  await button.click({ trial: true }); await expect(button).toBeInViewport({ ratio: 1 });
  expect(await button.evaluate(el => { const r = el.getBoundingClientRect();
    return r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
}
async function dismiss(page: Page) {
  for (let i = 0; i < 4; i++) {
    if (await page.locator(".story-choices button").first().isVisible()) { await page.locator(".story-choices button").first().click(); continue; }
    if (await page.locator(".world-requests .req-close").isVisible()) { await page.locator(".world-requests .req-close").click(); continue; }
    break;
  }
}
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`主动邀约 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  test("从人情网约不在场的熟人，刷新保留，隔日真实到店后再接待开单", async ({ page }) => {
    const w = base(); await enter(page, w); await contact(page);
    await expect(page.getByLabel("约下次见面")).toContainText("第 3 天上午");
    const invite = page.getByRole("button", { name: "约下次见面 · 4 精力", exact: true });
    await hit(invite); await page.screenshot({ path: `${audit}/offer-${width}.png` }); await invite.click();
    await expect(invite).toBeDisabled();
    await expect(page.getByLabel("约下次见面")).toContainText("已有安排：第 3 天上午");
    const booked = (await saved(page)).world;
    expect(booked.energy).toBe(36); expect(booked.money).toBe(w.money); expect(booked.opinion).toEqual(w.opinion);
    expect(booked.appointments).toEqual([{ person: "shen", day: 3, slot: 0, reason: "invited" }]);
    await page.reload();
    await expect(page.getByLabel("上次停在这里")).toContainText("沈薇约好了要来");
    await page.getByRole("button", { name: /^继续/ }).click();
    expect((await saved(page)).world).toEqual(booked);
    await page.locator(".world-next").click();
    await expect(page.locator(".report-appointment", { hasText: "沈薇" })).toContainText("你主动约来的");
    await page.getByRole("button", { name: "进入第 3 天", exact: true }).click(); await dismiss(page);
    const arrived = (await saved(page)).world;
    expect(arrived.money).toBe(0); expect(arrived.present.shen).toBeTruthy();
    await page.getByRole("button", { name: /查看沈薇/ }).click();
    await expect(page.getByLabel("来访缘由")).toContainText("你主动约来的");
    await page.screenshot({ path: `${audit}/arrived-${width}.png` });
    await page.locator(".world-verbs button", { hasText: "接待" }).click();
    await expect(page.locator(".world-serve").getByLabel("来访缘由")).toContainText("不急着开单");
    await page.getByRole("tab", { name: "挑货开单" }).click();
    await page.getByRole("button", { name: "粉底 ¥980 薄·撑妆", exact: true }).click();
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    await page.locator(".serve-commit").click();
    await expect(page.locator(".sale-receipt")).toBeVisible();
    expect((await saved(page)).world.money).toBeGreaterThan(0);
    expect((await saved(page)).world.energy).toBe(arrived.energy - 12);
  });
  test("现场先加微信才出现邀约入口，缺精力时保留解释且不扣款", async ({ page }) => {
    const w = { ...base(), present: { shen: "counter" as const, luyao: "rival" as const }, qualities: {}, energy: 6 };
    await enter(page, w); await page.getByRole("button", { name: /查看沈薇/ }).click();
    await expect(page.getByLabel("约下次见面")).toHaveCount(0);
    await page.locator(".world-verbs button", { hasText: "加微信" }).click();
    await expect(page.getByLabel("约下次见面")).toContainText("还需要 4 精力");
    await expect(page.getByRole("button", { name: /^约下次见面/ })).toBeDisabled();
    expect((await saved(page)).world.energy).toBe(2); expect((await saved(page)).world.appointments).toEqual([]);
  });
  test("普通争单输了仍可主动约回来，等待十天并显示跨季日期", async ({ page }) => {
    const w: World = { ...base(), day: 22, slot: 1, present: { shen: "rival", luyao: "rival" },
      rivalPlan: { day: 22, slot: 1, targets: [], tactic: "invite" },
      rivalBooking: { day: 22, slot: 1, person: "shen", product: "plain", units: 1, amount: SHELF.plain.price, invited: true } };
    const lost = ambient(w, PEOPLE); await enter(page, lost); await contact(page);
    await expect(page.getByLabel("约下次见面")).toContainText("第 2 季 · 第 4 天上午");
    const invite = page.getByRole("button", { name: /^约下次见面/ }); await hit(invite); await invite.click();
    expect((await saved(page)).world.rivalMoney).toBe(lost.rivalMoney);
    expect((await saved(page)).world.appointments.at(-1)?.day).toBe(32);
    await page.reload();
    await expect(page.getByLabel("上次停在这里")).toContainText("第 2 季 · 第 4 天上午");
    await page.screenshot({ path: `${audit}/next-chance-${width}.png` });
  });
  test("季末约好的时间经过真实换季保留，到新季第四天如约出现", async ({ page }) => {
    const w = { ...base(), day: 28, qualities: { "wechat:shen": 1, "rival-bought:shen": 22 } };
    await enter(page, w); await contact(page);
    await page.getByRole("button", { name: /^约下次见面/ }).click();
    await page.getByRole("button", { name: "‹ 返回楼层", exact: true }).click();
    await page.locator(".world-next").click();
    await expect(page.locator(".world-recap")).toBeVisible();
    await page.getByRole("button", { name: "进入第 2 季", exact: true }).click();
    const carried = (await saved(page)).world;
    expect(carried.appointments).toContainEqual({ person: "shen", day: 4, slot: 0, reason: "invited" });
    let arrived = false;
    let boughtBeforeArrival: number | undefined;
    for (let i = 0; i < 22; i++) {
      const s = await saved(page);
      if (s.world.day === 4 && s.world.slot === 0 && s.ui.screen === "play") { arrived = true; break; }
      await dismiss(page);
      const before = await saved(page);
      boughtBeforeArrival = before.world.qualities["bought:shen"];
      if (before.ui.screen === "report") await page.getByRole("button", { name: /^进入第 \d+ 天/ }).click();
      else await page.locator(".world-next").click();
    }
    expect(arrived).toBe(true);
    const at = (await saved(page)).world;
    expect(at.present.shen).toBeTruthy();
    // 中途剧情可能安排过别的来访；只核对本次应邀到店没有新开一单。
    expect(at.qualities["bought:shen"]).toBe(boughtBeforeArrival);
    expect(at.qualities["bought:shen"]).not.toBe(4);
    expect(at.log.some(l => l.day === 4 && l.slot === 0 && l.arrival?.kind === "invited" && l.arrival.person === "shen")).toBe(true);
  });
});

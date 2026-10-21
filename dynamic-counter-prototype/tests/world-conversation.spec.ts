import { expect, test, type Page } from "@playwright/test";
import { newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { Consult } from "../src/world/consult.ts";
import type { World } from "../src/world/types.ts";
import { mkdirSync, writeFileSync } from "node:fs";
const audit = process.env.CONVERSATION_AUDIT_DIR ?? "../audit/conversation-2026-10-18";
mkdirSync(audit, { recursive: true });
const saved = (page: Page): Promise<{ world: World; ui: { consults: { entries: Record<string, Consult> } } }> =>
  page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
async function enter(page: Page) {
  const world: World = { ...newWorld("conversation-ui", PEOPLE), day: 2, slot: 1, energy: 20,
    opinion: { shen: 0 }, present: { shen: "counter", luyao: "rival" } };
  await page.addInitScript(({ world, save, coach, steps, version }) => {
    if (!localStorage.getItem(save)) localStorage.setItem(save, JSON.stringify({ version, world, ui: { screen: "play", reqSeen: 2 } }));
    localStorage.setItem(coach, JSON.stringify(steps));
  }, { world, save: SAVE_KEY, coach: COACH_KEY, steps: COACH_STEPS, version: WORLD_SAVE_VERSION });
  await page.goto("/?chrome=app");
  await page.getByRole("button", { name: /^继续/ }).click();
  await page.getByRole("button", { name: /查看沈薇/ }).click();
  await page.getByRole("button", { name: "接待 12 精力", exact: true }).click();
}
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`连续接待 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  test("问完留在这段谈话，回应与刚问的问题同时可读，继续问不重新找位置", async ({ page }) => {
    await enter(page);
    const question = page.getByRole("button", { name: "这一次大概想带几支？", exact: true });
    await question.click();
    await expect(question).toBeDisabled();
    await expect(page.locator(".consult-status")).toContainText("还可探 3 次");
    await page.screenshot({ path: `${audit}/ask-${width}.png` });
    writeFileSync(`${audit}/ask-${width}.json`, JSON.stringify({
      question: await question.boundingBox(),
      reply: await page.locator(".probe-reply").boundingBox(),
      scrollTop: await page.locator(".consult-scroll .mobile-scroll").evaluate(e => e.scrollTop),
      saved: (await saved(page)).ui.consults.entries.shen,
    }, null, 2));
    await expect.soft(question).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".probe-reply")).toContainText("最多 3 支");
    await expect(page.locator(".probe-reply")).toContainText("还有顾虑");
    await expect(page.locator(".probe-reply")).toBeInViewport({ ratio: 1 });
    expect((await saved(page)).world.energy).toBe(8);
    await page.getByRole("button", { name: "带妆久了会不会闷痘？", exact: true }).click();
    await expect(page.locator(".probe-reply")).toContainText("T区到下午就闷");
    await expect(page.locator(".probe-reply")).toBeInViewport({ ratio: 1 });
    await expect(page.getByLabel("已知需求")).toContainText("温和不闷");
    expect((await saved(page)).ui.consults.entries.shen.patience).toBe(2);
    expect((await saved(page)).world.energy).toBe(8);
  });
  test("观察后就地读线索，旧谈话免费回看；刷新后继续谈保留最后回应与成本", async ({ page }) => {
    await enter(page);
    await page.getByRole("button", { name: "看她的鼻翼", exact: true }).click();
    await expect(page.locator(".probe-reply")).toContainText("局部微红出油");
    await expect(page.locator(".probe-reply")).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `${audit}/look-${width}.png` });
    const before = await saved(page);
    const history = page.locator(".consult-listen-history");
    await history.locator("summary").click();
    await expect(history.locator(".serve-lines")).toContainText("一厚就假");
    await expect(history.locator(".serve-lines")).toContainText("局部微红出油");
    expect(await saved(page)).toEqual(before);
    await history.locator("summary").click();
    await page.reload(); await page.getByRole("button", { name: /^继续/ }).click();
    await expect(page.locator(".world-serve")).toBeVisible();
    await expect(page.locator(".probe-reply")).toContainText("局部微红出油");
    await expect(page.locator(".probe-reply")).toBeInViewport({ ratio: 1 });
    expect((await saved(page)).world.energy).toBe(before.world.energy);
    expect((await saved(page)).ui.consults.entries.shen).toEqual(before.ui.consults.entries.shen);
  });
  test("最后一次试用后切回问话不冒认旧问题，耐心用完仍可读取反应并开单", async ({ page }) => {
    await enter(page);
    for (const name of ["这一次大概想带几支？", "带妆久了会不会闷痘？", "要不要直接看套装？"])
      await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("tab", { name: "挑货开单" }).click();
    await page.getByRole("button", { name: "粉底 ¥980 薄·撑妆", exact: true }).click();
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    await expect(page.locator(".consult-reaction")).toContainText("就是这个感觉");
    const afterTry = await saved(page);
    await page.getByRole("tab", { name: "了解客人" }).click();
    await expect(page.locator(".probe-reply")).toContainText("就是这个感觉");
    await expect(page.locator(".probe-reply")).toContainText("你直接说吧");
    await expect(page.locator(".probe-reply")).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.serve-probe[aria-label="问"] .probe-reply')).toHaveCount(0);
    await expect(page.locator('.serve-probe[aria-label="问"] button:enabled')).toHaveCount(0);
    await page.screenshot({ path: `${audit}/last-reply-${width}.png` });
    await page.getByRole("tab", { name: "挑货开单" }).click();
    expect((await saved(page)).ui.consults.entries.shen).toEqual(afterTry.ui.consults.entries.shen);
    await page.getByRole("button", { name: "3 件", exact: true }).click();
    await page.getByRole("button", { name: "开给她", exact: true }).click();
    await expect(page.locator(".receipt-amount")).toContainText("+¥2,940");
  });
});

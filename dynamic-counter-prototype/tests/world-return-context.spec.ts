import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { drawStorylet, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE, STORYLETS } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { World } from "../src/world/types.ts";
import type { Consult } from "../src/world/consult.ts";
const audit = process.env.RETURN_AUDIT_DIR ?? "../audit/return-context-2026-10-18";
mkdirSync(audit, { recursive: true });
const saved = (page: Page): Promise<{ world: World; ui: { resumeConsult?: string; consults?: { entries: Record<string, Consult> } } }> =>
  page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
async function seed(page: Page, world: World, ui: Record<string, unknown>) {
  await page.goto("/?chrome=app");
  await page.evaluate(({ key, version, world, ui, coach, steps }) => {
    localStorage.setItem(key, JSON.stringify({ version, world, ui }));
    localStorage.setItem(coach, JSON.stringify(steps));
  }, { key: SAVE_KEY, version: WORLD_SAVE_VERSION, world, ui, coach: COACH_KEY, steps: COACH_STEPS });
  await page.reload();
}
const floor = (): World => ({ ...newWorld("return-context", PEOPLE), day: 2, slot: 1, energy: 20,
  present: { shen: "counter", luyao: "rival" }, opinion: { shen: 0 } });
async function startTalking(page: Page) {
  await seed(page, floor(), { screen: "play", reqSeen: 2 });
  await page.getByRole("button", { name: /^继续/ }).click();
  await page.getByRole("button", { name: /查看沈薇/ }).click();
  await page.getByRole("button", { name: "接待 12 精力", exact: true }).click();
  await page.getByRole("button", { name: "带妆久了会不会闷痘？", exact: true }).click();
}
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`回来接上 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  test("接待中断后说明谈到哪里，一次继续直接回原接待且不重复扣费", async ({ page }) => {
    await seed(page, floor(), { screen: "play", reqSeen: 2 });
    await page.getByRole("button", { name: /^继续/ }).click();
    await page.getByRole("button", { name: /查看沈薇/ }).click();
    await page.getByRole("button", { name: "接待 12 精力", exact: true }).click();
    await page.getByRole("button", { name: "带妆久了会不会闷痘？", exact: true }).click();
    const before = await saved(page);
    await page.reload();
    await page.getByRole("button", { name: /^继续/ }).click({ trial: true });
    await page.screenshot({ path: `${audit}/consult-entry-${width}.png` });
    expect(await saved(page)).toEqual(before);
    await expect(page.getByLabel("上次停在这里")).toContainText("沈薇");
    await expect(page.getByLabel("上次停在这里")).toContainText("T区到下午就闷");
    const resume = page.getByRole("button", { name: "继续 · 和沈薇接着谈", exact: true });
    await expect(resume).toBeInViewport({ ratio: 1 }); await resume.click();
    await expect(page.locator(".world-serve")).toBeVisible();
    await expect(page.getByLabel("已知需求")).toContainText("温和不闷");
    expect((await saved(page)).world).toEqual(before.world);
    expect((await saved(page)).ui.consults).toEqual(before.ui.consults);
    await page.getByRole("button", { name: "这一次大概想带几支？", exact: true }).click();
    expect((await saved(page)).world.energy).toBe(before.world.energy);
    await page.screenshot({ path: `${audit}/consult-resumed-${width}.png` });
  });
  test("打烊时退出，继续页说结算的那一天，不把下一天说成已经开工", async ({ page }) => {
    const w: World = { ...floor(), day: 8, slot: 0, money: 1180 };
    await seed(page, w, { screen: "report", reqSeen: 7,
      report: { day: 7, moneyDelta: 1180, movers: [], tomorrow: [], week: true } });
    const before = await saved(page);
    await page.screenshot({ path: `${audit}/report-entry-${width}.png` });
    const resume = page.getByRole("button", { name: "继续 · 看第 7 天的账", exact: true });
    await expect(resume).toBeInViewport({ ratio: 1 });
    await expect(page.getByLabel("上次停在这里")).toContainText("第 7 天已经打烊");
    expect(await saved(page)).toEqual(before);
    await resume.click();
    await expect(page.locator(".report-eyebrow")).toContainText("第 7 天");
    await expect(page.getByRole("button", { name: "进入第 8 天", exact: true })).toBeVisible();
    expect((await saved(page)).world).toEqual(before.world);
  });
  test("挑货中断能恢复所选商品、件数和最后一次试用，继续后真实开单", async ({ page }) => {
    await startTalking(page);
    for (const name of ["这一次大概想带几支？", "你最怕镜头看到什么？"])
      await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("tab", { name: "挑货开单" }).click();
    await page.getByRole("button", { name: /^粉底 ¥980 薄·撑妆/ }).click();
    await page.getByRole("button", { name: "3 件", exact: true }).click();
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    const before = await saved(page); await page.reload();
    await expect(page.getByLabel("上次停在这里")).toContainText("就是这个感觉");
    await page.getByRole("button", { name: /^继续/ }).click();
    await expect(page.getByRole("tab", { name: "挑货开单" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".consult-reaction")).toContainText("就是这个感觉");
    expect((await saved(page)).world).toEqual(before.world);
    expect((await saved(page)).ui.consults).toEqual(before.ui.consults);
    await page.locator(".serve-commit").click();
    await expect(page.locator(".receipt-amount")).toContainText("+¥2,940");
    expect((await saved(page)).world.energy).toBe(before.world.energy);
  });
  test("主动关闭后回楼层；没有新停点字段的旧档仍可手动接着谈", async ({ page }) => {
    await startTalking(page);
    await page.locator(".world-serve .pc-close").click();
    const before = await saved(page);
    expect(before.ui.resumeConsult).toBeUndefined();
    await page.reload();
    await expect(page.getByLabel("上次停在这里")).toContainText("沈薇的谈话还留着");
    await page.getByRole("button", { name: /^继续/ }).click();
    await expect(page.locator(".world-serve")).toHaveCount(0);
    expect((await saved(page)).world).toEqual(before.world);
    await page.getByRole("button", { name: /查看沈薇/ }).click();
    await page.getByRole("button", { name: /接着谈/ }).click();
    await expect(page.getByLabel("已知需求")).toContainText("温和不闷");
    await page.evaluate(key => { const s = JSON.parse(localStorage.getItem(key)!); delete s.ui.resumeConsult; localStorage.setItem(key, JSON.stringify(s)); }, SAVE_KEY);
    await page.reload(); await page.getByRole("button", { name: /^继续/ }).click();
    await expect(page.locator(".world-serve")).toHaveCount(0);
    expect((await saved(page)).ui.consults).toEqual(before.ui.consults);
  });
  test("损坏停点、过期接待和对面客人不会被直接拉回柜台", async ({ page }) => {
    await startTalking(page); const talking = await saved(page);
    const cases = [
      { world: talking.world, ui: { ...talking.ui, resumeConsult: ["shen"] } },
      { world: { ...talking.world, slot: 2 as const }, ui: talking.ui },
      { world: { ...talking.world, present: { shen: "rival" as const, luyao: "rival" as const } }, ui: talking.ui },
    ];
    for (const s of cases) {
      await seed(page, s.world, { ...s.ui, screen: "play", reqSeen: 2 });
      await page.getByRole("button", { name: /^继续/ }).click();
      await expect(page.locator(".world-serve")).toHaveCount(0);
      expect((await saved(page)).world).toEqual(s.world);
    }
  });
  test("未完剧情和季末回顾恢复原位置，不补抽剧情、不擅自进入新季", async ({ page }) => {
    await startTalking(page); const talking = await saved(page);
    const draw = drawStorylet(talking.world, PEOPLE, STORYLETS); expect(draw.drawn).toBeTruthy();
    await seed(page, draw.world, { ...talking.ui, screen: "play", reqSeen: 2,
      pending: { id: draw.drawn!.storylet.id, binding: draw.drawn!.binding } });
    await page.getByRole("button", { name: "继续 · 接上这段故事", exact: true }).click();
    await expect(page.locator(".world-story")).toBeVisible();
    await expect(page.locator(".world-serve")).toHaveCount(0);
    expect((await saved(page)).world).toEqual(draw.world);
    const season = { ...floor(), day: 29, money: 12000 };
    await seed(page, season, { ...talking.ui, screen: "season" });
    // 旧接待字段不能把季末入口改成接待入口。
    await expect(page.getByLabel("上次停在这里")).toContainText("第 1 季已经收工");
    await page.screenshot({ path: `${audit}/season-entry-${width}.png` });
    await page.getByRole("button", { name: "继续 · 看第 1 季回顾", exact: true }).click();
    await expect(page.locator(".world-recap")).toBeVisible();
    expect((await saved(page)).world).toEqual(season);
  });
  test("继续页用公开约定提醒下一件事，打开或继续不会替玩家联系或成交", async ({ page }) => {
    const w: World = { ...floor(), day: 5,
      weekendOrder: { person: "liangxia", due: 7, prepared: true, sponsor: "anjie" } };
    await seed(page, w, { screen: "play", reqSeen: 5 });
    await expect(page.getByLabel("上次停在这里")).toContainText("安姐已经替你牵线");
    await page.screenshot({ path: `${audit}/appointment-entry-${width}.png` });
    await page.getByRole("button", { name: /^继续/ }).click();
    expect((await saved(page)).world).toEqual(w);
    await expect(page.locator(".weekend-preview")).toContainText("安姐已牵线");
  });
});

// 第 4 级那三块界面的走查（?mode=world）。
// 存档是手工拼的 World 落盘（跟 world-floor.spec.ts 同一个办法）：把职级旗与分支旗写进去，
// 那一屏就该按分支长出来。每一处都钉「看得见的判据」，不钉内部实现。
import assert from "node:assert/strict";
import { expect, test, type Page } from "@playwright/test";
import { newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { World } from "../src/world/types.ts";

// 到了第 4 级还没选分支的世界（那一屏会挡住别的）。
const rank4World = (over: Partial<World> = {}): World => ({
  ...newWorld("branch-seed", PEOPLE),
  day: 2, slot: 1, money: 4_600,
  qualities: { "career:rank": 4 },
  present: { roman: "counter", suman: "counter", luyao: "rival", mei: "counter" },
  ...over,
});

const envelope = (world: World) =>
  JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "play" } });

const saveWorld = async (page: Page, world: World) => {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
    [SAVE_KEY, envelope(world)]);
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
    [COACH_KEY, JSON.stringify(COACH_STEPS)]);
};

test("到了第 4 级：三条路摆出来，选一条才算数", async ({ page }) => {
  await saveWorld(page, rank4World());
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  const choice = page.getByRole("region", { name: "三条路" });
  await expect(choice).toBeVisible();
  await expect(choice.getByRole("button")).toHaveCount(3);
  await expect(choice).toContainText("区域督导");
  await expect(choice).toContainText("维珞 BA");
  await expect(choice).toContainText("自己的店");
  // 选一条：那一屏让开，页顶的职级换成分支的名字。
  await choice.getByRole("button", { name: /自己的店/ }).click();
  await expect(choice).toBeHidden();
  await expect(page.locator(".world-bar-info b")).toContainText("自己的店");
});

test("三条路互斥：选过就定死，而且记在档里", async ({ page }) => {
  await saveWorld(page, rank4World());
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  const choice = page.getByRole("region", { name: "三条路" });
  await choice.getByRole("button", { name: /区域督导/ }).click();
  await expect(choice).toBeHidden();
  await expect(page.locator(".world-bar-info b")).toContainText("区域督导");
  // 选过的那一条要落进存档：这一屏下次再开时它还在，不再问第二遍。
  const flags = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw).world.qualities as Record<string, number>) : {};
  }, SAVE_KEY);
  assert.equal(flags["career:branch:district"], 1, "选过的那条分支没记进存档");
  assert.equal(flags["career:branch:own"], undefined);
  assert.equal(flags["career:branch:weiluo"], undefined);
});

test("区域督导：今天在哪个柜，选完当天定住", async ({ page }) => {
  await saveWorld(page, rank4World({ qualities: { "career:rank": 4, "career:branch:district": 1 } }));
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  const picker = page.getByRole("region", { name: "今天在哪个柜" });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("button")).toHaveCount(3);
  await expect(picker).toContainText("还没定");
  await picker.getByRole("button", { name: "西柜" }).click();
  await expect(picker).toContainText("今天在西柜");
  await expect(picker).toContainText("今天定住了");
  // 定住了：另外两个按暗，按不动。
  await expect(picker.getByRole("button", { name: "东柜" })).toBeDisabled();
});

test("自己开店：页顶看的是结余，不是毛收入", async ({ page }) => {
  await saveWorld(page, rank4World({ money: 40_000,
    qualities: { "career:rank": 4, "career:branch:own": 1, "career:rent": 9_000 } }));
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  const bar = page.locator(".world-bar-score");
  await expect(bar).toContainText("结余 ¥31,000");
  await expect(bar).not.toContainText("我方");
});

test("跳去维珞：对面那一位换成老同事周敏", async ({ page }) => {
  await saveWorld(page, rank4World({
    // 手拼的盘不走 beginSlot：在场的人得自己写上 —— 周敏站对面，陆遥站你这一边。
    present: { roman: "counter", suman: "counter", zhoumin: "rival", luyao: "counter", mei: "counter" },
    qualities: { "career:rank": 4, "career:branch:weiluo": 1 } }));
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  // 楼层上站在对面那一侧的，是周敏；陆遥改站你这一边。
  await expect(page.locator(".wf-tag", { hasText: "周敏" })).toBeVisible();
  await expect(page.locator(".wf-tag", { hasText: "陆遥" })).toBeVisible();
});

test("被换掉：这段职业生涯到此为止，剩一屏收场的话", async ({ page }) => {
  await saveWorld(page, rank4World({ qualities: {
    "career:rank": 4, "career:branch:own": 1, "career:ended": 1 } }));
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  const end = page.getByRole("region", { name: "职业终局" });
  await expect(end).toBeVisible();
  await expect(end).toContainText("铺子黄了");
  await expect(end.getByRole("button", { name: "开新局" })).toBeVisible();
});

test("走完一遍：判词给出来，接着干也能接着走", async ({ page }) => {
  await saveWorld(page, rank4World({ qualities: {
    "career:rank": 4, "career:branch:own": 1, "career:done": 1 } }));
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  const end = page.getByRole("region", { name: "职业终局" });
  await expect(end).toBeVisible();
  await expect(end).toContainText("这间铺子你开下来了");
  // 两种收法都在：接着干，或者收摊开新局。
  await expect(end.getByRole("button", { name: "接着干" })).toBeVisible();
  await expect(end.getByRole("button", { name: /收摊/ })).toBeVisible();
  // 接着干：那一屏让开，楼层接着走。
  await end.getByRole("button", { name: "接着干" }).click();
  await expect(end).toBeHidden();
  await expect(page.locator(".world-bar-info b")).toContainText("自己的店");
});

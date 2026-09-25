import { expect, test, type Page } from "@playwright/test";
import { CUSTOMERS, SAVE_KEY } from "../src/campaign";

// P46：成交卡那句时间账原来只念连带那一档自己占的分钟（"占用现场 2 分钟"），
// 而第 1 天真正挤走梅女士的，是沈薇这一位在柜前花掉的 8 分钟 —— 恰好是她肯等的全部。
// 这一屏要同时看得见两个数，且大的那个数要和旁边那位的状态对得上。
// 下面每一个数都是从这一遍点击流里量出来的（8 / 5 / ¥1,960 / ¥980 / 3 分钟剩余 / 那句离席记录）。
async function visitShen(page: Page, faceTrial: boolean) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  // 楼层时钟钉住：这一屏要量的是"手上的动作花几分钟"，不许把挂机那几分钟混进来。
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "查看沈薇", exact: true }).click();
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  const cues = page.locator(".cue-actions button");
  await cues.nth(0).click();
  await cues.nth(0).click();
  await cues.nth(1).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
  await page.getByRole("button", { name: "柔焦 ¥980", exact: true }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  const interruption = page.getByRole("button", { name: "让顾客确认需求", exact: true });
  if (await interruption.count()) await interruption.click();
  if (faceTrial) await page.getByRole("button", { name: /^半脸上妆/ }).click();
  await page.locator(".bundle-choices button").filter({ hasText: faceTrial ? "两件连带" : "一件" }).first().click();
  await page.getByRole("button", { name: "提出成交", exact: true }).click();
  return page.locator(".result-units");
}

// 现场那一列顾客状态（.floor-queue 在 ≥1101px 是 display:none，桌面读的是这条 rail）。
const railStatus = (page: Page, name: string) => page.locator(".customer-list button").filter({ hasText: name }).locator("small");
const saved = (page: Page) => page.evaluate(key => JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
  lost?: string[]; waitMeters?: Record<string, number>; history?: Array<string | { text?: string }>,
}, SAVE_KEY);

test("看够两处、问一句、试一次、再上脸：卡上念的是这一位花掉的 8 分钟，而现场刚好被这一单清空", async ({ page }) => {
  const receipt = await visitShen(page, true);
  await expect(receipt).toHaveText("2 件 · 整单 ¥1,960 · 这一位在柜前花掉 8 分钟，其中开单占 2 分钟");
  // 旧那句不许留下来：它单独看是对的（连带两件确实占两分钟），摆在这一屏却把"一单很便宜"教给了玩家。
  await expect(receipt).not.toContainText("占用现场");
  // 同一张卡的右边那位就是被这 8 分钟挤走的：不用离开这一屏就能对上。
  expect(CUSTOMERS.mei.patience, "这条钉的是「梅女士等 8 分钟」那个人；她改了就要重测这一屏").toBe(8);
  await expect(railStatus(page, "梅女士"), "卡上写着 8 分钟，旁边那一格就该是她的下场").toHaveText("已离开");
  // 现场空了，所以这一屏不再说"等待的人一起倒数"——它说的是闭店那一步。两句都在同一屏读得到。
  await expect(page.locator(".result-next p")).toHaveText("今天的接待结束了，柜台还有一件事要处理。");
  await expect(page.getByRole("button", { name: "处理闭店事件", exact: true })).toBeVisible();
  await page.screenshot({ path: "../audit/experience-v2/p46-sandbox-visit-minutes.png" });

  const state = await saved(page);
  expect(state.lost).toEqual(["mei"]);
  expect(state.history?.map(item => (typeof item === "string" ? item : item.text))).toContain(CUSTOMERS.mei.lostLine);
});

test("省掉上妆那一格、连带只开一件：同一张卡念 5 分钟，梅女士还在等", async ({ page }) => {
  const receipt = await visitShen(page, false);
  await expect(receipt).toHaveText("1 件 · 整单 ¥980 · 这一位在柜前花掉 5 分钟，其中开单占 1 分钟");
  await expect(page.locator(".result-next p")).toHaveText("还有 1 位顾客。刚才这一位在柜前花掉 5 分钟，等待的人一起倒数。");
  await expect(railStatus(page, "梅女士")).toHaveText("正在等你");
  await page.screenshot({ path: "../audit/experience-v2/p46-sandbox-lean-visit.png" });
  // 8 分钟耐心 − 这一单的 5 分钟 = 3：重复看已经看过的那处没占第二分钟，占了的话这里就是 2。
  expect((await saved(page)).waitMeters?.mei, "梅女士剩的分钟数").toBe(3);
});

// P43（手机版）：同一条规则在手机上要能用同一只手摸到。
// 沙盘那一份（rescue-e2e/typed-demand.spec.ts）钉的是诉求板；这一份钉的是她脸上那一屏的两句：
// 手记里她答的那一句，和 `.demand-said` 那句「她在意：…」。刷新后还得在，因为 revealed 是存档里的字段。
import { expect, test, type Page } from "@playwright/test";
import { INITIAL, QUESTIONS, TRAIT_LABELS } from "../src/campaign";

async function seedSave(page: Page, patch: Record<string, unknown> = {}) {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), { ...INITIAL, ...patch });
  await page.reload();
}

async function openConsult(page: Page, name: string, cues: string[]) {
  await page.getByRole("button", { name: "查看" + name }).click();
  await page.getByRole("button", { name: "观察" + name }).click();
  for (const cue of cues) await page.getByRole("button", { name: "观察" + cue, exact: true }).click();
}

async function typeAsk(page: Page, text: string) {
  await page.getByLabel("对顾客说").fill(text);
  await page.getByLabel("对顾客说").press("Enter");
}

const said = (page: Page) => page.locator(".demand-said");
const chat = (page: Page) => page.getByLabel("接待对话");

// 她脸上那两处都只指向"先稳住"，第二条（不闷痘）只有问得出来才看得到。
test("打字问出第二条诉求：她答那句，「她在意」多那一条，刷新还在", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await openConsult(page, "梅女士", ["眼下", "脸颊"]);
  await expect(said(page)).toContainText(TRAIT_LABELS.soothe);
  await expect(said(page)).not.toContainText(TRAIT_LABELS.steady);
  await expect(said(page)).toContainText("还有 2 条她没说出口");
  await typeAsk(page, "脸上有痘，用这个会不会闷出来更多？");
  await expect(chat(page)).toContainText("几乎不用，越厚越显累。");
  await expect(said(page)).toContainText(TRAIT_LABELS.steady);
  await expect(said(page)).toContainText("还有 1 条她没说出口");
  await page.screenshot({ path: "../audit/experience-v2/p43-mobile-typed-steady.png" });
  await page.reload();
  await page.getByRole("button", { name: "继续第 1 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "查看梅女士" }).click();
  await page.getByRole("button", { name: "观察梅女士" }).click();
  await expect(said(page)).toContainText(TRAIT_LABELS.steady);
  await expect(said(page)).toContainText("还有 1 条她没说出口");
});

// 同一句"痘"字，问的是遮瑕还是闷痘：旧口径只能落到她第一条有用的问题。
test("打字问的是场合，她就答场合那句，不是拿闷痘那句顶回来", async ({ page }) => {
  await seedSave(page, { day: 2 });
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await openConsult(page, "小雨", ["眼下", "脸颊"]);
  await expect(said(page)).toContainText(TRAIT_LABELS.steady);
  await typeAsk(page, "明天是什么场合，要多遮一点吗");
  await expect(chat(page)).toContainText("想像换了张脸");
  await expect(chat(page)).not.toContainText("别闷痘");
  await expect(said(page)).toContainText(TRAIT_LABELS.correct);
  await page.screenshot({ path: "../audit/experience-v2/p43-mobile-typed-correct.png" });
});

// 她答不出的那件事不能被冒充成"她答了"：问偏了只有一句"没接这个话"，诉求板不许多出一条。
test("她答不出的那件事，「她在意」不会凭空多出一条", async ({ page }) => {
  await seedSave(page, { day: 3 });
  await page.getByRole("button", { name: "继续第 3 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await openConsult(page, "段小姐", ["眼神", "皮肤"]);
  const before = await said(page).innerText();
  await typeAsk(page, "婚礼当天能撑一整天不脱吗");
  const answer = (await chat(page).innerText()).replace(before, "");
  for (const question of QUESTIONS.duan) {
    expect(answer, "问偏了不该拿她准备过的另一句顶上去").not.toContain(question.response);
  }
  expect(answer).toContain("走");
  await expect(said(page)).not.toContainText(TRAIT_LABELS.wear);
});

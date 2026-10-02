// P43（手机版）：同一条规则在手机上要能用同一只手摸到。
// 沙盘那一份（rescue-e2e/typed-demand.spec.ts）钉的是诉求板；这一份钉的是她脸上那一屏的两句：
// 手记里她答的那一句，和 `.demand-said` 那句「她在意：…」。刷新后还得在，因为 revealed 是存档里的字段。
import { expect, test, type Page } from "@playwright/test";
import { CUSTOMERS, INITIAL, QUESTIONS, TRAIT_LABELS, type CustomerId } from "../src/campaign";

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

// P45：白问那句十句各是各的。手机这一屏拿到的要念她自己的原话（写死的那句，读 deflection 字段是循环自证），
// 且不是另外九句里的任何一句 —— 两个人的台词互换要在这里红。
const otherDeflections = (id: CustomerId) => (Object.keys(CUSTOMERS) as CustomerId[])
  .filter(other => other !== id)
  .map(other => CUSTOMERS[other].deflection);

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
  expect(answer).toContain("我就是来看看，你别绕我。");
  for (const other of otherDeflections("duan")) expect(answer, "这句不是段小姐的话").not.toContain(other);
  await expect(said(page)).not.toContainText(TRAIT_LABELS.wear);
});

// P44（手机版）：她身上那两处线索都不露任何诉求，所以「她在意」里多出来的每一条都得是问出来的。
// 改之前把「东西不是我用」打进去，她会白答最重那一条，把低风险和先稳住一起露出来（还算问对了 +2 信任）。
test("她那句「不是我用」问回去，她答这一句：「她在意」不会凭空多出两条", async ({ page }) => {
  await seedSave(page, { day: 3 });
  await page.getByRole("button", { name: "继续第 3 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await openConsult(page, "赵女士", ["神情", "信息"]);
  await expect(said(page)).not.toContainText("她在意");
  await typeAsk(page, "东西不是我用");
  await expect(chat(page)).toContainText("不是我用。看我的脸没有用。");
  for (const question of QUESTIONS.zhao.filter(entry => entry.reveals.length)) {
    expect(await chat(page).innerText(), "白问那句不许冒充她答过的答案").not.toContain(question.response);
  }
  await expect(said(page)).not.toContainText("她在意");
  await page.screenshot({ path: "../audit/experience-v2/p44-mobile-white-ask.png" });
  // 上面那句是"认得出来"的那一档，兜底落点没被走过。这一句她压根没准备过：白问只能落在一条什么都不露的问题上。
  await typeAsk(page, "你们几点关门");
  await expect(chat(page)).toContainText("这话你该去问我女儿，我说不来这些。");
  for (const other of otherDeflections("zhao")) {
    await expect(chat(page), "这句不是赵女士的话").not.toContainText(other);
  }
  await page.screenshot({ path: "../audit/experience-v2/p45-mobile-white-ask-her-own-line.png" });
  await expect(said(page), "白问那句不许把她最重那条答案的诉求记进「她在意」").not.toContainText("她在意");
  // 同一屏的反面：她自己说过「我怕的是送错」，照着问回去就该拿到那一句、多出那一条。
  await typeAsk(page, "我怕的是送错");
  await expect(chat(page)).toContainText("我怕的是送错，不是看着不够贵。");
  await expect(said(page)).toContainText(`她在意：${TRAIT_LABELS.soothe}`);
  await page.screenshot({ path: "../audit/experience-v2/p44-mobile-echo-her-words.png" });
});

// P52（手机版）：同一件事在手机上要用同一只手摸到——「闷痘」她答得出且露诉求；
// 「遮瑕」落在她自己那句接得住的拒答上，挡回那句不许顶替，留着没说的那条也不凭空露出来。
test("沈薇被问闷痘答她那句、「她在意」多低风险；被问遮瑕接得住但不露她留着的那条", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await openConsult(page, "沈薇", ["眼下", "脸颊"]);
  await expect(said(page)).toContainText(TRAIT_LABELS.natural);
  await typeAsk(page, "带妆久了会不会闷痘");
  await expect(chat(page)).toContainText("T区到下午就闷");
  await expect(said(page)).toContainText(TRAIT_LABELS.steady);
  await typeAsk(page, "能遮住痘印吗");
  await expect(chat(page)).toContainText("盖住不难，盖完还是我这张脸才难。");
  expect(await chat(page).innerText(), "挡回那句不许顶替她准备好的拒答").not.toContain(CUSTOMERS.shen.deflection);
  await expect(said(page), "她留着没说的那条不许凭空露出来").not.toContainText(TRAIT_LABELS.correct);
  await page.screenshot({ path: "../audit/experience-v2/p52-mobile-typed-shen.png" });
});


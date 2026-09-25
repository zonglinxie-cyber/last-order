// P43（沙盘）：「用自己的话问」要问得到她答得出的第二条诉求。
// 规则层（tests/consult-chat.test.ts）钉的是解析本身；这两条钉的是玩家那一屏：
// 打字问到哪件事，她答那句、诉求板就多出那一条 —— 观察给她的那一条不能替打字充数。
import { expect, test, type Page } from "@playwright/test";
import { CUSTOMERS, INITIAL, QUESTIONS, SAVE_KEY, TRAIT_LABELS, type Campaign } from "../src/campaign";

async function seed(page: Page, value: Campaign) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // 沙盘离开页面会把内存里那一份写回存档（src/CounterGame.tsx 的 unload effect），
  // 先掐掉这一页的 setItem，再用 Storage 原型自己写，否则旧文档带着旧状态回来抢写。
  await page.evaluate(({ key, v }) => {
    localStorage.setItem = () => {};
    Object.getPrototypeOf(localStorage).setItem.call(localStorage, key, JSON.stringify(v));
  }, { key: SAVE_KEY, v: value });
  await page.reload();
}

const revealed = (page: Page) => page.evaluate(key => ((JSON.parse(localStorage.getItem(key) ?? "{}") as {
  activeSession: { revealed: string[] } | null;
}).activeSession?.revealed ?? []) as string[], SAVE_KEY);

async function open(page: Page, name: string, cues: string[]) {
  await page.getByRole("button", { name: "查看" + name, exact: true }).click();
  await page.getByRole("button", { name: "接待" + name, exact: true }).click();
  for (const cue of cues) await page.getByRole("button", { name: "观察" + cue, exact: true }).click();
}

async function typeAsk(page: Page, text: string) {
  await page.getByLabel("对顾客说", { exact: true }).fill(text);
  await page.getByRole("button", { name: "开口问", exact: true }).click();
}

const demand = (page: Page, label: string) => page.locator(".demand-board p").filter({ hasText: label });

// 梅女士脸上那两处都只指向"先稳住"，第二条（不闷痘）只有问得出来才看得到。
test("打字问出她答得出的第二条：她答那句，诉求板多那一条", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await open(page, "梅女士", ["眼下", "脸颊"]);
  // 观察给的是"先把干燥泛红稳住"，这一屏她还没说过闷不闷痘。
  await expect(demand(page, TRAIT_LABELS.soothe)).toHaveCount(1);
  await expect(demand(page, TRAIT_LABELS.steady)).toHaveCount(0);
  expect(await revealed(page)).toEqual(["soothe"]);
  await typeAsk(page, "脸上有痘，用这个会不会闷出来更多？");
  await expect(page.locator(".consultation-notes p").filter({ hasText: "几乎不用，越厚越显累。" })).toHaveCount(1);
  await expect(demand(page, TRAIT_LABELS.steady)).toHaveCount(1);
  expect(await revealed(page), "打字问到的那条才是这次多出来的信息").toEqual(["soothe", "steady"]);
  await page.screenshot({ path: "../audit/experience-v2/p43-sandbox-typed-steady.png" });
});

// 同一句"痘"字，问的是遮瑕还是闷痘：旧口径只能落到她第一条有用的问题，答的和问的不是同一件事。
test("打字问的是遮瑕，她就答遮瑕那句，不是拿闷痘那句顶回来", async ({ page }) => {
  await seed(page, { ...INITIAL, day: 2, eventDoneDays: [1] });
  await open(page, "小雨", ["眼下", "脸颊"]);
  await expect(demand(page, TRAIT_LABELS.steady)).toHaveCount(1);
  await expect(demand(page, TRAIT_LABELS.correct)).toHaveCount(0);
  await typeAsk(page, "能不能遮一下痘印");
  await expect(page.locator(".consultation-notes p").filter({ hasText: "想像换了张脸" })).toHaveCount(1);
  await expect(page.locator(".consultation-notes p").filter({ hasText: "别闷痘" })).toHaveCount(0);
  await expect(demand(page, TRAIT_LABELS.correct)).toHaveCount(1);
  expect(await revealed(page), "遮瑕这条是打字问出来的，不是观察顺手带出来的").toEqual(["natural", "steady", "correct"]);
  await page.screenshot({ path: "../audit/experience-v2/p43-sandbox-typed-correct.png" });
});

// 她没准备过的那件事不能被冒充成"她答了"：这一条钉的是问偏了的时候界面不给她答案。
test("她答不出的那件事，诉求板不会凭空多出一条", async ({ page }) => {
  await seed(page, { ...INITIAL, day: 3, eventDoneDays: [1, 2] });
  await open(page, "段小姐", ["眼神", "皮肤"]);
  await typeAsk(page, "婚礼当天能撑一整天不脱吗");
  const notes = page.locator(".consultation-notes p.customer");
  await expect(notes).toHaveCount(1);
  // 只说"没多出诉求"不够：她答不出时不能把她准备过的某一句挪过来冒充。
  // 手记是折叠的 details，innerText 在隐藏节点上是空串 —— 这里要读 textContent。
  const said = (await notes.first().textContent()) ?? "";
  for (const question of QUESTIONS.duan) {
    expect(said, "问偏了不该拿她准备过的另一句顶上去").not.toContain(question.response);
  }
  expect(said).toContain("走");
  await expect(notes).not.toContainText(CUSTOMERS.duan.cues.nose.finding);
  expect(await revealed(page), "问偏了不该换来新诉求").toEqual(["natural"]);
  await expect(demand(page, TRAIT_LABELS.wear)).toHaveCount(0);
});

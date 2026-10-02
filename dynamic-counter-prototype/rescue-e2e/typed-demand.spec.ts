// P43（沙盘）：「用自己的话问」要问得到她答得出的第二条诉求。
// 规则层（tests/consult-chat.test.ts）钉的是解析本身；这两条钉的是玩家那一屏：
// 打字问到哪件事，她答那句、诉求板就多出那一条 —— 观察给她的那一条不能替打字充数。
import { expect, test, type Page } from "@playwright/test";
import { CUSTOMERS, INITIAL, QUESTIONS, SAVE_KEY, TRAIT_LABELS, type Campaign, type CustomerId } from "../src/campaign";

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

// P45：白问那句十句各是各的。界面这一屏拿到的要念她自己的原话（写死的那句，读 deflection 字段是循环自证），
// 而且不是另外九句里的任何一句 —— 两个人的台词互换要在这里红。
const otherDeflections = (id: CustomerId) => (Object.keys(CUSTOMERS) as CustomerId[])
  .filter(other => other !== id)
  .map(other => CUSTOMERS[other].deflection);

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
  // 以前这里是全柜共用的一句"我现在就可以走"；P45 起她挡回来说的是自己的话。
  expect(said).toContain("我就是来看看，你别绕我。");
  for (const other of otherDeflections("duan")) expect(said, "这句不是段小姐的话").not.toContain(other);
  await expect(notes).not.toContainText(CUSTOMERS.duan.cues.nose.finding);
  expect(await revealed(page), "问偏了不该换来新诉求").toEqual(["natural"]);
  await expect(demand(page, TRAIT_LABELS.wear)).toHaveCount(0);
});

// P44：她身上那两处线索都不露任何诉求，所以这一屏「她在意」里的一条都不是白来的。
// 改之前把「东西不是我用」打进去，她会白答最重那一条、把低风险和先稳住一起露出来（还算问对了）。
test("她自己那句「不是我用」问回去，她答这一句，不答她最重那条答案", async ({ page }) => {
  await seed(page, { ...INITIAL, day: 3, eventDoneDays: [1, 2] });
  await open(page, "赵女士", ["神情", "信息"]);
  const notes = page.locator(".consultation-notes p.customer");
  expect(await revealed(page), "这两处线索本来什么都不露").toEqual([]);
  await typeAsk(page, "东西不是我用");
  await expect(notes.first()).toContainText("不是我用。看我的脸没有用。");
  for (const question of QUESTIONS.zhao.filter(entry => entry.reveals.length)) {
    expect(await notes.first().textContent(), "白问那句不许冒充她答过的答案").not.toContain(question.response);
  }
  expect(await revealed(page), "认不出她在说哪件事，一条诉求都不许多").toEqual([]);
  await page.screenshot({ path: "../audit/experience-v2/p44-sandbox-white-ask.png" });
  // 上面那句是"认得出来"的那一档，兜底落点没被走过。这一句她压根没准备过：白问只能落在一条什么都不露的问题上。
  await page.getByRole("button", { name: /再问一句/ }).click();
  await typeAsk(page, "你们几点关门");
  expect(await revealed(page), "白问那句不许把她最重那条答案的诉求记上").toEqual([]);
  // 她那一条有用的问题一次露两条（低风险 + 先稳住），所以这两格都要点名 —— 诉求板上还有"没说出口"和"底线"两行，不能只数行数。
  await expect(demand(page, TRAIT_LABELS.steady)).toHaveCount(0);
  await expect(demand(page, TRAIT_LABELS.soothe)).toHaveCount(0);
  expect(await notes.last().textContent(), "白问那句要念她自己的话").toContain("这话你该去问我女儿，我说不来这些。");
  for (const other of otherDeflections("zhao")) {
    expect(await notes.last().textContent(), "这句不是赵女士的话").not.toContain(other);
  }
  await page.screenshot({ path: "../audit/experience-v2/p45-sandbox-white-ask-her-own-line.png" });
  // 同一屏的反面：她自己说过「我怕的是送错」，照着问回去就该拿到那一句。
  await page.getByRole("button", { name: /再问一句/ }).click();
  await typeAsk(page, "我怕的是送错");
  await expect(notes.last()).toContainText("我怕的是送错，不是看着不够贵。");
  expect(await revealed(page), "照她的原话问回来，露出的是说出这句话那一格的诉求").toEqual(["soothe"]);
  await expect(demand(page, TRAIT_LABELS.soothe)).toHaveCount(1);
  await page.screenshot({ path: "../audit/experience-v2/p44-sandbox-echo-her-words.png" });
});

// P52（沙盘）：「会不会闷痘」本来就是她鼻翼那处线索露的事——以前落空白格念挡回，现在有一条真问题接得住。
// 反过来「遮瑕」是她留着没说的那条：话接得住（她自己那句，不是挡回），但诉求板不许多一条。
test("沈薇被问闷痘答她那句、诉求板多低风险；被问遮瑕接得住但不露她留着的那条", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await open(page, "沈薇", ["眼下", "脸颊"]);
  expect(await revealed(page)).toEqual(["natural"]);
  const notes = page.locator(".consultation-notes p.customer");
  await typeAsk(page, "带妆久了会不会闷痘");
  await expect(notes.filter({ hasText: "T区到下午就闷" })).toHaveCount(1);
  await expect(demand(page, TRAIT_LABELS.steady)).toHaveCount(1);
  expect(await revealed(page), "打字问到闷痘露出的是她本来就有的那条").toEqual(["natural", "steady"]);
  await page.getByRole("button", { name: /再问一句/ }).click();
  await typeAsk(page, "能遮住痘印吗");
  await expect(notes.filter({ hasText: "盖住不难，盖完还是我这张脸才难。" })).toHaveCount(1);
  expect(await notes.last().textContent(), "她留着没说的那条不许被一句挡回顶替").not.toContain(CUSTOMERS.shen.deflection);
  expect(await revealed(page), "她没准备答的那条不许凭空露出来").toEqual(["natural", "steady"]);
  await page.screenshot({ path: "../audit/experience-v2/p52-sandbox-typed-shen.png" });
});


import { expect, test, type Page } from "@playwright/test";
import { CUSTOMERS, INITIAL, SAVE_KEY } from "../src/campaign";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
}
async function consult(page: Page, name: string, product: string) {
  await page.getByRole("button", { name: "查看" + name, exact: true }).click();
  await page.getByRole("button", { name: "接待" + name, exact: true }).click();
  // 观察按钮写的是她自己给的说法（灯光、清单、手机），每个人不一样，所以按位置取前两处；
  // 名字对不对由下面那条专门的用例守着。
  const cues = page.locator(".cue-actions button");
  await expect(cues).toHaveCount(3);
  await cues.nth(0).click();
  await cues.nth(1).click();
  // 同名的人按天排：安姐第 4 天问皮肤、第 5 天问当天要撑到几点，按现场有的那句问。
  const questions: Record<string, string[]> = {
    沈薇: ["你最怕镜头看到什么？", "昨天最满意哪一点？"],
    梅女士: ["明早最想改善哪里？"],
    小雨: ["预算里最不能牺牲什么？"],
    周姐: ["对面说的持妆你信吗？", "昨天那款同事怎么说？"],
    赵女士: ["女儿用过什么会不舒服？"],
    段小姐: ["真的只是看看吗？"],
    安姐: ["婚礼前皮肤最近稳定吗？", "今天几点开始化，几点能卸？"],
  };
  for (const label of questions[name]) {
    const button = page.getByRole("button", { name: label, exact: true });
    if (await button.count()) { await button.click(); break; }
  }
  await page.getByRole("button", { name: product, exact: true }).click();
  await page.getByRole("button", { name: "为" + name + "试用", exact: true }).click();
}

test("the full floor-to-consultation campaign reaches the honest ending after reloads", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await start(page);
  const days = [
    { people: [["沈薇", "柔焦 ¥980", "三件整套"], ["梅女士", "修护 ¥1,680"]], event: /拒绝补登记/ },
    { people: [["小雨", "柔焦 ¥980"], ["周姐", "柔焦 ¥980", "两件连带"]], event: /提出平分/ },
    { people: [["赵女士", "修护 ¥1,680"], ["段小姐", "柔焦 ¥980"]], event: /换低价基础款/ },
    { people: [["安姐", "修护 ¥1,680", "批量追加"], ["周姐", "修护 ¥1,680"]], event: /只按额度给两套/ },
    { people: [["安姐", "持妆 ¥1,280", "两件连带"], ["沈薇", "柔焦 ¥980", "批量追加"]], event: /把评价分给柜台/ },
  ];
  for (let day = 0; day < days.length; day++) {
    if (day > 0) {
      await page.getByRole("button", { name: "开始营业", exact: true }).click();
      await page.getByRole("button", { name: "暂停", exact: true }).click();
    }
    for (let index = 0; index < days[day].people.length; index++) {
      const [name, product, bundle] = days[day].people[index];
      await consult(page, name, product, bundle);
      if (await page.getByRole("button", { name: "先登记接待", exact: true }).count()) {
        await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
      }
      // 连带按开口要的件数计时：只开到她自己说过的上限。
      if (bundle) await page.getByRole("button", { name: new RegExp("^" + bundle) }).click();
      await expect(page.getByRole("region", { name: "本单报价" })).toBeVisible();
      await page.getByRole("button", { name: "登记我的接待", exact: true }).click();
      await page.getByRole("button", { name: "提出成交", exact: true }).click();
      await expect(page.getByRole("heading", { name: name + "成交", exact: true })).toBeVisible();
      await page.getByRole("button", { name: index === days[day].people.length - 1 ? "处理闭店事件" : "回到现场", exact: true }).click();
    }
    await page.getByRole("button", { name: days[day].event }).click();
    if (day === 3) await expect(page.locator(".large-number")).toContainText("¥17,430");
    await page.reload(); // Closed-day state and all money survive, no repeated event.
    await page.getByRole("button", { name: day === 4 ? "查看活动周结局" : "进入下一天", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "你留下了，而且没变成她们", exact: true })).toBeVisible();
  await expect(page.locator(".large-number")).toContainText("¥25,590");
  await expect(page.locator(".order-line")).toHaveCount(10);
  await page.reload();
  await expect(page.getByRole("heading", { name: "你留下了，而且没变成她们", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a saved observation and pending rival resume; a sample does not erase rejection", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  await page.getByRole("button", { name: "观察眼下", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "观察眼下", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "观察脸颊", exact: true }).click();
  await page.getByLabel("对顾客说", { exact: true }).fill("镜头里你最介意粉感吗？");
  await page.getByRole("button", { name: "开口问", exact: true }).click();
  await page.getByRole("button", { name: "修护 ¥1,680", exact: true }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "先登记接待", exact: true })).toBeVisible();
  const rival = await page.getByLabel("竞品打断").boundingBox();
  const face = await page.locator(".portrait-window").boundingBox();
  expect(rival!.y).toBeGreaterThanOrEqual(face!.y + face!.height);
  await page.getByRole("button", { name: "先登记接待", exact: true }).click();
  await page.getByRole("button", { name: "留小样 · 8", exact: true }).click();
  await expect(page.getByRole("button", { name: "接受拒绝", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "接受拒绝", exact: true }).click();
  await expect(page.getByRole("heading", { name: "沈薇拒绝成交", exact: true })).toBeVisible();
  await expect(page.locator(".large-number")).toHaveText("+ ¥0");
});

// 近景上的三个点位对每个人意味着不一样的东西：观察按钮要念她给的那句，而不是脸的方位。
test("the observe controls speak in her words, not in anatomical directions", async ({ page }) => {
  await page.goto("/");
  await seed(page, { ...INITIAL, day: 3 });
  await page.reload();
  await page.getByRole("button", { name: "查看段小姐", exact: true }).click();
  await page.getByRole("button", { name: "接待段小姐", exact: true }).click();
  const names = (["eyes", "cheek", "nose"] as const).map(cue => "观察" + CUSTOMERS.duan.cues[cue].label);
  expect(names).toEqual(["观察眼神", "观察皮肤", "观察手机"]);
  for (const name of names) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  expect(await page.locator(".portrait-cue").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label"))))
    .toEqual(["面部线索：眼神", "面部线索：皮肤", "面部线索：手机"]);
  // 勾要看得见，但不能进名字：否则点过一次之后这个按钮就查不到了。
  await page.getByRole("button", { name: "观察眼神", exact: true }).click();
  await expect(page.getByRole("button", { name: "观察眼神", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "观察眼神", exact: true })).toContainText("✓");
  await page.screenshot({ path: "../audit/experience-v2/cue-labels-her-words.png" });
});

// 同一条规则在两个 UI 里都读得出她的名字：第 5 天回到柜台的安姐，第三处线索是宴会厅的灯光。
test("the customer who came back on day five is read by the light she asked about", async ({ page }) => {
  await page.goto("/");
  await seed(page, { ...INITIAL, day: 5, flags: ["served:anjie:good"] });
  await page.reload();
  await page.getByRole("button", { name: "查看安姐", exact: true }).click();
  await page.getByRole("button", { name: "接待安姐", exact: true }).click();
  await expect(page.getByRole("button", { name: "观察灯光", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "观察手机", exact: true })).toHaveCount(0);
});

const clockMinutes = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));

// 半脸上妆是玩家自己开的一步：多花两分钟，换她没说出口的那件事。
test("a half-face demo is optional, charges the queue two minutes and says what she did not", async ({ page }) => {
  await page.clock.install();
  await start(page);
  await consult(page, "沈薇", "柔焦 ¥980");
  await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
  const faceTrial = page.getByRole("button", { name: "半脸上妆 · 多占 2 分钟", exact: true });
  await expect(faceTrial).toBeVisible();
  const clock = page.locator(".shift-clock strong");
  const before = clockMinutes(await clock.textContent() ?? "");
  await faceTrial.click();
  await expect(page.getByText("妆面压在她脸上，她才承认：低风险，不刺激不闷痘")).toBeVisible();
  expect(clockMinutes(await clock.textContent() ?? "")).toBe(before + 2);
  // 一支只能上一次脸；按钮用完就收走，不留成第二个金色动作。
  await expect(faceTrial).toHaveCount(0);
  await page.screenshot({ path: "../audit/experience-v2/face-trial.png" });
});

test("a split sale shows and persists the actual credited amount", async ({ page }) => {
  await start(page);
  await consult(page, "沈薇", "柔焦 ¥980");
  await page.getByRole("button", { name: "让她演示", exact: true }).click();
  await page.getByRole("button", { name: /^三件整套/ }).click();
  await expect(page.getByLabel("本单报价")).toContainText("你入账 ¥1,470");
  await page.getByRole("button", { name: "提出成交", exact: true }).click();
  await expect(page.locator(".large-number")).toHaveText("+ ¥1,470");
  await page.reload();
  await expect(page.locator(".rail-sales")).toContainText("¥1,470");
});

test("floor acceleration consumes patience and pause freezes it", async ({ page }) => {
  await page.clock.install();
  await start(page);
  await page.clock.fastForward(60_000);
  await expect(page.locator(".shift-clock strong")).toHaveText("19:00");
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.clock.runFor(20_000);
  await expect(page.locator(".shift-clock strong")).toHaveText("19:04");
  await expect(page.getByRole("button", { name: "接待沈薇", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.clock.fastForward(120_000);
  await expect(page.locator(".shift-clock strong")).toHaveText("19:04");
  // 耐心是分钟数：四位一分钟地倒数，走到零就换人带走。
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.clock.runFor(20_000);
  await expect(page.locator(".shift-clock strong")).toHaveText("19:08");
  await expect(page.getByRole("button", { name: "接待沈薇", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "接待梅女士", exact: true })).toHaveCount(0);
  await expect(page.locator(".floor-journal")).toContainText(/维珞|地铁/);
});

test("the floor is alive: people walk the shared geometry and freeze with the clock", async ({ page }) => {
  await page.clock.install();
  await start(page);
  const spot = (name: string) => page.getByRole("button", { name, exact: true }).evaluate(el => el.style.left + "," + el.style.top);
  const walking = page.locator(".rescue-pawn.walking");
  const staff = ["查看罗曼", "查看苏蔓", "查看唐可", "查看陆遥"];
  const before = await Promise.all(staff.map(spot));
  const shenBefore = parseFloat((await spot("查看沈薇")).split(",")[0]);
  await page.getByRole("button", { name: "1×", exact: true }).click();
  await page.clock.runFor(45_000);
  const after = await Promise.all(staff.map(spot));
  // 每个人都在自己的那条线上走：四个位置的站位都要动过。
  expect(after.filter((value, index) => value !== before[index]).length).toBe(after.length);
  await expect(walking.first()).toBeVisible();
  // 等得越久，人越往门口的方向漂——耐心倒数终于有了看得见的形状。
  // 取样要等到七分多钟：那之前来回逛的幅度（55 单位）比漂移还大，四十几秒时量到的正负全看她在哪一段路上。
  await page.clock.runFor(100_000);
  expect(parseFloat((await spot("查看沈薇")).split(",")[0]) - shenBefore).toBeGreaterThan(5);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const paused = await Promise.all([...staff, "查看沈薇"].map(spot));
  await page.clock.fastForward(180_000);
  expect(await Promise.all([...staff, "查看沈薇"].map(spot))).toEqual(paused);
});

test("phone viewport keeps face visible and key service actions usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await consult(page, "沈薇", "柔焦 ¥980");
  await page.getByRole("button", { name: "先登记接待", exact: true }).click();
  await expect(page.getByRole("button", { name: "提出成交", exact: true })).toBeInViewport();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  for (const name of ["返回现场", "提出成交", "已登记归属"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const face = await page.locator(".portrait-window").boundingBox();
  expect(face!.height).toBeGreaterThan(220);
  await page.screenshot({ path: "../audit/experience-v2/regression-phone-service.png" });
  await page.getByRole("button", { name: "提出成交", exact: true }).click();
  await expect(page.getByRole("heading", { name: "沈薇成交", exact: true })).toBeVisible();
});

test("加微信 costs a floor minute and only comes after she has taken something", async ({ page }) => {
  await page.clock.install();
  await start(page);
  await page.getByRole("button", { name: "查看沈薇", exact: true }).click();
  const member = page.getByRole("button", { name: "加微信 沈薇", exact: true });
  await expect(member).toBeDisabled();
  await expect(page.getByText("她还没接到过你的东西")).toBeVisible();
  await page.getByRole("button", { name: "留小样 · 8", exact: true }).click();
  await expect(member).toBeEnabled();
  await member.click();
  await expect(member).toHaveText("已在名单");
  await expect(page.locator(".rail-detail")).toContainText("名单 1");
  // 要微信不是免费动作：现场走一分钟，她自己也停在原地。
  await expect(page.locator(".shift-clock strong")).toHaveText("19:01");
  await expect(page.locator(".floor-journal")).toContainText("沈薇把你加进了微信名单");
  await page.screenshot({ path: "../audit/experience-v2/roster-dock.png" });
});

// 只有参数能跨过浏览器边界，存档键要从外面传进去。
const seed = (page: Page, state: Record<string, unknown>) => page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVE_KEY, value: state });

test("the morning read states the settled number once, and a reload does not repeat it", async ({ page }) => {
  await page.goto("/");
  await seed(page, { ...INITIAL, day: 2, sales: 1500, daySales: 1500, standing: 44, samples: 7 });
  await page.reload();
  await expect(page.locator(".rail-standing")).toHaveText("柜位已经写进评估表");
  await expect(page.locator(".floor-journal")).toContainText("晨会 · 累计达成 54%");
  await page.screenshot({ path: "../audit/experience-v2/morning-standing.png" });
  await page.reload();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as typeof INITIAL, SAVE_KEY);
  expect(saved.standing).toBe(36);
  expect(saved.history.filter(entry => entry.text.startsWith("晨会 ·"))).toHaveLength(1);
});

test("the finale states what happened to the counter itself, not only the money", async ({ page }) => {
  await page.goto("/");
  await seed(page, { ...INITIAL, day: 5, sales: 23000, trust: 60, compliance: 60, standing: 30, finished: true, eventDoneDays: [1, 2, 3, 4, 5] });
  await page.reload();
  await expect(page.getByRole("heading", { name: "你留下了，而且没变成她们", exact: true })).toBeVisible();
  await expect(page.locator(".ending-checks")).toContainText("撤柜评估已经写上去");
  await expect(page.locator(".counter-verdict")).toHaveText("绮光这个柜位被排进下一轮撤柜评估。你留下的数字，被人拿去说明面积不够。");
});

test("when the counter is under review the roster is a card you can put on the table", async ({ page }) => {
  await page.goto("/");
  await seed(page, {
    ...INITIAL, day: 5, sales: 6000, daySales: 0, standing: 44, samples: 2, members: ["shen", "mei"],
    dayServed: ["returning"], eventDoneDays: [1, 2, 3, 4], relations: { ...INITIAL.relations, roman: 40 },
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "柜位在评估表上", exact: true })).toBeVisible();
  await expect(page.getByText("2 个人是她问不到")).toBeVisible();
  await page.screenshot({ path: "../audit/experience-v2/counter-event.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".event-panel")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: "../audit/experience-v2/counter-event-phone.png", fullPage: true });
  await page.getByRole("button", { name: /把私域名单放在桌上/ }).click();
  await expect(page.locator(".decision-response")).toContainText("方敏把人数抄进报告");
  await page.getByRole("button", { name: "查看活动周结局", exact: true }).click();
  await expect(page.locator(".ending-checks")).toContainText("柜位留下，名单归你");
});

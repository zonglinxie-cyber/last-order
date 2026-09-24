import { expect, test, type Page } from "@playwright/test";
import { CUSTOMERS, INITIAL, RECORDS_MIN, SAVE_KEY, evidenceWord } from "../src/campaign";

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
      // 一周的柔焦配货到第 5 天只剩 3 支：断货要在她面前先说清楚，也要当场给得出两条出路。
      if (day === 4 && name === "沈薇") {
        await expect(page.locator(".quote-note")).toHaveText("柜上只剩 3 支，这单最多开到 3 件。");
        await expect(page.locator(".stock-transfer button")).toHaveCount(2);
      }
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
  // 第 5 天沈薇的连带被抽屉削掉一支：¥980 是柜上没了，不是算错。与手机版、规则模拟器同一条路线同一个数。
  await expect(page.locator(".large-number")).toContainText("¥24,610");
  await expect(page.locator(".order-line")).toHaveCount(10);
  await page.reload();
  await expect(page.getByRole("heading", { name: "你留下了，而且没变成她们", exact: true })).toBeVisible();
  // 达标之后页顶不能再念"还差 ¥0"。
  await expect(page.locator(".top-score")).toContainText("五日 ¥21,000 已经做到");
  // 一路按「登记我的接待」的 UI 路线，本子里的行数要和规则模拟器测出来的同一个数，
  // 否则第 5 晚那句「摊得开」就是界面和判词各说一套。
  expect(await page.evaluate(key => (JSON.parse(localStorage.getItem(key) ?? "{}") as { evidence: number }).evidence, SAVE_KEY)).toBe(12);
  expect(errors).toEqual([]);
});

// 抽屉见底不是隐藏数值：报价单先按现货说话，两条出路当场摆出来，一支一周只调一次。
test("one call reopens the drawer, and the other one is 唐可's decision", async ({ page }) => {
  await page.goto("/");
  await seed(page, { ...INITIAL, stock: { soft: 2, glow: 4, repair: 7 } });
  await page.reload();
  await consult(page, "沈薇", "柔焦 ¥980");
  await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
  // 她要 3 件、抽屉里只剩 2 支：连带按钮先按现货报，她开口之后报价单再说同一件事。
  const triple = page.getByRole("button", { name: /^三件整套/ });
  await expect(triple).toContainText("¥1,960");
  await triple.click();
  await expect(page.locator(".quote-note")).toHaveText("柜上只剩 2 支，这单最多开到 2 件。");
  const official = page.getByRole("button", { name: "请罗曼开调拨单 · 3 分钟", exact: true });
  await expect(official).toBeEnabled();
  // 私下拿货不留台账，但要唐可愿意帮你——她这一周还不想。
  const privateCall = page.getByRole("button", { name: /^找唐可拿三支 · 2 分钟/ });
  await expect(privateCall).toBeDisabled();
  await expect(privateCall).toContainText("唐可不会把货给一个刚跟她抢过单的人");
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as {
    stock: Record<string, number>; compliance: number; waitMeters: Record<string, number>;
  }, SAVE_KEY);
  await official.click();
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as {
    stock: Record<string, number>; compliance: number; waitMeters: Record<string, number>; flags: string[]; history: Array<{ text: string }>;
  }, SAVE_KEY);
  expect(after.stock.soft - before.stock.soft).toBe(3);
  // 走系统的单子在台账上留名：合规 +2，离柜 3 分钟从排队另一头扣。
  expect(after.compliance - before.compliance).toBe(2);
  expect(before.waitMeters.mei - after.waitMeters.mei).toBe(3);
  expect(after.flags).toContain("transfer:soft");
  expect(after.history.at(-1)?.text).toContain("台账上写着你的名字");
  // 一周只调得出这一次，所以这一行整体收掉，报价也不再削件。
  await expect(page.locator(".stock-transfer")).toHaveCount(0);
  await expect(page.locator(".quote-note")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^三件整套/ })).toContainText("¥2,940");
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

// 现场还差什么，念成她说的话：近景下面报没看的点，栏位里报她的原话，屏上不摆 x/y。
test("what the counter still misses is read as her words, not as a fraction", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  const rest = page.locator(".portrait-rest");
  // 只看过一处时她脸上全是闪着的点，报「还剩几处」没有取舍可言
  await expect(rest).toHaveCount(0);
  expect(await page.locator(".cue-actions button").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-pressed"))))
    .toEqual(["false", "false", "false"]);
  await expect(page.locator(".demand-board")).toContainText("还有 3 条她没说出口 · 问出来，或上脸试出来");
  await page.getByRole("button", { name: "观察眼下", exact: true }).click();
  await page.getByRole("button", { name: "观察脸颊", exact: true }).click();
  await expect(rest).toHaveText("她脸上还有 1 处没看：鼻翼");
  // 看没看过由近景上那三个点自己说，不用再摆一个计数
  expect(await page.locator(".portrait-cue").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-pressed"))))
    .toEqual(["true", "true", "false"]);
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
  await expect(page.locator(".consultation-notes summary")).toHaveText("接待手记 她答了 1 句");
  await page.getByRole("button", { name: "柔焦 ¥980", exact: true }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
  // 上脸那一步的按钮已经摆在下面，那句话不用再教一遍怎么问
  await expect(page.locator(".demand-blind")).toHaveText("还有 2 条她没说出口");
  await expect(page.locator(".demand-veto b")).toHaveText("底线");
  await expect(page.locator(".demand-veto")).toContainText("一厚就卡粉，镜头里全是粉感");
  const restBox = await rest.boundingBox();
  const frame = await page.locator(".portrait-window").boundingBox();
  expect(restBox!.y + restBox!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
  const cueBottoms = await page.locator(".portrait-cue").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().bottom));
  // 这一行是贴着近景下面放的，不能压住脸上的点位
  expect(Math.max(...cueBottoms)).toBeLessThanOrEqual(restBox!.y + 1);
  await expect(page.locator(".consult-scene")).not.toContainText(/\d\s\/\s\d/);
  await page.screenshot({ path: "../audit/experience-v2/consult-record-words.png" });
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

// 第一晚那句"两个顾客，只能先抓住一个"终于是要按下去的一下：迎上去把已经在看表的人请回来，另一位的分钟照扣。
test("walking out with a sample pulls the waiting one back, and the other one pays", async ({ page }) => {
  await page.clock.install();
  await start(page);
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.clock.runFor(30_000); // 六分钟：两位都只剩两拍
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const chip = (name: string) => page.locator(".floor-queue button", { hasText: name }).locator("small");
  await expect(chip("梅女士")).toHaveText("2 分钟耐心");
  await expect(chip("沈薇")).toHaveText("2 分钟耐心");
  await expect(page.locator(".pawn-name[aria-label='查看梅女士'] small")).toHaveText("开始看表");
  await page.getByRole("button", { name: "查看梅女士", exact: true }).click();
  const pull = page.getByRole("button", { name: /^迎上去/ });
  // 按不动的理由写在按钮上，不用先翻手册才知道轮不轮得到自己。
  await expect(pull).toHaveText("迎上去 · 1 支小样 · 2 分钟");
  const doorBefore = await page.locator(".pawn-name[aria-label='查看梅女士']").evaluate(el => parseFloat(el.style.left));
  await pull.click();
  await expect(chip("梅女士")).toHaveText("8 分钟耐心");
  await expect(page.locator(".pawn-name[aria-label='查看梅女士'] small")).toHaveText("正在等你");
  await expect(page.locator(".rail-detail")).toHaveText("小样 7 份 · 名单 0 人");
  await expect(page.locator(".shift-clock strong")).toHaveText("19:08");
  await expect(page.locator(".floor-journal")).toContainText("把她从中庭那边请回柜台");
  // 离柜的两分钟从另一头扣：沈薇不是"快走了"，是被陆遥带走了。
  await expect(page.locator(".floor-queue button")).toHaveCount(1);
  await expect(page.locator(".floor-journal")).toContainText("陆遥带沈薇去了维珞");
  // 沙盘上她真的走回来：位置只由耐心决定，表停着，位移就是这一步换来的。
  // 75.125% → 59.5% 是从"开始看表"那一步量到的实测站位，不是估的。
  const doorAfter = await page.locator(".pawn-name[aria-label='查看梅女士']").evaluate(el => parseFloat(el.style.left));
  console.log("PULL MEI left", doorBefore, "->", doorAfter, "delta", (doorAfter - doorBefore).toFixed(2));
  expect(doorAfter).toBeCloseTo(59.5, 1);
  expect(doorBefore - doorAfter).toBeGreaterThan(1);
  // 用过之后按钮不消失，改成说人话的"为什么轮不到"，免得以为是自己漏看了一个动作。
  const spent = page.locator(".floor-actions button", { hasText: "这一周已经迎过她一次" });
  await expect(spent).toBeDisabled();
  await page.screenshot({ path: "../audit/experience-v2/floor-pull-over.png" });
  await page.reload();
  await expect(page.locator(".rail-detail")).toHaveText("小样 7 份 · 名单 0 人");
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
  // 栏位里不剩裸的体力分和进度条：站不站得住是一句话，差多少是一句钱。
  await expect(page.locator(".rail-energy")).toHaveText("还站得住，能再接 4 位");
  // 记录本在栏位里也是一句话，和第 5 晚判的是同一条线（不是第四个数字）。
  await expect(page.locator(".rail-records")).toHaveText("记录本 空着");
  // 差多少只在页顶说一遍，栏位里不再开第二块记分牌（进度条也一起撤了）。
  await expect(page.locator(".top-score")).toContainText("还差 ¥19,500");
  await expect(page.locator(".rail-target")).toHaveCount(0);
  await expect(page.locator(".target-track")).toHaveCount(0);
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
  // 摊记录之前得先让她知道本子里有没有东西，不然这一步是盲选。
  await expect(page.getByText("只是你的本子摊开来没几行")).toBeVisible();
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

// 同一晚同一句话，本子摊不摊得开落点不同：空本子救不回柜位，这不是暗扣。
// 实测：一路按「登记我的接待」的干净路线五天有 12 行；一个人都没接到的路线只有 2 行。
for (const [evidence, verdict] of [[0, "撤柜评估已经写上去"], [RECORDS_MIN, "柜位留到季度末"]] as const) {
  test(`spreading the record book needs a book that has pages（留痕 ${evidence}）`, async ({ page }) => {
    // 上一轮的存档会在关页时被内存里的状态写回去，种子必须在页面脚本跑起来之前落盘。
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: SAVE_KEY, value: {
        ...INITIAL, day: 5, sales: 6000, daySales: 0, standing: 41, samples: 2, evidence,
        dayServed: ["returning"], eventDoneDays: [1, 2, 3, 4], relations: { ...INITIAL.relations, roman: 40 },
      },
    });
    await page.goto("/");
    await expect(page.getByText(evidence ? "五天本子摊得开" : "只是你的本子摊开来没几行")).toBeVisible();
    // 栏位那句话和事件判词必须念同一本账：同一个 evidenceWord，同一个 RECORDS_MIN。
    await expect(page.locator(".rail-records")).toHaveText(`记录本 ${evidenceWord(evidence)}`);
    await page.getByRole("button", { name: /把五天记录摊开/ }).click();
    await expect(page.locator(".decision-response")).toContainText(evidence ? "在表上写了备注" : "就这些");
    await page.getByRole("button", { name: "查看活动周结局", exact: true }).click();
    await expect(page.locator(".ending-checks")).toContainText(verdict);
    await page.screenshot({ path: `../audit/experience-v2/record-book-${evidence}.png` });
  });
}

// 当晚的跟进是有限额的：三条线只发得出两句，第三句今晚就是没有。
test("the evening panel holds two follow-ups and the third line waits", async ({ page }) => {
  await page.goto("/");
  await seed(page, {
    ...INITIAL, day: 2, sales: 4620, daySales: 0, samples: 6, dayServed: ["xiaoyu", "zhou"], eventDoneDays: [1],
    members: ["xiaoyu", "zhou"], flags: ["sample:mei", "served:mei:refused"],
    orders: [
      { day: 2, customerId: "xiaoyu", product: "soft", units: 1, total: 980, amount: 980, shared: false, risky: false },
      { day: 2, customerId: "zhou", product: "soft", units: 1, total: 980, amount: 980, shared: false, risky: false },
    ],
  });
  await page.reload();
  // 当天的人都接完了，闭店事件就在眼前：这一屏读的是今晚还剩几句。
  const panel = page.locator(".evening-touch");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("今晚跟一句 · 还能发 2 条");
  await expect(panel.locator(".touch-list button")).toHaveCount(3);
  await panel.getByRole("button", { name: /梅女士/ }).click();
  await expect(panel).toContainText("还能发 1 条");
  await expect(panel.locator(".touch-reply")).toHaveText(["梅女士回：「那支我在用。我最在意的是：先把干燥泛红稳住。这条你说得对，哪天路过我再来找你。」"]);
  await panel.getByRole("button", { name: /周姐/ }).click();
  await expect(panel).toContainText("还能发 0 条");
  // 跟过的人从名单上消失，剩下那条线按不动：配额是规则给的，不是按钮样式。
  await expect(panel.getByRole("button", { name: /小雨/ })).toBeDisabled();
  await expect(panel.locator(".touch-reply")).toHaveCount(2);
  // 回复是这一步的兑现，不能被面板自己的高度切掉半句：最后一行要整条落在面板可见区里。
  const lastReply = await panel.locator(".touch-reply").last().boundingBox();
  const panelBox = await panel.boundingBox();
  expect(lastReply!.y + lastReply!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
  await page.screenshot({ path: "../audit/experience-v2/evening-touch.png" });
  // 刷新之后还剩几句要跟着存档走，不能回到两条。
  await page.reload();
  await expect(page.locator(".evening-touch")).toContainText("还能发 0 条");
  expect(await page.evaluate(key => (JSON.parse(localStorage.getItem(key) ?? "{}") as { flags: string[] }).flags.filter(f => f.startsWith("touched:")), SAVE_KEY))
    .toEqual(["touched:mei:2", "touched:zhou:2"]);
});

// 跟进不是仪式感：第 5 天只有被跟过的那个人会补单，钱要能对上。
test("only the line you followed up actually repurchases on day five", async ({ page }) => {
  await page.goto("/");
  await seed(page, {
    ...INITIAL, day: 4, sales: 17_000, daySales: 0, samples: 2, dayServed: ["anjie"], eventDoneDays: [1, 2, 3, 4],
    members: ["shen", "mei"], flags: ["touched:shen:2"],
    orders: [
      { day: 1, customerId: "shen", product: "soft", units: 1, total: 980, amount: 980, shared: false, risky: false },
      { day: 2, customerId: "mei", product: "repair", units: 1, total: 1680, amount: 1680, shared: false, risky: false },
    ],
  });
  await page.reload();
  await page.getByRole("button", { name: "进入下一天", exact: true }).click();
  // 补单发生在清晨，所以它必须出现在第 5 天早上的那一叠通知里，不能只是账上多出来的数。
  await expect(page.locator(".dawn-note", { hasText: "沈薇在微信上补了一支柔焦" })).toBeVisible();
  await expect(page.locator(".dawn-note", { hasText: "梅女士在微信上补了一支" })).toHaveCount(0);
  await expect(page.locator(".rail-sales")).toContainText("¥980");
  // 名单上两个人，只有跟过的那一条线兑现：多出来的钱必须能追到那一晚的一句跟进。
  expect(await page.evaluate(key => (JSON.parse(localStorage.getItem(key) ?? "{}") as { sales: number }).sales, SAVE_KEY)).toBe(17_980);
  await page.screenshot({ path: "../audit/experience-v2/member-repeat.png" });
});

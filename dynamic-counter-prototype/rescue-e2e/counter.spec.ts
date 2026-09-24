import { expect, test, type Page } from "@playwright/test";
import { CUSTOMERS, demandBudgetWord, deliveryWord, EXPIRED_SAMPLING, EXPIRED_SAMPLING_NOTICE, FACE_TRIAL_RETURN, INITIAL, LEAVE_SAMPLE_RETURN, PULL_OVER_RETURN, RECORDS_MIN, SAVE_KEY, evidenceWord } from "../src/campaign";
import { ledgerYuan } from "../tests/ledger-yuan";

// 沙盘把 campaign 原样写进本机存档，所以"这一步到底做了什么"可以直接从存储里读，不用信界面。
const savedField = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>)[name] ?? -1), [SAVE_KEY, field] as [string, string]);

// 配货按天到这件事要在晨会上念出来，而不是让玩家自己算抽屉：一早就一句，念的是规则给的那句。
async function morningArrivals(page: Page, day: number) {
  const arrivals = page.locator(".dawn-note").filter({ hasText: "品牌 · 到货" });
  await expect(arrivals).toHaveCount(1);
  await expect(arrivals).toContainText(deliveryWord(day));
}

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await morningArrivals(page, 1);
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
  // 缺口在周中，不在周末：第 2 天柔焦被削一件，第 4 天修护整单开不出来。两句都写在报价单上。
  const shortages: Record<string, { note: string; sold: boolean }> = {
    "1/周姐": { note: "柜上只剩 1 支，这单最多开到 1 件。", sold: true },
    "3/周姐": { note: "柜上这一支断了：抽屉里一支修护都没有，这一单开不出来。", sold: false },
  };
  for (let day = 0; day < days.length; day++) {
    if (day > 0) {
      await morningArrivals(page, day + 1);
      if (day === 1) await page.screenshot({ path: "../audit/experience-v2/p14-morning-delivery.png" });
      if (day === 2) {
        // 开店前那一遍效期自查（条例第三十九条）：为什么现在查写在晨会上，价写在按钮上，两支小样当场出去。
        const expired = page.locator(".dawn-note").filter({ hasText: "品牌 · 巡店" });
        await expect(expired).toContainText(EXPIRED_SAMPLING_NOTICE);
        // 按下去之后按钮自己改口，所以这里认的是这一个控件，不是它当下那串字。
        const check = page.locator(".brief-check button");
        await expect(check).toHaveText(`开店前查一遍批号 · 下 ${EXPIRED_SAMPLING.units} 支 · 晚开门 ${EXPIRED_SAMPLING.minutes} 分钟`);
        await page.screenshot({ path: "../audit/experience-v2/p20-sandbox-brief-day3.png" });
        await check.click();
        await expect(check).toHaveText("查批号 · 到期那批已经下了");
        await expect(check).toBeDisabled();
        // 办完这件事，晨会就不该再拿它念第二遍。
        await expect(expired).toHaveCount(0);
        expect(await savedField(page, "samples")).toBe(INITIAL.samples - EXPIRED_SAMPLING.units);
      }
      // 查过的这一批不会再从微信上问回来：第 4 天早上不该有任何"批号"那一句。
      if (day === 3) await expect(page.locator(".dawn-note").filter({ hasText: "批号" })).toHaveCount(0);
      await page.getByRole("button", { name: "开始营业", exact: true }).click();
      await page.getByRole("button", { name: "暂停", exact: true }).click();
    }
    for (let index = 0; index < days[day].people.length; index++) {
      const [name, product, bundle] = days[day].people[index];
      await consult(page, name, product);
      if (await page.getByRole("button", { name: "先登记接待", exact: true }).count()) {
        await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
      }
      // 连带按开口要的件数计时：只开到她自己说过的上限。
      if (bundle) await page.getByRole("button", { name: new RegExp("^" + bundle) }).click();
      await expect(page.getByRole("region", { name: "本单报价" })).toBeVisible();
      const shortage = shortages[`${day}/${name}`];
      if (shortage) {
        // 开不出来不等于没得救：断货那一行旁边就是那两条出路，一起摆在同一屏上。
        await expect(page.locator(".quote-note")).toHaveText(shortage.note);
        await expect(page.locator(".stock-transfer button")).toHaveCount(2);
        // 截图要真的把两行拍进去：这一列自己会滚，视口截图只拍到断货那一行不算证据。
        await page.locator(".stock-transfer button").last().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `../audit/experience-v2/p14-${shortage.sold ? "clip" : "empty"}-day${day + 1}.png` });
      }
      await page.getByRole("button", { name: "登记我的接待", exact: true }).click();
      await page.getByRole("button", { name: "提出成交", exact: true }).click();
      await expect(page.getByRole("heading", { name: name + (shortage && !shortage.sold ? "没买成" : "成交"), exact: true })).toBeVisible();
      // 开不出来那张卡上写的出路要跟到货排期对得上：第 4 天还有一句"等大仓下一批"，第 5 天就没有。
      if (shortage && !shortage.sold) {
        await expect(page.getByText("等大仓下一批")).toBeVisible();
        await page.screenshot({ path: "../audit/experience-v2/p14-blocked-card.png" });
      }
      await page.getByRole("button", { name: index === days[day].people.length - 1 ? "处理闭店事件" : "回到现场", exact: true }).click();
    }
    await page.getByRole("button", { name: days[day].event }).click();
    if (day === 3) await expect(page.locator(".large-number")).toContainText("¥14,770");
    await page.reload(); // Closed-day state and all money survive, no repeated event.
    await page.getByRole("button", { name: day === 4 ? "查看活动周结局" : "进入下一天", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "你留下了，而且没变成她们", exact: true })).toBeVisible();
  // 第 4 天周姐那一单修护赶在到货前面：钱没开到，人也没买到。与手机版、规则模拟器同一条路线同一个数。
  await expect(page.locator(".large-number")).toContainText("¥22,930");
  // 账本要能自己加回去：把这一屏看得见的每一行 ¥ 加起来，就是页顶那个 ¥22,930。
  // 以前这里数的是另一叠小票（9 张），而晨会转来的一单、六支微信补单那些钱没有地方念。
  expect(await ledgerYuan(page)).toBe(22_930);
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
  const faceTrial = page.getByRole("button", { name: /^半脸上妆 · 多占 2 分钟/ });
  await expect(faceTrial).toBeVisible();
  // 上脸不一定给得出新东西（她可能该说的都说了），所以第二行写的是赌注，不是保证。
  await expect(faceTrial.locator("small")).toHaveText(FACE_TRIAL_RETURN);
  expect(await faceTrial.locator("small").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
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
  // 按钮上只有代价，玩家就决定不了要不要花这一支：买到什么紧跟在同一格里念出来。
  const pullNote = page.locator(".floor-action small", { hasText: PULL_OVER_RETURN });
  await expect(pullNote).toBeVisible();
  // 同一支小样的三个去处摆到一处才比得出：请回来是"现在"，留小样是"等她自己回柜"，加微信要前两步先成立。
  await expect(page.locator(".floor-action small", { hasText: LEAVE_SAMPLE_RETURN })).toBeVisible();
  await expect(page.locator(".floor-action small", { hasText: "先留一支小样" })).toBeVisible();
  // 说明行滚一下才到 = 决定已经做完了才看见理由：每句都得贴着自己那颗按钮，且不靠滚动。
  {
    const pane = await page.locator(".dock-content").boundingBox();
    const rows = await page.locator(".floor-action").evaluateAll(cells => cells.map(cell => ({
      buttonBottom: cell.querySelector("button")!.getBoundingClientRect().bottom,
      noteTop: cell.querySelector("small")!.getBoundingClientRect().top,
      said: cell.querySelector("small")!.textContent ?? "",
    })));
    expect(pane, "量不到动作面板").toBeTruthy();
    expect(rows.length, "一支小样在柜台上摆出几个去处").toBe(3);
    for (const row of rows) {
      expect(row.noteTop, `“${row.said}”没挂在自己那颗按钮下面`).toBeGreaterThanOrEqual(row.buttonBottom - 1);
      expect(row.noteTop, `“${row.said}”在滚动线以下`).toBeLessThanOrEqual(pane!.y + pane!.height + 1);
    }
  }
  await page.screenshot({ path: "../audit/experience-v2/p23-sandbox-pull-over-offer.png" });
  const doorBefore = await page.locator(".pawn-name[aria-label='查看梅女士']").evaluate(el => parseFloat(el.style.left));
  await pull.click();
  // 这一支已经花掉了：按不动的时候不把收益念第二遍。
  await expect(pullNote).toHaveCount(0);
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

// 横屏那一档（844×390）面板被钉死成一条矮带，动作区在里面是要滚的：
// 多出来那一行"买到什么"要是落在滚动线以下，玩家就是先按了、后看见理由。
test.describe("844×390 横屏", () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test("买到什么那一行和那颗按钮在同一屏，不用滚", async ({ page }) => {
    await page.clock.install();
    await start(page);
    await page.getByRole("button", { name: "4×", exact: true }).click();
    await page.clock.runFor(30_000);
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    // 横屏那一档名牌整排收起来（tight-plates 只留选中那位），选客只能走下面那条队列。
    await page.getByRole("button", { name: "选择顾客梅女士", exact: true }).click();
    const note = page.locator(".floor-action small", { hasText: PULL_OVER_RETURN });
    await expect(note).toBeVisible();
    const band = await note.boundingBox();
    const pane = await page.locator(".dock-content").boundingBox();
    console.log("PULL NOTE TIGHT", JSON.stringify({ band, pane, overflow: band && pane ? (band.y + band.height - pane.y - pane.height).toFixed(1) : null }));
    expect(band && pane, "量不到买到什么那一行").toBeTruthy();
    expect(band!.y, "那一行整个在面板上沿之外").toBeGreaterThanOrEqual(pane!.y - 1);
    expect(band!.y + band!.height - pane!.y - pane!.height, "买到什么那一行在滚动线以下").toBeLessThanOrEqual(1);
    // 这一档最挤的是行数：三格各带一句，如果每句都要占满一行，就又多出两行要滚。
    // 截流和留小样这两颗得并在同一行里 —— 它们是同一支小样的两个去处，摆散了就没得比。
    const pair = await page.locator(".floor-action").filter({ has: page.locator("small", { hasText: PULL_OVER_RETURN }) })
      .evaluateAll(cells => cells.map(cell => Math.round(cell.getBoundingClientRect().y)));
    const sampleCell = page.locator(".floor-action").filter({ has: page.locator("small", { hasText: LEAVE_SAMPLE_RETURN }) });
    expect(await sampleCell.evaluate(cell => Math.round(cell.getBoundingClientRect().y)), "截流和留小样没并成一行：两个去处要各滚一次才看全").toEqual(pair[0]);
    await page.screenshot({ path: "../audit/experience-v2/p23-sandbox-pull-over-844x390.png" });
  });
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
  // "为什么轮不到"钉在这颗按钮自己那一格：散在面板末尾就没人把它和按钮对上。
  const why = page.locator(".floor-action small", { hasText: "先留一支小样" });
  await expect(why).toBeVisible();
  await expect(why.locator("..")).toContainText("加微信");
  // 留在柜台那一支买的是"等"：能不能按和它买到什么得同时出现、也同时消失。
  const leaveNote = page.locator(".floor-action small", { hasText: LEAVE_SAMPLE_RETURN });
  await expect(leaveNote).toBeVisible();
  await page.getByRole("button", { name: "留小样 · 8", exact: true }).click();
  await expect(member).toBeEnabled();
  // 这一支已经花出去了：它的理由不许继续亮着，不然玩家以为对她还有第二条线。
  await expect(leaveNote).toHaveCount(0);
  await expect(why).toHaveCount(0);
  await expect(page.getByRole("button", { name: "留小样 · 7", exact: true })).toBeDisabled();
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

// P15：连带那一排的分钟买的是"开口多要一件"，不是"柜上多开一件"。第一张报价单就要说清楚，
// 不然第 1 天多按一档，开出来的还是同一单 3 件，却把梅女士剩下的最后一分钟花掉。
test("bundle minutes buy the ask, not the goods: the top tier says 要 4 件 when she caps at 3", async ({ page }) => {
  test.setTimeout(60_000);
  await start(page);
  await consult(page, "沈薇", "柔焦 ¥980");
  if (await page.getByRole("button", { name: "先登记接待", exact: true }).count()) {
    await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
  }
  await expect(page.locator(".bundle-choices .eyebrow")).toContainText("多要一件多占一分钟");
  await expect(page.locator(".bundle-choices .eyebrow")).not.toContainText("预算");
  const tier = (label: string) => page.locator(".bundle-choices button", { hasText: label });
  await expect(tier("三件整套")).toContainText("3 件 ¥2,940");
  await expect(tier("三件整套")).toContainText("占 3 分钟");
  await expect(tier("批量追加")).toContainText("3 件 ¥2,940");
  await expect(tier("批量追加")).toContainText("要 4 件 · 占 4 分钟");
  await page.screenshot({ path: "../audit/experience-v2/p15-bundle-row.png" });
});

// P17：同一屏一句话只念一遍。栏位（≤1100px 整块收起）是那句体力的正主，dock 那一格和成交卡只在它不在时接手；
// 她的说法由右上面板念，她的预算与上限由诉求板念，连带那一行只解释多出来的那一分钟买的是什么。
// 一句"看得见的"话在场内出现几次：只算自己写着这句话、且真的占位的节点（display:none 的接手槽不算）。
const countVisible = (page: Page, needle: string) => page.evaluate(t => Array.from(document.querySelectorAll<HTMLElement>("body *"))
  .filter(node => Array.from(node.childNodes).filter(c => c.nodeType === 3).map(c => c.textContent ?? "").join(" ").replace(/\s+/g, " ").trim() === t)
  .filter(node => node.getBoundingClientRect().width >= 2 && node.checkVisibility({ contentVisibilityAuto: true })).length, needle);
const slotText = (page: Page, selector: string) => page.evaluate(s => document.querySelector(s)?.textContent?.replace(/\s+/g, " ").trim() ?? null, selector);

test("接待那一屏：她的说法、体力、预算上限各只有一个槽在念", async ({ page }) => {
  test.setTimeout(60_000);
  await start(page);
  await consult(page, "沈薇", "柔焦 ¥980");
  if (await page.getByRole("button", { name: "先登记接待", exact: true }).count()) {
    await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
  }
  const descriptor = await slotText(page, ".customer-reading > .eyebrow");
  const energy = await slotText(page, ".rail-energy");
  const budget = await slotText(page, ".demand-budget");
  expect(budget).toBe(demandBudgetWord(CUSTOMERS.shen));
  expect(await countVisible(page, descriptor!), "她的说法在 dock 那一格又念了一遍").toBe(1);
  expect(await countVisible(page, energy!), "栏位已经念过体力，dock 不能跟着念").toBe(1);
  expect(await countVisible(page, budget!), "诉求板念过的预算与上限，连带那一行不能再说一次").toBe(1);
  expect(await page.evaluate(() => document.querySelector(".dock-person .rail-fallback")!.checkVisibility({ contentVisibilityAuto: true })),
    "栏位在场时 dock 的那个接手槽必须是收着的").toBe(false);
  await page.screenshot({ path: "../audit/experience-v2/p17-one-slot-1280x720.png" });
});

// 栏位收起来的那一档，体力那句改由 dock 接手——不能两边都念，也不能一句都没有。
test("栏位不在的那一档（1024×700），体力那句由 dock 接手念一次", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1024, height: 700 });
  await start(page);
  await page.getByRole("button", { name: "查看沈薇", exact: true }).click();
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector<HTMLElement>(".rescue-rail")!).display)).toBe("none");
  const energy = await slotText(page, ".dock-person .rail-fallback");
  expect(energy, "dock 的接手槽得真的写着那句").toBeTruthy();
  expect(await countVisible(page, energy!), "体力那句在窄一档要么没有、要么被念了两遍").toBe(1);
  await page.screenshot({ path: "../audit/experience-v2/p17-one-slot-1024x700.png" });
});

// 被抽屉削件时同一句话也要能读出来：她要 2 件、柜上只剩 1 支，那一档是在开口问，不是多开一件。
test("the same ask reads on a tier the drawer already clipped", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await seed(page, { ...INITIAL, day: 2, sales: 4_620, daySales: 0, stock: { soft: 1, glow: 4, repair: 6 }, eventDoneDays: [1], flags: ["delivered:2"] });
  await page.reload();
  // 半日存档直接开在楼层上，实时钟本来就是停的：耐心不动，这一屏才是玩家开口前看到的那一屏。
  await expect(page.locator(".shift-clock")).toContainText("现场已暂停");
  await consult(page, "周姐", "柔焦 ¥980");
  if (await page.getByRole("button", { name: "先登记接待", exact: true }).count()) {
    await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
  }
  const tier = (label: string) => page.locator(".bundle-choices button", { hasText: label });
  await expect(tier("两件连带")).toContainText("1 件 ¥980");
  await expect(tier("两件连带")).toContainText("要 2 件 · 占 2 分钟");
  await page.screenshot({ path: "../audit/experience-v2/p15-bundle-row-clipped.png" });
});

// P16：这一排是成交那一屏唯一要做决定的四格。P15 截图时才撞出来：它在 258px 的 dock 带子里压在折线以下，
// 玩家得先自己找到滚动条。这里不用任何 scrollIntoView——断言读的就是"程序落地那一屏"的几何。
const inView = () => {
  const body = document.querySelector<HTMLElement>(".service-body");
  const row = document.querySelector<HTMLElement>(".bundle-choices");
  if (!body || !row) return null;
  const band = body.getBoundingClientRect();
  const cells = [...row.querySelectorAll<HTMLElement>("button")].map(cell => cell.getBoundingClientRect());
  const centers = cells.map(cell => (cell.top + cell.bottom) / 2);
  return {
    // 一格都没被抽屉的上下边切到：四格全在可见带里。
    allInside: cells.every(cell => cell.top >= band.top - 1 && cell.bottom <= band.bottom + 1),
    // 第一格和那行说明在不在：矮到放不下整排时，至少这一排的开头要在。
    headInside: cells.every(cell => cell.top >= band.top - 1),
    eyebrow: (() => { const e = row.querySelector<HTMLElement>(".eyebrow"); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= band.top - 1 && r.bottom <= band.bottom + 1; })(),
    scrollTop: Math.round(body.scrollTop),
    // 滚过去不能把报价单的头一行切掉：那是按哪一格都在核对的数。
    quoteCut: Math.round(Math.max(0, band.top - (document.querySelector<HTMLElement>(".close-review > .order-quote")?.getBoundingClientRect().top ?? band.top))),
    cells: cells.length,
    // 四格排在同一行才比得起来：align-items:center 下同一行的格子共享垂直中心线。
    centerSpread: Math.round(Math.max(...centers) - Math.min(...centers)),
    cut: Math.round(Math.max(0, ...cells.map(cell => cell.bottom - band.bottom))),
  };
};

for (const [width, height] of [[1280, 720], [1280, 800], [1024, 700], [1440, 900]] as const) {
  test(`第一张报价单的连带四格在 ${width}×${height} 不用滚就看得完`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height });
    await start(page);
    await consult(page, "沈薇", "柔焦 ¥980");
    if (await page.getByRole("button", { name: "先登记接待", exact: true }).count()) {
      await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
    }
    const seen = await page.evaluate(inView);
    expect(seen).not.toBeNull();
    expect(seen!.cells).toBe(4);
    expect(seen!.centerSpread, "四格要排在同一行，横向比档位").toBeLessThanOrEqual(2);
    expect(seen!.cut, `抽屉没有玩家滚过就切掉 ${seen!.cut}px`).toBe(0);
    expect(seen!.quoteCut, `滚到这一排时报价单被切掉 ${seen!.quoteCut}px`).toBe(0);
    expect(seen!.allInside).toBe(true);
    await page.screenshot({ path: `../audit/experience-v2/p16-bundle-fold-${width}x${height}.png` });
  });
}

// 844×390 的抽屉只有 161px 高，四格那一行放不下：这一档只保证"这一排从开头起就在眼前"，剩下的靠滚动消化。
test("横屏矮带上至少这一排的开头在视野里，且是程序自己滚到的", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await start(page);
  await consult(page, "沈薇", "柔焦 ¥980");
  if (await page.getByRole("button", { name: "先登记接待", exact: true }).count()) {
    await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
  }
  const seen = await page.evaluate(inView);
  expect(seen!.headInside, "第一格不该在折线以上被切掉").toBe(true);
  expect(seen!.eyebrow, "「她愿意带走几件」那句要读得到").toBe(true);
  expect(seen!.scrollTop, "抽屉是程序滚过来的，不是停在开头").toBeGreaterThan(0);
  expect(seen!.quoteCut, `滚到这一排时报价单被切掉 ${seen!.quoteCut}px`).toBe(0);
  await page.screenshot({ path: "../audit/experience-v2/p16-bundle-fold-844x390.png" });
});

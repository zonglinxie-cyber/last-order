// 柜台最容易越界的那一句：只有普通备案的精华，嘴上承诺「用两周，斑就淡」。
// 沙盘这一屏守四件事：多不出第二支就没有这一格；这一格和它那一句理由落在同一屏（不靠滚）；
// 按下去当天多入账一支、钱只写一行；隔天她的「问回来」出现在晨会那一屏，只出现一次。
// 数字怎么分岔归规则单测（tests/campaign-rules.test.ts），手机版那一屏归 tests/overclaim.spec.ts。
import { expect, test, type Page } from "@playwright/test";
import { CLAIM_ASKBACK_TRUST, CLAIM_COMPLIANCE, CLAIM_LABEL, CLAIM_NOTE, CLAIM_TRUST, claimLine, INITIAL, PRODUCTS, SAVE_KEY, SAVE_VERSION } from "../src/campaign";
import { ledgerYuan } from "../tests/ledger-yuan";

const REPAIR = PRODUCTS.repair.price;
const money = (value: number) => value.toLocaleString("zh-CN");

const savedField = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>)[name] ?? -1), [SAVE_KEY, field] as [string, string]);

const savedArray = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, string[]>)[name] ?? []), [SAVE_KEY, field] as [string, string]);

// 第 1 天只配一支修护（DELIVERIES[0]），所以抽屉里的数要抹开才有"第二支"可推：
// 这一格的出现条件本身由规则单测守着，这里量的是沙盘那一屏排得下排不下。
async function closingRow(page: Page, patch: Record<string, unknown> = {}, size: readonly [number, number] = [1280, 720]) {
  await page.clock.install();
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: { ...INITIAL, version: SAVE_VERSION, day: 1, sales: 0, daySales: 0, dayServed: ["mei"], stock: { ...INITIAL.stock, repair: 3 }, ...patch },
  });
  await page.reload();
  await page.getByRole("button", { name: "查看沈薇", exact: true }).click();
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  const cues = page.locator(".cue-actions button");
  await cues.nth(0).click();
  await cues.nth(1).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
  await page.getByRole("button", { name: "修护 ¥1,680", exact: true }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  // 陆遥插一句话，dock 才轮得到成交那一排；不结掉它，这一排根本不渲染。
  if (await page.getByLabel("先登记接待").count()) await page.getByLabel("让顾客确认需求").click();
  const cell = page.locator(".closing-buttons .floor-action").filter({ hasText: CLAIM_LABEL });
  await expect(cell).toBeVisible();
  return cell;
}

for (const size of [[1280, 720], [1280, 800], [1024, 700], [640, 800], [390, 844], [844, 390]] as const) {
  test(`越界那一格和它的理由在 ${size[0]}×${size[1]} 同一屏，不靠滚也不折出格子`, async ({ page }) => {
    const cell = await closingRow(page, {}, size);
    // 第二行会不会把按钮撑出格子（≤650px 那档 closing-buttons button 是 nowrap），
    // 整排会不会掉到 dock 那条 overflow:hidden 带外、掉到折线以下。
    const seen = await cell.evaluate(node => {
      const band = node.closest<HTMLElement>(".rescue-dock");
      const button = node.querySelector("button")!;
      const small = node.querySelector("small");
      const b = (el: Element) => el.getBoundingClientRect();
      return {
        label: button.textContent ?? "",
        note: small?.textContent ?? "",
        hit: Math.round(b(button).height),
        overflowX: Math.round(button.scrollWidth - button.clientWidth),
        topGap: small ? Math.round(b(small).top - b(button).bottom) : -999,
        belowBand: Math.round(b(node).bottom - (band?.getBoundingClientRect().bottom ?? 0)),
        belowFold: Math.round(b(node).bottom - window.innerHeight),
        // 那一格被许了折行之后是往上长的（belowBand 两次都停在 -12），所以要问一句：它有没有把上面的东西挤掉。
        // 从这一格往上到带顶，任何一个会裁掉自己的祖先（或带本身）溢出多少 px。
        clip: (() => {
          let worst = 0;
          let who = "";
          for (let el: HTMLElement | null = node.parentElement; el && el !== band; el = el.parentElement) {
            if (getComputedStyle(el).overflowY === "visible") continue;
            const over = el.scrollHeight - el.clientHeight;
            if (over > worst) { worst = over; who = typeof el.className === "string" ? el.className : el.tagName; }
          }
          const bandOver = (band?.scrollHeight ?? 0) - (band?.clientHeight ?? 0);
          if (bandOver > worst) { worst = bandOver; who = "rescue-dock"; }
          return { worst, who };
        })(),
        rightOver: Math.round(b(node).right - (band?.getBoundingClientRect().right ?? 0)),
        rowOverflow: (() => { const row = node.parentElement; return row ? Math.round(row.scrollWidth - row.clientWidth) : -1; })(),
        noteLines: small ? Math.round(small.offsetHeight / parseFloat(getComputedStyle(small).lineHeight)) : 0,
        px: [button, small].filter(Boolean).map(el => parseFloat(getComputedStyle(el!).fontSize)),
        // 折行是可以的，折在词中间不行：「承 / 诺」把一句话拆成两个半截，读的人得先把它拼回去。
        // 记下每一行从原文第几个字起 —— 断点只准落在标签自己已有的那个空格上。
        labelStarts: (() => {
          const text = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
          if (!text?.textContent) return [];
          const lines: { top: number; start: number }[] = [];
          for (let i = 0; i < text.textContent.length; i++) {
            if (text.textContent[i] === " ") continue; // 行尾被吃掉的那个空格不该被当成一行的开头
            const range = document.createRange();
            range.setStart(text, i); range.setEnd(text, i + 1);
            const rect = range.getBoundingClientRect();
            const top = Math.round(rect.top);
            if (!lines.some(line => Math.abs(line.top - top) <= Math.round(rect.height / 2))) lines.push({ top, start: i });
          }
          return lines.sort((a, b) => a.top - b.top).map(line => line.start);
        })(),
      };
    });
    console.log("P36 LABEL WRAP", size.join("x"), JSON.stringify({ labelStarts: seen.labelStarts, label: seen.label }));
    console.log("P34 SANDBOX GEOMETRY", size.join("x"), JSON.stringify(seen));
    expect(seen.label).toBe(CLAIM_LABEL);
    expect(seen.note, "理由没跟在自己那颗按钮旁边").toBe(CLAIM_NOTE);
    expect(seen.hit, "主控件矮于 44px").toBeGreaterThanOrEqual(44);
    expect(seen.overflowX, "字撑出按钮：那一档按钮是 nowrap").toBeLessThanOrEqual(1);
    expect(seen.topGap, "理由浮在按钮上沿之外（跟错了格子）").toBeGreaterThanOrEqual(-1);
    expect(seen.belowBand, "整格掉到钉住那条带之外，会被 overflow 裁掉").toBeLessThanOrEqual(1);
    expect(seen.belowFold, "整格掉到折线以下：先按了、后看见理由").toBeLessThanOrEqual(1);
    // 横向同理：390×844 那一档整行比行框宽 56px 时，第三格是被推到屏幕外，不是"要滚才看到"。
    expect(seen.rightOver, "整格出到带的右沿之外").toBeLessThanOrEqual(1);
    expect(seen.rowOverflow, "成交那一排横向溢出：这一格被推到屏幕外").toBeLessThanOrEqual(1);
    expect(seen.clip.worst, `往上长出来的那一格把${seen.clip.who}里的内容挤出了可见框`).toBeLessThanOrEqual(1);
    expect(Math.min(...seen.px), "字掉到 12px 以下").toBeGreaterThanOrEqual(12);
    // 许它折行不等于许它折断（P36）：断点只准落在标签自己已有的那个空格上。
    // 390×844 那一档量到的是 [0, 8] —— 第二行从「诺」起，"承诺"这个动词被劈成两半。
    const midPhrase = seen.labelStarts.filter(start => start > 0 && CLAIM_LABEL[start - 1] !== " ");
    expect(midPhrase, `那一格被折在词中间：第 ${midPhrase.join("、")} 个字起被推到下一行`).toEqual([]);
    await page.screenshot({ path: `../audit/experience-v2/p34-sandbox-closing-${size[0]}x${size[1]}.png` });
  });
}

// 沙盘这一屏真正要比的是同一排里那两颗按钮：同样的硬推，多按这一格到底多买到什么、多付什么。
// 两边各用一个干净的 context（沙盘每秒把 React 里那份 state 写回存档，同一个 page 重塞种子会被它盖掉），
// 规则是纯函数、没有随机，所以两个数的差就是这一格的价格。
test("多带走一支、多扣一次合规，隔天她的问回来只念一次", async ({ browser, page }) => {
  const plainPage = await browser.newPage();
  await closingRow(plainPage);
  await plainPage.getByRole("button", { name: "强推成交", exact: true }).click();
  await expect(plainPage.locator(".large-number")).toHaveText(`+ ¥${money(REPAIR)}`);
  const plain = { sales: await savedField(plainPage, "sales"), trust: await savedField(plainPage, "trust"), compliance: await savedField(plainPage, "compliance") };
  await plainPage.close();

  const cell = await closingRow(page);
  await cell.click();
  await expect(page.getByRole("heading", { name: "沈薇被你推下来单", exact: true })).toBeVisible();
  // 两件事写在同一张收银记录上：多带走一支，和那句越界的话。
  await expect(page.locator(".large-number")).toHaveText(`+ ¥${money(REPAIR * 2)}`);
  await expect(page.locator(".result-units")).toContainText("2 件");
  await expect(page.getByText("淡斑属特殊化妆品，要注册才准宣称", { exact: false })).toBeVisible();
  expect(await savedField(page, "sales") - plain.sales, "多出来的那一支").toBe(REPAIR);
  expect(await savedField(page, "trust") - plain.trust, "她当场信了，信任是涨的那一头").toBe(CLAIM_TRUST);
  expect(await savedField(page, "compliance") - plain.compliance).toBe(CLAIM_COMPLIANCE);
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as { flags: string[], history: { day: number, text: string }[] }, SAVE_KEY);
  expect(stored.flags).toContain("claim:shen:1");
  expect(stored.history).toContainEqual({ day: 1, text: claimLine("shen") });
  await page.screenshot({ path: "../audit/experience-v2/p34-sandbox-result.png" });

  // 今天只剩她一位：这一单结掉就直接进闭店那一屏，账本在同一趟里量。
  await page.getByRole("button", { name: "处理闭店事件", exact: true }).click();
  await page.locator(".event-options button").first().click();
  await expect(page.getByRole("heading", { name: "今天的单，明天的账", exact: true })).toBeVisible();
  const line = page.locator(".ledger-book p").filter({ hasText: `¥${money(REPAIR * 2)}` });
  await expect(line, "两支写两遍，账就比钱多").toHaveCount(1);
  expect(await ledgerYuan(page), "玩家自己加回去的钱要等于页顶那个数").toBe(await savedField(page, "sales"));

  const trustBefore = await savedField(page, "trust");
  await page.getByRole("button", { name: "进入下一天", exact: true }).click();
  const askback = page.locator(".dawn-note").filter({ hasText: "沈薇：我回去搜了备案" });
  await expect(askback, "问回来这一句要在晨会那一屏念出来").toHaveCount(1);
  expect(await savedField(page, "trust")).toBe(trustBefore + CLAIM_ASKBACK_TRUST);
  await page.screenshot({ path: "../audit/experience-v2/p34-sandbox-askback-day2.png" });
  // 刷新回来的那一屏是现场（晨会已经读过），所以这里量的是存档：那一格扣过的痕迹只有一份。
  await page.reload();
  await expect(page.locator(".dawn-note"), "晨会那一屏不该在下午再出现一次").toHaveCount(0);
  expect(await savedArray(page, "flags").then(list => list.filter(name => name.startsWith("claim-raised:"))), "同一句问回来扣两次信任")
    .toEqual(["claim-raised:shen:1"]);
  expect(await savedField(page, "trust")).toBe(trustBefore + CLAIM_ASKBACK_TRUST);
});

test("抽屉里只剩一支的时候沙盘也没有这一格：多不出支数就不收这一次合规", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: { ...INITIAL, version: SAVE_VERSION, day: 1, sales: 0, daySales: 0, dayServed: ["mei"] },
  });
  await page.reload();
  await page.getByRole("button", { name: "查看沈薇", exact: true }).click();
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  const cues = page.locator(".cue-actions button");
  await cues.nth(0).click();
  await cues.nth(1).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
  await page.getByRole("button", { name: "修护 ¥1,680", exact: true }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  if (await page.getByLabel("先登记接待").count()) await page.getByLabel("让顾客确认需求").click();
  await expect(page.locator(".closing-buttons .floor-action").filter({ hasText: CLAIM_LABEL })).toHaveCount(0);
  await page.getByRole("button", { name: "强推成交", exact: true }).click();
  await expect(page.locator(".large-number")).toHaveText(`+ ¥${money(REPAIR)}`);
  expect(await savedField(page, "compliance"), "没越界就不该扣这一笔").toBe(INITIAL.compliance);
});

import { expect, test, type Page } from "@playwright/test";
import { INITIAL, SAVE_KEY } from "../src/campaign";

// P49 的手机版那一半：对峙卡最前面那句 .rival-trial-result 是早就有的，
// 这一遍把它钉成"不许再丢"——沙盘端刚补上同一处来源（rescue-e2e/rival-echo.spec.ts），
// 两端念的都是 REACTIONS[picked][reaction]，期望值字面量。
// 顺带钉住"对峙独占抽屉时她那句话还在卡上"：P46 记待办① 复核结论——
// 手机版 reaction 在卡、脸在屏（portrait 在 dock 外），缺的只是 record 那一行；
// 而那一行的信息在拍这三格板时用不到，拍完 dock 整排回来。

async function toRival(page: Page) {
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVE_KEY, value: INITIAL });
  await page.reload();
  await page.getByRole("button", { name: "继续第 1 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await page.getByRole("button", { name: "观察眼下" }).click();
  await page.getByRole("button", { name: "观察脸颊" }).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？" }).click();
  await page.getByRole("button", { name: /柔焦 ¥980/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await expect(page.locator(".rival-interruption")).toBeVisible();
}

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test(`对峙卡在 ${width}×${height}：试用反应念在陆遥前面、抽屉虽然整排换掉那句话还在`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await toRival(page);
    const seen = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(".rival-interruption");
      const line = card?.querySelector<HTMLElement>(".rival-trial-result");
      const challenger = card?.querySelector<HTMLElement>(".event-character-inline");
      const viewport = document.querySelector<HTMLElement>(".mobile-app-viewport");
      if (!card || !line || !challenger || !viewport) return null;
      const lr = line.getBoundingClientRect(), ch = challenger.getBoundingClientRect(),
        cr = card.getBoundingClientRect(), vr = viewport.getBoundingClientRect();
      return {
        text: line.textContent ?? "",
        count: document.querySelectorAll(".rival-trial-result").length,
        aboveChallenger: lr.bottom <= ch.top + 1,
        inCard: lr.top >= cr.top - 1 && lr.bottom <= cr.bottom + 1,
        cardInView: cr.top >= vr.top - 1 && cr.bottom <= vr.bottom + 1,
        // 抽屉换掉的那个瞬间：dock 不在 DOM，但她的脸（portrait）还压在卡上面。
        dockGone: !document.querySelector(".consultation-dock"),
        portraitUp: !!document.querySelector(".customer-portrait"),
        type: parseFloat(getComputedStyle(line).fontSize),
      };
    });
    console.log("P49 MOBILE RIVAL ECHO", width, height, JSON.stringify(seen));
    expect(seen, "量不到对峙卡里的反应那句").not.toBeNull();
    expect(seen!.text).toBe("她靠近镜子看了两秒，鼻翼没有结块。");
    expect(seen!.count, "同一件事不许念两遍").toBe(1);
    expect(seen!.aboveChallenger, "反应那句排到了陆遥后面").toBe(true);
    expect(seen!.inCard, "反应那句掉出对峙卡").toBe(true);
    expect(seen!.cardInView, "对峙卡掉出可视区").toBe(true);
    expect(seen!.dockGone && seen!.portraitUp, "对峙时脸或卡丢了：看不见刚试的结果").toBe(true);
    expect(seen!.type, "对峙卡里的反应掉到 12px 下限以下").toBeGreaterThanOrEqual(12);
    if (width === 390 && height === 844) await page.screenshot({ path: "../audit/experience-v2/p49-mobile-rival-echo.png" });
  });
}

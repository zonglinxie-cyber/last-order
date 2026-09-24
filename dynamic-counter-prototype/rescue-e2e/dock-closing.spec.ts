import { expect, test, type Page } from "@playwright/test";
import { LEAVE_SAMPLE_RETURN } from "../src/campaign";

// 「提出成交」原来在 1280×720 折线以下 88px，而 counter.spec.ts 一直是绿的：click() 会先把元素滚进视野。
// 所以这里不靠点击，只量位置——点了还"可见"等于没测。
const VIEWPORTS = [
  { width: 1280, height: 720, name: "桌面" },
  { width: 1440, height: 900, name: "大桌面" },
  { width: 1024, height: 700, name: "小笔记本" },
  { width: 640, height: 800, name: "大手机" },
  { width: 390, height: 844, name: "手机" },
];

async function toClosing(page: Page, product = "柔焦 ¥980") {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "查看沈薇", exact: true }).click();
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  const cues = page.locator(".cue-actions button");
  await cues.nth(0).click();
  await cues.nth(1).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
  await page.getByRole("button", { name: product, exact: true }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  // 陆遥会在试用后插一段对峙；这段不结掉，选品和成交行都不渲染。
  if (await page.getByRole("button", { name: "先登记接待", exact: true }).count()) {
    await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
  }
  await expect(page.getByRole("region", { name: "本单报价" })).toBeVisible();
}

/** 钉住的那条带的几何：一次都不滚，动作行就得在屏幕上；能滚的只有上面那段正文。 */
async function expectBarPinned(page: Page, viewport: { width: number, height: number }, action: string) {
  const button = page.getByRole("button", { name: action, exact: true });
  await expect(button).toBeVisible(); // scrollIntoViewIfNeeded：只保证在滚动容器里，不保证在屏幕里。
  await expect(button).toBeEnabled();

  const metrics = await page.evaluate(name => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };
    const scroller = (el: Element) => ({ ...box(el), overflowY: getComputedStyle(el).overflowY, scrollH: el.scrollHeight, clientH: el.clientHeight });
    const dock = document.querySelector(".rescue-dock");
    const content = document.querySelector(".dock-content");
    const body = document.querySelector(".service-body");
    const bar = document.querySelector(".closing-buttons");
    const hit = Array.from(bar?.querySelectorAll("button") ?? []).find(el => (el.textContent || "").includes(name));
    if (!dock || !content || !body || !bar || !hit) return null;
    return { dock: scroller(dock), content: scroller(content), body: scroller(body), bar: box(bar), action: box(hit) };
  }, action);
  expect(metrics, "接待抽屉的这几个节点都在").not.toBeNull();
  const { dock, content, body, bar, action: actionBox } = metrics!;

  expect(bar.bottom, `动作行掉到 ${viewport.width}×${viewport.height} 的折线以下了`).toBeLessThanOrEqual(viewport.height);
  expect(actionBox.top).toBeGreaterThanOrEqual(bar.top - 1);
  expect(actionBox.bottom).toBeLessThanOrEqual(dock.bottom);
  expect(dock.bottom).toBeLessThanOrEqual(viewport.height);
  expect(bar.height, "钉住的那条带至少要容得下 44px 的主控件").toBeGreaterThanOrEqual(44);

  // 整条抽屉不许滚，右栏也不许滚：谁滚都行，就是动作行不许跟着一起滚走。
  expect(dock.scrollH, "dock 变成滚动区了，动作行会跟着一起滚走").toBeLessThanOrEqual(dock.clientH + 1);
  expect(content.scrollH, "dock-content 又在自己滚了，动作行会掉到折线以下").toBeLessThanOrEqual(content.clientH + 1);
  expect(body.overflowY, "矮屏靠正文那一段滚动消化，不许改成删文案").toBe("auto");

  if (body.scrollH > body.clientH) {
    // 滚到底也不能把上面那段撕在半行上：带顶得落在正文之下。
    await page.evaluate(() => { const el = document.querySelector(".service-body") as HTMLElement; el.scrollTo(0, el.scrollHeight); });
    const atBottom = await page.evaluate(() => {
      const el = document.querySelector(".service-body") as HTMLElement;
      const barEl = document.querySelector(".closing-buttons") as HTMLElement;
      return { reached: el.scrollTop + el.clientHeight >= el.scrollHeight - 1, gap: Math.round(barEl.getBoundingClientRect().top - el.getBoundingClientRect().bottom) };
    });
    expect(atBottom.reached, "滚动区没到底，说明高度算错了").toBe(true);
    expect(atBottom.gap, "钉住的带和正文之间不该重叠").toBeGreaterThanOrEqual(-1);
  }
}

for (const viewport of VIEWPORTS) {
  test(`成交那一排在${viewport.name} ${viewport.width}×${viewport.height} 上不用滚就能看到并点到`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await toClosing(page);
    await expectBarPinned(page, viewport, "提出成交");
    await page.getByRole("button", { name: "提出成交", exact: true }).click();
    await expect(page.getByRole("heading", { name: "沈薇成交", exact: true })).toBeVisible();
  });

  // 她说"不要"时那一排是四个按钮，带子比成交那条高、正文被压得更矮——同一条契约再量一次。
  test(`拒绝那一排在${viewport.name} ${viewport.width}×${viewport.height} 上也钉得住`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await toClosing(page, "持妆 ¥1,280");
    await expectBarPinned(page, viewport, "接受拒绝");
    // 那颗"留小样"连它买到什么一起钉在脚上：只留一颗光按钮，玩家就比不出它和"换一款"的差别。
    const note = page.locator(".closing-buttons p", { hasText: LEAVE_SAMPLE_RETURN });
    await expect(note, "拒绝那一排没把留小样的理由带进脚里").toBeVisible();
    const noteBox = await note.boundingBox();
    const barBox = await page.locator(".closing-buttons").boundingBox();
    expect(noteBox && barBox, "量不到留小样那句").toBeTruthy();
    expect(noteBox!.y, "理由整个掉到带上沿之外").toBeGreaterThanOrEqual(barBox!.y - 1);
    expect(noteBox!.y + noteBox!.height - barBox!.y - barBox!.height, "理由掉出钉住的那条带（会被 overflow 裁掉）").toBeLessThanOrEqual(1);
    expect(noteBox!.y + noteBox!.height, "理由落在折线以下：先按了、后看见理由").toBeLessThanOrEqual(viewport.height);
  });
}

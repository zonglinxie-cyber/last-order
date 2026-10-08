// 话术牌局（?mode=duel）第 1 天走查：每阶段截图 + CJK 字数 + 可点控件数。
// 390×844 全程；最后补一张 320×568 对局屏。产物存 audit/research-2026-10/duel/。
import { chromium } from "file:///Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/dynamic-counter-prototype/node_modules/playwright-core/index.mjs";
import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("./duel/", import.meta.url));
const LOG = OUT + "duel-log.jsonl";
const BASE = process.env.DUEL_URL ?? "http://127.0.0.1:5199";
mkdirSync(OUT, { recursive: true });
rmSync(LOG, { force: true });

const browser = await chromium.launch({ headless: true });

async function measure(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const text = document.body.innerText || "";
    const cjk = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
    const clickables = [...document.querySelectorAll("button, [role='button']")].filter(vis);
    const enabled = clickables.filter((el) => !el.disabled && !el.closest("[disabled]"));
    const small = [...document.querySelectorAll("body *")].filter((el) => vis(el) && el.children.length === 0 && (el.innerText || "").trim() && parseFloat(getComputedStyle(el).fontSize) < 12)
      .map((el) => `${parseFloat(getComputedStyle(el).fontSize)}px:${(el.innerText || "").trim().slice(0, 12)}`);
    return { cjk, buttons: enabled.length, buttonsTotal: clickables.length, small };
  });
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
  const m = await measure(page);
  appendFileSync(LOG, JSON.stringify({ stage: name, ...m }) + "\n");
  console.log(`${name}  cjk=${m.cjk}  可点=${m.buttons}/${m.buttonsTotal}  小字<12px=${m.small.length}${m.small.length ? " " + m.small.slice(0, 4).join(" | ") : ""}`);
}

async function dragToFace(page, product, side) {
  const card = page.locator(`.duel-product[data-product="${product}"]`);
  const face = page.locator(".duel-face");
  const pb = await card.boundingBox();
  const fb = await face.boundingBox();
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.mouse.down();
  await page.mouse.move(fb.x + fb.width * (side === "left" ? 0.25 : 0.75), fb.y + fb.height * 0.55, { steps: 10 });
  await page.mouse.up();
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await page.goto(`${BASE}/?mode=duel`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(500);
await shot(page, "01-intro");
await page.getByRole("button", { name: "开始新品活动周" }).click();
await page.waitForTimeout(400);
await shot(page, "02-晨会");
await page.getByRole("button", { name: "开始营业" }).click();
await page.waitForTimeout(400);
await shot(page, "03-地板");
await page.getByRole("button", { name: /沈薇/ }).click();
await page.waitForTimeout(400);
await shot(page, "04-对局初始");
await page.getByRole("button", { name: "跳过引导" }).click();
await page.waitForTimeout(300);
await page.locator(".duel-face").screenshot({ path: `${OUT}04b-点位对准-390x844.png` });
await page.getByRole("button", { name: "看眼下" }).click();
await page.waitForTimeout(400);
await shot(page, "05-看脸后");
await page.locator('[data-card-id="ask:0"]').click();
await page.waitForTimeout(400);
await shot(page, "06-出牌后");
await page.getByRole("button", { name: "看脸颊" }).click();
await page.waitForTimeout(300);
// 拖拽进行中抓拍：按下、拖到一半截图、再放上去
{
  const card = page.locator('.duel-product[data-product="soft"]');
  const face = page.locator(".duel-face");
  const pb = await card.boundingBox();
  const fb = await face.boundingBox();
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.mouse.down();
  await page.mouse.move((pb.x + fb.x) / 2, (pb.y + fb.y) / 2, { steps: 6 });
  await page.mouse.move(fb.x + fb.width * 0.2, fb.y + fb.height * 0.5, { steps: 6 });
  await shot(page, "07-拖拽上脸中");
  await page.mouse.move(fb.x + fb.width * 0.25, fb.y + fb.height * 0.55, { steps: 4 });
  await page.mouse.up();
}
await page.waitForTimeout(400);
await shot(page, "08-竞品插话");
await page.locator('[data-card-id="rival:clarify"]').click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "看鼻翼" }).click();
await page.locator('[data-card-id="pitch"]').click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "提出成交" }).click();
await page.waitForTimeout(300);
await shot(page, "10-连带档位");
await page.getByRole("button", { name: /两件连带/ }).click();
await page.waitForTimeout(900);
await shot(page, "11-成交演出");
await page.getByRole("button", { name: "回到现场" }).click();
await page.waitForTimeout(300);
// 梅女士：快速打到可成交
await page.getByRole("button", { name: /梅女士/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "看眼下" }).click();
await page.locator('[data-card-id="ask:0"]').click();
await dragToFace(page, "repair", "left");
await page.waitForTimeout(300);
await shot(page, "16-五张手牌");
await page.getByRole("button", { name: "提出成交" }).click();
await page.getByRole("button", { name: /一件/ }).click();
await page.waitForTimeout(900);
await page.getByRole("button", { name: "处理闭店事件" }).click();
await page.waitForTimeout(400);
await shot(page, "12-闭店事件");
await page.locator(".duel-choice").first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "查看今日账单" }).click();
await page.waitForTimeout(400);
await shot(page, "13-当日账单");
await page.close();

// 第二遍：两半对比 + 「她走了」灰屏 —— 沈薇这局把第二支也拖上脸（每位顾客只有一支正解，
// 第二半注定是 negative −12），再烧一回合她就走。
const page2 = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await page2.goto(`${BASE}/?mode=duel`);
await page2.evaluate(() => localStorage.clear());
await page2.reload();
await page2.waitForTimeout(400);
await page2.getByRole("button", { name: "开始新品活动周" }).click();
await page2.getByRole("button", { name: "开始营业" }).click();
await page2.getByRole("button", { name: /沈薇/ }).click();
await page2.getByRole("button", { name: "跳过引导" }).click();
await page2.locator('[data-card-id="ask:0"]').click();          // r1
await dragToFace(page2, "soft", "left");                        // r2 → 触发竞品
await page2.locator('[data-card-id="rival:record"]').click();   // r3 记录在案
await page2.waitForTimeout(300);
await dragToFace(page2, "repair", "right");                     // r4 第二半脸（negative）
await page2.waitForTimeout(400);
await shot(page2, "09-两半对比");
await page2.locator(".duel-card:not([disabled])").first().click(); // r5 烧掉 → 「最后一句」
await page2.waitForTimeout(500);
await shot(page2, "14-最后一句");
await page2.getByRole("button", { name: "送她走" }).click();
await page2.waitForTimeout(500);
await shot(page2, "15-她走了灰屏");
await page2.close();

// 第三遍：320×568 对局屏 + 点位对准；第四遍 390×667 点位。
const page3 = await browser.newPage({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
await page3.goto(`${BASE}/?mode=duel`);
await page3.evaluate(() => localStorage.clear());
await page3.reload();
await page3.waitForTimeout(400);
await page3.getByRole("button", { name: "开始新品活动周" }).click();
await page3.getByRole("button", { name: "开始营业" }).click();
await page3.getByRole("button", { name: /沈薇/ }).click();
await page3.waitForTimeout(400);
await shot(page3, "17-对局320x568");
await page3.locator(".duel-face").screenshot({ path: `${OUT}17b-点位对准-320x568.png` });
await page3.close();

const page4 = await browser.newPage({ viewport: { width: 390, height: 667 }, hasTouch: true, isMobile: true });
await page4.goto(`${BASE}/?mode=duel`);
await page4.evaluate(() => localStorage.clear());
await page4.reload();
await page4.waitForTimeout(400);
await page4.getByRole("button", { name: "开始新品活动周" }).click();
await page4.getByRole("button", { name: "开始营业" }).click();
await page4.getByRole("button", { name: /沈薇/ }).click();
await page4.waitForTimeout(400);
await page4.locator(".duel-face").screenshot({ path: `${OUT}18-点位对准-390x667.png` });
await page4.close();

// 第五遍：桌面视口走设备选择器，iPhone / Pixel 10 两预设各截一张对局屏顶栏。
const page5 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page5.goto(`${BASE}/?mode=duel`);
await page5.evaluate(() => localStorage.clear());
await page5.reload();
await page5.waitForTimeout(500);
await page5.getByRole("button", { name: "开始新品活动周" }).click();
await page5.getByRole("button", { name: "开始营业" }).click();
await page5.getByRole("button", { name: /沈薇/ }).click();
await page5.waitForTimeout(500);
await page5.screenshot({ path: `${OUT}19-顶栏-iphone.png`, clip: { x: 0, y: 0, width: 1280, height: 320 } });
await page5.getByTestId("device-picker").click();
await page5.getByTestId("device-option-pixel-10").click();
await page5.waitForTimeout(500);
await page5.screenshot({ path: `${OUT}20-顶栏-pixel.png`, clip: { x: 0, y: 0, width: 1280, height: 360 } });
await page5.close();
await browser.close();
console.log("done → " + OUT);

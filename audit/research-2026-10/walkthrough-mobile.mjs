// 调研用走查脚本：以第一次玩的视角走一遍手机版（dynamic-counter-prototype）第 1 天。
// 390×844 竖屏，主走查对象。截图写入 audit/research-2026-10/current/mobile/。
// 用法：先起 `vite --host 127.0.0.1 --port 4190`（VITE_CONSULT_MODE=scripted），再 node walkthrough-mobile.mjs
import { chromium } from "file:///Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/dynamic-counter-prototype/node_modules/playwright-core/index.mjs";
import { mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("./current/mobile/", import.meta.url));
const LOG = OUT + "walkthrough-log.jsonl";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

let clicks = 0;
let t0 = null;
const now = () => (t0 === null ? 0 : (Date.now() - t0) / 1000);

async function metrics(stage) {
  const m = await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const buttons = [...document.querySelectorAll("button, a")].filter(vis);
    const inViewport = buttons.filter((b) => {
      const r = b.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    });
    const text = document.body.innerText || "";
    // 主按钮是否无需滚动即在视野内
    const primary = document.querySelector(".primary-action, .gold-button");
    const pr = primary ? primary.getBoundingClientRect() : null;
    return {
      cjkChars: (text.match(/[一-鿿]/g) || []).length,
      totalChars: text.length,
      visibleButtons: buttons.length,
      buttonsInViewport: inViewport.length,
      primaryInViewport: pr ? pr.top >= 0 && pr.bottom <= innerHeight : null,
      primaryLabel: primary ? (primary.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40) : null,
      buttonLabels: buttons.map((b) => (b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40)),
    };
  });
  const row = { stage, elapsedSec: +now().toFixed(1), clicks, ...m };
  appendFileSync(LOG, JSON.stringify(row) + "\n");
  console.log(stage, "| t=" + row.elapsedSec + "s | clicks=" + clicks, "| btns=" + m.visibleButtons + "/" + m.buttonsInViewport, "| cjk=" + m.cjkChars, "| primary=" + m.primaryLabel + (m.primaryInViewport ? "" : " [不在视野内]"));
  return m;
}

async function snap(stage) {
  await page.screenshot({ path: OUT + stage + ".png" });
  return metrics(stage);
}

async function click(locator, note) {
  await locator.click();
  clicks++;
  if (t0 === null) t0 = Date.now();
  if (note) console.log("  click:", note);
}

await page.goto("http://127.0.0.1:4190/");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(700);
await snap("01-intro");

await click(page.getByRole("button", { name: "开始新品活动周" }), "开始新品活动周");
await page.waitForTimeout(400);
await snap("02-brief-day1");

await click(page.getByRole("button", { name: "开始营业" }), "开始营业");
await page.waitForTimeout(500);
await snap("03-floor-day1");

// 新玩家视角：看现场几秒
await page.waitForTimeout(4000);
await snap("03b-floor-watching");

await click(page.getByRole("button", { name: "查看沈薇" }), "查看沈薇");
await page.waitForTimeout(400);
await snap("04-floor-inspect-shen");

await click(page.getByRole("button", { name: /观察沈薇|继续接待沈薇/ }), "观察沈薇");
await page.waitForTimeout(500);
await snap("05-consult-observe");

const cues = page.locator(".face-cue");
await click(cues.nth(0), "面部线索1");
await page.waitForTimeout(300);
await click(cues.nth(1), "面部线索2");
await page.waitForTimeout(400);
await snap("06-consult-observed");

await click(page.locator(".question-options button").first(), "提问：第一个选项");
await page.waitForTimeout(400);
await snap("07-consult-asked");

await click(page.locator(".product-options button").first(), "选品：第一款");
await page.waitForTimeout(300);
await snap("08-product-picked");

await click(page.locator(".consultation-foot .primary-action"), "为沈薇试用");
await page.waitForTimeout(600);
await snap("09-after-trial");

const rival = page.locator(".rival-actions button");
if (await rival.count()) {
  await click(rival.nth(1), "竞品打断：让顾客确认需求");
  await page.waitForTimeout(500);
}
await snap("10-close-stage");

// 连带四格（选默认之外看一遍）
const bundleBtns = page.locator(".bundle-row button");
if (await bundleBtns.count()) {
  await snap("10b-bundle-row");
}

const rec = page.getByRole("button", { name: /登记我的接待|已登记归属/ });
if (await rec.count() && await rec.isEnabled()) {
  await click(rec, "登记我的接待");
  await page.waitForTimeout(200);
}
await click(page.getByRole("button", { name: "提出成交" }), "提出成交");
await page.waitForTimeout(500);
const firstSale = { stage: "FIRST-SALE", elapsedSec: +now().toFixed(1), clicks };
appendFileSync(LOG, JSON.stringify(firstSale) + "\n");
console.log(">>> 首次成交 t=" + firstSale.elapsedSec + "s clicks=" + clicks);
await snap("11-result-first-sale");

await click(page.getByRole("button", { name: /回到现场|处理闭店事件/ }), "回到现场");
await page.waitForTimeout(500);
await snap("12-floor-after-first");

// 第二位顾客：梅女士
const meiView = page.getByRole("button", { name: "查看梅女士" });
if (await meiView.count()) {
  await click(meiView, "查看梅女士");
  await page.waitForTimeout(400);
  await snap("13-floor-inspect-mei");
  await click(page.getByRole("button", { name: /观察梅女士|继续接待梅女士/ }), "观察梅女士");
  await page.waitForTimeout(500);
  const c2 = page.locator(".face-cue");
  await click(c2.nth(0), "梅：线索1");
  await click(c2.nth(1), "梅：线索2");
  await page.waitForTimeout(300);
  await click(page.locator(".question-options button").first(), "梅：提问");
  await page.waitForTimeout(300);
  const repair = page.locator(".product-options button", { hasText: "修护" });
  if (await repair.count()) await click(repair.first(), "梅：选修护");
  else await click(page.locator(".product-options button").first(), "梅：选第一款");
  await page.waitForTimeout(300);
  await click(page.locator(".consultation-foot .primary-action"), "梅：试用");
  await page.waitForTimeout(600);
  await snap("14-mei-after-trial");
  const rec2 = page.getByRole("button", { name: /登记我的接待/ });
  if (await rec2.count() && await rec2.isEnabled()) { await click(rec2, "梅：登记"); await page.waitForTimeout(200); }
  const closeBtn = page.getByRole("button", { name: "提出成交" });
  if (await closeBtn.count()) await click(closeBtn, "梅：提出成交");
  else {
    const acc = page.getByRole("button", { name: "接受拒绝" });
    if (await acc.count()) await click(acc, "梅：接受拒绝");
  }
  await page.waitForTimeout(500);
  await snap("15-result-mei");
  const back = page.getByRole("button", { name: /回到现场|处理闭店事件/ });
  if (await back.count()) await click(back, "处理闭店事件");
  await page.waitForTimeout(500);
} else {
  await snap("13-mei-gone");
}

await snap("16-event");
const evBtn = page.locator(".event-choices button").first();
if (await evBtn.count()) {
  await click(evBtn, "闭店事件：第一个选项");
  await page.waitForTimeout(400);
  await snap("16b-event-result");
  const bill = page.getByRole("button", { name: "查看今日账单" });
  if (await bill.count()) await click(bill, "查看今日账单");
  await page.waitForTimeout(400);
}
await snap("17-summary-day1");
const next = page.getByRole("button", { name: /进入下一天|查看活动周结局/ });
if (await next.count()) {
  await click(next, "进入下一天");
  await page.waitForTimeout(500);
  await snap("18-brief-day2");
}

console.log("DONE. total clicks=" + clicks + " elapsed=" + now().toFixed(1) + "s");
await browser.close();

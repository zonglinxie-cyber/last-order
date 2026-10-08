// 调研用走查脚本：以第一次玩的视角走一遍桌面版第 1 天。
// 只读操作：不改源码、不清仓库文件，截图写入 audit/research-2026-10/current/。
// 用法：先 `npm run dev`（根目录），再 node walkthrough-desktop.mjs
import { chromium } from "file:///Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/dynamic-counter-prototype/node_modules/playwright-core/index.mjs";
import { mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("./current/", import.meta.url));
const LOG = OUT + "walkthrough-log.jsonl";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

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
    return {
      cjkChars: (text.match(/[一-鿿]/g) || []).length,
      totalChars: text.length,
      visibleButtons: buttons.length,
      buttonsInViewport: inViewport.length,
      buttonLabels: buttons.map((b) => (b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40)),
      screen: [...document.querySelectorAll(".rescue-game")].map((e) => e.className).join(" "),
    };
  });
  const row = { stage, elapsedSec: +now().toFixed(1), clicks, ...m };
  appendFileSync(LOG, JSON.stringify(row) + "\n");
  console.log(stage, "| t=" + row.elapsedSec + "s | clicks=" + clicks, "| btns=" + m.visibleButtons + " | cjk=" + m.cjkChars);
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

await page.goto("http://127.0.0.1:5173/");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(600);
await snap("01-intro");

await click(page.getByRole("button", { name: "开始新品活动周" }), "开始新品活动周");
await page.waitForTimeout(400);
await snap("02-brief-day1");

await click(page.getByRole("button", { name: "开始营业" }), "开始营业");
await page.waitForTimeout(400);
await snap("03-floor-day1");

// 以新玩家视角：先在楼层上停几秒看看现场在动（真实时间流逝/耐心倒数）
await page.waitForTimeout(4000);
await snap("03b-floor-watching");

// 默认选中沈薇，dock 里直接接待
await click(page.getByRole("button", { name: /接待沈薇|继续接待沈薇/ }), "接待沈薇");
await page.waitForTimeout(400);
await snap("04-consult-observe");

// 观察两处线索（dock 里的按钮）
const cueButtons = page.locator(".cue-actions button");
await click(cueButtons.nth(0), "观察线索1");
await page.waitForTimeout(300);
await click(cueButtons.nth(1), "观察线索2");
await page.waitForTimeout(400);
await snap("05-consult-observed");

// 提问
await click(page.locator(".question-choices button").first(), "提问：第一个选项");
await page.waitForTimeout(400);
await snap("06-consult-asked");

// 选品 + 试用
await click(page.locator(".product-choices button").first(), "选品：第一款");
await page.waitForTimeout(300);
await snap("06b-consult-product-picked");
await click(page.locator(".trial-button"), "试用");
await page.waitForTimeout(500);
await snap("07-after-trial");

// 竞品打断（沈薇是 rival 顾客）
const rivalChoices = page.locator(".rival-choices button");
if (await rivalChoices.count()) {
  await snap("07b-rival-decision");
  await click(rivalChoices.nth(1), "竞品打断：让顾客确认需求");
  await page.waitForTimeout(400);
}
await snap("08-close-review");

// 连带选择（默认 single 已选？看 close-review），登记归属 + 提出成交
const recordBtn = page.getByRole("button", { name: /登记我的接待|已登记归属/ });
if (await recordBtn.count() && await recordBtn.isEnabled()) {
  await click(recordBtn, "登记我的接待");
  await page.waitForTimeout(200);
}
await click(page.getByRole("button", { name: "提出成交" }), "提出成交");
await page.waitForTimeout(500);
const firstSale = { stage: "FIRST-SALE", elapsedSec: +now().toFixed(1), clicks };
appendFileSync(LOG, JSON.stringify(firstSale) + "\n");
console.log(">>> 首次成交 t=" + firstSale.elapsedSec + "s clicks=" + clicks);
await snap("09-result-first-sale");

// 回到现场，看梅女士还在不在
await click(page.getByRole("button", { name: /回到现场|处理闭店事件/ }), "回到现场");
await page.waitForTimeout(400);
await snap("10-floor-after-first");

// 接待第二位（如果还在）
const meiBtn = page.getByRole("button", { name: /接待梅女士/ });
if (await meiBtn.count()) {
  await click(meiBtn, "接待梅女士");
  await page.waitForTimeout(400);
  await snap("11-consult-mei");
  const cues = page.locator(".cue-actions button");
  await click(cues.nth(0), "梅：观察1");
  await click(cues.nth(1), "梅：观察2");
  await page.waitForTimeout(300);
  await click(page.locator(".question-choices button").first(), "梅：提问");
  await page.waitForTimeout(300);
  // 梅女士要 soothe → repair（修护）
  const repair = page.locator(".product-choices button", { hasText: "修护" });
  if (await repair.count()) await click(repair.first(), "梅：选修护");
  else await click(page.locator(".product-choices button").first(), "梅：选第一款");
  await page.waitForTimeout(300);
  await click(page.locator(".trial-button"), "梅：试用");
  await page.waitForTimeout(500);
  const rec = page.getByRole("button", { name: /登记我的接待/ });
  if (await rec.count() && await rec.isEnabled()) { await click(rec, "梅：登记"); await page.waitForTimeout(200); }
  const closeBtn = page.getByRole("button", { name: "提出成交" });
  if (await closeBtn.count()) await click(closeBtn, "梅：提出成交");
  else {
    const acc = page.getByRole("button", { name: "接受拒绝" });
    if (await acc.count()) await click(acc, "梅：接受拒绝");
  }
  await page.waitForTimeout(400);
  await snap("12-result-mei");
  const back = page.getByRole("button", { name: /回到现场|处理闭店事件/ });
  if (await back.count()) await click(back, "闭店事件");
  await page.waitForTimeout(400);
} else {
  await snap("11-mei-gone");
}

// 闭店事件 → 日结 → 下一天
await snap("13-event");
const evBtn = page.locator(".event-options button").first();
if (await evBtn.count()) {
  await click(evBtn, "闭店事件：第一个选项");
  await page.waitForTimeout(400);
}
await snap("14-summary-day1");
const next = page.getByRole("button", { name: /进入下一天|查看活动周结局/ });
if (await next.count()) {
  await click(next, "进入下一天");
  await page.waitForTimeout(400);
  await snap("15-brief-day2");
}

console.log("DONE. total clicks=" + clicks + " elapsed=" + now().toFixed(1) + "s");
await browser.close();

// 诊断探针：重放到关键状态，量滚动需求/字号/遮挡等布局证据。390×844。
import { chromium } from "file:///Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/dynamic-counter-prototype/node_modules/playwright-core/index.mjs";
import { appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("./current/mobile/", import.meta.url));
const LOG = OUT + "probe-log.jsonl";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function probe(stage) {
  const m = await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const textEls = [...document.querySelectorAll("body *")].filter((el) => vis(el) && el.children.length === 0 && (el.innerText || "").trim());
    const smallText = textEls.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12).map((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), text: (el.innerText || "").trim().slice(0, 30), cls: el.className.toString().slice(0, 40) }));
    const scrollers = [...document.querySelectorAll(".mobile-scroll, .dock-content, .service-body, .console-head")].filter(vis).map((el) => ({ cls: el.className.toString().slice(0, 50), scrollH: el.scrollHeight, clientH: el.clientHeight, overflow: el.scrollHeight - el.clientHeight }));
    const dock = document.querySelector(".consultation-dock, .player-console, .rescue-dock");
    const foot = document.querySelector(".consultation-foot, .closing-buttons");
    const footR = foot ? foot.getBoundingClientRect() : null;
    const buttons = [...document.querySelectorAll("button")].filter(vis).map((b) => ({ label: (b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 36), h: Math.round(b.getBoundingClientRect().height), disabled: b.disabled }));
    return {
      smallText: smallText.slice(0, 15),
      smallTextCount: smallText.length,
      scrollers,
      dockTop: dock ? Math.round(dock.getBoundingClientRect().top) : null,
      footBox: footR ? { top: Math.round(footR.top), bottom: Math.round(footR.bottom) } : null,
      buttons,
      belowFold: buttons.filter((b) => {
        const el = [...document.querySelectorAll("button")].find((x) => (x.innerText || x.getAttribute("aria-label") || "").includes(b.label.slice(0, 8)));
        return el ? el.getBoundingClientRect().bottom > innerHeight : false;
      }).map((b) => b.label),
    };
  });
  appendFileSync(LOG, JSON.stringify({ stage, ...m }) + "\n");
  console.log("=== " + stage + " ===");
  console.log("  scrollers:", JSON.stringify(m.scrollers));
  console.log("  smallText(" + m.smallTextCount + "):", JSON.stringify(m.smallText.slice(0, 8)));
  console.log("  foot:", JSON.stringify(m.footBox), "dockTop:", m.dockTop);
  console.log("  buttons:", m.buttons.map((b) => b.label + "(" + b.h + (b.disabled ? ",dis" : "") + ")").join(" | "));
  if (m.belowFold.length) console.log("  BELOW FOLD:", m.belowFold.join(" | "));
  return m;
}

await page.goto("http://127.0.0.1:4190/");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(600);
await probe("intro");
await page.getByRole("button", { name: "开始新品活动周" }).click();
await page.waitForTimeout(400);
await probe("brief");
await page.getByRole("button", { name: "开始营业" }).click();
await page.waitForTimeout(500);
await probe("floor");
await page.getByRole("button", { name: "查看沈薇" }).click();
await page.waitForTimeout(300);
await probe("floor-inspect");
await page.getByRole("button", { name: /观察沈薇/ }).click();
await page.waitForTimeout(500);
await probe("consult-observe");
const cues = page.locator(".face-cue");
await cues.nth(0).click();
await page.waitForTimeout(200);
await cues.nth(1).click();
await page.waitForTimeout(300);
await probe("consult-ask");
await page.locator(".question-options button").first().click();
await page.waitForTimeout(300);
await probe("consult-product");
await page.locator(".product-options button").first().click();
await page.waitForTimeout(200);
await page.locator(".consultation-foot .primary-action").click();
await page.waitForTimeout(600);
await probe("consult-rival");
const rival = page.locator(".rival-actions button");
if (await rival.count()) { await rival.nth(1).click(); await page.waitForTimeout(400); }
await probe("consult-close");
// 换最贵的连带档看报价变化
const bundles = page.locator(".bundle-row button");
if (await bundles.count() >= 3) { await bundles.nth(3).click(); await page.waitForTimeout(300); await probe("consult-close-bundle4"); }
await page.getByRole("button", { name: /登记我的接待/ }).click();
await page.getByRole("button", { name: "提出成交" }).click();
await page.waitForTimeout(500);
await probe("result");
await browser.close();
console.log("probe done");

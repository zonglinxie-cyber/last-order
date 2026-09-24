import { expect, test, type Page } from "@playwright/test";
import { INITIAL } from "../src/campaign";

// 390 宽的柜台上，气泡一旦压到别人身上就两败俱伤：这里锁住「一次一人开口、气泡永远在人群上方」。
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const LABELS = {
  bar: ".status-bar",
  "hud-day": ".game-hud span",
  "hud-num": ".game-hud b",
  feed: ".floor-feed",
  speed: ".speed-rail",
  bubble: ".actor-bubble",
  tag: ".actor-tag",
  dock: ".player-console",
  lost: ".lost-opportunity",
};

async function rects(page: Page, sel: Record<string, string>) {
  return page.evaluate((s) => {
    const out: Array<{ label: string; text: string; x: number; y: number; right: number; bottom: number; walking: boolean }> = [];
    for (const [label, selector] of Object.entries(s))
      document.querySelectorAll(selector).forEach(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        out.push({
          label,
          text: (el.textContent || "").trim().slice(0, 18),
          x: r.x,
          y: r.y,
          right: r.x + r.width,
          bottom: r.y + r.height,
          walking: !!el.closest(".floor-actor.is-walking"),
        });
      });
    return out;
  }, sel);
}

const collisions = (items: Awaited<ReturnType<typeof rects>>) => {
  const hits: string[] = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      // 两个人在走动中擦肩而过是现场本该有的样子，站定之后名牌不能压住彼此。
      if (a.label === "tag" && b.label === "tag" && (a.walking || b.walking)) continue;
      const x = Math.min(a.right, b.right) - Math.max(a.x, b.x);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
      if (x > 1 && y > 1) hits.push(`${a.label}「${a.text}」与 ${b.label}「${b.text}」重叠 ${x.toFixed(0)}×${y.toFixed(0)}`);
    }
  return hits;
};

async function seedFloor(page: Page, day: number) {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), { ...INITIAL, day, sales: 1200 * day, daySales: 1200 });
  await page.reload();
  await page.getByRole("button", { name: `继续第 ${day} 天` }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
}

// 现场 dock 多了一整行「迎上去」：真机上它不能把主操作推出可视区，也不能压住下面那句计时提示。
test("the extra floor action row stays reachable on a real phone", async ({ page }) => {
  await seedFloor(page, 4);
  await page.getByRole("button", { name: "停", exact: true }).click();
  const rows = await page.locator(".dock-actions button").evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect();
    return { text: (node.textContent ?? "").trim().slice(0, 12), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width) };
  }));
  console.log("PULL DOCK ROWS", JSON.stringify(rows));
  expect(rows).toHaveLength(3);
  const dockWidth = await page.locator(".dock-actions").evaluate(el => Math.round(el.getBoundingClientRect().width));
  // 整行占满：半列放不下「迎上去 · 1 支小样 · 2 分钟」这串要念完的理由。
  expect(rows[2].width).toBe(dockWidth);
  expect(rows[2].text.startsWith("迎上去")).toBe(true);
  for (const row of rows) expect(row.height).toBeGreaterThanOrEqual(44);
  const hint = await page.locator(".player-console > p").boundingBox();
  console.log("PULL HINT", JSON.stringify(hint));
  // 控制台整块吃掉了地面多深：站着的人名牌不能被它盖住。
  const band = await page.evaluate(() => {
    const out = { consoleTop: 0, tagBottom: 0 };
    document.querySelectorAll(".player-console").forEach(el => { out.consoleTop = el.getBoundingClientRect().top; });
    document.querySelectorAll(".actor-tag").forEach(el => { out.tagBottom = Math.max(out.tagBottom, el.getBoundingClientRect().bottom); });
    return out;
  });
  console.log("PULL BAND", JSON.stringify(band), "stage", JSON.stringify(await page.locator(".floor-stage").boundingBox()));
  expect(rows[0].bottom).toBeLessThanOrEqual(844);
  // 那句"每次观察、提问、试用都会让另一位客人继续流失"讲的正是这一行花掉的东西，不能藏在要滚动才看得见的位置。
  expect(hint!.y).toBeGreaterThan(rows[2].bottom);
  expect(Math.round(hint!.y + hint!.height)).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: "../audit/experience-v2/floor-pull-row-phone.png" });
});

test("the floor keeps one speaker at a time and never drops a bubble on a person", async ({ page }) => {
  test.setTimeout(90_000);
  for (const day of [1, 4]) {
    await seedFloor(page, day);
    // 差多少只在页顶说一遍：钱是一行字，不再挂一条进度条。
    await expect(page.locator(".sales-progress")).toHaveCount(0);
    await expect(page.locator(".target-mini")).toContainText("距五日目标");
    for (let sample = 0; sample < 5; sample++) {
      const items = await rects(page, LABELS);
      const bubbles = items.filter(item => item.label === "bubble");
      expect(bubbles, `第 ${day} 天第 ${sample + 1} 次取样`).toHaveLength(1);
      await expect(page.locator(".floor-actor.is-speaking")).toHaveCount(1);
      expect(collisions(items), `第 ${day} 天第 ${sample + 1} 次取样有叠字`).toEqual([]);
      // 气泡必须整块停在所有人头顶之上，而不是挤进人群里。
      const actorTops = await page.locator(".floor-actor").evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
      expect(bubbles[0].bottom).toBeLessThan(Math.min(...actorTops));
      // 点亮的名牌就在气泡下方：认错人等于没说。
      const plate = await page.locator(".floor-actor.is-speaking .actor-tag").boundingBox();
      expect(Math.abs(bubbles[0].x + (bubbles[0].right - bubbles[0].x) / 2 - (plate!.x + plate!.width / 2))).toBeLessThan(44);
      await page.waitForTimeout(900);
    }
    await page.screenshot({ path: `../audit/experience-v2/floor-crowding-day${day}.png` });
  }
});

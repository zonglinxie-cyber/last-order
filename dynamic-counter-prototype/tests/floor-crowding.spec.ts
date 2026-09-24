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

// 现场 dock 多了一整行「迎上去」：真机上它不能把主操作推出可视区，也不能压住下面那句计时提示，
// 更不能因为屏幕矮一点就把站在柜台前的人整块盖住。
// 三个尺寸跑完还要互相比一次：矮屏那两档是靠面板内滚动消化的，不是靠删掉她的话。
const SIZES = [{ width: 390, height: 844 }, { width: 390, height: 667 }, { width: 320, height: 568 }];

test("the extra floor action row stays reachable from the tallest phone to the shortest", async ({ page }) => {
  const seen: Array<{ size: string; quote: string; lines: number; clearance: number }> = [];
  for (const size of SIZES) {
    const tag = `${size.width}×${size.height}`;
    await page.setViewportSize(size);
    await seedFloor(page, 4);
    await page.getByRole("button", { name: "停", exact: true }).click();
    const rows = await page.locator(".dock-actions button").evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect();
      return { text: (node.textContent ?? "").trim().slice(0, 12), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width) };
    }));
    console.log("PULL DOCK ROWS", tag, JSON.stringify(rows));
    expect(rows, tag).toHaveLength(3);
    const dockWidth = await page.locator(".dock-actions").evaluate(el => Math.round(el.getBoundingClientRect().width));
    // 整行占满：半列放不下「迎上去 · 1 支小样 · 2 分钟」这串要念完的理由。
    expect(rows[2].width, tag).toBe(dockWidth);
    expect(rows[2].text.startsWith("迎上去"), tag).toBe(true);
    for (const row of rows) expect(row.height, `${tag} ${row.text}`).toBeGreaterThanOrEqual(44);
    const hint = await page.locator(".player-console > p").boundingBox();
    // 控制台整块吃掉了地面多深：站着的人名牌不能被它盖住。
    const band = await page.evaluate(() => {
      const out = { consoleTop: 0, consoleBottom: 0, tagBottom: 0, quote: "", identity: "", lines: 0 };
      document.querySelectorAll(".player-console").forEach(el => {
        const r = el.getBoundingClientRect();
        out.consoleTop = r.top;
        out.consoleBottom = r.bottom;
        out.quote = (el.querySelector(".inspect-quote")?.textContent ?? "").trim();
        out.identity = (el.querySelector(".player-identity strong")?.textContent ?? "").trim();
        out.lines = el.querySelectorAll(".party-list li").length;
      });
      document.querySelectorAll(".actor-tag").forEach(el => { out.tagBottom = Math.max(out.tagBottom, el.getBoundingClientRect().bottom); });
      return out;
    });
    console.log("PULL BAND", tag, JSON.stringify({ ...band, hint: hint && { y: hint.y, bottom: hint.y + hint.height } }), "stage", JSON.stringify(await page.locator(".floor-stage").boundingBox()));
    seen.push({ size: tag, quote: band.quote, lines: band.lines, clearance: band.consoleTop - band.tagBottom });
    expect(rows[0].bottom, tag).toBeLessThanOrEqual(size.height);
    // 那句"每次观察、提问、试用都会让另一位客人继续流失"讲的正是这一行花掉的东西，不能藏在要滚动才看得见的位置。
    expect(hint!.y, tag).toBeGreaterThan(rows[2].bottom);
    expect(Math.round(hint!.y + hint!.height), tag).toBeLessThanOrEqual(size.height);
    // 地面按百分比排、面板按屏幕比例封顶：实测余量 844→21.2px、667→12.3px、568→7.4px。
    expect(band.consoleTop - band.tagBottom, `${tag} 面板压住站着的人`).toBeGreaterThanOrEqual(4);
    // 动作行钉在面板里，不能因为封顶后被挤出可视区。
    expect(rows[2].bottom, tag).toBeLessThanOrEqual(Math.round(band.consoleBottom));
    // 气泡整只必须在画面里：320 宽上它曾被屏幕切掉两头，那句话就念不全。
    // 它也不能压在页顶那行计时上；矮到墙上放不下那条带时，它收掉，而这几句仍在页顶和柜台各念一遍。
    const chrome = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(".floor-feed-row");
      const bubble = document.querySelector<HTMLElement>(".actor-bubble.stage-bubble");
      const tops = [...document.querySelectorAll(".floor-actor")].map(el => el.getBoundingClientRect().top);
      return {
        feedBottom: row?.getBoundingClientRect().bottom ?? 0,
        actorTop: tops.length ? Math.min(...tops) : 0,
        bubble: bubble && bubble.getBoundingClientRect().height ? { x: bubble.getBoundingClientRect().x, y: bubble.getBoundingClientRect().y, right: bubble.getBoundingClientRect().right, bottom: bubble.getBoundingClientRect().bottom } : null,
        feed: (row?.querySelector(".floor-feed")?.textContent ?? "").trim(),
      };
    });
    console.log("PULL CHROME", tag, JSON.stringify(chrome), "viewport", size.width);
    expect(chrome.feed.length > 4, `${tag} 页顶那行念的是谁`).toBe(true);
    if (size.height > 600) {
      expect(chrome.bubble, tag).not.toBeNull();
      expect(chrome.bubble!.x, `${tag} 气泡出画（左）`).toBeGreaterThanOrEqual(0);
      expect(Math.round(chrome.bubble!.right), `${tag} 气泡出画（右）`).toBeLessThanOrEqual(size.width);
      expect(chrome.bubble!.y, `${tag} 气泡压在计时那一行上`).toBeGreaterThanOrEqual(chrome.feedBottom);
    } else {
      expect(chrome.bubble, `${tag} 墙上放不下还硬飘`).toBeNull();
    }
    // 这三样在每个尺寸都得原样在面板里。
    expect(band.identity, tag).toContain(" · ");
    expect(band.quote.length > 4, tag).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), tag).toBe(false);
    await page.screenshot({ path: `../audit/experience-v2/floor-pull-row-${size.width}x${size.height}.png` });
    // 矮屏那一档必须在面板内滚到见底：省下来的是可视区，不是她的那句话。
    const scrolled = await page.evaluate(() => {
      const head = document.querySelector<HTMLElement>(".console-head");
      if (!head) return null;
      head.scrollTop = head.scrollHeight;
      const last = head.querySelector(".party-list li:last-child");
      return { max: head.scrollHeight - head.clientHeight, lastBottom: last ? last.getBoundingClientRect().bottom : 0, consoleBottom: head.closest(".player-console")?.getBoundingClientRect().bottom ?? 0 };
    });
    if (size.height < 800) {
      expect(scrolled, tag).not.toBeNull();
      expect(scrolled!.max, `${tag} 面板没有可滚的余量`).toBeGreaterThan(0);
      expect(scrolled!.lastBottom, `${tag} 滚到底也看不到最后一行`).toBeLessThanOrEqual(scrolled!.consoleBottom);
      await page.screenshot({ path: `../audit/experience-v2/floor-pull-row-${size.width}x${size.height}-scrolled.png` });
    }
  }
  console.log("PULL COMPARE", JSON.stringify(seen));
  // 同一句话、同样多的"还有谁在等"：屏幕矮了不等于少告诉她一件事。
  for (const item of seen.slice(1)) {
    expect(item.quote, `${item.size} 与她说的话不符`).toBe(seen[0].quote);
    expect(item.lines, `${item.size} 与队列那一栏不符`).toBe(seen[0].lines);
  }
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

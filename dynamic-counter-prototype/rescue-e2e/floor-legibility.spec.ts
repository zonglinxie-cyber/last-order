import { expect, test, type Locator, type Page } from "@playwright/test";
import { DAYS, floorCustomers, INITIAL, SAVE_KEY, type CustomerId } from "../src/campaign";

// 现场只有一层文字：名牌、开口那句、选客条、时间按钮。站位间距是按像素校准的（floor-stage.ts），
// 沙盘缩到容不下名牌时路人牌子会收起来。这里两头都锁住：文字不许互相盖，人还得点得到。
const VIEWPORTS = [
  { width: 1280, height: 720, name: "桌面" },
  { width: 1024, height: 700, name: "小笔记本" },
  { width: 820, height: 900, name: "竖屏平板" },
  { width: 640, height: 800, name: "大手机" },
  { width: 390, height: 844, name: "手机" },
  { width: 844, height: 390, name: "横屏" },
];

const LABELS = {
  name: ".pawn-name",
  voice: ".floor-voice",
  hud: ".floor-mission",
  queue: ".floor-queue button",
  controls: ".scene-controls > *",
  header: ".top-score",
};

type Rect = { label: string; text: string; x: number; y: number; right: number; bottom: number };

async function plates(page: Page): Promise<Rect[]> {
  return page.evaluate(s => {
    const out: Rect[] = [];
    for (const [label, selector] of Object.entries(s))
      document.querySelectorAll(selector).forEach(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        out.push({ label, text: (el.textContent || "").trim().slice(0, 18), x: r.x, y: r.y, right: r.x + r.width, bottom: r.y + r.height });
      });
    return out;
  }, LABELS);
}

function overlaps(items: Rect[]) {
  const hits: string[] = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      const x = Math.min(a.right, b.right) - Math.max(a.x, b.x);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
      if (x > 1 && y > 1) hits.push(`${a.label}「${a.text}」压住 ${b.label}「${b.text}」${x.toFixed(0)}×${y.toFixed(0)}`);
    }
  return hits;
}

/**
 * 沙盘上的取货位和门口位是按"一天最多两位顾客在场"排的：`advanceDay` 每天清空 dayServed 和 lost。
 * 上界从规则本身量出来（把跨天回来的条件全部当成已满足），再加人就会先在这里失败，而不是在某个视口里悄悄叠字。
 */
const ON_FLOOR_MAX = Math.max(...DAYS.map(d => floorCustomers({ ...INITIAL, day: d.day, flags: ["served:zhou:good", "served:anjie:good"] }).length));
// 沙盘上同时在演的人数：你 + 四位员工 + 当天最多在场的顾客。
const CAST = 5 + ON_FLOOR_MAX;
test("一天同时在场的顾客不会超出沙盘留的取货位和门口位", async () => {
  expect(ON_FLOOR_MAX, "再加一位同时在场的顾客，就得先在沙盘上加一个位置").toBeLessThanOrEqual(2);
});

type SeedState = { day: number, dayServed: CustomerId[], lost: CustomerId[] };

/**
 * 三种可达的满字面：两位都在等（两块状态牌都是"正在等你"）、一位已经走掉（门口那块"已离开"）、
 * 一位已经成交（外线那块"已接待"）。走掉和成交都会把两行文字留在同一横线上，是最容易压字的两张状态。
 */
const SEEDS: Array<{ state: SeedState | null, label: string, suffix: string, waiting: string[] }> = [
  { state: null, label: "两位都在等", suffix: "", waiting: ["沈薇", "梅女士"] },
  { state: { day: 1, dayServed: [], lost: ["shen"] }, label: "一位已经走掉", suffix: "-lost", waiting: ["梅女士"] },
  { state: { day: 2, dayServed: ["xiaoyu"], lost: [] }, label: "一位已经成交", suffix: "-served", waiting: ["周姐"] },
];

async function enterFloor(page: Page, seed: SeedState | null) {
  if (seed) {
    // 关页时游戏会把内存里的存档写回去，所以种子必须在页面脚本跑起来之前落盘。
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
      { key: SAVE_KEY, value: { ...INITIAL, ...seed, sales: 1200 * seed.day, daySales: 1200 } });
  }
  await page.goto("/");
  if (!seed) await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  const open = page.getByRole("button", { name: "开始营业", exact: true });
  if (await open.count()) await open.click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.locator(".rescue-world")).toBeVisible();
  // 名牌跟着人物走 1 秒的 CSS transition，不等一下就量到的是走路中途。
  await page.waitForTimeout(1300);
}

/**
 * 把某个演员拖进视野：手机上沙盘按可见带的高度放大，一次只放得下一半人，其余要靠拖。
 * 一次只挪半屏、并且从沙盘中段起手——鼠标拖出窗口边界会被夹住，那种"看着拖了其实没动"的失败最难查。
 */
async function bringOnScreen(page: Page, handle: Locator, width: number) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const box = await handle.boundingBox();
    if (!box) return false;
    const center = box.x + box.width / 2;
    if (center > 6 && center < width - 6) return true;
    const scene = (await page.locator(".map-viewport").boundingBox())!;
    const room = scene.width / 2 - 20;
    const step = Math.max(-room, Math.min(room, center - width / 2));
    const lane = [0.45, 0.62, 0.78][attempt % 3];
    const from = { x: scene.x + scene.width / 2, y: scene.y + scene.height * lane };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(Math.max(scene.x + 12, Math.min(scene.x + scene.width - 12, from.x - step)), from.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(220);
  }
  return false;
}

for (const seed of SEEDS) {
  for (const viewport of VIEWPORTS) {
    test(`现场在 ${viewport.width}×${viewport.height}（${viewport.name} · ${seed.label}）文字不互相压住`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await enterFloor(page, seed.state);

      const tight = await page.locator(".rescue-scene.tight-plates").count() === 1;
      const items = await plates(page);
      expect(overlaps(items), `${viewport.width}×${viewport.height} 有叠字`).toEqual([]);
      // 沙盘小到一个世界单位不到 66/90 像素时，一张名牌都放不下：这时只该留下你点中的那一张。
      // 开口那张不留 —— P21 之后"开口的人"和"点中的人"必定不是同一个，两张一起亮就会在横屏叠住（实测 54×13）。
      const visibleNames = await page.locator(".pawn-name:visible").count();
      if (tight) {
        expect(await page.locator(".pawn-name:visible:not(.selected)").count(), viewport.name + "收起牌子之后还亮着别人的牌").toBe(0);
        expect(visibleNames, viewport.name + "沙盘放不下 " + CAST + " 张名牌，应该只留点中那一张").toBeLessThanOrEqual(1);
      }
      else expect(visibleNames, "正常沙盘每张名牌都要在").toBe(CAST);

      const pawns = page.locator(".rescue-pawn");
      const count = await pawns.count();
      expect(count).toBe(CAST);
      // 选客条只列还在等的客人，一个不多一个不少。桌面宽度下这条本来就让位给右侧柜位栏，所以按 DOM 数、不按可访问性数。
      const queue = page.locator(".floor-queue button");
      expect(await queue.count(), "选客条上的人不对").toBe(seed.waiting.length);
      if (tight) {
        // 横屏里人物立绘挤成一团，点不到每一个人：顾客必须仍然能从选客条里选出来。
        for (const name of seed.waiting) await expect(queue.filter({ hasText: name })).toBeVisible();
      } else {
        // 窄屏的选客条要真看得见，不能只在 DOM 里。
        if (viewport.width < 1101) for (const name of seed.waiting) await expect(queue.filter({ hasText: name })).toBeVisible();
        // 立绘和名牌是两层：名牌永远在最上面，所以每个人都能从自己的名字点进去（透明边缘不截点击）。
        for (let i = 0; i < count; i++) {
          const pawn = pawns.nth(i);
          const plate = page.locator(".pawn-name").nth(i);
          const handle = (await plate.isVisible() ? plate : pawn.locator("img"));
          expect(await bringOnScreen(page, handle, viewport.width), `第 ${i + 1} 个人拖不进视野`).toBe(true);
          await handle.click();
          await expect(pawn).toHaveClass(/selected/, { timeout: 5_000 });
        }
      }
      await page.screenshot({ path: `../audit/experience-v2/root-floor-${viewport.width}x${viewport.height}${seed.suffix}.png` });
    });
  }
}

/* 名牌是点人的快捷方式，但它压在彼此头顶上时"点谁的名字选出别人"是最难查的 bug —— 光看截图看不出来，
   因为两张牌各自都没被遮住，只有落点归谁这件事错了。这里逐张量"这个像素归谁"。
   44px 的触摸目标由立绘（手机 46×61）和选客条承担：纵向间距契约最紧只有 60 单位，名牌撑到 44px 就必然盖住邻牌。 */
for (const viewport of VIEWPORTS) {
  test(`每张名牌的落点归自己，点名字不会选出别人（${viewport.width}×${viewport.height}）`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await enterFloor(page, SEEDS[0].state);
    const tight = await page.locator(".rescue-scene.tight-plates").count() === 1;
    const owned = await page.evaluate(() => {
      const band = document.querySelector(".map-viewport")!.getBoundingClientRect();
      return [...document.querySelectorAll(".pawn-name")]
        .filter(el => el.getBoundingClientRect().height > 0)
        .flatMap(el => {
          const b = el.getBoundingClientRect();
          const x = b.x + b.width / 2, y = b.y + b.height / 2;
          // 手机上沙盘比屏幕宽，人本来就在屏外 —— 拖进来才谈得上点得到，这里不把她算成 bug。
          if (x < band.x || x > band.right || y < band.y || y > band.bottom) return [];
          const who = document.elementFromPoint(x, y)?.closest(".pawn-name");
          return who === el ? [] : ["「" + (el.textContent || "").trim().slice(0, 6) + "」的正中被「" + ((who?.textContent || document.elementFromPoint(x, y)?.className || "别的东西").trim().slice(0, 10)) + "」截走"];
        });
    });
    expect(owned, viewport.width + "×" + viewport.height + " 有名牌点错人").toEqual([]);
    // 收起来那一档只剩一两张牌，点不到每一个人：顾客仍然要能从选客条里选出来。
    if (tight) expect(await page.locator(".floor-queue button").count()).toBeGreaterThan(0);
    // 立绘是真正的触摸目标，按约定不能低于 44px。
    const shortest = await page.evaluate(() => Math.min(...[...document.querySelectorAll(".rescue-pawn img")]
      .filter(el => el.getBoundingClientRect().height > 0).map(el => el.getBoundingClientRect().height)));
    expect(shortest, "立绘点不到了，低于 44px").toBeGreaterThanOrEqual(44);
  });
}

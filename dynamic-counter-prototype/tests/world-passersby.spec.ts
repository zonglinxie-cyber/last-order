import { expect, test, type Page } from "@playwright/test";
import { newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { Slot, World } from "../src/world/types.ts";
import {
  PB_BASE, PB_FESTIVAL_EXTRA, PB_SECONDS, PB_SPAWN_GAP, PB_VARIANTS,
  WALK_PATHS, pathSeconds, walkKeyframes,
} from "../src/world/ui/zones.ts";

// 路人层（?mode=world 地图上的装饰人流）。
// 钉四件事：人按时段补到数、沿通道真的在走、绝不拦点击、开了「减少动态效果」就一个都不留。
// 尺寸契约照旧：390×844 与 320×568 下除地图容器外不横向溢出。

const pbWorld = (slot: Slot, over: Partial<World> = {}): World => ({
  ...newWorld("passersby-seed", PEOPLE),
  day: 2, slot, money: 4_600, energy: 100,
  present: { roman: "counter", suman: "counter", mei: "counter", zhou: "cashier", xiaoyu: "entrance", shen: "lounge" },
  ...over,
});

const enter = async (page: Page, world: World) => {
  const payload = JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "play" } });
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [SAVE_KEY, payload]);
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
};

/** 路人当前的位置（视口像素）。 */
const boxes = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".wf-pb")].map(el => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}));

test("晚高峰补到六位就停", async ({ page }) => {
  await enter(page, pbWorld(3));
  await expect.poll(() => boxes(page).then(b => b.length), { timeout: 15_000 }).toBe(PB_BASE[3]);
  await page.waitForTimeout(2000);
  expect(await boxes(page)).toHaveLength(PB_BASE[3]); // 不会自己超编
});

test("上午冷清：只补到三位", async ({ page }) => {
  await enter(page, pbWorld(0));
  await expect.poll(() => boxes(page).then(b => b.length), { timeout: 12_000 }).toBe(PB_BASE[0]);
  await page.waitForTimeout(2500);
  expect(await boxes(page)).toHaveLength(PB_BASE[0]); // 到数就不摆了
});

test("节日窗口再多两位", async ({ page }) => {
  await enter(page, pbWorld(3, { festival: "qixi" }));
  await expect.poll(() => boxes(page).then(b => b.length), { timeout: 15_000 }).toBe(PB_BASE[3] + PB_FESTIVAL_EXTRA);
});

test("路人沿通道走：位置在变、脚在迈步、朝左走的是镜像", async ({ page }) => {
  await enter(page, pbWorld(3));
  // 先等人流补齐，再量这一批人：补人期间下标会对不上
  await expect.poll(() => boxes(page).then(b => b.length), { timeout: 15_000 }).toBe(PB_BASE[3]);
  const before = await boxes(page);
  const faces = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".wf-pb i")].map(el => getComputedStyle(el).transform));
  const frames = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".wf-pb i")].map(el => getComputedStyle(el).backgroundPosition));
  await page.waitForTimeout(1600);
  const after = await boxes(page);
  expect(after).toHaveLength(before.length);
  // 每一位都真的挪了位置（不是钉在原地）
  before.forEach((b, i) => {
    expect(Math.abs(after[i].x - b.x) + Math.abs(after[i].y - b.y)).toBeGreaterThan(1);
  });
  // 走路帧在换、四种人里至少出现了两种、有人朝左（scaleX 镜像）
  const movedFrames = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".wf-pb i")].map(el => getComputedStyle(el).backgroundPosition));
  expect(movedFrames.some((f, i) => f !== frames[i])).toBe(true);
  expect(new Set(faces).size).toBeGreaterThan(1);
  // 比在场的人物小一号，且不显示名字
  const tagless = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".wf-pb")].every(el => !el.textContent?.trim()));
  expect(tagless).toBe(true);
  const sizes = await page.evaluate(() => ({
    pb: Math.round(document.querySelector<HTMLElement>(".wf-pb")!.getBoundingClientRect().height),
    actor: Math.round(document.querySelector<HTMLElement>(".wf-chibi")!.getBoundingClientRect().height),
  }));
  if (sizes.actor) expect(sizes.pb).toBeLessThan(sizes.actor);
});

test("路人不拦点击：点得到她身后的人，人物卡照常打开", async ({ page }) => {
  await enter(page, pbWorld(3));
  await expect.poll(() => boxes(page).then(b => b.length), { timeout: 15_000 }).toBeGreaterThan(2);
  const hit = await page.evaluate(() => {
    const layer = document.querySelector(".wf-passersby");
    const own = [...document.querySelectorAll<HTMLElement>(".wf-pb")].map(el => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!at && !!at.closest(".wf-passersby");
    });
    return {
      layer: layer ? getComputedStyle(layer).pointerEvents : "MISSING",
      figure: getComputedStyle(document.querySelector<HTMLElement>(".wf-pb i")!).pointerEvents,
      blocked: own.filter(Boolean).length,
    };
  });
  expect(hit.layer).toBe("none");
  expect(hit.figure).toBe("none");
  expect(hit.blocked).toBe(0);

  // 真按坐标点一次：路人层若吃点击，这张卡就打不开
  const box = await page.getByRole("button", { name: "查看梅女士" }).boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.locator(".person-card")).toBeVisible();
  // 层级也在人物下面
  const z = await page.evaluate(() => ({
    layer: getComputedStyle(document.querySelector<HTMLElement>(".wf-passersby")!).zIndex,
    actor: getComputedStyle(document.querySelector<HTMLElement>(".wf-actor")!).zIndex,
  }));
  expect(Number(z.layer)).toBeLessThan(Number(z.actor));
});

test("开了减少动态效果就不摆路人", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page, pbWorld(3));
  await page.waitForTimeout(3000);
  expect(await page.locator(".wf-passersby").count()).toBe(0);
  expect(await boxes(page)).toHaveLength(0);
  // 在场的人物照常在
  await expect(page.getByRole("button", { name: "查看梅女士" })).toBeVisible();
});

test("切到后台：脚步停在原地，也不再补人", async ({ page }) => {
  await enter(page, pbWorld(3));
  await expect.poll(() => boxes(page).then(b => b.length), { timeout: 15_000 }).toBeGreaterThan(0);
  const play = () => page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".wf-pb");
    return el ? getComputedStyle(el).animationPlayState : "MISSING";
  });
  expect(await play()).toBe("running");
  const hide = (state: string) => page.evaluate(visibility => {
    Object.defineProperty(document, "visibilityState", { get: () => visibility, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
  await hide("hidden");
  await expect.poll(play).toBe("paused");
  const waiting = (await boxes(page)).length;
  await page.waitForTimeout(3000);
  expect(await boxes(page)).toHaveLength(waiting); // 后台里不偷偷把人补齐
  await hide("visible");
  await expect.poll(play).toBe("running");
});

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("路人铺满通道也不造成横向溢出", async ({ page }) => {
      await enter(page, pbWorld(3));
      await expect.poll(() => boxes(page).then(b => b.length), { timeout: 15_000 }).toBe(PB_BASE[3]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      // 路人可以排在当前视野之外（地图本来有两屏宽），但不许排出地图本身：
      // 出了地图那一格就没有 overflow:hidden 兜着了。
      const outside = await page.evaluate(() => {
        const map = document.querySelector<HTMLElement>(".world-map")!.getBoundingClientRect();
        return [...document.querySelectorAll<HTMLElement>(".wf-pb")]
          .filter(el => {
            const r = el.getBoundingClientRect();
            return r.left < map.left - 1 || r.right > map.right + 1 || r.bottom > map.bottom + 1;
          })
          .map(el => `${el.style.left},${el.style.top}`);
      });
      expect(outside).toEqual([]);
      // 兜着这一层的裁剪框自己不许变宽（地图是两屏宽、靠拖，不是靠横向滚动）
      expect(await page.evaluate(() => {
        const view = document.querySelector<HTMLElement>(".world-map-view")!;
        return view.getBoundingClientRect().right - window.innerWidth;
      })).toBeLessThanOrEqual(1);
    });
  });
}

test("通道与节奏是可核对的纯规则", () => {
  // 四条通道：入口→中庭、中庭→维珞、入口↔休息区、沿橱窗横穿
  expect(WALK_PATHS).toHaveLength(4);
  for (const points of WALK_PATHS) {
    expect(points.length).toBeGreaterThanOrEqual(3);
    for (const p of points) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(100);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(100);
    }
  }
  // 慢一点：单趟 16~34 秒
  for (let i = 0; i < WALK_PATHS.length; i++) {
    expect(pathSeconds(i)).toBeGreaterThanOrEqual(PB_SECONDS.min);
    expect(pathSeconds(i)).toBeLessThanOrEqual(PB_SECONDS.max);
  }
  // 上午少、晚高峰多，节日再加两个；四种人轮换；补人间隔不至于半天不来人
  expect([PB_BASE[0], PB_BASE[1], PB_BASE[2], PB_BASE[3]]).toEqual([3, 4, 5, 6]);
  expect(PB_BASE[3] + PB_FESTIVAL_EXTRA).toBe(8);
  expect(PB_VARIANTS).toBe(4);
  expect(PB_SPAWN_GAP.max).toBeLessThanOrEqual(1200);
  // 每条通道都有一段自己的 @keyframes，位移用 cqw/cqh 跟着地图容器缩放
  for (let i = 0; i < WALK_PATHS.length; i++) {
    expect(walkKeyframes).toContain(`@keyframes wf-pb-walk-${i} {`);
  }
  const stops = walkKeyframes.match(/1cqw/g) ?? [];
  expect(stops.length).toBeGreaterThanOrEqual(WALK_PATHS.reduce((n, p) => n + p.length, 0));
});

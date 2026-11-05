import { expect, test, type Locator, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { CUSTOMERS, LEAGUES, PERKS, PRODUCTS } from "../src/world/counter/content.ts";
import {
  act, choosePerk, closeDeal, continueRun, emptyProfile, META_KEY, ORDERS_PER_DAY,
  parseProfile, parseRun, pickCustomer, recordResult, resultOf, SAVE_KEY,
  selectDiscount, selectProduct, serializeRun, startRun, TOTAL_DAYS,
} from "../src/world/counter/engine.ts";
import type { Action, Discount, Run } from "../src/world/counter/types.ts";
import { newWorld, parseWorld, SAVE_KEY as LEGACY_SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { emptyWorldProgress, WORLD_PROGRESS_KEY } from "../src/world/progress.ts";

// Default dev-server contract only: npx playwright test tests/counter-game.spec.ts --workers=1
// This is an omniscient UI-test oracle, NOT a player agent or a finite-information
// balance test. It reads real engine outcomes to choose offers; all journey actions
// still go through accessible UI controls. Never replace Math.random or seed wins.
const PREVIEW = "/?design=counter";
const AUDIT = new URL("../../audit/counter-redesign-2026-11-05/", import.meta.url);
const SHOT_RUN = process.env.COUNTER_AUDIT_PREFIX ?? `${Date.now()}-${process.pid}`;
const DISCOUNTS: Discount[] = [0, 10, 20];
const UI_ACTIONS: Action[] = ["ask-need", "ask-budget", "trial"];
const customerName = (id: string) => CUSTOMERS.find(c => c.id === id)!.name;
const productName = (id: string) => PRODUCTS.find(p => p.id === id)!.name;
const perkName = (id: string) => PERKS.find(p => p.id === id)!.name;
const primary = (page: Page) => page.locator(".c-footer .c-primary");

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.mouse.move(-100, -100);
  const cursor = page.getByTestId("mobile-cursor");
  if (await cursor.count()) {
    await expect(cursor).toHaveAttribute("data-visible", "false");
    await expect(cursor).toHaveCSS("opacity", "0");
  }
  const path = fileURLToPath(new URL(`${SHOT_RUN}-${name}.png`, AUDIT));
  await page.screenshot({ path, animations: "disabled", timeout: 5_000 });
  console.log(`Screenshot: ${path}`);
}

async function ready(button: Locator, main = false) {
  // Trial waits for motion/scroll stability without bypassing hit testing.
  await button.click({ trial: true });
  if (main) {
    const box = await button.boundingBox();
    expect(box, "main action has no bounding box").not.toBeNull();
    expect(box!.height, "main action must be at least 44px high").toBeGreaterThanOrEqual(44);
    expect(box!.width, "main action must be at least 44px wide").toBeGreaterThanOrEqual(44);
  }
  await expect.poll(() => button.evaluate(el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      reachable: x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && !!hit && el.contains(hit),
      blockedBy: hit && !el.contains(hit) ? `${hit.tagName}.${hit.className}` : null,
    };
  }), { message: "action center must hit the actual control, not an overlay/footer" })
    .toMatchObject({ reachable: true });
}

async function tap(button: Locator, main = false) {
  await ready(button, main);
  await button.click();
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const roots = [document.documentElement, document.body,
      ...document.querySelectorAll<HTMLElement>(".counter-app, .c-pad, .c-footer, .mobile-scroll, .bottom-sheet, .c-menu-content")];
    return roots.filter(el => el.getBoundingClientRect().width > 0 && el.scrollWidth > el.clientWidth + 1)
      .map(el => ({ node: el.className || el.tagName, width: el.clientWidth, scrollWidth: el.scrollWidth }));
  });
  expect(overflow, "horizontal overflow, including clipped inner scroll areas").toEqual([]);
}

async function readRun(page: Page): Promise<Run> {
  const run = parseRun(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY));
  expect(run, "UI must persist a structurally valid engine run").not.toBeNull();
  return run!;
}

async function expectRun(page: Page, expected: Run) {
  await expect.poll(async () => parseRun(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)))
    .toEqual(expected);
}

async function readProfile(page: Page) {
  return parseProfile(await page.evaluate(key => localStorage.getItem(key), META_KEY));
}

async function openHome(page: Page) {
  await page.goto(PREVIEW);
  await expect(page.getByTestId("counter-game")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-phone-chrome", "real");
}

async function startFresh(page: Page) {
  await openHome(page);
  await tap(page.getByRole("button", { name: /开柜，迎接第一位客人/ }), true);
  await expect(page.getByRole("heading", { name: "今天，先接谁？" })).toBeVisible();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).not.toBeNull();
  return readRun(page);
}

async function seedRun(page: Page, run: Run) {
  expect(parseRun(serializeRun(run))).toEqual(run);
  await openHome(page);
  // Seed once, not in a reload init script: refresh must exercise real persistence.
  await page.evaluate(({ save, meta, value, profile }) => {
    localStorage.setItem(save, value);
    localStorage.setItem(meta, profile);
  }, { save: SAVE_KEY, meta: META_KEY, value: serializeRun(run), profile: JSON.stringify(emptyProfile()) });
  await page.reload();
  await expect(page.getByTestId("counter-game")).toBeVisible();
}

async function resume(page: Page, run: Run) {
  await tap(page.getByRole("button", { name: new RegExp(`继续第 ${run.day} 天`) }), true);
  await expectRun(page, run);
}

type Offer = { product: string; discount: Discount; actions: Action[]; prepared: Run; settled: Run };
function bestOffer(deal: Run, plans: Action[][] = [UI_ACTIONS]): Offer {
  if (deal.phase !== "deal") throw new Error("Offer oracle requires an active deal");
  const choices: Offer[] = [];
  for (const p of PRODUCTS) for (const discount of DISCOUNTS) for (const actions of plans) {
    let prepared = selectDiscount(selectProduct(deal, p.id), discount);
    for (const action of actions) prepared = act(prepared, action);
    choices.push({ product: p.id, discount, actions, prepared, settled: closeDeal(prepared) });
  }
  const score = (offer: Offer) => Number(offer.settled.receipt!.outcome === "sold") * 100_000 +
    offer.settled.receipt!.profit + offer.settled.receipt!.relationDelta * 5;
  return choices.sort((a, b) => score(b) - score(a))[0]!;
}

function bestCustomer(run: Run, plans: Action[][] = [UI_ACTIONS]) {
  return run.board.map(op => ({ op, offer: bestOffer(pickCustomer(run, op.id), plans) }))
    .sort((a, b) => (Number(b.offer.settled.receipt!.outcome === "sold") - Number(a.offer.settled.receipt!.outcome === "sold")) * 100_000 +
      b.offer.settled.receipt!.profit + b.op.rivalValue - a.offer.settled.receipt!.profit - a.op.rivalValue)[0]!;
}

async function pickInUI(page: Page, run: Run, id = bestCustomer(run).op.id) {
  const op = run.board.find(o => o.id === id)!;
  await tap(page.getByRole("button", { name: `选择${customerName(op.customerId)}`, exact: true }));
  await expect(page.getByRole("button", { name: `选择${customerName(op.customerId)}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await tap(page.getByRole("button", { name: new RegExp(`^接待${customerName(op.customerId)}`) }), true);
  const deal = pickCustomer(run, id);
  await expectRun(page, deal);
  await expect(page.getByLabel(`剩余 ${deal.active!.patience} 次交谈`, { exact: true })).toBeVisible();
  return deal;
}

async function askInUI(page: Page, run: Run, action: "ask-need" | "ask-budget") {
  await tap(page.getByRole("button", { name: action === "ask-need" ? /问需求/ : /问预算/ }));
  const expected = act(run, action);
  expect(expected.active!.patience).toBe(run.active!.patience - 1);
  expect(expected.samples).toBe(run.samples);
  await expectRun(page, expected);
  await expect(page.getByLabel(`剩余 ${expected.active!.patience} 次交谈`, { exact: true })).toBeVisible();
  return expected;
}

async function offerInUI(page: Page, run: Run, screenshot?: string) {
  const offer = bestOffer(run, [["trial"]]);
  await tap(page.getByRole("tab", { name: "02 挑货报价" }));
  await expect(page.getByRole("tabpanel", { name: "02 挑货报价" })).toBeVisible();
  const product = page.getByRole("button", { name: `选择${productName(offer.product)}`, exact: true });
  await tap(product);
  let expected = selectProduct(run, offer.product);
  await expectRun(page, expected);
  await expect(product).toHaveAttribute("aria-pressed", "true");
  await tap(page.getByRole("button", { name: offer.discount === 0 ? "原价" : offer.discount === 10 ? "九折" : "八折", exact: true }));
  expected = selectDiscount(expected, offer.discount);
  await expectRun(page, expected);
  await tap(page.getByRole("button", { name: /^试这支/ }), true);
  const tried = act(expected, "trial");
  expect(tried.samples).toBe(expected.samples - 1);
  expect(tried.active!.patience).toBe(expected.active!.patience - 1);
  await expectRun(page, tried);
  await expect(page.getByRole("button", { name: /^这支已试过/ })).toBeDisabled();
  await ready(page.getByRole("button", { name: /就这样报价/ }), true);
  await noHorizontalOverflow(page);
  const discounts = page.getByRole("group", { name: "报价折扣" }).getByRole("button");
  const tabs = page.getByRole("tablist", { name: "接待步骤" }).getByRole("tab");
  await expect(discounts).toHaveCount(3);
  await expect(tabs).toHaveCount(2);
  const smallTargets = await discounts.or(tabs).evaluateAll(buttons => buttons.map(button => {
    const { width, height } = button.getBoundingClientRect();
    return { label: button.textContent, width, height };
  }).filter(button => button.height < 44 || button.width < 44));
  expect(smallTargets, "discount and step-tab touch targets must be at least 44×44px").toEqual([]);
  if (screenshot) await shot(page, screenshot);
  await tap(page.getByRole("button", { name: /就这样报价/ }), true);
  const settled = closeDeal(tried);
  await expectRun(page, settled);
  expect(settled.history).toHaveLength(run.history.length + 1);
  expect(settled.money).toBe(run.money + settled.receipt!.profit);
  await expect(page.getByRole("heading", { name: settled.receipt!.outcome === "sold" ? "这单，接住了。" : "这次，没接住。" })).toBeVisible();
  return settled;
}

function finalOrderFixture(): Run {
  const plans: Action[][] = [["ask-budget", "listen", "trial"], ["listen", "trial"], ["listen"], []];
  const priority = ["perfect-fit", "warm-return", "budget-room", "care-bonus", "trial-expert", "deep-listen", "patient", "sample-kit", "good-name", "double-question", "second-wind"];
  for (let seed = 0; seed < 20; seed++) {
    let run = startRun(`counter-ui-final-${seed}`, 0, "closer");
    for (let step = 0; step < 60 && run.phase !== "result"; step++) {
      if (run.phase === "select" && run.day === TOTAL_DAYS && run.turn === ORDERS_PER_DAY - 1) {
        const final = bestCustomer(run).offer.settled;
        if (final.receipt!.outcome === "sold" && resultOf(continueRun(final)).won) {
          expect(run.history).toHaveLength(13);
          expect(parseRun(serializeRun(run))).toEqual(run);
          return run;
        }
        break;
      }
      if (run.phase === "select") run = bestCustomer(run, plans).offer.settled;
      else if (run.phase === "receipt") run = continueRun(run);
      else if (run.phase === "draft") {
        const perk = [...run.draft].sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0]!;
        run = choosePerk(run, perk);
      } else throw new Error(`Unexpected fixture phase: ${run.phase}`);
    }
  }
  throw new Error("Real-engine fixture search found no winnable final order in 20 seeds");
}

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test.describe.configure({ timeout: 60_000 });
test.beforeEach(async ({ page, baseURL }) => {
  expect(baseURL, "Use the default Vite 4174 config, never preview/dist").toBe("http://127.0.0.1:4174");
  page.setDefaultTimeout(8_000);
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) await shot(page, `failure-${info.testId}`).catch(error => console.warn("Failure screenshot unavailable:", error));
});

for (const [width, height] of [[320, 568], [390, 844]] as const) {
  test(`fresh home ${width}×${height}: real mobile, no overflow, start is reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openHome(page);
    expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBeNull();
    await expect(page.getByRole("button", { name: /继续第/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `${LEAGUES[1]!.name}，尚未解锁`, exact: true })).toBeDisabled();
    const start = page.getByRole("button", { name: /开柜，迎接第一位客人/ });
    await ready(start, true);
    await noHorizontalOverflow(page);
    await shot(page, `home-${width}x${height}`);
    await tap(start, true);
    await expect(page.getByRole("heading", { name: "今天，先接谁？" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^选择/ })).toHaveCount(3);
    await expect(primary(page)).toBeDisabled();
    await noHorizontalOverflow(page);
  });
}

test("fresh UI journey: two orders, samples/patience/profit, receipt, draft and next day persist", async ({ page }) => {
  let run = await startFresh(page);
  await shot(page, "queue-390x844");
  run = await pickInUI(page, run);
  run = await askInUI(page, run, "ask-need");
  run = await askInUI(page, run, "ask-budget");
  await ready(primary(page), true);
  await shot(page, "negotiation-390x844");
  run = await offerInUI(page, run, "shelf-390x844");
  await ready(primary(page), true);
  await shot(page, "receipt-390x844");
  await tap(page.getByRole("button", { name: /还有一位，继续接客/ }), true);
  run = continueRun(run);
  await expectRun(page, run);
  expect(run.turn).toBe(1);
  expect(run.board).toHaveLength(2);
  run = await pickInUI(page, run);
  run = await askInUI(page, run, "ask-need");
  run = await askInUI(page, run, "ask-budget");
  run = await offerInUI(page, run);
  expect(run.turn).toBe(2);
  await tap(page.getByRole("button", { name: /收柜，选明天的能力/ }), true);
  run = continueRun(run);
  await expectRun(page, run);
  await expect(page.getByRole("heading", { name: "明天，用什么赢？" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^选择能力/ })).toHaveCount(3);
  await page.reload();
  await resume(page, run);
  const chosen = run.draft[0]!;
  await tap(page.getByRole("button", { name: `选择能力${perkName(chosen)}`, exact: true }));
  await ready(primary(page), true);
  await noHorizontalOverflow(page);
  await shot(page, "draft-390x844");
  await tap(primary(page), true);
  const next = choosePerk(run, chosen);
  await expectRun(page, next);
  expect(next.day).toBe(2);
  expect(next.history).toEqual(run.history);
  expect(next.money).toBe(run.money);
  expect(next.relations).toEqual(run.relations);
  expect(next.perks).toContain(chosen);
  expect(next.samples).toBeGreaterThan(run.samples);
  await expect(page.getByLabel("第 2 天，共 7 天", { exact: true })).toBeVisible();
  await page.reload();
  await resume(page, next);
  await expect(page.getByRole("heading", { name: "今天，先接谁？" })).toBeVisible();
});

test("reload resumes the same negotiation and conversation count; receipts never settle twice", async ({ page }) => {
  let run = await startFresh(page);
  run = await pickInUI(page, run);
  run = await askInUI(page, run, "ask-need");
  run = await askInUI(page, run, "ask-budget");
  const snapshot = serializeRun(run);
  await page.reload();
  await expect(page.getByRole("button", { name: /继续第 1 天.*这笔谈单还在/ })).toBeVisible();
  await resume(page, run);
  await expect(page.getByLabel(`剩余 ${run.active!.patience} 次交谈`, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /问预算/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /问需求/ })).toBeDisabled();
  expect(serializeRun(await readRun(page))).toBe(snapshot);
  run = await offerInUI(page, run);
  const settled = serializeRun(run);
  for (let i = 0; i < 2; i++) {
    await page.reload();
    await expect(page.getByRole("button", { name: /继续第 1 天.*这单已经结账/ })).toBeVisible();
    await resume(page, run);
    await expect(primary(page)).toContainText("还有一位，继续接客");
    expect(serializeRun(await readRun(page))).toBe(settled);
    expect(await readProfile(page)).toEqual(emptyProfile());
  }
  await tap(primary(page), true);
  await expectRun(page, continueRun(run));
});

test("real-engine final order wins through UI, unlocks next league and rewards exactly once", async ({ page }) => {
  let run = finalOrderFixture();
  console.log(`Final-order fixture: ${run.seed}, ${run.history.length} engine-settled orders, net ${run.money}/${run.rivalMoney}`);
  await seedRun(page, run);
  expect(await readProfile(page)).toEqual(emptyProfile());
  await expect(page.getByRole("button", { name: `${LEAGUES[1]!.name}，尚未解锁`, exact: true })).toBeDisabled();
  await resume(page, run);
  run = await pickInUI(page, run);
  run = await askInUI(page, run, "ask-need");
  run = await askInUI(page, run, "ask-budget");
  run = await offerInUI(page, run);
  expect(run.history).toHaveLength(TOTAL_DAYS * ORDERS_PER_DAY);
  expect(run.receipt!.outcome).toBe("sold");
  expect(await readProfile(page), "receipt alone must not award a result").toEqual(emptyProfile());
  await tap(page.getByRole("button", { name: /看这轮战绩/ }), true);
  run = continueRun(run);
  await expectRun(page, run);
  expect(resultOf(run).won).toBe(true);
  const reward = recordResult(emptyProfile(), run);
  await expect.poll(() => readProfile(page)).toEqual(reward);
  expect(reward).toMatchObject({ wins: 1, runs: 1, unlocked: 1 });
  await expect(page.getByRole("heading", { name: "这一柜，赢得漂亮。" })).toBeVisible();
  await expect(page.getByRole("heading", { name: LEAGUES[1]!.name, exact: true })).toBeVisible();
  await ready(primary(page), true);
  await shot(page, "result-390x844");
  // Refresh directly from the awarded result, not only after returning home.
  for (let i = 0; i < 2; i++) {
    await page.reload();
    await expect(page.getByRole("button", { name: LEAGUES[1]!.name, exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: /继续第/ })).toHaveCount(0);
    expect(await readProfile(page)).toEqual(reward);
    await expectRun(page, run);
  }
  await tap(page.getByRole("button", { name: LEAGUES[1]!.name, exact: true }));
  await tap(page.getByRole("button", { name: /开柜，迎接第一位客人/ }), true);
  await expect.poll(async () => (await readRun(page)).rank).toBe(1);
  expect(await readProfile(page)).toEqual(reward);
});

test("legacy default entry and counter preview keep their run/profile storage isolated", async ({ page }) => {
  await openHome(page);
  const legacyWorld = newWorld("counter-isolation-legacy", PEOPLE);
  const legacy = JSON.stringify({ version: WORLD_SAVE_VERSION, world: legacyWorld, ui: { screen: "play" } });
  const legacyProgress = JSON.stringify(emptyWorldProgress());
  await page.evaluate(entries => { for (const [key, value] of entries) localStorage.setItem(key, value); },
    [[LEGACY_SAVE_KEY, legacy], [WORLD_PROGRESS_KEY, legacyProgress]]);
  await page.reload();
  await expect(page.getByRole("button", { name: /继续第/ })).toHaveCount(0);
  await tap(page.getByRole("button", { name: /开柜，迎接第一位客人/ }), true);
  await expect(page.getByRole("heading", { name: "今天，先接谁？" })).toBeVisible();
  const counter = await pickInUI(page, await readRun(page));
  const counterProfile = await readProfile(page);
  const legacyEntries = () => page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [LEGACY_SAVE_KEY, WORLD_PROGRESS_KEY]);
  expect(await legacyEntries()).toEqual([legacy, legacyProgress]);
  await page.goto("/");
  await expect(page.locator(".world-app")).toBeVisible();
  await expect(page.getByTestId("counter-game")).toHaveCount(0);
  await tap(page.getByRole("button", { name: /^继续/ }).first());
  await expect.poll(async () => {
    const raw = await page.evaluate(key => localStorage.getItem(key), LEGACY_SAVE_KEY);
    return parseWorld(raw)?.seed;
  }).toBe(legacyWorld.seed);
  await expectRun(page, counter);
  expect(await readProfile(page)).toEqual(counterProfile);
  const legacyAfterResume = await legacyEntries();
  await openHome(page);
  await resume(page, counter);
  await askInUI(page, counter, "ask-need");
  expect(await legacyEntries()).toEqual(legacyAfterResume);
});

test("320×568 shelf/menu action centers are reachable; sending a customer away can be cancelled", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  let run = await startFresh(page);
  run = await pickInUI(page, run);
  run = await askInUI(page, run, "ask-need");
  await tap(page.getByRole("button", { name: "这笔先不争了", exact: true }));
  const leave = page.getByRole("dialog", { name: "放下这笔生意？", exact: true });
  await expect(leave).toBeVisible();
  await ready(leave.getByRole("button", { name: "确认送客", exact: true }), true);
  await ready(leave.getByRole("button", { name: "再想一下", exact: true }), true);
  await shot(page, "leave-confirm-320x568");
  await tap(leave.getByRole("button", { name: "再想一下", exact: true }), true);
  await expect(leave).toHaveCount(0);
  await expectRun(page, run);
  expect(run.history).toHaveLength(0);
  await tap(page.getByRole("button", { name: "查看玩法与经营能力", exact: true }), true);
  const menu = page.getByRole("dialog", { name: "这一柜，怎么赢？", exact: true });
  await expect(menu).toBeVisible();
  const back = menu.getByRole("button", { name: "知道了，回柜台", exact: true });
  await ready(back, true);
  await noHorizontalOverflow(page);
  await shot(page, "menu-320x568");
  await ready(menu.getByRole("button", { name: "保存并回到开柜页", exact: true }), true);
  await tap(back, true);
  await expect(menu).toHaveCount(0);
  await expectRun(page, run);
  run = await askInUI(page, run, "ask-budget");
  await offerInUI(page, run, "shelf-320x568");
  await noHorizontalOverflow(page);
});

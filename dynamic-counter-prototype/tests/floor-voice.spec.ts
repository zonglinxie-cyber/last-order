import { expect, test, type Page } from "@playwright/test";
import { INITIAL, energyWord } from "../src/campaign";

// 现场那一屏有四个会念人的槽：页顶那行、墙上气泡、身份块、面板引号。
// 之前它们会各念同一个人两遍（量出来的：点中第一位客人时墙上气泡和面板引号一字不差，页顶那行又把身份块的行动念一遍）。
// 这里钉住"一个人只在一处开口"：点中她之后，墙上和页顶念的必须是别人。
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function toFloor(page: Page, day: number) {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)),
    { ...INITIAL, day, sales: 1200 * day, daySales: 1200, eventDoneDays: Array.from({ length: day - 1 }, (_, i) => i + 1) });
  await page.reload();
  await page.getByRole("button", { name: `继续第 ${day} 天` }).click();
  const start = page.getByRole("button", { name: "开始营业", exact: true });
  if (await start.count()) await start.click();
}

function readSlots(page: Page) {
  return page.evaluate(() => {
    const text = (sel: string) => (document.querySelector(sel)?.textContent ?? "").trim();
    return {
      feed: text(".floor-feed"),
      bubble: text(".actor-bubble.stage-bubble"),
      quote: text(".inspect-quote"),
      focusName: text(".player-identity strong").split(" · ")[0],
      speakingName: [...document.querySelectorAll(".floor-actor.is-speaking .actor-tag")].map(el => (el.textContent ?? "").trim()),
      small: text(".player-identity small"),
      hint: text(".player-console > p"),
      party: [...document.querySelectorAll(".party-list li")].map(el => (el.textContent ?? "").trim()),
      // 结构不变量：一个人不能既是"我点中的"又是"正在开口的"。
      both: [...document.querySelectorAll(".floor-actor.is-selected.is-speaking")].map(el => el.getAttribute("aria-label") ?? "?"),
      onFloor: [...document.querySelectorAll(".floor-actor")].map(el => (el.getAttribute("aria-label") ?? "").replace("查看", "")),
    };
  });
}

/** 墙上那句话现在只跟着现场状态变，不跟着拍子变：连着采几次，它必须一句都没换过。
    间隔取 300 毫秒（比一拍 380 毫秒还短），换算是"这句话停得住"，不是"这一拍刚好没跳到"。 */
async function sampleBeats(page: Page, times = 5) {
  const seen: string[] = [];
  for (let i = 0; i < times; i++) {
    seen.push((await readSlots(page)).bubble);
    await page.waitForTimeout(300);
  }
  return seen;
}

for (const day of [2, 4]) {
  test(`第 ${day} 天现场：点中谁，墙上和页顶就不再念谁`, async ({ page }) => {
    test.setTimeout(60_000);
    await toFloor(page, day);
    const actors = await page.locator(".floor-actor").evaluateAll(nodes => nodes.map(n => n.getAttribute("aria-label") ?? ""));
    expect(actors.length, "现场一个人也没有，这一屏没什么可钉的").toBeGreaterThan(1);
    for (const label of actors) {
      const who = label.replace("查看", "");
      await page.getByRole("button", { name: label, exact: true }).dispatchEvent("click");
      const slots = await readSlots(page);
      const beats = await sampleBeats(page);
      expect(slots.both, `${who}：同一个人既被点中又在开口`).toEqual([]);
      // 说话的人必须恰好一个，而且不是你刚点中的那个（P21）。以前这里比的是"墙上那句 ≠ 面板那句"，
      // 但两位客人都到了要走的档位时本来就同说「我真的要走了。」——那是两个人，不是一屏两遍，所以改按人比。
      expect(slots.speakingName.length, `${who}：墙上说话的人不是一个`).toBe(1);
      expect(slots.speakingName[0], `${who}：墙上开口的就是你点中的${who}`).not.toBe(slots.focusName);
      expect(beats.filter(Boolean).length, `${who}：墙上一直是空的，这一屏没有别的人在活`).toBe(beats.length);
      // 一句话从头到尾没换过拍子（P22），而且短到停这几秒就读得完。
      expect(new Set(beats).size, `${who}：墙上那句话在跳：${beats.join(" / ")}`).toBe(1);
      expect([...beats[0]].length, `${who}：墙上那句 ${beats[0]} 有 ${[...beats[0]].length} 字，380 毫秒一档根本读不完`).toBeLessThanOrEqual(18);
      // 页顶那行是"还有谁在等"：现场有别人的时候，它不重复报面板已经点名的人。
      if (slots.onFloor.length > 1) expect(slots.feed.startsWith(`${who} · `), `页顶又念了一遍${who}`).toBe(false);
      expect(slots.hint, "体力的那句在身份块和提示行各念一遍").not.toBe(slots.small);
      // 每个人在一屏里出现且只出现一次：页顶、名单、身份块三格加起来不重不漏。
      const named = [slots.feed.split(" · ")[0], ...slots.party.map(line => line.split(" · ")[0]), slots.focusName];
      expect(new Set(named).size, `这一屏报的人重了：${named.join(" / ")}`).toBe(named.length);
      expect(named.filter(name => slots.onFloor.includes(name)).length, `现场有 ${slots.onFloor.length} 个人，这一屏只报出 ${named.length} 个`).toBe(slots.onFloor.length);
    }
    // 两张同名不同号：P21 的记录按 p21-* 引证，本轮之后现场是 P22 的状态，两个名字都留下。
    await page.screenshot({ path: `../audit/experience-v2/p21-mobile-floor-day${day}.png` });
    await page.screenshot({ path: `../audit/experience-v2/p22-mobile-floor-day${day}.png` });
  });
}

// 只剩一位客人 + 今天已经累：体力那句话只有一个槽可念。
// 这两个条件同时成立以前，身份块和面板最下面那行会一字不差地各念一遍"还站得住，能再接 N 位"。
test("现场只剩一位客人且今天累了，体力那句也只在身份块念一遍", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)),
    { ...INITIAL, day: 4, energy: 10, sales: 4800, daySales: 1200, eventDoneDays: [1, 2, 3] });
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
  const start = page.getByRole("button", { name: "开始营业", exact: true });
  if (await start.count()) await start.click();
  const slots = await readSlots(page);
  expect(slots.onFloor.length, "这一格要的是只剩一位客人的现场").toBe(3);
  expect(slots.small, "累到那一档时身份块该念体力这句话").toBe(energyWord(10));
  expect(slots.hint, `体力在身份块（${slots.small}）和提示行各念一遍`).not.toBe(slots.small);
  await page.screenshot({ path: "../audit/experience-v2/p21-mobile-floor-tired-alone.png" });
});

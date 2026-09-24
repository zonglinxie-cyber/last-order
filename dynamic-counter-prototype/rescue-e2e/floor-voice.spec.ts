import { expect, test, type Page } from "@playwright/test";
import { CUSTOMERS, INITIAL, SAVE_KEY, type CustomerId } from "../src/campaign";

// 沙盘这一屏原来有两处念同一个人：空地那句（.floor-voice）和面板那句（她正在说）。
// 选中谁，空地那句就是她的整句开口，面板又是同一句 —— 量到的第 2 天周姐就是逐字相同。
// 现在定下来：面板念"你点中的这个人"，空地念"你没点中的那个人"（第 1 天那句副标题正是"只能先抓住一个"）。
async function enterFloor(page: Page, seed: Record<string, unknown> | null) {
  if (seed) await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: SAVE_KEY, value: { ...INITIAL, ...seed } });
  await page.goto("/");
  if (!seed) await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  const open = page.getByRole("button", { name: "开始营业", exact: true });
  if (await open.count()) await open.click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.waitForTimeout(1300);
}

const read = (page: Page) => page.evaluate(() => {
  const raw = (document.querySelector(".floor-voice")?.textContent ?? "").trim();
  const quote = raw.match(/“(.*)”/s);
  return {
    // 剥掉名字和引号，只比那句话本身。
    voice: quote ? quote[1] : raw,
    voiceName: (document.querySelector(".floor-voice b")?.textContent ?? "").trim(),
    panel: [...document.querySelectorAll(".floor-inspect p")].map(el => (el.textContent ?? "").trim()),
    speaking: [...document.querySelectorAll(".pawn-name.is-speaking")].map(el => (el.textContent ?? "").trim()),
    selected: [...document.querySelectorAll(".pawn-name.selected")].map(el => (el.textContent ?? "").trim()),
  };
});

async function pick(page: Page, name: string) {
  await page.locator(".pawn-name", { hasText: name }).first().click({ force: true, timeout: 4_000 });
  await expect(page.locator(".pawn-name.selected")).toContainText(name, { timeout: 4_000 });
}

const STATES: Array<{ label: string; seed: Record<string, unknown> | null; focus: Array<{ id: CustomerId; name: string }> }> = [
  { label: "第1天两位都在等", seed: null, focus: [{ id: "shen", name: "沈薇" }, { id: "mei", name: "梅女士" }] },
  { label: "第2天一位已成交", seed: { day: 2, dayServed: ["xiaoyu"], lost: [], sales: 2400, daySales: 1200 }, focus: [{ id: "zhou", name: "周姐" }] },
];

for (const state of STATES) {
  test(`沙盘空地上那句不重复念面板已经点过的人（${state.label}）`, async ({ page }) => {
    test.setTimeout(60_000);
    await enterFloor(page, state.seed);
    for (const who of state.focus) {
      await pick(page, who.name);
      const seen = await read(page);
      const hers = CUSTOMERS[who.id].opening;
      expect(seen.panel[0], `${who.name}：面板没在念她开口那句`).toBe(hers);
      // 同一句话不许在两处出现，也不许其中一处是另一处的开头（第 1 天沈薇就是被截成前半句各念一遍）。
      if (seen.voice) {
        expect(hers.includes(seen.voice) || seen.voice.includes(hers), `空地念的还是${who.name}那句：${seen.voice}`).toBe(false);
        expect(seen.voiceName, `空地那句挂到了你点中的人身上：${seen.voiceName}`).not.toBe(who.name);
      }
      expect(seen.speaking.join("|"), "点中和开口落在同一张名牌上").not.toContain(who.name);
    }
    await page.screenshot({ path: `../audit/experience-v2/p21-sandbox-floor-${state.label}.png` });
  });
}

test("沙盘面板那句跟着她的耐心走，且空地按'先看谁'挑人", async ({ page }) => {
  test.setTimeout(60_000);
  // 梅女士是按先后来排的第二位，却是更等不住的那一位：这样"按耐心挑"和"按先来挑"才分得开。
  await enterFloor(page, { day: 1, waitMeters: { shen: 8, mei: 2 } });
  await pick(page, "梅女士");
  const seen = await read(page);
  // 她已经在看表了：面板原来写死开场白，等于把"还有两分钟"这件事抹掉。
  expect(seen.panel[0], `梅女士只剩 2 分耐心，面板还念「${seen.panel[0]}」`).toBe("我真的要走了。");
  expect(seen.voiceName, "空地那句又挂回你点中的人身上").not.toBe("梅女士");
  // 这张要在点中她的时候拍：面板那句就是本轮要改的东西，晚一步面板就换成同事了。
  await page.screenshot({ path: `../audit/experience-v2/p22-sandbox-panel-看表那一位.png` });
  // 点中的是同事时，两位客人都在"没点中"那一堆里，空地该报更等不住的那一位。
  await pick(page, "陆遥");
  const staff = await read(page);
  expect(staff.voiceName, `空地念的是${staff.voiceName}，可梅女士只剩 2 分`).toBe("梅女士");
  expect(staff.speaking.join("|")).toContain("梅女士");
  await page.screenshot({ path: `../audit/experience-v2/p22-sandbox-floor-空地挑更等不住的那位.png` });
  // 隔 1.2 秒（三拍多）再拍一张：两张里那句话必须是同一句，这是"停得住"的视觉证据。
  await page.waitForTimeout(1200);
  expect((await read(page)).voiceName, "1.2 秒之后空地换人了").toBe("梅女士");
  await page.screenshot({ path: `../audit/experience-v2/p22-sandbox-floor-1.2秒后还是这句.png` });
});

test("沙盘空地那句报的是另一个还在等的人，替你把'只能先抓住一个'摆出来", async ({ page }) => {
  test.setTimeout(60_000);
  await enterFloor(page, null);
  await pick(page, "沈薇");
  const shen = await read(page);
  expect(shen.voice, "点中沈薇时，空地该念还站在另一头的梅女士").toBe("我只有十分钟。");
  expect(shen.voiceName).toBe("梅女士");
  await pick(page, "梅女士");
  const mei = await read(page);
  // 梅女士那句整句太长，空地只念头一段；整句在面板里，不会丢。
  expect(mei.voice, "点中梅女士时，空地该念沈薇").toBe("先说好，我不缺粉底。");
  expect(mei.voiceName).toBe("沈薇");
  expect(mei.panel[0]).not.toContain(mei.voice);
});

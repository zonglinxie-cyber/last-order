// 人情场（?mode=world）整季通关冒烟：扮演一个普通玩家，从新档开局一路玩到第 28 天散场，
// 进季末回顾页（.world-recap），再开第 2 季玩三天，确认跨季内容能开出来。
// 跑法：cd dynamic-counter-prototype && MOBILE_RUNTIME_TEST_PORT=4474 npx playwright test tests/world-season-smoke.spec.ts
// 两条引导路径各跑一遍：一条全程点「知道了」，一条开局点「跳过引导」。
// 玩家的选择由固定种子决定；开局那颗骰子（Date.now + Math.random）也一起钉住，同一个 SEED 玩出来的整季内容可复现。
// 逐时段记进 ../audit/world-smoke/report-<路径>.json：点了谁、做了什么、她那边念到什么，以及卡死/遮挡/缺字。
// 发现问题只记录、只截图，不改 src/，由主控分派。
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import type { World } from "../src/world/types.ts";
import { COACH_KEY } from "../src/world/ui/coach.ts";
import { WORLD_PROGRESS_KEY } from "../src/world/progress.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { ENDINGS, seasonEnding } from "../src/world/ending.ts";

const AUDIT_DIR = "../audit/world-smoke";
const SEED = 20261009;
const FIXED_NOW = 1_800_000_000_000;
const STEP_MS = 5_000; // 单步超过 5 秒算卡死
const SEASON_DAYS = 28;
const S2_DAYS = 3; // 进第 2 季后再玩三天
const SLOTS_PER_DAY = 4;
const SLOT_WORDS = ["上午", "午后", "傍晚", "晚高峰"];
const MAX_STEPS = SEASON_DAYS * (SLOTS_PER_DAY + 2) + 40;
const MAX_STEPS_S2 = S2_DAYS * (SLOTS_PER_DAY + 2) + 30;

mkdirSync(AUDIT_DIR, { recursive: true });

/** 一条记下来的问题：哪一天哪个时段、做了什么、看到了什么。 */
type Note = { where: string; did: string; saw: string };

/** 玩家侧的随机：线性同余，只决定"点谁 / 做哪个动作"。 */
const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
const pick = <T,>(list: readonly T[], rnd: () => number): T => list[Math.floor(rnd() * list.length) % list.length];

/** 截图名要洗掉空格与标点，但目录分隔符得留着，否则存证会掉进当前目录。 */
const shotPath = (label: string, where: string, did: string) =>
  `${AUDIT_DIR}/${`stuck-${label}-${where}-${did}`.replace(/[^\w一-龥-]+/g, "-").slice(0, 160)}.png`;

/** 单步执行：超过 5 秒就截图存证并抛错，把卡死在哪一天哪一步钉进报错。 */
async function step<T>(page: Page, did: string, where: () => string, label: string, note: (n: Note) => void, run: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`单步超过 ${STEP_MS}ms`)), STEP_MS);
  });
  try {
    return await Promise.race([run(), timeout]);
  } catch (err) {
    const shot = shotPath(label, where(), did);
    await page.screenshot({ path: shot }).catch(() => undefined);
    // 谁压在最上面：把卡住这一步的那层浮层一并记下来
    const top = await page.evaluate(() => {
      const layers = [...document.querySelectorAll<HTMLElement>("body *")]
        .filter(el => {
          const s = getComputedStyle(el);
          return s.position === "fixed" || +s.zIndex >= 30;
        })
        .filter(el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0)
        .map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}@${getComputedStyle(el).zIndex}`);
      return [...new Set(layers)].slice(0, 12).join(" / ") || "没有浮层";
    }).catch(() => "?");
    const saw = `卡住：${String(err)}｜最上层：${top}｜截图 ${shot}`;
    note({ where: where(), did, saw });
    throw new Error(`${did} · ${where()} · ${saw}`);
  } finally {
    clearTimeout(timer);
  }
}


const visible = async (loc: Locator): Promise<boolean> => (await loc.isVisible().catch(() => false));

/** 按钮中心点是不是真的落在按钮自己身上（不被任何浮层挡住）。 */
const hitBlocker = (loc: Locator): Promise<string | null> =>
  loc.evaluate(el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (r.width === 0 || r.height === 0) return "尺寸为 0";
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return "中心点在视口外";
    const hit = document.elementFromPoint(x, y);
    if (!hit) return "中心点上什么都没有";
    if (hit === el || el.contains(hit) || hit.contains(el)) return null;
    const cls = `${hit.tagName.toLowerCase()}${hit.className ? `.${String(hit.className).split(" ").join(".")}` : ""}`;
    return `被 ${cls} 挡住`;
  }).catch(() => "按钮不在 DOM 里");

/** 一次 DOM 采样取回这一屏要看的所以事情：整季 110 多屏，逐屏省掉十来回通信才跑得完。 */
type Probe = {
  bar: string;
  screen: "intro" | "floor" | "report" | "season";
  coachText: string; coachOk: boolean; coachSkip: boolean;
  story: boolean; request: string;
  go: string | null; goBlock: string | null;
  reportTitle: string;
  /** 屏幕上有没有念出 undefined / 空占位这类缺字痕迹。 */
  defect: string;
  /** 屏幕上有没有把内部字段名（人名拼音、arc: 这类旗子、单独的 _）念给玩家。 */
  rawField: string;
};

/** 内部字段名清单：这些拼音 id 与旗子前缀一旦出现在玩家眼前，就是漏了内部字段。 */
const RAW_TOKENS = [...PEOPLE.map(p => p.id), "arc", "quality", "storylet"];

const probe = (page: Page): Promise<Probe> =>
  page.evaluate(tokens => {
    // fixed 定位的元素 offsetParent 一定是 null，所以可见性只能量盒子自己
    const live = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };
    const shown = (sel: string) => {
      const el = document.querySelector(sel);
      return el && live(el) ? el : null;
    };
    const text = (el: Element | null | undefined) => (el?.textContent ?? "").trim();
    // 中心点是不是真的落在按钮自己身上
    const blockerOf = (el: Element) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (r.width === 0 || r.height === 0) return "尺寸为 0";
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return "中心点在视口外";
      const hit = document.elementFromPoint(x, y);
      if (!hit) return "中心点上什么都没有";
      if (hit === el || el.contains(hit) || hit.contains(el)) return null;
      return `被 ${hit.tagName.toLowerCase()}.${String(hit.className).split(" ").join(".")} 挡住`;
    };
    const bubble = shown(".world-coach");
    // 开门那张「今天的请求」卡（Requests.tsx）
    const layer = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
      .find(el => live(el) && /今天的请求/.test(el.textContent ?? "") && !el.querySelector(".story-choices, .world-verbs, .pc-close"));
    const goEl = shown(".world-report-page:not(.world-recap-page) .report-foot .world-primary") ?? shown(".world-next");
    const screen = shown(".world-intro-screen") ? "intro"
      : shown(".world-recap") ? "season"
      : shown(".world-report-page") ? "report"
      : "floor";
    const scanned = (document.body as HTMLElement).innerText ?? "";
    const peek = (at: number) => scanned.slice(Math.max(0, at - 24), at + 34).replace(/\s+/g, " ");
    return {
      bar: text(document.querySelector(".world-bar b")),
      screen,
      coachText: text(bubble?.querySelector(".wc-text")),
      coachOk: !!bubble?.querySelector(".wc-ok"),
      coachSkip: !!bubble?.querySelector(".wc-skip"),
      story: !!shown(".world-story"),
      request: layer ? text(layer).slice(0, 40) : "",
      go: goEl ? text(goEl) : null,
      goBlock: goEl ? blockerOf(goEl) : null,
      reportTitle: text(document.querySelector(".world-report-page h1")),
      // 缺字：undefined / NaN / 空占位。这类直接算问题。
      defect: (() => {
        for (const re of [/undefined|NaN|\[object [A-Za-z]/, /\{\{[^}]*\}\}|\$\{[^}]*\}|（）|\(\)/]) {
          const m = re.exec(scanned);
          if (m) return peek(m.index);
        }
        return "";
      })(),
      // 内部字段名漏到玩家眼前（人名拼音、arc:/quality: 这类旗子、单独的 _）。另记一条，不拦整季冒烟。
      rawField: (() => {
        for (const re of [/arc:|quality:|flag:|storylet/, /(^|[\s，、：:])_(?=$|[\s：:])/, new RegExp(`\\b(?:${tokens.join("|")})\\b`)]) {
          const m = re.exec(scanned);
          if (m) return peek(m.index);
        }
        return "";
      })(),
    } as Probe;
  }, RAW_TOKENS);

/** 引导气泡：按本次策略要按的那颗；找不到就退而点气泡里第一颗按钮，好让下一步走得下去。 */
const tapCoach = async (page: Page, coach: "know" | "skip"): Promise<void> => {
  const bubble = page.locator(".world-coach").first();
  const button = bubble.locator(coach === "skip" ? ".wc-skip" : ".wc-ok");
  if (await visible(button)) await button.click({ timeout: STEP_MS }).catch(() => undefined);
  else await bubble.evaluate(el => (el.querySelector("button") as HTMLButtonElement | null)?.click()).catch(() => undefined);
  await bubble.waitFor({ state: "hidden", timeout: 1_200 }).catch(() => undefined);
};

/**
 * 开门那张「今天的请求」卡：有能按的「应下」就应下，「应下」被灰掉（小样不够）就按「回绝」，
 * 最后点「知道了」收卡。返回这一屏替玩家做了什么；没有卡返回 null，不等、不猜。
 * 每按一次都重新查 DOM：一次点击就是一次重渲染，行节点会被换掉。
 */
const answerRequestCard = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const live = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const card = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
      .find(el => live(el) && /今天的请求/.test(el.textContent ?? "") && !el.querySelector(".story-choices, .world-verbs, .pc-close"));
    if (!card()) return null;
    const log: string[] = [];
    for (let round = 0; round < 6; round++) {
      const layer = card();
      if (!layer) { log.push("卡自己收掉了"); break; }
      const rows = [...layer.querySelectorAll<HTMLElement>(".req-row")];
      const row = rows.find(r => r.querySelector(".req-yes:not([disabled])")) ?? rows.find(r => r.querySelector(".req-yes"));
      if (!row) { log.push("今天没有当场可应的请求"); break; }
      const who = row.querySelector(".req-by b")?.textContent?.trim() ?? "";
      const yes = row.querySelector<HTMLButtonElement>(".req-yes")!;
      if (!yes.disabled) { yes.click(); log.push(`应下 ${who}`); continue; }
      const no = row.querySelector<HTMLButtonElement>(".req-no");
      if (no) { no.click(); log.push(`「应下」灰着（小样不够），回绝 ${who}`); continue; }
      log.push(`${who} 的请求「应下」按不动又没有「回绝」`);
      break;
    }
    const layer = card();
    if (layer) {
      const closer = layer.querySelector<HTMLButtonElement>(".req-close");
      if (closer) { closer.click(); log.push("点「知道了」收卡"); }
      else log.push("有请求卡但找不到「知道了」");
    }
    return log.join("；");
  }).catch(err => `处理请求卡失败：${String(err)}`);

/** 故事卡：有就选第一个可见选项；只剩「先记下这一幕」时点它。返回这一幕说了什么、我们选了什么。 */
const chooseStory = async (page: Page): Promise<{ text: string; chose: string } | null> => {
  const card = page.locator(".world-story");
  if (!(await visible(card))) return null;
  const text = ((await card.locator(".story-text").first().textContent().catch(() => "")) ?? "").trim();
  const options = card.locator(".story-choices button");
  const first = (await options.count()) ? options.first() : card.locator("button").first();
  const chose = ((await first.textContent().catch(() => "")) ?? "").trim();
  await first.click({ timeout: STEP_MS });
  await card.waitFor({ state: "hidden", timeout: STEP_MS }).catch(() => undefined);
  return { text: text.slice(0, 70), chose: chose.slice(0, 30) };
};

/** 楼层上的人会走动（.wf-actor 有 0.9s 的 left/top 过渡），一动定位子就不是刚才量到的那一点。 */
type Actor = { pid: string; name: string };

/** 等站位停下来（最多约 1.6s）。停下返回空数组；一直动就返回还在动的那几个名字。 */
const settleActors = (page: Page): Promise<string[]> =>
  page.evaluate(async () => {
    const sample = () => [...document.querySelectorAll<HTMLElement>(".wf-actor")].map(el => {
      const r = el.getBoundingClientRect();
      return `${el.querySelector(".wf-tag")?.textContent?.trim() ?? el.dataset.pid ?? "?"}@${r.left.toFixed(0)},${r.top.toFixed(0)}`;
    });
    let prev = sample();
    for (let i = 0; i < 10; i++) {
      await new Promise(res => setTimeout(res, 160));
      const cur = sample();
      if (cur.length === prev.length && cur.every((c, j) => c === prev[j])) return [];
      prev = cur;
    }
    return [...new Set(prev.map(s => s.split("@")[0]))];
  }).catch(() => [] as string[]);

/** 这一屏点得到的人：完全在视口内、中心点没有被别的东西盖住。 */
const reachableActors = (page: Page): Promise<Actor[]> =>
  page.evaluate(() => {
    const out: Actor[] = [];
    for (const el of [...document.querySelectorAll<HTMLElement>(".wf-actor")]) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < 0 || r.right > window.innerWidth || r.top < 0 || r.bottom > window.innerHeight) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit) continue;
      if (hit !== el && !el.contains(hit) && !hit.contains(el)) continue;
      out.push({ pid: el.dataset.pid ?? "", name: el.querySelector(".wf-tag")?.textContent?.trim() ?? "" });
    }
    return out;
  });

/**
 * 由 DOM 自己按下这个人：位置刚变过时 Playwright 会一直等"稳定"而白等 5 秒。
 * 点之前先确认中心点没有被浮层盖住——被盖住就是真问题，记下来，不代劳硬点。
 */
const tapActor = (page: Page, actor: Actor): Promise<string | null> =>
  page.evaluate(([pid, name]) => {
    const el = [...document.querySelectorAll<HTMLElement>(".wf-actor")].find(x => x.dataset.pid === pid);
    if (!el) return "人不在场了";
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
      return `${name || "这个人"}的中心点被 ${hit.tagName.toLowerCase()}.${String(hit.className).split(" ")[0]} 盖住`;
    }
    el.click();
    return null;
  }, [actor.pid, actor.name] as [string, string]).catch(err => `点${actor.name}失败：${String(err)}`);

const isPairVerb = (word: string) => ["介绍认识", "打圆场", "托", "说件私事"].some(v => word.startsWith(v));

/** 做了一个动作：note 是"做了什么"，result 是她那边念到什么，problem 是"这一步本来该做得成却做不成"。 */
type ActionResult = { note: string; result?: string; problem?: string };

/** 动作之后场上念的那一句（吐司 / 故事卡正文），用来记下"这一步的结果"。 */
const readOutcome = async (page: Page): Promise<string> => {
  const toast = page.locator(".world-toast").first();
  await toast.waitFor({ state: "visible", timeout: 1_200 }).catch(() => undefined);
  const said = (await toast.textContent().catch(() => ""))?.trim() ?? "";
  if (said) return said.slice(0, 80);
  const card = page.locator(".world-story .story-text").first();
  if (await visible(card)) return `故事：${((await card.textContent().catch(() => "")) ?? "").trim().slice(0, 60)}`;
  return "";
};

async function doOneAction(page: Page, rnd: () => number, wantServe: boolean): Promise<ActionResult> {
  const actors = await reachableActors(page);
  if (!actors.length) return { note: "", problem: "这一屏一个在场的人都点不到" };
  const picked: Actor[] = [];
  let pool = [...actors];
  let blocker: string | null = null;
  let opened = false;
  const drawer = page.locator(".world-drawer");
  while (pool.length && picked.length < 3) {
    const actor = pick(pool, rnd);
    pool = pool.filter(a => a.pid !== actor.pid);
    picked.push(actor);
    blocker = await tapActor(page, actor);
    if (blocker) continue;
    await drawer.waitFor({ state: "visible", timeout: 1_500 }).catch(() => undefined);
    if (await visible(drawer)) { opened = true; break; }
  }
  if (!opened) return { note: "", problem: `${picked.map(p => p.name).join("、")}：点了人，人物卡与动作排都没出来${blocker ? `（${blocker}）` : ""}` };
  const actor = picked[picked.length - 1];

  const verbs = drawer.locator(".world-verbs button");
  const words = await verbs.allTextContents().catch(() => [] as string[]);
  const labelled = words
    .map(w => w.replace(/\s*\d+\s*精力\s*/, "").replace(/\s*·\s*再点一人\s*/, "").trim())
    .map((w, i) => ({ w, i }))
    .filter(x => x.w);
  if (!labelled.length) {
    const emptyText = (await drawer.locator(".verbs-empty").textContent().catch(() => ""))?.trim() ?? "";
    return { note: `${actor.name}这会儿没动作可做${emptyText ? `（${emptyText}）` : ""}` };
  }

  const serve = labelled.find(x => wantServe && x.w === "接待");
  const singles = labelled.filter(x => !isPairVerb(x.w));
  const target = serve ?? pick(singles.length ? singles : labelled, rnd);
  const word = target.w;
  await verbs.nth(target.i).click({ timeout: STEP_MS });

  if (word === "接待") {
    const panel = page.locator(".world-serve");
    if (!(await visible(panel))) return { note: "", problem: `${actor.name}：点「接待」之后接待面板没出来` };
    const products = panel.locator(".serve-products button");
    if ((await products.count()) === 0) return { note: "", problem: `${actor.name}：接待面板里没有货可选` };
    await products.first().click({ timeout: STEP_MS });
    const commit = panel.locator(".serve-commit");
    await commit.waitFor({ state: "visible", timeout: STEP_MS }).catch(() => undefined);
    if (await commit.isDisabled().catch(() => true)) return { note: "", problem: `${actor.name}：选完第一支货，「开给」还是按不动` };
    await commit.click({ timeout: STEP_MS });
    return { note: `对${actor.name}接待 · 第一支货开给她` };
  }

  if (isPairVerb(word)) {
    const pair = page.locator(".world-pick");
    if (!(await visible(pair))) return { note: "", problem: `${actor.name}：点「${word}」之后没有出选人` };
    const targets = pair.locator(".pick-targets button:not(.pick-cancel)");
    if ((await targets.count()) === 0) {
      await pair.locator(".pick-cancel").click({ timeout: STEP_MS }).catch(() => undefined);
      return { note: `${actor.name}的「${word}」没有可选的对象` };
    }
    await targets.first().click({ timeout: STEP_MS });
    await pair.waitFor({ state: "hidden", timeout: STEP_MS }).catch(() => undefined);
    return { note: `对${actor.name}做「${word}」` };
  }

  return { note: `对${actor.name}做「${word}」` };
}

const closeDrawer = async (page: Page): Promise<void> => {
  const closer = page.locator(".pc-close");
  if (await visible(closer)) await closer.click({ timeout: STEP_MS }).catch(() => undefined);
};

/** 一局冒烟的全部现场：页、策略、记录本和走到哪了。 */
type Session = {
  page: Page; coach: "know" | "skip"; label: string;
  notes: Note[]; actions: string[]; errors: string[]; noise: string[];
  /** 内部字段名漏在玩家眼前的那几行：另记一份，交给主控定怎么改。 */
  rawWords: Set<string>;
  state: { season: number; day: number; slot: number; screen: string };
  rnd: () => number;
  steps: number; startedAt: number;
  where: () => string;
  note: (n: Note) => void;
  writeReport: () => void;
};

/**
 * 一段连续游玩：每屏先收浮层（引导 / 故事卡 / 请求卡），再点人做动作，再走下一时段。
 * stop 在每个时段开始时判；第 1 季用它停在散场页，第 2 季用它玩满三天。
 */
async function playSlots(s: Session, stop: (p: Probe) => boolean, maxSteps: number): Promise<Probe | null> {
  const { page, coach, note, actions } = s;
  let skippedOnce = false;

  /** 一层层收掉压在这一屏上面的东西：引导、故事卡、请求卡。返回每收到一件事。 */
  async function clearOverlays(): Promise<string[]> {
    const seen: string[] = [];
    for (let round = 0; round < 5; round++) {
      const q = await probe(page);
      if (q.coachText) {
        seen.push(`引导：${q.coachText}`);
        if (!q[coach === "skip" ? "coachSkip" : "coachOk"]) {
          note({ where: s.where(), did: "引导", saw: `${q.coachText}：气泡里没有${coach === "skip" ? "「跳过引导」" : "「知道了」"}按钮` });
        } else if (coach === "skip" && skippedOnce) {
          note({ where: s.where(), did: "引导", saw: `开局点过「跳过引导」之后又冒出一句：${q.coachText}` });
        }
        skippedOnce = true;
        await tapCoach(page, coach);
        continue;
      }
      if (q.story) {
        const picked = await chooseStory(page);
        if (!picked) break;
        seen.push(`故事卡：${picked.text}｜选了「${picked.chose}」`);
        continue;
      }
      if (q.request) {
        const done = await answerRequestCard(page);
        seen.push(`请求卡：${done ?? q.request}`);
        if (done?.includes("找不到") || done?.includes("按不动")) note({ where: s.where(), did: "请求卡", saw: done });
        continue;
      }
      break;
    }
    return seen;
  }

  for (let guard = 0; guard < maxSteps; guard++) {
    const p = await step(page, "看这一屏", s.where, s.label, note, () => probe(page));
    const hit = /第 (\d+) 季 · 第 (\d+) 天 · (上午|午后|傍晚|晚高峰)/.exec(p.bar);
    if (hit) {
      s.state.season = Number(hit[1]);
      s.state.day = Number(hit[2]);
      s.state.slot = SLOT_WORDS.indexOf(hit[3]);
    }
    s.state.screen = p.screen;
    s.steps++;
    if (p.defect) note({ where: s.where(), did: "读这一屏", saw: `文案缺字嫌疑：…${p.defect}…` });
    if (p.rawField) s.rawWords.add(`${p.screen} · ${p.rawField}`);
    if (stop(p)) return p;

    if (p.screen === "intro") {
      await step(page, "开这一季", s.where, s.label, note, () =>
        page.getByRole("button", { name: /开这一季|继续/ }).first().click({ timeout: STEP_MS }));
      continue;
    }

    // 开头：引导、故事卡与请求卡先收掉，别让它仨挡住后面的操作。
    const before = await step(page, "收开头的浮层", s.where, s.label, note, clearOverlays);
    before.forEach(x => actions.push(`${s.where()} ${x}`));

    if (p.screen === "report") {
      console.log(`〔${s.label}〕${s.where()} → 小结页（${p.bar}）`);
      if (s.state.day === 1 && s.state.season === 1) await page.screenshot({ path: `${AUDIT_DIR}/report-day1-${coach}.png` });
      if (!p.reportTitle) note({ where: s.where(), did: "日小结", saw: "小结页没有标题" });
      if (p.goBlock) note({ where: s.where(), did: `日小结「${p.go}」`, saw: p.goBlock });
      await step(page, "进入下一天", s.where, s.label, note, () =>
        page.locator(".report-foot .world-primary").click({ timeout: STEP_MS }));
      continue;
    }

    // 楼层：先处理故事卡，再点在场的人做一次动作（约四成时段多做一次）。
    const times = s.rnd() < 0.4 ? 2 : 1;
    const moving = await step(page, "等走动的人停下", s.where, s.label, note, () => settleActors(page));
    if (moving.length) actions.push(`${s.where()} 到点还在走动：${moving.slice(0, 8).join("、")}`);
    for (let i = 0; i < times; i++) {
      const did = `点人做动作 第${i + 1}次`;
      const done = await step(page, did, s.where, s.label, note, async () => {
        const r = await doOneAction(page, s.rnd, i === 0);
        return r.problem ? r : { ...r, result: await readOutcome(page) };
      });
      if (done.problem) note({ where: s.where(), did, saw: done.problem });
      if (done.note) actions.push(`${s.where()} ${done.note}${done.result ? ` → ${done.result}` : ""}`);
      await closeDrawer(page);
    }

    // 动作做完可能又引出故事卡、请求卡或一句新引导。
    const after = await step(page, "收动作之后的浮层", s.where, s.label, note, clearOverlays);
    after.forEach(x => actions.push(`${s.where()} ${x}`));

    const q = await step(page, "看「下一时段」能不能按", s.where, s.label, note, () => probe(page));
    if (q.goBlock) note({ where: s.where(), did: `点「${q.go}」之前`, saw: q.goBlock });
    await step(page, "下一时段", s.where, s.label, note, () => page.locator(".world-next").click({ timeout: STEP_MS }));
    if (s.state.slot === SLOTS_PER_DAY - 1) s.state.slot = 0;

    if (s.state.season === 1 && s.state.day === 1 && s.steps === 1) await page.screenshot({ path: `${AUDIT_DIR}/floor-day1-${coach}.png` });
    if (s.state.season === 1 && s.state.day === 14 && s.state.slot === 1 && s.steps % 4 === 2) await page.screenshot({ path: `${AUDIT_DIR}/floor-day14-${coach}.png` });
  }
  return null;
}

/** 开局落进存档的世界种子：整季内容跟着它确定，打出来好复现。 */
const readWorldSeed = (page: Page): Promise<string> =>
  page.evaluate(key => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as { world?: { seed?: string } }).world?.seed ?? "?" : "?";
    } catch { return "?"; }
  }, SAVE_KEY);

/** 新档一路玩到散场页：返回现场（还没做季末页断言，交给调用方）。 */
async function playSeason(page: Page, coach: "know" | "skip"): Promise<Session> {
  const label = coach === "know" ? "知道了" : "跳过引导";
  const s: Session = {
    page, coach, label,
    notes: [], actions: [], errors: [], noise: [], rawWords: new Set<string>(),
    state: { season: 1, day: 1, slot: 0, screen: "intro" },
    rnd: makeRng(SEED + (coach === "know" ? 1 : 2)),
    steps: 0, startedAt: Date.now(),
    where: () => `${s.state.screen} · 第 ${s.state.season} 季第 ${s.state.day} 天 ${SLOT_WORDS[s.state.slot] ?? s.state.slot}`,
    note: n => { s.notes.push(n); s.writeReport(); },
    writeReport: () => writeFileSync(`${AUDIT_DIR}/report-${coach}.json`, JSON.stringify({
      coach, day: s.state.day, slot: s.state.slot, screen: s.state.screen,
      elapsedMs: Date.now() - s.startedAt, steps: s.steps,
      actions: s.actions, notes: s.notes, errors: s.errors, noise: s.noise, rawFields: [...s.rawWords],
    }, null, 2)),
  };

  page.on("console", msg => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    const url = msg.location()?.url ?? "";
    // worktree 与原仓库共用 node_modules，Vite 的 server.fs.allow 会把 @fontsource 的 woff2 挡成 403。
    // 这是跑测试的机器环境，不是游戏里的报错，但仍单记一行，别悄悄吞掉。
    if (/Failed to load resource/.test(text) && /font|woff/i.test(`${url} ${text}`)) s.noise.push(`${s.where()} · 字体资源加载失败（环境）：${url || text}`);
    else s.errors.push(`${s.where()} · console.error：${text}${url ? ` @${url}` : ""}`);
  });
  page.on("pageerror", err => s.errors.push(`${s.where()} · pageerror：${err.message}`));

  // 新档开局：世界档、引导已读、跨季档案三把钥匙都清掉。
  await page.addInitScript(keys => {
    try { for (const k of keys) window.localStorage.removeItem(k); } catch { /* 存不进就算了 */ }
  }, [SAVE_KEY, COACH_KEY, WORLD_PROGRESS_KEY]);
  // 开局那颗骰子：Date.now 固定、Math.random 换成同种子的线性同余，世界种子跟着定下来，整季内容可复现。
  await page.addInitScript(([now, seed]) => {
    Date.now = () => now;
    let r = seed >>> 0;
    Math.random = () => {
      r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
      return r / 4294967296;
    };
  }, [FIXED_NOW, SEED] as [number, number]);

  const seed = (await (async () => {
    await page.goto("/?mode=world");
    await expect(page.locator(".world-intro-screen")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "开这一季" }).click({ timeout: 15_000 });
    await page.locator(".world-next").waitFor({ state: "visible", timeout: 15_000 });
    return readWorldSeed(page);
  })());
  console.log(`〔${label}〕开局世界种子：${seed}`);

  await playSlots(s, p => p.screen === "season", MAX_STEPS);
  s.writeReport();
  return s;
}

test.describe.configure({ mode: "serial" });

for (const coach of ["know", "skip"] as const) {
  test.describe(`人情场整季冒烟 · ${coach === "know" ? "全程点知道了" : "开局跳过引导"}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, actionTimeout: STEP_MS });
    test.setTimeout(900_000);

    test(`从新档玩到第 ${SEASON_DAYS} 天散场，过季末回顾页，再进第 2 季玩 ${S2_DAYS} 天`, async ({ page }) => {
      const s = await playSeason(page, coach);
      const elapsed = Date.now() - s.startedAt;
      console.log(`〔${s.label}〕整季用时 ${(elapsed / 1000).toFixed(1)}s，走了 ${s.steps} 步，记下 ${s.actions.length} 行流水、${s.notes.length} 条问题`);
      if (s.noise.length) console.log(`〔${s.label}〕环境噪音（不计为游戏报错）：${s.noise.length} 条（worktree 共用 node_modules 的字体 403），详见 report-${coach}.json`);
      if (s.rawWords.size) console.log(`〔${s.label}〕内部字段名漏在眼前 ${s.rawWords.size} 处：\n${[...s.rawWords].map(x => `  · ${x}`).join("\n")}`);
      console.log(`〔${s.label}〕逐时段明细与问题清单：${AUDIT_DIR}/report-${coach}.json`);
      expect(s.state.screen, `${s.label}：没走到第 ${SEASON_DAYS} 天之后的季末页，停在 ${s.where()}`).toBe("season");
      expect(s.errors, `控制台报错：\n${s.errors.join("\n")}`).toEqual([]);

      // —— 季末回顾页：结局当标题、有高光时间轴、三颗按钮都在脚下 ——
      const recap = page.locator(".world-recap").first();
      await expect(recap).toBeVisible();
      const endingTitle = (await recap.locator("h1").first().textContent().catch(() => ""))?.trim() ?? "";
      const endingTitles = ENDINGS.map(e => e.title);
      expect(endingTitles, `季末页 h1「${endingTitle}」不是 ENDINGS 里的任何一档结局`).toContain(endingTitle);
      await expect(recap).toContainText("这一季的高光");
      await expect(page.locator(".report-eyebrow")).toContainText(`${SEASON_DAYS} 天散场`);
      await page.screenshot({ path: `${AUDIT_DIR}/season-end-${coach}.png`, fullPage: false });

      for (const name of [/进入第 2 季/, /档案/, /重开一季/] as const) {
        const btn = page.getByRole("button", { name }).first();
        await expect(btn, `季末页缺「${name}」这颗按钮`).toBeVisible();
        const blocker = await hitBlocker(btn);
        expect(blocker, `季末页「${name}」按不到：${blocker}`).toBeNull();
      }

      // —— 走完的线：念落点标题，不许把内部字段名摊给玩家 ——
      const arcsBlock = page.locator(".recap-block", { hasText: "走完的线" });
      const arcsText = (await arcsBlock.innerText().catch(() => "")).replace(/\s+/g, " ");
      expect(arcsText, "季末页没有「走完的线」这一块").not.toBe("");
      expect(arcsText, `走完的线念出了内部字段：${arcsText}`).not.toMatch(/end/);
      expect(arcsText, `走完的线念出了「· 数字」的落点编号：${arcsText}`).not.toMatch(/·\s*\d/);
      expect(arcsText, `走完的线念出了裸下划线：${arcsText}`).not.toMatch(/_/);

      // —— 档案能打开、能返回 ——
      const progressOf = () => page.evaluate(key => {
        try {
          const p = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { seen?: unknown[]; endings?: unknown[] };
          return { seen: p.seen?.length ?? 0, endings: p.endings?.length ?? 0 };
        } catch { return { seen: 0, endings: 0 }; }
      }, WORLD_PROGRESS_KEY);
      const beforeSeason2 = await progressOf();
      expect(beforeSeason2.seen, "玩完整一季之后，档案里一个人都没见过").toBeGreaterThan(0);
      await page.getByRole("button", { name: "档案" }).click({ timeout: STEP_MS });
      await expect(page.locator(".world-archive-page")).toBeVisible();
      await page.screenshot({ path: `${AUDIT_DIR}/season-archive-${coach}.png` });
      await page.locator(".archive-back").click({ timeout: STEP_MS });
      await expect(page.locator(".world-archive-page")).toHaveCount(0);
      await expect(recap).toBeVisible();

      // —— 进入第 2 季 ——
      await page.getByRole("button", { name: /进入第 2 季/ }).click({ timeout: STEP_MS });
      await expect(page.locator(".world-bar b")).toContainText("第 2 季 · 第 1 天", { timeout: 15_000 });
      await page.screenshot({ path: `${AUDIT_DIR}/season-2-start-${coach}.png` });

      // —— 第 2 季开局后，第 1 季攒下的档案只增不减 ——
      const afterSeason2 = await progressOf();
      expect(afterSeason2.endings, "这一季的散场没进档案").toBeGreaterThan(0);
      expect(afterSeason2.seen, `进第 2 季之后档案里的人从 ${beforeSeason2.seen} 位变成 ${afterSeason2.seen} 位`).toBeGreaterThanOrEqual(beforeSeason2.seen);

      // —— 第 2 季再玩三天：跨季内容（节日卡、同事线卡）要开得出门，一路不许报错 ——
      await playSlots(s, () => s.state.season >= 2 && s.state.day > S2_DAYS, MAX_STEPS_S2);
      s.writeReport();
      await page.screenshot({ path: `${AUDIT_DIR}/season-2-day${S2_DAYS}-${coach}.png` });

      const s2Fired = await page.evaluate(key => {
        try {
          const raw = window.localStorage.getItem(key);
          const fired = (raw ? (JSON.parse(raw) as { world?: { fired?: Record<string, number> } }).world?.fired : {}) ?? {};
          return Object.keys(fired).filter(id => /^(s2-|arc-(tangke|roman|fangmin|qiaowan))/.test(id));
        } catch { return []; }
      }, SAVE_KEY);
      console.log(`〔${s.label}〕第 2 季前 ${S2_DAYS} 天开出来的跨季卡：${s2Fired.length ? s2Fired.join("、") : "一张都没有"}`);
      expect(s2Fired.length, `第 2 季前 ${S2_DAYS} 天一张跨季卡（s2-* / 唐可罗曼范敏巧婉的线）都没开出来`).toBeGreaterThan(0);

      expect(s.errors, `第 2 季报错：\n${s.errors.join("\n")}`).toEqual([]);
      expect(s.notes, `一路上记下的问题：\n${s.notes.map(n => `${n.where} · ${n.did} → ${n.saw}`).join("\n")}`).toEqual([]);
    });
  });
}

/** 把世界状态直接落到收季那一屏（ui.screen = "season"），不用玩完整一季就能稳定复现季末回顾页。 */
const openSeasonScreen = async (page: Page, world: World) => {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
    [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "season" } })] as [string, string]);
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
    [COACH_KEY, JSON.stringify(["open", "card", "action", "story", "poach", "web", "report"])] as [string, string]);
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click({ timeout: 10_000 });
  await expect(page.locator(".world-recap")).toBeVisible({ timeout: 10_000 });
};

const EMPTY_LEAGUE: World = { ...newWorld("season-shot", PEOPLE), day: SEASON_DAYS + 1, slot: 3 };
/** 个人线走过两段的 arc:<人> 与三段的 arc:<人>:<阶段>，季末页两种都会念出来。 */
const RAW_ARCS: World = {
  ...newWorld("season-raw", PEOPLE),
  day: SEASON_DAYS + 1, slot: 3, money: 12_000,
  qualities: { "arc:suman": 3, "arc:luyao": 3, "arc:shen:start": 2, "arc:shen:end": 1 },
};
/** 长标题那一档：老客留在这三米（7 字标题 + 32 字正文 + 有人有线），专挑窄屏排版的底线。 */
const LONG_LANDING: World = {
  ...newWorld("season-long", PEOPLE),
  day: SEASON_DAYS + 1, slot: 3, money: 20_000, standing: 52, compliance: 35,
  opinion: { suman: 60, shen: 45, mei: -40 },
  qualities: { "arc:shen:start": 2, "arc:mei:end": 1 },
};

test.describe("季末回顾页", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.setTimeout(60_000);

  test("结局当标题，高光、三本账与三颗按钮都在", async ({ page }) => {
    await openSeasonScreen(page, EMPTY_LEAGUE);
    const ending = seasonEnding(EMPTY_LEAGUE, PEOPLE);
    await page.screenshot({ path: `${AUDIT_DIR}/season-ending-title.png` });
    const recap = page.locator(".world-recap").first();
    await expect(recap.locator("h1")).toHaveText(ending.title);
    await expect(recap.locator(".recap-ending-body")).toHaveText(ending.body);
    await expect(recap).toContainText("这一季的高光");
    await expect(recap).toContainText("三本账");
    for (const name of [/进入第 2 季/, /档案/, /重开一季/]) {
      await expect(page.getByRole("button", { name }).first()).toBeVisible();
    }
  });

  test("走完的线按落点标题念，不许把内部字段名摊给玩家", async ({ page }) => {
    // 上一轮整季冒烟在第 28 天散场页复现过：「几条线走到哪里了」念成「_ ：suman · 3，luyao · 3…」和「苏蔓 ：end · 1」。
    // 现在季末回顾页由 recap.ts 的 arcLandings 出标题；这一条从 test.fail 转成正常断言，防回退。
    await openSeasonScreen(page, RAW_ARCS);
    await page.screenshot({ path: `${AUDIT_DIR}/season-raw-fields.png` });
    const arcs = page.locator(".recap-block", { hasText: "走完的线" });
    const block = (await arcs.innerText()).replace(/\s+/g, " ");
    expect(block, "走完的线这一块是空的（RAW_ARCS 里沈薇走到了第 1 档）").not.toBe("");
    expect(block).not.toMatch(/end/);
    expect(block).not.toMatch(/·\s*\d/);
    expect(block).not.toMatch(/_/);
    // 整页也认不回来内部字段：旗子前缀与人名拼音一律不许露面
    const body = (await page.locator(".world-recap").innerText()).replace(/\s+/g, " ");
    expect(body).not.toMatch(/arc:|quality:|flag:|storylet/);
    for (const id of ["suman", "shen", "luyao", "anjie"]) {
      expect(body, `季末回顾页念出了人名拼音 ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
  });

  for (const [width, height] of [[390, 844], [320, 568]] as const) {
    for (const [name, world] of [["空手散场", EMPTY_LEAGUE], ["长标题散场", LONG_LANDING]] as const) {
      test.describe(`季末回顾页排版 · ${width}×${height} · ${name}`, () => {
        test.use({ viewport: { width, height } });

        test("不横向溢出、脚上三颗按钮 ≥44px 且点得中", async ({ page }) => {
          await openSeasonScreen(page, world);
          const ending = seasonEnding(world, PEOPLE);
          const title = page.locator(".world-recap h1");
          await expect(title).toHaveText(ending.title);
          await expect(page.locator(".recap-ending-body")).toHaveText(ending.body);

          // 横向溢出
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow, "季末回顾页横向溢出").toBeLessThanOrEqual(1);
          const clipped = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".world-recap *")]
            .filter(el => el.getBoundingClientRect().width > 0)
            .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
            .map(el => `${el.tagName.toLowerCase()}.${el.className}`));
          expect(clipped, "有内容压过右边界").toEqual([]);

          // 脚上三颗按钮：够大、在视口里、中心点落在自己身上
          for (const label of [/进入第 2 季/, /档案/, /重开一季/]) {
            const btn = page.getByRole("button", { name: label }).first();
            await expect(btn).toBeVisible();
            const size = await btn.evaluate(el => {
              const r = el.getBoundingClientRect();
              return { h: r.height, top: r.top, bottom: r.bottom, inView: r.top >= 0 && r.bottom <= window.innerHeight };
            });
            expect(size.h, `「${label}」这颗按钮高度不足 44px`).toBeGreaterThanOrEqual(44);
            expect(size.inView, `「${label}」这颗按钮不在视口里`).toBe(true);
            const blocker = await hitBlocker(btn);
            expect(blocker, `「${label}」被挡住：${blocker}`).toBeNull();
          }

          await page.screenshot({ path: `${AUDIT_DIR}/season-recap-${width}x${height}-${name}.png` });

          // 进第 2 季那一脚按得下去
          await page.getByRole("button", { name: /进入第 2 季/ }).click({ timeout: 10_000 });
          await expect(page.locator(".world-bar b")).toContainText("第 2 季 · 第 1 天", { timeout: 10_000 });
        });
      });
    }
  }
});

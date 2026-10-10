// 人情场结局：每条都能造出来，条件按 rank 取先到的那条，rank 是全序。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ENDINGS, rank, seasonEnding } from "../src/world/ending.ts";
import { newWorld } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/people.ts";
import type { World } from "../src/world/types.ts";

const base = (): World => newWorld("ending", PEOPLE);

const at = (partial: Partial<World>): World => ({ ...base(), ...partial });

/** 主线那四句认的是落点变动那一季，而记号是 setQuality 写落点那一刻钉的（见 world-engine.test.ts）。
 *  夹具是手工拼的盘，所以这一格得自己带上：漏带就是「加记号之前的旧档」，主线那一句不念。 */
const landedIn = (season: number, landing: number, extra: Record<string, number> = {}): Partial<World> => ({
  season,
  qualities: { "mainline:act": 4, "thread:return-slip": landing, "thread:return-slip:landed": season, ...extra },
});

test("结局至少 8 个，rank 两两不同，排出来是全序", () => {
  assert.ok(ENDINGS.length >= 8);
  assert.equal(new Set(ENDINGS.map(e => e.id)).size, ENDINGS.length);
  const ranks = ENDINGS.map(e => rank(e.id));
  assert.equal(new Set(ranks).size, ranks.length);
  for (let i = 0; i < ranks.length; i++) {
    assert.equal(ranks[i], i + 1, ENDINGS[i]?.id);
    assert.ok(ENDINGS[i]?.title && ENDINGS[i]?.body);
  }
  for (let i = 0; i < ranks.length; i++) {
    for (let j = i + 1; j < ranks.length; j++) {
      assert.ok(ranks[i]! < ranks[j]!, `${ENDINGS[i]?.id} 与 ${ENDINGS[j]?.id} 分不出好坏`);
    }
  }
  assert.throws(() => rank("no-such-ending"));
});

test("每个结局都能构造出来，更好的条件优先", () => {
  const cases: Array<[string, World]> = [
    // 主线第 4 幕那四句：落点代号见 storylets-mainline.ts（12 写自己 / 13 交给下一任 /
    // 14 进区域总表 / 15 摘下来 / 16 她填的 / 17 谁也不写）。
    ["page-carried", at({
      compliance: 50, standing: 40, money: 12000,
      ...landedIn(1, 12, { "arc:peilan:end": 1 }),
    })],
    ["row-is-yours", at({
      compliance: 55, standing: 50, money: 12000,
      ...landedIn(1, 12),
    })],
    ["row-in-total", at({
      compliance: 45, standing: 40, money: 12000,
      ...landedIn(1, 14),
    })],
    ["row-still-open", at({
      compliance: 30, standing: 36, money: 12000,
      ...landedIn(1, 17),
    })],
    ["both-kept", at({
      compliance: 50, standing: 60, money: 20000,
      qualities: { "arc:shen:end": 1, "arc:anjie:end": 1 },
      opinion: { shen: 20, anjie: 20 },
    })],
    ["names-stay", at({
      compliance: 40, standing: 42, money: 8000,
      qualities: { "arc:tangke:end": 2, "arc:suman:end": 1 },
      opinion: { suman: 20, tangke: 5 },
    })],
    ["own-sentence", at({
      compliance: 45, standing: 46, money: 8000,
      qualities: { "arc:qiaowan:end": 1, "arc:roman:end": 1, "arc:shen:end": 4 },
      opinion: { qiaowan: 10, roman: 10, shen: 10 },
    })],
    ["file-and-sheet", at({
      compliance: 45, standing: 46, money: 9000,
      qualities: { "arc:fangmin:end": 1, "arc:roman:end": 2, "arc:shen:end": 4, "arc:anjie:end": 4 },
      opinion: { fangmin: 15, roman: 5 },
    })],
    ["folder-follows", at({
      compliance: 70, standing: 65, money: 35000,
      opinion: { fangmin: 50 },
    })],
    ["speaks-first", at({
      compliance: 50, standing: 60, money: 9000,
      qualities: { "arc:luyao:end": 1 },
      opinion: { luyao: 20 },
    })],
    ["team-stays", at({
      compliance: 50, standing: 46, money: 3000,
      qualities: { "arc:shen:end": 1 },
      opinion: { shen: 20 },
    })],
    ["still-named", at({
      compliance: 50, standing: 46, money: 3000,
      qualities: { "arc:anjie:end": 1 },
      opinion: { anjie: 20 },
    })],
    ["books-hold", at({
      compliance: 55, standing: 64, money: 45000,
      opinion: { mei: 45, zhou: 42 },
    })],
    ["regulars-stay", at({
      compliance: 52, standing: 50, money: 6000,
      opinion: { suman: 48, roman: 60, mei: 20 },
    })],
    ["ledger-empty", at({
      compliance: 0, standing: 36, money: 28000,
      opinion: { shen: -40, mei: -36 },
    })],
    ["nobody-left", at({
      compliance: 50, standing: 52, money: 2000,
      opinion: { mei: 10 },
    })],
    ["counter-empty", at({
      compliance: 0, standing: 20, money: 0,
      opinion: { shen: -40, mei: -40, anjie: -35, zhou: -32 },
    })],
  ];

  assert.equal(cases.length, ENDINGS.length);
  for (const [id, world] of cases) {
    const got = seasonEnding(world, PEOPLE);
    assert.equal(got.id, id, got.body);
    assert.equal(got.title, ENDINGS.find(e => e.id === id)?.title);
    assert.ok(got.body.length > 0);
  }

  const bothAndFolder = at({
    compliance: 70, standing: 65, money: 35000,
    qualities: { "arc:shen:end": 1, "arc:anjie:end": 1 },
    opinion: { shen: 20, anjie: 20, fangmin: 50 },
  });
  const top = seasonEnding(bothAndFolder, PEOPLE);
  assert.equal(top.id, "both-kept");
  assert.ok(rank(top.id) < rank("names-stay"));
  assert.ok(rank("names-stay") < rank("folder-follows"));

  const bothAndNames = at({
    compliance: 50, standing: 60, money: 20000,
    qualities: { "arc:shen:end": 1, "arc:anjie:end": 1, "arc:tangke:end": 2, "arc:suman:end": 1 },
    opinion: { shen: 20, anjie: 20, suman: 20 },
  });
  assert.equal(seasonEnding(bothAndNames, PEOPLE).id, "both-kept");

  const teamAndBooks = at({
    compliance: 55, standing: 64, money: 45000,
    qualities: { "arc:shen:end": 1 },
    opinion: { shen: 20, mei: 45, zhou: 42 },
  });
  assert.equal(seasonEnding(teamAndBooks, PEOPLE).id, "team-stays");
  assert.ok(rank("team-stays") < rank("books-hold"));

  const pushedButNamed = at({
    compliance: 0, standing: 30, money: 30000,
    qualities: { "arc:shen:end": 1, "arc:anjie:end": 1 },
    opinion: { shen: 20, anjie: 20 },
  });
  assert.equal(seasonEnding(pushedButNamed, PEOPLE).id, "ledger-empty");
  assert.ok(rank("ledger-empty") > rank("both-kept"));
});

test("四季的故事讲完那一句盖过旧十三句，而没走到第 4 幕的一律不受影响", () => {
  // 同一副牌同时符合两句：认目录里在前的那句。这条钉的是「主线收束」确实比单项人际成绩更靠前，
  // 以及新增那四句的门槛带 act >= 4 —— 门槛漏写，前两季的牌就会被「那一栏还是空的」念一句它没做过的话。
  const signedAndKept = at({
    compliance: 60, standing: 60, money: 20000,
    ...landedIn(1, 12, { "arc:shen:end": 1, "arc:anjie:end": 1 }),
    opinion: { shen: 20, anjie: 20 },
  });
  assert.equal(seasonEnding(signedAndKept, PEOPLE).id, "row-is-yours");
  assert.ok(rank("row-is-yours") < rank("both-kept"));

  // 同一副牌只把幕号从 4 压回 3（第 3 幕收了尾那一档）：就该落回旧十三句。
  // 认的是那四句门槛里的 act >= 4 —— 门槛漏写，一句「那一栏今年还是空的」就能念到没跑完四季的人头上。
  const sameButActThree = { ...signedAndKept, qualities: { ...signedAndKept.qualities, "mainline:act": 3 } };
  assert.equal(seasonEnding(sameButActThree, PEOPLE).id, "both-kept", "幕号压回 3 就不该走主线那四句");

  // 落点 12~17 只有 13/15/16/17 属于「那一栏还是空的」那一族；12 走前两句，14 走第三句。
  for (const landing of [13, 15, 16, 17]) {
    const opened = at({
      compliance: 40, standing: 40, money: 12000,
      ...landedIn(1, landing),
    });
    assert.equal(seasonEnding(opened, PEOPLE).id, "row-still-open", `落点 ${landing} 该念「那一栏今年还是空的」`);
  }
  // 台账见底的四季不认这一句：故事讲完不等于这一季没塌。
  const openedButEmpty = at({
    compliance: 5, standing: 10, money: 20000,
    ...landedIn(1, 15),
  });
  assert.equal(seasonEnding(openedButEmpty, PEOPLE).id, "ledger-empty");
});

// 主线那一层只在退货单落地的那一季说话。落地那一句已经说完以后还每季念一遍，
// 后面的季就没有人物层的话了（第 27 轮 8 副牌 × 6 季量到：第 5、6 季三个人物结局 0/32）。
test("主线那四句认的是退货单落地那一季，不是第几季", () => {
  // 落点 → 该念哪一句。这几副牌都没攒人物层的旗，主线那一句被收住以后落「谁也没交」。
  const family: Array<[number, string]> = [
    [12, "row-is-yours"], [14, "row-in-total"], [13, "row-still-open"], [17, "row-still-open"],
  ];
  for (const [landing, id] of family) {
    const bare = { compliance: 50, standing: 45, money: 12_000 };
    // 落地那一季（记号 = 季号，setQuality 写落点那一刻钉上的）：该念主线那一句。
    assert.equal(seasonEnding(at({ ...bare, ...landedIn(4, landing) }), PEOPLE).id, id,
      `第 4 季落点 ${landing} 该念「${id}」`);
    // 隔一季再收：同一句不念第二遍。
    assert.equal(seasonEnding(at({ ...bare, ...landedIn(4, landing), season: 5 }), PEOPLE).id, "nobody-left",
      `落点 ${landing}：第 5 季还在念「${id}」`);
    // 慢牌第 5 季才落地的，第 5 季照样念这一句 —— 认的是落地那一季，不是季号 4。
    assert.equal(seasonEnding(at({ ...bare, ...landedIn(5, landing) }), PEOPLE).id, id,
      `第 5 季才落地也该念「${id}」`);
    // 旧档（钉记号之前存的盘）有落点却没有记号：宁可不念，也不猜它落在哪一季。
    const noStamp = { ...at({ ...bare, ...landedIn(4, landing), season: 5 }) };
    noStamp.qualities = Object.fromEntries(
      Object.entries(noStamp.qualities).filter(([key]) => !key.endsWith(":landed")));
    assert.equal(seasonEnding(noStamp, PEOPLE).id, "nobody-left",
      `落点 ${landing}：没记号的旧档不该念「${id}」`);
  }

  // 「这一页有人认」是四句里最好的一句，它多认裴岚那条线：收住以后也不该退到「那一栏写的是你」。
  const carried = at({
    compliance: 50, standing: 45, money: 12_000,
    ...landedIn(4, 12, { "arc:peilan:end": 1 }),
  });
  assert.equal(seasonEnding(carried, PEOPLE).id, "page-carried");
  assert.equal(seasonEnding({ ...carried, season: 5 }, PEOPLE).id, "nobody-left", "第 5 季还在念主线那两句");

  // 收住主线那四句不伤人：同一副牌在落地那一季之外的其它判据照常生效。
  const keptNextSeason = at({
    compliance: 50, standing: 60, money: 20_000,
    ...landedIn(4, 12, { "arc:shen:end": 1, "arc:anjie:end": 1 }),
    season: 5,
    opinion: { shen: 20, anjie: 20 },
  });
  assert.equal(seasonEnding(keptNextSeason, PEOPLE).id, "both-kept");
});

// 门槛写在这一句一句的 when 里，谁新加一句读幕号的都会漏掉那一层，而漏掉是静默的。
test("目录里每一句读幕号的，都必须同时读落地那一季", () => {
  const src = readFileSync(new URL("../src/world/ending.ts", import.meta.url), "utf8");
  const entries = src.split('\n  {\n    id: "').slice(1);
  assert.equal(entries.length, ENDINGS.length, "CATALOG 的条数和读出来的条数对不上");
  const readsAct = entries.filter(e => e.includes("s.act >= 4"));
  assert.equal(readsAct.length, 4, "主线那四句的门槛少了/多了");
  for (const e of readsAct) {
    assert.ok(e.includes("s.landedThisSeason"),
      `「${e.match(/^([\w-]+)"/)?.[1]}」读幕号却不读落地那一季`);
  }
});

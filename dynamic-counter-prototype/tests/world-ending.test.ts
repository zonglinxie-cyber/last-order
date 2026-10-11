// 人情场结局：每条都能造出来，条件按 rank 取先到的那条，rank 是全序。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ENDINGS, rank, seasonEnding } from "../src/world/ending.ts";
import { ENDING_HINTS } from "../src/world/ending-hints.ts";
import { STORYLETS_MAINLINE } from "../src/world/content/storylets-mainline.ts";
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

/** 第 5 幕以后那十四句认的是两件事："这一步的线索是不是本季学到的"（线索存的是绝对天，见 engine 的 absDay）
 *  + 那一步落在哪一档（第 44 轮）。夹具自己算这个天：第 S 季第 12 天 = (S-1)*28 + 12。季号差一，判词就该换。
 *  档位记号必须一起带上：引擎里它们是同一个选项写的，只带线索的夹具是一份写坏了的盘。 */
const spokeIn = (season: number, clue: string, tier?: [string, number]): Partial<World> => ({
  season,
  qualities: {
    "mainline:act": 5,
    [`clue:${clue}`]: (season - 1) * 28 + 12,
    ...(tier ? { [`mainline:${tier[0]}`]: tier[1] } : {}),
  },
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
    // 第 43 轮：第 5 幕以后一句一季。第 44 轮：一季四档，一档一句 —— 每一档都要能单独造出来，
    // 造不出来就是玩家走得到、档案里却永远空着的一句。构造它们只要"这一步的线索是本季学到的"+ 档位，
    // 不需要新的落点档，也不需要新的存档字段 —— 这就是它们能靠线索的绝对天数的原因。
    ["row-signed-again", at({ compliance: 55, standing: 48, money: 14000, ...spokeIn(5, "slip-signature", ["a5-row", 1]) })],
    ["row-no-proxy", at({ compliance: 52, standing: 44, money: 14000, ...spokeIn(5, "slip-signature", ["a5-row", 2]) })],
    ["row-borrowed-name", at({ compliance: 48, standing: 40, money: 14000, ...spokeIn(5, "slip-signature", ["a5-row", 3]) })],
    ["row-numbers-only", at({ compliance: 55, standing: 48, money: 14000, ...spokeIn(6, "slip-number", ["a6-row", 1]) })],
    ["row-stamp-of-others", at({ compliance: 52, standing: 44, money: 14000, ...spokeIn(6, "slip-number", ["a6-row", 2]) })],
    ["row-signs-the-young", at({ compliance: 48, standing: 40, money: 14000, ...spokeIn(6, "slip-number", ["a6-row", 3]) })],
    ["row-only-counted", at({ compliance: 44, standing: 46, money: 14000, ...spokeIn(6, "slip-number", ["a6-row", 4]) })],
    ["row-name-printed", at({ compliance: 55, standing: 48, money: 15000, ...spokeIn(7, "slip-selfrow", ["a7-row", 1]) })],
    ["row-is-a-post", at({ compliance: 52, standing: 44, money: 15000, ...spokeIn(7, "slip-selfrow", ["a7-row", 2]) })],
    ["row-copies-itself", at({ compliance: 48, standing: 40, money: 15000, ...spokeIn(7, "slip-selfrow", ["a7-row", 3]) })],
    ["row-nobody-added", at({ compliance: 44, standing: 46, money: 15000, ...spokeIn(7, "slip-selfrow", ["a7-row", 4]) })],
    ["row-blank-who-stands", at({ compliance: 55, standing: 48, money: 16000, ...spokeIn(8, "slip-blank", ["a8-row", 3]) })],
    ["row-blank-asked", at({ compliance: 50, standing: 44, money: 16000, ...spokeIn(8, "slip-blank", ["a8-row", 2]) })],
    ["row-blank-season", at({ compliance: 44, standing: 40, money: 16000, ...spokeIn(8, "slip-blank", ["a8-row", 1]) })],
    ["row-crossed-again", at({ compliance: 55, standing: 48, money: 16000, ...spokeIn(9, "slip-ownrow", ["a9-row", 1]) })],
    ["row-read-aloud", at({ compliance: 50, standing: 44, money: 16000, ...spokeIn(9, "slip-ownrow", ["a9-row", 2]) })],
    ["row-system-answer", at({ compliance: 48, standing: 42, money: 16000, ...spokeIn(9, "slip-ownrow", ["a9-row", 3]) })],
    ["row-in-your-hand", at({ compliance: 44, standing: 40, money: 16000, ...spokeIn(9, "slip-ownrow", ["a9-row", 4]) })],
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

/** 一季那四步的账：线索 id、档位记号、哪一季、档位 1..N 各念哪一句（数组顺序就是档位顺序）。
 *  第 8 季那句按「越把这一栏交回给人办的排前」倒着排，所以 1 档念的是「没人问」那一句。 */
const CHAIN_STEPS = [
  ["slip-signature", "a5-row", 5, ["row-signed-again", "row-no-proxy", "row-borrowed-name"]],
  ["slip-number", "a6-row", 6, ["row-numbers-only", "row-stamp-of-others", "row-signs-the-young", "row-only-counted"]],
  ["slip-selfrow", "a7-row", 7, ["row-name-printed", "row-is-a-post", "row-copies-itself", "row-nobody-added"]],
  ["slip-blank", "a8-row", 8, ["row-blank-season", "row-blank-asked", "row-blank-who-stands"]],
  ["slip-ownrow", "a9-row", 9, ["row-crossed-again", "row-read-aloud", "row-system-answer", "row-in-your-hand"]],
] as const;

test("第 5 幕以后那十八句：同一季换个档位就换一句，隔一季不重念，也不靠幕号分季", () => {
  // 这是第 43 轮记下的代价 ①（同一季里两种选择看到的是同一句话）在这一轮还上的账。
  // 同一条线索，学到那一天落在上一季 → 这一季不该再把同一句话原样念一遍（第 27 轮给主线那四句立的口径，
  // 延伸到"按季续写"这一层：那一层的门槛不认季号就白搭）。
  for (const [clue, tierKey, season, ids] of CHAIN_STEPS) {
    assert.equal(new Set(ids).size, ids.length, `${clue} 那几句里有重复的 id`);
    for (let tier = 1; tier <= ids.length; tier++) {
      const got = seasonEnding(at({ compliance: 50, standing: 45, money: 14000, ...spokeIn(season, clue, [tierKey, tier]) }), PEOPLE);
      assert.equal(got.id, ids[tier - 1], `${clue} 第 ${season} 季落在档位 ${tier}，念到的却是「${got.title}」`);
    }
    const before = at({ season, qualities: { "mainline:act": 5, [`clue:${clue}`]: (season - 2) * 28 + 12, [`mainline:${tierKey}`]: 1 } });
    const beforeId = seasonEnding(before, PEOPLE).id;
    assert.ok(!(ids as readonly string[]).includes(beforeId), `${clue} 是上一季学的 —— 这一季把同一句话（${beforeId}）原样重念了`);
  }
  // 第 4 季那张退货单落地那一季，念的还得是第 4 幕那四句（那一步的线索那时还没有）
  const landed4 = at({ compliance: 55, standing: 50, money: 12000, ...landedIn(4, 12) });
  assert.ok(["row-is-yours", "page-carried"].includes(seasonEnding(landed4, PEOPLE).id),
    `第 4 季末念成了「${seasonEnding(landed4, PEOPLE).id}」—— 新句子把第 4 幕那句抢了`);
  // 边界（C2 那次反证抓出来的洞）：夹具原来全用季中第 12 天，于是 seasonOfAbsDay 少算一季
  // （floor(day/28)+1）也照样全绿 —— 一条量不到东西的断言就是假绿。补上季末/季首那两天。
  const lastDay = at({ season: 6, qualities: { "mainline:act": 5, "clue:slip-number": (6 - 1) * 28 + 28, "mainline:a6-row": 1 } });
  assert.equal(seasonEnding(lastDay, PEOPLE).id, "row-numbers-only", "第 28 天学的那一步，这一季没念自己的判词");
  const firstDayNext = at({ season: 6, qualities: { "mainline:act": 5, "clue:slip-number": (6 - 1) * 28 + 29, "mainline:a6-row": 1 } });
  assert.notEqual(seasonEnding(firstDayNext, PEOPLE).id, "row-numbers-only",
    "那是下一季第一天学的，这一季就念了下一季的话 —— 天数换算错一天就整季串台");
  // 旧档（第 43 轮那批存档）只有线索、没有档位记号：那一句认不到，落回通用判词。
  // 这是本轮记下的代价，写死在这里，免得日后有人以为它还在念主线那句。
  const noTier = at({ compliance: 50, standing: 45, money: 14000, ...spokeIn(6, "slip-number") });
  assert.ok(!(CHAIN_STEPS[1][3] as readonly string[]).includes(seasonEnding(noTier, PEOPLE).id),
    "缺档位记号的旧档不该硬认第 6 季那四句里的某一句");
  // 静态：这十四句靠线索的绝对天数分季、靠那一步自己写的记号分档，不许再读幕号（幕号停在 5，读它分不出季）
  const src = readFileSync(new URL("../src/world/ending.ts", import.meta.url), "utf8");
  for (const [, , , ids] of CHAIN_STEPS) for (const id of ids) {
    const at0 = src.indexOf(`id: "${id}"`);
    assert.ok(at0 > 0, `${id} 不在目录里`);
    const gate = src.slice(at0, src.indexOf("},", at0));
    assert.ok(gate.includes("s.spoke["), `${id} 没靠线索季号 —— 它凭什么知道这一季说过那句话`);
    assert.ok(gate.includes("s.tier["), `${id} 没认档位 —— 它就是第 43 轮那句同一季通用判词`);
    assert.ok(!gate.includes("s.act"), `${id} 还在读幕号：幕号停在 5，读它分不出季`);
  }
});

test("内容写得出的每一档都正好有一句判词认它，判词也不认内容写不出的档", () => {
  // 档位从内容读，不抄名单：`mainline:aX-row` 能被写成哪几档，是那些卡的选项 effects 说了算。
  // 漏一档 = 玩家走得到、档案里却永远空着的一句；多一档 = 玩家永远读不到的死门
  // （跟梯子那条「没有死格子」同一个口径）。
  const written = new Map<string, number[]>();
  const add = (key: string, n: number) => {
    const list = written.get(key) ?? [];
    if (!list.includes(n)) written.set(key, [...list, n].sort((a, b) => a - b));
  };
  for (const card of STORYLETS_MAINLINE) for (const choice of card.choices) for (const effect of choice.effects) {
    const quality = "quality" in effect ? effect.quality : undefined;
    const set = "set" in effect ? effect.set : undefined;
    const hit = /^mainline:(a[5-9]-row)$/.exec(quality ?? "");
    if (hit && set !== undefined) add(hit[1]!, set);
  }
  assert.deepEqual([...written.keys()].sort(), ["a5-row", "a6-row", "a7-row", "a8-row", "a9-row"], "档位记号不止这五格了，这条守卫要跟着改");

  const src = readFileSync(new URL("../src/world/ending.ts", import.meta.url), "utf8");
  const entries = src.split('\n  {\n    id: "').slice(1);
  const chain = entries.filter(e => e.includes("s.spoke["));
  const admitted = new Map<string, number[]>();
  for (const e of chain) {
    const id = /^([\w-]+)"/.exec(e)?.[1] ?? "?";
    const hits = [...e.matchAll(/s\.tier\["(a[5-9]-row)"\] === (\d+)/g)];
    // 一句只认一档：范围门（>=/<=）铺不铺满量不出来，那条「死格子」守卫就白立了
    assert.equal(hits.length, 1, `「${id}」的门里读到 ${hits.length} 个「=== 某一档」，一句只该认一档`);
    assert.ok(!/s\.tier\["a[5-9]-row"\] *(>=|<=|>|<)/.test(e), `「${id}」用了范围门`);
    const key = hits[0]?.[1]!, tier = Number(hits[0]?.[2]);
    assert.equal(new Set([key]).size, 1, `${id} 跨了两格的档位`);
    const list = admitted.get(key) ?? [];
    assert.ok(!list.includes(tier), `${key} 的第 ${tier} 档被两句判词同时认到 —— 后一句是永远念不到的死句`);
    admitted.set(key, [...list, tier].sort((a, b) => a - b));
  }
  for (const [key, tiers] of written) {
    assert.deepEqual(admitted.get(key), tiers,
      `${key}：内容写得出 ${tiers.join("/")} 档，判词认到 ${admitted.get(key)?.join("/") ?? "一句也没有"}`);
  }
  assert.equal(chain.length, [...written.values()].reduce((n, t) => n + t.length, 0),
    "按季续写那一段的句子数，要和内容能走出的档位数对上");
  // 每一季那几句各自只认自己那一步的线索：a6-row 配 slip-signature 之类的串台要当场红
  for (const [clue, tierKey, , ids] of CHAIN_STEPS) {
    for (const id of ids) {
      const gate = src.slice(src.indexOf(`id: "${id}"`), src.indexOf("},", src.indexOf(`id: "${id}"`)));
      assert.ok(gate.includes(`s.spoke["${clue}"]`), `${id} 认的不是 ${clue} 那一步`);
      assert.ok(gate.includes(`s.tier["${tierKey}"]`), `${id} 读的是别的记号`);
    }
  }
});

test("档案里每一句判词都有自己那句提示，不落兜底那句", () => {
  // 判词越加越多，档案里那句「还没解锁的结局。」就越是白占地方：第 42、43 轮加的主线那十八句
  // 一直念的是兜底句，这一条把口子堵上。
  for (const e of ENDINGS) assert.ok(ENDING_HINTS[e.id], `${e.id}「${e.title}」在档案里念的是兜底那句`);
  for (const id of Object.keys(ENDING_HINTS)) assert.ok(ENDINGS.some(e => e.id === id), `提示表里有 ${id}，目录里没有这一句`);
});

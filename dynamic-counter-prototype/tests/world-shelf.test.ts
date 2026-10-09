// 人情场的货架（src/world/shelf.ts）与"每一位顾客的需求都要被满足"这条产品判据。
// 为什么单独一份测试：旧三日版式里只有三支货，32 位有诉求表的客人中 28 位只有一支"买得起的正解"，
// 4 位连那一支都够不着 —— 货架给不出选择。这里钉的是**这张表的形状**（覆盖、挤位、陷阱、钱与懂的冲突），
// 数字变了就必须重新读一遍内容，不许默默漂过去。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ENERGY_PER_DAY, PRICE_MISS_OPINION, SERVE_GOOD_OPINION, newWorld, opinionOf, resolveServe,
} from "../src/world/engine.ts";
import {
  PERFECT_MATCH, PERFECT_MATCH_OPINION, SHELF, SHELF_IDS, TAG_WORD, affordableUnits, fitOfPerson, shelfFitTier,
  type ShelfId,
} from "../src/world/shelf.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { Person } from "../src/world/types.ts";

const skinned = PEOPLE.filter(p => p.skin);
/** 她买得起的正解（对症 + 预算够一支）。 */
const affordablePositives = (p: Person) => SHELF_IDS.filter(id =>
  shelfFitTier(fitOfPerson(p, id)) === "positive" && p.skin!.budget >= SHELF[id].price);
/** 一件多少钱：价 × 件数，件数仍受她的用量上限与预算削。 */
const revenue = (p: Person, id: ShelfId) => SHELF[id].price * affordableUnits(p, id);

test("32 位有诉求表的客人，每一个都有买得起的正解", () => {
  // 这一条是任务 #9 的验收本身：旧货架下这四位是空的（唐糖 ¥1,500 够不着修护、蔡阿姨 ¥900 够不着柔焦、
  // 江宁 ¥400、苏晓 ¥1,100 够不着修护）。
  const none = skinned.filter(p => affordablePositives(p).length === 0).map(p => p.id);
  assert.deepEqual(none, []);
  assert.equal(skinned.length, 32, "有脸的人数变了，上面那批覆盖结论要重读");
});

test("货架不再只给一个答案：只有一支买得起的正解的人从 28 降到 9", () => {
  const one = skinned.filter(p => affordablePositives(p).length === 1).map(p => p.id);
  assert.deepEqual(one, ["zhao", "zhou", "tangtang", "zhaoning", "heqing", "jiangning", "suxiao", "yenushi", "cenning"]);
  const counts = skinned.map(p => affordablePositives(p).length).sort((a, b) => a - b);
  assert.equal(counts[Math.floor(counts.length / 2)], 2, "中位数：一位客人面前摆出两支可选的正解");
  // 实测形状（不是"越多越好"）：1 支 9 人 / 2 支 8 人 / 3 支 12 人 / 4 支 2 人 / 5 支 1 人。
  // 中位数是 2 而不是更多：21/32 位的用量上限只有 1 件，¥1,180 以上那三支对多数人属于"看过但买不起"。
  const dist: Record<number, number> = {};
  for (const c of counts) dist[c] = (dist[c] ?? 0) + 1;
  assert.deepEqual(dist, { 1: 9, 2: 8, 3: 12, 4: 2, 5: 1 });
});

test("八支货没有死角也没有万能药", () => {
  for (const id of SHELF_IDS) {
    const pos = skinned.filter(p => shelfFitTier(fitOfPerson(p, id)) === "positive").length;
    const neg = skinned.filter(p => shelfFitTier(fitOfPerson(p, id)) === "negative").length;
    assert.ok(pos >= 3, `${SHELF[id].short} 只有 ${pos} 位当它是正解 —— 摆着一支没人要的货是内容浪费`);
    assert.ok(neg >= 2, `${SHELF[id].short} 谁都接不住 —— 一支对所有人都正的货会把判断变成挑最贵的`);
  }
  // 挤位：最贵买得起的正解落在谁身上。一支超过 12 位就说明这张表又变回"一个答案"了。
  const heat = SHELF_IDS.map(id => skinned.filter(p => {
    const aff = affordablePositives(p);
    return aff.length && aff.reduce((x, y) => (SHELF[y].price > SHELF[x].price ? y : x)) === id;
  }).length);
  assert.equal(Math.max(...heat), 12, `首选挤位读数变了：${heat.join("/")}`);
});

test("钱与懂不是同一格：四位客人的满分那支不是最赚的那支", () => {
  // 看法是这个人情的货币（她肯不肯多讲一条、回不回来、会不会被对面请走），
  // 所以"多花一千块"和"她要的每条都被接住"必须真的能撞车，否则货架只是八个体价签。
  const same: string[] = [], conflict: string[] = [], noPerfect: string[] = [];
  for (const p of skinned) {
    const aff = affordablePositives(p);
    const perfect = aff.filter(id => fitOfPerson(p, id) >= PERFECT_MATCH);
    const money = [...aff].sort((a, b) => revenue(p, b) - revenue(p, a))[0];
    const fit = perfect.length ? [...perfect].sort((a, b) => revenue(p, b) - revenue(p, a))[0] : null;
    if (!perfect.length) noPerfect.push(p.id);
    else if (fit === money) same.push(p.id);
    else conflict.push(p.id);
  }
  assert.deepEqual([same.length, conflict.length, noPerfect.length], [22, 4, 6]);
  assert.deepEqual(conflict, ["miduo", "liangxia", "caiaiyi", "dongayi"]);
  assert.deepEqual(noPerfect, ["zhou", "tangtang", "heqing", "suxiao", "yenushi", "cenning"]);
  // 撞得最狠的一位：米朵 —— 修护 ¥1,680 只算"没推错"，喷雾 ¥680 才是她那两条都接住的那支。
  assert.ok(conflict.includes("miduo") && conflict.includes("dongayi"));
});

test("越贵不等于越赚：件数被她的预算削，五位客人按最贵开反而少赚", () => {
  const differ = skinned.filter(p => {
    const aff = affordablePositives(p);
    const priciest = [...aff].sort((a, b) => SHELF[b].price - SHELF[a].price)[0];
    const money = [...aff].sort((a, b) => revenue(p, b) - revenue(p, a))[0];
    return priciest !== undefined && priciest !== money;
  }).map(p => p.id);
  assert.deepEqual(differ, ["shen", "liangxia", "guyan", "chendao", "yinxiaojie"]);
  const shen = PEOPLE.find(p => p.id === "shen")!;
  // 沈薇：妆前 ¥1,180 一支她只开得下 2 件，柔焦 ¥980 开得下 3 件 —— 便宜那支反而多 ¥580。
  assert.equal(revenue(shen, "base"), 2_360);
  assert.equal(revenue(shen, "soft"), 2_940);
});

test("满分支：把她每条诉求都接住，比「没推错」多一笔看法", () => {
  const serve = (id: ShelfId) => resolveServe(
    { ...newWorld("shelf-serve", PEOPLE), energy: ENERGY_PER_DAY, present: { mei: "counter" } },
    PEOPLE, "mei", id, 1);
  // 梅女士：修护 1.00（满分）、喷雾 0.83（过线但没满分）、持妆 0.17（不对症）。
  const good = serve("repair");
  assert.equal(opinionOf(good, "mei"), SERVE_GOOD_OPINION + PERFECT_MATCH_OPINION);
  assert.ok(good.log.some(l => l.text.includes("要的每条都被接住了")), "多出来的这一笔要在句子里念出来");
  assert.equal(serve("mist").money, SHELF.mist.price);
  assert.equal(opinionOf(serve("mist"), "mei"), SERVE_GOOD_OPINION, "过线只拿基础那笔");
});

test("对症却买不起 ≠ 推错：那句「这解决不了我的事」不能说给超预算的推荐", () => {
  const serve = (id: ShelfId) => resolveServe(
    { ...newWorld("shelf-miss", PEOPLE), energy: ENERGY_PER_DAY, present: { mei: "counter" } },
    PEOPLE, "mei", id, 1);
  // 面敷 ¥2,280 对梅女士是 1.00 的正解，她只有 ¥1,800 —— 她没怪你选错。
  const pricey = serve("mask");
  assert.equal(pricey.money, 0, "买不起就不该入账");
  assert.equal(opinionOf(pricey, "mei"), PRICE_MISS_OPINION);
  assert.ok(pricey.memories.some(m => m.holder === "mei" && m.act === "price-miss"));
  assert.ok(pricey.log.some(l => l.text.includes("价签")));
  // 持妆 ¥1,280 她买得起，但那不是她的答案 —— 这一句才归"不对症"。
  const wrong = serve("glow");
  assert.equal(opinionOf(wrong, "mei"), -3);
  assert.ok(wrong.memories.some(m => m.holder === "mei" && m.act === "wrong-pick"));
  assert.ok(wrong.log.some(l => l.text.includes("这解决不了我的事")));
});

test("货架只有一张：引擎和界面都不再从旧五日版拿货", () => {
  // 两支货架各自定价迟早对不上账（人情场不受五日版那些金额约束，见根目录 AGENTS.md）。
  const engine = readFileSync(new URL("../src/world/engine.ts", import.meta.url), "utf8");
  assert.equal(engine.includes('from "../campaign.ts"'), false, "引擎不该再 import campaign.ts");
  const ui = readFileSync(new URL("../src/world/ui/WorldGame.tsx", import.meta.url), "utf8");
  assert.equal(/\bPRODUCTS\b/.test(ui), false, "接待面板该读 shelf.ts 的 SHELF");
  assert.equal(SHELF_IDS.length, 8);
});

test("八支货的短标签不许虚标：写着「见效」这一支就得真有见效这条", () => {
  // 标签是格子上那行小字，玩家不点就靠它扫完八支（tests/world-newbie.spec.ts 钉它在 320 那一档没被裁）。
  // 所以它是承诺不是营销：提到的每一条，这一支在该条上必须至少 1 分。
  const covered = new Set<string>();
  for (const id of SHELF_IDS) {
    const tag = SHELF[id].tag;
    const claimed = Object.keys(TAG_WORD).filter(word => tag.includes(word));
    assert.ok(claimed.length >= 1, `${SHELF[id].short}「${tag}」一个诉求词都没用，等于没标`);
    for (const word of claimed) {
      const trait = TAG_WORD[word];
      assert.ok(SHELF[id].traits[trait] >= 1, `${SHELF[id].short}「${tag}」写着「${word}」，它在 ${trait} 这条上是 0 分`);
      covered.add(trait);
    }
    assert.ok([...tag].length <= 5, `${SHELF[id].short}「${tag}」${[...tag].length} 个字，320 那一档一格只有 70px`);
  }
  assert.equal(new Set(SHELF_IDS.map(id => SHELF[id].tag)).size, SHELF_IDS.length, "八支标签两两不同，扫一眼才分得开");
  assert.deepEqual([...covered].sort(), ["correct", "natural", "soothe", "steady", "wear"],
    "她会被问到的五条诉求，货架上要每条都读得出来");
});

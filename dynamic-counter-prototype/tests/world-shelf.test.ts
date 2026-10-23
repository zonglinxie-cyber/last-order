// 人情场的货架（src/world/shelf.ts）与"每一位顾客的需求都要被满足"这条产品判据。
// 为什么单独一份测试：旧三日版式里只有三支货，32 位有诉求表的客人中 28 位只有一支"买得起的正解"，
// 4 位连那一支都够不着 —— 货架给不出选择。这里钉的是**这张表的形状**（覆盖、挤位、陷阱、钱与懂的冲突），
// 数字变了就必须重新读一遍内容，不许默默漂过去。
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ENERGY_PER_DAY, PRICE_MISS_OPINION, SERVE_GOOD_OPINION, newWorld, opinionOf, resolveServe,
} from "../src/world/engine.ts";
import {
  PERFECT_MATCH_OPINION, SHELF, SHELF_IDS, TAG_WORD, affordableUnits, fitOfPerson, perfectShelf, shelfFitTier,
  type ShelfId,
} from "../src/world/shelf.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { Person, Trait, World } from "../src/world/types.ts";
import { saleFeedback } from "../src/world/sales-feedback.ts";

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

test("货架不再只给一个答案：只有一支买得起的正解的人 28 → 9（八支）→ 1（十二支）；中位三支 → 四支", () => {
  const one = skinned.filter(p => affordablePositives(p).length === 1).map(p => p.id);
  // 剩下的这一位是周姐：薄、见效、稳、撑妆四条都要，又不许厚 —— 只有粉底一支过线。
  assert.deepEqual(one, ["zhou"]);
  const counts = skinned.map(p => affordablePositives(p).length).sort((a, b) => a - b);
  assert.equal(counts[Math.floor(counts.length / 2)], 4, "中位数：一位客人面前摆出四支可选的正解");
  // 实测形状：1 支 1 人 / 2 支 5 人 / 3 支 6 人 / 4 支 14 人 / 5 支 3 人 / 6 支 2 人 / 9 支 1 人（预算高、诉求少的宋姐九支都行）。
  // 2026-10-21 重排档位后从 {1:1,2:9,3:15,4:2,5:1,6:1,7:2,9:1} 变成这个形状：喷雾、乳液、持妆重新能被翻出来，
  // 于是"面前有几支可选"整体往宽里挪了一格 —— 货架变宽不是稀释，是原来那几支被盖住的货重新露出来。
  const dist: Record<number, number> = {};
  for (const c of counts) dist[c] = (dist[c] ?? 0) + 1;
  assert.deepEqual(dist, { 1: 1, 2: 5, 3: 6, 4: 14, 5: 3, 6: 2, 9: 1 });
});

test("货架上没有死货：没有哪一支被更便宜的另一支全面盖住", () => {
  // 这一条是货架尾部那一刀的核心。旧档位下有四支是死的：喷雾被面膜盖住、乳液被洁面盖住、
  // 持妆被气垫盖住、精粹水被粉霜盖住 —— 更便宜的那支在每条诉求上都不差，被盖住的一支
  // 就永远拿不到"正中"，盲策按标签排完序也永远不会先试它，于是它一年到头零成交。
  const traits: Trait[] = ["natural", "correct", "soothe", "steady", "wear"];
  const dead = SHELF_IDS.filter(id => SHELF_IDS.some(other =>
    other !== id && SHELF[other].price < SHELF[id].price &&
    traits.every(t => SHELF[other].traits[t] >= SHELF[id].traits[t])));
  assert.deepEqual(dead, [], `这几支被更便宜的货盖住了：${dead.map(id => SHELF[id].short).join("、")}`);
});

test("货架尾部那三支各有人把她们当正中：喷雾、乳液、持妆", () => {
  const owners = (id: ShelfId) => skinned.filter(p => perfectShelf(p) === id).map(p => p.id);
  assert.deepEqual(owners("mist"), ["miduo", "dongayi"], "米朵与冬姨那一族：又薄又要退红，喷雾是唯一那支");
  assert.deepEqual(owners("balm"), ["xiaoyu"], "小雨：要见效、要不闷，兜里不宽裕，乳液比粉底便宜");
  assert.deepEqual(owners("glow"), ["yenushi"], "叶女士：撑妆、见效、还不能闷，只有持妆给得起");
});

test("三十二位客人人人有正中：周姐与叶女士不再空着", () => {
  const none = skinned.filter(p => !perfectShelf(p)).map(p => p.id);
  assert.deepEqual(none, [], `这几位没有买得起的正中：${none.join("、")}`);
  assert.equal(skinned.length, 32, "有脸的人数变了，上面那批覆盖结论要重读");
});

test("十二支货没有死角也没有万能药", () => {
  for (const id of SHELF_IDS) {
    const pos = skinned.filter(p => shelfFitTier(fitOfPerson(p, id)) === "positive").length;
    const neg = skinned.filter(p => shelfFitTier(fitOfPerson(p, id)) === "negative").length;
    assert.ok(pos >= 3, `${SHELF[id].short} 只有 ${pos} 位当它是正解 —— 摆着一支没人要的货是内容浪费`);
    assert.ok(neg >= 2, `${SHELF[id].short} 谁都接不住 —— 一支对所有人都正的货会把判断变成挑最贵的`);
  }
  // 挤位：最贵买得起的正解落在谁身上。八支那版最挤的一支压着 12 位，十二支摊到 9 位；
  // 2026-10-21 重排档位后落到 11 位 —— 挤在粉霜身上的是"薄 + 稳"那一族（薄的人不许厚，
  // 于是贵的那几支对她们一律接不住，最贵的正解只能是这支出粉的养肤粉霜）。这是那一族的结构上限。
  const heat = SHELF_IDS.map(id => skinned.filter(p => {
    const aff = affordablePositives(p);
    return aff.length && aff.reduce((x, y) => (SHELF[y].price > SHELF[x].price ? y : x)) === id;
  }).length);
  assert.equal(Math.max(...heat), 11, `首选挤位读数变了：${heat.join("/")}`);
});

test("钱与懂不是同一格：二十三位客人的正中那支不是最赚的那支", () => {
  // 看法是这个人情的货币（她肯不肯多讲一条、回不回来、会不会被对面请走），
  // 所以"多花一千块"和"她要的每条都被接住"必须真的能撞车，否则货架只是十二个体价签。
  // 正中按「买得起、全接住、最便宜」只留一支；贵的全接住仍是对症，但不拿正中那一笔。
  const same: string[] = [], conflict: string[] = [], noPerfect: string[] = [];
  for (const p of skinned) {
    const aff = affordablePositives(p);
    const per = perfectShelf(p);
    const money = [...aff].sort((a, b) => revenue(p, b) - revenue(p, a))[0];
    if (!per) noPerfect.push(p.id);
    else if (per === money) same.push(p.id);
    else conflict.push(p.id);
  }
  assert.deepEqual([same.length, conflict.length, noPerfect.length], [9, 23, 0]);
  assert.deepEqual(conflict, ["xiaoyu", "zhao", "miduo", "tangtang", "liangxia", "baijie", "zhaoning", "heqing", "caiaiyi", "linyi", "wulaoshi", "dongayi", "guyan", "suxiao", "songjie", "hanlei", "chendao", "yinxiaojie", "qianjie", "gaoyuan", "cenning", "chenke", "tanwan"]);
  assert.deepEqual(noPerfect, []);
  // 撞得最狠的一位：米朵 —— 正中喷雾 ¥480，最赚的那支是精华 ¥1,680，同一单两个答案。
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
  // 梅女士：修护 1.00（满分）、喷雾 0.83（过线但没满分）、持妆 0.33（勉强带走了）。
  const good = serve("repair");
  assert.equal(opinionOf(good, "mei"), SERVE_GOOD_OPINION + PERFECT_MATCH_OPINION);
  assert.ok(good.log.some(l => l.text.includes("要的每条都被接住了")), "多出来的这一笔要在句子里念出来");
  assert.equal(serve("mist").money, SHELF.mist.price);
  assert.equal(opinionOf(serve("mist"), "mei"), SERVE_GOOD_OPINION, "过线只拿基础那笔");
});

test("贵的全接住仍成交，但正中那支多一笔看法：钱与懂真的分开结", () => {
  const p = PEOPLE.find(x => x.id === "shen")!;
  const w: World = { ...newWorld("shelf-perfect", PEOPLE), energy: ENERGY_PER_DAY, present: { shen: "counter" } };
  const expensive = resolveServe(w, PEOPLE, "shen", "base", 1);
  const perfect = resolveServe(w, PEOPLE, "shen", "soft", 1);
  assert.equal(expensive.money, SHELF.base.price);
  assert.equal(perfect.money, SHELF.soft.price);
  assert.equal(opinionOf(perfect, "shen") - opinionOf(expensive, "shen"), PERFECT_MATCH_OPINION,
    "贵的全接住只拿基础看法；正中那支多 4 点");
  assert.match(saleFeedback(w, expensive, p, "base", 1).explanation, /不是最省/);
  assert.doesNotMatch(saleFeedback(w, perfect, p, "soft", 1).explanation, /不是最省/);
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
  // 持妆 ¥1,280 她买得起，但重排档位后它对她只是勉强（0.33），推错的是气垫 ——
  // 它跟她的诉求一条都不沾（0.17），这一句才归"不对症"。
  const wrong = serve("cushion");
  assert.equal(opinionOf(wrong, "mei"), -3);
  assert.ok(wrong.memories.some(m => m.holder === "mei" && m.act === "wrong-pick"));
  assert.ok(wrong.log.some(l => l.text.includes("这解决不了我的事")));
});

test("货架只有一张：旧五日版那份货架连同 campaign.ts 一起删了，没人再从那里拿货", () => {
  assert.equal(existsSync(new URL("../src/campaign.ts", import.meta.url)), false);
  const engine = readFileSync(new URL("../src/world/engine.ts", import.meta.url), "utf8");
  assert.equal(engine.includes("campaign.ts\""), false, "引擎不该再 import campaign.ts");
  const ui = readFileSync(new URL("../src/world/ui/WorldGame.tsx", import.meta.url), "utf8");
  assert.equal(/\bPRODUCTS\b/.test(ui), false, "接待面板该读 shelf.ts 的 SHELF");
  assert.equal(SHELF_IDS.length, 12);
});

test("十二支货的短标签不许虚标：写着「见效」这一支就得真有见效这条", () => {
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
    // 标签得写到这一支的招牌：至少有一条它给的是满档（2 分）。写不到满档的那条，
    // 标签就只是"什么都说一点"，玩家扫完货架也分不出该往哪支上伸手。
    assert.ok(claimed.some(w => SHELF[id].traits[TAG_WORD[w]!] === 2),
      `${SHELF[id].short}「${tag}」没写到它满档的那条诉求`);
  }
  assert.equal(new Set(SHELF_IDS.map(id => SHELF[id].tag)).size, SHELF_IDS.length, "标签两两不同，扫一眼才分得开");
  assert.deepEqual([...covered].sort(), ["correct", "natural", "soothe", "steady", "wear"],
    "她会被问到的五条诉求，货架上要每条都读得出来");
});

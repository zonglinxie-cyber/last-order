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
  PERFECT_MATCH, PERFECT_MATCH_OPINION, SHELF, SHELF_IDS, TAG_WORD, affordableUnits, fitOfPair, fitOfPerson,
  isPerfectPair, needsPair, pairFits, pairPartners, perfectPairOf, perfectShelf, shelfFitTier, type ShelfId,
} from "../src/world/shelf.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { variantPerson } from "../src/world/visits.ts";
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
  // 要配两支的那几位（她的事一件货接不住）单支那条分布对她们不适用 ——
  // 她的正解是「两支合起来那一支」，统计时剔掉；剩下的人面对的货架不能变窄。
  const rest = skinned.filter(p => !needsPair(p));
  const one = rest.filter(p => affordablePositives(p).length === 1).map(p => p.id);
  // 剩下的这一位是周姐：薄、见效、稳、撑妆四条都要，又不许厚 —— 只有粉底一支过线。
  assert.deepEqual(one, ["zhou"]);
  const counts = rest.map(p => affordablePositives(p).length).sort((a, b) => a - b);
  assert.equal(counts[Math.floor(counts.length / 2)], 4, "中位数：一位客人面前摆出四支可选的正解");
  // 实测形状：1 支 1 人 / 2 支 5 人 / 3 支 6 人 / 4 支 14 人 / 5 支 3 人 / 6 支 2 人 / 9 支 1 人（预算高、诉求少的宋姐九支都行）。
  // 2026-10-21 重排档位后从 {1:1,2:9,3:15,4:2,5:1,6:1,7:2,9:1} 变成这个形状：喷雾、乳液、持妆重新能被翻出来，
  // 于是"面前有几支可选"整体往宽里挪了一格 —— 货架变宽不是稀释，是原来那几支被盖住的货重新露出来。
  // 2026-10-24（第 52 轮「配两支」）：剔掉要配两支的那两位之后，4 支从 14 人变 13 人、5 支从 3 人变 2 人 ——
  // 她俩各多了一条诉求，单支能过线的货就少一支。这是那两位自己的事，不该算进「其余人的货架」。
  const dist: Record<number, number> = {};
  for (const c of counts) dist[c] = (dist[c] ?? 0) + 1;
  assert.deepEqual(dist, { 1: 1, 2: 5, 3: 6, 4: 13, 5: 2, 6: 2, 9: 1 });
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

test("三十二位客人人人有正解：三十位一支正中，两位两支合起来正中", () => {
  // 2026-10-24（第 52 轮「配两支」）：正中有两样 —— 一支正中，或两支合起来正中。
  // 那两位「一件货接不住」的客人没有单支正中，她们的正解在两支上；所以这条守卫不能只查单支。
  const pairsOf = (p: Person): ShelfId[][] => {
    const pairs: ShelfId[][] = [];
    for (const a of SHELF_IDS) for (const b of pairPartners(p, a)) pairs.push([a, b]);
    return pairs;
  };
  const none = skinned.filter(p => !perfectShelf(p) && pairsOf(p).length === 0).map(p => p.id);
  assert.deepEqual(none, [], `这几位没有买得起的正解：${none.join("、")}`);
  assert.equal(skinned.length, 32, "有脸的人数变了，上面那批覆盖结论要重读");
  // 没有单支正中的那几位，正是「一件货接不住」的那几位 —— 两边对不上，说明配两支那一刀没接上。
  assert.deepEqual(skinned.filter(p => !perfectShelf(p)).map(p => p.id),
    skinned.filter(needsPair).map(p => p.id),
    "没有单支正中的客人 = 需要配两支的客人");
});

test("有些人的事一件货接不住：单支再准也差一口气，得两支合起来", () => {
  const pairPeople = skinned.filter(needsPair);
  assert.ok(pairPeople.length >= 1, "没有一位客人的事要配两支 —— 那一刀就白做了");
  for (const p of pairPeople) {
    assert.equal(perfectShelf(p), null, `${p.id} 有单支正中，不该算要配两支`);
    // 单支接不满：她要的每一条，任何一支都接不满 —— 差的那一块正是搭支要补的。
    const best = Math.max(...SHELF_IDS.map(id => fitOfPerson(p, id)));
    assert.ok(best < PERFECT_MATCH, `${p.id} 单支就有正中，配两支这一格就多余了`);
    // 配得上：至少有一对两支合起来是正中，而且她买得起这一对。
    const pairs: ShelfId[][] = [];
    for (const a of SHELF_IDS) for (const b of pairPartners(p, a)) pairs.push([a, b]);
    assert.ok(pairs.length >= 1, `${p.id} 没有配得成的两支`);
    for (const [a, b] of pairs) {
      assert.ok(fitOfPair(p, a, b) >= PERFECT_MATCH, `${a}+${b} 配不成 ${p.id} 的事`);
      assert.ok(SHELF[a].price + SHELF[b].price <= p.skin!.budget, `${a}+${b} 超 ${p.id} 的预算`);
    }
  }
});

test("配两支才是正中：只卖一支照样成交，但拿不到「你懂她」那一笔", () => {
  const p = skinned.find(x => needsPair(x))!;
  // 最省的那一对 —— 她要的正中就在这两支里
  const [main, partner] = perfectPairOf(p)!;
  const w: World = { ...newWorld("shelf-pair", PEOPLE), energy: ENERGY_PER_DAY, present: { [p.id]: "counter" } };
  // 只卖一支：过线、成交、钱也照收 —— 但她要的那一条还差着，「你懂她」那一笔不给。
  const one = resolveServe(w, PEOPLE, p.id, main, 1);
  assert.equal(one.money, SHELF[main].price);
  assert.equal(opinionOf(one, p.id), SERVE_GOOD_OPINION, "单支过线只拿基础那笔");
  // 配两支：两支的钱一起收，「你懂她」那一笔也给上。
  const two = resolveServe(w, PEOPLE, p.id, main, 1, false, partner);
  assert.equal(two.money, SHELF[main].price + SHELF[partner].price);
  assert.equal(opinionOf(two, p.id), SERVE_GOOD_OPINION + PERFECT_MATCH_OPINION);
  assert.ok(two.log.some(l => l.text.includes(SHELF[main].name) && l.text.includes(SHELF[partner].name)),
    "收账那句话要把两支都说出来");
});

test("配两支也讲「最省」：更贵的那一对照样接得住她的每一条，却不是正中", () => {
  // 这一条是这一刀的要害：配两支若「无脑挑最贵」就成立，它就不是一个选择，是一条捷径。
  // 正中跟单支一个口径 —— 接住每一条、买得起、而且是最便宜的那一对。
  for (const p of skinned.filter(x => needsPair(x))) {
    const best = perfectPairOf(p)!;
    const bestPrice = SHELF[best[0]].price + SHELF[best[1]].price;
    assert.ok(isPerfectPair(p, best[0], best[1]), `${p.id} 最省的那一对拿不到正中那一笔`);
    // 找得到更贵的一对：接住她的每一条（fit 到线），却不是正中。
    const pricier = SHELF_IDS.flatMap(a => pairPartners(p, a).map(b => ({ a, b, price: SHELF[a].price + SHELF[b].price })))
      .filter(r => r.price > bestPrice);
    assert.ok(pricier.length > 0, `${p.id} 没有更贵的组合 —— 「钱 vs 懂她」这一格不成立`);
    const { a, b } = pricier[0]!;
    assert.ok(fitOfPair(p, a, b) >= PERFECT_MATCH, `${a}+${b} 接不住 ${p.id} 的每一条`);
    assert.equal(isPerfectPair(p, a, b), false, `${a}+${b} 比最省的那一对贵，却拿了正中 —— 口径乱了`);
    const w: World = { ...newWorld("shelf-pair2", PEOPLE), energy: ENERGY_PER_DAY, present: { [p.id]: "counter" } };
    const sold = resolveServe(w, PEOPLE, p.id, a, 1, false, b);
    // 照样成交、照样是「对症」，但那一笔「你懂她」不给。
    assert.equal(sold.money, SHELF[a].price + SHELF[b].price);
    assert.equal(opinionOf(sold, p.id), SERVE_GOOD_OPINION, "贵的那一对接住了，却不是正中");
  }
});

test("当天情境也会造出「没有哪一支能接全」：那一层不是死内容", () => {
  // 来访情境会把今天的重点提到头等（要 2 档、权重 2），其余几条的分量压到 1 ——
  // 她今天于是多出一件事要办，单支接不全（2026-10-24 实测：改需求表之前就有 6 处这样的情形，
  // 第 49/50 轮那句「零场景」是只量本体需求表、漏了这一层量出来的）。
  // 这一条钉的是「配两支」这一格在情境层也有戏份，不是只在改了需求表的那两位身上成立。
  let cases = 0;
  const who = new Set<string>();
  for (const p of skinned) for (const code of [1, 2, 3, 4]) {
    const v = variantPerson(p, code);
    if (perfectShelf(v)) continue;
    if (!SHELF_IDS.some(a => pairPartners(v, a).length > 0)) continue;
    cases++; who.add(p.id);
  }
  // 实测 14 处 / 6 位客人（周姐、梁夏、陈道、叶女士、尹小姐、高远）。钉下限，不钉死名单。
  assert.ok(cases >= 4, `情境层只造出 ${cases} 处「要两支」的情形 —— 那一层几乎是死内容`);
  assert.ok(who.size >= 3, `只有 ${who.size} 位客人在情境里遇上这一格`);
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

test("钱与懂不是同一格：二十一位客人的正中那支不是最赚的那支", () => {
  // 看法是这个人情的货币（她肯不肯多讲一条、回不回来、会不会被对面请走），
  // 所以"多花一千块"和"她要的每条都被接住"必须真的能撞车，否则货架只是十二个体价签。
  // 正中按「买得起、全接住、最便宜」只留一支；贵的全接住仍是对症，但不拿正中那一笔。
  // 2026-10-24（第 52 轮「配两支」）：要配两支的那两位没有单支正中 —— 她们的「正中」是两支合起来那一支，
  // 这一格对她们不适用，单独归到 noPerfect 里数。
  const same: string[] = [], conflict: string[] = [], noPerfect: string[] = [];
  for (const p of skinned) {
    const aff = affordablePositives(p);
    const per = perfectShelf(p);
    const money = [...aff].sort((a, b) => revenue(p, b) - revenue(p, a))[0];
    if (!per) noPerfect.push(p.id);
    else if (per === money) same.push(p.id);
    else conflict.push(p.id);
  }
  assert.deepEqual([same.length, conflict.length, noPerfect.length], [9, 21, 2]);
  assert.deepEqual(conflict, ["xiaoyu", "zhao", "miduo", "tangtang", "liangxia", "baijie", "zhaoning", "heqing", "caiaiyi", "linyi", "wulaoshi", "dongayi", "guyan", "suxiao", "songjie", "hanlei", "chendao", "qianjie", "cenning", "chenke", "tanwan"]);
  // 没有单支正中的那两位，正是要配两支的那两位 —— 名单从生产里读，不在守卫里写死。
  assert.deepEqual(noPerfect, skinned.filter(needsPair).map(p => p.id));
  // 撞得最狠的一位：米朵 —— 正中喷雾 ¥480，最赚的那支是精华 ¥1,680，同一单两个答案。
  assert.ok(conflict.includes("miduo") && conflict.includes("dongayi"));
});

test("越贵不等于越赚：件数被她的预算削，四位客人按最贵开反而少赚", () => {
  const differ = skinned.filter(p => {
    const aff = affordablePositives(p);
    const priciest = [...aff].sort((a, b) => SHELF[b].price - SHELF[a].price)[0];
    const money = [...aff].sort((a, b) => revenue(p, b) - revenue(p, a))[0];
    return priciest !== undefined && priciest !== money;
  }).map(p => p.id);
  // 2026-10-24：尹小姐退出这一格 —— 她多了一条诉求以后，单支的正解只剩喷雾与面膜两支，
  // 最贵那支与最赚那支成了同一支，不再撞车。她那一格现在是「单支接不满，得配两支」。
  assert.deepEqual(differ, ["shen", "liangxia", "guyan", "chendao"]);
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

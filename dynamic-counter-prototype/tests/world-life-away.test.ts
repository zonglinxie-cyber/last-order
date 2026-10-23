// 熟客流失的通用守卫。一整季没在她这儿开过单 → 她落进「这一格不留了」那一档：
// 她来得少了，也不替你带人（life:<id>:how 第三档，life-sales.ts 读它）。再接住她一次就翻回来。
import assert from "node:assert/strict";
import { test } from "node:test";
import { newWorld, nextSeason, settleServe } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { AWAY_BIAS, LIFE_HOW_BIAS, clearLifeAway, lifeArriveChance, lifeAwayOf, lifeReferChance } from "../src/world/life-sales.ts";
import type { World } from "../src/world/types.ts";

// 挑人按条件找，不点名 —— 谁排在前面变了，这条守卫照样咬得住
const person = PEOPLE.find(p => p.role === "customer" && p.skin)!;

const withLife = (world: World, step = 1): World =>
  ({ ...world, qualities: { ...world.qualities, [`life:${person.id}`]: step } });

test("一整季没接待过她：换季时落一个 away 旗，她来得少了、也不带你的人", () => {
  const world = withLife(newWorld("away", PEOPLE));
  const next = nextSeason(world, PEOPLE);
  assert.equal(next.qualities[`life:${person.id}:away`], 1, "要落旗");
  assert.equal(next.qualities[`life:${person.id}:how`], undefined, "卡上写下的落点一个字不改");
  // 来得少了：自然来访概率比原来低 0.07。
  const base = lifeArriveChance(world, person.id, 0.5);
  const after = lifeArriveChance(next, person.id, 0.5);
  assert.ok(after < base, `她该来得少：${after} 对 ${base}`);
  // 不再替你带人：这一档把概率压到 0 以下（夜里约客那一关就约不成了）。
  assert.ok(lifeReferChance(next, person.id, 0.15) < 0, `她该不替你带人：${lifeReferChance(next, person.id, 0.15)}`);
});

test("这一季接待过她：不落旗", () => {
  const base = withLife(newWorld("away-kept", PEOPLE));
  const world: World = { ...base, qualities: { ...base.qualities, [`served:${person.id}`]: 1 } };
  const next = nextSeason(world, PEOPLE);
  assert.equal(next.qualities[`life:${person.id}:away`], undefined);
  assert.notEqual(next.qualities[`life:${person.id}:how`], 3);
});

test("没有人生那一步的客人不算熟客，不落旗", () => {
  const world = newWorld("away-none", PEOPLE);
  const next = nextSeason(world, PEOPLE);
  assert.equal(next.qualities[`life:${person.id}:away`], undefined);
});

test("再接住她一次，这一页翻回来", () => {
  const world = withLife(newWorld("away-back", PEOPLE));
  const away = nextSeason(world, PEOPLE);
  assert.equal(lifeAwayOf(away, person.id), true);
  const served = settleServe(away, PEOPLE, person.id, "mist", 1);
  assert.equal(lifeAwayOf(served, person.id), false, "接待过就把旗清掉");
  assert.equal(clearLifeAway(away, person.id).qualities[`life:${person.id}:away`], undefined);
});

test("冷落是单独一档：到访减得比卡上落点轻，拉客与带人一样归零", () => {
  // 冷落那一档不借卡上落点的第三档 —— 借了会把某一种打法的晚期局面压成一个形状
  // （16 副牌里两副撞成同一副）。这一条把「比落点轻、但拉客带人一样归零」钉住。
  assert.ok(AWAY_BIAS.arrive > LIFE_HOW_BIAS[3].arrive,
    `冷落的到访减量不该跟卡上落点一样重：${AWAY_BIAS.arrive} 对 ${LIFE_HOW_BIAS[3].arrive}`);
  assert.ok(AWAY_BIAS.arrive < 0, "冷落以后她还是该来得少一点");
  assert.equal(AWAY_BIAS.refer, -1, "她不替你拉客");
  assert.equal(AWAY_BIAS.bring, -1, "她不替你带人");
  // 走真实读数：被冷落的那一位，减的正是冷落这一档，不是卡上落点那一档。
  const flagged: World = { ...newWorld("away-tier", PEOPLE),
    qualities: { [`life:${person.id}:away`]: 1 } };
  assert.equal(lifeArriveChance(flagged, person.id, 0.5), 0.5 + AWAY_BIAS.arrive,
    "被冷落以后到访减的是冷落那一档");
});

test("旗不重复落：已经落过的那一位，下一次换季不再多落一个", () => {
  const world = withLife(newWorld("away-hard", PEOPLE));
  const once = nextSeason(world, PEOPLE);
  assert.equal(once.qualities[`life:${person.id}:away`], 1);
  const twice = nextSeason(once, PEOPLE);
  assert.equal(twice.qualities[`life:${person.id}:away`], 1, "同一面旗，不叠");
  // 第三档本来就不留人了；冷落她一整季不会让这一档再重一分 —— 冷落那一档是顶替，不是叠加。
  const base = withLife(newWorld("away-tier3", PEOPLE));
  const tier3: World = { ...base, qualities: { ...base.qualities, [`life:${person.id}:how`]: 3 } };
  const after = nextSeason(tier3, PEOPLE);
  const withFlag = lifeArriveChance(after, person.id, 0.5);
  const withoutFlag = lifeArriveChance({ ...after, qualities: { ...after.qualities, [`life:${person.id}:away`]: undefined } }, person.id, 0.5);
  assert.equal(withFlag, 0.5 + AWAY_BIAS.arrive, "冷落那一档顶替卡上的落点");
  assert.equal(withoutFlag, 0.5 + LIFE_HOW_BIAS[3].arrive, "没有旗，就是卡上落点那一档");
  assert.notEqual(withFlag, 0.5 + LIFE_HOW_BIAS[3].arrive + AWAY_BIAS.arrive, "不该两档叠着算");
});

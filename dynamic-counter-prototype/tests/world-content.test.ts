// 人情场内容体检。引擎不在这里测，只核对人和故事碎片对得上契约。
import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMERS } from "../src/campaign.ts";
import { FESTIVALS, festivalsFor } from "../src/world/content/festivals.ts";
import { CIRCLES, PEOPLE } from "../src/world/content/people.ts";
import { STORYLETS } from "../src/world/content/storylets.ts";
import { drawStorylet, newWorld, nextSeason } from "../src/world/engine.ts";
import { PLAYER, type Cond, type Effect, type Ref, type Temper, type World, type Zone } from "../src/world/types.ts";

const SEASON_DAYS = 28;
const TEMPERS: Temper[] = ["face", "wary", "warm", "gossip", "thrifty", "hasty", "loyal", "proud", "shy"];
const IDS = new Set(PEOPLE.map(p => p.id));
const RELATIONAL = (e: Effect) => "opinion" in e || "bond" in e || "remember" in e || "appoint" in e;

function walkCond(cond: Cond, refs: Ref[]) {
  if ("any" in cond) {
    for (const item of cond.any) walkCond(item, refs);
    return;
  }
  if ("not" in cond) {
    walkCond(cond.not, refs);
    return;
  }
  if ("present" in cond) refs.push(cond.present);
  else if ("absent" in cond) refs.push(cond.absent);
  else if ("opinion" in cond) refs.push(cond.opinion);
  else if ("bond" in cond) refs.push(cond.bond[0], cond.bond[1]);
  else if ("remembers" in cond) {
    refs.push(cond.remembers);
    if (cond.subject) refs.push(cond.subject);
  } else if ("temper" in cond) refs.push(cond.temper);
  else if ("role" in cond) refs.push(cond.role);
}

function walkEffect(effect: Effect, refs: Ref[]) {
  if ("remember" in effect) {
    refs.push(effect.remember.holder);
    if (effect.remember.subject) refs.push(effect.remember.subject);
  } else if ("appoint" in effect) {
    refs.push(effect.appoint.person);
    for (const id of effect.appoint.bring ?? []) refs.push(id);
  } else if ("leave" in effect) refs.push(effect.leave);
  else if ("opinion" in effect) refs.push(effect.opinion);
  else if ("bond" in effect) refs.push(effect.bond[0], effect.bond[1]);
}

function assertRef(ref: Ref, slots: Set<string>, where: string, social: boolean) {
  if (ref === "$self" || ref === PLAYER) return;
  if (ref.startsWith("$")) {
    assert.ok(slots.has(ref.slice(1)), `${where} 用了未声明的槽 ${ref}`);
    return;
  }
  if (social) assert.fail(`${where} 社交局写死了人物 ${ref}`);
  assert.ok(IDS.has(ref), `${where} 指向不存在的人 ${ref}`);
}

function placeholders(text: string, slots: Set<string>, where: string) {
  for (const hit of text.matchAll(/\{([^}]+)\}/g)) {
    const token = hit[1] ?? "";
    if (token === "player") continue;
    assert.match(token, /^\$[A-Za-z0-9_]+$/, `${where} 有未声明的占位 {${token}}`);
    assert.ok(slots.has(token.slice(1)), `${where} 的 {${token}} 没有对应角色槽`);
  }
}

test("人物、关系、脾气和主团", () => {
  assert.ok(PEOPLE.length >= 38 && PEOPLE.length <= 48, `人数 ${PEOPLE.length}`);
  assert.equal(new Set(PEOPLE.map(p => p.id)).size, PEOPLE.length, "人物 id 重复");

  const circleOf = new Map<string, string>();
  for (const [circle, members] of Object.entries(CIRCLES)) {
    for (const id of members) {
      assert.ok(IDS.has(id), `主团 ${circle} 里没有这个人：${id}`);
      assert.ok(!circleOf.has(id), `${id} 进了两个主团`);
      circleOf.set(id, circle);
    }
  }
  for (const person of PEOPLE) assert.ok(circleOf.has(person.id), `${person.name} 没有主团`);

  const temperCount = Object.fromEntries(TEMPERS.map(temper => [temper, 0])) as Record<Temper, number>;
  let bonds = 0;
  let cross = 0;
  for (const person of PEOPLE) {
    assert.ok(person.tempers.length >= 1 && person.tempers.length <= 2, `${person.name} 的脾气不是 1~2 个`);
    for (const temper of person.tempers) temperCount[temper] += 1;
    assert.ok(person.bonds.length >= 2, `${person.name} 的关系少于 2 条`);
    assert.equal(new Set(person.bonds.map(b => b.to)).size, person.bonds.length, `${person.name} 对同一个人写了两条`);
    const voice = [person.voice.greet, person.voice.pleased, person.voice.hurt, person.voice.praise, person.voice.complain];
    for (const line of voice) {
      assert.ok(line.trim().length > 0, `${person.name} 有空口吻`);
      for (const hit of line.matchAll(/\{([^}]+)\}/g)) {
        assert.ok(hit[1] === "player" || hit[1] === "x", `${person.name} 的口吻有未声明占位 {${hit[1]}}`);
      }
    }
    let crossed = 0;
    for (const bond of person.bonds) {
      assert.ok(IDS.has(bond.to), `${person.name} 的关系指向不存在的人 ${bond.to}`);
      assert.ok(bond.warmth >= -100 && bond.warmth <= 100, `${person.name} → ${bond.to} 冷暖出界`);
      const back = PEOPLE.find(p => p.id === bond.to)?.bonds.some(b => b.to === person.id);
      assert.ok(back, `${person.name} → ${bond.to} 没有回指`);
      if (circleOf.get(bond.to) !== circleOf.get(person.id)) crossed += 1;
      bonds += 1;
    }
    assert.ok(crossed >= 1, `${person.name} 没有跨团关系`);
    cross += crossed;
    if (person.skin?.buysFor) assert.ok(IDS.has(person.skin.buysFor), `${person.name} 的 buysFor 找不到人`);
    for (const cond of person.secret?.reveal ?? []) {
      const refs: Ref[] = [];
      walkCond(cond, refs);
      for (const ref of refs) assertRef(ref, new Set(), `${person.name} 的秘密`, false);
    }
    const days = person.visits.days;
    if (days !== "any") for (const day of days) assert.ok(day >= 1 && day <= 7, `${person.name} 的来访日`);
    for (const slot of person.visits.slots) assert.ok(slot >= 0 && slot <= 3);
    assert.ok(person.visits.chance >= 0 && person.visits.chance <= 1, person.name);
    for (const festival of person.visits.festivals ?? []) {
      assert.ok(FESTIVALS.some(item => item.id === festival), `${person.name} 的节日 ${festival} 没有声明`);
    }
  }
  for (const temper of TEMPERS) assert.ok(temperCount[temper] >= 3, `${temper} 只有 ${temperCount[temper]} 人`);
  assert.ok(bonds >= 80, `关系条数 ${bonds}`);
  assert.ok(cross >= 40, `跨团 ${cross}`);
});

test("旧人物的名字、皮肤和立绘沿用 campaign", () => {
  const customers = ["shen", "mei", "xiaoyu", "zhao", "anjie", "zhou", "duan"] as const;
  for (const id of customers) {
    const person = PEOPLE.find(p => p.id === id);
    const customer = CUSTOMERS[id];
    assert.ok(person, id);
    assert.equal(person.name, customer.name);
    assert.equal(person.role, "customer");
    assert.deepEqual(person.skin?.demands, customer.demands);
    assert.deepEqual(person.skin?.veto, customer.veto);
    assert.equal(person.skin?.budget, customer.budget);
    assert.equal(person.skin?.maxUnits, customer.maxUnits);
    assert.ok(person.portrait?.includes(`customer-${id}-consultation.png`), person.portrait);
  }
  for (const [id, file] of [
    ["roman", "roman.png"], ["suman", "suman.png"], ["tangke", "tangke.png"],
    ["fangmin", "fangmin.png"], ["luyao", "luyao.png"],
  ] as const) {
    const person = PEOPLE.find(p => p.id === id);
    assert.ok(person?.portrait?.includes(`staff-portraits/${file}`), id);
  }
  assert.equal(PEOPLE.find(p => p.id === "luyao")?.role, "rival");
  for (const id of ["qiaowan", "peilan", "roman", "suman", "tangke", "fangmin"]) {
    assert.equal(PEOPLE.find(p => p.id === id)?.role, "staff", id);
  }
  for (const id of ["ligui", "laokang", "huojie"]) assert.equal(PEOPLE.find(p => p.id === id)?.role, "mall", id);
});

test("一季 28 天里有 520、618、七夕", () => {
  assert.ok(FESTIVALS.length >= 2 && FESTIVALS.length <= 3);
  const ids = FESTIVALS.map(item => item.id);
  assert.deepEqual(new Set(ids).size, ids.length);
  for (const need of ["520", "618", "qixi"]) assert.ok(ids.includes(need), need);
  for (const festival of FESTIVALS) {
    assert.ok(festival.fromDay >= 1 && festival.toDay <= SEASON_DAYS && festival.fromDay <= festival.toDay, festival.id);
  }
});

test("节日按季取：第 1 季照旧，第 2 季双 11 / 双 12 / 年终盘点，第 3 季起循环", () => {
  assert.deepEqual(festivalsFor(1), FESTIVALS, "第 1 季就是 FESTIVALS");
  const two = festivalsFor(2).map(f => f.id);
  for (const need of ["double11", "double12", "yearend"]) assert.ok(two.includes(need), need);
  assert.equal(new Set(two).size, two.length, "第 2 季节日 id 不重复");
  for (const festival of festivalsFor(2)) {
    assert.ok(festival.fromDay >= 1 && festival.toDay <= SEASON_DAYS && festival.fromDay <= festival.toDay, festival.id);
  }
  assert.deepEqual(festivalsFor(3), festivalsFor(1), "第 3 季循环回第 1 季");
  assert.deepEqual(festivalsFor(4), festivalsFor(2), "第 4 季循环回第 2 季");
});

test("个人线走到终点的，换季以后那条线的卡不再抽得到", () => {
  // 四条个人线全走到落点：arc:<id>:end 跟着换季带过去，下一季所有 arc 卡都该被条件挡住。
  const ended = {
    ...newWorld("arc-done", PEOPLE),
    day: 28,
    qualities: {
      "arc:shen": 3, "arc:shen:end": 2, "arc:anjie": 3, "arc:anjie:end": 4,
      "arc:luyao": 3, "arc:luyao:end": 1, "arc:suman": 3, "arc:suman:end": 3,
    },
  };
  const w: World = nextSeason(ended, PEOPLE);
  assert.equal(w.day, 1, "换季后天数回到 1");
  const all = Object.fromEntries(PEOPLE.map(p => [p.id, "atrium" as Zone]));
  for (let i = 0; i < 20; i++) {
    const { drawn } = drawStorylet({ ...w, seed: `arc-done-${i}`, present: { ...all } }, PEOPLE, STORYLETS);
    assert.ok(!drawn || drawn.storylet.kind !== "arc",
      `第 2 季还抽到了已终结的个人线 ${drawn?.storylet.id}`);
  }
});

test("故事碎片的槽、占位、落点和关系效果", () => {
  assert.equal(new Set(STORYLETS.map(s => s.id)).size, STORYLETS.length, "故事 id 重复");
  const count = { social: 0, arc: 0, floor: 0 };
  const tension = { [-1]: 0, 0: 0, 1: 0 };
  const arcCards = new Map<string, number>();
  const arcEnds = new Map<string, Set<number>>();

  for (const story of STORYLETS) {
    count[story.kind] += 1;
    tension[story.tension] += 1;
    assert.ok(story.choices.length >= 2, story.id);
    const slots = new Set(Object.keys(story.cast));
    const social = story.kind === "social";
    const refs: Ref[] = [];
    for (const cond of story.when) walkCond(cond, refs);
    for (const slot of Object.values(story.cast)) for (const cond of slot.where) walkCond(cond, refs);
    placeholders(story.text, slots, story.id);
    if (social) assert.ok(story.choices.some(choice => (choice.when?.length ?? 0) > 0), `${story.id} 没有按条件分叉`);
    for (const choice of story.choices) {
      assert.ok(choice.effects.some(RELATIONAL), `${story.id} / ${choice.label} 没有改关系网`);
      for (const cond of choice.when ?? []) walkCond(cond, refs);
      placeholders(choice.label, slots, `${story.id} 选项`);
      placeholders(choice.result, slots, `${story.id} 结果`);
      for (const effect of choice.effects) {
        walkEffect(effect, refs);
        if ("log" in effect) placeholders(effect.log, slots, `${story.id} 记录`);
        if ("quality" in effect && effect.set !== undefined) {
          const end = /^arc:([^:]+):end$/.exec(effect.quality);
          if (end) {
            const bag = arcEnds.get(end[1] ?? "") ?? new Set<number>();
            bag.add(effect.set);
            arcEnds.set(end[1] ?? "", bag);
          }
        }
      }
    }
    for (const ref of refs) assertRef(ref, slots, story.id, social);
    for (const cond of story.when) {
      if ("festival" in cond) assert.ok(FESTIVALS.some(item => item.id === cond.festival), `${story.id} 的节日`);
    }
    if (story.kind === "arc") {
      const qualities: string[] = [];
      const take = (cond: Cond) => {
        if ("any" in cond) cond.any.forEach(take);
        else if ("not" in cond) take(cond.not);
        else if ("quality" in cond && cond.quality.startsWith("arc:")) qualities.push(cond.quality);
      };
      for (const cond of story.when) take(cond);
      const arc = /^arc:([^:]+)/.exec(qualities[0] ?? "");
      assert.ok(arc, `${story.id} 没有 arc:<id>`);
      arcCards.set(arc[1] ?? "", (arcCards.get(arc[1] ?? "") ?? 0) + 1);
    }
  }

  assert.ok(count.social >= 24, `社交局 ${count.social}`);
  assert.ok(count.floor >= 8, `楼层 ${count.floor}`);
  assert.ok(count.arc >= 12, `个人线 ${count.arc}`);
  assert.ok(tension[-1] > 0 && tension[0] > 0 && tension[1] > 0, "张力要有冲突也要有缓和");
  assert.ok(arcCards.size >= 4, `个人线人数 ${arcCards.size}`);
  for (const [id, cards] of arcCards) {
    assert.ok(cards >= 3, `${id} 只有 ${cards} 张`);
    const ends = arcEnds.get(id);
    assert.ok(ends && ends.size >= 2, `${id} 的落点只有 ${ends ? [...ends].join(",") : "没有"}`);
  }
});

// 人情场内容体检。引擎不在这里测，只核对人和故事碎片对得上契约。
import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMERS } from "../src/campaign.ts";
import { FESTIVALS, festivalsFor } from "../src/world/content/festivals.ts";
import { CIRCLES, PEOPLE } from "../src/world/content/people.ts";
import { MAINLINE_ACTS, STORYLETS } from "../src/world/content/index.ts";
import { CLUES } from "../src/world/content/clues.ts";
import { ARC_PEOPLE, arcLandings } from "../src/world/progress.ts";
import { absDay, applyChoice, beginSlot, choiceVisible, doVerb, drawStorylet, endDay, evalCond, newWorld, nextSeason, storyDeck } from "../src/world/engine.ts";
import { PLAYER, type Cond, type Effect, type PersonId, type Ref, type Storylet, type Temper, type World, type Zone } from "../src/world/types.ts";

const SEASON_DAYS = 28;
const TEMPERS: Temper[] = ["face", "wary", "warm", "gossip", "thrifty", "hasty", "loyal", "proud", "shy"];
const IDS = new Set(PEOPLE.map(p => p.id));
const RELATIONAL = (e: Effect) => "opinion" in e || "bond" in e || "remember" in e || "appoint" in e;

/** 全柜 quality 键的值域：内容里 `set` 过的具体值；只出现过 `delta` 的键算开口（静态判不动它的范围）。 */
const qualityValues = new Map<string, number[]>();
const openQuality = new Set<string>();
for (const s of STORYLETS) for (const c of s.choices) for (const e of c.effects) {
  if (!("quality" in e)) continue;
  if (typeof e.set === "number") {
    const list = qualityValues.get(e.quality) ?? [];
    if (!list.includes(e.set)) qualityValues.set(e.quality, [...list, e.set].sort((a, b) => a - b));
  } else openQuality.add(e.quality);
}

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

test("节日按季取：四季各一套，第 5 季起循环", () => {
  assert.deepEqual(festivalsFor(1), FESTIVALS, "第 1 季就是 FESTIVALS");
  const two = festivalsFor(2).map(f => f.id);
  for (const need of ["double11", "double12", "yearend"]) assert.ok(two.includes(need), need);
  assert.equal(new Set(two).size, two.length, "第 2 季节日 id 不重复");
  for (const festival of festivalsFor(2)) {
    assert.ok(festival.fromDay >= 1 && festival.toDay <= SEASON_DAYS && festival.fromDay <= festival.toDay, festival.id);
  }
  const three = festivalsFor(3).map(f => f.id);
  for (const need of ["valentine", "womens", "spring"]) assert.ok(three.includes(need), need);
  const four = festivalsFor(4).map(f => f.id);
  for (const need of ["school", "midautumn", "national"]) assert.ok(four.includes(need), need);
  for (const festival of [...festivalsFor(3), ...festivalsFor(4)]) {
    assert.ok(festival.fromDay >= 1 && festival.toDay <= SEASON_DAYS && festival.fromDay <= festival.toDay, festival.id);
  }
  const year = [1, 2, 3, 4].flatMap(n => festivalsFor(n).map(f => f.id));
  assert.equal(new Set(year).size, year.length, "一年里的节日 id 不重复");
  assert.deepEqual(festivalsFor(5), festivalsFor(1), "第 5 季循环回第 1 季");
  assert.deepEqual(festivalsFor(6), festivalsFor(2), "第 6 季循环回第 2 季");
  assert.deepEqual(festivalsFor(7), festivalsFor(3), "第 7 季循环回第 3 季");
});

test("个人线走到终点的，换季以后那条线的卡不再抽得到", () => {
  // 五条个人线全走到落点：arc:<id>:end 跟着换季带过去，下一季所有 arc 卡都该被条件挡住。
  const ended = {
    ...newWorld("arc-done", PEOPLE),
    day: 28,
    qualities: {
      "arc:shen": 3, "arc:shen:end": 2, "arc:anjie": 3, "arc:anjie:end": 4,
      "arc:luyao": 3, "arc:luyao:end": 1, "arc:suman": 3, "arc:suman:end": 3,
      "arc:mei": 3, "arc:mei:end": 1,
    },
  };
  const w: World = nextSeason(ended, PEOPLE);
  assert.equal(w.day, 1, "换季后天数回到 1");
  assert.equal(w.season, 2);
  const all = Object.fromEntries(PEOPLE.map(p => [p.id, "atrium" as Zone]));
  const seasonOneArc = /^arc-(shen|anjie|luyao|suman|mei)-/;
  for (let i = 0; i < 20; i++) {
    const { drawn } = drawStorylet({ ...w, seed: `arc-done-${i}`, present: { ...all } }, PEOPLE, STORYLETS);
    assert.ok(!drawn || !seasonOneArc.test(drawn.storylet.id),
      `第 2 季还抽到了已终结的个人线 ${drawn?.storylet.id}`);
  }
});

/** 回访卡（引力井）：走完的线原地留下的可重复卡。id 一律是 echo-<人>，值 = 她最晚第几季能落完点、回访从哪一季开。
 *  上面那条测的是"线走完了，原来的卡不再抽得到"，这一张测的是它的另一半：走完以后她这一季还得有戏。 */
const ECHO_FROM_SEASON = {
  shen: 2, anjie: 2, luyao: 2, suman: 2, xiaoyu: 2, zhou: 2, zhao: 2, miduo: 2, mei: 2,
  yinxiaojie: 3, duan: 3, zhaoning: 3,
} as const;
/** 还没有回访卡的八条：第 2 季那四条同事线（唐可 / 罗曼 / 方敏 / 乔晚）和第 3、4 季那四条（宋姐 / 白姐 / 裴岚 / 梁夏）。
 *  名单写死在这里，是为了让"补了 12 条"不被读成"20 条都补了"，也让新加的第二十一条线必须先选边。 */
const NO_ECHO_YET: PersonId[] = ["tangke", "roman", "fangmin", "qiaowan", "songjie", "baijie", "peilan", "liangxia"];

test("走完的线下一季还有她自己的卡可抽（回访卡）", () => {
  const allPresent = Object.fromEntries(PEOPLE.map(p => [p.id, "atrium" as Zone])) as Record<PersonId, Zone>;
  for (const [rawId, from] of Object.entries(ECHO_FROM_SEASON) as Array<[PersonId, number]>) {
    const card = STORYLETS.find(s => s.id === `echo-${rawId}`);
    assert.ok(card, `${rawId} 从第 ${from} 季起没有回访卡`);
    assert.equal(card.kind, "arc", `回访卡 ${card.id} 不是 arc，拿不到剧情卡那一份权重`);
    assert.ok(!card.once, `回访卡 ${card.id} 写了 once —— 演完一次就又断了`);
    assert.ok((card.cooldown ?? 0) >= SEASON_DAYS,
      `回访卡 ${card.id} 冷却 ${card.cooldown} 天：一季 28 天，第 1 天演过、第 28 天正好差 27 天又放行 —— 她要整季封顶才挡得住`);
    assert.ok(card.when.some(c => "quality" in c && c.quality === `arc:${rawId}:end` && c.gte === 1),
      `回访卡 ${card.id} 没有认「arc:${rawId}:end ≥ 1」这道门 —— 线还没走完就能抽到她的回访`);
    assert.ok(card.when.some(c => "season" in c && c.season.gte === from),
      `回访卡 ${card.id} 的开季门不是第 ${from} 季`);
    // 她当年怎么收的，这一季就怎么回来：每一档落点都要接得住，不许有落点走到"没格子可点"。
    for (const { landing } of arcLandings(STORYLETS, rawId)) {
      const w: World = {
        ...newWorld(`echo-${rawId}`, PEOPLE), season: from, day: 5, present: { ...allPresent },
        qualities: { [`arc:${rawId}`]: 3, [`arc:${rawId}:end`]: landing },
      };
      const hit = storyDeck(w, PEOPLE, STORYLETS, 0).eligible.find(e => e.storylet.id === card.id);
      assert.ok(hit, `${rawId} 落到第 ${landing} 档以后，第 ${from} 季她的回访卡不在牌堆里`);
      const shown = card.choices.filter(c => choiceVisible(w, PEOPLE, { storylet: card, binding: hit.binding }, c));
      assert.ok(shown.length > 0, `${rawId} 的回访卡在落点第 ${landing} 档上一格都点不出来`);
    }
  }
  assert.deepEqual(STORYLETS.filter(s => s.id.startsWith("echo-")).map(s => s.id).sort(),
    Object.keys(ECHO_FROM_SEASON).map(id => `echo-${id}`).sort(),
    "回访卡名单变了：加了要在 ECHO_FROM_SEASON 记一季，也要在设计文档那张表上补一笔");
  assert.deepEqual([...Object.keys(ECHO_FROM_SEASON), ...NO_ECHO_YET].sort(), [...ARC_PEOPLE].sort(),
    "个人线名册对不上：新加一条线得先说清它有没有回访卡");
});

test("回访卡整季封顶：第 1 天演过她，第 28 天不许再演第二次；换季以后照旧回得来", () => {
  // 上一版把冷却写成 27，理由是"一季 28 天等于每季一次"—— 差一天：判据是 `day - fired < cooldown`，
  // 第 1 天与第 28 天正好差 27，不小于 27，于是放行。40 副 × 4 季量到 80 回"同一张回访卡一季演两次"
  // （占回访卡出现的 6.3%），文档那句"一季最多演一次"是错的。这一条把边界钉死在真数字上。
  const allPresent = Object.fromEntries(PEOPLE.map(p => [p.id, "atrium" as Zone])) as Record<PersonId, Zone>;
  const at = (day: number, firedDay: number | null): World => ({
    ...newWorld("echo-cooldown", PEOPLE),
    season: 2, day, present: { ...allPresent },
    qualities: { "arc:shen": 3, "arc:shen:end": 1 },
    fired: firedDay === null ? {} : { "echo-shen": firedDay },
  });
  const inDeck = (w: World) => storyDeck(w, PEOPLE, STORYLETS, 0).eligible.some(e => e.storylet.id === "echo-shen");
  assert.ok(inDeck(at(1, null)), "第 1 天她本来就该在牌堆里 —— 下面那句要拿它当对照");
  assert.ok(!inDeck(at(28, 1)),
    "第 1 天演过、第 28 天（差 27 天）她又在牌堆里：冷却没到整季，同一张回访卡一季能演两回");
  // 另一半也要钉：封顶是"整季一次"，不是"整局一次"。冷却不许跨季记账。
  // （换季把 present 清空，所以人得重新摆回楼层上 —— 绑不出槽就跟这张卡没关系了。）
  assert.ok(inDeck({ ...nextSeason(at(28, 1), PEOPLE), present: { ...allPresent } }),
    "换季以后她回不来了 —— 回访卡的冷却跨了季，引力井变成一次性卡");
});

/** 「人生一步」（storylets-life.ts）名册：走完的线里那个人，自己的日子往前挪了一格。
 *  LIFE_STEP1 = 第 5 季那一步（把 life:<id> 从 0 写到 1，同时记下怎么落的 life:<id>:how），
 *  LIFE_STEP2 = 第 6 季那一步（认 life:<id> = 1，写到 2）。
 *  名单写死在这里：补人要在名单上选边，别让"这一批补了 11 张"被读成"20 条线都补了"。 */
const LIFE_STEP1: PersonId[] = ["shen", "anjie", "mei", "xiaoyu", "zhou", "suman", "luyao", "miduo",
  "zhao", "yinxiaojie", "duan", "zhaoning", "tangke", "roman", "fangmin", "qiaowan", "songjie", "baijie", "peilan", "liangxia"];
// 第 32 轮起两份名单等长（20 位两格梯子都有）。这里写第二份显式名单、不写 [...LIFE_STEP1]，
// 是为了补人的时候必须在名单上选边；两边不等长时后面那句「梯子中间断了一格」会红。
const LIFE_STEP2: PersonId[] = ["shen", "anjie", "mei", "xiaoyu", "zhou", "suman", "luyao", "miduo",
  "zhao", "yinxiaojie", "duan", "zhaoning", "tangke", "roman", "fangmin", "qiaowan", "songjie", "baijie", "peilan", "liangxia"];
/** 这颗门认不认「她收在第 L 档」这一件事 —— 只判 arc:<id>:end 那一条，其余门留给运行时那遍。 */
const endAdmits = (cond: Cond, id: PersonId, L: number): boolean => {
  if ("any" in cond) return cond.any.some(c => endAdmits(c, id, L));
  if ("not" in cond) return !endAdmits(cond.not, id, L);
  if ("quality" in cond && cond.quality === `arc:${id}:end`) {
    if ("eq" in cond) return cond.eq === L;
    if ("gte" in cond) return L >= cond.gte!;
    if ("lte" in cond) return L <= cond.lte!;
  }
  return false;
};
const ALL_PRESENT = Object.fromEntries(PEOPLE.map(p => [p.id, "atrium" as Zone])) as Record<PersonId, Zone>;
/** 摆一个"她的线走到哪一档、今年第几天"的场面（第 5/6 季那两类门都要用）。 */
const lifeWorld = (seed: string, season: number, qualities: Record<string, number>): World =>
  ({ ...newWorld(seed, PEOPLE), season, day: 5, present: { ...ALL_PRESENT }, qualities });
const deckOf = (w: World, id: string) => storyDeck(w, PEOPLE, STORYLETS, 0).eligible.find(e => e.storylet.id === id);

test("走完的线第 5 季有她自己的一步：门、每档落点接得住、不给钱、演过就不重演", () => {
  for (const rawId of LIFE_STEP1) {
    const card = STORYLETS.find(s => s.id === `life-${rawId}`);
    assert.ok(card, `${rawId} 第 5 季没有「人生一步」卡`);
    assert.equal(card.kind, "arc", `${card.id} 不是 arc，拿不到剧情卡那一份权重`);
    assert.ok(!card.once, `${card.id} 写了 once —— 这一步演完她今年就再也没有下文`);
    assert.ok((card.cooldown ?? 0) >= SEASON_DAYS,
      `${card.id} 冷却 ${card.cooldown} 天：判据是 day - fired < cooldown，第 1 天演过、第 28 天正好差 27 天又放行`);
    assert.ok(card.when.some(c => "season" in c && c.season.gte === 5), `${card.id} 没开在第 5 季`);
    assert.ok(card.when.some(c => "quality" in c && c.quality === `arc:${rawId}:end` && c.gte === 1),
      `${card.id} 没有「她那条线已经走完」这道门 —— 线没走完就演她这几年，会演出一个还没发生的人生`);
    assert.ok(card.when.some(c => "quality" in c && c.quality === `life:${rawId}` && c.lte === 0),
      `${card.id} 没有「这一步还没走过」这道门 —— 同一步每年重演一遍，她这几年就在原地打转`);
    for (const choice of card.choices) {
      for (const effect of choice.effects)
        assert.ok(!("stat" in effect && effect.stat === "money"),
          `${card.id}「${choice.label}」给了钱：这一批只管她在往前走，不管柜上多赚一笔`);
      // 每一步都得留下"怎么落的"，否则第 6 季那一步的几种说法里有几种永远接不上。
      const step = choice.effects.find(e => "quality" in e && e.quality === `life:${rawId}`);
      assert.ok(step && "set" in step && step.set === 1, `${card.id}「${choice.label}」没把 life:${rawId} 写成 1 —— 点了这一步等于没走`);
      const landed = choice.effects.find(e => "quality" in e && e.quality === `life:${rawId}:how`);
      assert.ok(landed && "set" in landed && [1, 2, 3].includes(landed.set ?? 0),
        `${card.id}「${choice.label}」没记下这一步怎么落的（life:${rawId}:how 要 1/2/3）`);
    }
    // 她当年收在哪一档，第 5 季这一步就该演得到，且至少点得动一格。
    const landings = arcLandings(STORYLETS, rawId);
    for (const { landing } of landings) {
      const w = lifeWorld(`life-${rawId}`, 5, { [`arc:${rawId}`]: 3, [`arc:${rawId}:end`]: landing });
      const hit = deckOf(w, card.id);
      assert.ok(hit, `${rawId} 落到第 ${landing} 档以后，第 5 季她的「人生一步」不在牌堆里`);
      const shown = card.choices.filter(c => choiceVisible(w, PEOPLE, { storylet: card, binding: hit!.binding }, c));
      assert.ok(shown.length > 0, `${card.id} 在落点第 ${landing} 档上一格都点不出来`);
      // 上面那句咬不住"分档"：没写 when 的兜底选项在任何一档都点得动。
      // 这一句要的是她收在哪一档，桌上就得有一句是为这一档写的 —— 不然 4 档与 6 档在她身上是同一句话。
      assert.ok(card.choices.some(c => (c.when ?? []).some(x => endAdmits(x, rawId, landing))),
        `${card.id} 落到第 ${landing} 档时没有一颗选项是为这一档写的 —— 她这几年的样子跟她怎么收场没关系了`);
    }
    // 反面两刀：线没走完不许演；这一步演过了不许再演第二次。
    assert.ok(!deckOf(lifeWorld(`life-${rawId}-open`, 5, { [`arc:${rawId}`]: 2 }), card.id),
      `${rawId} 的线还没走完（arc:${rawId}=2、没有落点），第 5 季她的这一步就在牌堆里`);
    assert.ok(!deckOf(lifeWorld(`life-${rawId}-done`, 5,
      { [`arc:${rawId}:end`]: landings[0]?.landing ?? 1, [`life:${rawId}`]: 1 }), card.id),
      `${rawId} 这一步去年已经走过，第 6 季她那张第 5 季的卡还在牌堆里`);
  }
  assert.deepEqual(STORYLETS.filter(s => /^life-/.test(s.id)).map(s => s.id).sort(),
    LIFE_STEP1.map(id => `life-${id}`).sort(), "「人生一步」名单变了：补人要在这两张名单上选边");
  assert.deepEqual(STORYLETS.filter(s => /^life2-/.test(s.id)).map(s => s.id).sort(),
    LIFE_STEP2.map(id => `life2-${id}`).sort(), "「下一步」名单变了：第 6 季那一步要给谁，要写进名单");
  assert.ok(LIFE_STEP2.every(id => LIFE_STEP1.includes(id)),
    "下一步给了一条还没走过第 5 季那一步的线 —— 梯子中间断了一格");
});

test("那一步的下一步：第 6 季按「上一步怎么落的」分叉，每一档都说得出话", () => {
  for (const rawId of LIFE_STEP2) {
    const step1 = STORYLETS.find(s => s.id === `life-${rawId}`)!;
    const card = STORYLETS.find(s => s.id === `life2-${rawId}`);
    assert.ok(card, `${rawId} 第 6 季没有「下一步」卡`);
    assert.ok(!card.once, `${card.id} 写了 once`);
    assert.ok((card.cooldown ?? 0) >= SEASON_DAYS, `${card.id} 冷却没到整季`);
    assert.ok(card.when.some(c => "season" in c && c.season.gte === 6), `${card.id} 没开在第 6 季`);
    assert.ok(card.when.some(c => "quality" in c && c.quality === `life:${rawId}` && c.eq === 1),
      `${card.id} 没有「去年那一步刚走完」这道门`);
    // 每一颗都得把梯子往前推一格并记下今年怎么落的 —— 否则点完这张卡，第 7 季那种「下一步」永远开不了。
    for (const choice of card.choices) {
      for (const effect of choice.effects)
        assert.ok(!("stat" in effect && effect.stat === "money"),
          `${card.id}「${choice.label}」给了钱：这一批只管她在往前走，不管柜上多赚一笔`);
      const step = choice.effects.find(e => "quality" in e && e.quality === `life:${rawId}`);
      assert.ok(step && "set" in step && step.set === 2,
        `${card.id}「${choice.label}」没把 life:${rawId} 写成 2 —— 今年这一步点完还停在去年那一格`);
      const landed = choice.effects.find(e => "quality" in e && e.quality === `life:${rawId}:how`);
      assert.ok(landed && "set" in landed && [1, 2, 3].includes(landed.set ?? 0),
        `${card.id}「${choice.label}」没记下今年怎么落的（life:${rawId}:how 要 1/2/3）`);
    }
    // how 能取到哪几档不靠猜：从第 5 季那一步真写得出的那些值里取。
    const hows = [...new Set(step1.choices
      .flatMap(c => c.effects.filter(e => "quality" in e && e.quality === `life:${rawId}:how`))
      .map(e => ("set" in e ? e.set : undefined)).filter((n): n is number => typeof n === "number"))].sort();
    assert.ok(hows.length >= 2, `${rawId} 的第 5 季那一步只有一种落法（${hows.join("/")}）—— 下一步没得可分叉`);
    for (const howValue of hows) {
      const w = lifeWorld(`life2-${rawId}-${howValue}`, 6,
        { [`arc:${rawId}:end`]: 1, [`life:${rawId}`]: 1, [`life:${rawId}:how`]: howValue });
      const hit = deckOf(w, card.id);
      assert.ok(hit, `${rawId} 去年按第 ${howValue} 种落法走完那一步，今年她的下一步不在牌堆里`);
      const shown = card.choices.filter(c => choiceVisible(w, PEOPLE, { storylet: card, binding: hit!.binding }, c));
      assert.ok(shown.length > 0, `${card.id} 在 how=${howValue} 那一档上一格都点不出来`);
      // 兜底那颗（没有 when）在任何一档都点得动，所以上面那句咬不住分叉：
      // 每一档必须有一句挂在同一个 how 读数上的话，否则去年怎么落的影响不出今年的一行字。
      assert.ok(shown.some(c => (c.when ?? []).some(x =>
        "quality" in x && x.quality === `life:${rawId}:how` && x.eq === howValue)),
        `${card.id} 在 how=${howValue} 那一档只由那颗没有门的兜底选项接住 —— 分叉白分了，这一档没有她自己的一句话`);
    }
    // 反面：去年那一步没演（life:<id> 缺席）不许跳到今年；今年演过了（=2）不许再演。
    const end0 = arcLandings(STORYLETS, rawId)[0]!.landing;
    assert.ok(!deckOf(lifeWorld(`life2-${rawId}-skip`, 6, { [`arc:${rawId}:end`]: end0 }), card.id),
      `${rawId} 去年那一步根本没演，今年「下一步」就在牌堆里 —— 梯子被跳过去一格`);
    assert.ok(!deckOf(lifeWorld(`life2-${rawId}-stepped`, 6,
      { [`arc:${rawId}:end`]: end0, [`life:${rawId}`]: 2, [`life:${rawId}:how`]: 1 }), card.id),
      `${rawId} 今年这一步已经走过，这张卡还在牌堆里`);
  }
});

// 第 7 季那一格（life:<id> 走到 3）：第 33 轮先给十位，第 35 轮铺满二十位 —— 三份名单现在等长。
const LIFE_STEP3: PersonId[] = ["shen", "anjie", "mei", "xiaoyu", "zhou", "suman", "luyao", "miduo", "zhao", "liangxia",
  "yinxiaojie", "duan", "zhaoning", "tangke", "roman", "fangmin", "qiaowan", "songjie", "baijie", "peilan"];

test("第 7 季那一格：前两年的账在这里结，格子不许缺也不许够不着", () => {
  assert.deepEqual(STORYLETS.filter(s => /^life3-/.test(s.id)).map(s => s.id).sort(),
    LIFE_STEP3.map(id => `life3-${id}`).sort(), "第 7 季那一份名单变了：要给谁，要在名单上选边");
  assert.ok(LIFE_STEP3.every(id => LIFE_STEP2.includes(id)),
    "第 7 季给了一条去年没走那一步的线 —— 梯子中间断了一格");
  for (const rawId of LIFE_STEP3) {
    const step2 = STORYLETS.find(s => s.id === `life2-${rawId}`)!;
    const card = STORYLETS.find(s => s.id === `life3-${rawId}`);
    assert.ok(card, `${rawId} 第 7 季没有那一张`);
    assert.ok(!card.once, `${card.id} 写了 once`);
    assert.ok((card.cooldown ?? 0) >= SEASON_DAYS, `${card.id} 冷却没到整季`);
    assert.ok(card.when.some(c => "season" in c && c.season.gte === 7), `${card.id} 没开在第 7 季`);
    assert.ok(card.when.some(c => "quality" in c && c.quality === `life:${rawId}` && c.eq === 2),
      `${card.id} 没有「去年那一步已经走过」这道门 —— 前两年的账没结完就跳到第三年`);
    for (const choice of card.choices) {
      for (const effect of choice.effects)
        assert.ok(!("stat" in effect && effect.stat === "money"),
          `${card.id}「${choice.label}」给了钱：这一批只管她在往前走，不管柜上多赚一笔`);
      const step = choice.effects.find(e => "quality" in e && e.quality === `life:${rawId}`);
      assert.ok(step && "set" in step && step.set === 3,
        `${card.id}「${choice.label}」没把 life:${rawId} 写成 3 —— 第三年这一步点完还停在去年那一格`);
      const landed = choice.effects.find(e => "quality" in e && e.quality === `life:${rawId}:how`);
      assert.ok(landed && "set" in landed && [1, 2, 3].includes(landed.set ?? 0),
        `${card.id}「${choice.label}」没记下第三年怎么落的（life:${rawId}:how 要 1/2/3）`);
    }
    // 去年写得出的读数（不靠猜：从 life2-<id> 的真实效果里取）逐档要有为它写的一句话 ——
    const hows = [...new Set(step2.choices
      .flatMap(c => c.effects.filter(e => "quality" in e && e.quality === `life:${rawId}:how`))
      .map(e => ("set" in e ? e.set : undefined)).filter((n): n is number => typeof n === "number"))].sort();
    assert.ok(hows.length >= 2, `${rawId} 去年那一步只有一种落法（${hows.join("/")}）—— 第三年没得可分叉`);
    // 反过来也要咬：为某一档写的话不许挂在去年取不到的读数上 —— 那一格就是永远点不着的死格子。
    const gated = new Set(card.choices.flatMap(c => (c.when ?? [])
      .filter(x => "quality" in x && x.quality === `life:${rawId}:how` && typeof x.eq === "number")
      .map(x => x.eq as number)));
    const dead = [...gated].filter(v => !hows.includes(v));
    assert.equal(dead.length, 0, `${card.id} 有 ${dead.length} 颗挂在这个柜够不着的门上：how=${dead.join("/")} —— 去年写不出这个数，这句玩家永远读不到`);
    for (const howValue of hows) {
      const w = lifeWorld(`life3-${rawId}-${howValue}`, 7,
        { [`arc:${rawId}:end`]: 1, [`life:${rawId}`]: 2, [`life:${rawId}:how`]: howValue });
      const hit = deckOf(w, card.id);
      assert.ok(hit, `${rawId} 去年按第 ${howValue} 种落法走完那一步，第 7 季她那一张不在牌堆里`);
      const shown = card.choices.filter(c => choiceVisible(w, PEOPLE, { storylet: card, binding: hit!.binding }, c));
      assert.ok(shown.some(c => (c.when ?? []).some(x =>
        "quality" in x && x.quality === `life:${rawId}:how` && x.eq === howValue)),
        `${card.id} 在 how=${howValue} 那一档只由兜底选项接住 —— 前两年怎么待她，第三年读不出差别`);
    }
    // 反面：去年那一步没演（life 是 1 或没有）不许跳到第三年；第三年演过了不许再演。
    const end1 = arcLandings(STORYLETS, rawId)[0]!.landing;
    assert.ok(!deckOf(lifeWorld(`life3-${rawId}-skip`, 7, { [`arc:${rawId}:end`]: end1, [`life:${rawId}`]: 1 }), card.id),
      `${rawId} 去年那一步刚演，第 7 季第三年的那张就在牌堆里 —— 梯子被跳过去一格`);
    assert.ok(!deckOf(lifeWorld(`life3-${rawId}-done`, 7,
      { [`arc:${rawId}:end`]: end1, [`life:${rawId}`]: 3, [`life:${rawId}:how`]: 1 }), card.id),
      `${rawId} 第三年已经走过，这张卡还在牌堆里`);
  }
});

// 第 8 季那一格（life:<id> 走到 4）：第 39 轮开的第四格，先给十位 —— 要给谁在名单上选边，不许悄悄加。
// 第四格不写成"又一年"，写成**这一格归谁由她自己给答案**；分叉读第三年那一档（第 34 轮那条通用守卫两头咬）。
const LIFE_STEP4: PersonId[] = ["shen", "anjie", "mei", "xiaoyu", "zhou", "suman", "luyao", "miduo", "zhao", "fangmin"];

test("第 8 季那一格：四年的账由她自己给答案，格子不许缺也不许够不着", () => {
  assert.deepEqual(STORYLETS.filter(s => /^life4-/.test(s.id)).map(s => s.id).sort(),
    LIFE_STEP4.map(id => `life4-${id}`).sort(), "第 8 季那一份名单变了：要给谁，要在名单上选边");
  assert.ok(LIFE_STEP4.every(id => LIFE_STEP3.includes(id)),
    "第 8 季给了一条第三年没走的线 —— 梯子中间断了一格");
  for (const rawId of LIFE_STEP4) {
    const step3 = STORYLETS.find(s => s.id === `life3-${rawId}`)!;
    const card = STORYLETS.find(s => s.id === `life4-${rawId}`);
    assert.ok(card, `${rawId} 第 8 季没有那一张`);
    assert.ok(!card.once, `${card.id} 写了 once`);
    assert.ok((card.cooldown ?? 0) >= SEASON_DAYS, `${card.id} 冷却没到整季`);
    assert.ok(card.when.some(c => "season" in c && c.season.gte === 8), `${card.id} 没开在第 8 季`);
    assert.ok(card.when.some(c => "quality" in c && c.quality === `life:${rawId}` && c.eq === 3),
      `${card.id} 没有「第三年那一步已经走过」这道门 —— 前三年的账没结完就跳到第四年`);
    for (const choice of card.choices) {
      for (const effect of choice.effects)
        assert.ok(!("stat" in effect && effect.stat === "money"),
          `${card.id}「${choice.label}」给了钱：第四格也只管她往前走，不管柜上多赚一笔`);
      const step = choice.effects.find(e => "quality" in e && e.quality === `life:${rawId}`);
      assert.ok(step && "set" in step && step.set === 4,
        `${card.id}「${choice.label}」没把 life:${rawId} 写成 4 —— 第四年这一步点完还停在第三年那一格`);
      const landed = choice.effects.find(e => "quality" in e && e.quality === `life:${rawId}:how`);
      assert.ok(landed && "set" in landed && [1, 2, 3].includes(landed.set ?? 0),
        `${card.id}「${choice.label}」没记下第四年怎么落的（life:${rawId}:how 要 1/2/3）`);
    }
    // 第三年写得出的读数（从 life3-<id> 的真实效果里取，不靠猜）逐档要有为它写的一句话；
    // 反过来，挂在第三年取不到的读数上的格子一颗都不许有。
    const hows = [...new Set(step3.choices
      .flatMap(c => c.effects.filter(e => "quality" in e && e.quality === `life:${rawId}:how`))
      .map(e => ("set" in e ? e.set : undefined)).filter((n): n is number => typeof n === "number"))].sort();
    assert.ok(hows.length >= 2, `${rawId} 第三年只有一种落法（${hows.join("/")}）—— 第四年没得可分叉`);
    // 兜底那一格照样要钉：牌堆不看选项级门（engine.ts:798 那段），三颗全部门认档时桌上会一颗都不剩。
    // 今天 life=3 必然带着 how∈[1,2,3]，这一句量不到东西；它是给以后（第五格、改档、手工存档）备的。
    assert.ok(card.choices.some(c => !c.when || !c.when.length),
      `${card.id} 没有保底那一格：三颗都认档，读数一对不上桌上就是空的`);
    const gated = new Set(card.choices.flatMap(c => (c.when ?? [])
      .filter(x => "quality" in x && x.quality === `life:${rawId}:how` && typeof x.eq === "number")
      .map(x => x.eq as number)));
    const dead = [...gated].filter(v => !hows.includes(v));
    assert.equal(dead.length, 0,
      `${card.id} 有 ${dead.length} 颗挂在第三年写不出的读数上：how=${dead.join("/")} —— 这句玩家永远读不到`);
    for (const howValue of hows) {
      const w = lifeWorld(`life4-${rawId}-${howValue}`, 8,
        { [`arc:${rawId}:end`]: 1, [`life:${rawId}`]: 3, [`life:${rawId}:how`]: howValue });
      const hit = deckOf(w, card.id);
      assert.ok(hit, `${rawId} 第三年按第 ${howValue} 种落法走完，第 8 季她那一张不在牌堆里`);
      const shown = card.choices.filter(c => choiceVisible(w, PEOPLE, { storylet: card, binding: hit!.binding }, c));
      assert.ok(shown.some(c => (c.when ?? []).some(x =>
        "quality" in x && x.quality === `life:${rawId}:how` && x.eq === howValue)),
        `${card.id} 在 how=${howValue} 那一档只由兜底选项接住 —— 前三年怎么待她，第四年读不出差别`);
    }
    // 反面：第三年刚演（life=2）不许跳到第四年；第四年演过了不许再演。
    const end1 = arcLandings(STORYLETS, rawId)[0]!.landing;
    assert.ok(!deckOf(lifeWorld(`life4-${rawId}-skip`, 8, { [`arc:${rawId}:end`]: end1, [`life:${rawId}`]: 2 }), card.id),
      `${rawId} 第三年刚演，第 8 季第四年的那张就在牌堆里 —— 梯子被跳过去一格`);
    assert.ok(!deckOf(lifeWorld(`life4-${rawId}-done`, 8,
      { [`arc:${rawId}:end`]: end1, [`life:${rawId}`]: 4, [`life:${rawId}:how`]: 1 }), card.id),
      `${rawId} 第四年已经走过，这张卡还在牌堆里`);
  }
  // 第四格只给十位：剩下十位今年仍空着，这一句把"没铺满"记成读数而不是遗漏（铺满是下一刀）。
  assert.equal(LIFE_STEP4.length, 10, "第 8 季那一份名单不再是十位 —— 三份等长的说法与文档那句要一起改");
});

test("梯子没有死格子：每一颗挂在去年读数上的选项，去年真写得出那个数", () => {
  // 第 30 轮那句「死格子」守卫只咬 life3- 那十张；这一条对所有梯卡开一遍，且不看名单 ——
  // 它第一次跑就抓到第 29 轮那批的两颗：life2-shen 挂 how=3、life2-anjie 挂 how=2，
  // 而上一年那张分别只写得出 [1,2] 和 [1,3]，那两句话玩家永远读不到。
  const writesHow = (id: PersonId, cardId: string): number[] | null => {
    const c = STORYLETS.find(s => s.id === cardId);
    if (!c) return null;
    return [...new Set(c.choices
      .flatMap(x => x.effects.filter(e => "quality" in e && e.quality === `life:${id}:how`))
      .map(e => ("set" in e ? e.set : undefined)).filter((n): n is number => typeof n === "number"))].sort();
  };
  const gatesHow = (id: PersonId, cardId: string): number[] => {
    const c = STORYLETS.find(s => s.id === cardId)!;
    return [...new Set(c.choices.flatMap(x => (x.when ?? [])
      .filter(w => "quality" in w && w.quality === `life:${id}:how` && typeof w.eq === "number")
      .map(w => w.eq as number)))].sort();
  };
  const cards = STORYLETS.filter(s => /^life[2-4]-/.test(s.id)).sort((a, b) => a.id.localeCompare(b.id));
  assert.ok(cards.length >= 50, `梯卡只剩 ${cards.length} 张（第 6、7、8 季三摞）：这条守卫是照整摞卡开的，卡少一批它就该红`);
  // 梯子的格序：life-（第 5 季）→ life2-（第 6 季）→ life3-（第 7 季）→ life4-（第 8 季）。
  // 守卫不看名单，只看格序 —— 加第五格时这里不用再改，只要前缀按这个次序排。
  const RUNG = ["life-", "life2-", "life3-", "life4-"];
  for (const card of cards) {
    const rung = RUNG.findIndex(p => card.id.startsWith(p));
    assert.ok(rung >= 1, `${card.id} 落在第 ${rung} 格 —— 守卫接不住这一格（RUNG 要往前加）`);
    const rawId = card.id.slice(RUNG[rung].length) as PersonId;
    const upId = `${RUNG[rung - 1]}${rawId}`;
    const prod = writesHow(rawId, upId);
    assert.ok(prod, `${card.id} 的上游 ${upId} 不存在 —— 梯子的这一段没接上`);
    const gated = gatesHow(rawId, card.id);
    const dead = gated.filter(v => !prod!.includes(v));
    assert.equal(dead.length, 0,
      `${card.id} 有 ${dead.length} 颗挂在去年写不出的读数上：how=${dead.join("/")} —— 这一档的话玩家永远读不到`);
    const missing = prod!.filter(v => !gated.includes(v));
    assert.equal(missing.length, 0,
      `${card.id} 少了一档：去年写得出 how=${missing.join("/")}，今年没有一颗选项是为这一档写的`);
  }
});

test("全柜条件可达性：没有一颗门读一个谁也写不出的数，也没有一处自己跟自己矛盾", () => {
  // 第 34 轮那个洞（选项挂在一个去年永远写不出的 how 上）不是梯子里独有的，任何一张卡都可能。
  // 这一条把同一件事对所有卡开一遍，四类都是静态判得动的：
  // A 一颗门读的 quality 值，全柜没有任何效果写得出；B clue id 不存在；C 问一个没有秘密的人的秘密；D 属性说错了人。
  // 注意"引擎自己会写的键"不算：clue:/thread:/mainline:/secret-/wechat:/away:/bought:/served: 这些内容由引擎记账，
  // arc:<id>（不带 :end）也是引擎递增的 —— 把它们当闭合值域会报一堆假洞（第一版探针就把 arc: 整族算进去了）。
  const ENGINE_PREFIX = ["clue:", "thread:", "mainline:", "secret-", "wechat:", "away:", "bought:", "served:",
    "storyteller:", "handoff-sale:", "standing:"];
  const isOpenKey = (k: string) => openQuality.has(k) || ENGINE_PREFIX.some(p => k.startsWith(p)) || /^arc:[a-z]+$/.test(k);
  const clueIds = new Set(CLUES.map(c => c.id));
  const bad: string[] = [];
  // 只在同一层"并且"关系里判矛盾：{ any: [eq 3, gte 4] } 是"或者"，不是自相矛盾（所以绝不往 any 里递归判这条）。
  const contradictions = (owner: string, where: string, conds: Cond[]) => {
    const lo: Record<string, number> = {}, hi: Record<string, number> = {}, hard: Record<string, number> = {};
    for (const c of conds) {
      if ("any" in c || "not" in c) continue;
      const key = "quality" in c ? `q:${c.quality}` : "opinion" in c ? `o:${String(c.opinion)}` : "bond" in c ? `b:${c.bond.join(">")}` : null;
      if (!key) continue;
      const g = (c as { gte?: number }).gte, l = (c as { lte?: number }).lte, e = (c as { eq?: number }).eq;
      if (typeof g === "number") lo[key] = Math.max(lo[key] ?? -1e9, g);
      if (typeof l === "number") hi[key] = Math.min(hi[key] ?? 1e9, l);
      if (typeof e === "number") hard[key] = e;
    }
    for (const key of Object.keys(hard)) {
      const e = hard[key];
      if ((key in lo && e < lo[key]) || (key in hi && e > hi[key]))
        bad.push(`${owner} ${where}: 对 ${key} 既要 == ${e}，又要${key in lo ? ` >= ${lo[key]}` : ""}${key in hi ? ` <= ${hi[key]}` : ""} —— 这一颗永远点不亮`);
    }
    for (const key of Object.keys(lo))
      if (key in hi && lo[key] > hi[key]) bad.push(`${owner} ${where}: 对 ${key} 既要 >= ${lo[key]} 又要 <= ${hi[key]} —— 无解`);
  };
  let visited = 0;
  // 只钉"打算扫多少"是假绿：把 scan 那一行的入参切成空数组，计数照旧对得上，扫描却一次没做。
  // 所以钉两个数：枚举出来的条件数 == 守卫真正看过的大小。
  const countConds = (cs: Cond[]): number =>
    cs.reduce((a, c) => a + 1 + ("any" in c ? countConds(c.any) : "not" in c ? countConds([c.not]) : 0), 0);
  // 值域那一类只能在"并且"层判：{ any: [end==1, end>=5] } 整组是 satisfiable 的（走第一支），
  // 但里面的 `end >= 5` 单独看写不出 —— 递归进去就会报假洞（U3b 就是这么抓出我自己的错的）。
  // 线索 id、属性、指到不存在的人这三类与"或者"无关，照旧往 any / not 里递归。
  const scan = (owner: string, where: string, conds: Cond[], andLevel = true) => {
    for (const c of conds) {
      visited++;
      if ("any" in c) { scan(owner, `${where}（any 里）`, c.any, false); continue; }
      if ("not" in c) { scan(owner, `${where}（取反里）`, [c.not], false); continue; }
      if (andLevel && "quality" in c && !isOpenKey(c.quality)) {
        const vals = qualityValues.get(c.quality) ?? [];
        if (typeof c.eq === "number" && c.eq > 0 && !vals.includes(c.eq))
          bad.push(`${owner} ${where}: 读 ${c.quality} === ${c.eq}，可全柜写得出的只有 [${vals.join(",") || "没人写这个键"}]`);
        if (typeof c.gte === "number" && c.gte >= 1 && !vals.some(v => v >= c.gte!))
          bad.push(`${owner} ${where}: 读 ${c.quality} >= ${c.gte}，写得出的最大是 ${vals.length ? Math.max(...vals) : "没有"}`);
      }
      if ("clue" in c && !clueIds.has(c.clue)) bad.push(`${owner} ${where}: clue "${c.clue}" 不在 CLUES（共 ${clueIds.size} 条）`);
      const secretOf = (v: unknown) => (typeof v === "string" && !v.startsWith("$") ? PEOPLE.find(p => p.id === v) : undefined);
      if ("knowsSecret" in c) {
        const p = secretOf(c.knowsSecret);
        if (p && !p.secret) bad.push(`${owner} ${where}: 问 ${p.name} 的秘密，可人物表里她没写 secret`);
      }
      if ("quality" in c && /^secret-(known|kept|out|backfired):/.test(c.quality)) {
        const p = secretOf(c.quality.split(":")[1]);
        if (p && !p.secret) bad.push(`${owner} ${where}: 读 ${c.quality}，可 ${p.name} 没有秘密可揭`);
      }
      if ("temper" in c && !String(c.temper).startsWith("$")) {
        const p = PEOPLE.find(x => x.id === c.temper);
        if (p && c.is && !p.tempers.includes(c.is)) bad.push(`${owner} ${where}: 说 ${p.name} 脾气是「${c.is}」，人物表里她是 [${p.tempers.join(",")}]`);
      }
      if ("role" in c && !String(c.role).startsWith("$")) {
        const p = PEOPLE.find(x => x.id === c.role);
        if (p && c.is && p.role !== c.is) bad.push(`${owner} ${where}: 说 ${p.name} 身份是「${c.is}」，人物表里是「${p.role}」`);
      }
      if ("gender" in c && !String(c.gender).startsWith("$")) {
        const p = PEOPLE.find(x => x.id === c.gender);
        if (p && c.is && p.gender !== c.is) bad.push(`${owner} ${where}: 说 ${p.name} 是「${c.is}」，人物表里是「${p.gender}」`);
      }
      for (const ref of ["present", "absent", "opinion", "temper", "role", "gender"] as const) {
        if (ref in c && typeof (c as Record<string, unknown>)[ref] === "string" && !String((c as Record<string, unknown>)[ref]).startsWith("$")) {
          const id = String((c as Record<string, unknown>)[ref]);
          if (!PEOPLE.some(x => x.id === id)) bad.push(`${owner} ${where}: ${ref} 指到 "${id}" —— 不在人物表里`);
        }
      }
    }
  };
  let total = 0, choiceConds = 0;
  for (const s of STORYLETS) {
    total += countConds(s.when);
    contradictions(s.id, "卡级", s.when);
    scan(s.id, "卡级", s.when);
    s.choices.forEach((c, i) => {
      const n = countConds(c.when ?? []);
      total += n;
      choiceConds += n;
      contradictions(s.id, `第${i + 1}颗「${c.label}」`, c.when ?? []);
      scan(s.id, `第${i + 1}颗「${c.label}」`, c.when ?? []);
    });
  }
  // 这条守卫的价值全在"扫得到全部条件"上：读数掉了说明它悄悄漏了范围（比如新加一种 when 写法没进这里）。
  // 两个数都要钉 —— 只钉枚举数的话，"扫描那一行被换成空数组"这种漏法看不见（U6 第一版就是这么溜过去的）。
  assert.ok(STORYLETS.length > 300, `只扫了 ${STORYLETS.length} 张卡：范围缩水了，这条守卫会假绿`);
  assert.ok(choiceConds > 300, `选项上的门只枚举到 ${choiceConds} 道：这一层的门最容易写错（第 34 轮那个洞就在这层），漏了它整条守卫就是假绿`);
  assert.equal(visited, total, `枚举到 ${total} 道条件，守卫只看了 ${visited} 道 —— 有一层没扫到，这条守卫在假绿`);
  assert.equal(bad.length, 0, bad.slice(0, 25).join("\n  "));
});

test("往牌堆加一张晚季才开的卡，前四季抽到的卡逐位不动", () => {
  // 量到的机制：bindCast 每扫一张卡就按槽数推进 rngCalls，而卡级 when 是在绑定走完以后才判的，
  // 所以"这一季根本开不了"的卡照样消耗随机流。上一轮加 11 张第 5 季才开的卡，四季那两条经验判据里
  // slip-tape 从 10/12 掉到 9/12 —— 内容没挡住内容，是抽样流被挪了位。
  // 现在改成：不看槽的那几道门先判，判不过就连随机流一起不碰。这一条钉的是这个不变量。
  const late: Storylet = {
    id: "late-gate-probe", kind: "arc", cast: { a: { id: "shen", where: [] } },
    when: [{ season: { gte: 5 } }, { quality: "arc:shen:end", gte: 1 }],
    weight: 90, tension: 0, cooldown: 28,
    text: "{$a}站在镜前，一句话没说。",
    choices: [
      { label: "问一句", effects: [{ opinion: "$a", delta: 1 }], result: "{$a}点头。" },
      { label: "先不问", effects: [{ opinion: "$a", delta: -1 }], result: "{$a}自己坐了很久。" },
    ],
  };
  const play = (pool: Storylet[]) => {
    let w = newWorld("late-gate", PEOPLE);
    const seq: string[] = [];
    for (let s = 1; s <= 4; s++) {
      while (w.day <= SEASON_DAYS) {
        for (const slot of [0, 1, 2, 3] as const) {
          w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
          const { drawn } = drawStorylet(w, PEOPLE, pool);
          if (!drawn) continue;
          seq.push(`${drawn.storylet.id}@${w.season}.${w.day}.${slot}`);
          const idx = drawn.storylet.choices.findIndex(c => choiceVisible(w, PEOPLE, drawn, c));
          if (idx >= 0) w = applyChoice(w, PEOPLE, drawn, idx);
        }
        w = endDay(w, PEOPLE);
      }
      if (s < 4) w = nextSeason(w, PEOPLE);
    }
    return { seq, rngCalls: w.rngCalls };
  };
  const base = play(STORYLETS);
  // 放在牌堆最前面：旧写法下这一张的槽会把后面每一张的抽样起点往后挪一格。
  const withLate = play([late, ...STORYLETS]);
  assert.deepEqual(withLate.seq, base.seq,
    `牌堆多了一张第 5 季才开的卡，前四季抽到的卡就变了（第 ${withLate.seq.findIndex((x, i) => x !== base.seq[i]) + 1} 格起不一样）`);
  assert.equal(withLate.rngCalls, base.rngCalls, "牌堆多了一张开不了的卡，随机流却多走了几步");
  // 另一半必须钉住：这张卡在第 5 季真的要进牌堆、也要真消耗一次绑定随机 ——
  // 否则上面那两句绿得毫无意义（把门写错、这张卡永远开不了，也是"逐位不动"）。
  const open = lifeWorld("late-gate-5", 5, { "arc:shen": 3, "arc:shen:end": 1 });
  assert.ok(storyDeck(open, PEOPLE, [late, ...STORYLETS], 0).eligible.some(e => e.storylet.id === late.id),
    "这张卡第 5 季根本进不了牌堆 —— 前面那句「逐位不动」是因为它一整年都不合法，不是因为门先判掉了");
  assert.equal(storyDeck(open, PEOPLE, [late], 0).cursor.rngCalls - open.rngCalls, 1,
    "它进牌堆时按槽数消耗随机流（1 个槽 = 1 步），不然整副牌的顺序就不只是'多了一张卡'而是被重排了");
});

test("连玩六副八季：第 5、6、7、8 季真演到那四步（经验判据）", () => {
  // 这一条就是任务 26 的验收判据：第 29 轮之前量到第 5、6 季各抽到 15 次故事卡、新演 0 张。
  // 走法照抄 slip-tape 那条（每格只 greet、可见格之间均匀随机取）。第 35 轮三格都铺满以后实测
  // 6 副各是第 5 季 19~20 张一步、第 6 季 19~20 张二步、第 7 季 19~20 张三步（各 20 张），
  // 且第 5 季一张「二步」都不演、第 6 季一张「三步」都不演（梯子不跳格那一半由静态守卫钉，这一半要真走一遍）；
  // 跑 6 副是为了把整条规则测试的时间压住，阈值留出余量。
  let state = 1;
  const rand = () => { state = (state * 1103515245 + 12345) & 0x7fffffff; return state / 0x7fffffff; };
  const playSeason = (world: World, fired: string[]) => {
    let w = world;
    while (w.day <= SEASON_DAYS) {
      for (const slot of [0, 1, 2, 3] as const) {
        w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
        for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        if (!drawn) continue;
        const vis = drawn.storylet.choices.map((c, i) => i).filter(i => choiceVisible(w, PEOPLE, drawn, drawn.storylet.choices[i]));
        if (!vis.length) continue;
        w = applyChoice(w, PEOPLE, drawn, vis[Math.floor(rand() * vis.length)] ?? vis[0]!);
        if (!fired.includes(drawn.storylet.id)) fired.push(drawn.storylet.id);
      }
      w = endDay(w, PEOPLE);
    }
    return w;
  };
  for (let i = 0; i < 6; i++) {
    state = 7 + i * 104729;
    let w = newWorld(`tape-${i}`, PEOPLE);
    for (let s = 1; s < 5; s++) { w = playSeason(w, []); w = nextSeason(w, PEOPLE); }
    const five: string[] = [];
    w = playSeason(w, five);
    w = nextSeason(w, PEOPLE);
    const six: string[] = [];
    w = playSeason(w, six);
    w = nextSeason(w, PEOPLE);
    const seven: string[] = [];
    w = playSeason(w, seven);
    w = nextSeason(w, PEOPLE);
    const eight: string[] = [];
    w = playSeason(w, eight);
    const step1 = five.filter(id => /^life-/.test(id)).length;
    const step2Early = five.filter(id => /^life2-/.test(id)).length;
    const step2 = six.filter(id => /^life2-/.test(id)).length;
    const step3Early = six.filter(id => /^life3-/.test(id)).length;
    const step3 = seven.filter(id => /^life3-/.test(id)).length;
    const step4Early = seven.filter(id => /^life4-/.test(id)).length;
    const step4 = eight.filter(id => /^life4-/.test(id)).length;
    assert.equal(step2Early, 0, `副 ${i}：第 5 季就演到了「下一步」（${step2Early} 张）—— 梯子提前塌了一格`);
    assert.equal(step3Early, 0, `副 ${i}：第 6 季就演到了第三年那一张（${step3Early} 张）—— 两年的账没走完就结算`);
    assert.equal(step4Early, 0, `副 ${i}：第 7 季就演到了第四格（${step4Early} 张）—— 三年的账没结完就跳到四年`);
    assert.ok(step1 >= 16, `副 ${i}：第 5 季只演到 ${step1} 张「人生一步」（20 张里）—— 补齐名单以后第 5 季还是没新剧情`);
    assert.ok(step2 >= 17, `副 ${i}：第 6 季只演到 ${step2} 张「下一步」（20 张里）—— 去年的那一步没接到今年`);
    // 阈值按实测：第 35 轮铺满二十位以后，6 副各是第 7 季 19~20 张（共 20 张）。
    assert.ok(step3 >= 17, `副 ${i}：第 7 季只演到 ${step3} 张第三年那一张（20 张里）—— 前两年的账在这一季结不掉`);
    // 第 39 轮开第四格：先只给十位（名单钉子在那一条里）。阈值不猜：X1 那次把这句抬到 11，
    // 副 0 报回来的是「只演到 10 张（10 张里）」—— 这一季十位全演到。这里钉 9 留一颗余量，
    // 它绿就同时说明 6 副每一副都 ≥9。这一句量的是"第 8 季真的有新剧情可演"，第 29 轮之前那一季读的是 0 张。
    assert.ok(step4 >= 9, `副 ${i}：第 8 季只演到 ${step4} 张第四格（10 张里）—— 开了一格却演不到，等于没开`);
  }
});

test("「名字是借的」不再只有一个写入方：走完的线回第二趟时替主线作证", () => {
  // 量到的洞：六条线索里只有 slip-borrowed 拿不全 —— 40 副 naive 走法 22/40，其余五条都 40/40，
  // 而主线那边有五张卡的 when 读着它（main-slip-shen / -yin / -fang / -turn / -turn-desk）。
  // 这一条是整条退货单的反转枢纽（名字是借的 ⇒ 单子不是沈薇退的），漏掉等于 45% 的人玩到的故事少一节。
  const writes = (c: { effects: Effect[] }) => c.effects.some(e => "clue" in e && e.clue === "slip-borrowed");
  const writers = STORYLETS.filter(s => s.choices.some(writes));
  // 静态有三张写它（main-slip-song / main-a2-audit / main-a2-mirror），但后两张各是那张卡的第二格，
  // 而下面那条走法永远取第一格 —— 实测 40 副里真写过这条的只有 song 一张。所以这一句量的是"够不够四条路"，
  // 不是"之前有没有路"；补没补上，认的是下面那条经验判据。
  assert.ok(writers.length >= 4,
    `只有 ${writers.length} 张卡写这条线索（${writers.map(w => w.id).join("、")}）—— 一张卡漏掉就是几成人玩不到那个反转`);
  // [卡 id, 那条线的人, 最早第几季能回第二趟]
  const second: Array<[string, PersonId, number]> = [["echo2-shen", "shen", 2], ["echo2-xiaoyu", "xiaoyu", 2], ["echo2-zhou", "zhou", 3]];
  for (const [id, person, from] of second) {
    const card = STORYLETS.find(s => s.id === id);
    assert.ok(card, `${id} 不在了 —— 主线那条替代路径断了一条`);
    const gated = card.choices.filter(writes);
    assert.equal(gated.length, 1, `${id} 写这条线索的格子该只有一格`);
    assert.ok(gated[0].when?.some(c => "not" in c && "clue" in c.not && c.not.clue === "slip-borrowed"),
      `${id} 那一格没带「本子上还没有这一条」这道门 —— 已经知道的人要再看一遍同样的话`);
    assert.ok(card.choices.some(c => !c.when?.length), `${id} 没有保底那一格：门都对不上时桌上是空的`);
    assert.ok(!card.once, `${id} 写了 once —— 第二回回访变成一次性卡`);
    assert.ok((card.cooldown ?? 0) >= SEASON_DAYS, `${id} 冷却不到整季`);
    assert.ok(card.when.some(c => "quality" in c && c.quality === `arc:${person}:end` && c.gte === 1),
      `${id} 没认「arc:${person}:end ≥ 1」这道门 —— 线还没走完就能回第二趟`);
    assert.ok(card.when.some(c => "season" in c && c.season.gte === from),
      `${id} 的开季门不是第 ${from} 季 —— 走完那一季当场就回头演，玩家来不及把她当上一季的人`);
  }

  // 静态那四条只证明"卡上有这一格"，不证明"抽得到、点得下去、点完本子上多一行"。
  // 下面这一副牌是照本子的真实形状拼的：宋姐那张已经演过（fired 挡着，本子上却没有这条线索 ——
  // 那正是 22/40 里剩下的 18 副），这回访卡必须自己把这一行写进本子。
  const everywhere = Object.fromEntries(PEOPLE.map(p => [p.id, "atrium" as Zone])) as Record<PersonId, Zone>;
  for (const [id, person, from] of second) {
    const card = STORYLETS.find(s => s.id === id)!;
    const base = newWorld(id, PEOPLE);
    const w: World = {
      ...base,
      season: from, day: 9, present: { ...everywhere },
      qualities: { [`arc:${person}`]: 3, [`arc:${person}:end`]: 1 },
      opinion: { ...base.opinion, [person]: 20 },
      fired: { "main-slip-song": 3 },
    };
    const hit = storyDeck(w, PEOPLE, STORYLETS, 0).eligible.find(e => e.storylet.id === id);
    assert.ok(hit, `${id} 在「宋姐那张演过、本子上还没有这一条」的牌里抽不到 —— 这条路根本没接上主线`);
    const idx = card.choices.findIndex(c => writes(c) && choiceVisible(w, PEOPLE, hit, c));
    assert.ok(idx >= 0, `${id} 那一格在看法够高、本子上没有这条时该露出来`);
    assert.ok(applyChoice(w, PEOPLE, hit, idx).qualities["clue:slip-borrowed"],
      `${id} 点下去本子上没多这一行 —— 替代路径是假的`);
  }
  assert.deepEqual(STORYLETS.filter(s => s.id.startsWith("echo2")).map(s => s.id).sort(),
    second.map(([id]) => id).sort(),
    "第二回回访卡的名单变了：补一张要在上面那两条判据里点名，也要在界面演出里演一遍");
});

test("「录进去的是你的原话」由她那条线补上：个人线卡往主线本子里落一行", () => {
  // 量到的洞（第 27 轮）：这条线索原来只有两张主线卡写得进，而每张都是"三格里的一格"。
  // 拿模拟器那个政策（格在可见格之间均匀随机）数 24 副 × 4 季只落到 10 副 —— 抽到那张卡不等于点到那一格。
  // 更要紧的是 `main-act3-tape` 整张卡认这条线索：漏掉的人连第 3 幕那一幕都看不见。
  const writesTape = (c: { effects: Effect[] }) => c.effects.some(e => "clue" in e && e.clue === "slip-tape");
  const writers = STORYLETS.filter(s => s.choices.some(writesTape));
  const ids = writers.map(s => s.id);
  assert.ok(ids.includes("arc-yin-tape") && ids.includes("echo-yinxiaojie"),
    `写「录进去的是你的原话」的是 ${ids.join("、")} —— 她那条线本来就在讲那支笔，这一行该由她补进本子`);
  assert.ok(writers.length >= 4,
    `只有 ${writers.length} 张卡写这条线索（${ids.join("、")}）—— 每张只有一格写它时，漏一格就是几成人少一幕`);
  // 本轮不动经济：这几格要是开始给钱，第 26 轮那张钱数表就再也比不了了。
  for (const id of ["arc-yin-tape", "echo-yinxiaojie", "arc-pl-who"]) {
    const card = STORYLETS.find(s => s.id === id)!;
    for (const c of card.choices.filter(c => writesTape(c) || c.effects.some(e => "clue" in e && e.clue === "slip-roster")))
      assert.ok(!c.effects.some(e => "stat" in e && e.stat === "money"),
        `${id} 落线索那一格开始给钱了 —— 补本子的这一刀从此混进经济账`);
  }

  const everywhere = Object.fromEntries(PEOPLE.map(p => [p.id, "atrium" as Zone])) as Record<PersonId, Zone>;
  const base = newWorld("arc-yin-tape", PEOPLE);
  const w: World = { ...base, season: 2, day: 9, present: { ...everywhere }, qualities: { "arc:yinxiaojie": 2 } };
  const card = STORYLETS.find(s => s.id === "arc-yin-tape")!;
  const hit = storyDeck(w, PEOPLE, STORYLETS, 0).eligible.find(e => e.storylet.id === "arc-yin-tape");
  assert.ok(hit, "她那条线讲录音那一张在「线走到第二档、本子上还没有这条」的牌里抽不到 —— 替代路径没接上");
  const idx = card.choices.findIndex(c => writesTape(c) && choiceVisible(w, PEOPLE, hit!, c));
  assert.ok(idx >= 0, "她那两格讲笔的该露出来（这一格不带线索门，本子上有没有都得讲）");
  assert.equal(applyChoice(w, PEOPLE, hit!, idx).qualities["clue:slip-tape"], absDay(w),
    "点下去本子上没多这一行 —— 个人线补主线是假的");
  // 本子上已经有这一条：`learnClue` 认过就不改写，日子不许被后面那张卡挪到更晚。
  const known: World = { ...w, qualities: { "arc:yinxiaojie": 2, "clue:slip-tape": 12 } };
  const again = applyChoice(known, PEOPLE, hit!, idx);
  assert.equal(again.qualities["clue:slip-tape"], 12, "同一条线索被第二张卡改写了日子 —— 本子上的先后乱了");
});

test("裴岚那句「记在一个当时顶班的人手上」得真的落进本子", () => {
  // 第 27 轮：这一格的台词就是那条事实，可它原来只动关系与台账，本子上什么也不多一行
  // （`slip-roster` 拿模拟器那个政策数 24 副只落 18 副）。台词写了、本子没记，是内容写歪。
  const card = STORYLETS.find(s => s.id === "arc-pl-who");
  assert.ok(card, "arc-pl-who 不在了");
  const idx = card.choices.findIndex(c => c.label === "方敏那一行到底记在谁名下");
  assert.ok(idx >= 0, "arc-pl-who 那一格改了说法，判据要点名它");
  assert.ok(card.choices[idx]!.effects.some(e => "clue" in e && e.clue === "slip-roster"),
    "她说出了「当时顶班的人」却没把这一条写进本子 —— 台词写了、本子没记");
  const everywhere = Object.fromEntries(PEOPLE.map(p => [p.id, "atrium" as Zone])) as Record<PersonId, Zone>;
  const base = newWorld("arc-pl-who", PEOPLE);
  const w: World = {
    ...base, season: 4, day: 9, present: { ...everywhere },
    qualities: { "arc:peilan": 1, "thread:return-slip": 7 },
  };
  const hit = storyDeck(w, PEOPLE, STORYLETS, 0).eligible.find(e => e.storylet.id === "arc-pl-who");
  assert.ok(hit, "裴岚那条线在「单子已经翻过来、她刚开头」的牌里抽不到");
  assert.ok(choiceVisible(w, PEOPLE, hit!, card.choices[idx]!),
    "那一格在退货单已经翻过来时该露出来");
  assert.ok(applyChoice(w, PEOPLE, hit!, idx).qualities["clue:slip-roster"],
    "点下去本子上没多这一行");
});

test("连玩十二副四季：那条录音不再大面积漏（经验判据 · 格随机取）", () => {
  // 这一条的走法跟上面那条「名字是借的」不一样：动作只 greet，但**格在可见格之间均匀随机** ——
  // 模拟器四个风格用的就是这个政策（风格只挑动作，不挑格子）。naive 那种恒取第一格量不到这一层：
  // 补之前同一批牌 naive 是 39/40，随机取格只有 10/24。
  let state = 1;
  const rand = () => { state = (state * 1103515245 + 12345) & 0x7fffffff; return state / 0x7fffffff; };
  const playSeason = (world: World) => {
    let w = world;
    while (w.day <= SEASON_DAYS) {
      for (const slot of [0, 1, 2, 3] as const) {
        w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
        for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        if (!drawn) continue;
        const vis = drawn.storylet.choices.map((c, i) => i).filter(i => choiceVisible(w, PEOPLE, drawn, drawn.storylet.choices[i]));
        if (!vis.length) continue;
        w = applyChoice(w, PEOPLE, drawn, vis[Math.floor(rand() * vis.length)] ?? vis[0]!);
      }
      w = endDay(w, PEOPLE);
    }
    return w;
  };
  let landed = 0;
  for (let i = 0; i < 12; i++) {
    state = 7 + i * 104729;
    let w = newWorld(`tape-${i}`, PEOPLE);
    for (let s = 1; s < 4; s++) { w = playSeason(w); w = nextSeason(w, PEOPLE); }
    w = playSeason(w);
    if (w.qualities["clue:slip-tape"]) landed++;
  }
  // 阈值敢压到 10/12：补这一刀之前同一走法 24 副只落 10 副（42%），十二副里期望五副。
  assert.ok(landed >= 10,
    `十二副牌只有 ${landed} 副拿到「录进去的是你的原话」—— 她那条线没接上本子（补之前 24 副只落 10 副）`);
});

test("连玩十二副四季：那条「名字是借的」不再大面积漏（经验判据）", () => {
  // 走法照抄上面第 4 幕那条：每格只 greet、卡取第一个看得见的选项。补三张第二回之前同一走法是 22/40，
  // 六副里期望只中三副 —— 这条要的就是它能红。
  const playSeason = (world: World) => {
    let w = world;
    while (w.day <= SEASON_DAYS) {
      for (const slot of [0, 1, 2, 3] as const) {
        w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
        for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        const idx = drawn ? drawn.storylet.choices.findIndex(c => choiceVisible(w, PEOPLE, drawn, c)) : -1;
        if (!drawn || idx < 0) continue;
        w = applyChoice(w, PEOPLE, drawn, idx);
      }
      w = endDay(w, PEOPLE);
    }
    return w;
  };
  let landed = 0;
  for (let i = 0; i < 12; i++) {
    let w = newWorld(`borrowed-${i}`, PEOPLE);
    for (let s = 1; s < 4; s++) { w = playSeason(w); w = nextSeason(w, PEOPLE); }
    w = playSeason(w);
    if (w.qualities["clue:slip-borrowed"]) landed++;
  }
  // 阈值为什么敢压到 10/12：补上三张第二回以后同一走法是 40/40（拿满），摘掉是 22/40。
  // 六副那一版红不起来（55% 的基率下 ≥5/6 有 16% 的概率蒙过），实测把三张摘掉它照样绿 —— 那种判据是假判据。
  assert.ok(landed >= 10,
    `十二副牌只有 ${landed} 副拿到「群里那句的名字是借的」—— 回访卡那条替代路径没接上（补之前是 22/40）`);
});

test("个人线名册双向对得上：卡写的落点都在档案里，档案里每个人都真有落点卡", () => {
  // 单向只测一半会漏：新增一条线忘了登记 ARC_PEOPLE，走完以后跨季档案和季末回顾都念不出她；
  // 反过来名册里挂着一个没有落点卡的人，档案那一页永远是空的。
  const ends = new Map<string, number[]>();
  for (const card of STORYLETS)
    for (const choice of card.choices)
      for (const effect of choice.effects) {
        if (!("quality" in effect) || typeof effect.set !== "number") continue;
        const landed = /^arc:([^:]+):end$/.exec(effect.quality);
        if (!landed) continue;
        const list = ends.get(landed[1]!) ?? [];
        if (!list.includes(effect.set)) ends.set(landed[1]!, [...list, effect.set]);
      }
  for (const [id, list] of ends)
    assert.ok(ARC_PEOPLE.includes(id), `卡给 ${id} 写了 ${list.length} 个落点，ARC_PEOPLE 里没有她 —— 档案念不出这条线`);
  for (const id of ARC_PEOPLE) assert.ok(ends.has(id), `档案里挂着 ${id} 的个人线，却没有一张卡能落到点上`);
});

/** 每条个人线在第几季开张（判据同 tests/world-sim.ts：第 1 张卡上那道 season 门槛）。 */
const lineSeason = (id: string): number => {
  const openers = STORYLETS.filter(s => s.kind === "arc"
    && s.when.some(c => "not" in c && (c.not as { quality?: unknown }).quality === `arc:${id}`
      && (c.not as { gte?: unknown }).gte === 1));
  return openers.reduce((max, s) => {
    const gate = s.when.find(c => "season" in c) as { season?: { gte?: number } } | undefined;
    return Math.max(max, gate?.season?.gte ?? 1);
  }, 1);
};

test("梅女士的十分钟：一路给她时间，一季之内必定走到反转和落点", () => {
  // 「人物线太乱、每条线不够完整」的验收方式：不数卡片数，直接拿引擎跑十二副牌。
  // 抽到自己线上的卡按指定选项走（那颗按不了退到备选），跑完必须看见 arc:mei:end。
  // 柜上抽到的别人的卡也必须落一手：界面上除了「一颗都按不动」以外没有第二条出路（WorldGame 那句
  // 「先记下这一幕」只在 storyChoices 为空时才出现）。丢着不按是引擎到不了的状态 —— 那张卡的 fired
  // 永远不写，同一条线的第一章能整季反复占着柜（上一版 11/12 就是这么来的，不是说书人偏心）。
  const route = new Map<string, string[]>([
    ["arc-mei-ten", ["十分钟里只讲一支"]],
    ["arc-mei-late", ["再给她十分钟"]],
    ["arc-mei-form", ["让她自己说完", "把表推回去，不问"]],
    ["arc-mei-end", ["这一支是给她自己的", "这单做完，不问下一次"]],
  ]);
  const seasonOne = ARC_PEOPLE.filter(id => lineSeason(id) === 1);

  let landed = 0;
  const unfinished: string[] = [];
  for (let i = 0; i < 12; i++) {
    let w = newWorld(`mei-line-${i}`, PEOPLE);
    while (w.day <= SEASON_DAYS) {
      for (let slot = 0; slot < 4; slot++) {
        w = beginSlot({ ...w, slot: slot as 0 | 1 | 2 | 3 }, PEOPLE, festivalsFor(1));
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        // 「一路给她时间」在真实游戏里不只是等她开口：她站到柜前，你先招呼一句 ——
        // 那一句花体力，也正是「她明天还来不来」的那一步。完全不招呼的玩家不能当验收基线。
        if (w.present["mei"] === "counter") w = doVerb(w, PEOPLE, "greet", ["mei"]);
        if (!drawn) continue;
        const labels = route.get(drawn.storylet.id) ?? drawn.storylet.choices.map(c => c.label);
        const choice = labels
          .map(label => drawn.storylet.choices.find(c => c.label === label))
          .find((c): c is Storylet["choices"][number] => !!c && choiceVisible(w, PEOPLE, drawn, c))
          ?? drawn.storylet.choices.find(c => choiceVisible(w, PEOPLE, drawn, c));
        if (!choice) continue;
        w = applyChoice(w, PEOPLE, drawn, drawn.storylet.choices.indexOf(choice));
      }
      w = endDay(w, PEOPLE);
    }
    for (const id of seasonOne)
      if ((w.qualities[`arc:${id}:end`] ?? 0) < 1) unfinished.push(`${id}@种子${i}`);
    if ((w.qualities["arc:mei:end"] ?? 0) >= 1) {
      landed++;
      assert.ok(w.qualities["secret-known:mei"], `种子 ${i}：走到了落点却没揭开那句「明早要见客户」`);
    }
  }
  assert.equal(landed, 12, "十二副牌跑完整季，有种子一次都没能走到梅女士的终点");
  assert.deepEqual(unfinished, [],
    `第 1 季挂着的线里有这些没能走完：${unfinished.join("、")}（线数或节奏变了先改 docs/人情场设计.md「一季讲几条线」）`);
});

test("第 2 季才开的那几条线：连着玩两季，每一条都开得了张、走得到落点", () => {
  // 「没玩就结束了」不止是第 1 季的事：第 2 季如果只把上一季的人再念一遍，玩家看到的是一层楼在重复。
  // 这一条把三条新线（尹小姐、段小姐、赵宁）和原有的四条一起钉在第 2 季那张名单上。
  const later = ARC_PEOPLE.filter(id => lineSeason(id) === 2);
  assert.deepEqual(later, ["yinxiaojie", "duan", "zhaoning", "tangke", "roman", "fangmin", "qiaowan"],
    "第 2 季开张的线名单变了 —— 改这条之前先改 docs/人情场设计.md「一季讲几条线」");

  const played = (world: World) => {
    let w = world;
    while (w.day <= SEASON_DAYS) {
      for (const slot of [0, 1, 2, 3] as const) {
        w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
        for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        // 每条线都按「玩家顺着她」走：拿第一个看得见的选项，不预设哪条线该被偏爱。
        const idx = drawn ? drawn.storylet.choices.findIndex(c => choiceVisible(w, PEOPLE, drawn, c)) : -1;
        if (!drawn || idx < 0) continue;
        w = applyChoice(w, PEOPLE, drawn, idx);
      }
      w = endDay(w, PEOPLE);
    }
    return w;
  };

  let landed = 0;
  for (let i = 0; i < 6; i++) {
    let w = played(newWorld(`s2-lines-${i}`, PEOPLE));
    w = played(nextSeason(w, PEOPLE));
    assert.equal(w.season, 2, `种子 ${i}：换季没走到第 2 季`);
    const none = later.filter(id => (w.qualities[`arc:${id}`] ?? 0) < 1);
    assert.equal(none.length, 0, `种子 ${i}：第 2 季这 ${none.length} 条线一次都没开张（${none.join(", ")}）`);
    if (later.every(id => (w.qualities[`arc:${id}:end`] ?? 0) >= 1)) landed++;
  }
  assert.equal(landed, 6, "六副牌连着跑两季，有种子没把第 2 季那几条线走到落点");
});

test("第 3 季才开的那两条线：连着玩三季，第 1、2 季一张都抽不到，第 3 季开得张、走得到落点", () => {
  // 「没玩就结束了」剩下的那一半：16 条线在第 2 季末全部收完，第 3 季起只有过路社交。
  // 这一条把两条新线钉在第 3 季那张名单上，并且钉住「它们第 3 季才开」——
  // 门槛写错成 gte 1 的话第 1 季就撞开，玩家会在安姐婚礼还没落定的时候听见「那场婚礼定了别人」。
  const third = ARC_PEOPLE.filter(id => lineSeason(id) === 3);
  assert.deepEqual(third, ["songjie", "baijie"],
    "第 3 季开张的线名单变了 —— 改这条之前先改 docs/人情场设计.md「一季讲几条线」");

  const played = (world: World) => {
    let w = world;
    while (w.day <= SEASON_DAYS) {
      for (const slot of [0, 1, 2, 3] as const) {
        w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
        for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        // 判据同第 2 季那一条：玩家顺着她走，拿第一个看得见的选项，不预设哪条线该被偏爱。
        const idx = drawn ? drawn.storylet.choices.findIndex(c => choiceVisible(w, PEOPLE, drawn, c)) : -1;
        if (!drawn || idx < 0) continue;
        w = applyChoice(w, PEOPLE, drawn, idx);
      }
      w = endDay(w, PEOPLE);
    }
    return w;
  };

  let landed = 0;
  for (let i = 0; i < 6; i++) {
    let w = played(newWorld(`s3-lines-${i}`, PEOPLE));
    w = played(nextSeason(w, PEOPLE));
    for (const id of third)
      assert.equal(w.qualities[`arc:${id}`] ?? 0, 0, `种子 ${i}：${id} 的线在两季之内就开张了，第 3 季那道门槛没生效`);
    w = played(nextSeason(w, PEOPLE));
    assert.equal(w.season, 3, `种子 ${i}：连着玩三季没走到第 3 季`);
    const none = third.filter(id => (w.qualities[`arc:${id}`] ?? 0) < 1);
    assert.equal(none.length, 0, `种子 ${i}：第 3 季这 ${none.length} 条线一次都没开张（${none.join(", ")}）`);
    if (third.every(id => (w.qualities[`arc:${id}:end`] ?? 0) >= 1)) landed++;
  }
  assert.equal(landed, 6, "六副牌连着跑三季，有种子没把第 3 季那两条线走到落点");
});

test("第 3 季那两条线的分支门：只认换季带得下来的东西", () => {
  // 这两条线的反转全靠前两季：白姐那张读安姐婚礼线的落点，宋姐那张读「名字是从群里借的」那条记忆。
  // 记忆只有 |valence| = 2 的那一档能过季（nextSeason 里筛的就是这个），所以分支门必须钉在 ±2 上 ——
  // 挂成 ±1 的话第 3 季永远看不见那张卡，而单季内测又全是绿的。
  const chair = STORYLETS.find(s => s.id === "arc-bj-chair")!;
  const label = "定的人是苏蔓那边";
  for (const end of [0, 1, 2, 3, 4]) {
    const w: World = { ...newWorld("bj-chair", PEOPLE), qualities: end ? { "arc:anjie:end": end } : {} };
    const drawn = { storylet: chair, binding: { a: "baijie" } };
    const shown = chair.choices.filter(c => c.label === label && choiceVisible(w, PEOPLE, drawn, c)).length;
    assert.equal(shown, end === 2 ? 1 : 0, `安姐落点 ${end} 那一档不该露出「定的人是苏蔓那边」`);
  }
  // 四种落点 + 落点没走完，五档里必须恰好有一档走默认那句「跟她无关」以外的分支，或者落到默认那档。
  for (const end of [1, 2, 3]) {
    const w: World = { ...newWorld("bj-chair", PEOPLE), qualities: { "arc:anjie:end": end } };
    const drawn = { storylet: chair, binding: { a: "baijie" } };
    const branches = chair.choices.filter(c => (c.when?.length ?? 0) > 0 && choiceVisible(w, PEOPLE, drawn, c));
    assert.equal(branches.length, 1, `安姐落点 ${end}：带条件的分支应当只剩一格`);
  }

  const book = STORYLETS.find(s => s.id === "arc-sj-book")!;
  const shotLabel = "那张截图是你自己拍的吧";
  const withMemory: World = {
    ...newWorld("sj-book", PEOPLE),
    qualities: { "arc:songjie": 1 },
    memories: [{ holder: "songjie", subject: "player", act: "slip-named-group", valence: -2, day: 3 }],
  };
  const withoutMemory: World = { ...withMemory, memories: [] };
  const drawnBook = { storylet: book, binding: { a: "songjie" } };
  assert.equal(book.choices.filter(c => c.label === shotLabel && choiceVisible(withMemory, PEOPLE, drawnBook, c)).length, 1,
    "主线那句「名字是从群里借的」过了季还在她记忆里，这一格就该露出来");
  assert.equal(book.choices.filter(c => c.label === shotLabel && choiceVisible(withoutMemory, PEOPLE, drawnBook, c)).length, 0,
    "第 1 季没把这句说出去过，反转不能凭空掉下来");
});

/** 这个人一季预期能站上楼层几个时段（判据照 beginSlot 里访客那一段：日子 = 一周第几天、时段在她的 slots 里、fromDay 之后、按 chance 计权）。 */
const floorChances = (id: string): number => {
  const v = PEOPLE.find(p => p.id === id)?.visits;
  if (!v) return 0;
  if (v.festivals) return Infinity; // 只在节日窗口里来的人另算：那一格是节日给的，不在这里比
  let n = 0;
  for (let day = 1; day <= SEASON_DAYS; day++) {
    if (v.fromDay !== undefined && day < v.fromDay) continue;
    const dow = ((day - 1) % 7) + 1;
    if (v.days !== "any" && !v.days.includes(dow)) continue;
    n += v.slots.length * v.chance;
  }
  return n;
};

test("被故事点名的那个人得上得了楼：个人线开头卡与主线线索卡的在场期望有下限", () => {
  // 这一条管的是「写了却碰不见」：开头那一张和主线的线索卡都只能在她在场的那一柜抽得到，
  // 她整季不来，卡就整季不存在 —— 跟抽签名额、跟玩家怎么选都无关。
  // 量过的两个反面（40 种子 × 4 风格，2026-10-09）：赵宁 days [6,7] × slots [1] × 0.4 = 3.2 格
  // → 她的线 148/160，掉的 12 副全是「整季没遇见过她」而不是走到一半停住；尹小洁 9% 的时段在场
  // → main-slip-yin 只讲到 49/160，主线本子停在 2/4。
  const thin: string[] = [];
  for (const story of STORYLETS) {
    if (story.kind !== "arc" && story.kind !== "mainline") continue;
    for (const slot of Object.values(story.cast)) {
      const id = slot.id;
      if (!id) continue;
      const person = PEOPLE.find(p => p.id === id);
      if (!person || person.role !== "customer") continue; // 同事、对面、商场的人天天在楼层上
      const opener = story.kind === "arc" && story.when.some(c => "not" in c
        && (c.not as { quality?: unknown }).quality === `arc:${id}` && (c.not as { gte?: unknown }).gte === 1);
      if (story.kind !== "mainline" && !opener) continue;
      const n = floorChances(id);
      if (n < 8) thin.push(`${story.id} 点名的${person.name}一季只有 ${n.toFixed(1)} 格`);
    }
  }
  assert.deepEqual(thin, [], `这些卡要靠她开口，但她上不了几次楼：${thin.join("；")}`);
});

test("主线本子：四条线索不是收藏册，但一副牌至少摸到两条、多数牌摸到三条", () => {
  // 反转要有料：本子上只有两条时，「名字在谁手里」那一张是把四选一压成二选一。
  // 十二副牌各跑两季（每张抽到的卡都落一手，判据同「梅女士的十分钟」），数每副牌讲到的线索卡张数。
  const CLUES = ["main-slip-shen", "main-slip-song", "main-slip-yin", "main-slip-fang"];
  const played = (start: World) => {
    let w = start;
    const seen = new Set<string>();
    while (w.day <= SEASON_DAYS) {
      for (const slot of [0, 1, 2, 3] as const) {
        w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
        for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        if (!drawn) continue;
        if (CLUES.includes(drawn.storylet.id)) seen.add(drawn.storylet.id);
        const idx = drawn.storylet.choices.findIndex(c => choiceVisible(w, PEOPLE, drawn, c));
        if (idx < 0) continue;
        w = applyChoice(w, PEOPLE, drawn, idx);
      }
      w = endDay(w, PEOPLE);
    }
    return { w, seen };
  };

  const hist = new Map<number, number>();
  for (let i = 0; i < 12; i++) {
    const run = played(newWorld(`slip-clues-${i}`, PEOPLE));
    const next = played(nextSeason(run.w, PEOPLE));
    for (const id of next.seen) run.seen.add(id);
    const n = run.seen.size;
    hist.set(n, (hist.get(n) ?? 0) + 1);
    assert.ok(n >= 2, `种子 ${i}：整季两副只摸到 ${n} 条线索，本子上撑不起一次反转`);
  }
  const threeOrMore = [...hist.entries()].filter(([n]) => n >= 3).reduce((a, [, c]) => a + c, 0);
  // 量过的两端：改之前 7/12 副（2 条×5、3 条×4、4 条×3），改之后 10/12 副（2 条×2、3 条×9、4 条×1）。
  // 门槛钉在 8：留两副余量，哪天真把在场或 weight 动坏了，这一条先报红。
  assert.ok(threeOrMore >= 8, `十二副牌里只有 ${threeOrMore} 副摸到三条以上线索（${[...hist.entries()].sort().map(([n, c]) => `${n} 条×${c} 副`).join(" ")}）`
    + " —— 在场期望或线索卡的 weight 被动过，回看 docs/人情场设计.md「主线本子上有几条线索」");
});

test("故事碎片的槽、占位、落点和关系效果", () => {
  assert.equal(new Set(STORYLETS.map(s => s.id)).size, STORYLETS.length, "故事 id 重复");
  const count = { social: 0, arc: 0, floor: 0, mainline: 0 };
  const tension = { [-1]: 0, 0: 0, 1: 0 };
  const arcCards = new Map<string, number>();
  const arcEnds = new Map<string, Set<number>>();

  const festivalIds = new Set([1, 2, 3, 4].flatMap(n => festivalsFor(n).map(item => item.id)));
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
      if ("festival" in cond) assert.ok(festivalIds.has(cond.festival), `${story.id} 的节日 ${cond.festival}`);
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
  // 主线以前不在这个名目里：count["mainline"] 一直是 NaN，池子清点念不到那 11 张 spine 卡。
  assert.ok(count.mainline >= 11, `主线 ${count.mainline}`);
  assert.ok(tension[-1] > 0 && tension[0] > 0 && tension[1] > 0, "张力要有冲突也要有缓和");
  assert.ok(arcCards.size >= 4, `个人线人数 ${arcCards.size}`);
  for (const [id, cards] of arcCards) {
    assert.ok(cards >= 3, `${id} 只有 ${cards} 张`);
    const ends = arcEnds.get(id);
    assert.ok(ends && ends.size >= 2, `${id} 的落点只有 ${ends ? [...ends].join(",") : "没有"}`);
  }
});

test("同名选项互斥且全覆盖：任何一对人，介绍那张卡恰好只露出一颗'引到同一面镜子前'", async () => {
  const { choiceVisible, newWorld } = await import("../src/world/engine.ts");
  const card = STORYLETS.find(s => s.id === "social-intro-mirror")!;
  const label = "把两个人引到同一面镜子前";
  const w = newWorld("intro-mirror", PEOPLE);
  for (const a of PEOPLE) for (const b of PEOPLE) {
    if (a.id === b.id) continue;
    const drawn = { storylet: card, binding: { a: a.id, b: b.id } };
    const shown = card.choices.filter(c => c.label === label && choiceVisible(w, PEOPLE, drawn, c)).length;
    assert.equal(shown, 1, `${a.id} × ${b.id} 露出 ${shown} 颗`);
  }
});

test("第 2 季同名选项互斥且全覆盖", async () => {
  const { choiceVisible, newWorld } = await import("../src/world/engine.ts");
  const w = newWorld("s2-labels", PEOPLE);

  const hand = STORYLETS.find(s => s.id === "s2-d11-hand")!;
  const handLabel = "把到手价念完";
  for (const person of PEOPLE) {
    const drawn = { storylet: hand, binding: { a: person.id } };
    const shown = hand.choices.filter(c => c.label === handLabel && choiceVisible(w, PEOPLE, drawn, c)).length;
    assert.equal(shown, 1, `${person.id} 的到手价露出 ${shown} 颗`);
  }

  const unload = STORYLETS.find(s => s.id === "arc-qiaowan-unload")!;
  const unloadLabel = "让她把那句卸掉";
  for (const secret of [0, 1]) {
    const world = { ...w, qualities: secret ? { "secret-known:qiaowan": 1 } : {} };
    const drawn = { storylet: unload, binding: { a: "qiaowan" } };
    const shown = unload.choices.filter(c => c.label === unloadLabel && choiceVisible(world, PEOPLE, drawn, c)).length;
    assert.equal(shown, 1, `乔晚秘密 ${secret} 露出 ${shown} 颗`);
  }

  const who = STORYLETS.find(s => s.id === "arc-fangmin-who")!;
  const whoLabel = "问她缺口是谁的";
  for (const secret of [0, 1]) {
    const world = { ...w, qualities: secret ? { "secret-known:fangmin": 1 } : {} };
    const drawn = { storylet: who, binding: { a: "fangmin" } };
    const shown = who.choices.filter(c => c.label === whoLabel && choiceVisible(world, PEOPLE, drawn, c)).length;
    assert.equal(shown, 1, `方敏秘密 ${secret} 露出 ${shown} 颗`);
  }
});

test("主线整段只演一次，而且第 2 季还有新的一幕可演", () => {
  // 探针量出来的两个毛病一起钉住：
  // ① nextSeason 把 fired 整份清空（engine.ts:1227），而 mainline:act、thread:return-slip 都带着过季 ——
  //    于是第 2 幕那三张收法（once: true）在每一季把同一句话原样重演一遍。12 个种子的探针里
  //    main-slip-after-own 第 1、2、3 季各演 12 次，一次不落。
  // ② 第 1 季关掉第 1 幕之后，唯一通向第 3 幕的 main-act3-open 压在第 3 季第 10 天（中位第 66 天），
  //    而第 2 幕的收法中位在第 19~20 天 —— 中间 46 天主线没有一句新话。
  //    「剧情太短，没玩就结束了」在主线层就是这一条：不是结局早，是故事在半路停了整整一季。
  const perSeed = (seed: number): string[][] => {
    const bySeason: string[][] = [[], [], []];
    let w = newWorld(`mainline-${seed}`, PEOPLE);
    for (let season = 1; season <= 3; season++) {
      while (w.day <= SEASON_DAYS) {
        for (const slot of [0, 1, 2, 3] as const) {
          w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
          for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
          const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
          if (!drawn) continue;
          if (drawn.storylet.kind === "mainline") bySeason[season - 1].push(drawn.storylet.id);
          const idx = drawn.storylet.choices.findIndex(c => choiceVisible(w, PEOPLE, drawn, c));
          if (idx >= 0) w = applyChoice(w, PEOPLE, drawn, idx);
        }
        w = endDay(w, PEOPLE);
      }
      if (season < 3) w = nextSeason(w, PEOPLE);
    }
    return bySeason;
  };

  for (let seed = 0; seed < 6; seed++) {
    const [s1, s2, s3] = perSeed(seed);
    const seenSeason = new Map<string, number[]>();
    [s1, s2, s3].forEach((ids, i) => ids.forEach(id => seenSeason.set(id, [...(seenSeason.get(id) ?? []), i + 1])));
    const replay = [...seenSeason].filter(([, seasons]) => new Set(seasons).size > 1);
    assert.equal(replay.length, 0,
      `种子 ${seed}：这些主线卡跨季原样重演了 —— ${replay.map(([id, n]) => `${id}(${n.join("/")})`).join("、")}。`
      + `门槛只认过季带着走的 quality，卡自己必须留一个过得了季的「已经演过」记号。`);
    const fresh = s2.filter(id => !s1.includes(id));
    assert.ok(fresh.length >= 1, `种子 ${seed}：第 2 季主线一张新卡都没有（第 1 季演过 ${s1.length} 张，第 2 季只剩重演）`);
  }
});

test("第 4 季才开的那两条线和那一句主线的话：连着玩四季，前三季一张都抽不到", () => {
  // 内容燃烧曲线量到的是「半池 29 天 / 八成 60 天」，第 4 季（第 85~112 天）原本一张新个人线、
  // 一张主线卡都没有 —— 愿意连玩四季的人只在循环过路社交。这一条把裴岚、梁夏钉在第 4 季那张名单上，
  // 并且钉住「第 4 季主线还有一句话要说」：main-a4-page 是那一季唯一的主线卡。
  const fourth = ARC_PEOPLE.filter(id => lineSeason(id) === 4);
  assert.deepEqual(fourth, ["peilan", "liangxia"],
    "第 4 季开张的线名单变了 —— 改这条之前先改 docs/人情场设计.md「一季讲几条线」");

  const played = (world: World, mainline: string[]) => {
    let w = world;
    while (w.day <= SEASON_DAYS) {
      for (const slot of [0, 1, 2, 3] as const) {
        w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
        for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        if (drawn && drawn.storylet.kind === "mainline") mainline.push(drawn.storylet.id);
        const idx = drawn ? drawn.storylet.choices.findIndex(c => choiceVisible(w, PEOPLE, drawn, c)) : -1;
        if (!drawn || idx < 0) continue;
        w = applyChoice(w, PEOPLE, drawn, idx);
      }
      w = endDay(w, PEOPLE);
    }
    return w;
  };

  for (let i = 0; i < 6; i++) {
    // played() 一跑就是一整季（while 到 day > 28 就收），所以每一季都得先 nextSeason 再玩 —— 判据同第 3 季那一条。
    const notOpenYet = (w: World, season: number) => { for (const id of fourth)
      assert.equal(w.qualities[`arc:${id}`] ?? 0, 0, `种子 ${i}：${id} 的线在第 ${season} 季就开张了，season gte 4 那道门槛没生效`); };
    let w = played(newWorld(`s4-lines-${i}`, PEOPLE), []);
    notOpenYet(w, 1);
    w = played(nextSeason(w, PEOPLE), []);
    notOpenYet(w, 2);
    w = played(nextSeason(w, PEOPLE), []);
    notOpenYet(w, 3);
    const mainS4: string[] = [];
    const end = played(nextSeason(w, PEOPLE), mainS4);
    assert.equal(end.season, 4, `种子 ${i}：连着玩四季没走到第 4 季`);
    const none = fourth.filter(id => (end.qualities[`arc:${id}`] ?? 0) < 1);
    assert.equal(none.length, 0, `种子 ${i}：第 4 季这 ${none.length} 条线一次都没开张（${none.join(", ")}）`);
    const landed = fourth.filter(id => (end.qualities[`arc:${id}:end`] ?? 0) < 1);
    assert.equal(landed.length, 0, `种子 ${i}：第 4 季这两条线走到了开头却没落到终点（${landed.join(", ")}）—— 四张卡里有一张在季节内接不上`);
    // 第 4 季的主线那句话要说出来：这张卡是那一季唯一的主线卡，也是「第 2 幕空了一整季」那个毛病不许复发的判据。
    assert.ok(mainS4.includes("main-a4-page"), `种子 ${i}：第 4 季主线一张卡都没抽到（抽到的主线卡：${mainS4.join(", ") || "无"}）`);
  }
});

test("第 4 季那两条线的分支门：只认换季带得下来的东西", () => {
  // 判据同第 3 季那一条：裴岚的反转读主线的本子（clue: 前缀过季带着走）和她自己那条记忆（±2 才留得住），
  // 梁夏的反转读苏蔓的秘密（secret-known:）和第 1 季那场婚礼的落点（arc:）。
  // 门槛写歪成读不带着走的东西，第 4 季永远看不见那张卡，而单季内测全是绿的。
  const who = STORYLETS.find(s => s.id === "arc-pl-who")!;
  const drawnWho = { storylet: who, binding: { a: "peilan" } };
  const labelHeld = "那一页是你自己按住的";
  const withClue: World = { ...newWorld("pl-who", PEOPLE), qualities: { "arc:peilan": 1, "clue:slip-gap": 1 } };
  const withoutClue: World = { ...withClue, qualities: { "arc:peilan": 1 } };
  assert.equal(who.choices.filter(c => c.label === labelHeld && choiceVisible(withClue, PEOPLE, drawnWho, c)).length, 1,
    "本子上有「方敏按住了领用表那一行」，这一格就该露出来");
  assert.equal(who.choices.filter(c => c.label === labelHeld && choiceVisible(withoutClue, PEOPLE, drawnWho, c)).length, 0,
    "本子上没有那条线索，反转不能凭空掉下来");

  const page = STORYLETS.find(s => s.id === "main-a4-page")!;
  const drawnPage = { storylet: page, binding: { a: "fangmin" } };
  const labelQuarter = "问那一页每季是谁要的";
  for (const qualities of [{ "mainline:act": 2, "clue:slip-roster": 1 }, { "mainline:act": 2, "arc:peilan": 1 }] as Array<Record<string, number>>) {
    const w: World = { ...newWorld("a4-page", PEOPLE), season: 4, day: 6, qualities };
    assert.equal(page.choices.filter(c => c.label === labelQuarter && choiceVisible(w, PEOPLE, drawnPage, c)).length, 1,
      `${JSON.stringify(qualities)}：第 4 季那句「是谁每季都要那一页」该露出来`);
  }
  const bare: World = { ...newWorld("a4-page", PEOPLE), season: 4, day: 6, qualities: { "mainline:act": 2 } };
  assert.equal(page.choices.filter(c => c.label === labelQuarter && choiceVisible(bare, PEOPLE, drawnPage, c)).length, 0,
    "既没摸到第 3 幕那条线索、也没跟裴岚谈过表，就不许直接报出工号");

  const set = STORYLETS.find(s => s.id === "arc-lx-set")!;
  const drawnSet = { storylet: set, binding: { a: "liangxia" } };
  const labelKept = "这套图你一直留着";
  const withSecret: World = { ...newWorld("lx-set", PEOPLE), qualities: { "arc:liangxia": 1, "secret-known:suman": 1 } };
  const withoutSecret: World = { ...withSecret, qualities: { "arc:liangxia": 1 } };
  assert.equal(set.choices.filter(c => c.label === labelKept && choiceVisible(withSecret, PEOPLE, drawnSet, c)).length, 1,
    "知道苏蔓那句「别让梁夏上镜」，才问得出这套原图是谁按的");
  assert.equal(set.choices.filter(c => c.label === labelKept && choiceVisible(withoutSecret, PEOPLE, drawnSet, c)).length, 0,
    "那句秘密没听过，反转不能凭空掉下来");

  // 过季带得下来的那一档：这些分支门认的记忆必须钉在 ±2 —— 换季筛记忆留的就是这一档。
  for (const [cardId, act] of [["arc-pl-end", "quarter-held-known"], ["arc-pl-end", "quarter-list-named"],
    ["arc-lx-end", "camera-base-natural"], ["arc-lx-end", "camera-set-kept"]] as const) {
    const writer = STORYLETS.find(s => s.choices.some(c => c.effects.some(e => "remember" in e && e.remember.act === act)))!;
    const effect = writer.choices.flatMap(c => c.effects).find(e => "remember" in e && e.remember.act === act)!;
    assert.equal(Math.abs((effect as { remember: { valence: number } }).remember.valence), 2,
      `${cardId} 的分支门认 ${act}，可写它的那张卡挂在 ${writer.id} 的 valence 不是 ±2 —— 过不了季，第 4 季那一格永远按不出来`);
  }
});

test("主线第 4、5 幕：四季到第 4 幕、七季每季都有主线可演，而且同一幕不跨季重演", () => {
  // 这条判据的形状在第 37 轮改过一次。原来钉的是「四季跑完幕号 == 最后一幕」（第 20 轮的取舍：主线在四季内讲完），
  // 加了第 5 幕以后那句不成立了 —— 现在的不变量是**六季讲完**，而四季那一档只要求到得了第 4 幕（那笔账落地）。
  // 换判据不是放水：旧的"四季讲完"被明文替换，新的那句更强（多两季还要一路走到最后一幕，中途不许卡住）。
  // 第 38 轮再加一句：**第 6、7 季各有一张主线卡演到** —— 幕号停在 5 不等于这条线说完了。
  const A4 = ["main-a4-who", "main-a4-desk", "main-a4-valve"];
  const A5 = ["main-a5-open", "main-a5-names", "main-a5-desk"];
  const A6 = ["main-a6-relay"];
  const A7 = ["main-a7-same"];
  const playSeason = (world: World, mainline: string[]) => {
    let w = world;
    while (w.day <= SEASON_DAYS) {
      for (const slot of [0, 1, 2, 3] as const) {
        w = beginSlot({ ...w, slot }, PEOPLE, festivalsFor(w.season));
        for (const p of PEOPLE) if (w.present[p.id] === "counter") w = doVerb(w, PEOPLE, "greet", [p.id]);
        const { drawn } = drawStorylet(w, PEOPLE, STORYLETS);
        if (drawn && drawn.storylet.kind === "mainline") mainline.push(drawn.storylet.id);
        const idx = drawn ? drawn.storylet.choices.findIndex(c => choiceVisible(w, PEOPLE, drawn, c)) : -1;
        if (!drawn || idx < 0) continue;
        w = applyChoice(w, PEOPLE, drawn, idx);
      }
      w = endDay(w, PEOPLE);
    }
    return w;
  };

  for (let i = 0; i < 6; i++) {
    const mainline: string[] = [];
    let w = newWorld(`act4-${i}`, PEOPLE);
    for (let s = 1; s < 4; s++) { w = playSeason(w, mainline); w = nextSeason(w, PEOPLE); }
    w = playSeason(w, mainline);
    assert.equal(w.season, 4, `种子 ${i}：没走到第 4 季`);

    assert.ok(mainline.includes("main-a4-who"),
      `种子 ${i}：第 4 幕没开局（第 4 季那几张主线卡：${mainline.slice(-4).join(", ") || "无"}，幕号停在 ${w.qualities["mainline:act"] ?? 0}）`);
    assert.ok((w.qualities["mainline:act"] ?? 0) >= 4,
      `种子 ${i}：四季跑完幕号才 ${w.qualities["mainline:act"] ?? 0} —— 第 4 幕到不了，后面第 5 幕更是空话`);
    const landing4 = w.qualities["thread:return-slip"] ?? 0;
    assert.ok(landing4 >= 12,
      `种子 ${i}：第 4 幕开了局却没落到第 4 幕那一族落点（thread:return-slip = ${landing4}，收法卡 main-a4-desk ${mainline.includes("main-a4-desk") ? "演过" : "没演过"}）`);
    for (const id of A4) {
      const n = mainline.filter(x => x === id).length;
      assert.ok(n <= 1, `种子 ${i}：${id} 在四季里演了 ${n} 次 —— 同一句主线的话不许跨季原样重演`);
    }

    // 第 5 幕：再走两季。这一档钉的是"主线不再在四季就断在半路"——
    // 第 5 幕开得了张、两条新线索进得了本子、六季跑完幕号真的走到内容写的最后一幕。
    w = nextSeason(w, PEOPLE); w = playSeason(w, mainline);   // 第 5 季
    const before6 = mainline.length;                          // 第 6 季从这里开始
    w = nextSeason(w, PEOPLE); w = playSeason(w, mainline);
    assert.equal(w.season, 6, `种子 ${i}：没走到第 6 季`);
    assert.ok(mainline.includes("main-a5-open"),
      `种子 ${i}：第 5 幕没开局（最后四张主线卡：${mainline.slice(-4).join(", ") || "无"}，幕号停在 ${w.qualities["mainline:act"] ?? 0}）`);
    assert.equal(w.qualities["mainline:act"] ?? 0, MAINLINE_ACTS.length,
      `种子 ${i}：六季跑完幕号停在 ${w.qualities["mainline:act"] ?? 0}，内容写到第 ${MAINLINE_ACTS.length} 幕 —— 整条主线没讲完`);
    assert.ok((w.qualities["clue:slip-handover"] ?? 0) >= 1, "本子第 7 条「那一栏今年还开着」没记上");
    assert.ok((w.qualities["clue:slip-signature"] ?? 0) >= 1, "本子第 8 条「还是那个名字在签」没记上 —— 第 5 幕那句翻面就无从谈起");
    for (const id of A5) {
      const n = mainline.filter(x => x === id).length;
      assert.ok(n <= 1, `种子 ${i}：${id} 在六季里演了 ${n} 次 —— 第 5 幕的话不许跨季原样重演`);
    }

    // 第 38 轮那一刀要答的是第 37 轮代价 ①：幕号停在 5 以后，第 6、7 季的主线整季 0 张。
    // 这两季各有一张「续写」的卡，读的是上一季那张写下的记号 —— 所以这里验的是真走到，不是静态开得了。
    // 第 6 季那一段上面已经走过（起点记在 before6），这里只把它读出来。
    const inSix = mainline.slice(before6);
    assert.ok(inSix.includes("main-a6-relay"),
      `种子 ${i}：第 6 季一张「续写」的主线卡都没演到（该季主线：${inSix.join(", ") || "无"}）`);
    assert.equal(w.qualities["mainline:a5-row"] ?? 0, 1,
      `种子 ${i}：第 6 季那张读的是 mainline:a5-row，可它停在 ${w.qualities["mainline:a5-row"] ?? 0} —— 第 5 幕收束那张没把记号写下去`);
    assert.ok([1, 2, 3, 4].includes(w.qualities["mainline:a6-row"] ?? 0),
      `种子 ${i}：第 6 季那张没写出 a6-row（读到 ${w.qualities["mainline:a6-row"] ?? 0}），第 7 季那句就没人接`);

    const before7 = mainline.length;
    w = nextSeason(w, PEOPLE); w = playSeason(w, mainline);
    assert.equal(w.season, 7, `种子 ${i}：没走到第 7 季`);
    const inSeven = mainline.slice(before7);
    assert.ok(inSeven.includes("main-a7-same"),
      `种子 ${i}：第 7 季一张「续写」的主线卡都没演到（该季主线：${inSeven.join(", ") || "无"}）`);
    assert.ok((w.qualities["clue:slip-number"] ?? 0) >= 1, "本子第 9 条「换的是名字，号一年没换」没记上");
    assert.ok((w.qualities["clue:slip-selfrow"] ?? 0) >= 1, "本子第 10 条「那一栏抄自己」没记上");
    for (const id of [...A6, ...A7]) {
      const n = mainline.filter(x => x === id).length;
      assert.ok(n <= 1, `种子 ${i}：${id} 在七季里演了 ${n} 次 —— 按季续写不许有一季原样重演上一季那句话`);
    }
  }
});

test("第 4 幕那三张的门槛：不收第 3 幕的尾开不了局，签过名以后也不回来抢同一档", () => {
  // 上一条是「最直的那条路走得到」，这一条是静态的门：把牌堆里第 4 幕那三张的条件逐副探一遍。
  // 之所以要分开测 —— 玩到第 4 幕的人一定先收过第 3 幕的尾，跑整季测不出「门被拆掉」这种写法；
  // 门拆了以后第 1 季就能念出「长出来的是你的号」，而那句要的是玩家已经答过「那一行是谁的手写的」。
  const card = (id: string) => STORYLETS.find(s => s.id === id)!;
  const legal = (w: World, c: Storylet) => c.when.every(x => evalCond(w, PEOPLE, x));
  const at = (patch: Partial<World>): World => ({
    ...newWorld("a4-gate", PEOPLE), season: 4, day: 24,
    present: { fangmin: "cashier", shen: "counter", peilan: "counter" }, ...patch,
  });

  const who = card("main-a4-who");
  const actThree = { "mainline:act": 3 };
  assert.equal(legal(at({ qualities: { ...actThree, "thread:return-slip": 7 } }), who), true,
    "第 3 幕收了尾（落点 7），第 4 季第 6 天以后方敏在楼上 —— 这一幕就该开得了局");
  assert.equal(legal(at({ qualities: actThree }), who), false,
    "那条退货单还没在第 3 幕翻面，第 4 幕不能凭空开场 —— 玩家会听到一句他还没挣到的话");
  assert.equal(legal(at({ qualities: { "mainline:act": 4, "thread:return-slip": 7 } }), who), false,
    "幕号抬到 4 之后这张该被它自己的 ACT(3) 关掉，不然同一句问话每季重演");
  assert.equal(legal({ ...at({ qualities: { ...actThree, "thread:return-slip": 7 } }), present: {} }, who), false,
    "方敏不在楼上，那一页摊不开");
  assert.equal(legal(at({ season: 3, qualities: { ...actThree, "thread:return-slip": 7 } }), who), false,
    "第 3 季不许把四季收束的那一幕提前演完");

  // 两张收法卡：落到 12 以后（含阀门那两档）自己关门，不再跟已经签过名的人抢同一档。
  for (const id of ["main-a4-desk", "main-a4-valve"]) {
    const c = card(id);
    const open = { "mainline:act": 4, "clue:slip-desk": 1 };
    assert.equal(legal(at({ qualities: open }), c), true, `${id}：幕号到 4、本子上有第四页那条 —— 收法该按得出来`);
    for (const landing of [12, 13, 14, 15, 16, 17]) {
      assert.equal(legal(at({ qualities: { ...open, "thread:return-slip": landing } }), c), false,
        `${id}：这一栏已经落在 ${landing}，再抽到一次就是把同一句收法演第二遍`);
    }
  }
  assert.equal(legal(at({ qualities: { "mainline:act": 4 } }), card("main-a4-desk")), false,
    "本子上既没有第四页那条、也没有领用表那条，第 4 幕的收法不许凭空掉下来");

  // 落点 14 那一格挂的是裴岚：她这一季得在楼上，而且她的线要走到承认那一页那一段。
  const desk = card("main-a4-desk");
  const drawnDesk = { storylet: desk, binding: { a: "fangmin" as const, b: "peilan" as const } };
  const labelTotal = "让裴岚把这一行写进区域总表";
  const visible = (qualities: Record<string, number>, present?: World["present"]) => {
    const w = at({ qualities: { "mainline:act": 4, "clue:slip-desk": 1, ...qualities }, ...(present ? { present } : {}) });
    return desk.choices.filter(c => c.label === labelTotal && choiceVisible(w, PEOPLE, drawnDesk, c)).length;
  };
  assert.equal(visible({ "arc:peilan": 2 }), 1, "裴岚的线走到那一格、人也在楼上 —— 这一行该写得上总表");
  assert.equal(visible({ "arc:peilan": 1 }), 0, "她的线还没走到那一段，总表那一格不该露出来");
  assert.equal(visible({ "arc:peilan": 2 }, { fangmin: "cashier", shen: "counter" }), 0,
    "裴岚这一季不在楼上，就不能把这一行交给她 —— 那个落点要她本人接");
});

test("第 5 幕那三张的门槛：第 4 幕没收尾开不了局，两条线索得一条接一条", () => {
  // 跟第 4 幕那条同一个道理：玩到第 5 幕的人一定先收过第 4 幕的尾，跑整季测不出"门被拆掉"这种写法，
  // 所以逐副静态探一遍。翻面不许凭空掉下来 —— 「那一栏今年写谁」要的是玩家已经答过"谁在写单子"。
  const card = (id: string) => STORYLETS.find(s => s.id === id)!;
  const legal = (w: World, c: Storylet) => c.when.every(x => evalCond(w, PEOPLE, x));
  const at = (patch: Partial<World>): World => ({
    ...newWorld("a5-gate", PEOPLE), season: 5, day: 24,
    present: { shen: "counter", fangmin: "cashier", peilan: "counter" }, ...patch,
  });
  const done4 = { "mainline:act": 4, "thread:return-slip": 13, "clue:slip-desk": 1 };

  const open = card("main-a5-open");
  assert.equal(legal(at({ qualities: done4 }), open), true, "第 4 幕落了地、第 5 季、沈薇在楼上 —— 第 5 幕就该开得了局");
  assert.equal(legal(at({ qualities: { ...done4, "mainline:act": 3, "thread:return-slip": 7 } }), open), false,
    "第 4 幕还没收尾就开第 5 幕，玩家听到的是他还没挣到的下一问");
  assert.equal(legal(at({ qualities: { ...done4, "thread:return-slip": 11 } }), open), false,
    "幕号到 4 但那一笔没落到第 4 幕那一族落点（<12）—— 四季那本账还没结完，不该翻到第 5 幕");
  assert.equal(legal(at({ season: 4, qualities: done4 }), open), false,
    "第 4 季不许演第 5 幕 —— 那一栏要空到第二年才叫「又开了」");
  assert.equal(legal(at({ qualities: done4, present: { fangmin: "cashier" } }), open), false,
    "沈薇不在楼上，那页表没人翻给你看");
  assert.equal(legal(at({ season: 5, day: 2, qualities: done4 }), open), false,
    "第 5 季头两天不许开局：跟第 1 幕那张阀门同一个规矩，主线不许压在新季最前面");

  const names = card("main-a5-names");
  assert.equal(legal(at({ qualities: { ...done4, "mainline:act": 5 } }), names), false,
    "没查到那一栏今年还开着，就直接查谁在签 —— 第 7 条线索是第 8 条的前提");
  assert.equal(legal(at({ qualities: { ...done4, "mainline:act": 5, "clue:slip-handover": 1 } }), names), true,
    "查过「待定」那两个字的第 5 季第 12 天以后，沈薇在楼上 —— 这一张就该来");
  assert.equal(legal(at({ qualities: { ...done4, "mainline:act": 4, "clue:slip-handover": 1 } }), names), false,
    "幕号停在 4 时不许演第 5 幕中间的卡");

  const desk = card("main-a5-desk");
  assert.equal(legal(at({ qualities: { ...done4, "mainline:act": 5, "clue:slip-handover": 1 } }), desk), false,
    "还没查出「还是那个名字在签」，方敏就不该来问这一栏落谁 —— 收束要建立在第 8 条线索上");
  assert.equal(legal(at({ qualities: { ...done4, "mainline:act": 5, "clue:slip-handover": 1, "clue:slip-signature": 1 } }), desk), true,
    "两条都查到了、第 5 季第 20 天以后、方敏在楼上 —— 这一幕收得了");

  // 跨季不重演：抬幕号那张自己关门，另两张靠自动补的 mainline:seen 记号。
  const seen = (id: string) => ({ [`mainline:seen:${id}`]: 1 });
  assert.equal(legal(at({ qualities: { ...done4, "mainline:act": 5, "clue:slip-handover": 1, ...seen("main-a5-names") } }), names), false,
    "main-a5-names 演过以后第 6 季不许原样再演一遍");
  assert.equal(legal(at({ qualities: { ...done4, "mainline:act": 5, "clue:slip-handover": 1, "clue:slip-signature": 1, ...seen("main-a5-desk") } }), desk), false,
    "main-a5-desk 演过以后不许再演 —— 这一幕的收束只说一次");
  assert.equal(legal(at({ qualities: { ...done4, "thread:return-slip": 13, ...seen("main-a5-open") } }), open), true,
    "main-a5-open 靠抬幕号自己关门（ACT(4) 抬到 5 就断），不需要 seen 记号 —— 别把它加进名单又漏掉别的");

  // 内容里出现的最大幕号必须正好是 MAINLINE_ACTS 的长度：加一幕要真的写到底，不许名单先扩。
  const actNumbers: number[] = [];
  for (const s of STORYLETS) for (const x of s.when)
    if ("quality" in x && x.quality === "mainline:act") actNumbers.push(x.eq ?? x.gte ?? 0);
  const maxAct = Math.max(...actNumbers);
  assert.equal(maxAct, MAINLINE_ACTS.length,
    `内容里的门最大到第 ${maxAct} 幕，名单却有 ${MAINLINE_ACTS.length} 幕 —— 档案与回顾会念出一句没人演到的"下一幕"`);
});

test("主线按季续写：去年那一栏怎么落的，决定今年她说哪一句 —— 两个记号都不许有死档", () => {
  // 第 37 轮代价 ①：幕号抬到 5 以后，第 6、7 季的主线整季 0 张。第 38 轮的形状不是"再开一幕"，
  // 是"一幕里按季续写"：每一季那一张读**上一季那一张写下的记号**（mainline:a5-row → a6-row）。
  // 于是这一条要钉的是记号本身，形状照第 34 轮那条梯子守卫：两头都咬 ——
  // 缺档（去年落了这一档，今年没这句话）与死档（今年这句话挂在一个去年根本写不出的读数上）。
  // 为什么不按 `remember` 分叉：nextSeason 只带走 |valence| === 2 的记忆（engine.ts:1247），
  // 而第 5 幕收束那三格里有一格写的是 valence 1 —— 照它分叉就是一个永远打不开的死档。下面最后一段钉的就是这件事。
  const card = (id: string) => STORYLETS.find(s => s.id === id)!;
  const legal = (w: World, c: Storylet) => c.when.every(x => evalCond(w, PEOPLE, x));
  const visible = (w: World, c: Storylet) => c.choices.filter(x => !x.when || x.when.every(k => evalCond(w, PEOPLE, k))).length;
  const at = (patch: Partial<World>): World => ({
    ...newWorld("a6-chain", PEOPLE), season: 6, day: 24, slot: 1,
    present: { shen: "counter", fangmin: "counter" },
    qualities: { "mainline:act": 5, "clue:slip-handover": 1, "clue:slip-signature": 1 }, ...patch,
  });

  // 门里读到的档（含 any / not 递归）
  const reads = (c: Cond, key: string): number[] => {
    if ("any" in c) return c.any.flatMap(x => reads(x, key));
    if ("not" in c) return reads(c.not, key);
    return "quality" in c && c.quality === key && typeof c.eq === "number" ? [c.eq] : [];
  };
  const forkValues = (s: Storylet, key: string) =>
    [...new Set(s.choices.flatMap(c => (c.when ?? []).flatMap(x => reads(x, key))))].sort((a, b) => a - b);

  const a6 = card("main-a6-relay");
  const a7 = card("main-a7-same");

  // ① 上一季写得出哪几档 —— 这是分叉的前提，写不出来的档位在门里就是装饰。
  assert.deepEqual(qualityValues.get("mainline:a5-row"), [1, 2, 3],
    "mainline:a5-row 全柜写出的档位不是 [1,2,3] —— 第 5 幕收束那三格各写一档是这张卡分叉的上游");
  assert.deepEqual(qualityValues.get("mainline:a6-row"), [1, 2, 3, 4],
    "mainline:a6-row 全柜写出的档位不是 [1,2,3,4] —— 第 7 季那张的门就是照这四个值摆的");
  // ② 写出的每一档都有格子接住，且格子只挂在写得出的档上（两头 containment，缺档与死档一起咬）。
  assert.deepEqual(forkValues(a6, "mainline:a5-row"), [1, 2, 3],
    `第 6 季那张读 mainline:a5-row 读到的是 ${JSON.stringify(forkValues(a6, "mainline:a5-row"))}，可上游写得出 [1,2,3] —— 有一档去年落了名、今年没这句话`);
  assert.deepEqual(forkValues(a7, "mainline:a6-row"), [1, 2, 3, 4],
    `第 7 季那张读 mainline:a6-row 读到的是 ${JSON.stringify(forkValues(a7, "mainline:a6-row"))}，可上游写得出 [1,2,3,4]`);
  // ③ 兜底那一格不许省：去年那一栏可能压根没落名（没演到 main-a5-desk），门全认档时桌上是空的。
  for (const s of [a6, a7]) {
    assert.ok(s.choices.some(c => !c.when || !c.when.length), `${s.id} 没有保底那一格：去年那一栏没落名时桌上是空的`);
    assert.equal(s.kind, "mainline", `${s.id} 不是主线卡，抽卡那层的优先级会走错`);
    for (const c of s.choices) {
      assert.ok(!c.effects.some(e => "stat" in e && e.stat === "money"), `${s.id}「${c.label}」给了钱 —— 主线这几格只动本子与人情`);
    }
  }
  // 第 6 季那一张的每一格都要把记号写下去 —— 第 7 季那句「它抄自己」全靠它当上游。
  // 第 7 季那张不写：梯子只到第 7 季，往 a7-row 写一个没人读的键就是下一轮的死格子。
  for (const c of a6.choices) {
    assert.ok(c.effects.some(e => "quality" in e && e.quality === "mainline:a6-row" && typeof e.set === "number"),
      `第 6 季那张「${c.label}」没写 mainline:a6-row —— 第 7 季那一格就没有上游`);
  }
  assert.ok(!a7.choices.some(c => c.effects.some(e => "quality" in e && e.quality === "mainline:a7-row")),
    "第 7 季那张写了没人读的记号 —— 第 8 季还没做，这一笔是空转");
  // 回顾页那句钩子（「这一页没合上」）现在认的是"内容里还有没有比这一季更晚的主线卡"（recap.ts）。
  // 所以这一句把边界钉在内容上：主线讲到第 7 季为止。加第 8 季那张时要一起改的是这里与那句断言，
  // 不是回顾页的文案 —— 文案自己会从内容里推。
  const seasonGates = STORYLETS.filter(s => s.kind === "mainline")
    .flatMap(s => s.when.filter(c => "season" in c).map(c => (c as { season: { gte?: number } }).season.gte ?? 0));
  assert.equal(Math.max(...seasonGates), 7,
    `内容里最晚的一张主线卡开在第 ${Math.max(...seasonGates)} 季 —— 回顾页的钩子中位在这一季之后就该收，改了这里要一起改 docs 那句"讲到第 7 季为止"`);
  // ④ 每张都要在「演过就不再演」的名单里：门里的线索与幕号过季照样成立，不发记号就会一季重念一遍。
  for (const s of [a6, a7]) {
    assert.ok(s.when.some(c => "not" in c && "quality" in c.not && c.not.quality === `mainline:seen:${s.id}`),
      `${s.id} 的门里没有「没演过」这一道 —— 它会跨季原样重演`);
    assert.ok(s.choices.every(c => c.effects.some(e => "quality" in e && e.quality === `mainline:seen:${s.id}`)),
      `${s.id} 有一格没落下「演过」的记号`);
  }

  // ⑤ 季门：第 5 季不许演第 6 季那张，第 6 季不许演第 7 季那张 —— 预门在 bindCast 之前判，
  //    这两句同时保证"加晚季卡不许挪抽样流"那条不变量还成立。
  const a5row1 = { "mainline:a5-row": 1 };
  assert.equal(legal(at({ season: 5, qualities: { ...at({}).qualities, ...a5row1 } }), a6), false,
    "第 5 季不许演第 6 季那一张 —— 那一栏要满一年才长得出「照旧」这层");
  assert.equal(legal(at({ qualities: { ...at({}).qualities, ...a5row1 } }), a6), true,
    "第 6 季、幕号 5、本子上有第 8 条、去年落过名 —— 这一格就该开");
  assert.equal(legal(at({ season: 7, day: 12, qualities: { ...at({}).qualities, "mainline:a6-row": 1 } }), a7), false,
    "第 7 季第 12 天不许演（day ≥ 16）—— 那行小字要在抄件上印满一季才看得见");
  // ⑥ 本子的次序：第 9 条要第 8 条，第 10 条要第 9 条 —— 不许凭空掉下一条。
  assert.equal(legal(at({ qualities: { "mainline:act": 5, "clue:slip-handover": 1, ...a5row1 } }), a6), false,
    "没查到「照旧签」那条线索，第 6 季那张不该开 —— 反转要玩家先挣到上一句");
  assert.equal(legal(at({ season: 7, day: 20, qualities: { ...at({}).qualities, "mainline:a6-row": 1 } }), a7), false,
    "本子上没有第 9 条「换的是名字，号一年没换」，第 7 季那句「它抄自己」就没人接");
  // ⑦ 去年没落名（记号 0）时，桌上只剩兜底那一格，不许是空的。
  assert.equal(visible(at({ qualities: { ...at({}).qualities } }), a6), 1,
    "去年那一栏没落名时，第 6 季那张该只剩兜底那一格开着");
  assert.equal(visible(at({ qualities: { ...at({}).qualities, "mainline:a5-row": 2 } }), a6), 2,
    "去年落的是「主张撤栏」，桌上该是那一格 + 兜底那一格");
  for (const n of [1, 2, 3, 4]) {
    assert.equal(visible(at({ season: 7, day: 20, qualities: { ...at({}).qualities, "clue:slip-number": 1, "mainline:a6-row": n } }), a7), 2,
      `第 6 季落在档 ${n} 时，第 7 季那张该有「这一档的话」+ 兜底共两颗开着`);
  }

  // ⑧ 钉住那段被绕开的引擎行为本身：换季把 |valence| !== 2 的记忆洗掉。
  //    没有这一条，以后有人把分叉改挂到 remember 上，静态门探针在单季夹具里照样全绿。
  const memWorld: World = {
    ...newWorld("a6-mem", PEOPLE), season: 5, day: 28,
    present: { fangmin: "counter" },
    memories: [
      { day: 24, holder: "fangmin", subject: PLAYER, act: "a5-row-closed", valence: 1 },
      { day: 24, holder: "fangmin", subject: PLAYER, act: "a5-her-name", valence: 2 },
    ],
  };
  const kept = nextSeason(memWorld, PEOPLE).memories.map(m => m.act);
  assert.deepEqual(kept, ["a5-her-name"],
    `换季带走的记忆形状变了（现在是 ${JSON.stringify(kept)}）—— 第 6 季那张分叉改读记忆的依据也跟着变，要一起改`);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ambient, applyChoice, availableVerbs, beginSlot, doVerb, drawStorylet, endDay,
  MAX_PRESENT_CUSTOMERS, newWorld, opinionOf, parseWorld,
  resolveServe, seasonSummary, serializeWorld, verbOptions,
  warmthOf, VERB_ENERGY, SAVE_KEY, WORLD_SAVE_VERSION,
} from "../src/world/engine.ts";
import type { Person, Storylet, World } from "../src/world/types.ts";
import { PLAYER } from "../src/world/types.ts";
import { PRODUCTS } from "../src/campaign.ts";
import { FIXTURE_PEOPLE, FIXTURE_STORYLETS } from "./fixtures/world-fixture.ts";

const PEOPLE = FIXTURE_PEOPLE;
const person = (id: string) => PEOPLE.find(p => p.id === id)!;

/** 手动摆一个场面：不经过 beginSlot，直接指定谁在场。 */
const stage = (w: World, ids: string[], zone = "atrium"): World =>
  ({ ...w, present: Object.fromEntries(ids.map(id => [id, zone])) });

const setOpinion = (w: World, id: string, v: number): World =>
  ({ ...w, opinion: { ...w.opinion, [id]: v } });

/** 一段固定剧本：两天八时段，每时段开场→闲聊→说书人→做第一个能做的动作。 */
function runScript(seed: string): World {
  let w = newWorld(seed, PEOPLE);
  for (let day = 0; day < 2; day++) {
    for (let slot = 0; slot < 4; slot++) {
      w = { ...w, slot: slot as 0 | 1 | 2 | 3 };
      w = beginSlot(w, PEOPLE);
      w = ambient(w, PEOPLE);
      const { world: w2, drawn } = drawStorylet(w, PEOPLE, FIXTURE_STORYLETS);
      w = drawn ? applyChoice(w2, PEOPLE, drawn, 0) : w2;
      const call = verbOptions(w, PEOPLE)[0];
      if (call) w = doVerb(w, PEOPLE, call.verb, call.targets);
    }
    w = endDay(w, PEOPLE);
  }
  return w;
}

test("同一个种子、同一串操作，结果逐位相同", () => {
  const a = runScript("det-1"), b = runScript("det-1");
  assert.equal(serializeWorld(a), serializeWorld(b));
  const c = runScript("det-2");
  assert.notEqual(serializeWorld(a), serializeWorld(c), "不同种子应当走出不同的世界");
});

test("beginSlot：同事常驻、对手在 rival 区、顾客不超过上限", () => {
  let w = beginSlot(newWorld("t2", PEOPLE), PEOPLE);
  assert.ok("suman" in w.present && "tangke" in w.present, "同事常驻");
  assert.equal(w.present["luyao"], "rival", "对面的人在 rival 区");
  const customers = Object.keys(w.present).filter(id => person(id).role === "customer");
  assert.ok(customers.length <= MAX_PRESENT_CUSTOMERS);

  // 上限钉死：造 8 个一定来的顾客，场上也只能坐 5 个。
  const crowd: Person[] = Array.from({ length: 8 }, (_, i) => ({
    ...person("duan"), id: `crowd-${i}`, bonds: [],
    visits: { days: "any" as const, slots: [0, 1, 2, 3] as (0 | 1 | 2 | 3)[], chance: 1 },
  }));
  w = beginSlot(newWorld("t2", crowd), crowd);
  assert.equal(Object.keys(w.present).length, MAX_PRESENT_CUSTOMERS);

  // 预约的人越过 Visits 规律也要来：梅女士第 2 天本不来（days [1,3,5]）。
  w = { ...newWorld("t2", PEOPLE), day: 2,
    appointments: [{ day: 2, slot: 0, person: "mei", reason: "visit" }] };
  w = beginSlot(w, PEOPLE);
  assert.ok("mei" in w.present);
});

test("传话：没见过玩家的人进门就带着看法", () => {
  // 沈薇亲眼见过玩家硬推（一手记忆），她跟何太同场且要好 → 有概率讲出去。
  let w = stage(newWorld("t2", PEOPLE), ["shen", "he"]);
  w = { ...w, memories: [{ day: 1, holder: "shen", subject: PLAYER, act: "hard-sell", valence: -2 }] };
  w = ambient(w, PEOPLE);
  const heard = w.memories.find(m => m.holder === "he" && m.act === "hard-sell");
  assert.ok(heard, "何太应当听到了这件事");
  assert.equal(heard!.heardFrom, "shen", "听来的话要记着是谁说的");
  assert.ok(opinionOf(w, "he") < 0, "她还没见过你，看法已经先入为主");
  assert.ok(w.memories.filter(m => m.holder === "he" && m.subject === PLAYER).every(m => m.heardFrom),
    "她的负面看法全部来自转述，没有一条是亲眼所见");

  // 同一件事 A 已经讲过就不再记第二遍。
  const count = w.memories.filter(m => m.holder === "he" && m.act === "hard-sell").length;
  w = ambient(w, PEOPLE);
  assert.equal(w.memories.filter(m => m.holder === "he" && m.act === "hard-sell").length, count);
});

test("多疑的人把听来的话打折", () => {
  // he2 是何太的多疑删除版；两人对沈薇的信任一样，收到的传话应该减半。
  const he2: Person = { ...person("he"), id: "he2", tempers: [] };
  const folks = [...PEOPLE, he2];
  const base = (): World => stage(
    { ...newWorld("t2", folks), bonds: { "shen>he": 45, "shen>he2": 45 } },
    [], "atrium");
  const rumor = [{ day: 1, holder: "shen", subject: PLAYER, act: "hard-sell", valence: -2 as const }];

  let waryW = { ...base(), present: { shen: "atrium", he: "atrium" }, memories: [...rumor] };
  waryW = ambient(waryW, folks);
  let plainW = { ...base(), present: { shen: "atrium", he2: "atrium" }, memories: [...rumor] };
  plainW = ambient(plainW, folks);

  const wary = opinionOf(waryW, "he"), plain = opinionOf(plainW, "he2");
  assert.ok(plain < 0 && wary < 0);
  assert.ok(Math.abs(wary) < Math.abs(plain), `多疑 ${wary} 应比不多疑 ${plain} 动得少`);
  assert.ok(Math.abs(wary) <= Math.ceil(Math.abs(plain) / 2), "打折至少是减半");
});

test("说书人：角色槽按声明顺序绑定，once 与 cooldown 生效", () => {
  // st-heard-rumor：$a 记着坏话、在场；$b 在场且 a→b 冷暖 ≥10。
  const rumor = FIXTURE_STORYLETS.find(s => s.id === "st-heard-rumor")!;
  let w = stage(newWorld("t2", PEOPLE), ["shen", "he"]);
  w = { ...w, memories: [{ day: 1, holder: "shen", subject: PLAYER, act: "hard-sell", valence: -2 }] };
  const { world: w2, drawn } = drawStorylet(w, PEOPLE, [rumor]);
  assert.ok(drawn);
  assert.equal(drawn!.binding["a"], "shen");
  assert.equal(drawn!.binding["b"], "he");
  w = applyChoice(w2, PEOPLE, drawn!, 0);
  assert.ok("st-heard-rumor" in w.fired);

  // st-mei-arc-1 是 once：触发过就不再出现。
  const arc = FIXTURE_STORYLETS.find(s => s.id === "st-mei-arc-1")!;
  w = stage(newWorld("t2", PEOPLE), ["mei"], "counter");
  w = setOpinion(w, "mei", 30);
  const first = drawStorylet(w, PEOPLE, [arc]);
  assert.ok(first.drawn, "条件满足应当能抽到");
  w = applyChoice(first.world, PEOPLE, first.drawn!, 0);
  assert.equal(drawStorylet(w, PEOPLE, [arc]).drawn, null, "once 的卡不能再抽");

  // st-sister-quarrel 冷却 3 天：触发后第 1、2 天抽不到，第 4 天又能抽。
  const quarrel = FIXTURE_STORYLETS.find(s => s.id === "st-sister-quarrel")!;
  w = stage(newWorld("t2", PEOPLE), ["peng", "zhao"]);
  const q1 = drawStorylet(w, PEOPLE, [quarrel]);
  assert.ok(q1.drawn);
  w = applyChoice(q1.world, PEOPLE, q1.drawn!, 0);
  for (const ahead of [1, 2]) {
    const later = { ...w, day: w.day + ahead };
    assert.equal(drawStorylet(later, PEOPLE, [quarrel]).drawn, null, `冷却中（+${ahead} 天）不能抽`);
  }
  const later = { ...w, day: w.day + 3 };
  assert.ok(drawStorylet(later, PEOPLE, [quarrel]).drawn, "冷却结束又能抽了");
});

test("说书人热度：冲突多了压低 tension=1 的卡", () => {
  const hot = FIXTURE_STORYLETS.find(s => s.id === "st-rival-jab")!;
  const calm = FIXTURE_STORYLETS.find(s => s.id === "st-quiet-day")!;
  const count = (seed: string, heat: number) => {
    let hits = 0;
    for (let i = 0; i < 40; i++) {
      const w = stage({ ...newWorld(`${seed}-${i}`, PEOPLE), qualities: { "storyteller:heat": heat } }, ["luyao", "mei"]);
      const { drawn } = drawStorylet(w, PEOPLE, [hot, calm]);
      if (drawn?.storylet.id === "st-rival-jab") hits++;
    }
    return hits;
  };
  assert.ok(count("h", -3) > count("h", 3), "火药味重时起冲突的卡要被压下去");
});

test("卖货：判断对了入账记 honest-advice，推错的不强卖", () => {
  let w = stage(newWorld("t2", PEOPLE), ["mei"], "counter");
  w = resolveServe(w, PEOPLE, "mei", "soft", 1);
  assert.equal(w.money, PRODUCTS.soft.price, "柔焦是梅女士的正解");
  assert.ok(opinionOf(w, "mei") > 0);
  assert.ok(w.memories.some(m => m.holder === "mei" && m.act === "honest-advice" && m.valence === 2));

  // 判断错了不强卖：持妆不是她的答案，没买成但也没结仇。
  w = stage(newWorld("t2", PEOPLE), ["mei"], "counter");
  w = resolveServe(w, PEOPLE, "mei", "glow", 1);
  assert.equal(w.money, 0);
  assert.ok(opinionOf(w, "mei") < 0);
  assert.ok(w.memories.some(m => m.holder === "mei" && m.act === "wrong-pick" && m.valence === -1));

  // 买过一次的人不是无限钱包：马上再接待，只聊不买。
  w = stage(newWorld("t2", PEOPLE), ["mei"], "counter");
  w = resolveServe(w, PEOPLE, "mei", "soft", 1);
  w = resolveServe(w, PEOPLE, "mei", "soft", 1);
  assert.equal(w.money, PRODUCTS.soft.price, "冷却期内不再开单");
});

test("硬推：当场入账，但预约了两天后来退货", () => {
  let w = stage(newWorld("t2", PEOPLE), ["mei"], "counter");
  w = resolveServe(w, PEOPLE, "mei", "glow", 2, true);
  const price = PRODUCTS.glow.price; // 梅女士上限 1 件
  assert.equal(w.money, price, "硬推当场入账");
  assert.equal(opinionOf(w, "mei"), -12);
  assert.ok(w.memories.some(m => m.holder === "mei" && m.act === "hard-sell" && m.valence === -2));
  const ap = w.appointments.find(a => a.reason === "refund");
  assert.ok(ap, "应当约了一个回来退货的单");
  assert.ok(ap!.day - w.day >= 2 && ap!.day - w.day <= 3, "退货在 2~3 天后");
  assert.equal(ap!.amount, price);

  // 到了那天那个时段，她进门就退款。
  w = { ...w, day: ap!.day, slot: ap!.slot, energy: 100 };
  w = beginSlot(w, PEOPLE);
  assert.equal(w.money, 0, "退款当场出账");
  assert.ok(opinionOf(w, "mei") <= -20, "退货再加一层怨气");
  assert.ok(w.log.some(l => l.text.includes("退")), "楼层上看得见她回来退货");
});

test("介绍：双方都认你时成朋友，两个好胜的人较上劲，看法低时尴尬", () => {
  // 成功：梅女士和小段原本不认识。
  let w = stage(newWorld("t2", PEOPLE), ["mei", "duan"]);
  w = setOpinion(setOpinion(w, "mei", 15), "duan", 15);
  w = doVerb(w, PEOPLE, "introduce", ["mei", "duan"]);
  assert.equal(warmthOf(w, PEOPLE, "mei", "duan"), 20);
  assert.equal(w.bondKinds?.["mei>duan"], "friend");

  // 两个好胜的人：彭姐和邱太。
  w = stage(newWorld("t2", PEOPLE), ["peng", "qiu"]);
  w = setOpinion(setOpinion(w, "peng", 15), "qiu", 15);
  w = doVerb(w, PEOPLE, "introduce", ["peng", "qiu"]);
  assert.equal(w.bondKinds?.["peng>qiu"], "rival");
  assert.ok(warmthOf(w, PEOPLE, "peng", "qiu") < 0);

  // 看法不到线：尴尬、两边都扣。
  w = stage(newWorld("t2", PEOPLE), ["mei", "duan"]);
  w = doVerb(w, PEOPLE, "introduce", ["mei", "duan"]);
  assert.equal(opinionOf(w, "mei"), -4);
  assert.equal(opinionOf(w, "duan"), -4);
  assert.ok(!w.bondKinds?.["mei>duan"], "没结成关系");
});

test("打圆场：冷暖够低才接得起来，成败两条分支", () => {
  // 关系不够冷不给劝。
  let w = stage(newWorld("t2", PEOPLE), ["mei", "duan"]);
  assert.ok(!availableVerbs(w, PEOPLE, ["mei", "duan"]).includes("mediate"));

  // 彭姐和赵阿姨是 -35 的对头：两人都抬看法时成功率高（seed t2 那一抽 < 0.75）。
  w = stage(newWorld("t2", PEOPLE), ["peng", "zhao"]);
  w = setOpinion(setOpinion(w, "peng", 40), "zhao", 40);
  w = doVerb(w, PEOPLE, "mediate", ["peng", "zhao"]);
  assert.ok(warmthOf(w, PEOPLE, "peng", "zhao") > -35, "说成了关系回暖");
  assert.ok(w.memories.some(m => m.holder === "peng" && m.act === "mediated" && m.valence === 2));

  // 两人都看你不顺眼时成功率低（seed t1 那一抽 ≥ 0.15），失败两边都扣。
  w = stage(newWorld("t1", PEOPLE), ["peng", "zhao"]);
  w = setOpinion(setOpinion(w, "peng", -20), "zhao", -20);
  w = doVerb(w, PEOPLE, "mediate", ["peng", "zhao"]);
  assert.equal(opinionOf(w, "peng"), -26, "劝崩了两边都怪你");
  assert.equal(opinionOf(w, "zhao"), -26);
});

test("招呼、小样、加微信的门都在", () => {
  let w = stage(newWorld("t2", PEOPLE), ["duan", "mei"]);
  assert.ok(availableVerbs(w, PEOPLE, ["duan"]).includes("greet"));
  w = doVerb(w, PEOPLE, "greet", ["duan"]);
  assert.equal(opinionOf(w, "duan"), 3);
  // 怕被推销的小段同一天再被招呼会反感。
  w = doVerb(w, PEOPLE, "greet", ["duan"]);
  assert.ok(opinionOf(w, "duan") < 3, "反复招呼她躲开了");

  w = doVerb(w, PEOPLE, "sample", ["duan"]);
  assert.equal(w.samples, 7, "小样要真给出去一支");
  assert.equal(opinionOf(w, "duan"), 10, "精打细算的人拿小样更高兴（+3 招呼 −3 反感 +10 小样）");

  // 微信要看法够高才加得上。
  assert.ok(!availableVerbs(w, PEOPLE, ["mei"]).includes("wechat"));
  w = setOpinion(w, "mei", 20);
  assert.ok(availableVerbs(w, PEOPLE, ["mei"]).includes("wechat"));
  w = doVerb(w, PEOPLE, "wechat", ["mei"]);
  assert.ok(w.qualities["wechat:mei"], "加上微信记成 quality");
});

test("保密与传话：传出去的秘密会流回事主耳朵里", () => {
  let w = stage(newWorld("t3", PEOPLE), ["he", "qiu"]);
  w = { ...w, qualities: { "secret-known:qiu": 1 } };
  // 先替她保密：看法涨、记 kept-secret。
  w = doVerb(w, PEOPLE, "keep", ["qiu"]);
  assert.ok(opinionOf(w, "qiu") > 0);
  assert.ok(w.qualities["secret-kept:qiu"]);

  // 再把她的事说给何太听：听众涨看法，quality 记下"传出去了"。
  w = doVerb(w, PEOPLE, "tell", ["he", "qiu"]);
  assert.ok(w.memories.some(m => m.holder === "he" && m.subject === "qiu" && m.act === "secret"));
  assert.ok(w.qualities["secret-out:qiu"]);

  // 何太和邱太同场（seed t3 那抽 < 0.5）：事主对上号，因为答应过保密所以记仇更深。
  const before = opinionOf(w, "qiu");
  w = ambient(w, PEOPLE);
  assert.ok(opinionOf(w, "qiu") <= before - 35 + 1, "先保密又传出去，仇记更深");
  assert.ok(w.memories.some(m => m.holder === "qiu" && m.act === "betrayed" && m.valence === -2));
});

test("精力是硬门槛：不够 20 点接不了客", () => {
  let w = stage(newWorld("t2", PEOPLE), ["mei"], "counter");
  w = { ...w, energy: VERB_ENERGY.serve - 1 };
  assert.ok(!availableVerbs(w, PEOPLE, ["mei"]).includes("serve"));
  const frozen = resolveServe(w, PEOPLE, "mei", "soft", 1);
  assert.equal(frozen.money, 0, "没精力开不了单");
});

test("存档：序列化往返一致，坏档整份拒收", () => {
  const w = runScript("det-1");
  const parsed = parseWorld(serializeWorld(w));
  assert.deepEqual(parsed, w, "序列化 → 解析应当还原同一个世界");
  assert.equal(SAVE_KEY, "last-order-world-v1");
  assert.equal(WORLD_SAVE_VERSION, 1);

  assert.equal(parseWorld("not json"), null);
  assert.equal(parseWorld(JSON.stringify({ version: 99, world: w })), null, "版本不符拒收");
  const broken = JSON.parse(serializeWorld(w));
  delete broken.world.memories;
  assert.equal(parseWorld(JSON.stringify(broken)), null, "缺字段拒收");
  const wrongType = JSON.parse(serializeWorld(w));
  wrongType.world.memories = [{ day: 1, holder: "x", subject: "player", act: "a", valence: 3 }];
  assert.equal(parseWorld(JSON.stringify(wrongType)), null, "valence 越界拒收");
});

test("一季盘点：盟友、仇人、个人线落点", () => {
  let w = newWorld("t2", PEOPLE);
  w = setOpinion(setOpinion(w, "mei", 45), "peng", -40);
  w = { ...w, money: 5000, qualities: { "arc:mei:end": 2, "arc:luyao:clash": 1 } };
  const s = seasonSummary(w, PEOPLE);
  assert.deepEqual(s.allies, ["mei"]);
  assert.deepEqual(s.enemies, ["peng"]);
  assert.equal(s.arcs["mei"]["end"], 2);
  assert.equal(s.money, 5000);
});

test("endDay：精力重置、天数推进、加了微信的人会约回来", () => {
  let w = newWorld("t2", PEOPLE);
  w = { ...w, energy: 3, samples: 0, qualities: { "wechat:mei": 1 } };
  w = endDay(w, PEOPLE);
  assert.equal(w.day, 2);
  assert.equal(w.energy, 100);
  assert.equal(w.samples, 4);
  // 夜里传话沿关系网走一遍，世界仍在推进（rngCalls 前进）。
  assert.ok(w.rngCalls > 0);
});

test("角色槽：同一个人不会同时填进两个槽", () => {
  const pair: Storylet = {
    id: "t-two-customers", kind: "social", tension: 0, weight: 1, text: "{$a}和{$b}",
    cast: { a: { where: [{ role: "$self", is: "customer" }] }, b: { where: [{ role: "$self", is: "customer" }] } },
    when: [], choices: [{ label: "好", effects: [], result: "好" }],
  };
  for (let i = 0; i < 40; i++) {
    const w = stage(newWorld(`distinct-${i}`, PEOPLE), ["mei", "shen"]);
    const { drawn } = drawStorylet(w, PEOPLE, [pair]);
    assert.ok(drawn, "两位顾客在场，这张卡必须抽得出来");
    assert.notEqual(drawn.binding.a, drawn.binding.b);
  }
});

test("角色槽：前一个槽的人配不上后面的槽时，回头换人", () => {
  const friends: Storylet = {
    id: "t-friends", kind: "social", tension: 0, weight: 1, text: "{$a}带着{$b}",
    cast: { a: { where: [{ role: "$self", is: "customer" }] }, b: { where: [{ bond: ["$a", "$self"], gte: 1 }] } },
    when: [], choices: [{ label: "好", effects: [], result: "好" }],
  };
  // 梅女士在场但谁也不认识；只有沈薇和何太互为熟人。不回溯的话，先抽到梅女士的种子会整张作废。
  for (let i = 0; i < 40; i++) {
    const w = stage(newWorld(`backtrack-${i}`, PEOPLE), ["mei", "shen", "he"]);
    const { drawn } = drawStorylet(w, PEOPLE, [friends]);
    assert.ok(drawn, `种子 backtrack-${i} 应该绑得出来`);
    assert.ok(["shen", "he"].includes(drawn.binding.a));
  }
});

test("柜位：人情动作加柜位，一天只算第一次", () => {
  let w = stage(newWorld("standing-social", PEOPLE), ["suman", "tangke"], "counter");
  const start = w.standing;
  w = doVerb(w, PEOPLE, "help", ["suman"]);
  assert.equal(w.standing, start + 1, "第一次帮同事，柜位 +1");
  w = doVerb(w, PEOPLE, "help", ["tangke"]);
  assert.equal(w.standing, start + 1, "同一天再帮另一位，柜位不再涨");
});

test("柜位：每晚把离起点的差距回落一成", () => {
  const high = { ...newWorld("standing-drift", PEOPLE), standing: 90 };
  assert.equal(endDay(high, PEOPLE).standing, 86);
  const low = { ...newWorld("standing-drift", PEOPLE), standing: 20 };
  assert.equal(endDay(low, PEOPLE).standing, 23);
});

test("场子不空：每个时段至少两位客人；开局上午沈薇和梅女士在柜台前", () => {
  let w = newWorld("never-empty", PEOPLE);
  w = beginSlot(w, PEOPLE);
  assert.equal(w.present.shen, "counter");
  assert.equal(w.present.mei, "counter");
  for (let day = 0; day < 3; day++) {
    for (let slot = 0; slot < 4; slot++) {
      w = beginSlot({ ...w, slot: slot as 0 | 1 | 2 | 3 }, PEOPLE);
      const guests = Object.keys(w.present).filter(id => person(id)?.role === "customer");
      assert.ok(guests.length >= 2, `第 ${w.day} 天时段 ${slot} 只有 ${guests.length} 位客人`);
    }
    w = endDay(w, PEOPLE);
  }
});

test("陆遥在时段末带走没顾上的人，她当天不再回来", () => {
  // 找一个种子：开局上午沈薇、梅女士都在，玩家谁也没招呼，时段末有人被带走。
  for (let i = 0; i < 60; i++) {
    let w = beginSlot(newWorld(`poach-${i}`, PEOPLE), PEOPLE);
    w = ambient(w, PEOPLE);
    const gone = ["shen", "mei"].find(id => w.present[id] === "rival");
    if (!gone) continue;
    for (let slot = 1; slot < 4; slot++) {
      w = beginSlot({ ...w, slot: slot as 0 | 1 | 2 | 3 }, PEOPLE);
      assert.ok(!(gone in w.present), `${gone} 当天被请走，第 ${slot} 时段不该再出现`);
    }
    return;
  }
  assert.fail("60 个种子里没有一次抢客，概率常量可能被改坏了");
});

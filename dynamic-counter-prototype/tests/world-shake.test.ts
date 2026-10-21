import assert from "node:assert/strict";
import { test } from "node:test";
import { ambient, beginServe, beginSlot, doVerb, newWorld, parseWorld, rivalGuarded, rivalPlanWord,
  rivalShakeCandidates, rivalShakes, rivalTargets, rivalThreats, serializeWorld,
  SHAKE_MAX_PER_DAY, SHAKE_MAX_PER_WEEK, SHAKE_MAX_TOTAL, SHAKE_OPINION } from "../src/world/engine.ts";
import { CARE_TRUST_MIN, weekGuardPersonKey, weekGuardThreatKey, weekShakeKey, weekShakeTotalKey } from "../src/world/target.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { World } from "../src/world/types.ts";

// 撬客这一刀：她抢不到能买的人时，改去撬你信得过的熟客 —— 旱周里能卖的都被十天间隔锁住，
// 守客这条线才重新有戏份。名单最小可用：一位客人、一位同事、陆遥本人。
const GUEST = "shen", OTHER = "mei", STAFF = "fangmin";
const roster = PEOPLE.filter(p => [GUEST, OTHER, STAFF, "luyao"].includes(p.id));
const base = (over: Partial<World> = {}): World => ({
  ...newWorld("shake-test", roster),
  day: 9, slot: 1, energy: 80, touched: [],
  opinion: { [GUEST]: 100, [OTHER]: 100, [STAFF]: 50 },
  ...over,
});
// 沈薇按预约落位在柜前，其余按当天来访。预约理由用「invited」：
// 「visit」会让她到场就顺手买一支（看法 ≥ 5 就买），买过的人进十天间隔，她抢不也撬不走。
const opening = (over: Partial<World> = {}) => beginSlot(base({
  appointments: [{ person: GUEST, day: 9, slot: 1, reason: "invited" }], ...over,
}), roster);

test("抢不到能买的人时，她公开点名一位你信得过的熟客", () => {
  const w = opening();
  assert.deepEqual(rivalTargets(w), [], "信得过的人她抢不走");
  assert.deepEqual(rivalShakes(w), [GUEST]);
  assert.ok(rivalThreats(w).includes(GUEST), "楼层要亮出她盯上的人");
  assert.equal(w.qualities[weekGuardThreatKey(2, 9, 1, GUEST)], 1, "公开威胁要落到周账上");
  assert.equal(rivalPlanWord(w)!.title, "陆遥改去撬你的熟客");
  assert.equal(rivalPlanWord(w)!.howTo.includes("亲自"), true, "得说清是亲自接住这一位");
});

test("抢得到能买的人时她只抢客，不顺手去撬熟客", () => {
  const w = opening({ opinion: { [GUEST]: 5, [OTHER]: 100, [STAFF]: 50 } });
  assert.deepEqual(rivalTargets(w), [GUEST]);
  assert.deepEqual(rivalShakes(w), [], "抢客和撬客互斥");
});

test("你亲自接住她点名的熟客就算守住，人还在你这边", () => {
  const w = opening();
  const id = rivalShakes(w)[0]!;
  const held = ambient(beginServe(w, roster, id), roster);
  assert.equal(held.qualities[weekGuardPersonKey(2, id)], 1, "接住 = 守客 +1");
  assert.equal(held.present[id], "counter", "接住了人还在你柜前");
  assert.equal(held.opinion[id], 100, "接住了不掉信任");
  assert.equal(rivalGuarded(held, id), true);
});

test("没接住就被她带走，你的信任掉一截，这一格不算守客", () => {
  const w = opening();
  const id = rivalShakes(w)[0]!;
  const lost = ambient(w, roster);
  assert.equal(lost.qualities[weekGuardPersonKey(2, id)], undefined, "没接住不算守住");
  assert.equal(lost.present[id], "rival", "她把人带走了");
  assert.equal(lost.opinion[id], 100 + SHAKE_OPINION, "你的信任掉一截");
  assert.ok(lost.log.some(l => l.text.includes("叫到一边聊了两句")), "这一声要念给玩家听");
});

test("托同事照看挡不住撬客：只有亲自接住才算守住", () => {
  const w = opening();
  const id = rivalShakes(w)[0]!;
  const handed = doVerb(w, roster, "handoff", [STAFF, id]);
  assert.equal(handed.qualities[`guard-commit:9:1:${id}`], undefined, "托单不算接住");
  const end = ambient(handed, roster);
  assert.equal(end.qualities[weekGuardPersonKey(2, id)], undefined);
  assert.equal(end.present[id], "rival");
  assert.equal(end.opinion[id], 100 + SHAKE_OPINION);
});

test("她一天只撬一个人，同一个人一周只被撬一次", () => {
  const w = opening();
  assert.equal(rivalShakes(w).length, SHAKE_MAX_PER_DAY);
  const second = beginSlot({ ...w, slot: 2, appointments: [] }, roster);
  assert.deepEqual(rivalShakes(second), [], "同一天的下一格不再点名");
  // 隔一天、同一周：她换一个人，不能把同一位一周撬两回。
  const next = beginSlot({ ...second, day: 10, slot: 1,
    appointments: [{ person: OTHER, day: 10, slot: 1, reason: "invited" }] }, roster);
  assert.deepEqual(rivalShakes(next), [OTHER]);
  assert.equal(next.qualities[weekShakeKey(2, GUEST)], SHAKE_MAX_PER_WEEK, "本周撬过的人记着");
  assert.equal(next.qualities[weekShakeKey(2, OTHER)], 1);
});

test("她只撬你信得过的熟客：信任不到客情门槛的不点", () => {
  const world = base({ present: { [GUEST]: "counter", luyao: "rival" } });
  assert.deepEqual(rivalShakeCandidates({ ...world, opinion: { [GUEST]: CARE_TRUST_MIN - 1 } }, roster), []);
  assert.deepEqual(rivalShakeCandidates({ ...world, opinion: { [GUEST]: CARE_TRUST_MIN } }, roster).map(p => p.id), [GUEST]);
});

test("一周最多撬七个，超了她换人", () => {
  const world = base({ present: { [GUEST]: "counter", luyao: "rival" },
    qualities: { [weekShakeTotalKey(2)]: SHAKE_MAX_TOTAL } });
  assert.deepEqual(rivalShakeCandidates(world, roster), [], "一周的额度用完了");
  const under = { ...world, qualities: { [weekShakeTotalKey(2)]: SHAKE_MAX_TOTAL - 1 } };
  assert.deepEqual(rivalShakeCandidates(under, roster).map(p => p.id), [GUEST]);
});

test("存档往返不丢撬客名单，坏名单拒收", () => {
  const w = opening();
  const round = parseWorld(serializeWorld(w))!;
  assert.deepEqual(round.rivalPlan!.shakes, rivalShakes(w));
  for (const bad of [["a", "a"], [1], [""]]) {
    const broken = { ...w, rivalPlan: { ...w.rivalPlan!, shakes: bad } } as unknown as World;
    assert.equal(parseWorld(serializeWorld(broken)), null, `坏名单要拒收：${JSON.stringify(bad)}`);
  }
});

test("一个人一周被撬过几次就记几次，额度不靠猜", () => {
  const w = opening();
  assert.equal(w.qualities[weekShakeKey(2, GUEST)], SHAKE_MAX_PER_WEEK);
  assert.equal(w.qualities[weekShakeKey(2, OTHER)], undefined);
  assert.equal(w.qualities[weekShakeTotalKey(2)], 1);
});

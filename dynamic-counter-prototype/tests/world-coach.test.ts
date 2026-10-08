import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COACH_KEY, COACH_STEPS, coachAlive, coachAnchorSelector, coachCustomer, coachPoached,
  coachTip, markCoachSeen, parseCoachSeen, serializeCoachSeen, skipCoachSeen,
  type CoachView,
} from "../src/world/ui/coach.ts";
import { newWorld } from "../src/world/engine.ts";
import type { World } from "../src/world/types.ts";
import { FIXTURE_PEOPLE } from "./fixtures/world-fixture.ts";

// 苏蔓的新手引导：哪一步说哪一句、指着什么，全在 coach.ts 的纯函数里。
// 这里钉触发规则、"每句只出现一次"的 seen 语义、坏数据兜底 —— 界面那一层不进来。

const PEOPLE = FIXTURE_PEOPLE;

/** 楼层默认场面：沈薇在柜前、梅女士在中庭、苏蔓上班、陆遥在对面。 */
const floor = (over: Partial<World> = {}): World => ({
  ...newWorld("coach-test", PEOPLE),
  present: { shen: "counter", mei: "atrium", suman: "counter", luyao: "rival" },
  ...over,
});
const view = (over: Partial<CoachView> = {}): CoachView => ({
  screen: "floor", storyOpen: false, webOpen: false, cardOpen: false, acted: false, ...over,
});

test("开局那个上午：指着柜前的顾客，说先点一个人看看她是谁", () => {
  const tip = coachTip(view(), floor(), PEOPLE, []);
  assert.ok(tip, "新档进楼层该有一句");
  assert.equal(tip.step, "open");
  assert.equal(tip.text, "柜前这两位，先点一个人看看她是谁。");
  assert.deepEqual(tip.anchor, { kind: "actor", id: "shen" }); // 柜前的优先于中庭的
  assert.equal(tip.side, "above");
});

test("开局那句只在第 1 天上午讲：换了天/时段就不再冒出来", () => {
  assert.equal(coachTip(view(), floor({ day: 1, slot: 1 }), PEOPLE, []), null);
  assert.equal(coachTip(view(), floor({ day: 2, slot: 0 }), PEOPLE, []), null);
});

test("第一次打开人物卡：指着那排动作，说每件都花精力", () => {
  const tip = coachTip(view({ cardOpen: true }), floor(), PEOPLE, []);
  assert.equal(tip?.step, "card");
  assert.equal(tip.text, "下面那排是你能做的事，每件都花精力。");
  assert.deepEqual(tip.anchor, { kind: "verbs" });
  assert.equal(tip.side, "above");
});

test("第一次花过精力：指着「下一时段」", () => {
  const tip = coachTip(view({ acted: true }), floor({ energy: 97 }), PEOPLE, []);
  assert.equal(tip?.step, "action");
  assert.equal(tip.text, "精力用得差不多了，就点右上角的「下一时段」。");
  assert.deepEqual(tip.anchor, { kind: "nextSlot" });
  assert.equal(tip.side, "below");
});

test("故事卡摊着的时候只说卡那句，楼层上的提示都让路", () => {
  const tip = coachTip(view({ storyOpen: true, cardOpen: true, acted: true }), floor({ energy: 50 }), PEOPLE, []);
  assert.equal(tip?.step, "story");
  assert.equal(tip.text, "这种事没有标准答案，她们会记住你怎么选。");
  assert.deepEqual(tip.anchor, { kind: "storyChoices" });
  // 卡那句看过以后，卡还摊着 —— 楼层上的提示也不许隔着卡冒出来
  assert.equal(coachTip(view({ storyOpen: true, acted: true }), floor({ energy: 50 }), PEOPLE, ["story"]), null);
});

test("有人被陆遥请走：指着被请到对面的那个人", () => {
  const w = floor({ present: { shen: "counter", mei: "rival", luyao: "rival" }, qualities: { "away:mei": 1 } });
  assert.equal(coachPoached(w, PEOPLE), "mei");
  const tip = coachTip(view(), w, PEOPLE, []);
  assert.equal(tip?.step, "poach");
  assert.equal(tip.text, "没顾上的人，对面会请走。");
  assert.deepEqual(tip.anchor, { kind: "actor", id: "mei" });
});

test("「被请走」只认引擎盖的 away 章：人站对面没有章不算数", () => {
  const w = floor({ present: { shen: "counter", mei: "rival", luyao: "rival" } });
  assert.equal(coachPoached(w, PEOPLE), undefined);
});

test("第一次打开人情网：指着那一屏的顶栏", () => {
  const tip = coachTip(view({ webOpen: true }), floor(), PEOPLE, []);
  assert.equal(tip?.step, "web");
  assert.deepEqual(tip.anchor, { kind: "webBar" });
  assert.equal(tip.side, "below");
});

test("第一天收工的小结：指着「进入第 2 天」那颗按钮；别的小结不念", () => {
  const tip = coachTip(view({ screen: "report", reportDay: 1 }), floor(), PEOPLE, []);
  assert.equal(tip?.step, "report");
  assert.deepEqual(tip.anchor, { kind: "reportFoot" });
  assert.equal(tip.side, "above");
  assert.equal(coachTip(view({ screen: "report", reportDay: 2 }), floor(), PEOPLE, []), null);
  assert.equal(coachTip(view({ screen: "report", reportDay: 1 }), floor(), PEOPLE, ["report"]), null);
});

test("一次只说一句：看过的不再出现，全部看过就什么也不说", () => {
  const w = floor({ energy: 97 });
  let seen = markCoachSeen([], "action");
  assert.notEqual(coachTip(view({ acted: true }), w, PEOPLE, seen)?.step, "action");
  assert.equal(coachTip(view({ acted: true }), w, PEOPLE, seen)?.step, "open"); // 精力那句没了，开局那句补上
  seen = skipCoachSeen();
  assert.deepEqual(new Set(seen), new Set(COACH_STEPS));
  assert.equal(coachTip(view({ acted: true }), w, PEOPLE, seen), null);
  assert.equal(coachTip(view({ cardOpen: true, storyOpen: true, webOpen: true, acted: true }), w, PEOPLE, seen), null);
});

test("先后序：人情网 > 故事卡 > 被请走 > 人物卡 > 花过精力 > 开局", () => {
  const w = floor({
    energy: 60,
    present: { shen: "counter", mei: "rival", luyao: "rival" },
    qualities: { "away:mei": 1 },
  });
  const busy = view({ storyOpen: true, webOpen: true, cardOpen: true, acted: true });
  assert.equal(coachTip(busy, w, PEOPLE, [])?.step, "web"); // 网整屏压在卡上面
  assert.equal(coachTip(view({ storyOpen: true, cardOpen: true, acted: true }), w, PEOPLE, [])?.step, "story");
  assert.equal(coachTip(view({ cardOpen: true, acted: true }), w, PEOPLE, [])?.step, "poach");
  assert.equal(coachTip(view({ cardOpen: true, acted: true }), floor({ energy: 60 }), PEOPLE, [])?.step, "card");
  assert.equal(coachTip(view({ acted: true }), floor({ energy: 60 }), PEOPLE, [])?.step, "action");
});

test("正在念的那句什么时候收：卡关了、动过手、卡收了、网关了", () => {
  const card = { step: "card" as const, text: "", anchor: { kind: "verbs" as const }, side: "above" as const };
  assert.equal(coachAlive(card, view({ cardOpen: true })), true);
  assert.equal(coachAlive(card, view({ cardOpen: false })), false);
  // 「下面那排是你能做的事」使命在她真的做过一件事之后就完成 —— 让位给「下一时段」那句
  assert.equal(coachAlive(card, view({ cardOpen: true, acted: true })), false);
  const story = { step: "story" as const, text: "", anchor: { kind: "storyChoices" as const }, side: "above" as const };
  assert.equal(coachAlive(story, view({ storyOpen: false })), false);
  const web = { step: "web" as const, text: "", anchor: { kind: "webBar" as const }, side: "below" as const };
  assert.equal(coachAlive(web, view({ webOpen: false })), false);
});

test("锚点选择器：人靠 data-pid，其余是界面固定的一处", () => {
  assert.equal(coachAnchorSelector({ kind: "actor", id: "mei" }), '[data-pid="mei"]');
  assert.equal(coachAnchorSelector({ kind: "verbs" }), ".world-verbs");
  assert.equal(coachAnchorSelector({ kind: "nextSlot" }), ".world-next");
  assert.equal(coachAnchorSelector({ kind: "storyChoices" }), ".story-choices");
  assert.equal(coachAnchorSelector({ kind: "webBar" }), ".world-web-bar button");
  assert.equal(coachAnchorSelector({ kind: "reportFoot" }), ".report-foot button");
});

test("柜前挑人：柜前顾客优先，都被请走就没有开局那句", () => {
  assert.equal(coachCustomer(floor(), PEOPLE), "shen");
  assert.equal(coachCustomer(floor({ present: { mei: "atrium", suman: "counter" } }), PEOPLE), "mei");
  const w = floor({ present: { mei: "rival", luyao: "rival" }, qualities: { "away:mei": 1 } });
  assert.equal(coachCustomer(w, PEOPLE), undefined);
  // 场上没有够得着的顾客，开局那句憋着 —— 出来的是更贴当下的「被请走」那句
  assert.equal(coachTip(view(), w, PEOPLE, [])?.step, "poach");
  assert.equal(coachTip(view(), floor({ present: { luyao: "rival", suman: "counter" } }), PEOPLE, []), null);
});

test("看过记录落盘：往返一致，坏数据按什么都没看过处理", () => {
  assert.equal(COACH_KEY, "last-order-world-coach-v1");
  assert.deepEqual(parseCoachSeen(serializeCoachSeen(["open", "story"])), ["open", "story"]);
  assert.deepEqual(parseCoachSeen(null), []);
  assert.deepEqual(parseCoachSeen(""), []);
  assert.deepEqual(parseCoachSeen("not json"), []);
  assert.deepEqual(parseCoachSeen('{"open":true}'), []);
  assert.deepEqual(parseCoachSeen('["open","bogus",42]'), ["open"]); // 不认识的步丢掉
  assert.deepEqual(markCoachSeen(["open"], "open"), ["open"]); // 重复记不产生第二条
});

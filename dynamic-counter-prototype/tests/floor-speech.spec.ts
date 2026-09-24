import { expect, test } from "@playwright/test";
import { CUSTOMERS, type CustomerId } from "../src/campaign";
import { customerSpeech, firstClause, staffSpeech, voiceTarget } from "../src/floorLife";

// 现场那一屏每 380 毫秒进一拍（Prototype 的 setInterval）。以前台词按拍子轮，一句话只闪 380 毫秒：
// 台词里最长的那句开口 38 字，按 5 字/秒要 7.6 秒才念得完。所以台词改成"一个状态一句话"——
// 这里钉的就是这条映射，以及"墙上那句短到停得住"这个上限（空地/墙上只有 258px 与 168px 两档）。
const ids = Object.keys(CUSTOMERS) as CustomerId[];

test("墙上/空地那句对每个客人都短到一念就得完（≤18 字）", () => {
  for (const id of ids) {
    const c = CUSTOMERS[id];
    for (const meter of [c.patience, c.patience / 2, 2, 1]) {
      for (const rivalNear of [true, false]) {
        const line = customerSpeech(c, meter, false, rivalNear);
        expect([...line].length, `${c.name} 耐心 ${meter}、rivalNear=${rivalNear} 时那句有 ${[...line].length} 字：${line}`).toBeLessThanOrEqual(18);
      }
    }
  }
});

test("同一套状态永远同一句，且状态一变话才变", () => {
  for (const id of ids) {
    const c = CUSTOMERS[id];
    expect(customerSpeech(c, c.patience, false, false)).toBe(customerSpeech(c, c.patience, false, false));
    expect(customerSpeech(c, c.patience, false, false), `${c.name}：不急时墙上就是她开口那句的头一段`).toBe(firstClause(c.opening));
  }
  const c = CUSTOMERS.shen;
  expect(customerSpeech(c, 8, true, false)).toBe("我还在这儿。");
  expect(customerSpeech(c, 3, false, true), "陆遥靠近时她说的是对比，不是时间").toBe("对面也在看我。");
  expect(customerSpeech(c, 3, false, false), "耐心过半（不是按拍）就该换成这句").toBe("我时间不多。");
  expect(customerSpeech(c, 2, false, true), "要走比'对面在看'更要紧").toBe("我真的要走了。");
  expect(customerSpeech(c, 1, false, false)).toBe("你们还接不接？");
});

test("面板那句是整句，不会比墙上那句短", () => {
  for (const id of ids) {
    const c = CUSTOMERS[id];
    expect(customerSpeech(c, c.patience, false, false, true)).toBe(c.opening);
    expect([...customerSpeech(c, c.patience, false, false, true)].length)
      .toBeGreaterThanOrEqual([...customerSpeech(c, c.patience, false, false)].length);
  }
});

test("同事那三句各对一个状态", () => {
  expect(staffSpeech("luyao", true)).toBe("你要先接谁？");
  expect(staffSpeech("luyao", false)).toBe("我在对面看着。");
  expect(staffSpeech("roman", true)).toBe("入口位不能空太久。");
});

// 谁开口按"先看谁"排，不是按拍子轮：这一格回答的是当天副标题问的那个问题。
const candidates = [
  { kind: "customer" as const, id: "shen" as CustomerId },
  { kind: "customer" as const, id: "mei" as CustomerId },
  { kind: "staff" as const, id: "luyao" as const },
  { kind: "staff" as const, id: "roman" as const },
];

test("没被点中的人里，开口的先是快等不住的", () => {
  expect(voiceTarget(candidates, { shen: 6, mei: 3 }, 0)).toEqual({ kind: "customer", id: "mei" });
  expect(voiceTarget(candidates, { shen: 2, mei: 3 }, 0), "反过来也要跟着耐心走，不能固定念先来那位").toEqual({ kind: "customer", id: "shen" });
});

test("陆遥靠过来时先听她，只剩同事时也有一位在说话", () => {
  expect(voiceTarget(candidates, { shen: 2, mei: 3 }, 0.5)).toEqual({ kind: "staff", id: "luyao" });
  expect(voiceTarget(candidates.slice(2), { shen: 2, mei: 3 }, 0)).toEqual({ kind: "staff", id: "luyao" });
  expect(voiceTarget([], {}, 0)).toBeNull();
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { fallbackReply, inferUseful } from "../src/campaign.ts";

test("need-focused questions count as useful", () => {
  assert.equal(inferUseful("shen", "你最怕镜头看到粉感吗"), true);
  assert.equal(inferUseful("anjie", "婚礼前这两天泛红怎么办"), true);
  assert.equal(inferUseful("shen", "要不要直接上看最贵的套组"), false);
});

test("fallback replies stay in character", () => {
  assert.match(fallbackReply("shen", "你最怕镜头看到什么？", 0, true), /粉感|没化妆/);
  assert.match(fallbackReply("shen", "直接开套组吧", null, false), /预算|价格|走|任务/);
});

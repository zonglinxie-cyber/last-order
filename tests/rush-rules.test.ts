import test from "node:test";
import assert from "node:assert/strict";
import { createRush, distance, OBSTACLES, parseRush, route, rushReducer, RUSH_SAVE_KEY, STATIONS, walkable, type RushState } from "../src/rush-rules.ts";

const running = () => rushReducer(createRush(20260908), { type: "start" });
function tick(state: RushState, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 20); i++) state = rushReducer(state, { type: "tick", dt: .05 });
  return state;
}
test("取货必须走到柜台，送达才计分，完成后手中商品清空", () => {
  let s = running(); const station = STATIONS[0], guest = s.guests[0];
  s = rushReducer(s, { type: "go", point: station, destination: { kind: "station", product: station.product } });
  assert.equal(s.carrying, null);
  s = tick(s, 2); assert.equal(s.carrying, "soft"); assert.equal(s.score, 0);
  s = rushReducer(s, { type: "go", point: guest, destination: { kind: "guest", id: guest.id } });
  for (let i = 0; s.path.length && i < 500; i++) s = rushReducer(s, { type: "tick", dt: .05 });
  assert.equal(s.served, 1); assert.equal(s.carrying, null); assert.ok(s.score > 100);
  assert.ok(!s.guests.some(g => g.id === guest.id));
});
test("错误商品当场拒绝；不消耗手中商品，不计成功，不可空手刷分", () => {
  let s = running(); const guest = s.guests[0];
  s = { ...s, player: { x: guest.x, y: guest.y }, carrying: "glow", score: 200, combo: 2 };
  s = rushReducer(s, { type: "interact" });
  assert.equal(s.served, 0); assert.equal(s.mistakes, 1); assert.equal(s.score, 170); assert.equal(s.combo, 0); assert.equal(s.carrying, "glow");
  s = rushReducer({ ...s, carrying: null }, { type: "interact" });
  assert.equal(s.served, 0); assert.equal(s.score, 170);
});
test("所有货台和顾客间都能绕柜台到达，每段路线不穿过柜台", () => {
  const points = [...STATIONS, ...createRush().guests, { x: 875, y: 510 }, { x: 470, y: 505 }];
  for (const a of points) for (const b of points) {
    const path = route(a, b); assert.ok(path.length, JSON.stringify({ a, b }));
    let from = a;
    for (const to of path) {
      for (let i = 0; i <= 100; i++) assert.ok(walkable({ x: from.x + (to.x - from.x) * i / 100, y: from.y + (to.y - from.y) * i / 100 }));
      from = to;
    }
    assert.ok(distance(path.at(-1)!, b) < .01);
  }
  const r = OBSTACLES[0]; assert.deepEqual(route(points[0], { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }), []);
});
test("暂停冻结整局；刷新后先暂停，保留商品、分数、耐心和位置", () => {
  let s = tick(running(), 2); s.carrying = "repair"; s.score = 123;
  const paused = rushReducer(s, { type: "pause" }); assert.deepEqual(tick(paused, 20), paused);
  const loaded = parseRush(JSON.stringify(s)); assert.ok(loaded);
  assert.equal(loaded.phase, "paused"); assert.equal(loaded.carrying, "repair"); assert.equal(loaded.score, 123);
  assert.deepEqual(loaded.player, s.player); assert.deepEqual(loaded.guests, s.guests);
  assert.ok(tick(rushReducer(loaded, { type: "resume" }), 1).elapsed > loaded.elapsed);
  assert.notEqual(RUSH_SAVE_KEY, "last-order-campaign-v1");
});
test("连续三次正确送达触发高光，下一单得分翻倍", () => {
  let s = running();
  for (let i = 0; i < 3; i++) {
    const guest = s.guests[0];
    s = rushReducer({ ...s, player: { x: guest.x, y: guest.y }, carrying: guest.product }, { type: "interact" });
    if (!s.guests.length && i < 2) s = tick(s, 1.5);
  }
  assert.equal(s.combo, 3); assert.equal(s.bestCombo, 3); assert.equal(s.fever, 8);
  if (!s.guests.length) s = tick(s, 1.5);
  const guest = s.guests[0], before = s.score;
  s = rushReducer({ ...s, player: { x: guest.x, y: guest.y }, carrying: guest.product }, { type: "interact" });
  assert.ok(s.score - before >= 400);
});
test("冲刺有冷却；近距离打断陆遥，连续按不能无限眩晕", () => {
  let s = running(); s.player = { ...s.rival };
  s = rushReducer(s, { type: "dash" }); assert.equal(s.stunned, 3); assert.equal(s.cooldown, 3);
  s = tick(s, .5); const again = rushReducer(s, { type: "dash" }); assert.equal(again.cooldown, s.cooldown); assert.equal(again.stunned, s.stunned);
});
test("陆遥走近后需要交谈，成功抢客会打断连单", () => {
  let s = running(); s.elapsed = 11; s.rival = { x: s.guests[0].x, y: s.guests[0].y }; s.combo = 2;
  const id = s.guests[0].id;
  s = tick(s, 3); assert.ok(s.guests.some(g => g.id === id));
  s = tick(s, .6); assert.ok(!s.guests.some(g => g.id === id)); assert.equal(s.lost, 1); assert.equal(s.combo, 0);
});
test("90 秒准确结束；结算后输入、时间和分数冻结", () => {
  const s = tick(running(), 90.1); assert.equal(s.phase, "finished"); assert.equal(s.elapsed, 90);
  assert.deepEqual(tick(s, 10), s); assert.deepEqual(rushReducer(s, { type: "interact" }), s);
  assert.equal(parseRush(JSON.stringify(s))?.phase, "finished");
});
test("拒绝损坏、无限值、越界人物和重复顾客；随机种子可复现", () => {
  assert.equal(parseRush("broken"), null); assert.equal(parseRush(JSON.stringify({ version: 1 })), null);
  assert.equal(parseRush(JSON.stringify({ ...running(), score: 1e309 })), null);
  assert.equal(parseRush(JSON.stringify({ ...running(), player: { x: 300, y: 300 } })), null);
  const s = running(); assert.equal(parseRush(JSON.stringify({ ...s, guests: [s.guests[0], s.guests[0]] })), null);
  assert.deepEqual(tick(running(), 40), tick(running(), 40));
});
test("任意一帧均可存档恢复，竞争对手连续转向时不会切进柜角", () => {
  for (const seed of [1, 31, 20260908]) {
    let s = rushReducer(createRush(seed), { type: "start" });
    for (let i = 0; i < 1800; i++) {
      s = rushReducer(s, { type: "tick", dt: .05 });
      assert.ok(walkable(s.rival), `seed=${seed}, frame=${i}`);
      if (i % 100 === 0) assert.ok(parseRush(JSON.stringify(s)), `seed=${seed}, frame=${i}`);
    }
  }
});
test("重玩在暂停或结算后生效，重置本局数据与时间", () => {
  const s = running(); assert.deepEqual(rushReducer(s, { type: "restart", seed: 9 }), s);
  assert.deepEqual(rushReducer(rushReducer(s, { type: "pause" }), { type: "restart", seed: 9 }), createRush(9));
  const ended = tick(s, 90.1);
  assert.deepEqual(rushReducer(ended, { type: "restart", seed: 9 }), createRush(9));
});

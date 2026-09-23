import assert from "node:assert/strict";
import { test } from "node:test";
import { WORLD, walkable, route, clearLine, type Point } from "../src/rush-rules.ts";
import { BAG_SPOTS, BROWSE_BEATS, EXIT_SPOTS, NAME_X, NAME_Y, STAFF_BEATS, STAGE_SPOTS, poseOn, standBeside, standing } from "../src/floor-stage.ts";

const spots: Array<[string, Point]> = [...Object.entries(STAGE_SPOTS).map(([name, point]) => ["STAGE_SPOTS." + name, point] as [string, Point]), ...BAG_SPOTS.map((point, index) => [`BAG_SPOTS[${index}]`, point] as [string, Point]), ...EXIT_SPOTS.map((point, index) => [`EXIT_SPOTS[${index}]`, point] as [string, Point])];

test("every campaign floor spot is walkable in the shared rush geometry", () => {
  for (const [name, point] of spots) {
    assert.ok(walkable(point), `${name} 站在柜台或墙里：${point.x},${point.y}`);
    assert.ok(point.x > 0 && point.x < WORLD.width && point.y > 0 && point.y < WORLD.height, `${name} 出界`);
  }
});

test("every beat walks between legal spots instead of cutting through furniture", () => {
  const beats: Array<[string, { spots: Point[] }]> = [
    ...Object.entries(STAFF_BEATS).map(([name, beat]) => [name, beat] as [string, { spots: Point[] }]),
    ...BROWSE_BEATS.map((beat, index) => [`browse-${index}`, beat] as [string, { spots: Point[] }]),
  ];
  for (const [name, beat] of beats) {
    for (let i = 0; i < beat.spots.length; i++) {
      const from = beat.spots[i], to = beat.spots[(i + 1) % beat.spots.length];
      assert.ok(route(from, to).length, `${name} 第 ${i} 段没有路可走`);
    }
  }
});

/**
 * 间距契约在 floor-stage.ts 里按像素算好（实测最宽名牌 64px、两行 40px），这里只引用它：
 * 两个能同时站定的位置必须横向差 ≥NAME_X 或纵向差 ≥NAME_Y，否则名字会压住彼此。
 * 走位中途的擦肩是现场该有的样子，所以只约束停下来的点。
 */

test("能同时站定的两个人，名牌永远盖不住彼此", () => {
  // 一个演员独占的线：组内航点按顺序走，不会同时出现；多人线（顾客、拎袋、门口）组内也要算。
  const lanes: Array<[string, Point[], number]> = [
    ...Object.entries(STAFF_BEATS).map(([name, beat]) => ["staff:" + name, beat.spots, 1] as [string, Point[], number]),
    ["staff:player-session", [STAGE_SPOTS.makeupStool], 1],
    ["customer:browse", [...BROWSE_BEATS.flatMap(beat => beat.spots), STAGE_SPOTS.mirror], 2],
    ["customer:served", BAG_SPOTS, 3],
    ["customer:lost", EXIT_SPOTS, 3],
  ];
  for (let a = 0; a < lanes.length; a++)
    for (let b = a; b < lanes.length; b++) {
      const [na, sa, ka] = lanes[a], [nb, sb] = lanes[b];
      for (let i = 0; i < sa.length; i++)
        for (let j = 0; j < sb.length; j++) {
          if (a === b && (ka === 1 || i === j)) continue;
          const dx = Math.abs(sa[i].x - sb[j].x), dy = Math.abs(sa[i].y - sb[j].y);
          assert.ok(dx >= NAME_X || dy >= NAME_Y, `${na}[${i}] ${sa[i].x},${sa[i].y} 与 ${nb}[${j}] ${sb[j].x},${sb[j].y} 只差 ${dx}×${dy}，名牌会叠在一起`);
        }
    }
});

test("员工线和顾客线不共用航点，站定时不会叠成一个人", () => {
  const used = new Map<string, string>();
  const claim = (owner: string, spot: Point) => {
    const key = spot.x + "," + spot.y;
    const previous = used.get(key);
    assert.equal(previous, undefined, `${owner} 和 ${previous ?? ""} 抢同一个站位 ${key}`);
    used.set(key, owner);
  };
  for (const [name, beat] of Object.entries(STAFF_BEATS)) for (const spot of beat.spots) claim("staff:" + name, spot);
  for (const [index, beat] of BROWSE_BEATS.entries()) for (const spot of beat.spots) claim("browse:" + index, spot);
  BAG_SPOTS.forEach((spot, index) => claim("bag:" + index, spot));
  EXIT_SPOTS.forEach((spot, index) => claim("exit:" + index, spot));
  claim("stool", STAGE_SPOTS.makeupStool);
});

test("waiting customers drift to their own doorway without passing through the counters", () => {
  // 顾客在两条航点之间来回走，耐心耗尽前她从任意一处起步：所以每条中段到自己那格门口都要走得通。
  // 这里要的是精确的线段/柜台判定，不能采样——`customerPose` 就是一条直线插值，采样会漏掉擦角。
  const starts: Point[] = BROWSE_BEATS.flatMap(beat => [
    ...beat.spots,
    ...beat.spots.slice(1).map((spot, i) => ({ x: (beat.spots[i].x + spot.x) / 2, y: (beat.spots[i].y + spot.y) / 2 })),
  ]);
  for (const [index, doorway] of EXIT_SPOTS.entries()) {
    for (const from of starts) {
      assert.ok(walkable(from), `逛的航点本身不可站：${from.x},${from.y}`);
      assert.ok(clearLine(from, doorway), `第 ${index} 格门口：从 ${from.x},${from.y} 挪过去会穿过柜台`);
    }
  }
});

test("陆遥迎上去时停在客人身旁，不会站进她的名牌里", () => {
  for (const [from, to] of [[STAGE_SPOTS.luyaoPost, STAGE_SPOTS.island], [STAGE_SPOTS.weilo, STAGE_SPOTS.mirror], [STAGE_SPOTS.luyaoPost, STAGE_SPOTS.mirror]] as Array<[Point, Point]>) {
    const beside = standBeside(from, to);
    assert.ok(walkable(beside), `让位点落进柜台：${beside.x},${beside.y}`);
    assert.ok(Math.abs(beside.x - to.x) >= NAME_X || Math.abs(beside.y - to.y) >= NAME_Y, `迎上去还是压住名牌：${beside.x},${beside.y} vs ${to.x},${to.y}`);
  }
});

test("poses are a pure function of floor time and stay on the walkable band", () => {
  for (const beat of [...Object.values(STAFF_BEATS), ...BROWSE_BEATS]) {
    for (const minutes of [0, 0.4, 1.7, 5, 8.2, 31, 77]) {
      const pose = poseOn(beat, minutes, 1.2);
      assert.deepEqual(pose, poseOn(beat, minutes, 1.2), "同样时间必须给出同样姿势，否则刷新会跳人");
      assert.ok(pose.point.x >= 100 && pose.point.x <= 940 && pose.point.y >= 192 && pose.point.y <= 534, `站位出界：${pose.point.x},${pose.point.y}`);
      assert.ok(pose.facing === 1 || pose.facing === -1);
    }
    assert.ok(walkable(poseOn(beat, 3.4, 0).point), "站位落进柜台");
  }
  const still = poseOn(standing(STAGE_SPOTS.mirror), 9.9);
  assert.deepEqual(still.point, STAGE_SPOTS.mirror);
  assert.equal(still.moving, false, "站桩节拍不该迈步");
});

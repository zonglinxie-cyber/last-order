// 职业阶梯的通用守卫。不钉「谁第几年升到几级」（那是内容），只钉规矩：
//  ① 新人档时每一个读数与「以前」逐字节相同；② 过了线才升、只升不降；
//  ③ 升上去以后玩法真的变（精力、同屏客位、对手抢客）；④ 年末评估一年只做一次。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  energySlotOf, maxPresentCustomers, newWorld, nextSeason, parseWorld, poachChanceNow, serializeWorld,
} from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import {
  CAREER_GATE, CAREER_RANK_KEY, CAREER_WINS_KEY, RANK_NAME, applyCareerAudit, careerAudit,
  careerModsOf, careerRankOf, careerWinsOf, markSeasonWin,
} from "../src/world/career.ts";
import type { World } from "../src/world/types.ts";

const withRank = (rank: number, world: World): World =>
  ({ ...world, qualities: { ...world.qualities, [CAREER_RANK_KEY]: rank } });

/** 造一份「四项都过线」的年末世界：柜位、台账、赢的季数、客情都到位。 */
const strongYear = (world: World): World => ({
  ...world,
  standing: 90,
  compliance: 80,
  opinion: { ...world.opinion, suman: 60 },
  qualities: { ...world.qualities, [CAREER_WINS_KEY]: 4 },
});

test("新人档时每一个读数与「以前」逐字节相同", () => {
  const world = newWorld("rank-blank", PEOPLE);
  assert.equal(careerRankOf(world), 1);
  assert.deepEqual(careerModsOf(world), { energy: 0, guests: 0, poach: 0 });
  assert.equal(energySlotOf(world), 20);
  assert.equal(maxPresentCustomers(world), 7);
  assert.equal(poachChanceNow(world), 0.5);
});

test("升上去以后玩法真的变：精力更足、柜前站得下的人更多、对面抢客没那么狠", () => {
  const base = newWorld("rank-up", PEOPLE);
  const r2 = withRank(2, base), r3 = withRank(3, base);
  assert.ok(energySlotOf(r2) > energySlotOf(base), "正式 BA 以后每一格发的精力更多");
  assert.ok(maxPresentCustomers(r3) > maxPresentCustomers(r2), "柜长以后同屏的人更多");
  assert.ok(poachChanceNow(r3) < poachChanceNow(r2), "柜长以后对面抢客没那么容易");
  assert.equal(RANK_NAME[careerRankOf(r3)], "柜长");
});

test("四项考核都过线才升；差一项就不升", () => {
  const base = newWorld("rank-gate", PEOPLE);
  const ok = careerAudit(strongYear(base));
  assert.equal(ok.passed, true);
  assert.equal(ok.next, 2);
  assert.equal(ok.checks.filter(c => !c.ok).length, 0);
  // 柜位差一截就不过。
  const short = careerAudit({ ...strongYear(base), standing: CAREER_GATE[2].standing - 1 });
  assert.equal(short.passed, false);
  assert.ok(short.gap.includes("柜位"), `要说清差在哪儿：${short.gap}`);
  // 赢的季数不够也不过。
  const fewWins = careerAudit({ ...strongYear(base), qualities: { ...base.qualities, [CAREER_WINS_KEY]: 1 } });
  assert.equal(fewWins.passed, false);
});

test("只升不降：没过线保住原来那一级", () => {
  const base = newWorld("rank-keep", PEOPLE);
  const r2 = withRank(2, base);
  const out = applyCareerAudit({ ...r2, standing: 10, compliance: 10, opinion: {}, qualities: { ...r2.qualities, [CAREER_WINS_KEY]: 0 } });
  assert.equal(careerRankOf(out), 2, "没过线不降级");
});

test("赢一季记一笔；年终评估以后新的一年从零再记", () => {
  const base = newWorld("rank-wins", PEOPLE);
  const won = markSeasonWin({ ...base, money: 100, rivalMoney: 50 });
  assert.equal(careerWinsOf(won), 1);
  const lost = markSeasonWin({ ...base, money: 50, rivalMoney: 100 });
  assert.equal(careerWinsOf(lost), 0);
  const audited = applyCareerAudit(strongYear(won));
  assert.equal(careerWinsOf(audited), 0, "评估完新的一年从零再记");
});

test("季末那一屏算得早半拍：这一季赢没赢先算进去，不让人以为白赢", () => {
  // 真正评估在换季那一刻做，那时这一季已经记过一笔；季末这一屏早半拍，
  // 得先把「这一季算不算赢」加进去 —— 否则赢了一季却还显示 0 季。
  const base = newWorld("rank-early", PEOPLE);
  const world = { ...base, standing: 90, compliance: 80, opinion: { suman: 60 },
    qualities: { ...base.qualities, [CAREER_WINS_KEY]: 0 } };
  const winCheck = careerAudit(world).checks.find(c => c.label.includes("赢过对面"))!;
  assert.equal(winCheck.detail, "0 / 2 季", "不传覆盖就按存档里那个数");
  const early = careerAudit(world, 1);
  const earlyCheck = early.checks.find(c => c.label.includes("赢过对面"))!;
  assert.equal(earlyCheck.detail, "1 / 2 季", "这一季赢了就得算进去");
  assert.equal(early.passed, false, "1 季还不够两年");
  assert.equal(careerAudit(world, 2).passed, true, "两年赢了才升得上");
});

test("年末评估在新年份开季那一刻发生，一年只做一次", () => {
  const world = newWorld("rank-season", PEOPLE);
  // 第 4 季收工 → 第 5 季（第 2 年的第一季）：评估在这一刻做。
  let w = { ...world, season: 4, standing: 90, compliance: 80,
    opinion: { suman: 60 }, qualities: { ...world.qualities, [CAREER_WINS_KEY]: 4 } };
  w = nextSeason(w, PEOPLE);
  assert.equal(w.season, 5);
  assert.equal(careerRankOf(w), 2, "四项都过线，应当升到正式 BA");
  assert.ok(w.log.some(l => l.text.includes("年终评估")), "评估要出现在这一季开场的日志里");
  // 同一年内换季不再评估一次。
  const again = nextSeason(w, PEOPLE);
  assert.equal(again.season, 6);
  assert.equal(again.log.filter(l => l.text.includes("年终评估")).length, 0);
});

test("档位旗认得：存档往返以后职级还在，脏值按新人读", () => {
  const world = withRank(3, newWorld("rank-save", PEOPLE));
  const back = parseWorld(serializeWorld(world))!;
  assert.equal(careerRankOf(back), 3);
  const dirty = { ...world, qualities: { ...world.qualities, [CAREER_RANK_KEY]: 99 } };
  assert.equal(careerRankOf(dirty), 1, "不认识的值按新人读");
});

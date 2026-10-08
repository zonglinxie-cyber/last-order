// 人情场结局：每条都能造出来，条件按 rank 取先到的那条，rank 是全序。
import assert from "node:assert/strict";
import { test } from "node:test";
import { ENDINGS, rank, seasonEnding } from "../src/world/ending.ts";
import { newWorld } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/people.ts";
import type { World } from "../src/world/types.ts";

const base = (): World => newWorld("ending", PEOPLE);

const at = (partial: Partial<World>): World => ({ ...base(), ...partial });

test("结局至少 8 个，rank 两两不同，排出来是全序", () => {
  assert.ok(ENDINGS.length >= 8);
  assert.equal(new Set(ENDINGS.map(e => e.id)).size, ENDINGS.length);
  const ranks = ENDINGS.map(e => rank(e.id));
  assert.equal(new Set(ranks).size, ranks.length);
  for (let i = 0; i < ranks.length; i++) {
    assert.equal(ranks[i], i + 1, ENDINGS[i]?.id);
    assert.ok(ENDINGS[i]?.title && ENDINGS[i]?.body);
  }
  for (let i = 0; i < ranks.length; i++) {
    for (let j = i + 1; j < ranks.length; j++) {
      assert.ok(ranks[i]! < ranks[j]!, `${ENDINGS[i]?.id} 与 ${ENDINGS[j]?.id} 分不出好坏`);
    }
  }
  assert.throws(() => rank("no-such-ending"));
});

test("每个结局都能构造出来，更好的条件优先", () => {
  const cases: Array<[string, World]> = [
    ["both-kept", at({
      compliance: 50, standing: 60, money: 20000,
      qualities: { "arc:shen:end": 1, "arc:anjie:end": 1 },
      opinion: { shen: 20, anjie: 20 },
    })],
    ["folder-follows", at({
      compliance: 70, standing: 65, money: 20000,
      opinion: { fangmin: 50 },
    })],
    ["speaks-first", at({
      compliance: 50, standing: 60, money: 9000,
      qualities: { "arc:luyao:end": 1 },
      opinion: { luyao: 20 },
    })],
    ["team-stays", at({
      compliance: 50, standing: 46, money: 3000,
      qualities: { "arc:shen:end": 1 },
      opinion: { shen: 20 },
    })],
    ["still-named", at({
      compliance: 50, standing: 46, money: 3000,
      qualities: { "arc:anjie:end": 1 },
      opinion: { anjie: 20 },
    })],
    ["books-hold", at({
      compliance: 55, standing: 64, money: 18000,
      opinion: { mei: 45, zhou: 42 },
    })],
    ["regulars-stay", at({
      compliance: 52, standing: 50, money: 6000,
      opinion: { suman: 48, roman: 60, mei: 20 },
    })],
    ["ledger-empty", at({
      compliance: 0, standing: 36, money: 28000,
      opinion: { shen: -40, mei: -36 },
    })],
    ["nobody-left", at({
      compliance: 50, standing: 52, money: 2000,
      opinion: { mei: 10 },
    })],
    ["counter-empty", at({
      compliance: 0, standing: 20, money: 0,
      opinion: { shen: -40, mei: -40, anjie: -35, zhou: -32 },
    })],
  ];

  assert.equal(cases.length, ENDINGS.length);
  for (const [id, world] of cases) {
    const got = seasonEnding(world, PEOPLE);
    assert.equal(got.id, id, got.body);
    assert.equal(got.title, ENDINGS.find(e => e.id === id)?.title);
    assert.ok(got.body.length > 0);
  }

  const bothAndFolder = at({
    compliance: 70, standing: 65, money: 20000,
    qualities: { "arc:shen:end": 1, "arc:anjie:end": 1 },
    opinion: { shen: 20, anjie: 20, fangmin: 50 },
  });
  const top = seasonEnding(bothAndFolder, PEOPLE);
  assert.equal(top.id, "both-kept");
  assert.ok(rank(top.id) < rank("folder-follows"));

  const teamAndBooks = at({
    compliance: 55, standing: 64, money: 18000,
    qualities: { "arc:shen:end": 1 },
    opinion: { shen: 20, mei: 45, zhou: 42 },
  });
  assert.equal(seasonEnding(teamAndBooks, PEOPLE).id, "team-stays");
  assert.ok(rank("team-stays") < rank("books-hold"));

  const pushedButNamed = at({
    compliance: 0, standing: 30, money: 30000,
    qualities: { "arc:shen:end": 1, "arc:anjie:end": 1 },
    opinion: { shen: 20, anjie: 20 },
  });
  assert.equal(seasonEnding(pushedButNamed, PEOPLE).id, "ledger-empty");
  assert.ok(rank("ledger-empty") > rank("both-kept"));
});

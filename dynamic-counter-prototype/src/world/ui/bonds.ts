// 关系读法：初始值在 Person.bonds，当前值在 World.bonds（键 "a>b"）。
// 视图只从这两个来源算，不另存一份冷暖。
import type { BondKind, Person, PersonId, World } from "../types.ts";

/** a 对 b 的当前冷暖；World.bonds 覆盖 Person.bonds 的初始值，都没有则 undefined。 */
export function directedWarmth(world: World, people: Map<PersonId, Person>, from: PersonId, to: PersonId): number | undefined {
  const live = world.bonds[`${from}>${to}`];
  if (live !== undefined) return live;
  return people.get(from)?.bonds.find(bond => bond.to === to)?.warmth;
}

/** 两人之间合并后的冷暖：取两边都有的平均，只有一边就用那一边。 */
export function bondWarmth(world: World, people: Map<PersonId, Person>, a: PersonId, b: PersonId): number | undefined {
  const ab = directedWarmth(world, people, a, b);
  const ba = directedWarmth(world, people, b, a);
  if (ab === undefined && ba === undefined) return undefined;
  if (ab === undefined) return ba;
  if (ba === undefined) return ab;
  return (ab + ba) / 2;
}

/** 两人关系里能念出来的类型：先认 a 对 b 的，再倒过来找。 */
export function bondKind(world: World, people: Map<PersonId, Person>, a: PersonId, b: PersonId): BondKind | undefined {
  const forward = people.get(a)?.bonds.find(bond => bond.to === b);
  if (forward) return forward.kind;
  return people.get(b)?.bonds.find(bond => bond.to === a)?.kind;
}

/** 一个人的直接熟人（双向任一方向有连线就算），人物卡与二度关系都用它。 */
export function neighborsOf(world: World, people: Map<PersonId, Person>, id: PersonId): PersonId[] {
  const seen = new Set<PersonId>();
  for (const other of people.keys()) {
    if (other === id) continue;
    if (bondWarmth(world, people, id, other) !== undefined) seen.add(other);
  }
  return [...seen];
}

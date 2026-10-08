// 视图读关系的薄层：冷暖、关系类型、认不认识都问引擎（engine.ts 的 warmthOf / kindOf / related），
// 这里只做两件视图自己的事 —— 把两个方向合成一条连线的冷暖，以及列出一个人的熟人。
import { kindOf, related, warmthOf } from "../engine.ts";
import type { BondKind, Person, PersonId, World } from "../types.ts";

const list = (people: Map<PersonId, Person>) => [...people.values()];

/** a 对 b 这个方向有没有记录：运行时的冷暖、运行时新建的关系类型，或初始 bonds。 */
const hasDirection = (world: World, people: Map<PersonId, Person>, a: PersonId, b: PersonId) =>
  `${a}>${b}` in world.bonds || `${a}>${b}` in (world.bondKinds ?? {}) || !!people.get(a)?.bonds.some(bond => bond.to === b);

/** 两人之间合并后的冷暖：两个方向都有就取平均，只有一边就用那一边，互不认识则 undefined。 */
export function bondWarmth(world: World, people: Map<PersonId, Person>, a: PersonId, b: PersonId): number | undefined {
  if (!related(world, list(people), a, b)) return undefined;
  const ab = hasDirection(world, people, a, b) ? warmthOf(world, list(people), a, b) : undefined;
  const ba = hasDirection(world, people, b, a) ? warmthOf(world, list(people), b, a) : undefined;
  if (ab === undefined) return ba ?? 0;
  if (ba === undefined) return ab;
  return (ab + ba) / 2;
}

/** 两人关系里能念出来的类型：先认 a 对 b 的，再倒过来找。 */
export const bondKind = (world: World, people: Map<PersonId, Person>, a: PersonId, b: PersonId): BondKind | undefined =>
  kindOf(world, list(people), a, b) ?? kindOf(world, list(people), b, a);

/** 一个人的直接熟人（任一方向有连线就算），人物卡与二度关系都用它。 */
export const neighborsOf = (world: World, people: Map<PersonId, Person>, id: PersonId): PersonId[] =>
  [...people.keys()].filter(other => other !== id && related(world, list(people), id, other));

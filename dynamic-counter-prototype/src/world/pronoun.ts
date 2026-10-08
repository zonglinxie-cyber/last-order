// 代词一处判：内容里指代某个角色槽的人时用 ta()，不要写死"她/他"。
// 引擎话术接这份表由主控在引擎合并后处理。
import type { Person, PersonId } from "./types.ts";

export const ta = (person: Person): "她" | "他" => (person.gender === "m" ? "他" : "她");

/** 按 id 在人群里查；查不到按"她"兜底（人情场绝大多数顾客是女性）。 */
export const taOf = (people: Person[], id: PersonId): "她" | "他" => {
  const person = people.find(p => p.id === id);
  return person ? ta(person) : "她";
};

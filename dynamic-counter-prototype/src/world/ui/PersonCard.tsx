// 人物卡：只读 World 与 Person，不接引擎、不做任何判断。
// 看法与冷暖一律说成话（words.ts 唯一出处），不出现数字和进度条。
import { ta } from "../pronoun.ts";
import { useMemo } from "react";
import { MobileScroll } from "../../mobile";
import { PLAYER, type Person, type PersonId, type World } from "../types.ts";
import { bondKind, bondWarmth, neighborsOf } from "./bonds.ts";
import { BOND_KIND_WORD, PLAYER_NAME, TEMPER_WORD, actWord, bondWarmWord, opinionWord } from "./words.ts";

type PersonCardProps = {
  person: Person;
  world: World;
  people: Person[];
  onClose: () => void;
};

export function PersonCard({ person, world, people, onClose }: PersonCardProps) {
  const byId = useMemo(() => new Map<PersonId, Person>(people.map(p => [p.id, p])), [people]);
  const nameOf = (id: PersonId): string => (id === PLAYER ? PLAYER_NAME : byId.get(id)?.name ?? id);

  const known = useMemo(() => neighborsOf(world, byId, person.id)
    .filter(id => id !== PLAYER)
    .map(id => ({ id, name: nameOf(id), warmth: bondWarmth(world, byId, person.id, id) ?? 0, kind: bondKind(world, byId, person.id, id) }))
    .sort((a, b) => b.warmth - a.warmth), [world, byId, person.id]);

  const aboutPlayer = useMemo(() => world.memories
    .filter(memory => memory.holder === person.id && memory.subject === PLAYER), [world.memories, person.id]);

  return <aside className="person-card" aria-label={`${person.name}的人物卡`}>
    <header className="pc-head">
      <span className={"pc-avatar" + (person.portrait ? "" : " letter")}>
        {person.portrait ? <img src={person.portrait} alt="" aria-hidden="true" /> : <b aria-hidden="true">{person.name.slice(0, 1)}</b>}
      </span>
      <div className="pc-title">
        <b className="pc-name">{person.name}</b>
        <small className="pc-descriptor">{person.descriptor}</small>
      </div>
      <button className="pc-close" type="button" aria-label="关闭人物卡" onClick={onClose}>×</button>
    </header>
    <MobileScroll className="pc-scroll">
      <p className="pc-opinion">{ta(person)}看你：<strong>{opinionWord(world.opinion[person.id])}</strong></p>
      <p className="pc-tempers">{person.tempers.map(t => TEMPER_WORD[t]).join(" · ")}</p>
      <section className="pc-section">
        <h3>{ta(person)}的熟人</h3>
        {known.length === 0 ? <p className="pc-empty">{ta(person)}在这个场上还没什么熟人。</p> : <ul className="pc-known">
          {known.map(row => <li key={row.id} className={row.warmth >= 20 ? "warm" : row.warmth <= -20 ? "cold" : ""}>
            <b>{row.name}</b>
            <small>{row.kind ? `${BOND_KIND_WORD[row.kind]} · ` : ""}{bondWarmWord(row.warmth)}</small>
          </li>)}
        </ul>}
      </section>
      <section className="pc-section">
        <h3>{ta(person)}知道的关于你的事</h3>
        {aboutPlayer.length === 0 ? <p className="pc-empty">{ta(person)}手上还没有关于你的事。</p> : <ul className="pc-memories">
          {aboutPlayer.map((memory, index) => <li key={`${memory.day}:${memory.act}:${index}`} className={memory.valence >= 1 ? "good" : memory.valence <= -1 ? "bad" : ""}>
            <b className="pc-memory-head">第{memory.day}天 · {memory.heardFrom ? `听${nameOf(memory.heardFrom)}说` : "亲眼看见"}</b>
            <p>{actWord(memory.act)}</p>
          </li>)}
        </ul>}
      </section>
    </MobileScroll>
  </aside>;
}

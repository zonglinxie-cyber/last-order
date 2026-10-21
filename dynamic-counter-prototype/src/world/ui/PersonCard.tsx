// 人物卡：只读 World 与 Person，不接引擎、不做任何判断。
// 看法与冷暖一律说成话（words.ts 唯一出处），不出现数字和进度条。
import { ta } from "../pronoun.ts";
import { clientNotes, TRAIT_LABEL } from "../consult.ts";
import { purchaseCooldownOf } from "../purchases.ts";
import { visitContext } from "../visits.ts";
import { currentArrival } from "../arrivals.ts";
import { CARE_DAYS_MIN, CARE_TRUST_MIN, weekCareDaysOf, weekCarePeople, weekGuardedPeople } from "../target.ts";
import { ageAtSeason } from "../content/people.ts";
import { useEffect, useMemo, useRef } from "react";
import { MobileScroll } from "../../mobile";
import { PLAYER, type Person, type PersonId, type World } from "../types.ts";
import { bondKind, bondWarmth, neighborsOf } from "./bonds.ts";
import { BOND_KIND_WORD, PLAYER_NAME, TEMPER_WORD, actWord, bondWarmWord, opinionWord } from "./words.ts";

export type ContactInvitation = { when?: string; cost: number; blocked: string | null; onInvite: () => void };
type PersonCardProps = {
  person: Person;
  world: World;
  people: Person[];
  /** 陆遥这一时段盯的正是她时由楼层传进来（判据在引擎，人物卡不接引擎）。 */
  rival?: { title: string; howTo: string; held: boolean };
  /** 最近动作的原话放进正文，不盖住下一步按钮。 */
  feedback?: string | null;
  booking?: { amount: number; invited: boolean; won: boolean; blocked: string | null; weekend?: boolean };
  invitation?: ContactInvitation;
  onClose: () => void;
};

export function PersonCard({ person, world, people, rival, feedback, booking, invitation, onClose }: PersonCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (feedback) cardRef.current?.querySelector(".pc-scroll .mobile-scroll")?.scrollTo({ top: 0 });
  }, [feedback]);
  const notes = clientNotes(world, person);
  const today = visitContext(world, person);
  const arrival = currentArrival(world, person.id, people);
  const customer = person.role === "customer";
  const cooldown = customer ? purchaseCooldownOf(world, person.id) : null;
  const cared = customer && weekCarePeople(world).includes(person.id);
  const careDays = customer ? Math.min(CARE_DAYS_MIN, weekCareDaysOf(world, person.id)) : 0;
  const guarded = customer && weekGuardedPeople(world).includes(person.id);
  const byId = useMemo(() => new Map<PersonId, Person>(people.map(p => [p.id, p])), [people]);
  const nameOf = (id: PersonId): string => (id === PLAYER ? PLAYER_NAME : byId.get(id)?.name ?? id);

  const known = useMemo(() => neighborsOf(world, byId, person.id)
    .filter(id => id !== PLAYER)
    .map(id => ({ id, name: nameOf(id), warmth: bondWarmth(world, byId, person.id, id) ?? 0, kind: bondKind(world, byId, person.id, id) }))
    .sort((a, b) => b.warmth - a.warmth), [world, byId, person.id]);

  const aboutPlayer = useMemo(() => world.memories
    .filter(memory => memory.holder === person.id && memory.subject === PLAYER), [world.memories, person.id]);

  return <aside className="person-card" ref={cardRef} aria-label={`${person.name}的人物卡`}>
    <header className="pc-head">
      <span className={"pc-avatar" + (person.portrait ? "" : " letter")}>
        {person.portrait ? <img src={person.portrait} alt="" aria-hidden="true" /> : <b aria-hidden="true">{person.name.slice(0, 1)}</b>}
      </span>
      <div className="pc-title">
        <b className="pc-name">{person.name}</b>
        <small className="pc-descriptor">{person.descriptor} · 今年 {ageAtSeason(person, world.season)} 岁</small>
      </div>
      <button className="pc-close" type="button" aria-label="关闭人物卡" onClick={onClose}>×</button>
    </header>
    <MobileScroll className="pc-scroll">
      {feedback && <p className="world-toast" role="status">{feedback}</p>}
      {booking && <section className="pc-section arrival-note" aria-label="对面的预约">
        <h3>{booking.won ? "这笔预约已经接下" : booking.weekend ? "周末最后一单" : booking.invited ? "已经邀来比货" : "陆遥自己约来的客人"}</h3>
        <p>{booking.won ? "这次在你这里买了，对面不会再收这笔预约的钱。" : `对面预计这单 ¥${booking.amount.toLocaleString("zh-CN")}，本时段结束结账。`}</p>
        {!booking.won && <p>{booking.invited ? "愿意来看看，还不等于选你。要靠实际成交接下；也可托熟悉的同事按客情笔记开单。"
          : "邀来花 6 精力和 1 份小样，接待另花 12 精力；也可以把力气留给眼前的客人。"}</p>
        }
        {booking.blocked && !booking.invited && <p>{booking.blocked}。</p>}
      </section>}
      {arrival && <section className="pc-section arrival-note" aria-label="来访缘由">
        <h3>{arrival.title}</h3><p>{arrival.line}</p>
      </section>}
      {invitation && <section className="pc-section pc-invitation" aria-label="约下次见面">
        <h3>微信里约下次见面</h3>
        {invitation.blocked ? <p role="status">{invitation.blocked}。</p> : <>
          <p>{invitation.when}有空来。刚买过的会等用完再约；到店接待另花 12 精力，买不买另说。</p>
        </>}
        <button type="button" disabled={!!invitation.blocked} onClick={invitation.onInvite}>约下次见面 · {invitation.cost} 精力</button>
      </section>}
      <p className="pc-opinion">{ta(person)}看你：<strong>{opinionWord(world.opinion[person.id])}</strong></p>
      <p className="pc-tempers">{person.tempers.map(t => TEMPER_WORD[t]).join(" · ")}</p>
      {cooldown && <p className="pc-cooldown" role="status">
        {cooldown.source === "you"
          ? `上次在第 ${cooldown.day} 天在你这柜买过；还要 ${cooldown.left} 天才会再买。`
          : `上次在第 ${cooldown.day} 天在对面买过；还要 ${cooldown.left} 天才会回来。`}
      </p>}
      {today && <section className="pc-section" aria-label="今天的来意">
        <h3>今天的来意 · {today.title}</h3><p>{today.line}</p>
      </section>}
      {customer && <section className="pc-section" aria-label="这一关">
        <h3>这一关</h3>
        {rival && <p className={`pc-rival${rival.held ? " is-held" : ""}`}>{rival.held
          ? `已接住${ta(person)}，陆遥这一时段带不走${ta(person)}。${guarded ? `本周守客已记过${ta(person)}，不重复加。` : "时段结束守客 +1。"}`
          : `${rival.title}：${rival.howTo}。`}</p>}
        <p>{cared ? `本周客情已记上${ta(person)}，同一人一周只算一次。`
          : `客情：本周亲自照应 ${careDays} / ${CARE_DAYS_MIN} 天${careDays >= CARE_DAYS_MIN && (world.opinion[person.id] ?? 0) < CARE_TRUST_MIN ? `，${ta(person)}还要再信你一些` : ""}。送小样、介绍熟人、打圆场、加微信、保密或对症成交都算；托同事照看不算。`}</p>
        {!rival && guarded && <p>本周守客已记上{ta(person)}。</p>}
      </section>}
      {(notes.known.length > 0 || notes.vetoKnown || notes.unitsKnown) && <section className="pc-section" aria-label="客情笔记">
        <h3>你记得的事</h3>
        {notes.known.length > 0 && <p>{notes.known.map(t => TRAIT_LABEL[t]).join(" · ")}</p>}
        {notes.vetoKnown && <p>底线：{person.skin?.veto?.note}</p>}
        {notes.unitsKnown && <p>一次最多带 {person.skin?.maxUnits} 件</p>}
      </section>}
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

// 每日委托的两处露脸：开门那张「今天的请求」卡，和「现场」栏小标记点开的进度卡。
// 数据全在 world.requests 里：谁提的、要什么、做到有什么都是生成时写好的话，
// 这里只念不判 —— 成没成、罚什么由 requests.ts 说了算。
import { INSTANT_KINDS, askedToday, dueToday, openRequests } from "../requests.ts";
import type { Person, PersonId, World, WorldRequest } from "../types.ts";

type RequestsProps = {
  world: World;
  people: Person[];
  /** 当场可结的委托（唐可借小样）：accept 应下、false 回绝 */
  onAnswer: (reqId: string, accept: boolean) => void;
  onClose: () => void;
};

const nameOf = (people: Person[], id: PersonId) => people.find(p => p.id === id)?.name ?? id;

/** 一行委托当前念什么：进行中说期限，结了说结果。 */
const stateWord = (w: World, req: WorldRequest): string => {
  switch (req.state) {
    case "open": return req.due > w.day ? "明天打烊前" : "今天打烊前";
    case "done": return "成了";
    case "failed": return "失约了";
    case "declined": return "回绝了";
    case "void": return "没来成";
  }
};

function RequestRow({ req, world, people, onAnswer }: {
  req: WorldRequest; world: World; people: Person[]; onAnswer: RequestsProps["onAnswer"];
}) {
  const instant = req.state === "open" && INSTANT_KINDS.includes(req.kind);
  return <li className={`req-row ${req.state}`}>
    <p className="req-by"><b>{nameOf(people, req.by)}</b><span className="req-state">{stateWord(world, req)}</span></p>
    <p className="req-text">{req.text}</p>
    <p className="req-reward">做到了：{req.reward}</p>
    {instant && <div className="req-actions">
      <button type="button" className="req-yes" disabled={req.n !== undefined && world.samples < req.n}
        onClick={() => onAnswer(req.id, true)}>应下{req.n ? `（给她 ${req.n} 支）` : ""}</button>
      <button type="button" className="req-no" onClick={() => onAnswer(req.id, false)}>回绝</button>
    </div>}
  </li>;
}

function RequestsList({ list, world, people, onAnswer, empty }: {
  list: WorldRequest[]; world: World; people: Person[]; onAnswer: RequestsProps["onAnswer"]; empty: string;
}) {
  if (!list.length) return <p className="req-empty">{empty}</p>;
  return <ul className="req-list">
    {list.map(req => <RequestRow key={req.id} req={req} world={world} people={people} onAnswer={onAnswer} />)}
  </ul>;
}

/** 开门弹的那张：今天新提的请求，谁提的、要什么、做到了有什么。 */
export function RequestsCard({ world, people, onAnswer, onClose }: RequestsProps) {
  return <div className="world-requests" role="dialog" aria-label="今天的请求">
    <article className="req-card">
      <h2 className="req-title">今天的请求</h2>
      <RequestsList list={askedToday(world)} world={world} people={people} onAnswer={onAnswer}
        empty="今天没人托你什么事。" />
      <button type="button" className="req-close" onClick={onClose}>知道了</button>
    </article>
  </div>;
}

/** 「现场」栏小标记点开的那张：今天要结的 + 还没到期的，各自的进度。 */
export function RequestsPanel({ world, people, onAnswer, onClose }: RequestsProps) {
  const due = dueToday(world);
  const later = openRequests(world).filter(r => r.due > world.day);
  return <div className="world-requests" role="dialog" aria-label="委托进度">
    <article className="req-card">
      <h2 className="req-title">委托 {due.filter(r => r.state === "done").length}/{due.length}</h2>
      <RequestsList list={[...due, ...later]} world={world} people={people} onAnswer={onAnswer}
        empty="手上没有托你的事。" />
      <button type="button" className="req-close" onClick={onClose}>知道了</button>
    </article>
  </div>;
}

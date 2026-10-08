// 「人情网」视图：只读 World 与 Person，不含任何规则判断。
// 布局取舍：40 人全摆在圈上再缩放，节点会掉到 44px 命中线以下、名字也糊；
// 所以默认画玩家为中心的全网（按 |opinion| 排内外圈），点一个人改成只画她的一度、二度——
// 每屏节点数由邻域封顶，命中区永远够手指。
import { useEffect, useMemo, useRef, useState } from "react";
import { asset } from "../../base.ts";
import { PLAYER, type Person, type PersonId, type World } from "../types.ts";
import { bondWarmth, neighborsOf } from "./bonds.ts";
import { PersonCard } from "./PersonCard.tsx";
import { PLAYER_NAME, SLOT_WORD } from "./words.ts";
import "./web.css";

const NODE_HIT = 24; // 直径 48px，站得住 44px 的指尖下限
const NODE_R = 20;

type NodePos = { id: PersonId; x: number; y: number; dark: boolean };
type EdgePos = { key: string; ax: number; ay: number; bx: number; by: number; warmth: number; touchesCenter: boolean };

/** 玩家契约里没有自己的 Person 条目，中心节点用工位立绘合成。 */
const PLAYER_NODE = { name: "你", portrait: asset("/assets/game/staff-portraits/xuyuan.png") };

export function WebView({ world, people }: { world: World; people: Person[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [focus, setFocus] = useState<PersonId | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const sync = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byId = useMemo(() => new Map<PersonId, Person>(people.map(p => [p.id, p])), [people]);
  const focusPerson = focus ? byId.get(focus) : undefined;

  const layout = useMemo(() => {
    const { w, h } = size;
    if (w < 60 || h < 60) return null;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2 - NODE_HIT - 12;
    const centerId = focus ?? PLAYER;
    const nodes: NodePos[] = [{ id: centerId, x: cx, y: cy, dark: false }];
    const place = (list: PersonId[], radiusOf: (id: PersonId, index: number) => number, startAngle: number, dark: boolean) => {
      list.forEach((id, i) => {
        const a = startAngle + (i * 2 * Math.PI) / Math.max(list.length, 1);
        const r = radiusOf(id, i);
        nodes.push({ id, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), dark });
      });
    };

    if (!focus) {
      const known = people
        .filter(p => world.opinion[p.id] !== undefined)
        .sort((a, b) => Math.abs(world.opinion[b.id]!) - Math.abs(world.opinion[a.id]!));
      const unknown = people.filter(p => world.opinion[p.id] === undefined);
      // 看法越极端（不论好坏）离中心越近：半径是 |opinion| 的单调递减函数。
      place(known.map(p => p.id), id => {
        const t = Math.abs(world.opinion[id]!) / 100;
        return R * 0.42 + (1 - t) * (R * 0.84 - R * 0.42);
      }, -Math.PI / 2, false);
      place(unknown.map(p => p.id), () => R, Math.PI / 2, true);
    } else {
      const ring1 = [...new Set([PLAYER, ...neighborsOf(world, byId, focus)])].filter(id => id !== focus);
      const ring2 = [...new Set(ring1.flatMap(id => (id === PLAYER ? [] : neighborsOf(world, byId, id))))]
        .filter(id => id !== focus && !ring1.includes(id));
      place(ring1, () => R * 0.52, -Math.PI / 2, false);
      place(ring2, () => R * 0.94, Math.PI / 2 - 0.4, false);
    }

    const posOf = new Map(nodes.map(n => [n.id, n]));
    const edges: EdgePos[] = [];
    const ids = [...posOf.keys()];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        let warmth: number | undefined;
        if (a === PLAYER || b === PLAYER) {
          // 玩家的连线只在「全网」和「她本人」两种场合画，二度圈里再拉玩家线就糊成一片了。
          const other = a === PLAYER ? b : a;
          if (!focus || other === focus) warmth = world.opinion[other];
        } else {
          warmth = bondWarmth(world, byId, a, b);
        }
        if (warmth === undefined) continue;
        const na = posOf.get(a)!, nb = posOf.get(b)!;
        edges.push({ key: `${a}~${b}`, ax: na.x, ay: na.y, bx: nb.x, by: nb.y, warmth, touchesCenter: a === centerId || b === centerId });
      }
    }
    return { nodes, edges, R };
  }, [size, focus, world, people, byId]);

  const nameOf = (id: PersonId): string => (id === PLAYER ? PLAYER_NODE.name : byId.get(id)?.name ?? id);
  const portraitOf = (id: PersonId): string | undefined => (id === PLAYER ? PLAYER_NODE.portrait : byId.get(id)?.portrait);

  return <div className="web-view">
    <header className="web-head">
      <div className="web-head-title">
        <b>{focusPerson ? `${focusPerson.name} 的关系网` : "人情网"}</b>
        <small>{focusPerson ? "只画她的一度、二度 · 点中心回全网" : `第${world.day}天 ${SLOT_WORD[world.slot]} · 点一个人看她和连线`}</small>
      </div>
      {focus !== null && <button className="web-all" type="button" onClick={() => setFocus(null)}>全网</button>}
    </header>
    <div className="web-stage" ref={stageRef}>
      {layout && <svg className="web-svg" width={size.w} height={size.h}>
        <circle className="web-guide" cx={size.w / 2} cy={size.h / 2} r={layout.R * 0.42} />
        <circle className="web-guide" cx={size.w / 2} cy={size.h / 2} r={layout.R * 0.84} />
        <circle className="web-guide" cx={size.w / 2} cy={size.h / 2} r={layout.R} />
        <g className="web-edges">
          {layout.edges.map(edge => <line
            key={edge.key}
            className={`web-edge ${edge.warmth >= 0 ? "warm" : "cold"}${focus && edge.touchesCenter ? " lit" : ""}${focus && !edge.touchesCenter ? " dim" : ""}`}
            x1={edge.ax} y1={edge.ay} x2={edge.bx} y2={edge.by}
            strokeWidth={1.2 + (Math.abs(edge.warmth) / 100) * 3.4}
            strokeOpacity={0.28 + (Math.abs(edge.warmth) / 100) * 0.5}
          />)}
        </g>
        <g className="web-nodes">
          {layout.nodes.map(node => {
            const isPlayer = node.id === PLAYER;
            const isCenter = focus !== null && node.id === focus;
            const portrait = portraitOf(node.id);
            const letter = nameOf(node.id).slice(0, 1);
            return <g
              key={node.id}
              className={"web-node" + (node.dark ? " unknown" : "") + (isPlayer ? " player" : "") + (isCenter ? " center" : "")}
              transform={`translate(${node.x} ${node.y})`}
              role="button" tabIndex={0} aria-label={nameOf(node.id)}
              onClick={() => setFocus(node.id === PLAYER ? null : node.id)}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setFocus(node.id === PLAYER ? null : node.id); } }}
            >
              <circle className="web-hit" r={NODE_HIT} />
              {portrait
                ? <><clipPath id={`web-clip-${node.id}`}><circle r={NODE_R} /></clipPath>
                    <image className="web-face" href={portrait} x={-NODE_R} y={-NODE_R} width={NODE_R * 2} height={NODE_R * 2} preserveAspectRatio="xMidYMin slice" clipPath={`url(#web-clip-${node.id})`} />
                    <circle className="web-ring" r={NODE_R} /></>
                : <circle className="web-token" r={NODE_R} /> }
              {!portrait && <text className="web-letter" y={5} aria-hidden="true">{letter}</text>}
              <text className="web-label" y={NODE_R + 15}>{nameOf(node.id)}</text>
            </g>;
          })}
        </g>
      </svg>}
    </div>
    {focusPerson && <PersonCard person={focusPerson} world={world} people={people} onClose={() => setFocus(null)} />}
  </div>;
}

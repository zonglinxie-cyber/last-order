export type NodeId = string;

export type Waypoint = { id: NodeId; x: number; y: number; room: string };

export const NODES: Record<NodeId, Waypoint> = {
  backroom: { id: "backroom", x: 10, y: 58, room: "员工通道" },
  aurora_shelf: { id: "aurora_shelf", x: 12, y: 48, room: "绮光货架" },
  tester: { id: "tester", x: 38, y: 78, room: "试妆台" },
  tester_side: { id: "tester_side", x: 42, y: 52, room: "试妆台" },
  xuyuan: { id: "xuyuan", x: 24, y: 70, room: "绮光柜台" },
  suman: { id: "suman", x: 14, y: 60, room: "绮光柜台" },
  checkout: { id: "checkout", x: 48, y: 44, room: "收银" },
  roman: { id: "roman", x: 51, y: 34, room: "收银" },
  aisle: { id: "aisle", x: 56, y: 58, room: "中庭过道" },
  entrance: { id: "entrance", x: 46, y: 88, room: "入口" },
  exit: { id: "exit", x: 64, y: 92, room: "商场通道" },
  tangke: { id: "tangke", x: 54, y: 80, room: "中庭过道" },
  velora: { id: "velora", x: 72, y: 46, room: "维珞" },
  velora_front: { id: "velora_front", x: 63, y: 64, room: "维珞前" },
  luyao: { id: "luyao", x: 64, y: 54, room: "维珞" },
};

const STAND: Record<string, { x: number; y: number }> = {
  xuyuan: { x: -3.6, y: 2.0 },
  luyao: { x: 3.8, y: -2.0 },
  roman: { x: 0.4, y: -2.6 },
  suman: { x: -3.8, y: -0.4 },
  tangke: { x: 3.6, y: 2.4 },
  fangmin: { x: 1.6, y: 3.2 },
  shen: { x: 2.8, y: 3.0 },
  mei: { x: -3.2, y: 2.6 },
  xiaoyu: { x: 0.4, y: 3.6 },
  zhou: { x: 3.4, y: -2.2 },
  zhao: { x: -3.4, y: -2.0 },
  duan: { x: 1.4, y: -3.2 },
  anjie: { x: -1.8, y: 3.4 },
  returning: { x: 2.8, y: 3.0 },
  zhou2: { x: 3.4, y: -2.2 },
};

export function standPoint(nodeId: NodeId, actorId: string) {
  const node = NODES[nodeId];
  const off = STAND[actorId] ?? { x: 0, y: 0 };
  return { x: node.x + off.x, y: node.y + off.y };
}

const LINKS: [NodeId, NodeId][] = [
  ["backroom", "aurora_shelf"],
  ["aurora_shelf", "suman"],
  ["aurora_shelf", "tester"],
  ["suman", "xuyuan"],
  ["tester", "tester_side"],
  ["tester", "xuyuan"],
  ["tester_side", "aisle"],
  ["xuyuan", "checkout"],
  ["checkout", "roman"],
  ["checkout", "aisle"],
  ["tester_side", "tangke"],
  ["tangke", "aisle"],
  ["aisle", "entrance"],
  ["entrance", "exit"],
  ["aisle", "velora_front"],
  ["velora_front", "luyao"],
  ["luyao", "velora"],
];

const adj = new Map<NodeId, NodeId[]>();
for (const id of Object.keys(NODES)) adj.set(id, []);
for (const [a, b] of LINKS) {
  adj.get(a)!.push(b);
  adj.get(b)!.push(a);
}

export function nearestNode(x: number, y: number): NodeId {
  let best: NodeId = "aisle";
  let dist = Infinity;
  for (const node of Object.values(NODES)) {
    const d = (node.x - x) ** 2 + (node.y - y) ** 2;
    if (d < dist) {
      dist = d;
      best = node.id;
    }
  }
  return best;
}

export function pathTo(from: NodeId, to: NodeId): NodeId[] {
  if (from === to) return [];
  const queue = [from];
  const prev = new Map<NodeId, NodeId>();
  const seen = new Set([from]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, cur);
      if (next === to) {
        const path = [next];
        let walk = next;
        while (walk !== from) {
          walk = prev.get(walk)!;
          path.push(walk);
        }
        path.pop();
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return [];
}

export function roomAt(x: number, y: number) {
  return NODES[nearestNode(x, y)].room;
}

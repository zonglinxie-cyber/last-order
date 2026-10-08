// 人情场新手引导：苏蔓一次只说一句，指着当下该看的东西。哪一步该说哪一句、指着什么、
// 摆在哪一侧，规则全在这个文件里，都是纯函数 —— 不碰 DOM、不读 localStorage。
// 每句只出现一次：看没看过由界面落盘到 COACH_KEY（和世界存档 SAVE_KEY 是两把钥匙），
// 一句冒过头、被「知道了」/「跳过引导」/场景翻篇收掉，都算看过，不再回来。
import type { Person, PersonId, World } from "../types.ts";

export const COACH_KEY = "last-order-world-coach-v1";

export type CoachStep = "open" | "card" | "action" | "story" | "poach" | "web" | "report";
export const COACH_STEPS: CoachStep[] = ["open", "card", "action", "story", "poach", "web", "report"];

/** 气泡指着的东西：actor 是地图上某个人，其余是界面固定的一处。 */
export type CoachAnchor =
  | { kind: "actor"; id: PersonId }
  | { kind: "verbs" | "nextSlot" | "storyChoices" | "webBar" | "reportFoot" };

export type CoachTip = {
  step: CoachStep;
  /** 苏蔓的那一句，只出现一次。 */
  text: string;
  anchor: CoachAnchor;
  /** 气泡摆在锚点的哪一侧；箭头永远在朝着锚点的那条边上，不盖锚点本身。 */
  side: "above" | "below";
};

/** 界面每个渲染帧告诉规则此刻是什么样子；规则只看这个，不自己猜。 */
export type CoachView = {
  screen: "floor" | "report";
  /** 小结页是第几天收工；不在小结页给 undefined。 */
  reportDay?: number;
  storyOpen: boolean;
  webOpen: boolean;
  cardOpen: boolean;
  /** 今天已经花过精力 —— 做过至少一个动作。 */
  acted: boolean;
};

const TEXT: Record<CoachStep, string> = {
  open: "柜前这两位，先点一个人看看她是谁。",
  card: "下面那排是你能做的事，每件都花精力。",
  action: "精力用得差不多了，就点右上角的「下一时段」。",
  story: "这种事没有标准答案，她们会记住你怎么选。",
  poach: "没顾上的人，对面会请走。",
  web: "这一屏把整层的关系画给你看：谁跟谁近，谁听了你什么。",
  report: "打烊这张账每天收工都有：谁近了、谁远了，明天谁说要来。",
};

/** 开局那句指着的人：柜台前的顾客优先，没有就场上第一位顾客；顾客被请去对面的不算。 */
export const coachCustomer = (world: World, people: Person[]): PersonId | undefined => {
  const guests = people.filter(p => p.role === "customer"
    && p.id in world.present && world.present[p.id] !== "rival").map(p => p.id);
  return guests.find(id => world.present[id] === "counter") ?? guests[0];
};

/** 这个时段被陆遥请去对面、还站在那边的人。away 是引擎抢客时盖的当天章，只认它。 */
export const coachPoached = (world: World, people: Person[]): PersonId | undefined =>
  people.find(p => p.role === "customer" && world.present[p.id] === "rival"
    && (world.qualities[`away:${p.id}`] ?? 0) === world.day)?.id;

/**
 * 此刻该冒出哪一句。一次只说一句：故事卡压着楼层时只说卡那句，人情网开着时只说网那句；
 * 看过的（seen）一律跳过。顺序就是优先级 —— 越贴当下的事越先开口。
 */
export function coachTip(view: CoachView, world: World, people: Person[], seen: CoachStep[]): CoachTip | null {
  const fresh = (step: CoachStep) => !seen.includes(step);
  if (view.screen === "report")
    return view.reportDay === 1 && fresh("report")
      ? { step: "report", text: TEXT.report, anchor: { kind: "reportFoot" }, side: "above" } : null;
  if (view.webOpen)
    return fresh("web") ? { step: "web", text: TEXT.web, anchor: { kind: "webBar" }, side: "below" } : null;
  if (view.storyOpen)
    return fresh("story") ? { step: "story", text: TEXT.story, anchor: { kind: "storyChoices" }, side: "above" } : null;
  const poached = coachPoached(world, people);
  if (poached && fresh("poach"))
    return { step: "poach", text: TEXT.poach, anchor: { kind: "actor", id: poached }, side: "above" };
  if (view.cardOpen && fresh("card"))
    return { step: "card", text: TEXT.card, anchor: { kind: "verbs" }, side: "above" };
  if (view.acted && fresh("action"))
    return { step: "action", text: TEXT.action, anchor: { kind: "nextSlot" }, side: "below" };
  const first = coachCustomer(world, people);
  // 开局那句只在开局那个上午讲：过了这个村再说"柜前这两位"就是念错词。
  if (fresh("open") && first && world.day === 1 && world.slot === 0)
    return { step: "open", text: TEXT.open, anchor: { kind: "actor", id: first }, side: "above" };
  return null;
}

/** 正在念的这句还成立吗：时段翻篇、锚点所指的东西撤了、或它要说的动作玩家已经做了，
    就该收掉（收掉即算看过）。动作那句一旦动过手就完成使命。 */
export const coachAlive = (tip: CoachTip, view: CoachView): boolean => {
  if (tip.anchor.kind === "verbs") return view.cardOpen && !view.acted;
  if (tip.anchor.kind === "storyChoices") return view.storyOpen;
  if (tip.anchor.kind === "webBar") return view.webOpen;
  return true;
};

/** 越贴当下的事越先开口：正在念的会被排序更靠前的新句顶掉。report 单独一屏不参战。 */
export const coachUrgency = (step: CoachStep): number => {
  const order: CoachStep[] = ["web", "story", "poach", "card", "action", "open"];
  const i = order.indexOf(step);
  return i < 0 ? order.length : i;
};

/** 锚点 → 楼层里的那个元素。actor 靠人身上的 data-pid 认，界面负责把这个属性摆上去。 */
export const coachAnchorSelector = (anchor: CoachAnchor): string => {
  switch (anchor.kind) {
    case "actor": return `[data-pid="${anchor.id}"]`;
    case "verbs": return ".world-verbs";
    case "nextSlot": return ".world-next";
    case "storyChoices": return ".story-choices";
    case "webBar": return ".world-web-bar button";
    case "reportFoot": return ".report-foot button";
  }
};

// —— 看过记录：读进来的原始字串与要写的字串都在这里过一遍，坏数据按"什么都没看过"处理 ——

export const parseCoachSeen = (raw: string | null): CoachStep[] => {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((x): x is CoachStep => typeof x === "string" && (COACH_STEPS as string[]).includes(x));
  } catch { return []; }
};

export const serializeCoachSeen = (seen: CoachStep[]): string => JSON.stringify(seen);
export const markCoachSeen = (seen: CoachStep[], step: CoachStep): CoachStep[] =>
  seen.includes(step) ? seen : [...seen, step];
export const skipCoachSeen = (): CoachStep[] => [...COACH_STEPS];

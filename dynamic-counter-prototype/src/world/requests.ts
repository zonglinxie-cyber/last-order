// 每日委托：每天开门第一个时段，在场或熟悉的人提一两个具体请求 —— 做到了有人情，
// 失约有人记得（失约的负面记忆当晚就能被传话系统带出去）。
// 生成在 beginSlot（slot 0、当天还没有委托时），结算在 endDay（夜里传话之前）。
// 纯函数：入参 World 返回新 World；抽数全走 (seed, rngCalls)，同一种子逐位相同。
// 这里的 helpers 全部从 engine.ts 拿（同一个物理），两个文件互相 import，但谁都不在
// 模块顶层调对方的函数，加载顺序无所谓 —— 和 exchanges.ts 同一条规矩。
import {
  addOpinion, addWarmth, kindOf, opinionOf, personOf, qualityOf, related,
  remember, say, warmthOf, MEDIATE_COLD_LIMIT,
} from "./engine.ts";
import { drawIndex, drawWeighted } from "./rng.ts";
import { ta, taOf } from "./pronoun.ts";
import type { Person, PersonId, RequestKind, RequestState, Slot, World, WorldRequest } from "./types.ts";
import { PLAYER } from "./types.ts";

// —— 旋钮 ——

/** 每天开门最多几条委托。 */
export const REQUESTS_PER_DAY = 2;
/** 做到：提的人看法动这么多。 */
export const REQUEST_DONE_OPINION = 6;
/** 到期没做到：看法降这么多，另记一条"说好的事没做"。 */
export const REQUEST_FAIL_OPINION = -5;
/** 当场回绝（唐可那类）：比晾到打烊体面一点。 */
export const REQUEST_DECLINE_OPINION = -3;

/** 罗曼的件数：按前几天平均每天卖出算，夹在 MIN..MAX 里别太难。 */
export const QUOTA_LOOKBACK = 3;
export const QUOTA_MIN = 2;
export const QUOTA_MAX = 5;
/** 件数达标，柜位也认。 */
export const QUOTA_STANDING = 2;

/** 苏蔓：留住了，老客跟她更亲。 */
export const KEEP_OPINION = 7;
export const KEEP_WARMTH = 8;
/** 称得上"她的老客"的线：client 关系、冷暖到这数。 */
export const KEEP_CLIENT_WARMTH = 20;

/** 唐可借小样的支数与她记的人情。 */
export const SAMPLES_UNITS = 2;
export const SAMPLES_OPINION = 8;

/** 对你看法到这条线，客人才会开口托你牵线/劝和。 */
export const PAIR_OPINION_MIN = 15;

/** 方敏：一整天没硬推，台账记一笔。 */
export const CLEAN_OPINION = 4;
export const CLEAN_COMPLIANCE = 2;

/** 加过微信的人约明天来：接住了她把你当自己人。 */
export const REBOOK_OPINION = 5;

// —— 引擎共用的键 ——

/** 这一天玩家开出了几件（resolveServe / 托单 / 回流单都记）。罗曼的 quota 读它。 */
export const soldUnitsKey = (day: number) => `sold:${day}`;
/** 这天在楼层上露过面（beginSlot 落位时盖章）。rebook 判"她来没来"读它。 */
export const seenKey = (id: PersonId) => `seen:${id}`;

// —— 记忆代号（words.ts 的 ACT_WORD 有同名句） ——

const ACT_KEPT = "kept-promise";
const ACT_BROKE = "broke-promise";
const ACT_LENT = "lent-samples";
const ACT_TURNED = "turned-down";

// —— 生成 ——

type Draft = {
  by: PersonId;
  kind: RequestKind;
  /** 0 = 今天打烊结算，1 = 明天打烊结算 */
  dueIn?: number;
  target?: PersonId;
  n?: number;
  goal?: "introduce" | "mediate";
  text: string;
  reward: string;
  log: string;
};

type Template = { kind: RequestKind; weight: number; drafts: (w: World, people: Person[]) => Draft[] };

const reachableNow = (w: World, id: PersonId) => id in w.present && w.present[id] !== "rival";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 前几天平均每天开出几件；一天都没开过张按 0 算进平均，别因为没记录就抬高。 */
const quotaTarget = (w: World): number => {
  const days = Math.min(QUOTA_LOOKBACK, w.day - 1);
  if (days <= 0) return QUOTA_MIN;
  let sum = 0;
  for (let d = w.day - days; d < w.day; d++) sum += qualityOf(w, soldUnitsKey(d));
  return clamp(Math.ceil(sum / days), QUOTA_MIN, QUOTA_MAX);
};

const TEMPLATES: Template[] = [
  {
    kind: "quota", weight: 3,
    drafts: (w) => {
      if (!reachableNow(w, "roman")) return [];
      const n = quotaTarget(w);
      return [{
        by: "roman", kind: "quota", n,
        text: `今天卖出 ${n} 件`,
        reward: "罗曼认这个数，柜位跟着记一笔",
        log: `早会罗曼点了你的名：今天卖出 ${n} 件。`,
      }];
    },
  },
  {
    kind: "keep", weight: 3,
    drafts: (w, people) => {
      if (!reachableNow(w, "suman")) return [];
      // 她的老客 = client 关系、两头至少一头够亲，此刻已经在场的那位。
      return people.filter(p => p.role === "customer" && reachableNow(w, p.id)
        && (kindOf(w, people, "suman", p.id) === "client" || kindOf(w, people, p.id, "suman") === "client")
        && Math.max(warmthOf(w, people, "suman", p.id), warmthOf(w, people, p.id, "suman")) >= KEEP_CLIENT_WARMTH)
        .map(p => ({
          by: "suman" as PersonId, kind: "keep" as const, target: p.id,
          text: `看住${p.name}，别叫对面请走`,
          reward: "苏蔓记你一个人情",
          log: `苏蔓把你拉到一边：${p.name}今天会来，帮我看住${ta(p)}，别叫陆遥请走。`,
        }));
    },
  },
  {
    kind: "samples", weight: 2,
    drafts: (w) => reachableNow(w, "tangke") && w.samples >= SAMPLES_UNITS
      ? [{
        by: "tangke", kind: "samples", n: SAMPLES_UNITS,
        text: `借她 ${SAMPLES_UNITS} 支小样应急`,
        reward: "唐可记你一个人情",
        log: `唐可凑过来小声说：借我 ${SAMPLES_UNITS} 支小样应急，回头补你。`,
      }] : [],
  },
  {
    kind: "pair", weight: 2,
    drafts: (w, people) => {
      const out: Draft[] = [];
      for (const p of people) {
        if (p.role !== "customer" || !reachableNow(w, p.id)) continue;
        if (opinionOf(w, p.id) < PAIR_OPINION_MIN) continue;
        // 劝和：她指名要你打圆场 —— 两人够冷、对方此刻也在场。
        for (const q of people) {
          if (q.id === p.id || !reachableNow(w, q.id)) continue;
          if (Math.min(warmthOf(w, people, p.id, q.id), warmthOf(w, people, q.id, p.id)) >= MEDIATE_COLD_LIMIT) continue;
          out.push({
            by: p.id, kind: "pair", goal: "mediate", target: q.id,
            text: `替${p.name}跟${q.name}打个圆场`,
            reward: `${p.name}记你一个人情`,
            log: `${p.name}拉了你一下：我跟${q.name}僵着，你替我们打个圆场。`,
          });
        }
        // 牵线：这层有她还不认识的人，就有一条"介绍个合得来的"可提。
        if (people.some(q => q.id !== p.id && reachableNow(w, q.id) && !related(w, people, p.id, q.id)))
          out.push({
            by: p.id, kind: "pair", goal: "introduce",
            text: `帮${p.name}介绍一个合得来的人`,
            reward: `${p.name}记你一个人情`,
            log: `${p.name}跟你说：这层要是有聊得来的，给我介绍一个。`,
          });
      }
      return out;
    },
  },
  {
    kind: "clean", weight: 2,
    drafts: (w) => reachableNow(w, "fangmin")
      ? [{
        by: "fangmin", kind: "clean",
        text: "今天一天，一单都别硬推",
        reward: "方敏在台账上记你一笔",
        log: "方敏压低声音：今天别硬推，台账上我看着。",
      }] : [],
  },
  {
    kind: "rebook", weight: 2,
    drafts: (w, people) => people.filter(p => p.role === "customer"
        && qualityOf(w, `wechat:${p.id}`)
        && !w.appointments.some(a => a.person === p.id && a.day === w.day + 1)
        && !w.requests.some(r => r.kind === "rebook" && r.target === p.id && r.state === "open"))
      .map(p => ({
        by: p.id, kind: "rebook" as const, dueIn: 1, target: p.id,
        text: `${p.name}约了明天来，明天在场接住`,
        reward: `${p.name}把你当自己人`,
        log: `${p.name}发来微信：明天我过去一趟，你可得在。`,
      })),
  },
];

/**
 * 开门：slot 0 落定之后调。当天已有委托就不再开（beginSlot 重复进同一个时段不重复发）。
 * 每条委托写一条现场 log；rebook 顺手把她明天的约排进 appointments。
 */
export function openDay(world: World, people: Person[]): World {
  if (world.slot !== 0) return world;
  if (world.requests.some(r => r.day === world.day)) return world;
  let w = world;
  const usedBy = new Set<PersonId>();
  const out: WorldRequest[] = [];
  while (out.length < REQUESTS_PER_DAY) {
    const elig = TEMPLATES
      .map(t => ({ t, drafts: t.drafts(w, people).filter(d => !usedBy.has(d.by)) }))
      .filter(x => x.drafts.length);
    if (!elig.length) break;
    const i = drawWeighted(w.seed, w.rngCalls, elig.map(x => x.t.weight));
    w = { ...w, rngCalls: w.rngCalls + 1 };
    if (i < 0) break;
    const { t, drafts } = elig[i]!;
    const j = drawIndex(w.seed, w.rngCalls, drafts.length);
    w = { ...w, rngCalls: w.rngCalls + 1 };
    const d = drafts[j]!;
    usedBy.add(d.by);
    const req: WorldRequest = {
      id: `req:${w.day}:${d.kind}:${d.by}`, kind: d.kind, by: d.by,
      day: w.day, due: w.day + (d.dueIn ?? 0), state: "open",
      text: d.text, reward: d.reward,
      ...(d.target ? { target: d.target } : {}),
      ...(d.n !== undefined ? { n: d.n } : {}),
      ...(d.goal ? { goal: d.goal } : {}),
    };
    out.push(req);
    w = say(w, d.log, [d.by]);
    if (req.kind === "rebook" && req.target) {
      const person = personOf(people, req.target);
      const slot: Slot = person?.visits.slots[0] ?? 0;
      w = { ...w, appointments: [...w.appointments,
        { day: req.due, slot, person: req.target, reason: "wechat" as const }] };
    }
  }
  return { ...w, requests: [...w.requests, ...out] };
}

// —— 完成判定 ——

/** 她今天跟你打过交道（一手、不负面）：招呼、接待、小样、牵线、劝和、微信都算。 */
const metToday = (w: World, id: PersonId): boolean =>
  w.memories.some(m => m.holder === id && m.day === w.day && m.valence >= 0
    && (m.heardFrom === undefined || m.heardFrom === PLAYER));

export type RequestOutcome = Exclude<RequestState, "open" | "declined">;

/** 到期这一刻判：做到了 / 没做到 / 条件作废。当场回绝的不走这里。 */
export function checkRequest(w: World, people: Person[], req: WorldRequest): RequestOutcome {
  switch (req.kind) {
    case "quota":
      return qualityOf(w, soldUnitsKey(req.day)) >= (req.n ?? 0) ? "done" : "failed";
    case "clean":
      return w.memories.some(m => m.day === req.day && m.act === "hard-sell") ? "failed" : "done";
    case "keep":
    case "rebook": {
      const t = req.target;
      if (!t) return "failed";
      // keep 的目标生成时就在场；rebook 看明天有没有真的露面（位子满了没进来就不算失约）。
      if (req.kind === "rebook" && qualityOf(w, seenKey(t)) !== w.day) return "void";
      if (qualityOf(w, `away:${t}`) === w.day) return "failed";
      return metToday(w, t) ? "done" : "failed";
    }
    case "pair": {
      // "mediated" 记忆的 subject 是玩家不是对方 —— 她名下当天有一条劝和/介绍成功就算数。
      const act = req.goal === "mediate" ? "mediated" : "introduced";
      const ok = w.memories.some(m => m.holder === req.by && m.day === w.day && m.act === act);
      return ok ? "done" : "failed";
    }
    case "samples":
      return "failed"; // 拖到打烊还没回：按失约算
  }
}

// —— 结算 ——

const markRequest = (w: World, req: WorldRequest, state: RequestState): World =>
  ({ ...w, requests: w.requests.map(r => (r.id === req.id ? { ...r, state } : r)) });

const nameOf = (people: Person[], id: PersonId) => personOf(people, id)?.name ?? id;

function rewardRequest(w: World, people: Person[], req: WorldRequest): World {
  const by = personOf(people, req.by);
  const name = nameOf(people, req.by);
  w = markRequest(w, req, "done");
  w = remember(w, req.by, ACT_KEPT, 1);
  switch (req.kind) {
    case "quota":
      w = addOpinion(w, req.by, REQUEST_DONE_OPINION);
      w = { ...w, standing: clamp(w.standing + QUOTA_STANDING, 0, 100) };
      return say(w, `罗曼看了一眼数：说好的 ${req.n} 件，你做到了。`, [req.by]);
    case "keep": {
      w = addOpinion(w, req.by, KEEP_OPINION);
      if (req.target) w = addWarmth(w, people, req.target, req.by, KEEP_WARMTH);
      return say(w, `${name}冲你点头：${nameOf(people, req.target!)}安安稳稳逛完才走的。`, [req.by]);
    }
    case "pair":
      w = addOpinion(w, req.by, REQUEST_DONE_OPINION);
      return say(w, req.goal === "mediate"
        ? `${name}那口气顺了，回头谢你打的圆场。`
        : `${name}认识了新的人，回头谢你牵的线。`, [req.by]);
    case "clean":
      w = addOpinion(w, req.by, CLEAN_OPINION);
      w = { ...w, compliance: clamp(w.compliance + CLEAN_COMPLIANCE, 0, 100) };
      return say(w, `方敏在台账上给你记了一笔：今天干干净净。`, [req.by]);
    case "rebook":
      w = addOpinion(w, req.by, REBOOK_OPINION);
      return say(w, `${name}临走说：说好了在就真在，下次还来找你。`, [req.by]);
    case "samples":
      // 借小样是当场结的，走到这里的只有"拖到打烊"那一路 —— 不会进 done。
      return w;
  }
}

function failRequest(w: World, people: Person[], req: WorldRequest): World {
  const name = nameOf(people, req.by);
  w = markRequest(w, req, "failed");
  w = addOpinion(w, req.by, REQUEST_FAIL_OPINION);
  w = remember(w, req.by, ACT_BROKE, -1);
  switch (req.kind) {
    case "quota":
      return say(w, `罗曼翻着单子：说好的 ${req.n} 件呢。`, [req.by]);
    case "keep": {
      const t = nameOf(people, req.target ?? req.by);
      return say(w, qualityOf(w, `away:${req.target ?? ""}`) === w.day
        ? `${t}还是叫对面请走了，${name}没说什么。`
        : `${t}来了你没顾上，${name}看在眼里。`, [req.by]);
    }
    case "pair":
      return say(w, `${name}等了一天没等到，说好的事黄了。`, [req.by]);
    case "clean":
      return say(w, `方敏摇了摇头：说了别硬推。`, [req.by]);
    case "rebook":
      return say(w, `${name}白跑了一趟，走的时候没再说话。`, [req.by]);
    case "samples":
      return say(w, `${name}等了一天没等到，自己找别人凑去了。`, [req.by]);
  }
}

/**
 * 打烊结算：到期的委托一条条过 —— 做到的给奖励，没做到的记失约，人没来成的作废。
 * 放在 endDay 夜里传话之前调：broke-promise 这条坏话当晚就能被带出去。
 */
export function settleRequests(world: World, people: Person[]): World {
  let w = world;
  for (const req of w.requests) {
    if (req.state !== "open" || req.due > w.day) continue;
    const outcome = checkRequest(w, people, req);
    if (outcome === "done") w = rewardRequest(w, people, req);
    else if (outcome === "failed") w = failRequest(w, people, req);
    else {
      w = markRequest(w, req, "void");
      w = say(w, `${nameOf(people, req.target ?? req.by)}今天没来成，这事就算了。`,
        [req.by, ...(req.target ? [req.target] : [])]);
    }
  }
  return w;
}

// —— 当场可结的委托（唐可借小样这一类） ——

/** 能在卡上当场答的 kind；别的一律等打烊结算。 */
export const INSTANT_KINDS: RequestKind[] = ["samples"];

/**
 * 当场应或当场回绝。应下：小样真出去、记人情、委托即 done；回绝：体面一点的小罚。
 * 不认识的 id / 已经结过的 / 不是当场类的，原样退回。
 */
export function resolveRequestChoice(world: World, people: Person[], reqId: string, accept: boolean): World {
  const req = world.requests.find(r => r.id === reqId);
  if (!req || req.state !== "open" || !INSTANT_KINDS.includes(req.kind)) return world;
  let w = world;
  const n = req.n ?? 1;
  if (accept) {
    if (w.samples < n) return world;
    const name = nameOf(people, req.by);
    w = { ...w, samples: w.samples - n };
    w = markRequest(w, req, "done");
    w = addOpinion(w, req.by, SAMPLES_OPINION);
    w = remember(w, req.by, ACT_LENT, 1);
    return say(w, `你数了 ${n} 支小样给${name}，${taOf(people, req.by)}连说回头补你。`, [req.by]);
  }
  w = markRequest(w, req, "declined");
  w = addOpinion(w, req.by, REQUEST_DECLINE_OPINION);
  w = remember(w, req.by, ACT_TURNED, -1);
  return say(w, `你摇摇头说柜上也不富余，${nameOf(people, req.by)}讪讪地走了。`, [req.by]);
}

// —— 界面读数 ——

/** 今天该结的委托（今天到期）；现场栏的「委托 n/m」和结算都按这份数。 */
export const dueToday = (w: World): WorldRequest[] => w.requests.filter(r => r.due === w.day);

/** 今天新提的委托（开门卡念的就是这份）。 */
export const askedToday = (w: World): WorldRequest[] => w.requests.filter(r => r.day === w.day);

/** 还没结的（不管哪天到期）：进度面板里"进行中"的那几条。 */
export const openRequests = (w: World): WorldRequest[] => w.requests.filter(r => r.state === "open");

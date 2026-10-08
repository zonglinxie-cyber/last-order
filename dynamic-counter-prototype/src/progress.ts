// 档案（跨局图鉴）的唯一规则层：存档键 last-order-progress-v1，与 campaign 的 SAVE_KEY 无关。
// 只增不减：一局结束不会抹掉上一局见过的脸。这里全是纯函数，localStorage 读写只在最下面两个包装里。
import { CUSTOMERS, endingTitle, type Campaign, type CustomerId } from "./campaign.ts";

export const PROGRESS_KEY = "last-order-progress-v1";
export const PROGRESS_VERSION = 1;

// 每位顾客一单只落一个结果旗：resolveSale 写 served:<id>:good|risky|out-of-stock|refused，
// 队列另一头等过头的人写 lost:<id>（spendAttention / releaseService）。
export type VisitOutcome = "good" | "risky" | "out-of-stock" | "refused" | "lost";
export const VISIT_OUTCOMES: readonly VisitOutcome[] = ["good", "risky", "out-of-stock", "refused", "lost"];

export type Progress = {
  version: number;
  met: CustomerId[];
  outcomes: Partial<Record<CustomerId, VisitOutcome[]>>;
  endings: string[];
};

export const emptyProgress = (): Progress => ({ version: PROGRESS_VERSION, met: [], outcomes: {}, endings: [] });

// 变体归并：沈薇带团队回来、周姐带同事需求回来、安姐婚礼当天回来，都算同一位人物的第二次来。
type VisitSlot = { person: CustomerId; visit: number };
export const VISIT_SLOT: Record<CustomerId, VisitSlot> = {
  shen: { person: "shen", visit: 1 },
  returning: { person: "shen", visit: 2 },
  mei: { person: "mei", visit: 1 },
  xiaoyu: { person: "xiaoyu", visit: 1 },
  zhao: { person: "zhao", visit: 1 },
  anjie: { person: "anjie", visit: 1 },
  anjie2: { person: "anjie", visit: 2 },
  zhou: { person: "zhou", visit: 1 },
  zhou2: { person: "zhou", visit: 2 },
  duan: { person: "duan", visit: 1 },
};
const PEOPLE: CustomerId[] = (Object.keys(CUSTOMERS) as CustomerId[]).filter(id => VISIT_SLOT[id].visit === 1);

const outcomeWords: Record<VisitOutcome, string> = {
  good: "聊对了，这一单好好成交过",
  risky: "判断错了也硬开了一单，她事后会想起来",
  "out-of-stock": "柜上断了货，这一单没买成",
  refused: "话说到她面前，她拒绝了",
  lost: "她在柜台前等过头，走了",
};

export function campaignVisits(campaign: Campaign): Array<{ id: CustomerId; outcome: VisitOutcome }> {
  const visits: Array<{ id: CustomerId; outcome: VisitOutcome }> = [];
  for (const name of campaign.flags) {
    const served = /^served:([a-z0-9]+):(good|risky|out-of-stock|refused)$/.exec(name);
    if (served) {
      const id = served[1] as CustomerId;
      if (Object.hasOwn(CUSTOMERS, id)) visits.push({ id, outcome: served[2] as VisitOutcome });
      continue;
    }
    const lost = /^lost:([a-z0-9]+)$/.exec(name);
    if (lost) {
      const id = lost[1] as CustomerId;
      if (Object.hasOwn(CUSTOMERS, id)) visits.push({ id, outcome: "lost" });
    }
  }
  return visits;
}

export function recordProgress(progress: Progress, campaign: Campaign): Progress {
  const met = [...progress.met];
  const outcomes: Progress["outcomes"] = {};
  for (const [id, list] of Object.entries(progress.outcomes) as Array<[CustomerId, VisitOutcome[]]>) outcomes[id] = [...list];
  for (const { id, outcome } of campaignVisits(campaign)) {
    if (!met.includes(id)) met.push(id);
    const list = outcomes[id] ?? [];
    if (!list.includes(outcome)) outcomes[id] = [...list, outcome];
  }
  const endings = [...progress.endings];
  // 结局只认收摊的那一局：没 finished 的存档中途读数还不算数。
  if (campaign.finished) {
    const title = endingTitle(campaign);
    if (!endings.includes(title)) endings.push(title);
  }
  return { version: PROGRESS_VERSION, met, outcomes, endings };
}

// 类型不对整份丢弃（和 parseCampaign 同一口径）：不做坏字段过滤后的半份图鉴。
export function parseProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Progress>;
    if (!parsed || typeof parsed !== "object" || parsed.version !== PROGRESS_VERSION) return null;
    if (!Array.isArray(parsed.met) || !parsed.met.every(id => typeof id === "string" && Object.hasOwn(CUSTOMERS, id))) return null;
    if (!parsed.outcomes || typeof parsed.outcomes !== "object" || Array.isArray(parsed.outcomes)) return null;
    for (const [id, list] of Object.entries(parsed.outcomes)) {
      if (!Object.hasOwn(CUSTOMERS, id)) return null;
      if (!Array.isArray(list) || !list.every(outcome => VISIT_OUTCOMES.includes(outcome as VisitOutcome))) return null;
    }
    if (!Array.isArray(parsed.endings) || !parsed.endings.every(title => typeof title === "string")) return null;
    return {
      version: PROGRESS_VERSION,
      met: [...new Set(parsed.met as CustomerId[])],
      outcomes: Object.fromEntries(Object.entries(parsed.outcomes).map(([id, list]) => [id, [...list] as VisitOutcome[]])),
      endings: [...new Set(parsed.endings as string[])],
    };
  } catch {
    return null;
  }
}

export type ArchiveVisit = {
  id: CustomerId;
  name: string;
  visit: number;
  visitWord: string;
  descriptor: string;
  opening: string;
  outcomes: VisitOutcome[];
  outcomeWords: string[];
  // 只有这一单好好成交过（good），她才把"真正要的"那句留在档案里。
  need: string | null;
};

export type ArchiveEntry = {
  key: CustomerId;
  name: string;
  portrait: string;
  met: boolean;
  visits: ArchiveVisit[];
};

export function archiveEntries(progress: Progress): ArchiveEntry[] {
  return PEOPLE.map(person => {
    const variants = (Object.keys(CUSTOMERS) as CustomerId[])
      .filter(id => VISIT_SLOT[id].person === person)
      .sort((a, b) => VISIT_SLOT[a].visit - VISIT_SLOT[b].visit);
    const visits = variants
      .filter(id => progress.met.includes(id))
      .map(id => {
        const outcomes = progress.outcomes[id] ?? [];
        return {
          id,
          name: CUSTOMERS[id].name,
          visit: VISIT_SLOT[id].visit,
          visitWord: VISIT_SLOT[id].visit === 1 ? "第一次来" : `第 ${VISIT_SLOT[id].visit} 次来`,
          descriptor: CUSTOMERS[id].descriptor,
          opening: CUSTOMERS[id].opening,
          outcomes,
          outcomeWords: outcomes.map(outcome => outcomeWords[outcome]),
          need: outcomes.includes("good") ? CUSTOMERS[id].need : null,
        };
      });
    return {
      key: person,
      name: CUSTOMERS[person].name,
      portrait: CUSTOMERS[person].portrait,
      met: visits.length > 0,
      visits,
    };
  });
}

export type EndingEntry = { title: string; hint: string; achieved: boolean };

// endingTitle 可能返回的全部五档，措辞与 campaign.ts 逐字对齐（只读它，不改它）。
const ENDINGS: Array<{ title: string; hint: string }> = [
  { title: "你留下了，而且没变成她们", hint: "数字、台账、人心，三条线都守在柜台这一边" },
  { title: "你留下了，可没人等你", hint: "数字过了线，可她那一栏没留下你" },
  { title: "销冠的账单", hint: "数字冲在最前面，台账在身后拖出一条危险的线" },
  { title: "没转正，但有人等你", hint: "差的那截写在数字上，没写在信任里" },
  { title: "柜台灯灭了", hint: "这一周既没留下数字，也没留下愿意回来的人" },
];

export function endingEntries(progress: Progress): EndingEntry[] {
  return ENDINGS.map(ending => ({ ...ending, achieved: progress.endings.includes(ending.title) }));
}

// —— 以下两个是浏览器侧的薄包装，规则测试不经过它们 ——

export function readStoredProgress(): Progress {
  try {
    return parseProgress(window.localStorage.getItem(PROGRESS_KEY)) ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function commitCampaignToProgress(campaign: Campaign): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(recordProgress(readStoredProgress(), campaign)));
  } catch {
    // 隐私模式或配额满了都不该把游戏本身弄崩。
  }
}

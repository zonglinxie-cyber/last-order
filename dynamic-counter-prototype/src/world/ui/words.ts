// 人情网界面的中文说法唯一出处：act 代号、脾气、关系类型、看法与冷暖的成句。
// 界面不许自己拼这些句子；引擎新增 act 代号时只在这里补一行。
import type { BondKind, Slot, Temper } from "../types.ts";

export { PLAYER_NAME } from "../engine.ts";

export const TEMPER_WORD: Record<Temper, string> = {
  face: "爱面子",
  wary: "多疑",
  warm: "热心",
  gossip: "爱八卦",
  thrifty: "精打细算",
  hasty: "急性子",
  loyal: "念旧",
  proud: "好胜",
  shy: "怕被推销",
};

export const BOND_KIND_WORD: Record<BondKind, string> = {
  family: "家人",
  friend: "朋友",
  partner: "伴侣",
  colleague: "同事",
  mentor: "师徒",
  rival: "对头",
  client: "熟客",
  fan: "粉丝",
};

export const SLOT_WORD: Record<Slot, string> = { 0: "上午", 1: "午后", 2: "傍晚", 3: "晚高峰" };

// 事件代号 → 中文短句。写成能被「亲眼看你……」「听她说……」接住的样子。
export const ACT_WORD: Record<string, string> = {
  // 卖货
  "honest-advice": "给了她实在的建议",
  "wrong-pick": "推荐的东西不太对她的路",
  "hard-sell": "把不适合的东西硬推给她",
  "sold-anyway": "明知不合适还是卖给了她",
  "returned-goods": "让她跑回来退了货",
  "came-back-bought": "她回头又在你这儿买了",
  // 招呼与人情
  "greeted": "主动招呼了她",
  "pestered": "一趟趟围上来推销",
  "got-sample": "留了一份小样给她",
  "added-wechat": "加了她的微信",
  "helped-out": "搭了把手",
  "looked-after": "忙不过来时托同事好好接待了她",
  // 介绍与打圆场
  "introduced": "介绍了一个合得来的人给她",
  "awkward-intro": "硬把她和一个不熟的人凑到一起",
  "one-upping": "介绍来的人处处跟她较劲",
  "mediated": "在她跟人闹僵的时候打了圆场",
  "botched-mediation": "打圆场没打好，反而更僵",
  // 秘密
  "secret": "从你这儿听到了别人的私事",
  "kept-secret": "替她保守了秘密",
  "betrayed": "把她的秘密说了出去",
  // 对面
  "heard-rival-pitch": "让对面柜把她请走了",
};

/** 未知代号原样念出来，不编一句假话盖过去。 */
export const actWord = (act: string): string => ACT_WORD[act] ?? act;

/** 她对你的看法，只说一句话，不报数字。 */
export const opinionWord = (o: number | undefined): string => {
  if (o === undefined) return "没见过你，也没听过你的事";
  if (o >= 60) return "把你当自己人";
  if (o >= 25) return "对你有好脸色";
  if (o >= 5) return "愿意再跟你聊";
  if (o > -5) return "还没拿定主意";
  if (o > -25) return "对你有戒心";
  if (o > -60) return "当面不给你好话";
  return "跟人说过你坏话";
};

/** NPC 之间冷暖的成句，人物卡「她的熟人」一栏用。 */
export const bondWarmWord = (w: number): string => {
  if (w >= 60) return "很亲";
  if (w >= 20) return "处得好";
  if (w > -20) return "有来往";
  if (w > -60) return "不太对付";
  return "有过节";
};

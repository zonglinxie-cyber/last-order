// 人情网界面的中文说法唯一出处：act 代号、脾气、关系类型、看法与冷暖的成句。
// 界面不许自己拼这些句子；引擎新增 act 代号时只在这里补一行。
import type { BondKind, Slot, Temper } from "../types.ts";

export const PLAYER_NAME = "许愿";

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
  friend: "闺蜜",
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
  "hard-sell": "把不适合的东西硬推给她",
  "honest-advice": "给了她实在的建议",
  "kept-secret": "替她保守了秘密",
  "took-my-client": "抢了她手头的客人",
  "sample-gift": "留了一份小样给她",
  "public-callout": "当众拆穿过她",
  "bad-recommend": "推错了东西还说成合适",
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

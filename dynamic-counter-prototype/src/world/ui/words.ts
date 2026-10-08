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
  // 故事碎片里写下的（content/storylets.ts）
  "sidelined": "把她晾在一边，先顾了别人",
  "public-shame": "当着别人的面让她下不来台",
  "wrong-face": "照着别人的脸给她开了货",
  "kept-word": "没等别人说破，自己先认了",
  "stood-aside": "退开一步，没有围上来",
  "leaked": "把一句坏话补全了传出去",
  "talked-down": "让背后的话传到了当事人面前",
  "no-snatch": "没有当面压过她的话头",
  "took-client": "当着客人的面把她压了下去",
  "yielded-client": "把客人让给了她",
  "fair-split": "当众问清了这单该算谁的",
  "took-order": "客人还在，就把单写成了别人的名字",
  "broke-word": "当场拆了她带人的场",
  "copied-line": "教了她一句只会照搬的话",
  "brought-friend": "答应她把朋友带来",
  "refused-intro": "推掉了她想带来的人",
  "crowded": "一群人围上来，把她逼走了",
  "price-plain": "把差价明明白白说清楚",
  "price-pad": "拿小样把差价垫了过去",
  "off-camera": "镜头只对着产品，没拍她的脸",
  "on-camera": "让镜头对着她的脸",
  "same-as-record": "照自己看见的写进了记录",
  "named-colleague": "在记录里把缺口写到了她头上",
  "not-my-return": "分开说清，没把她化成别人的样子",
  "kept-warning": "她提醒过的那句，你守住没说",
  "broke-warning": "她提醒过的那句，你还是说了",
  "covered-gap": "替她补上了缺口，写明是你补的",
  "refused-gap": "没替她补那个缺口",
  "turned-friend": "没按熟客那套待她，把她处成了朋友",
  "passed-word": "把一句好话原样带到了她面前",
  // 第 2 季故事碎片（content/storylets-season2.ts）
  "presale-matched": "把预售核销和票对上了",
  "presale-forced": "预售没核上，还是收了尾款",
  "hand-price": "把线上到手价说清楚了",
  "ledger-matched": "年终盘点照小票对上了",
  "ledger-padded": "年终盘点补了一行票上没有的数",
  "records-opened": "把记录摊开给区域经理看了",
  "records-held": "没把记录摊给区域经理",
  "came-for-last": "带着之前的事回到了柜前",
  "quota-held": "转正名额的来历没有往下传",
  "quota-said": "说了转正名额不是总部写的",
  "posted-stay": "调岗表上还留在这面柜",
  "posted-out": "调岗表上离开了这面柜",
  "unlearned": "把背错的那句卸掉了",
  "own-line": "用自己的句子把客人送走了",
  "folder-kept": "把原话留在文件夹里，下一季还认",
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

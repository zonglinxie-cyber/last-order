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
  // 在场的人自己长出来的（exchanges.ts）
  "quarreled": "跟人当场吵了一架",
  "vouched-for": "替你说了好话",
  "badmouthed": "在背后数落了你一通",
  "walked-out": "被你气得待不下去，走了",
  "stormed-off": "熟人被你气走，她跟着走了",
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
  // 顾客个人线（content/storylets-arcs3.ts）
  "budget-kept": "按她报的预算开了，没有往上加",
  "over-budget": "开过了她报出来的预算",
  "colleague-need": "按同事的需求开，没有按她自己的脸",
  "own-face": "按她自己的脸开，同事的需求另说",
  "daughter-row": "对的是女儿写下的那一行",
  "mother-say": "听了她口述的那一格，没有对屏幕",
  "claim-full": "在镜头里把功效说满了",
  "claim-held": "镜头开着，功效没有说满",
  "rival-line": "把对面那句复述给她听了",
  // 梅女士的十分钟（同一份文件，反转写在 arc-mei-form）
  "given-time": "陪她把那十分钟过完，没有催",
  "asked-client": "问了她那位客户",
  "saw-stay": "看着你留在那十分钟里",
  "heard-client": "从她嘴里听到了那位客户",
  "sent-off": "提醒她表已经过了，把她送回忙里",
  "covered-name": "替她在登记表上填了客户",
  "told-around": "把她那一栏讲给了柜上的人",
  "heard-mei-name": "听到她落在登记表上的那个名字",
  "told-herself": "她当着人把自己的那句话说完",
  "kept-as-client": "这一支还是记在客户名下，没有再问",
  // 尹小姐带走的那句（storylets-arcs4.ts）
  "said-plain": "把那一瓶说回干燥和泛红，没有往线外说",
  "asked-proof": "问了她要那一句做什么",
  "carried-line": "原话一字不差，又念了一遍",
  "asked-where": "问了她那两支后来去了哪",
  "taught-return": "把能退的那句原话教给了她",
  "pen-held": "只管把这单卖掉，不管她那句留着",
  "showed-slip": "把自己那张小票摊开给她看",
  "line-on-order": "那句原话照她的写法进了单子",
  "tape-gone": "那支笔她不再带进这面柜",
  // 段小姐拆平的包装（storylets-arcs4.ts）
  "kept-looking": "她说只是看看，你就只讲了那一句",
  "asked-whofor": "问了这一支是买给谁的",
  "name-on-row": "那一行照她报的别人的名字开了",
  "turned-away": "按别人那一行劝她别买",
  "took-back": "那一笔退货登记在她自己名下",
  "row-blank": "退货写成换货，那一行没人认领",
  "counted-new": "旧的那支不提，这趟算新开一单",
  // 赵宁来说的那声「不」（storylets-arcs4.ts）
  "came-alone": "她一个人进柜，没有让别人替她开口",
  "asked-about-mother": "先问的是她妈妈今天怎么没来",
  "showed-old-order": "把妈妈的旧单翻出来给她看",
  "list-held": "对的是她自己写的那一行",
  "list-mixed": "把她那一行念成了她妈妈的口味",
  "sale-stopped": "那一支没有开，话记在她这一栏",
  "sale-forced": "那支还是开了，写在妈妈那一栏",
  "both-come": "约了她和妈妈一起来把这句话说完",
  "nothing-asked": "这一单做完，什么也没多问",
  "own-name": "她在柜上落的是自己的名字",
  // 主线：那张退货单（storylets-mainline.ts）
  "slip-asked-date": "先问了那单是哪天进来的",
  "slip-asked-tape": "问了她包带里开着什么",
  "slip-asked-gap": "把领用表那一行问到嘴边",
  "slip-not-mine": "说清了那张单子不是她退的",
  "slip-named-group": "把名字是从群里借的说出去了",
  "slip-name-held": "知道那一行是谁的，没有念出口",
  "slip-owned-line": "把自己那句原话交了出去",
  "slip-waited": "等这一页自己归档，没先开口",
  "slip-punted": "把单子推给了别人的名字",
  // 主线第 2 季那三张（storylets-mainline.ts）：幕号还没抬，但本子上先有了下一幕要用的东西
  "act2-copied-line": "把原件抄了一份留在自己手里",
  "act2-admitted-held": "问到她承认那一行是她按的",
  "act2-slip-fled": "说那张单子早并进柜位账了",
  "act2-tape-whole": "听完了那一段没有剪过的",
  "act2-tape-why": "问她为什么留到这一季",
  "act2-tape-hushed": "劝她把那支笔收回去",
  "act2-traded-slip": "跟对面换了一张复印件",
  "act2-asked-source": "问了对面那张是谁给她的",
  "act2-showed-own": "把自己那张单子摊给她看了",
  // 主线第 3 幕：那一行是谁的手写的（storylets-mainline.ts）
  "act3-asked-roster": "把那几天的排班调出来对了一遍",
  "act3-asked-held": "问了她这一页按了几季",
  "act3-own-name": "把自己的名字写回了那一行",
  "act3-name-cleared": "听说那一行的字不是她写的",
  "act3-row-buried": "陪你把那一页停在柜位名下",
  "act3-asked-herself": "拿着那页去问过她本人",
  "act3-tape-filed": "把那句原话交进了台账",
  "act3-tape-kept": "让她先把那支笔收回去",
  "act3-she-signed": "她自己在那一栏签了名",
  "act3-nobody-signed": "那一栏谁也没签",
  // 第 3 季：宋姐那一沓垫付（storylets-arcs5.ts）
  "group-asked-shot": "问了她群里那张截图是谁拍的",
  "group-not-asked": "群里那一句没有追问",
  "group-read-out": "把群里那句当众念了出来",
  "group-book-matched": "照小票把那沓垫付一笔一笔对上",
  "group-book-asked": "问她那一沓跟柜上有什么关系",
  "group-book-merged": "把垫付并进柜上的账，改了名字",
  "group-shot-known": "认下那张截图是她自己拍的",
  "group-told-herself": "那一页由她自己跟当事人说",
  "group-paid-by-counter": "那一笔由柜上退掉了",
  "group-client-named": "把发图那个人念给了柜上",
  "group-named-out": "在自己待的群里被人念了名字",
  "group-money-known": "问清了那一栏记在谁名下",
  "group-own-name": "垫付那一栏写回她自己名下",
  "group-settled": "那一笔她自己跟群里对完了",
  "group-owed-stays": "柜上垫过的那一笔她没有再要",
  "group-nothing-said": "那一沓票她一个字也没说",
  // 第 3 季：白姐那六个色（同一份文件）
  "case-six-shades": "六个色分开答完",
  "case-shade-short": "按一支的预算把她那六行划掉",
  "case-asked-whofor": "问她这一次是替谁选",
  "case-chair-named": "说出了那场婚礼定的是谁",
  "case-chair-pulled": "认下案例是她自己撤下来的",
  "case-chair-plain": "那场婚礼她本来就没被叫",
  "kit-one-kept": "那一笔按一支开完",
  "kit-split-ticket": "四支开成一客四张票",
  "kit-samples-filled": "拿试色小样替她凑齐六色",
  "case-group-shot": "认下群里那张图是她拍的",
  "case-chair-kept": "六个色留下一次上台用",
  "case-record-as-said": "这一笔按她说的一支算",
  "case-brought-client": "带着还在挑色的人来试色",
  "case-group-pulled": "把群里那一句原样收了回去",
  // 主线第 4 季那一张（storylets-mainline.ts 的 main-a4-page）
  "act4-signed-copy": "在这一季的抄件上签了名",
  "act4-quarter-known": "问出那一页每季是谁要的",
  "act4-copy-burned": "把那一页的抄件烧了",
  // 第 4 季个人线：裴岚（storylets-arcs6.ts）
  "quarter-row-asked": "问她那一行为什么每季都抄一遍",
  "quarter-words-kept": "把今天的原话照她的规矩留下",
  "quarter-numbers-only": "只给她看数，那一行不看",
  "quarter-held-known": "认下那一页是她自己按住的",
  "quarter-row-named": "问清那一行记在谁手上",
  "quarter-page-refused": "说柜上不管区域那一页",
  "quarter-list-named": "把她的名字写进下一季的名单",
  "listed-by-counter": "把她写进下一季还留着的名单",
  "quarter-list-self": "把名单那一格写了自己",
  "quarter-list-blank": "名单那一格空着没写",
  "quarter-row-carried": "把那一页自己抄上去认了",
  "quarter-list-good": "替她把名字留到下一季",
  "quarter-list-as-is": "名单按上一季的人数报",
  "quarter-table-closed": "不替这面柜写下一季",
  "quarter-nothing-said": "那一页谁也没念",
  // 第 4 季个人线：梁夏（storylets-arcs6.ts）
  "camera-asked-shoot": "让她在柜上拍了挂在主页的照片",
  "camera-asked-wedding": "先问了安姐那一场后来怎样",
  "camera-shoot-refused": "说柜上不拍人",
  "camera-set-kept": "把那套删不掉的旧原图给你看",
  "camera-set-spread": "问她那场婚礼的图是谁传出去的",
  "camera-set-deleted": "替她把那一页删了",
  "camera-base-natural": "按她的否决只开薄的那支",
  "camera-base-trialled": "只上半脸，八小时以后再说",
  "camera-asked-source": "问她这一季的活是从哪里接来的",
  "camera-counter-named": "让柜上上了她主页那一行字",
  "camera-no-sign": "不挂柜上的名字，人回来就行",
  "camera-set-told": "把那一页先跟安姐说清",
  "camera-shot-closed": "不肯让她在柜上拍那张",
  "camera-returned": "把那支厚的退回来了",
  "camera-stood-aside": "那一季她本来没打算让谁看见",
  // 每日委托（requests.ts）
  "kept-promise": "答应她的事做到了",
  "broke-promise": "答应她的事没做到",
  "lent-samples": "借了两支小样给她",
  "turned-down": "没应下她张的口",
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

const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;

/** 同屏比分：这一季我 vs 对面维珞的进账，比的是钱不是人次。
 *  页顶、打烊、季末三处都读这一句，界面不许各拼一份。 */
export const scoreWord = (mine: number, hers: number): string => {
  if (!hers) return "对面一单没开";
  if (mine > hers) return `比对面多 ${yuan(mine - hers)}`;
  if (mine < hers) return `落后对面 ${yuan(hers - mine)}`;
  return "和对面打平";
};

/** 页顶那一格用的短式：只报对面的账，不带比较句。 */
export const scoreBrief = (hers: number): string => `对面 ${yuan(hers)}`;

/** 楼层名牌底下那一行小字：她是不是你已经接见过的客人。
 *  判据只有一个出处（engine 的 isReturningGuest），这里只出说法。 */
export const guestKindWord = (returning: boolean): string => returning ? "回头客" : "新客";

/** 「现场 · N 位客人」后面跟的那半句。一位新客都没有就不念 —— 全是熟人不算一条消息。 */
export const newGuestWord = (fresh: number): string => fresh ? ` · 新客 ${fresh}` : "";

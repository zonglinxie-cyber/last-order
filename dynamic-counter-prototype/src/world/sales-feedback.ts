// 复盘只解释已经发生的结算，不查看预约队列中的未来退货结果。
import { SERVE_REFUSE_OPINION } from "./engine.ts";
import { recentlyPurchased } from "./purchases.ts";
import { PERFECT_MATCH, SHELF, fitOfPair, fitOfPerson, isPerfectMatch, isPerfectPair, perfectPairOf, serveItemsOf, shelfFitTier, type ShelfId } from "./shelf.ts";
import { ROUTE_WORD, weekMoneyOf, weekResultOf, weekTargetOf } from "./target.ts";
import { PLAYER, type Person, type World } from "./types.ts";
import { ta } from "./pronoun.ts";

export type SaleFeedback = {
  title: string; tone: "good" | "mixed" | "bad"; amount: number; units: number;
  opinion: number; compliance: number; standing: number;
  explanation: string; lesson: string; goal: string; lines: string[];
};
export function saleFeedback(before: World, after: World, person: Person, product: ShelfId, requestedUnits = 1, mood = 0, secondTry = false, extra?: ShelfId | null): SaleFeedback {
  const amount = after.money - before.money;
  const recent = recentlyPurchased(before, person.id);
  const hard = after.memories.slice(before.memories.length)
    .some(m => m.holder === person.id && m.subject === PLAYER && m.act === "hard-sell");
  // 配了两支的：主支之外还搭了一支，件数与开口都算两支的。
  const pair = extra && extra !== product ? extra : null;
  const askedTotal = requestedUnits + (pair ? 1 : 0);
  const overAsk = amount > 0 && !hard && askedTotal > (person.skin?.maxUnits ?? 0);
  const score = pair ? fitOfPair(person, product, pair) : fitOfPerson(person, product);
  const tier = shelfFitTier(score);
  const perfect = pair ? isPerfectPair(person, product, pair) : (tier === "positive" && isPerfectMatch(person, product));
  // 最省的那一对：配的这一对不是它的时候，收据要说出来 —— 「接住了」与「懂她」不是一件事。
  const cheapest = pair ? perfectPairOf(person) : null;
  const soldItems = serveItemsOf(person, product, requestedUnits, tier, pair);
  const soldUnits = soldItems.reduce((sum, i) => sum + i.units, 0);
  const refused = (before.opinion[person.id] ?? 0) + mood <= SERVE_REFUSE_OPINION;
  const title = amount > 0 ? hard ? "单开了，人情有代价" : overAsk ? "这单开口多了" : tier === "positive" ? perfect ? "这一单，懂她" : "接住了这单" : "成交了，还有遗憾"
    : refused ? "这次先修复关系" : recent ? "还没用完，先别急" : "这一单没成交";
  const baseExplanation = amount > 0 ? hard ? "账面进账了，但关系、柜位和台账都受了影响；多出来的货之后可能退回来。"
    : overAsk ? `你开口要 ${askedTotal} 件，她最多只想带 ${person.skin!.maxUnits} 件。多要的部分没有增加成交，反而扣了人情。`
    : tier === "positive" ? perfect
      ? (pair ? "两支合起来接住了她的每一件事：单买一支差着的那一条，这一支补上了。她觉得你真听懂了。"
        : "这支货接住了她的全部诉求，也没有让她为不需要的东西多付。认对需求，也是在为下一次见面铺路。")
      : pair && score >= PERFECT_MATCH && cheapest
        ? `两支合起来接住了她的每一件事，但不是最省的那一对；最省的是${SHELF[cheapest[0]].short} + ${SHELF[cheapest[1]].short}。`
        : score >= PERFECT_MATCH ? "这支也接住了她的全部诉求，但不是最省的那一支；正中那支更便宜。" : "选到的货符合需求，她愿意为这次推荐买单。"
    : "她勉强接受了，实际带走的件数以结算为准。试用里的犹豫值得留意。"
    : refused ? "眼下她不愿意接受你的推荐，产品合适也不能代替信任。"
    : recent ? "上次买的还没用完。换一支货推荐，也解决不了这个问题。"
    : tier !== "negative" ? "产品对症，但一件的价格已经超过她今天的预算。" : "这支货没有接住她的需要。价格更贵并不代表更合适。";
  const withSecondTry = secondTry && amount > 0 && !hard
    ? `${baseExplanation} 她在第一支上已经点过头，你又换了一支；这次反复让她少给了几分信任。`
    : baseExplanation;
  const lesson = hard ? "下次可以少开一些、换货，或把这一单留到以后。"
    : secondTry ? "她点头后，换一支要有把握；没把握就先收下这一单。"
    : overAsk ? "货要对症，量也要对。一次问清件数，客情笔记会替你记到下次。"
    : refused ? "先用招呼、帮忙或履约修复关系，再谈下一单。"
    : recent ? "招呼、帮忙或经营关系，也是在为以后留生意。"
    : amount <= 0 ? "把已知需求与货架标签对照，再用试用验证不确定的那支。"
    : "记住今天问出的需求，下一次把有限的耐心用在新的判断上。";
  const made = weekMoneyOf(after), target = weekTargetOf(after.day, after.season);
  const result = weekResultOf(after);
  return { title: title.replaceAll("她", ta(person)), tone: amount <= 0 ? "bad" : hard || overAsk || tier === "mixed" ? "mixed" : "good", amount,
    units: soldUnits, opinion: (after.opinion[person.id] ?? 0) - (before.opinion[person.id] ?? 0),
    compliance: after.compliance - before.compliance, standing: after.standing - before.standing,
    explanation: withSecondTry.replaceAll("她", ta(person)), lesson, goal: result.stars ? `本周${ROUTE_WORD[result.route]}线已过关 · ${result.stars} 颗星`
      : `业绩线还差 ¥${(target - made).toLocaleString("zh-CN")}；也可以走客情或守客线`,
    lines: after.log.slice(before.log.length).map(l => l.text),
  };
}

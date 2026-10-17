// 复盘只解释已经发生的结算，不查看预约队列中的未来退货结果。
import { SERVE_REFUSE_OPINION } from "./engine.ts";
import { recentlyPurchased } from "./purchases.ts";
import { PERFECT_MATCH, SHELF, fitOfPerson, shelfFitTier, type ShelfId } from "./shelf.ts";
import { ROUTE_WORD, weekMoneyOf, weekResultOf, weekTargetOf } from "./target.ts";
import { PLAYER, type Person, type World } from "./types.ts";
import { ta } from "./pronoun.ts";

export type SaleFeedback = {
  title: string; tone: "good" | "mixed" | "bad"; amount: number; units: number;
  opinion: number; compliance: number; standing: number;
  explanation: string; lesson: string; goal: string; lines: string[];
};
export function saleFeedback(before: World, after: World, person: Person, product: ShelfId, requestedUnits = 1, mood = 0): SaleFeedback {
  const amount = after.money - before.money;
  const recent = recentlyPurchased(before, person.id);
  const hard = after.memories.slice(before.memories.length)
    .some(m => m.holder === person.id && m.subject === PLAYER && m.act === "hard-sell");
  const overAsk = amount > 0 && !hard && requestedUnits > (person.skin?.maxUnits ?? 0);
  const score = fitOfPerson(person, product), tier = shelfFitTier(score);
  const refused = (before.opinion[person.id] ?? 0) + mood <= SERVE_REFUSE_OPINION;
  const title = amount > 0 ? hard ? "单开了，人情有代价" : overAsk ? "这单开口多了" : tier === "positive" ? score >= PERFECT_MATCH ? "这一单，懂她" : "接住了这单" : "成交了，还有遗憾"
    : refused ? "这次先修复关系" : recent ? "还没用完，先别急" : "这一单没成交";
  const explanation = amount > 0 ? hard ? "账面进账了，但关系、柜位和台账都受了影响；多出来的货之后可能退回来。"
    : overAsk ? `你开口要 ${requestedUnits} 件，她最多只想带 ${person.skin!.maxUnits} 件。多要的部分没有增加成交，反而扣了人情。`
    : tier === "positive" ? score >= PERFECT_MATCH ? "这支货接住了她的全部诉求。认对需求，也是在为下一次见面铺路。" : "选到的货符合需求，她愿意为这次推荐买单。"
    : "她勉强接受了，实际带走的件数以结算为准。试用里的犹豫值得留意。"
    : refused ? "眼下她不愿意接受你的推荐，产品合适也不能代替信任。"
    : recent ? "上次买的还没用完。换一支货推荐，也解决不了这个问题。"
    : tier !== "negative" ? "产品对症，但一件的价格已经超过她今天的预算。" : "这支货没有接住她的需要。价格更贵并不代表更合适。";
  const lesson = hard ? "下次可以少开一些、换货，或把这一单留到以后。"
    : overAsk ? "货要对症，量也要对。一次问清件数，客情笔记会替你记到下次。"
    : refused ? "先用招呼、帮忙或履约修复关系，再谈下一单。"
    : recent ? "招呼、帮忙或经营关系，也是在为以后留生意。"
    : amount <= 0 ? "把已知需求与货架标签对照，再用试用验证不确定的那支。"
    : "记住今天问出的需求，下一次把有限的耐心用在新的判断上。";
  const made = weekMoneyOf(after), target = weekTargetOf(after.day);
  const result = weekResultOf(after);
  return { title: title.replaceAll("她", ta(person)), tone: amount <= 0 ? "bad" : hard || overAsk || tier === "mixed" ? "mixed" : "good", amount,
    units: amount / SHELF[product].price, opinion: (after.opinion[person.id] ?? 0) - (before.opinion[person.id] ?? 0),
    compliance: after.compliance - before.compliance, standing: after.standing - before.standing,
    explanation: explanation.replaceAll("她", ta(person)), lesson, goal: result.stars ? `本周${ROUTE_WORD[result.route]}线已过关 · ${result.stars} 颗星`
      : `业绩线还差 ¥${(target - made).toLocaleString("zh-CN")}；也可以走客情或守客线`,
    lines: after.log.slice(before.log.length).map(l => l.text),
  };
}

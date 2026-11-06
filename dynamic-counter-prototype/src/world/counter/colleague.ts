import { CUSTOMERS, PRODUCTS } from "./content.ts";
import type { ColleagueChat, Run } from "./types.ts";

// A single optional conversation, not another resource or relationship meter.
export function talkToSuman(run: Run, choice: ColleagueChat["choice"]): Run {
  if (run.experiment || run.day !== 1 || run.phase !== "draft" || run.colleagueChat || !["review", "own"].includes(choice)) return run;
  let reply: string, nextMorning: string;
  if (choice === "own") {
    reply = "行，你按自己的来。椅子给你，我去找找我那杯已经凉透的茶。";
    nextMorning = "你昨天说想自己试试，今天我先不插话。镜子擦好了，开柜吧。";
  } else {
    const today = run.history.filter(receipt => receipt.day === 1);
    const sold = today.find(receipt => receipt.outcome === "sold" && receipt.fit >= 8) ?? today.find(receipt => receipt.outcome === "sold");
    if (sold) {
      const customer = CUSTOMERS.find(c => c.id === sold.customerId)!;
      const product = PRODUCTS.find(p => p.id === sold.productId)!;
      const observation = sold.fit >= 8 ? `给${customer.name}拿的${product.name}，确实对上了她的要求。` :
        sold.discount === 0 ? `${customer.name}那单，你没打折也接住了。` : `${customer.name}那单，你让了价，也还是留住了利润。`;
      reply = `${observation}${today.some(r => r.outcome !== "sold") ? "别只盯着没成的那一笔。" : "今天这两笔，收得挺稳。"}先坐会儿，站一天了。`;
      nextMorning = `昨天聊的${customer.name}那单，我还记着。今天换了客人，咱们再听听他们怎么说。`;
    } else {
      reply = "今天没开成，先别急着给自己下结论。明天别一口气把话问完，挑一支试试，也是一条路。椅子在这儿，先歇会儿。";
      nextMorning = "昨天的先放一放。今天这几位还没聊过，重新来。";
    }
  }
  return { ...run, colleagueChat: { choice, reply, nextMorning } };
}

export function receiptAchievement(run: Run): { title: string; detail: string } | null {
  const receipt = run.receipt;
  if (!receipt || receipt.outcome !== "sold") return null;
  const earlierSales = run.history.filter(r => r.id !== receipt.id && r.outcome === "sold");
  const lead = run.money - run.rivalMoney;
  if (lead > 0 && run.money - receipt.profit <= run.rivalMoney - receipt.rivalGain) {
    return { title: "这一单，反超了", detail: `现在领先 ¥${lead.toLocaleString("zh-CN")}。这笔收益已经计入上方比分。` };
  }
  if (earlierSales.length === 0) return { title: "第一单，拿下", detail: "从这一笔开始，试着把自己的打法接起来。" };
  if (receipt.fit >= 8 && receipt.discount === 0) return { title: "选得准，也守住了价", detail: "这单原始匹配达到 8 分以上，按原价成交。" };
  if (receipt.returning) return { title: "这位熟客，这次接住了", detail: "这次是真正成交，不只是认得彼此。" };
  return { title: "又接住一笔", detail: `本轮已成交 ${earlierSales.length + 1} 笔，继续把判断变成实绩。` };
}

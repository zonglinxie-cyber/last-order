import type { Page } from "@playwright/test";

// 玩家能自己加回去的那一笔：把界面上看得见的所有 ¥ 行加成一个数。
// 钱只写在因果行上（沙盘和手机版念的都是 campaign.ts 里那一份 history），
// 所以这个和应当等于页顶的大数字——有一笔动了钱却没写行，这里就对不上。
export async function ledgerYuan(page: Page, selector = ".ledger-book p") {
  return page.locator(selector).evaluateAll(nodes => nodes.reduce((sum, node) => {
    for (const hit of (node.textContent ?? "").matchAll(/·\s*(−?)¥([\d,]+)/g)) sum += (hit[1] ? -1 : 1) * Number(hit[2].replace(/,/g, ""));
    return sum;
  }, 0));
}

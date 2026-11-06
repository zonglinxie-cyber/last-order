import type { ReactNode } from "react";
import { asset } from "../../base.ts";
import { CUSTOMERS, PRODUCTS } from "./content.ts";
import {
  bookCustomer, chapterBid, chooseChapterPlan, chooseInventory, chooseShowcaseFormat,
  preparationBlocked, setGift, supportKind, TANGKE_BID,
} from "./chapter.ts";
import { supportTrial } from "./engine.ts";
import type { Opportunity, Receipt, Run } from "./types.ts";

type Props = { run: Run; update: (fn: (run: Run) => Run) => void };
const money = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
const customerName = (id: string) => CUSTOMERS.find(c => c.id === id)?.name ?? "客人";
const productName = (id: string | null) => PRODUCTS.find(p => p.id === id)?.name ?? "未选商品";
const staffNames = { tangke: "唐可", suman: "苏蔓", roman: "罗曼", luyao: "陆遥" };

function StaffLine({ who, children }: { who: keyof typeof staffNames; children: ReactNode }) {
  return <div className="c-chapter-voice">
    <img src={asset(`/assets/game/staff-portraits/${who}.png`)} alt="" draggable={false} />
    <div><b>{staffNames[who]}</b><p>{children}</p></div>
  </div>;
}

function BidReceipts({ receipts }: { receipts: Receipt[] }) {
  return <ul className="c-chapter-receipts">{receipts.map(r => <li key={r.id} data-receipt-id={r.id}>
    <b>第 {r.day} 天 · {customerName(r.customerId)} · {productName(r.productId)}</b>
    <span>成交 1 分{r.fit >= 8 ? " + 原始匹配≥8 得1分" : ""}{r.discount === 0 ? " + 原价得1分" : ""} · 个人净收益 {money(r.profit)}</span>
  </li>)}</ul>;
}

export function ChapterGoal({ run }: { run: Run }) {
  if (!run.chapter || run.experiment) return null;
  const bid = chapterBid(run);
  return <details className="c-chapter c-chapter-goal" data-testid="chapter-goal">
    <summary><span><b>周末主理机会</b><small>{run.chapter.award ? "结果已公示" : `第2–5天挑两张好单 · 当前 ${bid.score} 分`}</small></span><span aria-hidden="true">＋</span></summary>
    <p>这不是七天净收益联赛：周末谁来主理，看第2–5天最好的两张成交单，第6天开柜公示。</p>
    <p>每张成交 1 分，原始匹配≥8 再加 1 分，原价再加 1 分。先比两张总分，再比两张个人净收益；完全相同，先报名的唐可优先。</p>
    <p>唐可已提交 <b>{TANGKE_BID.score} 分 · {money(TANGKE_BID.profit)}</b>：公开预设案例，羽光原价 ¥330＋原价奖金 ¥30，安心原价 ¥260，两单均高匹配，不计入七天对手账。</p>
    <p>你的候选：{bid.receipts.length} 张 · {bid.score} 分 · {money(bid.profit)}。分给唐可的钱不算你的参选收益。</p>
    <BidReceipts receipts={bid.receipts} />
    {run.day === 1 && <StaffLine who="luyao">我先把周末的陈列备好，主理的位置还得凭单子争。</StaffLine>}
  </details>;
}

export function ChapterPlanPanel({ run, update }: Props) {
  const chapter = run.chapter;
  if (!chapter || run.experiment || run.day !== 1 || run.phase !== "draft") return null;
  return <section className="c-chapter" data-testid="chapter-plan" aria-label="收柜后的搭班选择">
    <span className="c-eyebrow">收柜间隙 · 周末谁主理？</span>
    {chapter.plan ? <StaffLine who={chapter.plan === "solo" ? "roman" : "tangke"}>
      {chapter.plan === "solo" ? "没内定。第2到第5天，你每天可以先约一位问预算，再决定接不接。" : "行，第2到第5天每天替你试一笔，用你的小样。成了分我四分之一；主理的位置，我也会争。"}
    </StaffLine> : <>
      <StaffLine who="tangke">陆遥都准备了，周末位置是不是定了？</StaffLine>
      <StaffLine who="suman">准备不等于内定。别猜，问清楚再做打算。</StaffLine>
      <div className="c-chapter-actions">
        <div><button type="button" onClick={() => update(r => chooseChapterPlan(r, "solo"))}>找罗曼问清楚</button><small>第2–5天，每天提前问一位候客的预算，不耗交谈；问过也可以不接。</small></div>
        <div><button type="button" onClick={() => update(r => chooseChapterPlan(r, "team"))}>和唐可约好搭班</button><small>第2–5天，每天替你试一笔：不耗交谈，用你1份小样；成交含奖金的收益分25%给她，向下取整，失单不分。</small></div>
      </div>
      <small>也可以不选，照常选能力下班。</small>
    </>}
    <p className="c-chapter-note">罗曼提醒：今天活动临促也帮忙整理了周末礼袋，收柜记得交接。</p>
  </section>;
}

export function ChapterBooking({ run, candidate, update }: Props & { candidate?: Opportunity }) {
  const chapter = run.chapter;
  if (!chapter || run.experiment || chapter.plan !== "solo" || run.day < 2 || run.day > 5) return null;
  const used = chapter.bookings.find(b => b.day === run.day);
  const booked = candidate && chapter.bookings.find(b => b.day === run.day && b.opportunityId === candidate.id);
  const blocked = preparationBlocked(run);
  const opening = run.turn === 0;
  return <section className="c-chapter" data-testid="chapter-booking" aria-label="提前问价">
    <b>开柜前，先问一句</b>
    <p role="status">{used ? `今日预约已用${booked && candidate ? ` · ${customerName(candidate.customerId)}说预算是 ${money(booked.budget)}` : ""}` : blocked ? "今天的准备机会用来查交接，不能提前问价。" : !opening ? run.day === 5 ? "今天已开始接客，本轮提前问价已结束。" : "今天已开始接客，提前问价要留到下次开柜前。" : "每天开柜前只问一位，不耗销售交谈。问过预算，也可以把接待名额留给别人。"}</p>
    {candidate ? <button type="button" className="c-chapter-button" disabled={!!used || blocked || !opening} onClick={() => update(r => bookCustomer(r, candidate.id))}>提前问{customerName(candidate.customerId)}预算</button> : <small>{opening && !used && !blocked ? "先点选一位候客，再决定要不要问预算。" : "照常选择要接待的客人就好。"}</small>}
  </section>;
}

export function ChapterSupport({ run, update }: Props) {
  const chapter = run.chapter, deal = run.active;
  if (!chapter || run.experiment || !deal) return null;
  const kind = supportKind(run);
  const offered = deal.support?.kind ?? kind ?? (run.day >= 2 && run.day <= 5 && chapter.plan === "team" ? "team" : run.day >= 6 && run.day <= 7 && chapter.award?.won && chapter.format === "demo" ? "demo" : null);
  const product = PRODUCTS.find(p => p.id === deal.product);
  const blocked = preparationBlocked(run);
  const used = chapter.supportDays.includes(run.day);
  const tried = !!product && deal.tried.includes(product.id);
  const enabled = !!kind && !!product && run.samples > 0 && !tried && !deal.support && !used && !blocked;
  const reason = deal.support ? `本单已试用${productName(deal.support.productId)}。`
    : blocked && chapter.plan === "team" ? "今天的准备机会用来查交接，唐可支援暂停一天。"
    : used ? "今日支援已用；自己的交谈和小样仍可照常试货。"
    : !offered ? chapter.plan === "solo" ? "你选了提前问价；这单可用自己的交谈试货。" : "这会儿没有搭班或演示安排，可用自己的交谈试货。"
    : !product ? "先选一支货，再请支援。"
    : run.samples <= 0 ? "小样用完了，支援也需要你出1份小样。"
    : tried ? "这支已经试过了，不重复花小样。"
    : !kind ? "这会儿没有可用支援，仍可照常报价。"
    : "不耗你的交谈，交谈用完也能请支援；仍用你1份小样。";
  return <section className="c-chapter" data-testid="chapter-support" aria-label="试用支援">
    <b>{offered === "team" ? "唐可搭班" : offered === "demo" ? "你的演示专场" : "试用安排"}</b>
    <p role="status">{reason}</p>
    {offered && <>
      <button type="button" className="c-chapter-button" disabled={!enabled} onClick={() => update(supportTrial)}>{offered === "team" ? "请唐可替我试用" : "用演示台试用"}</button>
      <small>{offered === "team" ? "每天一次。只要请她试过，本单成交含奖金的收益就分25%给唐可，向下取整；失单不分。" : "每天一次，不分账。演示也只能证明试过的商品。"}</small>
    </>}
    {deal.support && <p className="c-chapter-note">{deal.support.kind === "team" ? "即使最后换品，成交仍分账；" : "换品后不会自动得到试用证明；"}这次试用只证明{productName(deal.support.productId)}。</p>}
    {deal.support && deal.support.productId !== deal.product && deal.trialNotes[deal.support.productId] && <p className="c-trial-result">{productName(deal.support.productId)}的试用记录：{deal.trialNotes[deal.support.productId]}</p>}
  </section>;
}

export function ChapterGift({ run, update }: Props) {
  const gifts = run.chapter?.gifts;
  if (!gifts || run.experiment || !run.active || run.day < 4 || run.day > 7 || !gifts.opened) return null;
  return <section className="c-chapter" data-testid="chapter-gift" aria-label="本单赠品">
    <div className="c-chapter-heading"><b>周末礼袋</b><span>可用 {gifts.stock} 份</span></div>
    <button type="button" className="c-chapter-button" aria-pressed={!!run.active.gift} disabled={gifts.stock <= 0} onClick={() => update(r => setGift(r, !r.active?.gift))}>成交后送1份赠品</button>
    <small role="status">{gifts.stock <= 0 ? "手头没有赠品，照常谈单就好。" : `${run.active.gift ? "已选赠品 · " : ""}成交才扣1份，额外关系+1；不加匹配、不抬预算，失单不耗。`}</small>
  </section>;
}

// The saved cause is hidden until the investigation or day-six public notice.
function inventoryEvidence(run: Run): string | null {
  const gifts = run.chapter?.gifts;
  if (!gifts?.opened || !(run.day >= 6 || (gifts.choice === "trace" && run.day >= 4))) return null;
  return gifts.cause === "transfer"
    ? "罗曼核对了跨柜借调单：两份赠品被借到邻柜，交接时漏了登记，不是有人偷拿。"
    : "罗曼核对交接记录，并向当班临促确认：两份赠品是活动临促私自拿走的，不是跨柜借调。";
}

export function ChapterInventory({ run, update }: Props) {
  const gifts = run.chapter?.gifts;
  if (!gifts?.opened || run.experiment) return null;
  const choosing = run.day === 3 && run.phase === "draft";
  const opening = run.day >= 4 && run.day <= 6 && run.turn === 0 && run.phase === "select";
  if (!choosing && !opening) return null;
  const evidence = inventoryEvidence(run);
  return <section className="c-chapter" data-testid="chapter-inventory" aria-label="预留赠品交接">
    <span className="c-eyebrow">{choosing ? "第3天收柜 · 礼袋不对数" : evidence ? "礼袋交接 · 核查有了结果" : "礼袋交接 · 还在核对"}</span>
    <b>{choosing ? "预留的2份赠品少了" : `手头可用赠品 ${gifts.stock} 份`}</b>
    {choosing ? <>
      <p>少的是周末预留的两份赠品，不是全店库存。{gifts.choice === "replace" ? "你已经另外补了两份，原来的仍在核查。" : "原来的两份还没找回来。"}手头可用 {gifts.stock} 份。</p>
      {!gifts.choice ? <>
        <StaffLine who="tangke">先把周末要用的补上，别让客人等。</StaffLine>
        <StaffLine who="suman">先查交接。谁帮过忙、谁说过话，都不能当成拿走东西的证据。</StaffLine>
        <StaffLine who="roman">今天活动临促也参与了礼袋整理，我会一起核对。你不用替整柜认账。</StaffLine>
        <div className="c-chapter-actions">
          <div><button type="button" onClick={() => update(r => chooseInventory(r, "trace"))}>查交接</button><small>第4天拿到核查证据，但占用当天预约或唐可支援；何时追回，看核查结果。</small></div>
          <div><button type="button" disabled={run.money < 60} onClick={() => update(r => chooseInventory(r, "replace"))}>补2份赠品（¥60）</button><small>个人支出¥60，只补一次，不占准备；原2份第6天追回，最多4份。{run.money < 60 ? "现在的钱不够。" : ""}</small></div>
          <div><button type="button" onClick={() => update(r => chooseInventory(r, "report"))}>交给罗曼登记</button><small>不花钱、不占准备；第6天公示并追回。</small></div>
        </div>
        <small>不选也按正常交接往下走，可以直接选能力下班。</small>
      </> : <StaffLine who={gifts.choice === "trace" ? "suman" : "roman"}>
        {gifts.choice === "trace" ? "明天一起核对。先占用一天准备时间，把事情查明白。" : gifts.choice === "replace" ? `你补的两份已记好，个人支出${money(gifts.expense)}。原来的两份我继续追。` : "登记好了，你明天照常准备，核查由我来。"}
      </StaffLine>}
    </> : <>
      {evidence ? <StaffLine who="roman">{evidence}</StaffLine> : <p>罗曼还在核对交接。没查清之前，不拿传言定人。</p>}
      <p role="status">{gifts.recovered ? "原来的2份已追回，已入库一次；这里显示的是扣除已送赠品后的余量。" : evidence ? "证据已核实，原来的2份还在追还。" : "原来的2份尚未追回。"}</p>
      {preparationBlocked(run) && <small>今天查交接占用了准备机会：不能预约，也不能请唐可支援；正常谈单不受影响。</small>}
    </>}
  </section>;
}

function awardComparison(run: Run): string {
  const award = run.chapter!.award!;
  if (award.score !== TANGKE_BID.score) return `你 ${award.score} 分，唐可 ${TANGKE_BID.score} 分，相差 ${Math.abs(award.score - TANGKE_BID.score)} 分；先按总分决定。`;
  if (award.profit !== TANGKE_BID.profit) return `同为 ${award.score} 分，你的两张单${award.profit > TANGKE_BID.profit ? "多" : "少"}赚 ${money(Math.abs(award.profit - TANGKE_BID.profit))}。`;
  return `同为 ${award.score} 分、${money(award.profit)}；唐可先报名，同分同钱由她优先。`;
}

function AwardSummary({ run }: { run: Run }) {
  const award = run.chapter!.award!;
  const receipts = award.receiptIds.map(id => run.history.find(r => r.id === id)).filter((r): r is Receipt => !!r);
  return <>
    <b>{award.won ? "周末主理，这次由你来" : "这次主理的位置归唐可"}</b>
    <p>你 {award.score} 分 · {money(award.profit)}　|　唐可 {TANGKE_BID.score} 分 · {money(TANGKE_BID.profit)}</p>
    <p>{awardComparison(run)}{!award.won && " 没拿到主理也能继续正常营业。"}</p>
    <details className="c-details"><summary>核对得分与单据（{award.receiptIds.length}张）</summary><BidReceipts receipts={receipts} />
      <small>这里只决定周末主理，不代表七天净收益联赛胜出；联赛仍按七天总账与信誉结算。</small>
    </details>
  </>;
}

export function ChapterAward({ run, update }: Props) {
  const chapter = run.chapter;
  if (!chapter?.award || run.experiment || run.phase !== "select" || run.turn !== 0) return null;
  const canChoose = run.day === 6 && !chapter.format;
  const helped = run.history.some(r => r.support?.kind === "team");
  return <section className="c-chapter" data-testid="chapter-award" aria-label="周末主理公示">
    <span className="c-eyebrow">周末主理 · 公示</span>
    <AwardSummary run={run} />
    <StaffLine who="tangke">{helped ? "帮你试货归帮你试货，主理我也报名争了。" : "我也交了单子，这个位置得各凭本事。"}{chapter.award.won ? "这回你来，我看看你怎么做。" : "这回我来，你的柜台照常开，别松劲。"}</StaffLine>
    {chapter.award.won && <div data-testid="chapter-format" className="c-chapter-format">
      {chapter.format ? <p role="status">已定方案 · {chapter.format === "consult" ? "预约详谈：第6–7天每笔接待多1次交谈。" : "演示专场：第6–7天每天一次不耗交谈的试用，仍用1份小样，不分账。"}</p> : canChoose ? <>
        <b>周末打法，现在选一个</b>
        <div className="c-chapter-actions">
          <div><button type="button" onClick={() => update(r => chooseShowcaseFormat(r, "consult"))}>预约详谈</button><small>第6–7天，每笔接待多1次交谈。</small></div>
          <div><button type="button" onClick={() => update(r => chooseShowcaseFormat(r, "demo"))}>演示专场</button><small>第6–7天每天一次不耗交谈的试用，仍用1份小样。</small></div>
        </div>
        <small>只在今天开柜前选一次；开始接客后不再补选。</small>
      </> : <p>昨天开柜前没有选定方案，今天照常接客，不补发专场加成。</p>}
    </div>}
  </section>;
}

export function ChapterReceipt({ run }: { run: Run }) {
  if (!run.chapter || run.experiment || !run.receipt) return null;
  const receipt = run.receipt;
  if (!receipt.support && !receipt.gift) return null;
  return <section className="c-chapter" data-testid="chapter-receipt" aria-label="本单搭班与赠品账">
    {receipt.support && <>
      <b>{receipt.support.kind === "team" ? "这单搭班的钱，分清楚" : "演示专场 · 不分账"}</b>
      <p>你 {money(receipt.profit)} + 同事分成 {money(receipt.support.partnerShare)} = 分账前收益 {money(receipt.support.grossProfit)}（含奖金）。</p>
      <small>{receipt.outcome === "sold" ? "比分只加你实际留下的净收益。" : "这单没成交，没有分成。"}试用证明的是{productName(receipt.support.productId)}{receipt.productId !== receipt.support.productId ? `，最后报价的是${productName(receipt.productId)}` : ""}。</small>
      {receipt.support.kind === "team" && <StaffLine who="tangke">{receipt.outcome === "sold" ? "这笔搭得不错。钱分明白，主理的位置还是各凭本事。" : "没卖成就不分你的钱。下一笔还得重新看客人。"}</StaffLine>}
    </>}
    {receipt.gift && <p>{receipt.outcome === "sold" ? "已送出1份赠品，额外关系+1已计入本单。" : "这单没成交，赠品不扣库存。"}</p>}
  </section>;
}

export function ChapterRecap({ run, total = false }: { run: Run; total?: boolean }) {
  const chapter = run.chapter;
  if (!chapter || run.experiment) return null;
  const receipts = total ? run.history : run.history.filter(r => r.day === run.day);
  const player = receipts.reduce((sum, r) => sum + r.profit, 0);
  const partner = receipts.reduce((sum, r) => sum + (r.support?.partnerShare ?? 0), 0);
  const gross = receipts.reduce((sum, r) => sum + (r.support?.grossProfit ?? r.profit), 0);
  const expense = total || run.day === 3 ? chapter.gifts.expense : 0;
  const teamwork = receipts.filter(r => r.support?.kind === "team");
  const evidence = inventoryEvidence(run);
  const tangke = teamwork.length ? teamwork.some(r => r.outcome === "sold") ? total ? "搭班的钱都分清了。帮你归帮你，主理我也真争了。" : "搭班的钱分清了，周末的位置可不白让。" : "试过但没卖成，就不分你的钱。下次重新看。"
    : chapter.plan === "solo" ? total ? "这轮你选了自己谈，咱们各凭本事。" : "你选了自己谈，那就各凭本事争这个位置。"
    : chapter.plan === "team" && !total && preparationBlocked(run) ? "今天你忙着查交接，搭班的事明天再说。"
    : chapter.plan === "team" && run.day >= 2 && (total || run.day <= 5) ? "约好了搭班，你没叫我试货也行，按你的节奏来。"
    : "主理我也报了名，拿单子说话。";
  return <section className="c-chapter" data-testid="chapter-recap" aria-label={total ? "章节结果与七天账目" : "今日搭班账目"}>
    <span className="c-eyebrow">{total ? "七天总账 · 按真实单据" : "收柜小账 · 按今天的单据"}</span>
    <dl className="c-chapter-ledger">
      <div><dt>你的成交净收益</dt><dd>{money(player)}</dd></div>
      <div><dt>唐可分成</dt><dd>{money(partner)}</dd></div>
      <div><dt>补赠品支出{total && expense > 0 ? "（第3天）" : ""}</dt><dd>−{money(expense)}</dd></div>
      <div className="c-chapter-ledger-total"><dt>{total ? "本轮你实际留下" : "今天你实际留下"}</dt><dd>{money(player - expense)}</dd></div>
    </dl>
    <small>你 {money(player)} + 同事 {money(partner)} = 分账前 {money(gross)}（含奖金）。补赠品支出另扣，比分不包含同事分成。</small>
    <StaffLine who="tangke">{tangke}</StaffLine>
    {total && <div className="c-chapter-result">
      <span className="c-eyebrow">章节回顾 · 不重复发放奖励</span>
      {chapter.award ? <><AwardSummary run={run} />{chapter.award.won && <p>{chapter.format === "consult" ? "你选了预约详谈，第6–7天每笔多1次交谈。" : chapter.format === "demo" ? "你选了演示专场，第6–7天每天一次不耗交谈的试用。" : "你拿到了主理机会，但没有选定专场方案。"}</p>}</> : <p>这轮没有主理公示结果，不能算作拿到主理机会。</p>}
      {chapter.gifts.opened && <><p>{evidence ?? "赠品交接还没查清，没有核实的原因不作结论。"}</p><p>{chapter.gifts.recovered ? "原2份赠品已追回，不重复入库。" : "原2份赠品尚未追回。"}剩余 {chapter.gifts.stock} 份。</p></>}
    </div>}
  </section>;
}

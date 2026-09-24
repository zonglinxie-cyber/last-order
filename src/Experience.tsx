import { useEffect, useRef, type ReactNode } from "react";
import { CUSTOMERS, DAYS, demandBudgetWord, ENERGY_LOCK, consultationRecord, fitPreview, PRODUCTS, QUESTIONS, relationText, TOUCHES_PER_EVENING, TRAIT_LABELS, type Campaign, type CustomerId } from "../dynamic-counter-prototype/src/campaign";
import { asset } from "./sim/asset";

// Presentation only: money, patience and story consequences stay in campaign.ts.
export const CHAPTER_HOOKS = [
  { speaker: "罗曼 · 柜长", line: "五天，两万一。数字留下来，你才能留下来。", question: "第一笔单，你要赢过对手，还是赢得信任？" },
  { speaker: "唐可 · 同期新人", line: "她上午先找的是我。你不能只算最后刷卡的那个人。", question: "少一点业绩，能不能换来一个盟友？" },
  { speaker: "赵女士 · 顾客", line: "东西不是给我的。你能不能替我多想一步？", question: "当总部要数字，而顾客要安全，你站哪边？" },
  { speaker: "苏蔓 · 前辈", line: "安姐跟了我三年。这次我把她交给你。", question: "最大的一单，也可能是最贵的一次代价。" },
  { speaker: "方敏 · 合规", line: "别急着解释。把这五天的记录拿给我。", question: "灯灭之前，所有人情都要对账。" },
];

export function ChapterTrack({ day }: { day: number }) {
  return <ol className="chapter-track" aria-label="五日章节">{DAYS.map(chapter => <li key={chapter.day} aria-current={chapter.day === day ? "step" : undefined} className={chapter.day < day ? "complete" : ""}><span>{String(chapter.day).padStart(2, "0")}</span><b>{chapter.title}</b></li>)}</ol>;
}

export function GameDialog({ title, onClose, returnFocus, children }: { title: string; onClose: () => void; returnFocus?: HTMLElement | null; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = returnFocus ?? document.activeElement as HTMLElement | null;
    const root = panel.current;
    root?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab" || !root) return;
      const elements = [...root.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input, summary, [tabindex='0']")].filter(el => el.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop"><section ref={panel} role="dialog" aria-modal="true" aria-label={title} className="experience-dialog"><header><div><span className="eyebrow">LAST ORDER / 值班记录</span><h2>{title}</h2></div><button onClick={onClose} aria-label="关闭弹窗">关闭 ×</button></header>{children}</section></div>;
}

export function ShiftHandbook({ game, onRestart }: { game: Campaign; onRestart: () => void }) {
  return <div className="handbook-body">
    <section><h3>不是把东西卖出去，是让人愿意回来。</h3><p>你是许愿，试用期的最后五天。目标是 ¥21,000，但合规与信任也会改变结局。先点人物了解情况，再决定接待谁。</p></section>
    <div className="handbook-rules"><section><b>01 / 时间是成本</b><p>现场 1× 每 20 秒走一分钟；接待时阅读不倒计时。首次观察、每次提问、每次试用各消耗一分钟，连带按你开口要的件数计时（要四件就是四分钟）。其他顾客仍会等待或离开。重复看线索免费。她开始往中庭那边挪的时候有两条路：让苏蔓替你留人（要之前的人情，一班一次），或自己端着试用装迎上去（一支小样、离柜两分钟，从另一位的耐心上扣，同一个人整周只迎一次）——两条都只能救一个，另一个人的分钟照旧在走。</p></section><section><b>02 / 判断有后果</b><p>先观察两处，再问、再试。她没被问出来的要求，照样决定这单成不成——手记只会显示你已经掌握的那几条。不合适可以换款（试用后换款花 5 体力）或接受拒绝；小样不改变适配，强推会在后面几天退货。</p></section><section><b>03 / 连带不是白给的</b><p>成交后她带走几件，看你判断得准不准，也受她的预算和用量上限约束；多要一件就多占一分钟现场时间，另一边的人可能就走掉了。方向勉强时她只拿一件。陆遥参与成交你只拿一半；体力低于 {ENERGY_LOCK} 就不能再接新人，结账前看清实际入账。每一单按下的「登记我的接待」都会在本子里多写一行，第 5 天晚上你要摊开的就是这本子。</p></section><section><b>04 / 晨会念的是累计</b><p>两万一是按天分下来的。每天早上罗曼会念一遍：到昨天为止这个柜位该做到多少，你账上实际有多少。连续掉队，柜位会被写进评估表——第 5 天晚上她当面问的就是这件事。</p></section><section><b>05 / 品牌在数两样东西</b><p>小样发出去才算派样率，压在柜后巡店当天会盘出来；企微名单是明年还在找你的人。加微信要先有接触（留过小样或刚接完这一单），占一分钟现场时间。加过粉又真在你这儿成过单的人，最后一天会在微信上自己补一支。但她回来不靠名单靠跟进：闭店之前每晚只有 {TOUCHES_PER_EVENING} 句跟进，同一个人整周只跟一次，没跟过的那条线后面什么都不会发生。</p></section></div>
    <section><h3>商品备忘 · 不是标准答案</h3><div className="handbook-products">{Object.values(PRODUCTS).map(product => <article key={product.name}><b>{product.name}</b><span>¥{product.price.toLocaleString("zh-CN")}</span><p>{product.note}</p></article>)}</div><small>游戏采用简化的美妆判断，不构成护肤或医疗建议。自由输入使用本地剧本规则，不是真实 AI 对话。</small></section>
    <section><h3>你和柜台的关系</h3><div className="relationship-notes">{([['suman', '苏蔓'], ['tangke', '唐可'], ['luyao', '陆遥'], ['roman', '罗曼']] as const).map(([id, name]) => <div key={id}><img src={asset(`assets/aurora/${id}.png`)} alt="" /><span><b>{name}</b><small>{relationText(game.relations[id])}</small></span></div>)}</div></section>
    <section><h3>已经发生的事</h3>{game.history.length ? <ol className="handbook-history">{game.history.slice().reverse().map((entry, i) => <li key={i}><small>DAY {entry.day}</small>{entry.text}</li>)}</ol> : <p>账本还是空的。第一笔记录，由你写。</p>}</section>
    <footer><p>进度仅保存在这个网址的本机浏览器。关闭手册后现场仍暂停，可手动恢复倍速。</p><button className="risk-button" onClick={onRestart}>重新开始这五天</button></footer>
  </div>;
}

// Rotate positions without changing original rule indices or revealing useful answers.
export function questionChoices(id: CustomerId) {
  const choices = QUESTIONS[id].map((question, index) => ({ ...question, index }));
  const offset = Object.keys(CUSTOMERS).indexOf(id) % choices.length;
  return [...choices.slice(offset), ...choices.slice(0, offset)];
}

// 信息不对称的界面表达：只有问出来或看出来的诉求才用她的原话念出来，没问到的只说条数。
export function DemandBoard({ game }: { game: Campaign }) {
  const session = game.activeSession;
  if (!session) return null;
  const customer = CUSTOMERS[session.customerId];
  const preview = fitPreview(customer, session.revealed);
  const record = consultationRecord(customer, session.discovered, session.revealed, session.tested);
  return <div className="demand-board">
    <span className="eyebrow">她要什么</span>
    {preview.known.map(demand => <p key={demand.trait}><b>{TRAIT_LABELS[demand.trait]}</b><i className={"weight w" + demand.weight}>{"●".repeat(demand.weight)}</i></p>)}
    {record.blind && <p className="demand-blind">{record.blind}</p>}
    {record.veto && <p className="demand-veto"><b>底线</b>{record.veto}</p>}
    {/* 她的预算与上限全场只在这块念一次；连带那一行念的是多出来的那一分钟买的是什么。措辞由 campaign.ts 一处出。 */}
    <p className="demand-budget">{demandBudgetWord(customer)}</p>
  </div>;
}

// 手记是玩家自己的本子：它说「问没问过」，不再摆 2 条线索 · 1 次问答这样的计数。
export function ConsultationNotes({ game }: { game: Campaign }) {
  const session = game.activeSession;
  if (!session) return null;
  const customer = CUSTOMERS[session.customerId];
  const asked = session.chat.filter(line => line.role === "customer").length;
  return <details className="consultation-notes" key={session.customerId}><summary>接待手记 <span>{asked ? `她答了 ${asked} 句` : "还没开口问"}</span></summary><div>
    {session.discovered.map(id => <p key={id}><b>{customer.cues[id].label}</b>{customer.cues[id].finding}</p>)}
    {session.chat.map((line, index) => <p key={index} className={line.role}><b>{line.role === "player" ? "你问" : customer.name}</b>{line.text}</p>)}
    {!session.discovered.length && <p>先观察。只有实际发现的线索才会记在这里。</p>}
  </div></details>;
}

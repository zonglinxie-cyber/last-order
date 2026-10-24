// 每周一关的三块界面：楼层页顶那条进度、周日打烊那一屏的结算、季末那一排四关战绩。
// 判据全在 target.ts，这里只摆。
import { rivalNameOf } from "../branches.ts";
import {
  CARE_DAYS_MIN, CARE_STEPS, GUARD_RATE_STEPS, GUARD_STEPS, ROUTE_WORD, SEASON_WEEKS, WEEK_EXCEED_RATE, WEEK_HIT_STANDING, WEEK_STARS_MAX,
  routeFromCode, seasonStarsOf, starWords, nextWeekHint, weekGoalTail, weekGoalWord, weekLevelWord, weekMadeKey, weekMoneyOf, weekRivalKey,
  weekCareCountKey, weekCareNearOf, weekCarePeople, weekGuardedPeople, weekResultOf, weekRivalOf, weekRouteKey, weekStarsKey, weekStarsOf, weekTargetOf, weekTargetOfWeek,
} from "../target.ts";
import { WEEK_RULES, weekRuleOf } from "../weeks.ts";
import type { World } from "../types.ts";
import { rivalBookingSlots, RIVAL_INVITE_ENERGY, RIVAL_INVITE_SAMPLES } from "../rival-business.ts";
import { currentWeekendOrder } from "../weekend-orders.ts";
import { SLOT_WORD } from "./words.ts";
import { PEOPLE } from "../content/index.ts";
import { BottomSheet, MobileScroll } from "../../mobile";

const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
const starRow = (n: number) => "★".repeat(n) + "☆".repeat(WEEK_STARS_MAX - n);

const nextStep = (count: number, steps: readonly number[]) => steps.find(x => count < x) ?? steps[steps.length - 1]!;
const nameOf = (id: string) => PEOPLE.find(p => p.id === id)?.name ?? id;
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** 守客每颗星的说法：人数之外，高星还要挡住足够比例的公开威胁（比例 0 的那颗不提）。 */
const guardStepWords = GUARD_STEPS.map((n, i) => `守客 ${n} 位不同客人${GUARD_RATE_STEPS[i] ? ` · 挡住 ${pct(GUARD_RATE_STEPS[i])} 威胁` : ""}`);
/** 守客下一颗星差什么：人数够了但挡住的比例没到，就把比例亮出来，不让玩家对着「5/5」干着急。 */
const guardNextWord = (guard: number, stars: number, rate: number) => {
  const i = Math.min(stars, GUARD_STEPS.length - 1);
  const short = guard >= GUARD_STEPS[i]! && rate < GUARD_RATE_STEPS[i]!;
  return `${guard}/${GUARD_STEPS[i]}位${short ? ` 挡${pct(rate)}/${pct(GUARD_RATE_STEPS[i]!)}` : ""}`;
};
const RIVAL_NAME = PEOPLE.find(p => p.role === "rival")?.name ?? "对面";

/** 三条线各自眼下到哪：页顶那排、帮助面板、对账屏没过时那三行都读这一份。 */
function routeLines(world: World) {
  const r = weekResultOf(world);
  const guardNext = guardNextWord(r.guard, r.guardStars, r.guardRate);
  return [
    { route: "sales" as const, stars: r.sales.stars, ratio: r.made / r.target,
      short: `业绩 ${yuan(r.made)}/${yuan(r.target)}`, gap: r.made >= r.target ? "" : `业绩差 ${yuan(r.target - r.made)}` },
    { route: "care" as const, stars: r.careStars, ratio: r.care / CARE_STEPS[0],
      short: `客情 ${r.care}/${nextStep(r.care, CARE_STEPS)}位`, gap: r.careStars ? "" : `客情差 ${CARE_STEPS[0] - r.care} 位` },
    { route: "guard" as const, stars: r.guardStars, ratio: r.guard / GUARD_STEPS[0],
      short: `守客 ${guardNext}`, gap: r.guardStars ? "" : `守客差 ${GUARD_STEPS[0] - r.guard} 位` },
  ];
}

/** 没过关时三条各差多少，打烊小结那一格用；已过关返回 null。 */
export const weekGapWord = (world: World): string | null =>
  weekResultOf(world).stars ? null : routeLines(world).map(x => x.gap).join(" · ");

/** 楼层页顶下面那一条：第几关、领先那条线到哪了、三条线各差多少；点开看每条线怎么算。 */
export function GoalStrip({ world, lit, bump, onOpen }: { world: World; lit: boolean; bump: string | null; onOpen: () => void }) {
  const made = weekMoneyOf(world), rival = weekRivalOf(world), target = weekTargetOf(world.day, world.season);
  const live = weekResultOf(world);
  const lines = routeLines(world);
  // 没过关时进度条跟离门槛最近的那条线；同比例先业绩、再客情、再守客。
  const track = live.stars ? live.route : lines.reduce((a, b) => b.ratio > a.ratio ? b : a).route;
  const [current, first, third] = track === "sales" ? [made, target, Math.ceil(target * WEEK_EXCEED_RATE)]
    : track === "care" ? [live.care, CARE_STEPS[0], CARE_STEPS[CARE_STEPS.length - 1]!]
    : [live.guard, GUARD_STEPS[0], GUARD_STEPS[GUARD_STEPS.length - 1]!];
  const pct = Math.max(0, Math.min(100, current / third * 100));
  const mark = first / third * 100;
  const progressWord = track === "sales" ? weekGoalWord(world)
    : track === "care" ? `客情 ${live.care} / ${nextStep(live.care, CARE_STEPS)} 位`
    : `守客 ${guardNextWord(live.guard, live.guardStars, live.guardRate)}`;
  const upcoming = rivalBookingSlots(world).filter(slot => slot > world.slot);
  const weekend = currentWeekendOrder(world);
  const ownWeekend = !!weekend?.prepared && !weekend.outcome && weekend.due === world.day;
  const rivalTimes = upcoming.filter(slot => !(slot === 3 && ownWeekend)).map(slot => SLOT_WORD[slot]);
  const plans = [rivalTimes.length ? `对面${rivalTimes.join("、")}约客` : "",
    // 周末那一单是玩家自己的安排：对面排不排单都得提醒。
    ownWeekend && world.slot < 3 ? "晚高峰接周末约单" : ""].filter(Boolean).join("；");
  const schedule = (world.slot === 0 || world.slot === 2) && plans ? `接下来：${plans}` : "";
  return <button type="button" className={`world-goal${live.stars ? " is-passed" : ""}${lit ? " is-hit" : ""}`}
    aria-label={`本周目标：${weekLevelWord(world)}，${lines.map(x => x.short).join("，")}。${schedule ? `${schedule}。` : ""}点开看三条过关线`} onClick={onOpen}>
    <span className="wg-row">
      <b className="world-week">{weekLevelWord(world)}</b>
      <span className={`wg-tail${rival > made ? " is-trail" : made > 0 ? " is-lead" : ""}`}>{weekGoalTail(world)}</span>
    </span>
    <span className="wg-track" aria-hidden="true">
      <i style={{ width: `${pct}%` }} />
      <s style={{ left: `${mark}%` }} />
    </span>
    <span className="wg-row wg-foot">
      <span className="wg-money">{progressWord}{bump ? <em className="wg-bump">{bump}</em> : null}</span>
      <span className="wg-stars">{live.stars ? `${ROUTE_WORD[live.route]} ${starRow(live.stars)}` : "任选一线过关"}</span>
    </span>
    <span className="wg-routes">
      {lines.map(x => <span key={x.route} className={`${x.stars ? "done" : ""}${x.route === track ? " is-track" : ""}`}>
        {x.stars ? "✓" : ""}{x.short}</span>)}
      <span className="wg-more" aria-hidden="true">›</span>
    </span>
    {schedule && <span className="wg-schedule">{schedule}</span>}
  </button>;
}

/** 点页顶那条弹出来：三条线各怎么算、眼下到哪、这周已经记上的是谁。周日只取最好的一条。 */
export function RoutesSheet({ world, onClose, onHistory }: { world: World; onClose: () => void; onHistory?: () => void }) {
  const rivalName = rivalNameOf(world);
  const live = weekResultOf(world);
  const lines = routeLines(world);
  const cared = weekCarePeople(world).map(nameOf), guarded = weekGuardedPeople(world).map(nameOf);
  const near = weekCareNearOf(world);
  const [sales, care, guard] = lines;
  const bookingSlots = rivalBookingSlots(world);
  const busyWeek = weekRuleOf(world.season, world.day) === "rival-off";
  const head = (x: typeof sales) => <h3><b>{ROUTE_WORD[x.route]}线 {starRow(x.stars)}</b><span>{x.short}</span></h3>;
  // 用现成的 BottomSheet：Escape、焦点圈定、下滑关闭都是它的；正文在 MobileScroll 里滚，320×568 也够得着「知道了」。
  return <BottomSheet open title="三条过关线" description={`${weekLevelWord(world)} · 任选一条到线就过关`} snap={0.86}
    onOpenChange={open => { if (!open) onClose(); }}>
    <div className="world-routes">
      <MobileScroll className="routes-scroll">
        <ul className="routes-summary" aria-label="三条线一览">
          {lines.map(x => <li key={x.route} className={x.stars ? "done" : ""}>
            <b>{ROUTE_WORD[x.route]}</b><span>{x.short}</span><em>{starRow(x.stars)}</em>
          </li>)}
        </ul>
        <ul className="routes-list">
          <li className={sales.stars ? "done" : ""}>{head(sales)}
            <p>本周进账到 {yuan(live.target)} 过关；比{RIVAL_NAME}多一颗星；到 {yuan(Math.ceil(live.target * WEEK_EXCEED_RATE))} 再一颗。</p>
            <small>{RIVAL_NAME}本周 {yuan(live.rival)}</small></li>
          <li className={care.stars ? "done" : ""}>{head(care)}
            <p>本周在 {CARE_DAYS_MIN} 个不同的日子亲自为同一位客人办过实事（送小样、介绍熟人、打圆场、加微信、替人保密或对症成交），而且到对账时仍信得过你，就记一位。关系掉回去会被划掉；托同事照看不算；同一人一周只算一次。</p>
            <small>{CARE_STEPS.join(" / ")} 位各一颗星{cared.length ? ` · 已记：${cared.join("、")}` : ""}{near ? ` · 还差一天 ${near} 位（下周从头记两天）` : ""}</small></li>
          <li className={guard.stars ? "done" : ""}>{head(guard)}
            <p>{RIVAL_NAME}每个时段开场公开目标，页顶亮出名字和手法。首季第一周只盯一位，此后最多同时盯两位，先顾谁由你决定。招揽：本时段接待或托同事照看就接住；比货：要亲自对症成交。时段结束逐人结算，同一人一周只算一次。</p>
            <small>{guardStepWords.join("；")}</small>
            <small className="routes-rate">按客人逐个计，本周公开威胁 {live.guardThreats} 人次，挡住 {live.guardStops} 人次{live.guardThreats ? `（${pct(live.guardRate)}）` : ""}{guarded.length ? ` · 已记：${guarded.join("、")}` : ""}</small></li>
        </ul>
        <section className="routes-booking" aria-label="对面的约客安排">
          <h3>对面也在约客</h3>
          <p>{busyWeek ? "这周对面忙着整理客情：每天只在午后约一位客人，晚高峰她不排单。"
            : bookingSlots.length ? `每天${bookingSlots.map(slot => SLOT_WORD[slot]).join("、")}各有一次约客机会。`
            : "首季第一周先熟悉柜台；从第 8 天起，每天午后、晚高峰各有一次约客机会。"}周末最后一单占用当晚这一场；提前确认过的周末客人直接来你柜前。</p>
          <p>客人到场才公开姓名和报价，本时段结束结账。邀来比货花 {RIVAL_INVITE_ENERGY} 精力、{RIVAL_INVITE_SAMPLES} 份小样，接待另花 12 精力；也可以把精力留给自己约好的客人。</p>
          <small>有空位、有合适客人才约得成；刚在任一家买过的客人先用完再来。不会挤掉你已约好的人。</small>
        </section>
        <p className="routes-foot">周日打烊只取星最多的一条：过关柜位 +{WEEK_HIT_STANDING}。</p>
        {onHistory && <button type="button" className="world-archive-entry" onClick={onHistory}>你和{rivalName}的交锋战绩</button>}
      </MobileScroll>
      <button className="routes-close" type="button" onClick={onClose}>知道了</button>
    </div>
  </BottomSheet>;
}

/** 周日打烊那一屏顶上的结算：过没过、几颗星、三颗星各自怎么来的、跟对面比、下一关要多少。 */
export function LevelResult({ world, day }: { world: World; day: number }) {
  const n = Math.min(SEASON_WEEKS, Math.floor((day - 1) / 7) + 1);
  const made = world.qualities[weekMadeKey(n)] ?? 0;
  const rival = world.qualities[weekRivalKey(n)] ?? 0;
  const target = weekTargetOfWeek(world.season, n);
  const s = weekStarsOf(made, rival, target);
  const stars = world.qualities[weekStarsKey(n)] ?? s.stars;
  const route = routeFromCode(world.qualities[weekRouteKey(n)] ?? 1);
  const scored = weekResultOf({ ...world, day });
  const near = weekCareNearOf({ ...world, day });
  // 客情人数按当下信任动态过滤；对账那一刻冻结的人数才是这一关真正算的数（旧档没有就退回现算）。
  const care = world.qualities[weekCareCountKey(n)] ?? scored.care;
  const passed = stars > 0;
  const rule = WEEK_RULES.find(r => r.id === weekRuleOf(world.season, day));
  // 过了：列获胜那条线的三颗星各怎么来；没过：三条线各到哪，玩家知道下周离哪条最近。
  const words = !passed ? [`业绩 ${yuan(made)} / ${yuan(target)}`, `客情 ${care} / ${CARE_STEPS[0]} 位`, `守客 ${scored.guard} / ${GUARD_STEPS[0]} 位`]
    : route === "sales" ? starWords(target)
    : route === "care" ? CARE_STEPS.map(x => `客情 ${x} 位不同客人`) : guardStepWords;
  const checks = !passed ? [false, false, false]
    : route === "sales" ? [s.hit, s.hit && s.beatRival, s.hit && s.exceeded]
    : route === "care" ? CARE_STEPS.map(x => care >= x)
    : GUARD_STEPS.map((x, i) => scored.guard >= x && scored.guardRate >= GUARD_RATE_STEPS[i]!);
  const max = Math.max(made, rival, 1);
  return <section className={`report-level ${passed ? "pass" : "fail"}`} aria-label={`第 ${n} 关结算`}>
    <p className="rl-eyebrow">第 {n} 关{rule ? ` · ${rule.word}` : ""}</p>
    <h1 className="rl-stamp">{passed ? "过关" : "没过"}</h1>
    {passed && <p className="rl-route">凭{ROUTE_WORD[route]}过关</p>}
    <p className="rl-stars" aria-label={`${stars} 颗星`}>{starRow(stars)}</p>
    <ul className="rl-checks">
      {words.map((word, i) => <li key={word} className={checks[i] ? "ok" : ""}>{checks[i] ? "✓" : "✗"} {word}</li>)}
    </ul>
    {near > 0 && <p className="rl-near" role="status">客情这周有 {near} 位只亲自照应过一天，没算进人数；下周要从头记两天。</p>}
    <div className="rl-versus">
      <p><span>你</span><i style={{ width: `${(made / max) * 100}%` }} /><b>{yuan(made)}</b></p>
      <p className="rival"><span>对面</span><i style={{ width: `${(rival / max) * 100}%` }} /><b>{yuan(rival)}</b></p>
    </div>
    <p className="rl-note">{passed ? `柜位 +${WEEK_HIT_STANDING} · 罗曼记了你一笔` : "罗曼记着这一周"}{n < SEASON_WEEKS ? ` · 下一关业绩线 ${yuan(weekTargetOfWeek(world.season, n + 1))}` : " · 这是这一季最后一关"}</p>
    <p className="rl-next" aria-label="下一周先改什么"><b>下一周先改什么</b>{nextWeekHint({ ...world, day })}</p>
  </section>;
}

/** 季末那一排：四关各几颗星、一季加起来多少、是不是新纪录。 */
export function SeasonLevels({ world, prevBest }: { world: World; prevBest: number | null }) {
  const stars = seasonStarsOf(world);
  const total = stars.reduce((a, b) => a + b, 0);
  const passed = stars.filter(x => x > 0).length;
  const record = prevBest !== null && total > prevBest;
  return <section className="recap-block recap-levels" aria-label="四关战绩">
    <h2>四关战绩</h2>
    <ol className="rl-season">
      {Array.from({ length: SEASON_WEEKS }, (_, i) => {
        const v = world.qualities[weekStarsKey(i + 1)];
        return <li key={i} className={v ? "pass" : "fail"}>
          <small>第 {i + 1} 关</small><b>{v === undefined ? "—" : starRow(v)}</b>
          <em>{v ? ROUTE_WORD[routeFromCode(world.qualities[weekRouteKey(i + 1)] ?? 1)] : yuan(world.qualities[weekMadeKey(i + 1)] ?? 0)}</em>
        </li>;
      })}
    </ol>
    <p className="rl-total">过了 {passed} / {SEASON_WEEKS} 关 · 一共 {total} / {SEASON_WEEKS * WEEK_STARS_MAX} 颗星
      {record ? <strong className="rl-record">新纪录</strong> : prevBest ? <small>（最好的一季 {Math.max(prevBest, total)} 颗）</small> : null}</p>
  </section>;
}

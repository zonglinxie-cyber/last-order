import { weekendPrepareBlock, weekendSponsors } from "../engine.ts";
import { BottomSheet, MobileScroll } from "../../mobile";
import { currentWeekendOrder, weekendReview, WEEKEND_RESULT, WEEKEND_SPONSOR_RESPONSE } from "../weekend-orders.ts";
import type { Person, PersonId, WeekendOrder, World } from "../types.ts";

export function WeekendReview({ order }: { order: WeekendOrder }) {
  const review = weekendReview(order);
  return review && <section className="weekend-review" aria-label="这一单怎么走到这里">
    <h3>这一单怎么走到这里</h3>
    {review.facts.map((line, i) => <p key={i}>{line}</p>)}
    <p className="weekend-lesson"><b>下次可以试试</b>{review.lesson}</p>
  </section>;
}

export function WeekendOrderSheet({ world, person, people, onPrepare, onClose }: {
  world: World; person: Person; people: Person[]; onPrepare: (sponsor?: PersonId) => void; onClose: () => void;
}) {
  const order = currentWeekendOrder(world);
  if (!order) return null;
  const block = weekendPrepareBlock(world);
  const sponsors = weekendSponsors(world, people);
  const sponsor = people.find(p => p.id === order.sponsor);
  return <BottomSheet open title={`周末最后一单 · ${person.name}`} description={`第 ${order.due} 天 · 晚高峰，收工前`}
    snap={0.78} onOpenChange={open => { if (!open) onClose(); }}>
    <div className="world-routes weekend-sheet">
      <MobileScroll className="routes-scroll">
        <div className="weekend-letter">
          <p>「周日晚上有空过来，想赶在收工前把这一单办好。」</p>
          {order.outcome ? <><h3>{WEEKEND_RESULT[order.outcome]}</h3>
            <p>{order.resolvedDay! < order.due ? "这一单提前有了结果，周末不用重复开单。" : "钱和人情已经按真实接待记账。"}之后会回来聊那次的事。</p>
            {sponsor && <p>{order.echoQueued ? `${sponsor.name}的回应：${WEEKEND_SPONSOR_RESPONSE[order.outcome].line}` : `${sponsor.name}周日打烊会听到朋友的感受，再决定这次是否介绍对了人。`}</p>}</>
            : order.prepared ? <><h3>时间已经确认</h3><p>{sponsor ? `${sponsor.name}已经替你牵线，花了 6 精力，没有用小样。` : "联系花的精力和小样已经记过。"}到时直接来你的柜前，接待另花 12 精力；买不买仍要靠推荐。</p>
              {sponsor && <p>这份介绍带着信任。接待得合适，{sponsor.name}更信你；勉强成交或硬推，会让介绍人失望。没买成不扣介绍人的信任。</p>}</>
            : <><h3>{sponsors.length ? "自己联系，或请熟客牵线" : "先安排，还是到时争取？"}</h3>
              <p>提前联系花 6 精力和 1 份小样，到时直接来你的柜前，晚高峰可多留一点劲照应别人。</p>
              <p>也可以先顾眼前的客人。没有提前确认，到时先去对面；仍能花同样资源邀来比货。</p>
              <p>到店再听清今天的需要。接待另花 12 精力，不保证成交；提前买好了就不再开第二单。</p></>}
          <WeekendReview order={order} />
          {!order.outcome && !order.prepared && block && <p role="status">{sponsors.length ? "自己联系：" : ""}{block}。</p>}
          {!order.outcome && !order.prepared && sponsors.length > 0 && <section className="weekend-sponsors" aria-label="请熟客牵线">
            <h3>也可以请熟客牵线</h3>
            <p>下面的人认识{person.name}，也信得过你。请一位帮忙同样花 6 精力，省下一份小样；时间确认后不能再换介绍人。</p>
            <p>接待得合适，介绍人更信你；勉强成交或硬推，会让介绍人失望。没买成不扣介绍人的信任。</p>
            {sponsors.map(p => {
              const reason = weekendPrepareBlock(world, p.id, people);
              return <div key={p.id}><button type="button" disabled={!!reason} onClick={() => onPrepare(p.id)}>
                请{p.name}牵线 · 6 精力</button>{reason && <small>{reason}</small>}</div>;
            })}
          </section>}
        </div>
      </MobileScroll>
      {!order.outcome && !order.prepared && <button className="routes-close weekend-prepare" type="button" disabled={!!block} onClick={() => onPrepare()}>提前联系 · 6 精力 + 1 小样</button>}
      <button className="routes-close weekend-close" type="button" onClick={onClose}>{order.prepared || order.outcome ? "回到楼层" : "先顾眼前的客人"}</button>
    </div>
  </BottomSheet>;
}

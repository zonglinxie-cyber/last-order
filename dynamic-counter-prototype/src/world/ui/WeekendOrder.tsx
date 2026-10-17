import { weekendPrepareBlock } from "../engine.ts";
import { BottomSheet, MobileScroll } from "../../mobile";
import { currentWeekendOrder, WEEKEND_RESULT } from "../weekend-orders.ts";
import type { Person, World } from "../types.ts";

export function WeekendOrderSheet({ world, person, onPrepare, onClose }: {
  world: World; person: Person; onPrepare: () => void; onClose: () => void;
}) {
  const order = currentWeekendOrder(world);
  if (!order) return null;
  const block = weekendPrepareBlock(world);
  return <BottomSheet open title={`周末最后一单 · ${person.name}`} description={`第 ${order.due} 天 · 晚高峰，收工前`}
    snap={0.78} onOpenChange={open => { if (!open) onClose(); }}>
    <div className="world-routes weekend-sheet">
      <MobileScroll className="routes-scroll">
        <div className="weekend-letter">
          <p>「周日晚上有空过来，想赶在收工前把这一单办好。」</p>
          {order.outcome ? <><h3>{WEEKEND_RESULT[order.outcome]}</h3>
            <p>{order.resolvedDay! < order.due ? "这一单提前有了结果，周末不用重复开单。" : "钱和人情已经按真实接待记账。"}之后会回来聊那次的事。</p></>
            : order.prepared ? <><h3>时间已经确认</h3><p>到时直接来你的柜前。联系花的精力和小样已经记过，接待另花 12 精力；买不买仍要靠推荐。</p></>
            : <><h3>先安排，还是到时争取？</h3>
              <p>提前联系花 6 精力和 1 份小样，到时直接来你的柜前，晚高峰可多留一点劲照应别人。</p>
              <p>也可以先顾眼前的客人。没有提前确认，到时先去对面；仍能花同样资源邀来比货。</p>
              <p>到店再听清今天的需要。接待另花 12 精力，不保证成交；提前买好了就不再开第二单。</p></>}
          {!order.outcome && !order.prepared && block && <p role="status">{block}。</p>}
        </div>
      </MobileScroll>
      {!order.outcome && !order.prepared && <button className="routes-close weekend-prepare" type="button" disabled={!!block} onClick={onPrepare}>提前联系 · 6 精力 + 1 小样</button>}
      <button className="routes-close weekend-close" type="button" onClick={onClose}>{order.prepared || order.outcome ? "回到楼层" : "先顾眼前的客人"}</button>
    </div>
  </BottomSheet>;
}

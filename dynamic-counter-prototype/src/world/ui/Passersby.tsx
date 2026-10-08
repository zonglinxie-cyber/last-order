// 路人层：不能点、没有名字，只为了让商场看起来有人流。
// 位移和走路帧全在 CSS 里跑（transform + steps()），React 只在"补一个人"和"一个人走到头"
// 这两件事上改状态，所以每秒钟没有一次 setState。
// 节奏跟着时段走：上午三位、晚高峰六位，节日窗口再挤进来两位（数字在 zones.ts，走查钉那份）。
// 页面切到后台就把动画和补人都暂停；系统开了「减少动态效果」则整层不渲染。
import { useEffect, useState, type AnimationEvent, type CSSProperties } from "react";
import { PB_BASE, PB_FESTIVAL_EXTRA, PB_SPAWN_GAP, PB_VARIANTS, WALK_PATHS, pathSeconds, walkKeyframes } from "./zones.ts";
import type { Slot } from "../types.ts";
import "./passersby.css";

/** 一条通道 + 一个方向 = 一种走法；同一种走法场上只摆一个人。 */
const COMBOS = WALK_PATHS.flatMap((_, path) => [path * 2, path * 2 + 1]);

type Walker = {
  key: number;
  path: number;
  /** 倒着走一遍：通道倒过来走，人改成朝左 */
  reverse: boolean;
  variant: number;
  /** 走完这条通道要多少秒 */
  dur: number;
  /** 四帧走完一圈要多少秒 */
  step: number;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

let nextKey = 1;
const spawn = (live: Walker[]): Walker => {
  const free = COMBOS.filter(c => !live.some(w => w.path * 2 + (w.reverse ? 1 : 0) === c));
  const pool = free.length ? free : COMBOS;
  const combo = pool[Math.floor(Math.random() * pool.length)];
  const used = new Set(live.map(w => w.variant));
  const quiet = Array.from({ length: PB_VARIANTS }, (_, v) => v).filter(v => !used.has(v));
  const faces = quiet.length ? quiet : Array.from({ length: PB_VARIANTS }, (_, v) => v);
  const path = Math.floor(combo / 2);
  return {
    key: nextKey++, path, reverse: combo % 2 === 1,
    variant: faces[Math.floor(Math.random() * faces.length)],
    dur: pathSeconds(path) * rand(0.85, 1.2), step: rand(0.46, 0.62),
  };
};

/** 楼层上的人流层。slot/festival 决定摆几位，位移的 @keyframes 由 zones.ts 从通道坐标推出来。 */
export function Passersby({ slot, festival }: { slot: Slot; festival: boolean }) {
  const [walkers, setWalkers] = useState<Walker[]>([]);
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReduced(media.matches);
    const onVisibility = () => setVisible(document.visibilityState !== "hidden");
    media.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const target = reduced ? 0 : PB_BASE[slot] + (festival ? PB_FESTIVAL_EXTRA : 0);

  // 人不够就过一会儿补一个；后台里不补，回到前台这条 effect 会因为 visible 变化重排。
  useEffect(() => {
    if (!visible || walkers.length >= target) return;
    const timer = window.setTimeout(
      () => setWalkers(live => (live.length >= target ? live : [...live, spawn(live)])),
      rand(PB_SPAWN_GAP.min, PB_SPAWN_GAP.max));
    return () => window.clearTimeout(timer);
  }, [visible, walkers, target]);

  // 走到头就下场，过一会儿换个人、换条路再来
  const done = (key: number) => (event: AnimationEvent<HTMLSpanElement>) => {
    if (!event.animationName.startsWith("wf-pb-walk-")) return;
    setWalkers(live => live.filter(w => w.key !== key));
  };

  if (reduced) return null;

  return <div className={`wf-passersby${visible ? "" : " is-paused"}`} aria-hidden="true" data-testid="passersby">
    <style>{walkKeyframes}</style>
    {walkers.map(w => {
      const points = WALK_PATHS[w.path];
      const head = points[0];
      const tail = points[points.length - 1];
      const faceLeft = w.reverse ? tail.x > head.x : tail.x < head.x;
      // 元素钉在通道的 0% 那一头；倒着走交给 animation-direction: reverse（keyframes 从末点播回头）。
      return <span key={w.key} className="wf-pb" onAnimationEnd={done(w.key)} style={{
        left: `${head.x}%`,
        top: `${head.y}%`,
        animationName: `wf-pb-walk-${w.path}`,
        animationDuration: `${w.dur.toFixed(2)}s`,
        animationDirection: w.reverse ? "reverse" : "normal",
        "--pb-face": faceLeft ? -1 : 1,
      } as CSSProperties}>
        <i className={`wf-pb-figure pb-v${w.variant}`} style={{ animationDuration: `${w.step.toFixed(2)}s` } as CSSProperties} />
      </span>;
    })}
  </div>;
}

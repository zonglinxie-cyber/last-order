import { lazy, Suspense } from "react";
import { MobileRuntime } from "./mobile";

const WorldGame = lazy(() => import("./world/ui/WorldGame"));
const CounterGame = lazy(() => import("./world/counter/CounterGame"));
const redesignPreview = new URLSearchParams(window.location.search).get("design") === "counter";

export default function App() {
  return (
    <MobileRuntime>
      <Suspense fallback={<p role="status" style={{ padding: "80px 24px" }}>柜台正在开门…</p>}>
        {redesignPreview ? <CounterGame /> : <WorldGame />}
      </Suspense>
    </MobileRuntime>
  );
}

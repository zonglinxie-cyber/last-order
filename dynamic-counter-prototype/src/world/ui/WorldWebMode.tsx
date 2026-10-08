// ?mode=web 预览壳：只用 tests/fixtures/web-fixture.ts 渲染人情网，不接引擎、不读存档。
// 引擎（engine.ts）接线是下一轮的事，这一块的产物只有 WebView 与 PersonCard 两个展示组件。
import { WEB_PEOPLE, WEB_WORLD } from "../../../tests/fixtures/web-fixture.ts";
import { WebView } from "./WebView.tsx";

export default function WorldWebMode() {
  return <div className="app-screen web-mode-screen">
    <WebView world={WEB_WORLD} people={WEB_PEOPLE} />
  </div>;
}

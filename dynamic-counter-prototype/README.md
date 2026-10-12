# 最后一单 · 人情场（手机版）

移动端美妆专柜销售游戏：看 → 问 → 试 → 开单，一周一关，跟对面柜台比业绩，一层楼的人情记着你怎么待人。项目约定见上一级 `../AGENTS.md`，设计见 `../docs/人情场设计.md`。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173/`。桌面端显示手机预览框；触屏手机和安装后的 PWA 用全屏界面。

## 代码在哪

- `src/world/`：引擎（`engine.ts`）、接待（`consult.ts`）、每周一关（`target.ts`）、货架（`shelf.ts`）、内容（`content/`）、界面（`ui/`，入口 `ui/WorldGame.tsx`）。
- `src/mobile/`、`src/App.tsx`、`src/main.tsx` 等：手机外框运行时，受 `mobile-runtime.lock.json` 保护。

## 测试

```bash
npm run test:rules                                      # 规则单测
node --experimental-strip-types tests/world-sim.ts 20 2 # 模拟器
npx playwright test tests/world-floor.spec.ts --workers=1
npm run build
```

## 发布构建

`npm run build` 的静态客户端在 `dist/client/`，发布 Worker 在 `dist/server/`，带离线预缓存的 Service Worker。

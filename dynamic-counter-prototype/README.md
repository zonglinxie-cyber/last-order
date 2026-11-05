# 最后一单 · 人情场（手机版）

移动端美妆专柜销售游戏：看 → 问 → 试 → 开单，一周一关，跟对面柜台比业绩，一层楼的人情记着你怎么待人。项目约定见上一级 `../AGENTS.md`，设计见 `../docs/人情场设计.md`。

[手机在线试玩](https://zonglinxie-cyber.github.io/last-order/m/)（公网地址，无需同一局域网）。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173/`。桌面端显示手机预览框；触屏手机和安装后的 PWA 用全屏界面。

## 新设计试玩：七天争柜

**[公网试玩「七天争柜」](https://zonglinxie-cyber.github.io/last-order/m/?design=counter)**（GitHub Pages，手机流量可访问，无需同一局域网）。`main` 推送后由 `Deploy Pages` 自动发布，是否发布完成以对应 Actions 的成功结果为准。

本地启动后访问 **`http://127.0.0.1:5173/?design=counter`**。这是一版重新设计的独立玩法原型，不是旧系统继续叠功能：七天、每天三选二顾客、有限交谈与报价、利润竞争、熟客回访、每日三选一能力、五级差异联赛。

默认网址仍进原版；试玩使用独立存档，旧版进度与已有人物资产没有删除。这个隔离入口用于决定是否替换，不作为长期双版本方案。

```bash
npm run test:counter          # 新规则单测 + 默认口径手机流程
npm run sim:counter -- 20     # 20 种子 × 三种风格 × 有限信息/乱点对照
```

设计和实测边界见 `../docs/人情场设计.md` 的「主题重设计：七天争柜」节。

## 代码在哪

- `src/world/`：引擎（`engine.ts`）、接待（`consult.ts`）、每周一关（`target.ts`）、货架（`shelf.ts`）、内容（`content/`）、界面（`ui/`，入口 `ui/WorldGame.tsx`）。
- `src/world/counter/`：新版隔离原型；独立的 `types.ts` / `content.ts` / `engine.ts`，页面 `CounterGame.tsx` / `counter.css`，不引用旧世界规则。
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

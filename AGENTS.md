# 最后一单 · 项目约定

目标（用户原话）：「把这个游戏打造成最好玩的手机端销售游戏」，要丰满、有趣、能长期玩；要有过关感和胜负欲。

## 入口
- 游戏只有一个：「人情场」，在 `dynamic-counter-prototype/`，默认网址直接进（`?mode=world` 还认，但不再需要）。代码在 `src/world/`，数据契约是 `src/world/types.ts`。
- 设计文档：`docs/人情场设计.md`（系统与现状）、`docs/剧情主线设计.md`（主线与反转）、`docs/长线玩法提案.md`（一年以上的循环）。设计决定、数值推导、改动历史都写进这些文档，不写进本文件。
- 旧版（桌面沙盘、五日剧情、duel / run / match / blitz）2026-10-12 已整体删除，玩法搬进了人情场；要查旧代码去 git 历史（删除前最后一笔 `4601f8c`），旧约定原文在 `docs/旧版约定存档.md`，只作历史参考。

## 怎么跑（在 `dynamic-counter-prototype/` 下）
- 规则单测：`npm run test:rules`
- 模拟器：`node --experimental-strip-types tests/world-sim.ts 20 2`（20 种子 × 4 种打法 × 2 季，约 4 分钟）。改规则或内容以后，签名数不能降，也不能出现一种打法通吃。
- 楼层 e2e：`npx playwright test tests/world-floor.spec.ts --workers=1`；整季冒烟：`tests/world-season-smoke.spec.ts`（约 7 分钟）。
- **Playwright 用例一律用默认口径跑**（dev server 4174，`npm run test:runtime` 同款）。换成 preview 口径（`dist/`）时，service worker 的缓存名带内容哈希、`/tests/runtime-fixture.html` 也不在 `dist/` 里 —— 实测有 9 条会平白变红，看着像坏了，其实一条都没坏。判「有没有坏」必须用默认口径。
- 构建：`npm run build`。它只做 `src` 的类型检查，Playwright 用例要另外单独跑一次 `tsc`。
- 同一时间只跑一个 Playwright 套件，两个套件会互相停掉对方的资源服务器。本机预览绑定 `127.0.0.1`。

## 不要动
- `.env`：不读出、不提交里面的内容。
- 手机外框运行时（`src/mobile/`、`src/App.tsx`、`src/main.tsx` 等，清单在 `mobile-runtime.lock.json`）：为了真机体验可以改。改完运行 `npm run update:runtime-lock`，再跑 `npm run check:runtime`。不要为了让检查通过去删检查本身。
- 多个助手并行时，同一个文件同一时间只能有一个助手在改。分给你的范围以外的文件不要动。

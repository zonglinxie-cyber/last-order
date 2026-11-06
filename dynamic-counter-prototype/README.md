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

本地未发布版本的顾客已扩展为 **24 位、72 种来意**（不代表上述公网地址已更新）。新开的一轮前两天不重复顾客，之后每天至少两位新面孔；熟客隔天回访，每人一轮最多出现两次，回访换来意，卡片显示真实的上次接待记录。已保存的新版进度可以继续，不必清档。

同一本地入口现在带一个完整的“周末主理”章节：第1天听到唐可的消息后，可独立预约问预算、与唐可搭班，或不选；第2–5天的准备真实改变接待，搭班仍耗小样并分25%。第3天收柜只盘点周末预留赠品少了2份，可查交接、补货、登记或照常下班；原因预先固定，不根据玩家猜测改真相。第4–7天赠品只在成交时消耗；第6天用第2–5天最好两张真实成交单竞争主理，获胜后选择“预约详谈”或“演示专场”，实际影响最后两天。旧存档可续玩，不会回填章节；实验入口与普通入口的进度、战绩隔离。自然问答、独立销售笔记与苏蔓闲聊仍在。**这些均未提交、推送或发布；公网仍是此前的8位顾客原型。**章节已完成本地规则、模拟和手机流程验证，但尚无新版真人试玩，不代表长期留存已解决。

默认网址仍进原版；试玩使用独立存档，旧版进度与已有人物资产没有删除。这个隔离入口用于决定是否替换，不作为长期双版本方案。

```bash
npm run test:counter          # 章节/对白规则 + 默认口径手机流程
npm run sim:counter -- 20     # 20 种子 × 三种风格 × 有限信息/乱点对照
node --experimental-strip-types tests/counter-chapter-sim.ts 20  # 章节360局矩阵
node --experimental-strip-types tests/counter-chapter-sim.ts --probe # rank1/4探针
```

设计和实测边界见 `../docs/人情场设计.md` 的「主题重设计：七天争柜」节；章节取舍与验证见 `../docs/柜台职场生活提案-2026-11-06.md` 第10.10节及 `../audit/counter-chapter-2026-11-06/`。

### 本地研究入口：适配补贴（不默认开启）

启动开发服务器后访问 **`http://127.0.0.1:5173/?design=counter&experiment=fit-subsidy-v1`**。

- 第3、5、7天各一份30元指定商品补贴；须正常成交且商品能力满足主次需求门槛。不是强制活动，不符合补贴条件仍能按普通规则成交。
- 与普通版使用独立的进度和联赛纪录；不会把普通旧档自动变成实验档。页面有实验标签，收据及结果页分别列出补贴，避免重复记账。
- **暂不推荐加入正式玩法。** 360局整周对照中，60组考虑补贴的配对仅5组改变行为，35组只是同动作多拿钱；这不是更耐玩或留存提升的证明。
- 同一引擎的可选规则，不是第三套游戏。研究模拟器仅在 `tests/`，不打进客户端。本轮未提交、推送或部署。

```bash
node --experimental-strip-types --test tests/counter-subsidy.test.ts tests/counter-subsidy-sim.test.ts
node --experimental-strip-types tests/counter-subsidy-sim.ts 20
npx playwright test tests/counter-subsidy.spec.ts --workers=1
```

完整条件、反例和验证记录见 `../docs/人情场设计.md` 的「适配补贴独立实验（2026-11-06）」节。普通 `?design=counter` 不启用此规则。

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

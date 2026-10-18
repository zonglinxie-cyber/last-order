# 试用反馈独立复核（SWE-2 + 负责人整合）

对照 `cf8a317` 六文件的暂存差，以及工作区整合：`TRIED_MARK.perfect` 改为「认准了」、`restoreConsults` 要求 `typeof tier === "string"`、`world-floor.spec.ts` 接纳「认准了」、`world-trial-response.spec.ts` 截图与真实金额/关系。托单预览 99→100 定点看过。未开浏览器 / 服务器 / 全季模拟。

**结论：工作区整合后没有可复现的真实缺陷。** `TrialTier` 只留在接待格子与提示；结账仍走 `FitTier` 三档。梁夏粉底 2 件 1960/+8、粉霜 1 件 1180/+12 仍是旧账。看法 99 的托单预览现为 100，原世界不动。

探针：`/tmp/renqing-sales-grok-20261018/trial-probe.mts` → `trial-probe.json`（417ms）。针对性 `tests/world-consult.test.ts`：26/26 通过（187ms）。

验收对象是**工作区**（整合后）。暂存区仍是 SWE-2 原文案「点头认准了」和 `String(tier)`；收合并提交前要把整合 diff 加进暂存，否则会把已修的两处退回去。这不是玩法缺陷。

## 验收对照

### TrialTier 不进真实结算

`TrialTier = FitTier | "perfect"` 只出现在 `consult.ts` 的 `tried` / `TRIED_MARK` / `tryOn` / `restoreConsults`，以及 `ConsultPanel` 的 `tried-${tried}` 类名（`consult.ts` 29、49、273–275、307 行；`ConsultPanel.tsx` 135–138 行）。

`shelf.ts` 的 `FitTier` 仍是三档。`settleServe` / `shelfUnits` / `sales-feedback` 用 `shelfFitTier(score)` 与 `score >= PERFECT_MATCH`，不读 `consult.tried`（`engine.ts` 1474、1558–1559 行；`sales-feedback.ts` 20–22 行）。探针：梁夏不经试用直接 `settleServe`，账与试过后专项要的数相同。

### tryOn 只多记一格字

台词条件未改（269–272 行）。新行：`mark = !hitVeto && positive && score >= PERFECT_MATCH ? "perfect" : tier`，`matched` 改写为 `mark === "perfect"`，与旧 `!hitVeto && … >= PERFECT_MATCH` 等价。

梁夏：粉底记下 `positive`，耐心 4→3，mood 0，known 仍是 `["natural"]`，`matched` 仍假；粉霜记下 `perfect`，耐心 3→2，known/mood 不动，`matched` 变真。再试粉底返回同一对象。`spend` 仍只扣 1 句耐心。

### 未试货不泄 perfect

`offerEvidence` 无 `c.tried[id]` 时只说「还没试过」（344–345 行）。探针：面霜提示含「还没试过」，不含「点头 / 认准了」。格子未试行只出价格（`ConsultPanel.tsx` 138 行）。`consult-sim` 的 `rankProducts` / `pickOffer` / `runConsult` 不调用 `fitOfPerson`；`fitOfPerson` 只在测量用的 `fitInfo`（`consult-sim.ts` 147–184、200–211、310–324 行）。

### 旧档不升格，坏枚举拒绝

`restoreConsults` 不重算适配，只认字符串四档（375–376 行）。探针：粉霜存成 `"positive"` 回来仍是 `"positive"`，不因 fit=1 升成 perfect。`["perfect"]`、`"Perfect"`、对象档被拒（`world-consult.test.ts` 380–384、409–411 行，测试已过）。

`String(["perfect"])==="perfect"`，旧写法 `String(tier)` 会把数组收成认准；整合后的 `typeof tier === "string"` 堵住这口。

### 保存 / 刷新 / 切商品

`tried` 按货 id 分格。切货只改 `product`，不改 `tried`。`offerEvidence` 读当前 id。探针：粉底「她点头。」、粉霜「她认准了。」可并存。刷新走 `restoreConsults`；规则测试覆盖完整草稿往返。真机刷新见未验证。

### 两种正面反馈 + 保留价格

工作区 `TRIED_MARK`：`perfect: "认准了"`，`positive: "点头"`（307 行）。格子：`她认准了 · ¥1,180` / `她点头 · ¥980`（`ConsultPanel.tsx` 138 行）。未试行仍只显示价。

### consult-sim 口径

`perfect` +1100、`positive` +1000，不是负面（160–164 行）。循环在认准或点头停（312、323 行），与旧「第一声点头就停」同序，单次接待里不会既有认准又有点头再改选。报告现写「认准 N / 点头 M」；对照旧报告的「点头」用 **N+M**（`tryPerfect + tryPositive`，627、675 行）。未跑全季模拟。

### 梁夏旧账

原始诉求（无当日情境）：粉底 fit 0.833 → positive；粉霜 fit 1.000 → 正中。`beginServe` 后：

| 货 | 件数 | money | energy | opinion |
|---|---|---|---|---|
| 粉底 `soft` | 2 | 1960 | 8 | +8 |
| 粉霜 `base` | 1 | 1180 | 8 | +12 |

`SERVE_GOOD_OPINION` 8，正中再加 `PERFECT_MATCH_OPINION` 4。与专项断言一致。

### 托单预览 99→100（定点）

`handoff.ts` 46 行：`opinionOf(addOpinion(world, staffId, HANDOFF_STAFF_OPINION), staffId)`。`addOpinion` 封顶 100（`engine.ts` 253–254 行），返回新对象。探针：预览 100，与真加看法相同，`serializeWorld` 前后相同。`world-handoff.test.ts` 148–152 行有 99→100 与原世界未改断言。

## 未验证

- 未跑 Playwright / 浏览器。格子颜色、320 截图、刷新后续谈，只读了 `world-trial-response.spec.ts`，不称界面通过。
- 未跑 `consult-sim` 全量；对照旧报告要用认准+点头之和，不能逐行对「点头」那一列。
- 未跑整份 `test:rules`。只跑了 `world-consult.test.ts`。

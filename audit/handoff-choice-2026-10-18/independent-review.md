# 托单 watch/sell 独立复核

对照 HEAD `c88dd4d` 与交回 diff。范围仅 `engine.ts`、`handoff.ts`、`HandoffSheet.tsx`、`WorldGame.tsx`、`world.css`、`package.json`、`world-handoff.test.ts`、`world-handoff-choice.spec.ts`、`world-floor.spec.ts`、`world-season-smoke.spec.ts`。SWE-2 试用标记 worktree 未读。

**结论：规则层没有可复现的真实缺陷。** 省略 `handoffMode` 与基线自动托单仍逐位相同；watch 只跳过自动财务；sell 仍是 1 件 / 全柜日 1 单 / 购买间隔 / 门槛认 +4 后的值；无效目标不扣费；已付费草稿经 `restoreConsults` 仍在；代卖文案在已花 12 时不说退回。浏览器 / Playwright / 预览本次未跑，不称界面通过。

当前 `engine.ts` sha256 `0d1ef826b5ccb2d475768f1e74d48d0a9c7bbe122f27c6b34cf55ef90ad0e278`，与负责人 `/tmp/renqing-handoff-choice-20261018/default-comparison.json` 记录一致。探针：`/tmp/renqing-sales-grok-20261018/handoff-probe.mts` → `handoff-probe.json`（437ms）。

## 验收对照

### 省略 mode = 旧自动行为

`doVerb` 只在 `handoffMode === "watch"` 时跳过代卖；`undefined` 与 `"sell"` 走同一段旧门槛（`engine.ts` 1358–1372 行）。失败时回落旧句「你请…先照看…自己腾出手来。」（1376–1377 行），不改成 watch 那句。

复跑负责人 36 组 `default-baseline.json`：**36/36 与 c88dd4d 输出逐位相同**。本机 `serializeWorld(省略) === serializeWorld(sell)` 为真。输入与基线生成器相同：苏蔓→安姐，看法 0/15/16/20/40 × 已知需求 × 自购/对面对手冷却，外加邀客/比货/名额已用/精力不足/客人在对面。

### watch 只跳过自动财务

安姐基准（day 7、精力 20、苏蔓看法 16、`client-note:anjie:soothe`）：

| | money | bought | 全柜代卖 | soldUnits | 同事当日名额 | 苏蔓看法 | 安姐看法 | looked-after |
|---|---|---|---|---|---|---|---|---|
| watch | 0 | 无 | 无 | 无 | 有 | 20 | 12 | 1 |
| sell / 省略 | 2280 | day 7 | 有 | +1 | 有 | 20 | 12 | 1 |

非财务字段（opinion / memories / touched / 除 bought·sale-day·soldUnits 外的 qualities）watch 与 sell 相同。

守邀：`rivalPlan.tactic=invite` 时 watch 后 `rivalGuarded(anjie)=true` 且 money=0；`tactic=compare` 时 watch 后 `rivalGuarded=false`（`engine.ts` 1348–1352 行，在 watch/sell 分叉之前）。

决策情境复跑与负责人一致：安姐 watch 再亲自 3 件 **6840 / 余 2**，sell **2280 / 余 14**；赵 1 件两路径均 **1680**，sell 多余 12。

### sell 件数、日限额、间隔、门槛

代卖写死 `units: 1`、金额 `SHELF[product].price`（1364–1369 行）。全柜门 `handoff-sale-day:${day}`；`recentlyPurchased` 与亲自开单同一把 10 天间隔。门槛用加完 `HANDOFF_STAFF_OPINION`（+4）之后的 `opinionOf`（1344 行再 1358 行）。

探针：苏蔓 15→19，sell 进账 0；16→20，进账 2280。苏蔓已照看后再托梅，`doVerb` 返回同一对象、不扣费。罗马再 sell 梅：可托（名额还在），钱不增加。

### 无效 / 失效不扣费

`handoffMode` 非 `watch`/`sell`/省略时，在扣精力前原样返回（1244–1246 行）。`availableVerbs` 不包含 handoff 时同样原样返回（1242 行）。

探针：`"sell-one" | "auto" | "SEE" | ""`、精力 3、安姐不在场，世界引用不变、精力仍 20 或 3。

界面：`confirmHandoff` 在 `next === world` 时只关表单、不 `setWorld`（`WorldGame.tsx` 613–619 行）。打开表单本身不调用 `doVerb`（626–627 行）。

### 预览只读、不承诺成交 / 不留到下时段

`handoffPreview` 只读 `availableVerbs`、看法、当日名额、`client-note`/`bought`、`recentlyPurchased`，不调用 `visitPerson`/`bestFit`（`handoff.ts` 36–54 行）。探针：调用前后 `JSON.stringify(world)` 相同；预览 JSON 不含「密集修护 / 面霜 / 精华 / 2280 / 6840」。

watch 按钮写明「要在本时段接待，不替你留到下一时段」（`HandoffSheet.tsx` 34 行）。sell 按钮写「不保证成交」（39 行）。`sellOfferable` 为真也不等于引擎一定进账（适配未过线仍只扣 6，与旧自动相同）。

### 先选客人 / 先选同事

`availableVerbs` 只认 `[同事, 客人]`（`engine.ts` 1188–1189 行）。`verbOptions` 不会产出 `[anjie, suman]`。楼层 `pick.calls.find(c => c.targets.includes(id))` 两种起点都落到 `["suman","anjie"]`。`draftPaid` 读 `handoffTargets[1]`（`WorldGame.tsx` 1134 行）因此指向客人。

探针：`reversedExists=false`，两种 pick 都是 `["suman","anjie"]`。点选与标题是否好认见「未验证」。

### 已付费草稿不丢、续谈 / 刷新 / 开单不重收 12

`confirmHandoff` 只改 `world` / `result`，不动 `consults`。落盘信封带 `saveConsults`（`WorldGame.tsx` 450、613–619 行）。`接着谈` 走已有 `begun`，`consultAct` / `doServe` 不再 `beginServe`（641–658 行）。

探针（先 `beginServe` + 看一处 + 面霜 3 件 + 试用，再托单，再 `restoreConsults`）：

- watch 后草稿仍是 `{product:mask, units:3, begun:true, patience:3, tried:{mask:positive}}`
- sell 后同一份草稿仍在
- watch 后再 `settleServe`：精力仍 2，进账 6840，不重扣 12

`markMet` 只写 `last-met`，不改当天 `visit-context`，`spotsOf` 刷新后仍对得上（`visits.ts` 93–94、86–89 行）。

### 代卖文案不谎称退回已花 12

已付费：`这单接待已花 12 精力。接着谈不再收费，代卖也不退回。`（`HandoffSheet.tsx` 29 行），且 sell 小字不出现「省下亲自接待」（39 行，`!draftPaid`）。未付费才说省下 12。代码审查成立；真机未点。

### 无公开代卖条件：禁用 sell、解释、watch 仍可

`sell` 按钮 `disabled={!p.can || !p.sellOfferable}`；`watch` 只看 `p.can`（31、36 行）。`sellNotes` 以「这次只能照看：」列出原因（28 行）。

探针：全柜已代卖 → `can=true, sellOfferable=false`，注「今天柜上已经代卖过一单」；看法 15 → 注「托单后看法 19，门槛 20」；无 client-note → 注「还没问出安姐要什么」，`can` 仍为 true。

## 未验证（不称通过）

- 未开浏览器 / Playwright / 预览。客人名是否在 320×568 标题里一眼能看清、两种点选是否好点、取消后抽屉是否挡地图，本次都没有用真机或专项跑完。
- 楼层 e2e、整季冒烟未跑。冒烟现在点托单后优先点 watch（`world-season-smoke.spec.ts` 397–406 行），会改变那条 UI 路径的局内结果；`world-sim` 仍走省略 mode，与已验收 344 行相同这一点本次未再跑全季。
- 引导气泡与托单表单叠层：`CoachLayer` 未按 `handoffTargets` 关掉（`WorldGame.tsx` 1156 行），教练层 z-index 100、表单 90。是否挡住按钮取决于当天引导是否还在、气泡落点，**未实测，不报缺陷**。

负责人 `/tmp/renqing-handoff-choice-20261018/browser-first.log`（11:48）里专项前两例失败，对照当前源码是用例定位，不是收费/世界写坏：`.handoff-sheet` 正文没有「安姐」，名字在 BottomSheet 标题「托苏蔓照看安姐」；取消后抽屉仍开着，再点地图「查看苏蔓」会被抽屉挡住。不据此阻断规则验收。

## 最小修正

无。规则与公开预览已满足本次清单。界面专项等负责人跑完再定，不在本复核里改源码。

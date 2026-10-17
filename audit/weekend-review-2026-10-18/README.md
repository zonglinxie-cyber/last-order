# 周末输赢有来由

## 玩家能看到什么

周末单详情、周日打烊与季末回顾现在共用“这一单怎么走到这里”：实际推荐的商品、开口件数、带走件数与拒绝/成交原因；最后在本柜还是对面成交、商品、件数和真实金额；对应的一条下一次建议。

例如，玩家实际推荐了不合适的隔离乳，梅女士没有买，随后在对面带走精华：复盘保留这两段经过，提醒下次核对需求并留一次耐心给试用。不会只因为客人去了对面，就断言玩家没有接待、没有精力或没问问题。

记录只覆盖当次已发生的事实。没有推荐就不写一段推荐；缺记录的旧档继续显示原结果。硬推只说明可能退货，不读取预约队列预告未来退货。没有加奖金、改成交概率、提高对手收入或暗中赠送需求答案。

## 记录与边界

`WeekendOrder.attempt` 保存最后一次实际开口推荐；`sale` 保存最终真实成交。二者分开，允许一次失败推荐后转去对面、托同事买成或熟客回店买好。记录分别挂在原来的实际结算出口，已结案的周末单不被后续推荐覆盖；原来不消费随机数的路径仍不消费。

存档版本保持兼容，两个字段均可缺省。有字段时核对商品、整数件数、报价乘积、成交归属、推荐与成交一致性、日期及理由。新周末单重新规划、换季清除旧单，沿用原有回访回应机制。

周日和季末展示不依赖临时成交小票；刷新后读原记录。详情中未结案但已经尝试推荐的单也能复看当前经过。这不是完整逐句聊天记录，只保留最后一次推荐和最终成交；不声称知道玩家当时为什么作这个选择。

## 针对性验证

`weekend-new-final.log`：28 条周末规则通过，含新增 13 条。八类推荐结果逐项与没有周末记录的相同结算对照，除周末记录外整个世界状态一致；另验证失败后对面成交、同事代接、熟客回购、冻结已结案记录、重复结账、旧档、损坏字段与未来退款不泄漏。

`browser-new.log` 首轮 5/8：两个失败由“接待”匹配到了含同词的对手预告按钮引起，改为精确操作名称；另一失败是 320×568 季末滚动至末段后约 0.6% 的段落仍被裁切。补充 8px 滚动留白，保留完整可见断言，`browser-new-final.log` 8/8。`first-failures/` 留有原失败；`first-layout/` 保存初次通过的截图。截图随后发现季末原有结果与回访文字继承了暗灰色，补明确的正文颜色，并在最终套件验证。

完整规则、两季模拟和浏览器回归另见最终记录；不把上述专项当全量验收。

## 基线

本轮基于 `ae3e6f7`。`baseline-source.json` 保存改前源码哈希，`baseline-sim-provenance.json` 核对改前 42 个规则、内容、模拟文件与 `76fdf55` 验证时相同，因此改前完整两季模拟使用 `audit/rival-tempo-2026-10-18/world-sim-after.log`。改后重新执行完整 `world-sim.ts 20 2`，不拿旧报告冒充本轮执行。

## 实际限制

浏览器尺寸为 320×568、390×844；自动化和模拟不证明实体手机体验或真人留存已经改善。本轮让结果可回看、可解释，是否让玩家更愿意再挑战，需要真人试玩。仍保留既有构建包体提示；本轮不发布公网。


## 最终验收与交付

- `rules.log`：335/335 通过。`build.log`、`types.log` 通过；构建包含 28 个移动运行时保护文件检查。
- `world-sim.log`：完整 20 种子 × 四打法 × 两季模拟及脚本自带加难探针完成。去掉 Node 进程警告与行尾空白后，报告与改前逐字一致；两季四打法签名数都为 20/20，按既有结局排名 honest 11/20、social 14/20（并列都算），没有一种打法包揽该排名。见 `sim-comparison.json`；不将结局排名与收入胜率混称。
- `browser-regression.log`：116/116 通过，涵盖周末复盘、原周末单、熟客牵线、接待、楼层、小屏顶栏、对手经营、继续页与整季冒烟。两条引导路线各走完 28 天，再进第二季玩三天；326 / 332 行操作流水中，notes、errors、rawFields 均为 0，见 `season-summary.json`。
- 最后将鼠标移出画面，清除预览触点对截图文字的遮挡，再跑新流程 8/8（`browser-shots-final.log`）。没有改手机运行时或隐藏游戏内容；这八条已包含在前述 116 条中，不重复计数。最终两档截图已人工复查，正文与继续/关闭按钮可用；按段落滚动阅读，不宣称整个季末内容能挤在一屏。
- `validated-source.json` 留存验收代码哈希；最后只改了截图前的鼠标操作，规则及界面源码与完整验收时相同。
- 测试覆盖的 59 份旧产物先归档到 `related/`，再恢复至本轮前字节；原有 102 个未提交文件哈希一致，见 `preserved-work.json`。
- 本机试玩：<http://127.0.0.1:4188/>，实际新模块与样式已核对，见 `preview-check.json`。未发布公网。

复验命令（在 `dynamic-counter-prototype/`）：

```sh
npm run test:rules
node --experimental-strip-types tests/world-sim.ts 20 2
npm run build
MOBILE_RUNTIME_TEST_PORT=4187 WORLD_SMOKE_AUDIT_DIR=../audit/weekend-review-2026-10-18/season-smoke npx playwright test tests/world-weekend-review.spec.ts tests/world-weekend.spec.ts tests/world-weekend-referral.spec.ts tests/world-consult.spec.ts tests/world-floor.spec.ts tests/world-rival-business.spec.ts tests/world-rival-tempo.spec.ts tests/world-header.spec.ts tests/world-return-context.spec.ts tests/world-season-smoke.spec.ts --workers=1
```

独立测试类型检查继承项目 tsconfig，纳入 `tests/world-weekend.test.ts`、`tests/world-weekend-review.spec.ts` 与 `src/vite-env.d.ts`，Node 类型使用上级目录已有依赖；未安装或修改依赖。

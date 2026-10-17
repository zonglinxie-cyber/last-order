# 小屏顶栏：做决定时看得见资源和比分

## 问题与改变

改前顶栏将日期、钱、对面比分、精力、小样和本周规矩塞在同一条横滑区，右侧还有三个固定按钮。320×568 的截图只能看到被截短的日期；旧比分断言只查右边界，不会发现父容器裁切。`before/` 与 `browser-before.log` 保存三种尺寸下的实际失败（3/3），不是用缺失截图推断。

现在日期与双方金额占整行，精力、小样在下排并紧邻静音、人情网、下一时段。金额保留完整数字，不缩成万或 K。本周规矩沿用周目标中的关名，取消顶栏重复信息。地图根据可用高度收缩，现场栏保留至少 96px；原有同场争客与约客的专用收缩规则合并为同一布局。

## 验证范围

新增 `world-header.spec.ts` 在 320×568、390×667、390×844 验证开局、拥挤柜台、多位季号、节日与七位金额。检查文字实际范围、父容器裁切、中心遮挡、按钮至少 44px，并真实邀请客人、核对精力和小样扣除、刷新恢复、静音不改世界、推进恰好一个时段。`after/` 保存截图与测量；首轮 9/9 通过。

规则、内容、模拟器和移动运行时与 `76fdf55` 的 60 个相关文件逐字节相同，见 `verification-reuse.json`。复用上一轮 322 条规则及完整 20 种子 × 4 打法 × 2 季模拟；本轮没有重新运行它们。浏览器验证与构建另按当前界面执行。

## 回归中的旧断言

广泛回归发现 `world-background.spec.ts` 的未完成接待恢复用例仍找旧的“继续 · 第 1 季 · 第 1 天”，并期待先回到楼层。当前既有的继续页会说明“和梅女士接着谈”，直接恢复接待。修正测试时保留世界快照、完整接待草稿、试用次数与最终成交精力检查，按现有体验检查恢复入口，不回退现有继续页行为。

## 边界

这是浏览器模拟与本机预览验证，不代表实体手机手感、真实系统回收或真人留存已经验收。构建保留既有大包体提示。本轮不发布公网。

## 最终验收与入口

- 广泛回归 `browser-regression.log`：117/118 通过，唯一失败是上文旧接待恢复断言。修正后 `browser-resume-final.log`：前后台恢复与继续页专项 20/20 通过。按文件与用例标题去重，共 **132 项不同浏览器用例通过**，明细见 `browser-covered-cases.json`。
- 覆盖顶栏、楼层接待、名牌避让与点击、周规矩与过关、对手经营、成交反馈、新手开场、前后台恢复、全屏与桌面预览。没有因为失败缩减检查、延长超时或修改游戏规则。
- `build.log` 与 `types.log` 均通过；构建包含 28 个运行时保护文件检查。规则与模拟结果按前文明确复用，不计作本轮新跑。
- 复查 320×568 的开局、拥挤柜台、长金额及节日截图；保留前后图片与文字范围测量。实体手机与真人体验仍待后续验收。
- 本机预览：<http://127.0.0.1:4188/>。`preview-check.json` 核对实际服务的新顶栏和布局源码。
- 32 份被测试覆盖的旧产物已归档到 `related/`，随后恢复本轮前的原始字节；原有 102 个未提交文件哈希一致，见 `preserved-work.json`。

复验命令（在 `dynamic-counter-prototype/`）：

```sh
MOBILE_RUNTIME_TEST_PORT=4187 npx playwright test tests/world-header.spec.ts tests/world-floor.spec.ts tests/world-weeks.spec.ts tests/world-levels.spec.ts tests/world-rival-tempo.spec.ts tests/world-rival-business.spec.ts tests/world-background.spec.ts tests/world-fullscreen.spec.ts tests/world-moments.spec.ts tests/world-opening.spec.ts tests/world-return-context.spec.ts --workers=1
npm run build
```

独立测试类型检查使用继承项目配置的临时 tsconfig，包含本轮四个测试文件与 `src/vite-env.d.ts`，Node 类型使用上级目录已有的 `node_modules/@types`，没有安装依赖或放宽检查。

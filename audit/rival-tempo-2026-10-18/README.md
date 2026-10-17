# 对手也有持续经营的节奏 · 2026-10-18

基线 `0581251`。从首季第 8 天起，普通对面预约有午后、晚高峰两次机会；第一周沿用原体验，周末最后一单占当晚这一场。报价、邀请资源、接待、购买间隔和结账沿用真实业务规则，没有额外对面收入或玩家领先时的隐藏加成。

## 最终实现与证据

- `src/world/rival-business.ts` 的时段表供引擎、预告共用，校验接受普通晚场旧格式存档。
- 下午按既有安排留位；新增夜场只用自然来访落位后的剩余客位。已在场、玩家预约、同行和近期购买都不会被拿来凑单。
- 上午和傍晚在周目标处提示后续约客时间，点开查看成本与限制。小屏地图可收缩，现场栏保留至少 96px。
- `unit-final.log`：14 条预约行为检查通过，包括二十种子“夜场不挤掉原有来访、不改站位与自然来访随机流”的对照。
- `consult-*-before.log` 与 `consult-*-after.log`：二十种子首季，两种固定策略逐一同口径对比，数字由 `consult-comparison.json` 汇总；邀请、牵线和接待仍消耗真实资源。
- `baseline-provenance.json`：隔离基线的 61 个源文件与 `0581251` 逐字节相同。前后模拟器都只增加相同的预约/成交来源计数，不改变动作策略和随机数。

普通策略整季领先 19/20 → 7/20，主动争单及经营熟客策略 20/20 → 20/20；主动策略满星周 49/80 → 39/80，两组过关周均保持 80/80。主动策略最小领先降到 1,880 游戏元，但固定策略仍不能证明真人留存或竞争已完全平衡。

## 定位与纠正

1. `probe-base/two/three.log` 是十种子的范围试探。三场比两场增加的成交有限，因此选择午后、晚高峰两场，保留上午与傍晚用于其他经营。它们都是提前留位版本，不能当最终规则的结果。
2. `first-reserved-evening/` 是未采用的提前留位版本。其全量规则 319/321，录音线索只覆盖 8/12，米朵在种子 9 没走完。该版本浏览器回归在 58 条通过后主动中断，以应用已经证实的规则修复；中断后的整季结果不作验收。
3. `diagnosis/repro-base.log` 与 `repro-two.log`：同两项检查，基线通过、提前留位失败。`miduo-*.json` 记录具体续章与赴约。`night-displaces-visits-before.log` 将问题压缩成种子 0 的一次开场：高原被挤掉。
4. 改为先保留自然来访、再追加夜场。`diagnosis/repro-late.log` 的两项原检查恢复，新加入的不挤占检查也通过。没有调剧情权重、改故事或降低原验收线。`first-reserved-evening` 内收入与满星读数不适用于最终版。
5. `browser-focused.log` 最初 25/26，通过的实际晚场支付、成交、刷新均正常；唯一失败为 320 屏的现场栏只剩约 24px。修复地图收缩后 `browser-tempo-final.log` 六项通过。最终广泛回归另记，数量不重复累加。
6. `types-command-first/second.log` 是首次独立类型检查的命令问题：TypeScript 7 要求显式忽略项目配置，项目 Node 类型位于上级目录。之后使用继承项目配置的临时配置、指向现有类型和 `vite-env.d.ts`，没有安装依赖或放宽严格检查。

## 复验命令

在 `dynamic-counter-prototype/` 运行：

```sh
npm run test:rules
node --experimental-strip-types tests/world-sim.ts 20 2
node --experimental-strip-types tests/consult-sim.ts 20 1 default
node --experimental-strip-types tests/consult-sim.ts 20 1 rebook
npm run build
MOBILE_RUNTIME_TEST_PORT=4187 WORLD_SMOKE_AUDIT_DIR=../audit/rival-tempo-2026-10-18/season-smoke npx playwright test tests/world-rival-tempo.spec.ts tests/world-rival-business.spec.ts tests/world-levels.spec.ts tests/world-floor.spec.ts tests/world-dynamics.spec.ts tests/world-weekend.spec.ts tests/world-weekend-referral.spec.ts tests/world-invite.spec.ts tests/world-season-smoke.spec.ts --workers=1
```

## 已完成的全量规则与模拟

`rules-final.log`：322/322 通过。`world-sim-after.log` 完整结束，包括既有加难与长线探针。`world-sim-comparison.json` 核对第一、第二季四种打法签名数均 20/20；按结局排名 honest 11/20、social 14/20，并列都算，没有一种打法包揽。基线报告与模拟器已与 `0581251` 逐字节核对，记录在 provenance 文件。

`build-final.log` 与 `types-final.log` 已通过，包含运行时 28 个保护文件检查；构建仍有既有大包体提示。最终帮助页样式及周末预告也已重新构建并复验相关浏览器流程。

## 最终手机验收与交付

`browser-final.log`：广泛回归 109/109，通过楼层、竞争、三条周路线、邀约、周末单、牵线与整季冒烟。两条引导路线分别走完首季 28 天与第二季前三天，`season-smoke/report-know.json`、`report-skip.json` 的 notes、errors、rawFields 均为 0。

截图复查后补了四条阅读/归属检查（两种屏幕各两条）：`browser-reading-before.log` 四条均失败，分别指出抽屉只有 260px、已确认的周末单仍被预告为对面约客。修正正文颜色、抽屉高度和预约归属文案后，`browser-ui-final.log` 22/22 通过，包含新 8 条与原周路线 14 条。最后再次构建、独立测试类型检查通过；这次只改两处界面文件，规则和两季模拟复用同一份已通过的代码，不重复运行。去除重复复验后，本轮共 **111 条不同浏览器用例通过**，见 `browser-covered-cases.json`。

已复查 320×568 的最终预告、已确认周末单和帮助页截图：正文清楚，关闭按钮完整可点，现场栏没有被新预告挤掉。390×844 同样通过自动尺寸与流程检查。浏览器模拟不代替实体手机或真人留存测试。

17 份被测试覆盖的旧产物先归档到 `related/`，再恢复至本轮前的原始字节。原有 102 个文件全部哈希一致，见 `preserved-work.json`；没有回退用户原本的未提交截图。

本机试玩：`http://127.0.0.1:4188/`。`preview-check.json` 核对实际服务的新模块与最后两处界面修正。未发布公网。

## 后续体验线索

320×568 的楼层截图还提示一个既有问题：顶栏日期被截短，精力与小样不在眼前。当前 `world-floor.spec.ts` 的比分检查只核对元素右边界未超出视口，没有核对父容器裁切或按钮遮挡。这轮未改顶栏；下一轮应直接测可见区域与遮挡，再决定布局，而不能用这条旧检查当作全部信息都清楚的证据。

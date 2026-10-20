# 客情只差一天：周结算读出近失，下周提示说清要从头记两天（2026-10-20）

上一轮遗留的断点：8 位客人本周各只被亲自照应过一天，`weekCareOf` 只报 0 或已记人数；周结算看不出「只差一天」，下周提示还会说「先约回本周只照应过一天的人」，容易让玩家以为再点一次就补完。客情按周重算，下周仍要从头记两天。

## 改了什么

- `weekCareNearPeople` / `weekCareNearOf`：读出本周只照应过一天、仍信得过你、尚未记进客情的人；不把信任掉线、已记满两天、上周的人混进来。
- 周结算三条线下面新增一行：`客情这周有 8 位只亲自照应过一天，没算进人数；下周要从头记两天。`
- 三条线抽屉的客情行追加：`还差一天 8 位（下周从头记两天）`。
- `nextWeekHint` 在客情是最近路线时改说：`本周有 8 位只差一天，但下周要从头记两天，先给他们排两次见面。` 不再说「再约回一次就补完」。

## 同条件改前/改后

同一副盘：1 位已记客情（两天 + week-care）、8 位本周只照应过一天、业绩 ¥1,000 / 目标 ¥16,000、守客 0/3。

`hint-before.log`（4cc9b21）：
`先补客情：还差 8 位；同一位客人要在两个不同日子亲自办过事才算，先约回本周只照应过一天的人。`

`hint-after.log`（本轮）：
`先补客情：还差 8 位；本周有 8 位只差一天，但下周要从头记两天，先给他们排两次见面。`

玩家的下周动作从「把这 8 位再约一次」改成「安排两次见面，或另找能见两次的人」；这是客情按周重算的机制事实，不是换一句文案。有限信息下玩家只能从周报和抽屉看到这 8 位；全知策略不影响这条读数。

## 手机

- `browser.log`：`npx playwright test tests/world-levels.spec.ts --workers=1`，18/18；320×568 与 390×844 的周结算和三条线抽屉都包含新读数，且不出现旧的「先约回本周只照应过一天的人」。
- `report-320.png` / `report-390.png`：周结算上的近失行与下周一句。
- `routes-320.png` / `routes-390.png`：三条线抽屉里客情行的「还差一天 8 位」。
- `rules-target.log`：`node --experimental-strip-types --test tests/world-target.test.ts`，12/12；覆盖低信任、上周、已记满两天三种排除。
- `rules-final.log`：`npm run test:rules`，363/363。
- `build.log` / `tsc.log`：构建通过、独立 `tsc` 退出 0。
- `season.log`：整季冒烟的「全程点知道了」路径 1/1（4.2m），从新档走完首季 28 天、季末回顾，再进第二季玩 3 天；不是整套 11 条，另 10 条季末排版/跳过引导路径本轮未重跑。
- `sim.log`：`node --experimental-strip-types tests/world-sim.ts 20 2`，与改前基线逐字节一致（新增读数不在模拟器决策路径上）。

## 复现

```bash
cd dynamic-counter-prototype
# 改前
git -C .. worktree add --detach /tmp/care-near-before 4cc9b21
cp tests/care-near-probe.ts /tmp/care-near-before/dynamic-counter-prototype/tests/
(cd /tmp/care-near-before/dynamic-counter-prototype && node --experimental-strip-types tests/care-near-probe.ts)
git -C .. worktree remove --force /tmp/care-near-before
# 改后
node --experimental-strip-types tests/care-near-probe.ts
npx playwright test tests/world-levels.spec.ts --workers=1
```

## 真人观察

本机预览 `http://127.0.0.1:5173/`。让玩家打到一次周结算，先读「客情只差一天」那行，再问：下周你会把这 8 位各约几次？如果回答「再点一次就补完」，说明这句仍需更直白；如果回答「两次」，再看三条线抽屉里的「还差一天 8 位」是否帮助他选中客情线。没有真人反馈前，不声称这条读数提高了理解或留存。

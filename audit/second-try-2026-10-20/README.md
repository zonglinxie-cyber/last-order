# 点头后再换一支：同条件对照与手机验收（2026-10-20）

这一轮只解决一个体验问题：她试到「这个可以」之后，再换一支没有代价，于是「继续摸到认准」永远不亏，接待退化成同一条流程。现在第一次换支若没试到正中，普通人 −2、好胜/多疑/急性 −3；换到正中不罚，同一单只结一次。代价在按下试用前就写在开单区和固定底栏。

## 文件

- `choice-before.log`：在 `de64505` 的临时 worktree 里跑 `tests/second-try-choice-probe.ts`。
- `choice-after.log`：当前实现跑同一个探针。
- `browser.log`：`npx playwright test tests/world-second-try.spec.ts --workers=1`，6/6。
- `rules-consult.log`：`node --experimental-strip-types --test tests/world-consult.test.ts`，29/29。
- `rules-final.log`：`npm run test:rules`，362/362。
- `levels.log`：`npx playwright test tests/world-levels.spec.ts --workers=1`，16/16（含下一周一句）。
- `consult-regression.log`：`world-consult` + `world-trial-response` + 新 spec，18/18。
- `season-smoke.log`：`npx playwright test tests/world-season-smoke.spec.ts --workers=1`，11/11；两条新档路径走完首季 28 天、季末回顾，再进第二季玩 3 天。
- `sim.log`：`node --experimental-strip-types tests/world-sim.ts 20 2`，与改前基线 `/tmp/sim-baseline.log` 逐字节一致（27,122 字节）。
- `risk-320.png` / `risk-390.png`：周姐点头后选中粉霜，开单前看见 −3。
- `receipt-320.png` / `receipt-390.png`：换空后仍卖回粉底，小票 +5 并说明「反复」。
- `perfect-320.png` / `perfect-390.png`：梁夏换到粉霜正中，+12。

## 同条件对照（有限信息策略）

探针只看她说的需求、今天的重点、货架 tag 与价格，一支支试到点头，再看第二支公开排名最高的货。32 位有诉求的客人里，22 位第一次就认准、不需要换支；10 位走到「点头 + 第二支」。

| | 旧规则 `de64505` | 新规则 |
|---|---:|---:|
| 第二支换空（犹豫/摇头/另一支点头） | 8 位；换支与收手同为 +8 | 8 位；换支 +5 或 +6，收手 +8 |
| 第二支正中 | 2 位；+12 | 2 位；+12（不罚） |

代表行：

| 客人 | 先点头 | 换的那支 | 换支结果 | 收手 | 换支后收（新） | 旧规则换支后收 |
|---|---|---|---:|---:|---:|---:|
| 周姐（多疑·好胜） | 粉底 ¥980 | 粉霜 ¥1,180 | 犹豫 | +8 | +5（−3） | +8 |
| 梁夏（爱面子·怕推销） | 粉底 ¥980 | 粉霜 ¥1,180 | 正中 | +8 | +12（+4） | +12 |

全知上限里 21 位有 19 位能换到正中，但那是知道适配分的结果；有限信息下 8/10 会换空，才是这一刀改变决策的地方。旧模拟器的盲策在第一支点头就停，不触发换支，所以完整两季四打法报告应与改前一致；这条只证明旧路径未变，换支收益由这份探针单独覆盖。

## 复现

```bash
cd dynamic-counter-prototype
# 改前
git -C .. worktree add --detach /tmp/last-order-head de64505
cp tests/second-try-choice-probe.ts /tmp/last-order-head/dynamic-counter-prototype/tests/
(cd /tmp/last-order-head/dynamic-counter-prototype && node --experimental-strip-types tests/second-try-choice-probe.ts > /tmp/choice-before.log)
git -C .. worktree remove --force /tmp/last-order-head
# 改后
node --experimental-strip-types tests/second-try-choice-probe.ts > /tmp/choice-after.log
# 手机
npx playwright test tests/world-second-try.spec.ts --workers=1
```

## 真人与夹具的边界

- 自然新档（改后）：2026-10-20 23:33–23:34 清空 localStorage、开新季，接待沈薇，粉底 ×3 试出「认准」，开单 +¥2,940 / 人情 +12；刷新后继续页显示「本周 ¥2,940 / ¥13,000」，停在第 1 天上午。第一单只试了一支，不触发换支风险，确认新手首单没有被新规则挡住。这是浏览器里的实际操作，不是夹具跳转。
- 下面的 6/6 与 16/16 是固定存档夹具，用来稳定复现换支与周日结算；不代替自然整季或真人设备。

## 真人试玩入口与观察任务

本机预览：`http://127.0.0.1:5173/`（只绑定回环地址，未发布公网）。

1. 开新档，第 1 天接待周姐；看 / 问后挑「粉底」试一下，等她说「这个可以」。
2. 切到「粉霜」，先不按试用，读开单区和底栏那行「人情 −3」。问玩家：这时你会收手，还是再试一支？为什么？
3. 按「试一下」；她犹豫后，切回「粉底」开单。看小票的人情是否 +5，问玩家能否说出少掉的 3 点从哪来。
4. 另开一档接待梁夏，重复到「粉底点头」，换「粉霜」；这次是正中，看小票 +12。问玩家：同样是换支，为什么这次没罚？
5. 把一档打到周日没过，读结算屏的「下一周先改什么」；问玩家下周第一件事会改什么，是否同意这句建议。

尚未有真人反馈；这份任务只定义观察点，不据此声称趣味性或留存提升。

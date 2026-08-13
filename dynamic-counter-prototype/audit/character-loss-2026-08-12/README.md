# 人物形象丢失审计（2026-08-12）

## 结论

人物图片没有发生随机 404。真正的问题是展示映射退化：营业现场只按“年轻 / 年长”复用两种顾客小人，赵女士还被错误映射为年轻外观；陆遥仅有一块共享 sprite，罗曼、苏蔓、唐可、方敏没有独立视觉资产，只以文字出现。

## 修复

- 保留五张既有顾客咨询近景，不修改图片文件。
- 每位顾客在营业现场增加自己的近景身份头像；赵女士使用成熟地图形态。
- 为许愿、陆遥、罗曼、苏蔓、唐可、方敏补齐六张独立员工头像。
- 营业现场、玩家状态、陆遥插话、闭店事件按人物 ID 显式映射头像。
- 没有把旧办公室题材的七张人物立绘冒充成美妆角色。

## 验证

- 11 张运行时人物图片在 `http://127.0.0.1:5185/` 均返回 `image/png`。
- 浏览器控制台：0 error，0 warning。
- 生产构建通过。
- 自动化测试：19 条核心玩法测试、1 条离线发布测试、5 条 PWA / Sites 打包测试全部通过。

## ImageGen 记录

模式：内置 ImageGen。

最终生成源图：

- `/Users/derekfly3/.codex/generated_images/019fea77-2cf2-71d3-850e-e0bb8d996509/exec-a24f3061-db86-4cd1-81dd-d8b66d60cb65.png`
- `tmp/imagegen/staff-portraits-chroma.png`
- `tmp/imagegen/staff-portraits-alpha.png`

最终提示词：

> Use case: stylized-concept. Asset type: six distinct mobile game character portrait tokens for a Chinese luxury cosmetics-counter simulation game. Input image: the provided toy-staff-walk sprite sheet is the mandatory visual style reference for proportions, facial rendering, gold-and-purple palette, and polished 2D game illustration finish. Primary request: Create exactly six clearly different head-and-shoulders character busts, arranged in one perfectly even horizontal row of six isolated cells, left to right in this exact identity order: (1) Xu Yuan, 23, earnest new beauty advisor, warm cream uniform, youthful and observant; (2) Lu Yao, 30, sharp confident rival sales champion, deep violet uniform, sleek ponytail; (3) Roman, 36, calm immaculate counter manager, structured black-and-gold uniform, controlled expression; (4) Su Man, 32, warm senior advisor and mentor, champagne uniform, gentle smile; (5) Tang Ke, 22, competitive quick-witted new hire, lavender uniform, short lively hair; (6) Fang Min, 41, quiet compliance and inventory lead, dark taupe uniform, serious mature expression. Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal, one uniform color, no shadows, gradients, texture, reflections, floor plane, or lighting variation. Style/medium: polished modern 2D mobile simulation-game portraits, lightly chibi but adult, consistent with the provided sprite reference; expressive recognizable faces, not photorealistic. Composition/framing: exact one-row six-column contact sheet; every bust centered in an equal-width cell; full head, hair, shoulders, and upper chest visible; generous padding; no overlap; identical visual scale. Lighting/mood: clean luxury cosmetics-counter warmth, subtle gold rim light contained only on characters. Constraints: exactly six people; all female; each identity visually distinct; no duplicate faces; no text, labels, logos, UI, watermark, border, props, cast shadow, contact shadow, or reflection; crisp opaque silhouettes; do not use #00ff00 anywhere in characters.

## 证据

- `03-floor-after-fix.png`：修复后的营业现场。
- `01-customer-map-sheet.png`、`02-staff-map-sheet.png`：审计时确认的旧通用地图素材。

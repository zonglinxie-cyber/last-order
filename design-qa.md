# Design QA

- Source visual truth: `/Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/design-qa-before.png` plus the approved map-layer / portrait-layer requirements in the current task.
- Implementation screenshot: `/Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/design-qa-after.png`
- Full-view comparison: `/Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/design-qa-comparison.png`
- Focused map comparison: `/Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/design-qa-map-comparison.png`
- Focused interaction-card comparison: `/Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/design-qa-card-comparison.png`
- Viewport: 1280 × 720 CSS px
- Density normalization: source and implementation are both 1280 × 720 px at devicePixelRatio 1; no resampling was required before comparison.
- State: Day 01, female player selected, 周启明 selected for the matching full-view capture.

## Full-view comparison evidence

The former full-height character cutouts have been replaced by six compact, consistently sized bust markers anchored at the same scene coordinates. Their reduced visual footprint exposes the office furniture and floor instead of covering it. The sidebar now uses the complete official portrait at a substantially larger size while preserving the existing name, role, and two interaction actions.

## Focused region comparison evidence

- Map: all six markers use the same crop container, floor shadow, lightweight name label, and restrained selected outline. Existing furniture placement remains readable and no marker crosses the scene boundary.
- Interaction card: the official portrait is shown almost full height with its original aspect ratio. The card contains only the portrait, name, role, and two requested actions, without a dead empty region.

## Required fidelity surfaces

- Fonts and typography: existing type scale and hierarchy were preserved. Map labels were reduced to names only and remain legible at the test viewport.
- Spacing and layout rhythm: the scene, toolbar, sidebar, and feed geometry were preserved. The interaction card uses a compact two-column composition without unused space.
- Colors and visual tokens: existing dark UI and per-character accent tokens were preserved. Selected state uses a thin accent border and floor ring rather than a large glow.
- Image quality and asset fidelity: all map markers and the interaction card reuse the original 320 × 700 transparent PNG assets without editing or stretching. Map markers use a CSS crop; the interaction card uses `object-fit: contain`.
- Copy and content: map labels show only names. The interaction card shows the correct name, role, “当面沟通”, and “发消息”.

## Findings

No actionable P0, P1, or P2 issues remain in the requested scope.

## Interaction and runtime checks

- Five NPC buttons and one player marker rendered.
- All six map images loaded at 320 × 700 natural dimensions.
- Clicking each NPC updated the card to the matching official portrait.
- Hover and selected styling were verified on 王芳.
- “当面沟通” opened the selected NPC's existing dialogue bubble.
- Production build passed.
- Browser console contained no warnings or errors.

## Comparison history

Pass 1: the requested visual split was visible without remaining P0/P1/P2 issues, so no corrective QA iteration was required.

final result: passed

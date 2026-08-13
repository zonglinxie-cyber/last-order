# Design QA

final result: passed

## Evidence

- Source visual truth: `/Users/derekfly3/.codex/generated_images/019fea77-2cf2-71d3-850e-e0bb8d996509/exec-8e3e9a3a-a3ca-4a3d-96f1-7dc729705d48.png`
- Browser-rendered implementation: `/Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/dynamic-counter-prototype/qa-implementation-toy.png`
- Same-input comparison: `/Users/derekfly3/Documents/ChatGPT/AI公司大乱斗/dynamic-counter-prototype/qa-side-by-side-toy.png`
- Intended app viewport: `393 × 852` CSS px. Final browser capture was normalized from the visible phone viewport to `393 × 852` pixels for comparison.
- Source pixels: `853 × 1844`, normalized to `393 × 852`.
- State: live counter stage before customer selection.

## Comparison

- Typography: warm gold serif sales HUD and compact dark name labels preserve the source hierarchy. Small labels remain short and do not overlap characters.
- Spacing/layout: the tester island, entrance, checkout, open floor, four actors, pressure strip, and bottom guidance match the source composition. The implementation intentionally leaves slightly more open floor to support actual movement.
- Colors/tokens: champagne gold, warm ivory, muted violet, espresso brown, and the danger accent are preserved.
- Image quality/assets: the stage is a dedicated painterly background plate. Staff and customers are dedicated transparent 3–3.5-head-tall fashion-toy sprite assets, not CSS/SVG approximations or shrunken photorealistic people.
- Copy/content: the implementation uses functional live-state copy rather than decorative mock text. The monthly target, interception pressure, character names, and tap guidance are visible.
- Interaction: customer tap triggers player movement, arrival enters the existing face-focused consultation view, and failure to react allows the rival to intercept Shen Wei.

## Focused region comparison

- Focused review was performed on the actors and foot contact because movement style was the selected concept's decisive surface.
- Character proportions, expressive faces, costume identity, age differentiation, soft contact shadow, and foot anchors are all visible at phone size.
- The source is a static direction board; the implementation adds a restrained four-pose step cycle, two-pixel weight shift, shadow compression, slower velocity, and end-of-path deceleration. This is an intentional functional extension.

## Comparison history

### Iteration 1

- [P1] Generated sprites were initially stretched from their native `384:512` cell ratio into the legacy map viewport.
  - Fix: changed the rendered sprite cell to `96 × 128`, restored native aspect ratio, and enlarged actors uniformly.
- [P2] The third generated walk pose faced the opposite direction, causing head-direction flicker.
  - Fix: normalized the third cell direction in both sprite sheets before use.
- [P2] Constant-speed movement felt like sliding.
  - Fix: reduced player/rival speed, added end-of-path easing, slowed the four-pose loop, and added restrained weight/shadow changes.
- [P2] Character buttons were unstable while their React callback identity changed on every animation frame.
  - Fix: moved actor reads to a ref, stabilized the customer callback, and added stationary transparent semantic hitboxes above the animated sprites.

### Final pass

- No actionable P0/P1/P2 visual findings remain.
- Remaining difference: the implementation actors are slightly smaller than the static direction board because they must move without colliding with furniture. This is an acceptable functional constraint, not a fidelity defect.

## Verification

- `npm run check:runtime`: passed; 28 protected mobile runtime files intact.
- `npm run build`: passed.
- Customer semantic hitboxes: visible, enabled, and functional.
- Player movement guidance and automatic consultation transition: passed.
- Existing consultation screen remains intact.
- Browser console errors: none from the application.

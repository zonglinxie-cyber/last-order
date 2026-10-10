# 手机版约定

项目入口、测试命令、哪些不要动：见上一级 `../AGENTS.md`。这里只放手机外框运行时的用法。旧约定原文在 `../docs/旧版约定存档.md`。

## 运行时组件（`src/mobile/`，完整说明在 `src/mobile/COMPONENTS.md`）
- 可滚动的内容放进 `MobileScroll`。固定的头部、底栏、输入框、浮层放在它外面，作为同级层。
- 输入文字一律用 `KeyboardInput` / `KeyboardTextarea` / `MobileTextField`，不要直接写原生 `input`。打开浮层、切换页面之前先调用 `keyboard.hide()`。
- 手机内的弹层用 `BottomSheet`，横向滑动的列表用 `Carousel`，不要自己写 `overflow-x`。
- 页面底部的固定元素按 `useKeyboardInsets().bottomInset` 定位，不要直接写 `bottom: 0`。

## 真机
- 外框（`PhoneFrame`、模拟状态栏、设备切换器、底部横条）是给桌面预览用的。在真手机上和装到桌面的 PWA 里全屏显示，这些节点一件都不画，安全区读实测的 `env(safe-area-inset-*)`。
- 全屏与否只判一次，在 `src/mobile/chrome.ts`，结果写在 `<html data-phone-chrome="real|frame">`。样式表里不要再自己写 `@media (pointer: coarse)` 或 `(display-mode: standalone)` 猜一遍——CDP 模拟不了 `display-mode`，媒体查询那一支没法验收。第一个界面让开的高度用 `--top-inset`，假状态栏那条高度由 `--fake-bar-height` 给（画框 54px，全屏 8px）。验收在 `tests/world-fullscreen.spec.ts`；`?chrome=frame` 强制画框、`?chrome=app` 强制全屏，两条都是给测试用的。
- 改了运行时文件以后，先运行 `npm run update:runtime-lock`，再运行 `npm run check:runtime`。

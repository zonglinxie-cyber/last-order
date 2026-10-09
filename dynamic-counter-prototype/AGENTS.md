# 手机版约定

项目入口、测试命令、哪些不要动：见上一级 `../AGENTS.md`。这里只放手机外框运行时的用法。旧约定原文在 `../docs/旧版约定存档.md`。

## 运行时组件（`src/mobile/`，完整说明在 `src/mobile/COMPONENTS.md`）
- 可滚动的内容放进 `MobileScroll`。固定的头部、底栏、输入框、浮层放在它外面，作为同级层。
- 输入文字一律用 `KeyboardInput` / `KeyboardTextarea` / `MobileTextField`，不要直接写原生 `input`。打开浮层、切换页面之前先调用 `keyboard.hide()`。
- 手机内的弹层用 `BottomSheet`，横向滑动的列表用 `Carousel`，不要自己写 `overflow-x`。
- 页面底部的固定元素按 `useKeyboardInsets().bottomInset` 定位，不要直接写 `bottom: 0`。

## 真机
- 外框（`PhoneFrame`、模拟状态栏、设备切换器、底部横条）是给桌面预览用的。在真手机上和装到桌面的 PWA 里，应该全屏显示，不画假的状态栏和底部横条。这一条还没做到，见 Qoder 的任务 10。
- 改了运行时文件以后，先运行 `npm run update:runtime-lock`，再运行 `npm run check:runtime`。

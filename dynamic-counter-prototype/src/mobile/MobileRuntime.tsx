import { useEffect, type PropsWithChildren } from "react";
import { MobileDeviceProvider, useMobileDevice } from "./Device";
import { KeyboardDock, KeyboardProvider, useKeyboard } from "./Keyboard";
import { PhoneFrame } from "./PhoneFrame";
import { HomeIndicator, StatusBar } from "./components";

export function MobileRuntime({ children }: PropsWithChildren) {
  return (
    <MobileDeviceProvider>
      <PhoneFrame>
        <KeyboardProvider>
          <KeyboardPreview />
          <FakeChromeLayer>
            <MobileAppViewport>{children}</MobileAppViewport>
          </FakeChromeLayer>
          <KeyboardDock />
        </KeyboardProvider>
      </PhoneFrame>
    </MobileDeviceProvider>
  );
}

/** 假状态栏和假底部横条只属于桌面预览：真手机上和装到桌面的 PWA 里，它们是两个谁也不需要的空带，
    还正好盖在真的时钟和 home 条上面。全屏那一档不渲染它们。 */
function FakeChromeLayer({ children }: PropsWithChildren) {
  const { chrome } = useMobileDevice();
  if (chrome === "real") return <>{children}</>;
  return (
    <>
      <StatusBar />
      {children}
      <HomeIndicator />
    </>
  );
}

function MobileAppViewport({ children }: PropsWithChildren) {
  const { device } = useMobileDevice();
  const keyboard = useKeyboard();

  return (
    <div
      className="mobile-app-viewport"
      data-keyboard-visible={keyboard.visible ? "true" : "false"}
      data-platform={device.platform}
      data-testid="mobile-app-viewport"
    >
      {children}
    </div>
  );
}

function KeyboardPreview() {
  const keyboard = useKeyboard();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("keyboard") === "1") {
      keyboard.show();
    }
  }, [keyboard]);

  return null;
}

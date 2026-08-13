import { defineConfig } from "@playwright/test";

const releasePort = 4175;

export default defineConfig({
  testDir: "./tests/release",
  timeout: 20_000,
  use: {
    baseURL: `http://127.0.0.1:${releasePort}`,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${releasePort}`,
    url: `http://127.0.0.1:${releasePort}/`,
    reuseExistingServer: false,
  },
});

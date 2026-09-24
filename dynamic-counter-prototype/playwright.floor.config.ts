import { defineConfig } from "@playwright/test";

const port = Number(process.env.FLOOR_TEST_PORT ?? 5194);
export default defineConfig({
  testDir: "./rescue-e2e",
  timeout: 30_000,
  workers: 2,
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1280, height: 720 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  outputDir: "./test-results/floor",
  webServer: {
    command: `npm --prefix .. run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: Boolean(process.env.FLOOR_TEST_PORT),
  },
});

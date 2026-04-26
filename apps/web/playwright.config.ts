import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3010";
const devServerPort = Number(new URL(baseURL).port || "3010");
const useExternalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: useExternalServer
    ? undefined
    : {
        command: `pnpm --filter @amdox/web exec next dev -p ${devServerPort}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180000,
      },
});

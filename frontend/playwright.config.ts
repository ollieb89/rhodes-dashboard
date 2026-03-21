import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3489",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --port 3489",
    port: 3489,
    timeout: 30_000,
    reuseExistingServer: true,
  },
});

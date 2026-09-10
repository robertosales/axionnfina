import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  expect: { timeout: 20000 },
  use: {
    baseURL: "http://localhost:4174",
    headless: true,
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  },
  webServer: process.env["PLAYWRIGHT_EXTERNAL_SERVER"]
    ? undefined
    : {
        command: "node node_modules/vite/bin/vite.js --port 4174",
        url: "http://localhost:4174",
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          VITE_SUPABASE_URL: "https://example.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only",
        },
      },
});

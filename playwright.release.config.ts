import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/release",
  timeout: 240000,
  workers: 1,
  reporter: "list",
  use: { trace: "retain-on-failure" },
});

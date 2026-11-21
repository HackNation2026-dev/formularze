const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/ui",
  use: { baseURL: "http://127.0.0.1:8015", headless: true, channel: "chrome" },
  workers: 1,
  webServer: {
    command:
      "AUTH_ENABLED=true JWT_SECRET=ui-test-secret-with-at-least-32-characters EXTRACTOR=llm LLM_BASE_URL=http://127.0.0.1:9 APP_PORT=8015 PYTHONPATH=src .venv/bin/python -m formgen",
    url: "http://127.0.0.1:8015/health",
    reuseExistingServer: false,
  },
});

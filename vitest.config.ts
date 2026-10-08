/**
 * Vitest 测试框架配置
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts", "test/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});

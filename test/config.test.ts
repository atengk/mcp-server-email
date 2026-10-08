/**
 * 配置解析单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/index.js";

describe("Config Module", () => {
  it("应成功加载并解析默认环境配置", () => {
    const loaded = loadConfig();
    expect(loaded).toBeDefined();
    expect(loaded.MCP_TRANSPORT).toBeDefined();
    expect(loaded.MCP_PORT).toBe(3000);
  });
});

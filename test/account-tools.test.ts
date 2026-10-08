/**
 * MCP 账户工具集成测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountManager } from "../src/services/account-manager.js";
import { registerEmailTools } from "../src/tools/index.js";

describe("Account MCP Tools", () => {
  let server: McpServer;
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeEach(async () => {
    server = new McpServer({ name: "test-server", version: "1.0.0" });
    registerEmailTools(server);

    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
  });

  it("应当成功注册 list_accounts 与 verify_connection 工具", async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain("list_accounts");
    expect(toolNames).toContain("verify_connection");
    expect(toolNames).toContain("send_email");
    expect(toolNames).toContain("search_emails");
  });

  it("list_accounts 工具应返回脱敏账户列表且不暴露密码", async () => {
    vi.spyOn(accountManager, "listAccounts").mockReturnValue([
      {
        id: "work",
        name: "工作邮箱",
        email: "work@company.com",
        isDefault: true,
        smtp: {
          host: "smtp.company.com",
          port: 465,
          secure: true,
          user: "work@company.com",
        },
        imap: {
          host: "imap.company.com",
          port: 993,
          secure: true,
          user: "work@company.com",
        },
      },
    ]);

    const result = await client.callTool({
      name: "list_accounts",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const textContent = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(textContent);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("work");
    expect(parsed[0].isDefault).toBe(true);
    expect(parsed[0].smtp.user).toBe("work@company.com");
    // 严格断言：输出中绝无 pass 字段或明文密码
    expect(textContent).not.toContain('"pass"');
    expect(parsed[0].smtp.pass).toBeUndefined();
    expect(parsed[0].imap.pass).toBeUndefined();
  });

  it("verify_connection 工具应返回体检报告", async () => {
    vi.spyOn(accountManager, "verifyConnection").mockResolvedValue({
      account: "default",
      smtp: {
        configured: true,
        success: true,
        host: "smtp.example.com",
        port: 465,
      },
      imap: {
        configured: true,
        success: true,
        host: "imap.example.com",
        port: 993,
      },
      overallSuccess: true,
    });

    const result = await client.callTool({
      name: "verify_connection",
      arguments: { account: "default" },
    });

    expect(result.isError).toBeFalsy();
    const textContent = (result.content as Array<{ type: string; text: string }>)[0].text;
    const report = JSON.parse(textContent);

    expect(report.account).toBe("default");
    expect(report.overallSuccess).toBe(true);
    expect(report.smtp.success).toBe(true);
    expect(report.imap.success).toBe(true);
  });
});

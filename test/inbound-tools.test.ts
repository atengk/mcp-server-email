/**
 * 收件与状态看板 MCP 工具端到端集成测试
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

describe("Inbound & Status MCP Tools", () => {
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

    vi.spyOn(accountManager, "getAccount").mockReturnValue({
      id: "default",
      email: "user@example.com",
      smtp: {
        host: "smtp.example.com",
        port: 465,
        secure: true,
        user: "user@example.com",
        pass: "pass",
      },
      imap: {
        host: "imap.example.com",
        port: 993,
        secure: true,
        user: "user@example.com",
        pass: "pass",
      },
    });
  });

  afterEach(async () => {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
  });

  it("应当成功暴露 get_mailbox_status、search_emails 与 list_mailboxes 工具", async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain("get_mailbox_status");
    expect(toolNames).toContain("search_emails");
    expect(toolNames).toContain("list_mailboxes");
  });

  it("调用 get_mailbox_status 应当返回看板概览报告", async () => {
    const mockImapService = {
      getMailboxStatus: vi.fn().mockResolvedValue({
        mailboxes: [{ mailbox: "INBOX", total: 10, unseen: 3, recent: 1 }],
        totalUnseen: 3,
        totalMessages: 10,
      }),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const result = await client.callTool({
      name: "get_mailbox_status",
      arguments: { mailbox: "inbox" },
    });

    expect(result.isError).toBeFalsy();
    const textContent = (result.content as Array<{ type: string; text: string }>)[0].text;
    const report = JSON.parse(textContent);

    expect(report.totalUnseen).toBe(3);
    expect(report.totalMessages).toBe(10);
    expect(report.mailboxes[0].mailbox).toBe("INBOX");
    expect(mockImapService.getMailboxStatus).toHaveBeenCalledWith("inbox");
  });

  it("调用 search_emails 应当支持多维分页检索并返回带有 preview 的结果", async () => {
    const mockImapService = {
      searchEmails: vi.fn().mockResolvedValue({
        items: [
          {
            uid: 100,
            seq: 1,
            from: "Alice <alice@example.com>",
            subject: "季度汇报",
            date: "2026-10-08T00:00:00Z",
            unseen: true,
            hasAttachments: false,
            preview: "这是清洗后的 150 字符摘要预览...",
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      }),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const result = await client.callTool({
      name: "search_emails",
      arguments: {
        query: "季度",
        unseenOnly: true,
        page: 1,
        limit: 10,
      },
    });

    expect(result.isError).toBeFalsy();
    const textContent = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(textContent);

    expect(parsed.total).toBe(1);
    expect(parsed.items[0].preview).toBe("这是清洗后的 150 字符摘要预览...");
    expect(mockImapService.searchEmails).toHaveBeenCalledWith(
      expect.objectContaining({ query: "季度", unseenOnly: true, page: 1, limit: 10 })
    );
  });
});

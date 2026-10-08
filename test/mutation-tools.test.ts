/**
 * 邮件状态流转、星标置顶与防灾软删除 MCP 工具黑盒集成测试
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

describe("Mutation & Soft-Deletion MCP Tools", () => {
  let server: McpServer;
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeEach(async () => {
    server = new McpServer({ name: "test-mutation-server", version: "1.0.0" });
    registerEmailTools(server);

    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "test-mutation-client", version: "1.0.0" });
    await client.connect(clientTransport);

    vi.spyOn(accountManager, "getAccount").mockReturnValue({
      id: "default",
      email: "user@example.com",
    });
  });

  afterEach(async () => {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
  });

  it("应当暴露 mark_email_read、flag_email 与 move_email 工具", async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain("mark_email_read");
    expect(toolNames).toContain("flag_email");
    expect(toolNames).toContain("move_email");
  });

  it("mark_email_read 应支持单封与批量标记已读/未读状态", async () => {
    const mockImapService = {
      markEmailRead: vi.fn().mockResolvedValue({
        success: true,
        count: 2,
        read: true,
      }),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const res = await client.callTool({
      name: "mark_email_read",
      arguments: {
        uids: [101, 102],
        read: true,
        mailbox: "inbox",
      },
    });

    expect(res.isError).toBeFalsy();
    const textContent = (res.content as Array<{ type: string; text: string }>)[0].text;
    const result = JSON.parse(textContent);

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.read).toBe(true);
    expect(mockImapService.markEmailRead).toHaveBeenCalledWith([101, 102], true, "inbox");
  });

  it("flag_email 应支持设置与取消星标", async () => {
    const mockImapService = {
      flagEmail: vi.fn().mockResolvedValue({
        success: true,
        count: 1,
        flagged: true,
      }),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const res = await client.callTool({
      name: "flag_email",
      arguments: {
        uids: 55,
        flagged: true,
      },
    });

    expect(res.isError).toBeFalsy();
    const textContent = (res.content as Array<{ type: string; text: string }>)[0].text;
    const result = JSON.parse(textContent);

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.flagged).toBe(true);
    expect(mockImapService.flagEmail).toHaveBeenCalledWith(55, true, "INBOX");
  });

  it("move_email 应支持跨文件夹转移与软删除至 Trash", async () => {
    const mockImapService = {
      moveEmail: vi.fn().mockResolvedValue({
        success: true,
        count: 1,
        sourceMailbox: "INBOX",
        targetMailbox: "Deleted Messages",
      }),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const res = await client.callTool({
      name: "move_email",
      arguments: {
        uids: [12],
        targetMailbox: "trash",
        sourceMailbox: "inbox",
      },
    });

    expect(res.isError).toBeFalsy();
    const textContent = (res.content as Array<{ type: string; text: string }>)[0].text;
    const result = JSON.parse(textContent);

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.sourceMailbox).toBe("INBOX");
    expect(result.targetMailbox).toBe("Deleted Messages");
    expect(mockImapService.moveEmail).toHaveBeenCalledWith([12], "trash", "inbox");
  });

  it("异常发生时应友好捕获并返回 isError: true", async () => {
    const mockImapService = {
      moveEmail: vi.fn().mockRejectedValue(new Error("邮箱连接超时")),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const res = await client.callTool({
      name: "move_email",
      arguments: {
        uids: 1,
        targetMailbox: "trash",
      },
    });

    expect(res.isError).toBe(true);
    const textContent = (res.content as Array<{ type: string; text: string }>)[0].text;
    expect(textContent).toContain("移动邮件失败: 邮箱连接超时");
  });
});

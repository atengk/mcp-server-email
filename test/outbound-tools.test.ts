/**
 * 外发与协同 MCP 工具端到端集成测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountManager } from "../src/services/account-manager.js";
import * as replyService from "../src/services/reply.service.js";
import { registerEmailTools } from "../src/tools/index.js";

describe("Outbound & Collaboration MCP Tools", () => {
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

  it("应当暴露 reply_email 与 create_draft 工具定义", async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain("send_email");
    expect(toolNames).toContain("reply_email");
    expect(toolNames).toContain("create_draft");
  });

  it("调用 reply_email 应当触发会话回复并返回正确响应", async () => {
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
    vi.spyOn(accountManager, "getImapService").mockReturnValue({} as any);
    vi.spyOn(accountManager, "getSmtpService").mockReturnValue({} as any);

    const replySpy = vi.spyOn(replyService, "replyEmail").mockResolvedValue({
      messageId: "<reply-msg-test@company.com>",
      accepted: ["alice@external.com"],
      inReplyTo: "<orig-123@external.com>",
      references: ["<orig-123@external.com>"],
      to: "alice@external.com",
      subject: "Re: 业务需求探讨",
    });

    const result = await client.callTool({
      name: "reply_email",
      arguments: {
        originalUid: 888,
        text: "已收到并处理。",
      },
    });

    expect(result.isError).toBeFalsy();
    const textContent = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(textContent).toContain("邮件回复成功！");
    expect(textContent).toContain("<reply-msg-test@company.com>");
    expect(replySpy).toHaveBeenCalledWith(
      expect.objectContaining({ originalUid: 888, text: "已收到并处理。" }),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it("调用 create_draft 应当触发草稿存储并返回确认消息", async () => {
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

    const mockImapService = {
      createDraft: vi.fn().mockResolvedValue({
        success: true,
        mailbox: "Drafts",
      }),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const result = await client.callTool({
      name: "create_draft",
      arguments: {
        to: "client@example.com",
        subject: "待审阅方案",
        text: "请审阅附件草案。",
      },
    });

    expect(result.isError).toBeFalsy();
    const textContent = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(textContent).toContain("草稿已成功保存至 [Drafts]");
    expect(mockImapService.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ to: "client@example.com", subject: "待审阅方案" }),
      expect.any(String)
    );
  });
});


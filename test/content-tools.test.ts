/**
 * 邮件正文提纯与附件沙箱落盘 MCP 工具黑盒集成测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountManager } from "../src/services/account-manager.js";
import { registerEmailTools } from "../src/tools/index.js";

describe("Content Purifier & Attachment Sandbox MCP Tools", () => {
  let server: McpServer;
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;
  let tempSandboxDir: string;

  beforeEach(async () => {
    tempSandboxDir = path.join(os.tmpdir(), `mcp-email-test-${Date.now()}`);
    process.env.MCP_ATTACHMENT_DIR = tempSandboxDir;

    server = new McpServer({ name: "test-content-server", version: "1.0.0" });
    registerEmailTools(server);

    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "test-content-client", version: "1.0.0" });
    await client.connect(clientTransport);

    vi.spyOn(accountManager, "getAccount").mockReturnValue({
      id: "default",
      email: "user@example.com",
    });
  });

  afterEach(async () => {
    delete process.env.MCP_ATTACHMENT_DIR;
    await client.close().catch(() => {});
    await server.close().catch(() => {});
    await fs.rm(tempSandboxDir, { recursive: true, force: true }).catch(() => {});
  });

  it("应当暴露 get_email_detail 与 download_attachment 工具", async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain("get_email_detail");
    expect(toolNames).toContain("download_attachment");
  });

  it("get_email_detail 应当提纯 HTML 为 Markdown 并返回脱敏附件元数据（无 Base64）", async () => {
    const mockImapService = {
      getEmailDetail: vi.fn().mockResolvedValue({
        uid: 42,
        from: "Leader <leader@example.com>",
        to: ["user@example.com"],
        subject: "技术规范评审通知",
        date: "2026-10-08T10:00:00.000Z",
        text: "这是纯文本备选",
        html: "<h1>通知</h1><p>请查阅附件<strong>架构图</strong>及规范。</p>",
        bodyMarkdown: "# 通知\n\n请查阅附件**架构图**及规范。",
        truncated: false,
        attachments: [
          {
            id: "0",
            filename: "architecture.png",
            contentType: "image/png",
            size: 1048576,
          },
          {
            id: "1",
            filename: "spec.pdf",
            contentType: "application/pdf",
            size: 2097152,
          },
        ],
      }),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const response = await client.callTool({
      name: "get_email_detail",
      arguments: {
        uid: 42,
        mailbox: "inbox",
      },
    });

    expect(response.isError).toBeFalsy();
    const textContent = (response.content as Array<{ type: string; text: string }>)[0].text;
    const detail = JSON.parse(textContent);

    expect(detail.uid).toBe(42);
    expect(detail.bodyMarkdown).toContain("# 通知");
    expect(detail.bodyMarkdown).toContain("**架构图**");
    expect(detail.truncated).toBe(false);

    // 严格检查附件元数据：严禁携带 base64, buffer 或二进制内容
    expect(detail.attachments).toHaveLength(2);
    expect(detail.attachments[0]).toEqual({
      id: "0",
      filename: "architecture.png",
      contentType: "image/png",
      size: 1048576,
    });
    expect((detail.attachments[0] as any).content).toBeUndefined();
    expect((detail.attachments[0] as any).base64).toBeUndefined();
    expect(mockImapService.getEmailDetail).toHaveBeenCalledWith(42, "inbox");
  });

  it("get_email_detail 遇到超长正文应标记 truncated: true 并包含截断声明", async () => {
    const mockImapService = {
      getEmailDetail: vi.fn().mockResolvedValue({
        uid: 88,
        from: "Big Data <bigdata@example.com>",
        to: ["user@example.com"],
        subject: "超长日志报告",
        date: "2026-10-08T10:00:00.000Z",
        bodyMarkdown: "A".repeat(30720) + "\n\n[提示: 邮件正文已超过 30KB 安全阈值，已执行截断保护]",
        truncated: true,
        attachments: [],
      }),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const response = await client.callTool({
      name: "get_email_detail",
      arguments: { uid: 88 },
    });

    expect(response.isError).toBeFalsy();
    const textContent = (response.content as Array<{ type: string; text: string }>)[0].text;
    const detail = JSON.parse(textContent);

    expect(detail.truncated).toBe(true);
    expect(detail.bodyMarkdown).toContain("已超过 30KB 安全阈值");
  });

  it("download_attachment 应当成功保存附件至受管沙箱并返回物理路径与 file:/// URI", async () => {
    const mockImapService = {
      downloadAttachment: vi.fn().mockResolvedValue({
        attachmentId: "0",
        filename: "report.pdf",
        contentType: "application/pdf",
        size: 1024,
        filePath: path.join(tempSandboxDir, "report.pdf"),
        fileUrl: `file:///${tempSandboxDir.replace(/\\/g, "/")}/report.pdf`,
      }),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const response = await client.callTool({
      name: "download_attachment",
      arguments: {
        uid: 10,
        attachmentId: "0",
        mailbox: "inbox",
      },
    });

    expect(response.isError).toBeFalsy();
    const textContent = (response.content as Array<{ type: string; text: string }>)[0].text;
    const result = JSON.parse(textContent);

    expect(result.attachmentId).toBe("0");
    expect(result.filename).toBe("report.pdf");
    expect(result.filePath).toBe(path.join(tempSandboxDir, "report.pdf"));
    expect(result.fileUrl).toContain("file:///");
    expect(mockImapService.downloadAttachment).toHaveBeenCalledWith(10, "0", "inbox");
  });

  it("download_attachment 遇到路径穿越或提取失败时应返回友好错误", async () => {
    const mockImapService = {
      downloadAttachment: vi.fn().mockRejectedValue(
        new Error('拒绝处理：检测到非法路径穿越文件名 "../../etc/passwd"')
      ),
    };

    vi.spyOn(accountManager, "getImapService").mockReturnValue(mockImapService as any);

    const response = await client.callTool({
      name: "download_attachment",
      arguments: {
        uid: 10,
        attachmentId: "../../etc/passwd",
      },
    });

    expect(response.isError).toBe(true);
    const textContent = (response.content as Array<{ type: string; text: string }>)[0].text;
    expect(textContent).toContain("下载附件失败");
    expect(textContent).toContain("拒绝处理：检测到非法路径穿越文件名");
  });
});

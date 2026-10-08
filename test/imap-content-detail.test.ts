/**
 * ImapService 邮件正文提纯与附件下载方法底层测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ImapService } from "../src/services/imap.service.js";
import type { ImapConfig } from "../src/types/index.js";

describe("ImapService Email Detail & Download Attachment", () => {
  const mockConfig: ImapConfig = {
    host: "imap.example.com",
    port: 993,
    secure: true,
    user: "test@example.com",
    pass: "secret",
  };

  it("getEmailDetail 应自动解析文件夹别名、提纯正文并返回无 Base64 的附件元数据", async () => {
    const rawEml = [
      'From: "Sender Name" <sender@example.com>',
      "To: test@example.com",
      "Subject: =?UTF-8?B?5byA5Y+R5LiO5rWL6K+V?= (开发与测试)",
      'Content-Type: multipart/mixed; boundary="boundary-123"',
      "",
      "--boundary-123",
      'Content-Type: text/html; charset="utf-8"',
      "",
      "<h2>重要提醒</h2><p>点击<a href='https://example.com'>链接</a>查看文档。</p>",
      "--boundary-123",
      'Content-Type: application/pdf; name="report.pdf"',
      "Content-Disposition: attachment; filename=\"report.pdf\"",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from("Mock PDF Attachment Data").toString("base64"),
      "--boundary-123--",
    ].join("\r\n");

    const mockLock = { release: vi.fn() };
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([{ path: "INBOX" }, { path: "Drafts" }]),
      getMailboxLock: vi.fn().mockResolvedValue(mockLock),
      download: vi.fn().mockResolvedValue({
        content: Buffer.from(rawEml),
      }),
    };

    const service = new ImapService(mockConfig);
    (service as any).createClient = () => mockClient;

    const detail = await service.getEmailDetail(123, "inbox");

    expect(mockClient.connect).toHaveBeenCalled();
    expect(mockClient.getMailboxLock).toHaveBeenCalledWith("INBOX");
    expect(detail.uid).toBe(123);
    expect(detail.subject).toContain("开发与测试");
    expect(detail.bodyMarkdown).toContain("## 重要提醒");
    expect(detail.bodyMarkdown).toContain("[链接](https://example.com)");
    expect(detail.truncated).toBe(false);

    // 检查附件元数据脱敏
    expect(detail.attachments).toHaveLength(1);
    expect(detail.attachments[0]).toEqual({
      id: "0",
      filename: "report.pdf",
      contentType: "application/pdf",
      size: Buffer.from("Mock PDF Attachment Data").length,
    });
    // 确保没有 Base64 泄露进 attachments
    expect((detail.attachments[0] as any).content).toBeUndefined();
    expect((detail.attachments[0] as any).base64).toBeUndefined();
    expect(mockLock.release).toHaveBeenCalled();
    expect(mockClient.logout).toHaveBeenCalled();
  });

  it("downloadAttachment 应按索引或文件名提取附件并保存至沙箱", async () => {
    const sandboxDir = path.join(os.tmpdir(), `sandbox-test-${Date.now()}`);
    process.env.MCP_ATTACHMENT_DIR = sandboxDir;

    try {
      const pdfContent = "Mock PDF Binary Content Here!";
      const rawEml = [
        "From: sender@example.com",
        "To: test@example.com",
        "Subject: Attachment Test",
        'Content-Type: multipart/mixed; boundary="b1"',
        "",
        "--b1",
        "Content-Type: text/plain",
        "",
        "Please find attachment.",
        "--b1",
        'Content-Type: text/plain; name="readme.txt"',
        "Content-Disposition: attachment; filename=\"readme.txt\"",
        "",
        pdfContent,
        "--b1--",
      ].join("\r\n");

      const mockLock = { release: vi.fn() };
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([{ path: "INBOX" }]),
        getMailboxLock: vi.fn().mockResolvedValue(mockLock),
        download: vi.fn().mockResolvedValue({
          content: Buffer.from(rawEml),
        }),
      };

      const service = new ImapService(mockConfig);
      (service as any).createClient = () => mockClient;

      // 1. 通过附件文件名下载
      const res = await service.downloadAttachment(50, "readme.txt", "INBOX");
      expect(res.attachmentId).toBe("0");
      expect(res.filename).toBe("readme.txt");
      expect(res.size).toBe(Buffer.byteLength(pdfContent));
      expect(res.filePath).toBe(path.join(sandboxDir, "50", "readme.txt"));
      expect(res.fileUrl.startsWith("file:///")).toBe(true);

      const savedData = await fs.readFile(res.filePath, "utf-8");
      expect(savedData).toBe(pdfContent);

      // 2. 通过索引下载
      const res2 = await service.downloadAttachment(50, "0", "INBOX");
      expect(res2.filename).toBe("readme.txt");

      // 3. 查找不存在的附件应抛错
      await expect(service.downloadAttachment(50, "nonexistent.exe", "INBOX")).rejects.toThrow(
        '未在邮件 (UID: 50) 中找到标识为 "nonexistent.exe" 的附件'
      );
    } finally {
      delete process.env.MCP_ATTACHMENT_DIR;
      await fs.rm(sandboxDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

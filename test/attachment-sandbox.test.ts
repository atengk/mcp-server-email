/**
 * 附件受管沙箱存储服务单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getAttachmentSandboxDir,
  sanitizeFileName,
  saveAttachmentToSandbox,
  validateOutboundAttachmentPath,
} from "../src/services/attachment-sandbox.js";

describe("Attachment Sandbox Service", () => {
  it("应支持从环境变量 MCP_ATTACHMENT_DIR 获取沙箱目录或回退至临时目录", () => {
    const originalEnv = process.env.MCP_ATTACHMENT_DIR;
    try {
      delete process.env.MCP_ATTACHMENT_DIR;
      const defaultDir = getAttachmentSandboxDir();
      expect(defaultDir).toContain("mcp-email-attachments");

      process.env.MCP_ATTACHMENT_DIR = "./custom-sandbox-dir";
      const customDir = getAttachmentSandboxDir();
      expect(customDir).toBe(path.resolve("./custom-sandbox-dir"));
    } finally {
      if (originalEnv) {
        process.env.MCP_ATTACHMENT_DIR = originalEnv;
      } else {
        delete process.env.MCP_ATTACHMENT_DIR;
      }
    }
  });

  it("应正确净化文件名并防御路径穿越攻击", () => {
    // 正常文件名保持不变
    expect(sanitizeFileName("report.pdf")).toBe("report.pdf");
    expect(sanitizeFileName("季度业绩总结_2026.docx")).toBe("季度业绩总结_2026.docx");

    // 剔除特殊非法字符
    expect(sanitizeFileName("test<bad>:file*?.png")).toBe("test_bad__file__.png");

    // 拦截显式路径穿越
    expect(() => sanitizeFileName("../../etc/passwd")).toThrow("拒绝处理");
    expect(() => sanitizeFileName("..\\..\\Windows\\system32\\cmd.exe")).toThrow("拒绝处理");
    expect(() => sanitizeFileName("folder/sub/../../../file.txt")).toThrow("拒绝处理");
  });

  it("应成功将附件保存至沙箱并返回物理绝对路径与 file:/// 直达 URI", async () => {
    const testDir = path.join(os.tmpdir(), `test-sandbox-${Date.now()}`);
    try {
      const buffer = Buffer.from("Hello MCP Email Attachment Sandbox!");
      const result = await saveAttachmentToSandbox("test-doc.txt", buffer, testDir);

      expect(result.filename).toBe("test-doc.txt");
      expect(result.size).toBe(buffer.length);
      expect(result.filePath).toBe(path.join(testDir, "test-doc.txt"));
      expect(result.fileUrl.startsWith("file:///")).toBe(true);

      // 验证物理文件内容存在且正确
      const readContent = await fs.readFile(result.filePath, "utf-8");
      expect(readContent).toBe("Hello MCP Email Attachment Sandbox!");
    } finally {
      await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("应支持按邮件 UID 进行子目录分层隔离，杜绝同名附件相互覆盖", async () => {
    const testDir = path.join(os.tmpdir(), `test-sandbox-uid-${Date.now()}`);
    try {
      const content1 = Buffer.from("Mail 100 Content");
      const content2 = Buffer.from("Mail 200 Content");

      const res1 = await saveAttachmentToSandbox("invoice.pdf", content1, testDir, 100);
      const res2 = await saveAttachmentToSandbox("invoice.pdf", content2, testDir, 200);

      expect(res1.filePath).toBe(path.join(testDir, "100", "invoice.pdf"));
      expect(res2.filePath).toBe(path.join(testDir, "200", "invoice.pdf"));

      const read1 = await fs.readFile(res1.filePath, "utf-8");
      const read2 = await fs.readFile(res2.filePath, "utf-8");
      expect(read1).toBe("Mail 100 Content");
      expect(read2).toBe("Mail 200 Content");
    } finally {
      await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("validateOutboundAttachmentPath 应严格拦截敏感凭据文件外发并允许安全白名单路径", () => {
    // 拦截敏感系统与密钥文件
    expect(() => validateOutboundAttachmentPath(".env")).toThrow("严禁外发系统关键敏感凭据");
    expect(() => validateOutboundAttachmentPath(".env.production")).toThrow("严禁外发系统关键敏感凭据");
    expect(() => validateOutboundAttachmentPath("id_rsa")).toThrow("严禁外发系统关键敏感凭据");
    expect(() => validateOutboundAttachmentPath("/etc/passwd")).toThrow("严禁外发系统关键敏感凭据");
    expect(() => validateOutboundAttachmentPath("server.key")).toThrow("严禁外发系统关键敏感凭据");

    // 允许工作区内普通文件
    const safeLocal = validateOutboundAttachmentPath("./package.json");
    expect(safeLocal).toBe(path.resolve("./package.json"));
  });
});

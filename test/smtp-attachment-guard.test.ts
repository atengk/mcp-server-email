/**
 * 外发附件敏感路径拦截看门狗单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it, vi } from "vitest";
import { SmtpService } from "../src/services/smtp.service.js";
import type { SmtpConfig } from "../src/types/index.js";

describe("Outbound Attachment Guard", () => {
  const mockConfig: SmtpConfig = {
    host: "smtp.example.com",
    port: 465,
    secure: true,
    user: "test@example.com",
    pass: "secret",
  };

  it("当外发附件包含敏感文件路径时应直接拦截报错", async () => {
    const service = new SmtpService(mockConfig);
    const mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: "msg-1", accepted: ["target@example.com"] }),
    };
    (service as any).getTransporter = () => mockTransporter;

    // 1. 尝试外发 .env 文件
    await expect(
      service.sendEmail({
        to: "target@example.com",
        subject: "敏感测试",
        attachments: [
          {
            filename: "env.txt",
            path: "./.env",
          },
        ],
      })
    ).rejects.toThrow("严禁外发系统关键敏感凭据");

    // 2. 尝试外发私钥
    await expect(
      service.sendEmail({
        to: "target@example.com",
        subject: "私钥测试",
        attachments: [
          {
            filename: "key.pem",
            path: "/path/to/server.key",
          },
        ],
      })
    ).rejects.toThrow("严禁外发系统关键敏感凭据");

    // 3. 正常工作区文件允许发送
    const result = await service.sendEmail({
      to: "target@example.com",
      subject: "正常文件",
      attachments: [
        {
          filename: "package.json",
          path: "./package.json",
        },
      ],
    });

    expect(result.messageId).toBe("msg-1");
    expect(mockTransporter.sendMail).toHaveBeenCalled();
  });
});

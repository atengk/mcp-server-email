/**
 * SMTP 邮件外发与邮件头注入单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it, vi } from "vitest";
import { SmtpService } from "../src/services/smtp.service.js";
import type { SmtpConfig } from "../src/types/index.js";

describe("SmtpService Outbound & Threading", () => {
  const mockSmtpConfig: SmtpConfig = {
    host: "smtp.example.com",
    port: 465,
    secure: true,
    user: "bot@example.com",
    pass: "mock-password",
    from: "Bot <bot@example.com>",
  };

  it("应成功组装包含 In-Reply-To、References、CC 与 BCC 的外发载荷", async () => {
    const service = new SmtpService(mockSmtpConfig);

    let sentMailOptions: any = null;
    const mockTransporter = {
      sendMail: vi.fn().mockImplementation(async (options) => {
        sentMailOptions = options;
        return { messageId: "<sent-msg-123@example.com>", accepted: ["recipient@example.com"] };
      }),
    };

    (service as any).getTransporter = () => mockTransporter;

    const result = await service.sendEmail({
      to: "recipient@example.com",
      subject: "Re: 季度工作汇报",
      text: "收到，请查收批注。",
      cc: ["leader@example.com"],
      bcc: "archive@example.com",
      inReplyTo: "<original-msg-001@company.com>",
      references: ["<root-msg-000@company.com>", "<original-msg-001@company.com>"],
    });

    expect(result.messageId).toBe("<sent-msg-123@example.com>");
    expect(result.accepted).toContain("recipient@example.com");

    expect(sentMailOptions).toBeDefined();
    expect(sentMailOptions.to).toBe("recipient@example.com");
    expect(sentMailOptions.cc).toBe("leader@example.com");
    expect(sentMailOptions.bcc).toBe("archive@example.com");
    expect(sentMailOptions.inReplyTo).toBe("<original-msg-001@company.com>");
    expect(sentMailOptions.references).toEqual([
      "<root-msg-000@company.com>",
      "<original-msg-001@company.com>",
    ]);
  });
});

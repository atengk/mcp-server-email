/**
 * 邮件会话回复逻辑单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it, vi } from "vitest";
import { replyEmail } from "../src/services/reply.service.js";
import type { AccountProfile, EmailDetail } from "../src/types/index.js";

describe("Email Reply Workflow", () => {
  const mockAccount: AccountProfile = {
    id: "work",
    email: "me@company.com",
    smtp: {
      host: "smtp.company.com",
      port: 465,
      secure: true,
      user: "me@company.com",
      pass: "mypassword",
      from: "Me <me@company.com>",
    },
    imap: {
      host: "imap.company.com",
      port: 993,
      secure: true,
      user: "me@company.com",
      pass: "mypassword",
    },
  };

  const sampleOriginalEmail: EmailDetail = {
    uid: 101,
    from: "Alice Wonderland <alice@external.com>",
    fromAddress: "alice@external.com",
    to: ["Me <me@company.com>", "Bob <bob@company.com>"],
    cc: ["Charlie <charlie@company.com>"],
    subject: "Q4 财报预算审核计划",
    date: "2026-10-01T08:00:00.000Z",
    text: "请各位确认预算方案。",
    messageId: "<msg-101@external.com>",
    references: ["<msg-001@external.com>"],
    attachments: [],
  };

  it("单人回复应正确提取发件人、注入 In-Reply-To/References 并添加 Re: 前缀", async () => {
    let sentOptions: any = null;

    const mockSmtpService = {
      sendEmail: vi.fn().mockImplementation(async (options) => {
        sentOptions = options;
        return { messageId: "<reply-msg-201@company.com>", accepted: [options.to] };
      }),
    };

    const mockImapService = {
      getEmailDetail: vi.fn().mockResolvedValue(sampleOriginalEmail),
    };

    const result = await replyEmail(
      {
        originalUid: 101,
        text: "方案已审核，整体无误。",
        replyAll: false,
      },
      mockAccount,
      mockImapService as any,
      mockSmtpService as any
    );

    expect(result.messageId).toBe("<reply-msg-201@company.com>");
    expect(result.to).toBe("alice@external.com");
    expect(result.subject).toBe("Re: Q4 财报预算审核计划");
    expect(result.inReplyTo).toBe("<msg-101@external.com>");
    expect(result.references).toEqual(["<msg-001@external.com>", "<msg-101@external.com>"]);
    expect(result.cc).toBeUndefined();

    expect(sentOptions.to).toBe("alice@external.com");
    expect(sentOptions.inReplyTo).toBe("<msg-101@external.com>");
  });

  it("全员回复 (replyAll) 应自动保留抄送人并排除自己与原发件人", async () => {
    const mockSmtpService = {
      sendEmail: vi.fn().mockImplementation(async (options) => {
        return { messageId: "<reply-msg-202@company.com>", accepted: [options.to] };
      }),
    };

    const mockImapService = {
      getEmailDetail: vi.fn().mockResolvedValue(sampleOriginalEmail),
    };

    const result = await replyEmail(
      {
        originalUid: 101,
        text: "同步抄送各位，批准该方案。",
        replyAll: true,
      },
      mockAccount,
      mockImapService as any,
      mockSmtpService as any
    );

    expect(result.to).toBe("alice@external.com");
    // CC 列表应包含 bob 和 charlie，但排除 me@company.com
    expect(result.cc).toBeDefined();
    expect(result.cc).toContain("bob@company.com");
    expect(result.cc).toContain("charlie@company.com");
    expect(result.cc).not.toContain("me@company.com");
  });

  it("原主题若已有 Re: 前缀时不应重复追加", async () => {
    const originalWithRe: EmailDetail = {
      ...sampleOriginalEmail,
      subject: "Re: Q4 财报预算审核计划",
    };

    const mockSmtpService = {
      sendEmail: vi.fn().mockResolvedValue({ messageId: "<reply-msg-203>", accepted: [] }),
    };

    const mockImapService = {
      getEmailDetail: vi.fn().mockResolvedValue(originalWithRe),
    };

    const result = await replyEmail(
      {
        originalUid: 101,
        text: "已再次确认。",
        replyAll: false,
      },
      mockAccount,
      mockImapService as any,
      mockSmtpService as any
    );

    expect(result.subject).toBe("Re: Q4 财报预算审核计划");
  });
});

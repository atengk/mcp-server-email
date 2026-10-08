/**
 * 账户管理服务与动态路由单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it, vi } from "vitest";
import { AccountManager } from "../src/services/account-manager.js";
import { ImapService } from "../src/services/imap.service.js";
import { SmtpService } from "../src/services/smtp.service.js";
import type { AccountProfile } from "../src/types/index.js";

describe("AccountManager", () => {
  const sampleAccounts: AccountProfile[] = [
    {
      id: "personal",
      name: "个人邮箱",
      email: "me@personal.com",
      smtp: {
        host: "smtp.personal.com",
        port: 465,
        secure: true,
        user: "me@personal.com",
        pass: "personal-secret-password",
        from: "Me <me@personal.com>",
      },
      imap: {
        host: "imap.personal.com",
        port: 993,
        secure: true,
        user: "me@personal.com",
        pass: "personal-secret-password",
      },
    },
    {
      id: "work",
      name: "工作邮箱",
      email: "work@company.com",
      smtp: {
        host: "smtp.company.com",
        port: 587,
        secure: false,
        user: "work@company.com",
        pass: "work-secret-password",
      },
      imap: {
        host: "imap.company.com",
        port: 993,
        secure: true,
        user: "work@company.com",
        pass: "work-secret-password",
      },
    },
  ];

  it("listAccounts 应正确脱敏密码并标记默认账户", () => {
    const manager = new AccountManager(sampleAccounts, "personal");
    const list = manager.listAccounts();

    expect(list).toHaveLength(2);

    const personal = list.find((a) => a.id === "personal");
    expect(personal).toBeDefined();
    expect(personal?.isDefault).toBe(true);
    expect(personal?.smtp?.host).toBe("smtp.personal.com");
    expect((personal?.smtp as any)?.pass).toBeUndefined();
    expect((personal?.imap as any)?.pass).toBeUndefined();

    const work = list.find((a) => a.id === "work");
    expect(work).toBeDefined();
    expect(work?.isDefault).toBe(false);
    expect((work?.smtp as any)?.pass).toBeUndefined();
    expect((work?.imap as any)?.pass).toBeUndefined();
  });

  it("getAccount 应支持按标识获取或缺省回退到默认账户", () => {
    const manager = new AccountManager(sampleAccounts, "personal");

    // 指定账户
    const work = manager.getAccount("work");
    expect(work.id).toBe("work");

    // 缺省回退
    const fallback = manager.getAccount();
    expect(fallback.id).toBe("personal");

    // 不存在账户抛错
    expect(() => manager.getAccount("unknown")).toThrowError(/未找到指定标识为 "unknown" 的邮箱账户/);
  });

  it("getSmtpService 与 getImapService 应正确路由并复用服务实例", () => {
    const manager = new AccountManager(sampleAccounts, "personal");

    const smtp1 = manager.getSmtpService("work");
    const smtp2 = manager.getSmtpService("work");
    expect(smtp1).toBe(smtp2);

    const imap1 = manager.getImapService("personal");
    const imap2 = manager.getImapService("personal");
    expect(imap1).toBe(imap2);
  });

  it("verifyConnection 应正确汇总 SMTP 与 IMAP 连通体检报告", async () => {
    const manager = new AccountManager(sampleAccounts, "personal");

    const smtpSpy = vi
      .spyOn(SmtpService.prototype, "verifyConnection")
      .mockResolvedValue(true);
    const imapSpy = vi
      .spyOn(ImapService.prototype, "verifyConnection")
      .mockResolvedValue(true);

    try {
      const report = await manager.verifyConnection("personal");
      expect(report.account).toBe("personal");
      expect(report.smtp.configured).toBe(true);
      expect(report.smtp.success).toBe(true);
      expect(report.imap.configured).toBe(true);
      expect(report.imap.success).toBe(true);
      expect(report.overallSuccess).toBe(true);
    } finally {
      smtpSpy.mockRestore();
      imapSpy.mockRestore();
    }
  });

  it("verifyConnection 在连接失败时应记录错误并标记 overallSuccess 为 false", async () => {
    const manager = new AccountManager(sampleAccounts, "personal");

    const smtpSpy = vi
      .spyOn(SmtpService.prototype, "verifyConnection")
      .mockRejectedValue(new Error("SMTP 认证失败"));
    const imapSpy = vi
      .spyOn(ImapService.prototype, "verifyConnection")
      .mockResolvedValue(true);

    try {
      const report = await manager.verifyConnection("personal");
      expect(report.account).toBe("personal");
      expect(report.smtp.configured).toBe(true);
      expect(report.smtp.success).toBe(false);
      expect(report.smtp.error).toBe("SMTP 认证失败");
      expect(report.overallSuccess).toBe(false);
    } finally {
      smtpSpy.mockRestore();
      imapSpy.mockRestore();
    }
  });
});


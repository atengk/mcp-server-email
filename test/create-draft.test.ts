/**
 * 草稿箱创建与特殊邮箱别名解析测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it, vi } from "vitest";
import { ImapService } from "../src/services/imap.service.js";
import {
  buildRawMimeMessage,
  resolveSpecialMailbox,
} from "../src/services/mailbox-resolver.js";
import type { ImapConfig } from "../src/types/index.js";

describe("Mailbox Resolver & Draft Creation", () => {
  it("resolveSpecialMailbox 应自适应映射不同服务商的草稿箱路径", () => {
    // 场景 1: Gmail
    const gmailFolders = [
      { path: "INBOX", specialUse: "\\Inbox" },
      { path: "[Gmail]/Drafts", specialUse: "\\Drafts" },
      { path: "[Gmail]/Trash", specialUse: "\\Trash" },
    ];
    expect(resolveSpecialMailbox("drafts", gmailFolders)).toBe("[Gmail]/Drafts");
    expect(resolveSpecialMailbox("草稿箱", gmailFolders)).toBe("[Gmail]/Drafts");
    expect(resolveSpecialMailbox("trash", gmailFolders)).toBe("[Gmail]/Trash");

    // 场景 2: QQ 邮箱
    const qqFolders = [
      { path: "INBOX" },
      { path: "草稿箱" },
      { path: "已删除" },
    ];
    expect(resolveSpecialMailbox("drafts", qqFolders)).toBe("草稿箱");
    expect(resolveSpecialMailbox("trash", qqFolders)).toBe("已删除");

    // 场景 3: 标准 IMAP 默认回退
    expect(resolveSpecialMailbox("drafts", [])).toBe("Drafts");
  });

  it("buildRawMimeMessage 应生成包含完整邮件头的 RFC MIME Buffer", async () => {
    const { simpleParser } = await import("mailparser");
    const raw = await buildRawMimeMessage(
      {
        to: "client@example.com",
        subject: "合同初稿请审阅",
        text: "请查阅附件合同草案。",
        cc: "legal@example.com",
      },
      "author@example.com"
    );

    expect(raw).toBeInstanceOf(Buffer);
    const parsed = await simpleParser(raw);
    expect(parsed.from?.text).toContain("author@example.com");
    expect(parsed.to?.text).toContain("client@example.com");
    expect(parsed.subject).toBe("合同初稿请审阅");
    expect(parsed.cc?.text).toContain("legal@example.com");
    expect(parsed.text).toContain("请查阅附件合同草案。");
  });


  it("ImapService.createDraft 应解析草稿箱路径并调用 append 存入草稿", async () => {
    const mockImapConfig: ImapConfig = {
      host: "imap.example.com",
      port: 993,
      secure: true,
      user: "user@example.com",
      pass: "password",
    };

    const imapService = new ImapService(mockImapConfig);

    let appendedMailbox = "";
    let appendedFlags: string[] = [];

    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        { path: "INBOX" },
        { path: "[Gmail]/Drafts", specialUse: "\\Drafts" },
      ]),
      append: vi.fn().mockImplementation(async (mailbox, buffer, flags) => {
        appendedMailbox = mailbox;
        appendedFlags = flags;
        return { uid: 999 };
      }),
    };

    (imapService as any).createClient = () => mockClient;

    const result = await imapService.createDraft(
      {
        to: "boss@example.com",
        subject: "述职报告草稿",
        text: "述职报告正文内容...",
      },
      "user@example.com"
    );

    expect(result.success).toBe(true);
    expect(result.mailbox).toBe("[Gmail]/Drafts");
    expect(appendedMailbox).toBe("[Gmail]/Drafts");
    expect(appendedFlags).toContain("\\Draft");
    expect(mockClient.connect).toHaveBeenCalled();
    expect(mockClient.logout).toHaveBeenCalled();
  });
});

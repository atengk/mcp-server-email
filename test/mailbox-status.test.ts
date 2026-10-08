/**
 * 邮箱状态看板单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it, vi } from "vitest";
import { ImapService } from "../src/services/imap.service.js";
import type { ImapConfig } from "../src/types/index.js";

describe("Mailbox Status Dashboard", () => {
  const mockConfig: ImapConfig = {
    host: "imap.example.com",
    port: 993,
    secure: true,
    user: "user@example.com",
    pass: "mockpass",
  };

  it("查询指定文件夹别名时应解析物理路径并返回状态明细", async () => {
    const service = new ImapService(mockConfig);

    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        { path: "INBOX", specialUse: "\\Inbox" },
        { path: "[Gmail]/Drafts", specialUse: "\\Drafts" },
      ]),
      status: vi.fn().mockImplementation(async (path) => {
        if (path === "[Gmail]/Drafts") {
          return { messages: 5, unseen: 2, recent: 1 };
        }
        return { messages: 100, unseen: 10, recent: 2 };
      }),
    };

    (service as any).createClient = () => mockClient;

    const report = await service.getMailboxStatus("drafts");

    expect(report.mailboxes).toHaveLength(1);
    expect(report.mailboxes[0].mailbox).toBe("[Gmail]/Drafts");
    expect(report.mailboxes[0].total).toBe(5);
    expect(report.mailboxes[0].unseen).toBe(2);
    expect(report.mailboxes[0].recent).toBe(1);
    expect(report.totalUnseen).toBe(2);
    expect(report.totalMessages).toBe(5);

    expect(mockClient.status).toHaveBeenCalledWith("[Gmail]/Drafts", {
      messages: true,
      unseen: true,
      recent: true,
    });
  });

  it("缺省文件夹参数时应遍历所有物理邮箱并统计全局总数", async () => {
    const service = new ImapService(mockConfig);

    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        { path: "INBOX" },
        { path: "Sent" },
        { path: "Trash" },
      ]),
      status: vi.fn().mockImplementation(async (path) => {
        if (path === "INBOX") return { messages: 50, unseen: 8, recent: 2 };
        if (path === "Sent") return { messages: 30, unseen: 0, recent: 0 };
        return { messages: 10, unseen: 1, recent: 0 };
      }),
    };

    (service as any).createClient = () => mockClient;

    const report = await service.getMailboxStatus();

    expect(report.mailboxes).toHaveLength(3);
    expect(report.totalMessages).toBe(90);
    expect(report.totalUnseen).toBe(9);
  });
});

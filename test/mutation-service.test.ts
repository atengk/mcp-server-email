/**
 * 邮件状态变更、星标置顶与跨文件夹移动底层服务单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it, vi } from "vitest";
import { ImapService } from "../src/services/imap.service.js";
import type { ImapConfig } from "../src/types/index.js";

describe("ImapService Mutation & Soft Deletion", () => {
  const mockConfig: ImapConfig = {
    host: "imap.example.com",
    port: 993,
    secure: true,
    user: "user@example.com",
    pass: "secret",
  };

  it("markEmailRead 应支持单封与批量 UID 设置已读 (\\Seen) 或未读", async () => {
    const mockLock = { release: vi.fn() };
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([{ path: "INBOX" }]),
      getMailboxLock: vi.fn().mockResolvedValue(mockLock),
      messageFlagsAdd: vi.fn().mockResolvedValue(true),
      messageFlagsRemove: vi.fn().mockResolvedValue(true),
    };

    const service = new ImapService(mockConfig);
    (service as any).createClient = () => mockClient;

    // 1. 批量标记已读
    const res1 = await service.markEmailRead([102, 101, 102], true, "inbox");
    expect(res1).toEqual({
      success: true,
      count: 2,
      read: true,
    });
    expect(mockClient.getMailboxLock).toHaveBeenCalledWith("INBOX");
    expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith("101,102", ["\\Seen"], { uid: true });
    expect(mockLock.release).toHaveBeenCalled();

    // 2. 单封标记未读
    const res2 = await service.markEmailRead(88, false, "INBOX");
    expect(res2).toEqual({
      success: true,
      count: 1,
      read: false,
    });
    expect(mockClient.messageFlagsRemove).toHaveBeenCalledWith("88", ["\\Seen"], { uid: true });

    // 3. 空 UID 列表防御
    await expect(service.markEmailRead([], true)).rejects.toThrow("请提供至少一个有效");
  });

  it("flagEmail 应支持设置与取消星标置顶 (\\Flagged)", async () => {
    const mockLock = { release: vi.fn() };
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([{ path: "INBOX" }]),
      getMailboxLock: vi.fn().mockResolvedValue(mockLock),
      messageFlagsAdd: vi.fn().mockResolvedValue(true),
      messageFlagsRemove: vi.fn().mockResolvedValue(true),
    };

    const service = new ImapService(mockConfig);
    (service as any).createClient = () => mockClient;

    // 1. 设置星标
    const res1 = await service.flagEmail([50, 60], true, "inbox");
    expect(res1).toEqual({
      success: true,
      count: 2,
      flagged: true,
    });
    expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith("50,60", ["\\Flagged"], { uid: true });

    // 2. 取消星标
    const res2 = await service.flagEmail(50, false, "inbox");
    expect(res2).toEqual({
      success: true,
      count: 1,
      flagged: false,
    });
    expect(mockClient.messageFlagsRemove).toHaveBeenCalledWith("50", ["\\Flagged"], { uid: true });
  });

  it("moveEmail 应自动解析目标别名并实现软删除与文件夹流转（防灾无 EXPUNGE）", async () => {
    const mockLock = { release: vi.fn() };
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        { path: "INBOX" },
        { path: "Deleted Messages", specialUse: "\\Trash" },
        { path: "Archive" },
      ]),
      getMailboxLock: vi.fn().mockResolvedValue(mockLock),
      messageMove: vi.fn().mockResolvedValue(true),
    };

    const service = new ImapService(mockConfig);
    (service as any).createClient = () => mockClient;

    // 1. 软删除：移动至逻辑别名 "trash"，自动解析为物理 "Deleted Messages"
    const resTrash = await service.moveEmail([1, 2, 3], "trash", "inbox");
    expect(resTrash).toEqual({
      success: true,
      count: 3,
      sourceMailbox: "INBOX",
      targetMailbox: "Deleted Messages",
    });
    expect(mockClient.getMailboxLock).toHaveBeenCalledWith("INBOX");
    expect(mockClient.messageMove).toHaveBeenCalledWith("1,2,3", "Deleted Messages", { uid: true });

    // 2. 文件夹归档流转：从 INBOX 移动至 Archive
    const resArchive = await service.moveEmail(99, "Archive", "inbox");
    expect(resArchive).toEqual({
      success: true,
      count: 1,
      sourceMailbox: "INBOX",
      targetMailbox: "Archive",
    });
    expect(mockClient.messageMove).toHaveBeenCalledWith("99", "Archive", { uid: true });
    expect(mockLock.release).toHaveBeenCalled();
  });
});

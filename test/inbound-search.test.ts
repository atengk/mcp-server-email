/**
 * 多维检索分页与 Preview Snippet 提取单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it, vi } from "vitest";
import { ImapService } from "../src/services/imap.service.js";
import {
  extractPreviewSnippet,
  parseBodyFromRawOrParts,
} from "../src/services/mailbox-resolver.js";
import type { ImapConfig } from "../src/types/index.js";

describe("Inbound Search & Preview Snippet", () => {
  it("extractPreviewSnippet 应净化 HTML/CSS/脚本并截断至 150 字符 Preview 摘要", () => {
    const rawHtml = `
      <html>
        <head>
          <style>body { color: red; font-size: 14px; }</style>
          <script>alert('malicious script');</script>
        </head>
        <body>
          <p>尊敬的客户&nbsp;：&amp;合作伙伴，</p>
          <div>
            这是关于 2026 年第四季度战略合作规划的备忘录。我们计划在下个月初正式启动联合研发项目，并召开线上评审启动会。请查阅详细日程并于本周五前反馈意见。感谢您的持续支持与配合！期待后续深入沟通交流。为了确保各项工作能够按时保质完成，请相关部门负责人务必于明天下午下班前提交初步人员名单及里程碑时间表。
          </div>
        </body>
      </html>
    `;

    const snippet = extractPreviewSnippet(rawHtml, 150);

    expect(snippet).not.toContain("<style>");
    expect(snippet).not.toContain("alert(");
    expect(snippet).not.toContain("<p>");
    expect(snippet).not.toContain("&nbsp;");
    expect(snippet).toContain("尊敬的客户 ：&合作伙伴");
    expect(snippet.length).toBe(153); // 150 + '...'
    expect(snippet.endsWith("...")).toBe(true);

    // 测试未超长文本不应带有省略号
    const shortText = "简短邮件通知。";
    expect(extractPreviewSnippet(shortText, 150)).toBe("简短邮件通知。");
  });


  it("parseBodyFromRawOrParts 应能从 bodyParts 或 raw source 中提取文本", () => {
    const bodyPartsMap = new Map<string, Buffer>();
    bodyPartsMap.set("1", Buffer.from("这是来自 bodyParts 1 的纯文本正文内容"));
    expect(parseBodyFromRawOrParts(bodyPartsMap)).toBe("这是来自 bodyParts 1 的纯文本正文内容");

    const rawSource = Buffer.from(
      "From: a@b.com\r\nTo: c@d.com\r\n\r\n这是来自 raw source 的正文内容"
    );
    expect(parseBodyFromRawOrParts(undefined, rawSource)).toBe("这是来自 raw source 的正文内容");
  });

  it("searchEmails 应支持多维条件搜索、特殊别名解析及 page/limit 分页计算", async () => {
    const mockConfig: ImapConfig = {
      host: "imap.example.com",
      port: 993,
      secure: true,
      user: "user@example.com",
      pass: "mockpass",
    };

    const service = new ImapService(mockConfig);

    const mockUids = Array.from({ length: 25 }, (_, i) => i + 1); // UIDs: 1..25

    let searchedCriteria: any = null;
    let fetchedUids: number[] = [];

    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        { path: "INBOX" },
        { path: "[Gmail]/Trash", specialUse: "\\Trash" },
      ]),
      getMailboxLock: vi.fn().mockResolvedValue({
        release: vi.fn(),
      }),
      search: vi.fn().mockImplementation(async (criteria) => {
        searchedCriteria = criteria;
        return mockUids;
      }),
      fetch: vi.fn().mockImplementation(async function* (uids) {
        fetchedUids = uids;
        for (const uid of uids) {
          yield {
            uid,
            seq: uid,
            envelope: {
              from: [{ name: "Alice", address: "alice@example.com" }],
              subject: `测试邮件 #${uid}`,
              date: new Date("2026-10-08T00:00:00Z"),
            },
            flags: new Set(["\\Seen"]),
            bodyStructure: { childNodes: [] },
            source: Buffer.from(`From: a@b.com\r\n\r\n正文摘要内容 #${uid}`),
          };
        }
      }),
    };

    (service as any).createClient = () => mockClient;

    // 检索第 1 页，每页 10 条，指定别名 "trash"
    const resultPage1 = await service.searchEmails({
      mailbox: "trash",
      unseenOnly: true,
      flaggedOnly: true,
      query: "项目方案",
      page: 1,
      limit: 10,
    });

    expect(searchedCriteria.seen).toBe(false);
    expect(searchedCriteria.flagged).toBe(true);
    expect(searchedCriteria.body).toBe("项目方案");

    expect(resultPage1.total).toBe(25);
    expect(resultPage1.page).toBe(1);
    expect(resultPage1.limit).toBe(10);
    expect(resultPage1.hasMore).toBe(true);
    expect(resultPage1.items).toHaveLength(10);
    // 最新逆序优先：第 1 页应为 UID 25..16
    expect(resultPage1.items[0].uid).toBe(25);
    expect(resultPage1.items[0].preview).toContain("正文摘要内容 #25");

    // 检索第 3 页，每页 10 条（剩余 5 条，无下一页）
    const resultPage3 = await service.searchEmails({
      mailbox: "trash",
      page: 3,
      limit: 10,
    });

    expect(resultPage3.page).toBe(3);
    expect(resultPage3.hasMore).toBe(false);
    expect(resultPage3.items).toHaveLength(5);
    expect(resultPage3.items[0].uid).toBe(5);
  });

  it("searchEmails 带有 hasAttachment 过滤时应通过窗口探测回填紧凑分页", async () => {
    const mockConfig: ImapConfig = {
      host: "imap.example.com",
      port: 993,
      secure: true,
      user: "test@example.com",
      pass: "secret",
    };

    const service = new ImapService(mockConfig);
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([{ path: "INBOX" }]),
      getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
      search: vi.fn().mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      fetch: vi.fn().mockImplementation(async function* (uids: number[]) {
        for (const uid of uids) {
          // 仅偶数 UID 带有附件 (childNodes 长度为 2)
          const hasAtt = uid % 2 === 0;
          yield {
            uid,
            seq: uid,
            envelope: {
              subject: `测试主题 #${uid}`,
              from: [{ name: "Sender", address: "sender@example.com" }],
              date: new Date(),
            },
            flags: new Set(),
            bodyStructure: {
              childNodes: hasAtt ? [{}, {}] : [{}],
            },
            source: Buffer.from(`内容 #${uid}`),
          };
        }
      }),
    };

    (service as any).createClient = () => mockClient;

    const res = await service.searchEmails({
      mailbox: "inbox",
      hasAttachment: true,
      page: 1,
      limit: 3,
    });

    // 偶数 UID 为 10, 8, 6, 4, 2，共 5 封有附件
    expect(res.total).toBe(5);
    expect(res.items).toHaveLength(3);
    expect(res.items[0].uid).toBe(10);
    expect(res.items[1].uid).toBe(8);
    expect(res.items[2].uid).toBe(6);
    expect(res.hasMore).toBe(true);
  });
});

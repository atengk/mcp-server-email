/**
 * IMAP 邮件查收与检索服务
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { config } from "../config/index.js";
import type {
  DownloadAttachmentResult,
  EmailAttachmentMetadata,
  EmailDetail,
  EmailSummary,
  FlagEmailResult,
  ImapConfig,
  MailboxStatus,
  MailboxStatusReport,
  MarkEmailReadResult,
  MoveEmailResult,
  SearchEmailFilter,
  SearchEmailsResult,
  SendEmailOptions,
} from "../types/index.js";
import {
  buildRawMimeMessage,
  extractPreviewSnippet,
  parseBodyFromRawOrParts,
  resolveSpecialMailbox,
} from "./mailbox-resolver.js";
import { purifyEmailBody } from "./content-purifier.js";
import { saveAttachmentToSandbox } from "./attachment-sandbox.js";




/**
 * IMAP 邮件存储交互服务
 */
export class ImapService {
  constructor(private readonly imapConfig?: ImapConfig) {}

  /**
   * 创建新的 IMAP 客户端连接
   *
   * @returns 初始化的 ImapFlow 客户端实例
   * @throws Error 当未配置 IMAP 主机或账号时
   */
  private createClient(): ImapFlow {
    const host = this.imapConfig?.host || config.MCP_IMAP_HOST;
    const port = this.imapConfig?.port ?? config.MCP_IMAP_PORT;
    const secure = this.imapConfig?.secure ?? config.MCP_IMAP_SECURE;
    const user = this.imapConfig?.user || config.MCP_IMAP_USER;
    const pass = this.imapConfig?.pass || config.MCP_IMAP_PASS;

    if (!host || !user || !pass) {
      throw new Error(
        "IMAP 配置不完整：请确保已配置 MCP_IMAP_HOST、MCP_IMAP_USER 和 MCP_IMAP_PASS 环境变量"
      );
    }

    return new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      logger: false, // 禁用内部控制台输出，保护 MCP Stdio 通信通道
    });
  }

  /**
   * 获取远程邮箱目录列表
   *
   * @returns 邮箱目录路径列表
   */
  async listMailboxes(): Promise<string[]> {
    const client = this.createClient();
    await client.connect();

    try {
      const mailboxes = await client.list();
      return mailboxes.map((item) => item.path);
    } finally {
      await client.logout().catch(() => {});
    }
  }

  /**
   * 检索符合条件的邮件摘要列表
   *
   * @param filter 检索与过滤条件
   * @returns 分页检索结果与条目摘要
   */
  async searchEmails(filter: SearchEmailFilter): Promise<SearchEmailsResult> {
    const client = this.createClient();
    await client.connect();

    try {
      // 1. 获取物理邮箱列表并解析逻辑别名
      const allMailboxes = await client.list();
      const targetMailbox = resolveSpecialMailbox(filter.mailbox || "INBOX", allMailboxes);

      const lock = await client.getMailboxLock(targetMailbox);
      try {
        // 2. 组装 IMAP 查询条件字典
        const query: Record<string, unknown> = {};

        if (filter.query) {
          query.body = filter.query;
        }
        if (filter.unseenOnly) {
          query.seen = false;
        }
        if (filter.flaggedOnly) {
          query.flagged = true;
        }
        if (filter.from) {
          query.from = filter.from;
        }
        if (filter.to) {
          query.to = filter.to;
        }
        if (filter.subject) {
          query.subject = filter.subject;
        }
        if (filter.since) {
          query.since = new Date(filter.since);
        }
        if (filter.before) {
          query.before = new Date(filter.before);
        }

        const searchCriteria = Object.keys(query).length > 0 ? query : { all: true };
        const searchResult = await client.search(searchCriteria, { uid: true });
        const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

        const total = uids.length;
        const page = filter.page && filter.page > 0 ? filter.page : 1;
        const limit = filter.limit && filter.limit > 0 ? filter.limit : 10;

        if (total === 0) {
          return {
            items: [],
            total: 0,
            page,
            limit,
            hasMore: false,
          };
        }

        // 3. 计算分页切片与拉取条目
        const sortedUids = [...uids].reverse();
        let selectedUids: number[] = [];
        let effectiveTotal = total;
        let hasMore = false;

        if (filter.hasAttachment === undefined) {
          // 常规无附件过滤场景：直接高效分页切片
          const startIndex = (page - 1) * limit;
          selectedUids = sortedUids.slice(startIndex, startIndex + limit);
          hasMore = startIndex + limit < total;
        } else {
          // 带有附件过滤场景：窗口探测回填（最大探测深度 100 封，消除分页稀疏断层）
          const maxScanLimit = Math.min(sortedUids.length, 100);
          const scanUids = sortedUids.slice(0, maxScanLimit);
          const matchedUids: number[] = [];

          if (scanUids.length > 0) {
            for await (const message of client.fetch(scanUids, {
              uid: true,
              bodyStructure: true,
            })) {
              const hasAttachments = Boolean(
                message.bodyStructure?.childNodes &&
                  message.bodyStructure.childNodes.length > 1
              );
              if (hasAttachments === filter.hasAttachment) {
                matchedUids.push(message.uid);
              }
            }
          }

          // 保持逆序排布（最新邮件优先）
          matchedUids.sort((a, b) => b - a);
          effectiveTotal = matchedUids.length;
          const startIndex = (page - 1) * limit;
          selectedUids = matchedUids.slice(startIndex, startIndex + limit);
          hasMore = startIndex + limit < matchedUids.length;
        }

        const items: EmailSummary[] = [];

        if (selectedUids.length > 0) {
          for await (const message of client.fetch(selectedUids, {
            envelope: true,
            flags: true,
            internalDate: true,
            uid: true,
            bodyStructure: true,
            bodyParts: ["TEXT", "1"],
            source: { maxLength: 2048 },
          })) {
            const hasAttachments = Boolean(
              message.bodyStructure?.childNodes &&
                message.bodyStructure.childNodes.length > 1
            );

            const fromAddr = message.envelope?.from?.[0]
              ? `${message.envelope.from[0].name || ""} <${message.envelope.from[0].address || ""}>`.trim()
              : "未知发件人";

            // 提取正文并清洗为 150 字符 Preview 摘要
            const rawBody = parseBodyFromRawOrParts(message.bodyParts, message.source);
            const preview = extractPreviewSnippet(rawBody, 150);

            items.push({
              uid: message.uid,
              seq: message.seq,
              from: fromAddr,
              subject: message.envelope?.subject || "(无主题)",
              date: message.envelope?.date?.toISOString() || new Date().toISOString(),
              unseen: !message.flags?.has("\\Seen"),
              hasAttachments,
              preview,
            });
          }

          // 保证返回项顺序与 selectedUids 顺序一致
          items.sort((a, b) => b.uid - a.uid);
        }

        return {
          items,
          total: effectiveTotal,
          page,
          limit,
          hasMore,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }

  }

  /**
   * 根据 UID 获取邮件正文及附件明细（包含 Markdown 提纯与附件元数据清单）
   *
   * @param uid 邮件唯一标识符
   * @param mailbox 所处邮箱文件夹或别名，默认 INBOX
   * @returns 邮件详情数据
   */
  async getEmailDetail(uid: number, mailbox = "INBOX"): Promise<EmailDetail> {
    const client = this.createClient();
    await client.connect();

    try {
      const mailboxes = await client.list();
      const targetMailbox = resolveSpecialMailbox(mailbox, mailboxes);

      const lock = await client.getMailboxLock(targetMailbox);
      try {
        const download = await client.download(String(uid), undefined, { uid: true });
        if (!download || !download.content) {
          throw new Error(`未找到 UID 为 ${uid} 的邮件内容`);
        }

        const parsed = await simpleParser(download.content);

        const toList: string[] = [];
        if (parsed.to) {
          if (Array.isArray(parsed.to)) {
            parsed.to.forEach((addr) => toList.push(addr.text));
          } else {
            toList.push(parsed.to.text);
          }
        }

        const ccList: string[] = [];
        if (parsed.cc) {
          if (Array.isArray(parsed.cc)) {
            parsed.cc.forEach((addr) => ccList.push(addr.text));
          } else {
            ccList.push(parsed.cc.text);
          }
        }

        // 仅提取轻量元数据清单，严禁嵌入大体积 Base64，保护 Token 经济性
        const attachments: EmailAttachmentMetadata[] = (parsed.attachments || []).map((att, idx) => ({
          id: String(idx),
          filename: att.filename || `attachment-${idx}`,
          contentType: att.contentType || "application/octet-stream",
          size: att.size || (att.content ? att.content.length : 0),
        }));

        const fromAddress = parsed.from?.value?.[0]?.address || undefined;
        let references: string[] | undefined;
        if (parsed.references) {
          references = Array.isArray(parsed.references)
            ? parsed.references
            : [parsed.references];
        }

        // 清洗提纯 HTML 为轻量 Markdown，执行 30KB 安全截断
        const purified = purifyEmailBody(
          parsed.text,
          typeof parsed.html === "string" ? parsed.html : undefined
        );

        return {
          uid,
          from: parsed.from?.text || "未知发件人",
          fromAddress,
          to: toList,
          cc: ccList.length > 0 ? ccList : undefined,
          subject: parsed.subject || "(无主题)",
          date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
          text: parsed.text,
          html: typeof parsed.html === "string" ? parsed.html : undefined,
          bodyMarkdown: purified.content,
          truncated: purified.truncated,
          messageId: parsed.messageId,
          inReplyTo: parsed.inReplyTo,
          references,
          attachments,
        };

      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  /**
   * 从指定邮件中提取附件并下载保存至受管本地沙箱
   *
   * @param uid 邮件唯一标识符
   * @param attachmentIdentifier 附件唯一标识（ID 序号或文件名）
   * @param mailbox 所在邮箱文件夹，默认 INBOX
   * @returns 下载落盘结果
   * @throws Error 当未找到邮件或目标附件时
   */
  async downloadAttachment(
    uid: number,
    attachmentIdentifier: string,
    mailbox = "INBOX"
  ): Promise<DownloadAttachmentResult> {
    const client = this.createClient();
    await client.connect();

    try {
      const mailboxes = await client.list();
      const targetMailbox = resolveSpecialMailbox(mailbox, mailboxes);

      const lock = await client.getMailboxLock(targetMailbox);
      try {
        const download = await client.download(String(uid), undefined, { uid: true });
        if (!download || !download.content) {
          throw new Error(`未找到 UID 为 ${uid} 的邮件内容`);
        }

        const parsed = await simpleParser(download.content);
        const attachments = parsed.attachments || [];

        // 优先通过数字索引匹配，其次匹配文件名
        const targetIndex = attachments.findIndex(
          (att, idx) =>
            String(idx) === String(attachmentIdentifier) ||
            att.filename === attachmentIdentifier
        );

        if (targetIndex === -1) {
          throw new Error(
            `未在邮件 (UID: ${uid}) 中找到标识为 "${attachmentIdentifier}" 的附件`
          );
        }

        const targetAttachment = attachments[targetIndex];
        if (!targetAttachment.content) {
          throw new Error(
            `附件 "${targetAttachment.filename || attachmentIdentifier}" 内容为空或无法提取`
          );
        }

        const rawFileName = targetAttachment.filename || `attachment-${targetIndex}`;
        const saved = await saveAttachmentToSandbox(rawFileName, targetAttachment.content, undefined, uid);

        return {
          attachmentId: String(targetIndex),
          filename: saved.filename,
          contentType: targetAttachment.contentType || "application/octet-stream",
          size: saved.size,
          filePath: saved.filePath,
          fileUrl: saved.fileUrl,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  /**
   * 验证 IMAP 服务的网络握手与身份认证
   *
   * @returns 是否连接成功
   */
  async verifyConnection(): Promise<boolean> {
    const client = this.createClient();
    try {
      await client.connect();
      return true;
    } finally {
      await client.logout().catch(() => {});
    }
  }

  /**
   * 将邮件载荷组装为 RFC 822 MIME 数据并存入草稿箱
   *
   * @param options 邮件选项载荷
   * @param from 发件人地址
   * @returns 存储结果，包含物理草稿箱路径
   */
  async createDraft(
    options: SendEmailOptions,
    from: string
  ): Promise<{ success: boolean; mailbox: string }> {
    const client = this.createClient();
    await client.connect();

    try {
      // 1. 获取邮箱列表并解析物理草稿箱路径
      const mailboxes = await client.list();
      const draftsPath = resolveSpecialMailbox("drafts", mailboxes);

      // 2. 组装标准 RFC MIME Buffer
      const rawMime = await buildRawMimeMessage(options, from);

      // 3. 追加至草稿箱，打上 \Draft 与 \Seen 标记
      await client.append(draftsPath, rawMime, ["\\Draft", "\\Seen"]);

      return {
        success: true,
        mailbox: draftsPath,
      };
    } finally {
      await client.logout().catch(() => {});
    }
  }

  /**
   * 极速获取邮箱文件夹状态与未读统计看板
   *
   * @param mailboxAlias 可选指定文件夹别名或物理路径，缺省时查询全部可用文件夹
   * @returns 邮箱状态看板概览报告
   */
  async getMailboxStatus(mailboxAlias?: string): Promise<MailboxStatusReport> {
    const client = this.createClient();
    await client.connect();

    try {
      const allMailboxes = await client.list();

      // 1. 如果指定了具体文件夹（如 "INBOX", "drafts" 等），解析别名并只查该文件夹
      if (mailboxAlias && mailboxAlias.toUpperCase() !== "ALL") {
        const resolvedPath = resolveSpecialMailbox(mailboxAlias, allMailboxes);
        const status = await client.status(resolvedPath, {
          messages: true,
          unseen: true,
          recent: true,
        });

        const item: MailboxStatus = {
          mailbox: resolvedPath,
          total: status.messages || 0,
          unseen: status.unseen || 0,
          recent: status.recent || 0,
        };

        return {
          mailboxes: [item],
          totalUnseen: item.unseen,
          totalMessages: item.total,
        };
      }

      // 2. 缺省或 ALL 时，并发管道化统计所有物理邮箱状态
      const statusPromises = allMailboxes.map(async (box) => {
        try {
          const status = await client.status(box.path, {
            messages: true,
            unseen: true,
            recent: true,
          });

          return {
            mailbox: box.path,
            total: status.messages || 0,
            unseen: status.unseen || 0,
            recent: status.recent || 0,
          };
        } catch {
          // 部分特殊目录可能不支持 STATUS，静默降级为 0
          return {
            mailbox: box.path,
            total: 0,
            unseen: 0,
            recent: 0,
          };
        }
      });

      const items = await Promise.all(statusPromises);
      let totalUnseen = 0;
      let totalMessages = 0;

      for (const item of items) {
        totalUnseen += item.unseen;
        totalMessages += item.total;
      }

      return {
        mailboxes: items,
        totalUnseen,
        totalMessages,
      };
    } finally {
      await client.logout().catch(() => {});
    }
  }

  /**
   * 将邮件 UID 或 UID 列表格式化为 IMAP SequenceSet 字符串并执行有效性校验
   *
   * @param uids 单个 UID 或 UID 数组
   * @returns 规整后的 IMAP 查询范围字符串与计数
   * @throws Error 当未提供任何有效 UID 时
   */
  private formatUidRange(uids: number | number[]): { range: string; count: number } {
    const list = Array.isArray(uids) ? uids : [uids];
    const valid = list.filter((u) => typeof u === "number" && !isNaN(u) && u > 0);
    if (valid.length === 0) {
      throw new Error("请提供至少一个有效的邮件 UID 标识符");
    }
    const sorted = Array.from(new Set(valid)).sort((a, b) => a - b);
    return {
      range: sorted.join(","),
      count: sorted.length,
    };
  }

  /**
   * 修改邮件的已读/未读状态标记 (\Seen)
   *
   * @param uids 单个邮件 UID 或 UID 列表
   * @param read 是否标记为已读（true 为已读，false 为未读，默认 true）
   * @param mailbox 所在邮箱文件夹别名或物理路径，默认 INBOX
   * @returns 状态流转操作结果
   */
  async markEmailRead(
    uids: number | number[],
    read = true,
    mailbox = "INBOX"
  ): Promise<MarkEmailReadResult> {
    const client = this.createClient();
    await client.connect();

    try {
      const mailboxes = await client.list();
      const resolvedMailbox = resolveSpecialMailbox(mailbox, mailboxes);

      const lock = await client.getMailboxLock(resolvedMailbox);
      try {
        const { range, count } = this.formatUidRange(uids);
        if (read) {
          await client.messageFlagsAdd(range, ["\\Seen"], { uid: true });
        } else {
          await client.messageFlagsRemove(range, ["\\Seen"], { uid: true });
        }

        return {
          success: true,
          count,
          read,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  /**
   * 修改邮件的星标/置顶标记 (\Flagged)
   *
   * @param uids 单个邮件 UID 或 UID 列表
   * @param flagged 是否设置星标（true 为星标，false 为取消星标，默认 true）
   * @param mailbox 所在邮箱文件夹别名或物理路径，默认 INBOX
   * @returns 星标设置操作结果
   */
  async flagEmail(
    uids: number | number[],
    flagged = true,
    mailbox = "INBOX"
  ): Promise<FlagEmailResult> {
    const client = this.createClient();
    await client.connect();

    try {
      const mailboxes = await client.list();
      const resolvedMailbox = resolveSpecialMailbox(mailbox, mailboxes);

      const lock = await client.getMailboxLock(resolvedMailbox);
      try {
        const { range, count } = this.formatUidRange(uids);
        if (flagged) {
          await client.messageFlagsAdd(range, ["\\Flagged"], { uid: true });
        } else {
          await client.messageFlagsRemove(range, ["\\Flagged"], { uid: true });
        }

        return {
          success: true,
          count,
          flagged,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  /**
   * 将邮件跨文件夹移动或转移至回收站进行安全软删除（彻底杜绝物理硬删除 EXPUNGE）
   *
   * @param uids 单个邮件 UID 或 UID 列表
   * @param targetMailbox 目标邮箱文件夹别名或物理路径（如 trash, archive, INBOX）
   * @param sourceMailbox 源邮箱文件夹别名或物理路径，默认 INBOX
   * @returns 移动结果，包含实际物理源路径与目标路径
   */
  async moveEmail(
    uids: number | number[],
    targetMailbox: string,
    sourceMailbox = "INBOX"
  ): Promise<MoveEmailResult> {
    const client = this.createClient();
    await client.connect();

    try {
      const mailboxes = await client.list();
      const resolvedSource = resolveSpecialMailbox(sourceMailbox, mailboxes);
      const resolvedTarget = resolveSpecialMailbox(targetMailbox, mailboxes);

      const lock = await client.getMailboxLock(resolvedSource);
      try {
        const { range, count } = this.formatUidRange(uids);
        await client.messageMove(range, resolvedTarget, { uid: true });

        return {
          success: true,
          count,
          sourceMailbox: resolvedSource,
          targetMailbox: resolvedTarget,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }
}

export const imapService = new ImapService();



/**
 * IMAP 邮件查收与检索服务
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { config } from "../config/index.js";
import type { EmailDetail, EmailSummary, ImapConfig, SearchEmailFilter } from "../types/index.js";

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
   * @returns 匹配的邮件摘要列表，无结果时返回空集合
   */
  async searchEmails(filter: SearchEmailFilter): Promise<EmailSummary[]> {
    const client = this.createClient();
    await client.connect();

    const targetMailbox = filter.mailbox || "INBOX";

    try {
      const lock = await client.getMailboxLock(targetMailbox);
      try {
        const query: Record<string, unknown> = {};

        if (filter.unseenOnly) {
          query.seen = false;
        }
        if (filter.from) {
          query.from = filter.from;
        }
        if (filter.subject) {
          query.subject = filter.subject;
        }
        if (filter.since) {
          query.since = new Date(filter.since);
        }

        const limit = filter.limit && filter.limit > 0 ? filter.limit : 10;
        const results: EmailSummary[] = [];

        // 默认若没有任何过滤条件，则按全部查询
        const searchCriteria = Object.keys(query).length > 0 ? query : { all: true };
        const uids = await client.search(searchCriteria, { uid: true });

        if (!uids || uids.length === 0) {
          return [];
        }

        // 取最新的 limit 封邮件 (逆序切片)
        const selectedUids = uids.slice(-limit).reverse();

        for await (const message of client.fetch(selectedUids, {
          envelope: true,
          flags: true,
          internalDate: true,
          uid: true,
          bodyStructure: true,
        })) {
          const fromAddr = message.envelope?.from?.[0]
            ? `${message.envelope.from[0].name || ""} <${message.envelope.from[0].address || ""}>`.trim()
            : "未知发件人";

          results.push({
            uid: message.uid,
            seq: message.seq,
            from: fromAddr,
            subject: message.envelope?.subject || "(无主题)",
            date: message.envelope?.date?.toISOString() || new Date().toISOString(),
            unseen: !message.flags?.has("\\Seen"),
            hasAttachments: Boolean(message.bodyStructure?.childNodes && message.bodyStructure.childNodes.length > 1),
          });
        }

        return results;
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  /**
   * 根据 UID 获取邮件正文及附件明细
   *
   * @param uid 邮件唯一标识符
   * @param mailbox 所处邮箱，默认 INBOX
   * @returns 邮件详情数据
   */
  async getEmailDetail(uid: number, mailbox = "INBOX"): Promise<EmailDetail> {
    const client = this.createClient();
    await client.connect();

    try {
      const lock = await client.getMailboxLock(mailbox);
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

        const attachments = (parsed.attachments || []).map((att) => ({
          filename: att.filename || "未命名附件",
          contentType: att.contentType,
          size: att.size,
        }));

        return {
          uid,
          from: parsed.from?.text || "未知发件人",
          to: toList,
          cc: ccList.length > 0 ? ccList : undefined,
          subject: parsed.subject || "(无主题)",
          date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
          text: parsed.text,
          html: typeof parsed.html === "string" ? parsed.html : undefined,
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
}

export const imapService = new ImapService();

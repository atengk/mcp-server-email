/**
 * 邮件会话回复与线程关系维护服务
 *
 * @author Ateng
 * @since 2026-10-08
 */
import type { AccountProfile } from "../types/index.js";
import type { ImapService } from "./imap.service.js";
import type { SmtpService } from "./smtp.service.js";

/**
 * 邮件回复入参选项
 */
export interface ReplyEmailOptions {
  /** 被回复原邮件的 UID */
  originalUid: number;
  /** 原邮件所在邮箱（默认 INBOX） */
  mailbox?: string;
  /** 纯文本正文内容 */
  text?: string;
  /** HTML 格式正文内容 */
  html?: string;
  /** 是否全员回复（包含原邮件抄送人） */
  replyAll?: boolean;
  /** 附件清单 */
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string;
    contentType?: string;
  }>;
}

/**
 * 邮件回复响应结果
 */
export interface ReplyEmailResult {
  /** 新发出的邮件 Message-ID */
  messageId: string;
  /** 投递成功的收件地址列表 */
  accepted: string[];
  /** 关联回复原邮件 Message-ID */
  inReplyTo?: string;
  /** 关联会话引用链 Message-ID 集合 */
  references?: string[];
  /** 主收件人地址 */
  to: string;
  /** 抄送地址列表 */
  cc?: string[];
  /** 最终回复邮件主题 */
  subject: string;
}

/**
 * 从可能包含显示名称的邮箱字符串中提取纯邮箱地址
 *
 * @param input 原始地址字符串，如 "User <user@example.com>" 或 "user@example.com"
 * @returns 规范化的纯邮箱地址
 */
export function extractEmailAddress(input: string): string {
  const match = input.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }
  return input.trim().toLowerCase();
}

/**
 * 格式化回复邮件主题，自动规整 Re: 前缀且避免多重重复
 *
 * @param subject 原始邮件主题
 * @returns 规整后的回复邮件主题
 */
export function formatReplySubject(subject: string): string {
  const cleanSubject = (subject || "").trim();
  if (/^re:\s*/i.test(cleanSubject)) {
    return cleanSubject;
  }
  return `Re: ${cleanSubject || "(无主题)"}`;
}

/**
 * 执行邮件会话回复逻辑，自动构建 RFC 线程关系与收件人拓扑
 *
 * @param options 回复选项
 * @param account 发送账户画像
 * @param imapService IMAP 查询服务实例
 * @param smtpService SMTP 发送服务实例
 * @returns 最终外发结果
 */
export async function replyEmail(
  options: ReplyEmailOptions,
  account: AccountProfile,
  imapService: ImapService,
  smtpService: SmtpService
): Promise<ReplyEmailResult> {
  // 1. 获取原邮件详情与头信息
  const mailbox = options.mailbox || "INBOX";
  const original = await imapService.getEmailDetail(options.originalUid, mailbox);

  if (!original) {
    throw new Error(`未找到 UID 为 ${options.originalUid} 的原始邮件`);
  }

  // 2. 解析回复主收件人
  const to = original.fromAddress || extractEmailAddress(original.from);

  // 3. 构建全员回复 (replyAll) 抄送人列表，自动排除自身与原发件人
  let cc: string[] | undefined;
  if (options.replyAll) {
    const selfAddresses = new Set<string>();
    if (account.email) {
      selfAddresses.add(account.email.toLowerCase());
    }
    if (account.smtp?.user) {
      selfAddresses.add(account.smtp.user.toLowerCase());
    }
    if (account.imap?.user) {
      selfAddresses.add(account.imap.user.toLowerCase());
    }
    if (account.smtp?.from) {
      selfAddresses.add(extractEmailAddress(account.smtp.from));
    }

    const allOriginalRecipients = [...(original.to || []), ...(original.cc || [])];
    const ccSet = new Set<string>();

    for (const raw of allOriginalRecipients) {
      const email = extractEmailAddress(raw);
      if (email && email !== to && !selfAddresses.has(email)) {
        ccSet.add(email);
      }
    }

    if (ccSet.size > 0) {
      cc = Array.from(ccSet);
    }
  }

  // 4. 组装会话线程标识 (In-Reply-To & References) 与主题
  const inReplyTo = original.messageId;
  const references: string[] = original.references ? [...original.references] : [];
  if (original.messageId && !references.includes(original.messageId)) {
    references.push(original.messageId);
  }

  const subject = formatReplySubject(original.subject);

  // 5. 调用 SMTP 服务外发回复邮件
  const sendResult = await smtpService.sendEmail({
    to,
    cc,
    subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
    inReplyTo,
    references: references.length > 0 ? references : undefined,
  });

  return {
    messageId: sendResult.messageId,
    accepted: sendResult.accepted,
    inReplyTo,
    references: references.length > 0 ? references : undefined,
    to,
    cc,
    subject,
  };
}

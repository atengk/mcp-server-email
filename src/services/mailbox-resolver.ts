/**
 * 特殊用途邮箱目录别名解析与 MIME 载荷构造
 *
 * @author Ateng
 * @since 2026-10-08
 */
import nodemailer from "nodemailer";
import type { SendEmailOptions } from "../types/index.js";

/**
 * 远程邮箱元数据项
 */
export interface MailboxItem {
  /** 物理邮箱路径，如 INBOX, [Gmail]/Drafts, 草稿箱 */
  path: string;
  /** 邮箱显示名称 */
  name?: string;
  /** RFC 6154 Special-Use 标志，如 \Drafts, \Trash, \Sent, \Inbox */
  specialUse?: string;
}

/**
 * 将逻辑别名（如 drafts, trash, sent, inbox）映射为当前邮箱服务商的物理路径
 *
 * @param logicalAlias 逻辑别名或自定义目录名
 * @param availableMailboxes 服务端返回的物理邮箱列表
 * @returns 解析后的物理邮箱路径
 */
export function resolveSpecialMailbox(
  logicalAlias: string,
  availableMailboxes: MailboxItem[]
): string {
  const normalized = (logicalAlias || "").trim().toLowerCase();

  // 1. 收件箱 (INBOX) 别名映射
  if (normalized === "inbox" || normalized === "收件箱") {
    const found = availableMailboxes.find(
      (m) =>
        m.specialUse?.toLowerCase() === "\\inbox" ||
        m.path.toUpperCase() === "INBOX" ||
        m.name?.toUpperCase() === "INBOX"
    );
    return found ? found.path : "INBOX";
  }

  // 2. 草稿箱 (Drafts) 别名映射
  if (
    normalized === "drafts" ||
    normalized === "draft" ||
    normalized === "草稿箱" ||
    normalized === "草稿"
  ) {
    const bySpecialUse = availableMailboxes.find(
      (m) => m.specialUse?.toLowerCase() === "\\drafts"
    );
    if (bySpecialUse) {
      return bySpecialUse.path;
    }

    const byName = availableMailboxes.find((m) => {
      const p = m.path.toLowerCase();
      const n = (m.name || "").toLowerCase();
      return (
        p === "drafts" ||
        p === "草稿箱" ||
        p.endsWith("/drafts") ||
        n === "drafts" ||
        n === "草稿箱"
      );
    });
    if (byName) {
      return byName.path;
    }

    return "Drafts";
  }

  // 3. 回收站 (Trash) 别名映射
  if (
    normalized === "trash" ||
    normalized === "bin" ||
    normalized === "deleted" ||
    normalized === "已删除" ||
    normalized === "回收站" ||
    normalized === "废件箱"
  ) {
    const bySpecialUse = availableMailboxes.find(
      (m) => m.specialUse?.toLowerCase() === "\\trash"
    );
    if (bySpecialUse) {
      return bySpecialUse.path;
    }

    const byName = availableMailboxes.find((m) => {
      const p = m.path.toLowerCase();
      const n = (m.name || "").toLowerCase();
      return (
        p === "trash" ||
        p === "deleted messages" ||
        p === "已删除" ||
        p === "回收站" ||
        p.endsWith("/trash") ||
        n === "trash" ||
        n === "已删除" ||
        n === "回收站"
      );
    });
    if (byName) {
      return byName.path;
    }

    return "Trash";
  }

  // 4. 已发送 (Sent) 别名映射
  if (
    normalized === "sent" ||
    normalized === "已发送" ||
    normalized === "sent messages"
  ) {
    const bySpecialUse = availableMailboxes.find(
      (m) => m.specialUse?.toLowerCase() === "\\sent"
    );
    if (bySpecialUse) {
      return bySpecialUse.path;
    }

    const byName = availableMailboxes.find((m) => {
      const p = m.path.toLowerCase();
      const n = (m.name || "").toLowerCase();
      return (
        p === "sent" ||
        p === "sent messages" ||
        p === "已发送" ||
        p.endsWith("/sent mail") ||
        p.endsWith("/sent") ||
        n === "sent" ||
        n === "已发送"
      );
    });
    if (byName) {
      return byName.path;
    }

    return "Sent";
  }

  // 5. 尝试精确与不区分大小写匹配物理路径
  const exactMatch = availableMailboxes.find(
    (m) =>
      m.path.toLowerCase() === normalized ||
      (m.name && m.name.toLowerCase() === normalized)
  );
  if (exactMatch) {
    return exactMatch.path;
  }

  return logicalAlias;
}

/**
 * 使用 Nodemailer 纯内存流式传输器构建标准 RFC 822 MIME 数据 Buffer
 *
 * @param options 发信选项载荷
 * @param from 发件人地址
 * @returns 编译后的二进制 Buffer
 */
export async function buildRawMimeMessage(
  options: SendEmailOptions,
  from: string
): Promise<Buffer> {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  });

  const mailOptions = {
    from,
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    cc: options.cc
      ? Array.isArray(options.cc)
        ? options.cc.join(", ")
        : options.cc
      : undefined,
    bcc: options.bcc
      ? Array.isArray(options.bcc)
        ? options.bcc.join(", ")
        : options.bcc
      : undefined,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
    inReplyTo: options.inReplyTo,
    references: options.references,
  };

  const info = await transport.sendMail(mailOptions);
  return info.message as Buffer;
}

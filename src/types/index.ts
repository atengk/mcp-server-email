/**
 * 邮件服务核心数据类型与模型定义
 *
 * @author Ateng
 * @since 2026-10-08
 */

/**
 * 邮件发送入参选项
 */
export interface SendEmailOptions {
  /** 收件人地址列表，多个地址以逗号分隔或数组传入 */
  to: string | string[];
  /** 邮件主题 */
  subject: string;
  /** 纯文本正文内容 */
  text?: string;
  /** HTML 格式正文内容 */
  html?: string;
  /** 抄送地址列表 */
  cc?: string | string[];
  /** 密送地址列表 */
  bcc?: string | string[];
  /** 附件清单 */
  attachments?: Array<{
    /** 附件文件名 */
    filename: string;
    /** 本地文件绝对路径，或 Base64 编码字符串 */
    path?: string;
    /** 直接内容字符串或 Buffer */
    content?: string;
    /** 内容类型 (MIME Type) */
    contentType?: string;
  }>;
}

/**
 * 邮件摘要信息（用于列表检索展示）
 */
export interface EmailSummary {
  /** 邮件全局唯一 UID */
  uid: number;
  /** 邮件序号 Seq */
  seq: number;
  /** 发件人地址 */
  from: string;
  /** 邮件主题 */
  subject: string;
  /** 接收日期 (ISO 格式) */
  date: string;
  /** 是否未读 */
  unseen: boolean;
  /** 是否包含附件 */
  hasAttachments: boolean;
  /** 简要文本预览 */
  preview?: string;
}

/**
 * 邮件详情数据
 */
export interface EmailDetail {
  /** 邮件 UID */
  uid: number;
  /** 发件人 */
  from: string;
  /** 收件人列表 */
  to: string[];
  /** 抄送列表 */
  cc?: string[];
  /** 邮件主题 */
  subject: string;
  /** 日期 */
  date: string;
  /** 纯文本正文 */
  text?: string;
  /** HTML 格式正文 */
  html?: string;
  /** 附件元数据清单 */
  attachments: Array<{
    /** 附件名称 */
    filename: string;
    /** 文件类型 */
    contentType: string;
    /** 文件大小（字节） */
    size: number;
  }>;
}

/**
 * 邮件检索过滤条件
 */
export interface SearchEmailFilter {
  /** 邮箱文件夹（默认 INBOX） */
  mailbox?: string;
  /** 发件人包含关键字 */
  from?: string;
  /** 主题包含关键字 */
  subject?: string;
  /** 仅查询未读邮件 */
  unseenOnly?: boolean;
  /** 起始日期 (YYYY-MM-DD) */
  since?: string;
  /** 最大返回数量（默认 10） */
  limit?: number;
}

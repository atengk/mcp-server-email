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
  /** 原发件人地址覆盖（可选） */
  from?: string;
  /** 关联回复邮件的 Message-ID (RFC 822) */
  inReplyTo?: string;
  /** 关联会话引用链 Message-ID 集合 */
  references?: string | string[];
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
 * 邮件附件元数据清单（不含原始二进制与大体积 Base64，保护 Token 经济性）
 */
export interface EmailAttachmentMetadata {
  /** 附件在邮件中的唯一标识 ID 或序号（如 "0", "1"） */
  id: string;
  /** 附件名称 */
  filename: string;
  /** 内容类型 (MIME Type) */
  contentType: string;
  /** 文件大小（字节） */
  size: number;
}

/**
 * 邮件详情数据
 */
export interface EmailDetail {
  /** 邮件 UID */
  uid: number;
  /** 发件人名称与地址全文本 */
  from: string;
  /** 发件人纯邮箱地址 */
  fromAddress?: string;
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
  /** 清洗提纯后的 Markdown 正文 */
  bodyMarkdown?: string;
  /** 邮件正文是否因超过 30KB 阈值触发截断 */
  truncated?: boolean;
  /** 全局唯一 Message-ID (RFC 822) */
  messageId?: string;
  /** 关联上级 Message-ID */
  inReplyTo?: string;
  /** 会话线程引用链条 */
  references?: string[];
  /** 附件元数据清单（不含二进制数据） */
  attachments: EmailAttachmentMetadata[];
}

/**
 * 附件下载落盘结果
 */
export interface DownloadAttachmentResult {
  /** 附件在邮件中的唯一标识 ID 或序号 */
  attachmentId: string;
  /** 附件文件名 */
  filename: string;
  /** MIME 内容类型 */
  contentType: string;
  /** 附件文件字节大小 */
  size: number;
  /** 本地受管沙箱物理绝对路径 */
  filePath: string;
  /** 本地沙箱文件直达 URI (file://...) */
  fileUrl: string;
}

/**
 * 邮件检索过滤条件
 */
export interface SearchEmailFilter {
  /** 邮箱文件夹（支持别名如 inbox, drafts, trash 或物理路径，默认 INBOX） */
  mailbox?: string;
  /** 全文检索关键字（匹配发件人、主题或正文） */
  query?: string;
  /** 发件人包含关键字或地址 */
  from?: string;
  /** 收件人包含关键字或地址 */
  to?: string;
  /** 主题包含关键字 */
  subject?: string;
  /** 仅查询未读邮件 */
  unseenOnly?: boolean;
  /** 仅查询星标/置顶邮件 */
  flaggedOnly?: boolean;
  /** 是否必须包含附件 */
  hasAttachment?: boolean;
  /** 起始日期 (YYYY-MM-DD) */
  since?: string;
  /** 截止日期 (YYYY-MM-DD) */
  before?: string;
  /** 当前页码（从 1 开始，默认 1） */
  page?: number;
  /** 最大返回数量（默认 10） */
  limit?: number;
}

/**
 * 邮件多维检索分页结果
 */
export interface SearchEmailsResult {
  /** 当前页邮件摘要列表 */
  items: EmailSummary[];
  /** 匹配的总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页大小限制 */
  limit: number;
  /** 是否存在更多后续分页数据 */
  hasMore: boolean;
}

/**
 * 单个邮箱文件夹状态指标
 */
export interface MailboxStatus {
  /** 物理邮箱文件夹路径 */
  mailbox: string;
  /** 邮件总数 */
  total: number;
  /** 未读邮件数 */
  unseen: number;
  /** 最近邮件数 */
  recent: number;
}

/**
 * 邮箱状态看板概览报告
 */
export interface MailboxStatusReport {
  /** 各文件夹状态明细列表 */
  mailboxes: MailboxStatus[];
  /** 统计范围内未读邮件总数 */
  totalUnseen: number;
  /** 统计范围内邮件总数 */
  totalMessages: number;
}


/**
 * SMTP 账户配置
 */
export interface SmtpConfig {
  /** SMTP 服务器主机地址 */
  host: string;
  /** 端口号 (如 465 或 587) */
  port: number;
  /** 是否开启 TLS/SSL */
  secure: boolean;
  /** 用户名/邮箱账号 */
  user: string;
  /** 授权码或密码 */
  pass: string;
  /** 默认发件人 (如 Name <user@example.com>) */
  from?: string;
}

/**
 * IMAP 账户配置
 */
export interface ImapConfig {
  /** IMAP 服务器主机地址 */
  host: string;
  /** 端口号 (如 993) */
  port: number;
  /** 是否开启 TLS/SSL */
  secure: boolean;
  /** 用户名/邮箱账号 */
  user: string;
  /** 授权码或密码 */
  pass: string;
}

/**
 * 完整邮箱账户画像（包含密码凭据，仅限服务端内部受控使用）
 */
export interface AccountProfile {
  /** 账户唯一标识，如 default, work, personal */
  id: string;
  /** 账户别名或名称 */
  name?: string;
  /** 关联邮箱地址 */
  email?: string;
  /** SMTP 外发服务配置 */
  smtp?: SmtpConfig;
  /** IMAP 查收服务配置 */
  imap?: ImapConfig;
}


/**
 * 对外脱敏公开的账户画像（隐藏密码凭据）
 */
export interface SanitizedAccountProfile {
  /** 账户唯一标识 */
  id: string;
  /** 账户别名或名称 */
  name?: string;
  /** 关联邮箱地址 */
  email?: string;
  /** 是否为当前默认账户 */
  isDefault: boolean;
  /** SMTP 脱敏配置 */
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    from?: string;
  };
  /** IMAP 脱敏配置 */
  imap?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
  };
}

/**
 * 单项服务连通性检查结果
 */
export interface ServiceCheckResult {
  /** 是否已配置该服务 */
  configured: boolean;
  /** 是否联通成功 */
  success: boolean;
  /** 服务器主机 */
  host?: string;
  /** 端口 */
  port?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 账户连通性综合体检报告
 */
export interface ConnectionVerifyReport {
  /** 检查的账户标识 */
  account: string;
  /** SMTP 检查结果 */
  smtp: ServiceCheckResult;
  /** IMAP 检查结果 */
  imap: ServiceCheckResult;
  /** 综合是否完全成功 */
  overallSuccess: boolean;
}


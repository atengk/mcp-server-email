/**
 * SMTP 邮件外发核心业务服务
 *
 * @author Ateng
 * @since 2026-10-08
 */
import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config/index.js";
import type { SendEmailOptions, SmtpConfig } from "../types/index.js";

/**
 * SMTP 传输管理服务
 */
export class SmtpService {
  private transporter: Transporter | null = null;

  constructor(private readonly smtpConfig?: SmtpConfig) {}

  /**
   * 初始化并获取 Nodemailer 传输器单例
   *
   * @returns 初始化的 Transporter 实例
   * @throws Error 当未配置 SMTP 主机或账号时
   */
  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.smtpConfig?.host || config.MCP_SMTP_HOST;
    const port = this.smtpConfig?.port ?? config.MCP_SMTP_PORT;
    const secure = this.smtpConfig?.secure ?? config.MCP_SMTP_SECURE;
    const user = this.smtpConfig?.user || config.MCP_SMTP_USER;
    const pass = this.smtpConfig?.pass || config.MCP_SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error(
        "SMTP 配置不完整：请确保已配置 MCP_SMTP_HOST、MCP_SMTP_USER 和 MCP_SMTP_PASS 环境变量"
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  /**
   * 发送电子邮件
   *
   * @param options 发送邮件配置与内容选项
   * @returns 发送结果明细，包含 messageId
   * @throws Error 当发送失败时
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string; accepted: string[] }> {
    // 1. 获取并校验 SMTP 传输客户端
    const client = this.getTransporter();

    // 2. 组装发件人与信件载荷
    const from =
      options.from ||
      this.smtpConfig?.from ||
      this.smtpConfig?.user ||
      config.MCP_SMTP_FROM ||
      config.MCP_SMTP_USER;
    const mailOptions = {
      from,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(", ") : options.cc) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc) : undefined,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
      inReplyTo: options.inReplyTo,
      references: options.references,
    };

    // 3. 执行外发传输并返回结果
    const info = await client.sendMail(mailOptions);
    return {
      messageId: info.messageId,
      accepted: Array.isArray(info.accepted) ? (info.accepted as string[]) : [],
    };
  }

  /**
   * 验证 SMTP 服务的网络与认证联通性
   *
   * @returns 是否连接成功
   */
  async verifyConnection(): Promise<boolean> {
    const client = this.getTransporter();
    await client.verify();
    return true;
  }
}

export const smtpService = new SmtpService();

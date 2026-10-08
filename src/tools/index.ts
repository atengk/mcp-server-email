/**
 * MCP 工具定义与请求分发注册
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { accountManager } from "../services/account-manager.js";
import { replyEmail } from "../services/reply.service.js";

/**
 * 注册所有邮件相关的 MCP 工具到服务端实例
 *
 * @param server McpServer 实例
 */
export function registerEmailTools(server: McpServer): void {
  // 1. 列出可用邮箱账户画像（凭据脱敏）
  server.tool(
    "list_accounts",
    "列出所有已配置的邮箱账户画像列表（凭据安全脱敏，隐藏密码），包含账户标识、邮箱地址、服务配置与默认账户标记",
    {},
    async () => {
      try {
        const accounts = accountManager.listAccounts();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(accounts, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `获取账户列表失败: ${message}` }],
        };
      }
    }
  );

  // 2. 连通性自检与凭据体检工具
  server.tool(
    "verify_connection",
    "验证指定或默认邮箱账户的网络连通性与认证凭据（包括 SMTP 外发和 IMAP 查收通道），返回网络握手与身份认证体检报告",
    {
      account: z.string().optional().describe("邮箱账户画像标识，缺省时体检默认账户"),
    },
    async (args) => {
      try {
        const report = await accountManager.verifyConnection(args.account);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `验证账户连接失败: ${message}` }],
        };
      }
    }
  );

  // 3. 发送邮件工具
  server.tool(
    "send_email",
    "发送电子邮件，支持纯文本、HTML 正文以及文件附件",
    {
      account: z.string().optional().describe("发信邮箱账户画像标识，缺省时使用默认账户"),
      to: z.union([z.string(), z.array(z.string())]).describe("收件人邮箱地址，单个或数组"),
      subject: z.string().describe("邮件主题"),
      text: z.string().optional().describe("纯文本正文内容"),
      html: z.string().optional().describe("HTML 格式正文内容"),
      cc: z.union([z.string(), z.array(z.string())]).optional().describe("抄送邮箱地址"),
      bcc: z.union([z.string(), z.array(z.string())]).optional().describe("密送邮箱地址"),
      attachments: z
        .array(
          z.object({
            filename: z.string().describe("附件文件名"),
            path: z.string().optional().describe("本地文件绝对路径"),
            content: z.string().optional().describe("附件文本内容或 Base64 编码字符串"),
            contentType: z.string().optional().describe("MIME 类型"),
          })
        )
        .optional()
        .describe("附件列表"),
    },
    async (args) => {
      try {
        const smtpService = accountManager.getSmtpService(args.account);
        const result = await smtpService.sendEmail({
          to: args.to,
          subject: args.subject,
          text: args.text,
          html: args.html,
          cc: args.cc,
          bcc: args.bcc,
          attachments: args.attachments,
        });

        return {
          content: [
            {
              type: "text",
              text: `邮件发送成功！MessageID: ${result.messageId}，已投递至: ${result.accepted.join(", ")}`,
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `发送邮件失败: ${message}` }],
        };
      }
    }
  );

  // 4. 会话回复工具
  server.tool(
    "reply_email",
    "回复指定邮件，自动保持原生会话折叠树（自动注入 In-Reply-To、References 邮件头，添加 Re: 主题前缀，支持一键 replyAll 保留原抄送人）",
    {
      account: z.string().optional().describe("发送回复的邮箱账户画像标识，缺省时使用默认账户"),
      originalUid: z.number().describe("被回复原邮件的唯一 UID 标识符"),
      mailbox: z.string().optional().default("INBOX").describe("原邮件所在邮箱文件夹名称，默认为 INBOX"),
      text: z.string().optional().describe("回复的纯文本正文内容"),
      html: z.string().optional().describe("回复的 HTML 格式正文内容"),
      replyAll: z.boolean().optional().default(false).describe("是否全员回复（抄送除自身外的原邮件收件人与抄送人）"),
      attachments: z
        .array(
          z.object({
            filename: z.string().describe("附件文件名"),
            path: z.string().optional().describe("本地文件绝对路径"),
            content: z.string().optional().describe("附件文本内容或 Base64 编码字符串"),
            contentType: z.string().optional().describe("MIME 类型"),
          })
        )
        .optional()
        .describe("附件列表"),
    },
    async (args) => {
      try {
        const account = accountManager.getAccount(args.account);
        const imapService = accountManager.getImapService(args.account);
        const smtpService = accountManager.getSmtpService(args.account);

        const result = await replyEmail(
          {
            originalUid: args.originalUid,
            mailbox: args.mailbox,
            text: args.text,
            html: args.html,
            replyAll: args.replyAll,
            attachments: args.attachments,
          },
          account,
          imapService,
          smtpService
        );

        return {
          content: [
            {
              type: "text",
              text: `邮件回复成功！MessageID: ${result.messageId}，已回复至: ${result.to}${result.cc ? ` (抄送: ${result.cc.join(", ")})` : ""}，主题: ${result.subject}`,
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `回复邮件失败: ${message}` }],
        };
      }
    }
  );

  // 5. 保存至草稿箱工具
  server.tool(
    "create_draft",
    "将拟定邮件存入邮箱草稿箱（Drafts），供人工在邮箱客户端中最终审阅确认后发出",
    {
      account: z.string().optional().describe("草稿所属邮箱账户画像标识，缺省时使用默认账户"),
      to: z.union([z.string(), z.array(z.string())]).optional().describe("收件人邮箱地址，单个或数组"),
      subject: z.string().optional().default("(无主题)").describe("邮件主题"),
      text: z.string().optional().describe("纯文本正文内容"),
      html: z.string().optional().describe("HTML 格式正文内容"),
      cc: z.union([z.string(), z.array(z.string())]).optional().describe("抄送邮箱地址"),
      bcc: z.union([z.string(), z.array(z.string())]).optional().describe("密送邮箱地址"),
      attachments: z
        .array(
          z.object({
            filename: z.string().describe("附件文件名"),
            path: z.string().optional().describe("本地文件绝对路径"),
            content: z.string().optional().describe("附件文本内容或 Base64 编码字符串"),
            contentType: z.string().optional().describe("MIME 类型"),
          })
        )
        .optional()
        .describe("附件列表"),
    },
    async (args) => {
      try {
        const account = accountManager.getAccount(args.account);
        const imapService = accountManager.getImapService(args.account);
        const from =
          account.smtp?.from ||
          account.smtp?.user ||
          account.email ||
          "user@example.com";

        const result = await imapService.createDraft(
          {
            to: args.to || "",
            subject: args.subject || "(无主题)",
            text: args.text,
            html: args.html,
            cc: args.cc,
            bcc: args.bcc,
            attachments: args.attachments,
          },
          from
        );

        return {
          content: [
            {
              type: "text",
              text: `草稿已成功保存至 [${result.mailbox}]！主题: ${args.subject || "(无主题)"}`,
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `保存草稿箱失败: ${message}` }],
        };
      }
    }
  );

  // 6. 极速状态看板工具
  server.tool(
    "get_mailbox_status",
    "极速获取指定或全部邮箱文件夹的状态看板（包含总邮件数、未读邮件数与最近邮件数），毫秒级响应",
    {
      account: z.string().optional().describe("邮箱账户画像标识，缺省时使用默认账户"),
      mailbox: z
        .string()
        .optional()
        .describe(
          "目标邮箱文件夹别名或物理路径（如 inbox, drafts, trash 或 INBOX），缺省时统计全部可用文件夹"
        ),
    },
    async (args) => {
      try {
        const imapService = accountManager.getImapService(args.account);
        const report = await imapService.getMailboxStatus(args.mailbox);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `获取邮箱状态失败: ${message}` }],
        };
      }
    }
  );

  // 7. 检索邮件列表工具 (多维复合检索与分页)
  server.tool(
    "search_emails",
    "在邮箱中按多维条件检索邮件，返回包含 150 字符 Preview 纯文本摘要的分页列表",
    {
      account: z.string().optional().describe("收信邮箱账户画像标识，缺省时使用默认账户"),
      mailbox: z
        .string()
        .optional()
        .default("INBOX")
        .describe("邮箱文件夹名称或别名（如 inbox, drafts, trash），默认为 INBOX"),
      query: z.string().optional().describe("全文检索关键字（匹配发件人、主题或正文）"),
      from: z.string().optional().describe("按发件人地址或关键字筛选"),
      to: z.string().optional().describe("按收件人地址或关键字筛选"),
      subject: z.string().optional().describe("按邮件主题关键字筛选"),
      unseenOnly: z.boolean().optional().default(false).describe("是否仅查询未读邮件"),
      flaggedOnly: z.boolean().optional().default(false).describe("是否仅查询星标/置顶邮件"),
      hasAttachment: z.boolean().optional().describe("是否必须包含附件"),
      since: z.string().optional().describe("起始日期筛选，格式如 YYYY-MM-DD"),
      before: z.string().optional().describe("截止日期筛选，格式如 YYYY-MM-DD"),
      page: z.number().optional().default(1).describe("当前页码，从 1 开始，默认 1"),
      limit: z.number().optional().default(10).describe("每页拉取条数，默认 10"),
    },
    async (args) => {
      try {
        const imapService = accountManager.getImapService(args.account);
        const result = await imapService.searchEmails({
          mailbox: args.mailbox,
          query: args.query,
          from: args.from,
          to: args.to,
          subject: args.subject,
          unseenOnly: args.unseenOnly,
          flaggedOnly: args.flaggedOnly,
          hasAttachment: args.hasAttachment,
          since: args.since,
          before: args.before,
          page: args.page,
          limit: args.limit,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `检索邮件列表失败: ${message}` }],
        };
      }
    }
  );


  // 7. 获取邮件正文及附件详情工具
  server.tool(
    "get_email_detail",
    "根据邮件全局 UID 获取单封邮件的完整正文内容与附件清单",
    {
      account: z.string().optional().describe("收信邮箱账户画像标识，缺省时使用默认账户"),
      uid: z.number().describe("邮件的唯一 UID 标识符"),
      mailbox: z.string().optional().default("INBOX").describe("邮箱文件夹名称，默认为 INBOX"),
    },
    async (args) => {
      try {
        const imapService = accountManager.getImapService(args.account);
        const detail = await imapService.getEmailDetail(args.uid, args.mailbox);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(detail, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `获取邮件详情失败: ${message}` }],
        };
      }
    }
  );

  // 8. 列出全部邮箱目录工具
  server.tool(
    "list_mailboxes",
    "获取当前邮箱服务的所有可用文件夹/目录列表（如 INBOX, Sent, Trash 等）",
    {
      account: z.string().optional().describe("收信邮箱账户画像标识，缺省时使用默认账户"),
    },
    async (args) => {
      try {
        const imapService = accountManager.getImapService(args.account);
        const mailboxes = await imapService.listMailboxes();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(mailboxes, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `获取邮箱目录失败: ${message}` }],
        };
      }
    }
  );

  // 9. 下载附件至本地受管沙箱工具
  server.tool(
    "download_attachment",
    "将指定邮件的附件按需提取并安全保存至本地受管沙箱目录，返回物理绝对路径与 file:/// 直达 URI",
    {
      account: z.string().optional().describe("邮箱账户画像标识，缺省时使用默认账户"),
      uid: z.number().describe("邮件的唯一 UID 标识符"),
      attachmentId: z
        .string()
        .describe("待下载附件的标识 ID（对应 get_email_detail 返回的附件 id，如 '0'）或附件文件名"),
      mailbox: z
        .string()
        .optional()
        .default("INBOX")
        .describe("原邮件所在邮箱文件夹名称或别名，默认为 INBOX"),
    },
    async (args) => {
      try {
        const imapService = accountManager.getImapService(args.account);
        const result = await imapService.downloadAttachment(
          args.uid,
          args.attachmentId,
          args.mailbox
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `下载附件失败: ${message}` }],
        };
      }
    }
  );
}

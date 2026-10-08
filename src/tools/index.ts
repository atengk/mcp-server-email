/**
 * MCP 工具定义与请求分发注册
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { imapService } from "../services/imap.service.js";
import { smtpService } from "../services/smtp.service.js";

/**
 * 注册所有邮件相关的 MCP 工具到服务端实例
 *
 * @param server McpServer 实例
 */
export function registerEmailTools(server: McpServer): void {
  // 1. 发送邮件工具
  server.tool(
    "send_email",
    "发送电子邮件，支持纯文本、HTML 正文以及文件附件",
    {
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

  // 2. 检索邮件列表工具
  server.tool(
    "search_emails",
    "在邮箱中按过滤条件检索邮件，返回摘要列表",
    {
      mailbox: z.string().optional().default("INBOX").describe("邮箱文件夹名称，默认为 INBOX"),
      from: z.string().optional().describe("按发件人地址或关键字筛选"),
      subject: z.string().optional().describe("按邮件主题关键字筛选"),
      unseenOnly: z.boolean().optional().default(false).describe("是否仅查询未读邮件"),
      since: z.string().optional().describe("起始日期筛选，格式如 YYYY-MM-DD"),
      limit: z.number().optional().default(10).describe("最大拉取条数，默认 10"),
    },
    async (args) => {
      try {
        const list = await imapService.searchEmails({
          mailbox: args.mailbox,
          from: args.from,
          subject: args.subject,
          unseenOnly: args.unseenOnly,
          since: args.since,
          limit: args.limit,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(list, null, 2),
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

  // 3. 获取邮件正文及附件详情工具
  server.tool(
    "get_email_detail",
    "根据邮件全局 UID 获取单封邮件的完整正文内容与附件清单",
    {
      uid: z.number().describe("邮件的唯一 UID 标识符"),
      mailbox: z.string().optional().default("INBOX").describe("邮箱文件夹名称，默认为 INBOX"),
    },
    async (args) => {
      try {
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

  // 4. 列出全部邮箱目录工具
  server.tool(
    "list_mailboxes",
    "获取当前邮箱服务的所有可用文件夹/目录列表（如 INBOX, Sent, Trash 等）",
    {},
    async () => {
      try {
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
}

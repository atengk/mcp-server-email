/**
 * 服务端环境变量配置解析与安全校验
 *
 * @author Ateng
 * @since 2026-10-08
 */
import dotenv from "dotenv";
import { z } from "zod";

// 加载本地环境变量
dotenv.config();

/**
 * 环境变量 Schema 定义
 */
const envSchema = z.object({
  // SMTP 配置
  MCP_SMTP_HOST: z.string().optional(),
  MCP_SMTP_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 465)),
  MCP_SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === "true" || val === "1"),
  MCP_SMTP_USER: z.string().optional(),
  MCP_SMTP_PASS: z.string().optional(),
  MCP_SMTP_FROM: z.string().optional(),

  // IMAP 配置
  MCP_IMAP_HOST: z.string().optional(),
  MCP_IMAP_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 993)),
  MCP_IMAP_SECURE: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === "true" || val === "1"),
  MCP_IMAP_USER: z.string().optional(),
  MCP_IMAP_PASS: z.string().optional(),

  // MCP 传输与服务配置
  MCP_TRANSPORT: z.enum(["stdio", "sse"]).default("stdio"),
  MCP_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 3000)),
  MCP_LOG_LEVEL: z.string().default("info"),
});

export type AppConfig = z.infer<typeof envSchema>;

/**
 * 解析并获取已校验的环境变量配置
 *
 * @returns 结构化配置对象
 */
export function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("[配置错误] 环境变量校验失败:", result.error.format());
    throw new Error("环境变量格式无效，请检查 .env 配置");
  }
  return result.data;
}

export const config = loadConfig();

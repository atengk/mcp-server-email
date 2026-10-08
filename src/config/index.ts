/**
 * 服务端环境变量与多账户画像配置解析
 *
 * @author Ateng
 * @since 2026-10-08
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";
import type { AccountProfile } from "../types/index.js";

// 加载本地环境变量
dotenv.config();

/**
 * SMTP 单配置 Schema
 */
const smtpProfileSchema = z.object({
  host: z.string(),
  port: z
    .union([z.number(), z.string().transform((val) => parseInt(val, 10))])
    .default(465),
  secure: z
    .union([z.boolean(), z.string().transform((val) => val === "true" || val === "1")])
    .default(true),
  user: z.string(),
  pass: z.string(),
  from: z.string().optional(),
});

/**
 * IMAP 单配置 Schema
 */
const imapProfileSchema = z.object({
  host: z.string(),
  port: z
    .union([z.number(), z.string().transform((val) => parseInt(val, 10))])
    .default(993),
  secure: z
    .union([z.boolean(), z.string().transform((val) => val === "true" || val === "1")])
    .default(true),
  user: z.string(),
  pass: z.string(),
});

/**
 * 完整账户画像 Schema
 */
const accountProfileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  smtp: smtpProfileSchema.optional(),
  imap: imapProfileSchema.optional(),
});

/**
 * 环境变量顶层 Schema 定义
 */
const envSchema = z.object({
  // SMTP 配置 (向下兼容单账户)
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

  // IMAP 配置 (向下兼容单账户)
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

  // 多账户配置
  MCP_ACCOUNTS: z.string().optional(),
  MCP_ACCOUNTS_FILE: z.string().optional(),
  MCP_DEFAULT_ACCOUNT: z.string().optional(),

  // MCP 传输与服务配置
  MCP_TRANSPORT: z.enum(["stdio", "sse"]).default("stdio"),
  MCP_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 3000)),
  MCP_LOG_LEVEL: z.string().default("info"),
});

export type AppConfig = z.infer<typeof envSchema> & {
  accounts: AccountProfile[];
  defaultAccountId: string;
};

/**
 * 将 JSON 数据解析为账户画像列表
 *
 * @param raw JSON 反序列化后的原始数据
 * @returns 规范化的账户画像列表
 */
function parseAccountsFromJson(raw: unknown): AccountProfile[] {
  if (Array.isArray(raw)) {
    return z.array(accountProfileSchema).parse(raw);
  }
  if (typeof raw === "object" && raw !== null) {
    const record = z.record(accountProfileSchema.omit({ id: true })).parse(raw);
    return Object.entries(record).map(([id, profile]) => ({
      ...profile,
      id,
    }));
  }
  throw new Error("无效的账户配置格式，必须为 JSON 数组或键值对象");
}

/**
 * 从环境变量与配置文件中解析多账户画像列表
 *
 * @param env 环境变量键值字典，缺省为 process.env
 * @returns 解析得到的账户列表与默认账户 ID
 */
export function parseAccountProfiles(
  env: Record<string, string | undefined> = process.env
): { accounts: AccountProfile[]; defaultAccountId: string } {
  let accounts: AccountProfile[] = [];

  // 1. 优先尝试从 MCP_ACCOUNTS_FILE 配置文件加载
  const accountsFile = env.MCP_ACCOUNTS_FILE;
  if (accountsFile) {
    try {
      const resolvedPath = path.isAbsolute(accountsFile)
        ? accountsFile
        : path.resolve(process.cwd(), accountsFile);
      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, "utf-8");
        accounts = parseAccountsFromJson(JSON.parse(fileContent));
      } else {
        console.error(`[配置警告] MCP_ACCOUNTS_FILE 指定的文件不存在: ${resolvedPath}`);
      }
    } catch (err: unknown) {
      console.error(
        "[配置错误] 解析 MCP_ACCOUNTS_FILE 失败:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 2. 尝试从 MCP_ACCOUNTS 环境变量（JSON 字符串）解析
  const accountsJson = env.MCP_ACCOUNTS;
  if (accountsJson && accounts.length === 0) {
    try {
      accounts = parseAccountsFromJson(JSON.parse(accountsJson));
    } catch (err: unknown) {
      console.error(
        "[配置错误] 解析 MCP_ACCOUNTS JSON 失败:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 3. 兼容单账户环境变量平滑回退 (MCP_SMTP_* / MCP_IMAP_*)
  if (accounts.length === 0) {
    const hasSmtp = Boolean(env.MCP_SMTP_HOST && env.MCP_SMTP_USER && env.MCP_SMTP_PASS);
    const hasImap = Boolean(env.MCP_IMAP_HOST && env.MCP_IMAP_USER && env.MCP_IMAP_PASS);

    if (hasSmtp || hasImap) {
      const defaultAccount: AccountProfile = {
        id: "default",
        name: "默认邮箱账户",
        email: env.MCP_SMTP_USER || env.MCP_IMAP_USER,
      };

      if (hasSmtp) {
        defaultAccount.smtp = {
          host: env.MCP_SMTP_HOST!,
          port: env.MCP_SMTP_PORT ? parseInt(env.MCP_SMTP_PORT, 10) : 465,
          secure:
            env.MCP_SMTP_SECURE === undefined ||
            env.MCP_SMTP_SECURE === "true" ||
            env.MCP_SMTP_SECURE === "1",
          user: env.MCP_SMTP_USER!,
          pass: env.MCP_SMTP_PASS!,
          from: env.MCP_SMTP_FROM,
        };
      }

      if (hasImap) {
        defaultAccount.imap = {
          host: env.MCP_IMAP_HOST!,
          port: env.MCP_IMAP_PORT ? parseInt(env.MCP_IMAP_PORT, 10) : 993,
          secure:
            env.MCP_IMAP_SECURE === undefined ||
            env.MCP_IMAP_SECURE === "true" ||
            env.MCP_IMAP_SECURE === "1",
          user: env.MCP_IMAP_USER!,
          pass: env.MCP_IMAP_PASS!,
        };
      }

      accounts.push(defaultAccount);
    }
  }

  // 4. 解析默认账户 ID
  let defaultAccountId = env.MCP_DEFAULT_ACCOUNT || "";
  if (!defaultAccountId || !accounts.some((a) => a.id === defaultAccountId)) {
    const defaultAcc = accounts.find((a) => a.id === "default");
    defaultAccountId = defaultAcc ? defaultAcc.id : accounts[0]?.id || "default";
  }

  return { accounts, defaultAccountId };
}

/**
 * 解析并获取已校验的环境变量与多账户配置
 *
 * @param env 环境变量键值字典，缺省为 process.env
 * @returns 结构化配置对象
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    console.error("[配置错误] 环境变量校验失败:", result.error.format());
    throw new Error("环境变量格式无效，请检查 .env 配置");
  }

  const { accounts, defaultAccountId } = parseAccountProfiles(env);

  return {
    ...result.data,
    accounts,
    defaultAccountId,
  };
}

export const config = loadConfig();

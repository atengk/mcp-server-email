/**
 * 多账户配置解析单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it } from "vitest";
import { parseAccountProfiles } from "../src/config/index.js";

describe("Account Config Parsing", () => {
  it("应能平滑解析既有的 MCP_SMTP_* 与 MCP_IMAP_* 环境变量为默认账户", () => {
    const env: Record<string, string> = {
      MCP_SMTP_HOST: "smtp.example.com",
      MCP_SMTP_PORT: "465",
      MCP_SMTP_SECURE: "true",
      MCP_SMTP_USER: "user@example.com",
      MCP_SMTP_PASS: "secret123",
      MCP_SMTP_FROM: "Test User <user@example.com>",
      MCP_IMAP_HOST: "imap.example.com",
      MCP_IMAP_PORT: "993",
      MCP_IMAP_SECURE: "true",
      MCP_IMAP_USER: "user@example.com",
      MCP_IMAP_PASS: "secret123",
    };

    const { accounts, defaultAccountId } = parseAccountProfiles(env);

    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("default");
    expect(accounts[0].smtp?.host).toBe("smtp.example.com");
    expect(accounts[0].smtp?.port).toBe(465);
    expect(accounts[0].smtp?.secure).toBe(true);
    expect(accounts[0].smtp?.user).toBe("user@example.com");
    expect(accounts[0].smtp?.pass).toBe("secret123");
    expect(accounts[0].smtp?.from).toBe("Test User <user@example.com>");
    expect(accounts[0].imap?.host).toBe("imap.example.com");
    expect(accounts[0].imap?.port).toBe(993);
    expect(accounts[0].imap?.user).toBe("user@example.com");
    expect(defaultAccountId).toBe("default");
  });

  it("应支持从 MCP_ACCOUNTS JSON 字符串数组解析多账户画像", () => {
    const accountsJson = JSON.stringify([
      {
        id: "work",
        name: "工作邮箱",
        email: "work@company.com",
        smtp: {
          host: "smtp.company.com",
          port: 465,
          secure: true,
          user: "work@company.com",
          pass: "workpass",
        },
        imap: {
          host: "imap.company.com",
          port: 993,
          secure: true,
          user: "work@company.com",
          pass: "workpass",
        },
      },
      {
        id: "personal",
        name: "个人邮箱",
        email: "me@personal.com",
        smtp: {
          host: "smtp.personal.com",
          port: 587,
          secure: false,
          user: "me@personal.com",
          pass: "personalpass",
        },
        imap: {
          host: "imap.personal.com",
          port: 993,
          secure: true,
          user: "me@personal.com",
          pass: "personalpass",
        },
      },
    ]);

    const env: Record<string, string> = {
      MCP_ACCOUNTS: accountsJson,
      MCP_DEFAULT_ACCOUNT: "personal",
    };

    const { accounts, defaultAccountId } = parseAccountProfiles(env);

    expect(accounts).toHaveLength(2);
    expect(accounts.find((a) => a.id === "work")?.smtp.user).toBe("work@company.com");
    expect(accounts.find((a) => a.id === "personal")?.smtp.port).toBe(587);
    expect(defaultAccountId).toBe("personal");
  });

  it("应支持从 MCP_ACCOUNTS JSON 字典对象解析多账户画像", () => {
    const accountsJson = JSON.stringify({
      work: {
        name: "工作邮箱",
        smtp: {
          host: "smtp.company.com",
          port: 465,
          user: "work@company.com",
          pass: "workpass",
        },
        imap: {
          host: "imap.company.com",
          port: 993,
          user: "work@company.com",
          pass: "workpass",
        },
      },
    });

    const env: Record<string, string> = {
      MCP_ACCOUNTS: accountsJson,
    };

    const { accounts, defaultAccountId } = parseAccountProfiles(env);

    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("work");
    expect(accounts[0].smtp?.secure).toBe(true); // 默认端口 465 为 secure: true
    expect(defaultAccountId).toBe("work");
  });

  it("应支持从 MCP_ACCOUNTS_FILE 指定的本地配置文件加载多账户画像", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const os = await import("node:os");

    const tempFilePath = path.join(os.tmpdir(), `mcp-email-test-accounts-${Date.now()}.json`);
    const fileContent = JSON.stringify([
      {
        id: "file-account",
        name: "文件配置账户",
        smtp: {
          host: "smtp.file.com",
          port: 465,
          secure: true,
          user: "file@file.com",
          pass: "filepass",
        },
        imap: {
          host: "imap.file.com",
          port: 993,
          secure: true,
          user: "file@file.com",
          pass: "filepass",
        },
      },
    ]);

    await fs.writeFile(tempFilePath, fileContent, "utf-8");

    try {
      const env: Record<string, string> = {
        MCP_ACCOUNTS_FILE: tempFilePath,
      };

      const { accounts, defaultAccountId } = parseAccountProfiles(env);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe("file-account");
      expect(accounts[0].smtp.user).toBe("file@file.com");
      expect(defaultAccountId).toBe("file-account");
    } finally {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  });
});


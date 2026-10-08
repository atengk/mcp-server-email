# MCP Server Email

<p align="center">
  <strong>生产级 Email Model Context Protocol (MCP) 服务端（支持 SMTP 外发、IMAP 检索与附件处理，集成 Stdio/SSE 双模）</strong>
</p>

<p align="center">
  <a href="https://github.com/atengk/mcp-server-email/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/atengk/mcp-server-email/ci.yml?branch=main&label=CI&style=flat-square" alt="CI Status" />
  </a>
  <a href="https://github.com/atengk/mcp-server-email/releases">
    <img src="https://img.shields.io/github/v/release/atengk/mcp-server-email?style=flat-square" alt="Release" />
  </a>
  <a href="https://www.npmjs.com/package/@atengk/mcp-server-email">
    <img src="https://img.shields.io/npm/v/@atengk/mcp-server-email?style=flat-square&color=cb3837" alt="npm version" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square" alt="License" />
  </a>
  <a href="./CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" />
  </a>
</p>

---

## 📖 项目简介

`mcp-server-email` 是专为大模型与 AI 智能体（Agent）打造的生产级邮件能力底座。通过遵循标准化 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 协议，为 Claude Desktop、Cursor、Cline、Windsurf 等开发工具与 Agent 宿主环境提供完整的电子邮件收发与检索能力。

---

## ✨ 核心特性

- 🎯 **双向邮件处理能力**：
  - **外发 (SMTP)**：支持纯文本、富文本 HTML、抄送 (CC)、密送 (BCC) 及多附件发送；
  - **检索与查收 (IMAP)**：支持多文件夹目录遍历、按发件人/主题/时间/未读状态多维检索、单封邮件正文解析与附件提取；
- 🔄 **Stdio / SSE 双模通信**：
  - 默认采用 `Stdio` 传输，适配本地 IDE 插件与 Claude Desktop 进程拉起；
  - 支持 `--transport sse --port 3000` 切换为流式 HTTP 服务，便于 Docker 容器云或集中式多租户部署；
- 🛡️ **三位一体凭据安全隔离**：
  - 所有主机、端口与邮箱授权密码通过 `MCP_SMTP_*` 和 `MCP_IMAP_*` 专业环境变量严格隔离注入；
  - 彻底规避大模型在 Prompt 提示词上下文中窥视、拼接或泄露明文密钥；
- 📦 **免安装秒开 (npx)**：无需手动下载源码，一条命令即可通过 `npx` 极速加载；
- 🌐 **广泛兼容主流邮件服务商**：开箱即用支持 QQ 邮箱、163 网易邮箱、Gmail、Outlook、企业微信邮箱及自建私有邮件服务器。

---

## 🛠️ 快速开始

### 方式 1：Claude Desktop 配置（推荐）

打开 Claude Desktop 配置文件（Windows: `%APPDATA%\Claude\claude_desktop_config.json`，macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`），在 `mcpServers` 中增加：

```json
{
  "mcpServers": {
    "email": {
      "command": "npx",
      "args": ["-y", "@atengk/mcp-server-email"],
      "env": {
        "MCP_SMTP_HOST": "smtp.qq.com",
        "MCP_SMTP_PORT": "465",
        "MCP_SMTP_SECURE": "true",
        "MCP_SMTP_USER": "your_email@qq.com",
        "MCP_SMTP_PASS": "YOUR_AUTHORIZATION_CODE",
        "MCP_SMTP_FROM": "AI 助手 <your_email@qq.com>",
        "MCP_IMAP_HOST": "imap.qq.com",
        "MCP_IMAP_PORT": "993",
        "MCP_IMAP_SECURE": "true",
        "MCP_IMAP_USER": "your_email@qq.com",
        "MCP_IMAP_PASS": "YOUR_AUTHORIZATION_CODE"
      }
    }
  }
}
```

### 方式 2：Docker 容器运行 (SSE 模式)

```bash
docker run -d \
  --name mcp-server-email \
  -p 3000:3000 \
  -e MCP_TRANSPORT=sse \
  -e MCP_PORT=3000 \
  -e MCP_SMTP_HOST=smtp.example.com \
  -e MCP_SMTP_PORT=465 \
  -e MCP_SMTP_USER=user@example.com \
  -e MCP_SMTP_PASS=YOUR_SMTP_PASSWORD \
  -e MCP_IMAP_HOST=imap.example.com \
  -e MCP_IMAP_PORT=993 \
  -e MCP_IMAP_USER=user@example.com \
  -e MCP_IMAP_PASS=YOUR_IMAP_PASSWORD \
  ghcr.io/atengk/mcp-server-email:latest
```

---

## ⚙️ 环境变量规范

| 环境变量名 | 说明 | 默认值 | 示例 |
| :--- | :--- | :--- | :--- |
| `MCP_SMTP_HOST` | SMTP 发信服务器域名或 IP | 无 | `smtp.qq.com` |
| `MCP_SMTP_PORT` | SMTP 发信端口 | `465` | `465` 或 `587` |
| `MCP_SMTP_SECURE` | 是否使用 SSL/TLS 加密 | `true` | `true` / `false` |
| `MCP_SMTP_USER` | SMTP 登录用户名 / 邮箱地址 | 无 | `user@example.com` |
| `MCP_SMTP_PASS` | SMTP 授权码或登录密码 | 无 | `YOUR_AUTH_CODE` |
| `MCP_SMTP_FROM` | 邮件发件人显示格式（可选） | 默认取 USER | `小助手 <user@example.com>` |
| `MCP_IMAP_HOST` | IMAP 收信服务器域名或 IP | 无 | `imap.qq.com` |
| `MCP_IMAP_PORT` | IMAP 收信端口 | `993` | `993` |
| `MCP_IMAP_SECURE` | 是否使用 SSL/TLS 加密 | `true` | `true` / `false` |
| `MCP_IMAP_USER` | IMAP 登录用户名 / 邮箱地址 | 无 | `user@example.com` |
| `MCP_IMAP_PASS` | IMAP 授权码或登录密码 | 无 | `YOUR_AUTH_CODE` |
| `MCP_TRANSPORT` | 通信传输模式 (`stdio` 或 `sse`) | `stdio` | `stdio` |
| `MCP_PORT` | SSE 模式下的监听端口 | `3000` | `3000` |

---

## 🧰 提供的 MCP 工具列表

| 工具名称 | 描述说明 | 关键入参 |
| :--- | :--- | :--- |
| `send_email` | 发送电子邮件（支持文本/HTML/附件/抄送） | `to`, `subject`, `text`, `html`, `cc`, `bcc`, `attachments` |
| `search_emails` | 在邮箱中按条件检索邮件并返回摘要列表 | `mailbox`, `from`, `subject`, `unseenOnly`, `since`, `limit` |
| `get_email_detail` | 根据 UID 获取单封邮件的完整正文与附件明细 | `uid`, `mailbox` |
| `list_mailboxes` | 获取服务器的所有邮箱文件夹目录列表 | 无 |

---

## 📮 常见邮箱服务商配置参考

> ⚠️ **重要提示**：绝大多数主流邮箱（如 QQ、163、Gmail 等）均**不支持**直接使用邮箱登录密码，必须在邮箱网页端设置中开启 POP3/IMAP/SMTP 服务并生成专属的 **授权码 (App Password)**。

| 邮箱服务商 | SMTP 服务器 & 端口 | IMAP 服务器 & 端口 | 密码填写要求 |
| :--- | :--- | :--- | :--- |
| **QQ 邮箱** | `smtp.qq.com:465` (SSL) | `imap.qq.com:993` (SSL) | 在「设置 -> 账户」生成 16 位 POP3/IMAP 授权码 |
| **163 网易邮箱** | `smtp.163.com:465` (SSL) | `imap.163.com:993` (SSL) | 在「设置 -> POP3/SMTP/IMAP」开启并获取授权密码 |
| **Gmail** | `smtp.gmail.com:465` (SSL) | `imap.gmail.com:993` (SSL) | 开启两步验证后，在 Google 账号中生成「应用专用密码」 |
| **Outlook / Office 365** | `smtp.office365.com:587` | `outlook.office365.com:993` | 需启用相应现代认证或应用密码 |

---

## 🤝 参与贡献

欢迎任何形式的贡献与建议！请在提交代码前仔细阅读我们的 [贡献指南 (CONTRIBUTING.md)](./CONTRIBUTING.md)。

---

## 📄 开源许可证

本项目基于 [Apache License 2.0](./LICENSE) 协议开源。

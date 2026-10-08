# MCP Server Email

<p align="center">
  <strong>生产级 Email Model Context Protocol (MCP) 服务端（支持多账户并发、会话回复保持、IMAP 复合检索、附件沙箱与防灾软删除，提供 Stdio/SSE 双模通信）</strong>
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

`mcp-server-email` 是专为大语言模型（LLM）与 AI 智能体（Agent）打造的生产级邮件能力底座。通过遵循标准化 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 协议，为支持 MCP 的各类客户端与智能体宿主环境提供完整的电子邮件外发、会话回复、草稿审查、多维检索、正文提纯、附件沙箱落盘与状态管理能力。

---

## ✨ 核心特性

- 🎯 **13 大核心工具矩阵**：覆盖邮件外发（`send_email`）、会话回复保持（`reply_email`）、草稿箱审查（`create_draft`）、多维检索（`search_emails`）、正文提纯（`get_email_detail`）、附件沙箱（`download_attachment`）、状态流转与极速未读看板；
- 👥 **原生多账户并发路由**：支持在单个服务实例中通过 `MCP_ACCOUNTS`（JSON）同时声明多个邮箱身份（如 `work`、`personal`），工具层自动按 `account` 参数精准分发；
- 🧵 **RFC 会话线程（Threading）保持**：专属 `reply_email` 工具自动识别原信 Message-ID，注入 `In-Reply-To` 与 `References` 邮件头，在 Outlook、Gmail 等客户端中维持原生树状会话折叠；
- 🛡️ **三位一体安全与防灾隔离**：
  - **凭据零泄露**：密码完全封存于环境层，Tool 入参及返回值绝不暴露敏感密钥；
  - **附件沙箱隔离**：物理落盘强制限制在受管安全目录，严格防御 `../` 路径穿越攻击；
  - **防灾软删除**：彻底禁用底层硬删除（EXPUNGE），删除意图统一路由至回收站（Trash）；
- ⚡ **Token 经济性与上下文防御**：HTML 正文自动提纯为 Markdown 并执行 30KB 安全截断；检索列表自带 150 字符 Preview 纯文本摘要；附件仅返回元数据，严禁大体积 Base64 塞爆上下文；
- 🔄 **Stdio / SSE 双模通信**：默认采用 `Stdio` 适配本地客户端进程直接拉起；支持 `--transport sse --port 3000` 切换为流式 HTTP 服务，便于 Docker 容器云或集中部署；
- 📦 **免安装秒开 (npx)**：一条命令直接通过 `npx -y @atengk/mcp-server-email` 极速加载。

---

## 🛠️ 快速配置与运行

### 通用 MCP 客户端配置 (JSON)

在支持 MCP 的客户端（如 Claude Desktop、Cursor、Cline、Windsurf 等）的配置文件中，将本服务添加至 `mcpServers`：

#### 方案 A：单账户配置模式 (Single Account)

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

#### 方案 B：多账户并发配置模式 (Multi-Account)

通过单一 `MCP_ACCOUNTS` 环境变量配置多个邮箱画像，大模型可在调用工具时按需指定 `account: "work"` 或 `account: "personal"`：

```json
{
  "mcpServers": {
    "email": {
      "command": "npx",
      "args": ["-y", "@atengk/mcp-server-email"],
      "env": {
        "MCP_DEFAULT_ACCOUNT": "work",
        "MCP_ACCOUNTS": "{\"personal\":{\"smtp\":{\"host\":\"smtp.qq.com\",\"port\":465,\"secure\":true,\"user\":\"me@qq.com\",\"pass\":\"YOUR_QQ_AUTH_CODE\"},\"imap\":{\"host\":\"imap.qq.com\",\"port\":993,\"secure\":true,\"user\":\"me@qq.com\",\"pass\":\"YOUR_QQ_AUTH_CODE\"}},\"work\":{\"smtp\":{\"host\":\"smtp.office365.com\",\"port\":587,\"secure\":false,\"user\":\"me@company.com\",\"pass\":\"YOUR_WORK_PASS\"},\"imap\":{\"host\":\"outlook.office365.com\",\"port\":993,\"secure\":true,\"user\":\"me@company.com\",\"pass\":\"YOUR_WORK_PASS\"}}}"
      }
    }
  }
}
```

---

### Docker 容器运行 (SSE 模式)

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

## 🧰 13 大核心 MCP 工具矩阵

| 分类 | 工具名称 | 核心职责说明 | 关键入参 |
| :--- | :--- | :--- | :--- |
| **账户发现** | `list_accounts` | 列出已配置的全部邮箱画像标识（密码脱敏） | 无 |
| **外发通信** | `send_email` | 撰写并发送全新邮件（支持文本/HTML/附件/抄送） | `to`, `subject`, `text`, `html`, `attachments`, `cc`, `bcc`, `account` |
| | `reply_email` | 保持会话线程的智能回复（自动注入 In-Reply-To） | `originalUid`, `text`, `html`, `replyAll`, `attachments`, `account` |
| | `create_draft` | 保存草稿至草稿箱（用于人工二次审阅） | `to`, `subject`, `text`, `html`, `attachments`, `account` |
| **检索查询** | `search_emails` | 多维复合检索（含分页、hasMore 与 150 字预览摘要） | `query`, `from`, `subject`, `since`, `before`, `unseenOnly`, `page`, `limit`, `account` |
| | `get_email_detail` | 获取邮件正文（HTML 提纯 Markdown，超长截断）与附件清单 | `uid`, `mailbox`, `account` |
| | `download_attachment`| 按需将指定附件安全下载至本地受管沙箱目录 | `uid`, `filename`, `account` |
| **状态看板** | `get_mailbox_status` | 毫秒级极速获取文件夹总数与未读数统计 | `mailbox`, `account` |
| | `list_mailboxes` | 列出当前服务商所有可用文件夹及别名映射 | `account` |
| **归类整理** | `mark_email_read` | 批量 / 单封标记邮件已读或未读 | `uids`, `read`, `mailbox`, `account` |
| | `flag_email` | 设置或取消邮件星标（重要度标记） | `uids`, `flagged`, `mailbox`, `account` |
| | `move_email` | 移动邮件至目标文件夹（移至 Trash 实现软删除） | `uids`, `targetMailbox`, `sourceMailbox`, `account` |
| **诊断排障** | `verify_connection` | 一键体检 SMTP 与 IMAP 连通性及凭据有效性 | `account` |

---

## ⚙️ 环境变量全景表

| 环境变量名 | 类型 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `MCP_ACCOUNTS` | JSON 字符串 | 多账户配置对象（包含多个画像的 SMTP 与 IMAP 凭据） | 见快速配置多账户示例 |
| `MCP_ACCOUNTS_FILE` | 字符串 | 外部多账户 JSON 配置文件绝对路径 | `/etc/mcp-email/accounts.json` |
| `MCP_DEFAULT_ACCOUNT` | 字符串 | 多账户模式下的缺省路由账户名称 | `work` |
| `MCP_ATTACHMENT_DIR` | 字符串 | 附件下载的本地受管沙箱根目录 | `/data/mcp-attachments`（默认系统临时目录） |
| `MCP_SMTP_HOST` | 字符串 | 单账户模式：SMTP 发信服务器主机 | `smtp.qq.com` |
| `MCP_SMTP_PORT` | 数字 | 单账户模式：SMTP 发信端口 | `465` 或 `587` |
| `MCP_SMTP_SECURE` | 布尔 | 单账户模式：是否启用 TLS/SSL 加密 | `true`（默认 true） |
| `MCP_SMTP_USER` | 字符串 | 单账户模式：SMTP 登录用户名 / 邮箱地址 | `user@example.com` |
| `MCP_SMTP_PASS` | 字符串 | 单账户模式：SMTP 授权码或密码 | `YOUR_AUTH_CODE` |
| `MCP_SMTP_FROM` | 字符串 | 单账户模式：发件人展示格式 | `AI 助理 <user@example.com>` |
| `MCP_IMAP_HOST` | 字符串 | 单账户模式：IMAP 收信服务器主机 | `imap.qq.com` |
| `MCP_IMAP_PORT` | 数字 | 单账户模式：IMAP 收信端口 | `993` |
| `MCP_IMAP_SECURE` | 布尔 | 单账户模式：是否启用 TLS/SSL 加密 | `true`（默认 true） |
| `MCP_IMAP_USER` | 字符串 | 单账户模式：IMAP 登录用户名 / 邮箱地址 | `user@example.com` |
| `MCP_IMAP_PASS` | 字符串 | 单账户模式：IMAP 授权码或密码 | `YOUR_AUTH_CODE` |
| `MCP_TRANSPORT` | 枚举 | 通信传输模式 (`stdio` 或 `sse`) | `stdio`（默认 stdio） |
| `MCP_PORT` | 数字 | SSE 模式下的 HTTP 监听端口 | `3000` |

---

## 📮 常见邮箱服务商配置指引

> ⚠️ **避坑指南**：现代主流邮箱服务商出于安全考虑，均**不支持**直接使用邮箱日常登录密码，必须在邮箱网页端设置中开启 POP3/IMAP/SMTP 服务并生成专属的 **授权码 / 应用密码 (App Password)**。

| 邮箱服务商 | SMTP 服务器 & 端口 | IMAP 服务器 & 端口 | 密码填写要求与开启路径 |
| :--- | :--- | :--- | :--- |
| **QQ 邮箱** | `smtp.qq.com:465` (SSL) | `imap.qq.com:993` (SSL) | 在「网页设置 -> 账户 -> POP3/IMAP 服务」生成 16 位专属授权码 |
| **163 网易邮箱** | `smtp.163.com:465` (SSL) | `imap.163.com:993` (SSL) | 在「网页设置 -> POP3/SMTP/IMAP」开启并获取客户端授权密码 |
| **Gmail** | `smtp.gmail.com:465` (SSL) | `imap.gmail.com:993` (SSL) | 开启 Google 账号两步验证后，在「安全性 -> 应用专用密码」生成 |
| **Outlook / Office 365** | `smtp.office365.com:587` | `outlook.office365.com:993` | 需管理员开启相应 IMAP/SMTP 访问权限或配置应用密码 |

---

## 🤝 参与贡献

欢迎任何形式的贡献与建议！请在提交代码前仔细阅读我们的 [贡献指南 (CONTRIBUTING.md)](./CONTRIBUTING.md)。

---

## 📄 开源许可证

本项目基于 [Apache License 2.0](./LICENSE) 协议开源。

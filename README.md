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

`mcp-server-email` 是专为大语言模型（LLM）与 AI 智能体（Agent）打造的生产级邮件能力底座。通过遵循标准化 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 协议，为支持 MCP 的各类客户端宿主环境提供完整的电子邮件外发、会话回复、草稿审查、多维检索、正文提纯、附件沙箱落盘与状态管理能力。

---

## ✨ 核心特性

- 🎯 **13 大核心工具矩阵**：全功能覆盖外发、会话回复、草稿箱人机协同、多维分页检索、状态看板、正文提纯、附件沙箱、状态标记与防灾软删除；
- ✉️ **纯发信模式原生支持**：若仅需外发邮件，仅需配置 5 个 SMTP 环境变量，零 IMAP 负担，无需开启收信权限，安全轻量；
- 👥 **多邮箱灵活扩展**：天然适配客户端原生多实例声明（如 `email-personal`、`email-work`），亦支持单实例内通过 `MCP_ACCOUNTS`（JSON）聚合路由；
- 🧵 **RFC 会话线程（Threading）保持**：专属 `reply_email` 工具自动读取原信 Message-ID，注入 `In-Reply-To` 与 `References` 邮件头，在各类邮件客户端中维持原生树状会话折叠；
- 🛡️ **三位一体安全与防灾隔离**：
  - **凭据零泄露**：密码完全封存于环境层，Tool 入参及返回值绝不暴露敏感密钥；
  - **附件沙箱隔离**：物理落盘强制限制在受管安全目录，严格防御 `../` 路径穿越攻击；
  - **防灾软删除**：彻底禁用底层硬删除（EXPUNGE），删除意图统一路由至回收站（Trash）；
- ⚡ **Token 经济性与上下文防御**：HTML 正文自动提纯为 Markdown 并执行 30KB 安全截断；检索列表自带 150 字符 Preview 纯文本摘要；邮件详情仅返回附件元数据清单，严禁大体积 Base64 塞爆上下文；
- 🔄 **Stdio / SSE 双模通信**：默认采用 `Stdio` 适配本地客户端进程直接拉起；支持 `--transport sse --port 3000` 切换为流式 HTTP 服务，便于 Docker 容器云或集中部署；
- 📦 **免安装秒开 (npx)**：一条命令直接通过 `npx -y @atengk/mcp-server-email` 极速加载。

---

## 🛠️ 通用 MCP 客户端配置

本项目完全符合标准化 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 规范。所有支持 MCP 的客户端（包括 Claude Desktop、Cursor、Cline、Windsurf、Cherry Studio 等）均采用标准 JSON 语法在客户端配置文件中的 `mcpServers` 节点声明。

### 场景一：极简仅发送邮件（纯 SMTP，零 IMAP 负担）

> 💡 **如果只想发送邮件？**  
> 仅需配置 5 个 `MCP_SMTP_*` 环境变量即可！无需配置任何 IMAP 账号与密码，无需开通收信权限，安全且开箱即用。适用于自动化报告、监控告警、周报外发等纯发信场景。

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
        "MCP_SMTP_FROM": "AI 助理 <your_email@qq.com>"
      }
    }
  }
}
```

### 场景二：全功能收发一体（SMTP + IMAP）

同时配置发信通道（SMTP）与查收通道（IMAP），解锁全部 13 大工具矩阵（包括全文检索、正文提纯、会话回复、草稿审查、附件沙箱与标记归类）：

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
        "MCP_SMTP_FROM": "AI 助理 <your_email@qq.com>",
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

### 场景三：配置多个邮箱实例（推荐：客户端原生多实例）

如果您有多个邮箱（例如个人 QQ 邮箱与公司工作邮箱），**最推荐、最直观的做法**是直接在客户端的 `mcpServers` 下声明多个独立服务（如 `email-personal` 与 `email-work`），每个服务各自指定独立的环境变量：

```json
{
  "mcpServers": {
    "email-personal": {
      "command": "npx",
      "args": ["-y", "@atengk/mcp-server-email"],
      "env": {
        "MCP_SMTP_HOST": "smtp.qq.com",
        "MCP_SMTP_PORT": "465",
        "MCP_SMTP_SECURE": "true",
        "MCP_SMTP_USER": "personal@qq.com",
        "MCP_SMTP_PASS": "YOUR_QQ_AUTH_CODE",
        "MCP_SMTP_FROM": "个人助理 <personal@qq.com>"
      }
    },
    "email-work": {
      "command": "npx",
      "args": ["-y", "@atengk/mcp-server-email"],
      "env": {
        "MCP_SMTP_HOST": "smtp.office365.com",
        "MCP_SMTP_PORT": "587",
        "MCP_SMTP_SECURE": "false",
        "MCP_SMTP_USER": "work@company.com",
        "MCP_SMTP_PASS": "YOUR_WORK_PASS",
        "MCP_SMTP_FROM": "工作助理 <work@company.com>",
        "MCP_IMAP_HOST": "outlook.office365.com",
        "MCP_IMAP_PORT": "993",
        "MCP_IMAP_SECURE": "true",
        "MCP_IMAP_USER": "work@company.com",
        "MCP_IMAP_PASS": "YOUR_WORK_PASS"
      }
    }
  }
}
```

> 💡 **进阶选项：单服务内多账户聚合（可选）**  
> 若您希望在单一服务端进程内同时纳管多个邮箱画像，并通过 Tool 入参中的 `account` 动态路由，也可以使用环境变量 `MCP_ACCOUNTS`（JSON 字符串）或 `MCP_ACCOUNTS_FILE`（指向本地文件，参考 [`examples/accounts.example.json`](./examples/accounts.example.json)）。普通场景优先推荐上述**客户端原生多实例**方式。

---

## 🧰 13 大核心 MCP 工具详尽手册

所有工具均支持可选的 `account?: string` 参数，未传时自动回退至默认账户。

### 1. 账户发现与连通性自检

- **`list_accounts`**：列出当前服务端已注册的所有可用账户画像标识（包含邮箱地址、运行模式 `mode`（full/send_only/receive_only）、收发能力特性 `capabilities` 及服务器脱敏主机，严禁暴露密码）。
  - *入参*：无
- **`verify_connection`**：一键对指定账户或默认账户发起真实的协议握手体检（原生支持全功能与纯发信模式），返回各通道连通性报告与就绪状态说明。
  - *入参*：`account?: string`

> 💡 **纯发信模式说明**：若账户仅配置了 SMTP（纯发信模式），外发工具 `send_email` 与自检工具均正常工作；若智能体误调收信相关工具（如 `search_emails`、`reply_email` 等），服务端会自动返回明确的纯发信模式指引，防止大模型产生幻觉。

### 2. 外发通信与人机协同

- **`send_email`**：外发全新邮件。支持纯文本、HTML 富文本、抄送、密送与本地文件附件。
  - *入参*：
    - `to`: 收件人地址（单字符串或字符串数组）
    - `subject`: 邮件主题
    - `text?`: 纯文本正文
    - `html?`: HTML 格式正文
    - `cc?`: 抄送地址列表
    - `bcc?`: 密送地址列表
    - `attachments?`: 附件列表（包含 `filename`, `path`, `content`, `contentType`）
    - `account?`: 邮箱账户标识
- **`reply_email`**：会话回复专属工作流。根据被回复邮件原信自动注入 `In-Reply-To` 与 `References` 头，自动添加 `Re:` 前缀。
  - *入参*：
    - `originalUid`: 原邮件 UID
    - `text?` / `html?`: 回复正文
    - `replyAll?`: 是否全员回复（默认 false，为 true 时自动保留原抄送人并排除自身）
    - `mailbox?`: 原邮件所在文件夹（默认 INBOX）
    - `account?`: 邮箱账户标识
- **`create_draft`**：将邮件载荷构造成标准 RFC 822 MIME 数据并存入草稿箱，等待用户在客户端中复核与审批后手动发出。
  - *入参*：`to?`, `subject?`, `text?`, `html?`, `cc?`, `bcc?`, `attachments?`, `account?`

### 3. 多维检索与正文提纯

- **`search_emails`**：在指定邮箱中进行多维组合检索。包含发件人、收件人、主题、未读、星标、附件与日期范围筛选，并自带 **150 字符 Preview 纯文本摘要**与分页元数据。
  - *入参*：`query?`, `from?`, `to?`, `subject?`, `unseenOnly?`, `flaggedOnly?`, `hasAttachment?`, `since?`, `before?`, `page?` (默认 1), `limit?` (默认 10), `mailbox?` (默认 INBOX), `account?`
- **`get_email_detail`**：获取邮件完整详情。自动将 HTML 清洗转换为结构清晰的轻量 Markdown，执行 **30KB 阈值截断保护**并返回脱敏附件元数据列表（严禁 Base64 泄露）。
  - *入参*：`uid`: 邮件 UID, `mailbox?` (默认 INBOX), `account?`
- **`download_attachment`**：将指定附件安全提取并落盘至受管本地沙箱，返回物理绝对路径与 `file:///` 直达 URI。
  - *入参*：`uid`: 邮件 UID, `attachmentId`: 附件标识序号（如 '0'）或附件原名, `mailbox?` (默认 INBOX), `account?`

### 4. 状态看板与归类流转

- **`get_mailbox_status`**：毫秒级极速获取指定或全部文件夹的状态看板（总邮件数、未读数、最近邮件数）。
  - *入参*：`mailbox?` (指定单个文件夹或缺省统计全部), `account?`
- **`list_mailboxes`**：列出当前连接邮箱服务商所有可用的物理文件夹清单。
  - *入参*：`account?`
- **`mark_email_read`**：修改邮件的已读/未读状态标记（`\Seen`），支持单封与批量原子变更。
  - *入参*：`uids`: 单个 UID 或 UID 数组, `read?` (默认 true), `mailbox?` (默认 INBOX), `account?`
- **`flag_email`**：设置或取消重要星标标记（`\Flagged`），用于高优先级事项置顶关注。
  - *入参*：`uids`: 单个 UID 或 UID 数组, `flagged?` (默认 true), `mailbox?` (默认 INBOX), `account?`
- **`move_email`**：将邮件跨文件夹移动或归档。**彻底杜绝物理硬删除（EXPUNGE）**，软删除请指定 `targetMailbox: "trash"`。
  - *入参*：`uids`: 单个 UID 或 UID 数组, `targetMailbox`: 目标文件夹或别名, `sourceMailbox?` (默认 INBOX), `account?`

---

## ⚙️ 环境变量全景表

| 环境变量名 | 类型 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `MCP_ACCOUNTS` | JSON 字符串 | 多账户配置对象（包含多个画像的 SMTP 与 IMAP 凭据） | 见多账户配置示例 |
| `MCP_ACCOUNTS_FILE` | 字符串 | 外部多账户 JSON 配置文件绝对路径 | `/etc/mcp-email/accounts.json` |
| `MCP_DEFAULT_ACCOUNT` | 字符串 | 多账户模式下的缺省路由账户名称 | `work` |
| `MCP_ATTACHMENT_DIR` | 字符串 | 附件下载的本地受管沙箱根目录 | `/data/mcp-attachments`（默认系统隔离临时目录） |
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

## 🐳 Docker 容器运行 (SSE 模式)

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

## 💻 本地研发与质量保障

```bash
# 安装依赖
pnpm install

# 运行全量测试套件
pnpm test

# 执行 TypeScript 类型检查
pnpm typecheck

# 编译打包单文件 ESM 产物
pnpm build
```

---

## 🤝 参与贡献

欢迎任何形式的贡献与建议！请在提交代码前仔细阅读我们的 [贡献指南 (CONTRIBUTING.md)](./CONTRIBUTING.md)。

---

## 📄 开源许可证

本项目基于 [Apache License 2.0](./LICENSE) 协议开源。

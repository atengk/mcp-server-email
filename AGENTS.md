# Agent 行为准则与技能规范

## 1. 项目概览与架构原则 (Project Architecture)
本项目为生产级 Model Context Protocol (MCP) 邮件服务端，基于 TypeScript / Node.js 构建，支持 Stdio 与 Streamable SSE 双模传输，对外提供包含邮件外发、会话回复、草稿审查、多维检索、正文提纯、附件沙箱与状态流转在内的 13 大核心工具矩阵。

---

## 2. 研发红线与安全约束 (Engineering Red Lines)

- **MCP Stdio 通道纯净红线 (Stdio Purity)**：
  - 在标准输入输出（Stdio）模式下，`stdout` 是 MCP 协议 JSON-RPC 消息报文的专有通信信道；
  - **正式业务源码中绝对严禁使用裸 `console.log`**；所有运行日志、状态输出与排查堆栈必须 100% 通过 `console.error` 输出至标准错误流（stderr），避免报文解析崩溃。

- **凭据隔离与零泄露不变量 (Zero-Secret Isolation)**：
  - 邮箱密码与授权码统一由环境变量（`MCP_SMTP_*` / `MCP_IMAP_*` / `MCP_ACCOUNTS`）在启动时受控加载；
  - **Tool 调用入参与返回结果中绝对禁止传递或暴露明文密码**；
  - `list_accounts` 等元数据发现工具仅暴露脱敏后的账户标识与邮箱地址。

- **Token 经济性与上下文防御 (Token Guardrails)**：
  - 邮件正文提取必须过滤冗余 CSS 与脚本标签，清洗转换为轻量 Markdown 或纯文本；
  - 对超过 30KB 的超长邮件正文强制执行安全截断并附带截断声明；
  - 检索邮件列表强制返回 150 字符纯文本 Preview 摘要；
  - 邮件详情中仅返回附件元数据清单，**严禁将大体积 Base64 编码直接嵌入响应**。

- **附件沙箱与路径穿越防护 (Sandbox Security)**：
  - 附件物理落盘必须严格限制在 `MCP_ATTACHMENT_DIR` 指定目录或系统受管临时目录（`os.tmpdir()/mcp-email-attachments`）；
  - 强制对附件原始文件名进行净化过滤，**坚决抵御 `../` 路径穿越攻击**，严禁向沙箱外部或系统关键目录写入文件。

- **防灾软删除准则 (Soft-Delete Only)**：
  - 坚决杜绝提供或调用物理硬删除（IMAP `EXPUNGE`）指令，防止智能体幻觉导致用户邮件永久损毁；
  - 任何删除意图统一通过移动至回收站（`Trash`）实现安全软删除。

- **多账户与会话线程约定 (Multi-Account & Threading)**：
  - 所有工具统一接受可选的 `account?: string` 参数，未指定时平滑回退至 `MCP_DEFAULT_ACCOUNT` 或默认账户；
  - 邮件回复操作必须优先使用 `reply_email`，自动注入 RFC 规范的 `In-Reply-To` 与 `References` 邮件头，维持客户端原生会话折叠。

---

## 3. Agent 技能配置 (Agent skills)

### 问题追踪 (Issue tracker)
本项目使用 GitHub Issues 管理需求任务与缺陷反馈，通过 `gh` CLI 工具执行。详见 `docs/agents/issue-tracker.md`。

### 分诊标签 (Triage labels)
采用 5 个标准分诊角色标签（`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`）。详见 `docs/agents/triage-labels.md`。

### 领域文档 (Domain docs)
采用单上下文模式（根目录 `CONTEXT.md` 与 `docs/adr/`）。详见 `docs/agents/domain.md`。

# 问题追踪系统：GitHub (Issue Tracker: GitHub)

本项目的缺陷反馈、需求任务（Tickets）与规格说明（Specs）统一托管于 GitHub Issues。所有操作均通过 GitHub CLI（`gh`）命令行工具执行。

## 操作约定 (Conventions)

- **创建 Issue**：`gh issue create --title "..." --body "..."`（多行内容推荐使用 EOF Heredoc）。
- **查看 Issue**：`gh issue view <number> --comments`（可通过 `jq` 过滤评论并获取标签）。
- **列出 Issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`（配合 `--label` 与 `--state` 过滤）。
- **评论 Issue**：`gh issue comment <number> --body "..."`。
- **添加 / 移除标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`。
- **关闭 Issue**：`gh issue close <number> --comment "..."`。

仓库地址自动从本地 `git remote -v` 中推导（在克隆目录内执行 `gh` 会自动绑定）。

## Pull Request 分诊支持 (Pull Requests as a Triage Surface)

**PR 作为外部需求入口：否 (PRs as a request surface: no)**。
*(若希望将外部 PR 纳入与 Issue 相同的分诊队列，可将此项设为 `yes`，`/triage` 技能将读取此标识。)*

当配置为 `yes` 时，PR 将走与 Issue 相同的分诊标签和流转状态，使用对应的 `gh pr` 指令：
- **查看 PR**：`gh pr view <number> --comments` 与 `gh pr diff <number>`（查看 Diff）。
- **列出待分诊外部 PR**：`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，仅保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的外部 PR。
- **评论 / 标签 / 关闭**：`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

由于 GitHub 的 Issue 与 PR 共享同一编号空间，单纯的 `#42` 可能指代任一对象——优先使用 `gh pr view 42`，若非 PR 则回退至 `gh issue view 42`。

## 当技能提示 "publish to the issue tracker" 时

创建一个 GitHub Issue。

## 当技能提示 "fetch the relevant ticket" 时

执行 `gh issue view <number> --comments`。

## 探路者协作操作规范 (Wayfinding Operations)

供 `/wayfinder` 技能使用。**导航图 (Map)** 为单个 Issue，关联的 **子任务 (Child tickets)** 为独立 Issue：

- **导航图 (Map)**：单个标记为 `wayfinder:map` 标签的 Issue，包含说明、当前决策（Decisions-so-far）与迷雾区（Fog）正文。创建命令：`gh issue create --label wayfinder:map`。
- **子任务卡 (Child ticket)**：通过 GitHub sub-issue 关联到导航图；若未开启 sub-issues，则在地图正文任务列表中添加子任务，并在子任务正文顶部注明 `Part of #<map>`。标签格式为 `wayfinder:<type>`（如 `research` / `prototype` / `grilling` / `task`）。被认领后分配给对应开发者。
- **阻塞依赖 (Blocking)**：使用 GitHub 原生 Issue 依赖能力，通过 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` 添加依赖边，其中 `<blocker-db-id>` 为阻塞者的数字数据库 ID（`gh api repos/<owner>/<repo>/issues/<n> --jq .id`）。若无原生依赖支持，在子任务正文顶部添加 `Blocked by: #<n>, #<n>`。当所有阻塞项关闭时视为已解除阻塞。
- **前沿查询 (Frontier query)**：列出地图未解决的子任务，剔除存在未关闭阻塞项或已被认领的任务；首个满足条件的任务生效。
- **认领 (Claim)**：`gh issue edit <n> --add-assignee @me`。
- **解决 (Resolve)**：`gh issue comment <n> --body "<answer>"`，然后 `gh issue close <n>`，并将决策要点追加到地图的 Decisions-so-far 章节中。

# 领域文档消费规范 (Domain Docs)

工程技能在探索和修改代码库时，如何读取与遵循本项目的领域设计文档：

## 开始探索前必读文件

- 根目录下的 **`CONTEXT.md`**，或
- 根目录下的 **`CONTEXT-MAP.md`**（若存在多上下文映射文件，阅读与当前任务相关的上下文文档）；
- **`docs/adr/`** 目录——阅读与你即将处理的领域相关的架构决策记录 (ADR)。在多上下文仓库中，还需检查对应模块下的 `src/<context>/docs/adr/`。

若上述文件不存在，**静默继续执行**，无需显式报错，也不要主动提议提前创建。`/domain-modeling` 技能会在术语或架构决策真正敲定时按需延迟创建。

## 目录布局结构 (File Structure)

本项目采用**单上下文结构 (Single-context repo)**：

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-typescript-runtime-and-dual-transports.md
│   └── 0002-environment-based-credential-isolation.md
└── src/
```

## 严格使用词汇表术语 (Use the glossary's vocabulary)

当输出包含领域概念时（包括 Issue 标题、重构方案、方案假设、测试用例名称等），必须严格使用 `CONTEXT.md` 中定义的标准术语，严禁漂移到词汇表明确标明 `_Avoid_` 的同义词。

若所需概念尚未在词汇表中定义，这是一个明确信号——要么你在创造项目中未曾认可的新概念（需重新审视），要么存在真实的领域盲区（需通过 `/domain-modeling` 补充登记）。

## 架构决策冲突提示 (Flag ADR conflicts)

若输出方案与既有 ADR 决策发生冲突，必须显式指明并陈述理由，严禁静默覆盖：

> _与 ADR-0001（TypeScript 运行时与双模传输）存在冲突——但值得重新讨论，原因为……_

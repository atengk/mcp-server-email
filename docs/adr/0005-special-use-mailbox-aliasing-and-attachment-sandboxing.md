# 5. Special-Use Mailbox Aliasing and Attachment Sandboxing

## Status
Accepted

## Context & Decision
Email service providers diverge wildly in naming special folders (e.g. Gmail uses `[Gmail]/Drafts`, QQ Mail uses `草稿箱` or `Deleted Messages`, and standard IMAP servers use `Drafts` or `Trash`). Furthermore, allowing LLM agents to download attachments to unrestricted filesystem locations introduces path traversal vulnerabilities. We decided to implement an automatic special-use mailbox resolver that transparently maps logical aliases (`drafts`, `trash`, `sent`, `inbox`) to the provider's physical mailbox path, and enforce an attachment sandbox directory (customizable via `MCP_ATTACHMENT_DIR` or defaulting to an OS-isolated temporary location) with strict filename sanitization against path traversal.

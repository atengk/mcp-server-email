# 6. Multi-Account Configuration Profiles and Dynamic Routing

## Status
Accepted

## Context & Decision
Users frequently manage multiple email addresses (such as work and personal accounts) across different mail providers within a single LLM assistant setup. Requiring users to spin up multiple distinct MCP server instances complicates host configurations and scatters tool definitions. We decided to support multi-account profiles declared either via the inline `MCP_ACCOUNTS` JSON environment variable or through an external file specified by `MCP_ACCOUNTS_FILE`, while preserving full backward compatibility for single-account `MCP_SMTP_*` and `MCP_IMAP_*` definitions (mapping implicitly to `default`). Tools accept an optional `account` argument with fallback to `MCP_DEFAULT_ACCOUNT`, and a dedicated `list_accounts` discovery tool exposes configured account identities without leaking passwords.

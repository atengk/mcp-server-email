# 4. Token-Efficient Payloads and On-Demand Attachment Materialization

## Status
Accepted

## Context & Decision
Email messages often contain bloated HTML layouts and multi-megabyte binary attachments. Returning raw HTML or Base64 payloads inside MCP tool responses rapidly exhausts LLM context windows and triggers payload size limits. We decided to convert HTML bodies into clean, sanitized text/Markdown with a safety truncation threshold (default 30KB), return 150-character plain-text preview snippets in search results, and materialize attachments strictly on-demand into the local filesystem via a separate `download_attachment` tool, returning local file paths instead of inline binaries.

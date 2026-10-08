# 2. Environment-Based Credential Isolation with Prefixed Variables

## Status
Accepted

## Context & Decision
Email servers require sensitive credentials (host, port, username, password/auth code). Allowing LLMs to pass these credentials dynamically as tool arguments exposes them to prompt leakage, history logging, and token pollution. We decided to isolate all email credentials within environment variables scoped with standard prefixes (`MCP_SMTP_*` and `MCP_IMAP_*`). The MCP server reads and validates these credentials at boot, keeping tool invocations focused purely on functional parameters (recipients, subject, query filters) with zero secret exposure.

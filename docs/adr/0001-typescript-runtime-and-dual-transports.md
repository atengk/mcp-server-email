# 1. Use TypeScript and Dual MCP Transports (Stdio & SSE)

## Status
Accepted

## Context & Decision
For `mcp-server-email`, we need a runtime that supports both frictionless zero-install local execution (`npx -y mcp-server-email`) and containerized remote deployments, along with robust email protocol libraries. We chose TypeScript on Node.js using `@modelcontextprotocol/sdk` supporting both Stdio and SSE transport modes over compiled alternatives (like Go) because Node.js possesses the most mature and battle-tested SMTP/IMAP parsing ecosystem (such as Nodemailer and Mailparser) and allows seamless `npx` execution without platform-specific binary orchestration.

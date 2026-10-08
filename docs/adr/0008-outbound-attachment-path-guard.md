# 8. Outbound Attachment Path Guard and Sensitive File Exfiltration Defense

## Status
Accepted

## Context & Decision
When AI agents compose outgoing emails via `send_email` or draft workflows, specifying local file paths for attachments (`attachments[].path`) introduces serious data exfiltration risks if the agent hallucinates or encounters prompt injection (e.g. attempting to send `/etc/passwd`, SSH keys, or `.env` files). We decided to enforce an outbound attachment security guard (`validateOutboundAttachmentPath`) that strictly restricts attachable local file paths to either the managed attachment sandbox directory (`MCP_ATTACHMENT_DIR`) or the current workspace working directory, while explicitly blocking sensitive credential files (`.env*`, `id_rsa*`, `.pem`, `.key`, `shadow`, `passwd`).

# MCP Server Email

A Model Context Protocol (MCP) server providing standard email outbound delivery (SMTP) and inbound mailbox query and retrieval (IMAP) capabilities.

## Language

**Message**:
An electronic mail record comprising headers (sender, recipients, subject, date), text or HTML content, and optional attachments.
_Avoid_: Letter, dispatch, mail document

**Mailbox**:
A remote folder or container on an email server (such as INBOX, Sent, Archive, Trash) holding messages.
_Avoid_: Directory, folder, bucket

**Transport (SMTP)**:
The outbound transmission protocol interface responsible for routing and delivering messages to target recipient servers.
_Avoid_: Dispatcher, mail sender, push engine

**Store (IMAP)**:
The inbound mail access protocol interface responsible for querying, searching, filtering, and fetching messages from mailboxes.
_Avoid_: Receiver, pop agent, puller

**Attachment**:
A discrete file or binary asset attached to and transmitted alongside a message.
_Avoid_: Enclosure, payload, raw file

**MCP Transport**:
The communication protocol between the MCP client and this server, supporting either local standard input/output (`Stdio`) or network streamable HTTP (`SSE`).
_Avoid_: Socket channel, pipe mode

**Credential Configuration**:
The server configuration parameters supplied strictly via environment variables prefixed with `MCP_SMTP_` and `MCP_IMAP_` to maintain credential boundary isolation from the LLM prompt context.
_Avoid_: Tool auth params, inline secrets

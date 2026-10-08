# MCP Server Email

A Model Context Protocol (MCP) server providing standard email outbound delivery (SMTP) and inbound mailbox query and retrieval (IMAP) capabilities.

## Language

**Message**:
An electronic mail record comprising headers (sender, recipients, subject, date), text or HTML content, and optional attachments.
_Avoid_: Letter, dispatch, mail document

**Mailbox**:
A remote folder or container on an email server (such as INBOX, Sent, Archive, Trash, Drafts) holding messages.
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

**Draft**:
An unsent message created and stored in the Drafts mailbox to allow human verification before final transmission.
_Avoid_: Temporary letter, draft note, pending mail

**Flag**:
A status indicator attached to a message in an IMAP mailbox, denoting read state (Seen/Unseen) or priority (Flagged/Starred).
_Avoid_: Tag, label, badge

**Preview Snippet**:
A short, sanitized plain-text excerpt of a message body (up to 200 characters) returned in search results to minimize LLM token consumption.
_Avoid_: Abstract, blurb, summary text

**On-Demand Attachment Materialization**:
The process of saving an email attachment into a local storage path only when explicitly requested, returning a local filesystem URI rather than large Base64 blobs in the conversation context.
_Avoid_: Payload injection, inline blob dump

**Special-Use Mailbox**:
A logical mailbox role (such as INBOX, Drafts, Trash, Sent, Archive, Junk) that the server automatically resolves from standard aliases to the provider's physical mailbox path.
_Avoid_: System directory, default path, hardcoded folder

**Attachment Sandbox**:
A secured and isolated directory location where downloaded email attachments are materialized, fortified with strict path traversal defenses.
_Avoid_: Dump directory, arbitrary export path

**Email Account Profile**:
A named configuration mapping a dedicated SMTP transport and IMAP store under a unique identifier (such as `personal` or `work`).
_Avoid_: Mailbox identity, credential profile, user tenant

**Multi-Account Routing**:
The dynamic selection mechanism that resolves an optional tool parameter `account` to an active Email Account Profile, with automatic fallback to `MCP_DEFAULT_ACCOUNT` or the single configured account.
_Avoid_: Tenant switching, context multiplexing

**Message Thread**:
A connected conversational sequence of related messages linked together through standard `In-Reply-To` and `References` headers.
_Avoid_: Mail chain, email chat, reply tree

**Attachment Guard**:
The security policy mechanism that validates and restricts candidate local file paths for outgoing email attachments, strictly preventing arbitrary file exfiltration of sensitive credentials.
_Avoid_: File blocker, path firewall

**Windowed Probe**:
The bounded lookahead scanning strategy that inspects up to 100 recent messages to satisfy IMAP post-filters (such as attachment presence) before applying pagination slices, eliminating sparse result pages.
_Avoid_: Full mailbox scan, brute-force filter

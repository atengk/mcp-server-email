# 3. Read-Write Safety and Soft Deletion via Trash Routing

## Status
Accepted

## Context & Decision
When enabling LLM agents to organize mailboxes, granting permanent physical deletion capabilities presents a catastrophic risk of unrecoverable data loss caused by model hallucination or ambiguous user commands. We decided to allow status mutations (marking as read/unread, toggling starred flags, moving folders) while strictly prohibiting physical `EXPUNGE` / hard-delete operations. Any deletion requests from agents must be handled as a soft move into the user's `Trash` mailbox, preserving auditability and manual recovery.

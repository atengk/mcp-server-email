# 7. Email Threading Preservation and Dedicated Reply Workflow

## Status
Accepted

## Context & Decision
Standard generic email transmission tools lack conversational awareness, causing agent replies to appear as isolated messages that break email threading in clients like Outlook, Apple Mail, and Gmail. We decided to introduce a dedicated `reply_email` tool that takes an `originalUid`, automatically resolves the sender as recipient, preserves CC recipients on reply-all, prefixes `Re: `, and injects RFC-compliant `In-Reply-To` and `References` headers. This separates conversational threading from fresh email authoring without forcing agents to manually track cryptographic message identifiers.

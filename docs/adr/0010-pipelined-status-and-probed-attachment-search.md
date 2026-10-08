# 10. Pipelined Status Queries and Probed Windowing for Attachment Search

## Status
Accepted

## Context & Decision
Querying mailbox statistics across all folders serially triggered high latency when many folders existed, and standard IMAP SEARCH lacked native attachment filters, causing post-sliced sparse pagination when `hasAttachment` was specified. We decided to pipeline all mailbox `STATUS` queries concurrently via `Promise.all` over the connection's command queue to achieve sub-second overview latency, and introduce a windowed probe mechanism (up to 100 recent messages) to accumulate matches before slicing, eliminating pagination gaps and empty sparse pages.

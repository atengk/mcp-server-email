# 11. Multi-Session SSE Transport Architecture

## Status
Accepted

## Context & Decision
Binding a single global `SSEServerTransport` caused subsequent client connections to overwrite the previous transport and cross-wire JSON-RPC messages in multi-agent or cloud container deployments. We decided to maintain an active session map (`Map<string, SSEServerTransport>`) keyed by `transport.sessionId`, routing incoming POST messages accurately via `?sessionId=...` and automatically purging transports on socket closure.

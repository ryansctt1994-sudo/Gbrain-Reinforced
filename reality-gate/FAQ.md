# Reality Gate FAQ

## What is Reality Gate?

Reality Gate is a fail-closed cryptographic proxy for agent/tool traffic. It requires a signed receipt before forwarding a request upstream.

## Is this a full MCP security solution?

No. It is a focused control boundary prototype. It proves and demonstrates one important invariant: no valid receipt, no upstream execution.

## Why Base64URL keys?

Base64URL values are easier to pass through shells, environment variables, JSON, CI systems, and container configuration without escaping problems.

## Why does the proxy reject upstream failures?

The proxy is designed to fail closed. If the upstream path cannot be reached, the caller gets a denial response instead of ambiguous partial success.

## Does it prevent replay attacks?

Not completely yet. Receipts include nonces, but this prototype does not persist consumed nonces. Production use should add nonce storage with expiration.

## Why the haiku?

Compliance logs are usually boring. Boring logs get ignored. The haiku makes denial states memorable while preserving structured JSONL audit records.

## Can I use this in production?

Treat this as a prototype until you add replay prevention, rate limiting, service identity, key rotation, persistent audit storage, and deployment-specific policies.

## What should I test first?

Run:

```bash
docker compose --profile test run --rm chaos
```

The expected result is:

```text
✅ GATE INTACT – fail-closed held.
```

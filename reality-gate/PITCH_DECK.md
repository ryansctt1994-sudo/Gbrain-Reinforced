# Reality Gate Pitch Deck

## 1. Title

Reality Gate: the fail-closed control layer for MCP agents.

Tagline: because hope is not a security policy.

## 2. Problem

AI agents can call tools quickly, repeatedly, and opaquely. A powerful agent without a hard execution boundary can burn budget, mutate state, leak data, or trigger upstream systems before a human notices.

## 3. Insight

Logging after execution is not governance. Governance starts before execution, at the boundary where authority is admitted or denied.

## 4. Solution

Reality Gate is a cryptographic proxy that requires every request to carry a signed Ed25519 receipt. The proxy verifies the receipt before forwarding traffic. Invalid, stale, malformed, or missing receipts are denied by default.

## 5. Demo

```bash
bash setup.sh
docker compose up -d
docker compose --profile test run --rm chaos
```

Expected output:

```text
✅ GATE INTACT – fail-closed held.
```

## 6. Core invariant

No valid receipt, no upstream execution.

## 7. Why now

MCP-style agent architectures are expanding the number of callable tools. The faster agents gain execution pathways, the more important it becomes to place hard gates in front of those pathways.

## 8. Differentiation

Reality Gate is intentionally narrow. It does not pretend to be a full governance suite. It provides a concrete, testable enforcement point:

- Direct Ed25519 receipt verification.
- Explicit denial paths.
- JSONL audit trail.
- Dockerized demo.
- POST-capable mock upstream.
- Chaos fuzzer.

## 9. Roadmap

- Persistent nonce replay prevention.
- Policy bundle support.
- Rate limiting.
- Key rotation.
- mTLS examples.
- GitHub Actions chaos test.
- Kubernetes deployment profile.

## 10. Launch hook

Your MCP agent has 47,000 API calls left today.

Who approved the 47,001st?

> Agent dreams of scale  
> Gate replies with cold error  
> Receipt? No. Go home.

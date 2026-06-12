# Reality Gate

Fail-closed cryptographic proxy for MCP-style AI agents — because hope is not a security policy.

Reality Gate sits between an agent and an upstream tool/server. It requires every request to carry a signed receipt before forwarding. Invalid signatures, malformed receipts, stale timestamps, missing budget fields, or upstream failures are rejected and logged as structured compliance events.

It is intentionally simple: verify first, forward second, fail closed always.

> Gold runs thin, agent  
> Your ambition costs dollars  
> Gate holds the ledger.

## What this project provides

- A FastAPI proxy that validates signed receipts before forwarding requests.
- Ed25519 signing and verification using Base64URL-safe keys and tokens.
- Explicit fail-closed behavior for malformed, missing, expired, or unverifiable receipts.
- JSONL audit logging with haiku-flavored denial messages.
- A receipt signing CLI with key generation.
- A chaos fuzzer that attacks the proxy with malformed and adversarial requests.
- Docker and Docker Compose for one-command local testing.

## Threat model

Reality Gate is built to reduce uncontrolled agent execution risk. It does not claim to solve all AI security problems. It enforces a narrow invariant:

A request must not reach the upstream MCP/tool server unless it carries a valid, fresh, cryptographically verifiable receipt whose declared constraints satisfy the proxy policy.

It is useful for local demos, agent gateways, budget boundaries, compliance experiments, governance receipts, and fail-closed control-plane prototypes.

## Quick start

```bash
git clone https://github.com/ryansctt1994-sudo/Gbrain-Reinforced.git
cd Gbrain-Reinforced/reality-gate
chmod +x setup.sh
./setup.sh
```

Then export the public key printed by setup:

```bash
export REALITY_GATE_PUBKEY_B64="paste-public-key-here"
docker compose up -d
```

Run the chaos fuzzer:

```bash
docker compose --profile test run --rm chaos
```

Expected result:

```text
✅ GATE INTACT – fail-closed held.
```

## Manual local run

Generate keys:

```bash
python sign_receipt.py --generate-keys-only
```

Start the proxy:

```bash
export REALITY_GATE_PUBKEY_B64="paste-public-key-here"
export UPSTREAM_MCP_URL="http://localhost:5000"
python proxy.py
```

Create a signed receipt:

```bash
python sign_receipt.py --private-key-file keys/reality_gate_private.b64 --subject demo-agent --action call_tool --budget 10
```

Send a request:

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "X-Reality-Receipt: paste-token-here" \
  -d '{"tool":"demo","args":{"hello":"world"}}'
```

## Environment variables

| Variable | Required | Default | Description |
|---|---:|---|---|
| `REALITY_GATE_PUBKEY_B64` | yes | none | Base64URL Ed25519 public key used for receipt verification. |
| `UPSTREAM_MCP_URL` | no | `http://localhost:5000` | Upstream server base URL. |
| `REALITY_GATE_LOG` | no | `reality_gate.jsonl` | JSONL audit log file. |
| `REALITY_GATE_MAX_AGE_SECONDS` | no | `300` | Maximum receipt age. |
| `REALITY_GATE_PORT` | no | `8080` | Proxy listen port. |

## Receipt shape

Receipts are signed JSON payloads using compact JWS with EdDSA:

```json
{
  "iss": "reality-gate",
  "sub": "demo-agent",
  "action": "call_tool",
  "budget": 10,
  "iat": 1760000000,
  "nonce": "..."
}
```

The proxy requires `sub`, `action`, `budget`, `iat`, and `nonce`. Budget must be a positive integer, and `iat` must be within the allowed time window.

## Fail-closed rules

Reality Gate denies by default. A request is rejected when:

- The receipt header is missing.
- The receipt cannot be decoded or verified.
- Required receipt claims are missing.
- The receipt is stale or from too far in the future.
- The budget is invalid.
- The upstream server fails.

Each denial is recorded in the JSONL log.

## Security posture

This is a prototype control boundary. Before production use, add replay prevention with nonce persistence, rate limits, mTLS or service identity, persistent audit storage, key rotation, structured policy bundles, and deployment-specific upstream allowlists.

## License

No license is included in this subpackage. Add one before encouraging external reuse.

# Reality Gate

Fail-closed cryptographic proxy for MCP-style AI agents — because hope is not a security policy.

Reality Gate sits between an agent and an upstream tool/server. It requires every request to carry a signed receipt before forwarding. Invalid signatures, malformed receipts, stale timestamps, missing budget fields, or upstream failures are rejected and logged as structured compliance events.

It is intentionally simple: verify first, forward second, fail closed always.

> Gold runs thin, agent  
> Your ambition costs dollars  
> Gate holds the ledger.

## What this project provides

- A FastAPI proxy that validates signed receipts before forwarding requests.
- Direct Ed25519 signing and verification using Base64URL-safe compact tokens.
- Explicit fail-closed behavior for malformed, missing, expired, or unverifiable receipts.
- JSONL audit logging with haiku-flavored denial messages.
- A receipt signing CLI with key generation.
- A chaos fuzzer that attacks the proxy with malformed and adversarial requests.
- A POST-capable mock MCP upstream for local demos.
- Docker and Docker Compose for one-command local testing.

## Threat model

Reality Gate is built to reduce uncontrolled agent execution risk. It does not claim to solve all AI security problems. It enforces a narrow invariant:

A request must not reach the upstream MCP/tool server unless it carries a valid, fresh, cryptographically verifiable receipt whose declared constraints satisfy the proxy policy.

It is useful for local demos, agent gateways, budget boundaries, compliance experiments, governance receipts, and fail-closed control-plane prototypes.

## Quick start

```bash
git clone https://github.com/ryansctt1994-sudo/Gbrain-Reinforced.git
cd Gbrain-Reinforced/reality-gate
bash setup.sh
docker compose up -d
docker compose --profile test run --rm chaos
```

Expected result:

```text
✅ GATE INTACT – fail-closed held.
```

`setup.sh` generates local Ed25519 keys, writes `.env` with `REALITY_GATE_PUBKEY_B64`, and builds the Docker image. The generated `keys/` directory and `.env` file are intentionally ignored by Git.

## Manual local run

Generate keys:

```bash
python sign_receipt.py --generate-keys-only
```

Start the mock upstream:

```bash
python mock_mcp.py
```

Start the proxy in another terminal:

```bash
export REALITY_GATE_PUBKEY_B64="$(cat keys/reality_gate_public.b64)"
export UPSTREAM_MCP_URL="http://localhost:5000"
python proxy.py
```

Create a signed receipt:

```bash
TOKEN=$(python sign_receipt.py --private-key-file keys/reality_gate_private.b64 --subject demo-agent --action call_tool --budget 10)
```

Send a valid request:

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "X-Reality-Receipt: $TOKEN" \
  -d '{"tool":"demo","args":{"hello":"world"}}'
```

Run fail-closed fuzzing:

```bash
python chaos_fuzzer.py --target http://localhost:8080
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

Receipts are compact Base64URL tokens:

```text
base64url(header).base64url(payload).base64url(signature)
```

Header:

```json
{
  "alg": "Ed25519",
  "typ": "RG1"
}
```

Payload:

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

## Files

```text
reality-gate/
├── .env.example
├── .gitignore
├── README.md
├── CONTRIBUTING.md
├── FAQ.md
├── PITCH_DECK.md
├── proxy.py
├── sign_receipt.py
├── chaos_fuzzer.py
├── mock_mcp.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── setup.sh
```

## Security posture

This is a prototype control boundary. Before production use, add replay prevention with nonce persistence, rate limits, mTLS or service identity, persistent audit storage, key rotation, structured policy bundles, and deployment-specific upstream allowlists.

## License

No license is included in this subpackage. Add one before encouraging external reuse.

#!/bin/bash
set -euo pipefail

echo "🔐 Generating cryptographic keys (Base64URL)..."
python3 sign_receipt.py --generate-keys-only

PUBKEY="$(cat keys/reality_gate_public.b64)"
printf 'REALITY_GATE_PUBKEY_B64=%s\n' "$PUBKEY" > .env

echo "🧾 Wrote .env with REALITY_GATE_PUBKEY_B64. Do not commit .env or keys/."

echo "📦 Building Docker image..."
docker build -t reality-gate-proxy .

echo "✅ Done. Run 'docker compose up' to start the proxy + mock upstream."
echo "🧪 Then run 'docker compose --profile test run --rm chaos' to verify fail-closed behavior."

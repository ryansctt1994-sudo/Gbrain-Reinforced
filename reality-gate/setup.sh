#!/bin/bash
set -e

echo "🔐 Generating cryptographic keys (Base64URL)..."
python3 sign_receipt.py --generate-keys-only

echo "📦 Building Docker image..."
docker build -t reality-gate-proxy .

echo "✅ Done. Export REALITY_GATE_PUBKEY_B64 using the printed public key, then run 'docker compose up' to start the proxy + mock upstream."

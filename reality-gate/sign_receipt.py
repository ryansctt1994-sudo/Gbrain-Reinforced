"""Generate Ed25519 keys and sign Reality Gate receipts."""

from __future__ import annotations

import argparse
import base64
import json
import secrets
import time
from pathlib import Path
from typing import Any, Dict

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from jose import jwt

KEY_DIR = Path("keys")
PRIVATE_KEY_FILE = KEY_DIR / "reality_gate_private.b64"
PUBLIC_KEY_FILE = KEY_DIR / "reality_gate_public.b64"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def unb64url(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def generate_keys() -> tuple[str, str]:
    private_key = Ed25519PrivateKey.generate()
    private_raw = private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_raw = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return b64url(private_raw), b64url(public_raw)


def save_keys(private_b64: str, public_b64: str) -> None:
    KEY_DIR.mkdir(exist_ok=True)
    PRIVATE_KEY_FILE.write_text(private_b64 + "\n", encoding="utf-8")
    PUBLIC_KEY_FILE.write_text(public_b64 + "\n", encoding="utf-8")
    PRIVATE_KEY_FILE.chmod(0o600)


def load_private_key(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def sign_receipt(private_key_b64: str, claims: Dict[str, Any]) -> str:
    return jwt.encode(claims, private_key_b64, algorithm="EdDSA")


def build_claims(subject: str, action: str, budget: int) -> Dict[str, Any]:
    return {
        "iss": "reality-gate",
        "sub": subject,
        "action": action,
        "budget": budget,
        "iat": int(time.time()),
        "nonce": secrets.token_urlsafe(18),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Reality Gate receipt signer")
    parser.add_argument("--generate-keys-only", action="store_true", help="Generate Ed25519 keys and exit")
    parser.add_argument("--private-key-file", default=str(PRIVATE_KEY_FILE), help="Path to Base64URL private key")
    parser.add_argument("--subject", default="demo-agent", help="Receipt subject")
    parser.add_argument("--action", default="call_tool", help="Permitted action")
    parser.add_argument("--budget", type=int, default=1, help="Positive integer budget")
    parser.add_argument("--json", action="store_true", help="Print JSON with token and claims")
    args = parser.parse_args()

    if args.generate_keys_only:
        private_b64, public_b64 = generate_keys()
        save_keys(private_b64, public_b64)
        print("Generated Reality Gate Ed25519 keys.")
        print(f"Private key file: {PRIVATE_KEY_FILE}")
        print(f"Public key file:  {PUBLIC_KEY_FILE}")
        print("\nExport this before running the proxy:")
        print(f"export REALITY_GATE_PUBKEY_B64={public_b64}")
        return

    if args.budget <= 0:
        raise SystemExit("--budget must be positive")

    private_key = load_private_key(Path(args.private_key_file))
    claims = build_claims(args.subject, args.action, args.budget)
    token = sign_receipt(private_key, claims)

    if args.json:
        print(json.dumps({"token": token, "claims": claims}, indent=2, sort_keys=True))
    else:
        print(token)


if __name__ == "__main__":
    main()

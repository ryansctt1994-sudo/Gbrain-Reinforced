"""Reality Gate fail-closed proxy.

A small FastAPI proxy that verifies a cryptographic receipt before forwarding a
request to an upstream MCP/tool server.
"""

from __future__ import annotations

import base64
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Tuple

import httpx
import uvicorn
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

APP_NAME = "reality-gate"
PUBKEY_B64 = os.getenv("REALITY_GATE_PUBKEY_B64")
UPSTREAM_MCP_URL = os.getenv("UPSTREAM_MCP_URL", "http://localhost:5000").rstrip("/")
LOG_PATH = Path(os.getenv("REALITY_GATE_LOG", "reality_gate.jsonl"))
MAX_AGE_SECONDS = int(os.getenv("REALITY_GATE_MAX_AGE_SECONDS", "300"))
PORT = int(os.getenv("REALITY_GATE_PORT", "8080"))

app = FastAPI(title="Reality Gate", version="0.1.1")

DENIAL_HAIKU = {
    "missing_receipt": "Silent agent knocks / Gate asks for a receipt / Nothing passes through",
    "bad_receipt": "Ink without a seal / The ledger does not believe / Cold door, warmer logs",
    "stale_receipt": "Time is a river / Receipt drowned in yesterday / Try again with now",
    "bad_budget": "Gold runs thin, agent / Your ambition costs dollars / Gate holds the ledger",
    "upstream_failure": "Upstream thunder breaks / Gate refuses blind passage / Safety before speed",
    "bad_payload": "Malformed little dream / JSON lost its skeleton / Gate keeps its own shape",
}


def b64url_decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def audit(event: str, allowed: bool, reason: str, detail: Dict[str, Any] | None = None) -> None:
    record = {
        "ts": int(time.time()),
        "app": APP_NAME,
        "event": event,
        "allowed": allowed,
        "reason": reason,
        "detail": detail or {},
    }
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")


def deny(reason: str, status_code: int = 403, detail: Dict[str, Any] | None = None) -> JSONResponse:
    audit("request_denied", False, reason, detail)
    return JSONResponse(
        status_code=status_code,
        content={
            "ok": False,
            "reason": reason,
            "haiku": DENIAL_HAIKU.get(reason, "Gate closed by default / Proof must arrive before power / Silence is denied"),
        },
    )


def require_pubkey() -> str:
    if not PUBKEY_B64:
        raise RuntimeError("REALITY_GATE_PUBKEY_B64 is required")
    return PUBKEY_B64


def decode_token(token: str) -> Tuple[Dict[str, Any], Dict[str, Any], bytes, bytes]:
    parts = token.split(".")
    if len(parts) != 3 or not all(parts):
        raise ValueError("receipt must have header.payload.signature")

    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    header = json.loads(b64url_decode(header_b64))
    claims = json.loads(b64url_decode(payload_b64))
    signature = b64url_decode(signature_b64)

    if header.get("alg") != "Ed25519" or header.get("typ") != "RG1":
        raise ValueError("unsupported receipt header")
    if not isinstance(claims, dict):
        raise ValueError("receipt claims must be a JSON object")

    return header, claims, signature, signing_input


def verify_receipt(token: str) -> Dict[str, Any]:
    public_raw = b64url_decode(require_pubkey())
    if len(public_raw) != 32:
        raise ValueError("Ed25519 public key must decode to 32 bytes")

    _, claims, signature, signing_input = decode_token(token)
    Ed25519PublicKey.from_public_bytes(public_raw).verify(signature, signing_input)

    required = ["sub", "action", "budget", "iat", "nonce"]
    missing = [field for field in required if field not in claims]
    if missing:
        raise ValueError(f"missing required claims: {missing}")

    now = int(time.time())
    iat = int(claims["iat"])
    if iat > now + 30 or now - iat > MAX_AGE_SECONDS:
        raise TimeoutError("receipt timestamp outside allowed window")

    budget = claims["budget"]
    if not isinstance(budget, int) or budget <= 0:
        raise ArithmeticError("budget must be a positive integer")

    return claims


@app.get("/healthz")
def healthz() -> Dict[str, Any]:
    return {"ok": True, "app": APP_NAME, "upstream": UPSTREAM_MCP_URL}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(path: str, request: Request) -> JSONResponse:
    receipt = request.headers.get("X-Reality-Receipt")
    if not receipt:
        return deny("missing_receipt", 401)

    try:
        claims = verify_receipt(receipt)
    except TimeoutError as exc:
        return deny("stale_receipt", 403, {"error": str(exc)})
    except ArithmeticError as exc:
        return deny("bad_budget", 403, {"error": str(exc)})
    except Exception as exc:
        return deny("bad_receipt", 403, {"error": str(exc)})

    body = await request.body()
    target = f"{UPSTREAM_MCP_URL}/{path}"

    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"host", "content-length", "x-reality-receipt"}
    }
    headers["X-Reality-Subject"] = str(claims["sub"])
    headers["X-Reality-Action"] = str(claims["action"])

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.request(
                request.method,
                target,
                params=dict(request.query_params),
                content=body,
                headers=headers,
            )
    except httpx.HTTPError as exc:
        return deny("upstream_failure", 502, {"error": str(exc)})

    audit(
        "request_forwarded",
        True,
        "receipt_verified",
        {
            "sub": claims.get("sub"),
            "action": claims.get("action"),
            "budget": claims.get("budget"),
            "upstream_status": response.status_code,
            "path": path,
        },
    )

    content_type = response.headers.get("content-type", "")
    try:
        upstream_body: Any = response.json() if "application/json" in content_type else response.text[:4096]
    except ValueError:
        upstream_body = response.text[:4096]

    return JSONResponse(
        status_code=response.status_code,
        content={
            "ok": True,
            "upstream_status": response.status_code,
            "body": upstream_body,
        },
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)

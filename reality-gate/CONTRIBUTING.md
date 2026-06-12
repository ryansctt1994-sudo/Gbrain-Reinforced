# Contributing to Reality Gate

Reality Gate is a small fail-closed security boundary. Contributions should preserve that property above all else.

## Core rule

Do not make the proxy permissive for convenience. A request must be denied unless the receipt is valid, fresh, and policy-compliant.

## Local development

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python sign_receipt.py --generate-keys-only
export REALITY_GATE_PUBKEY_B64="paste-public-key-here"
python proxy.py
```

In another terminal:

```bash
python chaos_fuzzer.py --target http://localhost:8080
```

## Pull request checklist

- The fail-closed invariant is preserved.
- New denial paths are logged.
- No secrets, private keys, logs, or generated receipts are committed.
- The chaos fuzzer still reports `GATE INTACT`.
- README or FAQ is updated when behavior changes.

## Good first issues

- Add more denial haiku.
- Add nonce replay persistence.
- Add structured policy files.
- Add GitHub Actions for the fuzzer.
- Add mTLS deployment examples.

## Security reports

Open a private security advisory if available. If not, open a minimal issue saying a security report is available without posting exploit details publicly.

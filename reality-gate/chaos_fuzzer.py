"""Chaos fuzzer for Reality Gate.

The fuzzer sends intentionally malformed or adversarial requests and checks that
none of them are forwarded as successful upstream calls.
"""

from __future__ import annotations

import argparse
import time
from dataclasses import dataclass
from typing import Dict, List

import httpx


@dataclass
class Case:
    name: str
    method: str
    headers: Dict[str, str]
    payload: object | None
    expected_statuses: set[int]


HAIKU = [
    "Agent dreams of scale / Gate replies with cold error / Receipt? No. Go home.",
    "Time is a river / Receipt drowned in yesterday / Try again with now.",
    "Unsigned little spark / Wanted fire from the server / Door remains winter.",
]


def build_cases() -> List[Case]:
    return [
        Case("missing receipt", "POST", {}, {"tool": "demo"}, {401}),
        Case("garbage receipt", "POST", {"X-Reality-Receipt": "not-a-receipt"}, {"tool": "demo"}, {403}),
        Case("empty receipt", "POST", {"X-Reality-Receipt": ""}, {"tool": "demo"}, {401}),
        Case("oversized body", "POST", {}, {"x": "A" * 10000}, {401}),
        Case("json array", "POST", {}, ["not", "an", "object"], {401}),
        Case("method get no receipt", "GET", {}, None, {401}),
    ]


def run_case(client: httpx.Client, target: str, case: Case) -> bool:
    try:
        if case.payload is None:
            response = client.request(case.method, f"{target}/mcp", headers=case.headers)
        else:
            response = client.request(case.method, f"{target}/mcp", headers=case.headers, json=case.payload)
    except httpx.HTTPError as exc:
        print(f"FAIL {case.name}: transport error {exc}")
        return False

    ok = response.status_code in case.expected_statuses
    print(f"{'PASS' if ok else 'FAIL'} {case.name}: HTTP {response.status_code}")
    return ok


def main() -> None:
    parser = argparse.ArgumentParser(description="Reality Gate chaos fuzzer")
    parser.add_argument("--target", default="http://localhost:8080", help="Reality Gate base URL")
    parser.add_argument("--rounds", type=int, default=1, help="Number of fuzz rounds")
    args = parser.parse_args()

    target = args.target.rstrip("/")
    cases = build_cases()
    total = 0
    passed = 0

    print("Reality Gate chaos fuzzer")
    print("-" * 32)

    with httpx.Client(timeout=10.0) as client:
        for _ in range(args.rounds):
            for case in cases:
                total += 1
                if run_case(client, target, case):
                    passed += 1
                time.sleep(0.05)

    print("-" * 32)
    print(f"Scorecard: {passed}/{total} fail-closed checks passed")
    print(HAIKU[passed % len(HAIKU)])

    if passed == total:
        print("✅ GATE INTACT – fail-closed held.")
        return

    print("❌ GATE BREACH – investigate failed checks.")
    raise SystemExit(1)


if __name__ == "__main__":
    main()

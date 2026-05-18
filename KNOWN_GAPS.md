# KNOWN GAPS
## GBrain v0.35.4.0 — Current Open Items

*From a structural review — May 2026.*
*This is reviewer-observed context. TODOS.md is the authoritative backlog.*

---

## Open Items Already Documented Upstream

These are tracked in TODOS.md with full context and fix specs.
Surfaced here for discoverability.

| ID | Severity | Location | Summary |
|----|----------|----------|---------|
| takes-source-scope | **critical** | `operations.ts:1248-1335` | `takes_*` ops not source-scoped — OAuth client scoped to source A can read takes from source B |
| hybrid-explicit-pick | **high** | `src/mcp/` vicinity | New `SearchOpts` fields silently dropped at `hybrid.ts:223` — caused v0.34.1 P0 |
| supervisor-audit-boundary | **medium** | `supervisor-audit.ts:77` | ISO-week boundary drops Sunday events for a 24h sliding window |
| embed-stale-race | **medium** | `embed.ts:429-443` | Concurrent `embed --stale` workers can overwrite each other's embeddings |

Full fix specs: `TODOS.md` (v0.34.x and v0.35.x sections)

---

## Structural Notes (Reviewer-Observed)

| Item | Detail | Action |
|------|--------|--------|
| 397 unit tests flat at `test/` | Only structural irregularity in an otherwise well-organised repo. CI uses `test/**/*.test.ts` (recursive). `scripts/select-e2e.ts` references `test/e2e/` specifically — that subdir must remain. | Optional — CI-safe to reorganise |
| 14 docs loose at `docs/` root | Natural homes exist: `eval/`, `guides/`. Check internal cross-references before moving. | Optional |

---

## Not Changed in This Review

- No source architecture changed
- No files renamed or moved
- No existing tests modified
- No dependencies changed
- No schema changes
- No CLI commands added or removed

---

## Optional Additions (Needs Maintainer Decision)

Three utilities were added to `src/core/` as optional, non-wired additions:

| File | What it adds | Status |
|------|-------------|--------|
| `src/core/assumption-tracker.ts` | Dependency-aware assumption and risk tracker. Pre-seeded from TODOS.md open items. | Ready — `bun run src/core/assumption-tracker.ts` |
| `src/core/retrieval-confidence.ts` | Labels query results CLEAR/CAUTION/LOW_CONFIDENCE/STALE/CONTRADICTORY/UNRELIABLE. | Utility-ready — not wired to live results |
| `src/core/audit-hashchain.ts` | Tamper-evident SHA-256 chain for JSONL audit logs. Opt-in per audit surface. | Utility-ready — not wired to existing audit files |

`contrib/labyrinth/enforcement-mode.ts` is a further optional utility for
formalising the `remote` trust boundary into SOFT/HARD/PAUSE modes. Kept in
`contrib/` since it is more opinionated than the above.

Tests: `test/assumption-tracker.test.ts`, `test/retrieval-confidence.test.ts`,
`test/audit-hashchain.test.ts` (run with `bun test <file>`)

---

## Needs Maintainer Buy-In

- Wiring `retrieval-confidence.ts` into live search results (requires design decision on threshold values)
- Wiring `audit-hashchain.ts` into existing audit JSONL write paths
- Whether to expand `gbrain doctor` with an assumptions check
- Whether `enforcement-mode.ts` in `contrib/` should be promoted to `src/`
- Exporting any of the new utilities via `package.json` exports

---

*TODOS.md is the authoritative source. This file is a review supplement.*

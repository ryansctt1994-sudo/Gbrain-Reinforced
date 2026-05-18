# Review Notes — GBrain v0.35.4.0

**Original project:** GBrain by Garry Tan (@garrytan) — MIT License
**Review, documentation additions, and optional utilities:** @LabyrinthCoder — May 2026

---

## What Changed

**Three source utilities** added to `src/core/`:

- `audit-hashchain.ts` — tamper-evident SHA-256 chain for JSONL audit logs.
  Opt-in per audit surface. Companion CLI: `bun run src/core/audit-hashchain.ts <file>`.

- `retrieval-confidence.ts` — labels retrieval results based on score,
  contradiction density, source staleness, and graph hop count.
  Labels: CLEAR / CAUTION / LOW_CONFIDENCE / STALE / CONTRADICTORY / UNRELIABLE.

- `assumption-tracker.ts` — lightweight directed risk graph. Tracks open
  assumptions with AT_RISK auto-propagation when dependencies are unverified.
  Pre-seeded with GBrain's open items from TODOS.md. CLI output:
  `bun run src/core/assumption-tracker.ts` (markdown) or `--json` (JSON).

**Three test files** in `test/` using `bun:test`:

- `test/audit-hashchain.test.ts` — 8 tests
- `test/retrieval-confidence.test.ts` — 9 tests
- `test/assumption-tracker.test.ts` — 11 tests

**Four documentation files** at root:

- `WHAT_THIS_IS.md` — one-page orientation for new contributors and agents
- `STRUCTURE.md` — complete folder map with file counts and notes
- `KNOWN_GAPS.md` — open items from TODOS.md + review-discovered notes
- `REVIEW_NOTES.md` — this file

**One optional contrib utility:**

- `contrib/labyrinth/enforcement-mode.ts` — formalises `remote` trust boundary
  into SOFT/HARD/PAUSE modes. Optional — not required for GBrain runtime.
- `contrib/labyrinth/README.md` — attribution and integration notes

**One additional utility** in `src/core/`:

- `brain-snapshot.ts` — lightweight pre-flight snapshot (version, engine, DB status,
  page count, stale chunks). Does not duplicate `gbrain doctor` — runs no heavy checks.
  Accepts assumption counts from `buildGBrainTracker()`. CLI: `bun run src/core/brain-snapshot.ts`.

**One technical paper** at root:

- `LABYRINTH_RECOMMENDATIONS.md` — documents what was wired, what was left optional,
  and what Labyrinth recommends for GBrain that was not implemented. Includes
  implementation sketches for: assumption_health in doctor, retrieval confidence in MCP
  query results, audit hashchain integration, stale embedding detection thresholds,
  evidence hierarchy vocabulary, and skill status frontmatter.

**README** — small navigation section added (11 lines).

---

## What Was Not Changed

All 1,305 original files are byte-identical to upstream.
No architecture changes. No renames. No file moves.
No existing tests modified. No new dependencies.
No CLI commands added or removed. No schema changes.

---

## Running the New Tests

```bash
bun test test/audit-hashchain.test.ts
bun test test/retrieval-confidence.test.ts
bun test test/audit-hashchain.test.ts
bun test test/retrieval-confidence.test.ts
bun test test/assumption-tracker.test.ts
bun test test/brain-snapshot.test.ts
```

*Note: tests were authored in this environment but not executed (Bun not available locally).
Tests use GBrain's existing `bun:test` conventions and should run cleanly.*

---

## Why These Additions

**Assumption tracker** — Dense repos accumulate undocumented assumptions.
When a parent assumption (`takes-source-scope` is not fully verified) is OPEN,
dependent capabilities (`source-isolation-read-path`) inherit AT_RISK status
automatically. Makes invisible risk visible without adding process overhead.

**Retrieval confidence** — GBrain returns scores but no signal for when results
look suspicious. This labels them. Useful for agents that need to know whether
to trust a result before acting on it.

**Hashchain** — GBrain already writes JSONL audit trails. Adding `prev_hash`
to each entry makes retroactive modification detectable in O(n). One field,
no format change, opt-in per audit surface.

**Docs** — Better entry paths for new contributors and AI agents. The existing
AGENTS.md, CLAUDE.md, and CONTRIBUTING.md are excellent — these complement them.

---

## What Needs Maintainer Decision

- Whether to wire `retrieval-confidence.ts` into live search results
- Whether to wire `audit-hashchain.ts` into existing audit JSONL paths
- Whether `enforcement-mode.ts` in `contrib/` should be promoted to `src/`
- Whether to export any new utilities via `package.json` exports
- Whether to expand `gbrain doctor` with an assumptions check

---

## What Was Intentionally Not Touched

- `src/core/operations.ts` (the contract — too central to touch without deep review)
- `src/mcp/server.ts` (generated from operations)
- All test files in `test/` (3,700+ existing tests untouched)
- All `skills/` (Garry's skill definitions are his)
- All `docs/` (existing documentation is strong)
- `package.json` exports (no new utilities exported without maintainer direction)

---

Optional reflective notes from the contributor are available in `bonus/labyrinth-reflections/`; they are not required for runtime or review.

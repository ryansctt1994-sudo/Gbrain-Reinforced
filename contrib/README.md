# contrib/labyrinth/

**Original project:** GBrain by Garry Tan (@garrytan) — MIT License
**Review, documentation additions, and optional utilities:** @LabyrinthCoder — May 2026

---

## What Is This Folder

Optional utilities from a structural review of GBrain v0.35.4.0.

Three of these utilities were integrated natively into `src/core/` and `test/`
(see `REVIEW_NOTES.md`). This folder contains the fourth — `enforcement-mode.ts` —
which is not yet wired into GBrain core and is kept here as an optional addition.

---

## Contents

| File | Status | What it does |
|------|--------|-------------|
| `enforcement-mode.ts` | Optional — not wired | Formalises GBrain's existing `remote` trust boundary into SOFT/HARD/PAUSE modes |
| `README.md` | This file | Attribution and description |

**Already integrated into `src/core/` (not here):**
- `audit-hashchain.ts` — tamper-evident JSONL chain
- `retrieval-confidence.ts` — confidence labels for query results
- `assumption-tracker.ts` — dependency-aware risk tracker

**Tests for integrated utilities (in `test/`):**
- `test/audit-hashchain.test.ts` (8 tests)
- `test/retrieval-confidence.test.ts` (9 tests)
- `test/assumption-tracker.test.ts` (7 tests)

---

## enforcement-mode.ts

GBrain already has a trust boundary via `OperationContext.remote`
(false = trusted local CLI, true = untrusted MCP/remote caller).

This file formalises that into three explicit modes:
- **SOFT** — labels only, always proceeds (maps from `remote: false`)
- **HARD** — blocks on bad retrieval signals (maps from `remote: true`)
- **PAUSE** — ambiguous signals wait for operator confirmation (new)

The PAUSE state is the novel addition. GBrain currently has no
"ambiguous, hold for operator" state — results either go through or they don't.

**To run:**
```bash
bun run contrib/labyrinth/enforcement-mode.ts
```

**To integrate** (if desired):
Wire `modeFromContext({ remote: ctx.remote })` into `src/mcp/dispatch.ts`
or `src/core/operations.ts` alongside the existing remote flag check.
Depends on `src/core/retrieval-confidence.ts`.

---

## Attribution

No original GBrain files were removed or modified to create this folder.
All original 1,305 files are preserved byte-for-byte.

The three natively integrated utilities (`src/core/audit-hashchain.ts`,
`src/core/retrieval-confidence.ts`, `src/core/assumption-tracker.ts`) and
their tests modify the repo with Garry Tan's architecture in mind — they
follow GBrain's naming conventions, ESM import style, and bun:test conventions.

---

*@LabyrinthCoder — May 2026*
*X: [@LabyrinthCoder](https://x.com/LabyrinthCoder)*

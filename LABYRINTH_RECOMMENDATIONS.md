# Labyrinth OS → GBrain: Architectural Recommendations

**From:** @LabyrinthCoder (Labyrinth OS project)
**To:** Garry Tan (@garrytan), GBrain maintainers
**Version reviewed:** GBrain v0.35.4.0
**Date:** May 2026

---

## What This Document Is

Labyrinth OS is an AI constitutional enforcement substrate — a system for making
AI proposals verifiable before execution. During a structural review of GBrain,
we identified patterns in Labyrinth's architecture that translate naturally into
GBrain's context.

This paper describes what we recommend, what we wired in, what we left optional,
and what we think GBrain could eventually benefit from that we did not implement.

It is not a prescription. It is a technical handoff.

---

## What Was Already Wired In

### assumption-tracker.ts (`src/core/`)

**What it is:** A directed dependency graph of open assumptions with automatic
AT_RISK propagation. Pre-seeded from GBrain's TODOS.md open items.

**Why it belongs here:** GBrain accumulates undocumented assumptions — things the
codebase depends on but hasn't formally verified. The `takes-source-scope` leak,
for example, was already known and tracked in TODOS.md, but its downstream impact
on `source-isolation-read-path` was not explicitly visible. The tracker makes
those dependency chains explicit.

**Key fields:** `id`, `label`, `status`, `dependsOn`, `evidence`, `falsifiable`,
`severity`, `owner`, `source`, `openedAt`, `lastReviewed`

**Key methods:** `propagate()`, `stale()`, `unresolvedAge()`, `toMarkdown()`,
`toJSON()`

**Integration opportunity:** The assumption tracker could feed into `gbrain doctor`
as an additional check: `assumption_health` — surfaces AT_RISK and stale open
items without requiring manual TODOS.md review.

### retrieval-confidence.ts (`src/core/`)

**What it is:** Maps retrieval signals to confidence labels: CLEAR / CAUTION /
LOW_CONFIDENCE / STALE / CONTRADICTORY / UNRELIABLE.

**Why it belongs here:** GBrain returns retrieval scores but provides no epistemic
signal to callers about whether those scores are trustworthy. An agent that receives
a result with a low score, old sources, or contradicting chunks has no way to know
it should be skeptical. This module surfaces that ambiguity.

**Signal mapping:**
- `score` ← GBrain retrieval score (0–1)
- `contradictions` ← count of contradicting chunks (GBrain already tracks these)
- `staleDays` ← age of oldest retrieved source
- `graphHops` ← number of graph traversal steps to answer

**Integration opportunity:** Wrap the return path of `hybridSearch()` or
`query` operation results with a confidence label before returning to MCP callers.
GBrain's doctor already runs a `contradictions` check — the retrieval-confidence
module could use that same signal at query time.

### audit-hashchain.ts (`src/core/`)

**What it is:** Opt-in SHA-256 chaining for JSONL audit log files. Each entry
carries a `prev_hash` field linking it to the previous entry.

**What this is NOT:** Not encryption. Not access control. Not identity
verification. Not deletion-proof. Tamper-evident and append-only only.

**Why it belongs here:** GBrain already writes JSONL audit trails (`audit-slug-fallback`,
`shell-audit`, `subagent-audit`, `rerank-audit`). Adding one field per entry (`prev_hash`)
makes retroactive modification detectable without changing the format.

**Integration opportunity:** The lowest-friction integration point is
`audit-slug-fallback.ts:logSlugFallback()` — wrap the existing `fs.appendFile`
call with `chainEntry()` from this module. No format change, no schema change.

### brain-snapshot.ts (`src/core/`)

**What it is:** Lightweight pre-flight snapshot — version, engine type, DB
connection status, page count, stale chunk count — without the full weight of
`gbrain doctor`.

**Why it belongs here:** `gbrain doctor` runs 20+ checks including DB queries,
file walks, eval comparisons, and network probes. For quick pre-flight checks
(before a batch job, from an agent context, or in a health endpoint) a compact
snapshot is useful without the overhead.

**Integration opportunity:** Expose as `gbrain snapshot --json` or wire into
the MCP server's health check surface. The snapshot also accepts assumption
counts from `buildGBrainTracker()` so agent callers can see open risk alongside
DB health in one call.

---

## What Was Left Optional (contrib/labyrinth/)

### enforcement-mode.ts

**What it is:** Formalises GBrain's existing `remote: true/false` trust boundary
into three explicit modes — SOFT (labels, always proceeds), HARD (blocks on bad
signals), PAUSE (holds for operator on ambiguous signals).

**Why it's in contrib and not src:** GBrain's trust boundary is already
well-designed (v0.26.9 made `remote` a REQUIRED field with fail-closed semantics).
EnforcementMode is an opinionated layer on top of an already sound design.
Garry should decide whether the PAUSE state adds value for his use case.

**Integration point if adopted:** Wire `modeFromContext({ remote: ctx.remote })`
into `src/mcp/dispatch.ts` or alongside the `OperationContext.remote` check.
The PAUSE decision surfaces ambiguous retrieval to the operator instead of
silently returning low-confidence results.

---

## What We Recommend But Did Not Implement

These are the patterns from Labyrinth OS that GBrain could eventually benefit
from. We did not implement them because they require deeper codebase knowledge,
owner buy-in, or design decisions only Garry can make.

### 1. Assumption Health Check in `gbrain doctor`

**Pattern:** Add `assumption_health` to the doctor check suite.
**What it would do:** Run `buildGBrainTracker().propagate()` and surface:
- Count of OPEN assumptions by severity
- Count of AT_RISK assumptions (auto-propagated)
- Count of stale assumptions (not reviewed in 90+ days)
- Any critical-severity open items

**Why it's worth adding:** Doctor already runs `multi_source_drift`, `eval_drift`,
`sync_freshness`, and `contradictions`. An assumption health check would surface
the architectural risk layer that those checks don't capture — the "what are we
assuming about the system that we haven't verified?"

**Implementation sketch:**
```typescript
// In src/commands/doctor.ts, add:
import { buildGBrainTracker } from '../core/assumption-tracker.ts'

async function checkAssumptionHealth(): Promise<Check> {
  const tracker = buildGBrainTracker()
  tracker.propagate()
  const open = tracker.byStatus('OPEN')
  const atRisk = tracker.byStatus('AT_RISK')
  const stale = tracker.stale(90)
  const critical = open.filter(a => a.severity === 'critical')

  if (critical.length > 0) {
    return { name: 'assumption_health', status: 'fail',
      message: `${critical.length} critical open assumption(s): ${critical.map(a => a.id).join(', ')}` }
  }
  if (atRisk.length > 0 || stale.length > 0) {
    return { name: 'assumption_health', status: 'warn',
      message: `${atRisk.length} at-risk, ${stale.length} stale assumptions` }
  }
  return { name: 'assumption_health', status: 'ok',
    message: `${open.length} open assumptions, none critical` }
}
```

### 2. Retrieval Confidence in MCP Query Results

**Pattern:** Wrap `hybridSearch()` output with a confidence label before
returning to MCP callers.

**What it would do:** Each query result from the MCP server would carry a
`confidence` object: `{ code: 'CAUTION', reason: 'sources older than 180 days' }`.

**Why GBrain needs it:** Agents calling GBrain via MCP currently have no signal
about result quality. They receive results and proceed. An agent that knows a
result is STALE or CONTRADICTORY can hedge appropriately, ask for verification,
or surface the uncertainty to the user.

**Implementation sketch:**
```typescript
// In the query operation handler (src/core/operations.ts):
import { labelResult } from './retrieval-confidence.ts'

// After retrieving results:
const confidence = labelResult({
  score: result.score,
  contradictions: contradictionCount,  // from existing contradiction tracking
  staleDays: daysSinceUpdated(result.updatedAt),
  graphHops: result.graphDepth,
})

return { ...result, _confidence: { code: confidence.code, reason: confidence.reason } }
```

**Threshold note:** The default thresholds in `retrieval-confidence.ts` were
set conservatively. Garry should tune them based on GBrain's actual score
distribution before wiring this into live results.

### 3. Audit Hashchain on Slug-Fallback Log

**Pattern:** Wire `audit-hashchain.ts` into `logSlugFallback()` in
`src/core/audit-slug-fallback.ts`.

**What it would do:** Each slug-fallback audit entry would carry a `prev_hash`
linking it to the prior entry. Any retroactive modification breaks the chain.

**Implementation sketch:**
```typescript
// In audit-slug-fallback.ts:
import { HashChain, chainEntry } from './audit-hashchain.ts'

export async function logSlugFallback(slug: string, source_path: string) {
  const auditFile = join(resolveAuditDir(), computeSlugFallbackAuditFilename())
  const chain = HashChain.fromJSONL(auditFile)

  const event: SlugFallbackAuditEvent = {
    ts: new Date().toISOString(),
    slug, source_path,
    severity: 'info',
    code: 'SLUG_FALLBACK_FRONTMATTER',
  }
  const chained = chainEntry(event, chain)

  await fs.promises.appendFile(auditFile, JSON.stringify(chained) + '\n')
}
```

**Caveat:** This changes the JSONL schema for new entries. Existing entries
(without `prev_hash`) load correctly but are not linked. The transition is
non-breaking but the chain starts from the first chained entry, not from
the beginning of the file.

### 4. Stale Embedding Detection as a Scheduled Check

**Pattern:** GBrain already has `countStaleChunks()` and `embed --stale`. A
scheduled check (as a cron job or doctor check) that fires when stale chunks
exceed a threshold would surface embedding drift proactively.

**What GBrain already has:** `gbrain doctor` (via `brain-snapshot.ts`) surfaces
stale chunk count. The `embed --stale` command resolves it.

**What's missing:** A threshold-based alert. Something like:
- 0 stale chunks → ok
- 1–100 → info (run `gbrain embed --stale` when convenient)
- 100+ → warn (retrieval quality degrading)
- 1000+ → fail (urgent — embeddings significantly out of date)

**Labyrinth analog:** Labyrinth's `betti_1` structural proxy detects topological
drift in the knowledge graph. GBrain's equivalent is stale embedding density —
a proxy for how much of the retrieval surface has drifted from the current
embedding model.

### 5. Evidence Hierarchy in Documentation

**Pattern:** Labyrinth's Reality Hierarchy — `architecture intent ≠ implemented
capability ≠ verified behavior ≠ field-tested behavior` — translated into GBrain's
language.

**GBrain equivalent:** A simple status vocabulary for capability claims:

| Status | Meaning |
|--------|---------|
| Proposed | Designed, not yet implemented |
| Implemented | Code exists, tests incomplete |
| Tested | Unit tests pass |
| CI-covered | Passing in CI on every commit |
| Production-observed | Confirmed in Garry's production deployment |

**Application:** TODOS.md and KNOWN_GAPS.md could use these statuses instead of
free-form descriptions. Makes it immediately clear whether an item is speculative
or battle-tested.

### 6. Epistemic State on Skills

**Pattern:** GBrain's 34 skills are fat markdown files without explicit status.
Some are well-validated (cold-start, citation-fixer). Others may be more
experimental.

**Recommendation:** Add a simple `status` field to each skill's frontmatter:

```yaml
---
status: production  # or: experimental | deprecated | draft
last-validated: 2026-03
---
```

This would let `gbrain doctor`'s `skill_conformance` check surface skills that
haven't been validated recently — the same pattern as `stale()` in the assumption
tracker, applied to skills.

---

## What We Explicitly Did Not Translate from Labyrinth

These Labyrinth patterns do not belong in GBrain:

| Pattern | Why not |
|---------|---------|
| Z3 formal gate machinery | Overkill for retrieval thresholds. GBrain's trust boundary is already sound. |
| Constitutional gate | GBrain is not a safety-critical physical system. `remote` boolean is appropriate. |
| Agent lineage journals | GBrain has CHANGELOG.md. Labyrinth-style journals are too foreign. |
| Circuit breaker (CLOSED/OPEN) | GBrain's minion supervisor already handles failures. |
| Proposal review governance | Would add process overhead inappropriate for this repo's culture. |
| Assumption collapse propagation (full ACP-1) | The simplified tracker in `assumption-tracker.ts` is sufficient. |
| Symbolic/poetic closing sections | Not appropriate for a production repo. |

---

## Summary

The four utilities wired into `src/core/` and the one in `contrib/labyrinth/`
represent the highest-value, lowest-disruption subset of what Labyrinth has learned
about making AI systems more trustworthy and survivable.

The recommendations in this paper are the next layer — things that require Garry's
judgment, codebase access, and deployment context to implement correctly.

The recurring theme across all of them is the same theme Labyrinth was built around:

**Make invisible assumptions explicit.
Make uncertainty visible.
Make audit trails tamper-evident.
Make architectural risk legible.**

That's the direction. Garry decides how far to go.

---

*@LabyrinthCoder — May 2026*
*Labyrinth OS: [https://x.com/LabyrinthCoder](https://x.com/LabyrinthCoder)*
*GBrain original: Garry Tan (@garrytan) — MIT License*

/**
 * Compact brain state snapshot for quick diagnostic reads.
 *
 * GBrain's doctor command is comprehensive but heavyweight — it runs
 * DB queries, file walks, eval checks, and network probes. Sometimes
 * you just need a fast snapshot of key state to understand whether
 * the brain is healthy enough to proceed.
 *
 * This module produces a compact, serializable snapshot of:
 *   - version and engine type
 *   - DB connection status
 *   - open assumption count (if assumption-tracker is used)
 *   - key counts: pages, chunks, stale chunks
 *
 * It does NOT duplicate doctor checks. Use `gbrain doctor` for full
 * diagnostics. Use this for lightweight pre-flight or agent context.
 *
 * Usage:
 *
 *   import { takeBrainSnapshot } from '../core/brain-snapshot.ts'
 *
 *   const snap = await takeBrainSnapshot(engine, VERSION)
 *   console.log(JSON.stringify(snap, null, 2))
 *
 * Or from CLI:
 *   bun run src/core/brain-snapshot.ts
 */

import { VERSION } from '../version.ts'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrainSnapshot {
  /** GBrain version string */
  version: string
  /** Engine type: 'pglite' | 'postgres' | 'unknown' */
  engine: string
  /** ISO timestamp of when this snapshot was taken */
  takenAt: string
  /** Whether a DB connection could be established */
  dbConnected: boolean
  /** Page count, or null if DB unreachable */
  pageCount: number | null
  /** Chunk count, or null if DB unreachable */
  chunkCount: number | null
  /** Chunks with null embeddings (stale), or null if DB unreachable */
  staleChunkCount: number | null
  /** Open assumption count from assumption-tracker (if provided) */
  openAssumptions?: number
  /** AT_RISK assumption count from assumption-tracker (if provided) */
  atRiskAssumptions?: number
  /** Any error encountered during snapshot */
  error?: string
}

// ── BrainEngine subset ────────────────────────────────────────────────────────

// Minimal interface — avoids importing the full BrainEngine type
// so this module stays lightweight and decoupled.
interface SnapshotEngine {
  kind: string
  countPages?(opts?: Record<string, unknown>): Promise<number>
  countStaleChunks?(): Promise<number>
}

// ── takeBrainSnapshot ─────────────────────────────────────────────────────────

/**
 * Take a lightweight snapshot of key brain state.
 *
 * @param engine     A BrainEngine instance (or compatible subset).
 * @param version    Version string (pass VERSION from '../version.ts').
 * @param assumptions  Optional: pass { open, atRisk } from AssumptionTracker.
 */
export async function takeBrainSnapshot(
  engine: SnapshotEngine,
  version = VERSION,
  assumptions?: { open: number; atRisk: number }
): Promise<BrainSnapshot> {
  const takenAt = new Date().toISOString()
  const snap: BrainSnapshot = {
    version,
    engine: engine.kind ?? 'unknown',
    takenAt,
    dbConnected: false,
    pageCount: null,
    chunkCount: null,
    staleChunkCount: null,
  }

  if (assumptions) {
    snap.openAssumptions = assumptions.open
    snap.atRiskAssumptions = assumptions.atRisk
  }

  try {
    // Page count
    if (typeof engine.countPages === 'function') {
      snap.pageCount = await engine.countPages()
      snap.dbConnected = true
    }

    // Stale chunks
    if (typeof engine.countStaleChunks === 'function') {
      snap.staleChunkCount = await engine.countStaleChunks()
    }
  } catch (err) {
    snap.error = err instanceof Error ? err.message : String(err)
  }

  return snap
}

/**
 * Format a snapshot for compact CLI display.
 */
export function formatSnapshot(snap: BrainSnapshot): string {
  const lines = [
    `GBrain ${snap.version} (${snap.engine}) — ${snap.takenAt}`,
    snap.dbConnected
      ? `  ✓ DB connected`
      : `  ✗ DB unreachable${snap.error ? ': ' + snap.error : ''}`,
  ]

  if (snap.pageCount != null) lines.push(`  pages: ${snap.pageCount}`)
  if (snap.staleChunkCount != null && snap.staleChunkCount > 0) {
    lines.push(`  ⚠ stale chunks: ${snap.staleChunkCount} (run gbrain embed --stale)`)
  }
  if (snap.openAssumptions != null) {
    lines.push(`  open assumptions: ${snap.openAssumptions}`)
  }
  if (snap.atRiskAssumptions != null && snap.atRiskAssumptions > 0) {
    lines.push(`  ⚠ at-risk assumptions: ${snap.atRiskAssumptions}`)
  }

  return lines.join('\n')
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  // Without a live engine, print a minimal version-only snapshot
  const snap: BrainSnapshot = {
    version: VERSION,
    engine: 'unknown',
    takenAt: new Date().toISOString(),
    dbConnected: false,
    pageCount: null,
    chunkCount: null,
    staleChunkCount: null,
    error: 'No engine provided — pass a BrainEngine instance to takeBrainSnapshot()',
  }
  const args = process.argv.slice(2)
  if (args.includes('--json')) {
    console.log(JSON.stringify(snap, null, 2))
  } else {
    console.log(formatSnapshot(snap))
    console.log()
    console.log('To get a full snapshot, import takeBrainSnapshot from this module')
    console.log('and pass a connected BrainEngine instance.')
  }
}

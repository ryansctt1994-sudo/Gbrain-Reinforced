/**
 * How these utilities relate (for GBrain maintainers):
 *
 *   audit-hashchain.ts      — optional integrity check for append-only logs
 *   retrieval-confidence.ts — result quality signaling (this file)
 *   assumption-tracker.ts   — project risk and open-question tracking
 *   contrib/labyrinth/      — enforcement-mode, optional trust-boundary helper
 *
 * None are wired into GBrain runtime by default.
 * Each is standalone and can be adopted independently.
 */

/**
 * Retrieval confidence labels for GBrain query results.
 *
 * GBrain's hybrid search returns scores, but callers have no signal for
 * when a result looks suspicious — low confidence, contradicting chunks,
 * stale sources, or complex graph paths. This module maps those signals
 * to a simple label that agents and CLI users can act on.
 *
 * Labels:
 *   CLEAR          — all signals within safe bounds
 *   CAUTION        — marginal but acceptable
 *   LOW_CONFIDENCE — retrieval score below the useful threshold
 *   STALE          — retrieved content is old relative to query context
 *   CONTRADICTORY  — high contradiction density across retrieved chunks
 *   UNRELIABLE     — multiple signals failed simultaneously
 *
 * Usage:
 *
 *   import { labelResult } from '../core/retrieval-confidence.ts'
 *
 *   const label = labelResult({
 *     score: result.score,          // GBrain retrieval score 0-1
 *     contradictions: 2,            // from contradiction detection
 *     chunkCount: results.length,
 *     staleDays: daysSinceUpdated,  // from page.updated_at
 *   })
 *
 *   if (label.code !== 'CLEAR') {
 *     console.warn(`[${label.code}] ${label.reason}`)
 *   }
 *
 * Thresholds are tunable via the second argument. The defaults reflect
 * GBrain's BrainBench P@5 49.1% baseline — adjust as benchmark data grows.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConfidenceCode =
  | 'CLEAR'
  | 'CAUTION'
  | 'LOW_CONFIDENCE'
  | 'STALE'
  | 'CONTRADICTORY'
  | 'UNRELIABLE'

export interface RetrievalSignals {
  /** Retrieval score 0–1 from GBrain's hybrid search. */
  score: number
  /** Number of retrieved chunks with contradicting content. Default 0. */
  contradictions?: number
  /** Total chunks retrieved. Default 1. */
  chunkCount?: number
  /** Age of the oldest retrieved source in days. Default 0. */
  staleDays?: number
  /** Number of graph hops needed to answer the query. Default 0. */
  graphHops?: number
}

export interface ConfidenceThresholds {
  scoreMin: number        // below → LOW_CONFIDENCE. Default 0.45
  scoreSafe: number       // below scoreMin..scoreSafe → CAUTION. Default 0.70
  contradictionRatio: number  // above → CONTRADICTORY. Default 0.40
  staleDaysMax: number    // above → STALE. Default 180
  graphHopsMax: number    // above → treat as complex. Default 6
}

export interface ConfidenceLabel {
  code: ConfidenceCode
  reason: string
  signals: {
    score: number
    contradictionRatio: number
    staleDays: number
    graphHops: number
    failCount: number
  }
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  scoreMin: 0.45,
  scoreSafe: 0.70,
  contradictionRatio: 0.40,
  staleDaysMax: 180,
  graphHopsMax: 6,
}

// ── labelResult ───────────────────────────────────────────────────────────────

/**
 * Label a GBrain retrieval result with a confidence assessment.
 */
export function labelResult(
  signals: RetrievalSignals,
  thresholds: Partial<ConfidenceThresholds> = {}
): ConfidenceLabel {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds }

  const score = Math.max(0, Math.min(1, signals.score))
  const contradictionRatio = signals.contradictions != null
    ? Math.min(1, signals.contradictions / Math.max(1, signals.chunkCount ?? 1))
    : 0
  const staleDays = signals.staleDays ?? 0
  const graphHops = signals.graphHops ?? 0

  const fails = [
    score < t.scoreMin ? 1 : 0,
    contradictionRatio > t.contradictionRatio ? 1 : 0,
    staleDays > t.staleDaysMax ? 1 : 0,
    graphHops > t.graphHopsMax ? 1 : 0,
  ] as const
  const failCount = fails.reduce((a, b) => a + b, 0)

  const computed = { score, contradictionRatio, staleDays, graphHops, failCount }

  if (failCount >= 3) {
    return { code: 'UNRELIABLE', reason: `${failCount}/4 signals failed`, signals: computed }
  }
  if (contradictionRatio > t.contradictionRatio) {
    return {
      code: 'CONTRADICTORY',
      reason: `High contradiction density (${(contradictionRatio * 100).toFixed(0)}% of chunks conflict)`,
      signals: computed,
    }
  }
  if (staleDays > t.staleDaysMax) {
    return {
      code: 'STALE',
      reason: `Oldest source is ${staleDays} days old (threshold: ${t.staleDaysMax})`,
      signals: computed,
    }
  }
  if (score < t.scoreMin) {
    return {
      code: 'LOW_CONFIDENCE',
      reason: `Retrieval score ${score.toFixed(2)} below useful threshold ${t.scoreMin}`,
      signals: computed,
    }
  }
  if (score < t.scoreSafe || contradictionRatio > 0.15 || staleDays > 90) {
    return { code: 'CAUTION', reason: 'Marginal signals — verify if decision-critical', signals: computed }
  }
  return { code: 'CLEAR', reason: 'All retrieval signals within safe bounds', signals: computed }
}

/**
 * Format a confidence label for CLI output.
 * Matches GBrain's existing terse stderr style.
 */
export function formatConfidenceLabel(label: ConfidenceLabel): string {
  const prefix = label.code === 'CLEAR' ? '✓' : label.code === 'CAUTION' ? '⚠' : '✗'
  return `${prefix} [${label.code}] ${label.reason}`
}

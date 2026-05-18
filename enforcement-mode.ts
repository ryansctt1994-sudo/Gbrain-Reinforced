/**
 * enforcement-mode.ts — optional trust-boundary enforcement for GBrain
 *
 * Original project: GBrain by Garry Tan (@garrytan) — MIT
 * This utility: @LabyrinthCoder — May 2026 — MIT
 *
 * STATUS: Optional / not yet wired into GBrain core.
 * See REVIEW_NOTES.md for integration discussion.
 *
 * WHAT THIS DOES:
 * GBrain already has a trust boundary via OperationContext.remote
 * (false = trusted local CLI, true = untrusted MCP/remote caller).
 * This module formalises that into three explicit modes and adds PAUSE —
 * the "ambiguous, hold for operator" state.
 *
 * MODES:
 *   SOFT  — labels only, always proceeds (local/trusted clients)
 *           Maps from: OperationContext.remote = false
 *   HARD  — blocks on bad signals (remote/untrusted clients)
 *           Maps from: OperationContext.remote = true
 *   PAUSE — ambiguous signals wait for operator (high-stakes contexts)
 *           New: no direct equivalent in current GBrain
 *
 * INTEGRATION POINT (if adopted):
 *   Wire into src/mcp/dispatch.ts or src/core/operations.ts
 *   alongside the existing remote flag check.
 *
 * DEPENDENCY:
 *   Requires retrieval-confidence.ts (../src/core/retrieval-confidence.ts)
 *   if wired into src/. Standalone below uses an inline version.
 */

import type { ConfidenceCode, RetrievalSignals } from '../src/core/retrieval-confidence.ts'
import { labelResult } from '../src/core/retrieval-confidence.ts'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnforcementMode = 'SOFT' | 'HARD' | 'PAUSE'
export type Decision = 'PROCEED' | 'PROCEED_WITH_LABEL' | 'PAUSE' | 'BLOCK'

export interface EnforcementInput extends RetrievalSignals {
  action: string
  remote?: boolean
  highStakes?: boolean
}

export interface EnforcementResult {
  decision: Decision
  mode: EnforcementMode
  labelCode: ConfidenceCode
  labelReason: string
  reason: string
}

// ── Block/pause thresholds ────────────────────────────────────────────────────

const BLOCK_CODES: ReadonlySet<ConfidenceCode> = new Set(['CONTRADICTORY', 'UNRELIABLE'])
const PAUSE_CODES: ReadonlySet<ConfidenceCode> = new Set(['LOW_CONFIDENCE', 'STALE', 'CAUTION'])

// ── modeFromContext ───────────────────────────────────────────────────────────

/**
 * Map GBrain's existing OperationContext flags to an EnforcementMode.
 * Drop-in replacement for boolean remote checks.
 */
export function modeFromContext(ctx: { remote?: boolean; highStakes?: boolean }): EnforcementMode {
  if (ctx.highStakes) return 'PAUSE'
  if (ctx.remote) return 'HARD'
  return 'SOFT'
}

// ── enforce ───────────────────────────────────────────────────────────────────

/**
 * Apply enforcement mode to a GBrain operation.
 */
export function enforce(mode: EnforcementMode, input: EnforcementInput): EnforcementResult {
  const label = labelResult(input)
  const { code, reason: labelReason } = label

  switch (mode) {
    case 'SOFT':
      return {
        decision: 'PROCEED_WITH_LABEL',
        mode, labelCode: code, labelReason,
        reason: `SOFT: proceeding with label [${code}]`,
      }

    case 'HARD':
      if (BLOCK_CODES.has(code)) {
        return { decision: 'BLOCK', mode, labelCode: code, labelReason, reason: `HARD: blocking — ${code}` }
      }
      if (PAUSE_CODES.has(code)) {
        return { decision: 'PAUSE', mode, labelCode: code, labelReason, reason: `HARD: pausing — ${code}` }
      }
      return { decision: 'PROCEED', mode, labelCode: code, labelReason, reason: `HARD: proceeding — ${code}` }

    case 'PAUSE':
      if (BLOCK_CODES.has(code)) {
        return { decision: 'BLOCK', mode, labelCode: code, labelReason, reason: `PAUSE: blocking — ${code}` }
      }
      if (code !== 'CLEAR') {
        return { decision: 'PAUSE', mode, labelCode: code, labelReason, reason: `PAUSE: holding — not CLEAR (${code})` }
      }
      return { decision: 'PROCEED', mode, labelCode: code, labelReason, reason: 'PAUSE: proceeding — CLEAR' }
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  console.log('EnforcementMode utility — @LabyrinthCoder / GBrain')
  console.log('See REVIEW_NOTES.md for integration discussion.')
  console.log()
  console.log('Example:')
  const result = enforce('HARD', { action: 'query', score: 0.35, remote: true })
  console.log(`  enforce('HARD', { score: 0.35, remote: true }) →`, result.decision, `[${result.labelCode}]`)
}

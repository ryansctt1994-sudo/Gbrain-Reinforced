/**
 * Lightweight assumption and open-question tracker for GBrain.
 *
 * Dense projects accumulate undocumented assumptions — things the codebase
 * depends on but hasn't verified. When a parent assumption turns out to be
 * wrong, dependent capabilities inherit that risk automatically.
 *
 * States:
 *   VERIFIED  — proven, tested, confirmed (evidence required)
 *   PARTIAL   — partially verified, known gaps
 *   OPEN      — assumed but not yet verified
 *   AT_RISK   — a parent dependency is OPEN or AT_RISK (auto-propagated)
 *   BLOCKED   — cannot progress until a dependency resolves
 *
 * Designed as a project-risk tracker, not a philosophical system.
 * Keep it practical: track assumptions, evidence, blockers, ownership.
 *
 * Usage:
 *
 *   import { AssumptionTracker, buildGBrainTracker } from '../core/assumption-tracker.ts'
 *
 *   const tracker = buildGBrainTracker()
 *   tracker.propagate()
 *
 *   // Print a markdown gap table
 *   console.log(tracker.toMarkdown())
 *
 *   // Or get JSON for tooling
 *   const data = tracker.toJSON()
 *
 * CLI:
 *   bun run src/core/assumption-tracker.ts           # print summary
 *   bun run src/core/assumption-tracker.ts --json    # print JSON
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssumptionStatus = 'VERIFIED' | 'PARTIAL' | 'OPEN' | 'AT_RISK' | 'BLOCKED'
export type AssumptionSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Assumption {
  /** Unique stable identifier. kebab-case recommended. */
  id: string
  /** Short human-readable description of the assumption. */
  label: string
  /** Current status. */
  status: AssumptionStatus
  /** IDs of assumptions this one depends on. */
  dependsOn?: string[]
  /** Evidence that this assumption is VERIFIED or PARTIAL. */
  evidence?: string
  /** Notes, context, or mitigation ideas. */
  notes?: string
  /** Who owns verifying this. */
  owner?: string
  /** Where to look for more context (file, doc, TODOS.md line, issue URL). */
  source?: string
  /** How important is it to resolve this? */
  severity?: AssumptionSeverity
  /** Explicit condition that would prove this assumption wrong. */
  falsifiable?: string
  /** What resolved this (e.g. PR #N, commit hash, test added). */
  closedBy?: string
  /** ISO date string when this assumption was last reviewed. */
  lastReviewed?: string
  /** ISO date string when this assumption was first opened. */
  openedAt?: string
}

// ── AssumptionTracker ─────────────────────────────────────────────────────────

export class AssumptionTracker {
  private map: Map<string, Assumption> = new Map()

  add(a: Assumption): this {
    this.map.set(a.id, { ...a })
    return this
  }

  get(id: string): Assumption | undefined {
    return this.map.get(id)
  }

  /**
   * Propagate AT_RISK status through the dependency graph.
   * Any assumption depending on an OPEN or AT_RISK parent inherits AT_RISK.
   * Runs until stable (handles transitive chains). Guards against cycles.
   *
   * Returns the IDs of assumptions whose status changed.
   */
  propagate(): string[] {
    const changed: string[] = []
    let stable = false
    const maxIterations = this.map.size * 2  // cycle guard

    let iterations = 0
    while (!stable && iterations < maxIterations) {
      stable = true
      iterations++
      for (const [, a] of this.map) {
        // VERIFIED and OPEN never inherit AT_RISK from parents
        if (a.status === 'VERIFIED' || a.status === 'OPEN' || a.status === 'AT_RISK') continue
        if (!a.dependsOn?.length) continue

        const hasRiskyParent = a.dependsOn.some(pid => {
          const parent = this.map.get(pid)
          return parent?.status === 'OPEN' || parent?.status === 'AT_RISK'
        })

        if (hasRiskyParent) {
          a.status = 'AT_RISK'
          changed.push(a.id)
          stable = false
        }
      }
    }

    return changed
  }

  byStatus(status: AssumptionStatus): Assumption[] {
    return [...this.map.values()].filter(a => a.status === status)
  }

  bySeverity(severity: AssumptionSeverity): Assumption[] {
    return [...this.map.values()].filter(a => a.severity === severity)
  }

  all(): Assumption[] {
    return [...this.map.values()]
  }

  /**
   * Return assumptions that have not been reviewed recently.
   * Useful for surfacing forgotten open questions.
   *
   * @param staleDays  Number of days without review before flagging (default: 90)
   */
  stale(staleDays = 90): Assumption[] {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - staleDays)

    return [...this.map.values()].filter(a => {
      if (a.status === 'VERIFIED') return false  // resolved — not stale
      if (!a.lastReviewed) return true           // never reviewed — always stale
      return new Date(a.lastReviewed) < cutoff
    })
  }

  /**
   * Return the number of days an assumption has been open without resolution.
   * Returns undefined if openedAt is not set.
   */
  unresolvedAge(id: string): number | undefined {
    const a = this.map.get(id)
    if (!a || a.status === 'VERIFIED' || !a.openedAt) return undefined
    const opened = new Date(a.openedAt)
    const now = new Date()
    return Math.floor((now.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24))
  }

  /**
   * Export all assumptions as a JSON-serializable array.
   */
  toJSON(): Assumption[] {
    return this.all()
  }

  /**
   * Generate a markdown gap table.
   * Useful for KNOWN_GAPS.md, PR descriptions, or doc generation.
   */
  toMarkdown(title = 'Assumption Register'): string {
    const lines: string[] = [`# ${title}`, '']
    const total = this.map.size
    lines.push(`${total} tracked assumptions`, '')

    const order: AssumptionStatus[] = ['VERIFIED', 'PARTIAL', 'OPEN', 'AT_RISK', 'BLOCKED']
    const icons: Record<AssumptionStatus, string> = {
      VERIFIED: '✓', PARTIAL: '~', OPEN: '?', AT_RISK: '⚠', BLOCKED: '✗',
    }

    for (const status of order) {
      const group = this.byStatus(status)
      if (!group.length) continue
      lines.push(`## ${icons[status]} ${status} (${group.length})`, '')

      if (status === 'VERIFIED' || status === 'PARTIAL') {
        for (const a of group) {
          lines.push(`- **${a.id}**: ${a.label}`)
          if (a.evidence) lines.push(`  - Evidence: ${a.evidence}`)
        }
      } else {
        for (const a of group) {
          lines.push(`- **${a.id}**: ${a.label}`)
          if (a.severity) lines.push(`  - Severity: ${a.severity}`)
          if (a.owner) lines.push(`  - Owner: ${a.owner}`)
          if (a.source) lines.push(`  - Source: ${a.source}`)
          if (a.dependsOn?.length) lines.push(`  - Depends on: ${a.dependsOn.join(', ')}`)
          if (a.falsifiable) lines.push(`  - Falsifiable if: ${a.falsifiable}`)
          if (a.notes) lines.push(`  - Notes: ${a.notes}`)
        }
      }
      lines.push('')
    }

    return lines.join('\n')
  }
}

// ── GBrain tracker ────────────────────────────────────────────────────────────

/**
 * Pre-seeded assumption tracker for GBrain v0.35.4.0.
 * Sources from TODOS.md open items. Call propagate() to compute AT_RISK cascades.
 */
export function buildGBrainTracker(): AssumptionTracker {
  return new AssumptionTracker()
    // ── VERIFIED ──
    .add({
      id: 'hybrid-rag-retrieval',
      label: 'Hybrid RAG returns relevant results',
      status: 'VERIFIED',
      evidence: 'BrainBench: P@5 49.1%, R@5 97.9% on 240-page corpus',
      source: 'evals/functional-area-resolver eval harness',
    })
    .add({
      id: 'entity-wiring-zero-llm',
      label: 'Knowledge graph wires itself with zero LLM calls',
      status: 'VERIFIED',
      evidence: 'Production deployment — entity extraction via deterministic extraction only',
    })
    .add({
      id: 'remote-field-fail-closed',
      label: 'OperationContext.remote is REQUIRED and fail-closed (v0.26.9)',
      status: 'VERIFIED',
      evidence: 'TypeScript compiler enforces REQUIRED; 4 call sites use fail-closed semantics',
      source: 'src/core/operations.ts, src/mcp/dispatch.ts',
      falsifiable: 'A remote caller can execute a local-only operation without setting remote: true',
    })

    // ── OPEN (security items from TODOS.md) ──
    .add({
      id: 'takes-source-scope',
      label: 'takes_* ops are fully source-scoped',
      status: 'OPEN',
      severity: 'critical',
      source: 'TODOS.md v0.34.x — operations.ts:1248-1335',
      notes: 'takes_list/search/scorecard/calibration missing sourceId filter. Auth\'d OAuth client scoped to source A can read takes from source B.',
      falsifiable: 'Auth\'d client scoped to source-a cannot read takes from source-b via takes_list',
      owner: 'Garry Tan',
    })
    .add({
      id: 'hybrid-explicit-pick',
      label: 'hybrid.ts:223 explicit-pick is safe against new SearchOpts fields',
      status: 'OPEN',
      severity: 'high',
      source: 'TODOS.md v0.34.x — caused v0.34.1 P0',
      notes: 'New SearchOpts fields silently dropped if not manually added to pick list.',
      falsifiable: 'A new SearchOpts field is added and hybrid search uses it without a pick-list update',
      owner: 'Garry Tan',
    })
    .add({
      id: 'supervisor-audit-week-boundary',
      label: 'supervisor-audit reads correctly across ISO-week boundary',
      status: 'OPEN',
      severity: 'medium',
      source: 'TODOS.md v0.36.x — supervisor-audit.ts:77',
      notes: 'Monday 00:00 UTC silently loses Sunday events. stub-guard-audit fixed this pattern; supervisor should adopt it.',
      owner: 'Garry Tan',
    })
    .add({
      id: 'embed-stale-race',
      label: 'embed --stale has no concurrent upsert race',
      status: 'OPEN',
      severity: 'medium',
      source: 'TODOS.md v0.35.x — embed.ts:429-443',
      notes: 'Two workers from same listStaleChunks snapshot can overwrite each other. Small window.',
    })

    // ── PARTIAL ──
    .add({
      id: 'source-isolation-read-path',
      label: 'All read-path operations are fully source-isolated',
      status: 'PARTIAL',
      severity: 'high',
      dependsOn: ['takes-source-scope', 'hybrid-explicit-pick'],
      source: 'TODOS.md — 14 read ops from PR#861 not yet on sourceScopeOpts',
      notes: 'Core search ops sealed in v0.34.1. takes_* surface missed.',
    })

    // ── BLOCKED ──
    .add({
      id: 'resolver-compression-safe',
      label: 'functional-area-resolver RESOLVER.md can be compressed without regression',
      status: 'BLOCKED',
      severity: 'low',
      source: 'TODOS.md v0.33.x',
      notes: 'Needs full re-baseline eval (~$3 across 3 models) before proceeding.',
    })
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const tracker = buildGBrainTracker()
  const changed = tracker.propagate()

  const args = process.argv.slice(2)
  if (args.includes('--json')) {
    console.log(JSON.stringify(tracker.toJSON(), null, 2))
  } else {
    if (changed.length) {
      process.stderr.write(`AT_RISK propagation: ${changed.join(', ')}\n\n`)
    }
    console.log(tracker.toMarkdown('GBrain v0.35.4.0 — Assumption Register'))
  }
}

/**
 * Tamper-evident hash chain for GBrain's JSONL audit ledgers.
 *
 * GBrain already writes JSONL audit trails (slug-fallback, shell-audit,
 * subagent-audit, rerank-audit, filing-audit). This module adds SHA-256
 * chaining so any retroactive modification to a past entry is detectable
 * in O(n).
 *
 * What this is:
 *   Tamper-evident: modification, removal, or reordering since genesis is detectable.
 *   Append-only: chain is verified from genesis; gaps break the chain.
 *
 * What this is NOT:
 *   Not encryption (entries remain plaintext JSON).
 *   Not access control (does not prevent unauthorized reads).
 *   Not authentication (does not verify who wrote an entry).
 *   Not deletion-proof (full file deletion is not detectable without a reference copy).
 *
 * Design:
 *  - Each entry carries a `prev_hash` field linking it to the previous entry.
 *  - Genesis entry has `prev_hash: "0".repeat(64)`.
 *  - Any entry whose hash doesn't match `sha256(canonicalise(entry))` is corrupt.
 *  - Any entry whose `prev_hash` doesn't match the prior entry's hash is tampered.
 *
 * Usage — wrapping an existing JSONL write path:
 *
 *   import { HashChain, chainEntry } from '../core/audit-hashchain.ts'
 *   const chain = await HashChain.fromJSONL(existingPath)
 *   const entry = chainEntry({ action: 'slug_fallback', slug, source_path }, chain)
 *   await fs.appendFile(path, JSON.stringify(entry) + '\n')
 *
 * Verification:
 *
 *   const chain = await HashChain.fromJSONL(path)
 *   const result = chain.verify()
 *   if (!result.ok) console.error('Ledger tampered at entry', result.brokenAt)
 *
 * The existing JSONL formats are NOT changed. This module is opt-in per audit
 * surface. Existing JSONL files without `prev_hash` fields load correctly —
 * they are treated as an unlinked prefix before chaining begins.
 */

import { createHash } from 'node:crypto'
import * as fs from 'node:fs'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChainedEntry extends Record<string, unknown> {
  /** ISO timestamp */
  ts: string
  /** SHA-256 of the previous entry's canonical JSON. "0".repeat(64) for genesis. */
  prev_hash: string
  /** SHA-256 of this entry's canonical JSON (all fields including prev_hash, excluding hash). */
  hash: string
}

export interface VerifyResult {
  ok: boolean
  /** Index of the first broken entry, if any. */
  brokenAt?: number
  error?: string
}

// ── Hashing ───────────────────────────────────────────────────────────────────

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

function canonical(entry: Record<string, unknown>): string {
  // Stable JSON: sorted keys, excluding the hash field itself
  const { hash: _hash, ...rest } = entry as Record<string, unknown>
  return JSON.stringify(rest, Object.keys(rest).sort())
}

// ── chainEntry ────────────────────────────────────────────────────────────────

/**
 * Attach `prev_hash` and `hash` to an audit entry.
 * Call this just before appending to a JSONL file.
 *
 * @param data    The audit event fields (must include `ts`).
 * @param chain   The current chain (to get the head hash). Pass an empty
 *                HashChain for the first entry in a new file.
 */
export function chainEntry<T extends Record<string, unknown>>(
  data: T & { ts: string },
  chain: HashChain
): T & ChainedEntry {
  const withPrev = { ...data, prev_hash: chain.headHash }
  const hash = sha256(canonical(withPrev))
  return { ...withPrev, hash } as T & ChainedEntry
}

// ── HashChain ─────────────────────────────────────────────────────────────────

export class HashChain {
  private entries: ChainedEntry[] = []

  get length(): number { return this.entries.length }
  get isEmpty(): boolean { return this.entries.length === 0 }

  /** Hash of the most recent entry, or "0".repeat(64) if empty. */
  get headHash(): string {
    return this.entries.length > 0
      ? this.entries[this.entries.length - 1].hash
      : '0'.repeat(64)
  }

  /**
   * Load a HashChain from an existing JSONL file.
   * Entries without `prev_hash` are loaded as-is (unlinked legacy entries).
   */
  static fromJSONL(filePath: string): HashChain {
    const chain = new HashChain()
    if (!fs.existsSync(filePath)) return chain
    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean)
    for (const line of lines) {
      const entry = JSON.parse(line) as ChainedEntry
      if (entry.prev_hash && entry.hash) {
        chain.entries.push(entry)
      }
    }
    return chain
  }

  /**
   * Verify the chain's integrity.
   * Returns { ok: true } on a clean chain, or { ok: false, brokenAt, error }.
   */
  verify(): VerifyResult {
    if (this.entries.length === 0) return { ok: true }

    let expectedPrev = '0'.repeat(64)
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]

      if (entry.prev_hash !== expectedPrev) {
        return { ok: false, brokenAt: i, error: `Entry ${i} linkage broken` }
      }

      const recomputed = sha256(canonical(entry))
      if (recomputed !== entry.hash) {
        return { ok: false, brokenAt: i, error: `Entry ${i} hash invalid — content was modified` }
      }

      expectedPrev = entry.hash
    }
    return { ok: true }
  }

  /** Iterate over all entries. */
  [Symbol.iterator](): Iterator<ChainedEntry> {
    return this.entries[Symbol.iterator]()
  }
}

// ── CLI (bun run src/core/audit-hashchain.ts <jsonl-file>) ───────────────────

if (import.meta.main) {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: bun run src/core/audit-hashchain.ts <jsonl-file>')
    process.exit(1)
  }
  const chain = HashChain.fromJSONL(filePath)
  const result = chain.verify()
  if (result.ok) {
    console.log(`✓ Chain intact — ${chain.length} entries verified`)
  } else {
    console.error(`✗ Chain broken at entry ${result.brokenAt}: ${result.error}`)
    process.exit(1)
  }
}

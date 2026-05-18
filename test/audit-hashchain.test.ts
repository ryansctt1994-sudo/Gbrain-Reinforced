/**
 * Tests for audit-hashchain.ts — tamper-evident JSONL chain.
 */

import { describe, test, expect } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { HashChain, chainEntry } from '../src/core/audit-hashchain.ts'

describe('HashChain', () => {
  test('empty chain verifies cleanly', () => {
    const chain = new HashChain()
    expect(chain.verify()).toEqual({ ok: true })
    expect(chain.isEmpty).toBe(true)
    expect(chain.headHash).toBe('0'.repeat(64))
  })

  test('chainEntry sets prev_hash and hash', () => {
    const chain = new HashChain()
    const entry = chainEntry({ ts: '2026-05-01T00:00:00Z', action: 'test' }, chain)
    expect(entry.prev_hash).toBe('0'.repeat(64))
    expect(entry.hash).toHaveLength(64)
    expect(entry.action).toBe('test')
  })

  test('successive entries link correctly', () => {
    const chain = new HashChain()
    const e1 = chainEntry({ ts: '2026-05-01T00:00:00Z', action: 'first' }, chain)
    // Simulate loading e1 into chain
    const chain2 = HashChain.fromJSONL(writeTemp([e1]))
    const e2 = chainEntry({ ts: '2026-05-01T00:01:00Z', action: 'second' }, chain2)
    expect(e2.prev_hash).toBe(e1.hash)
  })

  test('verify detects tampered entry', () => {
    const chain = new HashChain()
    const e1 = chainEntry({ ts: '2026-05-01T00:00:00Z', action: 'original' }, chain)
    const filePath = writeTemp([e1])

    // Tamper: overwrite the action after writing
    const content = readFileSync(filePath, 'utf8')
    writeFileSync(filePath, content.replace('"original"', '"tampered"'))

    const loaded = HashChain.fromJSONL(filePath)
    const result = loaded.verify()
    expect(result.ok).toBe(false)
    expect(result.brokenAt).toBe(0)
  })

  test('fromJSONL roundtrip preserves integrity', () => {
    const chain1 = new HashChain()
    const entries: object[] = []
    entries.push(chainEntry({ ts: '2026-05-01T00:00:00Z', action: 'a' }, chain1))
    const chain2 = HashChain.fromJSONL(writeTemp(entries))
    entries.push(chainEntry({ ts: '2026-05-01T00:01:00Z', action: 'b' }, chain2))
    const filePath = writeTemp(entries)

    const restored = HashChain.fromJSONL(filePath)
    expect(restored.length).toBe(2)
    expect(restored.verify()).toEqual({ ok: true })
  })

  test('legacy entries without hash fields load without error', () => {
    // GBrain has existing JSONL files that predate chaining — they should load
    const legacy = [
      JSON.stringify({ ts: '2026-01-01T00:00:00Z', code: 'SLUG_FALLBACK_FRONTMATTER', slug: 'test' }),
    ].join('\n')
    const filePath = writeTemp([], legacy)
    // Should not throw — legacy entries are skipped (no prev_hash/hash fields)
    const chain = HashChain.fromJSONL(filePath)
    expect(chain.length).toBe(0)  // Legacy entries not linked
  })

  test('empty chain headHash is genesis sentinel', () => {
    const chain = new HashChain()
    expect(chain.headHash).toMatch(/^0{64}$/)
  })

  test('verify passes on empty file', () => {
    const filePath = writeTemp([])
    const chain = HashChain.fromJSONL(filePath)
    expect(chain.verify()).toEqual({ ok: true })
  })
})

// ── helpers ───────────────────────────────────────────────────────────────────

let tmpDir: string | null = null

function writeTemp(entries: object[], raw?: string): string {
  if (!tmpDir) tmpDir = mkdtempSync(join(tmpdir(), 'gbrain-hashchain-test-'))
  const path = join(tmpDir, `${Date.now()}-${Math.random()}.jsonl`)
  const content = raw ?? entries.map(e => JSON.stringify(e)).join('\n')
  writeFileSync(path, content)
  return path
}

// cleanup is handled by bun:test process exit for tmpdir

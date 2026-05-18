/**
 * Tests for brain-snapshot.ts — lightweight brain state snapshot.
 */

import { describe, test, expect } from 'bun:test'
import { takeBrainSnapshot, formatSnapshot } from '../src/core/brain-snapshot.ts'

// Minimal mock engine for testing
function mockEngine(overrides: {
  kind?: string
  pageCount?: number
  staleChunkCount?: number
  throwError?: boolean
}) {
  return {
    kind: overrides.kind ?? 'pglite',
    countPages: overrides.throwError
      ? async () => { throw new Error('DB unreachable') }
      : async () => overrides.pageCount ?? 42,
    countStaleChunks: async () => overrides.staleChunkCount ?? 0,
  }
}

describe('takeBrainSnapshot', () => {
  test('returns connected snapshot with page and stale counts', async () => {
    const snap = await takeBrainSnapshot(mockEngine({ pageCount: 100, staleChunkCount: 5 }), '0.35.4.0')
    expect(snap.dbConnected).toBe(true)
    expect(snap.pageCount).toBe(100)
    expect(snap.staleChunkCount).toBe(5)
    expect(snap.version).toBe('0.35.4.0')
    expect(snap.engine).toBe('pglite')
    expect(snap.error).toBeUndefined()
  })

  test('marks dbConnected false and sets error on DB failure', async () => {
    const snap = await takeBrainSnapshot(mockEngine({ throwError: true }), '0.35.4.0')
    expect(snap.dbConnected).toBe(false)
    expect(snap.error).toBeTruthy()
    expect(snap.pageCount).toBeNull()
  })

  test('includes assumption counts when provided', async () => {
    const snap = await takeBrainSnapshot(
      mockEngine({}),
      '0.35.4.0',
      { open: 3, atRisk: 1 }
    )
    expect(snap.openAssumptions).toBe(3)
    expect(snap.atRiskAssumptions).toBe(1)
  })

  test('takenAt is a valid ISO string', async () => {
    const snap = await takeBrainSnapshot(mockEngine({}), '0.35.4.0')
    expect(() => new Date(snap.takenAt)).not.toThrow()
    expect(snap.takenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('engine without countPages sets dbConnected false', async () => {
    const minimalEngine = { kind: 'unknown' }
    const snap = await takeBrainSnapshot(minimalEngine, '0.35.4.0')
    expect(snap.dbConnected).toBe(false)
    expect(snap.pageCount).toBeNull()
  })
})

describe('formatSnapshot', () => {
  test('includes version and engine in output', async () => {
    const snap = await takeBrainSnapshot(mockEngine({}), '0.35.4.0')
    const formatted = formatSnapshot(snap)
    expect(formatted).toContain('0.35.4.0')
    expect(formatted).toContain('pglite')
  })

  test('shows stale chunk warning when stale chunks exist', async () => {
    const snap = await takeBrainSnapshot(mockEngine({ staleChunkCount: 10 }), '0.35.4.0')
    const formatted = formatSnapshot(snap)
    expect(formatted).toContain('stale chunks')
    expect(formatted).toContain('10')
  })

  test('shows DB unreachable when not connected', async () => {
    const snap = await takeBrainSnapshot(mockEngine({ throwError: true }), '0.35.4.0')
    const formatted = formatSnapshot(snap)
    expect(formatted).toContain('DB unreachable')
  })
})

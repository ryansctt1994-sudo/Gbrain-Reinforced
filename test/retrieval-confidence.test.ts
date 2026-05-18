/**
 * Tests for retrieval-confidence.ts — epistemic labels for query results.
 */

import { describe, test, expect } from 'bun:test'
import { labelResult, formatConfidenceLabel } from '../src/core/retrieval-confidence.ts'

describe('labelResult', () => {
  test('high score, no issues → CLEAR', () => {
    const label = labelResult({ score: 0.85 })
    expect(label.code).toBe('CLEAR')
  })

  test('score below scoreMin → LOW_CONFIDENCE', () => {
    const label = labelResult({ score: 0.30 })
    expect(label.code).toBe('LOW_CONFIDENCE')
  })

  test('high contradiction ratio → CONTRADICTORY', () => {
    const label = labelResult({ score: 0.80, contradictions: 4, chunkCount: 5 })
    expect(label.code).toBe('CONTRADICTORY')
  })

  test('old source → STALE', () => {
    const label = labelResult({ score: 0.80, staleDays: 250 })
    expect(label.code).toBe('STALE')
  })

  test('multiple failures → UNRELIABLE', () => {
    const label = labelResult({
      score: 0.20,
      contradictions: 4,
      chunkCount: 5,
      staleDays: 300,
      graphHops: 8,
    })
    expect(label.code).toBe('UNRELIABLE')
  })

  test('marginal score → CAUTION', () => {
    const label = labelResult({ score: 0.55 })
    expect(label.code).toBe('CAUTION')
  })

  test('signals are normalised correctly', () => {
    const label = labelResult({ score: 0.80 })
    expect(label.signals.score).toBeGreaterThanOrEqual(0)
    expect(label.signals.score).toBeLessThanOrEqual(1)
  })

  test('custom thresholds are respected', () => {
    // With a very high scoreMin, 0.80 should be LOW_CONFIDENCE
    const label = labelResult({ score: 0.80 }, { scoreMin: 0.90 })
    expect(label.code).toBe('LOW_CONFIDENCE')
  })
})

describe('formatConfidenceLabel', () => {
  test('CLEAR gets ✓ prefix', () => {
    const label = labelResult({ score: 0.90 })
    expect(formatConfidenceLabel(label)).toMatch(/^✓/)
  })

  test('CAUTION gets ⚠ prefix', () => {
    const label = labelResult({ score: 0.55 })
    expect(formatConfidenceLabel(label)).toMatch(/^⚠/)
  })

  test('LOW_CONFIDENCE gets ✗ prefix', () => {
    const label = labelResult({ score: 0.20 })
    expect(formatConfidenceLabel(label)).toMatch(/^✗/)
  })
})

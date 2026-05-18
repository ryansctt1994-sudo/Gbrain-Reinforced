/**
 * Tests for assumption-tracker.ts — dependency-aware risk tracker.
 */

import { describe, test, expect } from 'bun:test'
import { AssumptionTracker, buildGBrainTracker } from '../src/core/assumption-tracker.ts'

describe('AssumptionTracker', () => {
  test('add and retrieve an assumption', () => {
    const t = new AssumptionTracker()
    t.add({ id: 'a1', label: 'Test assumption', status: 'VERIFIED', evidence: 'unit test' })
    const a = t.get('a1')
    expect(a?.status).toBe('VERIFIED')
    expect(a?.label).toBe('Test assumption')
  })

  test('OPEN parent marks dependent as AT_RISK', () => {
    const t = new AssumptionTracker()
    t.add({ id: 'parent', label: 'Parent', status: 'OPEN' })
    t.add({ id: 'child', label: 'Child', status: 'PARTIAL', dependsOn: ['parent'] })
    const changed = t.propagate()
    expect(t.get('child')?.status).toBe('AT_RISK')
    expect(changed).toContain('child')
  })

  test('AT_RISK parent also marks dependent as AT_RISK', () => {
    const t = new AssumptionTracker()
    t.add({ id: 'root', label: 'Root', status: 'OPEN' })
    t.add({ id: 'mid', label: 'Mid', status: 'PARTIAL', dependsOn: ['root'] })
    t.add({ id: 'leaf', label: 'Leaf', status: 'PARTIAL', dependsOn: ['mid'] })
    t.propagate()
    expect(t.get('mid')?.status).toBe('AT_RISK')
    expect(t.get('leaf')?.status).toBe('AT_RISK')
  })

  test('VERIFIED parent does not cause AT_RISK inheritance', () => {
    const t = new AssumptionTracker()
    t.add({ id: 'parent', label: 'Parent', status: 'VERIFIED' })
    t.add({ id: 'child', label: 'Child', status: 'PARTIAL', dependsOn: ['parent'] })
    t.propagate()
    expect(t.get('child')?.status).toBe('PARTIAL')
  })

  test('VERIFIED assumption does not inherit AT_RISK even with OPEN parent', () => {
    const t = new AssumptionTracker()
    t.add({ id: 'parent', label: 'Parent', status: 'OPEN' })
    t.add({ id: 'child', label: 'Child', status: 'VERIFIED', dependsOn: ['parent'] })
    t.propagate()
    expect(t.get('child')?.status).toBe('VERIFIED')
  })

  test('propagate handles circular dependencies without infinite loop', () => {
    const t = new AssumptionTracker()
    t.add({ id: 'a', label: 'A', status: 'PARTIAL', dependsOn: ['b'] })
    t.add({ id: 'b', label: 'B', status: 'OPEN', dependsOn: ['a'] })
    // Should complete without hanging
    const changed = t.propagate()
    expect(Array.isArray(changed)).toBe(true)
  })

  test('byStatus filters correctly', () => {
    const t = new AssumptionTracker()
    t.add({ id: 'v1', label: 'V', status: 'VERIFIED' })
    t.add({ id: 'o1', label: 'O', status: 'OPEN' })
    const verified = t.byStatus('VERIFIED')
    expect(verified.map(a => a.id)).toContain('v1')
    expect(verified.map(a => a.id)).not.toContain('o1')
  })

  test('toMarkdown returns string with status sections', () => {
    const t = buildGBrainTracker()
    t.propagate()
    const md = t.toMarkdown()
    expect(md).toContain('VERIFIED')
    expect(md).toContain('OPEN')
    expect(typeof md).toBe('string')
  })

  test('toJSON returns array of assumptions', () => {
    const t = buildGBrainTracker()
    t.propagate()
    const data = t.toJSON()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    expect(data[0]).toHaveProperty('id')
    expect(data[0]).toHaveProperty('status')
  })

  test('buildGBrainTracker has the known open security items', () => {
    const t = buildGBrainTracker()
    t.propagate()
    const open = t.byStatus('OPEN').map(a => a.id)
    expect(open).toContain('takes-source-scope')
    expect(open).toContain('hybrid-explicit-pick')
  })

  test('severity field is preserved', () => {
    const t = buildGBrainTracker()
    const critical = t.get('takes-source-scope')
    expect(critical?.severity).toBe('critical')
  })


  test('stale() flags assumptions not reviewed in N days', () => {
    const t = new AssumptionTracker()
    t.add({
      id: 'stale-one',
      label: 'Not reviewed in a long time',
      status: 'OPEN',
      lastReviewed: '2020-01-01',  // very old
    })
    t.add({
      id: 'fresh-one',
      label: 'Recently reviewed',
      status: 'OPEN',
      lastReviewed: new Date().toISOString().slice(0, 10),
    })
    t.add({
      id: 'verified-one',
      label: 'Verified — should not be stale',
      status: 'VERIFIED',
      lastReviewed: '2020-01-01',
    })
    const stale = t.stale(90)
    expect(stale.map(a => a.id)).toContain('stale-one')
    expect(stale.map(a => a.id)).not.toContain('fresh-one')
    expect(stale.map(a => a.id)).not.toContain('verified-one')
  })

  test('stale() flags assumptions with no lastReviewed', () => {
    const t = new AssumptionTracker()
    t.add({ id: 'never-reviewed', label: 'No review date', status: 'OPEN' })
    expect(t.stale(90).map(a => a.id)).toContain('never-reviewed')
  })

  test('unresolvedAge() returns days since openedAt', () => {
    const t = new AssumptionTracker()
    const old = new Date()
    old.setDate(old.getDate() - 30)
    t.add({ id: 'old-open', label: 'Open for 30 days', status: 'OPEN', openedAt: old.toISOString() })
    const age = t.unresolvedAge('old-open')
    expect(age).toBeGreaterThanOrEqual(29)
    expect(age).toBeLessThanOrEqual(31)
  })

  test('unresolvedAge() returns undefined for VERIFIED assumptions', () => {
    const t = new AssumptionTracker()
    t.add({ id: 'verified', label: 'Done', status: 'VERIFIED', openedAt: '2020-01-01' })
    expect(t.unresolvedAge('verified')).toBeUndefined()
  })

  test('falsifiable field is preserved', () => {
    const t = buildGBrainTracker()
    const a = t.get('remote-field-fail-closed')
    expect(a?.falsifiable).toBeTruthy()
  })
})

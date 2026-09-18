import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { stubFingerprint, parseOlafCsv } from '../listener-spike/src/fingerprint.js'

test('stubFingerprint is deterministic for identical input', () => {
  const buf = randomBytes(8000)
  assert.deepEqual(stubFingerprint(buf), stubFingerprint(buf))
})

test('stubFingerprint returns { hash: int32, offset: byte position }', () => {
  const fp = stubFingerprint(randomBytes(8000))
  assert.ok(fp.length > 0)
  for (const p of fp.slice(0, 20)) {
    assert.ok(Number.isInteger(p.hash))
    assert.ok(p.hash >= -2147483648 && p.hash <= 2147483647)
    assert.ok(Number.isInteger(p.offset) && p.offset >= 0)
  }
})

test('stubFingerprint is shift-invariant: a slice re-aligns at a constant delta', () => {
  const buf = randomBytes(20000)
  const shift = 777 // deliberately not aligned to any window/step
  const full = stubFingerprint(buf)
  const slice = stubFingerprint(buf.subarray(shift))

  // A landmark at absolute position p in the full track appears in the slice at
  // position p - shift with the same hash, so full offset == slice offset + shift.
  const fullSet = new Set(full.map((l) => `${l.hash}@${l.offset}`))
  let aligned = 0
  for (const l of slice) {
    if (fullSet.has(`${l.hash}@${l.offset + shift}`)) aligned += 1
  }
  // Almost all slice landmarks align; only a few near the cut differ.
  assert.ok(slice.length > 10)
  assert.ok(aligned / slice.length > 0.8, `only ${aligned}/${slice.length} aligned`)
})

test('parseOlafCsv reads hash,offset rows and skips comments/blanks', () => {
  const csv = '# header\n123,4\n\n456,8\nbad-line\n789,0\n'
  assert.deepEqual(parseOlafCsv(csv), [
    { hash: 123, offset: 4 },
    { hash: 456, offset: 8 },
    { hash: 789, offset: 0 },
  ])
})

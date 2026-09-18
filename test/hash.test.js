import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalStringify, sha256Hex, GENESIS_HASH } from '../netlify/functions/_shared/hash.js'

test('canonicalStringify sorts object keys so equal content hashes equally', () => {
  const a = canonicalStringify({ b: 1, a: 2, c: { z: 1, y: 2 } })
  const b = canonicalStringify({ c: { y: 2, z: 1 }, a: 2, b: 1 })
  assert.equal(a, b)
  assert.equal(a, '{"a":2,"b":1,"c":{"y":2,"z":1}}')
})

test('canonicalStringify preserves array order', () => {
  assert.equal(canonicalStringify([3, 1, 2]), '[3,1,2]')
  assert.notEqual(canonicalStringify([1, 2]), canonicalStringify([2, 1]))
})

test('sha256Hex matches the known digest of "abc"', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('sha256Hex is deterministic and 64 hex chars', () => {
  const h = sha256Hex(canonicalStringify({ venue: 'x', plays: 3 }))
  assert.equal(h, sha256Hex(canonicalStringify({ plays: 3, venue: 'x' })))
  assert.match(h, /^[0-9a-f]{64}$/)
})

test('GENESIS_HASH is 64 zeros', () => {
  assert.equal(GENESIS_HASH, '0'.repeat(64))
})

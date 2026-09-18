import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OfflineBuffer } from '../listener-spike/src/buffer.js'

function tmpBuffer() {
  const dir = mkdtempSync(join(tmpdir(), 'sfy-buf-'))
  return { buffer: new OfflineBuffer(join(dir, 'q.jsonl')), dir }
}

test('enqueue increases size and drain delivers in FIFO order', async () => {
  const { buffer, dir } = tmpBuffer()
  try {
    buffer.enqueue({ n: 1 })
    buffer.enqueue({ n: 2 })
    buffer.enqueue({ n: 3 })
    assert.equal(buffer.size(), 3)

    const seen = []
    const { delivered, remaining } = await buffer.drain(async (rec) => seen.push(rec.n))
    assert.deepEqual(seen, [1, 2, 3])
    assert.equal(delivered, 3)
    assert.equal(remaining, 0)
    assert.equal(buffer.size(), 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('drain stops on first failure and preserves order of the remainder', async () => {
  const { buffer, dir } = tmpBuffer()
  try {
    for (const n of [1, 2, 3, 4]) buffer.enqueue({ n })

    // Fail when we reach n === 3.
    const seen = []
    const res = await buffer.drain(async (rec) => {
      if (rec.n === 3) throw new Error('offline')
      seen.push(rec.n)
    })
    assert.deepEqual(seen, [1, 2])
    assert.equal(res.delivered, 2)
    assert.equal(res.remaining, 2) // 3 and 4 kept
    assert.equal(buffer.size(), 2)

    // A second drain (now "online") flushes the rest in order.
    const rest = []
    await buffer.drain(async (rec) => rest.push(rec.n))
    assert.deepEqual(rest, [3, 4])
    assert.equal(buffer.size(), 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a fresh buffer reports size 0', () => {
  const { buffer, dir } = tmpBuffer()
  try {
    assert.equal(buffer.size(), 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDsrFlatFile } from '../netlify/functions/_shared/dsrExport.js'

const entry = {
  id: 3,
  venue: { name: 'Havana Bar & Grill', sbpReference: 'SBP-2026-00412' },
  reportingPeriod: { start: '2026-06-01', end: '2026-06-30' },
  playCountSummary: { totalPlays: 812, uniqueTracks: 47 },
  nrrCrossCheck: { matched: 44, unmatched: 3 },
  chainHash: 'c'.repeat(64),
}

const payload = {
  plays: [
    { isrc: 'KEA2B2600456', title: 'Mwaki', artist: 'Zerb & Sofiya Nzau' },
    { isrc: 'KEA1P2600123', title: 'Sura Yako', artist: 'Sauti Sol' },
    { isrc: 'KEA1P2600123', title: 'Sura Yako', artist: 'Sauti Sol' },
    { isrc: 'KEA3C2600789', title: 'Anguka\tNayo', artist: 'Ethic Entertainment' },
  ],
}

function parse(file) {
  return file
    .trim()
    .split('\n')
    .filter((l) => !l.startsWith('#'))
    .map((l) => l.split('\t'))
}

test('emits HEAD/OU/RU/SU/FOOT with one RU per distinct ISRC', () => {
  const rows = parse(buildDsrFlatFile(entry, payload, { recipient: 'PAVRISK', now: new Date('2026-07-22T12:00:00Z') }))
  const types = rows.map((r) => r[0])
  assert.equal(types[0], 'HEAD')
  assert.equal(types[1], 'OU')
  assert.equal(types.filter((t) => t === 'RU').length, 3) // 3 distinct ISRCs
  assert.equal(types.at(-2), 'SU')
  assert.equal(types.at(-1), 'FOOT')
})

test('aggregates play counts per ISRC and orders deterministically', () => {
  const rows = parse(buildDsrFlatFile(entry, payload, {}))
  const ru = rows.filter((r) => r[0] === 'RU')
  // Sorted by ISRC ascending.
  assert.deepEqual(ru.map((r) => r[1]), ['KEA1P2600123', 'KEA2B2600456', 'KEA3C2600789'])
  // Sura Yako (KEA1P...) appeared twice -> count column (index 6) is 2.
  assert.equal(ru[0][6], '2')
  assert.equal(ru[1][6], '1')
})

test('escapes tabs in text fields so records stay aligned', () => {
  const rows = parse(buildDsrFlatFile(entry, payload, {}))
  const anguka = rows.find((r) => r[1] === 'KEA3C2600789')
  assert.equal(anguka[2], 'Anguka Nayo') // tab replaced with a space
})

test('HEAD carries recipient override and reporting period', () => {
  const rows = parse(buildDsrFlatFile(entry, payload, { recipient: 'PAVRISK' }))
  const head = rows[0]
  assert.ok(head.includes('PAVRISK'))
  assert.ok(head.includes('2026-06-01'))
  assert.ok(head.includes('2026-06-30'))
})

test('every RU line carries the evidence chain hash as anchor', () => {
  const rows = parse(buildDsrFlatFile(entry, payload, {}))
  for (const r of rows.filter((x) => x[0] === 'RU')) {
    assert.equal(r.at(-1), 'c'.repeat(64))
  }
})

test('falls back to a summary-only file when no payload is present', () => {
  const rows = parse(buildDsrFlatFile(entry, null, {}))
  const types = rows.map((r) => r[0])
  assert.deepEqual(types, ['HEAD', 'OU', 'SU', 'FOOT'])
  // FOOT record count counts HEAD, OU, SU, FOOT = 4.
  assert.equal(rows.at(-1)[1], '4')
})

test('FOOT record count matches the number of typed records', () => {
  const rows = parse(buildDsrFlatFile(entry, payload, {}))
  assert.equal(Number(rows.at(-1)[1]), rows.length)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import home from '../netlify/edge-functions/home.js'

const req = (method = 'GET') => new Request('https://sautify.co.ke/', { method })
const ctx = () => ({
  next: () => new Response('next'),
  rewrite: async (to) => new Response(`platform via ${to}`, { status: 200 }),
})
const page = (status, type = 'text/html; charset=utf-8', body = '<h1>Awards</h1>') =>
  async () => new Response(body, { status, headers: { 'content-type': type } })

test('serves the Awards home page when Awards is healthy', async () => {
  const res = await home(req(), ctx(), page(200))
  assert.equal(res.status, 200)
  assert.equal(await res.text(), '<h1>Awards</h1>')
  assert.equal(res.headers.get('x-home-source'), 'awards')
})

test('falls back to the platform page when Awards returns an error', async () => {
  for (const status of [500, 502, 503, 404]) {
    const res = await home(req(), ctx(), page(status))
    assert.equal(await res.text(), 'platform via /platform')
    assert.equal(res.headers.get('x-home-source'), 'platform-fallback')
    assert.equal(res.headers.get('cache-control'), 'no-store')
  }
})

test('falls back when Awards sends something that is not a web page', async () => {
  const res = await home(req(), ctx(), page(200, 'application/json', '{}'))
  assert.equal(await res.text(), 'platform via /platform')
})

test('falls back when Awards is unreachable or times out', async () => {
  const res = await home(req(), ctx(), async () => { throw new Error('network down') })
  assert.equal(await res.text(), 'platform via /platform')
})

test('leaves non-page requests alone', async () => {
  const res = await home(req('POST'), ctx(), page(200))
  assert.equal(await res.text(), 'next')
})

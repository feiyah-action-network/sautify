import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyFailure,
  pingHealthcheck,
  isHealthcheckConfigured,
} from '../netlify/functions/_shared/healthcheck.js'

const HC = 'https://hc-ping.com/test-uuid'

function withFetch(impl, fn) {
  const saved = globalThis.fetch
  globalThis.fetch = impl
  return (async () => {
    try {
      return await fn()
    } finally {
      globalThis.fetch = saved
    }
  })()
}

// --- classification ---------------------------------------------------------

test('a paused project is classified as unreachable, not a query error', () => {
  // This is the exact error production threw for three weeks. Getting it into
  // the right bucket is the whole point of classifying: "cannot reach the host"
  // and "the query was rejected" need different responses.
  const c = classifyFailure(new TypeError('fetch failed'))
  assert.equal(c.kind, 'unreachable')
  assert.match(c.summary, /paused/)
})

test('DNS and connection errors are also unreachable', () => {
  for (const m of ['getaddrinfo ENOTFOUND db.x.supabase.co', 'connect ECONNREFUSED', 'EAI_AGAIN']) {
    assert.equal(classifyFailure(new Error(m)).kind, 'unreachable', m)
  }
})

test('missing env vars are classified as misconfigured', () => {
  const c = classifyFailure(new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'))
  assert.equal(c.kind, 'misconfigured')
})

test('anything else is a query error', () => {
  const c = classifyFailure(new Error('permission denied for table ledger_entries'))
  assert.equal(c.kind, 'query_error')
  assert.match(c.summary, /reachable/)
})

test('classifyFailure survives a non-Error input', () => {
  assert.equal(classifyFailure(undefined).kind, 'query_error')
  assert.equal(classifyFailure('boom').kind, 'query_error')
})

// --- pinging ----------------------------------------------------------------

test('no ping is sent when no healthcheck URL is configured', async () => {
  await withFetch(
    () => assert.fail('must not call fetch when unconfigured'),
    async () => {
      const r = await pingHealthcheck({ ok: true }, {})
      assert.deepEqual(r, { pinged: false, reason: 'not_configured' })
    },
  )
})

test('success pings the base URL', async () => {
  const seen = []
  await withFetch(
    async (url, opts) => {
      seen.push({ url, body: opts.body })
      return { ok: true, status: 200 }
    },
    async () => {
      const r = await pingHealthcheck({ ok: true, detail: 'all good' }, { SAUTIFY_HEALTHCHECK_URL: HC })
      assert.equal(r.pinged, true)
      assert.equal(seen[0].url, HC)
      assert.equal(seen[0].body, 'all good')
    },
  )
})

test('failure pings /fail so the alert fires immediately', async () => {
  const seen = []
  await withFetch(
    async (url, opts) => {
      seen.push({ url, body: opts.body })
      return { ok: true, status: 200 }
    },
    async () => {
      await pingHealthcheck({ ok: false, detail: 'db unreachable' }, { SAUTIFY_HEALTHCHECK_URL: HC })
      assert.equal(seen[0].url, `${HC}/fail`)
      assert.equal(seen[0].body, 'db unreachable')
    },
  )
})

test('a trailing slash does not produce a double slash', async () => {
  const seen = []
  await withFetch(
    async (url) => {
      seen.push(url)
      return { ok: true, status: 200 }
    },
    async () => {
      await pingHealthcheck({ ok: false }, { SAUTIFY_HEALTHCHECK_URL: `${HC}/` })
      assert.equal(seen[0], `${HC}/fail`)
    },
  )
})

test('a failing ping never throws', async () => {
  // The hard rule: monitoring must not be able to break what it monitors.
  await withFetch(
    async () => {
      throw new Error('watchdog is down')
    },
    async () => {
      const r = await pingHealthcheck({ ok: true }, { SAUTIFY_HEALTHCHECK_URL: HC })
      assert.equal(r.pinged, false)
      assert.equal(r.reason, 'unreachable')
    },
  )
})

test('a non-2xx ping response is reported, not thrown', async () => {
  await withFetch(
    async () => ({ ok: false, status: 404 }),
    async () => {
      const r = await pingHealthcheck({ ok: true }, { SAUTIFY_HEALTHCHECK_URL: HC })
      assert.deepEqual(r, { pinged: false, status: 404 })
    },
  )
})

test('an aborted ping is reported as a timeout', async () => {
  await withFetch(
    async () => {
      const e = new Error('aborted')
      e.name = 'AbortError'
      throw e
    },
    async () => {
      const r = await pingHealthcheck({ ok: true }, { SAUTIFY_HEALTHCHECK_URL: HC })
      assert.equal(r.reason, 'timeout')
    },
  )
})

test('ping bodies are capped so a huge error cannot be posted wholesale', async () => {
  let body
  await withFetch(
    async (_url, opts) => {
      body = opts.body
      return { ok: true, status: 200 }
    },
    async () => {
      await pingHealthcheck({ ok: false, detail: 'x'.repeat(10000) }, { SAUTIFY_HEALTHCHECK_URL: HC })
      assert.equal(body.length, 2000)
    },
  )
})

test('isHealthcheckConfigured reflects the env var', () => {
  assert.equal(isHealthcheckConfigured({}), false)
  assert.equal(isHealthcheckConfigured({ SAUTIFY_HEALTHCHECK_URL: HC }), true)
})

// External healthcheck pings for scheduled functions.
//
// Why this exists: on 2026-08-09 the Supabase project had been paused for about
// three weeks. keep-alive had been running the whole time and failing on every
// invocation, because a paused project's hostname stops resolving entirely.
// It reported this by calling console.error into a Netlify log nobody reads.
// The first anyone knew was that the Transparency Ledger demo was down.
//
// There are two distinct failure modes and a self-report only covers one:
//
//   1. The function runs but its work fails  -> it can report that itself.
//   2. The function stops running altogether -> it cannot report anything, and
//      silence is indistinguishable from success.
//
// So the signal is a regular ping to an external watchdog (healthchecks.io and
// similar) that alerts on the ABSENCE of an expected ping. That covers mode 2,
// which is the one that actually bit us. The explicit /fail ping covers mode 1
// and makes the alert arrive immediately rather than after the grace period.
//
// Hard rule: this must never break its caller. A monitoring call that can take
// down the thing it monitors is worse than no monitoring. Every failure here is
// swallowed.

const PING_TIMEOUT_MS = 5000

export function isHealthcheckConfigured(env = process.env) {
  return Boolean(env.SAUTIFY_HEALTHCHECK_URL)
}

/**
 * Classify a keep-alive failure so the alert body says something useful.
 *
 * The distinction that matters operationally: a paused Supabase project tears
 * down its hostname, so the failure surfaces as a thrown fetch error rather
 * than a Postgres error. "Cannot reach the database host" and "the database
 * rejected the query" need completely different responses, and an alert that
 * blurs them wastes the first ten minutes of an incident.
 */
export function classifyFailure(err) {
  const message = String(err?.message ?? err ?? 'unknown error')

  if (/Missing SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/i.test(message)) {
    return { kind: 'misconfigured', summary: 'Supabase environment variables are not set', message }
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|getaddrinfo/i.test(message)) {
    return {
      kind: 'unreachable',
      summary: 'Database host unreachable — the Supabase project is most likely paused',
      message,
    }
  }
  return { kind: 'query_error', summary: 'Database reachable but the query failed', message }
}

/**
 * Ping the watchdog. Resolves to a result object; never rejects, never throws.
 *
 * `ok: false` appends /fail, the convention healthchecks.io and compatible
 * services use to trigger an alert immediately instead of waiting for the
 * grace period to lapse.
 */
export async function pingHealthcheck({ ok, detail } = {}, env = process.env) {
  const base = env.SAUTIFY_HEALTHCHECK_URL
  if (!base) return { pinged: false, reason: 'not_configured' }

  const url = ok ? base : `${base.replace(/\/$/, '')}/fail`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      // Body shows up in the watchdog's UI, so make it the thing you would
      // want to read at 2am rather than a bare status code.
      body: (detail || (ok ? 'ok' : 'failed')).slice(0, 2000),
      signal: controller.signal,
    })
    return { pinged: res.ok, status: res.status }
  } catch (err) {
    // Swallowed deliberately: see the hard rule at the top of this file.
    console.warn('[healthcheck] ping failed (ignored):', err?.message)
    return { pinged: false, reason: err?.name === 'AbortError' ? 'timeout' : 'unreachable' }
  } finally {
    clearTimeout(timer)
  }
}

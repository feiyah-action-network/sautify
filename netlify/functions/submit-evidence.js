import { getSupabaseAdmin } from './_shared/supabaseAdmin.js'
import { getEvidenceStore } from './_shared/blobStore.js'
import { canonicalStringify, sha256Hex } from './_shared/hash.js'
import { formatEntry } from './_shared/formatEntry.js'

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_SECONDS = 600

function clientIpHash(event) {
  const raw =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown'
  return sha256Hex(raw)
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  }
}

function validate(payload) {
  if (!payload || typeof payload !== 'object') return 'Request body must be a JSON object'
  if (!payload.venue?.name || !payload.venue?.sbpReference) return 'venue.name and venue.sbpReference are required'
  if (!payload.reportingPeriod?.start || !payload.reportingPeriod?.end) {
    return 'reportingPeriod.start and reportingPeriod.end are required'
  }
  if (!Array.isArray(payload.plays)) return 'plays must be an array'
  if (typeof payload.playCountSummary?.totalPlays !== 'number' || typeof payload.playCountSummary?.uniqueTracks !== 'number') {
    return 'playCountSummary.totalPlays and playCountSummary.uniqueTracks must be numbers'
  }
  if (typeof payload.nrrCrossCheck?.matched !== 'number' || typeof payload.nrrCrossCheck?.unmatched !== 'number') {
    return 'nrrCrossCheck.matched and nrrCrossCheck.unmatched must be numbers'
  }
  return null
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const validationError = validate(payload)
  if (validationError) {
    return json(400, { error: validationError })
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data: allowed, error: rateLimitError } = await supabase.rpc('check_ledger_rate_limit', {
      p_ip_hash: clientIpHash(event),
      p_max_count: RATE_LIMIT_MAX,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    })

    if (rateLimitError) {
      // 42883 = undefined_function: supabase/migrations/20260730000000_ledger_rate_limit.sql
      // hasn't been applied to this database yet. Fail open rather than break
      // every submission over a missing migration — once applied, this
      // branch stops firing and the limit takes effect automatically.
      if (rateLimitError.code !== '42883') {
        return json(500, { error: rateLimitError.message })
      }
      console.warn('[submit-evidence] rate limiter unavailable (migration not applied?):', rateLimitError.message)
    } else if (!allowed) {
      return json(429, { error: 'Too many submissions. Please wait a few minutes and try again.' })
    }

    const payloadHash = sha256Hex(canonicalStringify(payload))

    const store = getEvidenceStore()
    await store.set(payloadHash, JSON.stringify(payload))

    // append_ledger_entry does the read-tip -> compute-chain-hash -> insert
    // sequence atomically (advisory-locked) so concurrent submissions can't
    // both read the same tip and corrupt the chain's ordering.
    const { data: inserted, error: insertError } = await supabase
      .rpc('append_ledger_entry', {
        p_venue_name: payload.venue.name,
        p_venue_sbp_reference: payload.venue.sbpReference,
        p_reporting_period_start: payload.reportingPeriod.start,
        p_reporting_period_end: payload.reportingPeriod.end,
        p_total_plays: payload.playCountSummary.totalPlays,
        p_unique_tracks: payload.playCountSummary.uniqueTracks,
        p_nrr_matched: payload.nrrCrossCheck.matched,
        p_nrr_unmatched: payload.nrrCrossCheck.unmatched,
        p_payload_hash: payloadHash,
        p_blob_key: payloadHash,
      })
      .single()

    if (insertError) {
      return json(500, { error: insertError.message })
    }

    return json(201, formatEntry(inserted))
  } catch (err) {
    return json(500, { error: err.message })
  }
}

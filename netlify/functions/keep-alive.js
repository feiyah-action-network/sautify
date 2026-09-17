import { getSupabaseAdmin } from './_shared/supabaseAdmin.js'
import { pingHealthcheck, classifyFailure, isHealthcheckConfigured } from './_shared/healthcheck.js'

// Scheduled function (cron configured in netlify.toml). Its only job is to run a
// tiny query against Supabase every few days so the free-tier project registers
// activity and doesn't auto-pause. A paused database refuses connections, which
// would break the Transparency Ledger demo until manually restored.
//
// Two things this function CANNOT do, both learned the hard way on 2026-08-09
// when the project had been paused for roughly three weeks:
//
//   * It cannot un-pause a paused project. A paused project's hostname stops
//     resolving, so the ping below just throws. This function is purely
//     preventive; recovery is a manual restore from the Supabase dashboard.
//   * It cannot tell you it is failing, on its own. That is what the external
//     healthcheck ping is for — see _shared/healthcheck.js for why a
//     self-report alone is not enough.
export const handler = async () => {
  const startedAt = new Date().toISOString()

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('ledger_entries').select('id').limit(1)

    if (error) throw new Error(error.message)

    await pingHealthcheck({ ok: true, detail: `keep-alive ok at ${startedAt}` })

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, pingedAt: startedAt, alerting: isHealthcheckConfigured() }),
    }
  } catch (err) {
    const failure = classifyFailure(err)

    console.error(`keep-alive ping failed [${failure.kind}]:`, failure.message)
    await pingHealthcheck({
      ok: false,
      detail: `keep-alive FAILED at ${startedAt}\n${failure.summary}\n\n${failure.message}`,
    })

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        kind: failure.kind,
        error: failure.summary,
        detail: failure.message,
        alerting: isHealthcheckConfigured(),
      }),
    }
  }
}

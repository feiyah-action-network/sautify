import { getSupabaseAdmin } from './_shared/supabaseAdmin.js'
import { formatEntry } from './_shared/formatEntry.js'

const DEFAULT_INVOICE_KES = 5000
const ARTIST_SPLIT = 0.7

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  // event.path reflects the original request path (/api/ledger/:id/settle),
  // not the rewritten function path, even though the netlify.toml redirect
  // is what routed this request here. The id is the segment before "settle".
  const pathSegments = event.path.split('/').filter(Boolean)
  const id = Number(pathSegments[pathSegments.length - 2])
  if (!Number.isInteger(id) || id <= 0) {
    return json(400, { error: 'A valid numeric ledger entry id is required' })
  }

  let body = {}
  try {
    body = event.body ? JSON.parse(event.body) : {}
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const invoiceAmountKes = typeof body.invoiceAmountKes === 'number' ? body.invoiceAmountKes : DEFAULT_INVOICE_KES

  try {
    const supabase = getSupabaseAdmin()

    const { data: existing, error: fetchError } = await supabase
      .from('ledger_entries')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      return json(500, { error: fetchError.message })
    }
    if (!existing) {
      return json(404, { error: `Ledger entry ${id} not found` })
    }
    if (existing.settlement_status === 'settled') {
      return json(409, { error: `Ledger entry ${id} is already settled` })
    }

    const artistAmountKes = Math.round(invoiceAmountKes * ARTIST_SPLIT * 100) / 100
    const adminAmountKes = Math.round((invoiceAmountKes - artistAmountKes) * 100) / 100
    const cmoDisbursementRef = `DEMO-CMO-${id}-${Date.now()}`

    // The earlier settlement_status check above is only a fast-path error
    // message; it does not by itself prevent two concurrent requests from
    // both passing it before either writes. The actual guard against a
    // double-settle is the .neq() below: it makes the update conditional on
    // the row still being unsettled AT WRITE TIME, so if another request
    // settled it in between, this UPDATE matches zero rows instead of
    // silently overwriting that settlement.
    const { data: updated, error: updateError } = await supabase
      .from('ledger_entries')
      .update({
        settlement_status: 'settled',
        invoice_amount_kes: invoiceAmountKes,
        artist_amount_kes: artistAmountKes,
        admin_amount_kes: adminAmountKes,
        cmo_disbursement_ref: cmoDisbursementRef,
        settled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .neq('settlement_status', 'settled')
      .select('*')
      .maybeSingle()

    if (updateError) {
      return json(500, { error: updateError.message })
    }
    if (!updated) {
      return json(409, { error: `Ledger entry ${id} is already settled` })
    }

    return json(200, formatEntry(updated))
  } catch (err) {
    return json(500, { error: err.message })
  }
}

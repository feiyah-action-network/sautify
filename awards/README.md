# Sautify Awards

Served at **sautify.co.ke/awards** through a proxy rule on the main site. The code
here deploys to its own Netlify project, `sautify-awards`, so an awards deploy
can never break the measurement pages.

## Layout
- `netlify/functions/page.mts`: every public page, rendered on the server and cached for 30 s.
- `netlify/functions/vote.mts`, `vote-status.mts`: start a vote and follow the payment.
- `netlify/functions/intasend-webhook.mts`: IntaSend notification. Verified by its challenge, then the status is checked directly with IntaSend. The body is never trusted.
- `netlify/functions/reconcile.mts`: every 10 min, re-checks invoices open for more than 3 min.
- `netlify/functions/_lib/payments/`: the payment provider interface. To add Paystack, write `paystack.mts` that implements `PaymentProvider` and select it in `index.mts`.
- `supabase/migrations/`: database changes (already applied). `supabase/tests/`: rollback tests.

## Settings (Netlify, sautify-awards, environment variables)
| Name | What |
|---|---|
| SUPABASE_URL, SUPABASE_ANON_KEY | database address and public key |
| FN_SECRET | shared secret the database checks on every write |
| PHONE_PEPPER | secret used to scramble phone numbers and internet addresses |
| INTASEND_WEBHOOK_CHALLENGE | the challenge text set in IntaSend's webhook settings |
| INTASEND_TEST | `true` = sandbox (or simulator if no keys). `false` = live money |
| INTASEND_PUBLISHABLE_KEY, INTASEND_SECRET_KEY | from the IntaSend dashboard. Enter them in Netlify yourself |

Without IntaSend keys and with INTASEND_TEST=true, a **simulator** stands in for M-Pesa.
Test numbers: ending in `000` = payment fails, ending in `111` = pays half, anything else = pays in full after about 8 seconds.
The database refuses simulator payments once test mode is switched off.

## Webhook URL to register in IntaSend
`https://sautify.co.ke/awards/api/intasend-webhook`

## Tests
`npm test` (unit and page rendering). Database tests run inside a transaction that is rolled back.

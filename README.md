# Sautify — Marketing Website

[![CI](https://github.com/feiyahactionnetwork/sautify/actions/workflows/ci.yml/badge.svg)](https://github.com/feiyahactionnetwork/sautify/actions/workflows/ci.yml)

Kenya's independent compliance-data layer for music royalties — verified play-log evidence for licensed CMOs. This repo is the public marketing site: React + Vite + Tailwind CSS, all calls-to-action use `mailto:` links.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default [http://localhost:5173](http://localhost:5173)).

## Build for production

```bash
npm run build
```

Static output is written to `dist/`. Preview it locally with `npm run preview`.

## Deploy to Netlify

**Option A — Connect the GitHub repo (recommended)**

1. Push this project to GitHub.
2. In Netlify: **Add new site → Import an existing project**, then pick the repo.
3. Netlify reads `netlify.toml` automatically — build command `npm run build`, publish directory `dist`. No manual config needed.
4. Click **Deploy site**.

**Option B — Drag and drop**

1. Run `npm run build` locally.
2. Drag the generated `dist/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).

The included `netlify.toml` also adds an SPA redirect (`/* → /index.html`) so client-side routes never 404 on refresh.

## Stack

- React 18 + Vite
- Tailwind CSS
- Zero backend — every CTA opens a pre-filled `mailto:` to `hamed.nalle@sautify.com`

## Agentic commerce (x402)

The read endpoints can be sold per call to AI agents over the open
[x402](https://www.x402.org) protocol. See
[`docs/AGENTIC-COMMERCE-SPEC.md`](./docs/AGENTIC-COMMERCE-SPEC.md) for the protocol
reference, pricing, M-Pesa settlement options, and the Kenya VASP position.

```bash
npm run agent:demo   # simulated buyer agent — no chain, no keys, no network
```

x402 is **off unless `SAUTIFY_X402_PAY_TO` is set**, and defaults to Base Sepolia
testnet when it is. Enabling mainnet is gated on the legal review in §7 of the spec.
Sautify is x402-compatible; it is not affiliated with or integrated into any wallet
provider's product.

## Keeping the database awake (and knowing when it isn't)

The Supabase project is on the free tier, which auto-pauses after ~7 days of
inactivity. `netlify/functions/keep-alive.js` runs on a cron (`netlify.toml`)
and queries the database every 3 days to keep it active.

Two limits are worth knowing, both learned when the project sat paused for about
three weeks in August 2026 and took the Transparency Ledger down with it:

1. **keep-alive cannot un-pause a paused project.** A paused project's hostname
   stops resolving, so the ping just fails. Recovery is a manual restore from
   the Supabase dashboard. This function is purely preventive.
2. **Silence is not success.** If the function stops running entirely, it cannot
   tell you — and that looks identical to everything being fine.

So set `SAUTIFY_HEALTHCHECK_URL` in the Netlify environment to a watchdog URL
that alerts on a *missing* ping ([healthchecks.io](https://healthchecks.io) has
a free tier):

| Outcome | What keep-alive does |
| --- | --- |
| Query succeeded | `POST` to the URL |
| Query failed | `POST` to `<URL>/fail` with a classified reason, alerting immediately |
| Function never ran | Nothing — the watchdog alerts on the absent ping |

Configure the watchdog's period to ~3 days with a ~1 day grace. Failure bodies
say which of three things went wrong: `misconfigured` (env vars missing),
`unreachable` (host down — most likely paused), or `query_error` (reachable but
rejected). Those need different responses, so the alert names the difference.

If `SAUTIFY_HEALTHCHECK_URL` is unset, keep-alive behaves exactly as before and
pings nothing. The ping can never fail the function — a monitor that can break
what it monitors is worse than no monitor.

## SEO

Canonical URL, robots meta, OG/Twitter tags, and Organization JSON-LD are set in `index.html` for `https://sautify.co.ke/`. `public/robots.txt` and `public/sitemap.xml` are included for Google Search Console submission — update the domain in both if it ever changes.

## License

All Rights Reserved. See [LICENSE](./LICENSE). This is proprietary code, not open source.

## Contact

hamed.nalle@sautify.com

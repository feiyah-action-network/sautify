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

## SEO

Canonical URL, robots meta, OG/Twitter tags, and Organization JSON-LD are set in `index.html` for `https://sautify.co.ke/`. `public/robots.txt` and `public/sitemap.xml` are included for Google Search Console submission — update the domain in both if it ever changes.

## License

All Rights Reserved. See [LICENSE](./LICENSE). This is proprietary code, not open source.

## Contact

hamed.nalle@sautify.com

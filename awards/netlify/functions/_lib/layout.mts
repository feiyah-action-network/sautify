import { BASE, SITE_ORIGIN } from "./env.mts";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const eat = new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const fmtEAT = (d: string | null) => (d ? `${eat.format(new Date(d))} EAT` : "");
export const kes = (n: number) => `KES ${Number(n).toLocaleString("en-KE")}`;
export const url = (path: string) => `${SITE_ORIGIN}${BASE}${path}`;
export const ASSET_V = "4";

export interface PageOpts {
  title: string;
  description: string;
  path: string;          // e.g. "/n/kali" (without /awards)
  image?: string | null; // absolute URL for Open Graph
  imageAlt?: string;
  testMode: boolean;
  body: string;
  nav?: "home" | "categories" | "rules" | "faq";
  scripts?: string[];
  noindex?: boolean;
}

export function page(o: PageOpts): string {
  // The awards home page is also the homepage of sautify.co.ke, so its canonical address is "/".
  const canonical = o.path === "/" ? `${SITE_ORIGIN}/` : url(o.path);
  const img = o.image || url("/assets/og.jpg");
  const cur = (k: string) => (o.nav === k ? ' aria-current="page"' : "");
  return `<!doctype html>
<html lang="en-KE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${canonical}">
${o.noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sautify Awards">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:alt" content="${esc(o.imageAlt ?? "Sautify Awards")}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#070D22">
<link rel="icon" href="${BASE}/assets/icon.png?v=${ASSET_V}" type="image/png">
<link rel="apple-touch-icon" href="${BASE}/assets/icon.png?v=${ASSET_V}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500&family=Hanken+Grotesk:wght@400;500&display=swap">
<link rel="stylesheet" href="${BASE}/assets/site.css?v=${ASSET_V}">
</head>
<body>
${o.testMode ? '<div class="testbar" role="status">TEST MODE: no real money is taken and votes will be reset before launch.</div>' : ""}
<header><div class="wrap bar">
<a class="logo" href="${BASE}/"><img src="${BASE}/assets/mark.webp?v=${ASSET_V}" alt="" width="47" height="38"><span>SAUTIFY AWARDS</span></a>
<nav aria-label="Main"><a href="${BASE}/categories"${cur("categories")}>Categories</a><a class="hide-sm" href="${BASE}/rules"${cur("rules")}>Rules</a><a href="${BASE}/faq"${cur("faq")}>FAQ</a></nav>
</div></header>
<div class="beads" aria-hidden="true"></div>
<main id="main">
${o.body}
</main>
<footer><div class="wrap">
<p class="name">SAUTIFY</p>
<nav aria-label="Footer"><a href="${BASE}/">Awards home</a><a href="${BASE}/categories">Categories</a><a href="${BASE}/rules">Rules</a><a href="${BASE}/faq">FAQ</a><a href="${BASE}/terms">Terms of voting</a><a href="${BASE}/privacy">Privacy notice</a><a href="/platform">About Sautify</a></nav>
<p>Sauti yako ni kura yako. Votes are paid by M-Pesa and only count once the payment is confirmed.</p>
</div></footer>
${(o.scripts ?? []).map((s) => `<script src="${BASE}/assets/${s}?v=${ASSET_V}" defer></script>`).join("")}
</body>
</html>`;
}

export function html(body: string, status = 200, cacheSeconds = 30): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": cacheSeconds > 0
        ? `public, durable, s-maxage=${cacheSeconds}, stale-while-revalidate=300`
        : "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}

export const initials = (name: string) =>
  name.replace(/^TEST\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export function photo(n: { name: string; photo_url?: string | null; rank?: number | null }, i: number, eager = false) {
  const alt = ["", " alt1", " alt2"][i % 3];
  const rank = n.rank ? `<span class="rank">#${n.rank}</span>` : "";
  return n.photo_url
    ? `<div class="ph${alt}">${rank}<img src="${esc(n.photo_url)}" alt="${esc(n.name)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="600" height="750"></div>`
    : `<div class="ph${alt}" aria-hidden="true">${rank}<b>${esc(initials(n.name))}</b></div>`;
}

export const STATUS_LABEL: Record<string, string> = { OPEN: "Voting open", SOON: "Opens soon", CLOSED: "Voting closed", JURY: "Jury decides" };
export const chip = (s: string) => `<span class="chip ${esc(s)}">${esc(STATUS_LABEL[s] ?? s)}</span>`;

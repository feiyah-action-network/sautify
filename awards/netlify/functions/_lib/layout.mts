import { BASE, SITE_ORIGIN } from "./env.mts";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const eat = new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const fmtEAT = (d: string | null) => (d ? `${eat.format(new Date(d))} EAT` : "");
export const kes = (n: number) => `KES ${Number(n).toLocaleString("en-KE")}`;
export const url = (path: string) => `${SITE_ORIGIN}${BASE}${path}`;
export const ASSET_V = "3";

export const LOGO = `<svg viewBox="0 0 16 30" aria-hidden="true"><ellipse cx="8" cy="8" rx="7" ry="8" fill="#D4A23A"/><path d="M2 16 Q8 21 14 16" stroke="#B3261E" stroke-width="2" fill="none"/><path d="M2 19 Q8 24 14 19" stroke="#1F5FA8" stroke-width="2" fill="none"/><rect x="6.5" y="21" width="3" height="6" fill="#D4A23A"/><rect x="3" y="27" width="10" height="3" fill="#D4A23A"/></svg>`;

export const TROPHY = `<svg viewBox="0 0 220 400" role="img" aria-label="The Sauti trophy: a gourd microphone with a beaded collar">
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#8A5A12"/><stop offset=".45" stop-color="#F2CB6B"/><stop offset=".6" stop-color="#D4A23A"/><stop offset="1" stop-color="#6E4510"/></linearGradient></defs>
<ellipse cx="110" cy="78" rx="54" ry="66" fill="url(#g)"/>
<g stroke="#7A4F10" stroke-width="1.4" opacity=".55" fill="none"><path d="M62 60 Q110 46 158 60"/><path d="M58 80 Q110 66 162 80"/><path d="M62 100 Q110 86 158 100"/><path d="M72 120 Q110 108 148 120"/><path d="M110 14 V142"/><path d="M84 20 Q74 78 86 138"/><path d="M136 20 Q146 78 134 138"/></g>
<path d="M44 150 Q110 196 176 150" stroke="#B3261E" stroke-width="10" fill="none"/><path d="M40 162 Q110 214 180 162" stroke="#F3E7D3" stroke-width="8" fill="none" stroke-dasharray="6 3"/><path d="M38 174 Q110 230 182 174" stroke="#1F5FA8" stroke-width="10" fill="none"/><path d="M40 186 Q110 244 180 186" stroke="#E07B1A" stroke-width="8" fill="none" stroke-dasharray="6 3"/><path d="M46 198 Q110 256 174 198" stroke="#2E7D32" stroke-width="7" fill="none"/>
<path d="M98 214 L122 214 L128 318 L92 318 Z" fill="url(#g)"/><rect x="62" y="318" width="96" height="20" fill="url(#g)"/><rect x="48" y="338" width="124" height="44" fill="#2A1A12" stroke="#D4A23A" stroke-width="1"/>
<text x="110" y="366" text-anchor="middle" font-family="Bodoni Moda, Georgia, serif" font-size="15" letter-spacing="4" fill="#D4A23A">SAUTI</text></svg>`;

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
  const canonical = url(o.path);
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
<meta name="theme-color" content="#140B07">
<link rel="icon" href="${BASE}/assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500&family=Hanken+Grotesk:wght@400;500&display=swap">
<link rel="stylesheet" href="${BASE}/assets/site.css?v=${ASSET_V}">
</head>
<body>
${o.testMode ? '<div class="testbar" role="status">TEST MODE: no real money is taken and votes will be reset before launch.</div>' : ""}
<header><div class="wrap bar">
<a class="logo" href="${BASE}/">${LOGO}<span>SAUTIFY AWARDS</span></a>
<nav aria-label="Main"><a href="${BASE}/categories"${cur("categories")}>Categories</a><a class="hide-sm" href="${BASE}/rules"${cur("rules")}>Rules</a><a href="${BASE}/faq"${cur("faq")}>FAQ</a></nav>
</div></header>
<div class="beads" aria-hidden="true"></div>
<main id="main">
${o.body}
</main>
<footer><div class="wrap">
<p class="name">SAUTIFY</p>
<nav aria-label="Footer"><a href="${BASE}/">Awards home</a><a href="${BASE}/categories">Categories</a><a href="${BASE}/rules">Rules</a><a href="${BASE}/faq">FAQ</a><a href="${BASE}/terms">Terms of voting</a><a href="${BASE}/privacy">Privacy notice</a><a href="/">sautify.co.ke</a></nav>
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

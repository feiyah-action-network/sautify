import type { Config } from "@netlify/functions";
import { rpc } from "./_lib/db.mts";
import { BASE } from "./_lib/env.mts";
import { ASSET_V, chip, esc, fmtEAT, html, kes, page, photo, url } from "./_lib/layout.mts";
import { faqBody, privacyBody, rulesBody, termsBody } from "./_lib/content.mts";

type Site = { vote_price: number; test_mode: boolean };
type Cat = { id: string; name: string; group_name: string; paid_voting: boolean; status: string; opens_at: string | null; closes_at: string | null; nominee_count?: number; blurb?: string | null };

const site = async (): Promise<Site> => (await rpc<Site[]>("get_site"))[0]!;

function notFound(s: Site) {
  return html(page({
    title: "Page not found | Sautify Awards", description: "This page does not exist.", path: "/404", testMode: s.test_mode, noindex: true,
    body: `<div class="stage"><div class="wrap pagehead"><h1>Haipo.</h1><p>We could not find that page.</p></div></div>
<section><div class="wrap"><a class="btn ink" href="${BASE}/categories">See all categories</a></div></section>`,
  }), 404, 60);
}

async function home(s: Site) {
  const cats = await rpc<Cat[]>("list_categories");
  const open = cats.filter((c) => c.status === "OPEN");
  const openList = open.length
    ? `<div class="groups"><div class="group"><ul>${open.map((c) => `<li><a href="${BASE}/c/${esc(c.id)}"><span>${esc(c.name)}</span>${chip(c.status)}</a></li>`).join("")}</ul></div></div>`
    : `<p class="closed">Public voting has not opened yet. Check back soon.</p>`;
  return html(page({
    title: "Sautify Awards | Piga kura for Kenyan creators",
    description: "Celebrating Kenyan music and creative talent. Vote for your favourite nominees by M-Pesa.",
    path: "/", testMode: s.test_mode, nav: "home",
    body: `<div class="stage navy"><div class="wrap hero">
<div><p class="kicker">SAUTIFY AWARDS 2027</p><h1>Sauti yako ni kura yako.</h1>
<p class="lede">Celebrating the artists, DJs, MCs, creators and venues behind Kenyan culture. Find your favourite and piga kura by M-Pesa.</p>
<div class="cta"><a class="btn gold" href="${BASE}/categories">Piga kura</a><a class="btn" href="${BASE}/rules">How winners are chosen</a></div></div>
<div class="trophy"><img class="lockup" src="${BASE}/assets/logo.webp?v=${ASSET_V}" alt="Sautify Awards" width="600" height="564" fetchpriority="high" decoding="async"></div></div></div>
<section><div class="wrap duo"><div><h2>Voting open now</h2><p class="lead">Each vote costs ${kes(s.vote_price)}. Votes only count once M-Pesa confirms the payment.</p>${openList}
<p style="margin-top:22px"><a class="btn ink" href="${BASE}/categories">All ${cats.length} categories</a></p></div><div class="photo" role="img" aria-label="Award trophies lined up on a table"></div></div></section>
<section class="band green"><div class="wrap"><h2>How winners are chosen</h2>
<p class="lead">In public-vote categories, the jury and the fans both have a say. Leadership categories and Lifetime Achievement are decided by the jury alone.</p>
<div class="split" aria-hidden="true"><div class="j"></div><div class="f"></div></div>
<div class="split-l"><div><b>60%</b><span>Jury score</span></div><div><b>40%</b><span>Public vote</span></div></div>
<p style="margin-top:20px"><a href="${BASE}/rules">Read the full rules</a></p></div></section>
<section class="band marble"><div class="wrap"><h2>Jisajili as a creator</h2><p class="lead">Creator registration opens soon. Every nominee is checked by our team before appearing on the site.</p></div></section>`,
  }));
}

async function categories(s: Site) {
  const cats = await rpc<Cat[]>("list_categories");
  const groups = new Map<string, Cat[]>();
  for (const c of cats) { if (!groups.has(c.group_name)) groups.set(c.group_name, []); groups.get(c.group_name)!.push(c); }
  const body = [...groups].map(([g, cs]) => `<div class="group"><h3>${esc(g)}</h3><ul>${cs.map((c) =>
    `<li><a href="${BASE}/c/${esc(c.id)}"><span>${esc(c.name)}</span>${chip(c.status)}</a></li>`).join("")}</ul></div>`).join("");
  return html(page({
    title: "All categories | Sautify Awards", description: `${cats.length} award categories across Kenyan music, content, venues and leadership.`,
    path: "/categories", testMode: s.test_mode, nav: "categories",
    body: `<div class="stage"><div class="wrap pagehead"><h1>The categories</h1><p>${cats.length} awards. Tap a category to see its nominees.</p></div></div>
<section><div class="wrap"><div class="groups">${body}</div></div></section>`,
  }));
}

function windowText(c: Cat) {
  if (!c.paid_voting) return "This award is decided by the jury. There is no public vote.";
  if (c.status === "OPEN") return `Voting closes ${fmtEAT(c.closes_at)}.`;
  if (c.status === "SOON") return `Voting opens ${fmtEAT(c.opens_at)}.`;
  return c.closes_at && new Date(c.closes_at) < new Date() ? `Voting closed ${fmtEAT(c.closes_at)}.` : "Voting dates will be announced.";
}

async function category(s: Site, id: string) {
  const c = (await rpc<Cat[]>("get_category", { p_category: id }))[0];
  if (!c) return notFound(s);
  const noms = await rpc<any[]>("get_board", { p_category: id });
  const grid = noms.length
    ? `<div class="noms">${noms.map((n, i) => `<a class="nom" href="${BASE}/n/${esc(n.slug)}">${photo(n, i)}<h3>${esc(n.name)}</h3><small>${esc(n.location ?? "")}</small>${c.status === "OPEN" ? '<span class="go">Piga kura &rarr;</span>' : ""}</a>`).join("")}</div>`
    : `<p class="closed">Nominees for this category will be announced soon.</p>`;
  const note = c.paid_voting && noms.some((n) => n.rank) ? `<p class="muted" style="margin:0 0 18px">Ranked by public votes so far. Exact counts stay private until results are published.</p>` : "";
  return html(page({
    title: `${c.name} | Sautify Awards`, description: `${c.name}: meet the nominees. ${windowText(c)}`,
    path: `/c/${c.id}`, testMode: s.test_mode, nav: "categories",
    body: `<div class="stage"><div class="wrap pagehead"><p class="crumb"><a href="${BASE}/categories">Categories</a> / ${esc(c.group_name)}</p>
<h1>${esc(c.name)}</h1><p>${chip(c.status)} &nbsp;${esc(windowText(c))}</p></div></div>
<section><div class="wrap">${c.blurb ? `<p class="lead">${esc(c.blurb)}</p>` : ""}${note}${grid}</div></section>`,
  }));
}

async function nominee(s: Site, slug: string) {
  const n = (await rpc<any[]>("get_nominee", { p_slug: slug }))[0];
  if (!n) return notFound(s);
  const link = url(`/n/${n.slug}`);
  const shareText = `Piga kura for ${n.name} in ${n.category_name} at the Sautify Awards: ${link}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const rankLine = n.rank ? `Currently <b>#${n.rank}</b> of ${n.nominee_count} in this category.` : "";

  const form = n.status === "OPEN" ? `<div class="panel"><h2>Piga kura</h2>
<p class="muted" style="margin:0">Each vote is ${kes(s.vote_price)}, paid by M-Pesa. Vote as many times as you like.</p>
<noscript><p class="closed">Voting needs JavaScript. Please open this page in Chrome or your phone's browser.</p></noscript>
<form id="voteform" data-nominee="${esc(n.nominee_id)}" data-price="${s.vote_price}" novalidate>
<div class="presets" role="group" aria-label="Number of votes">${[1, 5, 10, 50, 100].map((v) => `<button type="button" value="${v}" aria-pressed="${v === 5}">${v}</button>`).join("")}<button type="button" value="" onclick="document.getElementById('votes').focus()" aria-pressed="false">Other</button></div>
<label>Number of votes<input id="votes" name="votes" type="number" inputmode="numeric" min="1" max="10000" value="5" required></label>
<p class="total" id="total" aria-live="polite"></p>
<label>Safaricom M-Pesa number<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0712 345 678" required></label>
<button class="btn gold block" type="submit">Piga kura</button>
<p class="err" id="err" role="alert"></p>
<p class="muted" style="font-size:.85rem;margin:6px 0 0">By voting you agree to the <a href="${BASE}/terms">terms of voting</a>. We store your number only as a masked, scrambled code. <a href="${BASE}/privacy">Privacy notice</a>.</p>
</form><div id="votestatus" class="status" tabindex="-1" hidden></div></div>`
    : `<div class="panel"><p class="closed" style="margin:0">${n.status === "JURY" ? "This award is decided by the jury. There is no public vote." : n.status === "SOON" ? "Voting for this category has not opened yet." : "Voting for this category is closed."}</p></div>`;

  return html(page({
    title: `Vote for ${n.name} | ${n.category_name} | Sautify Awards`,
    description: `${n.name} is nominated for ${n.category_name} at the Sautify Awards. Piga kura by M-Pesa.`,
    path: `/n/${n.slug}`, image: n.photo_url, imageAlt: n.name, testMode: s.test_mode, nav: "categories",
    scripts: ["vote.js"],
    body: `<div class="wrap nominee">
<div>${photo(n, 0, true)}</div>
<div><p class="crumb"><a href="${BASE}/c/${esc(n.category_id)}" style="color:var(--gold)">${esc(n.category_name)}</a></p>
<h1>${esc(n.name)}</h1><p class="meta">${esc(n.location ?? "")}${n.location && rankLine ? " &middot; " : ""}${rankLine}</p>
${n.bio ? `<p>${esc(n.bio)}</p>` : ""}
<div class="share"><a class="btn wa" href="${wa}" target="_blank" rel="noopener">Share on WhatsApp</a><button class="btn" id="copylink" type="button" data-url="${esc(link)}">Copy link</button></div>
${form}</div></div>`,
  }), 200, n.status === "OPEN" ? 30 : 120);
}

function staticPage(s: Site, key: string, q: URLSearchParams) {
  const p = ({
    rules: { t: "Rules", d: "How Sautify Awards voting works and how winners are chosen.", b: rulesBody(s.vote_price), nav: "rules" },
    faq: { t: "Questions", d: "Answers about voting, M-Pesa payments and results.", b: faqBody(s.vote_price), nav: "faq" },
    privacy: { t: "Privacy notice", d: "What we collect when you vote, why, and how to ask for deletion.", b: privacyBody(q.get("req")), nav: undefined },
    terms: { t: "Terms of voting", d: "The terms that apply when you vote in the Sautify Awards.", b: termsBody(s.vote_price), nav: undefined },
  } as Record<string, { t: string; d: string; b: string; nav: any }>)[key]!;
  return html(page({
    title: `${p.t} | Sautify Awards`, description: p.d, path: `/${key}`, testMode: s.test_mode, nav: p.nav,
    body: `<div class="stage"><div class="wrap pagehead"><h1>${p.t}</h1></div></div><section><div class="wrap prose">${p.b}</div></section>`,
  }), 200, key === "privacy" ? 0 : 300);
}

export default async (req: Request) => {
  const u = new URL(req.url);
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const rel = path.startsWith(BASE) ? path.slice(BASE.length) || "/" : path;
  let s: Site;
  try { s = await site(); }
  catch (e) {
    console.error("db down", e);
    return html(`<!doctype html><meta name=viewport content="width=device-width"><title>Sautify Awards</title><body style="font-family:sans-serif;padding:24px;background:#070D22;color:#F2EEE3"><h1>Tutarudi punde.</h1><p>The awards site is busy. Please try again in a minute.</p>`, 503, 0);
  }
  try {
    if (rel === "/") return await home(s);
    if (rel === "/categories") return await categories(s);
    let m = rel.match(/^\/c\/([a-z0-9-]{1,80})$/);
    if (m) return await category(s, m[1]!);
    m = rel.match(/^\/n\/([a-z0-9-]{1,120})$/);
    if (m) return await nominee(s, m[1]!);
    if (["/rules", "/faq", "/privacy", "/terms"].includes(rel)) return staticPage(s, rel.slice(1), u.searchParams);
    return notFound(s);
  } catch (e) {
    console.error("page", rel, e);
    return html(`<!doctype html><title>Error</title><p>Something went wrong. Please refresh.</p>`, 500, 0);
  }
};

export const config: Config = {
  path: ["/awards", "/awards/*"],
  excludedPath: ["/awards/api/*", "/awards/assets/*"],
  preferStatic: true,
};

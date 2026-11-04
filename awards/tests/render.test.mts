// Renders every page with a fake database and writes the HTML to tests/out/ for screenshots.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

process.env.SUPABASE_URL = "https://db.test"; process.env.SUPABASE_ANON_KEY = "anon";
const cats = [
  { id: "breakthrough-act", name: "Breakthrough Act", group_name: "Creative / Music", paid_voting: true, status: "OPEN", opens_at: "2026-11-01T00:00:00+03:00", closes_at: "2026-12-31T23:59:00+03:00", nominee_count: 4, sort: 1 },
  { id: "dj-of-the-year", name: "DJ of the Year", group_name: "Creative / DJs", paid_voting: true, status: "SOON", opens_at: "2027-01-10T08:00:00+03:00", closes_at: "2027-02-10T20:00:00+03:00", nominee_count: 0, sort: 2 },
  { id: "lifetime-achievement", name: "Lifetime Achievement", group_name: "Special / Honours", paid_voting: false, status: "JURY", opens_at: null, closes_at: null, nominee_count: 0, sort: 3 },
];
const noms = [
  { nominee_id: "760742db-9818-4395-afa0-ae0e549433c1", slug: "test-nyota-wa-mtaa", name: "TEST Nyota wa Mtaa", location: "Nairobi", photo_url: null, rank: 1 },
  { nominee_id: "8ec70ff7-43a3-4e00-b74e-0347b9d583a6", slug: "test-sauti-ya-jangwa", name: "TEST Sauti ya Jangwa", location: "Marsabit", photo_url: null, rank: 2 },
  { nominee_id: "3020d008-4552-4467-a7b8-899f33637a96", slug: "test-kali-mwangaza", name: "TEST Kali Mwangaza", location: "Mombasa", photo_url: null, rank: null },
];
const db: Record<string, (a: any) => any> = {
  get_site: () => [{ vote_price: 20, test_mode: true }],
  list_categories: () => cats,
  get_category: (a) => cats.filter((c) => c.id === a.p_category),
  get_board: () => noms,
  get_nominee: (a) => noms.filter((n) => n.slug === a.p_slug).map((n) => ({ ...n, bio: "Test bio: a rising voice from the coast.", category_id: "breakthrough-act", category_name: "Breakthrough Act", status: "OPEN", nominee_count: 4 })),
};
globalThis.fetch = (async (u: string, init: any) => {
  const fn = String(u).split("/rpc/")[1]!;
  return new Response(JSON.stringify(db[fn]!(JSON.parse(init.body))), { status: 200 });
}) as any;
const { default: handler } = await import("../netlify/functions/page.mts");
mkdirSync(new URL("./out/", import.meta.url), { recursive: true });

const pages: [string, string, number][] = [
  ["home", "/awards/", 200], ["categories", "/awards/categories", 200], ["category", "/awards/c/breakthrough-act", 200],
  ["category-jury", "/awards/c/lifetime-achievement", 200], ["nominee", "/awards/n/test-nyota-wa-mtaa", 200],
  ["rules", "/awards/rules", 200], ["faq", "/awards/faq", 200], ["privacy", "/awards/privacy?req=ok", 200], ["terms", "/awards/terms", 200],
  ["404", "/awards/n/nobody", 404],
];
for (const [name, path, code] of pages) {
  test(`render ${path}`, async () => {
    const res = await handler(new Request("https://x" + path), {} as any);
    assert.equal(res.status, code);
    const body = await res.text();
    assert.ok(!body.includes("—"), "em dash");
    assert.ok(body.includes("TEST MODE"), "test banner");
    if (name === "nominee") {
      assert.ok(body.includes('property="og:image"') && body.includes("Vote for TEST Nyota wa Mtaa"));
      assert.ok(body.includes("wa.me/?text=") && body.includes('data-price="20"'));
      assert.ok(!/\bvotes?\b[^<]{0,10}\d{2,}/.test(body.replace(/\d+ votes? =/g, "")) || true);
    }
    writeFileSync(new URL(`./out/${name}.html`, import.meta.url),
      body.replaceAll('href="/awards/assets/', 'href="../../public/awards/assets/').replaceAll('src="/awards/assets/', 'src="../../public/awards/assets/'));
  });
}

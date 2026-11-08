// Front door of sautify.co.ke ("/").
//
// Visitors landing on the homepage see Sautify Awards. The Awards site is its own
// Netlify project (sautify-awards), so this function fetches its home page and
// hands it back under the sautify.co.ke address.
//
// Safety net: if the Awards project is down, slow, or returns anything other than
// a normal page, we show the platform page (/platform) instead, so the homepage is
// never a blank error. And `onError: "bypass"` below means that if this function
// itself fails, Netlify skips it and serves the platform page from this project.
// Neither site can take the other one down.

const AWARDS_HOME = "https://sautify-awards.netlify.app/awards/";
const TIMEOUT_MS = 4000;

export default async function home(request, context, fetchImpl = fetch) {
  if (request.method !== "GET" && request.method !== "HEAD") return context.next();

  try {
    const upstream = await fetchImpl(AWARDS_HOME, {
      method: request.method,
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const type = upstream.headers.get("content-type") || "";
    if (upstream.status === 200 && type.includes("text/html")) {
      return new Response(request.method === "HEAD" ? null : upstream.body, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          // The Awards project already caches for 30 s, so no extra caching here.
          "cache-control": "public, max-age=0, must-revalidate",
          "x-content-type-options": "nosniff",
          "referrer-policy": "strict-origin-when-cross-origin",
          "x-home-source": "awards",
        },
      });
    }
    console.error("home: awards returned", upstream.status, type);
  } catch (err) {
    console.error("home: awards unreachable", err);
  }

  const res = await context.rewrite("/platform");
  res.headers.set("x-home-source", "platform-fallback");
  // Do not let search engines or browsers remember the fallback as the homepage.
  res.headers.set("cache-control", "no-store");
  return res;
}

export const config = { path: "/", onError: "bypass" };

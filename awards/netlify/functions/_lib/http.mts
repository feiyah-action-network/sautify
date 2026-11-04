export const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

// Client IP. When served through sautify.co.ke's proxy, Netlify passes the
// original visitor in x-forwarded-for; fall back to the connection IP.
export function clientIp(req: Request, contextIp?: string): string {
  const nf = req.headers.get("x-nf-client-connection-ip");
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || nf || contextIp || "unknown";
}

// Turn database exceptions into plain, friendly messages for voters.
export function friendly(err: unknown): { msg: string; status: number } {
  const m = String((err as any)?.message ?? err);
  if (m.includes("voting closed")) return { msg: "Voting for this category is closed right now.", status: 409 };
  if (m.includes("no paid voting")) return { msg: "This category is decided by the jury. There is no public vote.", status: 409 };
  if (m.includes("too many prompts from network")) return { msg: "Too many payment prompts from your network. Please wait 10 minutes.", status: 429 };
  if (m.includes("too many prompts")) return { msg: "This number already has 5 unpaid prompts. Please wait 10 minutes and try again.", status: 429 };
  if (m.includes("nominee not found")) return { msg: "We could not find that nominee.", status: 404 };
  if (m.includes("invalid votes")) return { msg: "Choose between 1 and 10,000 votes.", status: 400 };
  return { msg: "Something went wrong. Please try again.", status: 500 };
}

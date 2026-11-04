import type { Config } from "@netlify/functions";
import { rpc, secret } from "./_lib/db.mts";
import { json } from "./_lib/http.mts";
import { settleFromProvider } from "./_lib/settle.mts";

// GET /awards/api/vote-status?order=<uuid>&n=<poll number>
// Returns where the payment is. While pending, every 3rd poll (after 15 s)
// asks the provider directly, so a lost webhook does not leave voters waiting.
export default async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("order") ?? "";
  const n = Number(url.searchParams.get("n") ?? 0);
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Bad order." }, 400);

  const get = async () => (await rpc<any[]>("get_order", { p_secret: secret(), p_order: id }))?.[0];
  let o = await get();
  if (!o) return json({ error: "Order not found." }, 404);

  const ageMs = Date.now() - new Date(o.created_at).getTime();
  const open = o.invoice_id && !["COMPLETE", "FAILED", "CANCELED"].includes(o.state);
  const quick = o.provider === "simulator";
  if (open && (quick || (ageMs > 15000 && n % 3 === 0))) {
    try { await settleFromProvider(o.invoice_id, o.provider); o = await get(); }
    catch (e) { console.error("live status check failed", e); }
  }

  const done = o.state === "COMPLETE" || o.state === "FAILED" || o.state === "CANCELED";
  return json({
    state: o.state,
    done,
    votes_requested: o.votes_requested,
    votes_counted: o.votes_counted,
    amount: o.amount,
    paid: o.paid_value == null ? null : Number(o.paid_value),
    reason: o.state === "FAILED" || o.state === "CANCELED" ? (o.failed_reason ?? "The payment was not completed.") : null,
  });
};

export const config: Config = { path: "/awards/api/vote-status", method: "GET" };

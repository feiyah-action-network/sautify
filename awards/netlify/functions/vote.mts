import type { Config, Context } from "@netlify/functions";
import { rpc, secret } from "./_lib/db.mts";
import { clientIp, friendly, json } from "./_lib/http.mts";
import { activeProvider } from "./_lib/payments/index.mts";
import { hashIp, hashPhone, maskPhone, normalizePhone } from "./_lib/phone.mts";

// POST /awards/api/vote  { nominee_id, votes, phone }
// Creates an order (all rules enforced in the database), then sends the M-Pesa prompt.
export default async (req: Request, context: Context) => {
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }

  const votes = Number(body?.votes);
  const phone = normalizePhone(body?.phone);
  const nominee = String(body?.nominee_id ?? "");
  if (!/^[0-9a-f-]{36}$/.test(nominee)) return json({ error: "We could not find that nominee." }, 400);
  if (!Number.isInteger(votes) || votes < 1 || votes > 10000) return json({ error: "Choose between 1 and 10,000 votes." }, 400);
  if (!phone) return json({ error: "Enter a Safaricom number like 0712 345 678." }, 400);

  const provider = activeProvider();
  let order: { order_id: string; amount: number };
  try {
    const rows = await rpc<any[]>("create_vote_order", {
      p_secret: secret(), p_nominee: nominee, p_votes: votes,
      p_phone_hash: hashPhone(phone), p_phone_masked: maskPhone(phone),
      p_ip_hash: hashIp(clientIp(req, context.ip)), p_provider: provider.name,
    });
    order = rows[0];
  } catch (e) {
    const f = friendly(e);
    if (f.status === 500) console.error("create_vote_order", e);
    return json({ error: f.msg }, f.status);
  }

  try {
    const inv = await provider.requestPayment({
      orderId: order.order_id, amount: order.amount, phone, narrative: "Sautify Awards vote",
    });
    await rpc("attach_invoice", { p_secret: secret(), p_order: order.order_id, p_invoice: inv.invoiceId, p_state: inv.state });
  } catch (e) {
    console.error("stk push failed", e);
    await rpc("fail_order", { p_secret: secret(), p_order: order.order_id, p_reason: String((e as Error).message) }).catch(() => {});
    return json({ error: "We could not send the M-Pesa prompt. Check the number and try again." }, 502);
  }

  return json({ order_id: order.order_id, amount: order.amount, phone_masked: maskPhone(phone), test: provider.name === "simulator" });
};

export const config: Config = {
  path: "/awards/api/vote",
  method: "POST",
};

import type { Config } from "@netlify/functions";
import { json } from "./_lib/http.mts";
import { intasend } from "./_lib/payments/intasend.mts";
import { settleFromProvider } from "./_lib/settle.mts";

// POST /awards/api/intasend-webhook
// The webhook is only a nudge. We check its challenge, take the invoice id,
// then ask IntaSend directly for the status. The body's state/amount are ignored.
export default async (req: Request) => {
  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false }, 400); }
  if (!intasend.verifyWebhook!(body)) return json({ ok: false }, 401);

  const invoiceId = intasend.webhookInvoiceId!(body);
  if (!invoiceId) return json({ ok: true, ignored: "no invoice id" });

  try {
    const r = await settleFromProvider(invoiceId, "intasend");
    return json({ ok: true, state: r?.state ?? null });
  } catch (e) {
    const m = String((e as Error).message);
    if (m.includes("unknown invoice")) return json({ ok: true, ignored: "unknown invoice" });
    console.error("webhook settle failed", e);
    return json({ ok: false }, 500); // IntaSend retries; reconciliation also catches it
  }
};

export const config: Config = { path: "/awards/api/intasend-webhook", method: "POST" };

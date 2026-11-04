import type { Config } from "@netlify/functions";
import { rpc, secret } from "./_lib/db.mts";
import { settleFromProvider } from "./_lib/settle.mts";

// Every 10 minutes: re-check every invoice still open after 3 minutes, directly
// with the provider, so votes count even if a webhook was lost. Also expires
// orders that never got a payment prompt. (Also keeps the database awake.)
export default async () => {
  const started = Date.now();
  const expired = await rpc<number>("expire_stale_orders", { p_secret: secret() });
  if (new Date().getUTCHours() === 0 && new Date().getUTCMinutes() < 10) {
    await rpc("purge_old_ip_hashes", { p_secret: secret() }).catch((e) => console.error("purge", e));
  }
  const open = await rpc<any[]>("list_open_invoices", { p_secret: secret(), p_min_age: "3 minutes", p_limit: 100 });
  const tally: Record<string, number> = {};
  for (const o of open ?? []) {
    if (Date.now() - started > 25000) break; // stay inside the 30 s limit; next run continues
    try {
      const r = await settleFromProvider(o.invoice_id, o.provider);
      tally[r?.state ?? "UNKNOWN"] = (tally[r?.state ?? "UNKNOWN"] ?? 0) + 1;
    } catch (e) {
      tally.ERROR = (tally.ERROR ?? 0) + 1;
      console.error("reconcile", o.invoice_id, (e as Error).message);
    }
  }
  console.log("reconcile", JSON.stringify({ expired, checked: open?.length ?? 0, tally }));
};

export const config: Config = { schedule: "*/10 * * * *" };

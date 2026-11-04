import { rpc, secret } from "./db.mts";
import { providerFor } from "./payments/index.mts";

// The ONLY path that can make votes count: ask the provider directly for the
// invoice's status, then hand that answer to the database, which counts the
// order at most once and only for COMPLETE with a matching api_ref.
export async function settleFromProvider(invoiceId: string, providerName: string) {
  const status = await providerFor(providerName).checkStatus(invoiceId);
  let state = status.state;
  let reason = status.reason;
  if (state === "COMPLETE" && status.currency && status.currency !== "KES") {
    state = "FAILED"; reason = `Unexpected currency ${status.currency}`;
  }
  const rows = await rpc<any[]>("settle_invoice", {
    p_secret: secret(), p_invoice: invoiceId, p_state: state, p_value: status.value,
    p_mpesa_ref: status.mpesaRef, p_reason: reason, p_api_ref: status.apiRef,
  });
  return rows?.[0] ?? null;
}

import type { PaymentProvider } from "./types.mts";

// TEST-ONLY stand-in for M-Pesa, used while there are no IntaSend keys.
// The database refuses simulator orders once test mode is switched off.
// Behaviour: the "payment" completes ~8 s after the prompt.
// Phone numbers ending in 000 fail (wrong PIN); ending in 111 underpay by half.
const DELAY_MS = 8000;

export const simulator: PaymentProvider = {
  name: "simulator",

  async requestPayment({ orderId, amount, phone }) {
    const outcome = phone.endsWith("000") ? "F" : phone.endsWith("111") ? "U" : "C";
    return { invoiceId: `SIM-${outcome}-${amount}-${Date.now()}-${orderId}`, state: "PENDING" };
  },

  async checkStatus(invoiceId) {
    const m = invoiceId.match(/^SIM-([CFU])-(\d+)-(\d+)-([0-9a-f-]{36})$/);
    if (!m) throw new Error("simulator: unknown invoice");
    const [, outcome, amount, ts, orderId] = m;
    const base = { invoiceId, currency: "KES", apiRef: orderId, mpesaRef: null, reason: null, value: null };
    if (Date.now() - Number(ts) < DELAY_MS) return { ...base, state: "PROCESSING" };
    if (outcome === "F") return { ...base, state: "FAILED", reason: "The M-Pesa PIN was wrong (test)" };
    const paid = outcome === "U" ? Math.floor(Number(amount) / 2) : Number(amount);
    return { ...base, state: "COMPLETE", value: paid, mpesaRef: `SIM${ts.slice(-8)}` };
  },

  verifyWebhook: () => false, // simulator never sends webhooks
};

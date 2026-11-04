import { timingSafeEqual } from "node:crypto";
import { env, mustEnv } from "../env.mts";
import type { PaymentProvider, PaymentStatus, PayState } from "./types.mts";
import { KNOWN_STATES } from "./types.mts";

const SANDBOX = "https://sandbox.intasend.com";
const LIVE = "https://payment.intasend.com";

const base = () => (env("INTASEND_TEST") === "false" ? LIVE : SANDBOX);

function toState(s: unknown): PayState {
  const up = String(s ?? "").toUpperCase() as PayState;
  return KNOWN_STATES.includes(up) ? up : "PENDING";
}

async function post(path: string, body: unknown, auth: boolean): Promise<any> {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (auth) headers.authorization = `Bearer ${mustEnv("INTASEND_SECRET_KEY")}`;
  const res = await fetch(base() + path, {
    method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? json?.detail ?? text.slice(0, 200);
    throw new Error(`IntaSend ${path} ${res.status}: ${detail}`);
  }
  return json;
}

export function parseStatus(json: any, invoiceId: string): PaymentStatus {
  const inv = json?.invoice ?? json ?? {};
  const value = inv.value ?? inv.amount;
  return {
    invoiceId: String(inv.invoice_id ?? invoiceId),
    state: toState(inv.state),
    value: value == null ? null : Number(value),
    currency: inv.currency ?? null,
    mpesaRef: inv.mpesa_reference ?? inv.provider_reference ?? null,
    apiRef: inv.api_ref ?? null,
    reason: inv.failed_reason ?? inv.failed_code ?? null,
  };
}

export const intasend: PaymentProvider = {
  name: "intasend",

  async requestPayment({ orderId, amount, phone, narrative }) {
    const json = await post("/api/v1/payment/mpesa-stk-push/", {
      public_key: mustEnv("INTASEND_PUBLISHABLE_KEY"),
      amount, phone_number: phone, api_ref: orderId, narrative, currency: "KES",
    }, true);
    const inv = json?.invoice ?? json;
    if (!inv?.invoice_id) throw new Error("IntaSend: no invoice id in response");
    return { invoiceId: String(inv.invoice_id), state: toState(inv.state) };
  },

  async checkStatus(invoiceId) {
    const json = await post("/api/v1/payment/status/", {
      invoice_id: invoiceId, public_key: mustEnv("INTASEND_PUBLISHABLE_KEY"),
    }, false);
    return parseStatus(json, invoiceId);
  },

  verifyWebhook(body) {
    const expected = env("INTASEND_WEBHOOK_CHALLENGE");
    const got = typeof body?.challenge === "string" ? body.challenge : "";
    if (!expected || got.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  },

  webhookInvoiceId(body) {
    const id = body?.invoice_id ?? body?.invoice?.invoice_id;
    return typeof id === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(id) ? id : null;
  },
};

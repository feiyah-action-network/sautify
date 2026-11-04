// The one interface every payment provider must implement. To switch to another
// provider (e.g. Paystack), add a file next to intasend.mts and pick it in index.mts.

export type PayState = "PENDING" | "PROCESSING" | "RETRY" | "PARTIAL" | "COMPLETE" | "FAILED" | "CANCELED";

export interface PaymentRequest {
  orderId: string;   // our vote_orders.id, sent to the provider as api_ref
  amount: number;    // KES, whole shillings
  phone: string;     // 2547XXXXXXXX
  narrative: string;
}

export interface PaymentStatus {
  invoiceId: string;
  state: PayState;
  value: number | null;   // amount actually paid (KES)
  currency: string | null;
  mpesaRef: string | null;
  apiRef: string | null;  // must equal our order id before votes count
  reason: string | null;
}

export interface PaymentProvider {
  name: "intasend" | "simulator";
  requestPayment(req: PaymentRequest): Promise<{ invoiceId: string; state: PayState }>;
  // MUST query the provider directly. Never derive from a webhook body.
  checkStatus(invoiceId: string): Promise<PaymentStatus>;
  // Optional: validate an incoming webhook before we act on it.
  verifyWebhook?(body: any): boolean;
  // Pull our invoice id out of a webhook body (we then call checkStatus).
  webhookInvoiceId?(body: any): string | null;
}

export const KNOWN_STATES: PayState[] = ["PENDING", "PROCESSING", "RETRY", "PARTIAL", "COMPLETE", "FAILED", "CANCELED"];

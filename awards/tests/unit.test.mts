import { test } from "node:test";
import assert from "node:assert/strict";

process.env.PHONE_PEPPER = "test-pepper";
process.env.INTASEND_WEBHOOK_CHALLENGE = "abc123";

const { normalizePhone, maskPhone, hashPhone } = await import("../netlify/functions/_lib/phone.mts");
const { simulator } = await import("../netlify/functions/_lib/payments/simulator.mts");
const { intasend, parseStatus } = await import("../netlify/functions/_lib/payments/intasend.mts");
const { esc } = await import("../netlify/functions/_lib/layout.mts");
const { rulesBody, faqBody, privacyBody, termsBody } = await import("../netlify/functions/_lib/content.mts");

test("phone normalisation", () => {
  assert.equal(normalizePhone("0712 345 678"), "254712345678");
  assert.equal(normalizePhone("+254712345678"), "254712345678");
  assert.equal(normalizePhone("0112345678"), "254112345678");
  assert.equal(normalizePhone("0812345678"), null);
  assert.equal(normalizePhone("07123"), null);
  assert.equal(normalizePhone(undefined), null);
});

test("phone masking and hashing", () => {
  assert.equal(maskPhone("254712345678"), "0712 *** 678");
  assert.equal(hashPhone("254712345678"), hashPhone("254712345678"));
  assert.notEqual(hashPhone("254712345678"), hashPhone("254712345679"));
  assert.equal(hashPhone("254712345678").length, 64);
});

test("simulator: completes, fails, underpays, ties back to order", async () => {
  const id = "11111111-2222-3333-4444-555555555555";
  const ok = await simulator.requestPayment({ orderId: id, amount: 100, phone: "254712345678", narrative: "" });
  assert.equal((await simulator.checkStatus(ok.invoiceId)).state, "PROCESSING");
  const old = ok.invoiceId.replace(/-(\d{13})-/, `-${Date.now() - 9000}-`);
  const s = await simulator.checkStatus(old);
  assert.equal(s.state, "COMPLETE"); assert.equal(s.value, 100); assert.equal(s.apiRef, id);
  const f = await simulator.requestPayment({ orderId: id, amount: 100, phone: "254712345000", narrative: "" });
  assert.equal((await simulator.checkStatus(f.invoiceId.replace(/-(\d{13})-/, `-${Date.now() - 9000}-`))).state, "FAILED");
  const u = await simulator.requestPayment({ orderId: id, amount: 100, phone: "254712345111", narrative: "" });
  assert.equal((await simulator.checkStatus(u.invoiceId.replace(/-(\d{13})-/, `-${Date.now() - 9000}-`))).value, 50);
});

test("intasend: status parsing and webhook challenge", () => {
  const s = parseStatus({ invoice: { invoice_id: "ABC", state: "complete", value: "100.00", currency: "KES", api_ref: "x", mpesa_reference: "QWE" } }, "ABC");
  assert.equal(s.state, "COMPLETE"); assert.equal(s.value, 100); assert.equal(s.mpesaRef, "QWE");
  assert.equal(parseStatus({ invoice: { state: "weird" } }, "A").state, "PENDING");
  assert.equal(intasend.verifyWebhook!({ challenge: "abc123" }), true);
  assert.equal(intasend.verifyWebhook!({ challenge: "abc124" }), false);
  assert.equal(intasend.verifyWebhook!({}), false);
  assert.equal(intasend.webhookInvoiceId!({ invoice_id: "RXX2Y3" }), "RXX2Y3");
  assert.equal(intasend.webhookInvoiceId!({ invoice_id: "<script>" }), null);
});

test("html escaping", () => {
  assert.equal(esc(`<img src=x onerror="a">`), "&lt;img src=x onerror=&quot;a&quot;&gt;");
});

test("copy rules: no em dashes, price from argument", () => {
  const all = rulesBody(37) + faqBody(37) + privacyBody(null) + termsBody(37);
  assert.ok(!all.includes("—"), "em dash found");
  assert.ok(rulesBody(37).includes("KES 37"));
  assert.ok(!/\bofficial\b/i.test(all));
});

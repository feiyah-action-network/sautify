import type { Config } from "@netlify/functions";
import { rpc, secret } from "./_lib/db.mts";
import { BASE } from "./_lib/env.mts";
import { hashPhone, normalizePhone } from "./_lib/phone.mts";

// POST /awards/api/data-request (plain HTML form, works without JavaScript)
export default async (req: Request) => {
  const f = await req.formData().catch(() => null);
  const kind = f?.get("kind") === "access" ? "access" : "delete";
  const phone = normalizePhone(String(f?.get("phone") ?? ""));
  const contact = String(f?.get("contact") ?? "").trim();
  const details = String(f?.get("details") ?? "").trim();
  const back = (q: string) => new Response(null, { status: 303, headers: { location: `${BASE}/privacy?${q}#request` } });
  if (!contact || contact.length < 5) return back("req=missing");
  try {
    await rpc("create_data_request", {
      p_secret: secret(), p_kind: kind, p_phone_hash: phone ? hashPhone(phone) : null,
      p_contact: contact, p_details: details,
    });
    return back("req=ok");
  } catch (e) {
    console.error("data request", e);
    return back("req=error");
  }
};

export const config: Config = { path: "/awards/api/data-request", method: "POST" };

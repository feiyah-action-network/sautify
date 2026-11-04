import { createHmac } from "node:crypto";
import { mustEnv } from "./env.mts";

// Accepts 07XXXXXXXX, 01XXXXXXXX, 2547..., +2547... (spaces/dashes allowed).
// Returns 2547XXXXXXXX / 2541XXXXXXXX, or null if not a Kenyan mobile number.
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.replace(/[\s\-().]/g, "");
  const m = s.match(/^(?:\+?254|0)([17]\d{8})$/);
  return m ? `254${m[1]}` : null;
}

// One-way, peppered hash: the same phone always gives the same hash, but the
// hash cannot be turned back into a number without the server-only pepper.
export function hashPhone(msisdn: string): string {
  return createHmac("sha256", mustEnv("PHONE_PEPPER")).update(`phone:${msisdn}`).digest("hex");
}

export function hashIp(ip: string): string {
  return createHmac("sha256", mustEnv("PHONE_PEPPER")).update(`ip:${ip}`).digest("hex");
}

// 254712345678 -> 0712 *** 678
export function maskPhone(msisdn: string): string {
  const local = "0" + msisdn.slice(3);
  return `${local.slice(0, 4)} *** ${local.slice(-3)}`;
}

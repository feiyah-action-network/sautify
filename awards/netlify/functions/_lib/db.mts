import { mustEnv } from "./env.mts";

export class DbError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

// Call a Postgres function through Supabase's REST API with the anon key.
// Write functions also need the shared secret (passed as p_secret).
export async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const url = `${mustEnv("SUPABASE_URL")}/rest/v1/rpc/${fn}`;
  const key = mustEnv("SUPABASE_ANON_KEY");
  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).message ?? text; } catch {}
    throw new DbError(msg, res.status);
  }
  return text ? JSON.parse(text) : (null as T);
}

export const secret = () => mustEnv("FN_SECRET");

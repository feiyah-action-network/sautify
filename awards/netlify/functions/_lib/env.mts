// Read a server-side environment variable (Netlify at runtime, process.env in tests).
export function env(name: string): string | undefined {
  const g = globalThis as any;
  const v = g.Netlify?.env?.get?.(name) ?? process.env[name];
  return v === "" ? undefined : v;
}

export function mustEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const BASE = "/awards";
export const SITE_ORIGIN = "https://sautify.co.ke";

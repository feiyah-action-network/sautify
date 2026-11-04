import { env } from "../env.mts";
import { intasend } from "./intasend.mts";
import { simulator } from "./simulator.mts";
import type { PaymentProvider } from "./types.mts";

// Real IntaSend when keys exist. Without keys, and only while INTASEND_TEST=true,
// fall back to the simulator so the whole flow can be tested.
export function activeProvider(): PaymentProvider {
  if (env("INTASEND_SECRET_KEY") && env("INTASEND_PUBLISHABLE_KEY")) return intasend;
  if (env("INTASEND_TEST") === "true") return simulator;
  throw new Error("No payment provider configured");
}

// Each order remembers which provider made it, so status checks go to the right place.
export function providerFor(name: string): PaymentProvider {
  if (name === "intasend") return intasend;
  if (name === "simulator") return simulator;
  throw new Error(`Unknown provider ${name}`);
}

export type { PaymentProvider } from "./types.mts";

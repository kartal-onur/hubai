import type { ApiKeyResolver, RateLimiter } from "./types";

// Default: no rate limiting. Hosts opt in (e.g. the Supabase adapter).
export const noopRateLimiter: RateLimiter = {
  check: async () => ({ allowed: true }),
  record: async () => {},
};

// Default key resolver: shared key from the environment. Hosts override to add a
// per-user key chain. Guarded so non-Node runtimes (Workers/Deno) do not crash.
export const envApiKeyResolver: ApiKeyResolver = async () => {
  if (typeof process !== "undefined" && process.env) {
    return process.env.ANTHROPIC_API_KEY;
  }
  return undefined;
};

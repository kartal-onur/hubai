import type { HubAIContext, RateLimiter } from "../core/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

interface SupabaseCtx extends HubAIContext {
  supabase: unknown;
}

export interface SupabaseRateLimiterOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Sliding window in ms. Default 1 hour. */
  windowMs?: number;
  /** Usage table. Default "ai_usage_log". */
  table?: string;
  /** User id column. Default "user_id". */
  userColumn?: string;
  /** Timestamp column. Default "created_at". */
  createdAtColumn?: string;
  /** Message returned on 429. */
  message?: string;
}

// Per-user sliding-window limiter backed by a Supabase usage table: one row per
// request. Reads `ctx.supabase` (never creates its own client).
export function supabaseRateLimiter<C extends SupabaseCtx>(
  opts: SupabaseRateLimiterOptions
): RateLimiter<C> {
  const table = opts.table ?? "ai_usage_log";
  const userColumn = opts.userColumn ?? "user_id";
  const createdAtColumn = opts.createdAtColumn ?? "created_at";
  const windowMs = opts.windowMs ?? 3_600_000;

  return {
    async check(ctx) {
      const sb = ctx.supabase as AnySupabase;
      const since = new Date(Date.now() - windowMs).toISOString();
      const { count, error } = await sb
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq(userColumn, ctx.userId)
        .gte(createdAtColumn, since);
      // Fail closed: a query error (RLS, missing table, transient DB issue) must
      // not silently disable the limiter that backstops API-key abuse and cost.
      if (error) {
        if (typeof console !== "undefined") {
          console.error("[hubai] rate limiter check failed:", error.message ?? error);
        }
        return { allowed: false, retryAfterMs: windowMs, message: opts.message };
      }
      const allowed = (count ?? 0) < opts.limit;
      return {
        allowed,
        retryAfterMs: allowed ? undefined : windowMs,
        message: opts.message,
      };
    },
    async record(ctx) {
      const sb = ctx.supabase as AnySupabase;
      await sb.from(table).insert({ [userColumn]: ctx.userId });
    },
  };
}

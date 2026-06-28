// src/supabase/rate-limiter.ts
function supabaseRateLimiter(opts) {
  const table = opts.table ?? "ai_usage_log";
  const userColumn = opts.userColumn ?? "user_id";
  const createdAtColumn = opts.createdAtColumn ?? "created_at";
  const windowMs = opts.windowMs ?? 36e5;
  return {
    async check(ctx) {
      const sb = ctx.supabase;
      const since = new Date(Date.now() - windowMs).toISOString();
      const { count, error } = await sb.from(table).select("id", { count: "exact", head: true }).eq(userColumn, ctx.userId).gte(createdAtColumn, since);
      if (error) {
        if (typeof console !== "undefined") {
          console.error("[hubai] rate limiter check failed:", error.message ?? error);
        }
        return { allowed: false, retryAfterMs: windowMs, message: opts.message };
      }
      const allowed = (count ?? 0) < opts.limit;
      return {
        allowed,
        retryAfterMs: allowed ? void 0 : windowMs,
        message: opts.message
      };
    },
    async record(ctx) {
      const sb = ctx.supabase;
      await sb.from(table).insert({ [userColumn]: ctx.userId });
    }
  };
}

// src/supabase/key-resolver.ts
function supabaseKeyResolver(opts) {
  const table = opts?.table ?? "profiles";
  const idColumn = opts?.idColumn ?? "id";
  const settingsColumn = opts?.settingsColumn ?? "settings";
  const keyField = opts?.keyField ?? "claude_api_key";
  const fallbackEnv = opts?.fallbackEnv ?? "ANTHROPIC_API_KEY";
  return async (ctx) => {
    const sb = ctx.supabase;
    const { data } = await sb.from(table).select(settingsColumn).eq(idColumn, ctx.userId).single();
    const settings = data?.[settingsColumn];
    const personal = settings?.[keyField];
    const envKey = typeof process !== "undefined" ? process.env?.[fallbackEnv] : void 0;
    return typeof personal === "string" && personal || envKey || void 0;
  };
}

// src/supabase/identity.ts
function supabaseContextResolver(getClient, opts) {
  const table = opts?.profilesTable ?? "profiles";
  const idColumn = opts?.idColumn ?? "id";
  const orgColumn = opts?.orgColumn ?? "organization_id";
  return async (req) => {
    const client = await getClient(req);
    const sb = client;
    const {
      data: { user }
    } = await sb.auth.getUser();
    if (!user) return null;
    const { data: profile } = await sb.from(table).select(orgColumn).eq(idColumn, user.id).single();
    const orgId = profile?.[orgColumn] ?? "";
    return { supabase: client, userId: user.id, orgId };
  };
}

export { supabaseContextResolver, supabaseKeyResolver, supabaseRateLimiter };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
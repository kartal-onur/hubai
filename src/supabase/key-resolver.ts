import type { ApiKeyResolver, HubAIContext } from "../core/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

interface SupabaseCtx extends HubAIContext {
  supabase: unknown;
}

export interface SupabaseKeyResolverOptions {
  /** Profiles table. Default "profiles". */
  table?: string;
  /** Profile id column. Default "id". */
  idColumn?: string;
  /** JSONB settings column holding the personal key. Default "settings". */
  settingsColumn?: string;
  /** Field within settings holding the key. Default "claude_api_key". */
  keyField?: string;
  /** Env var for the shared fallback key. Default "ANTHROPIC_API_KEY". */
  fallbackEnv?: string;
}

// Personal-key-then-shared chain: a per-user key from profiles.settings, else the
// shared env key. Reads `ctx.supabase`; never creates its own client.
export function supabaseKeyResolver<C extends SupabaseCtx>(
  opts?: SupabaseKeyResolverOptions
): ApiKeyResolver<C> {
  const table = opts?.table ?? "profiles";
  const idColumn = opts?.idColumn ?? "id";
  const settingsColumn = opts?.settingsColumn ?? "settings";
  const keyField = opts?.keyField ?? "claude_api_key";
  const fallbackEnv = opts?.fallbackEnv ?? "ANTHROPIC_API_KEY";

  return async (ctx) => {
    const sb = ctx.supabase as AnySupabase;
    const { data } = await sb
      .from(table)
      .select(settingsColumn)
      .eq(idColumn, ctx.userId)
      .single();
    const settings = (data as Record<string, unknown> | null)?.[settingsColumn] as
      | Record<string, unknown>
      | undefined;
    const personal = settings?.[keyField];
    const envKey =
      typeof process !== "undefined" ? process.env?.[fallbackEnv] : undefined;
    return (typeof personal === "string" && personal) || envKey || undefined;
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextResolver } from "../core/types";

export interface SupabaseIdentityOptions {
  /** Profiles table. Default "profiles". */
  profilesTable?: string;
  /** Profile id column. Default "id". */
  idColumn?: string;
  /** Organization id column. Default "organization_id". */
  orgColumn?: string;
}

// Build a ContextResolver from a host-supplied client factory. The host keeps its
// own cookie/auth wiring (e.g. Next `createClient()`); this packages the
// getUser -> profile -> context shape. Returns null (-> 401) when unauthenticated.
export function supabaseContextResolver<S = SupabaseClient>(
  getClient: (req: Request) => S | Promise<S>,
  opts?: SupabaseIdentityOptions
): ContextResolver<{ supabase: S; userId: string; orgId: string }> {
  const table = opts?.profilesTable ?? "profiles";
  const idColumn = opts?.idColumn ?? "id";
  const orgColumn = opts?.orgColumn ?? "organization_id";

  return async (req) => {
    const client = await getClient(req);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = client as any;
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;

    const { data: profile } = await sb
      .from(table)
      .select(orgColumn)
      .eq(idColumn, user.id)
      .single();
    const orgId =
      ((profile as Record<string, unknown> | null)?.[orgColumn] as string) ?? "";

    return { supabase: client, userId: user.id, orgId };
  };
}

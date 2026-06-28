import { H as HubAIContext, R as RateLimiter, A as ApiKeyResolver, d as ContextResolver } from '../types-TSdO-PR8.js';
import { SupabaseClient } from '@supabase/supabase-js';
import '@anthropic-ai/sdk/resources/messages';

interface SupabaseCtx$1 extends HubAIContext {
    supabase: unknown;
}
interface SupabaseRateLimiterOptions {
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
declare function supabaseRateLimiter<C extends SupabaseCtx$1>(opts: SupabaseRateLimiterOptions): RateLimiter<C>;

interface SupabaseCtx extends HubAIContext {
    supabase: unknown;
}
interface SupabaseKeyResolverOptions {
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
declare function supabaseKeyResolver<C extends SupabaseCtx>(opts?: SupabaseKeyResolverOptions): ApiKeyResolver<C>;

interface SupabaseIdentityOptions {
    /** Profiles table. Default "profiles". */
    profilesTable?: string;
    /** Profile id column. Default "id". */
    idColumn?: string;
    /** Organization id column. Default "organization_id". */
    orgColumn?: string;
}
declare function supabaseContextResolver<S = SupabaseClient>(getClient: (req: Request) => S | Promise<S>, opts?: SupabaseIdentityOptions): ContextResolver<{
    supabase: S;
    userId: string;
    orgId: string;
}>;

export { type SupabaseIdentityOptions, type SupabaseKeyResolverOptions, type SupabaseRateLimiterOptions, supabaseContextResolver, supabaseKeyResolver, supabaseRateLimiter };

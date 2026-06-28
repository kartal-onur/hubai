// Map raw provider errors to a safe, human-readable message. Never leak raw
// provider/DB error text or stack traces to the client by default; the raw error
// is logged server-side instead.
export function mapAnthropicError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const isAuth =
    raw.includes("authentication_error") || raw.includes("invalid x-api-key");
  if (isAuth) {
    return "The AI service is unavailable (invalid API key). Please contact your administrator.";
  }
  if (typeof console !== "undefined") console.error("[hubai] error:", raw);
  return "An unexpected error occurred. Please try again.";
}

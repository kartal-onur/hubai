// Map raw provider errors to a safe, human-readable message. Never leak raw
// `invalid x-api-key ...` text or stack traces to the client by default.
export function mapAnthropicError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const isAuth =
    raw.includes("authentication_error") || raw.includes("invalid x-api-key");
  if (isAuth) {
    return "The AI service is unavailable (invalid API key). Please contact your administrator.";
  }
  return `An error occurred: ${raw}`;
}

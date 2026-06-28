# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-06-29

### Changed

- Distribution: the repo is public and the supported install path is the git URL (`npm i github:kartal-onur/hubai#v0.1.2`), which needs no token. GitHub Packages requires a token to install even public packages, so it is no longer the recommended path for token-free CI (e.g. Netlify).
- `dist/` is now committed so git-URL installs work with no build step on the consumer (`files` still limits the published/packed set to `dist`).

## [0.1.1] - 2026-06-29

### Fixed

- **Core**: a throwing tool no longer kills the stream. Tool failures are returned to the model as an `is_error` tool_result so it can recover, keeping the conversation valid.
- **Core**: assistant text emitted alongside a tool call is now streamed to the client (previously only terminal-turn text was streamed).
- **Core**: client disconnect now aborts the in-flight Anthropic call and stops the loop (request `signal` threaded through; ReadableStream `cancel` handler) so abandoned requests stop wasting tokens and stop running write-action side effects.
- **Core**: `handleRequest` wraps the whole pipeline; adapter/system failures return a generic 500 instead of leaking raw errors or breaking the documented status contract.
- **Core**: `mapAnthropicError` no longer interpolates raw provider/DB error text into the client message; the raw error is logged server-side and a generic message is returned.
- **React**: `clear()` now aborts an in-flight stream and the refresh callback no longer fires after a clear; the panel disables Clear while streaming.
- **React**: empty-content assistant turns (pure tool/navigate turns) are filtered from the API payload and from persistence, preventing a 400 on the next message.
- **React**: changing `storageKey` at runtime no longer writes the previous key's messages into the new key.
- **Supabase**: the rate limiter now fails closed on a query error instead of silently allowing the request.
- **React**: malformed SSE frames are reported (`console.warn`) instead of being silently dropped.

## [0.1.0] - 2026-06-29

### Added

- Initial release, extracted from Globalmeta WorkHub.
- `@kartal-onur/hubai/core`: framework-agnostic engine with a Web-standard `createHubAI().handleRequest(req)`, the SSE event contract (`text`, `tool_status`, `link`, `refresh`, `error`, `[DONE]`), `defineTool`, and `createNavigateTool`. Anthropic `baseURL` pinning, prompt caching on the system prefix, configurable model / tool-loop limit, and friendly error mapping.
- `@kartal-onur/hubai/react`: headless `useHubAI` hook plus themable `<HubAIChat>`, `<HubAIIntroDialog>`, and `<HubAIKeySettings>`. CSS-variable theming, per-slot `classNames`, injectable icons and labels, router-agnostic navigation, localStorage history, and optional `styles.css`.
- `@kartal-onur/hubai/supabase`: `supabaseContextResolver`, `supabaseKeyResolver` (per-user key from `profiles.settings`, env fallback), and `supabaseRateLimiter` (sliding window over a usage table).

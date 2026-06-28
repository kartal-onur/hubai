# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-29

### Added

- Initial release, extracted from Globalmeta WorkHub.
- `@kartal-onur/hubai/core`: framework-agnostic engine with a Web-standard `createHubAI().handleRequest(req)`, the SSE event contract (`text`, `tool_status`, `link`, `refresh`, `error`, `[DONE]`), `defineTool`, and `createNavigateTool`. Anthropic `baseURL` pinning, prompt caching on the system prefix, configurable model / tool-loop limit, and friendly error mapping.
- `@kartal-onur/hubai/react`: headless `useHubAI` hook plus themable `<HubAIChat>`, `<HubAIIntroDialog>`, and `<HubAIKeySettings>`. CSS-variable theming, per-slot `classNames`, injectable icons and labels, router-agnostic navigation, localStorage history, and optional `styles.css`.
- `@kartal-onur/hubai/supabase`: `supabaseContextResolver`, `supabaseKeyResolver` (per-user key from `profiles.settings`, env fallback), and `supabaseRateLimiter` (sliding window over a usage table).

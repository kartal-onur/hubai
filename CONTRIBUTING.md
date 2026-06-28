# Contributing

Internal Globalmeta package. These are the working rules for the repo.

## Setup

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsup -> dist/ (ESM + d.ts) + styles.css + "use client"
npm run dev         # tsup --watch
```

Node 20. The build emits ESM only; the "use client" directive for the react
entry is re-added by `scripts/add-use-client.mjs` after bundling (esbuild strips
module-level directives).

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
`refactor:`, `docs:`, `chore:`, `test:`. Keep code and comments in English.

## Versioning and releases

Semantic Versioning. Every version is a commit and a tag. Distribution is the
public GitHub source tarball pinned to a tag (consumers install
`https://github.com/kartal-onur/hubai/archive/refs/tags/vX.Y.Z.tar.gz`), so a
release just needs the built `dist` committed at the tag — no registry publish.

1. Update `CHANGELOG.md` (move items under a new version heading).
2. Bump and tag in one step:
   ```bash
   npm version patch   # or minor / major -> updates package.json, commits, tags vX.Y.Z
   ```
   Before bumping, run `npm run build` and commit `dist` (it is tracked, so the
   tag contains ready-to-consume output).
3. Push commit and tag:
   ```bash
   git push origin main --follow-tags
   ```
4. Bump every consumer's pinned tarball URL to the new tag.

Patch: bug fix, no API change. Minor: backward-compatible additions. Major:
breaking changes to the public API or the SSE contract.

## Testing changes against a consumer (before tagging)

```bash
npm run build
npm pack                       # -> kartal-onur-hubai-<version>.tgz
# in the consumer app:
npm install ../hubai/kartal-onur-hubai-<version>.tgz
```

Once tagged, point the consumer at the tarball URL for that tag.

## Design rules

- The core stays framework-agnostic: no `next`, no `@supabase/*`, no DOM-only globals beyond the universal Fetch/Streams set.
- The SSE event shapes are the public contract. Changing them is a breaking change. The types live once in `src/core/sse.ts` and are imported by the react entry.
- Keep tools returning a plain string so non-AI callers can reuse executors.
- Prefer adding behavior through config and per-tool flags (`emitLink`, `refreshOnSuccess`, `redactSummary`) over special-casing names in the engine.

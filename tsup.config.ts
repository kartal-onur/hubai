import { defineConfig } from "tsup";

// ESM only (every target host is ESM: Next 16/Turbopack, Netlify Functions v2).
// Peer deps are externalized so consumers keep a single copy of each.
// The "use client" directive for the react entry is added by a post-build step
// (scripts/add-use-client.mjs) because esbuild strips module-level directives
// when bundling.
export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "react/index": "src/react/index.ts",
    "supabase/index": "src/supabase/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2021",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@anthropic-ai/sdk",
    "@supabase/supabase-js",
  ],
});

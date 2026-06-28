// Prepend the "use client" directive to the bundled react entry. esbuild strips
// module-level directives when bundling, so we re-add it deterministically here.
import { readFile, writeFile } from "node:fs/promises";

const FILE = "dist/react/index.js";
const DIRECTIVE = '"use client";';

const src = await readFile(FILE, "utf8");
if (!src.startsWith(DIRECTIVE)) {
  await writeFile(FILE, `${DIRECTIVE}\n${src}`);
  console.log(`[hubai] prepended "use client" to ${FILE}`);
} else {
  console.log(`[hubai] "use client" already present in ${FILE}`);
}

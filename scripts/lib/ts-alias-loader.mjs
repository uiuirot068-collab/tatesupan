// Minimal ESM resolve hook so standalone verifier scripts can `import` the
// project's TypeScript source directly (Node 24 strips types natively) while
// still resolving the tsconfig `@/*` -> `src/*` path alias those files use.
// Registered via `node --import ./scripts/lib/register-ts-alias.mjs <script>`.
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC_ROOT = pathToFileURL(path.resolve(import.meta.dirname, "../../src") + "/").href;

const withTsExtension = (specifier) => (/\.[a-zA-Z0-9]+$/.test(specifier) ? specifier : `${specifier}.ts`);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = SRC_ROOT + withTsExtension(specifier.slice(2));
    return nextResolve(target, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts")) {
    return nextResolve(withTsExtension(specifier), context);
  }
  return nextResolve(specifier, context);
}

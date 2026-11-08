import { createRequire, registerHooks } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Match Next.js's @/* alias when Node runs the compiled planning tests.
const outputRoot = fileURLToPath(new URL("../.test-build/src/", import.meta.url));
const resolveModule = createRequire(import.meta.url).resolve;
registerHooks({
  resolve(specifier, context, nextResolve) {
    // Unit tests execute server handlers outside Next's server-only alias.
    if (specifier === "server-only") {
      return nextResolve(resolveModule("next/dist/compiled/server-only/empty.js"), context);
    }
    const mapped = specifier.startsWith("@/")
      ? resolveModule(resolve(outputRoot, specifier.slice(2))) : specifier;
    return nextResolve(mapped, context);
  },
});

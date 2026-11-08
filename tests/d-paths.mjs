import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Resolve source imports in D tests without changing application tsconfig or C's runner.
const root = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = specifier.startsWith("@/") ? new URL(specifier.slice(2), root)
      : specifier.startsWith(".") && context.parentURL ? new URL(specifier, context.parentURL) : null;
    if (url?.protocol === "file:" && !extname(url.pathname)) {
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        const path = fileURLToPath(url) + suffix;
        if (existsSync(path)) return nextResolve(pathToFileURL(path).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

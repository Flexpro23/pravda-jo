import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const ROOT = pathToFileURL(process.cwd() + '/');
/** Resolve the "@/..." tsconfig path alias, which bare Node knows nothing about. */
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) {
    const base = new URL(spec.slice(2), ROOT);
    for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
      const u = new URL(base.href + ext);
      if (existsSync(u)) return next(u.href, ctx);
    }
  }
  return next(spec, ctx);
}

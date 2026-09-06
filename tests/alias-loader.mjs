import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const ROOT = pathToFileURL(process.cwd() + '/');
const EXTS = ['', '.ts', '.tsx', '/index.ts'];

function withExtension(base) {
  for (const ext of EXTS) {
    const u = new URL(base.href + ext);
    if (existsSync(u)) return u.href;
  }
  return null;
}

/**
 * Resolve the "@/..." tsconfig path alias, which bare Node knows nothing
 * about — and resolve a plain relative import missing its extension
 * (`./num` for `./num.ts`), which `moduleResolution: "bundler"` allows in
 * source but Node's own ESM resolver rejects. Only the second case falls
 * back to trying extensions; an import that already resolves (a `.ts` file,
 * a real asset) is left untouched.
 */
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) {
    const hit = withExtension(new URL(spec.slice(2), ROOT));
    if (hit) return next(hit, ctx);
  } else if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL) {
    const base = new URL(spec, ctx.parentURL);
    if (!existsSync(base)) {
      const hit = withExtension(base);
      if (hit) return next(hit, ctx);
    }
  }
  return next(spec, ctx);
}

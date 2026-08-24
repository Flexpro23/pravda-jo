import { notFound } from 'next/navigation';

/**
 * Any path under a locale that matches no real route. Without this, an unknown
 * URL escapes the locale tree entirely and Next serves its own unstyled 404
 * instead of the one in this folder. Named routes are matched first.
 */
/* Rendered per request so the response carries a real 404 rather than a
   prerendered page served with 200. */
export const dynamic = 'force-dynamic';

export default function CatchAll(): never {
  notFound();
}

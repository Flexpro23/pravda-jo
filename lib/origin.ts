import { SITE } from '@/lib/data/company';

/**
 * Where the caller actually is, as a URL origin.
 *
 * On App Hosting the request that reaches a route handler carries the
 * container's own address — `req.url` is `http://0.0.0.0:8080/...` — so a
 * redirect or a link built from it sends a browser, or a provider reading a
 * WhatsApp message, to an address that exists only inside Cloud Run. The
 * public host travels in the proxy's forwarding headers instead, and locally,
 * where there is no proxy, in the plain Host header.
 *
 * Order: the forwarded host and scheme, then the Host header (https unless it
 * is plainly a local address), then the configured site as the last resort —
 * never `req.url`.
 */
export function publicOrigin(req: Request): string {
  const h = (k: string) => req.headers.get(k)?.split(',')[0]?.trim() || '';
  const host = h('x-forwarded-host') || h('host');
  if (!host) return SITE;
  const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(host);
  const proto = h('x-forwarded-proto') || (local ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** An absolute URL for a path on this deployment, for a redirect or a message. */
export const absolute = (req: Request, path: string) =>
  new URL(path, publicOrigin(req)).toString();

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The operator console's lock.
 *
 * The same OPERATOR_KEY guards the API, but a browser cannot send a bearer
 * header on a navigation, so the key is exchanged once for a cookie. What that
 * cookie carries used to be `sha256(OPERATOR_KEY)` — one constant value, shared
 * by every session ever opened, valid forever server-side because `maxAge` is
 * only a hint to the browser, and revocable only by rotating the key itself.
 *
 * It is now a minted, dated session: `v1.<issuedAtMs>.<hmac>`. Each sign-in
 * produces a different value, so a session rotates by construction; the age is
 * signed, so the server enforces the TTL rather than trusting the browser to
 * forget; and the signature is over the date alone, so the cookie is not a
 * credential anywhere else — a leaked one opens the console until it expires
 * and nothing more.
 *
 * Revocation is bumping `SESSION_SECRET` (or, absent one, rotating
 * `OPERATOR_KEY`): every outstanding session fails its next verification. That
 * is the whole mechanism, and it is worth knowing before it is needed.
 */
export const OPS_COOKIE = 'pravda_ops';

/**
 * What a refused attempt leaves behind for the gate to read.
 *
 * The gate is rendered by `app/ops/layout.tsx`, and a layout cannot read a
 * query string — so `?bad=1` never reaches it. The two things a refused attempt
 * has to carry forward, that it was refused and which page was being asked for,
 * ride on a ten-second cookie instead. Short enough that it cannot outlive the
 * redirect it exists for; long enough to survive one slow page load.
 */
export const OPS_RETRY_COOKIE = 'pravda_ops_retry';

/**
 * Thirty days, enforced here rather than in the browser.
 *
 * Twelve hours was the old `maxAge`, and it meant fishing a long random key out
 * of a password manager on a phone most mornings — which is how a console stops
 * being opened at all. A month is the honest trade for a surface that is read
 * by two people from their own phones.
 */
export const OPS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Past this age a session is re-minted on the next sign-in, so a console in
 * daily use never reaches the thirty-day wall.
 *
 * The rolling window is deliberately partial. `opsAuthed()` runs inside a
 * server component, which cannot set a cookie, so the one place a fresh value
 * can actually be written today is a route handler — the login route. A truly
 * rolling session needs middleware to re-stamp the cookie on ordinary
 * navigation; that is wave 2, and until it lands a session that goes untouched
 * for thirty days expires and asks for the key once.
 */
const OPS_REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const key = () => process.env.OPERATOR_KEY?.trim() ?? '';

/**
 * What signs a session. `SESSION_SECRET` when it is set, so that rotating the
 * console's key — an operator leaving, a suspected leak — is a separate act
 * from invalidating sessions, and so that neither one signs every provider out
 * of their portal on the morning of a shoot. `OPERATOR_KEY` is the fallback so
 * nothing breaks on the day the variable is introduced.
 */
const secret = () =>
  (process.env.SESSION_SECRET || process.env.OPERATOR_KEY || '').trim();

const sign = (issuedAt: number) =>
  createHmac('sha256', secret()).update(`ops:v1:${issuedAt}`).digest('hex').slice(0, 32);

const same = (a: string, b: string) => {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

/**
 * Both sides trimmed. A key piped in from `openssl rand -base64 32` carries the
 * trailing newline openssl emits, while every shell that reads it back strips
 * one — so an operator pasting a key that is correct to the eye would be
 * rejected on an invisible byte.
 */
export const keyMatches = (candidate: string) => same(candidate.trim(), key());

/** A fresh session. `issuedAt` is a seam for the tests, never for a caller. */
export const mintSession = (issuedAt: number = Date.now()) =>
  `v1.${issuedAt}.${sign(issuedAt)}`;

/** The date a session claims, or null if it does not parse as one. */
function issuedAtOf(raw: string): number | null {
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  if (!/^\d{10,15}$/.test(parts[1])) return null;
  return Number(parts[1]);
}

/**
 * Is this a session this deployment minted, and is it still inside its window?
 *
 * Order matters only for cost, not for safety: the signature covers the date,
 * so an edited `issuedAt` fails the comparison regardless of how old it claims
 * to be. Sixty seconds of tolerance on a future date absorbs clock skew between
 * two Cloud Run instances; anything further ahead is not something we minted.
 */
export function verifySession(raw: string): boolean {
  if (!secret()) return false;
  const issuedAt = issuedAtOf(raw);
  if (issuedAt === null) return false;

  const age = Date.now() - issuedAt;
  if (age < -60_000 || age >= OPS_TTL_MS) return false;

  return same(raw.split('.')[2], sign(issuedAt));
}

/**
 * A newer cookie value when the held one has aged past the refresh mark, or
 * null when it has not (and null when it does not verify — a session that is
 * not ours is not extended, it is refused elsewhere).
 */
export function refreshedCookie(raw: string): string | null {
  if (!verifySession(raw)) return null;
  const issuedAt = issuedAtOf(raw);
  if (issuedAt === null) return null;
  return Date.now() - issuedAt >= OPS_REFRESH_AFTER_MS ? mintSession() : null;
}

/**
 * Is the caller holding a valid console session?
 *
 * Signature unchanged from the digest era, so every caller — seven pages' worth
 * of gate, now one layout, and every ops API route — is untouched by the change
 * underneath it.
 *
 * `next/headers` is imported here rather than at the top of the file because
 * Node's own resolver cannot load it (no export map, no extension), and this
 * module's format functions are worth unit-testing without a Next runtime
 * around them. Nothing else in here touches a request.
 */
export async function opsAuthed(): Promise<boolean> {
  if (!key() || !secret()) return false;   // unset means closed, never open
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  return verifySession(jar.get(OPS_COOKIE)?.value ?? '');
}

/**
 * A destination we are willing to send someone to after they sign in.
 *
 * Only a path, only inside the console, and never a protocol-relative one —
 * `//evil.example/x` is a same-origin-looking string that browsers treat as an
 * absolute URL, which is exactly how an open redirect is built. Anything that
 * fails becomes `/ops`, because a deep link is a convenience and the queue is
 * always a correct answer.
 */
export function opsNext(raw: string): string {
  const s = (raw ?? '').trim();
  if (!s.startsWith('/ops') || s.startsWith('//') || s.includes('\\')) return '/ops';
  // A path only: a query or fragment carried through the gate has no meaning
  // to any console page and is one more thing to have to trust.
  const path = s.split(/[?#]/)[0];
  return /^\/ops(\/[A-Za-z0-9._~\-/[\]@%]*)?$/.test(path) ? path : '/ops';
}

/**
 * Was this request made from our own pages?
 *
 * `sameSite: 'lax'` already blocks a cross-site POST from carrying the cookie,
 * so this is the second lock rather than the first — explicit, cheap, and it
 * survives a future change to the cookie's attributes. `Sec-Fetch-Site` is the
 * browser's own account of where a request came from and cannot be set by page
 * script; `none` is a typed address or a bookmark, which is same-origin enough
 * for a form post. Where that header is absent (an older browser, curl) the
 * `Origin` host has to match instead.
 *
 * A request carrying neither header is not a browser, and a non-browser client
 * cannot be tricked into forging one on a victim's behalf — which is the only
 * thing this check exists to stop. It passes.
 */
export function sameOrigin(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site === 'same-origin' || site === 'none') return true;

  const origin = req.headers.get('origin');
  if (!origin) return site === null;   // no Sec-Fetch-Site and no Origin: not a browser

  let host: string;
  try { host = new URL(origin).host; } catch { return false; }

  // Behind Cloud Run's proxy the request's own URL is rebuilt from headers, so
  // compare against every host the hop could reasonably be describing.
  const candidates = new Set<string>();
  for (const h of [req.headers.get('x-forwarded-host'), req.headers.get('host')]) {
    if (h) candidates.add(h.split(',')[0].trim());
  }
  try { candidates.add(new URL(req.url).host); } catch { /* a relative req.url is not a host */ }

  return candidates.has(host);
}

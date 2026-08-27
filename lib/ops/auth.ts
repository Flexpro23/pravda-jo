import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * The operator console's lock.
 *
 * The same OPERATOR_KEY guards the API, but a browser cannot send a bearer
 * header on a navigation, so the key is exchanged once for a cookie. The cookie
 * holds a SHA-256 of the key rather than the key: a console session is then
 * useless for calling the API directly, and a leaked cookie cannot be replayed
 * as a credential anywhere else.
 */
export const OPS_COOKIE = 'pravda_ops';

const key = () => process.env.OPERATOR_KEY?.trim() ?? '';

/** The value a valid session cookie must carry. */
export const digest = () =>
  key() ? createHash('sha256').update(key()).digest('hex') : '';

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

/** Is the caller holding a valid console session? */
export async function opsAuthed(): Promise<boolean> {
  if (!key()) return false;              // unset means closed, never open
  const jar = await cookies();
  return same(jar.get(OPS_COOKIE)?.value ?? '', digest());
}

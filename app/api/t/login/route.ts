import { NextResponse } from 'next/server';
import { talentByCode } from '@/lib/store/deals';
import { T_COOKIE, T_TTL_MS, epochOf, sessionValue } from '@/lib/talent/auth';
import { sameOrigin } from '@/lib/ops/auth';
import { clientIp, hit, ipKey } from '@/lib/store/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `talentByCode` matches a submitted code against the *whole roster*, so a
 * guesser is not attacking one named provider — they are attacking all of them
 * at once, and any hit exposes somebody's dates, briefs and locations. Against
 * the six-digit codes this started with, a roster of thirty meant an expected
 * thirty-three thousand guesses: at five a second, under two hours of
 * unattended traffic.
 *
 * Four things answer that, and the arithmetic only works with all four. New
 * codes are eight digits (`newPassCode`), which is a hundredfold. Five attempts
 * per address per ten minutes. Twenty a minute across every address, which is
 * the cap that matters because the per-IP one is only as good as the number of
 * addresses an attacker can rent. And a fixed one-and-a-half-second wait before
 * *every* refusal — not only the throttled ones.
 *
 * That last one is the change that costs a real provider something, and it is
 * deliberate. A wrong code that comes back instantly and a throttled one that
 * comes back slowly are two distinguishable responses, and a script tunes
 * itself against the difference: it learns exactly how fast it may go. One
 * identical, slow answer to every failure teaches it nothing, and caps an
 * attacker at well under one guess a second per address whatever the counter
 * says. A person who mistyped their code waits a second and a half once.
 *
 * Both counters fail closed. A rate limiter that answers "sure, go ahead" when
 * the store is unreachable is not a rate limiter, and this is the one endpoint
 * where the thing being protected is somebody else's account rather than our
 * own convenience.
 */
const LOCKOUT_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Six to eight digits. Eight is what `newPassCode` now mints; six-digit codes
 * already handed out stay valid, because reissuing every provider's code to
 * close a gap they cannot see is a morning of WhatsApp messages and a shoot
 * day somebody cannot sign in for.
 */
const CODE_SHAPE = /^\d{6,8}$/;

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'origin' }, { status: 403 });
  }

  const bad = () => NextResponse.redirect(new URL('/t?bad=1', req.url), 303);

  const ip = clientIp(req);
  const [perIp, global] = await Promise.all([
    hit(`${ipKey(ip)}:t`, 5, 600_000, { failClosed: true }),
    hit('t-login:global', 20, 60_000, { failClosed: true }),
  ]);

  if (!perIp.ok || !global.ok) {
    // The global cap tripping is not one impatient provider; it is worth
    // Khaled's attention, so it says so in the logs where the per-IP cap does
    // not.
    if (!global.ok) console.warn(JSON.stringify({ at: 't-login.global-cap' }));
    await sleep(LOCKOUT_MS);
    return bad();
  }

  const form = await req.formData().catch(() => null);
  const code = String(form?.get('code') ?? '').trim();

  // Shape-checked before the roster is read, so a submission that could not be
  // anybody's code costs no Firestore read — and still costs the attacker the
  // same second and a half as a well-formed guess.
  const t = CODE_SHAPE.test(code) ? await talentByCode(code) : null;
  if (!t) {
    // Every wrong code waits, not only a throttled one. Never back to
    // `/t?code=…` either: the gate auto-submits a code it is given, and a wrong
    // one would then submit itself forever.
    await sleep(LOCKOUT_MS);
    return bad();
  }

  const res = NextResponse.redirect(new URL('/t', req.url), 303);
  res.cookies.set(T_COOKIE, sessionValue(t.id, epochOf(t)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Long: this is a phone kept in a pocket, not a desk someone walks away
    // from, and a provider re-entering a code before every shoot would stop
    // using it. The server enforces the same span independently.
    maxAge: Math.floor(T_TTL_MS / 1000),
  });
  return res;
}

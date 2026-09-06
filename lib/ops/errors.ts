/**
 * Every error string the console can be handed, said the way a person needs it.
 *
 * The routes answer machines: `unreadable`, `placeholder-cast`, `conflict`.
 * Each of those is a precise fact and none of them is a sentence, and until
 * now each screen invented its own translation — `RunHandle` had a good one for
 * the seven read failures and everywhere else printed `Failed: ${j.error}`,
 * which is a stack trace wearing a coat.
 *
 * One table, so a message written once is the message everywhere. Anything not
 * on it falls through to a sentence that at least admits what happened rather
 * than pretending it did not.
 */

export const EXPLAIN: Record<string, string> = {
  // ── the read ──────────────────────────────────────────────────────────────
  unreadable:
    'Could not read that account. Personal, misspelled, renamed and deleted all '
    + 'return the same error from Meta, so there is no way to tell which.',
  'too-few-posts':
    'Too few posts to say anything defensible. Nothing was stored.',
  'no-data':
    'The account reports posts but returned none — that is our token, not their '
    + 'account. Check whether it has passed data_access_expires_at.',
  unauthorised:
    'Meta refused our token. Check it is the Pravda app token, not the Wasla one.',
  throttled: 'Meta’s hourly budget is nearly spent. Try again shortly.',
  network: 'Meta did not answer. Try again; if it repeats, check the Graph status.',
  handle: 'That is not a valid Instagram handle.',

  // ── the session ───────────────────────────────────────────────────────────
  unauthenticated: 'The console session expired. Reload and sign in again.',
  origin: 'That request did not come from this console. Reload the page and try again.',

  // ── the sheet ─────────────────────────────────────────────────────────────
  'pick-three': 'Choose exactly three ideas first.',
  'no-offer': 'Set the offer first — videos and a price per video.',
  'not-approved': 'Approve it and send it before marking it won.',
  'approved-locked': 'This sheet is approved and its link is live. Reopen it before changing anything.',
  settled: 'This account is already won or lost; a re-read would only confuse the record.',
  'placeholder-cast':
    'One of the people cast is a worked example, not a person. Change the cast '
    + 'before sending this.',
  'uncastable-chosen':
    'One of the three ideas has nobody on the roster who can shoot it. Cast it '
    + 'by hand, or choose a different idea.',
  'bad-vertical': 'That is not a vertical the library knows.',
  'bad-cast':
    'One of those people cannot be booked — inactive, no day rate, a worked '
    + 'example, or the wrong discipline for that slot. Nothing was changed.',
  uncastable:
    'One of the three ideas has nobody behind it. Fix the cast on the sheet '
    + 'before turning it into a job.',

  // ── bookings and people ───────────────────────────────────────────────────
  placeholder: 'That is a placeholder person, not somebody who can be booked.',
  inactive: 'That person is not active on the roster.',
  'no-talent': 'No such person on the roster.',
  conflict: 'They already have a day booked on that date.',
  'illegal-transition': 'A booking cannot move there from where it is.',

  // ── the plumbing ──────────────────────────────────────────────────────────
  'not-found': 'That record is gone, or the address is wrong.',
  malformed: 'Something in that form was not a value this accepts.',
  empty: 'There was nothing to save.',
  'unknown-action': 'The console asked for something this route does not do.',
  'unknown-status': 'That is not a status this record can take.',
  'unknown-event': 'That is not a notice this account can be sent.',
  'client-name': 'A deal needs a client name.',
  gone: 'That part of the console has been retired.',
};

/**
 * The sentence for a route response.
 *
 * Prefers the route's own `message` where it wrote one — the booking route
 * composes a better clash line than any table could, because it knows the date
 * — then the table, then an honest fallback that still names the code so it
 * can be searched for.
 */
export function explain(
  error: unknown,
  fallbackOrBody?: string | { message?: string; hint?: string; detail?: string },
): string {
  const key = typeof error === 'string' ? error : '';
  const body = typeof fallbackOrBody === 'object' ? fallbackOrBody : null;
  // The route's own sentence wins where it wrote one: the booking route names
  // the date of the clash, which no table indexed by error code ever could.
  const base = body?.message
    ?? EXPLAIN[key]
    ?? body?.hint
    ?? (typeof fallbackOrBody === 'string' ? fallbackOrBody : null)
    ?? (key
      ? `That did not work, and the reason it gave was “${key}”.`
      : OFFLINE);
  // `detail` is the particular — which person, which concept. Appended rather
  // than substituted, because the sentence says what to do and the detail says
  // where, and an operator needs both.
  return body?.detail && !base.includes(body.detail) ? `${base} (${body.detail})` : base;
}

/** The same, for a fetch that never came back at all. */
export const OFFLINE = 'The request did not complete.';

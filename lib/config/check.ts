/**
 * What this deployment is actually configured to do.
 *
 * Every fallback in this codebase is buried in the module that reads it — the
 * site URL in `company.ts`, the operator's number in `operator.ts`, the Graph
 * version in `discovery.ts` — and each one is individually sensible. Together
 * they mean a misconfigured production deploy is invisible: no variable is
 * missing loudly, the system simply behaves as though nobody wants to be told
 * anything, and the first person to notice is a prospect whose read failed.
 *
 * So this reports presence, and nothing else. Never a value, never a prefix,
 * never a length, never a hash — a console panel that shows the first four
 * characters of a token is a console panel that leaks a token over somebody's
 * shoulder. `present: false` and a sentence naming exactly what breaks is the
 * whole contract, and it is enough to fix any row on this list.
 */

export type Severity = 'critical' | 'degraded' | 'optional';

export type ConfigRow = {
  key: string;
  present: boolean;
  severity: Severity;
  /** What stops working, in the operator's terms rather than the code's. */
  whatBreaks: string;
};

const has = (k: string) => !!process.env[k]?.trim();

/**
 * A Firestore project id from any of the places one can legitimately come from.
 * App Hosting sets `GOOGLE_CLOUD_PROJECT`; a developer machine supplies a
 * service-account JSON; a test run points at the emulator. Without one of them
 * the Admin SDK either fails or — worse — quietly reads some unrelated project
 * a stale `gcloud` login left behind.
 */
const projectResolvable = () =>
  has('GOOGLE_CLOUD_PROJECT') || has('GCLOUD_PROJECT') || has('FIREBASE_PROJECT_ID')
  || has('FIREBASE_SERVICE_ACCOUNT') || has('FIRESTORE_EMULATOR_HOST');

/**
 * Whether the classifier can reach Gemini at all, by either route.
 *
 * Mirrors `backend()` in lib/teardown/classify.ts rather than importing it, so
 * that a config panel — which runs in a request that has no business loading
 * the Google SDK — stays free of that dependency. The two must agree; the
 * shared rule is that an API key wins when set, and Vertex answers otherwise
 * from a project id that is not the Firestore emulator's.
 */
export const geminiConfigured = (): boolean => {
  if (process.env.GEMINI_API_KEY?.trim()) return true;
  const p = (process.env.VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '').trim();
  return !!p && !p.endsWith('-local');
};

/** Is there any way at all for the system to reach a human by itself? */
export const anyNotifyChannel = () =>
  (has('WHATSAPP_TOKEN') && has('WHATSAPP_PHONE_ID'))
  || (has('TELEGRAM_BOT_TOKEN') && has('TELEGRAM_CHAT_ID'))
  || (has('RESEND_API_KEY') && has('NOTIFY_EMAIL_TO') && has('NOTIFY_EMAIL_FROM'));

export function configReport(): ConfigRow[] {
  const row = (key: string, severity: Severity, whatBreaks: string, present = has(key)): ConfigRow =>
    ({ key, present, severity, whatBreaks });

  return [
    // ── without these, something is plainly broken ──────────────────────────
    row('OPERATOR_KEY', 'critical',
      'The console is closed to everyone. Unset means closed, never open.'),
    row('META_ACCESS_TOKEN', 'critical',
      'Every read fails as “unauthorised”. No teardown can be produced.'),
    row('META_IG_USER_ID', 'critical',
      'Business Discovery has nobody to authenticate as. Every read fails.'),
    row('GOOGLE_CLOUD_PROJECT', 'critical',
      'No Firestore project resolves — leads cannot be written or read.',
      projectResolvable()),

    // ── these work, but not the way anyone would want ───────────────────────
    {
      // Two ways to reach Gemini and either will do, so the row reports the
      // capability rather than a variable — a `GEMINI_API_KEY` row would read
      // as missing on the deployment that is correctly using Vertex and needs
      // no key at all.
      key: 'GEMINI_BACKEND',
      present: geminiConfigured(),
      severity: 'degraded',
      whatBreaks:
        'The trade is guessed by keyword list instead of read from the captions. '
        + 'Reads still succeed and the shortlist is still produced, but a business '
        + 'whose words are not in the lexicon gets no guess and no explanation — '
        + 'and nothing can tell you a business is outside the nine trades entirely.',
    },
    {
      key: 'NOTIFY_CHANNEL',
      present: anyNotifyChannel(),
      severity: 'degraded',
      whatBreaks:
        'No notification channel is configured — nothing will reach you automatically. '
        + 'Leads are still written and the console still composes every message for a human to send.',
    },
    row('STORAGE_BUCKET', 'degraded',
      'The talent library cannot hold photos. Profiles, comp cards and consents still save; '
      + 'uploading says photos are not configured.'),
    row('OPERATOR_PHONE', 'degraded',
      'Even the manual fallback has no destination: there is no wa.me link to tap.'),
    row('NEXT_PUBLIC_SITE_URL', 'degraded',
      'Every link in every message, every canonical URL and the sitemap fall back to the default origin.'),
    row('CRON_SECRET', 'degraded',
      'The read sweeper is closed, so a read is only best-effort: a lead whose instance died stays stuck.'),
    row('SESSION_SECRET', 'degraded',
      'Console sessions are signed with OPERATOR_KEY instead, so revoking a session means rotating the console key.'),

    // ── nice to have, and honest about being absent ────────────────────────
    row('TELEGRAM_BOT_TOKEN', 'optional',
      'The recommended operator channel is off. Needs TELEGRAM_CHAT_ID too.'),
    row('TELEGRAM_CHAT_ID', 'optional', 'Telegram has no chat to post into.'),
    row('WHATSAPP_TOKEN', 'optional',
      'Nothing sends itself over WhatsApp — talent offers included.'),
    row('WHATSAPP_PHONE_ID', 'optional', 'Same as WHATSAPP_TOKEN; both are needed.'),
    row('WHATSAPP_TEMPLATE', 'optional',
      'Talent offers can only send inside an open 24-hour window, which usually means not at all.'),
    row('RESEND_API_KEY', 'optional',
      'No email copy of a notice, so nothing about a lead is searchable later.'),
    row('NOTIFY_EMAIL_TO', 'optional', 'Email notices have no recipient.'),
    row('NOTIFY_EMAIL_FROM', 'optional', 'Resend refuses a send without a verified sender.'),
    row('NEXT_PUBLIC_CONTACT_EMAIL', 'optional',
      'Contact addresses on the public site fall back to the unregistered default domain.'),
    row('NEXT_PUBLIC_PRIVACY_EMAIL', 'optional',
      'The privacy address on /data falls back to the unregistered default domain.'),
    row('META_API_VERSION', 'optional', 'Defaults to the pinned Graph version.'),
    row('TALENT_SESSION_SECRET', 'optional',
      'Provider sessions are signed with SESSION_SECRET (or OPERATOR_KEY), so rotating that signs every provider out.'),
    row('WHATSAPP_REMINDER_TEMPLATE', 'optional',
      'Day-before reminders go as free text, which only reaches a provider inside an open 24-hour window.'),
    row('META_SELFCHECK_HANDLE', 'optional',
      'The Meta token self-check reads the default public account instead of our own.'),
    row('TURNSTILE_SECRET_KEY', 'optional',
      'The optional bot challenge is off. The honeypot and the IP windows still apply.'),
    row('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'optional',
      'The bot challenge widget is not rendered. Deliberate until abuse is observed.'),
  ];
}

/** The one-line version, for a banner that has to fit on a phone. */
export function configSummary(rows = configReport()) {
  const missing = (s: Severity) => rows.filter((r) => r.severity === s && !r.present);
  return {
    critical: missing('critical').map((r) => r.key),
    degraded: missing('degraded').map((r) => r.key),
    ok: missing('critical').length === 0 && missing('degraded').length === 0,
  };
}

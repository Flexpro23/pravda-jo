/**
 * Photographs of the people PRAVDA books, and what each person agreed to.
 *
 * Three facts from Jordan's PDPL (No. 24/2023, in force, and retroactive to
 * photos already held) decide the whole shape of this file, and they are worth
 * knowing before touching it:
 *
 *   · Consent is only valid for a stated PURPOSE and a stated DURATION, and it
 *     stops being valid when the purpose changes (Art. 5). "We can use your
 *     photos" covers nothing. So consent here is recorded per purpose, each
 *     with its own expiry.
 *
 *   · Using a photo in a way that ranks or profiles a person has to be
 *     disclosed before it happens (Art. 9). So photos are displayed, never
 *     scored — see `recommend.ts`, which does not read this file at all.
 *
 *   · Withdrawing consent may carry no financial or contractual consequence
 *     (Art. 4(c)). A model who takes her photos off the website must be cast
 *     exactly as often as she was before. The recommender's blindness to
 *     images is what guarantees that, and `tests/unit/media.test.mts` asserts
 *     it rather than trusting a comment.
 *
 * Not legal advice. The three purposes below are the obvious escalation of who
 * sees a face — our own console, a named prospective client, the public — and
 * a Jordanian lawyer should confirm the wording of the release that backs them.
 */

type B = { ar: string; en: string };

/**
 * Who a photograph may be shown to. Each widens the last, and each is its own
 * consent, because a person can reasonably agree to one and not the next.
 */
export type Purpose =
  /** Kept on file and seen inside the console, to cast them. */
  | 'roster'
  /** Shown to a named prospective client, on the page they are sent. */
  | 'clients'
  /** Published on PRAVDA's public website. */
  | 'website';

export const PURPOSES: Purpose[] = ['roster', 'clients', 'website'];

export const PURPOSE_LABEL: Record<Purpose, B & { detail: B }> = {
  roster: {
    ar: 'الملف الداخلي', en: 'Our records',
    detail: {
      ar: 'بنحتفظ بالصور ونشوفها جوّا اللوحة بس، عشان نختار مين يصوّر.',
      en: 'We keep the photos and see them inside the console only, to cast.',
    },
  },
  clients: {
    ar: 'الزبائن', en: 'Prospective clients',
    detail: {
      ar: 'بتطلع لزبون معيّن على الصفحة اللي بنبعتله إياها.',
      en: 'Shown to a named client on the page we send them.',
    },
  },
  website: {
    ar: 'الموقع', en: 'The website',
    detail: {
      ar: 'بتنشر على موقع برافدا العام.',
      en: 'Published on PRAVDA’s public website.',
    },
  },
};

export type Consent = {
  purpose: Purpose;
  /** ISO timestamp the person agreed. */
  grantedAt: string;
  /**
   * When it lapses. Required, never open-ended: a consent with no end date is
   * precisely the undated blanket grant the law says is worthless.
   */
  expiresAt: string;
  /**
   * How it was obtained, in words somebody could go and find: "signed release,
   * 12 Sep 2026, in the drive", "WhatsApp from her number, 12 Sep". A tick-box
   * with no trail is not documented consent.
   */
  evidence: string;
  /**
   * Set when they take it back. The record stays — what was agreed, and when it
   * ended, is itself something the controller may have to show.
   */
  withdrawnAt?: string;
};

export type TalentImage = {
  id: string;
  /** Object path inside the bucket. Never a public URL, never served directly. */
  path: string;
  contentType: string;
  bytes: number;
  uploadedAt: string;
  /** The one shown first. At most one per person; the store enforces it. */
  cover?: boolean;
  /**
   * The operator chose this one for the website. Necessary and not sufficient:
   * it is served publicly only while the person's `website` consent is live.
   */
  onWebsite?: boolean;
};

/** Upload ceilings. A comp-card photo is a few hundred kilobytes; ten megabytes is a mistake. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_PER_PERSON = 24;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** How long a consent runs unless the release says otherwise. */
export const CONSENT_DEFAULT_MONTHS = 12;

/**
 * Whether this person's consent for this purpose holds at `at`.
 *
 * The latest grant for the purpose decides, so a renewal supersedes an expired
 * one and a withdrawal after a grant ends it. Withdrawn, expired and absent are
 * all simply "no" — there is no state in which a photo is shown on a consent
 * that is not live right now.
 */
export function consentLive(
  consents: Consent[] | undefined, purpose: Purpose, at: Date = new Date(),
): boolean {
  const latest = (consents ?? [])
    .filter((c) => c.purpose === purpose)
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))[0];
  if (!latest) return false;
  if (latest.withdrawnAt && new Date(latest.withdrawnAt) <= at) return false;
  if (new Date(latest.grantedAt) > at) return false;
  return new Date(latest.expiresAt) > at;
}

/**
 * The latest consent for a purpose, whatever its state — for showing an
 * operator when it ran out, or that it never existed.
 */
export const latestConsent = (consents: Consent[] | undefined, purpose: Purpose) =>
  (consents ?? [])
    .filter((c) => c.purpose === purpose)
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))[0];

/**
 * Every place a photo can be read from, and the one rule that decides each.
 *
 * `roster` gates even the console. Holding a person's photographs is itself
 * processing, so without it an operator sees that photos exist and not what is
 * in them — which is also exactly what should happen the day someone withdraws.
 */
export function mayShow(
  person: { consents?: Consent[] },
  image: TalentImage,
  where: Purpose,
  at: Date = new Date(),
): boolean {
  switch (where) {
    case 'roster':
      return consentLive(person.consents, 'roster', at);
    case 'clients':
      return consentLive(person.consents, 'roster', at)
        && consentLive(person.consents, 'clients', at);
    case 'website':
      return !!image.onWebsite
        && consentLive(person.consents, 'roster', at)
        && consentLive(person.consents, 'website', at);
  }
}

/** The photo to lead with for a purpose: the cover if it may be shown, else the first that may. */
export function coverFor(
  person: { consents?: Consent[]; images?: TalentImage[] },
  where: Purpose,
  at: Date = new Date(),
): TalentImage | null {
  const shown = (person.images ?? []).filter((i) => mayShow(person, i, where, at));
  return shown.find((i) => i.cover) ?? shown[0] ?? null;
}

/** An expiry a consent form can default to. */
export const addMonths = (from: Date, months: number): Date => {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

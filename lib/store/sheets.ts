import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { store } from '@/lib/store/firebase';
import { ttlWrite, withTtl } from '@/lib/store/ttl';
import type { Signals } from '@/lib/teardown/signals';
import type { SiteRead } from '@/lib/meta/website';
import type { Findings, Web } from '@/lib/teardown/findings';
import type { Recommendation, CastPick } from '@/lib/teardown/recommend';
import type { Vertical } from '@/lib/data/concepts';
import type { VerticalGuess } from '@/lib/teardown/vertical';
import { listTalent } from '@/lib/store/deals';
import type { Talent } from '@/lib/data/deals';

const P = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
const SHEETS = `${P}sheets`;

/**
 * The sheet: one business, everything we read about it, and the offer.
 *
 * It replaces the client-facing configurator. Khaled fixes everything before
 * anything is shared, so the sheet has two faces of the same record — the
 * operator's, reached by `token`, and the client's, reached by `shareToken`,
 * which does not exist until he approves. A sheet nobody has approved has no
 * client-side address at all, which is a stronger guarantee than a page that
 * checks a flag before rendering.
 */
export type Offer = {
  /** How many videos the client is being offered. */
  videos: number;
  /** Per video. Defaults to the published 150; Khaled may discount. */
  pricePerVideo: number;
  /** Ads management, monthly. */
  ads: boolean;
  adsMonthlyJOD: number;
  /** videos × pricePerVideo. Computed on save, never trusted from a form. */
  totalJOD: number;
  note?: string;
};

export type Sheet = {
  token: string;
  /** Minted on approval. Its absence is what makes a sheet unshareable. */
  shareToken?: string;
  handle: string;
  clientName: string;
  website?: string;
  /**
   * What the business is, once somebody is prepared to stand behind it.
   *
   * Set from `verticalGuess` only when the guess is confident, or by an
   * operator saying so. Its absence is meaningful: `/s` prints a vertical
   * label only when this field exists, so a client is never shown a category
   * the engine merely suspected.
   */
  vertical?: Vertical;
  /**
   * What the bio, the captions and the site title suggested, always stored.
   *
   * Kept even when it was too weak to act on, because the operator correcting
   * it needs to see the words that produced it — a guess with no evidence
   * behind it is an assertion nobody can argue with.
   */
  verticalGuess?: VerticalGuess;

  /**
   * The account as Meta described it, at the moment we read it.
   *
   * The picture is a URL and never bytes. This is public business data — what
   * the business itself published about itself — held for the life of the
   * sheet and removed with it through the rights flow on `/{lang}/data`.
   */
  profile?: {
    name?: string;
    biography?: string;
    /** Whatever their bio points at, before we normalised or read it. */
    bioLink?: string;
    followers: number;
    follows?: number;
    mediaCount: number;
    profilePictureUrl?: string;
    readAt: string;
  };

  signals: Signals;
  site?: SiteRead | null;
  findings: Findings;
  /** Five, always. Khaled picks three. */
  recommendations: Recommendation[];
  /** Concept numbers he chose. Empty until he does. */
  chosen: number[];
  /**
   * Per concept, the people he settled on when he changed the engine's cast.
   *
   * Materialised rather than referential: a list of ids carries no name, so
   * every reader — `/s`, the console, `castPlan` — would have to fetch the
   * roster to render one, and the page a client holds would silently change
   * the day somebody edited a talent record. The `cast` action validates each
   * id once and writes down what it found.
   */
  castOverrides?: Record<string, CastPick[]>;
  /**
   * Arabic for the three he chose, keyed by concept number.
   *
   * The library is English — it is source material for an operator, not copy
   * for a recipient — and the sheet is read in Arabic by the people it is sent
   * to. Stock translation of an idea written for a different business reads
   * exactly like what it is, so this is written per client or the English
   * stands, correctly isolated, rather than being mangled through it.
   */
  copy?: Record<string, { name?: string; hook?: string }>;

  /**
   * Which of the four states their website was in, kept for the console.
   *
   * `/s` never renders this. It exists so an operator can tell "they have no
   * site" from "their site refused us", which are the same absence on the
   * page and completely different sentences on a call.
   */
  webState?: Web;
  /**
   * Whether the roster could cast this sheet when it was composed.
   *
   * The console warns on it before approval and `approveSheet` refuses on it,
   * because a roster of worked examples looks exactly like a real one on every
   * screen until an invented person is named on a real prospect's page.
   */
  rosterState?: 'real' | 'placeholder-only' | 'empty';

  offer?: Offer;
  status: 'draft' | 'approved';

  /**
   * The deal this became, once the client said yes.
   *
   * Its presence is what makes winning a sheet happen once. Khaled presses the
   * button twice — because the first press was slow, or because he came back to
   * the page a week later — and the second press finds this and opens the deal
   * that already exists rather than booking the same crew a second time.
   */
  dealId?: string;
  wonAt?: string;

  createdAt: string;
  updatedAt: string;
  approvedAt?: string;

  /**
   * When an unapproved sheet is deleted, matching the client's own clock.
   *
   * A sheet holds more about a business than its client record does — the bio,
   * the captions, the site read, the profile picture URL — so a draft nobody
   * ever approved must not outlive the lead it was composed for. Stamped at
   * composition, deleted on approval and on winning: a page a client has been
   * given an address to, or a business that became a customer, is no longer an
   * unconverted enquiry and the retention clock does not apply to it. A
   * Firestore TTL policy on this field is what actually does the deleting —
   * `gcloud firestore fields ttls update expiresAt --collection-group=sheets
   * --enable-ttl`.
   *
   * An ISO string here and a Firestore `Timestamp` in the document. The policy
   * deletes only what it finds in a timestamp field and ignores every other
   * type without complaining, so a string in Firestore is a retention promise
   * that quietly never happens; but the engine composes this value in
   * `lib/teardown/run.ts`, which must not import `firebase-admin`, so the type
   * stays a string and `lib/store/ttl.ts` converts at every read and write in
   * this file.
   */
  expiresAt?: string;

  /**
   * Sending is a human act, so this is written when Khaled says he sent it —
   * never by approval, which only mints the address.
   */
  sentAt?: string;

  /**
   * Whether anybody actually read it.
   *
   * `openedAt` is write-once: the first time a browser with JavaScript loads
   * the share URL. It is deliberately not stamped by the render, because the
   * first two fetches of a freshly pasted link are WhatsApp's preview crawler
   * and Khaled checking his own work — and a follow-up call built on either of
   * those is worse than one built on no signal at all.
   */
  openedAt?: string;
  lastOpenedAt?: string;
  openCount?: number;
};

export const mintToken = () => randomBytes(12).toString('base64url');

const clean = (t: string) => /^[A-Za-z0-9_-]{10,64}$/.test(t);

export async function saveSheet(s: Sheet) {
  await store().collection(SHEETS).doc(s.token).set({
    ...s,
    // The whole sheet goes back, so the expiry goes back with it — as a
    // timestamp, or a round trip through here would silently downgrade a
    // TTL-eligible field to a string the policy ignores.
    expiresAt: ttlWrite(s.expiresAt),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function getSheet(token: string): Promise<Sheet | null> {
  if (!clean(token)) return null;
  const d = await store().collection(SHEETS).doc(token).get();
  return d.exists ? withTtl<Sheet>(d.data()!) : null;
}

/**
 * The client's way in.
 *
 * Only ever finds an approved sheet, because the share token is created by
 * approval and by nothing else. A draft is not hidden from this lookup — it is
 * unaddressable by it.
 */
export async function getShared(shareToken: string): Promise<Sheet | null> {
  if (!clean(shareToken)) return null;
  const snap = await store().collection(SHEETS)
    .where('shareToken', '==', shareToken).limit(1).get();
  if (snap.empty) return null;
  const s = withTtl<Sheet>(snap.docs[0].data());
  return s.status === 'approved' ? s : null;
}

/**
 * A human opened the sheet.
 *
 * Addressed by the share token, because that is the only token the client's
 * page holds — the operator address never leaves the console. `openedAt` is
 * written once and never moved: the question Khaled asks is "did they ever
 * read it", and an overwritten first-open cannot answer it. `openCount` is a
 * field increment rather than a read-then-write, so two tabs opened at the
 * same moment count twice rather than once.
 *
 * Returns quietly on anything it cannot resolve. This is called from a beacon
 * whose failure the reader must never see.
 */
export async function recordOpen(shareToken: string): Promise<void> {
  if (!clean(shareToken)) return;
  const snap = await store().collection(SHEETS)
    .where('shareToken', '==', shareToken).limit(1).get();
  if (snap.empty) return;
  const doc = snap.docs[0];
  const s = withTtl<Sheet>(doc.data());
  if (s.status !== 'approved') return;

  const now = new Date().toISOString();
  await doc.ref.update({
    ...(s.openedAt ? {} : { openedAt: now }),
    lastOpenedAt: now,
    openCount: FieldValue.increment(1),
    // Deliberately not `updatedAt`: a client reading the page is not an edit
    // to it, and the console sorts its list by when somebody last changed
    // something. A sheet must not climb the queue because it was read.
  });
}

export async function listSheets(limit = 60): Promise<Sheet[]> {
  const snap = await store().collection(SHEETS)
    .orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => withTtl<Sheet>(d.data()));
}

/**
 * The people a chosen idea would actually put on a call sheet.
 *
 * The override when there is one, the engine's own cast otherwise. Exported
 * because `castPlan` and the approve gate must agree about this to the person:
 * a gate that checks one list while the booking form reads another is a gate
 * that passes the sheet it was built to stop.
 */
export const effectiveCast = (sheet: Sheet, n: number): CastPick[] => {
  const override = sheet.castOverrides?.[String(n)];
  if (override && override.length) return override;
  return sheet.recommendations.find((r) => r.conceptN === n)?.cast ?? [];
};

export type ApproveRefusal =
  | 'not-found' | 'pick-three' | 'no-offer' | 'placeholder-cast' | 'uncastable-chosen';

/**
 * Approve, and only then make it reachable.
 *
 * Refuses a sheet that has not had three ideas chosen or an offer composed:
 * the thing being approved is the thing the client will see, so approving an
 * incomplete one would publish a half-built page under a real business's name.
 *
 * The two casting refusals are newer and are about a different failure. The
 * seed writes fourteen worked examples onto the roster and marks every one of
 * them `placeholder: true`; nothing renders that flag differently, so an
 * invented videographer named on a real prospect's page looks exactly like a
 * real one right up to the moment somebody tries to book him. And a concept
 * the recommender itself marked `uncastable` names nobody at all — approving
 * it sends a page promising a crew we have not got.
 *
 * Both are checked against the roster as it is now, not as it was when the
 * sheet was composed. A person deactivated last week must stop a sheet today.
 */
export type CastRefusal = {
  why: Extract<ApproveRefusal, 'placeholder-cast' | 'uncastable-chosen'>;
  detail: string;
};

/**
 * Can this sheet's chosen ideas actually be crewed, right now?
 *
 * Exported and shared rather than written twice. `approveSheet` runs it before
 * minting an address, and `winSheet` runs the same function again before
 * turning the sheet into a job — because the roster moves between those two
 * moments. A person deactivated the week after the sheet went out, or a real
 * name reverted to a worked example by a careless seed rerun, must stop the
 * deal; and the check that stops it has to be the same check, or the two
 * disagree and the gate that passes is the weaker one.
 *
 * `null` means nothing is wrong.
 */
export function castRefusal(sheet: Sheet, roster: Talent[]): CastRefusal | null {
  const bookable = new Set(roster
    .filter((t) => t.active && t.dayRateJOD > 0 && !t.placeholder)
    .map((t) => t.id));

  for (const n of sheet.chosen) {
    const rec = sheet.recommendations.find((r) => r.conceptN === n);
    const cast = effectiveCast(sheet, n);
    const override = sheet.castOverrides?.[String(n)];

    // `uncastable` is the recommender saying the roster could not fill this
    // idea. An operator override is allowed to answer it — he may know
    // something the matcher does not — but only by naming somebody.
    if (rec?.uncastable && !(override && override.length)) {
      return { why: 'uncastable-chosen', detail: `#${n}: ${rec.uncastable}` };
    }

    for (const pick of cast) {
      if (!bookable.has(pick.talentId)) {
        return { why: 'placeholder-cast', detail: `#${n}: ${pick.name.en || pick.talentId}` };
      }
    }
  }
  return null;
}

export async function approveSheet(token: string): Promise<
{ ok: true; shareToken: string } | { ok: false; why: ApproveRefusal; detail?: string }> {
  const s = await getSheet(token);
  if (!s) return { ok: false, why: 'not-found' };
  if (s.chosen.length !== 3) return { ok: false, why: 'pick-three' };
  if (!s.offer || s.offer.videos < 1) return { ok: false, why: 'no-offer' };

  // A roster we cannot read is not a roster that passes. Failing open here
  // would make a transient Firestore error the way an invented person reaches
  // a client, which is exactly the event this gate exists for.
  const refusal = castRefusal(s, await listTalent());
  if (refusal) return { ok: false, ...refusal };

  // Approving twice keeps the link already sent rather than orphaning it.
  const shareToken = s.shareToken ?? mintToken();
  await store().collection(SHEETS).doc(token).update({
    status: 'approved', shareToken,
    approvedAt: s.approvedAt ?? new Date().toISOString(),
    // A sheet with an address a client has been given is not an unconverted
    // draft any more, so the retention clock stops. Deleted rather than
    // nulled, so the field's absence means what it says.
    expiresAt: FieldValue.delete(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true, shareToken };
}

/**
 * The five edits a console makes to a draft, each writing only its own field.
 *
 * These replaced `saveSheet({ ...sheet, one: change })`. That shape reads the
 * whole document, changes one key and writes all of it back — so two operators
 * on the same sheet, or one operator with the page open in two tabs, silently
 * undo each other: the second save carries a copy of the sheet from before the
 * first, and merge cannot tell a stale field from an intended one. A dotted
 * path writes the field and nothing else, which is what the console actually
 * meant every time.
 *
 * `updatedAt` moves on each, because the console's list is sorted by it and
 * these are all edits somebody made.
 */
export async function setChosen(token: string, chosen: number[]) {
  await store().collection(SHEETS).doc(token).update({
    chosen, updatedAt: new Date().toISOString(),
  });
}

/** Arabic for one concept. `undefined` on either half clears that half. */
export async function setCopyFor(
  token: string, n: number, copy: { name?: string; hook?: string },
) {
  await store().collection(SHEETS).doc(token).update({
    [`copy.${Number(n)}`]: copy,
    updatedAt: new Date().toISOString(),
  });
}

export async function setOffer(token: string, offer: Offer) {
  await store().collection(SHEETS).doc(token).update({
    offer, updatedAt: new Date().toISOString(),
  });
}

/**
 * The vertical moved, so the five ideas and the shortlist moved with it.
 *
 * Three fields rather than the whole sheet, for the reason above — and in
 * particular so the Arabic an operator wrote and the offer he composed cannot
 * be carried backwards by a re-recommendation that never touched them.
 */
export async function setRecommendations(
  token: string,
  recommendations: Sheet['recommendations'],
  chosen: number[],
  rosterState?: Sheet['rosterState'],
) {
  await store().collection(SHEETS).doc(token).update({
    recommendations,
    chosen,
    ...(rosterState ? { rosterState } : {}),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * The operator says what the business is.
 *
 * Written on its own rather than through `saveSheet`, so setting a vertical
 * cannot carry a stale copy of the whole document back over a concurrent edit.
 * `null` clears it — "I do not know" is a position, and a wrong label moves
 * five recommendations.
 */
export async function setSheetVertical(token: string, vertical: Vertical | null) {
  await store().collection(SHEETS).doc(token).update({
    vertical: vertical ?? FieldValue.delete(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Who is on this idea, decided by a person.
 *
 * An empty list deletes the override rather than storing one, so "reset to the
 * engine's cast" is the absence of a decision and not an empty decision — the
 * two render differently everywhere downstream.
 */
export async function setCastOverride(token: string, n: number, cast: CastPick[]) {
  const key = `castOverrides.${Number(n)}`;
  await store().collection(SHEETS).doc(token).update({
    [key]: cast.length ? cast : FieldValue.delete(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * He sent it.
 *
 * Write-once: the question this answers is when the client first had the link,
 * and a second press — after a follow-up message, a week later — must not move
 * that date. Returns whatever the sheet now says, so the caller can render it
 * without a second read.
 */
export async function markShareSent(token: string): Promise<string | null> {
  const s = await getSheet(token);
  if (!s) return null;
  if (s.sentAt) return s.sentAt;
  const sentAt = new Date().toISOString();
  await store().collection(SHEETS).doc(token)
    .update({ sentAt, updatedAt: sentAt });
  return sentAt;
}

/**
 * Back to draft, and the share link stops working immediately.
 *
 * A client hitting a dead link is recoverable — he re-approves and resends. A
 * client reading a sheet mid-revision, with three ideas becoming two and a
 * price changing under them, is not. The token is kept rather than destroyed,
 * so re-approving restores the same link he already sent.
 */
/**
 * Stop the retention clock on a sheet that is no longer an unconverted draft.
 *
 * `approveSheet` does this inline; `winSheet` calls it, because a sheet that
 * became a job is a customer's record and a TTL policy does not read
 * intentions. Deleted rather than nulled, so the field's absence means what it
 * says — a `null` would still be a field a query for "has an expiry" matches.
 */
export async function clearSheetExpiry(token: string): Promise<void> {
  await store().collection(SHEETS).doc(token)
    .update({ expiresAt: FieldValue.delete() });
}

export async function unapproveSheet(token: string) {
  await store().collection(SHEETS).doc(token)
    .update({ status: 'draft', updatedAt: new Date().toISOString() });
}

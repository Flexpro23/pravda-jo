import { randomBytes } from 'node:crypto';
import { store } from '@/lib/store/firebase';
import type { Signals } from '@/lib/teardown/signals';
import type { SiteRead } from '@/lib/meta/website';
import type { Findings } from '@/lib/teardown/findings';
import type { Recommendation } from '@/lib/teardown/recommend';
import type { Vertical } from '@/lib/data/concepts';

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
  vertical?: Vertical;

  signals: Signals;
  site?: SiteRead | null;
  findings: Findings;
  /** Five, always. Khaled picks three. */
  recommendations: Recommendation[];
  /** Concept numbers he chose. Empty until he does. */
  chosen: number[];
  /** Per concept, the talent ids he settled on if he changed them. */
  castOverrides?: Record<string, string[]>;
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

  offer?: Offer;
  status: 'draft' | 'approved';
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
};

export const mintToken = () => randomBytes(12).toString('base64url');

const clean = (t: string) => /^[A-Za-z0-9_-]{10,64}$/.test(t);

export async function saveSheet(s: Sheet) {
  await store().collection(SHEETS).doc(s.token)
    .set({ ...s, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function getSheet(token: string): Promise<Sheet | null> {
  if (!clean(token)) return null;
  const d = await store().collection(SHEETS).doc(token).get();
  return d.exists ? (d.data() as Sheet) : null;
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
  const s = snap.docs[0].data() as Sheet;
  return s.status === 'approved' ? s : null;
}

export async function listSheets(limit = 60): Promise<Sheet[]> {
  const snap = await store().collection(SHEETS)
    .orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data() as Sheet);
}

/**
 * Approve, and only then make it reachable.
 *
 * Refuses a sheet that has not had three ideas chosen or an offer composed:
 * the thing being approved is the thing the client will see, so approving an
 * incomplete one would publish a half-built page under a real business's name.
 */
export async function approveSheet(token: string): Promise<
{ ok: true; shareToken: string } | { ok: false; why: string }> {
  const s = await getSheet(token);
  if (!s) return { ok: false, why: 'not-found' };
  if (s.chosen.length !== 3) return { ok: false, why: 'pick-three' };
  if (!s.offer || s.offer.videos < 1) return { ok: false, why: 'no-offer' };

  // Approving twice keeps the link already sent rather than orphaning it.
  const shareToken = s.shareToken ?? mintToken();
  await store().collection(SHEETS).doc(token).update({
    status: 'approved', shareToken,
    approvedAt: s.approvedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true, shareToken };
}

/**
 * Back to draft, and the share link stops working immediately.
 *
 * A client hitting a dead link is recoverable — he re-approves and resends. A
 * client reading a sheet mid-revision, with three ideas becoming two and a
 * price changing under them, is not. The token is kept rather than destroyed,
 * so re-approving restores the same link he already sent.
 */
export async function unapproveSheet(token: string) {
  await store().collection(SHEETS).doc(token)
    .update({ status: 'draft', updatedAt: new Date().toISOString() });
}

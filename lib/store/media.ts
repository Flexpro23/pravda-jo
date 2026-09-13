import { randomBytes } from 'node:crypto';
import { bucket, store } from '@/lib/store/firebase';
import {
  IMAGE_MAX_BYTES, IMAGE_MAX_PER_PERSON, IMAGE_TYPES,
  type Consent, type Purpose, type TalentImage,
} from '@/lib/data/media';
import type { Talent } from '@/lib/data/deals';

/**
 * Photographs of the roster, and the consents that govern them.
 *
 * Bytes go to Storage and the list of them lives on the talent document, so a
 * person's photos and what they agreed to are read in one document fetch and
 * can never disagree about who owns what.
 *
 * Every change to that list runs in a transaction. Uploading six photos from a
 * phone fires six requests at once, and each one reading the list, appending
 * and writing it back would leave one photo on the record and five orphaned in
 * the bucket — present, paid for, and invisible.
 */

const P = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
const TALENT = `${P}talent`;

/** `talent/<id>/<imageId>.jpg` — the prefix keeps staging and itests out of production's photos. */
const objectPath = (talentId: string, imageId: string, ext: string) =>
  `${P}talent/${talentId}/${imageId}.${ext}`;

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export type UploadRefusal =
  | 'not-found' | 'too-many' | 'too-large' | 'wrong-type' | 'empty' | 'not-an-image';

/**
 * The first bytes of each accepted format.
 *
 * The declared content type comes from the browser, which takes it from the
 * file name. A file renamed to .jpg is still whatever it was, so the bytes are
 * checked too — this bucket's objects are later streamed back to a browser
 * under an image content type, and that must be true of every one of them.
 */
function sniff(buf: Buffer): (typeof IMAGE_TYPES)[number] | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export async function addImage(
  talentId: string, bytes: Buffer, declaredType: string,
): Promise<{ ok: true; image: TalentImage } | { ok: false; why: UploadRefusal }> {
  if (!bytes.length) return { ok: false, why: 'empty' };
  if (bytes.length > IMAGE_MAX_BYTES) return { ok: false, why: 'too-large' };
  if (!(IMAGE_TYPES as readonly string[]).includes(declaredType)) return { ok: false, why: 'wrong-type' };
  const actual = sniff(bytes);
  if (!actual) return { ok: false, why: 'not-an-image' };

  const ref = store().collection(TALENT).doc(talentId);
  const pre = await ref.get();
  if (!pre.exists) return { ok: false, why: 'not-found' };
  if (((pre.data() as Talent).images ?? []).length >= IMAGE_MAX_PER_PERSON) {
    return { ok: false, why: 'too-many' };
  }

  const id = randomBytes(9).toString('base64url');
  // The sniffed type, not the declared one: that is what the bytes are.
  const image: TalentImage = {
    id, path: objectPath(talentId, id, EXT[actual]), contentType: actual,
    bytes: bytes.length, uploadedAt: new Date().toISOString(),
  };

  // Bytes first. A record that points at an object which was never written is
  // a broken image on a screen; an object with no record is only a cost, and
  // `removeImage` and a later sweep can find it by prefix.
  await bucket().file(image.path).save(bytes, {
    resumable: false, contentType: actual,
    // Private objects. Nothing reads these but a route handler.
    metadata: { cacheControl: 'private, max-age=0' },
  });

  const saved = await store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const list = (snap.data() as Talent).images ?? [];
    if (list.length >= IMAGE_MAX_PER_PERSON) return null;
    // The first photo a person gets is their cover until someone chooses another.
    const next = [...list, { ...image, ...(list.length === 0 ? { cover: true } : {}) }];
    tx.update(ref, { images: next });
    return next[next.length - 1];
  });

  if (!saved) {
    // Lost the race to the per-person ceiling, or the person was deleted mid-upload.
    await bucket().file(image.path).delete({ ignoreNotFound: true }).catch(() => {});
    return { ok: false, why: 'too-many' };
  }
  return { ok: true, image: saved };
}

/** Deletes the object and the record. A photo taken down is gone from the bucket, not just hidden. */
export async function removeImage(talentId: string, imageId: string): Promise<boolean> {
  const ref = store().collection(TALENT).doc(talentId);
  const removed = await store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const list = (snap.data() as Talent).images ?? [];
    const gone = list.find((i) => i.id === imageId);
    if (!gone) return null;
    let next = list.filter((i) => i.id !== imageId);
    // Removing the cover promotes the next photo, so a person with photos
    // always has one to lead with.
    if (gone.cover && next.length && !next.some((i) => i.cover)) {
      next = next.map((i, n) => (n === 0 ? { ...i, cover: true } : i));
    }
    tx.update(ref, { images: next });
    return gone;
  });
  if (!removed) return false;
  await bucket().file(removed.path).delete({ ignoreNotFound: true });
  return true;
}

/** Choose the cover, or put a photo on or off the website. One photo, one field, atomically. */
export async function setImageFlags(
  talentId: string, imageId: string, flags: { cover?: true; onWebsite?: boolean },
): Promise<boolean> {
  const ref = store().collection(TALENT).doc(talentId);
  return store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const list = (snap.data() as Talent).images ?? [];
    if (!list.some((i) => i.id === imageId)) return false;
    const next = list.map((i) => {
      const mine = i.id === imageId;
      return {
        ...i,
        // At most one cover: choosing this one un-chooses the last.
        ...(flags.cover ? { cover: mine } : {}),
        ...(mine && flags.onWebsite !== undefined ? { onWebsite: flags.onWebsite } : {}),
      };
    });
    tx.update(ref, { images: next });
    return true;
  });
}

/** The bytes of one photo. Never call this without having decided the reader may see it. */
export async function readImage(image: TalentImage): Promise<Buffer> {
  const [buf] = await bucket().file(image.path).download();
  return buf;
}

// ── consent ─────────────────────────────────────────────────────────────────

export async function grantConsent(talentId: string, c: Omit<Consent, 'withdrawnAt'>): Promise<boolean> {
  const ref = store().collection(TALENT).doc(talentId);
  return store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const list = (snap.data() as Talent).consents ?? [];
    // Appended, never replaced: the history of what was agreed is kept.
    tx.update(ref, { consents: [...list, c] });
    return true;
  });
}

/**
 * They took it back. The consent record is stamped, not deleted.
 *
 * A withdrawal of `roster` withdraws everything wider than it too, because a
 * photo cannot be shown to a client or the public by a studio that has agreed
 * to stop holding it. Nothing else about the person changes: their bookings,
 * their rate and how often the recommender casts them are all untouched, which
 * is what PDPL Art. 4(c) requires.
 */
export async function withdrawConsent(talentId: string, purpose: Purpose): Promise<boolean> {
  const ref = store().collection(TALENT).doc(talentId);
  const scope: Purpose[] = purpose === 'roster' ? ['roster', 'clients', 'website']
    : purpose === 'clients' ? ['clients'] : ['website'];
  return store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const at = new Date().toISOString();
    const list = (snap.data() as Talent).consents ?? [];
    const next = list.map((c) => (scope.includes(c.purpose) && !c.withdrawnAt ? { ...c, withdrawnAt: at } : c));
    const patch: { consents: Consent[]; images?: TalentImage[] } = { consents: next };
    // Off the website the moment website consent ends — not at the next render.
    if (scope.includes('website')) {
      patch.images = ((snap.data() as Talent).images ?? []).map((i) => ({ ...i, onWebsite: false }));
    }
    tx.update(ref, patch);
    return true;
  });
}

import { getTalent } from '@/lib/store/deals';
import { readImage } from '@/lib/store/media';
import { StorageUnconfigured } from '@/lib/store/firebase';
import { mayShow, type Purpose } from '@/lib/data/media';

/**
 * One photograph, served only to a reader the person agreed may see it.
 *
 * Shared by the console route and the public one so the decision is made in
 * exactly one place. Consent is checked on every request, not when a URL was
 * minted, because a URL lives in a browser cache, a WhatsApp preview and a
 * forwarded message long after the consent behind it may have been withdrawn —
 * and a withdrawal has to take effect on the next read, not the next deploy.
 *
 * A refusal is a plain 404, never "consent withdrawn". Telling a stranger
 * which person used to be on the website and asked to come off is itself a
 * disclosure about them.
 */
export async function servePhoto(
  talentId: string, imageId: string, where: Purpose,
): Promise<Response> {
  const nope = () => new Response('Not found', { status: 404 });
  const t = await getTalent(talentId).catch(() => null);
  const image = t?.images?.find((i) => i.id === imageId);
  if (!t || !image || !mayShow(t, image, where)) return nope();

  // A placeholder person is invented. Their photo — a stock image, a stand-in —
  // must never be presented to the public as a member of the roster.
  if (where !== 'roster' && t.placeholder) return nope();

  try {
    const bytes = await readImage(image);
    return new Response(new Uint8Array(bytes), {
      headers: {
        'content-type': image.contentType,
        'content-length': String(bytes.length),
        // Never cached by anything shared. A cached copy outlives a withdrawal.
        'cache-control': where === 'website'
          ? 'public, max-age=300, must-revalidate'
          : 'private, no-store',
        'x-content-type-options': 'nosniff',
        // The console and a client's sheet must not leak this address onward.
        'referrer-policy': 'no-referrer',
      },
    });
  } catch (e) {
    if (e instanceof StorageUnconfigured) return new Response('Photos are not configured', { status: 503 });
    return nope();
  }
}

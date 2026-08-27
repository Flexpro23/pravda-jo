import { store } from '@/lib/store/firebase';
import { WORK as SEED_WORK, type Piece } from '@/lib/data/work';
import { ROSTER as SEED_ROSTER, type CastMember } from '@/lib/data/roster';

/**
 * The archive and the roster, read from Firestore.
 *
 * They lived in TypeScript, which meant every new face or finished piece was a
 * deploy. They live in the database now so the people who do the work can
 * change what the site says about it.
 *
 * The seed arrays stay, and are the fallback rather than dead code. Two things
 * can go wrong that must not take the site down: the build runs in Cloud Build,
 * where the runtime service account may not reach Firestore, and a store can be
 * briefly unreachable at request time. In either case the site renders the seed
 * rather than an empty archive or a 500.
 *
 * Every seeded record carries `placeholder: true`. Nothing in the current
 * archive happened and nobody in the current roster exists, and that fact
 * should live in the data rather than in someone's memory of which copy to
 * change later — see `anyPlaceholder`.
 */

const TTL = 5 * 60 * 1000;   // content changes rarely; a stale minute is fine

type Cache<T> = { at: number; value: T[] } | null;
let workCache: Cache<Piece> = null;
let rosterCache: Cache<CastMember> = null;

async function read<T>(collection: string, seed: T[], cache: Cache<T>,
  set: (c: Cache<T>) => void, order: string,
  dir: 'asc' | 'desc' = 'asc'): Promise<T[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  try {
    const snap = await store().collection(collection).orderBy(order, dir).get();
    // An empty collection means nobody has seeded it yet, not that the studio
    // has no work — falling through to the seed is the honest reading.
    const rows = snap.empty ? seed : snap.docs.map((d) => d.data() as T);
    set({ at: Date.now(), value: rows });
    return rows;
  } catch {
    set({ at: Date.now(), value: seed });
    return seed;
  }
}

/* Newest first, which is the order the hand-written array was in and the only
   order an archive reads correctly. Ascending would open on the oldest piece. */
export const getWork = () =>
  read<Piece>('work', SEED_WORK, workCache, (c) => { workCache = c; }, 'date', 'desc');

export const getRoster = () =>
  read<CastMember>('cast', SEED_ROSTER, rosterCache, (c) => { rosterCache = c; }, 'key');

export const getPiece = async (slug: string) =>
  (await getWork()).find((w) => w.slug === slug) ?? null;

/**
 * Is any of this invented?
 *
 * The archive page says "these ones already happened" and the roster says
 * everyone is reached through work they made. Both are false while the records
 * are seeded, and a cold prospect in Amman can check four invented local
 * businesses in an afternoon — having been sent a document whose entire claim
 * is that we only say what we can prove. So the claim is made by the data:
 * when the last placeholder is replaced, the copy asserts itself again, and
 * nobody has to remember to go and change a sentence.
 */
export const anyPlaceholder = (rows: { placeholder?: boolean }[]) =>
  rows.some((r) => r.placeholder);

/** Everything the cast page needs, in one round trip. */
export async function getCastPage() {
  const [roster, work] = await Promise.all([getRoster(), getWork()]);
  return { roster, work };
}

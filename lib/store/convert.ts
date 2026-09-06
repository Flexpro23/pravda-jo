import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { store } from '@/lib/store/firebase';
import {
  getSheet, saveSheet, effectiveCast, castRefusal, clearSheetExpiry, type Sheet,
} from '@/lib/store/sheets';
import { getDeal, listTalent, saveDeal } from '@/lib/store/deals';
import { clientForSheet } from '@/lib/store/clients';
import type { Deal, SoldConcept } from '@/lib/data/deals';

/**
 * The sheet the client said yes to, becoming the job that has to happen.
 *
 * Everything a deal needs is already on the sheet and was already checked by a
 * human before it was sent. Re-typing it into the deals console is where the
 * price becomes 105 instead of 150 and where the videographer who was cast is
 * not the one who gets booked — so the sheet hands it over whole.
 *
 * It deliberately stops short of creating bookings. A booking needs a date, and
 * there is no date anywhere on a sheet. Inventing one would put a real message
 * on a real person's phone telling them to turn up on a day nobody agreed. What
 * carries across instead is the casting, so the deal's offer form knows who and
 * for how much and only wants the day.
 */

export type CastSlot = {
  talentId: string;
  conceptN: number;
  conceptName: string;
  /** What they are turning up to do, in the language they actually read. */
  brief: string;
};

/**
 * Who the sheet cast, per chosen idea.
 *
 * One slot per person per concept and no deduplication across them: the same
 * videographer on all three is three shooting days, not one, and collapsing
 * them would under-book the job and under-pay him.
 *
 * The brief prefers the Arabic Khaled wrote on the sheet for this client. He
 * wrote it for the client to read, and the crew read Arabic too — a hook
 * assembled in English lands in a WhatsApp message that is otherwise entirely
 * Arabic, which is both a bidi mess and a thing nobody on the day can use.
 */
export function castPlan(sheet: Sheet): CastSlot[] {
  const slots: CastSlot[] = [];
  for (const n of sheet.chosen) {
    const rec = sheet.recommendations.find((r) => r.conceptN === n);
    if (!rec) continue;
    const written = sheet.copy?.[String(n)];
    const name = written?.name || rec.name;
    const hook = written?.hook || rec.hook;
    // The override when there is one, exactly as the approve gate read it.
    // Both go through `effectiveCast` so the people who were checked before
    // sending are the people who get booked.
    const ids = [...new Set(effectiveCast(sheet, n).map((c) => c.talentId))].filter(Boolean);
    for (const talentId of ids) {
      slots.push({ talentId, conceptN: n, conceptName: name, brief: `${name} — ${hook}` });
    }
  }
  return slots;
}

/**
 * The retention clock stops when the lead stops being a lead.
 *
 * `expiresAt` exists so an unconverted enquiry does not sit in Firestore
 * forever; a client who signed is not an unconverted enquiry, and a TTL policy
 * does not care about intentions. Deleted rather than nulled, so the field's
 * absence means what it says. Written here rather than in `clients.ts` because
 * that file belongs to another workstream this wave; when a `clearClientExpiry`
 * lands there, this should become a call to it.
 */
async function clearExpiry(clientId: string): Promise<void> {
  const P = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
  await store().collection(`${P}clients`).doc(clientId)
    .update({ expiresAt: FieldValue.delete() });
}

export async function winSheet(token: string): Promise<
{ ok: true; dealId: string; created: boolean } | { ok: false; why: string; detail?: string }> {
  const sheet = await getSheet(token);
  if (!sheet) return { ok: false, why: 'not-found' };
  // A sheet that was never approved was never sent, so there is nothing a
  // client could have said yes to.
  if (sheet.status !== 'approved') return { ok: false, why: 'not-approved' };
  if (sheet.chosen.length !== 3) return { ok: false, why: 'pick-three' };
  if (!sheet.offer || sheet.offer.videos < 1) return { ok: false, why: 'no-offer' };

  // The same gate `approveSheet` runs, run again against the roster as it is
  // now. Reaching a refusal here means the roster changed after the sheet went
  // out — somebody deactivated, or a seed rerun flagged a real person back to a
  // worked example — and a deal is precisely where that turns into a booking
  // offer sent to a person who does not exist. It was previously only half of
  // the check: `uncastable` was tested and the cast itself was not, so a sheet
  // naming a placeholder could be won even though it could not be approved.
  const refusal = castRefusal(sheet, await listTalent());
  if (refusal) return { ok: false, why: refusal.why, detail: refusal.detail };

  // Already won: open what exists. The second press is usually the first one
  // being slow, and it must not produce a second deal for the same client.
  if (sheet.dealId) {
    const existing = await getDeal(sheet.dealId);
    if (existing) return { ok: true, dealId: existing.id, created: false };
  }

  const concepts: SoldConcept[] = sheet.chosen.map((n) => {
    const rec = sheet.recommendations.find((r) => r.conceptN === n);
    return { conceptN: n, name: sheet.copy?.[String(n)]?.name || rec?.name || `#${n}` };
  });

  const now = new Date().toISOString();
  const id = randomBytes(9).toString('base64url');

  // The sheet is marked first, on purpose. If the deal write then fails, the
  // next press finds a dealId pointing at nothing, and creates the deal
  // properly — the state heals itself. Marking second would mean a failed
  // patch leaves a real deal the sheet has forgotten, and the next press
  // creates a duplicate of it.
  await saveSheet({ ...sheet, dealId: id, wonAt: now });

  const deal: Deal = {
    id,
    sheetToken: sheet.token,
    clientName: sheet.clientName,
    clientHandle: sheet.handle,
    concepts,
    // The figure printed on the page the client actually read. Taken, not
    // recomputed: a second implementation of the same arithmetic eventually
    // disagrees with the first, and the client is holding the first.
    clientTotalJOD: sheet.offer.totalJOD,
    retainerJOD: sheet.offer.ads ? sheet.offer.adsMonthlyJOD : undefined,
    source: 'sheet',
    // Won means they agreed. Not paid — paid is the transition that tells the
    // crew who they are shooting for, and money has not arrived yet.
    status: 'signed',
    signedAt: now,
    createdAt: now, updatedAt: now,
  };
  await saveDeal(deal);

  // Quietly, and after the deal exists. A retention field that failed to clear
  // is a thing to fix next time this runs; a deal that failed to be created
  // because of it would be a job nobody can see. The sheet carries the same
  // clock as the client for the same reason — it holds more about the business
  // than the client record does — so both stop here.
  const client = await clientForSheet(sheet.token).catch(() => null);
  if (client) await clearExpiry(client.id).catch(() => {});
  await clearSheetExpiry(sheet.token).catch(() => {});

  return { ok: true, dealId: id, created: true };
}

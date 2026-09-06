import { NextResponse, after } from 'next/server';
import { opsAuthed, sameOrigin } from '@/lib/ops/auth';
import {
  addClientNote, claimForRead, currentSheetOf, enqueueForRead, getClient,
  markNotified, setClientContact, setClientOutcome, setClientVertical,
} from '@/lib/store/clients';
import { getSheet } from '@/lib/store/sheets';
import { readAndFile } from '@/lib/teardown/pipeline';
import { tellOperator } from '@/lib/notify/operator';
import { VERTICAL_LABEL, type Vertical } from '@/lib/data/concepts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Everything the console does to one account.
 *
 * It began as the two halves of a notice — `compose` tries to send and, when
 * there is no channel configured, hands back the exact text and a wa.me link
 * instead; `mark-sent` records that a human did it. They are separate calls on
 * purpose: opening WhatsApp is not sending, and a lead marked handled by a
 * click that only opened an app is a lead nobody will look at again.
 *
 * The rest are the things a person needs to be able to do to a lead that the
 * engine cannot: read it again, fix a phone number somebody mistyped, say which
 * vertical it actually is, write down what was said on the call, and record
 * that it was won or lost. None of them touch anything the engine owns — in
 * particular a re-run never rewrites contact details, which is exactly how the
 * old console-side re-read used to erase them.
 */

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// `hasOwnProperty`, not `in`: the value came off a JSON body, and
// `'constructor' in VERTICAL_LABEL` is true — which would set a vertical the
// label map cannot render and the recommender cannot match.
const asVertical = (v: unknown): Vertical | null =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(VERTICAL_LABEL, v)
    ? (v as Vertical) : null;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  if (!(await opsAuthed())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const b = await req.json().catch(() => null);
  const id = str(b?.id, 40);
  const action = str(b?.action, 40);

  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  // ── read it again ─────────────────────────────────────────────────────────
  if (action === 'rerun') {
    // A settled account is not re-read. `force` writes `reading` over whatever
    // is there, and the read that follows advances to `ready` — so re-reading a
    // won client used to turn a customer back into a lead in the queue, with no
    // record that it had happened. Refused here rather than inside the claim,
    // because the console needs to say which of the two "no" answers this is:
    // this one is settled, the other is the hourly ceiling.
    if (client.status === 'won' || client.status === 'lost') {
      return NextResponse.json({
        error: 'settled',
        message: `This account is ${client.status}. Re-reading it would put it back in the queue.`,
      }, { status: 409 });
    }

    // An operator-confirmed vertical is remembered on the account, so the next
    // read starts from the answer instead of guessing again.
    const vertical = asVertical(b?.vertical);
    if (vertical) await setClientVertical(id, vertical).catch(() => {});

    // Forced: the operator has decided, whatever the status says. `force` also
    // restarts the attempt count, so a lead that already ran out of tries is
    // not immediately retired by the sweeper again.
    const claimed = await claimForRead(id, undefined, { force: true }).catch(() => null);

    // Belt and braces either way. If the claim was refused by the global Meta
    // ceiling, this is what gets it read once the window rolls; if it was
    // granted, this is what recovers it should this instance die mid-read.
    await enqueueForRead(id).catch(() => {});

    if (!claimed) {
      return NextResponse.json({
        ok: true, queued: true, reading: false,
        note: 'The hourly read ceiling is spent. It is queued and will be read automatically.',
      });
    }

    after(async () => { await readAndFile(claimed, { vertical: vertical ?? undefined }); });
    return NextResponse.json({
      ok: true, queued: true, reading: true, readAttempts: claimed.readAttempts ?? 1,
    });
  }

  // ── what a human knows ────────────────────────────────────────────────────
  if (action === 'status') {
    const outcome = b?.status;
    if (outcome !== 'won' && outcome !== 'lost') {
      return NextResponse.json({ error: 'unknown-status' }, { status: 400 });
    }
    const updated = await setClientOutcome(id, outcome, str(b?.lostReason, 500));
    return NextResponse.json({ ok: true, client: updated });
  }

  if (action === 'note') {
    const text = str(b?.text, 2000);
    if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 });
    const by = b?.by === 'ali' || b?.by === 'khaled' ? b.by : 'system';
    const updated = await addClientNote(id, by, text);
    return NextResponse.json({ ok: true, client: updated });
  }

  if (action === 'contact') {
    const updated = await setClientContact(id, {
      contactName: str(b?.contactName, 120),
      contactPhone: str(b?.contactPhone, 40),
    });
    return NextResponse.json({ ok: true, client: updated });
  }

  if (action === 'vertical') {
    // An explicit null clears it — "I do not actually know" is a real answer
    // and must be expressible, or a wrong guess can never be taken back.
    await setClientVertical(id, asVertical(b?.vertical));
    return NextResponse.json({ ok: true, client: await getClient(id) });
  }

  // ── the two halves of a notice ────────────────────────────────────────────
  const event = b?.event;
  if (event !== 'new' && event !== 'ready' && event !== 'failed') {
    return NextResponse.json({ error: 'unknown-event' }, { status: 400 });
  }

  if (action === 'mark-sent') {
    await markNotified(id, event === 'new' ? 'new' : 'ready', 'manual');
    return NextResponse.json({ ok: true });
  }

  if (action === 'compose') {
    // The ready message names the sheet, so it needs the newest token and its
    // finding count — announcing a report without a link to it is half a message.
    const token = currentSheetOf(client);
    const sheet = event === 'ready' && token ? await getSheet(token).catch(() => null) : null;
    const notice = await tellOperator(event, client, {
      sheetToken: token ?? undefined,
      findings: sheet?.findings?.findings?.length ?? 0,
    });
    return NextResponse.json(notice);
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}

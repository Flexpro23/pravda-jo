import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getTeardown } from '@/lib/store/teardowns';
import { listDeals, saveDeal } from '@/lib/store/deals';
import { priceSelection, PACKS, type Deal, type Selection } from '@/lib/data/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A client turning their teardown into a proposal.
 *
 * The only endpoint here a stranger can reach, and the token is the whole
 * credential — whoever holds the link is the recipient, which is the same trust
 * the teardown itself runs on. Two consequences shape everything below.
 *
 * The price is recomputed from the stored report, never taken from the request.
 * A submitted total is a number the client's browser chose, and the browser is
 * a place we do not control; the concepts are addressed by index into the
 * report we already hold, so a selection can only ever refer to work that was
 * actually offered to them.
 *
 * And a resubmission updates the proposal it already made rather than filing a
 * second one. Someone changing their mind twice should not arrive in Khaled's
 * dashboard as three separate deals to chase.
 */

const clean = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = clean(body?.token, 64);

  // The specimen is a sales page. It demonstrates the configurator and must not
  // put a fictional restaurant into the pipeline.
  if (token === 'sample') {
    return NextResponse.json({ error: 'specimen' }, { status: 400 });
  }

  const report = await getTeardown(token).catch(() => null);
  // getTeardown already refuses drafts, so an unfinished teardown cannot be
  // converted into a deal by someone who guessed at its link.
  if (!report) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  const raw = body?.selection ?? {};
  const perMonthRaw = Number(raw.perMonth) || 0;
  const selection: Selection = {
    concepts: Array.isArray(raw.concepts)
      ? [...new Set<number>(raw.concepts.map((x: unknown) => Number(x)))]
        .filter((i: number) => Number.isInteger(i) && i >= 0 && i < report.concepts.length)
      : [],
    perMonth: (PACKS as readonly number[]).includes(perMonthRaw)
      ? (perMonthRaw as Selection['perMonth']) : 0,
    ads: !!raw.ads,
  };

  const contactName = clean(body?.contactName, 120);
  const contactPhone = clean(body?.contactPhone, 40);
  if (!contactName || !contactPhone) {
    return NextResponse.json({ error: 'contact' }, { status: 400 });
  }
  if (!selection.concepts.length && !selection.perMonth && !selection.ads) {
    return NextResponse.json({ error: 'empty' }, { status: 400 });
  }

  const { onceJOD, monthlyJOD } = priceSelection(
    selection, report.concepts.map((c) => c.price),
  );

  const now = new Date().toISOString();
  // One proposal per teardown. A client who reconsiders is editing, not
  // queueing another thing for someone to chase.
  const prior = (await listDeals(200).catch(() => []))
    .find((d) => d.teardownToken === token && d.source === 'configurator');

  const deal: Deal = {
    id: prior?.id ?? randomBytes(9).toString('base64url'),
    teardownToken: token,
    clientName: report.client.en || report.client.ar,
    concepts: selection.concepts.map((i) => ({
      conceptN: i + 1,
      name: report.concepts[i].name.en || report.concepts[i].name.ar,
      priceJOD: report.concepts[i].price,
    })),
    clientTotalJOD: onceJOD,
    retainerJOD: monthlyJOD || undefined,
    perMonth: selection.perMonth || undefined,
    selection,
    source: 'configurator',
    contactName, contactPhone,
    // A proposal is where the pipeline starts. Nothing here signs anything, and
    // a client resubmitting must never reset a deal Khaled has already moved on.
    status: prior && prior.status !== 'proposed' ? prior.status : 'proposed',
    createdAt: prior?.createdAt ?? now,
    updatedAt: now,
  };

  await saveDeal(deal);
  // Confirm with the figures the SERVER computed, so the page cannot end up
  // showing a total the deal does not actually hold.
  return NextResponse.json({ ok: true, onceJOD, monthlyJOD, updated: !!prior });
}

/** Read back a proposal already made, so returning to the link shows it. */
export async function GET(req: Request) {
  const token = clean(new URL(req.url).searchParams.get('token'), 64);
  if (!token || token === 'sample') return NextResponse.json({ selection: null });
  const prior = (await listDeals(200).catch(() => []))
    .find((d) => d.teardownToken === token && d.source === 'configurator');
  return NextResponse.json({
    selection: prior?.selection ?? null,
    contactName: prior?.contactName ?? null,
    status: prior?.status ?? null,
  });
}

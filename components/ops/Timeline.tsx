import type { Client } from '@/lib/data/clients';
import type { Sheet } from '@/lib/store/sheets';
import type { Deal } from '@/lib/data/deals';

/**
 * Where this account actually got to.
 *
 * Built entirely from timestamps that already exist on `Client`, `Sheet` and
 * `Deal` — there is no event collection behind it and there should not be. A
 * separate log of what happened would be a second version of the truth, free
 * to disagree with the record it describes, and the first argument about which
 * one is right is an argument nobody can win.
 *
 * A step with no timestamp is greyed rather than hidden: the gap is the
 * information. "Approved, never sent" is a sentence this row shape says without
 * writing it down.
 */

const when = (iso?: string) => (iso ? iso.slice(0, 10) : null);

export default function Timeline({
  client, sheet, deal,
}: { client: Client; sheet?: Sheet | null; deal?: Deal | null }) {
  const steps: { label: string; at: string | null; note?: string }[] = [
    { label: 'Arrived', at: when(client.createdAt), note: `via ${client.source}` },
    { label: 'Khaled told', at: when(client.notifiedNewAt), note: client.lastNotifyChannel },
    {
      label: 'Read',
      at: when(sheet?.createdAt),
      note: sheet ? `${sheet.signals?.posts ?? 0} posts` : undefined,
    },
    {
      label: 'Sheet ready',
      at: when(client.notifiedReadyAt ?? (client.status === 'ready' ? client.updatedAt : undefined)),
      note: sheet ? `${sheet.chosen?.length ?? 0}/3 chosen` : undefined,
    },
    { label: 'Approved', at: when(sheet?.approvedAt) },
    { label: 'Sent', at: when(sheet?.sentAt) },
    {
      label: 'Opened',
      at: when(sheet?.openedAt),
      note: sheet?.openCount ? `${sheet.openCount} time${sheet.openCount === 1 ? '' : 's'}` : undefined,
    },
  ];

  // The end is one of two and never both. `lostReason` is shown because a
  // reason nobody can read is a reason nobody wrote down.
  if (client.status === 'lost') {
    steps.push({ label: 'Lost', at: when(client.updatedAt), note: client.lostReason });
  } else {
    steps.push({
      label: 'Won',
      at: when(deal?.signedAt ?? sheet?.wonAt ?? (client.status === 'won' ? client.updatedAt : undefined)),
      note: deal ? `${deal.clientTotalJOD} JOD` : undefined,
    });
  }

  return (
    <ol className="tline">
      {steps.map((s) => (
        <li key={s.label} data-done={!!s.at}>
          <span className="tline-l">{s.label}</span>
          <span className="tline-d mono">{s.at ?? '—'}</span>
          {s.note && s.at && <span className="tline-n" dir="auto">{s.note}</span>}
        </li>
      ))}
    </ol>
  );
}

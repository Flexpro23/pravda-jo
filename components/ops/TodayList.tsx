'use client';

import Link from 'next/link';
import { ago, type Task } from '@/lib/ops/today';
import TaskAction from '@/components/ops/TaskAction';

/**
 * The queue, as cards.
 *
 * No table. A table is a thing you read across; this is a thing you act on, one
 * row at a time, usually with a thumb. Every card carries the one action that
 * makes it go away where such an action exists, so the common case is a single
 * tap rather than a tap to open a page and a hunt for the button on it.
 */

const KIND_LABEL: Record<Task['kind'], string> = {
  'read-failed': 'read failed',
  'tell-new': 'new lead',
  'read-stuck': 'stalled',
  'tell-ready': 'read done',
  'review-sheet': 'review',
  'send-sheet': 'unsent',
  'chase-sheet': 'chase',
  collect: 'money',
  'tell-booking': 'crew',
  'mark-done': 'crew',
  'pay-crew': 'pay',
};

/** Which cards are red rather than amber. Losing a lead outranks owing a day. */
const HOT: Task['kind'][] = ['read-failed', 'tell-new', 'read-stuck', 'tell-ready'];

export default function TodayList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <p className="allclear">
        All clear. Nobody is waiting on a message, no sheet is half-reviewed and
        nobody is owed money.
      </p>
    );
  }

  return (
    <ul className="cards">
      {tasks.map((t, i) => (
        <li
          className="card"
          key={`${t.kind}:${t.clientId ?? t.sheetToken ?? t.bookingId ?? t.dealId ?? i}`}
          data-hot={HOT.includes(t.kind)}
        >
          <div className="card-head">
            <span className="pill" data-s={HOT.includes(t.kind) ? 'warn' : 'draft'}>
              {KIND_LABEL[t.kind]}
            </span>
            <span className="sp" />
            <span className="muted mono">{ago(t.ageMins)}</span>
          </div>
          {/* A business name, a person's name, or Arabic copy — all three reach
              this line and only the text knows which way it runs. */}
          <Link className="card-title" href={t.href} dir="auto">{t.title}</Link>
          <p className="card-sub" dir="auto">{t.sub}</p>
          <TaskAction task={t} />
        </li>
      ))}
    </ul>
  );
}

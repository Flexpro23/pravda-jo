'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VERTICAL_LABEL, type Vertical } from '@/lib/data/concepts';
import { explain, OFFLINE } from '@/lib/ops/errors';
import { reauthAction, useToast } from '@/components/ops/Toast';

const VERTICALS = Object.keys(VERTICAL_LABEL) as Vertical[];

/**
 * A handle, a website, and what the business actually is.
 *
 * The vertical is the third field because the recommender takes one and nothing
 * in the product ever set it: the public form does not ask, so every sheet was
 * scored with `vertical: null` and lost the trade bonus that makes a shortlist
 * feel chosen rather than generic. Blank is still allowed and still honest —
 * the engine guesses, stores the guess, and the sheet page is where it gets
 * confirmed once somebody has actually looked.
 */
export default function RunHandle() {
  const [handle, setHandle] = useState('');
  const [site, setSite] = useState('');
  const [vertical, setVertical] = useState<Vertical | ''>('');
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const router = useRouter();

  const run = async () => {
    if (!handle.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/ops/sheet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'run', handle, website: site, vertical: vertical || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        push({
          kind: 'err', text: explain(j.error, j),
          action: j.error === 'unauthenticated' ? reauthAction() : { label: 'Retry', onClick: run },
        });
      } else {
        setHandle(''); setSite('');
        push({
          kind: 'ok',
          text: `Read ${j.posts} posts${j.site ? ' and their website' : j.siteProblem ? ` (site: ${j.siteProblem})` : ''}`
            + ` · ${j.findings} findings · five ideas ready.`,
        });
        router.push(`/ops/sheet/${j.token}`);
      }
    } catch {
      push({ kind: 'err', text: OFFLINE, action: { label: 'Retry', onClick: run } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div className="run">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
          placeholder="@handle to read"
          aria-label="Instagram handle to read"
          autoComplete="off" autoCapitalize="none" spellCheck={false}
          disabled={busy}
        />
        <input
          value={site} onChange={(e) => setSite(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
          placeholder="their website (optional)"
          aria-label="Website to read"
          autoComplete="off" autoCapitalize="none" spellCheck={false}
          disabled={busy}
        />
        <select
          className="sel" value={vertical} disabled={busy}
          aria-label="What kind of business this is"
          onChange={(e) => setVertical(e.target.value as Vertical | '')}
        >
          <option value="">what they are — let it guess</option>
          {VERTICALS.map((v) => (
            <option key={v} value={v}>{VERTICAL_LABEL[v].en}</option>
          ))}
        </select>
        <button className="go" onClick={run} disabled={busy || !handle.trim()}>
          {busy ? 'Reading…' : 'Read'}
        </button>
      </div>
    </div>
  );
}

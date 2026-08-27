'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Every failure the read can return, said the way an operator needs to hear it. */
const EXPLAIN: Record<string, string> = {
  unreadable:
    'Could not read that account. Personal, misspelled, renamed and deleted all '
    + 'return the same error from Meta, so there is no way to tell which.',
  'too-few-posts':
    'Too few posts to say anything defensible. Nothing was stored.',
  'no-data':
    'The account reports posts but returned none — that is our token, not their '
    + 'account. Check whether it has passed data_access_expires_at.',
  unauthorised:
    'Meta refused our token. Check it is the Pravda app token, not the Wasla one.',
  unauthenticated: 'The console session expired. Reload and sign in again.',
  throttled: 'Meta’s hourly budget is nearly spent. Try again shortly.',
  handle: 'That is not a valid Instagram handle.',
};

export default function RunHandle() {
  const [handle, setHandle] = useState('');
  const [site, setSite] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  const router = useRouter();

  const run = async (force: boolean) => {
    if (!handle.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/ops/sheet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'run', handle, website: site }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg({ k: 'err', t: EXPLAIN[j.error] ?? j.hint ?? `Failed: ${j.error}` });
      } else if (j.reused) {
        setMsg({
          k: 'ok',
          t: `Already read — showing the existing ${j.status}. Use "Read again" to spend a fresh call.`,
        });
        router.refresh();
      } else {
        setHandle(''); setSite('');
        setMsg({
          k: 'ok',
          t: `Read ${j.posts} posts${j.site ? ' and their website' : j.siteProblem ? ` (site: ${j.siteProblem})` : ''}`
            + ` · ${j.findings} findings · five ideas ready.`,
        });
        router.push(`/ops/sheet/${j.token}`);
      }
    } catch {
      setMsg({ k: 'err', t: 'The request did not complete.' });
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
          onKeyDown={(e) => { if (e.key === 'Enter') run(false); }}
          placeholder="@handle to read"
          aria-label="Instagram handle to read"
          autoComplete="off" autoCapitalize="none" spellCheck={false}
          disabled={busy}
        />
        <input
          value={site} onChange={(e) => setSite(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(false); }}
          placeholder="their website (optional)"
          aria-label="Website to read"
          autoComplete="off" autoCapitalize="none" spellCheck={false}
          disabled={busy}
        />
        <button className="go" onClick={() => run(false)} disabled={busy || !handle.trim()}>
          {busy ? 'Reading…' : 'Read'}
        </button>

      </div>
      {msg && <p className="note" data-k={msg.k}>{msg.t}</p>}
    </div>
  );
}

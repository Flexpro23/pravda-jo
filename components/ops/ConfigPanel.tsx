'use client';

import { useState } from 'react';
import type { ConfigRow } from '@/lib/config/check';
import { explain, OFFLINE } from '@/lib/ops/errors';

/**
 * What this deployment is actually configured to do.
 *
 * Presence only — never a value, never a prefix, never a length. `check.ts`
 * makes that guarantee on the server and this panel is the reason it has to:
 * a console row showing the first four characters of a token is a token leaked
 * over somebody's shoulder.
 *
 * Only what is missing is listed. A complete configuration is one green line,
 * because a wall of ticks trains the eye to skip the one cross in it.
 */
export default function ConfigPanel({ rows }: { rows: ConfigRow[] }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);

  const critical = rows.filter((r) => r.severity === 'critical' && !r.present);
  const degraded = rows.filter((r) => r.severity === 'degraded' && !r.present);

  const check = async () => {
    setChecking(true); setResult(null);
    try {
      const res = await fetch('/api/ops/selfcheck', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setResult({ k: 'err', t: explain(j.error, j) }); return; }
      setResult(j.ok
        ? {
          k: 'ok',
          t: `The token read @${j.handle}.`
            + (typeof j.usage === 'number' ? ` Meta says ${j.usage}% of the hour is spent.` : ''),
        }
        : { k: 'err', t: explain(j.reason, j) });
    } catch { setResult({ k: 'err', t: OFFLINE }); } finally { setChecking(false); }
  };

  return (
    <section className="blk cfgpanel">
      <h2>Configuration</h2>
      {critical.length === 0 && degraded.length === 0 ? (
        <p className="hint" style={{ color: 'var(--go)' }}>
          Everything critical and everything degradable is set.
        </p>
      ) : (
        <ul className="cfgrows">
          {[...critical, ...degraded].map((r) => (
            <li key={r.key} data-sev={r.severity}>
              <span className="mono">{r.key}</span>
              <span>{r.whatBreaks}</span>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" onClick={check} disabled={checking}>
          {checking ? 'Asking Meta…' : 'Check the Meta token'}
        </button>
      </div>
      {result && <p className="note" data-k={result.k} style={{ marginTop: 12 }}>{result.t}</p>}
    </section>
  );
}

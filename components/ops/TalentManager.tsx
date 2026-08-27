'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AVAILABILITY_LABEL, DISCIPLINE_RATE, rateIsSet,
  type Talent, type TalentDiscipline,
} from '@/lib/data/deals';

const DISCIPLINES = Object.keys(DISCIPLINE_RATE) as TalentDiscipline[];

export default function TalentManager({ talent }: { talent: Talent[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  /** Shown once, right after issuing. Never fetched back — it is not stored. */
  const [code, setCode] = useState<{ who: string; code: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ nameEn: '', nameAr: '', discipline: 'videographer' as TalentDiscipline, phone: '', dayRateJOD: '' });
  const router = useRouter();

  const call = async (body: Record<string, unknown>) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/ops/talent', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { setMsg({ k: 'err', t: `Failed: ${j.error}` }); return null; }
      router.refresh();
      return j;
    } catch { setMsg({ k: 'err', t: 'The request did not complete.' }); return null; }
    finally { setBusy(false); }
  };

  const create = async () => {
    const j = await call({ action: 'create', ...f, dayRateJOD: f.dayRateJOD || undefined });
    if (j?.code) {
      setCode({ who: f.nameEn, code: j.code });
      setF({ nameEn: '', nameAr: '', discipline: 'videographer', phone: '', dayRateJOD: '' });
      setOpen(false);
    }
  };

  return (
    <>
      {code && (
        <div className="note" data-k="ok" style={{ marginBottom: 18 }}>
          <strong>{code.who}</strong>&rsquo;s sign-in code is{' '}
          <span className="mono" style={{ fontSize: 20, letterSpacing: '.18em' }}>{code.code}</span>
          {' '}— give it to them now. It is stored hashed, so this is the only
          time it can be read. If it is lost, reissue rather than recover.
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setCode(null)}>Got it</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <button className="go" onClick={() => setOpen((o) => !o)}>
          {open ? 'Cancel' : 'Add someone'}
        </button>
      </div>

      {open && (
        <section className="blk">
          <h2>New provider</h2>
          <div className="pair">
            <div>
              <label>Name — EN</label>
              <input value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
            </div>
            <div>
              <label>Name — AR</label>
              <input dir="rtl" value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} />
            </div>
          </div>
          <div className="pair">
            <div>
              <label>Discipline</label>
              <select
                value={f.discipline}
                onChange={(e) => setF({ ...f, discipline: e.target.value as TalentDiscipline })}
                style={{
                  width: '100%', background: '#191919', color: 'var(--ink)',
                  border: '1px solid var(--line)', borderRadius: 6, padding: '9px 11px',
                }}
              >
                {DISCIPLINES.map((d) => (
                  <option key={d} value={d}>
                    {d}{rateIsSet(d) ? ` — ${DISCIPLINE_RATE[d]} JOD/day` : ' — no published rate'}
                  </option>
                ))}
              </select>
              {!rateIsSet(f.discipline) && (
                <p className="hint todo" style={{ marginTop: 6 }}>
                  There is no rate card entry for this discipline, so nothing
                  booking them can be priced. Set a day rate below, or set the
                  published rate first.
                </p>
              )}
            </div>
            <div>
              <label>Day rate — JOD (what PRAVDA pays)</label>
              <input
                type="number" min={0} value={f.dayRateJOD}
                placeholder={String(DISCIPLINE_RATE[f.discipline] || '')}
                onChange={(e) => setF({ ...f, dayRateJOD: e.target.value })}
              />
            </div>
          </div>
          <div className="pair">
            <div>
              <label>Phone</label>
              <input dir="ltr" className="mono" value={f.phone}
                     onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
          </div>
          <button className="go" disabled={busy || !f.nameEn || !f.nameAr} onClick={create}>
            Add and issue a code
          </button>
        </section>
      )}

      {msg && <p className="note" data-k={msg.k}>{msg.t}</p>}

      {talent.length === 0 ? (
        <p className="muted">
          Nobody on the roster. The cast page is showing worked examples until
          there is.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Discipline</th><th>Day rate</th>
              <th>Availability</th><th>Phone</th><th />
            </tr>
          </thead>
          <tbody>
            {talent.map((t) => (
              <tr key={t.id} style={t.active ? undefined : { opacity: 0.45 }}>
                <td>{t.name.en}<span className="muted"> · {t.name.ar}</span></td>
                <td className="muted">{t.discipline}</td>
                <td className="mono">{t.dayRateJOD} JOD</td>
                <td><span className="pill">{AVAILABILITY_LABEL[t.availability].en}</span></td>
                <td className="mono muted">{t.phone || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button disabled={busy} onClick={async () => {
                    const j = await call({ action: 'reissue', id: t.id });
                    if (j?.code) setCode({ who: t.name.en, code: j.code });
                  }}>Reissue code</button>
                  <button disabled={busy} style={{ marginInlineStart: 8 }}
                          onClick={() => call({ action: 'update', id: t.id, active: !t.active })}>
                    {t.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewDeal({ tokens }: { tokens: { token: string; handle: string; client: string }[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ clientName: '', clientHandle: '', clientPhone: '', clientTotalJOD: '', retainerJOD: '', teardownToken: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const create = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/ops/deal', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...f, clientTotalJOD: Number(f.clientTotalJOD) || 0, retainerJOD: Number(f.retainerJOD) || undefined }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg(`Failed: ${j.error}`); return; }
      router.push(`/ops/deals/${j.id}`);
    } catch { setMsg('The request did not complete.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <button className="go" onClick={() => setOpen((o) => !o)}>{open ? 'Cancel' : 'New deal'}</button>
      {open && (
        <section className="blk" style={{ marginTop: 14 }}>
          <h2>New deal</h2>
          <p className="hint">
            Attach the teardown it came out of where there is one — it is the
            only record of what was promised.
          </p>
          <div className="pair">
            <div>
              <label>Client name</label>
              <input value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} />
            </div>
            <div>
              <label>Instagram handle</label>
              <input dir="ltr" className="mono" value={f.clientHandle}
                     onChange={(e) => setF({ ...f, clientHandle: e.target.value })} />
            </div>
          </div>
          <div className="pair">
            <div>
              <label>Client total — JOD</label>
              <input type="number" min={0} value={f.clientTotalJOD}
                     onChange={(e) => setF({ ...f, clientTotalJOD: e.target.value })} />
            </div>
            <div>
              <label>Retainer / month — JOD</label>
              <input type="number" min={0} placeholder="400" value={f.retainerJOD}
                     onChange={(e) => setF({ ...f, retainerJOD: e.target.value })} />
            </div>
          </div>
          <div className="pair">
            <div>
              <label>Phone</label>
              <input dir="ltr" className="mono" value={f.clientPhone}
                     onChange={(e) => setF({ ...f, clientPhone: e.target.value })} />
            </div>
            <div>
              <label>From which teardown</label>
              <select value={f.teardownToken}
                      onChange={(e) => {
                        const t = tokens.find((x) => x.token === e.target.value);
                        setF({ ...f, teardownToken: e.target.value, clientName: f.clientName || t?.client || '', clientHandle: f.clientHandle || t?.handle || '' });
                      }}
                      style={{ width: '100%', background: '#191919', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '9px 11px' }}>
                <option value="">— none —</option>
                {tokens.map((t) => <option key={t.token} value={t.token}>@{t.handle} · {t.client}</option>)}
              </select>
            </div>
          </div>
          <button className="go" disabled={busy || !f.clientName} onClick={create}>Create</button>
          {msg && <p className="note" data-k="err">{msg}</p>}
        </section>
      )}
    </div>
  );
}

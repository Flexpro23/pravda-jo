'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { explain, OFFLINE } from '@/lib/ops/errors';
import { reauthAction, useToast } from '@/components/ops/Toast';

/**
 * A deal typed in by hand.
 *
 * Almost every deal now arrives by winning a sheet, which carries its own
 * numbers across. This is the escape hatch for the ones that do not — a job
 * agreed on a call before anything was read.
 */
export default function NewDeal() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    clientName: '', clientHandle: '', clientPhone: '',
    clientTotalJOD: '', retainerJOD: '',
  });
  const { push } = useToast();
  const router = useRouter();

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/ops/deal', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...f, clientTotalJOD: Number(f.clientTotalJOD) || 0, retainerJOD: Number(f.retainerJOD) || undefined }),
      });
      const j = await res.json();
      if (!res.ok) {
        push({
          kind: 'err', text: explain(j.error, j),
          action: j.error === 'unauthenticated' ? reauthAction() : { label: 'Retry', onClick: create },
        });
        return;
      }
      router.push(`/ops/deals/${j.id}`);
    } catch {
      push({ kind: 'err', text: OFFLINE, action: { label: 'Retry', onClick: create } });
    }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <button className="go" onClick={() => setOpen((o) => !o)}>{open ? 'Cancel' : 'New deal'}</button>
      {open && (
        <section className="blk" style={{ marginTop: 14 }}>
          <h2>New deal</h2>
          <p className="hint">
            For a job agreed before anything was read. Everything else gets here
            by winning a sheet, which brings its own figures with it.
          </p>
          <div className="pair">
            <div>
              <label>Client name</label>
              <input value={f.clientName} dir="auto"
                     onChange={(e) => setF({ ...f, clientName: e.target.value })} />
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
          </div>
          <button className="go" disabled={busy || !f.clientName} onClick={create}>Create</button>
        </section>
      )}
    </div>
  );
}

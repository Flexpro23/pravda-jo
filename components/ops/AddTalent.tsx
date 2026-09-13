'use client';

import { useEffect, useRef, useState } from 'react';
import { DISCIPLINE_RATE, rateIsSet, type TalentDiscipline } from '@/lib/data/deals';
import { fieldsFor, type Attributes } from '@/lib/data/talentFields';
import { CONSENT_DEFAULT_MONTHS, IMAGE_MAX_PER_PERSON } from '@/lib/data/media';
import { explain, OFFLINE } from '@/lib/ops/errors';
import { reauthAction, useToast } from '@/components/ops/Toast';
import DisciplineTabs, { DISCIPLINE_NAME } from '@/components/ops/DisciplineTabs';
import CompCardFields from '@/components/ops/CompCardFields';

/**
 * Adding a person, in one sheet.
 *
 * It used to be four places: a form to create them, then their row, then a
 * consent card, then an upload control, then a comp card to type. The tedious
 * part was never the clicking — it was typing eight numbers off a WhatsApp
 * photo of their card. So the sheet starts with the card: drop a picture of
 * it, a model reads the fields in whatever order and language the agency
 * wrote them, and the form fills itself. Every read value lands in an
 * editable field for the operator to check; nothing is stored until Save.
 *
 * Three steps, in the order of the obligation:
 *   1. What they do, and their card if there is one.
 *   2. Who they are — prefilled from the card — and the card's fields.
 *   3. What they agreed to, then their photos. Photos cannot be kept without
 *      the first agreement, so it is asked for before the picker opens.
 *
 * Save is four calls to the same endpoints the rest of the console uses —
 * create, consent, upload, comp card — rather than one new "do everything"
 * route. If a later one fails the person still exists, and the sheet says so
 * and points at their row, rather than pretending nothing happened.
 */

type Step = 1 | 2 | 3;

export default function AddTalent({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (r: { who: string; code: string }) => void;
}) {
  const { push } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [discipline, setDiscipline] = useState<TalentDiscipline>('model');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState('');
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [card, setCard] = useState<{ name: string; read: number } | null>(null);
  const [reading, setReading] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [months, setMonths] = useState(String(CONSENT_DEFAULT_MONTHS));
  const [photos, setPhotos] = useState<File[]>([]);
  const [failed, setFailed] = useState<{ id: string; at: string } | null>(null);
  const cardRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // Escape closes; the page behind does not scroll while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, busy, onClose]);

  if (!open) return null;

  const reset = () => {
    setStep(1); setDiscipline('model'); setNameEn(''); setNameAr(''); setPhone(''); setRate('');
    setAttrs({}); setNotes({}); setCard(null); setEvidence(''); setMonths(String(CONSENT_DEFAULT_MONTHS));
    setPhotos([]); setFailed(null);
  };
  const close = () => { if (!busy) { reset(); onClose(); } };

  const fail = (j: { error?: string; detail?: string }) =>
    push({ kind: 'err', text: j.detail ?? explain(j.error ?? 'unknown', j),
           ...(j.error === 'unauthenticated' ? { action: reauthAction() } : {}) });

  /** Drop a picture of their card; the fields fill themselves. */
  const readCard = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const form = new FormData();
      form.set('file', file); form.set('discipline', discipline);
      const res = await fetch('/api/ops/talent/card', { method: 'POST', body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { fail(j); return; }
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(j.attributes as Attributes)) {
        next[k] = Array.isArray(v) ? v.join(', ') : String(v);
      }
      setAttrs((a) => ({ ...a, ...next }));
      // Only the first-read value is kept for a name or number the operator
      // may have typed already; a card never overwrites a person's own entry.
      if (j.name?.en && !nameEn) setNameEn(j.name.en);
      if (j.name?.ar && !nameAr) setNameAr(j.name.ar);
      if (j.phone && !phone) setPhone(j.phone);
      const n: Record<string, string> = {};
      for (const line of (j.unread as string[]) ?? []) {
        const label = line.split(':')[0];
        const f = fieldsFor(discipline).find((x) => x.label.en === label);
        if (f) n[f.key] = `${line.slice(label.length + 2)} — check the card`;
      }
      setNotes(n);
      setCard({ name: file.name, read: Object.keys(next).length });
      push({ kind: 'ok', text: `Read ${Object.keys(next).length} field${Object.keys(next).length === 1 ? '' : 's'} off the card${Object.keys(n).length ? `, ${Object.keys(n).length} to check` : ''}.` });
    } catch {
      push({ kind: 'err', text: OFFLINE });
    } finally {
      setReading(false);
      if (cardRef.current) cardRef.current.value = '';
    }
  };

  const post = async (url: string, body: Record<string, unknown> | FormData) => {
    const isForm = body instanceof FormData;
    const res = await fetch(url, {
      method: 'POST',
      ...(isForm ? {} : { headers: { 'content-type': 'application/json' } }),
      body: isForm ? body : JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    return { ok: res.ok, j };
  };

  const wantPhotos = photos.length > 0;
  const consentOk = evidence.trim().length >= 8;

  const save = async () => {
    setBusy(true);
    try {
      // 1. the person
      const created = await post('/api/ops/talent', {
        action: 'create', nameEn, nameAr, discipline, phone, dayRateJOD: rate || undefined,
      });
      if (!created.ok) { fail(created.j); return; }
      const id: string = created.j.id;
      const code: string = created.j.code;

      // 2. the comp card, if anything is on it
      const filled = Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== ''));
      if (Object.keys(filled).length) {
        const r = await post('/api/ops/talent/media', { action: 'attributes', talentId: id, attributes: filled });
        if (!r.ok) { fail(r.j); setFailed({ id, at: 'their comp card' }); onCreated({ who: nameEn, code }); return; }
      }

      // 3. consent, then photos — in that order, because the upload refuses without it
      if (wantPhotos) {
        const c = await post('/api/ops/talent/media', {
          action: 'consent', talentId: id, purpose: 'roster', evidence, months: Number(months),
        });
        if (!c.ok) { fail(c.j); setFailed({ id, at: 'their consent' }); onCreated({ who: nameEn, code }); return; }
        const form = new FormData();
        form.set('talentId', id);
        for (const f of photos) form.append('file', f);
        const u = await post('/api/ops/talent/media', form);
        const results = (u.j.results ?? []) as { name: string; ok: boolean; why?: string }[];
        const bad = results.filter((r) => !r.ok);
        if (bad.length) push({ kind: 'err', text: `${bad.length} photo${bad.length === 1 ? '' : 's'} refused: ${bad.map((b) => `${b.name} (${b.why})`).join(', ')}` });
        if (!u.ok && bad.length === results.length) { setFailed({ id, at: 'their photos' }); onCreated({ who: nameEn, code }); return; }
      }

      push({ kind: 'ok', text: `${nameEn} added${wantPhotos ? ` with ${photos.length} photo${photos.length === 1 ? '' : 's'}` : ''}.` });
      onCreated({ who: nameEn, code });
      reset();
    } catch {
      push({ kind: 'err', text: OFFLINE });
    } finally {
      setBusy(false);
    }
  };

  const canNext = step === 1 ? true : step === 2 ? !!nameEn.trim() && !!nameAr.trim() : (!wantPhotos || consentOk);

  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
        <div className="modal-head">
          <h2 id="add-title">Add someone</h2>
          <ol className="steps" aria-label="Steps">
            {(['Card', 'Who', 'Photos'] as const).map((s, i) => (
              <li key={s} data-on={step === i + 1} data-done={step > i + 1}>{s}</li>
            ))}
          </ol>
          <button type="button" className="modal-x" aria-label="Close" disabled={busy} onClick={close}>×</button>
        </div>

        <div className="modal-body">
          {failed && (
            <p className="note" data-k="warn">
              {nameEn} was added, but saving {failed.at} failed. Close this and continue from their
              row — nothing needs re-typing.
            </p>
          )}

          {step === 1 && (
            <>
              <label className="dtabs-label">What do they do</label>
              <DisciplineTabs name="add-discipline" value={discipline} disabled={busy || reading}
                              onChange={(d) => { setDiscipline(d); setAttrs({}); setNotes({}); setCard(null); }} />
              {!rateIsSet(discipline) && (
                <p className="hint todo">No published rate for this trade yet. They can be added and
                  profiled now; set a day rate before they can be booked.</p>
              )}

              <div className="drop" data-busy={reading}>
                <input ref={cardRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
                       onChange={(e) => readCard(e.target.files?.[0])} />
                <p className="drop-lead">Have their comp card?</p>
                <p className="hint">Add a photo or screenshot of it — the fields can be in any order,
                  Arabic or English — and the form fills itself. You check every number before it is saved.</p>
                <button type="button" disabled={busy || reading} onClick={() => cardRef.current?.click()}>
                  {reading ? 'Reading the card…' : card ? 'Read a different card' : 'Add a picture of the card'}
                </button>
                {card && <p className="hint">Read {card.read} field{card.read === 1 ? '' : 's'} from <span className="mono">{card.name}</span>.</p>}
              </div>
              <p className="hint">No card? Just continue and type what you know.</p>
            </>
          )}

          {step === 2 && (
            <>
              <div className="pair">
                <div>
                  <label>Name — EN</label>
                  <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} disabled={busy} autoFocus />
                </div>
                <div>
                  <label>Name — AR</label>
                  <input value={nameAr} dir="rtl" onChange={(e) => setNameAr(e.target.value)} disabled={busy} />
                </div>
              </div>
              <div className="pair">
                <div>
                  <label>Phone</label>
                  <input value={phone} dir="ltr" className="mono" onChange={(e) => setPhone(e.target.value)} disabled={busy} />
                </div>
                <div>
                  <label>Day rate — JOD (what PRAVDA pays)</label>
                  <input type="number" min={0} value={rate} placeholder={String(DISCIPLINE_RATE[discipline] || '')}
                         onChange={(e) => setRate(e.target.value)} disabled={busy} />
                </div>
              </div>
              <label className="dtabs-label">Comp card{card ? ' — read from the picture, check it' : ''}</label>
              <CompCardFields discipline={discipline} idPrefix="add" disabled={busy} values={attrs} notes={notes}
                              onChange={(k, v) => { setAttrs((a) => ({ ...a, [k]: v })); setNotes((n) => { const { [k]: _gone, ...rest } = n; return rest; }); }} />
            </>
          )}

          {step === 3 && (
            <>
              <label className="dtabs-label">Their photos</label>
              <div className="drop">
                <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
                       onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, IMAGE_MAX_PER_PERSON))} />
                <button type="button" disabled={busy} onClick={() => photoRef.current?.click()}>
                  {photos.length ? `${photos.length} chosen — change` : 'Choose photos'}
                </button>
                <p className="hint">Up to {IMAGE_MAX_PER_PERSON}. The first becomes their profile picture; change it any time from their row.</p>
                {photos.length > 0 && (
                  <ul className="drop-list">{photos.map((f) => <li key={f.name} className="mono">{f.name}</li>)}</ul>
                )}
              </div>

              {wantPhotos && (
                <div className="lib-form" style={{ borderTop: 0, marginTop: 14 }}>
                  <label>How they agreed to us keeping their photos</label>
                  <input value={evidence} dir="auto" placeholder="Signed release, 13 Sep 2026, in the shared drive"
                         onChange={(e) => setEvidence(e.target.value)} disabled={busy} />
                  <label>For how long</label>
                  <select className="sel" value={months} onChange={(e) => setMonths(e.target.value)} disabled={busy}>
                    {[3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} months</option>)}
                  </select>
                  <p className="hint">Photos cannot be kept without this. Say how it was given, so it can be found later.</p>
                </div>
              )}
              {!wantPhotos && <p className="hint">No photos yet is fine — add them from their row later.</p>}
            </>
          )}
        </div>

        <div className="modal-foot">
          {step > 1 ? <button type="button" disabled={busy} onClick={() => setStep((s) => (s - 1) as Step)}>Back</button> : <span />}
          <span className="sp" />
          {step < 3 ? (
            <button type="button" className="go" disabled={busy || reading || !canNext}
                    onClick={() => setStep((s) => (s + 1) as Step)}>
              {step === 1 ? (card ? 'Check the details' : 'Continue') : 'Continue to photos'}
            </button>
          ) : (
            <button type="button" className="go" disabled={busy || !canNext} onClick={save}>
              {busy ? 'Saving…' : wantPhotos ? `Add ${DISCIPLINE_NAME[discipline].toLowerCase()} with ${photos.length} photo${photos.length === 1 ? '' : 's'}` : `Add ${DISCIPLINE_NAME[discipline].toLowerCase()}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Talent } from '@/lib/data/deals';
import { fieldsFor, type Attributes, type Field } from '@/lib/data/talentFields';
import CompCardFields from '@/components/ops/CompCardFields';
import {
  PURPOSES, PURPOSE_LABEL, CONSENT_DEFAULT_MONTHS, IMAGE_MAX_PER_PERSON,
  consentLive, latestConsent, mayShow, type Purpose,
} from '@/lib/data/media';
import { explain, OFFLINE } from '@/lib/ops/errors';
import { reauthAction, useToast } from '@/components/ops/Toast';

/**
 * One person's library entry: what they agreed to, their photographs, and
 * their comp card — in that order.
 *
 * Consent sits above the photos on purpose. The order is the order of the
 * obligation — nobody's photos should be uploaded before there is an agreement
 * to hold them — and a screen that put the upload button first would teach the
 * opposite habit. It is kept to one compact strip so that it states the rule
 * without crowding out the work.
 *
 * Without `roster` consent the photos are shown as a count and nothing else.
 * That is not the console being awkward: it is exactly what an operator should
 * see the day somebody withdraws, and building it that way from the start
 * means a withdrawal never needs special handling on any screen.
 *
 * The comp card is laid out by group — measurements, sizes, look, what they
 * are good for — the way the trade reads one, with the unit printed inside the
 * field so a row of numbers reads as a row of numbers.
 */

const fmt = (iso?: string) => (iso ? iso.slice(0, 10) : '');

type UploadRow = { name: string; ok: boolean; why?: string };

const UPLOAD_WHY: Record<string, string> = {
  'too-large': 'over 10 MB',
  'wrong-type': 'not a JPEG, PNG or WebP',
  'not-an-image': 'the file is not really an image',
  'too-many': `already ${IMAGE_MAX_PER_PERSON} photos`,
  empty: 'empty file',
};

export default function TalentLibrary({ t }: { t: Talent }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [consentFor, setConsentFor] = useState<Purpose | null>(null);
  const [evidence, setEvidence] = useState('');
  const [months, setMonths] = useState(String(CONSENT_DEFAULT_MONTHS));
  const [uploads, setUploads] = useState<UploadRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const images = t.images ?? [];
  const canSee = consentLive(t.consents, 'roster', now);
  const webOk = consentLive(t.consents, 'website', now);

  const send = async (body: Record<string, unknown> | FormData, ok?: string) => {
    setBusy(true);
    try {
      const isForm = body instanceof FormData;
      const res = await fetch('/api/ops/talent/media', {
        method: 'POST',
        ...(isForm ? {} : { headers: { 'content-type': 'application/json' } }),
        body: isForm ? body : JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok && !j.results) {
        push({
          kind: 'err', text: j.detail ?? explain(j.error, j),
          ...(j.error === 'unauthenticated' ? { action: reauthAction() } : {}),
        });
        return null;
      }
      if (ok) push({ kind: 'ok', text: ok });
      router.refresh();
      return j;
    } catch {
      push({ kind: 'err', text: OFFLINE });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const form = new FormData();
    form.set('talentId', t.id);
    for (const f of Array.from(files)) form.append('file', f);
    const j = await send(form);
    if (j?.results) {
      setUploads(j.results);
      const good = (j.results as UploadRow[]).filter((r) => r.ok).length;
      if (good) push({ kind: 'ok', text: `${good} photo${good === 1 ? '' : 's'} added.` });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const recordConsent = async (purpose: Purpose) => {
    const j = await send(
      { action: 'consent', talentId: t.id, purpose, evidence, months: Number(months) },
      `Consent recorded: ${PURPOSE_LABEL[purpose].en.toLowerCase()}.`,
    );
    if (j) { setConsentFor(null); setEvidence(''); setMonths(String(CONSENT_DEFAULT_MONTHS)); }
  };

  // ── the comp card ─────────────────────────────────────────────────────────
  const fields = fieldsFor(t.discipline);
  const attrs: Attributes = t.attributes ?? {};
  const valueOf = (f: Field): string => {
    if (f.key in draft) return draft[f.key];
    const v = attrs[f.key];
    return Array.isArray(v) ? v.join(', ') : v === undefined ? '' : String(v);
  };
  const dirty = Object.keys(draft).length > 0;

  const saveCard = async () => {
    const merged: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = valueOf(f);
      if (f.kind === 'flag') merged[f.key] = raw === 'true';
      else if (raw !== '') merged[f.key] = raw;
    }
    const j = await send({ action: 'attributes', talentId: t.id, attributes: merged }, 'Comp card saved.');
    if (j) setDraft({});
  };


  return (
    <section className="lib" aria-label={`${t.name.en}: library`}>
      {/* ── consent ────────────────────────────────────────────────────── */}
      <div className="lib-head">
        <h4 className="lib-h">What they agreed to</h4>
        <span className="hint">
          Separate agreements, each with an end date. Withdrawing one never changes how often they are cast.
        </span>
      </div>
      <div className="lib-consents">
        {PURPOSES.map((p) => {
          const c = latestConsent(t.consents, p);
          const live = consentLive(t.consents, p, now);
          const needsRoster = p !== 'roster' && !canSee;
          const state = live ? 'live'
            : c?.withdrawnAt ? 'withdrawn'
              : c && new Date(c.expiresAt) <= now ? 'expired' : 'none';
          return (
            <div key={p} className="lib-consent" data-state={state}>
              <div className="lib-consent-top">
                <b>{PURPOSE_LABEL[p].en}</b>
                <span className="lib-state">
                  {state === 'live' && <>until {fmt(c?.expiresAt)}</>}
                  {state === 'withdrawn' && <>withdrawn {fmt(c?.withdrawnAt)}</>}
                  {state === 'expired' && <>expired {fmt(c?.expiresAt)}</>}
                  {state === 'none' && <>not given</>}
                </span>
              </div>
              <p className="hint">{PURPOSE_LABEL[p].detail.en}</p>
              {live && c?.evidence && <p className="hint lib-ev">On file: {c.evidence}</p>}
              <div className="row">
                {live ? (
                  <button className="lib-mini warn" disabled={busy}
                          onClick={() => send({ action: 'withdraw', talentId: t.id, purpose: p },
                            p === 'roster'
                              ? 'Withdrawn. Their photos are hidden everywhere, including here.'
                              : `Withdrawn: ${PURPOSE_LABEL[p].en.toLowerCase()}.`)}>
                    They withdrew it
                  </button>
                ) : (
                  <button className="lib-mini" disabled={busy || needsRoster}
                          title={needsRoster ? 'Needs “Our records” first' : undefined}
                          onClick={() => { setConsentFor(p); setEvidence(''); }}>
                    {state === 'none' ? 'Record consent' : 'Record it again'}
                  </button>
                )}
              </div>
              {consentFor === p && (
                <div className="lib-form">
                  <label>How they gave it</label>
                  <input value={evidence} dir="auto" autoFocus
                         placeholder="Signed release, 13 Sep 2026, in the shared drive"
                         onChange={(e) => setEvidence(e.target.value)} />
                  <label>For how long</label>
                  <select className="sel" value={months} onChange={(e) => setMonths(e.target.value)}>
                    {[3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} months</option>)}
                  </select>
                  <div className="row">
                    <button className="go" disabled={busy || evidence.trim().length < 8}
                            onClick={() => recordConsent(p)}>
                      Record
                    </button>
                    <button disabled={busy} onClick={() => setConsentFor(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── photos ─────────────────────────────────────────────────────── */}
      <div className="lib-head">
        <h4 className="lib-h">
          Photos <span className="muted">{images.length} of {IMAGE_MAX_PER_PERSON}</span>
        </h4>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
               onChange={(e) => upload(e.target.files)} />
        <button type="button" disabled={busy || !canSee || images.length >= IMAGE_MAX_PER_PERSON}
                title={canSee ? undefined : 'Record “Our records” consent first'}
                onClick={() => fileRef.current?.click()}>
          Add photos
        </button>
      </div>

      {!canSee && images.length > 0 && (
        <p className="note" data-k="warn">
          {images.length} photo{images.length === 1 ? '' : 's'} on file, hidden: there is no
          live consent to keep them. Record it above, or remove them.
        </p>
      )}
      {!canSee && images.length === 0 && (
        <p className="hint">Photos can be added once “Our records” consent is recorded.</p>
      )}
      {canSee && images.length === 0 && (
        <p className="hint">No photos yet. The first one added becomes the profile picture.</p>
      )}

      {canSee && images.length > 0 && (
        <div className="lib-grid">
          {images.map((img) => {
            const onSite = mayShow(t, img, 'website', now);
            return (
              <figure key={img.id} className="lib-photo" data-cover={!!img.cover}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/ops/talent/photo/${t.id}/${img.id}`} alt="" loading="lazy" />
                {img.cover && <span className="lib-tag">Profile picture</span>}
                <figcaption>
                  {!img.cover && (
                    <button className="lib-mini" disabled={busy}
                            onClick={() => send({ action: 'cover', talentId: t.id, imageId: img.id }, 'Profile picture set.')}>
                      Use as profile
                    </button>
                  )}
                  <label className="lib-web" title={webOk ? undefined : 'No live website consent'}>
                    <input type="checkbox" checked={!!img.onWebsite} disabled={busy || (!webOk && !img.onWebsite)}
                           onChange={(e) => send(
                             { action: 'website', talentId: t.id, imageId: img.id, on: e.target.checked },
                             e.target.checked ? 'On the website.' : 'Off the website.')} />
                    Website{img.onWebsite && !onSite ? ' (blocked)' : ''}
                  </label>
                  <button className="lib-mini warn" disabled={busy} aria-label="Delete photo"
                          onClick={() => {
                            if (window.confirm('Delete this photo? It is removed from storage, not hidden.')) {
                              send({ action: 'remove', talentId: t.id, imageId: img.id }, 'Photo deleted.');
                            }
                          }}>
                    Delete
                  </button>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}

      {uploads && uploads.some((u) => !u.ok) && (
        <ul className="lib-fails">
          {uploads.filter((u) => !u.ok).map((u) => (
            <li key={u.name}><span className="mono">{u.name}</span> — {UPLOAD_WHY[u.why ?? ''] ?? u.why}</li>
          ))}
        </ul>
      )}

      {/* ── comp card ──────────────────────────────────────────────────── */}
      <div className="lib-head">
        <h4 className="lib-h">Comp card</h4>
        <span className="hint">Everything optional. None of it reaches a client or the website.</span>
      </div>
      <CompCardFields discipline={t.discipline} idPrefix={t.id} disabled={busy}
                      values={Object.fromEntries(fields.map((f) => [f.key, valueOf(f)]))}
                      onChange={(key, v) => setDraft((d) => ({ ...d, [key]: v }))} />
      <div className="row">
        <button className="go" disabled={busy || !dirty} onClick={saveCard}>Save comp card</button>
        {dirty && <button disabled={busy} onClick={() => setDraft({})}>Discard</button>}
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AVAILABILITY_LABEL, DISCIPLINE_RATE,
  type Talent, type TalentDiscipline,
} from '@/lib/data/deals';
import { VERTICAL_LABEL } from '@/lib/data/concepts';
import { explain, OFFLINE } from '@/lib/ops/errors';
import { reauthAction, useToast } from '@/components/ops/Toast';
import TalentLibrary from '@/components/ops/TalentLibrary';
import { fieldsFor } from '@/lib/data/talentFields';
import { coverFor } from '@/lib/data/media';
import DisciplineTabs, { DISCIPLINES, DISCIPLINE_NAME } from '@/components/ops/DisciplineTabs';
import AddTalent from '@/components/ops/AddTalent';

/**
 * The roster, editable.
 *
 * It could create somebody, reissue their code and deactivate them, and nothing
 * else — so a phone number typed wrong on the day somebody joined stayed wrong,
 * and `tags`, which `fitOf()` in the recommender uses to cast, could not be set
 * anywhere in the product. Casting was fit-blind by omission rather than by
 * design.
 *
 * `placeholder` gets a pill and a dimmed row for the same reason: half this
 * roster is invented, to make the cast page look populated, and nothing on any
 * screen said so.
 */

/**
 * Their profile picture, or their initial in a circle.
 *
 * The picture is whichever photo was chosen as their profile picture, and it is
 * shown only while their consent to keep photos on file is live — the same rule
 * as the photos themselves, so withdrawing consent turns this back into an
 * initial on the next load, with nothing else to remember to update.
 *
 * The initial is the English name's first letter. An Arabic name's first
 * letter is often a connector form that reads wrongly on its own in a circle.
 */
function Avatar({ t }: { t: Talent }) {
  const pic = coverFor(t, 'roster');
  const initial = (t.name.en.trim()[0] ?? '?').toUpperCase();
  return (
    <span className="ava" data-fake={!!t.placeholder} aria-hidden="true">
      {pic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/ops/talent/photo/${t.id}/${pic.id}`} alt="" loading="lazy" />
      ) : (
        <span className="ava-initial">{initial}</span>
      )}
    </span>
  );
}

const TAG_SUGGESTIONS = [...Object.keys(VERTICAL_LABEL), ...DISCIPLINES];

export type TalentWork = {
  /** Days offered or accepted and not yet shot. */
  booked: number;
  /** Days shot. */
  done: number;
  /** What we owe them: shot and not paid. */
  owedJOD: number;
  /** The soonest day still ahead of them, for a "do not double-book" glance. */
  next?: string;
};

const daysSince = (iso?: string) =>
  (iso ? Math.floor((Date.now() - +new Date(iso)) / 86_400_000) : null);

export default function TalentManager({
  talent, work = {},
}: { talent: Talent[]; work?: Record<string, TalentWork> }) {
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  /** Shown once, right after issuing. Never fetched back — it is not stored. */
  const [code, setCode] = useState<{ who: string; code: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  // The active toggle is the one thing on this page pressed often enough
  // that waiting for a round trip is felt: this is applied the instant it is
  // pressed and rolled back if the request that should confirm it fails.
  const [activeOverride, setActiveOverride] = useState<Record<string, boolean>>({});
  const isActive = (t: Talent) => activeOverride[t.id] ?? t.active;
  // Same optimistic pattern as the active toggle: a tab lights up when it is
  // pressed, not when the round trip confirms it.
  const [disciplineOverride, setDisciplineOverride] = useState<Record<string, TalentDiscipline>>({});
  const disciplineOf = (t: Talent) => disciplineOverride[t.id] ?? t.discipline;
  const router = useRouter();

  const call = async (
    body: Record<string, unknown>, ok?: string, opts?: { rollback?: () => void },
  ) => {
    setBusy(true);
    try {
      const res = await fetch('/api/ops/talent', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        opts?.rollback?.();
        push({
          kind: 'err', text: explain(j.error, j),
          action: j.error === 'unauthenticated' ? reauthAction() : { label: 'Retry', onClick: () => call(body, ok, opts) },
        });
        return null;
      }
      if (ok) push({ kind: 'ok', text: ok });
      router.refresh();
      return j;
    } catch {
      opts?.rollback?.();
      push({ kind: 'err', text: OFFLINE, action: { label: 'Retry', onClick: () => call(body, ok, opts) } });
      return null;
    }
    finally { setBusy(false); }
  };

  /** One field, saved on blur. `saveTalent` merges, so nothing else moves. */
  const patch = (t: Talent, body: Record<string, unknown>) =>
    call({ action: 'update', id: t.id, ...body });

  /**
   * Switch a person's trade — with a question first when that loses anything.
   *
   * The server re-cleans their comp card against the new trade, so a model
   * moved to voiceover loses her height and shoe size. Inside a dropdown that
   * took a deliberate choice; as a tab it is one stray tap on a phone. So the
   * fields that would go are named before they go, and a switch that loses
   * nothing asks nothing.
   */
  const changeDiscipline = (t: Talent, next: TalentDiscipline) => {
    const from = disciplineOf(t);
    if (next === from) return;
    const keep = new Set(fieldsFor(next).map((x) => x.key));
    const lost = fieldsFor(from).filter((x) => t.attributes?.[x.key] !== undefined && !keep.has(x.key));
    if (lost.length && !window.confirm(
      `Switching ${t.name.en} to ${DISCIPLINE_NAME[next].toLowerCase()} clears their `
      // First letter only, so "Shoe size (EU)" reads "shoe size (EU)" and not "(eu)".
      + `${lost.map((x) => x.label.en.charAt(0).toLowerCase() + x.label.en.slice(1)).join(', ')}. Continue?`,
    )) return;
    setDisciplineOverride((o) => ({ ...o, [t.id]: next }));
    call(
      { action: 'update', id: t.id, discipline: next },
      `Now a ${DISCIPLINE_NAME[next].toLowerCase()}.`,
      { rollback: () => setDisciplineOverride((o) => ({ ...o, [t.id]: from })) },
    );
  };

  const toggleActive = (t: Talent) => {
    const next = !isActive(t);
    setActiveOverride((o) => ({ ...o, [t.id]: next }));
    call(
      { action: 'update', id: t.id, active: next },
      next ? 'Reactivated.' : 'Deactivated.',
      { rollback: () => setActiveOverride((o) => ({ ...o, [t.id]: !next })) },
    );
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
        <button className="go" type="button" onClick={() => setAdding(true)}>Add someone</button>
      </div>
      <AddTalent open={adding} onClose={() => setAdding(false)}
                 onCreated={(r) => { setCode(r); setAdding(false); router.refresh(); }} />

      {talent.length === 0 ? (
        <div className="panel">
          <p style={{ marginTop: 0 }}>
            Nobody on the roster yet.
          </p>
          <p className="hint" style={{ marginBottom: 0 }}>
            This is the list the engine casts from. Every sheet picks its crew
            out of it — a videographer for the shoot, models for the day, a
            voice where a concept needs one — and every booking, every WhatsApp
            offer and every invoice is addressed to somebody on it. Until there
            is a real person here, the cast page shows worked examples and no
            sheet can be approved.
          </p>
        </div>
      ) : (
        <div className="roster">
          {talent.map((t) => {
            const w = work[t.id];
            const age = daysSince(t.availabilitySetAt);
            const backBy = t.availableFrom;
            const open = openId === t.id;
            return (
              <div className="tal" key={t.id} data-off={!isActive(t)} data-fake={!!t.placeholder}>
                <div className="tal-head">
                  <Avatar t={t} />
                  <b dir="auto">{t.name.en}</b>
                  <span className="muted" dir="auto">{t.name.ar}</span>
                  <span className="mono muted">{t.discipline} · {t.dayRateJOD} JOD</span>
                  {t.placeholder && (
                    <span className="pill" data-s="warn">worked example — not bookable</span>
                  )}
                  {!isActive(t) && <span className="pill">inactive</span>}
                  <span className="sp" />
                  <span className="pill" data-s={t.availability === 'available' ? 'ready' : undefined}>
                    {AVAILABILITY_LABEL[t.availability].en}
                    {backBy && t.availability !== 'available' ? ` until ${backBy}` : ''}
                  </span>
                  <button type="button" onClick={() => setOpenId(open ? null : t.id)}>
                    {open ? 'Close' : 'Edit'}
                  </button>
                </div>

                <p className="tal-sub">
                  <span className="mono" dir="ltr">{t.phone || 'no number'}</span>
                  {age !== null && (
                    <span className={age > 30 ? 'todo' : undefined} suppressHydrationWarning>
                      {' · '}said so {age === 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`}
                    </span>
                  )}
                  {backBy && backBy < new Date().toISOString().slice(0, 10)
                    && t.availability !== 'available' && (
                    <span className="todo"> · that date has passed — they may be back</span>
                  )}
                  {w && (w.booked > 0 || w.done > 0 || w.owedJOD > 0) && (
                    <>
                      {' · '}{w.booked} day{w.booked === 1 ? '' : 's'} booked
                      {' · '}{w.done} done
                      {w.owedJOD > 0 && (
                        <span className="todo"> · {w.owedJOD} JOD owed</span>
                      )}
                    </>
                  )}
                  {t.tags?.length ? <> · <span className="mono">{t.tags.join(' ')}</span></> : null}
                </p>

                {open && (
                  <div className="sub">
                    <div className="pair">
                      <div>
                        <label>Name — EN</label>
                        <input defaultValue={t.name.en} dir="auto"
                               onBlur={(e) => e.target.value !== t.name.en && patch(t, { nameEn: e.target.value })} />
                      </div>
                      <div>
                        <label>Name — AR</label>
                        <input defaultValue={t.name.ar} dir="rtl"
                               onBlur={(e) => e.target.value !== t.name.ar && patch(t, { nameAr: e.target.value })} />
                      </div>
                    </div>
                    <label className="dtabs-label">Discipline</label>
                    <DisciplineTabs name={`discipline-${t.id}`} value={disciplineOf(t)} disabled={busy}
                                    onChange={(d) => changeDiscipline(t, d)} />
                    <div className="pair">
                      <div>
                        <label>Day rate — JOD</label>
                        <input type="number" min={0} defaultValue={t.dayRateJOD}
                               onBlur={(e) => Number(e.target.value) !== t.dayRateJOD
                                 && patch(t, { dayRateJOD: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label>Phone</label>
                        <input defaultValue={t.phone} dir="ltr" className="mono"
                               onBlur={(e) => e.target.value !== t.phone && patch(t, { phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="pair">
                      <div>
                        <label>Back from {AVAILABILITY_LABEL[t.availability].en.toLowerCase()} on</label>
                        <input type="date" defaultValue={t.availableFrom ?? ''}
                               onBlur={(e) => e.target.value !== (t.availableFrom ?? '')
                                 && patch(t, { availableFrom: e.target.value })} />
                      </div>
                    </div>

                    <label>What they are good for</label>
                    <p className="hint" style={{ margin: '0 0 8px' }}>
                      The recommender matches these against a concept&rsquo;s vertical
                      and the words it uses about itself. A tag that matches
                      nothing simply does not pull.
                    </p>
                    <div className="chips">
                      {(t.tags ?? []).map((tag) => (
                        <button type="button" className="chip" key={tag} disabled={busy}
                                aria-label={`Remove ${tag}`}
                                onClick={() => patch(t, { tags: (t.tags ?? []).filter((x) => x !== tag) })}>
                          {tag} ×
                        </button>
                      ))}
                    </div>
                    <div className="row" style={{ marginTop: 8 }}>
                      <input value={openId === t.id ? tagDraft : ''} placeholder="add a tag"
                             style={{ maxWidth: 200 }}
                             onChange={(e) => setTagDraft(e.target.value)}
                             onKeyDown={(e) => {
                               if (e.key !== 'Enter' || !tagDraft.trim()) return;
                               patch(t, { tags: [...new Set([...(t.tags ?? []), tagDraft.trim()])] });
                               setTagDraft('');
                             }} />
                    </div>
                    <div className="chips" style={{ marginTop: 8 }}>
                      {TAG_SUGGESTIONS.filter((s) => !(t.tags ?? []).includes(s)).map((s) => (
                        <button type="button" className="chip" key={s} disabled={busy}
                                data-sug onClick={() => patch(t, { tags: [...(t.tags ?? []), s] })}>
                          + {s}
                        </button>
                      ))}
                    </div>

                    <TalentLibrary t={t} />

                    <div className="pair" style={{ marginTop: 14 }}>
                      <div>
                        <label>Portfolio</label>
                        <input defaultValue={t.portfolioUrl ?? ''} dir="ltr" className="mono"
                               onBlur={(e) => e.target.value !== (t.portfolioUrl ?? '')
                                 && patch(t, { portfolioUrl: e.target.value })} />
                      </div>
                      <div>
                        <label>Name on a receipt</label>
                        <input defaultValue={t.legalName ?? ''} dir="auto"
                               onBlur={(e) => e.target.value !== (t.legalName ?? '')
                                 && patch(t, { legalName: e.target.value })} />
                      </div>
                    </div>
                    <div className="pair">
                      <div>
                        <label>ID or passport number</label>
                        <input defaultValue={t.idNumber ?? ''} dir="ltr" className="mono"
                               onBlur={(e) => e.target.value !== (t.idNumber ?? '')
                                 && patch(t, { idNumber: e.target.value })} />
                      </div>
                    </div>
                    <label>Anything else</label>
                    <textarea rows={2} defaultValue={t.note ?? ''} dir="auto"
                              onBlur={(e) => e.target.value !== (t.note ?? '') && patch(t, { note: e.target.value })} />

                    <label className="cfgline" data-on={!!t.placeholder} style={{ marginTop: 12 }}>
                      <input type="checkbox" defaultChecked={!!t.placeholder}
                             onChange={(e) => patch(t, { placeholder: e.target.checked })} />
                      <span>Worked example — not bookable, never cast on a real sheet</span>
                    </label>

                    {w && (
                      <p className="hint" style={{ marginTop: 12 }}>
                        {w.booked} day{w.booked === 1 ? '' : 's'} offered or accepted,{' '}
                        {w.done} shot, <b>{w.owedJOD} JOD</b> owed.
                        {w.next && <> Next day: <span className="mono">{w.next}</span>.</>}
                        {' '}
                        <a href={`/doc/invoice/${t.id}`} target="_blank" rel="noreferrer">
                          Their invoice →
                        </a>
                      </p>
                    )}

                    <div className="row" style={{ marginTop: 14 }}>
                      <button disabled={busy} onClick={() => toggleActive(t)}>
                        {isActive(t) ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button disabled={busy} onClick={async () => {
                        const j = await call({ action: 'reissue', id: t.id });
                        if (j?.code) setCode({ who: t.name.en, code: j.code });
                      }}>
                        Reissue code — signs every device out
                      </button>
                      <button className="warn" disabled={busy}
                              onClick={() => call({ action: 'signout', id: t.id },
                                'Signed out everywhere. Their code still works.')}>
                        Sign out everywhere
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

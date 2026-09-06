'use client';

import { useState } from 'react';
import type { Talent, TalentDiscipline } from '@/lib/data/deals';
import type { Recommendation } from '@/lib/teardown/recommend';

/**
 * Who is actually on this idea.
 *
 * `castOverrides` has existed on `Sheet`, been honoured by `castPlan`, and had
 * a route action for as long as either has — and no interface at all, so it
 * could never be set. The engine's cast is a ranking, not a decision, and the
 * person who knows that this videographer cannot shoot food and that model
 * will not work a clinic is the one holding the phone.
 *
 * Placeholders are rendered and disabled rather than filtered out, because a
 * roster that is half invented should say so on the screen where somebody is
 * choosing from it — an absence teaches nothing.
 */

const LABEL: Record<TalentDiscipline, string> = {
  videographer: 'Videographer', model: 'Model', voiceover: 'Voiceover',
};

/** The slots this concept has room for — the same arithmetic the route uses. */
function slotsFor(rec: Recommendation): TalentDiscipline[] {
  const shooters = Math.max(1, rec.cast.filter((c) => c.discipline === 'videographer').length);
  return [
    ...Array<TalentDiscipline>(shooters).fill('videographer'),
    ...Array<TalentDiscipline>(Math.max(0, rec.models)).fill('model'),
    ...(rec.needsVoice ? (['voiceover'] as TalentDiscipline[]) : []),
  ];
}

/** Fill the slots from a flat list of ids, discipline by discipline. */
function seat(slots: TalentDiscipline[], ids: string[], byId: Map<string, Talent>): string[] {
  const pool = [...ids];
  return slots.map((d) => {
    const i = pool.findIndex((id) => byId.get(id)?.discipline === d);
    return i === -1 ? '' : pool.splice(i, 1)[0];
  });
}

export default function CastPicker({
  rec, roster, current, override, onCast, busy,
}: {
  rec: Recommendation;
  roster: Talent[];
  /** The effective cast right now — the override when there is one. */
  current: { talentId: string; discipline: string }[];
  /** Whether what is showing is an operator's choice rather than the engine's. */
  override: boolean;
  onCast: (talentIds: string[]) => Promise<void>;
  busy: boolean;
}) {
  const byId = new Map(roster.map((t) => [t.id, t]));
  const slots = slotsFor(rec);
  const [picks, setPicks] = useState<string[]>(
    () => seat(slots, current.map((c) => c.talentId), byId),
  );

  const change = async (i: number, id: string) => {
    const next = picks.map((p, j) => (j === i ? id : p));
    setPicks(next);
    await onCast(next.filter(Boolean));
  };

  const reset = async () => {
    setPicks(seat(slots, rec.cast.map((c) => c.talentId), byId));
    await onCast([]);
  };

  return (
    <div className="cast-pick">
      <div className="itemhead">
        <b>Cast</b>
        {override && <span className="pill" data-s="ready">yours</span>}
        <span className="sp" />
        {override && (
          <button type="button" className="x" disabled={busy} onClick={reset}>
            reset to the engine’s cast
          </button>
        )}
      </div>

      {slots.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          Client-fronted — this one needs nobody from the roster.
        </p>
      ) : slots.map((d, i) => {
        const eligible = roster.filter((t) => t.discipline === d && t.active && t.dayRateJOD > 0);
        const real = eligible.filter((t) => !t.placeholder);
        return (
          <div className="cast-slot" key={`${d}-${i}`}>
            <label>{LABEL[d]}</label>
            {real.length === 0 ? (
              <p className="hint todo" style={{ margin: 0 }}>
                Nobody on the roster. Add {LABEL[d].toLowerCase()}s before this
                sheet can be sent.
              </p>
            ) : (
              <select
                className="sel" value={picks[i] ?? ''} disabled={busy}
                aria-label={`${LABEL[d]} on concept ${rec.conceptN}`}
                onChange={(e) => change(i, e.target.value)}
              >
                <option value="">— nobody —</option>
                {eligible.map((t) => (
                  <option key={t.id} value={t.id} disabled={!!t.placeholder}>
                    {t.name.en} · {t.dayRateJOD} JOD
                    {t.placeholder ? ' — not a real person' : ''}
                    {t.tags?.length ? ` · ${t.tags.slice(0, 3).join(' ')}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}

      {rec.crewNotes?.length > 0 && (
        <p className="hint" style={{ marginTop: 8 }}>
          Also on the day, not booked through the roster: {rec.crewNotes.join(', ')}.
        </p>
      )}
      {rec.uncastable && (
        <p className="hint todo" style={{ marginTop: 8 }}>{rec.uncastable}</p>
      )}
    </div>
  );
}

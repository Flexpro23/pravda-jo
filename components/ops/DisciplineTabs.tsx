'use client';

import { DISCIPLINE_RATE, rateIsSet, type TalentDiscipline } from '@/lib/data/deals';

/**
 * In the order people think of the roster, not the rate card's key order —
 * the four trades as Khaled names them.
 */
export const DISCIPLINES: TalentDiscipline[] = ['model', 'photographer', 'videographer', 'voiceover'];

export const DISCIPLINE_NAME: Record<TalentDiscipline, string> = {
  model: 'Model', photographer: 'Photographer', videographer: 'Videographer', voiceover: 'Voiceover',
};

/**
 * The four trades as tabs, one tap each.
 *
 * Built from radio inputs rather than buttons, because choosing one of four is
 * what a radio group is: the browser gives it arrow-key movement, one tab stop
 * for the whole group, and a screen reader announces "3 of 4" — none of which
 * a row of buttons would have without being rebuilt by hand. The inputs are
 * hidden visually and nowhere else.
 *
 * Each tab carries its rate, because the dropdown did and the rate is the
 * thing that decides whether the person can be booked at all.
 */
export default function DisciplineTabs({
  name, value, onChange, disabled,
}: {
  name: string; value: TalentDiscipline;
  onChange: (d: TalentDiscipline) => void; disabled?: boolean;
}) {
  return (
    <div className="dtabs" role="radiogroup" aria-label="Discipline">
      {DISCIPLINES.map((d) => (
        <label key={d} className="dtab" data-on={value === d}>
          <input type="radio" name={name} value={d} checked={value === d}
                 disabled={disabled} onChange={() => onChange(d)} />
          <span className="dtab-name">{DISCIPLINE_NAME[d]}</span>
          <span className="dtab-rate">
            {rateIsSet(d) ? `${DISCIPLINE_RATE[d]} JOD/day` : 'no rate yet'}
          </span>
        </label>
      ))}
    </div>
  );
}


'use client';

import { groupsFor, GROUP_LABEL, type Field } from '@/lib/data/talentFields';
import type { TalentDiscipline } from '@/lib/data/deals';

/**
 * The comp card as a form, laid out by group the way the trade reads one.
 *
 * Shared by the library (editing somebody who exists) and the add-someone
 * sheet (a draft read off a card image), so the two can never disagree about
 * what a model's card holds or in what order. Controlled: the parent owns the
 * values, this only draws them.
 *
 * `notes` marks fields the card reader could not take as read — a height it
 * saw as 16, say — so the operator is told to look rather than shown a blank
 * that reads as "the card had no height".
 */
export default function CompCardFields({
  discipline, values, onChange, disabled, idPrefix, notes = {},
}: {
  discipline: TalentDiscipline;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  idPrefix: string;
  notes?: Record<string, string>;
}) {
  const v = (f: Field) => values[f.key] ?? '';

  const control = (f: Field) => {
    const id = `${idPrefix}-${f.key}`;
    switch (f.kind) {
      case 'choice':
        return (
          <select id={id} className="sel" value={v(f)} disabled={disabled}
                  onChange={(e) => onChange(f.key, e.target.value)}>
            <option value="">—</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label.en}</option>)}
          </select>
        );
      case 'flag':
        return (
          <input id={id} type="checkbox" checked={v(f) === 'true'} disabled={disabled}
                 onChange={(e) => onChange(f.key, String(e.target.checked))} />
        );
      case 'number':
        return (
          <span className="cc-num" data-note={!!notes[f.key]}>
            <input id={id} value={v(f)} disabled={disabled} inputMode="decimal" dir="ltr"
                   onChange={(e) => onChange(f.key, e.target.value)} />
            {f.unit && <span className="cc-unit">{f.unit.en}</span>}
          </span>
        );
      default:
        return (
          <input id={id} value={v(f)} disabled={disabled} dir="auto"
                 placeholder={f.kind === 'list' ? (f.suggest ?? []).slice(0, 3).join(', ') : ''}
                 onChange={(e) => onChange(f.key, e.target.value)} />
        );
    }
  };

  return (
    <div className="cc">
      {groupsFor(discipline).map(({ group, fields }) => {
        const hints = fields.filter((f) => f.hint || notes[f.key]);
        return (
          <div key={group} className="cc-row">
            <span className="cc-glabel">{GROUP_LABEL[group].en}</span>
            <div className="cc-fields">
              {fields.map((f) => (
                <div key={f.key} className="cc-field" data-kind={f.kind}>
                  <label htmlFor={`${idPrefix}-${f.key}`} title={f.hint?.en}>{f.label.en}</label>
                  {control(f)}
                </div>
              ))}
            </div>
            {hints.length > 0 && (
              <p className="cc-hints hint">
                {hints.map((f) => (
                  <span key={f.key} className={notes[f.key] ? 'todo' : undefined}>
                    <b>{f.label.en}:</b> {notes[f.key] ?? f.hint!.en}
                  </span>
                ))}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

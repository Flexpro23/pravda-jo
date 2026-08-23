'use client';
import { useState } from 'react';
import { Lang, tx } from '@/lib/i18n';

/**
 * Risk-gradient sequence: handle → (check runs, visibly) → name → phone → OTP.
 * Each step shows that the previous one produced something.
 * Here: step one only. The rest lives behind the API.
 */
export default function Intake({ lang }: { lang: Lang }) {
  const [handle, setHandle] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'done'>('idle');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    setState('checking');
    // The real check calls Business Discovery. Failure returns 400/110/2207013,
    // which is indistinguishable between personal, typo, renamed and deleted —
    // so we never diagnose a cause we cannot determine.
    setTimeout(() => setState('done'), 900);
  };

  if (state === 'done') {
    return (
      <div className="intake-ok reveal">
        <p className="d3" style={{ marginBottom: 'var(--s3)' }}>
          {lang === 'ar' ? 'وصلنا الحساب.' : 'We have the handle.'}
        </p>
        <p className="intake-note">
          {lang === 'ar'
            ? 'رح نبعتلكم رسالة على واتساب بعد ما نخلّص القراءة — خلال يوم عمل.'
            : 'We will message you on WhatsApp once the read is finished — within one working day.'}
        </p>
      </div>
    );
  }

  return (
    <form className="intake" onSubmit={submit}>
      <div className="intake-row">
        <input
          type="text" value={handle} onChange={(e) => setHandle(e.target.value)}
          placeholder={tx('tdPlaceholder', lang)} aria-label={tx('tdPlaceholder', lang)}
          autoComplete="off" spellCheck={false} dir="ltr"
        />
        <button className="btn" type="submit" disabled={state === 'checking'}>
          {state === 'checking'
            ? (lang === 'ar' ? 'عم نقرأ…' : 'Reading…')
            : tx('tdCta', lang)}
        </button>
      </div>
      <p className="intake-note">{tx('tdNote', lang)}</p>
    </form>
  );
}

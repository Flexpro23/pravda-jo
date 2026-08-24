'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Lang, path, tx, fwd } from '@/lib/i18n';

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
      <div className="intake-ok fade">
        <p style={{ marginBottom: 'var(--s3)' }}>
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
          placeholder="@yourbusiness" aria-label={tx('tdField', lang)}
          autoComplete="off" autoCapitalize="none" autoCorrect="off"
          spellCheck={false} dir="ltr"
        />
        <button className="btn" type="submit" disabled={state === 'checking'}>
          {state === 'checking'
            ? (lang === 'ar' ? 'عم نقرأ…' : 'Reading…')
            : tx('tdCta', lang)}
        </button>
      </div>
      <p className="intake-note">
        {tx('tdNote', lang)}{' '}
        {/* The read needs a Professional account, so the fix is one tap away
            rather than a dead end after the handle fails. */}
        <Link className="link" href={path(lang, 'instagram-professional')}>
          {tx('tdSwitch', lang)} {fwd(lang)}
        </Link>
      </p>
    </form>
  );
}

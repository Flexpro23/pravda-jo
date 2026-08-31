'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Lang, path, tx, fwd } from '@/lib/i18n';

/**
 * Handing over the handle.
 *
 * Risk-gradient sequence, and the order is the point: the handle is public
 * information and costs a visitor nothing, so it is asked for first and on its
 * own. Only once they have committed that much are they asked for a name and a
 * number — which is the part that actually feels like a decision. A single form
 * asking for all three at once converts worse, because the phone field is
 * visible while they are still deciding whether to engage at all.
 *
 * The handle is validated here against Instagram's own rule so a typo comes
 * back instantly rather than after a round trip, and so the second step is
 * never reached with something that cannot be read.
 *
 * What this does NOT do is check the account exists before asking for a phone
 * number. It would be better for the visitor, and it is the wrong trade: it
 * spends one of our ~200 hourly Meta reads on an anonymous caller before there
 * is a lead to show for it. The read happens after the lead is safely written,
 * and a personal account surfaces in the console as something to answer rather
 * than as a dead end on this page.
 */

type Step = 'handle' | 'contact' | 'sending' | 'done';

const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

export default function Intake({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  const [step, setStep] = useState<Step>('handle');
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  /** What a person types, minus the parts that are not the handle. */
  const tidy = (raw: string) => raw.trim().replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '');

  const toContact = (e: React.FormEvent) => {
    e.preventDefault();
    const h = tidy(handle);
    if (!HANDLE.test(h)) {
      setErr(ar ? 'اكتبوا اسم الحساب بدون مسافات.' : 'Enter the handle without spaces.');
      return;
    }
    setHandle(h);
    setErr(null);
    setStep('contact');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr(ar ? 'شو اسمك؟' : 'What is your name?');
      return;
    }
    if (!/^(\+?962|0)?7\d{8}$/.test(phone.replace(/[^\d+]/g, ''))) {
      setErr(ar ? 'رقم موبايل أردني، زي 0791234567.' : 'A Jordanian mobile, like 0791234567.');
      return;
    }
    setErr(null);
    setStep('sending');

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle, contactName: name.trim(), contactPhone: phone.trim(), lang,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        // Named errors get a named answer; anything else is ours to own rather
        // than to blame on what they typed.
        const known: Record<string, string> = {
          handle: ar ? 'اسم الحساب مش مضبوط.' : 'That handle is not valid.',
          name: ar ? 'شو اسمك؟' : 'What is your name?',
          phone: ar ? 'الرقم مش مضبوط.' : 'That number is not valid.',
        };
        setErr(known[j?.error]
          ?? (ar ? 'صار خلل عنا. جرّبوا كمان مرة، أو راسلونا على واتساب.'
                 : 'Something broke on our side. Try again, or message us on WhatsApp.'));
        setStep('contact');
        return;
      }
      setReturning(!!j.returning);
      setStep('done');
    } catch {
      setErr(ar ? 'ما قدرنا نبعت. شيّكوا على النت وجرّبوا كمان مرة.'
                : 'That did not send. Check your connection and try again.');
      setStep('contact');
    }
  };

  if (step === 'done') {
    return (
      <div className="intake-ok fade">
        <p style={{ marginBottom: 'var(--s3)' }}>
          {ar ? `وصلنا @${handle}.` : `We have @${handle}.`}
        </p>
        <p className="intake-note">
          {/* Says only what is true the moment it is shown. The read has not
              run yet and may not succeed, so nothing here promises a report —
              it promises a person, which is a promise we keep either way. */}
          {returning
            ? (ar
              ? 'حسابكم عنا من قبل — رح نرجع نتواصل معكم على نفس الرقم.'
              : 'We already have you on file — we will come back to you on the same number.')
            : (ar
              ? 'عم نقرأ حسابكم هلق. خالد رح يتواصل معكم على واتساب خلال يوم عمل.'
              : 'We are reading your account now. Khaled will message you on WhatsApp within one working day.')}
        </p>
      </div>
    );
  }

  if (step === 'handle') {
    return (
      <form className="intake" onSubmit={toContact} noValidate>
        <div className="intake-row">
          <input
            type="text" value={handle} onChange={(e) => setHandle(e.target.value)}
            placeholder="@yourbusiness" aria-label={tx('tdField', lang)}
            autoComplete="off" autoCapitalize="none" autoCorrect="off"
            spellCheck={false} dir="ltr"
            aria-invalid={!!err} aria-describedby={err ? 'intake-err' : undefined}
          />
          <button className="btn" type="submit">{tx('tdCta', lang)}</button>
        </div>
        {err && <p className="intake-note" id="intake-err" role="alert">{err}</p>}
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

  const sending = step === 'sending';
  return (
    <form className="intake" onSubmit={submit} noValidate>
      <p className="intake-note" style={{ marginBottom: 'var(--s3)' }}>
        {ar ? 'حساب' : 'Reading'} <span className="ltr">@{handle}</span>
        {' · '}
        <button
          type="button" className="link"
          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
          onClick={() => { setStep('handle'); setErr(null); }}
        >
          {ar ? 'غيّروه' : 'change'}
        </button>
      </p>

      <div className="intake-row">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={ar ? 'اسمك' : 'Your name'}
          aria-label={ar ? 'اسمك' : 'Your name'}
          autoComplete="name" disabled={sending}
        />
      </div>
      <div className="intake-row" style={{ marginTop: 'var(--s2)' }}>
        <input
          type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="07 9123 4567"
          aria-label={ar ? 'رقم الموبايل' : 'Mobile number'}
          autoComplete="tel" inputMode="tel" dir="ltr" disabled={sending}
          aria-invalid={!!err} aria-describedby={err ? 'intake-err' : undefined}
        />
        <button className="btn" type="submit" disabled={sending}>
          {sending ? (ar ? 'عم نبعت…' : 'Sending…') : (ar ? 'ابعتوا' : 'Send')}
        </button>
      </div>

      {err && <p className="intake-note" id="intake-err" role="alert">{err}</p>}
      <p className="intake-note">
        {ar
          ? 'الرقم للتواصل بس — منبعتلكم التحقيق عليه، وما منعطيه لحدا.'
          : 'The number is for contact only — we send the teardown to it, and we give it to nobody.'}
      </p>
    </form>
  );
}

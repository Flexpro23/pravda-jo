'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CO } from '@/lib/data/company';
import { msisdn } from '@/lib/notify/whatsapp';
import { arNum } from '@/lib/format/num';
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
/** Which field an error belongs to — so aria-invalid lands on the right one. */
type ErrField = 'handle' | 'name' | 'phone' | null;
/** A field error is fixable by typing again. A server/rate error is not — it
 *  needs an escape hatch instead of a retry. */
type ErrKind = 'field' | 'server' | 'rate' | null;

const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/** The message a visitor's own WhatsApp opens with, prefilled. */
const waText = (ar: boolean, handle: string) =>
  ar ? `مرحبا، بدي تحقيق لحساب @${handle}` : `Hi, I would like a teardown for @${handle}`;

const waLink = (ar: boolean, handle: string) => {
  const n = msisdn(CO.phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(waText(ar, handle))}` : null;
};

/** "١ من ٢" / "1 of 2" — the digits are the only thing that changes per step. */
const stepLine = (n: 1 | 2, lang: Lang) => {
  const ar = lang === 'ar';
  return `${ar ? arNum(n) : n} ${tx('intakeStep', lang)} ${ar ? arNum(2) : 2}`;
};

export default function Intake({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  const [step, setStep] = useState<Step>('handle');
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState(''); // honeypot — real visitors never see this field
  const [err, setErr] = useState<string | null>(null);
  const [errField, setErrField] = useState<ErrField>(null);
  const [errKind, setErrKind] = useState<ErrKind>(null);
  const [returning, setReturning] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  const mountedAt = useRef(Date.now());
  const prevStep = useRef<Step>('handle');
  const nameRef = useRef<HTMLInputElement>(null);
  const doneHeadingRef = useRef<HTMLParagraphElement>(null);

  // Focus follows the two transitions a visitor cannot see coming: the step
  // change (so the next field is where the cursor already is) and the done
  // state (so a screen reader announces the confirmation rather than leaving
  // focus on a button that no longer does anything).
  useEffect(() => {
    if (prevStep.current === 'handle' && step === 'contact') nameRef.current?.focus();
    if (step === 'done') doneHeadingRef.current?.focus();
    prevStep.current = step;
  }, [step]);

  /** What a person types, minus the parts that are not the handle. */
  const tidy = (raw: string) => raw.trim().replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '');

  const toContact = (e: React.FormEvent) => {
    e.preventDefault();
    const h = tidy(handle);
    if (!HANDLE.test(h)) {
      setErr(ar ? 'اكتبوا اسم الحساب بدون مسافات.' : 'Enter the handle without spaces.');
      setErrField('handle'); setErrKind('field');
      return;
    }
    setHandle(h);
    setErr(null); setErrField(null); setErrKind(null);
    setStep('contact');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr(ar ? 'شو اسمك؟' : 'What is your name?');
      setErrField('name'); setErrKind('field');
      return;
    }
    if (!/^(\+?962|0)?7\d{8}$/.test(phone.replace(/[^\d+]/g, ''))) {
      setErr(ar ? 'رقم موبايل أردني، زي 0791234567.' : 'A Jordanian mobile, like 0791234567.');
      setErrField('phone'); setErrKind('field');
      return;
    }
    setErr(null); setErrField(null); setErrKind(null);
    setStep('sending');

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle, contactName: name.trim(), contactPhone: phone.trim(), lang,
          // The honeypot and the time-on-form are read by the backend before
          // anything else — see app/api/lead/route.ts. Both are silently
          // accepted (a plain success, nothing written) rather than rejected,
          // so a script learns nothing about which signal tripped it.
          company, elapsedMs: Date.now() - mountedAt.current,
        }),
      });

      if (res.status === 429) {
        setErr(tx('intakeTooMany', lang));
        setErrKind('rate'); setErrField(null);
        setStep('contact');
        return;
      }

      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        // Named errors get a named answer, on the field that caused them;
        // anything else is ours to own rather than to blame on what they
        // typed — and it is the one case a visitor needs a way around us
        // entirely, not just a reason to try again.
        const known: Record<string, string> = {
          handle: ar ? 'اسم الحساب مش مضبوط.' : 'That handle is not valid.',
          name: ar ? 'شو اسمك؟' : 'What is your name?',
          phone: ar ? 'الرقم مش مضبوط.' : 'That number is not valid.',
        };
        const field = j?.error as ErrField;
        if (field && known[field]) {
          setErr(known[field]); setErrField(field); setErrKind('field');
        } else {
          setErr(ar ? 'صار خلل عنا. جرّبوا كمان مرة، أو راسلونا على واتساب.'
                     : 'Something broke on our side. Try again, or message us on WhatsApp.');
          setErrField(null); setErrKind('server');
        }
        setStep('contact');
        return;
      }
      setReturning(!!j.returning);
      setSheetUrl(typeof j.sheetUrl === 'string' ? j.sheetUrl : null);
      setStep('done');
    } catch {
      setErr(ar ? 'ما قدرنا نبعت. شيّكوا على النت وجرّبوا كمان مرة، أو راسلونا على واتساب.'
                : 'That did not send. Check your connection and try again, or message us on WhatsApp.');
      setErrField(null); setErrKind('server');
      setStep('contact');
    }
  };

  /** The escape hatch: a stranger who cannot get the form to work should never
   *  be left with nothing to tap. Shown for a server/network failure only —
   *  a field error is fixed by typing again, not by leaving the page. */
  const failLinks = errKind === 'server' && (
    <p className="intake-note intake-fail">
      {waLink(ar, handle) && (
        <>
          <a className="link" href={waLink(ar, handle)!} target="_blank" rel="noopener noreferrer">
            {ar ? 'راسلونا على واتساب' : 'Message us on WhatsApp'}
          </a>
          {' · '}
        </>
      )}
      <a className="link" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a>
    </p>
  );

  if (step === 'done') {
    return (
      <div className="intake-ok fade" role="status">
        <p ref={doneHeadingRef} tabIndex={-1} style={{ marginBottom: 'var(--s3)', outline: 'none' }}>
          {ar ? `وصلنا @${handle}.` : `We have @${handle}.`}
        </p>
        {returning && sheetUrl ? (
          <p style={{ marginBottom: 'var(--s3)' }}>
            <Link className="btn" href={sheetUrl}>{tx('intakeReady', lang)}</Link>
          </p>
        ) : (
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
        )}
        <p className="intake-note">
          {/* Discovered only after the read runs, so it has to be said here too —
              step 1's link is long gone by the time this state is reached. */}
          {ar ? 'لو حسابكم لسّا شخصي، حوّلوه هلق — بياخد نص دقيقة. ' : 'If your account is still personal, switch it now — it takes half a minute. '}
          <Link className="link" href={path(lang, 'instagram-professional')}>
            {tx('tdSwitch', lang)} {fwd(lang)}
          </Link>
        </p>
        {waLink(ar, handle) && (
          <p style={{ marginTop: 'var(--s4)' }}>
            <a className="btn btn-s" href={waLink(ar, handle)!} target="_blank" rel="noopener noreferrer">
              {tx('intakeWhatsApp', lang)}
            </a>
          </p>
        )}
      </div>
    );
  }

  if (step === 'handle') {
    return (
      <form className="intake" onSubmit={toContact} noValidate>
        <fieldset className="intake-fieldset">
          <legend className="intake-step">
            <span aria-hidden="true">{stepLine(1, lang)}</span>
            <span className="sr-only">{ar ? `الخطوة ${arNum(1)} من ${arNum(2)}` : 'Step 1 of 2'}</span>
          </legend>
          <div className="intake-row">
            <input
              type="text" value={handle} onChange={(e) => setHandle(e.target.value)}
              placeholder="@yourbusiness" aria-label={tx('tdField', lang)}
              autoComplete="off" autoCapitalize="none" autoCorrect="off"
              spellCheck={false} dir="ltr"
              aria-invalid={errField === 'handle'} aria-describedby={errField === 'handle' ? 'intake-err' : undefined}
            />
            <button className="btn" type="submit">{tx('tdCta', lang)}</button>
          </div>
          {err && errField === 'handle' && <p className="intake-note" id="intake-err" role="alert">{err}</p>}
          <p className="intake-note">
            {tx('tdNote', lang)}{' '}
            {/* The read needs a Professional account, so the fix is one tap away
                rather than a dead end after the handle fails. */}
            <Link className="link" href={path(lang, 'instagram-professional')}>
              {tx('tdSwitch', lang)} {fwd(lang)}
            </Link>
          </p>
        </fieldset>
      </form>
    );
  }

  const sending = step === 'sending';
  return (
    <form className="intake" onSubmit={submit} noValidate>
      <fieldset className="intake-fieldset">
        <legend className="intake-step">
          <span aria-hidden="true">{stepLine(2, lang)}</span>
          <span className="sr-only">{ar ? `الخطوة ${arNum(2)} من ${arNum(2)}` : 'Step 2 of 2'}</span>
        </legend>

        <p className="intake-note" style={{ marginBottom: 'var(--s3)' }}>
          {ar ? 'حساب' : 'Reading'} <span className="ltr">@{handle}</span>
          {' · '}
          <button
            type="button" className="link"
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
            onClick={() => { setStep('handle'); setErr(null); setErrField(null); setErrKind(null); }}
          >
            {ar ? 'غيّروه' : 'change'}
          </button>
        </p>

        {/* Moved forward from a post-submit surprise: every fact that makes
            handing over a phone number an easy decision, said before the
            fields rather than after. */}
        <p className="intake-note intake-reassure">{tx('intakeReassure', lang)}</p>

        {/* The honeypot. Visually hidden, out of the tab order, carrying no
            aria attribute a screen reader would announce — a blind visitor
            never encounters it, and a script that fills every input it finds
            trips it instead. */}
        <input
          type="text" name="company" value={company} onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1} autoComplete="off" className="hp"
        />

        <div className="intake-row">
          <input
            ref={nameRef}
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder={ar ? 'اسمك' : 'Your name'}
            aria-label={ar ? 'اسمك' : 'Your name'}
            autoComplete="name" disabled={sending}
            aria-invalid={errField === 'name'} aria-describedby={errField === 'name' ? 'intake-err' : undefined}
          />
        </div>
        <div className="intake-row" style={{ marginTop: 'var(--s2)' }}>
          <input
            type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="07 9123 4567"
            aria-label={ar ? 'رقم الموبايل' : 'Mobile number'}
            autoComplete="tel" inputMode="tel" dir="ltr" disabled={sending}
            aria-invalid={errField === 'phone'} aria-describedby={errField === 'phone' ? 'intake-err' : undefined}
          />
          <button className="btn" type="submit" disabled={sending}>
            {sending ? (ar ? 'عم نبعت…' : 'Sending…') : (ar ? 'ابعتوا' : 'Send')}
          </button>
        </div>

        {err && <p className="intake-note" id="intake-err" role="alert">{err}</p>}
        {failLinks}
        <p className="intake-note">
          {ar
            ? 'الرقم للتواصل بس — منبعتلكم التحقيق عليه، وما منعطيه لحدا.'
            : 'The number is for contact only — we send the teardown to it, and we give it to nobody.'}
        </p>
      </fieldset>
    </form>
  );
}

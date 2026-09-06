import { currentTalent } from '@/lib/talent/auth';
import { bookingsForTalent } from '@/lib/store/deals';
import { msisdn } from '@/lib/notify/whatsapp';
import type { Booking } from '@/lib/data/deals';
import Portal from '@/components/t/Portal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The lost-code path.
 *
 * A code cannot be recovered — only its hash is stored — so the honest answer
 * is to put the provider in front of the person who can reissue one, in the
 * channel they are already in. No new mechanism, no new number: the same
 * operator phone the booking notices come from.
 */
const LOST = 'أنا (اكتب اسمك)، ما وصلني رمز الدخول لبرافدا. بدي رمز جديد.';

/**
 * Submit a code that arrived in the link itself.
 *
 * The message that carries this link already carries the provider's own day,
 * fee and location — it is private to them by the same means the code is, so a
 * code in its URL is a shortcut for the person the message was written for, not
 * a way past the login. A wrong one lands on `/t?bad=1`, which has no code in
 * it, so this can never loop.
 */

const AUTOSUBMIT =
  "var f=document.getElementById('tin');if(f&&!f.dataset.sent){f.dataset.sent='1';f.submit();}";

export default async function TalentPortal({
  searchParams,
}: { searchParams: Promise<{ bad?: string; code?: string }> }) {
  const { bad, code } = await searchParams;
  const me = await currentTalent();

  if (!me) {
    // Six to eight digits or nothing — the same shape the login accepts. A
    // prefilled box that then refuses to submit is worse than an empty one,
    // and a prefill the route would reject on sight is exactly that.
    const prefill = /^\d{6,8}$/.test(code ?? '') ? code : '';
    const auto = Boolean(prefill) && !bad;
    const phone = msisdn(
      (process.env.OPERATOR_PHONE || process.env.NEXT_PUBLIC_CONTACT_PHONE || '').trim(),
    );

    return (
      <main className="gate">
        <h1>PRAVDA</h1>
        <form method="post" action="/api/t/login" id="tin">
          <input
            name="code" inputMode="numeric" autoComplete="one-time-code"
            maxLength={8} placeholder="········" aria-label="رمز الدخول"
            defaultValue={prefill} autoFocus={!prefill}
          />
          <button className="go" type="submit">دخول</button>
          {bad && <p className="note" data-k="err">الرمز مش صحيح.</p>}
        </form>
        {auto && <script dangerouslySetInnerHTML={{ __html: AUTOSUBMIT }} />}
        <p className="u" style={{ marginTop: 20, lineHeight: 1.8 }}>
          الرمز بيوصلك من برافدا
          <br />
          بتضل مسجَّل على هذا الهاتف، ما بتحتاج تكتب الرمز كل مرة.
        </p>
        <p className="u" style={{ marginTop: 14 }}>
          {phone ? (
            <a href={`https://wa.me/${phone}?text=${encodeURIComponent(LOST)}`}>
              ما وصلني رمز؟
            </a>
          ) : (
            // No number configured: say the same thing without a link that
            // would open WhatsApp pointed at nobody.
            <>ما وصلني رمز؟ احكِ مع برافدا.</>
          )}
        </p>
      </main>
    );
  }

  // The only query this surface ever runs, scoped to the signed-in provider at
  // the query itself rather than filtered afterwards.
  let bookings: Booking[] = [];
  try { bookings = await bookingsForTalent(me.id); } catch { /* an unreachable store shows no days, not a crash */ }

  // Five fields, not the whole record.
  //
  // `Portal` is a client component, so everything handed to it is serialised
  // into the HTML and sits in the page source for anyone who opens it — the
  // provider, whoever is looking over their shoulder, whatever the phone syncs
  // it to. The Talent document carries `passCodeHash`, `sessionEpoch`,
  // `legalName`, `idNumber`, `dayRateJOD` and the operator's private `note`,
  // and the portal renders none of them. A password hash and an ID number in a
  // page's own source is not a leak the portal has to make to do its job, so
  // it does not make it: what crosses is what the screen actually draws.
  const meForPortal = {
    id: me.id,
    name: me.name,
    phone: me.phone,
    availability: me.availability,
    availableFrom: me.availableFrom,
  };

  return <Portal me={meForPortal} bookings={bookings} />;
}

'use client';

import { useEffect, useRef } from 'react';

/**
 * The only JavaScript on the sheet, and it does one thing.
 *
 * A client fetch rather than a server-render side effect. `/s` is
 * `force-dynamic`, so every fetch of the URL renders it — and the two fetches
 * that happen first are WhatsApp's link-preview crawler, the instant the URL is
 * pasted, and Khaled opening it himself to check it before sending. A
 * server-side stamp would record "opened" before the client had seen it, which
 * is worse than no signal: it would make the follow-up conversation wrong.
 * Crawlers do not run JavaScript, so this measures a human with a browser. The
 * cost is a reader with JavaScript off, who in a WhatsApp in-app browser is
 * essentially nobody.
 *
 * Never mounted on the specimen — there is no record there to stamp.
 */
export default function Opened({ token }: { token: string }) {
  const fired = useRef(false);
  useEffect(() => {
    // Strict mode runs effects twice in development; the count is a real
    // number an operator reads, so it is not allowed to double there.
    if (fired.current) return;
    fired.current = true;
    // `keepalive` so the write survives a reader who taps the reply button
    // before this settles. Failure is silent by design: nothing about whether
    // we managed to record a view belongs on the page being viewed.
    fetch('/api/s/opened', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ t: token }),
    }).catch(() => {});
  }, [token]);
  return null;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * A small shared handoff between routes. The content is allowed to render
 * immediately; the wash briefly covers it and then resolves, so the transition
 * never blocks navigation or traps focus inside a loading state.
 */
export default function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const first = useRef(true);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setToken((n) => n + 1);
  }, [pathname]);

  return (
    <>
      {children}
      {token > 0 && <span key={token} className="route-wash" aria-hidden="true" />}
    </>
  );
}

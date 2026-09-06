'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastKind = 'ok' | 'err';
export type ToastAction = { label: string; onClick: () => void };
export type ToastInput = { kind: ToastKind; text: string; action?: ToastAction };
type Toast = ToastInput & { id: number };

type ToastContextValue = { push: (t: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

/** Long enough to read a short sentence, short enough not to pile up. */
const OK_LIFETIME_MS = 4500;

/**
 * One stack, one rule: a success clears itself, a failure waits to be read.
 *
 * Every mutation in the console used to report through an inline `msg`
 * paragraph rendered at the bottom of whichever page it was on — invisible on
 * a phone the instant the page runs longer than one screen, which every page
 * here does. A toast appears where the tap happened, wherever that was.
 *
 * A failure never auto-dismisses: the operator has to see it go away, not
 * miss it going away. Where the action that failed can simply be tried again,
 * the toast carries that retry itself rather than sending the operator back
 * to hunt for the button they already pressed.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setToasts((ts) => [...ts, { id, ...t }]);
    if (t.kind === 'ok') setTimeout(() => dismiss(id), OK_LIFETIME_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" data-k={t.kind} key={t.id}>
            <p dir="auto">{t.text}</p>
            <div className="toast-acts">
              {t.action && (
                <button
                  type="button"
                  onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" className="x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * The one way anything in the console reports back.
 *
 * Throws outside `OpsShell` on purpose — a component that forgets to mount
 * under it should fail in development, not silently drop every message it
 * tries to show.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() called outside <OpsShell>.');
  return ctx;
}

/**
 * The action every `unauthenticated` toast carries: not a retry, since the
 * request will only fail the same way again, but a way back in that returns
 * to the page it happened on.
 */
export function reauthAction(): ToastAction {
  return {
    label: 'Sign in again',
    onClick: () => {
      const path = window.location.pathname + window.location.search;
      window.location.href = `/ops?next=${encodeURIComponent(path)}`;
    },
  };
}

'use client';

import { ToastProvider } from '@/components/ops/Toast';

/**
 * The client half of the layout.
 *
 * `app/ops/layout.tsx` does the auth check once, server-side, which is the
 * entire reason it is a server component — turning it into a client
 * component to hold toast state would put that check back on the client,
 * where it started. This wrapper is the whole cost of adding one: it holds
 * nothing but the toast stack, and every page under it can call `useToast()`
 * without knowing this file exists.
 */
export default function OpsShell({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

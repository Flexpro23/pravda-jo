/**
 * Is any of this invented?
 *
 * Lives here, in a module with no imports, because the two components that ask
 * are client components — and a client component that reaches into
 * `lib/store/content.ts` for a one-line predicate drags firebase-admin and the
 * whole gRPC stack into the browser bundle, where `net` does not exist and the
 * build fails. The store re-exports it for server callers.
 */
export const anyPlaceholder = (rows: { placeholder?: boolean }[]) =>
  rows.some((r) => r.placeholder);

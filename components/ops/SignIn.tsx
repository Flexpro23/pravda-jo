/**
 * The console's one gate.
 *
 * There were seven of these, one per page, each with its own wording and each
 * of them dropping the destination — so a notification link to a client always
 * became "sign in", then the queue, then find the link again. Now the layout
 * renders this instead of the page, and the page it would have rendered comes
 * back through `next`.
 *
 * A server component: it holds no state, and the one interaction it has is a
 * form post the browser already knows how to make.
 */
export default function SignIn({ next, bad }: { next: string; bad?: boolean }) {
  return (
    <main className="gate">
      <h1>PRAVDA — operator</h1>
      <form method="post" action="/api/ops/login">
        {/* `type="password"` so it does not sit on screen in a café, and
            `autoComplete="off"` so no browser offers to remember a key that
            belongs in Secret Manager. */}
        <input
          type="password" name="key" autoFocus autoComplete="off"
          placeholder="Operator key" aria-label="Operator key"
        />
        <input type="hidden" name="next" value={next} />
        <button className="go" type="submit">Enter</button>
        {bad && <p className="note" data-k="err">That key was not accepted.</p>}
      </form>
      <p className="muted" style={{ marginTop: 18 }}>
        The key is in Secret Manager as OPERATOR_KEY.
      </p>
    </main>
  );
}

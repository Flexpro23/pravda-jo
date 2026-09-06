'use client';

import { ago, type Task } from '@/lib/ops/today';
import TaskAction from '@/components/ops/TaskAction';

/**
 * One sentence at the top of the account, and the button that answers it.
 *
 * Derived from the same rules as the Today queue rather than from a second
 * reading of the same fields — a client page that says "waiting on a message"
 * while Today has already dropped it is worse than a page that says nothing.
 */
export default function NextAction({ task }: { task: Task | null }) {
  if (!task) {
    return (
      <div className="next" data-none>
        <p className="next-t">Nothing is owed on this account.</p>
        <p className="next-s">
          Everything that could be sent has been sent, and nothing has gone
          stale. Anything further is a decision, not a task.
        </p>
      </div>
    );
  }

  return (
    <div className="next">
      <p className="next-t" dir="auto">{task.title}</p>
      <p className="next-s" dir="auto">
        {task.sub} <span className="muted mono">· {ago(task.ageMins)}</span>
      </p>
      <TaskAction task={task} />
    </div>
  );
}

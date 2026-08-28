import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * One Firestore handle for the process.
 *
 * On App Hosting the runtime service account is already present, so
 * `applicationDefault()` resolves with nothing configured. Locally there is no
 * such identity, so a service-account JSON is read from the environment — as a
 * single-line variable rather than a file, because a key file in the working
 * tree eventually gets committed.
 */
let db: Firestore | null = null;

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const svc = JSON.parse(raw);
    return initializeApp({
      credential: cert({
        projectId: svc.project_id,
        clientEmail: svc.client_email,
        // Newlines survive an env var only as escapes; Firestore needs them real.
        privateKey: String(svc.private_key).replace(/\\n/g, '\n'),
      }),
      projectId: svc.project_id,
    });
  }
  // Pin the project explicitly. App Hosting sets these; a developer machine
  // often has application-default credentials pointing at some unrelated
  // project, and an unpinned Admin SDK would quietly read that one instead —
  // an empty queue that looks like an empty database rather than a wrong one.
  const projectId = process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || process.env.FIREBASE_PROJECT_ID;
  return initializeApp({ credential: applicationDefault(), projectId });
}

export function store(): Firestore {
  if (!db) {
    const fresh = getFirestore(app());
    // A teardown is written once and read many times; undefined fields are a
    // normal outcome of an optional section rather than an error.
    //
    // Guarded, because Next compiles the server into more than one module
    // graph — a page and a route handler do not share this file's `db`, but
    // they do share the one Firestore underneath it. The second graph to get
    // here finds a handle that is already configured, and settings() throws
    // rather than no-opping, which turns an already-applied setting into a
    // 500. The throw is the only thing being swallowed: the setting itself
    // was applied by whichever graph arrived first.
    try {
      fresh.settings({ ignoreUndefinedProperties: true });
    } catch { /* already configured, same object, same setting */ }
    db = fresh;
  }
  return db;
}

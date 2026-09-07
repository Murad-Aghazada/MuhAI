/* ============================================================
   Firebase — Muhai's system of record.

   Cloud Firestore holds every company's data (invoices, transactions,
   products, employees, tax obligations); Firebase Auth handles company
   sign-up and sign-in. Postgres is no longer in the path.

   The config below is read from the environment and is public by design:
   it identifies the project, it does not grant access. Access is decided
   by Auth + the rules in firestore.rules.
   ============================================================ */
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
)

if (!isFirebaseConfigured) {
  console.error(
    '[muhai] Firebase is not configured. Copy web/.env.example to web/.env.local ' +
      'and fill in the VITE_FIREBASE_* values, then restart the dev server.',
  )
}

// getApps() guards against Vite HMR re-initialising the app on every edit.
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const projectId = firebaseConfig.projectId

// Keep the session across reloads. Failure here is non-fatal — the user just
// gets an in-memory session for this tab.
setPersistence(auth, browserLocalPersistence).catch((e) =>
  console.warn('[muhai] Auth persistence unavailable; session is tab-only.', e),
)

export default app

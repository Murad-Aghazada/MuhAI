/* Firebase — used as the RAG knowledge base for the AI assistant.
   The assistant retrieves accounting/tax knowledge documents from the
   Realtime Database and grounds Gemini's answers on them. */
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, set } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyBddU5RNPQuFg6sKr8JzW1RKZNd90Dz7Jc',
  authDomain: 'cyberxbank-7dc0b.firebaseapp.com',
  databaseURL: 'https://cyberxbank-7dc0b-default-rtdb.firebaseio.com',
  projectId: 'cyberxbank-7dc0b',
  storageBucket: 'cyberxbank-7dc0b.firebasestorage.app',
  messagingSenderId: '448176780627',
  appId: '1:448176780627:web:463aab01136eef36c85da6',
  measurementId: 'G-RXMNBXBJVW',
}

let app
let db
try {
  app = initializeApp(firebaseConfig)
  db = getDatabase(app)
} catch (e) {
  console.warn('[muhai] Firebase init failed; RAG falls back to local knowledge base.', e)
}

const KB_PATH = 'muhai/knowledgeBase'

/** Fetch the knowledge-base documents stored in Firebase RTDB. */
export async function fetchKnowledgeBase() {
  if (!db) return null
  try {
    const snap = await get(ref(db, KB_PATH))
    return snap.exists() ? snap.val() : null
  } catch (e) {
    console.warn('[muhai] KB fetch failed; using local fallback.', e)
    return null
  }
}

/** Seed the knowledge base into Firebase (called once on first load). */
export async function seedKnowledgeBase(docs) {
  if (!db) return false
  try {
    const snap = await get(ref(db, KB_PATH))
    if (snap.exists()) return true // already seeded
    await set(ref(db, KB_PATH), docs)
    return true
  } catch (e) {
    console.warn('[muhai] KB seed failed (read-only rules?); using local fallback.', e)
    return false
  }
}

export { db }

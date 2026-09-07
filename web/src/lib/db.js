/* ============================================================
   Firestore data access.

   One company per account. Everything the company owns lives in
   subcollections beneath its document, which is what makes the security
   rules a single ownership check:

     users/{uid}                     -> { companyId, displayName, email }
     companies/{companyId}           -> profile + members[]
       .../invoices/{id}
       .../transactions/{id}
       .../products/{id}
       .../employees/{id}
       .../taxObligations/{id}

   Dates are stored as ISO "YYYY-MM-DD" strings rather than Timestamps: they
   are calendar dates (an invoice is dated the 5th regardless of timezone),
   they sort lexicographically, and they cross the API boundary unchanged.
   ============================================================ */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'

export const COLLECTIONS = {
  invoices: 'invoices',
  transactions: 'transactions',
  products: 'products',
  employees: 'employees',
  taxObligations: 'taxObligations',
}

// ── Paths ─────────────────────────────────────────────────────────────
export const userRef = (uid) => doc(db, 'users', uid)
export const companyRef = (companyId) => doc(db, 'companies', companyId)
export const subCollection = (companyId, name) =>
  collection(db, 'companies', companyId, name)
export const subDoc = (companyId, name, id) =>
  doc(db, 'companies', companyId, name, id)

// ── User ↔ company link ───────────────────────────────────────────────
export async function getUserProfile(uid) {
  const snap = await getDoc(userRef(uid))
  return snap.exists() ? { uid, ...snap.data() } : null
}

export async function getCompany(companyId) {
  const snap = await getDoc(companyRef(companyId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/**
 * Create the company document and link it to its owner.
 * Written as one batch so a half-registered account can never exist.
 */
export async function createCompany(uid, { email, displayName, company }) {
  const companyId = doc(collection(db, 'companies')).id
  const batch = writeBatch(db)

  batch.set(companyRef(companyId), {
    name: company.name,
    taxId: company.taxId || '',
    taxOffice: company.taxOffice || '',
    sector: company.sector || 'general',
    city: company.city || '',
    email,
    legalForm: company.legalForm || 'ltd',
    currency: 'TRY',
    cashBalance: 0,
    ownerUid: uid,
    members: [uid],
    seeded: false,
    createdAt: serverTimestamp(),
  })

  batch.set(userRef(uid), {
    email,
    displayName: displayName || '',
    companyId,
    role: 'owner',
    createdAt: serverTimestamp(),
  })

  await batch.commit()
  return companyId
}

export async function updateCompany(companyId, patch) {
  await updateDoc(companyRef(companyId), patch)
}

// ── Generic subcollection CRUD ────────────────────────────────────────
export async function listAll(companyId, name, orderField) {
  const base = subCollection(companyId, name)
  const q = orderField ? query(base, orderBy(orderField, 'desc')) : base
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Live subscription. Returns the unsubscribe function. */
export function watch(companyId, name, orderField, onData, onError) {
  const base = subCollection(companyId, name)
  const q = orderField ? query(base, orderBy(orderField, 'desc')) : base
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error(`[muhai] ${name} subscription failed`, err)
      onError?.(err)
    },
  )
}

export async function addItem(companyId, name, data) {
  const ref = doc(subCollection(companyId, name))
  await setDoc(ref, { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export async function updateItem(companyId, name, id, patch) {
  await updateDoc(subDoc(companyId, name, id), patch)
}

export async function removeItem(companyId, name, id) {
  await deleteDoc(subDoc(companyId, name, id))
}

/**
 * Write many documents at once.
 * Firestore caps a batch at 500 writes, so this chunks automatically.
 */
export async function addMany(companyId, name, items) {
  const CHUNK = 400
  const ids = []
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const item of items.slice(i, i + CHUNK)) {
      const ref = doc(subCollection(companyId, name))
      batch.set(ref, { ...item, createdAt: serverTimestamp() })
      ids.push(ref.id)
    }
    await batch.commit()
  }
  return ids
}

/** Delete every document in a subcollection. Used by "reset demo data". */
export async function clearCollection(companyId, name) {
  const snap = await getDocs(subCollection(companyId, name))
  const CHUNK = 400
  const refs = snap.docs.map((d) => d.ref)
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db)
    refs.slice(i, i + CHUNK).forEach((r) => batch.delete(r))
    await batch.commit()
  }
  return refs.length
}

// ── Invoice → ledger ──────────────────────────────────────────────────
/**
 * Save an invoice and, when it is already paid, the matching cash movement —
 * atomically, so the dashboard can never show an invoice whose money never
 * moved (or the reverse).
 */
export async function saveInvoiceWithLedger(companyId, invoice) {
  const batch = writeBatch(db)

  const invRef = doc(subCollection(companyId, COLLECTIONS.invoices))
  batch.set(invRef, { ...invoice, createdAt: serverTimestamp() })

  if (invoice.status === 'paid') {
    const txRef = doc(subCollection(companyId, COLLECTIONS.transactions))
    batch.set(txRef, {
      date: invoice.paidDate || invoice.issueDate,
      amount: invoice.amount,
      type: invoice.direction === 'sales' ? 'income' : 'expense',
      category: invoice.category || 'other',
      description: `${invoice.number} · ${invoice.vendor}`,
      vendor: invoice.vendor,
      invoiceId: invRef.id,
      createdAt: serverTimestamp(),
    })
  }

  await batch.commit()
  return invRef.id
}

/**
 * Flip an invoice to paid and post the cash movement in the same batch.
 */
export async function markInvoicePaid(companyId, invoice, paidDate) {
  const batch = writeBatch(db)
  const when = paidDate || new Date().toISOString().slice(0, 10)

  batch.update(subDoc(companyId, COLLECTIONS.invoices, invoice.id), {
    status: 'paid',
    paidDate: when,
  })

  const txRef = doc(subCollection(companyId, COLLECTIONS.transactions))
  batch.set(txRef, {
    date: when,
    amount: invoice.amount,
    type: invoice.direction === 'sales' ? 'income' : 'expense',
    category: invoice.category || 'other',
    description: `${invoice.number} · ${invoice.vendor}`,
    vendor: invoice.vendor,
    invoiceId: invoice.id,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}

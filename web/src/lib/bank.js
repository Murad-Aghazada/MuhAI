/* ============================================================
   Bank statement client.

   /api/bank is the only surface that reaches outside this stack, and it is
   optional by design: `getBankStatus()` says whether a bank is connected, and
   when it is not, the CSV import path produces exactly the same rows. The
   Bank screen decides which half of itself to show from that one call.

   Credentials never come near the browser. They belong to the deployment and
   live in the API's environment; this file only ever sends a date range.
   ============================================================ */
import { get, post, request } from './client.js'

const PREFIX = '/api/bank'

/** Is a bank connected — and if not, which setting is missing. */
export const getBankStatus = () => get(`${PREFIX}/status`)

export const listBankAccounts = () => get(`${PREFIX}/accounts`)

/** Fetch a statement without matching it. */
export const fetchStatement = (body) =>
  post(`${PREFIX}/transactions`, body, { timeout: 45000 })

/** Fetch and match in one round trip — what the screen's main button calls. */
export const syncStatement = (body) => post(`${PREFIX}/sync`, body, { timeout: 60000 })

/** Match rows the browser already holds (a CSV import, or a fetch on screen). */
export const reconcileStatement = (body) =>
  post(`${PREFIX}/reconcile`, body, { timeout: 45000 })

/** Parse a statement exported from internet banking. Needs no bank API. */
export function importStatement(file) {
  const form = new FormData()
  form.append('file', file)
  return request(`${PREFIX}/import`, {
    method: 'POST',
    body: form,
    isForm: true,
    timeout: 45000,
  })
}

/**
 * Workspace invoice documents -> the slice the matcher needs.
 *
 * The bank router reads no table, so the browser posts what it already has.
 * Paid invoices are kept: a statement covers a period, and the payment that
 * settled an invoice last week is exactly the row we want recognised rather
 * than flagged as unexplained.
 */
export function invoiceRefs(invoices = []) {
  return invoices
    .filter((i) => Number(i.amount) > 0)
    .map((i) => ({
      id: i.id,
      amount: Number(i.amount) || 0,
      date: i.paidDate || i.issueDate || null,
      vendor: i.vendor || null,
      number: i.number || null,
      direction: i.direction === 'sales' ? 'sales' : 'purchase',
      status: i.status || 'pending',
    }))
}

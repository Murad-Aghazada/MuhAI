/* ============================================================
   Company data.

   Subscribes to the company's Firestore collections (so every write shows
   up in the UI immediately, in every open tab) and asks the compute API for
   the derived analytics: dashboard rollup, Muhai Score, Prophet forecast,
   tax summary and payroll.

   If the API is unreachable the dashboard still renders — the same
   aggregations are computed locally and `apiOnline` goes false so the UI can
   say so honestly instead of showing stale or invented numbers.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { COLLECTIONS, watch } from '../lib/db.js'
import { buildSnapshot, localDashboard, todayIso } from '../lib/analytics.js'
import * as api from '../lib/api.js'
import { useAuth } from './AuthContext.jsx'

const DataContext = createContext(null)

const EMPTY = { invoices: [], transactions: [], products: [], employees: [], taxObligations: [] }

export function DataProvider({ children }) {
  const { companyId, company } = useAuth()

  const [raw, setRaw] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)

  const [dashboard, setDashboard] = useState(null)
  const [score, setScore] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [taxSummary, setTaxSummary] = useState(null)
  const [payroll, setPayroll] = useState(null)

  const [apiOnline, setApiOnline] = useState(true)
  const [apiError, setApiError] = useState(null)
  const [computing, setComputing] = useState(false)

  // ── Firestore subscriptions ─────────────────────────────────────────
  useEffect(() => {
    if (!companyId) {
      setRaw(EMPTY)
      setLoading(false)
      return
    }

    setLoading(true)
    const arrived = new Set()
    const specs = [
      [COLLECTIONS.invoices, 'issueDate'],
      [COLLECTIONS.transactions, 'date'],
      [COLLECTIONS.products, null],
      [COLLECTIONS.employees, null],
      [COLLECTIONS.taxObligations, 'dueDate'],
    ]

    const unsubs = specs.map(([name, orderField]) =>
      watch(
        companyId,
        name,
        orderField,
        (docs) => {
          setRaw((prev) => ({ ...prev, [name]: docs }))
          arrived.add(name)
          if (arrived.size === specs.length) setLoading(false)
        },
        (err) => {
          setDbError(err)
          setLoading(false)
        },
      ),
    )

    return () => unsubs.forEach((u) => u?.())
  }, [companyId])

  // ── Snapshot posted to the compute API ──────────────────────────────
  const snapshot = useMemo(
    () =>
      buildSnapshot({
        company,
        transactions: raw.transactions,
        invoices: raw.invoices,
        products: raw.products,
        employees: raw.employees,
        asOf: todayIso(),
      }),
    [company, raw.transactions, raw.invoices, raw.products, raw.employees],
  )

  // Compare by content: Firestore hands back new array identities on every
  // snapshot, and recomputing a Prophet forecast on each one would be absurd.
  const snapshotKey = useMemo(() => JSON.stringify(snapshot), [snapshot])
  const lastComputed = useRef(null)

  const recompute = useCallback(
    async (payload) => {
      setComputing(true)
      const results = await Promise.allSettled([
        api.getDashboard(payload),
        api.getMuhaiScore(payload),
        api.getForecast(payload, 30),
        api.getTaxSummary(payload),
        api.runPayroll(payload),
      ])
      const [d, s, f, t, p] = results

      const anyOk = results.some((r) => r.status === 'fulfilled')
      setApiOnline(anyOk)
      const firstFailure = results.find((r) => r.status === 'rejected')
      setApiError(anyOk ? null : firstFailure?.reason ?? null)

      setDashboard(
        d.status === 'fulfilled'
          ? d.value
          : localDashboard(
              { company, transactions: raw.transactions, invoices: raw.invoices },
              todayIso(),
            ),
      )
      if (s.status === 'fulfilled') setScore(s.value)
      if (f.status === 'fulfilled') setForecast(f.value)
      if (t.status === 'fulfilled') setTaxSummary(t.value)
      if (p.status === 'fulfilled') setPayroll(p.value)

      if (!anyOk) {
        // Keep whatever the API last returned rather than blanking the panels;
        // the offline badge tells the user those figures are not live.
        console.warn('[muhai] compute API unreachable; showing local aggregation only')
      }
      setComputing(false)
    },
    [company, raw.transactions, raw.invoices],
  )

  useEffect(() => {
    if (loading || !companyId) return
    if (lastComputed.current === snapshotKey) return
    lastComputed.current = snapshotKey
    recompute(snapshot)
  }, [loading, companyId, snapshotKey, snapshot, recompute])

  const refresh = useCallback(() => {
    lastComputed.current = null
    return recompute(snapshot)
  }, [recompute, snapshot])

  // Local aggregation is always available, so panels have something to show
  // during the very first round trip.
  const fallback = useMemo(
    () => localDashboard({ company, transactions: raw.transactions, invoices: raw.invoices }, todayIso()),
    [company, raw.transactions, raw.invoices],
  )

  const value = useMemo(
    () => ({
      companyId,
      company,
      loading,
      dbError,
      invoices: raw.invoices,
      transactions: raw.transactions,
      products: raw.products,
      employees: raw.employees,
      taxObligations: raw.taxObligations,
      snapshot,
      dashboard: dashboard || fallback,
      score,
      forecast,
      taxSummary,
      payroll,
      apiOnline,
      apiError,
      computing,
      isEmpty: !loading && raw.transactions.length === 0 && raw.invoices.length === 0,
      refresh,
    }),
    [
      companyId, company, loading, dbError, raw, snapshot, dashboard, fallback,
      score, forecast, taxSummary, payroll, apiOnline, apiError, computing, refresh,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}

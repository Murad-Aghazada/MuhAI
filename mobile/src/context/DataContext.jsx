/* ============================================================
   Company data, for the phone.

   A port of web/src/context/DataContext.jsx rather than a shared import, and
   the difference is deliberate: the web version fans out to six compute
   endpoints on every snapshot change — dashboard, score, forecast,
   tax-summary, payroll, compliance. Two of those feed screens this app does
   not have (Tax, Payroll), and the forecast carries a 45-second timeout. On a
   phone, over whatever Wi-Fi the user is standing in, that is three requests
   of pure waste on every load.

   So this fetches the three the mobile screens actually read, and leaves the
   forecast to be asked for by a screen that wants it.

   Everything of value underneath — loadWorkspace, buildSnapshot,
   localDashboard, the onChange notification — is the shared code, unchanged.
   ============================================================ */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'

import { loadWorkspace, onChange, vendorCategoryMap } from '../shared/db.js'
import { buildSnapshot, localDashboard, todayIso } from '../shared/analytics.js'
import * as api from '../shared/api.js'
import { useAuth } from '../shared/AuthContext.js'

const DataContext = createContext(null)

const EMPTY = {
  invoices: [], transactions: [], products: [], employees: [], taxObligations: [],
  vendorCategories: [],
}

const RELOAD_DEBOUNCE_MS = 150

export function DataProvider({ children }) {
  const { companyId, company: authCompany, refreshCompany } = useAuth()

  const [raw, setRaw] = useState(EMPTY)
  const [company, setCompany] = useState(authCompany)
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)

  const [dashboard, setDashboard] = useState(null)
  const [score, setScore] = useState(null)
  const [compliance, setCompliance] = useState(null)
  const [forecast, setForecast] = useState(null)

  const [apiOnline, setApiOnline] = useState(true)
  const [computing, setComputing] = useState(false)

  useEffect(() => setCompany(authCompany), [authCompany])

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!companyId) {
      setRaw(EMPTY)
      setLoading(false)
      return
    }
    try {
      const workspace = await loadWorkspace()
      if (!mounted.current) return
      setRaw({
        invoices: workspace.invoices ?? [],
        transactions: workspace.transactions ?? [],
        products: workspace.products ?? [],
        employees: workspace.employees ?? [],
        taxObligations: workspace.taxObligations ?? [],
        vendorCategories: workspace.vendorCategories ?? [],
      })
      if (workspace.company) setCompany(workspace.company)
      setDbError(null)
    } catch (err) {
      if (!mounted.current) return
      setDbError(err)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Every write announces itself through db.js; reload, debounced, exactly as
  // the web app does.
  useEffect(() => {
    if (!companyId) return undefined
    let timer = null
    const unsubscribe = onChange(() => {
      clearTimeout(timer)
      timer = setTimeout(load, RELOAD_DEBOUNCE_MS)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [companyId, load])

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
    [company, raw],
  )
  const snapshotKey = useMemo(() => JSON.stringify(snapshot), [snapshot])

  const learnedCategories = useMemo(
    () => vendorCategoryMap(raw.vendorCategories),
    [raw.vendorCategories],
  )

  const fallback = useMemo(
    () =>
      localDashboard(
        { company, transactions: raw.transactions, invoices: raw.invoices },
        todayIso(),
      ),
    [company, raw.transactions, raw.invoices],
  )

  const recompute = useCallback(
    async (payload) => {
      setComputing(true)
      const results = await Promise.allSettled([
        api.getDashboard(payload),
        api.getMuhaiScore(payload),
        api.getCompliance(payload),
      ])
      const [d, s, c] = results

      const anyOk = results.some((r) => r.status === 'fulfilled')
      if (!mounted.current) return
      setApiOnline(anyOk)

      // Never a blank screen and never an invented number: when the compute
      // API cannot be reached the same figures are derived locally and the
      // offline badge says so.
      setDashboard(d.status === 'fulfilled' ? d.value : fallback)
      if (s.status === 'fulfilled') setScore(s.value)
      // Alerts are derived, never stored: a stale list would accuse the user
      // of a duplicate they have already fixed.
      setCompliance(c.status === 'fulfilled' ? c.value : null)
      setComputing(false)
    },
    [fallback],
  )

  const lastComputed = useRef(null)
  useEffect(() => {
    if (loading || !companyId) return
    if (lastComputed.current === snapshotKey) return
    lastComputed.current = snapshotKey
    recompute(snapshot)
  }, [loading, companyId, snapshotKey, snapshot, recompute])

  /** The forecast is not fetched on load — it is the slow one. A screen that
      wants it asks, and the answer is cached until the next refresh. */
  const loadForecast = useCallback(
    async (horizon = 30) => {
      try {
        const result = await api.getForecast(snapshot, horizon)
        if (mounted.current) setForecast(result)
        return result
      } catch {
        return null
      }
    },
    [snapshot],
  )

  const refresh = useCallback(async () => {
    lastComputed.current = null
    setForecast(null)
    await load()
    await refreshCompany().catch(() => {})
    return recompute(snapshot)
  }, [load, recompute, refreshCompany, snapshot])

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
      vendorCategories: raw.vendorCategories,
      learnedCategories,
      snapshot,
      dashboard: dashboard || fallback,
      score,
      compliance,
      forecast,
      loadForecast,
      apiOnline,
      computing,
      isEmpty: !loading && raw.transactions.length === 0 && raw.invoices.length === 0,
      refresh,
    }),
    [
      companyId, company, loading, dbError, raw, snapshot, dashboard, fallback,
      score, compliance, forecast, loadForecast, learnedCategories, apiOnline,
      computing, refresh,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}

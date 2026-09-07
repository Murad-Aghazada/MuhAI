import { useState } from 'react'
import { motion } from 'framer-motion'
import { Database, Loader2 } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { seedCompany } from '../../lib/seed.js'

/**
 * Shown when a company has no data at all. Offers the one action that makes
 * every other screen meaningful: seed a realistic dataset.
 */
export default function EmptyState({ title, body }) {
  const { t } = useLang()
  const { companyId, refreshCompany } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSeed() {
    if (!companyId) return
    setBusy(true)
    setError(null)
    try {
      await seedCompany(companyId)
      await refreshCompany()
    } catch (e) {
      console.error('[muhai] seeding failed', e)
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <motion.div className="empty-state" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <span className="empty-state__icon">
          <Database size={26} strokeWidth={1.9} />
        </span>
        <h2>{title || t('common.emptyTitle')}</h2>
        <p>{body || t('common.emptyBody')}</p>
        {error && <div className="auth-alert auth-alert--error">{error}</div>}
        <button className="btn btn--brand" onClick={handleSeed} disabled={busy}>
          {busy && <Loader2 size={16} className="spin" />}
          {busy ? t('common.loadingDemo') : t('common.loadDemo')}
        </button>
      </motion.div>
    </div>
  )
}

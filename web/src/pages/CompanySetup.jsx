import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Loader2, LogOut } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { authErrorMessage, useAuth } from '../context/AuthContext.jsx'
import { createCompany } from '../lib/db.js'
import { seedCompany } from '../lib/seed.js'
import AuthShell from '../components/auth/AuthShell.jsx'

const SECTORS = ['general', 'retail', 'manufacturing', 'services', 'logistics', 'food', 'tech', 'construction']
const LEGAL_FORMS = ['ltd', 'as', 'sahis', 'koop']

/**
 * Recovery screen for a signed-in account that has no company yet.
 *
 * This happens when registration created the Firebase Auth user and then the
 * Firestore write failed (rules not published, offline, tab closed). Without
 * this the account is stranded: it can sign in but has nothing to sign in to.
 */
export default function CompanySetup() {
  const { t, lang } = useLang()
  const { user, refreshCompany, logout } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    companyName: '',
    taxId: '',
    taxOffice: '',
    city: '',
    sector: 'general',
    legalForm: 'ltd',
    withDemoData: true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.companyName.trim()) {
      setError(t('auth.required'))
      return
    }
    if (form.taxId && !/^\d{10}$/.test(form.taxId.trim())) {
      setError(t('auth.invalidTaxId'))
      return
    }

    setBusy(true)
    try {
      const companyId = await createCompany(user.uid, {
        email: user.email,
        displayName: user.displayName || '',
        company: {
          name: form.companyName.trim(),
          taxId: form.taxId.trim(),
          taxOffice: form.taxOffice.trim(),
          city: form.city.trim(),
          sector: form.sector,
          legalForm: form.legalForm,
        },
      })
      if (form.withDemoData) {
        try {
          await seedCompany(companyId)
        } catch (seedErr) {
          console.error('[muhai] demo seeding failed', seedErr)
        }
      }
      await refreshCompany()
      navigate('/app', { replace: true })
      // The auth listener re-reads the profile; a reload guarantees every
      // subscription restarts against the new company id.
      window.location.reload()
    } catch (err) {
      setError(authErrorMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={lang === 'en' ? 'Finish setting up your company' : 'İşletme kurulumunu tamamlayın'}
      subtitle={
        lang === 'en'
          ? `Signed in as ${user?.email}. This account has no company yet.`
          : `${user?.email} olarak giriş yaptınız. Bu hesaba bağlı bir işletme yok.`
      }
      wide
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span className="field__label">{t('auth.companyName')}</span>
          <span className="field__wrap">
            <Building2 size={16} strokeWidth={2.1} />
            <input value={form.companyName} onChange={set('companyName')} required placeholder="Atlas Ticaret Ltd. Şti." />
          </span>
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">{t('auth.taxId')}</span>
            <span className="field__wrap">
              <input value={form.taxId} onChange={set('taxId')} inputMode="numeric" maxLength={10} placeholder="4830027561" />
            </span>
          </label>
          <label className="field">
            <span className="field__label">{t('auth.taxOffice')}</span>
            <span className="field__wrap">
              <input value={form.taxOffice} onChange={set('taxOffice')} placeholder="Kadıköy" />
            </span>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">{t('auth.city')}</span>
            <span className="field__wrap">
              <input value={form.city} onChange={set('city')} placeholder="İstanbul" />
            </span>
          </label>
          <label className="field">
            <span className="field__label">{t('auth.legalForm')}</span>
            <span className="field__wrap">
              <select value={form.legalForm} onChange={set('legalForm')}>
                {LEGAL_FORMS.map((k) => (
                  <option key={k} value={k}>{t(`auth.legalOptions.${k}`)}</option>
                ))}
              </select>
            </span>
          </label>
        </div>

        <label className="field">
          <span className="field__label">{t('auth.sector')}</span>
          <span className="field__wrap">
            <select value={form.sector} onChange={set('sector')}>
              {SECTORS.map((k) => (
                <option key={k} value={k}>{t(`auth.sectorOptions.${k}`)}</option>
              ))}
            </select>
          </span>
        </label>

        <label className="checkbox-row">
          <input type="checkbox" checked={form.withDemoData} onChange={set('withDemoData')} />
          <span>
            <strong>{t('auth.demoToggle')}</strong>
            <em>{t('auth.demoToggleHint')}</em>
          </span>
        </label>

        {error && <div className="auth-alert auth-alert--error">{error}</div>}

        <button className="btn btn--brand btn--block" type="submit" disabled={busy}>
          {busy && <Loader2 size={16} className="spin" />}
          {busy ? t('auth.registering') : t('auth.register')}
        </button>
      </form>

      <div className="auth-foot">
        <button
          className="link-btn"
          onClick={async () => {
            await logout()
            navigate('/login', { replace: true })
          }}
        >
          <LogOut size={14} strokeWidth={2.2} /> {t('auth.logout')}
        </button>
      </div>
    </AuthShell>
  )
}

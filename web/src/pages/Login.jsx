import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Lock, Mail } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { authErrorMessage, useAuth } from '../context/AuthContext.jsx'
import AuthShell from '../components/auth/AuthShell.jsx'
import GoogleButton from '../components/auth/GoogleButton.jsx'
import { Btn } from '../components/ui/lp.jsx'

export default function Login() {
  const { t, lang } = useLang()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const from = location.state?.from?.pathname || '/app'

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login({ email: email.trim(), password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(authErrorMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSub')}
      alt={{ to: '/register', quiet: t('auth.noAccount'), cta: t('lp.start') }}
    >
      <GoogleButton onDone={() => navigate(from, { replace: true })} />

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span className="field__label">{t('auth.email')}</span>
          <span className="field__wrap">
            <Mail strokeWidth={1.6} />
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@sirket.com"
            />
          </span>
        </label>

        <label className="field">
          <span className="field__label">{t('auth.password')}</span>
          <span className="field__wrap">
            <Lock strokeWidth={1.6} />
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </span>
        </label>

        {error && (
          <motion.div className="lp-alert lp-alert--error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

        <Btn
          type="submit"
          variant="wide"
          label={busy ? t('auth.loggingIn') : t('auth.login')}
          icon={busy ? SpinIcon : undefined}
          disabled={busy}
        />
      </form>

      <div className="lp-auth__switch">
        {t('auth.noAccount')} <Link to="/register">{t('auth.createOne')}</Link>
      </div>
    </AuthShell>
  )
}

/* The chip's glyph while the request is out. It is drawn at the same 24 grid
   as the arrow it replaces, so the chip does not resize under the swap. */
function SpinIcon() {
  return <Loader2 className="spin" width="24" height="24" strokeWidth={1.5} />
}

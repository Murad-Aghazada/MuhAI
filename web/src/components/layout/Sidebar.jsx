import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, ReceiptText, Landmark, Banknote, Boxes, Users, Sparkles, Settings, X } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

function Item({ to, end, icon: Icon, label, badge, onClick }) {
  return (
    <NavLink to={to} end={end} onClick={onClick} className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}>
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="nav-active-bg" className="nav-item__bg" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
          <span className="nav-item__icon">
            <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
          </span>
          <span className="nav-item__text">{label}</span>
          {badge ? <span className="nav-item__badge">{badge}</span> : null}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  const { t } = useLang()
  const { company } = useAuth()
  const { invoices, products, score } = useData()

  // Badges count real, actionable things — unpaid invoices and low stock.
  const unpaid = invoices.filter((i) => i.status !== 'paid').length
  const lowStock = products.filter((p) => (p.stock ?? 0) <= (p.minStock ?? 0)).length

  const MAIN = [
    { to: '/app', id: 'dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/invoices', id: 'invoices', icon: ReceiptText, badge: unpaid || null },
    { to: '/app/tax', id: 'tax', icon: Landmark },
    { to: '/app/bank', id: 'bank', icon: Banknote },
    { to: '/app/inventory', id: 'inventory', icon: Boxes, badge: lowStock || null },
    { to: '/app/payroll', id: 'payroll', icon: Users },
  ]

  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <NavLink to="/" className="sidebar__brand">
            <span className="sidebar__logo">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <path d="M7 23V9.5C7 9.22 7.22 9 7.5 9C7.66 9 7.8 9.07 7.9 9.2L13.6 16.4C13.8 16.66 14.2 16.66 14.4 16.4L20.1 9.2C20.2 9.07 20.34 9 20.5 9C20.78 9 21 9.22 21 9.5V23" stroke="#0E9F6E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="24" cy="22.5" r="2" fill="#0E9F6E" />
              </svg>
            </span>
            <span>
              <div className="sidebar__brand-name">Muhai</div>
              <div className="sidebar__brand-tag">{t('common.tagline')}</div>
            </span>
          </NavLink>
          <button className="sidebar__close topbar__icon-btn" onClick={onClose} aria-label="Close menu" style={{ width: 34, height: 34 }}>
            <X size={18} />
          </button>
        </div>

        <nav>
          <div className="sidebar__group-label">{t('nav.groupMain')}</div>
          {MAIN.map((it) => (
            <Item key={it.to} {...it} label={t(`nav.${it.id}`)} onClick={onClose} />
          ))}
          <div className="sidebar__group-label">{t('nav.groupAi')}</div>
          <Item to="/app/assistant" icon={Sparkles} label={t('nav.assistant')} badge="AI" onClick={onClose} />
          <Item to="/app/settings" icon={Settings} label={t('nav.settings')} onClick={onClose} />
        </nav>

        <div className="sidebar__foot">
          <div className="sidebar__company">
            <div className="sidebar__company-name">{company?.name || '—'}</div>
            {company?.taxId && <div className="sidebar__company-meta mono">VKN {company.taxId}</div>}
            {score && (
              <div className={`sidebar__score sidebar__score--${score.rating}`}>
                <span>Muhai Score</span>
                <strong className="tnum">{score.total_score}</strong>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

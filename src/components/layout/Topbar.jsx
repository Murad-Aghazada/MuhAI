import { Search, Bell, Menu } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'
import LanguageToggle from './LanguageToggle.jsx'

export default function Topbar({ onMenu }) {
  const { t } = useLang()
  return (
    <header className="topbar">
      <button className="mobile-menu-btn topbar__icon-btn" onClick={onMenu} aria-label="Menu" style={{ width: 40, height: 40 }}>
        <Menu size={19} />
      </button>

      <label className="topbar__search">
        <Search size={17} strokeWidth={2.2} />
        <input placeholder={t('common.search')} aria-label={t('common.search')} />
      </label>

      <div className="topbar__spacer" />

      <LanguageToggle />

      <button className="topbar__icon-btn" aria-label="Notifications">
        <Bell size={18} strokeWidth={2.1} />
        <span className="topbar__notif-dot" />
      </button>

      <div className="topbar__avatar">
        <span className="topbar__avatar-img">EB</span>
        <span>
          <div className="topbar__avatar-name">Emin B.</div>
          <div className="topbar__avatar-role">Atlas Ticaret</div>
        </span>
      </div>
    </header>
  )
}

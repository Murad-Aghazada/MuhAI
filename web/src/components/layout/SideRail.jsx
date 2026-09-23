import { useLocation, useNavigate } from 'react-router-dom'
import {
  Boxes,
  LayoutGrid,
  Landmark,
  ReceiptText,
  Settings,
  Users,
} from 'lucide-react'
import { Spark } from '../../components/ui/icons.jsx'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { useData } from '../../context/DataContext.jsx'

/**
 * The navigation rail: a column of icons, each with its name underneath.
 *
 * Icon-plus-label, not icon-only. A bare icon rail trades a tooltip delay for
 * a few pixels of width and makes people hover to read their own menu; the
 * label costs 11px of type and removes the guessing. The active tile is a
 * filled square rather than a coloured glyph, so which room you are in is
 * legible from the corner of the eye.
 *
 * Counts ride the tile the way the dock's badges did — unpaid invoices and
 * stock below its reorder point, the two things worth interrupting for.
 */
export default function SideRail() {
  const { t } = useLang()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { invoices, products } = useData()

  const unpaid = invoices.filter((i) => i.status !== 'paid').length
  const lowStock = products.filter((p) => (p.stock ?? 0) <= (p.minStock ?? 0)).length

  const destinations = [
    { to: '/app', id: 'dashboard', icon: LayoutGrid, end: true },
    { to: '/app/invoices', id: 'invoices', icon: ReceiptText, badge: unpaid },
    { to: '/app/tax', id: 'tax', icon: Landmark },
    { to: '/app/inventory', id: 'inventory', icon: Boxes, badge: lowStock },
    { to: '/app/payroll', id: 'payroll', icon: Users },
    { to: '/app/assistant', id: 'assistant', icon: Spark },
  ]

  const isLive = (to, end) => (end ? pathname === to : pathname.startsWith(to))

  // A modified click stays with the browser, so any destination can still be
  // opened in a new tab.
  const follow = (to) => (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    navigate(to)
  }

  return (
    <nav className="rail" aria-label={t('nav.primary')}>
      {/* No wordmark and no compose tile up here. The nav pill carries the
          logo, and "Oluştur" only went to /app/invoices — which is the tile
          directly under it, with the page's own upload button on arrival. */}
      <div className="rail__group">
        {destinations.map(({ to, id, icon: Icon, end, badge }) => (
          <a
            key={to}
            href={to}
            onClick={follow(to)}
            className={`rail__item${isLive(to, end) ? ' is-live' : ''}`}
            aria-current={isLive(to, end) ? 'page' : undefined}
          >
            <span className="rail__tile">
              <Icon size={19} strokeWidth={1.5} />
              {badge ? <span className="rail__badge tnum">{badge > 99 ? '99+' : badge}</span> : null}
            </span>
            <span className="rail__label">{t(`dock.${id}`)}</span>
          </a>
        ))}
      </div>

      <span className="rail__rule" aria-hidden="true" />

      <div className="rail__group rail__group--foot">
        <a
          href="/app/settings"
          onClick={follow('/app/settings')}
          className={`rail__item${isLive('/app/settings') ? ' is-live' : ''}`}
        >
          <span className="rail__tile"><Settings size={19} strokeWidth={1.5} /></span>
          <span className="rail__label">{t('dock.settings')}</span>
        </a>
      </div>
    </nav>
  )
}

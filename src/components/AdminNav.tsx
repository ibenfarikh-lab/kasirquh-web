/**
 * KasirQuh React — src/components/AdminNav.tsx
 * Pengganti nav.bottom-nav admin: 5 tombol (Beranda, Kasir, Inbox, Catatan, Menu).
 * Badge Inbox = jumlah notifikasi belum dibaca.
 */
import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from './ui'
import { useInboxUnread } from '../features/admin/localAdmin'

const TABS = [
  { to: '/admin', label: 'Beranda', icon: 'home', end: true },
  { to: '/admin/kasir', label: 'Kasir', icon: 'cash' },
  { to: '/admin/pesanan', label: 'Inbox', icon: 'list', badge: true },
  { to: '/admin/catatan', label: 'Catatan', icon: 'note' },
  { to: '/admin/menu', label: 'Menu', icon: 'grid' },
]

export default function AdminNav() {
  const { pathname } = useLocation()
  const unread = useInboxUnread()
  const MAIN_TABS = ['/admin', '/admin/kasir', '/admin/pesanan', '/admin/catatan', '/admin/menu']
  if (!MAIN_TABS.includes(pathname)) return null
  return (
    <nav className="bottom-nav" aria-label="Navigasi admin">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => 'nav-btn' + (isActive ? ' active' : '')}
        >
          {t.badge ? (
            <span className="nav-icon-wrap">
              <Icon name={t.icon} />
              <b id="inboxBadge" hidden={unread === 0}>
                {unread}
              </b>
            </span>
          ) : (
            <Icon name={t.icon} />
          )}
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * KasirQuh React — src/components/CustomerNav.tsx
 * Nav bawah pelanggan (5 tombol: Beranda, Produk, Keranjang, Chat, Akun).
 *
 * Chat & Akun terkunci untuk tamu: diklik → sheet login langsung
 * (tidak pindah halaman), sesuai perilaku vanilla.
 */
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { useCartStore } from '../stores/cart'
import { GUEST_GATES } from '../lib/guestGate'
import { Icon } from './ui'

const TABS = [
  { to: '/beranda', label: 'Beranda', icon: 'home', end: true },
  { to: '/beranda/produk', label: 'Produk', icon: 'box', end: true },
  { to: '/beranda/keranjang', label: 'Keranjang', icon: 'cart', end: true },
  { to: '/beranda/chat', label: 'Chat', icon: 'chat', end: true, lock: true, gate: GUEST_GATES.chat },
  { to: '/beranda/akun', label: 'Akun', icon: 'user', end: true, lock: true, gate: GUEST_GATES.account },
] as const

export default function CustomerNav() {
  const count = useCartStore((s) => s.customerItemCount())
  const isGuest = useAuthStore((s) => s.session.isGuest)
  const openLoginSheet = useAuthStore((s) => s.openLoginSheet)

  // Badge berdenyut tiap jumlah keranjang BERTAMBAH (pengganti toast
  // tambah-keranjang — Opsi B user, 2026-10-21). popKey naik → badge
  // di-remount → animasi CSS .cart-badge-pop jalan lagi dari awal.
  const prevCount = useRef(count)
  const [popKey, setPopKey] = useState(0)
  useEffect(() => {
    if (count > prevCount.current) setPopKey((k) => k + 1)
    prevCount.current = count
  }, [count])

  /** Tamu menyentuh tab terkunci → modal login + kalimat gerbangnya, bukan halamannya. */
  function guardTab(e: React.MouseEvent, t: (typeof TABS)[number]) {
    if (isGuest && 'lock' in t && t.lock) {
      e.preventDefault()
      openLoginSheet(t.gate.action, t.gate.message)
    }
  }

  return (
    <nav className="customer-nav" aria-label="Navigasi pelanggan">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          onClick={(e) => guardTab(e, t)}
          className={({ isActive }) => `customer-nav-btn${isActive ? ' active' : ''}${t.icon === 'cart' ? ' cart-nav' : ''}`}
        >
          <span className="nav-icon-wrap">
            <Icon name={t.icon} />
            {t.icon === 'cart' ? (
              <b key={popKey} id="cartBadge" className={popKey ? 'cart-badge-pop' : undefined} hidden={count === 0}>
                {count}
              </b>
            ) : null}
            {'lock' in t && t.lock && isGuest ? <Icon name="lock" className="icon nav-private-lock" label="" /> : null}
          </span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

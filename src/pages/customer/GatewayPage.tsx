/**
 * KasirQuh React — src/pages/customer/GatewayPage.tsx
 * Pengganti section #gateway + js/init/gateway.js:
 * carousel promo, tombol Masuk/Lewati, adminHotspot.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { useSessionLocal, useSettingsLocal, type CustomerSettings } from '../../features/customer/local'
import { Icon } from '../../components/ui'
import { AuthSheet } from '../../components/AuthSheet'
import { AdminLoginSheet } from '../../components/AdminLoginSheet'

const SLIDE_COUNT = 3
const ADVANCE_MS = 4000

const TITLE_KEYS = ['gatewayTitle1', 'gatewayTitle2', 'gatewayTitle3'] as const
const COPY_KEYS = ['gatewayCopy1', 'gatewayCopy2', 'gatewayCopy3'] as const

function slideCopy(settings: CustomerSettings, i: 0 | 1 | 2) {
  const kicker = ['PROMO UTAMA', 'SEMBAKO', 'JAJAN & MINUMAN'][i]
  const titleKey = TITLE_KEYS[i]
  const copyKey = COPY_KEYS[i]
  return {
    kicker,
    title: String(settings[titleKey] || ''),
    copy: String(settings[copyKey] || ''),
  }
}

export default function GatewayPage() {
  const navigate = useNavigate()
  const settings = useSettingsLocal((s) => s.settings)
  const enterGuest = useSessionLocal((s) => s.enterGuest)
  const [index, setIndex] = useState(0)
  const [authOpen, setAuthOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchX = useRef(0)
  const justSwiped = useRef(false)
  const indexRef = useRef(0)


  const goGuest = useCallback(() => {
    // Selesai gateway -> dashboard sesi tersimpan jika ada, else mode tamu.
    if (timer.current) clearTimeout(timer.current)
    const s = useAuthStore.getState().session
    if (!s.isGuest) {
      navigate(s.role === 'admin' ? '/admin' : '/beranda', { replace: true })
      return
    }
    enterGuest()
    navigate('/beranda', { replace: true })
  }, [enterGuest, navigate])

  const showSlide = useCallback(
    (i: number, announce: boolean) => {
      const next = ((i % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT
      indexRef.current = next
      setIndex(next)
      if (announce) {
        const item = slideCopy(settings, next as 0 | 1 | 2)
        setAnnouncement(`Slide ${next + 1} dari ${SLIDE_COUNT}: ${item.title}`)
      }
    },
    [settings],
  )

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const cur = indexRef.current
      if (cur < SLIDE_COUNT - 1) {
        showSlide(cur + 1, true)
        schedule()
      } else {
        goGuest()
      }
    }, ADVANCE_MS)
    // deps disengaja minimal [goGuest, showSlide] — selain itu hanya ref & konstanta modul yang tidak wajib masuk deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goGuest, showSlide])

  const advance = useCallback(() => {
    const cur = indexRef.current
    if (cur < SLIDE_COUNT - 1) {
      showSlide(cur + 1, true)
      schedule()
    } else {
      goGuest()
    }
    // deps disengaja minimal — selain callback hanya ref & konstanta modul yang tidak wajib masuk deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goGuest, showSlide, schedule])

  useEffect(() => {
    showSlide(0, true)
    schedule()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // jalan sekali per mount — callback sengaja tidak masuk deps agar timer tidak di-restart saat settings berubah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hentikan timer auto-skip saat modal login/admin terbuka (jangan tendang ke dashboard).
  useEffect(() => {
    if (authOpen || adminOpen) {
      if (timer.current) clearTimeout(timer.current)
    } else {
      schedule()
    }
    // schedule sengaja tidak masuk deps agar buka-tutup modal login tidak me-reset timer slide gateway
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOpen, adminOpen])

  const onGatewayClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (t.closest('#gatewaySkip') || t.closest('#gatewayLogin') || t.closest('#adminHotspot') || t.closest('[data-gateway-slide]')) return
    if (justSwiped.current) {
      justSwiped.current = false
      return
    }
    advance()
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) < 38) return
    justSwiped.current = true
    if (dx < 0) advance()
    else {
      showSlide(index - 1, true)
      schedule()
    }
  }

  const item = slideCopy(settings, index as 0 | 1 | 2)

  return (
    <section
      id="gateway"
      className="screen gateway"
      aria-label="Promo Warunge Mimi"
      aria-roledescription="carousel"
      onClick={onGatewayClick}
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0].clientX
      }}
      onTouchEnd={onTouchEnd}
    >
      <div className="gateway-slides" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`gateway-slide${i === index ? ' active' : ''}`} />
        ))}
      </div>
      <header className="gateway-top">
        <div className="gateway-brand">
          <Icon name="warunge-logo" className="store-mark icon" label="Logo Warunge Mimi" />
          <div className="gateway-brand-copy">
            <small>Belanja dekat, terasa hangat</small>
            <strong id="gatewayStoreName">Warunge Mimi</strong>
          </div>
        </div>
        <div className="gateway-actions">
          <button id="gatewayLogin" className="gateway-skip" type="button" onClick={() => setAuthOpen(true)}>
            Masuk
          </button>
          <button
            id="gatewaySkip"
            className="gateway-skip"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goGuest()
            }}
          >
            Lewati
          </button>
        </div>
      </header>
      <div className="gateway-hero">
        <p id="gatewayKicker" className="gateway-kicker">
          {item.kicker}
        </p>
        <h1 id="gatewayPromoTitle" className="gateway-promo-title">
          {item.title}
        </h1>
        <p id="gatewayPromoCopy" className="gateway-promo-copy">
          {item.copy}
        </p>
        <p className="gateway-hint">
          <Icon name="bag" />
          Ketuk atau geser untuk lanjut
        </p>
      </div>
      <footer className="gateway-bottom">
        <div className="powered">
          <img src="/assets/img/img-005.png" alt="Logo KasirQuh" />
          Powered by KasirQuh
        </div>
        <div id="gatewayProgress" className="gateway-progress" aria-label="Pilih slide promo">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              data-gateway-slide={i}
              aria-label={['Tampilkan slide promo utama', 'Tampilkan slide sembako', 'Tampilkan slide jajan dan minuman'][i]}
              aria-current={i === index ? 'true' : undefined}
              className={i === index ? 'active' : ''}
              onClick={(e) => {
                e.stopPropagation()
                showSlide(i, true)
                schedule()
              }}
            />
          ))}
        </div>
        <span className="gateway-brand-spacer" aria-hidden="true" />
      </footer>
      <p id="gatewayAnnouncement" className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <button
        id="adminHotspot"
        className="admin-hotspot"
        type="button"
        aria-label="Akses admin"
        onClick={(e) => {
          e.stopPropagation()
          setAdminOpen(true)
        }}
      >
        Akses admin
      </button>

      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      <AdminLoginSheet open={adminOpen} onClose={() => setAdminOpen(false)} />
    </section>
  )
}



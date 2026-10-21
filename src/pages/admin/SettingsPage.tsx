/**
 * KasirQuh React — src/pages/admin/SettingsPage.tsx
 * Halaman Pengaturan (dulu SettingsSheet): #adminSettingsModal +
 * #errorLogModal + #adminSessionModal (js/features/admin/settings.js).
 *
 * Tema: localStorage perangkat (seperti kode lama). Sesi: useAuthStore resmi.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Sheet, SheetHeader, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { useAuthStore } from '../../stores/auth'
import { bioIsSupported, bioIsEnrolled, bioRemove } from '../../lib/biometric'
import { clearGatewaySeen } from '../../lib/gateway'
import { getAdminTheme, setAdminTheme, type ThemeChoice } from '../../lib/theme'

type SoundKind = 'order' | 'promo' | 'chat'
type SoundPreset = 'system' | 'mimi' | 'silent'

const SOUND_KEY = 'kasirquh-admin-sounds'
const VIBRATE_KEY = 'kasirquh-vibrate-silent'
const NAV_MOTION_KEY = 'kasirquh-nav-motion'

function loadJSON<T>(key: string, fb: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? ({ ...fb, ...JSON.parse(raw) } as T) : fb
  } catch {
    return fb
  }
}

/* Bunyi lokal sederhana (pengganti ringkas js/shared/audio.js untuk tombol Tes) */
function beep(pattern: number[]) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    pattern.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.18 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.18)
      osc.stop(now + i * 0.18 + 0.18)
    })
    setTimeout(() => void ctx.close(), pattern.length * 200 + 300)
  } catch {
    /* abaikan */
  }
}

function testSound(kind: SoundKind, preset: SoundPreset, vibrate: boolean) {
  if (preset === 'silent') {
    if (vibrate && navigator.vibrate) navigator.vibrate(120)
    return
  }
  const patterns: Record<SoundKind, number[]> =
    preset === 'mimi'
      ? { order: [660, 880, 990], promo: [520, 660], chat: [880] }
      : { order: [440], promo: [440], chat: [440] }
  beep(patterns[kind])
  if (vibrate && navigator.vibrate) navigator.vibrate(60)
}

const SOUND_LABEL: Record<SoundKind, { title: string; desc: string }> = {
  order: { title: 'Pesanan baru', desc: 'Pesanan pelanggan' },
  promo: { title: 'Promo aktif', desc: 'Kampanye warung' },
  chat: { title: 'Chat masuk', desc: 'Pertanyaan pelanggan' },
}

export default function SettingsPage() {
  useAdminBoot()
  const navigate = useNavigate()
  const saveStoreSettings = useLocalAdminStore((s) => s.saveStoreSettings)
  const errorLog = useLocalAdminStore((s) => s.errorLog)
  const clearErrorLog = useLocalAdminStore((s) => s.clearErrorLog)

  const [theme, setTheme] = useState<ThemeChoice>(() => getAdminTheme())
  const [sounds, setSounds] = useState<Record<SoundKind, SoundPreset>>({
    order: 'system',
    promo: 'system',
    chat: 'system',
  })
  const [vibrate, setVibrate] = useState(true)
  const [navMotion, setNavMotion] = useState(true)
  const [errorOpen, setErrorOpen] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    {
      try {
        const nm = localStorage.getItem(NAV_MOTION_KEY)
        if (nm !== null) setNavMotion(nm !== '0')
      } catch {
        /* abaikan */
      }
      setSounds(loadJSON<Record<SoundKind, SoundPreset>>(SOUND_KEY, { order: 'system', promo: 'system', chat: 'system' }))
      try {
        setVibrate(localStorage.getItem(VIBRATE_KEY) !== '0')
      } catch {
        /* abaikan */
      }
      setSaving(false)
    }
    // baca preferensi dari localStorage sekali per mount — tidak perlu jalan ulang karena perubahan disimpan langsung ke state+localStorage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickTheme = (t: string) => {
    const choice: ThemeChoice = (['light', 'dark', 'oled', 'system'] as const).includes(t as ThemeChoice)
      ? (t as ThemeChoice)
      : 'dark'
    setTheme(choice)
    setAdminTheme(choice)
  }

  const applyPreset = (preset: SoundPreset) => {
    setSounds(() => {
      const next = { order: preset, promo: preset, chat: preset }
      try {
        localStorage.setItem(SOUND_KEY, JSON.stringify(next))
      } catch {
        /* abaikan */
      }
      return next
    })
  }

  const changeSound = (kind: SoundKind, preset: SoundPreset) => {
    setSounds((s) => {
      const next = { ...s, [kind]: preset }
      try {
        localStorage.setItem(SOUND_KEY, JSON.stringify(next))
      } catch {
        /* abaikan */
      }
      return next
    })
  }

  const toggleVibrate = () => {
    setVibrate((v) => {
      try {
        localStorage.setItem(VIBRATE_KEY, v ? '1' : '0')
      } catch {
        /* abaikan */
      }
      return !v
    })
  }

  const toggleNavMotion = () => {
    const next = !navMotion
    setNavMotion(next)
    try {
      localStorage.setItem(NAV_MOTION_KEY, next ? '1' : '0')
    } catch {
      /* abaikan */
    }
    document.documentElement.dataset.navMotion = next ? 'on' : 'off'
    saveStoreSettings({ adminNavMotion: next })
      .then(() => {})
      .catch(() => toast('Gagal menyimpan'))
  }

  const applyAll = () => {
    setSaving(true)
    saveStoreSettings({
      adminTheme: theme,
      adminNavMotion: navMotion,
      adminSoundSettings: { order: sounds.order, promo: sounds.promo, chat: sounds.chat, vibrate },
    })
      .then(() => {
        navigate(-1)
        toast('Pengaturan global tersimpan')
      })
      .catch((error: unknown) => {
        navigate(-1)
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal menyimpan pengaturan')
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="admin-screen">
      <div id="settingsView" className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Mode Admin</small>
            <h2>Pengaturan</h2>
          </span>
        </div>
      <p className="tool-intro">Pengaturan global aplikasi, ringkas dalam lima kelompok.</p>
      <div className="settings-sections">
        <details className="settings-section" open>
          <summary>
            <Icon name="spark" />
            <span>
              <b>Tampilan</b>
              <small>Tema dan bahasa aplikasi</small>
            </span>
          </summary>
          <div className="settings-section-body">
            <div className="settings-group">
              <label>Tema</label>
              <div className="theme-picks theme-mode-picks">
                {[
                  { id: 'light', label: 'Terang', desc: 'Kontras siang' },
                  { id: 'dark', label: 'Gelap', desc: 'Bawaan admin' },
                  { id: 'system', label: 'Ikuti HP', desc: 'Otomatis' },
                ].map((t) => (
                  <button
                    key={t.id}
                    className={theme === t.id ? 'active' : ''}
                    onClick={() => pickTheme(t.id)}
                  >
                    {t.label}
                    <small>{t.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>

        <details className="settings-section">
          <summary>
            <Icon name="bell" />
            <span>
              <b>Notifikasi</b>
              <small>Nada per jenis, tes bunyi, hening, dan getar</small>
            </span>
          </summary>
          <div className="settings-section-body">
            <div className="sound-presets">
              {[
                { id: 'system', label: 'Bawaan HP', desc: 'Nada umum perangkat' },
                { id: 'mimi', label: 'Khas Mimi', desc: 'Beda tiap kejadian' },
                { id: 'silent', label: 'Hening', desc: 'Getar tanpa suara' },
              ].map((p) => (
                <button
                  key={p.id}
                  className={sounds.order === p.id && sounds.promo === p.id && sounds.chat === p.id ? 'active' : ''}
                  onClick={() => applyPreset(p.id as SoundPreset)}
                >
                  {p.label}
                  <small>{p.desc}</small>
                </button>
              ))}
            </div>
            <div className="sound-list">
              {(Object.keys(SOUND_LABEL) as SoundKind[]).map((kind) => (
                <div className="sound-row" key={kind}>
                  <span>
                    <b>{SOUND_LABEL[kind].title}</b>
                    <small>{SOUND_LABEL[kind].desc}</small>
                  </span>
                  <select
                    aria-label={'Dering ' + SOUND_LABEL[kind].title.toLowerCase()}
                    value={sounds[kind]}
                    onChange={(e) => changeSound(kind, e.target.value as SoundPreset)}
                  >
                    <option value="system">Bawaan HP</option>
                    <option value="mimi">Khas Mimi</option>
                    <option value="silent">Hening</option>
                  </select>
                  <button
                    className="sound-test"
                    aria-label={'Tes bunyi ' + SOUND_LABEL[kind].title.toLowerCase()}
                    onClick={() => testSound(kind, sounds[kind], vibrate)}
                  >
                    <Icon name="speaker" />
                  </button>
                </div>
              ))}
            </div>
            <button className="quiet-vibrate" aria-pressed={vibrate} onClick={toggleVibrate}>
              Getar saat mode hening · {vibrate ? 'Aktif' : 'Nonaktif'}
            </button>
            <button
              className="settings-link test-all"
              onClick={() => {
                testSound('order', sounds.order, vibrate)
                setTimeout(() => testSound('promo', sounds.promo, vibrate), 520)
                setTimeout(() => testSound('chat', sounds.chat, vibrate), 940)
                toast('Tes pesanan, promo, lalu chat')
              }}
            >
              <span className="settings-link-row">
                <Icon name="speaker" />
                Tes semua bunyi
              </span>
              <b>▶</b>
            </button>
          </div>
        </details>

        <details className="settings-section">
          <summary>
            <Icon name="gear" />
            <span>
              <b>Developer</b>
              <small>Opsi developer dan pembaruan aplikasi</small>
            </span>
          </summary>
          <div className="settings-section-body">
            <div className="toggle-setting-row">
              <span>
                <b>Animasi navigasi</b>
                <small>Transisi halus saat pindah menu</small>
              </span>
              <button className="toggle-btn" aria-pressed={navMotion} onClick={toggleNavMotion}>
                {navMotion ? 'NYALA' : 'MATI'}
              </button>
            </div>
            <button className="settings-link" onClick={() => setErrorOpen(true)}>
              <span className="settings-link-row">
                <Icon name="alert" />
                Log Error
              </span>
              <b>›</b>
            </button>
          </div>
        </details>

        <details className="settings-section">
          <summary>
            <Icon name="note" />
            <span>
              <b>Tentang</b>
              <small>Versi aplikasi dan pengembang</small>
            </span>
          </summary>
          <div className="settings-section-body">
            <div className="about-kasirquh">
              <img src="assets/img/img-005.png" alt="Logo KasirQuh" />
              <span>
                <b>KasirQuh V3</b>
                <small>Versi 3.1 (20261020s)</small>
              </span>
            </div>
            <p className="settings-note">Powered by KasirQuh</p>
          </div>
        </details>

        <details className="settings-section">
          <summary>
            <Icon name="users" />
            <span>
              <b>Akun</b>
              <small>Info sesi dan ganti akun</small>
            </span>
          </summary>
          <div className="settings-section-body">
            <button className="settings-link" onClick={() => setSessionOpen(true)}>
              <span className="settings-link-row">
                <Icon name="lock" />
                Info Sesi
              </span>
              <b>›</b>
            </button>
            <BioButton />
            <button
              className="settings-link danger"
              onClick={async () => {
                await useAuthStore.getState().logout()
                clearGatewaySeen()
                navigate('/', { replace: true })
                toast('Sesi admin ditutup')
              }}
            >
              <span className="settings-link-row">
                <Icon name="logout" />
                Keluar / Ganti Akun
              </span>
              <b>›</b>
            </button>
          </div>
        </details>
      </div>
      <button className="download-card" disabled={saving} onClick={applyAll}>
        {saving ? 'Menyimpan…' : 'Terapkan Pengaturan'}
      </button>

      <ErrorLogSheet
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        entries={errorLog}
        onClear={clearErrorLog}
      />
      <SessionInfoSheet open={sessionOpen} onClose={() => setSessionOpen(false)} />
        <AdminNav />
      </div>
    </div>
  )
}

/* ---------- Log Error (pengganti #errorLogModal) ---------- */

function ErrorLogSheet({
  open,
  onClose,
  entries,
  onClear,
}: {
  open: boolean
  onClose: () => void
  entries: { at: string; source: string; message: string }[]
  onClear: () => void
}) {
  const logs = [...entries].reverse()
  return (
    <Sheet open={open} onClose={onClose} sheetClassName="sheet feature-sheet">
      <SheetHeader kicker="Developer" title="Log Error" onClose={onClose} />
      <div className="sheet-body">
        <p className="admin-menu-note">
          50 galat terakhir yang tercatat di perangkat ini. Untuk pantau menyeluruh, periksa
          koleksi <code>client_errors</code> di Firestore.
        </p>
        <div>
          {logs.length ? (
            logs.map((e, i) => {
              let t = e.at || ''
              try {
                t = new Date(e.at).toLocaleString('id-ID')
              } catch {
                /* abaikan */
              }
              return (
                <article className="note-card" style={{ marginBottom: 8 }} key={i}>
                  <header>
                    <h3>{e.source}</h3>
                    <small>{t}</small>
                  </header>
                  <p>{e.message}</p>
                </article>
              )
            })
          ) : (
            <p className="admin-menu-note">Belum ada galat tercatat. Bagus!</p>
          )}
        </div>
        <button
          className="btn-secondary"
          style={{ marginTop: 12 }}
          onClick={() => {
            onClear()
            toast('Log error dihapus')
          }}
        >
          Hapus Log
        </button>
      </div>
    </Sheet>
  )
}

/* ---------- Tombol sidik jari (hanya bila didukung & terdaftar) ---------- */

function BioButton() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const ok = (await bioIsSupported()) && (await bioIsEnrolled('admin'))
        if (alive) setVisible(ok)
      } catch {
        /* abaikan */
      }
    })()
    return () => {
      alive = false
    }
  }, [])
  if (!visible) return null
  return (
    <button
      className="settings-link"
      onClick={async () => {
        if (!confirm('Hapus sidik jari di perangkat ini?')) return
        try {
          await bioRemove()
          toast('Sidik jari dihapus')
          setVisible(false)
        } catch {
          toast('Gagal menghapus sidik jari')
        }
      }}
    >
      <span className="settings-link-row">
        <Icon name="lock" />
        Hapus Sidik Jari
      </span>
      <b>›</b>
    </button>
  )
}

/* ---------- Info Sesi (pengganti #adminSessionModal) ---------- */

function SessionInfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const session = useAuthStore((s) => s.session)
  const sessionStartedAt = useAuthStore((s) => s.sessionStartedAt)
  const email = session.email || ''
  const waktuMasuk = sessionStartedAt
    ? new Date(sessionStartedAt).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Belum tersedia'
  return (
    <Sheet open={open} onClose={onClose} sheetClassName="sheet feature-sheet">
      <SheetHeader kicker="Keamanan akun" title="Info Sesi" onClose={onClose} />
      <article className="note-card">
        <header>
          <h3>Perangkat ini</h3>
          <span className="stock-pill">AKTIF</span>
        </header>
        <div className="session-facts">
          <span>
            <small>Peran</small>
            <b>Admin</b>
          </span>
          <span>
            <small>Nama</small>
            <b>{email || 'Admin Warunge Mimi'}</b>
          </span>
          <span>
            <small>Waktu masuk</small>
            <b>{waktuMasuk}</b>
          </span>
        </div>
      </article>
    </Sheet>
  )
}

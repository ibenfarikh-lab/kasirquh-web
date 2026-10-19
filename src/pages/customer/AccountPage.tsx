/**
 * KasirQuh React — src/pages/customer/AccountPage.tsx
 * Pengganti #akunCustomerView + js/features/customer/account.js:
 * profil, kartu member (barcode Code39), bonus harian, tile akun, pengaturan.
 */
import { useRef, useState } from 'react'
import { playNotification, type SoundKind, type SoundMode } from '../../lib/audio'
import { useNavigate } from 'react-router-dom'
import { Icon, Sheet, SheetHeader, toast } from '../../components/ui'
import {
  useSessionLocal,
  useCoinLocal,
  useOrdersLocal,
  useNotesLocal,
  compressPhoto,
} from '../../features/customer/local'
import { usePromoStore } from '../../stores/promo'
import { useAuthStore } from '../../stores/auth'
import { todayKeyJakarta } from '../../lib/firestore'
import { clearGatewaySeen } from '../../lib/gateway'
import { getCustomerTheme, setCustomerTheme, type ThemeChoice } from '../../lib/theme'

/* ============ Barcode Code39 (port S.code39 dari js/store/core.js) ============
 * Render sebagai SVG murni — tanpa library baru. */
const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '*': 'nwnnwnwnn', ' ': 'nwwnnwnnn',
}

interface BarRect {
  x: number
  y: number
  width: number
  height: number
}

/** Port barcodeRects() (js/features/customer/account.js). */
function barcodeRects(value: string, y: number, height: number): { rects: BarRect[]; width: number } {
  let x = 18
  const rects: BarRect[] = []
  ;('*' + value + '*').split('').forEach((ch) => {
    const pattern = CODE39[ch]
    if (!pattern) return
    pattern.split('').forEach((kind, i) => {
      const w = kind === 'w' ? 5 : 2
      if (i % 2 === 0) rects.push({ x, y, width: w, height })
      x += w
    })
    x += 2
  })
  return { rects, width: x + 18 }
}

/** Kartu member: render barcode + kode (port renderMemberCardBarcode). */
function MemberBarcode({ code }: { code: string | null }) {
  if (!code) {
    return (
      <svg className="member-barcode" viewBox="0 0 320 104" role="img" aria-label="Barcode kartu member">
        <text x="160" y="52" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fill="#777">
          Login untuk kartu member
        </text>
      </svg>
    )
  }
  const made = barcodeRects(code, 8, 78)
  return (
    <svg className="member-barcode" viewBox={`0 0 ${made.width} 104`} role="img" aria-label="Barcode kartu member">
      <rect width="100%" height="104" fill="#fff" />
      {made.rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} fill="#171313" />
      ))}
      <text x={made.width / 2} y={99} textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#171313">
        *{code}*
      </text>
    </svg>
  )
}

/** Kode member unik: KQ-XXXXXXXX dari 8 karakter awal UID Auth (port memberBarcodeCode). */
function useMemberCode(): string | null {
  const customerId = useSessionLocal((s) => s.customerId)
  if (!customerId) return null
  return 'KQ-' + String(customerId).slice(0, 8).toUpperCase()
}

type SheetKey = 'settings' | null

export default function AccountPage() {
  const navigate = useNavigate()
  const session = useSessionLocal()
  const balance = useCoinLocal((s) => s.balance)
  const activeOrder = useOrdersLocal((s) => s.activeOrder)
  const history = useOrdersLocal((s) => s.history)
  const notes = useNotesLocal((s) => s.notes)
  const memberCode = useMemberCode()
  const checkinDone = usePromoStore((s) => s.dailyCheckedIn)
  const lastCheckinDoc = useAuthStore((s) => s.myCustomerDoc?.lastCheckin)

  const [sheet, setSheet] = useState<SheetKey>(null)
  const [checkinBusy, setCheckinBusy] = useState(false)

  const name = session.name || 'Pelanggan'
  const initial = (name.trim().charAt(0) || 'M').toUpperCase()
  const coinText = balance > 0 ? balance.toLocaleString('id-ID') + ' koin' : 'Belum ada koin'

  function runDailyCheckin() {
    if (session.isGuest || !session.customerId) {
      toast('Bonus masuk setelah pelanggan login.')
      return
    }
    setCheckinBusy(true)
    void usePromoStore
      .getState()
      .checkin()
      .finally(() => setCheckinBusy(false))
  }

  const checkinTaken = checkinDone || lastCheckinDoc === todayKeyJakarta()

  function logout() {
    session.clearSession()
    clearGatewaySeen()
    navigate('/', { replace: true })
    toast('Keluar dari akun')
  }

  return (
    <div id="akunCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <p className="page-kicker">Milikmu</p>
        <h1>Akun</h1>
      </header>
      <main className="content">
        <section className="profile-card">
          <div className={`avatar customer-avatar${session.photoURL ? ' has-photo' : ''}`} id="profileInitial">
            {session.photoURL ? <img src={session.photoURL} alt="Foto profil" /> : initial}
          </div>
          <div>
            <h3 id="profileName">{name}</h3>
            <p>Pelanggan Warunge Mimi</p>
            <button className="coin-chip" onClick={() => navigate('/beranda/koin')}>
              <Icon name="coin" />
              <span>{coinText}</span>
            </button>
          </div>
        </section>

        <section id="memberCardSection" className="member-card-section">
          <div className="member-card-head">
            <Icon name="user" />
            <span>
              <b>Kartu Member</b>
              <small>Tunjukkan di kasir</small>
            </span>
          </div>
          <div className="member-card-body">
            <MemberBarcode code={memberCode} />
            <strong id="memberCardCode">{memberCode || '-'}</strong>
          </div>
        </section>

        <section id="dailyCheckinCard" className="checkin-card">
          <Icon name="calendar" />
          <span>
            <b>Bonus harian</b>
            <small>Bonus masuk setelah pelanggan login.</small>
          </span>
          <button
            id="checkinStatus"
            className="secondary"
            disabled={checkinBusy || checkinTaken}
            onClick={runDailyCheckin}
          >
            {checkinTaken ? 'Sudah diambil' : checkinBusy ? 'Memproses…' : 'Ambil bonus'}
          </button>
        </section>

        <section className="account-grid">
          <button
            className="account-tile"
            onClick={() => {
              if (activeOrder) navigate('/beranda/pesanan/' + activeOrder.id)
              else navigate('/beranda/riwayat')
            }}
          >
            <Icon name="truck" />
            <span>
              <b>Pesanan aktif</b>
              <small id="accountOrderMeta">
                {activeOrder ? 'Aktif: ' + activeOrder.id + ' · ' + activeOrder.status : 'Belum ada pesanan aktif'}
              </small>
            </span>
          </button>
          <button className="account-tile" onClick={() => navigate('/beranda/riwayat')}>
            <Icon name="list" />
            <span>
              <b>Riwayat</b>
              <small id="accountHistoryMeta">{history.length ? history.length + ' pesanan' : 'Belum ada riwayat'}</small>
            </span>
          </button>
          <button className="account-tile" onClick={() => navigate('/beranda/catatan')}>
            <Icon name="note" />
            <span id="accountNoteBadge" className="notice-count" hidden={!notes.length}>
              {notes.length || ''}
            </span>
            <span>
              <b>Catatan toko</b>
              <small id="accountNoteMeta">{notes.length ? notes.length + ' catatan' : 'Belum ada catatan'}</small>
            </span>
          </button>
          <button className="account-tile" onClick={() => navigate('/beranda/misi')}>
            <Icon name="spark" />
            <span>
              <b>Misi koin</b>
              <small>Selesaikan tantangan dan ambil bonus</small>
            </span>
          </button>
        </section>

        <section className="settings-list">
          <button onClick={() => setSheet('settings')}>
            <span>
              <Icon name="gear" />
              Identitas &amp; tampilan
            </span>
            <b>›</b>
          </button>
          <button className="account-danger" id="logoutCustomerBtn" type="button" onClick={logout}>
            <span>
              <Icon name="logout" />
              Keluar dari akun
            </span>
            <b>›</b>
          </button>
        </section>
      </main>

      <SettingsSheet open={sheet === 'settings'} onClose={() => setSheet(null)} />
    </div>
  )
}

/* ---------- Pengaturan pelanggan (port #settingsModal, ringkas) ---------- */
function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const session = useSessionLocal()
  const [name, setName] = useState(session.name || '')
  const [wa, setWa] = useState(session.wa)
  const [address, setAddress] = useState(session.address)
  const [photo, setPhoto] = useState(session.photoURL)
  const [theme, setTheme] = useState<ThemeChoice>(() => getCustomerTheme())
  const [sounds, setSounds] = useState<Record<SoundKind, SoundMode>>(() => {
    try {
      const raw = localStorage.getItem('kasirquh-admin-sounds')
      if (raw) return { order: 'system', promo: 'system', chat: 'system', ...JSON.parse(raw) }
    } catch { /* abaikan */ }
    return { order: 'system', promo: 'system', chat: 'system' }
  })
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      // Port compressPhotoFile: max 200x200 JPEG 0.7
      const dataUrl = await compressPhoto(file, 200, 'image/jpeg', 0.7)
      if (dataUrl.length > 900000) throw new Error('Foto masih terlalu besar, pilih yang lebih kecil')
      setPhoto(dataUrl)
      session.setSession({ photoURL: dataUrl })
      toast('Foto profil disimpan')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal simpan foto')
    } finally {
      setBusy(false)
    }
  }

  function apply() {
    const safe = name.trim() || 'Pelanggan'
    session.setSession({ name: safe, wa: wa.trim(), address: address.trim() })
    setCustomerTheme(theme)
    try { localStorage.setItem('kasirquh-admin-sounds', JSON.stringify(sounds)) } catch { /* abaikan */ }
    toast('Pengaturan diterapkan')
    onClose()
  }

  const initial = ((name || session.name || 'P').trim().charAt(0) || 'P').toUpperCase()

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader kicker="Sesuai caramu" title="Pengaturan Pelanggan" onClose={onClose} />
      <div className="settings-group">
        <label>Foto profil</label>
        <div className="photo-edit-row">
          <span id="photoPreview" className={`avatar photo-preview${photo ? ' has-photo' : ''}`}>
            {photo ? <img src={photo} alt="Foto profil" /> : initial}
          </span>
          <span>
            <button id="changePhotoBtn" className="secondary" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Mengompres…' : 'Ganti foto'}
            </button>
            <input ref={fileRef} id="photoFileInput" type="file" accept="image/*" hidden onChange={onPhoto} />
            <small className="setting-help">Foto dikompres otomatis, tersimpan aman.</small>
          </span>
        </div>
      </div>
      <div className="settings-group">
        <label htmlFor="customerNameInput">Nama panggilan</label>
        <input id="customerNameInput" className="setting-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="settings-group">
        <label htmlFor="customerWaInput">Nomor WhatsApp</label>
        <input id="customerWaInput" className="setting-input" type="tel" placeholder="08xxxxxxxxxx" maxLength={20} value={wa} onChange={(e) => setWa(e.target.value)} />
      </div>
      <div className="settings-group">
        <label htmlFor="customerAddressInput">Alamat</label>
        <input id="customerAddressInput" className="setting-input" placeholder="Alamat lengkap" maxLength={120} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="settings-group">
        <label>Tema tampilan</label>
        <div className="theme-picks theme-mode-picks">
          {(
            [
              ['light', 'Terang', 'Bawaan pelanggan'],
              ['dark', 'Gelap', 'Nyaman malam'],
              ['system', 'Ikuti HP', 'Otomatis'],
            ] as const
          ).map(([v, b, s]) => (
            <button key={v} className={theme === v ? 'active' : ''} onClick={() => setTheme(v)}>
              {b}
              <small>{s}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="settings-group">
        <label>Dering notifikasi</label>
        <div className="sound-list">
          {(
            [
              ['order', 'Pesanan siap', 'Kabar belanja'],
              ['promo', 'Promo warung', 'Penawaran baru'],
              ['chat', 'Chat masuk', 'Rumpi & toko'],
            ] as const
          ).map(([kind, title, desc]) => (
            <div key={kind} className="sound-row">
              <span>
                <b>{title}</b>
                <small>{desc}</small>
              </span>
              <select
                value={sounds[kind]}
                onChange={(e) => setSounds({ ...sounds, [kind]: e.target.value as SoundMode })}
                aria-label={`Dering ${title}`}
              >
                <option value="system">Bawaan HP</option>
                <option value="mimi">Khas Mimi</option>
                <option value="silent">Hening</option>
              </select>
              <button
                className="sound-test"
                onClick={() => { try { playNotification(kind, sounds[kind]) } catch { /* abaikan */ } }}
                aria-label={`Tes bunyi ${title}`}
              >
                <Icon name="speaker" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="settings-group">
        <label>Tentang</label>
        <div className="about-kasirquh">
          <img src="/assets/img/img-005.png" alt="Logo KasirQuh" />
          <span>
            <b>KasirQuh V3</b>
            <small>Versi 3.1 (20261020s)</small>
          </span>
        </div>
        <p className="settings-note">Powered by KasirQuh</p>
      </div>
      <div className="settings-actions">
        <button id="applySettings" className="primary" onClick={apply}>
          Terapkan pengaturan
        </button>
      </div>
    </Sheet>
  )
}

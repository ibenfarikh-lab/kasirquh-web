/**
 * KasirQuh React — src/components/AuthSheet.tsx
 * Sheet Masuk/Daftar pelanggan — dipakai di GatewayPage dan global
 * (CustomerLayout) agar tamu yang menyentuh fitur terkunci langsung
 * mendapat modal login tanpa pindah halaman.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { bioAuthenticate, bioIsEnrolled, bioIsSupported, bioRegister } from '../lib/biometric'
import { Icon, Sheet, toast } from './ui'

export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [wa, setWa] = useState('')
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [bioReady, setBioReady] = useState(false)

  useEffect(() => {
    let live = true
    bioIsSupported()
      .then((s) => (live && s ? bioIsEnrolled('customer') : false))
      .then((enrolled) => {
        if (live) setBioReady(enrolled)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [open])

  /** Tawarkan pendaftaran sidik jari setelah login manual berhasil. */
  function bioOfferEnroll(loginEmail: string, loginPassword: string) {
    bioIsSupported()
      .then((supported) => {
        if (!supported) return false
        return bioIsEnrolled('customer')
      })
      .then((enrolled) => {
        if (enrolled) return
        if (window.confirm('Aktifkan masuk dengan sidik jari untuk ' + loginEmail + '?')) {
          bioRegister(loginEmail, loginPassword, 'customer')
            .then(() => {
              toast('Sidik jari diaktifkan')
              setBioReady(true)
            })
            .catch((err: unknown) => {
              toast(err instanceof Error ? err.message : 'Gagal mengaktifkan sidik jari')
            })
        }
      })
      .catch(() => {})
  }

  async function bioLogin() {
    setBusy(true)
    setStatus('Menunggu sidik jari…')
    try {
      const cred = await bioAuthenticate('customer')
      setStatus('Sidik jari cocok, menghubungkan…')
      await useAuthStore.getState().loginCustomer(cred.email, cred.password)
      onClose()
      navigate('/beranda', { replace: true })
      toast('Selamat datang kembali')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Gagal masuk dengan sidik jari')
    } finally {
      setBusy(false)
    }
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setStatus('Lengkapi email dan kata sandi')
      return
    }
    setBusy(true)
    setStatus('Menghubungkan…')
    try {
      await useAuthStore.getState().loginCustomer(email.trim().toLowerCase(), password)
      onClose()
      // Lanjutkan aksi tamu yang tertunda (mis. checkout) — port finishCustomerLogin.
      const pending = useAuthStore.getState().pendingGuestAction
      useAuthStore.getState().setPendingGuestAction(null)
      if (pending === 'checkout') {
        navigate('/beranda/keranjang?delivery=1', { replace: true })
      } else if (pending === 'chat') {
        navigate('/beranda/chat', { replace: true })
      } else if (pending === 'account') {
        navigate('/beranda/akun', { replace: true })
      } else {
        navigate('/beranda', { replace: true })
      }
      toast('Selamat datang kembali')
      bioOfferEnroll(email.trim().toLowerCase(), password)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Masuk gagal')
    } finally {
      setBusy(false)
    }
  }

  async function doRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || password.length < 6) {
      setStatus('Isi nama, email, dan kata sandi (minimal 6 karakter)')
      return
    }
    setBusy(true)
    setStatus('Mengirim pendaftaran…')
    try {
      await useAuthStore.getState().registerCustomer({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        wa: wa.trim(),
        address: address.trim(),
      })
      onClose()
      navigate('/beranda', { replace: true })
      toast('Pendaftaran terkirim · menunggu persetujuan warung')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Pendaftaran gagal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} sheetClassName="sheet guest-lock-sheet auth-sheet">
      <div className="sheet-top">
        <div>
          <small id="guestLockKicker" className="page-kicker">
            Fitur khusus pelanggan
          </small>
          <h2 id="guestLockTitle">Masuk / Daftar</h2>
        </div>
        <button className="sheet-close" onClick={onClose} aria-label="Tutup">
          ×
        </button>
      </div>
      <p id="guestLockCopy">Mau lanjut? Login atau daftar dulu ya...</p>
      <div className="auth-note">
        <Icon name="alert" />
        <span>Masuk dengan email yang sudah disetujui warung. Pendaftar baru menunggu persetujuan admin.</span>
      </div>
      <div className="auth-tabs" role="tablist" aria-label="Pilih masuk atau daftar">
        {(['login', 'register'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`auth-tab${tab === t ? ' active' : ''}`}
            onClick={() => {
              setTab(t)
              setStatus('')
            }}
          >
            {t === 'login' ? 'Masuk' : 'Daftar'}
          </button>
        ))}
      </div>
      {tab === 'login' ? (
        <form className="auth-form" onSubmit={doLogin} noValidate>
          <label className="auth-field">
            Email
            <input type="email" autoComplete="email" placeholder="nama@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="auth-field">
            Kata sandi
            <input type="password" autoComplete="current-password" placeholder="Masukkan kata sandi" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <p className="auth-status" role="status" aria-live="polite">
            {status}
          </p>
          <button className="auth-submit" type="submit" disabled={busy}>
            Masuk
          </button>
          {bioReady ? (
            <button type="button" className="auth-submit secondary" disabled={busy} onClick={bioLogin}>
              Masuk dengan sidik jari
            </button>
          ) : null}
        </form>
      ) : (
        <form className="auth-form" onSubmit={doRegister} noValidate>
          <label className="auth-field">
            Nama
            <input type="text" autoComplete="name" placeholder="Nama pelanggan" maxLength={50} required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="auth-field">
            Email
            <input type="email" autoComplete="email" placeholder="nama@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="auth-field">
            Kata sandi
            <input type="password" autoComplete="new-password" placeholder="Minimal 6 karakter" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="auth-field">
            Nomor WhatsApp <small>(opsional)</small>
            <input type="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" maxLength={20} value={wa} onChange={(e) => setWa(e.target.value)} />
          </label>
          <label className="auth-field">
            Alamat <small>(opsional)</small>
            <input type="text" autoComplete="street-address" placeholder="Alamat lengkap" maxLength={120} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <p className="auth-status" role="status" aria-live="polite">
            {status}
          </p>
          <button className="auth-submit" type="submit" disabled={busy}>
            Kirim pendaftaran
          </button>
        </form>
      )}
    </Sheet>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { bioAuthenticate, bioIsEnrolled, bioIsSupported, bioRegister } from '../lib/biometric'
import { markGatewaySeen } from '../lib/gateway'
import { Sheet, toast } from './ui'

export function AdminLoginSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [bioReady, setBioReady] = useState(false)

  useEffect(() => {
    let live = true
    bioIsSupported()
      .then((s) => (live && s ? bioIsEnrolled('admin') : false))
      .then((enrolled) => {
        if (live) setBioReady(enrolled)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [open ])

  function bioOfferEnrollAdmin(loginEmail: string, loginPassword: string) {
    bioIsSupported()
      .then((supported) => (supported ? bioIsEnrolled('admin') : false))
      .then((enrolled) => {
        if (enrolled) return
        if (window.confirm('Aktifkan masuk dengan sidik jari untuk ' + loginEmail + '?')) {
          bioRegister(loginEmail, loginPassword, 'admin')
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

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setStatus('Lengkapi email dan kata sandi')
      return
    }
    setBusy(true)
    setStatus('Menghubungkan…')
    try {
      await useAuthStore.getState().loginAdmin(email.trim().toLowerCase(), password)
      markGatewaySeen()
      onClose()
      navigate('/admin', { replace: true })
      bioOfferEnrollAdmin(email.trim().toLowerCase(), password)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Masuk gagal')
    } finally {
      setBusy(false)
    }
  }

  async function bioLogin() {
    setBusy(true)
    setStatus('Menunggu sidik jari…')
    try {
      const cred = await bioAuthenticate('admin')
      setStatus('Sidik jari cocok, menghubungkan…')
      await useAuthStore.getState().loginAdmin(cred.email, cred.password)
      markGatewaySeen()
      onClose()
      navigate('/admin', { replace: true })
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Gagal masuk dengan sidik jari')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} sheetClassName="sheet pin-sheet">
      <div className="sheet-top">
        <div>
          <small className="page-kicker">Akses khusus</small>
          <h2>Masuk Admin</h2>
        </div>
        <button className="sheet-close" onClick={onClose} aria-label="Tutup">
          ×
        </button>
      </div>
      <p>Masuk dengan akun admin yang didaftarkan pemilik warung.</p>
      <form className="auth-form" onSubmit={doLogin} noValidate>
        <label className="auth-field">
          Email admin
          <input type="email" autoComplete="username" placeholder="admin@warung.id" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="auth-field">
          Kata sandi
          <input type="password" autoComplete="current-password" placeholder="Masukkan kata sandi" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <p className="auth-status" role="status" aria-live="polite">
          {status}
        </p>
        <button className="auth-submit" type="submit" disabled={busy}>
          Masuk sebagai Admin
        </button>
        {bioReady ? (
          <button type="button" className="auth-submit secondary" disabled={busy} onClick={bioLogin}>
            Masuk dengan sidik jari
          </button>
        ) : null}
      </form>
    </Sheet>
  )
}

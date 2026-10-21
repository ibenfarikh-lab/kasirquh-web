/**
 * KasirQuh React — src/pages/customer/PatunganPage.tsx
 * Pengganti PatunganSheet (#patunganModal + #patunganJoinModal) — halaman penuh, bukan modal.
 *
 * TODO(koordinator): daftar & gabung patungan masih lokal — gantikan dengan
 * store patungan resmi (Firestore) saat worker admin selesai.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { money } from '../../lib/format'
import { toast } from '../../components/ui'
import { usePatunganLocal, useSessionLocal } from '../../features/customer/local'
import { useAuthStore } from '../../stores/auth'
import type { Patungan } from '../../types'

export default function PatunganPage() {
  const items = usePatunganLocal((s) => s.items)
  const [joinId, setJoinId] = useState<string | null>(null)

  if (joinId !== null) {
    return <JoinPatunganView patunganId={joinId} onBack={() => setJoinId(null)} onDone={() => setJoinId(null)} />
  }

  return (
    <div id="patunganCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Belanja bareng tetangga</p>
          <h1>Patungan Warga</h1>
        </div>
      </header>
      <main className="content">
        <div id="patunganList">
          {items.map((p) => (
            <PatunganCard key={p.id} patungan={p} onJoin={() => setJoinId(p.id)} />
          ))}
        </div>
        <div id="patunganEmpty" className="empty-note" hidden={items.length > 0}>
          Belum ada patungan aktif. Cek lagi nanti ya.
        </div>
      </main>
    </div>
  )
}

function PatunganCard({ patungan, onJoin }: { patungan: Patungan; onJoin: () => void }) {
  const pct = patungan.slots > 0 ? Math.min(100, Math.round((patungan.joined / patungan.slots) * 100)) : 0
  const full = patungan.joined >= patungan.slots
  return (
    <article className="service-row">
      <div>
        <h3>{patungan.title}</h3>
        <p>
          {patungan.product} · {money(patungan.price)}/slot
        </p>
        <div className="progress-track">
          <span style={{ width: pct + '%' }} />
        </div>
        <small>
          {patungan.joined}/{patungan.slots} slot terisi
          {patungan.deadline ? ' · ' + patungan.deadline : ''}
        </small>
        {patungan.note ? <small>{patungan.note}</small> : null}
      </div>
      <button disabled={full} onClick={onJoin}>
        {full ? 'Penuh' : 'Ikut'}
      </button>
    </article>
  )
}

function JoinPatunganView({
  patunganId,
  onBack,
  onDone,
}: {
  patunganId: string | null
  onBack: () => void
  onDone: () => void
}) {
  const navigate = useNavigate()
  const patungan = usePatunganLocal((s) => (patunganId ? s.items.find((p) => p.id === patunganId) : undefined))
  const join = usePatunganLocal((s) => s.join)
  const isGuest = useSessionLocal((s) => s.isGuest)
  const [qty, setQty] = useState(1)
  const [payMethod, setPayMethod] = useState<'tunai' | 'transfer'>('tunai')

  if (!patungan) return null
  const total = patungan.price * qty

  function confirm() {
    if (isGuest) {
      useAuthStore.getState().openLoginSheet('patungan', 'Masuk dulu untuk ikut patungan')
      return
    }
    // TODO: tulis keikutsertaan ke Firestore (store patungan resmi).
    join(patungan!.id, qty)
    toast('Berhasil ikut patungan · ' + qty + ' slot')
    onDone()
    navigate(-1)
  }

  return (
    <div id="joinPatunganCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Ikut patungan</p>
          <h1 id="joinPatunganTitle">{patungan.title}</h1>
        </div>
      </header>
      <main className="content">
        <div id="joinPatunganInfo">
          <p className="service-note">
            {patungan.product} · {money(patungan.price)} per slot · {patungan.joined}/{patungan.slots} slot terisi
          </p>
        </div>
        <label className="settings-group">
          <label>Jumlah slot</label>
          <div className="det-step">
            <button id="joinMinus" onClick={() => setQty((v) => Math.max(1, v - 1))}>
              −
            </button>
            <b id="joinQty">{qty}</b>
            <button id="joinPlus" onClick={() => setQty((v) => v + 1)}>
              +
            </button>
          </div>
        </label>
        <div id="joinPatunganTotal" className="join-total">
          Total: {money(total)}
        </div>
        <div className="settings-group">
          <label>Metode pembayaran</label>
          <div className="det-step">
            <button className={`choice-btn pay-method${payMethod === 'tunai' ? ' active' : ''}`} onClick={() => setPayMethod('tunai')}>
              Tunai saat ambil
            </button>
            <button className={`choice-btn pay-method${payMethod === 'transfer' ? ' active' : ''}`} onClick={() => setPayMethod('transfer')}>
              Transfer
            </button>
          </div>
          <small className="form-hint-note">
            Tunai: bayar saat ambil barang di warung. Transfer: ke rekening warung, admin konfirmasi.
          </small>
        </div>
        <div className="sheet-actions">
          <button className="ghost" onClick={onBack}>
            Batal
          </button>
          <button className="primary" id="confirmJoinPatungan" onClick={confirm}>
            Ikut Patungan
          </button>
        </div>
      </main>
    </div>
  )
}

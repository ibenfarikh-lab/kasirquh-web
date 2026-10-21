import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import AdminNav from '../../components/AdminNav'
import { toast } from '../../components/ui'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { money, numericValue } from '../../lib/format'

export default function PatunganAdminPage() {
  useAdminBoot()
  const navigate = useNavigate()
  const patunganList = useLocalAdminStore((s) => s.patunganList)
  const createPatungan = useLocalAdminStore((s) => s.createPatungan)
  const setPatunganStatus = useLocalAdminStore((s) => s.setPatunganStatus)
  const confirmPatunganPayment = useLocalAdminStore((s) => s.confirmPatunganPayment)

  const [title, setTitle] = useState('')
  const [productName, setProductName] = useState('')
  const [price, setPrice] = useState('')
  const [slots, setSlots] = useState('')
  const [deadline, setDeadline] = useState('')
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)



  const create = () => {
    const data = {
      title: title.replace(/[<>]/g, '').trim(),
      productName: productName.replace(/[<>]/g, '').trim(),
      pricePerSlot: numericValue(price),
      totalSlots: Math.round(numericValue(slots)),
      deadline: deadline.replace(/[<>]/g, '').trim(),
      note: note.replace(/[<>]/g, '').trim(),
    }
    if (!data.title || !data.productName || !data.pricePerSlot || !data.totalSlots) {
      toast('Lengkapi nama, produk, harga, dan slot')
      return
    }
    setCreating(true)
    createPatungan(data)
      .then(() => {
        setTitle('')
        setProductName('')
        setPrice('')
        setSlots('')
        setDeadline('')
        setNote('')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal membuat patungan')
      })
      .finally(() => setCreating(false))
  }

  return (
    <div className="admin-screen">
      <div className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Kelola patungan</small>
            <h2>Patungan Warga</h2>
          </span>
          <button className="ghost" onClick={() => navigate('/admin/menu')} aria-label="Kembali ke Menu">
            {'‹ Kembali'}
          </button>
        </div>
      <div className="settings-group">
        <label>Nama patungan</label>
        <input
          className="setting-input"
          placeholder="cth: Patungan Indomie 1 dus"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="settings-group">
        <label>Nama produk</label>
        <input
          className="setting-input"
          placeholder="cth: Indomie Goreng"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="settings-group">
          <label>Harga per slot (Rp)</label>
          <input
            className="setting-input"
            inputMode="numeric"
            placeholder="10000"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
          />
        </div>
        <div className="settings-group">
          <label>Jumlah slot</label>
          <input
            className="setting-input"
            inputMode="numeric"
            placeholder="10"
            value={slots}
            onChange={(e) => setSlots(e.target.value.replace(/[^\d]/g, ''))}
          />
        </div>
      </div>
      <div className="settings-group">
        <label>Tenggat (opsional)</label>
        <input
          className="setting-input"
          placeholder="cth: 15 Okt 2026"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      <div className="settings-group">
        <label>Catatan (opsional)</label>
        <input
          className="setting-input"
          placeholder="cth: Dibagi saat barang datang"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <button
        className="primary"
        style={{ width: '100%', height: 46, border: 0, borderRadius: 14, fontWeight: 900 }}
        disabled={creating}
        onClick={create}
      >
        {creating ? 'Membuat…' : 'Buat Patungan'}
      </button>
      <div className="section-title" style={{ marginTop: 16 }}>
        Patungan berjalan
      </div>
      <div>
        {patunganList.length ? (
          patunganList.map((p) => (
            <article className="note-card" key={p.id}>
              <header>
                <h3>{p.title || p.productName || 'Patungan'}</h3>
                <span className="stock-pill">{p.status || 'aktif'}</span>
              </header>
              <p>
                {p.productName} · {money(p.pricePerSlot)}/slot · {p.filledSlots || 0}/
                {p.totalSlots || 0} terisi
              </p>
              {p.participants.length ? (
                <div className="patungan-parts">
                  {p.participants.map((x) => {
                    const ps = x.paymentStatus || 'menunggu bayar'
                    return (
                      <div className="part-row" key={x.customerId}>
                        <span>
                          {x.name} ({x.slots} slot)
                        </span>
                        <span className={ps === 'lunas' ? 'stock-pill' : 'notice-count'}>
                          {ps}
                        </span>
                        {ps !== 'lunas' ? (
                          <button
                            className="ghost"
                            onClick={() =>
                              confirmPatunganPayment(p.id, x.customerId)
                                .then(() => toast('Pembayaran dikonfirmasi lunas'))
                                .catch((e: unknown) =>
                                  toast('Gagal: ' + ((e as Error).message || '')),
                                )
                            }
                          >
                            Konfirmasi Lunas
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p>Belum ada peserta</p>
              )}
              <div className="card-actions">
                <button
                  className="ghost"
                  onClick={() =>
                    setPatunganStatus(p.id, 'selesai')
                      .then(() => {})
                      .catch(() => toast('Gagal'))
                  }
                >
                  Selesai
                </button>
                <button
                  className="ghost"
                  onClick={() =>
                    setPatunganStatus(p.id, 'batal')
                      .then(() => {})
                      .catch(() => toast('Gagal'))
                  }
                >
                  Batalkan
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-note">Belum ada patungan.</div>
        )}
      </div>
          </div>
      <AdminNav />
    </div>
  )
}
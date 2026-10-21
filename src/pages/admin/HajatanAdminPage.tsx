import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import AdminNav from '../../components/AdminNav'
import { toast } from '../../components/ui'
import { useProductsStore } from '../../stores/products'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { money } from '../../lib/format'
import type { RecipeItem } from '../../types'

export default function HajatanAdminPage() {
  useAdminBoot()
  const navigate = useNavigate()
  const products = useProductsStore((s) => s.products)
  const packages = useLocalAdminStore((s) => s.hajatanPackages)
  const saveHajatanPackage = useLocalAdminStore((s) => s.saveHajatanPackage)
  const deleteHajatanPackage = useLocalAdminStore((s) => s.deleteHajatanPackage)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [items, setItems] = useState<RecipeItem[]>([])
  const [pickId, setPickId] = useState('')
  const [pickQty, setPickQty] = useState('1')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (products.length && !pickId) setPickId(products[0].id)
  }, [products, pickId])

  const addItem = () => {
    if (!pickId) return
    if (items.some((it) => it.productId === pickId)) {
      return
    }
    setItems((list) => [
      ...list,
      { productId: pickId, qty: Math.max(1, Math.round(Number(pickQty) || 1)) },
    ])
  }

  const save = () => {
    const cleanName = name.replace(/[<>]/g, '').trim()
    if (!cleanName) {
      toast('Isi nama paket')
      return
    }
    if (!items.length) {
      toast('Tambahkan minimal 1 produk')
      return
    }
    setSaving(true)
    saveHajatanPackage(
      { name: cleanName, description: desc.replace(/[<>]/g, '').trim(), items },
      editingId,
    )
      .then(() => {
        setEditingId(null)
        setName('')
        setDesc('')
        setItems([])
      })
      .catch(() => toast('Gagal simpan'))
      .finally(() => setSaving(false))
  }

  const edit = (id: string) => {
    const p = packages.find((x) => x.id === id)
    if (!p) return
    setEditingId(p.id)
    setName(p.name || '')
    setDesc(p.description || '')
    setItems((p.items || []).map((it) => ({ productId: it.productId, qty: it.qty })))
  }

  const remove = (id: string) => {
    if (!window.confirm('Hapus paket ini?')) return
    deleteHajatanPackage(id)
      .then(() => {})
      .catch(() => toast('Gagal hapus'))
  }

  const options = products
    .filter((p) => p.stock > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))

  return (
    <div className="admin-screen">
      <div className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Kelola paket</small>
            <h2>Paket Hajatan</h2>
          </span>
          <button className="ghost" onClick={() => navigate('/admin/menu')} aria-label="Kembali ke Menu">
            {'‹ Kembali'}
          </button>
        </div>
      <div className="settings-group">
        <label>Nama paket</label>
        <input
          className="setting-input"
          placeholder="cth: Paket suguhan 20 tamu"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="settings-group">
        <label>Deskripsi</label>
        <input
          className="setting-input"
          placeholder="cth: Snack & minuman kemasan"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>
      <div className="section-title" style={{ marginTop: 12 }}>
        Isi paket <small>({items.length} produk)</small>
      </div>
      <div className="stock-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
        {items.length ? (
          items.map((it, i) => {
            const p = products.find((x) => x.id === it.productId)
            return (
              <div className="service-row" key={i}>
                <div>
                  <h3>{p ? p.name : '?'}</h3>
                  <p>Qty: {it.qty}</p>
                </div>
                <button onClick={() => setItems((list) => list.filter((_, j) => j !== i))}>
                  Hapus
                </button>
              </div>
            )
          })
        ) : (
          <div className="empty-note">Belum ada produk. Tambahkan di bawah.</div>
        )}
      </div>
      <div className="form-stack" style={{ marginTop: 8 }}>
        <label>Tambah produk</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px', gap: 8 }}>
          <select
            className="setting-input"
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            aria-label="Pilih produk"
          >
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {money(p.price)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            className="setting-input"
            value={pickQty}
            onChange={(e) => setPickQty(e.target.value)}
            aria-label="Jumlah"
          />
          <button className="primary" style={{ border: 0, borderRadius: 12 }} onClick={addItem}>
            +
          </button>
        </div>
      </div>
      <button className="primary-wide" style={{ marginTop: 12 }} disabled={saving} onClick={save}>
        {saving ? 'Menyimpan…' : 'Simpan Paket'}
      </button>
      <div className="section-title" style={{ marginTop: 16 }}>
        Paket tersimpan
      </div>
      <div>
        {packages.length ? (
          packages.map((p) => (
            <article className="note-card" key={p.id}>
              <header>
                <h3>{p.name}</h3>
              </header>
              <p>
                {p.description} · {(p.items || []).length} produk
              </p>
              <div className="card-actions">
                <button className="ghost" onClick={() => edit(p.id)}>
                  Ubah
                </button>
                <button className="ghost" onClick={() => remove(p.id)}>
                  Hapus
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-note">Belum ada paket. Buat di atas.</div>
        )}
      </div>
          </div>
      <AdminNav />
    </div>
  )
}
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useProductsStore } from '../../stores/products'
import {
  useLocalAdminStore,
  purchaseItemParts,
  purchaseItemLabel,
  shiftDateKey,
} from '../../features/admin/localAdmin'
import { money, numericValue, formatPurchaseDate } from '../../lib/format'
import { Icon, Sheet, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import type { StockNote } from '../../types'

export default function NotesPage() {
  useAdminBoot()
  const navigate = useNavigate()

  const products = useProductsStore((s) => s.products)
  const purchaseNotes = useLocalAdminStore((s) => s.purchaseNotes)
  const activePurchaseDate = useLocalAdminStore((s) => s.activePurchaseDate)
  const setActivePurchaseDate = useLocalAdminStore((s) => s.setActivePurchaseDate)
  const loadStockNotes = useLocalAdminStore((s) => s.loadStockNotes)
  const addManualPurchaseNote = useLocalAdminStore((s) => s.addManualPurchaseNote)

  const [editing, setEditing] = useState<{ date: string; id: string } | null>(null)
  const [supplier, setSupplier] = useState('')
  const [itemsText, setItemsText] = useState('')
  const [totalText, setTotalText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadStockNotes(activePurchaseDate).catch(() => {})
  }, [activePurchaseDate, loadStockNotes])

  const notes = purchaseNotes[activePurchaseDate] || []
  const dayTotal = notes.reduce((s, n) => s + n.total, 0)
  const stockValue = useMemo(
    () => products.reduce((s, p) => s + (p.stock || 0) * (p.cost || 0), 0),
    [products],
  )

  const shift = (days: number) => {
    const next = shiftDateKey(activePurchaseDate, days)
    setActivePurchaseDate(next)
  }

  const addNote = () => {
    const cleanSupplier = supplier.replace(/[<>]/g, '').trim()
    const items = itemsText
      .split(/\n|,/)
      .map((x) => x.replace(/[<>]/g, '').trim())
      .filter(Boolean)
    const total = numericValue(totalText)
    if (!cleanSupplier || !items.length || !total) {
      toast('Lengkapi supplier, daftar barang, dan total')
      return
    }
    setSaving(true)
    addManualPurchaseNote({ supplier: cleanSupplier, items, total })
      .then(() => {
        setSupplier('')
        setItemsText('')
        setTotalText('')
        toast('Catatan disimpan · kas & Pembukuan diperbarui')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Penyimpanan gagal')
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="admin-screen">
      <div id="noteView" className="subview admin-note-page active">
        <div className="admin-page-head">
          <span>
            <small>Kulakan per tanggal</small>
            <h2>Catatan Belanja</h2>
          </span>
          <div className="product-admin-head-actions">
            <button className="add-product-btn" onClick={() => navigate('/admin/belanja-stok')}>
              Belanja Stok
            </button>
          </div>
        </div>
        <section className="capital-card stock-value-card" aria-label="Nilai stok">
          <div className="capital-head">
            <span>
              <small>NILAI STOK · MODAL DI RAK</small>
              <b>{money(stockValue)}</b>
            </span>
          </div>
          <small className="capital-note">
            Dihitung dari stok × modal per pcs seluruh produk. Saldo kas dikelola di Pembukuan.
          </small>
        </section>
        <div className="date-nav">
          <button aria-label="Hari sebelumnya" onClick={() => shift(-1)}>
            ‹
          </button>
          <input
            type="date"
            aria-label="Pilih tanggal catatan belanja"
            value={activePurchaseDate}
            onChange={(e) => {
              if (e.target.value) setActivePurchaseDate(e.target.value)
            }}
          />
          <button aria-label="Hari berikutnya" onClick={() => shift(1)}>
            ›
          </button>
          <button
            aria-label="Muat ulang catatan"
            title="Muat ulang"
            onClick={() =>
              loadStockNotes(activePurchaseDate)
                .then((n) => toast(n + ' catatan dimuat'))
                .catch((err: unknown) => {
                  const e = err as { code?: string }
                  if (!e || e.code !== 'OFFLINE') toast('Gagal memuat')
                })
            }
          >
            ⟳
          </button>
        </div>
        <div className="date-title">
          <b>{formatPurchaseDate(activePurchaseDate)}</b>
          <small>
            {notes.length} catatan · total {money(dayTotal)}
          </small>
        </div>
        <div className="purchase-note-list">
          {notes.length ? (
            notes.map((note) => (
              <article
                className="purchase-note-card"
                key={note.id}
                tabIndex={0}
                role="button"
                aria-label={'Buka catatan ' + note.supplier}
                onClick={() => setEditing({ date: activePurchaseDate, id: note.id })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setEditing({ date: activePurchaseDate, id: note.id })
                  }
                }}
              >
                <header>
                  <div>
                    <h3>{note.supplier}</h3>
                    <small>{note.items.length} jenis barang</small>
                  </div>
                  <span className="source-pill">
                    {note.source === 'impor' ? 'Impor' : note.source}
                  </span>
                </header>
                <ul>
                  {note.items.map((item, i) => (
                    <li key={i}>{purchaseItemLabel(item)}</li>
                  ))}
                </ul>
                <footer>
                  <span>Total belanja</span>
                  <b>{money(note.total)}</b>
                </footer>
              </article>
            ))
          ) : (
            <div className="purchase-empty">Belum ada catatan belanja pada tanggal ini.</div>
          )}
        </div>
        <div className="purchase-form">
          <b>Tambah catatan</b>
          <div className="form-stack">
            <label htmlFor="purchaseSupplierInput">Supplier</label>
            <input
              id="purchaseSupplierInput"
              placeholder="Contoh: Agen sembako"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
            <label htmlFor="purchaseItemsInput">Barang yang dibeli</label>
            <textarea
              id="purchaseItemsInput"
              placeholder="Satu barang per baris, contoh: Minyak 2 dus"
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
            />
            <label htmlFor="purchaseTotalInput">Total habis</label>
            <input
              id="purchaseTotalInput"
              inputMode="numeric"
              placeholder="Contoh: 725.000"
              value={totalText}
              onChange={(e) => setTotalText(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
          <button className="primary-wide" disabled={saving} onClick={addNote}>
            {saving ? 'Menyimpan…' : 'Simpan Catatan Belanja'}
          </button>
        </div>
      </div>
      <AdminNav />
      <PurchaseNoteSheet editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}


type Mode = 'detail' | 'edit' | 'delete'

function PurchaseNoteSheet({
  editing,
  onClose,
}: {
  editing: { date: string; id: string } | null
  onClose: () => void
}) {
  const purchaseNotes = useLocalAdminStore((s) => s.purchaseNotes)
  const updateStockNote = useLocalAdminStore((s) => s.updateStockNote)
  const deleteStockNote = useLocalAdminStore((s) => s.deleteStockNote)
  const loadStockNotes = useLocalAdminStore((s) => s.loadStockNotes)

  const [mode, setMode] = useState<Mode>('detail')
  const [supplier, setSupplier] = useState('')
  const [rows, setRows] = useState<{ name: string; qty: string }[]>([])
  const [totalText, setTotalText] = useState('')
  const [busy, setBusy] = useState(false)

  const note: StockNote | undefined = editing
    ? (purchaseNotes[editing.date] || []).find((n) => n.id === editing.id)
    : undefined

  useEffect(() => {
    if (editing && note) {
      setMode('detail')
      setSupplier(note.supplier)
      setRows(note.items.map((it) => purchaseItemParts(it)))
      setTotalText(String(note.total))
      setBusy(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, editing?.date])

  if (!note || !editing) return null

  const saveEdit = () => {
    const cleanSupplier = supplier.replace(/[<>]/g, '').trim()
    const items = rows.map((r) => ({
      name: r.name.replace(/[<>]/g, '').trim(),
      qty: r.qty.replace(/[<>]/g, '').trim(),
    }))
    const total = numericValue(totalText)
    if (!cleanSupplier) {
      toast('Supplier tidak boleh kosong')
      return
    }
    if (!items.length) {
      toast('Tambahkan minimal satu barang')
      return
    }
    const invalid = items.findIndex((it) => !it.name || !it.qty)
    if (invalid >= 0) {
      toast('Lengkapi nama dan jumlah setiap barang')
      return
    }
    if (!total) {
      toast('Total belanja harus lebih dari Rp0')
      return
    }
    setBusy(true)
    updateStockNote(note.id, { supplier: cleanSupplier, items, total })
      .then(() => {
        loadStockNotes(editing.date).catch(() => {})
        setMode('detail')
        toast('Arsip catatan diperbarui · stok dan keuangan tetap')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Simpan arsip gagal')
      })
      .finally(() => setBusy(false))
  }

  const remove = () => {
    setBusy(true)
    deleteStockNote(note.id)
      .then(() => {
        loadStockNotes(editing.date).catch(() => {})
        onClose()
        toast('Catatan dihapus · stok dan keuangan tetap')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Hapus arsip gagal')
      })
      .finally(() => setBusy(false))
  }

  return (
    <Sheet open={editing !== null} onClose={onClose} sheetClassName="sheet feature-sheet">
      {mode === 'detail' ? (
        <div>
          <div className="sheet-top">
            <div>
              <small className="page-kicker">{formatPurchaseDate(editing.date)}</small>
              <h2>{note.supplier}</h2>
            </div>
            <button className="sheet-close" onClick={onClose} aria-label="Tutup detail catatan">
              ×
            </button>
          </div>
          <div className="purchase-detail-meta">
            <span className="source-pill">
              {note.source === 'impor' ? 'Impor' : note.source}
            </span>
            <small>{note.items.length} jenis barang</small>
          </div>
          <div className="purchase-detail-list">
            {note.items.map((item, i) => {
              const parts = purchaseItemParts(item)
              return (
                <div className="purchase-detail-row" key={i}>
                  <b>{parts.name}</b>
                  <span>{parts.qty}</span>
                </div>
              )
            })}
          </div>
          <div className="purchase-detail-total">
            <span>Total belanja</span>
            <b>{money(note.total)}</b>
          </div>
          <div className="purchase-archive-note">
            <Icon name="note" />
            <span>
              Perubahan di sini hanya memperbarui arsip catatan. Pembukuan dan stok produk tidak
              dihitung ulang.
            </span>
          </div>
          <div className="purchase-detail-actions">
            <button className="back" onClick={onClose}>
              Tutup
            </button>
            <button className="delete-note" onClick={() => setMode('delete')}>
              <Icon name="trash" />
              Hapus
            </button>
            <button className="primary" onClick={() => setMode('edit')}>
              Ubah
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'edit' ? (
        <div>
          <div className="sheet-top">
            <div>
              <small className="page-kicker">Ubah arsip belanja</small>
              <h2>Ubah Catatan</h2>
            </div>
            <button className="sheet-close" onClick={onClose} aria-label="Tutup perubahan catatan">
              ×
            </button>
          </div>
          <div className="purchase-detail-meta">
            <span className="source-pill">
              {note.source === 'impor' ? 'Impor' : note.source}
            </span>
            <small>Arsip transaksi</small>
          </div>
          <div className="form-stack">
            <label htmlFor="purchaseEditSupplier">Supplier</label>
            <input
              id="purchaseEditSupplier"
              maxLength={80}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
            <label>Daftar barang</label>
            <div className="purchase-edit-rows">
              {rows.map((row, i) => (
                <div className="purchase-edit-row" key={i}>
                  <input
                    className="purchase-edit-name"
                    placeholder="Nama barang"
                    aria-label="Nama barang"
                    value={row.name}
                    onChange={(e) =>
                      setRows((rs) => rs.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                    }
                  />
                  <input
                    className="purchase-edit-qty"
                    placeholder="Jumlah"
                    aria-label="Jumlah barang"
                    value={row.qty}
                    onChange={(e) =>
                      setRows((rs) => rs.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))
                    }
                  />
                  <button
                    type="button"
                    aria-label="Hapus baris barang"
                    onClick={() => {
                      if (rows.length === 1) {
                        toast('Minimal satu barang')
                        return
                      }
                      setRows((rs) => rs.filter((_, j) => j !== i))
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="purchase-add-row"
              onClick={() => setRows((rs) => [...rs, { name: '', qty: '' }])}
            >
              + Tambah baris barang
            </button>
            <label htmlFor="purchaseEditTotal">Total belanja</label>
            <input
              id="purchaseEditTotal"
              inputMode="numeric"
              value={totalText}
              onChange={(e) => setTotalText(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
          <div className="purchase-archive-note">
            <Icon name="alert" />
            <span>Menyimpan edit tidak mengubah ulang Pembukuan atau stok produk.</span>
          </div>
          <div className="purchase-edit-actions">
            <button className="back" onClick={() => setMode('detail')}>
              Batal
            </button>
            <button className="primary" disabled={busy} onClick={saveEdit}>
              {busy ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'delete' ? (
        <div className="purchase-delete-confirm">
          <div className="delete-confirm-icon" aria-hidden="true">
            <Icon name="trash" />
          </div>
          <h2>Yakin hapus catatan ini?</h2>
          <p>
            {note.supplier} · {money(note.total)} akan hilang dari arsip{' '}
            {formatPurchaseDate(editing.date)}.
          </p>
          <div className="purchase-archive-note">
            <Icon name="alert" />
            <span>Hanya arsip catatan yang dihapus. Pembukuan dan stok produk tidak berubah.</span>
          </div>
          <div className="purchase-delete-actions">
            <button className="back" onClick={() => setMode('detail')}>
              Batal
            </button>
            <button className="danger-confirm" disabled={busy} onClick={remove}>
              <Icon name="trash" />
              Hapus
            </button>
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}

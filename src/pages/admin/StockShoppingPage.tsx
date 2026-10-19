/**
 * KasirQuh React — src/pages/admin/StockShoppingPage.tsx
 * Halaman (dulu StockShoppingSheet): belanja stok.
 * Pengganti #stockShoppingModal + #stockSummaryModal + js/features/admin/stock.js.
 * Belanja Stok: saran kulakan otomatis -> checklist -> ringkasan -> simpan
 * (stok nambah, modal & harga jual tersimpan, jurnal kulakan, arsip stock_notes).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import AdminNav from '../../components/AdminNav'
import { Sheet, SheetHeader, Icon, toast } from '../../components/ui'
import { useProductsStore } from '../../stores/products'
import {
  useLocalAdminStore,
  cashBalance,
} from '../../features/admin/localAdmin'
import { money, numericValue, groupedNumber, stockText } from '../../lib/format'
import type { Product } from '../../types'

interface StockTask {
  key: string
  productId: string
  name: string
  note: string
  qtyLabel: string
  done: boolean
  price: string
  content: string
  packs: string
  packsManual: boolean
  suggestedPcs: number | null
}

interface RestockItem {
  productId: string | null
  product: Product | null
  name: string
  qtyPcs: number
  unitCost: number
  lineTotal: number
  suggestedPrice: number
}

interface PendingRestock {
  supplier: string
  items: RestockItem[]
  total: number
  automaticTotal: number
}

let taskSeq = 1

function taskData(t: StockTask): {
  price: number
  content: number
  packs: number
  qtyPcs: number
  unitCost: number
  lineTotal: number
} {
  const price = numericValue(t.price)
  const content = numericValue(t.content)
  const packs = numericValue(t.packs)
  const qtyPcs = packs * content
  const unitCost = content ? Math.round(price / content) : 0
  return { price, content, packs, qtyPcs, unitCost, lineTotal: price * packs }
}

export default function StockShoppingPage() {
  useAdminBoot()
  const navigate = useNavigate()
  const products = useProductsStore((s) => s.products)
  const journalEntries = useLocalAdminStore((s) => s.journalEntries)
  const lowStockThreshold = useLocalAdminStore((s) => s.lowStockThreshold)
  const setLowStockThreshold = useLocalAdminStore((s) => s.setLowStockThreshold)

  const [tasks, setTasks] = useState<StockTask[]>([])
  const [threshold, setThreshold] = useState(lowStockThreshold)
  const [supplier, setSupplier] = useState('')
  const [spend, setSpend] = useState('')
  const [spendManual, setSpendManual] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [pending, setPending] = useState<PendingRestock | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)

  useEffect(() => {
    setThreshold(lowStockThreshold)
    setSpendManual(false)
    // inisialisasi form sekali per mount — ambang batas dari store hanya dipakai sebagai nilai awal agar tidak menimpa isian user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const balance = cashBalance(journalEntries)
  const selectedIds = useMemo(() => tasks.map((t) => t.productId).filter(Boolean), [tasks])
  const suggestions = useMemo(
    () =>
      products
        .filter((p) => p.stock <= threshold && !selectedIds.includes(p.id))
        .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name)),
    [products, threshold, selectedIds],
  )

  const doneTasks = tasks.filter((t) => t.done)
  const autoTotal = doneTasks.reduce((s, t) => s + taskData(t).lineTotal, 0)
  const spendTotal = spendManual ? numericValue(spend) : autoTotal
  const warnBalance = spendTotal > 0 && spendTotal > balance

  const updateTask = (key: string, patch: Partial<StockTask>) =>
    setTasks((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)))

  const addTask = (
    name: string,
    qtyLabel: string,
    opts: { productId?: string; note?: string; suggestedPcs?: number | null } = {},
  ) => {
    const qtyMatch = String(qtyLabel).match(/[\d.,]+/)
    setTasks((ts) => [
      ...ts,
      {
        key: 'task-' + taskSeq++ + '-' + Date.now(),
        productId: opts.productId || '',
        name,
        note: opts.note || 'Ditambahkan manual',
        qtyLabel,
        done: false,
        price: '',
        content: '',
        packs: String(Math.max(1, numericValue(String((opts.suggestedPcs ?? qtyMatch?.[0]) || 1)))),
        packsManual: false,
        suggestedPcs: opts.suggestedPcs ?? null,
      },
    ])
  }

  const addSuggestion = (p: Product, qtyInput: string) => {
    const qty = Math.max(1, numericValue(qtyInput))
    addTask(p.name, qty + ' pcs dibutuhkan', {
      productId: p.id,
      note: 'Saran otomatis · stok ' + stockText(p) + ' ' + (p.unit || 'pcs'),
      suggestedPcs: qty,
    })
    toast(p.short + ' masuk checklist · ' + qty + ' pcs disarankan')
  }

  const addManual = () => {
    const name = newName.replace(/[<>]/g, '').trim()
    const qty = newQty.replace(/[<>]/g, '').trim()
    if (!name || !qty) {
      toast('Isi nama barang dan jumlah')
      return
    }
    const match = products.find(
      (p) => p.name.toLowerCase() === name.toLowerCase() || p.short.toLowerCase() === name.toLowerCase(),
    )
    if (match && selectedIds.includes(match.id)) {
      toast(match.short + ' sudah ada di checklist')
      return
    }
    addTask(name, qty, {
      productId: match ? match.id : '',
      note: match ? 'Ditambahkan manual dari Data Produk' : 'Barang manual · produk baru',
    })
    setNewName('')
    setNewQty('')
    toast('Barang ditambahkan ke daftar kulakan')
  }

  const takeNote = () => {
    const done = tasks.filter((t) => t.done)
    if (!done.length) {
      toast('Tandai minimal satu barang sudah dibeli')
      return
    }
    const cleanSupplier = supplier.replace(/[<>]/g, '').trim()
    if (!cleanSupplier) {
      toast('Isi nama supplier')
      return
    }
    const invalid = done.find((t) => {
      const d = taskData(t)
      return !d.price || !d.content || !d.packs
    })
    if (invalid) {
      toast('Lengkapi harga, isi, dan jumlah kemasan setiap barang selesai')
      return
    }
    const items: RestockItem[] = done.map((t) => {
      const d = taskData(t)
      const product =
        products.find((p) => p.id === t.productId) ||
        products.find((p) => p.name.toLowerCase() === t.name.toLowerCase()) ||
        null
      return {
        productId: product ? product.id : null,
        product,
        name: t.name,
        qtyPcs: d.qtyPcs,
        unitCost: d.unitCost,
        lineTotal: d.lineTotal,
        suggestedPrice: Math.round((d.unitCost * 1.25) / 500) * 500,
      }
    })
    const automaticTotal = items.reduce((s, it) => s + it.lineTotal, 0)
    const total = numericValue(spend) || automaticTotal
    if (!total) {
      toast('Total belanja belum terisi')
      return
    }
    setPending({ supplier: cleanSupplier, items, total, automaticTotal })
    setSummaryOpen(true)
  }

  const reset = () => {
    setTasks([])
    setSupplier('')
    setSpend('')
    setSpendManual(false)
    setPending(null)
    setSummaryOpen(false)
  }

  const backToMenu = () => navigate('/admin/menu')

  return (
    <div className="admin-screen">
      <div className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Terhubung ke Data Produk</small>
            <h2>Belanja Stok</h2>
          </span>
          <button className="ghost" onClick={backToMenu} aria-label="Kembali ke Menu">
            {'‹ Kembali'}
          </button>
        </div>
        <section className="low-stock-panel" aria-labelledby="lowStockTitle">
          <div className="stock-suggestion-head">
            <span>
              <h3 id="lowStockTitle">Perlu dikulak</h3>
              <small>Otomatis dari stok Data Produk</small>
            </span>
            <label htmlFor="lowStockThreshold">
              Batas menipis{' '}
              <span>
                <input
                  id="lowStockThreshold"
                  inputMode="numeric"
                  type="text"
                  value={threshold}
                  aria-label="Batas stok menipis dalam pcs"
                  onChange={(e) => {
                    const v = Math.min(99, Math.max(1, numericValue(e.target.value) || 1))
                    setThreshold(v)
                    setLowStockThreshold(v)
                  }}
                />{' '}
                pcs
              </span>
            </label>
          </div>
          <div className="low-stock-list">
            {suggestions.map((p) => (
              <SuggestionRow key={p.id} product={p} threshold={threshold} onAdd={addSuggestion} />
            ))}
          </div>
          <div className="stock-empty" hidden={suggestions.length > 0}>
            Semua stok masih aman.
          </div>
        </section>
        <div className="stock-checklist-head">
          <span>
            <h3>Checklist belanja</h3>
            <small>
              {doneTasks.length} dari {tasks.length} barang sudah dibeli
            </small>
          </span>
          <small>Tandai setelah barang didapat</small>
        </div>
        <div className="stock-list">
          {tasks.map((t) => {
            const d = taskData(t)
            const suggested = t.suggestedPcs
            return (
              <article key={t.key} className={'stock-task' + (t.done ? ' done' : '')}>
                <input
                  className="stock-check"
                  type="checkbox"
                  aria-label={'Tandai ' + t.name + ' selesai'}
                  checked={t.done}
                  onChange={(e) => {
                    updateTask(t.key, { done: e.target.checked })
                    setSpendManual(false)
                  }}
                />
                <div className="stock-task-body">
                  <div className="stock-task-head">
                    <span className="task-copy">
                      <b>{t.name}</b>
                      <small>{t.note}</small>
                    </span>
                    <strong>{t.qtyLabel}</strong>
                  </div>
                  <div className="stock-buy-fields">
                    <label>
                      Harga per kemasan (Rp)
                      <input
                        className="stock-pack-price"
                        inputMode="numeric"
                        placeholder="Sesuai nota"
                        value={t.price}
                        onChange={(e) => {
                          updateTask(t.key, { price: e.target.value.replace(/[^\d]/g, '') })
                          setSpendManual(false)
                        }}
                      />
                    </label>
                    <label>
                      Isi per kemasan
                      <input
                        className="stock-pack-content"
                        inputMode="numeric"
                        placeholder="Jumlah pcs"
                        value={t.content}
                        onChange={(e) => {
                          const content = e.target.value.replace(/[^\d]/g, '')
                          const patch: Partial<StockTask> = { content }
                          if (suggested && !t.packsManual) {
                            const contentNum = numericValue(content)
                            patch.packs = String(
                              contentNum ? Math.max(1, Math.ceil(suggested / contentNum)) : 1,
                            )
                          }
                          updateTask(t.key, patch)
                          setSpendManual(false)
                        }}
                      />
                    </label>
                    <label className="stock-pack-count-label">
                      Kemasan dibeli
                      <input
                        className="stock-pack-count"
                        inputMode="numeric"
                        aria-label={'Jumlah kemasan ' + t.name + ' yang dibeli'}
                        value={t.packs}
                        onChange={(e) => {
                          updateTask(t.key, {
                            packs: e.target.value.replace(/[^\d]/g, ''),
                            packsManual: true,
                          })
                          setSpendManual(false)
                        }}
                      />
                    </label>
                    <div className="unit-cost">
                      <span className="stock-unit-label">
                        {d.content
                          ? 'Modal per pcs · ' +
                            d.qtyPcs +
                            ' pcs masuk stok' +
                            (suggested ? ' (butuh ' + suggested + ')' : '')
                          : 'Modal per pcs'}
                      </span>
                      <b className="stock-unit-cost">{d.unitCost ? money(d.unitCost) : 'Rp0'}</b>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
        <div className="stock-empty" hidden={tasks.length > 0}>
          Belum ada barang. Tambahkan dari saran di atas atau isi manual.
        </div>
        <div className="inline-form">
          <input placeholder="Tambah barang manual" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input placeholder="Jumlah, mis. 2 dus" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
          <button onClick={addManual}>Tambah</button>
        </div>
        <div className="stock-note-fields">
          <input
            placeholder="Nama supplier"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
          <div className="stock-total-wrap">
            <label htmlFor="stockSpend">Total akhir</label>
            <div className="stock-total-input">
              <input
                id="stockSpend"
                inputMode="numeric"
                placeholder="Dihitung otomatis"
                value={spendManual ? spend : autoTotal ? groupedNumber(autoTotal) : ''}
                onChange={(e) => {
                  setSpend(e.target.value.replace(/[^\d]/g, ''))
                  setSpendManual(true)
                }}
              />
              <span>Bisa dikoreksi untuk diskon, ongkir, atau pembulatan.</span>
            </div>
          </div>
        </div>
        <div className="stock-warning" hidden={!warnBalance}>
          Saldo kas kurang {money(spendTotal - balance)}. Simpan tetap bisa dilanjutkan.
        </div>
        <button className="take-note-btn" onClick={takeNote}>
          <Icon name="download" /> Ambil Catatan
        </button>
        <p className="service-note">
          Sebelum disimpan, modal, harga jual, stok, dan total akan diperiksa di layar ringkasan.
        </p>
      </div>
      <StockSummarySheet
        open={summaryOpen}
        pending={pending}
        balance={balance}
        onBack={() => setSummaryOpen(false)}
        onSaved={() => {
          reset()
          backToMenu()
        }}
      />
      <AdminNav />
    </div>
  )
}

function SuggestionRow({
  product,
  threshold,
  onAdd,
}: {
  product: Product
  threshold: number
  onAdd: (p: Product, qty: string) => void
}) {
  const suggested = Math.max(1, threshold * 2 - product.stock)
  const [qty, setQty] = useState(groupedNumber(suggested))
  return (
    <article className="low-stock-row">
      <img src={product.img} alt={product.name} />
      <span>
        <b>{product.name}</b>
        <small>
          Sisa {stockText(product)} {product.unit || 'pcs'}
        </small>
      </span>
      <label className="suggestion-qty">
        <input
          className="suggestion-qty-input"
          inputMode="numeric"
          type="text"
          value={qty}
          aria-label={'Jumlah ' + product.name + ' yang disarankan'}
          onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))}
        />{' '}
        pcs
      </label>
      <button
        className="add-suggestion"
        aria-label={'Tambahkan ' + product.name + ' ke checklist'}
        onClick={() => onAdd(product, qty)}
      >
        +
      </button>
    </article>
  )
}

function StockSummarySheet({
  open,
  pending,
  balance,
  onBack,
  onSaved,
}: {
  open: boolean
  pending: PendingRestock | null
  balance: number
  onBack: () => void
  onSaved: () => void
}) {
  const saveRestock = useLocalAdminStore((s) => s.saveRestock)
  const [costChoices, setCostChoices] = useState<Record<number, string>>({})
  const [salePrices, setSalePrices] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && pending) {
      const sp: Record<number, string> = {}
      pending.items.forEach((it, i) => {
        sp[i] = groupedNumber(it.suggestedPrice)
      })
      setSalePrices(sp)
      setCostChoices({})
      setSaving(false)
    }
  }, [open, pending])

  if (!pending) return null
  const after = balance - pending.total

  const save = () => {
    const invalidIdx = pending.items.findIndex((_, i) => !numericValue(salePrices[i] || ''))
    if (invalidIdx >= 0) {
      toast('Lengkapi harga jual setiap barang')
      return
    }
    setSaving(true)
    saveRestock({
      supplier: pending.supplier,
      items: pending.items.map((it, i) => ({
        productId: it.productId,
        name: it.name,
        qtyPcs: it.qtyPcs,
        unitCost: it.unitCost,
        lineTotal: it.lineTotal,
        costChoice: costChoices[i] || 'weighted',
        salePrice: numericValue(salePrices[i]),
      })),
      total: pending.total,
    })
      .then(() => {
        onSaved()
        toast(pending.items.length + ' produk masuk stok · kas & Pembukuan diperbarui')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Penyimpanan gagal')
      })
      .finally(() => setSaving(false))
  }

  return (
    <Sheet open={open} onClose={onBack} sheetClassName="sheet feature-sheet">
      <SheetHeader kicker="Periksa sebelum masuk stok" title="Ringkasan Kulakan" onClose={onBack} />
      <div className="restock-summary-list">
        {pending.items.map((item, i) => {
          const product = item.product
          const oldInfo = product
            ? 'Stok lama ' +
              stockText(product) +
              ' ' +
              (product.unit || 'pcs') +
              ' · modal lama ' +
              money(product.cost)
            : 'Produk baru · akan masuk kategori Lainnya'
          return (
            <article className="restock-summary-item" key={i}>
              <header>
                <h3>{item.name}</h3>
                <span>{item.qtyPcs} pcs</span>
              </header>
              <div className="restock-metrics">
                <div>
                  <small>Modal / pcs</small>
                  <b>{money(item.unitCost)}</b>
                </div>
                <div>
                  <small>Catatan stok</small>
                  <b>{oldInfo}</b>
                </div>
              </div>
              {product ? (
                <label>
                  Modal yang disimpan
                  <select
                    value={costChoices[i] || 'weighted'}
                    onChange={(e) =>
                      setCostChoices((c) => ({ ...c, [i]: e.target.value }))
                    }
                  >
                    <option value="weighted">Rata-rata tertimbang</option>
                    <option value="new">Pakai modal baru</option>
                  </select>
                </label>
              ) : null}
              <label>
                Harga jual disarankan · +25%, dibulatkan Rp500
                <input
                  inputMode="numeric"
                  value={salePrices[i] || ''}
                  onChange={(e) =>
                    setSalePrices((sp) => ({
                      ...sp,
                      [i]: e.target.value.replace(/[^\d]/g, ''),
                    }))
                  }
                />
              </label>
            </article>
          )
        })}
      </div>
      <div className="restock-summary-foot">
        <div>
          <span>Supplier</span>
          <b>{pending.supplier}</b>
        </div>
        <div className="final">
          <span>Total akhir</span>
          <b>{money(pending.total)}</b>
        </div>
        <div>
          <span>Saldo kas setelah simpan</span>
          <b className={after < 0 ? 'cash-negative' : undefined}>{money(after)}</b>
        </div>
      </div>
      <div className="stock-warning" hidden={pending.total <= balance}>
        Saldo kas kurang. Simpan tetap bisa dilanjutkan dan saldo akan tampil merah di Pembukuan.
      </div>
      <div className="summary-actions">
        <button className="back" onClick={onBack}>
          Kembali
        </button>
        <button className="primary" disabled={saving} onClick={save}>
          {saving ? 'Menyimpan…' : 'Simpan & Masukkan Stok'}
        </button>
      </div>
    </Sheet>
  )
}

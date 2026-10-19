/**
 * KasirQuh React — src/pages/admin/ProductsPage.tsx
 * Pengganti #produkView + js/features/admin/products.js + renderAdminProductData()
 * + deleteProduct() (js/app.js): filter kategori, impor CSV, tambah/ubah/hapus.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useProductsStore, type CsvProductItem } from '../../stores/products'
import { money, groupedNumber, stockText } from '../../lib/format'
import { Icon, Sheet, SheetHeader, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'

const FILTER_CATS = ['Sembako', 'Minuman', 'Snack', 'Rokok', 'Rumah Tangga', 'Lainnya']

/* ---------- CSV (1:1 js/features/admin/products.js) ---------- */

const CSV_HEADER_ALIASES: Record<string, string[]> = {
  barcode: ['kode', 'barcode', 'kode barang', 'kode produk', 'sku', 'plu'],
  name: ['nama', 'nama produk', 'nama barang', 'produk'],
  cat: ['kategori', 'category', 'kat'],
  unit: ['satuan', 'unit'],
  stock: ['stok', 'stock', 'jumlah', 'qty'],
  cost: ['modal', 'harga modal', 'cost', 'harga beli', 'harga kulak'],
  price: ['harga', 'harga jual', 'price'],
  photo: ['foto', 'photo', 'gambar', 'image', 'photourl', 'foto url'],
}

function parseCsvNumber(value: unknown): number {
  let s = String(value == null ? '' : value).trim().replace(/\s+/g, '')
  if (!s) return 0
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = Number(s)
  return isNaN(n) ? 0 : n
}

function parseCsvText(text: unknown): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    if (row.some((c) => String(c).trim() !== '')) rows.push(row)
    row = []
  }
  const src = String(text || '').replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') pushField()
    else if (ch === '\r') {
      /* ikut \n */
    } else if (ch === '\n') {
      pushField()
      pushRow()
    } else field += ch
  }
  pushField()
  pushRow()
  return rows
}

function mapCsvRows(rows: string[][]): {
  items: CsvProductItem[]
  skipped: { row: number; reason: string }[]
} {
  const out: { items: CsvProductItem[]; skipped: { row: number; reason: string }[] } = {
    items: [],
    skipped: [],
  }
  if (!rows.length) return out
  const header = rows[0].map((h) => String(h || '').trim().toLowerCase())
  const colIndex: Record<string, number> = {}
  Object.keys(CSV_HEADER_ALIASES).forEach((key) => {
    colIndex[key] = header.findIndex((h) => CSV_HEADER_ALIASES[key].indexOf(h) >= 0)
  })
  if (colIndex.name < 0) {
    out.skipped.push({ row: 1, reason: 'kolom Nama tidak ditemukan di baris judul' })
    return out
  }
  const seen: Record<string, CsvProductItem> = {}
  rows.slice(1).forEach((cells, i) => {
    const lineNo = i + 2
    const get = (key: string) =>
      colIndex[key] >= 0 ? String(cells[colIndex[key]] == null ? '' : cells[colIndex[key]]).trim() : ''
    const name = get('name')
    if (!name) {
      out.skipped.push({ row: lineNo, reason: 'tanpa nama' })
      return
    }
    const barcode = get('barcode')
    const dedupeKey = barcode ? 'kode:' + barcode : 'baris:' + lineNo
    seen[dedupeKey] = {
      barcode,
      name,
      photo: get('photo'),
      cat: get('cat') || 'Lainnya',
      unit: get('unit') || 'pcs',
      stock: parseCsvNumber(get('stock')),
      cost: parseCsvNumber(get('cost')),
      price: parseCsvNumber(get('price')),
    }
  })
  out.items = Object.values(seen)
  return out
}

/* ---------- Halaman ---------- */

export default function ProductsPage() {
  useAdminBoot()
  const navigate = useNavigate()

  const products = useProductsStore((s) => s.products)
  const refreshProducts = useProductsStore((s) => s.refresh)
  const removeProduct = useProductsStore((s) => s.remove)

  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)

  const sorted = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('id-ID')
    return products
      .filter(
        (p) =>
          (!q || String(p.name || '').toLocaleLowerCase('id-ID').includes(q)) &&
          (!cat || p.cat === cat),
      )
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'))
  }, [products, query, cat])

  const openForm = (id: string | null) => {
    setConfirmDeleteId(null)
    navigate(id ? `/admin/produk/${id}/edit` : '/admin/produk/baru')
  }

  const deleteProduct = (id: string) => {
    const product = products.find((item) => item.id === id)
    if (!product) return
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      toast('Tap “Ya, hapus” untuk mengonfirmasi')
      return
    }
    if (products.length === 1) {
      setConfirmDeleteId(null)
      toast('Produk terakhir tidak dapat dihapus')
      return
    }
    setConfirmDeleteId(null)
    removeProduct(id)
      .then(() => toast(product.name + ' dihapus'))
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Hapus produk gagal')
      })
  }

  return (
    <div className="admin-screen">
      <div id="produkView" className="subview admin-page active">
        <div className="product-admin-head">
          <h2>Data Produk</h2>
          <div className="product-admin-head-actions">
            <button
              className="refresh-btn"
              aria-label="Muat ulang produk"
              onClick={() => refreshProducts().then(() => toast('Produk dimuat ulang'))}
            >
              ⟳
            </button>
            <button className="add-product-btn" onClick={() => setCsvOpen(true)}>
              Impor CSV
            </button>
            <button className="add-product-btn" onClick={() => openForm(null)}>
              + Tambah Produk
            </button>
          </div>
        </div>
        <div className="product-data-filters">
          <label className="pos-search" htmlFor="dataProductSearch">
            <Icon name="search" />
            <input
              id="dataProductSearch"
              type="search"
              autoComplete="off"
              placeholder="Cari nama produk…"
              aria-label="Cari produk"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            id="dataProductCategory"
            aria-label="Filter kategori"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="">Semua Kategori</option>
            {FILTER_CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="info-card product-admin-list">
          {sorted.map((product) => {
            const marginAmount = Math.max(0, (product.price || 0) - (product.cost || 0))
            const marginPercent = product.price
              ? Math.round((marginAmount / product.price) * 100)
              : 0
            const confirming = confirmDeleteId === product.id
            return (
              <article className="product-admin-card" key={product.id}>
                <img src={product.img} alt={product.name} />
                <div className="product-admin-copy">
                  <b>{product.name}</b>
                  <small>
                    {product.cat} · {product.unit || 'pcs'} · stok {stockText(product)}
                  </small>
                  <small>Modal {money(product.cost || 0)}</small>
                  <small className="margin-line">
                    Untung {money(marginAmount)} / {marginPercent}%
                  </small>
                </div>
                <div className="product-admin-price">
                  <small>Harga jual</small>
                  <b>{money(product.price)}</b>
                  <div className="product-admin-actions">
                    <button className="edit-product-btn" onClick={() => openForm(product.id)}>
                      Ubah
                    </button>
                    <button
                      className={'delete-product-btn' + (confirming ? ' confirming' : '')}
                      onClick={() => deleteProduct(product.id)}
                    >
                      <Icon name="trash" />
                      {confirming ? 'Ya, hapus' : 'Hapus'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <AdminNav />
      <CsvImportSheet open={csvOpen} onClose={() => setCsvOpen(false)} />
    </div>
  )
}

/* ---------- Impor CSV (pengganti #importCsvModal) ---------- */

function CsvImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const products = useProductsStore((s) => s.products)
  const importFromCsv = useProductsStore((s) => s.importFromCsv)
  const fileRef = useRef<HTMLInputElement>(null)

  const [parsed, setParsed] = useState<{
    items: CsvProductItem[]
    skipped: { row: number; reason: string }[]
  } | null>(null)
  const [status, setStatus] = useState('')
  const [statusError, setStatusError] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setParsed(null)
      setStatus('')
      setStatusError(false)
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [open])

  const onFile = (file: File | undefined) => {
    setStatus('')
    setStatusError(false)
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const mapped = mapCsvRows(parseCsvText(reader.result))
        if (!mapped.items.length && !mapped.skipped.length) {
          toast('File kosong atau tidak terbaca')
          return
        }
        setParsed(mapped)
      } catch {
        toast('File CSV tidak dapat dibaca')
      }
    }
    reader.onerror = () => toast('File tidak dapat dibaca')
    reader.readAsText(file)
  }

  const byBarcode = useMemo(() => {
    const map = new Map<string, boolean>()
    products.forEach((p) => {
      const code = String(p.barcode || '').trim()
      if (code && !map.has(code)) map.set(code, true)
    })
    return map
  }, [products])

  const doImport = () => {
    if (!parsed || !parsed.items.length) return
    setBusy(true)
    setStatus('Mengimpor 0/' + parsed.items.length + '…')
    setStatusError(false)
    importFromCsv(parsed.items, (done, total) => {
      setStatus('Mengimpor ' + done + '/' + total + '…')
    })
      .then((res) => {
        setStatus(
          'Selesai: ' +
            res.created +
            ' produk baru, ' +
            res.updated +
            ' diperbarui dari ' +
            res.total +
            ' baris.',
        )
        setParsed(null)
        toast('Impor selesai · ' + res.created + ' baru, ' + res.updated + ' diperbarui')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string; importedSoFar?: number }
        const soFar =
          e && e.importedSoFar ? ' (' + e.importedSoFar + ' baris sudah masuk sebelum gagal)' : ''
        setStatusError(true)
        setStatus('Impor terhenti' + soFar + ' · ' + ((e && e.message) || 'gagal menyimpan'))
        if (!e || e.code !== 'OFFLINE') toast((e && e.message) || 'Impor gagal')
      })
      .finally(() => setBusy(false))
  }

  const willCreate = parsed ? parsed.items.filter((it) => !(it.barcode && byBarcode.has(it.barcode))).length : 0
  const willUpdate = parsed ? parsed.items.length - willCreate : 0

  return (
    <Sheet open={open} onClose={onClose} sheetClassName="sheet feature-sheet">
      <SheetHeader kicker="Tetap di menu Produk" title="Impor Produk dari CSV" onClose={onClose} />
      <div className="form-stack">
        <label className="file-control" htmlFor="csvFileInput">
          <Icon name="download" />
          <span>Pilih file CSV</span>
          <input
            id="csvFileInput"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <small className="photo-help">
          Kolom yang dibaca: Kode, Nama, Kategori, Satuan, Stok, Modal, Harga. Baris tanpa nama
          dilewati. Kode yang sudah ada di database akan diperbarui dengan data dari file.
        </small>
        {parsed ? (
          <div className="csv-preview">
            <b>{parsed.items.length} produk siap diimpor</b>
            <br />
            {willCreate} baru · {willUpdate} akan diperbarui
            {parsed.skipped.length ? ' · ' + parsed.skipped.length + ' dilewati' : ''}
            <ul>
              {parsed.items.slice(0, 5).map((it, i) => (
                <li key={i}>
                  {it.name} · {groupedNumber(it.price)}
                  {it.barcode && byBarcode.has(it.barcode) ? ' (perbarui)' : ' (baru)'}
                </li>
              ))}
              {parsed.skipped.slice(0, 5).map((s, i) => (
                <li className="csv-skip" key={'s' + i}>
                  Baris {s.row}: {s.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {status ? (
          <p
            className={'session-transfer-status' + (statusError ? ' error' : '')}
            role="status"
            aria-live="polite"
          >
            {status}
          </p>
        ) : null}
      </div>
      <button className="primary-wide" disabled={!parsed?.items.length || busy} onClick={doImport}>
        {busy ? 'Mengimpor…' : 'Impor sekarang'}
      </button>
    </Sheet>
  )
}

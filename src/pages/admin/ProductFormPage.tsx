/**
 * KasirQuh React — src/pages/admin/ProductFormPage.tsx
 * Pengganti ProductFormSheet (dulu #productFormModal + openProductForm() +
 * updateProductMarginPreview() + setProductPhoto() + resizeProductPhoto()
 * di js/features/admin/products.js): halaman penuh, bukan modal.
 *
 * Route /admin/produk/baru → tambah produk; /admin/produk/:id/edit → ubah produk.
 * Logika form/simpan sama persis; setelah simpan kembali ke halaman sebelumnya.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from '../../components/ui'
import { useProductsStore, IMG_EMPTY } from '../../stores/products'
import {
  money,
  numericValue,
  groupedNumber,
  isDecimalUnit,
  parseDecimalInput,
} from '../../lib/format'

const CATEGORIES = ['Sembako', 'Minuman', 'Snack', 'Rokok', 'Rumah Tangga', 'Lainnya']

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Pilih file gambar dari HP'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Foto maksimal 5 MB'))
      return
    }
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      const maxSide = 300
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      }
      const dataUrl = canvas.toDataURL('image/png')
      URL.revokeObjectURL(objectUrl)
      resolve(dataUrl)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Foto tidak dapat dibaca'))
    }
    image.src = objectUrl
  })
}

export default function ProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const productId = id || null

  const products = useProductsStore((s) => s.products)
  const productsLoading = useProductsStore((s) => s.loading)
  const saveProduct = useProductsStore((s) => s.save)
  const product = productId ? products.find((p) => p.id === productId) : undefined

  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [cat, setCat] = useState('Sembako')
  const [unit, setUnit] = useState('pcs')
  const [stockTextVal, setStockTextVal] = useState('')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [photo, setPhoto] = useState('')
  const [wholesaleQty, setWholesaleQty] = useState('')
  const [wholesalePrice, setWholesalePrice] = useState('')
  const [wholesaleLabel, setWholesaleLabel] = useState('')
  const [budgetOn, setBudgetOn] = useState(false)
  const [budgetMaxQty, setBudgetMaxQty] = useState('4')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  /* Pengaman form (pola yang sama di semua form pengaturan): pada mode
   * ubah, field yang belum disentuh user mengikuti snapshot produk terbaru;
   * selama katalog masih dimuat (productsLoading) form TIDAK diisi kosong —
   * dulu form kosong karena produk belum termuat bisa tersimpan menimpa
   * produk live. Mode tambah memang mulai kosong (dokumen baru). */
  const dirtyRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    dirtyRef.current = new Set()
  }, [productId])

  useEffect(() => {
    if (!isEdit || productsLoading || !product) return
    const d = dirtyRef.current
    const newUnit = product.unit || 'pcs'
    const decimal = isDecimalUnit(newUnit)
    if (!d.has('name')) setName((v) => (v === product.name ? v : product.name))
    if (!d.has('barcode')) {
      const n = product.barcode || ''
      setBarcode((v) => (v === n ? v : n))
    }
    if (!d.has('cat')) setCat((v) => (v === product.cat ? v : product.cat))
    if (!d.has('unit')) setUnit((v) => (v === newUnit ? v : newUnit))
    if (!d.has('stock')) {
      const n = decimal
        ? Number(product.stock || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })
        : groupedNumber(product.stock)
      setStockTextVal((v) => (v === n ? v : n))
    }
    if (!d.has('cost')) {
      const n = groupedNumber(product.cost)
      setCost((v) => (v === n ? v : n))
    }
    if (!d.has('price')) {
      const n = groupedNumber(product.price)
      setPrice((v) => (v === n ? v : n))
    }
    if (!d.has('photo')) setPhoto((v) => (v === product.img ? v : product.img))
    if (!d.has('wholesaleQty')) {
      const n = product.wholesaleQty ? String(product.wholesaleQty) : ''
      setWholesaleQty((v) => (v === n ? v : n))
    }
    if (!d.has('wholesalePrice')) {
      const n = product.wholesalePrice ? groupedNumber(product.wholesalePrice) : ''
      setWholesalePrice((v) => (v === n ? v : n))
    }
    if (!d.has('wholesaleLabel')) {
      const n = product.wholesaleLabel || ''
      setWholesaleLabel((v) => (v === n ? v : n))
    }
    if (!d.has('budgetOn')) {
      const n = !!product.budgetEligible
      setBudgetOn((v) => (v === n ? v : n))
    }
    if (!d.has('budgetMaxQty')) {
      const n = String(product.budgetMaxQty || 4)
      setBudgetMaxQty((v) => (v === n ? v : n))
    }
  }, [isEdit, productsLoading, product])

  const marginAmount = Math.max(0, numericValue(price) - numericValue(cost))
  const marginPercent = numericValue(price)
    ? Math.round((marginAmount / numericValue(price)) * 100)
    : 0

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await resizeImageFile(file)
      dirtyRef.current.add('photo')
      setPhoto(dataUrl)
      toast('Foto produk PNG siap')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Foto tidak dapat dibaca')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = () => {
    if (isEdit && productsLoading) {
      toast('Data produk masih dimuat — tunggu sebentar, lalu coba lagi')
      return
    }
    if (isEdit && !product) {
      toast('Produk tidak ditemukan')
      return
    }
    if (isEdit && dirtyRef.current.size === 0) {
      /* Simpan tanpa perubahan: tidak menulis apa pun ke Firestore. */
      navigate(-1)
      toast('Tidak ada perubahan')
      return
    }
    const cleanName = name.replace(/[<>]/g, '').trim()
    const stock = isDecimalUnit(unit)
      ? Math.max(0, parseDecimalInput(stockTextVal))
      : Math.max(0, numericValue(stockTextVal))
    const costNum = numericValue(cost)
    const priceNum = numericValue(price)
    if (!cleanName || !costNum || !priceNum) {
      toast('Lengkapi nama, harga modal, dan harga jual')
      return
    }
    if (priceNum < costNum) {
      toast('Harga jual masih di bawah harga modal')
      return
    }
    if (!productId && !photo) {
      toast('Pilih foto produk baru')
      return
    }
    setSaving(true)
    saveProduct(
      {
        name: cleanName,
        cat,
        unit,
        stock,
        cost: costNum,
        price: priceNum,
        img: photo || (product ? product.img : ''),
        barcode: barcode.trim(),
        budgetEligible: budgetOn,
        budgetMaxQty: Math.min(20, Math.max(1, Number(budgetMaxQty) || 4)),
        wholesaleQty: Math.max(0, Math.round(Number(wholesaleQty) || 0)),
        wholesalePrice: numericValue(wholesalePrice),
        wholesaleLabel: wholesaleLabel.trim(),
      },
      productId || undefined,
    )
      .then(() => {
        navigate(-1)
        toast(
          productId
            ? 'Produk diperbarui · katalog pelanggan ikut berubah'
            : 'Produk baru ditambahkan',
        )
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Penyimpanan gagal')
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="admin-screen">
      <div id="productFormView" className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Tetap di menu Produk</small>
            <h2>{isEdit ? 'Ubah Produk' : 'Tambah Produk Baru'}</h2>
          </span>
        </div>
        <div className="product-photo-block">
          <label>Foto Produk</label>
          <div className="product-photo-field">
            <img
              className="product-photo-preview"
              src={photo || IMG_EMPTY}
              alt={product ? 'Foto ' + product.name : 'Pratinjau foto produk baru'}
            />
            <div className="product-photo-actions">
              <label className="file-control" htmlFor="productImageInput">
                <span>Pilih dari HP</span>
                <input
                  id="productImageInput"
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => pickPhoto(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>
          <small className="photo-help" />
        </div>
        <div className="form-stack">
          <label htmlFor="productNameInput">Nama produk</label>
          <input
            id="productNameInput"
            value={name}
            onChange={(e) => {
              dirtyRef.current.add('name')
              setName(e.target.value)
            }}
          />
          <label htmlFor="productBarcodeInput">Kode/Barcode</label>
          <div className="barcode-input-row">
            <input
              id="productBarcodeInput"
              placeholder="Opsional · untuk pindai barcode"
              value={barcode}
              onChange={(e) => {
                dirtyRef.current.add('barcode')
                setBarcode(e.target.value)
              }}
            />
          </div>
          <label htmlFor="productCategoryInput">Kategori</label>
          <select
            id="productCategoryInput"
            value={cat}
            onChange={(e) => {
              dirtyRef.current.add('cat')
              setCat(e.target.value)
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label htmlFor="productUnitInput">Satuan</label>
          <select
            id="productUnitInput"
            value={unit}
            onChange={(e) => {
              dirtyRef.current.add('unit')
              setUnit(e.target.value)
            }}
          >
            <option value="pcs">pcs</option>
            <option value="kg">kg</option>
            <option value="dus">dus</option>
          </select>
          <label htmlFor="productStockInput">Jumlah stok</label>
          <input
            id="productStockInput"
            type="text"
            inputMode="numeric"
            value={stockTextVal}
            onChange={(e) => {
              dirtyRef.current.add('stock')
              setStockTextVal(e.target.value)
            }}
          />
          <label htmlFor="productCostInput">Harga modal / beli supplier</label>
          <input
            id="productCostInput"
            inputMode="numeric"
            value={cost}
            onChange={(e) => {
              dirtyRef.current.add('cost')
              setCost(e.target.value)
            }}
          />
          <label htmlFor="productPriceInput">Harga jual ke pelanggan</label>
          <input
            id="productPriceInput"
            inputMode="numeric"
            value={price}
            onChange={(e) => {
              dirtyRef.current.add('price')
              setPrice(e.target.value)
            }}
          />
          <div className="settings-group" style={{ marginTop: 12 }}>
            <label>Harga Grosir (opsional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label htmlFor="productWholesaleQty" style={{ fontSize: 12 }}>
                  Min. qty
                </label>
                <input
                  id="productWholesaleQty"
                  type="number"
                  min={0}
                  placeholder="cth: 10"
                  value={wholesaleQty}
                  onChange={(e) => {
                    dirtyRef.current.add('wholesaleQty')
                    setWholesaleQty(e.target.value)
                  }}
                />
              </div>
              <div>
                <label htmlFor="productWholesalePrice" style={{ fontSize: 12 }}>
                  Harga/item (Rp)
                </label>
                <input
                  id="productWholesalePrice"
                  inputMode="numeric"
                  placeholder="cth: 8000"
                  value={wholesalePrice}
                  onChange={(e) => {
                    dirtyRef.current.add('wholesalePrice')
                    setWholesalePrice(e.target.value)
                  }}
                />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label htmlFor="productWholesaleLabel" style={{ fontSize: 12 }}>
                Label (opsional)
              </label>
              <input
                id="productWholesaleLabel"
                placeholder="cth: Beli 1 dus"
                value={wholesaleLabel}
                onChange={(e) => {
                  dirtyRef.current.add('wholesaleLabel')
                  setWholesaleLabel(e.target.value)
                }}
              />
            </div>
            <small style={{ color: 'var(--muted)', fontSize: 11 }}>
              Kosongkan jika tidak ada harga grosir.
            </small>
          </div>
          <div className="toggle-setting-row" style={{ marginTop: 10 }}>
            <span>
              <b>Masuk Mode Anggaran</b>
              <small>Produk bisa dipilih di Mode Anggaran pelanggan</small>
            </span>
            <button
              type="button"
              className={'toggle-btn' + (budgetOn ? ' on' : '')}
              aria-pressed={budgetOn}
              onClick={() => {
                dirtyRef.current.add('budgetOn')
                setBudgetOn((v) => !v)
              }}
            >
              {budgetOn ? 'NYALA' : 'MATI'}
            </button>
          </div>
          {budgetOn ? (
            <div className="form-stack" style={{ marginTop: 8 }}>
              <label htmlFor="productBudgetMaxQty">Maks qty di Mode Anggaran</label>
              <input
                id="productBudgetMaxQty"
                type="number"
                min={1}
                max={20}
                value={budgetMaxQty}
                onChange={(e) => {
                  dirtyRef.current.add('budgetMaxQty')
                  setBudgetMaxQty(e.target.value)
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="margin-preview">
          <span>Perkiraan margin</span>
          <b>
            Untung {money(marginAmount)} / {marginPercent}%
          </b>
        </div>
        <button
          className="primary-wide"
          disabled={saving || (isEdit && (productsLoading || !product))}
          onClick={save}
        >
          {saving ? 'Menyimpan…' : 'Simpan Produk'}
        </button>
      </div>
    </div>
  )
}

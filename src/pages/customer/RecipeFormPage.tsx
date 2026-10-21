import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../../stores/products'
import { useAuthStore } from '../../stores/auth'
import { money, groupedNumber, parseDecimalInput } from '../../lib/format'
import { Icon, toast } from '../../components/ui'
import { useSessionLocal, useRecipesLocal, compressPhoto } from '../../features/customer/local'
import type { RecipeItem } from '../../types'

interface Row {
  key: number
  productId: string
  qty: number
}

let rowSeq = 1

export default function RecipeFormPage() {
  const navigate = useNavigate()
  const products = useProductsStore((s) => s.products)
  const isGuest = useSessionLocal((s) => s.isGuest)
  const addMyRecipe = useRecipesLocal((s) => s.addMyRecipe)
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState('')
  const [rows, setRows] = useState<Row[]>([{ key: rowSeq++, productId: products[0]?.id || '', qty: 1 }])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const items: RecipeItem[] = useMemo(
    () => rows.map((r) => ({ productId: r.productId, qty: Math.max(1, Math.round(r.qty) || 1) })),
    [rows],
  )
  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const p = products.find((x) => x.id === item.productId)
        return sum + (p ? p.price * item.qty : 0)
      }, 0),
    [items, products],
  )

  function addRow() {
    setRows((prev) => [...prev, { key: rowSeq++, productId: products[0]?.id || '', qty: 1 }])
  }

  function removeRow(key: number) {
    setRows((prev) => {
      if (prev.length === 1) {
        toast('Minimal satu bahan')
        return prev
      }
      return prev.filter((r) => r.key !== key)
    })
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setPhoto(await compressPhoto(file, 300, 'image/png'))
    } catch {
      toast('Gambar tidak bisa dibaca')
    }
  }

  function save() {
    if (isGuest) {
      useAuthStore.getState().openLoginSheet('recipe', 'Masuk dulu untuk buat Ide Masakku')
      return
    }
    const nama = name.trim()
    if (!nama || !items.length) {
      toast('Isi nama resep dan bahan')
      return
    }
    setBusy(true)
    setTimeout(() => {
      addMyRecipe({
        id: 'mine-' + Date.now(),
        nama,
        desc: 'Racikan pilihanku untuk dibagikan ke warga.',
        foto: photo,
        items,
      })
      setBusy(false)
      navigate(-1)
      toast('Resepku tampil di Ide Masak Warga')
    }, 300)
  }

  return (
    <div id="recipeFormCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Racikan pribadi</p>
          <h1>Buat Ide Masakku</h1>
        </div>
      </header>
      <main className="content">
        <div className="form-stack">
          <label htmlFor="myRecipeName">Nama resep</label>
          <input
            id="myRecipeName"
            maxLength={54}
            placeholder="Contoh: Bekal soreku"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="recipe-photo-block">
            <label>
              Foto Resep <span style={{ fontWeight: 600 }}>(opsional)</span>
            </label>
            <div className="product-photo-field">
              {photo ? <img id="myRecipePhotoPreview" className="recipe-photo-preview" src={photo} alt="Pratinjau foto resep" /> : null}
              <div className="product-photo-actions">
                <label className="file-control" htmlFor="myRecipePhotoInput">
                  <Icon name="image" />
                  <span>Pilih dari HP</span>
                  <input ref={fileRef} id="myRecipePhotoInput" type="file" accept="image/*" hidden onChange={onPhoto} />
                </label>
                <small className="photo-help">Disimpan sebagai PNG · maksimal 300 px · transparansi tetap terjaga.</small>
              </div>
            </div>
          </div>
          <label>Daftar bahan</label>
          <div id="myRecipeIngredients" className="ingredient-editor">
            {rows.map((row) => (
              <div key={row.key} className="ingredient-row">
                <select aria-label="Pilih produk" value={row.productId} onChange={(e) => updateRow(row.key, { productId: e.target.value })}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {money(p.price)}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Jumlah bahan"
                  value={groupedNumber(row.qty)}
                  onChange={(e) => updateRow(row.key, { qty: parseDecimalInput(e.target.value) })}
                />
                <button type="button" aria-label="Hapus bahan" onClick={() => removeRow(row.key)}>
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
          <button id="addMyIngredient" className="ingredient-add" onClick={addRow}>
            + Tambah baris bahan
          </button>
        </div>
        <div id="myRecipeSummary" className="recipe-form-summary">
          {items.length} bahan · perkiraan total {money(total)}
        </div>
        <button id="saveMyRecipe" className="primary-wide" disabled={busy} onClick={save}>
          Tambahkan ke Ide Masak
        </button>
      </main>
    </div>
  )
}

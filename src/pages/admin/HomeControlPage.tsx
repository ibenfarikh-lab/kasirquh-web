import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet, SheetHeader, Icon, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useProductsStore } from '../../stores/products'
import { useSettingsStore } from '../../stores/settings'
import {
  useLocalAdminStore,
  type HomeControlState,
  type RecipeAdmin,
} from '../../features/admin/localAdmin'
import { money, numericValue, groupedNumber } from '../../lib/format'
import type { RecipeItem } from '../../types'

const CAROUSEL_SLOTS = [
  { key: 'flash', label: 'Promo Kilat', defTitle: 'Promo Kilat', defCopy: 'Diskon spesial tiap hari, stok terbatas!', defBadge: 'KILAT' },
  { key: 'coin', label: 'Koin Warga', defTitle: 'Koin Warga', defCopy: 'Kumpulkan koin tiap belanja, tukarkan dengan potongan harga!', defBadge: 'KOIN' },
  { key: 'recipe', label: 'Ide Masak Warga', defTitle: 'Ide Masak Warga', defCopy: 'Inspirasi masak dari warga, langsung masukkan bahan ke keranjang!', defBadge: 'RESEP' },
  { key: 'budget', label: 'Mode Anggaran', defTitle: 'Mode Anggaran', defCopy: 'Belanja hemat sesuai budget harianmu!', defBadge: 'HEMAT' },
  { key: 'hajatan', label: 'Paket Hajatan', defTitle: 'Paket Hajatan', defCopy: 'Paket lengkap untuk acara dan hajatan!', defBadge: 'PAKET' },
]

type Form = Omit<HomeControlState, 'homeSections' | 'carouselSlots'> & {
  sections: Record<'restock' | 'popular' | 'recipe', { show: boolean; order: number }>
  slots: Record<string, string>
}

function toForm(hc: HomeControlState): Form {
  return {
    runningText: hc.runningText,
    gatewayTitle1: hc.gatewayTitle1,
    gatewayCopy1: hc.gatewayCopy1,
    gatewayTitle2: hc.gatewayTitle2,
    gatewayCopy2: hc.gatewayCopy2,
    gatewayTitle3: hc.gatewayTitle3,
    gatewayCopy3: hc.gatewayCopy3,
    flashProductId: hc.flashProductId,
    flashPrice: hc.flashPrice,
    flashRule: hc.flashRule,
    kabarStatus: hc.kabarStatus,
    kabarMood: hc.kabarMood,
    sections: {
      restock: { ...hc.homeSections.restock },
      popular: { ...hc.homeSections.popular },
      recipe: { ...hc.homeSections.recipe },
    },
    slots: { ...hc.carouselSlots },
  }
}

export default function HomeControlPage() {
  useAdminBoot()
  const navigate = useNavigate()
  const products = useProductsStore((s) => s.products)
  const homeControl = useLocalAdminStore((s) => s.homeControl)
  const saveStoreSettings = useLocalAdminStore((s) => s.saveStoreSettings)
  const recipes = useLocalAdminStore((s) => s.recipes)
  const deleteRecipe = useLocalAdminStore((s) => s.deleteRecipe)
  const settingsLoaded = useSettingsStore((s) => s.settingsLoaded)

  const [form, setForm] = useState<Form>(() => toForm(homeControl))
  const [saving, setSaving] = useState(false)
  const [recipeFormId, setRecipeFormId] = useState<string | null>(null)
  const [recipeFormOpen, setRecipeFormOpen] = useState(false)

  const dirtyRef = useRef<Set<keyof Form>>(new Set())
  useEffect(() => {
    if (!settingsLoaded) return
    const next = toForm(homeControl)
    setForm((prev) => {
      const merged = { ...next }
      dirtyRef.current.forEach((k) => {
        ;(merged as Record<string, unknown>)[k] = prev[k]
      })
      return JSON.stringify(merged) === JSON.stringify(prev) ? prev : merged
    })
  }, [homeControl, settingsLoaded])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    dirtyRef.current.add(k)
    setForm((f) => ({ ...f, [k]: v }))
  }

  const toggleSection = (k: 'restock' | 'popular' | 'recipe') => {
    dirtyRef.current.add('sections')
    setForm((f) => ({
      ...f,
      sections: { ...f.sections, [k]: { ...f.sections[k], show: !f.sections[k].show } },
    }))
  }

  const orderSection = (k: 'restock' | 'popular' | 'recipe', order: number) => {
    dirtyRef.current.add('sections')
    setForm((f) => ({
      ...f,
      sections: { ...f.sections, [k]: { ...f.sections[k], order: Math.max(1, order) } },
    }))
  }

  const apply = () => {
    if (!settingsLoaded) {
      toast('Pengaturan masih dimuat — tunggu sebentar, lalu coba lagi')
      return
    }
    if (dirtyRef.current.size === 0) {
      navigate(-1)
      toast('Tidak ada perubahan')
      return
    }
    const flashProduct = products.find((p) => p.id === form.flashProductId)
    setSaving(true)
    saveStoreSettings({
      runningText: form.runningText.replace(/[<>]/g, '').trim(),
      gatewayTitle1: form.gatewayTitle1.replace(/[<>]/g, '').trim(),
      gatewayCopy1: form.gatewayCopy1.replace(/[<>]/g, '').trim(),
      gatewayTitle2: form.gatewayTitle2.replace(/[<>]/g, '').trim(),
      gatewayCopy2: form.gatewayCopy2.replace(/[<>]/g, '').trim(),
      gatewayTitle3: form.gatewayTitle3.replace(/[<>]/g, '').trim(),
      gatewayCopy3: form.gatewayCopy3.replace(/[<>]/g, '').trim(),
      flashProductId: form.flashProductId || null,
      flashProductName: flashProduct ? flashProduct.name : '',
      flashPrice: numericValue(String(form.flashPrice)),
      flashRule: form.flashRule.replace(/[<>]/g, '').trim(),
      kabarStatus: form.kabarStatus.replace(/[<>]/g, '').trim(),
      kabarMood: form.kabarMood.replace(/[<>]/g, '').trim(),
      homeSections: form.sections,
      carouselSlots: form.slots,
    })
      .then(() => {
        navigate(-1)
        toast('Beranda pelanggan disimpan')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal menyimpan')
      })
      .finally(() => setSaving(false))
  }

  const openRecipeForm = (id: string | null) => {
    if (!id && recipes.length >= 5) {
      toast('Maksimal 5 resep Ide Masak')
      return
    }
    setRecipeFormId(id)
    setRecipeFormOpen(true)
  }

  const removeRecipe = (r: RecipeAdmin) => {
    deleteRecipe(r.id)
      .then(() => toast('Resep dihapus dari Beranda pelanggan'))
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Hapus resep gagal')
      })
  }

  const sectionRows: { key: 'restock' | 'popular' | 'recipe'; title: string; desc: string }[] = [
    { key: 'restock', title: 'Stok Rumah Habis', desc: 'Otomatis dari riwayat belanja pelanggan' },
    { key: 'popular', title: 'Sedang Laris', desc: '8 teratas dari transaksi seluruh pelanggan' },
    { key: 'recipe', title: 'Ide Masak Warga', desc: 'Kelola resep dan daftar bahan yang tampil' },
  ]

  return (
    <div className="admin-screen">
      <div id="homeControlView" className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Toko</small>
            <h2>Pusat Kendali Beranda</h2>
          </span>
        </div>
      <div className="control-intro">
        <Icon name="home" />
        <div>
          <b>Kendali Beranda pelanggan</b>
          <small>Ubah lalu tekan Terapkan ke Beranda.</small>
        </div>
      </div>

      <div className="control-block control-card">
        <div className="control-card-head">
          <span className="control-num">01</span>
          <h3>
            <Icon name="bell" /> Promo, info &amp; kabar
          </h3>
        </div>
        <div className="control-grid">
          <label className="control-field full">
            Info toko &amp; teks berjalan
            <input value={form.runningText} onChange={(e) => set('runningText', e.target.value)} />
          </label>
          <div className="gateway-slide-fields">
            <h4>Slide 1 · Promo utama</h4>
            <label>
              Headline
              <input
                value={form.gatewayTitle1}
                maxLength={64}
                onChange={(e) => set('gatewayTitle1', e.target.value)}
              />
            </label>
            <label>
              Subheadline
              <input
                value={form.gatewayCopy1}
                maxLength={110}
                onChange={(e) => set('gatewayCopy1', e.target.value)}
              />
            </label>
          </div>
          <div className="gateway-slide-fields">
            <h4>Slide 2 · Sembako</h4>
            <label>
              Headline
              <input
                value={form.gatewayTitle2}
                maxLength={64}
                onChange={(e) => set('gatewayTitle2', e.target.value)}
              />
            </label>
            <label>
              Subheadline
              <input
                value={form.gatewayCopy2}
                maxLength={110}
                onChange={(e) => set('gatewayCopy2', e.target.value)}
              />
            </label>
          </div>
          <div className="gateway-slide-fields">
            <h4>Slide 3 · Jajan &amp; minuman</h4>
            <label>
              Headline
              <input
                value={form.gatewayTitle3}
                maxLength={64}
                onChange={(e) => set('gatewayTitle3', e.target.value)}
              />
            </label>
            <label>
              Subheadline
              <input
                value={form.gatewayCopy3}
                maxLength={110}
                onChange={(e) => set('gatewayCopy3', e.target.value)}
              />
            </label>
          </div>
          <div className="control-subhead">
            <h4>Promo Kilat</h4>
          </div>
          <label className="control-field">
            Produk promo kilat
            <select
              value={form.flashProductId || ''}
              onChange={(e) => set('flashProductId', e.target.value || null)}
            >
              <option value="">— Tidak ada —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="control-field">
            Harga kilat
            <input
              inputMode="numeric"
              value={groupedNumber(form.flashPrice)}
              onChange={(e) => set('flashPrice', numericValue(e.target.value))}
            />
          </label>
          <label className="control-field full">
            Batas &amp; pesan promo kilat
            <input value={form.flashRule} onChange={(e) => set('flashRule', e.target.value)} />
          </label>
          <div className="control-subhead">
            <h4>Kabar Warung</h4>
          </div>
          <label className="control-field full">
            Kabar status
            <input value={form.kabarStatus} onChange={(e) => set('kabarStatus', e.target.value)} />
          </label>
          <label className="control-field full">
            Kabar suasana
            <input value={form.kabarMood} onChange={(e) => set('kabarMood', e.target.value)} />
          </label>
        </div>
      </div>

      <div className="control-block control-card">
        <div className="control-card-head">
          <span className="control-num">02</span>
          <h3>
            <Icon name="home" /> Bagian Beranda
          </h3>
        </div>
        {sectionRows.slice(0, 2).map((row) => (
          <div className="switch-row section-order" key={row.key}>
            <span>
              <b>{row.title}</b>
              <small>{row.desc}</small>
            </span>
            <span>
              <button
                className="toggle-btn home-section-toggle"
                aria-pressed={form.sections[row.key].show}
                onClick={() => toggleSection(row.key)}
              >
                {form.sections[row.key].show ? 'TAMPIL' : 'SEMBUNYI'}
              </button>
              <select
                aria-label={'Urutan ' + row.title}
                value={form.sections[row.key].order}
                onChange={(e) => orderSection(row.key, Number(e.target.value))}
              >
                <option value={1}>Urut 1</option>
                <option value={2}>Urut 2</option>
                <option value={3}>Urut 3</option>
              </select>
            </span>
          </div>
        ))}
      </div>

      <div className="control-block control-card">
        <div className="control-card-head">
          <span className="control-num">03</span>
          <h3>
            <Icon name="spark" /> Carousel Beranda (5 slot tetap)
          </h3>
        </div>
        <p className="control-note">Ubah judul, isi, dan badge tiap slide. Shortcut terkunci.</p>
        <div className="control-recipe-list" style={{ marginTop: 10 }}>
          {CAROUSEL_SLOTS.map((s, i) => (
            <article className="control-recipe-item carousel-slot-editor" key={s.key}>
              <span className="slot-num">{i + 1}</span>
              <div className="slot-fields">
                <label>
                  Judul
                  <input
                    value={form.slots[s.key + 'Title'] ?? s.defTitle}
                    maxLength={64}
                    onChange={(e) => {
                      dirtyRef.current.add('slots')
                      setForm((f) => ({
                        ...f,
                        slots: { ...f.slots, [s.key + 'Title']: e.target.value },
                      }))
                    }}
                  />
                </label>
                <label>
                  Isi
                  <input
                    value={form.slots[s.key + 'Copy'] ?? s.defCopy}
                    maxLength={110}
                    onChange={(e) => {
                      dirtyRef.current.add('slots')
                      setForm((f) => ({
                        ...f,
                        slots: { ...f.slots, [s.key + 'Copy']: e.target.value },
                      }))
                    }}
                  />
                </label>
                <label>
                  Badge
                  <input
                    value={form.slots[s.key + 'Badge'] ?? s.defBadge}
                    maxLength={12}
                    onChange={(e) => {
                      dirtyRef.current.add('slots')
                      setForm((f) => ({
                        ...f,
                        slots: { ...f.slots, [s.key + 'Badge']: e.target.value },
                      }))
                    }}
                  />
                </label>
                <small className="slot-action">→ {s.label}</small>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="control-block control-card">
        <div className="control-card-head">
          <span className="control-num">04</span>
          <h3>
            <Icon name="book" /> Ide Masak
          </h3>
        </div>
        <div className="switch-row section-order">
          <span>
            <b>Ide Masak Warga</b>
            <small>Kelola resep dan daftar bahan yang tampil</small>
          </span>
          <span>
            <button
              className="toggle-btn home-section-toggle"
              aria-pressed={form.sections.recipe.show}
              onClick={() => toggleSection('recipe')}
            >
              {form.sections.recipe.show ? 'TAMPIL' : 'SEMBUNYI'}
            </button>
            <select
              aria-label="Urutan Ide Masak"
              value={form.sections.recipe.order}
              onChange={(e) => orderSection('recipe', Number(e.target.value))}
            >
              <option value={1}>Urut 1</option>
              <option value={2}>Urut 2</option>
              <option value={3}>Urut 3</option>
            </select>
          </span>
        </div>
        <div className="control-recipe-list">
          {recipes.length ? (
            recipes.map((r) => {
              const total = r.items.reduce((s, it) => {
                const p = products.find((x) => x.id === it.productId)
                return s + (p ? p.price * it.qty : 0)
              }, 0)
              return (
                <article className="control-recipe-item" key={r.id}>
                  {r.foto ? (
                    <img src={r.foto} alt={'Foto resep ' + r.nama} />
                  ) : (
                    <span className="recipe-photo-empty" aria-label="Tanpa foto">
                      <Icon name="image" />
                    </span>
                  )}
                  <span>
                    <b>{r.nama}</b>
                    <small>
                      {r.items.length} bahan · {money(total)}
                    </small>
                  </span>
                  <span className="control-recipe-actions">
                    <button aria-label={'Ubah ' + r.nama} onClick={() => openRecipeForm(r.id)}>
                      <Icon name="edit" />
                    </button>
                    <button aria-label={'Hapus ' + r.nama} onClick={() => removeRecipe(r)}>
                      <Icon name="trash" />
                    </button>
                  </span>
                </article>
              )
            })
          ) : (
            <div className="notification-empty">Belum ada resep warga.</div>
          )}
        </div>
        <div className="recipe-limit">
          <span>{recipes.length} dari maksimal 5 resep</span>
          <button onClick={() => openRecipeForm(null)} disabled={recipes.length >= 5}>
            + Tambah resep
          </button>
        </div>
      </div>

      <button className="primary-wide" disabled={saving || !settingsLoaded} onClick={apply}>
        {saving ? 'Menyimpan…' : 'Terapkan ke Beranda'}
      </button>

      <RecipeFormSheet
        open={recipeFormOpen}
        recipeId={recipeFormId}
        onClose={() => setRecipeFormOpen(false)}
      />
        <AdminNav />
      </div>
    </div>
  )
}


function RecipeFormSheet({
  open,
  recipeId,
  onClose,
}: {
  open: boolean
  recipeId: string | null
  onClose: () => void
}) {
  const products = useProductsStore((s) => s.products)
  const recipes = useLocalAdminStore((s) => s.recipes)
  const saveRecipe = useLocalAdminStore((s) => s.saveRecipe)
  const recipe = recipeId ? recipes.find((r) => r.id === recipeId) : undefined

  const [nama, setNama] = useState('')
  const [desc, setDesc] = useState('')
  const [foto, setFoto] = useState('')
  const [items, setItems] = useState<RecipeItem[]>([])
  const [pickId, setPickId] = useState('')
  const [pickQty, setPickQty] = useState('1')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setNama(recipe ? recipe.nama : '')
      setDesc(recipe ? recipe.desc : '')
      setFoto(recipe ? recipe.foto : '')
      setItems(recipe ? recipe.items.map((it) => ({ ...it })) : [])
      setPickId(products[0]?.id || '')
      setPickQty('1')
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipeId])

  const addItem = () => {
    if (!pickId) return
    if (items.some((it) => it.productId === pickId)) {
      toast('Produk sudah ada di paket')
      return
    }
    setItems((list) => [
      ...list,
      { productId: pickId, qty: Math.max(1, Math.round(Number(pickQty) || 1)) },
    ])
  }

  const pickPhoto = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Pilih file gambar dari HP')
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
      if (ctx) ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      setFoto(canvas.toDataURL('image/png'))
      URL.revokeObjectURL(objectUrl)
      toast('Foto resep siap')
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      if (fileRef.current) fileRef.current.value = ''
      toast('Foto tidak dapat dibaca')
    }
    image.src = objectUrl
  }

  const save = () => {
    const cleanNama = nama.replace(/[<>]/g, '').trim()
    const cleanDesc = desc.replace(/[<>]/g, '').trim()
    if (!cleanNama || !cleanDesc || !items.length) {
      toast('Lengkapi nama, deskripsi, dan bahan')
      return
    }
    if (!recipeId && recipes.length >= 5) {
      toast('Maksimal 5 resep Ide Masak')
      return
    }
    setSaving(true)
    saveRecipe({ nama: cleanNama, desc: cleanDesc, foto, items }, recipeId)
      .then(() => {
        onClose()
        toast(recipeId ? 'Resep diperbarui di Beranda pelanggan' : 'Resep ditambahkan ke Beranda pelanggan')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Simpan resep gagal')
      })
      .finally(() => setSaving(false))
  }

  return (
    <Sheet open={open} onClose={onClose} sheetClassName="sheet feature-sheet">
      <SheetHeader
        kicker="Ide Masak Warga"
        title={recipe ? 'Ubah Ide Masak' : 'Tambah Ide Masak'}
        onClose={onClose}
      />
      <div className="form-stack">
        <label>Nama resep</label>
        <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="cth: Nasi goreng spesial" />
        <label>Deskripsi</label>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="cth: Gurih dan cepat" />
        <label>Foto</label>
        <div className="product-photo-field">
          {foto ? <img src={foto} alt={'Foto resep ' + (nama || 'baru')} className="product-photo-preview" /> : null}
          <label className="file-control">
            <span>Pilih dari HP</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
          </label>
        </div>
        <label>Bahan ({items.length})</label>
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
            <div className="empty-note">Belum ada bahan. Tambahkan di bawah.</div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px', gap: 8 }}>
          <select value={pickId} onChange={(e) => setPickId(e.target.value)} aria-label="Pilih produk">
            {products
              .filter((p) => p.stock > 0)
              .sort((a, b) => a.name.localeCompare(b.name, 'id'))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {money(p.price)}
                </option>
              ))}
          </select>
          <input
            type="number"
            min={1}
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
        {saving ? 'Menyimpan…' : 'Simpan Resep'}
      </button>
    </Sheet>
  )
}

/**
 * KasirQuh React — src/pages/customer/CatalogPage.tsx
 * REFERENSI pola halaman: pengganti renderCustomer() + renderCatalogCats()
 * + openProduct() + updateDetailTotal() dari js/app.js.
 *
 * Pola yang WAJIB diikuti halaman lain:
 * - baca state dari zustand store (bukan global S)
 * - class CSS dipakai apa adanya dari app.css — JANGAN rename
 * - teks Indonesia dipertahankan verbatim
 * - Sheet untuk modal (bukan manipulasi DOM manual)
 * - Icon dari sprite via komponen <Icon/>
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import { useAlertsStore } from '../../stores/alerts'
import { useSettingsStore } from '../../stores/settings'
import { useAuthStore } from '../../stores/auth'
import { money, stockText, isWeightUnit } from '../../lib/format'
import { Icon, Sheet, EmptyNote, toast } from '../../components/ui'
import type { Product } from '../../types'

function categoryNames(products: Product[]): string[] {
  return [...new Set(products.map((p) => p.cat).filter(Boolean))]
}

export default function CatalogPage() {
  const navigate = useNavigate()
  const products = useProductsStore((s) => s.products)
  const loading = useProductsStore((s) => s.loading)
  const addCustomerItem = useCartStore((s) => s.addCustomerItem)
  const refreshProducts = useProductsStore((s) => s.refresh)

  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('Semua')
  const [detailId, setDetailId] = useState<string | null>(null)
  const flashProductId = useSettingsStore((s) => s.flashProductId)

  const flashProduct = flashProductId
    ? products.find((p) => p.id === flashProductId && p.isActive !== false)
    : undefined

  const cats = useMemo(() => categoryNames(products), [products])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .filter(
        (p) =>
          p.isActive !== false &&
          (cat === 'Semua' || p.cat === cat) &&
          p.name.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
  }, [products, query, cat])

  return (
    <div id="produkCustomerView" className="customer-view">
      <header className="customer-head top-safe">
        <div className="page-kicker">Katalog lengkap</div>
        <h1 className="catalog-title">Cari kebutuhan rumah</h1>
        <label className="search">
          <Icon name="search" />
          <input
            id="searchInput"
            placeholder="Cari sembako, minuman, snack..."
            aria-label="Cari produk"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>
      <main className="content">
        {flashProduct ? (
          <div id="catalogHero" className="kat-hero">
            <small>PROMO KILAT · TERBATAS</small>
            <h3>{flashProduct.name}</h3>
            <div className="kat-hero-price">
              {flashProduct.oldPrice ? <s>{money(flashProduct.oldPrice)}</s> : null}
              <b>{money(flashProduct.price)}</b>
            </div>
            <button className="kat-hero-cta" onClick={() => setDetailId(flashProduct.id)}>
              Lihat Detail
            </button>
          </div>
        ) : null}
        <div className="section-title">Kategori</div>
        <div id="catalogCats" className="kat-cat-grid">
          {['Semua', ...cats].map((c) => (
            <button
              key={c}
              className={`kat-chip${cat === c ? ' active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c === 'Semua' && cat === 'Semua' ? '✓ ' : ''}
              {c}
            </button>
          ))}
        </div>
        <div
          className="section-title"
          id="catalogSectionTitle"
          style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{cat === 'Semua' ? 'Semua produk' : cat}</span>
          <button className="refresh-btn" aria-label="Muat ulang produk" onClick={() => refreshProducts()}>
            ⟳ Muat ulang
          </button>
        </div>
        <div id="customerProducts" className="product-list kat-grid">
          {shown.map((p) => {
            const out = (p.stock || 0) <= 0
            return (
              <article
                key={p.id}
                className={`product-card${out ? ' out' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`Lihat detail ${p.name}`}
                onClick={() => setDetailId(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setDetailId(p.id)
                  }
                }}
              >
                {p.promo ? <span className="promo-flag">PROMO</span> : null}
                {out ? (
                  <span className="out-ribbon" aria-hidden="true">
                    HABIS
                  </span>
                ) : null}
                <img src={p.img} alt={p.name} loading="lazy" />
                <div>
                  <h3>{p.name}</h3>
                  <div className="price">{money(p.price)}</div>
                  <small style={{ color: 'var(--muted)' }}>Stok {stockText(p)}</small>
                </div>
                <button
                  className="add"
                  aria-label={`Tambah ${p.name} ke keranjang`}
                  disabled={out}
                  style={out ? { opacity: 0.4 } : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    addCustomerItem(p.id)
                  }}
                >
                  <Icon name="cart" />
                </button>
              </article>
            )
          })}
        </div>
        {!loading && shown.length === 0 ? (
          <div id="emptyCustomer" className="empty-note">
            Produk tidak ditemukan.
          </div>
        ) : null}
        {loading ? <EmptyNote>Memuat produk…</EmptyNote> : null}
      </main>

      <ProductDetailSheet
        productId={detailId}
        onClose={() => setDetailId(null)}
        onAsk={(p) => {
          setDetailId(null)
          // Chat adalah tab bergembok: tamu → sheet login, bukan halaman chat.
          if (useAuthStore.getState().session.isGuest) {
            useAuthStore.getState().openLoginSheet('chat', 'Masuk dulu untuk chat dengan warung')
            return
          }
          navigate('/beranda/chat', { state: { askAbout: p.name } })
        }}
      />
    </div>
  )
}

/* ---------- Sheet detail produk (pengganti #productModal + openProduct()) ---------- */
function ProductDetailSheet({
  productId,
  onClose,
  onAsk,
}: {
  productId: string | null
  onClose: () => void
  onAsk: (p: Product) => void
}) {
  const product = useProductsStore((s) =>
    productId ? s.products.find((p) => p.id === productId) : undefined,
  )
  const addCustomerItem = useCartStore((s) => s.addCustomerItem)
  const isWatching = useAlertsStore((s) => s.isWatching)
  const toggleAlert = useAlertsStore((s) => s.toggle)
  const [qty, setQty] = useState(1)

  // reset qty tiap ganti produk (pengganti S.detailQty)
  const [lastId, setLastId] = useState<string | null>(null)
  if (productId !== lastId) {
    setLastId(productId)
    setQty(product && isWeightUnit(product.unit) ? 0.5 : 1)
  }

  if (!product) return null
  const weight = isWeightUnit(product.unit)
  const q = weight ? Math.max(0.1, qty || 0.5) : Math.max(1, Math.round(qty || 1))
  const watching = isWatching(product.id)

  return (
    <Sheet open={productId !== null} onClose={onClose} sheetClassName="sheet feature-sheet det-sheet">
      <div className="det-hero">
        <button className="det-close" onClick={onClose} aria-label="Tutup">
          ×
        </button>
        <span id="detailPromo" className="det-pbadge" hidden={!product.promo}>
          PROMO
        </span>
        <img id="detailImg" src={product.img} alt={product.name} />
        <h2 id="detailName">{product.name}</h2>
        <div className="det-price">
          <s id="detailOldPrice">{product.oldPrice ? money(product.oldPrice) : ''}</s>
          <b id="detailPrice">{money(product.price)}</b>
        </div>
      </div>
      <div className="det-body">
        <div className="det-info-grid">
          <div className="det-info acc">
            <small>STOK</small>
            <b id="detailStockBig">{stockText(product)}</b>
          </div>
          <div className="det-info">
            <small>GROSIR</small>
            <b id="detailWholesaleMini">
              {product.wholesaleQty ? money(product.wholesalePrice) + '/item' : '-'}
            </b>
          </div>
          <div className="det-info">
            <small>KATEGORI</small>
            <b id="detailCat">{product.cat || '-'}</b>
          </div>
          <div className="det-info">
            <small>SATUAN</small>
            <b id="detailUnit">{product.unit || 'pcs'}</b>
          </div>
        </div>
        <div className="det-qty-row">
          <div className="det-step">
            <button
              id="detailMinus"
              aria-label="Kurangi"
              onClick={() => setQty((v) => (weight ? Math.max(0.1, +(v - 0.1).toFixed(1)) : Math.max(1, v - 1)))}
            >
              −
            </button>
            <b id="detailQty">
              {weight ? String(q).replace('.', ',') + ' ' + product.unit : q}
            </b>
            <button
              id="detailPlus"
              aria-label="Tambah"
              onClick={() =>
                setQty((v) => {
                  // Port vanilla: batasi jumlah maksimal sesuai stok.
                  const stock = Number(product.stock) || 0
                  if (weight) {
                    const max = Math.max(0.1, stock || 99)
                    const q = Math.min(max, +(v + 0.1).toFixed(1))
                    if (q === v) toast('Stok tersisa ' + String(max).replace('.', ',') + ' ' + product.unit, { type: 'warning' })
                    return q
                  }
                  const max2 = Math.max(1, Math.floor(stock) || 1)
                  const q2 = Math.min(max2, v + 1)
                  if (q2 === v) toast('Stok tersisa ' + max2, { type: 'warning' })
                  return q2
                })
              }
            >
              +
            </button>
          </div>
          <button
            id="detailAdd"
            className="det-add"
            onClick={() => {
              addCustomerItem(product.id, weight ? 1 : Math.round(q))
              onClose()
            }}
          >
            + Keranjang · <span id="detailTotal">{money(Math.round(product.price * q))}</span>
          </button>
        </div>
        <div className="det-actions">
          <button id="detailAsk" onClick={() => onAsk(product)}>
            Tanya Toko
          </button>
          <button
            id="detailAlert"
            onClick={() => {
              const now = toggleAlert({
                productId: product.id,
                name: product.name,
                priceAtWatch: product.price,
                watchedAt: new Date().toISOString(),
              })
              toast(now ? 'Harga dipantau' : 'Pantauan harga dilepas', { type: now ? 'success' : 'info' })
            }}
          >
            {watching ? 'Harga dipantau' : 'Pantau Harga'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

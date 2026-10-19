/**
 * KasirQuh React — src/pages/customer/HajatanPage.tsx
 * Pengganti HajatanSheet (#hajatanModal) — halaman penuh, bukan modal.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import { toast } from '../../components/ui'
import { useSettingsLocal } from '../../features/customer/local'
import type { CartMap } from '../../types'

function findProductByKeywords(keywords: string[]) {
  const list = keywords.map((k) => k.toLowerCase())
  return useProductsStore
    .getState()
    .products.find((p) => p.isActive !== false && p.stock > 0 && list.some((k) => p.name.toLowerCase().includes(k)))
}

export default function HajatanPage() {
  const navigate = useNavigate()
  const settings = useSettingsLocal((s) => s.settings)
  const addCustomerItem = useCartStore((s) => s.addCustomerItem)
  const packages = settings.hajatanPackages || []
  const [choice, setChoice] = useState<string>('snack')

  const activeChoice = packages.length ? packages[0].id : choice

  function applyHajatan() {
    const pkg = packages.find((p) => p.id === (packages.length ? activeChoice : undefined))
    if (pkg && pkg.items && pkg.items.length) {
      const products = useProductsStore.getState().products
      const bundle: CartMap = {}
      for (const it of pkg.items) {
        const p = products.find((x) => x.id === it.productId)
        if (!p || p.stock <= 0) {
          toast('Paket belum bisa disusun · ada produk yang belum tersedia')
          return
        }
        bundle[it.productId] = (bundle[it.productId] || 0) + Math.max(1, Math.round(Number(it.qty) || 1))
      }
      Object.entries(bundle).forEach(([id, q]) => addCustomerItem(id, q))
      toast('Paket hajatan masuk keranjang')
      navigate('/beranda/keranjang')
      return
    }
    // Fallback paket bawaan (port verbatim dari app.js)
    if (activeChoice === 'snack') {
      const cheapest = useProductsStore
        .getState()
        .products.filter((p) => p.cat === 'Snack' && p.stock > 0)
        .sort((a, b) => a.price - b.price)[0]
      if (!cheapest) {
        toast('Paket belum bisa disusun · ada produk yang belum tersedia')
        return
      }
      addCustomerItem(cheapest.id, 20)
      toast('Paket hajatan masuk keranjang')
      navigate('/beranda/keranjang')
      return
    }
    const specs = [
      { kw: ['mi', 'mie', 'indomie'], qty: 40 },
      { kw: ['minyak'], qty: 5 },
      { kw: ['minuman', 'aqua', 'air mineral', 'teh'], qty: 20 },
    ]
    const bundle: CartMap = {}
    for (const spec of specs) {
      const p = findProductByKeywords(spec.kw)
      if (!p) {
        toast('Paket belum bisa disusun · ada produk yang belum tersedia')
        return
      }
      bundle[p.id] = (bundle[p.id] || 0) + spec.qty
    }
    Object.entries(bundle).forEach(([id, q]) => addCustomerItem(id, q))
    toast('Paket hajatan masuk keranjang')
    navigate('/beranda/keranjang')
  }

  return (
    <div id="hajatanCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Belanja acara lebih tenang</p>
          <h1>Paket Hajatan</h1>
        </div>
      </header>
      <main className="content">
        <div className="plan-grid">
          {packages.length ? (
            packages.map((p, i) => (
              <button
                key={p.id}
                className={`plan-card hajatan-plan${(i === 0 && !packages.find((x) => x.id === choice)) || choice === p.id ? ' active' : ''}`}
                onClick={() => setChoice(p.id)}
              >
                <b>{p.name}</b>
                <small>{p.desc}</small>
                <strong>Ikut harga katalog</strong>
              </button>
            ))
          ) : (
            <>
              <button className={`plan-card hajatan-plan${activeChoice === 'snack' ? ' active' : ''}`} onClick={() => setChoice('snack')}>
                <b>Paket suguhan 20 tamu</b>
                <small>Snack &amp; minuman kemasan</small>
                <strong>Ikut harga katalog</strong>
              </button>
              <button className={`plan-card hajatan-plan${activeChoice === 'dapur' ? ' active' : ''}`} onClick={() => setChoice('dapur')}>
                <b>Paket dapur acara</b>
                <small>Mi, minyak, minuman</small>
                <strong>Ikut harga katalog</strong>
              </button>
            </>
          )}
        </div>
        <button id="hajatanBtn" className="primary-wide" onClick={applyHajatan}>
          Masukkan paket ke keranjang
        </button>
        <p className="service-note">Harga di keranjang dapat diperiksa dulu sebelum pesanan diteruskan.</p>
      </main>
    </div>
  )
}

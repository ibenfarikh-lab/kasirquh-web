/**
 * KasirQuh React — src/pages/customer/GrosirPage.tsx
 * Pengganti GrosirSheet (#grosirModal) — halaman penuh, bukan modal.
 */
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import { money } from '../../lib/format'
import { toast } from '../../components/ui'

export default function GrosirPage() {
  const navigate = useNavigate()
  const products = useProductsStore((s) => s.products)
  const rows = products.filter((p) => p.wholesaleQty > 0)

  function takeWholesale(id: string) {
    const p = useProductsStore.getState().products.find((x) => x.id === id)
    if (!p || !p.wholesaleQty) {
      toast('Harga grosir belum tersedia')
      return
    }
    // Port: S.customerCart[id] = max(sekarang, wholesaleQty)
    useCartStore.setState((s) => ({
      customerCart: { ...s.customerCart, [id]: Math.max(s.customerCart[id] || 0, p.wholesaleQty) },
    }))
    toast('Harga grosir aktif otomatis')
    navigate('/beranda/keranjang')
  }

  return (
    <div id="grosirCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Jumlah naik, harga turun</p>
          <h1>Grosir Otomatis</h1>
        </div>
      </header>
      <main className="content">
        <p className="service-note">Harga partai langsung aktif di keranjang, tanpa kode promo dan tanpa tanya admin.</p>
        <div className="service-list" id="wholesaleList">
          {rows.length ? (
            rows.map((p) => (
              <div key={p.id} className="service-row">
                <img src={p.img} alt={p.name} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                <div>
                  <h3>{p.name}</h3>
                  <p>{p.wholesaleLabel || 'Beli ' + p.wholesaleQty + ' pcs'}</p>
                </div>
                <button onClick={() => takeWholesale(p.id)}>{money((p.wholesalePrice || 0) * (p.wholesaleQty || 1))}</button>
              </div>
            ))
          ) : (
            <div className="empty-note">Belum ada harga grosir.</div>
          )}
        </div>
        <small className="service-note">Jumlah kurang dari satu dus tetap memakai harga satuan.</small>
      </main>
    </div>
  )
}

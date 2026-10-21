import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProductsStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import { money, isWeightUnit, stockText } from '../../lib/format'
import { toast } from '../../components/ui'
import type { CartMap, Product } from '../../types'
import { useSettingsLocal, cartTotals, cartStockIssue, customerUnitPrice } from '../../features/customer/local'

export default function CartPage() {
  const navigate = useNavigate()
  const products = useProductsStore((s) => s.products)
  const customerCart = useCartStore((s) => s.customerCart)
  const clearCustomerCart = useCartStore((s) => s.clearCustomerCart)
  const settings = useSettingsLocal((s) => s.settings)
  const [savedMenu, setSavedMenu] = useState<CartMap | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('delivery') === '1') {
      searchParams.delete('delivery')
      setSearchParams(searchParams, { replace: true })
      navigate('/beranda/checkout', { replace: true })
    }
  }, [searchParams, setSearchParams, navigate])

  const entries = Object.entries(customerCart).filter(
    ([id, q]) => q > 0 && products.some((p) => p.id === id),
  ) as [string, number][]

  const totals = cartTotals(customerCart, products, settings.promoUnitPrice)

  function clearCart() {
    if (!Object.keys(customerCart).length) {
      return
    }
    if (!window.confirm('Kosongkan semua isi keranjang?')) return
    clearCustomerCart()
  }

  function saveMenu() {
    if (!entries.length) {
      toast('Keranjang masih kosong')
      return
    }
    setSavedMenu({ ...customerCart })
    toast('Menu tersimpan selama sesi ini')
  }

  function loadMenu() {
    if (!savedMenu) {
      toast('Belum ada menu tersimpan')
      return
    }
    useCartStore.setState({ customerCart: { ...savedMenu } })
  }

  function openCheckout() {
    if (!Object.keys(customerCart).length) {
      toast('Pilih produk dulu, ya')
      return
    }
    const issue = cartStockIssue(customerCart, products)
    if (issue) {
      toast(
        'Stok ' + (issue.product ? issue.product.short : 'produk') + ' tidak cukup · tersedia ' +
          (issue.product ? stockText(issue.product) : 0) + ', diminta ' + issue.qty,
      )
      return
    }
    navigate('/beranda/checkout')
  }

  const savedCount = savedMenu ? Object.values(savedMenu).reduce((a, b) => a + b, 0) : 0

  return (
    <div id="keranjangCustomerView" className="customer-view">
      <header className="plain-head top-safe cart-head">
        <div>
          <p className="page-kicker">Belanjaanmu</p>
          <h1>Keranjang</h1>
        </div>
        <button id="clearCartBtn" className="clear-cart-btn" type="button" onClick={clearCart}>
          Kosongkan
        </button>
      </header>
      <main className="content cart-page">
        <div id="savedMenuArea">
          {savedMenu ? (
            <section className="saved-menu">
              <div>
                <b>Menu belanja rumah</b>
                <small>
                  {savedCount} barang · tersimpan selama sesi ini
                </small>
              </div>
              <button id="useSavedMenu" onClick={loadMenu}>
                Gunakan
              </button>
            </section>
          ) : null}
        </div>
        <div id="cartPageItems">
          {entries.length ? (
            entries.map(([id, q]) => {
              const p = products.find((x) => x.id === id) as Product
              const unit = customerUnitPrice(p, q, settings.promoUnitPrice)
              const wholesale = p.wholesaleQty > 0 && q >= p.wholesaleQty && (p.wholesalePrice || 0) <= unit
              const promo = (settings.promoUnitPrice[p.id] || 0) > 0 && settings.promoUnitPrice[p.id] < p.price
              return (
                <CartRow key={id} product={p} qty={q} unit={unit} wholesale={wholesale} promo={promo} />
              )
            })
          ) : (
            <div className="empty-note">
              Keranjangmu masih kosong.
              <br />
              <small>Tambahkan barang dari Beranda atau Produk.</small>
            </div>
          )}
        </div>
        <section className="checkout-card">
          <div className="total-row">
            <span>Harga barang</span>
            <b id="cartGross">{money(totals.gross)}</b>
          </div>
          <div className="total-row discount-row" id="cartDiscountRow" hidden={totals.discount === 0}>
            <span>Hemat</span>
            <b id="cartDiscount">−{money(totals.discount)}</b>
          </div>
          <div className="total-row">
            <span>Subtotal</span>
            <b id="cartSubtotal">{money(totals.total)}</b>
          </div>
          <div className="total-row final">
            <span>Total pesanan</span>
            <b id="cartPageTotal">{money(totals.total)}</b>
          </div>
          <div className="cart-tools">
            <button id="saveMenuBtn" onClick={saveMenu}>
              Simpan jadi menu
            </button>
            <button id="loadMenuBtn" onClick={loadMenu}>
              Isi menu tersimpan
            </button>
          </div>
          <p className="service-checkout-note">Harga grosir aktif otomatis saat jumlah mencapai satu dus.</p>
          <button id="checkoutBtn" className="checkout-btn" onClick={openCheckout}>
            Pilih ambil atau diantar
          </button>
        </section>
      </main>
    </div>
  )
}

function CartRow({
  product,
  qty,
  unit,
  wholesale,
  promo,
}: {
  product: Product
  qty: number
  unit: number
  wholesale: boolean
  promo: boolean
}) {
  const addCustomerItem = useCartStore((s) => s.addCustomerItem)
  const decCustomerItem = useCartStore((s) => s.decCustomerItem)
  const weight = isWeightUnit(product.unit)

  function dec() {
    if (weight) {
      const nq = Math.round((qty - 0.1) * 10) / 10
      if (nq < 0.1) {
        useCartStore.setState((s) => {
          const next = { ...s.customerCart }
          delete next[product.id]
          return { customerCart: next }
        })
      } else {
        useCartStore.setState((s) => ({ customerCart: { ...s.customerCart, [product.id]: nq } }))
      }
    } else {
      decCustomerItem(product.id)
    }
  }

  function inc() {
    if (weight) {
      const nq = Math.round((qty + 0.1) * 10) / 10
      useCartStore.setState((s) => ({ customerCart: { ...s.customerCart, [product.id]: nq } }))
    } else {
      addCustomerItem(product.id)
    }
  }

  return (
    <div className="sheet-row">
      <img src={product.img} alt={product.name} />
      <div>
        <b>{product.name}</b>
        <br />
        <small>
          {money(unit)} × {String(qty).replace('.', ',')} {product.unit || 'pcs'}
        </small>
        {wholesale ? <span className="wholesale-note">Harga {product.wholesaleLabel || 'grosir'} aktif</span> : null}
        {promo && !wholesale ? <span className="wholesale-note">Harga promo kilat aktif</span> : null}
      </div>
      <div className="qty">
        <button className="mini-btn" aria-label={`Kurangi ${product.name}`} onClick={dec}>
          −
        </button>
        <b>{String(qty).replace('.', ',')}</b>
        <button className="mini-btn plus" aria-label={`Tambah ${product.name}`} onClick={inc}>
          +
        </button>
      </div>
    </div>
  )
}

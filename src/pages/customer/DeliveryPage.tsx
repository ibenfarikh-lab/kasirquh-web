import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { checkoutCustomer, type Fulfillment, type PayMethod } from '../../stores/checkout'
import { useProductsStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import { money, stockText } from '../../lib/format'
import { todayKeyJakarta } from '../../lib/firestore'
import { toast } from '../../components/ui'
import { playNotification } from '../../lib/audio'
import type { Order } from '../../types'
import {
  useSessionLocal,
  useSettingsLocal,
  useCoinLocal,
  useOrdersLocal,
  cartTotals,
  cartStockIssue,
} from '../../features/customer/local'

const DELIVERY_FEE = 5000
const SLOTS = ['Secepatnya · 15–30 menit', '12.00–13.00', '16.00–17.00', '19.00–20.00']


export default function DeliveryPage() {
  const navigate = useNavigate()
  const products = useProductsStore((s) => s.products)
  const customerCart = useCartStore((s) => s.customerCart)
  const clearCustomerCart = useCartStore((s) => s.clearCustomerCart)
  const session = useSessionLocal()
  const settings = useSettingsLocal((s) => s.settings)
  const balance = useCoinLocal((s) => s.balance)
  const setActiveOrder = useOrdersLocal((s) => s.setActiveOrder)
  const prependHistory = useOrdersLocal((s) => s.prependHistory)

  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup')
  const [payMethod, setPayMethod] = useState<PayMethod>('cod')
  const [transferRef, setTransferRef] = useState('')
  const [address, setAddress] = useState('')
  const [slot, setSlot] = useState(SLOTS[0])
  const [redeemOn, setRedeemOn] = useState(false)
  const [busy, setBusy] = useState(false)

  const totals = useMemo(
    () => cartTotals(customerCart, products, settings.promoUnitPrice),
    [customerCart, products, settings.promoUnitPrice],
  )

  const redeem = useMemo(() => {
    if (!settings.coinProgramEnabled || !redeemOn || settings.coinValue <= 0) return { coins: 0, value: 0 }
    const maxValue = Math.floor((totals.total * settings.coinRedeemPercent) / 100)
    const coins = Math.max(0, Math.min(balance, Math.floor(maxValue / settings.coinValue)))
    return { coins, value: coins * settings.coinValue }
  }, [settings.coinProgramEnabled, settings.coinRedeemPercent, settings.coinValue, redeemOn, totals.total, balance])

  const fee = fulfillment === 'delivery' ? DELIVERY_FEE : 0
  const grand = Math.max(0, totals.total + fee - redeem.value)
  const coinBoxDisabled = !settings.coinProgramEnabled || balance === 0 || settings.coinRedeemPercent === 0

  function toggleRedeem() {
    if (!settings.coinProgramEnabled) {
      toast('Program koin sedang dimatikan admin')
      return
    }
    if (!balance) {
      toast('Saldo koin belum tersedia')
      return
    }
    if (!settings.coinRedeemPercent) {
      toast('Penukaran koin dimatikan admin')
      return
    }
    setRedeemOn((v) => !v)
  }

  async function confirmOrder() {
    if (session.isGuest || !session.customerId) {
      useAuthStore.getState().openLoginSheet('checkout', 'Masuk dulu untuk menyelesaikan pesananmu')
      return
    }
    if (!Object.keys(customerCart).length) {
      toast('Keranjang masih kosong')
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
    if (fulfillment === 'delivery' && !address.trim()) {
      toast('Tambahkan patokan rumah dulu')
      return
    }
    const cartSnapshot = { ...customerCart }
    const name = session.name?.trim() || 'Pelanggan'
    const doneMsg = fulfillment === 'delivery' ? 'Pesanan dibuat · diantar ' + slot : 'Pesanan dibuat · siap diambil di warung'
    setBusy(true)
    try {
      const result = await checkoutCustomer({
        cart: cartSnapshot,
        fulfillment,
        address: fulfillment === 'delivery' ? address.trim() : '',
        slot: fulfillment === 'delivery' ? slot : '',
        name,
        payMethod,
        transferReference: payMethod === 'transfer' ? transferRef.trim() : '',
        customerId: session.customerId ?? null,
        coinProgramEnabled: settings.coinProgramEnabled,
        coinRedeemEnabled: redeemOn,
        coinValue: settings.coinValue,
        coinRedeemPercent: settings.coinRedeemPercent,
        coinEventsSpend: !!settings.coinEvents.spend,
        coinSpendReward: settings.coinRewards.spend,
        coinSpendRule: settings.coinSpendRule,
        promoUnitPrice: settings.promoUnitPrice,
        flashProductId: settings.flashProductId ?? null,
        flashRule: String(settings.flashRule || ''),
      })
      setActiveOrder({
        id: result.code,
        customerId: session.customerId ?? null,
        status: 'sedang menunggu konfirmasi',
        detail:
          (fulfillment === 'delivery' ? slot : 'Ambil di warung setelah pesanan siap') +
          (result.redeemValue ? ' · koin ' + money(result.redeemValue) : ''),
        method: result.method,
        step: 0,
      })
      const orderProducts = useProductsStore.getState().products
      const order: Order = {
        id: result.code,
        docId: '',
        rawStatus: 'menunggu',
        dateKey: todayKeyJakarta(),
        status: 'active',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        name,
        customerId: session.customerId ?? null,
        wa: session.wa,
        address: fulfillment === 'delivery' ? address.trim() : 'Ambil di warung',
        method: result.method,
        transferStatus: '',
        transferReference: payMethod === 'transfer' ? transferRef.trim() : '',
        items: Object.entries(cartSnapshot).map(([pid, qty]) => {
          const p = orderProducts.find((x) => x.id === pid)
          return {
            name: p?.name || 'Produk',
            qty,
            subtotal: Math.round((p ? p.price : 0) * qty),
            productId: pid,
          }
        }),
        total: result.total,
        fullTotal: result.fullTotal,
        coinUsed: result.redeemCoins,
        coinValue: result.redeemValue,
        earnedCoins: result.earned,
        stockLines: Object.entries(cartSnapshot).map(([pid, qty]) => ({ productId: pid, qty })),
        cancelConfirm: false,
      }
      prependHistory(order)
      clearCustomerCart()
      setRedeemOn(false)
      setTransferRef('')
      navigate('/beranda')
      toast(doneMsg + ' · masuk Kasir Online')
      try {
        playNotification('order')
      } catch {
      }
    } catch (error) {
      if (!error || (error as { code?: string }).code !== 'OFFLINE') {
        toast(error instanceof Error ? error.message : 'Checkout gagal')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="deliveryCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Selesaikan pesanan</p>
          <h1>Ambil atau Diantar</h1>
        </div>
      </header>
      <main className="content">
        <div className="segmented" id="fulfillmentMethod">
          {(
            [
              ['pickup', 'Ambil di warung'],
              ['delivery', 'Diantar · Rp5.000'],
            ] as [Fulfillment, string][]
          ).map(([v, label]) => (
            <button key={v} className={fulfillment === v ? 'active' : ''} onClick={() => setFulfillment(v)}>
              {label}
            </button>
          ))}
        </div>
        <div className="segmented" id="payMethod">
          {(
            [
              ['cod', 'Tunai / COD'],
              ['transfer', 'Transfer'],
            ] as [PayMethod, string][]
          ).map(([v, label]) => (
            <button key={v} className={payMethod === v ? 'active' : ''} onClick={() => setPayMethod(v)}>
              {label}
            </button>
          ))}
        </div>
        {payMethod === 'transfer' ? (
          <div id="transferRefWrap" className="form-stack">
            <label htmlFor="transferRefInput">Referensi / no. transfer</label>
            <input
              id="transferRefInput"
              inputMode="text"
              autoComplete="off"
              placeholder="Contoh: TRF-987654 (dari m-banking)"
              value={transferRef}
              onChange={(e) => setTransferRef(e.target.value)}
            />
            <small>Tulis nomor referensi setelah transfer · tanpa foto bukti.</small>
          </div>
        ) : null}
        <div id="deliveryFields" className={`form-stack delivery-fields${fulfillment === 'delivery' ? ' active' : ''}`}>
          <label htmlFor="deliveryAddress">Patokan rumah</label>
          <input
            id="deliveryAddress"
            placeholder="Contoh: rumah pagar hijau dekat pos"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <label htmlFor="deliverySlot">Waktu antar</label>
          <select id="deliverySlot" value={slot} onChange={(e) => setSlot(e.target.value)}>
            {SLOTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div id="coinRedeemBox" className={`coin-redeem-box${coinBoxDisabled ? ' coin-disabled' : ''}`}>
          <div className="coin-redeem-head">
            <span>
              <b>Tukar Koin Warga</b>
              <small id="coinRedeemLimit">
                Maks. {settings.coinRedeemPercent}% belanja · 1 koin = {money(settings.coinValue)}
              </small>
            </span>
            <button id="coinRedeemToggle" aria-pressed={redeemOn} className={redeemOn ? 'active' : ''} onClick={toggleRedeem}>
              {redeemOn ? 'Digunakan' : 'Gunakan'}
            </button>
          </div>
          <div className="coin-redeem-detail">
            <span id="coinRedeemBalance">
              Saldo {balance.toLocaleString('id-ID')} koin · {money(balance * settings.coinValue)}
            </span>
            <b id="coinRedeemValue">
              {redeem.value ? '−' + redeem.coins.toLocaleString('id-ID') + ' koin · ' + money(redeem.value) : 'Potongan Rp0'}
            </b>
          </div>
        </div>
        <div className="checkout-summary">
          <div>
            <span>Belanja</span>
            <b id="checkoutItemsTotal">{money(totals.total)}</b>
          </div>
          <div>
            <span>Ongkir</span>
            <b id="checkoutDeliveryFee">{money(fee)}</b>
          </div>
          <div id="checkoutCoinRow" className="coin-cut" hidden={redeem.value === 0}>
            <span>Penukaran koin</span>
            <b id="checkoutCoinDiscount">−{money(redeem.value)}</b>
          </div>
          <div className="grand">
            <span>Total dibayar</span>
            <b id="checkoutGrandTotal">{money(grand)}</b>
          </div>
        </div>
        <button id="confirmOrderBtn" className="primary-wide" disabled={busy} onClick={confirmOrder}>
          {busy ? 'Memproses…' : fulfillment === 'delivery' ? 'Pesan & minta diantar' : 'Pesan & ambil di warung'}
        </button>
      </main>
    </div>
  )
}

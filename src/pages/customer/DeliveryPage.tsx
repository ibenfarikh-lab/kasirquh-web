/**
 * KasirQuh React — src/pages/customer/DeliveryPage.tsx
 * Pengganti DeliverySheet (#deliveryModal + js/features/customer/checkout.js) —
 * halaman penuh, bukan modal: fulfillment, payMethod, transfer ref, coin
 * redeem, ringkasan, confirmOrder.
 *
 * TODO(koordinator): checkoutCustomer() di bawah adalah port lokal dari
 * StoreCheckout.checkoutCustomer (js/store/checkout.js). Pindahkan ke store
 * checkout resmi saat worker terkait selesai.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, collection, runTransaction, serverTimestamp, increment } from 'firebase/firestore'
import { useAuthStore } from '../../stores/auth'
import { useProductsStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import { money, stockText } from '../../lib/format'
import { getDb, requireOnline } from '../../lib/firebase'
import { withTimeout, WRITE_TIMEOUT_MS, todayKeyJakarta } from '../../lib/firestore'
import { toast } from '../../components/ui'
import { playNotification } from '../../lib/audio'
import type { CartMap, Order } from '../../types'
import {
  useSessionLocal,
  useSettingsLocal,
  useCoinLocal,
  useOrdersLocal,
  cartTotals,
  cartStockIssue,
  customerUnitPrice,
} from '../../features/customer/local'

const DELIVERY_FEE = 5000
const SLOTS = ['Secepatnya · 15–30 menit', '12.00–13.00', '16.00–17.00', '19.00–20.00']

type Fulfillment = 'pickup' | 'delivery'
type PayMethod = 'cod' | 'transfer'

interface CheckoutResult {
  code: string
  total: number
  fullTotal: number
  redeemCoins: number
  redeemValue: number
  earned: number
  method: string
  itemCount: number
}

/**
 * Port StoreCheckout.checkoutCustomer (js/store/checkout.js) ke modular SDK.
 */
async function checkoutCustomer(args: {
  cart: CartMap
  fulfillment: Fulfillment
  address: string
  slot: string
  name: string
  payMethod: PayMethod
  transferReference: string
  customerId: string
  coinProgramEnabled: boolean
  coinRedeemEnabled: boolean
  coinValue: number
  coinRedeemPercent: number
  coinEventsSpend: boolean
  coinSpendReward: number
  coinSpendRule: number
  promoUnitPrice: Record<string, number>
  flashProductId: string | null
  flashRule: string
}): Promise<CheckoutResult> {
  requireOnline()
  const db = getDb()
  const entries = Object.entries(args.cart).filter(([, q]) => q > 0)
  if (!entries.length) throw new Error('Keranjang masih kosong')

  return withTimeout(
    runTransaction(db, async (t) => {
      // 1. nomor urut
      const counterRef = doc(db, 'counters', 'orders')
      const counterSnap = await t.get(counterRef)
      const seq = ((counterSnap.exists() ? (counterSnap.data().seq as number) : 0) || 0) + 1

      // 2. pelanggan: wajib approved; ambil saldo koin terkini
      const custRef = doc(db, 'customers', args.customerId)
      const custSnap = await t.get(custRef)
      if (!custSnap.exists() || custSnap.data().approvalStatus !== 'approved') {
        throw new Error('Akun belum disetujui warung')
      }
      const coins = Math.max(0, Math.round(Number(custSnap.data().coins) || 0))

      // 3. validasi stok per item (baca ulang) + harga
      const items: { productId: string; name: string; price: number; qty: number; subtotal: number; ref: ReturnType<typeof doc> }[] = []
      let total = 0
      for (const [pid, qty] of entries) {
        const pRef = doc(db, 'products', pid)
        const pSnap = await t.get(pRef)
        if (!pSnap.exists()) throw new Error('Ada produk yang sudah tidak tersedia')
        const pd = pSnap.data() || {}
        const stock = Math.max(0, Number(pd.stock) || 0)
        if (stock < qty) {
          throw new Error('Stok ' + (pd.name || 'produk') + ' tidak cukup · tersedia ' + stock + ', diminta ' + qty)
        }
        if (args.flashProductId && pid === args.flashProductId) {
          const capMatch = String(args.flashRule || '').match(/\d+/)
          const cap = capMatch ? Math.max(1, parseInt(capMatch[0], 10)) : 5
          if (qty > cap) throw new Error('Promo kilat maksimal ' + cap + ' per pesanan · kurangi jumlah ' + (pd.name || 'produk'))
        }
        const unit = customerUnitPrice(
          {
            id: pid,
            price: Math.max(0, Math.round(Number(pd.price) || 0)),
            wholesaleQty: Math.max(0, Number(pd.wholesaleQty) || 0),
            wholesalePrice: Math.max(0, Math.round(Number(pd.wholesalePrice) || 0)),
          } as never,
          qty,
          args.promoUnitPrice,
        )
        const subtotal = unit * qty
        total += subtotal
        items.push({ productId: pid, name: String(pd.name || 'Produk'), price: unit, qty, subtotal, ref: pRef })
      }

      // 4. koin: penukaran (batas admin) + bonus belanja
      const fee = args.fulfillment === 'delivery' ? DELIVERY_FEE : 0
      const fullTotal = total + fee
      let redeemCoins = 0
      let redeemValue = 0
      if (args.coinProgramEnabled && args.coinRedeemEnabled && args.coinValue > 0 && args.coinRedeemPercent > 0) {
        const maxValue = Math.floor((total * args.coinRedeemPercent) / 100)
        redeemCoins = Math.max(0, Math.min(coins, Math.floor(maxValue / args.coinValue)))
        redeemValue = redeemCoins * args.coinValue
      }
      if (redeemCoins > coins) throw new Error('Saldo koin tidak cukup')
      const paidTotal = Math.max(0, fullTotal - redeemValue)
      let earned = 0
      if (args.coinProgramEnabled && args.coinEventsSpend && args.coinSpendReward > 0 && args.coinSpendRule > 0) {
        earned = Math.floor(total / args.coinSpendRule) * args.coinSpendReward
      }

      // 5. tulis atomik
      const code = 'WM-' + String(seq).padStart(6, '0')
      const ts = serverTimestamp()
      t.set(counterRef, { seq }, { merge: true })
      items.forEach((it) => {
        t.update(it.ref, { stock: increment(-it.qty), updatedAt: ts })
      })
      const coinDelta = earned - redeemCoins
      if (coinDelta !== 0) t.update(custRef, { coins: increment(coinDelta) })
      const orderRef = doc(collection(db, 'orders'))
      t.set(orderRef, {
        code,
        customerId: args.customerId,
        customerName: args.name,
        items: items.map((it) => ({ productId: it.productId, name: it.name, price: it.price, qty: it.qty, subtotal: it.subtotal })),
        total: paidTotal,
        fullTotal,
        paymentMethod: args.payMethod === 'transfer' ? 'transfer' : 'cod',
        transferReference: args.payMethod === 'transfer' ? String(args.transferReference || '').slice(0, 80) : '',
        fulfillment: args.fulfillment,
        status: 'menunggu',
        note: args.fulfillment === 'delivery' ? 'Diantar · ' + args.address : 'Ambil di warung',
        coinUsed: redeemCoins,
        coinValue: redeemValue,
        earnedCoins: earned,
        createdAt: ts,
        updatedAt: ts,
      })
      if (redeemCoins > 0) {
        t.set(doc(collection(db, 'coin_ledger')), {
          customerId: args.customerId,
          amount: -redeemCoins,
          reason: 'tukar',
          label: 'Ditukar pada #' + code,
          detail: 'Potongan Rp' + redeemValue.toLocaleString('id-ID'),
          orderId: orderRef.id,
          createdAt: ts,
        })
      }
      if (earned > 0) {
        t.set(doc(collection(db, 'coin_ledger')), {
          customerId: args.customerId,
          amount: earned,
          reason: 'belanja',
          label: 'Bonus belanja #' + code,
          detail: 'Rp' + total.toLocaleString('id-ID') + ' belanja',
          orderId: orderRef.id,
          createdAt: ts,
        })
      }

      return {
        code,
        total: paidTotal,
        fullTotal,
        redeemCoins,
        redeemValue,
        earned,
        method: args.payMethod === 'transfer' ? 'Transfer' : args.fulfillment === 'delivery' ? 'COD' : 'Bayar di warung',
        itemCount: entries.reduce((a, [, q]) => a + q, 0),
      }
    }),
    WRITE_TIMEOUT_MS,
    'Checkout',
  )
}

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

  // Port coinRedemption() (js/app.js baris 338)
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
      // Tamu → simpan aksi, buka sheet login; setelah login dilanjutkan otomatis
      // (AuthSheet mengarah ke /beranda/keranjang?delivery=1 → halaman checkout ini).
      useAuthStore.getState().openLoginSheet('checkout')
      toast('Masuk / daftar dulu ya...')
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
        /* abaikan — bunyi tidak boleh menggagalkan alur */
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

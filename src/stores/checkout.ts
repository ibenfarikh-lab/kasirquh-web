import { create } from 'zustand'
import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { getDb, requireOnline } from '../lib/firebase'
import { withTimeout, WRITE_TIMEOUT_MS } from '../lib/firestore'
import { assertAdmin } from './auth'
import { useSettingsStore } from './settings'
import { usePromoStore, calcMaxRedeem } from './promo'
import { useProductsStore } from './products'
import { useCartStore } from './cart'
import { customerUnitPrice } from './orders'
import { customerUnitPrice as customerUnitPricePromo } from '../features/customer/local'
import type { CartMap } from '../types'

export type Fulfillment = 'pickup' | 'delivery'
export type PayMethod = 'cod' | 'transfer'

export interface KasirMember {
  uid: string
  name: string
}

export interface CartLine {
  productId: string
  name: string
  price: number
  qty: number
  subtotal: number
}

export interface CheckoutSummary {
  lines: CartLine[]
  itemsTotal: number
  itemCount: number
  fee: number
  redeemCoins: number
  redeemValue: number
  grandTotal: number
}

interface CheckoutState {
  fulfillment: Fulfillment
  payMethod: PayMethod
  coinRedeem: boolean
  address: string
  slot: string
  name: string
  transferReference: string

  setFulfillment: (v: Fulfillment) => void
  setPayMethod: (v: PayMethod) => void
  setCoinRedeem: (v: boolean) => void
  setAddress: (v: string) => void
  setSlot: (v: string) => void
  setName: (v: string) => void
  setTransferReference: (v: string) => void
  resetDraft: () => void

  cartTotals: () => { lines: CartLine[]; total: number; itemCount: number }
  summary: () => CheckoutSummary
  completeCashSale: (input: {
    lines: { productId: string; qty: number; total: number }[]
    total: number
    profit: number
    itemCount: number
    redeemCoins?: number
    earnedCoins?: number
    member?: KasirMember | null
  }) => Promise<void>
}

export interface CheckoutResult {
  code: string
  total: number
  fullTotal: number
  redeemCoins: number
  redeemValue: number
  earned: number
  method: string
  itemCount: number
}

export async function checkoutCustomer(args: {
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
      const counterRef = doc(db, 'counters', 'orders')
      const counterSnap = await t.get(counterRef)
      const seq = ((counterSnap.exists() ? (counterSnap.data().seq as number) : 0) || 0) + 1

      const custRef = doc(db, 'customers', args.customerId)
      const custSnap = await t.get(custRef)
      if (!custSnap.exists() || custSnap.data().approvalStatus !== 'approved') {
        throw new Error('Akun belum disetujui warung')
      }
      const coins = Math.max(0, Math.round(Number(custSnap.data().coins) || 0))

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
        const unit = customerUnitPricePromo(
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

const DELIVERY_FEE = 5000

export const useCheckoutStore = create<CheckoutState>()((set, get) => ({
  fulfillment: 'pickup',
  payMethod: 'cod',
  coinRedeem: false,
  address: '',
  slot: '',
  name: '',
  transferReference: '',

  setFulfillment: (v) => set({ fulfillment: v }),
  setPayMethod: (v) => set({ payMethod: v }),
  setCoinRedeem: (v) => set({ coinRedeem: v }),
  setAddress: (v) => set({ address: v }),
  setSlot: (v) => set({ slot: v }),
  setName: (v) => set({ name: v }),
  setTransferReference: (v) => set({ transferReference: v }),
  resetDraft: () =>
    set({
      fulfillment: 'pickup',
      payMethod: 'cod',
      coinRedeem: false,
      address: '',
      slot: '',
      name: '',
      transferReference: '',
    }),

  cartTotals: () => {
    const cart = useCartStore.getState().customerCart
    const products = useProductsStore.getState().products
    const lines: CartLine[] = []
    let total = 0
    let itemCount = 0
    for (const [pid, qty] of Object.entries(cart)) {
      if (qty <= 0) continue
      const p = products.find((x) => x.id === pid)
      if (!p) continue
      const unit = customerUnitPrice(
        { id: pid, price: p.price, wholesaleQty: p.wholesaleQty, wholesalePrice: p.wholesalePrice },
        qty,
      )
      const subtotal = unit * qty
      total += subtotal
      itemCount += qty
      lines.push({ productId: pid, name: p.name, price: unit, qty: qty, subtotal: subtotal })
    }
    return { lines, total, itemCount }
  },

  summary: () => {
    const { lines, total, itemCount } = get().cartTotals()
    const settings = useSettingsStore.getState()
    const fee = get().fulfillment === 'delivery' ? DELIVERY_FEE : 0
    let redeemCoins = 0
    let redeemValue = 0
    if (
      settings.coinProgramEnabled &&
      get().coinRedeem &&
      settings.coinRate > 0 &&
      settings.coinRedeemLimit > 0
    ) {
      const balance = usePromoStore.getState().coinBalance
      const r = calcMaxRedeem(total, balance)
      redeemCoins = r.coins
      redeemValue = r.value
    }
    const grandTotal = Math.max(0, total + fee - redeemValue)
    return { lines, itemsTotal: total, itemCount, fee, redeemCoins, redeemValue, grandTotal }
  },

  completeCashSale: async (input) => {
    requireOnline()
    assertAdmin()
    const lines = input.lines || []
    if (!lines.length) throw new Error('Transaksi masih kosong')
    const db = getDb()
    const ts = serverTimestamp()
    const batch = writeBatch(db)
    lines.forEach((l) => {
      batch.update(doc(db, 'products', l.productId), {
        stock: increment(-l.qty),
        updatedAt: ts,
      })
    })
    const km = input.member || null
    let redeemCoins = Math.max(0, Math.round(Number(input.redeemCoins) || 0))
    const earnedCoins = Math.max(0, Math.round(Number(input.earnedCoins) || 0))
    let total = Math.round(Number(input.total) || 0)
    const coinVal = Math.max(1, Math.round(Number(useSettingsStore.getState().coinRate) || 1))
    let memberDoc: DocumentData | null = null
    if (km && km.uid) {
      try {
        const snap = await getDoc(doc(db, 'customers', km.uid))
        memberDoc = snap.exists() ? snap.data() : null
      } catch {
        memberDoc = null
      }
      if (!memberDoc || memberDoc.approvalStatus !== 'approved') {
        throw new Error('Member tidak valid — transaksi dibatalkan')
      }
    }
    if (km && km.uid && redeemCoins > 0 && memberDoc) {
      const actualCoins = Math.max(0, Math.round(Number(memberDoc.coins) || 0))
      if (redeemCoins > actualCoins) {
        redeemCoins = actualCoins
        const rawTotal = lines.reduce((s, l) => s + (Number(l.total) || 0), 0)
        total = Math.max(0, rawTotal - redeemCoins * coinVal)
      }
    }
    batch.set(doc(collection(db, 'journal')), {
      type: 'pemasukan',
      category: 'penjualan',
      amount: Math.round(total),
      note: 'Penjualan · Kasir',
      refId: '',
      method: 'Tunai',
      profit: Math.round(input.profit || 0),
      itemCount: input.itemCount || 0,
      customerId: km ? km.uid : '',
      customerName: km ? km.name : '',
      coinUsed: redeemCoins,
      coinValue: redeemCoins * coinVal,
      earnedCoins: earnedCoins,
      createdAt: ts,
    })
    if (km && km.uid) {
      const coinDelta = earnedCoins - redeemCoins
      if (coinDelta !== 0) {
        batch.update(doc(db, 'customers', km.uid), { coins: increment(coinDelta) })
      }
      if (redeemCoins > 0) {
        batch.set(doc(collection(db, 'coin_ledger')), {
          customerId: km.uid,
          amount: -redeemCoins,
          reason: 'tukar',
          label: 'Ditukar di kasir',
          detail: 'Potongan Rp' + (redeemCoins * coinVal).toLocaleString('id-ID'),
          createdAt: ts,
        })
        batch.set(doc(collection(db, 'journal')), {
          type: 'pengeluaran',
          category: 'beban_promosi',
          amount: redeemCoins * coinVal,
          note: 'Penukaran koin · ' + redeemCoins.toLocaleString('id-ID') + ' koin (kasir)',
          refId: '',
          method: 'Koin Warga',
          profit: 0,
          itemCount: 0,
          customerId: km.uid,
          customerName: km.name,
          createdAt: ts,
        })
      }
      if (earnedCoins > 0) {
        batch.set(doc(collection(db, 'coin_ledger')), {
          customerId: km.uid,
          amount: earnedCoins,
          reason: 'belanja',
          label: 'Bonus belanja kasir',
          detail:
            'Rp' + Math.round(total + redeemCoins * coinVal).toLocaleString('id-ID') + ' belanja',
          createdAt: ts,
        })
      }
    }
    lines.forEach((l) => {
      batch.update(doc(db, 'products', l.productId), {
        totalTerjual: increment(l.qty),
      })
    })
    await withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Kasir tunai')
  },
}))

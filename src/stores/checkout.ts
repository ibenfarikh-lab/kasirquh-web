/**
 * KasirQuh React — src/stores/checkout.ts
 * Draf checkout pelanggan + kasir tunai admin. Pengganti
 * js/store/checkout.js (checkoutCustomer, completeCashSale) — logika
 * hitung (total, ongkir, diskon koin) dari js/app.js (cartTotals,
 * coinRedemption, updateCheckoutSummary).
 *
 * Pola: zustand create() dengan state + actions; tulis requireOnline()
 * dulu + timeout 30 dtk via withTimeout + pesan error jujur.
 */
import { create } from 'zustand'
import {
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { getDb, requireOnline } from '../lib/firebase'
import { withTimeout, WRITE_TIMEOUT_MS } from '../lib/firestore'
import { assertAdmin, useAuthStore } from './auth'
import { useSettingsStore } from './settings'
import { usePromoStore, calcMaxRedeem } from './promo'
import { useProductsStore } from './products'
import { useCartStore } from './cart'
import { customerUnitPrice, useOrdersStore, type PlaceOrderResult } from './orders'

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
  /** Cara terima pesanan */
  fulfillment: Fulfillment
  /** Metode bayar */
  payMethod: PayMethod
  /** Toggle "Gunakan" koin di checkout */
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

  /** Total keranjang pelanggan (harga promo/grosir per qty). */
  cartTotals: () => { lines: CartLine[]; total: number; itemCount: number }
  /** Ringkasan checkout: total + ongkir − diskon koin. */
  summary: () => CheckoutSummary
  /** Tulis pesanan ke Firestore (delegasi ke orders.placeOrder). */
  confirmOrder: () => Promise<PlaceOrderResult>
  /**
   * Kasir admin (tunai): decrement stok atomik + jurnal penjualan.
   * member: pelanggan teridentifikasi di kasir (opsional).
   */
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
    /* coinRedemption(): hanya bila program nyala + toggle dipakai + saldo ada */
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

  confirmOrder: async () => {
    const cart = useCartStore.getState().customerCart
    const name =
      get().name.trim() || useAuthStore.getState().session.name || 'Pelanggan'
    const result = await useOrdersStore.getState().placeOrder({
      cart,
      fulfillment: get().fulfillment,
      address: get().address,
      slot: get().slot,
      name: name,
      payMethod: get().payMethod,
      transferReference: get().transferReference,
      coinRedeemEnabled: get().coinRedeem,
    })
    useCartStore.getState().clearCustomerCart()
    get().resetDraft()
    return result
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
    /* Opsi A: catat member jika teridentifikasi di kasir */
    const km = input.member || null
    /* Opsi B: koin tukar & dapat */
    let redeemCoins = Math.max(0, Math.round(Number(input.redeemCoins) || 0))
    const earnedCoins = Math.max(0, Math.round(Number(input.earnedCoins) || 0))
    let total = Math.round(Number(input.total) || 0)
    const coinVal = Math.max(1, Math.round(Number(useSettingsStore.getState().coinRate) || 1))
    /* Validasi ulang member saat bayar: antara scan dan pembayaran, member
     * bisa di-reject/dihapus admin. Satu read dokumen dipakai untuk dua cek
     * (koin & approval) — efisien, tanpa read ganda. */
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
    /* Cegah koin minus — pakai ulang memberDoc di atas. */
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
        /* Beban promosi untuk koin yang ditukar */
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
    /* Naikkan counter penjualan per produk agar masuk Sedang Laris */
    lines.forEach((l) => {
      batch.update(doc(db, 'products', l.productId), {
        totalTerjual: increment(l.qty),
      })
    })
    await withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Kasir tunai')
  },
}))

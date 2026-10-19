/**
 * KasirQuh React — src/stores/orders.ts
 * Pesanan online. Pengganti js/store/orders.js (settleOrder, rejectTransfer,
 * setOrderStatus, cancelOrder, deleteOrder) + mapOrder dari js/store/core.js
 * + langganan pesanan dari js/store/chat.js + transaksi checkoutCustomer
 * dari js/store/checkout.js (dipakai sebagai placeOrder).
 *
 * Pola: zustand create() dengan state + actions; subscribe() pasang
 * onSnapshot modular dan return unsub; tulis requireOnline() dulu +
 * timeout 30 dtk via withTimeout + pesan error jujur.
 */
import { create } from 'zustand'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getDb, requireOnline } from '../lib/firebase'
import { withTimeout, WRITE_TIMEOUT_MS } from '../lib/firestore'
import { assertAdmin, requireCustomerId } from './auth'
import { rebuildPopular, rebuildRiwayat, useSettingsStore, type PopularItem, type RiwayatItem } from './settings'
import { useCustomersStore } from './customers'
import { useProductsStore } from './products'
import { calcEarnedCoins } from './promo'

/** Bentuk UI pesanan — port setia mapOrder (items tetap tuple warisan). */
export interface OrderRecord {
  id: string
  docId: string
  rawStatus: string
  dateKey: string
  status: 'active' | 'done'
  time: string
  name: string
  customerId: string
  wa: string
  address: string
  method: string
  transferStatus: string
  transferReference: string
  /** [nama, "2x", "Rp1.000", productId] — bentuk warisan kode lama */
  items: [string, string, string, string][]
  total: number
  fullTotal: number
  coinUsed: number
  coinValue: number
  earnedCoins: number
  stockDeducted: boolean
  stockLines: { productId: string; qty: number }[]
  cancelConfirm: boolean
}

export interface ActiveOrderInfo {
  id: string
  customerId: string
  status: string
  detail: string
  method: string
  step: number
}

export interface PlaceOrderInput {
  cart: Record<string, number>
  fulfillment: 'pickup' | 'delivery'
  address: string
  slot?: string
  name: string
  payMethod: 'cod' | 'transfer'
  transferReference?: string
  coinRedeemEnabled: boolean
}

export interface PlaceOrderResult {
  code: string
  total: number
  fullTotal: number
  redeemCoins: number
  redeemValue: number
  earned: number
  method: string
  itemCount: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function dateKeyOf(ts: { toDate?: () => Date } | null | undefined): string {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date()
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

function dateTimeOf(ts: { toDate?: () => Date } | null | undefined): string {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date()
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    })
      .format(d)
      .replace('.', ':')
  } catch {
    return 'Baru saja'
  }
}

const STATUS_LABEL: Record<string, string> = {
  menunggu: 'Menunggu',
  dikemas: 'Dikemas',
  dikirim: 'Dikirim',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

/** Mapper Firestore -> bentuk UI (port setia mapOrder). */
export function mapOrder(
  d: QueryDocumentSnapshot<DocumentData>,
  wa = '',
): OrderRecord | null {
  const data = d.data() || {}
  const raw = data.status || 'menunggu'
  if (raw === 'dibatalkan') return null // pesanan batal keluar dari daftar
  const fulfillment = data.fulfillment || 'pickup'
  const items = (data.items || []).map(
    (it: DocumentData): [string, string, string, string] => [
      String(it.name || 'Produk'),
      (Number(it.qty) || 0) + 'x',
      'Rp' + Math.round(Number(it.subtotal) || 0).toLocaleString('id-ID'),
      String(it.productId || ''),
    ],
  )
  return {
    id: String(data.code || d.id),
    docId: d.id,
    rawStatus: raw,
    dateKey: dateKeyOf(data.createdAt),
    status: raw === 'menunggu' || raw === 'dikemas' || raw === 'dikirim' ? 'active' : 'done',
    time: data.createdAt ? dateTimeOf(data.createdAt) : 'Baru saja',
    name: String(data.customerName || 'Pelanggan'),
    customerId: String(data.customerId || ''),
    wa: wa,
    address: String(
      data.note || (fulfillment === 'delivery' ? 'Diantar ke rumah' : 'Ambil di warung'),
    ),
    method:
      data.paymentMethod === 'transfer'
        ? 'Transfer'
        : fulfillment === 'delivery'
          ? 'COD'
          : 'Bayar di warung',
    transferStatus: String(data.transferStatus || ''),
    transferReference: String(data.transferReference || ''),
    items: items,
    total: Math.round(Number(data.total) || 0),
    fullTotal: Math.round(Number(data.fullTotal != null ? data.fullTotal : data.total) || 0),
    coinUsed: Math.round(Number(data.coinUsed) || 0),
    coinValue: Math.round(Number(data.coinValue) || 0),
    earnedCoins: Math.round(Number(data.earnedCoins) || 0),
    stockDeducted: true,
    stockLines: (data.items || []).map((it: DocumentData) => ({
      productId: String(it.productId || ''),
      qty: Number(it.qty) || 0,
    })),
    cancelConfirm: false,
  }
}

/**
 * Harga satuan pelanggan: harga promo kilat dulu, lalu harga grosir bila
 * qty memenuhi batas. (customerUnitPrice dari js/store/core.js)
 */
export function customerUnitPrice(
  product: { id: string; price: number; wholesaleQty?: number; wholesalePrice?: number },
  qty: number,
): number {
  const promoUnitPrice = useSettingsStore.getState().promoUnitPrice
  const base = promoUnitPrice[product.id] || product.price || 0
  if (product.wholesaleQty && qty >= product.wholesaleQty) {
    return Math.min(base, product.wholesalePrice || base)
  }
  return base
}

interface OrdersState {
  onlineOrders: OrderRecord[]
  /** Banner pesanan aktif pelanggan */
  activeOrder: ActiveOrderInfo | null
  /** Riwayat belanja pelanggan (diturunkan) */
  riwayat: RiwayatItem[]
  /** Produk terlaris (diturunkan) */
  popular: PopularItem[]
  loading: boolean

  /** Langganan pesanan milik pelanggan. Return unsub. */
  subscribeCustomerOrders: (uid: string) => () => void
  /** Langganan semua pesanan (admin). Return unsub. */
  subscribeAdminOrders: () => () => void
  clearRole: () => void

  /** Buat pesanan: transaksi nomor urut + validasi stok + koin (port checkoutCustomer). */
  placeOrder: (input: PlaceOrderInput) => Promise<PlaceOrderResult>
  /** Ubah status: menunggu → dikemas → dikirim (admin). */
  updateStatus: (orderId: string, status: string) => Promise<void>
  /** Selesaikan pesanan: status selesai + jurnal penjualan + jurnal beban koin (admin). */
  settleOrder: (orderId: string) => Promise<void>
  /** Batalkan pesanan: kembalikan stok + koin (admin). */
  cancel: (orderId: string) => Promise<void>
  /** Selesaikan + jurnal penjualan (admin, konfirmasi transfer). */
  confirmTransfer: (orderId: string) => Promise<void>
  /** Tolak bukti transfer (admin). */
  rejectTransfer: (orderId: string, reason: string) => Promise<void>
  /** Hapus dokumen pesanan (admin). */
  deleteOrder: (orderId: string) => Promise<void>
}

export const useOrdersStore = create<OrdersState>()((set, get) => ({
  onlineOrders: [],
  activeOrder: null,
  riwayat: [],
  popular: [],
  loading: true,

  subscribeCustomerOrders: (uid) => {
    const unsub = onSnapshot(
      query(collection(getDb(), 'orders'), where('customerId', '==', uid), limit(50)),
      (snap) => {
        const ms = (d: DocumentData) => {
          const ts = d.createdAt as { toMillis?: () => number } | null | undefined
          return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0
        }
        const onlineOrders = snap.docs
          .slice()
          .sort((a, b) => ms(b.data() || {}) - ms(a.data() || {}))
          .map((d) => mapOrder(d))
          .filter((o): o is OrderRecord => o !== null)
        /* Pulihkan banner pesanan aktif — hanya bila slot masih kosong */
        const prev = get().activeOrder
        let activeOrder: ActiveOrderInfo | null = prev
        if (prev == null) {
          const first = (onlineOrders || []).find((o) => o.status === 'active')
          if (first) {
            const step = { menunggu: 0, dikemas: 1, dikirim: 2 }[first.rawStatus] || 0
            activeOrder = {
              id: first.id,
              customerId: uid,
              status: ['Menunggu konfirmasi', 'Sedang dikemas', 'Sedang dikirim'][step],
              detail: (first.address || '') + (first.method ? ' · ' + first.method : ''),
              method: first.method,
              step: step,
            }
          }
        } else {
          /* Pesanan yang dilacak sudah selesai → kosongkan banner */
          const tracked = (onlineOrders || []).find((o) => o.id === prev.id)
          if (tracked && tracked.status !== 'active') activeOrder = null
        }
        const settings = useSettingsStore.getState()
        const { popular } = rebuildPopular(
          onlineOrders,
          [],
          false,
          (settings.storeSettings.topProductIds as string[]) || [],
        )
        set({
          onlineOrders,
          activeOrder,
          popular,
          riwayat: rebuildRiwayat(onlineOrders),
          loading: false,
        })
      },
      (err) => {
        console.error('[KasirQuh] langganan "orders" gagal:', err)
        set({ loading: false })
      },
    )
    return unsub
  },

  subscribeAdminOrders: () => {
    const unsub = onSnapshot(
      query(collection(getDb(), 'orders'), orderBy('createdAt', 'desc'), limit(30)),
      (snap) => {
        const customers = useCustomersStore.getState().customers
        const onlineOrders = snap.docs
          .map((d) => {
            const c = customers.find((x) => x.id === String((d.data() || {}).customerId || ''))
            return mapOrder(d, c ? c.wa || '' : '')
          })
          .filter((o): o is OrderRecord => o !== null)
        const settings = useSettingsStore.getState()
        const products = useProductsStore.getState().products
        const curTop = ((settings.storeSettings.topProductIds as string[]) || []).join('|')
        const { popular, top8 } = rebuildPopular(onlineOrders, products, true, [])
        /* 8 terlaris → persist ke store_settings agar tamu/pelanggan ikut
         * dapat. Hanya tulis bila daftar berubah (cegah loop); lewati bila
         * pesanan belum termuat agar tidak menimpa dengan daftar kosong. */
        if (top8.length && top8.join('|') !== curTop) {
          void settings.saveStoreSettings({ topProductIds: top8 }).catch(() => {})
        }
        useCustomersStore.getState().refreshSpend(onlineOrders)
        set({ onlineOrders, popular, loading: false })
      },
      (err) => {
        console.error('[KasirQuh] langganan "orders" gagal:', err)
        set({ loading: false })
      },
    )
    return unsub
  },

  clearRole: () => {
    set({ onlineOrders: [], activeOrder: null, riwayat: [], popular: [], loading: true })
  },

  placeOrder: async (input) => {
    requireOnline()
    const uid = requireCustomerId()
    const entries = Object.entries(input.cart || {}).filter(([, q]) => q > 0)
    if (!entries.length) throw new Error('Keranjang masih kosong')
    const settings = useSettingsStore.getState()
    const db = getDb()

    return withTimeout(
      runTransaction(db, async (t) => {
        /* 1. nomor urut */
        const counterRef = doc(db, 'counters', 'orders')
        const counterSnap = await t.get(counterRef)
        const seq = ((counterSnap.exists() ? counterSnap.data().seq : 0) || 0) + 1

        /* 2. pelanggan: wajib approved; ambil saldo koin terkini */
        const custRef = doc(db, 'customers', uid)
        const custSnap = await t.get(custRef)
        if (!custSnap.exists() || custSnap.data().approvalStatus !== 'approved') {
          throw new Error('Akun belum disetujui warung')
        }
        const coins = Math.max(0, Math.round(Number(custSnap.data().coins) || 0))

        /* 3. validasi stok per item (baca ulang dokumen produk) + harga */
        const items: {
          productId: string
          name: string
          price: number
          qty: number
          subtotal: number
          _ref: ReturnType<typeof doc>
        }[] = []
        let total = 0
        for (const [pid, qty] of entries) {
          const pRef = doc(db, 'products', pid)
          const pSnap = await t.get(pRef)
          if (!pSnap.exists()) throw new Error('Ada produk yang sudah tidak tersedia')
          const pd = pSnap.data() || {}
          const stock = Math.max(0, Number(pd.stock) || 0)
          if (stock < qty) {
            throw new Error(
              'Stok ' + (pd.name || 'produk') + ' tidak cukup · tersedia ' + stock + ', diminta ' + qty,
            )
          }
          /* Promo kilat: tegakkan batas per pesanan.
           * Angka diambil dari teks aturan admin bila ada, default 5. */
          if (settings.flashProductId && pid === settings.flashProductId) {
            const capMatch = String(settings.flashRule || '').match(/\d+/)
            const cap = capMatch ? Math.max(1, parseInt(capMatch[0], 10)) : 5
            if (qty > cap) {
              throw new Error(
                'Promo kilat maksimal ' + cap + ' per pesanan · kurangi jumlah ' + (pd.name || 'produk'),
              )
            }
          }
          const unit = customerUnitPrice(
            {
              id: pid,
              price: Math.max(0, Math.round(Number(pd.price) || 0)),
              wholesaleQty: pd.wholesaleQty,
              wholesalePrice: pd.wholesalePrice,
            },
            qty,
          )
          const subtotal = unit * qty
          total += subtotal
          items.push({
            productId: pid,
            name: String(pd.name || 'Produk'),
            price: unit,
            qty: qty,
            subtotal: subtotal,
            _ref: pRef,
          })
        }

        /* 4. koin: penukaran (batas admin) + bonus belanja */
        const fee = input.fulfillment === 'delivery' ? 5000 : 0
        const fullTotal = total + fee
        let redeemCoins = 0
        let redeemValue = 0
        if (
          input.coinRedeemEnabled &&
          settings.coinProgramEnabled &&
          settings.coinRate > 0 &&
          settings.coinRedeemLimit > 0
        ) {
          const maxValue = Math.floor((total * settings.coinRedeemLimit) / 100)
          redeemCoins = Math.max(0, Math.min(coins, Math.floor(maxValue / settings.coinRate)))
          redeemValue = redeemCoins * settings.coinRate
        }
        if (redeemCoins > coins) throw new Error('Saldo koin tidak cukup')
        const paidTotal = Math.max(0, fullTotal - redeemValue)
        const earned = calcEarnedCoins(total)

        /* 5. tulis atomik */
        const code = 'WM-' + String(seq).padStart(6, '0')
        const ts = serverTimestamp()
        const orderRef = doc(collection(db, 'orders'))
        t.set(counterRef, { seq: seq }, { merge: true })
        items.forEach((it) => {
          t.update(it._ref, { stock: increment(-it.qty), updatedAt: ts })
        })
        const coinDelta = earned - redeemCoins
        if (coinDelta !== 0) t.update(custRef, { coins: increment(coinDelta) })
        t.set(orderRef, {
          code: code,
          customerId: uid,
          customerName: input.name,
          items: items.map((it) => ({
            productId: it.productId,
            name: it.name,
            price: it.price,
            qty: it.qty,
            subtotal: it.subtotal,
          })),
          total: paidTotal,
          fullTotal: fullTotal,
          paymentMethod: input.payMethod === 'transfer' ? 'transfer' : 'cod',
          transferReference:
            input.payMethod === 'transfer' ? String(input.transferReference || '').slice(0, 80) : '',
          fulfillment: input.fulfillment,
          status: 'menunggu',
          note:
            input.fulfillment === 'delivery' ? 'Diantar · ' + input.address : 'Ambil di warung',
          coinUsed: redeemCoins,
          coinValue: redeemValue,
          earnedCoins: earned,
          createdAt: ts,
          updatedAt: ts,
        })
        if (redeemCoins > 0) {
          t.set(doc(collection(db, 'coin_ledger')), {
            customerId: uid,
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
            customerId: uid,
            amount: earned,
            reason: 'belanja',
            label: 'Bonus belanja #' + code,
            detail: 'Rp' + total.toLocaleString('id-ID') + ' belanja',
            orderId: orderRef.id,
            createdAt: ts,
          })
        }

        return {
          code: code,
          total: paidTotal,
          fullTotal: fullTotal,
          redeemCoins: redeemCoins,
          redeemValue: redeemValue,
          earned: earned,
          method:
            input.payMethod === 'transfer'
              ? 'Transfer'
              : input.fulfillment === 'delivery'
                ? 'COD'
                : 'Bayar di warung',
          itemCount: entries.reduce((a, [, q]) => a + q, 0),
        }
      }),
      WRITE_TIMEOUT_MS,
      'Checkout',
    )
  },

  updateStatus: async (orderId, status) => {
    requireOnline()
    assertAdmin()
    const allowed = ['dikemas', 'dikirim']
    if (!allowed.includes(status)) throw new Error('Status tidak valid')
    const db = getDb()
    const ref = doc(db, 'orders', orderId)
    const snap = await withTimeout(getDoc(ref), WRITE_TIMEOUT_MS, 'Ubah status')
    const d = snap.data() || {}
    if (d.status === 'selesai' || d.status === 'dibatalkan') {
      throw new Error('Pesanan sudah selesai/dibatalkan')
    }
    await withTimeout(
      updateDoc(ref, { status: status, updatedAt: serverTimestamp() }),
      WRITE_TIMEOUT_MS,
      'Ubah status',
    )
  },

  settleOrder: async (orderId) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    const ts = serverTimestamp()
    await withTimeout(
      runTransaction(db, async (t) => {
        const ref = doc(db, 'orders', orderId)
        const snap = await t.get(ref)
        if (!snap.exists()) throw new Error('Pesanan tidak ditemukan')
        const d = snap.data() || {}
        if (d.status === 'selesai') return
        if (d.status !== 'menunggu' && d.status !== 'dikemas' && d.status !== 'dikirim')
          throw new Error('Pesanan tidak dapat diselesaikan')
        let profit = 0
        let itemCount = 0
        for (const it of d.items || []) {
          const qty = Number(it.qty) || 0
          itemCount += qty
          let cost = 0
          if (it.productId) {
            const pSnap = await t.get(doc(db, 'products', it.productId))
            if (pSnap.exists())
              cost = Math.max(0, Math.round(Number(pSnap.data().costPrice) || 0))
          }
          profit += Math.max(0, Math.round(Number(it.price) || 0) - cost) * qty
        }
        t.update(ref, { status: 'selesai', updatedAt: ts })
        const total = Math.round(Number(d.total) || 0)
        t.set(doc(collection(db, 'journal')), {
          type: 'pemasukan',
          category: 'penjualan',
          amount: total,
          note: 'Penjualan · Online',
          refId: String(d.code || orderId),
          method:
            d.paymentMethod === 'transfer'
              ? 'Transfer'
              : d.fulfillment === 'delivery'
                ? 'COD'
                : 'Bayar di warung',
          profit,
          itemCount,
          createdAt: ts,
        })
        const coinValue = Math.round(Number(d.coinValue) || 0)
        if (coinValue > 0) {
          t.set(doc(collection(db, 'journal')), {
            type: 'pengeluaran',
            category: 'beban_promosi',
            amount: coinValue,
            note: 'Penukaran koin · ' + String(d.code || orderId),
            refId: String(d.code || orderId),
            method: 'Koin Warga',
            profit: 0,
            itemCount: 0,
            createdAt: ts,
          })
        }
      }),
      WRITE_TIMEOUT_MS,
      'Selesaikan pesanan',
    )
  },

  cancel: async (orderId) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    const ts = serverTimestamp()
    await withTimeout(
      runTransaction(db, async (t) => {
        const ref = doc(db, 'orders', orderId)
        const snap = await t.get(ref)
        if (!snap.exists()) throw new Error('Pesanan tidak ditemukan')
        const d = snap.data() || {}
        if (d.status !== 'menunggu') throw new Error('Pesanan sudah diproses, tidak dapat dibatalkan')
        ;(d.items || []).forEach((it: DocumentData) => {
          if (it.productId) {
            t.update(doc(db, 'products', it.productId), {
              stock: increment(Number(it.qty) || 0),
              updatedAt: ts,
            })
          }
        })
        const coinBack = Math.round(Number(d.coinUsed) || 0) - Math.round(Number(d.earnedCoins) || 0)
        if (coinBack !== 0 && d.customerId) {
          t.update(doc(db, 'customers', d.customerId), { coins: increment(coinBack) })
        }
        if (d.coinUsed > 0 && d.customerId) {
          t.set(doc(collection(db, 'coin_ledger')), {
            customerId: d.customerId,
            amount: Math.round(d.coinUsed),
            reason: 'tukar',
            label: 'Koin kembali · #' + (d.code || ''),
            detail: 'Pesanan dibatalkan',
            orderId: ref.id,
            createdAt: ts,
          })
        }
        if (d.earnedCoins > 0 && d.customerId) {
          t.set(doc(collection(db, 'coin_ledger')), {
            customerId: d.customerId,
            amount: -Math.round(d.earnedCoins),
            reason: 'belanja',
            label: 'Bonus dibatalkan · #' + (d.code || ''),
            detail: 'Pesanan dibatalkan',
            orderId: ref.id,
            createdAt: ts,
          })
        }
        t.update(ref, { status: 'dibatalkan', updatedAt: ts })
      }),
      WRITE_TIMEOUT_MS,
      'Batalkan pesanan',
    )
  },

  confirmTransfer: async (orderId) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    const ts = serverTimestamp()
    await withTimeout(
      runTransaction(db, async (t) => {
        const ref = doc(db, 'orders', orderId)
        const snap = await t.get(ref)
        if (!snap.exists()) throw new Error('Pesanan tidak ditemukan')
        const d = snap.data() || {}
        if (d.status === 'selesai') return
        if (d.status !== 'menunggu' && d.status !== 'dikemas' && d.status !== 'dikirim') {
          throw new Error('Pesanan tidak dapat diselesaikan')
        }
        /* Laba: harga jual saat checkout − modal saat ini */
        let profit = 0
        let itemCount = 0
        for (const it of (d.items || []) as DocumentData[]) {
          const qty = Number(it.qty) || 0
          itemCount += qty
          let cost = 0
          if (it.productId) {
            const pSnap = await t.get(doc(db, 'products', it.productId))
            if (pSnap.exists()) cost = Math.max(0, Math.round(Number(pSnap.data().costPrice) || 0))
          }
          profit += Math.max(0, Math.round(Number(it.price) || 0) - cost) * qty
        }
        t.update(ref, { status: 'selesai', updatedAt: ts })
        const total = Math.round(Number(d.total) || 0)
        t.set(doc(collection(db, 'journal')), {
          type: 'pemasukan',
          category: 'penjualan',
          amount: total,
          note: 'Penjualan · Online',
          refId: String(d.code || orderId),
          method:
            d.paymentMethod === 'transfer'
              ? 'Transfer'
              : d.fulfillment === 'delivery'
                ? 'COD'
                : 'Bayar di warung',
          profit: profit,
          itemCount: itemCount,
          createdAt: ts,
        })
        const coinValue = Math.round(Number(d.coinValue) || 0)
        if (coinValue > 0) {
          t.set(doc(collection(db, 'journal')), {
            type: 'pengeluaran',
            category: 'beban_promosi',
            amount: coinValue,
            note: 'Penukaran koin · ' + String(d.code || orderId),
            refId: String(d.code || orderId),
            method: 'Koin Warga',
            profit: 0,
            itemCount: 0,
            createdAt: ts,
          })
        }
      }),
      WRITE_TIMEOUT_MS,
      'Konfirmasi transfer',
    )
  },

  rejectTransfer: async (orderId, reason) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    const ref = doc(db, 'orders', orderId)
    const snap = await withTimeout(getDoc(ref), WRITE_TIMEOUT_MS, 'Tolak transfer')
    const d = snap.data() || {}
    if (d.status === 'selesai') throw new Error('Pesanan sudah lunas, tidak dapat ditolak')
    await withTimeout(
      updateDoc(ref, {
        transferStatus: 'rejected',
        transferRejectedAt: serverTimestamp(),
        transferRejectReason: String(reason || ''),
        updatedAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Tolak transfer',
    )
  },

  deleteOrder: async (orderId) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      deleteDoc(doc(getDb(), 'orders', orderId)),
      WRITE_TIMEOUT_MS,
      'Hapus pesanan',
    )
  },
}))

/** Label status pesanan (orderStatusLabel dari js/store/core.js). */
export function orderStatusLabel(raw: string): string {
  return STATUS_LABEL[raw] || raw
}

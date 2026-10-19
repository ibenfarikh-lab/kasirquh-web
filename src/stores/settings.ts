/**
 * KasirQuh React — src/stores/settings.ts
 * Pengaturan toko + fungsi turunan. Pengganti:
 * - applyStoreSettings / saveStoreSettings / startPublicSubs(promos) dari js/store.js
 * - rebuildRiwayat / rebuildPopular / rebuildInbox dari js/store/derived.js
 *
 * Pola: zustand create() dengan state + actions; subscribe() pasang
 * onSnapshot modular dan return unsub; tulis requireOnline() dulu +
 * timeout 30 dtk via withTimeout + pesan error jujur.
 */
import { create } from 'zustand'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore'
import { getDb, requireOnline } from '../lib/firebase'
import { withTimeout, WRITE_TIMEOUT_MS } from '../lib/firestore'
import type { GatewaySlides, HomeSections, Promo, StoreSettings } from '../types'

export interface CoinEvents {
  checkin: boolean
  mission: boolean
  guess: boolean
  spend: boolean
  tangkapDiskon: boolean
  buruDiskon: boolean
}

export interface CoinRewards {
  checkin: number
  mission: number
  guess: number
}

const DEFAULT_GATEWAY_SLIDES: GatewaySlides = {
  title1: 'Hemat belanja, senang di rumah',
  copy1: 'Promo pilihan Warunge Mimi untuk kebutuhan harian keluarga.',
  title2: 'Sembako lengkap, tinggal pilih',
  copy2: 'Minyak, gula, mi, dan kebutuhan dapur siap untuk stok rumah.',
  title3: 'Jajan dan minuman favoritmu',
  copy3: 'Camilan renyah dan minuman segar untuk teman santai kapan saja.',
}

const DEFAULT_HOME_SECTIONS: HomeSections = {
  restock: { show: true, order: 1 },
  popular: { show: true, order: 3 },
  recipe: { show: true, order: 2 },
}

const DEFAULT_COIN_EVENTS: CoinEvents = {
  checkin: true,
  mission: true,
  guess: true,
  spend: true,
  tangkapDiskon: true,
  buruDiskon: true,
}

const DEFAULT_COIN_REWARDS: CoinRewards = { checkin: 25, mission: 250, guess: 100 }

interface SettingsState {
  storeSettings: StoreSettings
  /** Nilai tukar koin (Rp per koin) — dari store_settings/main.coinRate */
  coinRate: number
  /** Batas persen penukaran koin — dari store_settings/main.coinRedeemLimit */
  coinRedeemLimit: number
  /** Ambang stok menipis — dari store_settings/main.lowStockDefault */
  lowStockDefault: number
  coinProgramEnabled: boolean
  coinEvents: CoinEvents
  coinRewards: CoinRewards
  coinSpendReward: number
  coinSpendRule: number
  coinRule: string
  flashProductId: string | null
  flashProductName: string
  flashRule: string
  flashEndsAt: Timestamp | null
  flashPrice: number
  /** Peta harga promo kilat: productId -> harga promo */
  promoUnitPrice: Record<string, number>
  promoTitle: string
  promoProductId: string | null
  promoCopy: string
  gatewaySlides: GatewaySlides
  kabarStatus: string
  kabarMood: string
  homeSections: HomeSections
  carouselSlots: Record<string, string>
  dashboardShortcutIds: string[]
  inboxReadIds: string[]
  storeName: string
  runningText: string
  openTime: string
  closeTime: string
  adminTheme: string
  /** Promo aktif (publik, tarik manual hemat kuota — bukan real-time) */
  promos: Promo[]

  /** Langganan live dokumen store_settings/main. Panggil sekali saat boot. Return unsub. */
  subscribe: () => () => void
  /** true setelah snapshot store_settings/main pertama diterima (settings siap dipakai). */
  settingsLoaded: boolean
  /** Tarik ulang promo aktif (manual, hemat kuota). */
  refreshPromos: () => Promise<void>
  /** Simpan pengaturan toko (admin). Snapshot menerapkan balik otomatis. */
  saveStoreSettings: (patch: DocumentData) => Promise<void>
}

function applySettingsData(d: StoreSettings): Partial<SettingsState> {
  const patch: Partial<SettingsState> = { storeSettings: d }
  if (Array.isArray(d.dashboardShortcutIds) && d.dashboardShortcutIds.length) {
    patch.dashboardShortcutIds = d.dashboardShortcutIds
      .filter((id): id is string => typeof id === 'string')
      .slice(0, 6)
  }
  if (d.carouselSlots && typeof d.carouselSlots === 'object') {
    patch.carouselSlots = d.carouselSlots as Record<string, string>
  }
  if (Array.isArray(d.inboxReadIds)) {
    patch.inboxReadIds = d.inboxReadIds
      .filter((id): id is string => typeof id === 'string')
      .slice(0, 200)
  }
  if (typeof d.coinRate === 'number') patch.coinRate = Math.max(1, Math.round(d.coinRate))
  if (typeof d.coinRedeemLimit === 'number') {
    patch.coinRedeemLimit = Math.min(100, Math.max(0, Math.round(d.coinRedeemLimit)))
  }
  if (typeof d.lowStockDefault === 'number') {
    patch.lowStockDefault = Math.min(99, Math.max(1, Math.round(d.lowStockDefault)))
  }
  /* Program koin: nyala/mati + event + hadiah (live) */
  if (typeof d.coinProgramEnabled === 'boolean') patch.coinProgramEnabled = d.coinProgramEnabled
  const events = d.coinEvents
  if (events && typeof events === 'object') {
    const ev: CoinEvents = { ...(patch.coinEvents ?? DEFAULT_COIN_EVENTS) }
    const src = events as Record<string, unknown>
    ;(['checkin', 'mission', 'guess', 'spend', 'tangkapDiskon', 'buruDiskon'] as const).forEach(
      (k) => {
        if (typeof src[k] === 'boolean') ev[k] = src[k] as boolean
      },
    )
    patch.coinEvents = ev
  }
  const rewards = d.coinRewards
  if (rewards && typeof rewards === 'object') {
    const rw: CoinRewards = { ...(patch.coinRewards ?? DEFAULT_COIN_REWARDS) }
    const src = rewards as Record<string, unknown>
    ;(['checkin', 'mission', 'guess'] as const).forEach((k) => {
      if (typeof src[k] === 'number') rw[k] = Math.max(0, Math.round(src[k] as number))
    })
    patch.coinRewards = rw
  }
  if (typeof d.coinSpendReward === 'number') {
    patch.coinSpendReward = Math.max(0, Math.round(d.coinSpendReward))
  }
  if (typeof d.coinSpendRule === 'number') {
    patch.coinSpendRule = Math.max(1, Math.round(d.coinSpendRule))
  }
  if (typeof d.coinRule === 'string') patch.coinRule = d.coinRule
  /* Promo kilat: produk + harga → peta harga promo (live) */
  const endsAt =
    d.flashEndsAt && typeof (d.flashEndsAt as Timestamp).toDate === 'function'
      ? (d.flashEndsAt as Timestamp)
      : null
  patch.flashEndsAt = endsAt
  /* Auto-off: jika waktu habis, promo mati otomatis */
  const flashExpired =
    endsAt && typeof endsAt.toMillis === 'function' && endsAt.toMillis() <= Date.now()
  const flashId =
    !flashExpired && typeof d.flashProductId === 'string' && d.flashProductId.trim()
      ? d.flashProductId.trim()
      : null
  patch.flashProductId = flashId
  const flashPrice = Number((d as DocumentData).flashPrice) > 0 ? Math.round(Number((d as DocumentData).flashPrice)) : 0
  patch.flashPrice = flashPrice
  patch.promoUnitPrice = flashId && flashPrice > 0 ? { [flashId]: flashPrice } : {}
  if (typeof d.flashRule === 'string') patch.flashRule = d.flashRule
  if (typeof (d as DocumentData).flashProductName === 'string') {
    patch.flashProductName = (d as DocumentData).flashProductName as string
  }
  /* Promo utama + slide gateway + kabar (live) */
  if (typeof d.promoTitle === 'string') patch.promoTitle = d.promoTitle
  if (typeof d.promoProductId === 'string') patch.promoProductId = d.promoProductId || null
  if (typeof d.promoCopy === 'string') patch.promoCopy = d.promoCopy
  const gsText = (v: unknown, fb: string) =>
    typeof v === 'string' && v.trim() ? v : fb
  patch.gatewaySlides = {
    title1: gsText(d.gatewayTitle1, DEFAULT_GATEWAY_SLIDES.title1),
    copy1: gsText(d.gatewayCopy1, DEFAULT_GATEWAY_SLIDES.copy1),
    title2: gsText(d.gatewayTitle2, DEFAULT_GATEWAY_SLIDES.title2),
    copy2: gsText(d.gatewayCopy2, DEFAULT_GATEWAY_SLIDES.copy2),
    title3: gsText(d.gatewayTitle3, DEFAULT_GATEWAY_SLIDES.title3),
    copy3: gsText(d.gatewayCopy3, DEFAULT_GATEWAY_SLIDES.copy3),
  }
  if (typeof d.kabarStatus === 'string') patch.kabarStatus = d.kabarStatus
  if (typeof d.kabarMood === 'string') patch.kabarMood = d.kabarMood
  /* Bagian Beranda (live) */
  const homeSections: HomeSections = {
    restock: { ...(patch.homeSections?.restock ?? DEFAULT_HOME_SECTIONS.restock) },
    popular: { ...(patch.homeSections?.popular ?? DEFAULT_HOME_SECTIONS.popular) },
    recipe: { ...(patch.homeSections?.recipe ?? DEFAULT_HOME_SECTIONS.recipe) },
  }
  ;(['restock', 'popular', 'recipe'] as const).forEach((k) => {
    const sec =
      d.homeSections && (d.homeSections as unknown as Record<string, unknown>)[k]
    if (sec && typeof sec === 'object') {
      const s = sec as Record<string, unknown>
      if (typeof s.show === 'boolean') homeSections[k].show = s.show as boolean
      const ord = Number(s.order)
      if (ord >= 1 && ord <= 3) homeSections[k].order = ord
    }
  })
  patch.homeSections = homeSections
  /* Jam operasional (live, format HH:MM) */
  const hhmm = (v: unknown) =>
    typeof v === 'string' && /^\d{2}:\d{2}$/.test(v.trim()) ? v.trim() : ''
  patch.openTime = hhmm((d as DocumentData).openTime)
  patch.closeTime = hhmm((d as DocumentData).closeTime)
  /* Nama warung + running text (satu sumber) */
  const raw = d as DocumentData
  patch.storeName = (String(raw.storeName || 'Warunge Mimi')).trim() || 'Warunge Mimi'
  if (typeof raw.runningText === 'string') patch.runningText = raw.runningText
  /* Preferensi admin (persist): tema, dering, animasi navigasi */
  const adminTheme = String(raw.adminTheme || '').trim()
  if (['light', 'dark', 'system'].indexOf(adminTheme) >= 0) patch.adminTheme = adminTheme
  return patch
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  storeSettings: {},
  coinRate: 1,
  coinRedeemLimit: 50,
  lowStockDefault: 5,
  coinProgramEnabled: true,
  coinEvents: { ...DEFAULT_COIN_EVENTS },
  coinRewards: { ...DEFAULT_COIN_REWARDS },
  coinSpendReward: 1,
  coinSpendRule: 100,
  coinRule: '',
  flashProductId: null,
  flashProductName: '',
  flashRule: '',
  flashEndsAt: null,
  flashPrice: 0,
  promoUnitPrice: {},
  promoTitle: '',
  promoProductId: null,
  promoCopy: '',
  gatewaySlides: { ...DEFAULT_GATEWAY_SLIDES },
  kabarStatus: '',
  kabarMood: '',
  homeSections: {
    restock: { ...DEFAULT_HOME_SECTIONS.restock },
    popular: { ...DEFAULT_HOME_SECTIONS.popular },
    recipe: { ...DEFAULT_HOME_SECTIONS.recipe },
  },
  carouselSlots: {},
  dashboardShortcutIds: ['kasir', 'inbox', 'bookkeeping'],
  inboxReadIds: [],
  storeName: 'Warunge Mimi',
  settingsLoaded: false,
  runningText: '',
  openTime: '',
  closeTime: '',
  adminTheme: 'dark',
  promos: [],

  subscribe: () => {
    const unsub = onSnapshot(
      doc(getDb(), 'store_settings', 'main'),
      (snap) => {
        const data = (snap.exists() ? snap.data() : null) as StoreSettings | null
        set({ ...applySettingsData(data || {}), settingsLoaded: true })
      },
      (err) => {
        console.error('[KasirQuh] langganan "store_settings" gagal:', err)
      },
    )
    return unsub
  },

  refreshPromos: async () => {
    try {
      const snap = await getDocs(
        query(collection(getDb(), 'promos'), where('isActive', '==', true)),
      )
      const promos = snap.docs.map((d) => {
        const data = d.data() || {}
        return {
          id: d.id,
          title: String(data.title || ''),
          copy: String(data.copy || ''),
          active: data.isActive !== false,
          productId: data.productId ? String(data.productId) : undefined,
          price: data.price != null ? Math.round(Number(data.price) || 0) : undefined,
        } as Promo
      })
      set({ promos })
    } catch (err) {
      console.error('[KasirQuh] muat "promos" gagal:', err)
    }
  },

  saveStoreSettings: async (patch) => {
    requireOnline()
    await withTimeout(
      setDoc(
        doc(getDb(), 'store_settings', 'main'),
        { updatedAt: serverTimestamp(), ...(patch || {}) },
        { merge: true },
      ),
      WRITE_TIMEOUT_MS,
      'Simpan pengaturan',
    )
  },
}))

/* ================= fungsi turunan (dari js/store/derived.js) ================= */

export interface RiwayatItem {
  productId: string
  terakhirDibeli: string
  qty: number
}

interface OrderLike {
  stockLines?: { productId: string; qty: number }[]
  _dateKey?: string
  status?: string
}

/** Riwayat belanja pelanggan: produk unik dari stockLines pesanan sendiri. */
export function rebuildRiwayat(orders: OrderLike[]): RiwayatItem[] {
  const byProduct: Record<string, RiwayatItem> = {}
  ;(orders || []).forEach((order) => {
    ;(order.stockLines || []).forEach((line) => {
      if (!line.productId || byProduct[line.productId]) return
      byProduct[line.productId] = {
        productId: line.productId,
        terakhirDibeli: order._dateKey || '',
        qty: line.qty,
      }
    })
  })
  return Object.values(byProduct)
}

export interface PopularItem {
  productId: string
  totalTerjual: number
}

interface ProductLike {
  id: string
  totalTerjual?: number
}

/**
 * Produk terlaris.
 * - Admin: agregat dari pesanan + counter totalTerjual produk; kembalikan juga
 *   top8 (8 terlaris) agar pemanggil bisa persist ke store_settings bila berubah.
 * - Tamu/pelanggan: pakai agregat admin (topProductIds) bila sudah dihitung.
 */
export function rebuildPopular(
  orders: OrderLike[],
  products: ProductLike[],
  isAdmin: boolean,
  topProductIds: string[],
): { popular: PopularItem[]; top8: string[] } {
  const agg: Record<string, number> = {}
  let top8: string[] = []
  if (isAdmin) {
    ;(orders || []).forEach((order) => {
      ;(order.stockLines || []).forEach((line) => {
        if (line.productId) agg[line.productId] = (agg[line.productId] || 0) + line.qty
      })
    })
    ;(products || []).forEach((prod) => {
      const t = Number(prod.totalTerjual) || 0
      if (t > 0 && prod.id) agg[prod.id] = (agg[prod.id] || 0) + t
    })
    top8 = Object.entries(agg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([pid]) => pid)
  } else {
    ;(topProductIds || []).forEach((pid, i) => {
      agg[pid] = 1000 - i
    })
  }
  const popular = Object.entries(agg).map(([productId, totalTerjual]) => ({
    productId,
    totalTerjual,
  }))
  return { popular, top8 }
}

export interface InboxSeed {
  pendingCustomers: { id: string; name: string; meta: string; status: string }[]
  activeOrders: { id: string; name: string; time: string }[]
  titipBaru: { id: string; item: string; customerName: string; time: string }[]
  lowStockProducts: { id: string; name: string; stock: number }[]
  unreadThreads: { id: string; name: string }[]
  localItems: InboxItem[]
  readIds: string[]
  lowStockThreshold: number
}

export interface InboxItem {
  id: string
  kind: string
  icon: string
  title: string
  time: string
  target: string
  read: boolean
}

/**
 * Inbox admin: diturunkan dari koleksi live (bukan notifikasi siluman).
 * Item lokal sesi (titip/share) dipertahankan; status "dibaca" ikut
 * dipertahankan antar rebuild.
 */
export function buildInboxItems(seed: InboxSeed): InboxItem[] {
  const localKinds = ['titip', 'share']
  const prevRead: Record<string, boolean> = {}
  ;(seed.localItems || []).forEach((x) => {
    if (x && x.read) prevRead[x.id] = true
  })
  const local = (seed.localItems || []).filter((x) => x && localKinds.indexOf(x.kind) >= 0)
  const persisted = new Set(seed.readIds || [])
  const read = (id: string) => !!prevRead[id] || persisted.has(id)
  const derived: InboxItem[] = []

  ;(seed.pendingCustomers || [])
    .filter((x) => x.status !== 'rejected')
    .forEach((x) => {
      derived.push({
        id: 'notif-signup-' + x.id,
        kind: 'signup',
        icon: 'user',
        title: 'Pendaftaran ' + x.name + ' menunggu persetujuan',
        time: x.meta || 'Baru saja',
        target: 'approvals',
        read: read('notif-signup-' + x.id),
      })
    })
  ;(seed.activeOrders || []).slice(0, 20).forEach((o) => {
    derived.push({
      id: 'order-' + o.id,
      kind: 'order',
      icon: 'bag',
      title: '#' + o.id + ' · ' + o.name,
      time: o.time,
      target: 'online',
      read: read('order-' + o.id),
    })
  })
  ;(seed.titipBaru || []).slice(0, 20).forEach((r) => {
    derived.push({
      id: 'titip-' + r.id,
      kind: 'titip',
      icon: 'bag',
      title: 'Titipan · ' + r.item + ' (' + r.customerName + ')',
      time: r.time || 'Baru saja',
      target: 'dashboard',
      read: read('titip-' + r.id),
    })
  })
  ;(seed.lowStockProducts || [])
    .filter((p) => p.stock <= seed.lowStockThreshold)
    .slice(0, 20)
    .forEach((p) => {
      derived.push({
        id: 'notif-stock-' + p.id,
        kind: 'stock',
        icon: 'box',
        title: 'Stok menipis · ' + p.name + ' (sisa ' + p.stock + ')',
        time: 'Perlu dikulak',
        target: 'produk',
        read: read('notif-stock-' + p.id),
      })
    })
  ;(seed.unreadThreads || []).forEach((t) => {
    derived.push({
      id: 'notif-chat-' + t.id,
      kind: 'chat',
      icon: 'chat',
      title: 'Chat baru dari ' + t.name,
      time: 'Baru saja',
      target: 'chat',
      read: read('notif-chat-' + t.id),
    })
  })

  return [...local, ...derived]
}

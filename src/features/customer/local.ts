/**
 * KasirQuh React — src/features/customer/local.ts
 *
 * LAPISAN ADAPTER (dulu: store interim).
 *
 * Hook-hook di bawah ini MENERUSKAN ke store resmi di src/stores/* —
 * tidak ada langganan Firestore ganda, tidak ada data tiruan lokal.
 * Semua baca/tulis data kini lewat:
 *   sesi     -> useAuthStore      (src/stores/auth.ts)
 *   settings -> useSettingsStore  (src/stores/settings.ts)
 *   koin     -> usePromoStore     (src/stores/promo.ts)
 *   pesanan  -> useOrdersStore    (src/stores/orders.ts)
 *   chat     -> useChatStore      (src/stores/chat.ts)
 *   resep/patungan/paket -> useCatalogStore (src/stores/catalog.ts)
 *   catatan  -> useNotesStore     (src/stores/notes.ts)
 *
 * Helper murni + useRoutinesLocal (jadwal rutin memang disimpan lokal
 * di perangkat, sesuai perilaku aplikasi lama) tetap tinggal di sini.
 */
import {
  useAuthStore,
  type MyCustomerDoc,
} from '../../stores/auth'
import { useSettingsStore } from '../../stores/settings'
import { usePromoStore } from '../../stores/promo'
import { useCustomersStore } from '../../stores/customers'
import {
  useOrdersStore,
  type ActiveOrderInfo as OfficialActiveOrderInfo,
  type OrderRecord,
} from '../../stores/orders'
import { useChatStore } from '../../stores/chat'
import { useCatalogStore } from '../../stores/catalog'
import { useNotesStore } from '../../stores/notes'
import { toast } from '../../components/ui'
import { numericValue } from '../../lib/format'
import type {
  CartMap,
  CoinEntry,
  CustomerNote,
  Order,
  OrderItem,
  Patungan,
  Product,
  Recipe,
  Routine,
  RumpiMessage,
  ServicePackage,
  SessionRole,
  StoreSettings,
  ThreadMessage,
} from '../../types'
import { todayKeyJakarta } from '../../lib/firestore'
import { create } from 'zustand'

/* ================= tipe lokal (kompatibilitas) ================= */

export interface ActiveOrderInfo {
  id: string
  customerId: string | null
  status: string
  detail: string
  method: string
  step: number
}

export interface CustomerSettings extends StoreSettings {
  coinProgramEnabled: boolean
  coinValue: number
  coinRedeemPercent: number
  coinEvents: Record<string, boolean>
  coinRewards: { checkin: number; mission: number; guess: number; spend: number }
  coinSpendRule: number
  promoUnitPrice: Record<string, number>
  rutinPackages: ServicePackage[]
  hajatanPackages: ServicePackage[]
}

/* ================= helper murni (port verbatim) ================= */

/** Port Store.customerUnitPrice (js/store/core.js): grosir bila qty capai batas. */
export function customerUnitPrice(
  p: Product,
  qty: number,
  promoUnitPrice: Record<string, number> = {},
): number {
  const base = promoUnitPrice[p.id] || p.price || 0
  if (p.wholesaleQty && qty >= p.wholesaleQty) {
    return Math.min(base, p.wholesalePrice || base)
  }
  return base
}

export interface CartTotals {
  gross: number
  total: number
  discount: number
}

/** Port cartTotals() (js/features/customer/cart.js). */
export function cartTotals(
  cart: CartMap,
  products: Product[],
  promoUnitPrice: Record<string, number> = {},
): CartTotals {
  let gross = 0
  let total = 0
  for (const [id, q] of Object.entries(cart)) {
    if (q <= 0) continue
    const p = products.find((x) => x.id === id)
    if (!p) continue
    gross += p.price * q
    total += customerUnitPrice(p, q, promoUnitPrice) * q
  }
  return { gross, total, discount: gross - total }
}

export interface StockIssue {
  product?: Product
  qty: number
}

/** Port cartStockIssue() (js/app.js baris 71). */
export function cartStockIssue(cart: CartMap, products: Product[]): StockIssue | null {
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue
    const product = products.find((p) => p.id === id)
    if (!product || product.stock < qty) return { product, qty }
  }
  return null
}

/** Port purchaseAgeLabel() (js/features/customer/home.js). */
export function purchaseAgeLabel(dateKey: string): string {
  const today = new Date(todayKeyJakarta() + 'T12:00:00+07:00')
  const purchaseDate = new Date(dateKey + 'T12:00:00+07:00')
  const days = Math.max(0, Math.round((today.getTime() - purchaseDate.getTime()) / 86400000))
  return days === 0 ? 'Dibeli hari ini' : days === 1 ? 'Dibeli kemarin' : 'Dibeli ' + days + ' hari lalu'
}

/** Port weekKeyOf() (js/features/customer/coins.js). */
export function weekKeyOf(date: Date): string {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dow = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dow + 3)
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  return (
    t.getUTCFullYear() + '-W' + String(Math.ceil(((t.getTime() - first.getTime()) / 86400000 + 1) / 7)).padStart(2, '0')
  )
}

/** Port updatePremiumHeader() — sapaan per jam (js/features/customer/home.js). */
export function greetingForHour(h: number): string {
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam'
}

/** Port logika buka/tutup toko (js/features/customer/home.js). */
export function isOpenNow(openTime: string, closeTime: string, now = new Date()): boolean {
  const toMin = (t: string): number | null => {
    const m = String(t).match(/(\d{1,2}):(\d{2})/)
    return m ? Number(m[1]) * 60 + Number(m[2]) : null
  }
  const cur = now.getHours() * 60 + now.getMinutes()
  const oMin = toMin(openTime)
  const cMin = toMin(closeTime)
  if (oMin === null || cMin === null) return true
  return oMin <= cMin ? cur >= oMin && cur < cMin : cur >= oMin || cur < cMin
}

/** Port routineNextDate() (js/features/customer/services.js). */
export function routineNextDate(routine: Routine): Date {
  const now = new Date()
  if (routine.interval !== 'mingguan') {
    const next = new Date(now)
    next.setDate(next.getDate() + 1)
    return next
  }
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  let diff = (days.indexOf(routine.day) - now.getDay() + 7) % 7
  if (diff === 0) diff = 7
  const next = new Date(now)
  next.setDate(next.getDate() + diff)
  return next
}

/** Port aiReply() (js/features/customer/services.js). */
export function aiReply(
  text: string,
  products: Product[],
  opts: { coinProgramEnabled: boolean; open: boolean },
): string {
  const t = text.toLowerCase()
  const minyak = products.find((p) => p.name.toLowerCase().includes('minyak'))
  const cheapest = products.slice().sort((a, b) => a.price - b.price)[0]
  if (t.includes('minyak') && minyak)
    return `${minyak.name} tersedia ${minyak.stock} ${minyak.unit || 'pcs'}, harganya Rp${minyak.price.toLocaleString('id-ID')}.`
  if (t.includes('murah') && cheapest)
    return `${cheapest.name} paling murah, Rp${cheapest.price.toLocaleString('id-ID')}.`
  if (t.includes('promo'))
    return opts.coinProgramEnabled
      ? 'Koin Warga aktif dan bisa ditukar saat checkout.'
      : 'Program Koin Warga sedang dimatikan warung.'
  if (t.includes('buka') || t.includes('tutup')) return opts.open ? 'Warung sedang buka.' : 'Warung sedang tutup.'
  return 'Maaf, aku belum paham. Coba tanya soal stok, harga termurah, promo, atau jam buka.'
}

/* ================= session -> useAuthStore ================= */

export interface SessionLocalState {
  role: SessionRole
  name: string | null
  customerId: string | null
  isGuest: boolean
  email: string | null
  photoURL: string
  wa: string
  address: string
  setSession: (patch: Partial<SessionLocalState>) => void
  enterGuest: () => void
  clearSession: () => void
}

function docStr(doc: MyCustomerDoc | null, key: string): string {
  const v = doc?.[key]
  return typeof v === 'string' ? v : ''
}

export function useSessionLocal<T = SessionLocalState>(
  selector: (s: SessionLocalState) => T = (s) => s as unknown as T,
): T {
  const session = useAuthStore((s) => s.session)
  const myCustomerDoc = useAuthStore((s) => s.myCustomerDoc)
  const state: SessionLocalState = {
    role: session.role,
    name: session.name ?? docStr(myCustomerDoc, 'name') ?? null,
    customerId: session.customerId,
    isGuest: session.isGuest,
    email: session.email,
    photoURL: docStr(myCustomerDoc, 'photoURL'),
    wa: docStr(myCustomerDoc, 'wa'),
    address: docStr(myCustomerDoc, 'address'),
    setSession: (patch) => {
      // Kompat: penulisan profil diteruskan ke dokumen customers/{uid}.
      const uid = useAuthStore.getState().session.customerId
      if (!uid) return
      const doc: Record<string, unknown> = {}
      if (patch.photoURL !== undefined) doc.photoURL = patch.photoURL
      if (patch.name !== undefined) doc.name = patch.name
      if (patch.wa !== undefined) doc.wa = patch.wa
      if (patch.address !== undefined) doc.address = patch.address
      if (Object.keys(doc).length) {
        void useCustomersStore.getState().saveCustomerDoc(doc)
      }
    },
    enterGuest: () => useAuthStore.getState().resetToGuest(),
    clearSession: () => void useAuthStore.getState().logout(),
  }
  return selector(state)
}

/* ================= settings -> useSettingsStore (+ katalog) ================= */

interface SettingsLocalState {
  settings: CustomerSettings
  setSettings: (patch: Partial<CustomerSettings>) => void
}

export function useSettingsLocal<T = SettingsLocalState>(
  selector: (s: SettingsLocalState) => T = (s) => s as unknown as T,
): T {
  const st = useSettingsStore()
  const rutinPackages = useCatalogStore((s) => s.rutinPackages)
  const hajatanPackages = useCatalogStore((s) => s.hajatanPackages)
  const gs = st.gatewaySlides
  const settings: CustomerSettings = {
    ...st.storeSettings,
    openTime: st.openTime,
    closeTime: st.closeTime,
    gatewayTitle1: gs.title1,
    gatewayCopy1: gs.copy1,
    gatewayTitle2: gs.title2,
    gatewayCopy2: gs.copy2,
    gatewayTitle3: gs.title3,
    gatewayCopy3: gs.copy3,
    coinProgramEnabled: st.coinProgramEnabled,
    coinRate: st.coinRate,
    coinRule: st.coinRule,
    coinRedeemLimit: st.coinRedeemLimit,
    coinValue: st.coinRate,
    coinRedeemPercent: st.coinRedeemLimit,
    coinEvents: st.coinEvents as unknown as Record<string, boolean>,
    coinRewards: {
      checkin: st.coinRewards.checkin,
      mission: st.coinRewards.mission,
      guess: st.coinRewards.guess,
      spend: st.coinSpendReward,
    },
    coinSpendRule: st.coinSpendRule,
    flashProductId: st.flashProductId,
    flashRule: st.flashRule,
    flashEndsAt: st.flashEndsAt,
    promoUnitPrice: st.promoUnitPrice,
    kabarStatus: st.kabarStatus,
    kabarMood: st.kabarMood,
    homeSections: st.homeSections,
    carouselSlots: st.carouselSlots,
    rutinPackages: rutinPackages as unknown as ServicePackage[],
    hajatanPackages: hajatanPackages as unknown as ServicePackage[],
  }
  return selector({
    settings,
    // Pengaturan toko hanya diubah admin lewat sheet admin; sisi pelanggan read-only.
    setSettings: () => {},
  })
}

/* ================= koin -> usePromoStore ================= */

export interface CoinGrantEntry {
  label: string
  detail?: string
  claimKey?: string
  reason?: string
  dateField?: string
  todayField?: string
}

interface CoinLocalState {
  balance: number
  history: CoinEntry[]
  missionClaims: Record<string, boolean>
  lastCheckin: string
  grant: (amount: number, entry: CoinGrantEntry) => void
  setLastCheckin: (key: string) => void
}

export function useCoinLocal<T = CoinLocalState>(
  selector: (s: CoinLocalState) => T = (s) => s as unknown as T,
): T {
  const coinBalance = usePromoStore((s) => s.coinBalance)
  const coinHistory = usePromoStore((s) => s.coinHistory)
  const myCustomerDoc = useAuthStore((s) => s.myCustomerDoc)
  const state: CoinLocalState = {
    balance: coinBalance,
    history: coinHistory,
    missionClaims: (myCustomerDoc?.missionClaims as Record<string, boolean> | undefined) ?? {},
    lastCheckin: docStr(myCustomerDoc, 'lastCheckin'),
    grant: (amount, entry) => {
      if (entry.claimKey) {
        // Hadiah misi/tebak-harga -> klaim resmi (idempoten per claimKey).
        // Teruskan amount & reason agar tidak tertukar (mis. tebak harga pakai reward guess).
        void usePromoStore.getState().claimMission(entry.detail || entry.label, entry.claimKey, {
          amount: amount,
          reason: entry.reason || 'misi',
          label: entry.label,
        })
        return
      }
      // Hadiah game -> grantGameCoins resmi (cap 500/hari).
      const uid = useAuthStore.getState().session.customerId
      if (!uid) {
        toast('Masuk dulu untuk klaim koin')
        return
      }
      void useCustomersStore
        .getState()
        .grantGameCoins(uid, amount, {
          label: entry.detail ? entry.label + ' · ' + entry.detail : entry.label,
          reason: entry.reason,
          dateField: entry.dateField,
          todayField: entry.todayField,
        })
        .then((r) => {
          if (r.granted > 0) toast('+' + r.granted + ' Koin Warga')
          else if (r.capped) toast('Batas 500 koin game/hari tercapai')
        })
        .catch((e: unknown) => {
          toast(e instanceof Error ? e.message : 'Gagal klaim koin')
        })
    },
    // Check-in kini lewat usePromoStore().checkin() — lihat AccountPage.
    setLastCheckin: () => {},
  }
  return selector(state)
}

/* ================= pesanan -> useOrdersStore ================= */

/** Konversi OrderRecord (tuple items) -> Order (objek items). Dipakai juga adapter admin. */
export function recordToOrder(r: OrderRecord): Order {
  return {
    id: r.id,
    docId: r.docId,
    rawStatus: r.rawStatus,
    dateKey: r.dateKey,
    status: r.status,
    time: r.time,
    name: r.name,
    customerId: r.customerId,
    wa: r.wa,
    address: r.address,
    method: r.method,
    transferStatus: r.transferStatus,
    transferReference: r.transferReference,
    items: r.items.map(
      ([name, qty, subtotal, productId]): OrderItem => ({
        name,
        qty: parseFloat(qty) || 0,
        subtotal: numericValue(subtotal),
        productId,
      }),
    ),
    total: r.total,
    fullTotal: r.fullTotal,
    coinUsed: r.coinUsed,
    coinValue: r.coinValue,
    earnedCoins: r.earnedCoins,
    stockLines: r.stockLines,
    cancelConfirm: r.cancelConfirm,
  }
}

function orderToRecord(o: Order): OrderRecord {
  return {
    id: o.id,
    docId: o.docId,
    rawStatus: o.rawStatus,
    dateKey: o.dateKey,
    status: o.status,
    time: o.time,
    name: o.name,
    customerId: o.customerId,
    wa: o.wa,
    address: o.address,
    method: o.method,
    transferStatus: o.transferStatus,
    transferReference: o.transferReference,
    items: o.items.map(
      (it): [string, string, string, string] => [
        it.name,
        String(it.qty) + 'x',
        'Rp' + Math.round(it.subtotal).toLocaleString('id-ID'),
        it.productId,
      ],
    ),
    total: o.total,
    fullTotal: o.fullTotal,
    coinUsed: o.coinUsed,
    coinValue: o.coinValue,
    earnedCoins: o.earnedCoins,
    stockDeducted: true,
    stockLines: o.stockLines,
    cancelConfirm: o.cancelConfirm,
  }
}

interface OrdersLocalState {
  activeOrder: ActiveOrderInfo | null
  history: Order[]
  setActiveOrder: (o: ActiveOrderInfo | null) => void
  prependHistory: (o: Order) => void
}

export function useOrdersLocal<T = OrdersLocalState>(
  selector: (s: OrdersLocalState) => T = (s) => s as unknown as T,
): T {
  const activeOrder = useOrdersStore((s) => s.activeOrder)
  const onlineOrders = useOrdersStore((s) => s.onlineOrders)
  const state: OrdersLocalState = {
    activeOrder: activeOrder as ActiveOrderInfo | null,
    history: onlineOrders.map(recordToOrder),
    setActiveOrder: (o) =>
      useOrdersStore.setState({ activeOrder: o as OfficialActiveOrderInfo | null }),
    // Langganan Firestore menambahkan pesanan resmi; prepend di sini untuk UI instan.
    prependHistory: (o) =>
      useOrdersStore.setState((s) => ({
        onlineOrders: [orderToRecord(o), ...s.onlineOrders],
      })),
  }
  return selector(state)
}

/* ================= chat -> useChatStore ================= */

interface ChatLocalState {
  rumpi: RumpiMessage[]
  rumpiUnread: number
  thread: ThreadMessage[]
  threadUnread: number
  threadName: string
  sendRumpi: (text: string, photo?: string, authorName?: string, authorPhoto?: string) => Promise<void>
  likeRumpi: (id: string) => void
  markRumpiSeen: () => void
  sendThreadMessage: (text: string, side?: 'admin' | 'customer', photo?: string) => Promise<void>
  markThreadSeen: () => void
}

export function useChatLocal<T = ChatLocalState>(
  selector: (s: ChatLocalState) => T = (s) => s as unknown as T,
): T {
  const rumpiPosts = useChatStore((s) => s.rumpiPosts)
  const customerThread = useChatStore((s) => s.threads['toko'])
  const getRumpiSeen = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem('rumpiSeenIds') || '[]')) } catch { return new Set() }
  }
  const rumpiUnread = rumpiPosts.filter((m) => !(m as {seed?: boolean}).seed && !getRumpiSeen().has(m.id)).length
  const state: ChatLocalState = {
    rumpi: rumpiPosts,
    rumpiUnread,
    thread: customerThread?.messages ?? [],
    threadUnread: customerThread?.customerUnread ?? 0,
    threadName: customerThread?.name || 'Warunge Mimi',
    sendRumpi: (text, photo) => useChatStore.getState().sendRumpi(text, photo || undefined),
    likeRumpi: (id) => {
      void useChatStore.getState().likeRumpi(id)
    },
    markRumpiSeen: () => {
      try {
        const ids = rumpiPosts.filter((m) => !(m as {seed?: boolean}).seed).map((m) => m.id)
        localStorage.setItem('rumpiSeenIds', JSON.stringify(ids))
      } catch {}
    },
    sendThreadMessage: (text, _side, photo) => useChatStore.getState().sendChatMessage(text, photo),
    markThreadSeen: () => {
      void useChatStore.getState().markThreadRead('toko')
    },
  }
  return selector(state)
}

/* ================= resep & patungan -> useCatalogStore ================= */

interface RecipesLocalState {
  recipes: Recipe[]
  myRecipes: Recipe[]
  addMyRecipe: (r: Recipe) => void
}

export function useRecipesLocal<T = RecipesLocalState>(
  selector: (s: RecipesLocalState) => T = (s) => s as unknown as T,
): T {
  const recipes = useCatalogStore((s) => s.recipes)
  const myRecipes = useCatalogStore((s) => s.myRecipes)
  return selector({
    recipes,
    myRecipes,
    addMyRecipe: (r) => {
      void useCatalogStore
        .getState()
        .saveMyRecipe({ nama: r.nama, desc: r.desc, foto: r.foto, items: r.items })
    },
  })
}

interface PatunganLocalState {
  items: Patungan[]
  join: (id: string, slots: number) => void
}

function toPatungan(p: {
  id: string
  title: string
  productName: string
  pricePerSlot: number
  totalSlots: number
  filledSlots: number
  deadline: string
  note: string
}): Patungan {
  return {
    id: p.id,
    title: p.title,
    product: p.productName,
    price: p.pricePerSlot,
    slots: p.totalSlots,
    joined: p.filledSlots,
    deadline: p.deadline,
    note: p.note,
  }
}

export function usePatunganLocal<T = PatunganLocalState>(
  selector: (s: PatunganLocalState) => T = (s) => s as unknown as T,
): T {
  const patunganList = useCatalogStore((s) => s.patunganList)
  return selector({
    items: patunganList.map(toPatungan),
    join: (id, slots) => {
      void useCatalogStore.getState().joinPatungan(id, slots)
    },
  })
}

/* ================= catatan -> useNotesStore ================= */

interface NotesLocalState {
  notes: CustomerNote[]
  setNotes: (notes: CustomerNote[]) => void
}

export function useNotesLocal<T = NotesLocalState>(
  selector: (s: NotesLocalState) => T = (s) => s as unknown as T,
): T {
  const customerNotesList = useNotesStore((s) => s.customerNotesList)
  return selector({
    notes: customerNotesList,
    // Diisi langganan Firestore (subscribeCustomerNotes); tidak ada penulisan lokal.
    setNotes: () => {},
  })
}

/* ================= jadwal rutin (tetap lokal, sesuai perilaku lama) ================= */

const ROUTINE_KEY = 'kasirquh.routines.v1'

interface RoutinesLocalState {
  routines: Routine[]
  saveRoutines: (list: Routine[]) => void
}

function loadRoutines(): Routine[] {
  try {
    const raw = localStorage.getItem(ROUTINE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

const useRoutinesLocalStore = create<RoutinesLocalState>()((set) => ({
  routines: loadRoutines(),
  saveRoutines: (list) => {
    try {
      localStorage.setItem(ROUTINE_KEY, JSON.stringify(list))
    } catch {
      /* abaikan */
    }
    set({ routines: list })
  },
}))

export function useRoutinesLocal<T = RoutinesLocalState>(
  selector: (s: RoutinesLocalState) => T = (s) => s as unknown as T,
): T {
  return useRoutinesLocalStore(selector)
}

/* ================= kompres foto (port compressPhotoFile / resizeRecipePhoto) ================= */

/**
 * Kompres gambar di client via canvas → data URL.
 * Port compressPhotoFile() (js/features/customer/account.js).
 */
export function compressPhoto(
  file: File,
  max: number,
  type: 'image/jpeg' | 'image/png',
  quality?: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Pilih file gambar'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL(type, quality))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gambar tidak bisa dibaca'))
    }
    img.src = url
  })
}

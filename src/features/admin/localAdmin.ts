/**
 * KasirQuh React — src/features/admin/localAdmin.ts
 *
 * LAPISAN ADAPTER (dulu: store interim milik Worker Admin).
 *
 * Hook `useLocalAdminStore` di bawah ini MENERUSKAN ke store resmi di
 * src/stores/* — tidak ada langganan Firestore ganda, tidak ada data tiruan.
 * Semua baca/tulis data kini lewat:
 *   jurnal/stok   -> useLedgerStore    (src/stores/ledger.ts)
 *   pesanan       -> useOrdersStore    (src/stores/orders.ts)
 *   pelanggan     -> useCustomersStore (src/stores/customers.ts)
 *   catatan/memo  -> useNotesStore     (src/stores/notes.ts)
 *   chat/rumpi    -> useChatStore      (src/stores/chat.ts)
 *   katalog/paket -> useCatalogStore   (src/stores/catalog.ts)
 *   kasir         -> useCheckoutStore  (src/stores/checkout.ts)
 *   pengaturan    -> useSettingsStore  (src/stores/settings.ts)
 *
 * State UI lokal admin (kategori aktif, member kasir, struk terakhir, dsb.)
 * tinggal di useAdminUIStore kecil di bawah. Helper murni + konstanta
 * (AI admin, kalkulator, shortcut dashboard) tetap di file ini.
 */
import { create } from 'zustand'
import type { DocumentData } from 'firebase/firestore'
import { todayKeyJakarta, pad2 } from '../../lib/firestore'
import { money, stockText } from '../../lib/format'
import { useLedgerStore } from '../../stores/ledger'
import { useOrdersStore } from '../../stores/orders'
import { useCustomersStore } from '../../stores/customers'
import { useNotesStore } from '../../stores/notes'
import type { CoinEvents } from '../../stores/settings'

export type { CoinEvents }
import { useChatStore } from '../../stores/chat'
import { useCatalogStore } from '../../stores/catalog'
import { useCheckoutStore } from '../../stores/checkout'
import { useSettingsStore } from '../../stores/settings'
import { useProductsStore } from '../../stores/products'
import { recordToOrder } from '../customer/local'
import type {
  Customer,
  CustomerNote,
  JournalEntry,
  Order,
  PendingCustomer,
  Product,
  RecipeItem,
  RumpiMessage,
  StockNote,
  ThreadMessage,
} from '../../types'

/* ================= Tipe lokal (tidak ada di src/types.ts) ================= */

export interface InboxItem {
  id: string
  kind: 'stock' | 'order' | 'titip' | 'chat' | 'signup' | 'share'
  title: string
  time: string
  read: boolean
  icon: string
  target: string
}

export interface KasirMember {
  uid: string
  name: string
  memberCode: string
  coins: number
}

export interface ReceiptItem {
  name: string
  qty: number
  total: number
}

export interface LastReceipt {
  at: string
  items: ReceiptItem[]
  total: number
  rawTotal: number
  cashReceived: number
  change: number
  redeemCoins: number
  earnedCoins: number
  coinValue: number
  member: { name: string; memberCode: string } | null
}

export interface DirectThread {
  id: string
  name: string
  initial: string
  photoURL: string
  messages: ThreadMessage[]
  unread: number
  customerUnread: number
  lastMessage: string
  /** Millis terakhir thread diperbarui (untuk urutan daftar). */
  updatedAt: number
  /** true bila thread di-pin admin (selalu di urutan teratas). */
  pinned: boolean
  loading: boolean
}

export interface StoreMemo {
  id: string
  title: string
  body: string
  at: string
}

export interface CoinSettingsState {
  enabled: boolean
  value: number
  redeemPercent: number
  events: CoinEvents
  rewards: { checkin: number; mission: number; guess: number }
  spendRule: number
  spendReward: number
  rule: string
}

export interface ServicePackageAdmin {
  id: string
  name: string
  description: string
  items: RecipeItem[]
}

export interface PatunganParticipant {
  customerId: string
  name: string
  slots: number
  paymentStatus: string
  paymentMethod: string
}

export interface PatunganAdmin {
  id: string
  title: string
  productName: string
  pricePerSlot: number
  totalSlots: number
  filledSlots: number
  deadline: string
  note: string
  status: string
  participants: PatunganParticipant[]
}

export interface AdminErrorEntry {
  at: string
  source: string
  message: string
}

export interface RecipeAdmin {
  id: string
  nama: string
  desc: string
  foto: string
  items: RecipeItem[]
}

export interface HomeSectionState {
  show: boolean
  order: number
}

export interface HomeControlState {
  runningText: string
  gatewayTitle1: string
  gatewayCopy1: string
  gatewayTitle2: string
  gatewayCopy2: string
  gatewayTitle3: string
  gatewayCopy3: string
  flashProductId: string | null
  flashPrice: number
  flashRule: string
  kabarStatus: string
  kabarMood: string
  homeSections: { restock: HomeSectionState; popular: HomeSectionState; recipe: HomeSectionState }
  carouselSlots: Record<string, string>
}

export interface TitipRequest {
  id: string
  item: string
  customerName: string
  status: string
  time: string
}

export type JournalPeriod = 'day' | 'week' | 'month'

/* ================= Helper tanggal (mirip Store.dateKeyOf/timeOf/dateTimeOf) ================= */

function tsToDate(ts: unknown): Date {
  const t = ts as { toDate?: () => Date } | null
  try {
    if (t && typeof t.toDate === 'function') return t.toDate()
  } catch {
    /* abaikan */
  }
  return new Date()
}

export function dateKeyOf(ts: unknown): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(tsToDate(ts))
}

export function timeOf(ts: unknown): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(tsToDate(ts))
      .replace('.', ':')
  } catch {
    return ''
  }
}

export function dateTimeOf(ts: unknown): string {
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
      .format(tsToDate(ts))
      .replace('.', ':')
  } catch {
    return 'Baru saja'
  }
}

export function shiftDateKey(key: string, days: number): string {
  const d = new Date(key + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return (
    d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
  )
}

/* ================= Mapper Firestore -> bentuk UI (1:1 js/store/core.js) ================= */


/* ================= Kalkulasi murni (1:1 js/features/admin/finance.js) ================= */

export function entriesForPeriod(
  entries: JournalEntry[],
  period: JournalPeriod,
  todayKey: string,
): JournalEntry[] {
  const today = new Date(todayKey + 'T12:00:00')
  return entries.filter((entry) => {
    const date = new Date(entry.date + 'T12:00:00')
    const days = Math.floor((today.getTime() - date.getTime()) / 86400000)
    if (period === 'day') return days === 0
    if (period === 'week') return days >= 0 && days < 7
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth()
    )
  })
}

export function cashBalance(entries: JournalEntry[]): number {
  return entries.reduce(
    (sum, e) => sum + (e.direction === 'income' ? e.amount : -e.amount),
    0,
  )
}

/* ================= AI Admin murni (1:1 js/features/admin/ai.js) ================= */

export function adminAiStock(products: Product[], lowStockThreshold: number): string {
  const low = products
    .filter((p) => p.stock <= lowStockThreshold)
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name))
  if (!low.length)
    return (
      'Semua stok masih aman. Tidak ada produk pada atau di bawah batas ' +
      lowStockThreshold +
      ' pcs.'
    )
  return (
    'Stok yang perlu dikulak (' +
    low.length +
    '):\n' +
    low.map((p) => '• ' + p.name + ' — sisa ' + p.stock + ' ' + (p.unit || 'pcs')).join('\n')
  )
}

export function adminAiSales(entries: JournalEntry[], todayKey: string): string {
  const sales = entries.filter((x) => x.type === 'Penjualan' && x.date === todayKey)
  if (!sales.length) return 'Belum ada transaksi penjualan hari ini. Omzet dan laba belum memiliki data.'
  const omzet = sales.reduce((s, x) => s + x.amount, 0)
  const laba = sales.reduce((s, x) => s + (x.profit || 0), 0)
  const items = sales.reduce((s, x) => s + (x.itemCount || 0), 0)
  return (
    'Omzet hari ini ' +
    money(omzet) +
    ' dari ' +
    sales.length +
    ' transaksi · ' +
    items +
    ' barang. Laba tercatat ' +
    money(laba) +
    '.'
  )
}

export function adminAiTransactions(entries: JournalEntry[], todayKey: string): string {
  const list = entries.filter((x) => x.date === todayKey)
  if (!list.length) return 'Belum ada transaksi hari ini. Jurnal sesi masih kosong.'
  const shown = list.slice(0, 6)
  const more = list.length - shown.length
  return (
    'Transaksi hari ini (' +
    list.length +
    '):\n' +
    shown
      .map(
        (e) =>
          '• ' +
          e.time +
          ' · ' +
          e.description +
          ' · ' +
          (e.direction === 'income' ? '+' : '−') +
          money(e.amount),
      )
      .join('\n') +
    (more ? '\n• +' + more + ' transaksi lainnya di Pembukuan.' : '')
  )
}

export function adminAiCustomers(pending: PendingCustomer[]): string {
  if (!pending.length) return 'Tidak ada pendaftaran pelanggan baru yang menunggu persetujuan.'
  return (
    pending.length +
    ' pelanggan menunggu persetujuan:\n' +
    pending.map((item) => '• ' + item.name + ' · ' + item.meta).join('\n')
  )
}

export function adminAiCash(entries: JournalEntry[]): string {
  if (!entries.length)
    return 'Belum ada data arus kas. Isi saldo awal atau catat transaksi terlebih dahulu.'
  const income = entries.filter((x) => x.direction === 'income').reduce((s, x) => s + x.amount, 0)
  const expense = entries
    .filter((x) => x.direction === 'expense')
    .reduce((s, x) => s + x.amount, 0)
  const balance = income - expense
  return (
    'Arus kas sesi:\n• Uang masuk ' +
    money(income) +
    '\n• Uang keluar ' +
    money(expense) +
    '\n• Saldo ' +
    money(balance) +
    (balance < 0 ? ' · saldo negatif, periksa pengeluaran.' : '')
  )
}

export function adminAiResponse(
  query: string,
  ctx: {
    products: Product[]
    journalEntries: JournalEntry[]
    pendingCustomers: PendingCustomer[]
    lowStockThreshold: number
    todayKey: string
  },
): string {
  const q = String(query || '')
    .toLocaleLowerCase('id-ID')
    .trim()
  if (!q) return 'Tulis pertanyaan singkat tentang data sesi ini.'
  const named = ctx.products.find(
    (p) =>
      q.includes(p.name.toLocaleLowerCase('id-ID')) ||
      q.includes(p.short.toLocaleLowerCase('id-ID')),
  )
  if (named && /(stok|sisa|tersedia|habis)/.test(q))
    return (
      named.name +
      ' tersisa ' +
      stockText(named) +
      ' ' +
      (named.unit || 'pcs') +
      (named.stock <= ctx.lowStockThreshold
        ? ' · sudah masuk prioritas restok.'
        : ' · stok masih di atas batas menipis ' + ctx.lowStockThreshold + '.')
    )
  if (/transaksi|jurnal|riwayat/.test(q)) return adminAiTransactions(ctx.journalEntries, ctx.todayKey)
  if (/omzet|omset|penjualan|laba|untung/.test(q)) return adminAiSales(ctx.journalEntries, ctx.todayKey)
  if (/stok|restok|kulak|menipis|kritis|habis/.test(q))
    return adminAiStock(ctx.products, ctx.lowStockThreshold)
  if (/arus kas|saldo|kas|uang masuk|uang keluar/.test(q)) return adminAiCash(ctx.journalEntries)
  if (/pelanggan|pendaftaran|warga baru/.test(q)) return adminAiCustomers(ctx.pendingCustomers)
  return 'Saya belum memahami pertanyaan itu. Coba tanyakan “omzet hari ini”, “transaksi apa saja hari ini”, “stok apa yang menipis”, “saldo kas”, atau nama produk tertentu.'
}

/* ================= Kalkulator murni (1:1 js/features/admin/calc.js) ================= */

export function calcDisplayValue(expression: string): string {
  if (!expression) return '0'
  return expression
    .replace(/\d+(?:\.\d+)?/g, (value) =>
      Number(value).toLocaleString('id-ID', { maximumFractionDigits: 2 }),
    )
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/\+/g, ' + ')
    .replace(/-/g, ' − ')
}

export function calcResult(expression: string): number {
  const parts = expression.match(/\d+(?:\.\d+)?|[+\-*/]/g) || []
  if (!parts.length) return 0
  let total = Number(parts[0]) || 0
  for (let i = 1; i < parts.length - 1; i += 2) {
    const op = parts[i]
    const n = Number(parts[i + 1])
    if (!Number.isFinite(n)) continue
    if (op === '+') total += n
    else if (op === '-') total -= n
    else if (op === '*') total *= n
    else if (op === '/' && n !== 0) total /= n
  }
  return Math.round(total * 100) / 100
}

/* ================= Catatan belanja: parsing (1:1 js/features/admin/notes.js) ================= */

function cleanInputLocal(value: unknown): string {
  return String(value || '')
    .replace(/[<>]/g, '')
    .trim()
}

export function purchaseItemParts(item: unknown): { name: string; qty: string } {
  if (item && typeof item === 'object') {
    const o = item as { name?: unknown; qty?: unknown }
    return { name: cleanInputLocal(o.name), qty: cleanInputLocal(o.qty) }
  }
  const text = cleanInputLocal(item)
  if (text.includes('·')) {
    const parts = text.split('·').map(cleanInputLocal).filter(Boolean)
    return { name: parts.shift() || 'Barang', qty: parts.join(' · ') || '1' }
  }
  const match = text.match(
    /^(.*?)[ ]+(\d+(?:[.,]\d+)?(?:[ ]*(?:pcs|dus|krat|renteng|pak|kg|liter|botol|bungkus|sachet|buah))?)$/i,
  )
  return match
    ? { name: cleanInputLocal(match[1]), qty: cleanInputLocal(match[2]) }
    : { name: text, qty: '1' }
}

export function purchaseItemLabel(item: unknown): string {
  const parts = purchaseItemParts(item)
  return parts.name + (parts.qty ? ' · ' + parts.qty : '')
}

/* ================= Shortcut dashboard (1:1 js/store/core.js) ================= */

export interface DashboardShortcutAction {
  kind: 'view' | 'tab' | 'sheet' | 'route'
  value: string
}

export interface DashboardShortcut {
  id: string
  group: string
  label: string
  detail: string
  icon: string
  action: DashboardShortcutAction
}

export const DASHBOARD_SHORTCUT_CATALOG: DashboardShortcut[] = [
  { id: 'kasir', group: 'Pekerjaan utama', label: 'Buka Kasir', detail: 'Transaksi langsung', icon: 'cash', action: { kind: 'view', value: 'kasir' } },
  { id: 'inbox', group: 'Pekerjaan utama', label: 'Cek Inbox', detail: 'Notifikasi terpadu', icon: 'list', action: { kind: 'view', value: 'pesanan' } },
  { id: 'bookkeeping', group: 'Pekerjaan utama', label: 'Pembukuan', detail: 'Kas dan jurnal', icon: 'book', action: { kind: 'view', value: 'bookkeeping' } },
  { id: 'products', group: 'Kelola warung', label: 'Data Produk', detail: 'Stok dan harga', icon: 'box', action: { kind: 'view', value: 'produk' } },
  { id: 'store-profile', group: 'Kelola warung', label: 'Profil Toko', detail: 'Identitas dan jam', icon: 'store', action: { kind: 'view', value: 'profil-toko' } },
  { id: 'customer-home', group: 'Kelola warung', label: 'Beranda Pelanggan', detail: 'Konten pelanggan', icon: 'home', action: { kind: 'view', value: 'kendali-beranda' } },
  { id: 'online', group: 'Kelola warung', label: 'Kasir Online', detail: 'Pesanan pelanggan', icon: 'receipt', action: { kind: 'view', value: 'online' } },
  { id: 'customers', group: 'Kelola warung', label: 'Data Pelanggan', detail: 'Warga dan riwayat', icon: 'users', action: { kind: 'tab', value: 'customers' } },
  { id: 'approvals', group: 'Kelola warung', label: 'Persetujuan', detail: 'Pelanggan baru', icon: 'clock', action: { kind: 'tab', value: 'approvals' } },
  { id: 'reports', group: 'Kelola warung', label: 'Laporan', detail: 'Omzet dan laba', icon: 'bars', action: { kind: 'tab', value: 'reports' } },
  { id: 'chat', group: 'Kelola warung', label: 'Chat & Rumpi', detail: 'Pelanggan dan warga', icon: 'chat', action: { kind: 'view', value: 'chat' } },
  { id: 'purchase-notes', group: 'Kelola warung', label: 'Catatan Belanja', detail: 'Arsip kulakan', icon: 'note', action: { kind: 'view', value: 'note' } },
  { id: 'calculator', group: 'Laci alat', label: 'Kalkulator', detail: 'Hitung cepat', icon: 'calculator', action: { kind: 'route', value: '/admin/kalkulator' } },
  { id: 'scanner', group: 'Laci alat', label: 'Pemindai Barcode', detail: 'Masuk transaksi', icon: 'barcode', action: { kind: 'sheet', value: 'scanner' } },
  { id: 'store-notes', group: 'Laci alat', label: 'Catatan Toko', detail: 'Pengingat internal', icon: 'note', action: { kind: 'view', value: 'catatan-toko' } },
  { id: 'stock-shopping', group: 'Laci alat', label: 'Belanja Stok', detail: 'Daftar kulakan', icon: 'cart', action: { kind: 'view', value: 'belanja-stok' } },
  { id: 'admin-ai', group: 'Laci alat', label: 'AI Admin', detail: 'Ringkas dan saran', icon: 'spark', action: { kind: 'view', value: 'ai-admin' } },
  { id: 'transfer', group: 'Laci alat', label: 'Konfirmasi Transfer', detail: 'Verifikasi pembayaran', icon: 'bank', action: { kind: 'route', value: '/admin/transfer' } },
  { id: 'receipt', group: 'Laci alat', label: 'Struk 58mm', detail: 'Transaksi terakhir', icon: 'receipt', action: { kind: 'route', value: '/admin/struk/terakhir' } },
  { id: 'settings', group: 'Pengaturan', label: 'Pengaturan Global', detail: 'Tampilan dan akun', icon: 'gear', action: { kind: 'view', value: 'pengaturan' } },
]


interface LocalAdminState {
  todayKey: string
  journalEntries: JournalEntry[]
  journalPeriod: JournalPeriod
  lowStockThreshold: number
  onlineOrders: Order[]
  customerData: Customer[]
  pendingCustomers: PendingCustomer[]
  adminCustomerNotes: CustomerNote[]
  purchaseNotes: Record<string, StockNote[]>
  activePurchaseDate: string
  rumpiMessages: RumpiMessage[]
  directThreads: Record<string, DirectThread>
  activeDirectThread: string | null
  storeMemos: StoreMemo[]
  titipRequests: TitipRequest[]
  inboxItems: InboxItem[]
  inboxReadIds: string[]
  /** ID thread chat yang di-pin (urutan = prioritas). */
  pinnedChatIds: string[]
  /** Pin/unpin thread chat pelanggan. */
  togglePinChat: (id: string) => void
  shortcutIds: string[]
  shortcutEdit: boolean
  kasirMember: KasirMember | null
  kasirRedeem: boolean
  lastReceipt: LastReceipt | null
  adminCat: string
  coin: CoinSettingsState
  storeName: string
  openTime: string
  closeTime: string
  rutinPackages: ServicePackageAdmin[]
  hajatanPackages: ServicePackageAdmin[]
  patunganList: PatunganAdmin[]
  recipes: RecipeAdmin[]
  homeControl: HomeControlState
  errorLog: AdminErrorEntry[]

  /* langganan */
  subscribeAll: () => () => void
  subscribeJournal: () => () => void
  subscribeOrders: () => () => void
  subscribeCustomers: () => () => void
  subscribeRumpi: () => () => void
  subscribeChatThreads: () => () => void
  subscribeMemos: () => () => void
  subscribeSettings: () => () => void
  subscribeTitip: () => () => void
  subscribeAdminNotes: () => () => void
  subscribePackages: () => () => void
  subscribeRecipes: () => () => void
  watchThreadMessages: (threadId: string) => () => void

  /* aksi tulis */
  saveStoreSettings: (patch: DocumentData) => Promise<void>
  recordJournal: (entry: {
    direction: 'income' | 'expense'
    type: string
    description: string
    amount: number
    source?: string
    method?: string
    profit?: number
    itemCount?: number
  }) => Promise<void>
  saveRestock: (payload: {
    supplier: string
    items: {
      productId: string | null
      name: string
      qtyPcs: number
      unitCost: number
      lineTotal: number
      costChoice: string
      salePrice: number
    }[]
    total: number
  }) => Promise<void>
  addManualPurchaseNote: (input: { supplier: string; items: string[]; total: number }) => Promise<void>
  updateStockNote: (
    docId: string,
    input: { supplier: string; items: { name: string; qty: string }[]; total: number },
  ) => Promise<void>
  deleteStockNote: (docId: string) => Promise<void>
  loadStockNotes: (dateKey: string) => Promise<number>
  completeCashSale: (input: {
    lines: { productId: string; qty: number; name: string; total: number }[]
    total: number
    profit: number
    itemCount: number
    redeemCoins: number
    earnedCoins: number
  }) => Promise<void>
  settleOrder: (docId: string) => Promise<void>
  rejectTransfer: (docId: string, reason?: string) => Promise<void>
  setOrderStatus: (docId: string, status: 'dikemas' | 'dikirim') => Promise<void>
  cancelOrder: (docId: string) => Promise<void>
  deleteOrder: (docId: string) => Promise<void>
  approveCustomer: (id: string) => Promise<void>
  rejectCustomer: (id: string) => Promise<void>
  identifyMemberByCode: (code: string) => Promise<KasirMember | null>
  adjustCoins: (uid: string, delta: number, detail: string) => Promise<void>
  grantBonusToAll: (amount: number, reason: string) => Promise<number>
  addCustomerNote: (input: {
    customerId: string
    type: string
    amount: number
    note: string
    date: string
  }) => Promise<void>
  addStoreMemo: (input: { title: string; body: string }) => Promise<void>
  deleteStoreMemo: (id: string) => Promise<void>
  sendRumpi: (text: string, photo: string) => Promise<void>
  deleteRumpi: (id: string) => Promise<void>
  likeRumpi: (id: string) => Promise<void>
  sendChatMessage: (threadId: string, text: string) => Promise<void>
  markThreadRead: (threadId: string) => Promise<void>
  setTitipStatus: (docId: string, status: string) => Promise<void>
  saveRutinPackage: (data: { name: string; description: string; items: RecipeItem[] }, id: string | null) => Promise<void>
  deleteRutinPackage: (id: string) => Promise<void>
  saveHajatanPackage: (data: { name: string; description: string; items: RecipeItem[] }, id: string | null) => Promise<void>
  deleteHajatanPackage: (id: string) => Promise<void>
  createPatungan: (data: {
    title: string
    productName: string
    pricePerSlot: number
    totalSlots: number
    deadline: string
    note: string
  }) => Promise<void>
  saveRecipe: (
    data: { nama: string; desc: string; foto: string; items: RecipeItem[] },
    id: string | null,
  ) => Promise<void>
  deleteRecipe: (id: string) => Promise<void>
  setPatunganStatus: (id: string, status: string) => Promise<void>
  confirmPatunganPayment: (patunganId: string, customerId: string) => Promise<void>

  /* aksi lokal */
  setJournalPeriod: (p: JournalPeriod) => void
  setLowStockThreshold: (n: number) => void
  setActivePurchaseDate: (d: string) => void
  setAdminCat: (c: string) => void
  setKasirMember: (m: KasirMember | null) => void
  setKasirRedeem: (v: boolean) => void
  setLastReceipt: (r: LastReceipt | null) => void
  setActiveDirectThread: (id: string | null) => void
  openThread: (id: string) => void
  rebuildInbox: (products: Product[]) => void
  markAllInboxRead: () => void
  markInboxGroupRead: (kind: InboxItem['kind']) => void
  markInboxItemRead: (id: string) => void
  toggleShortcutEdit: () => void
  addShortcut: (id: string) => void
  removeShortcut: (id: string) => void
  logError: (source: string, message: string) => void
  clearErrorLog: () => void
}


/* =====================================================================
 * LAPISAN ADAPTER — pengganti implementasi mega-store interim.
 * useLocalAdminStore(selector) meneruskan ke store resmi; tidak ada
 * langganan Firestore di sini (diorkestrasi useAuthStore per peran).
 * ===================================================================== */

const INBOX_READ_KEY = 'kqh_inbox_read'
const SHORTCUT_KEY = 'kqh_dashboard_shortcut_ids'
const PINNED_CHAT_KEY = 'kqh_pinned_chats'


/* ---------- state UI lokal admin (bukan data Firestore) ---------- */

interface AdminUIState {
  adminCat: string
  kasirMember: KasirMember | null
  kasirRedeem: boolean
  lastReceipt: LastReceipt | null
  journalPeriod: JournalPeriod
  activePurchaseDate: string
  shortcutEdit: boolean
  errorLog: AdminErrorEntry[]
  setAdminCat: (c: string) => void
  setKasirMember: (m: KasirMember | null) => void
  setKasirRedeem: (v: boolean) => void
  setLastReceipt: (r: LastReceipt | null) => void
  setJournalPeriod: (p: JournalPeriod) => void
  setActivePurchaseDate: (d: string) => void
  setShortcutEdit: (v: boolean) => void
  logError: (source: string, message: string) => void
  clearErrorLog: () => void
}

const useAdminUIStore = create<AdminUIState>()((set) => ({
  adminCat: 'Semua',
  kasirMember: null,
  kasirRedeem: false,
  lastReceipt: null,
  journalPeriod: 'day',
  activePurchaseDate: todayKeyJakarta(),
  shortcutEdit: false,
  errorLog: [],
  setAdminCat: (c) => set({ adminCat: c }),
  setKasirMember: (m) => set({ kasirMember: m }),
  setKasirRedeem: (v) => set({ kasirRedeem: v }),
  setLastReceipt: (r) => set({ lastReceipt: r }),
  setJournalPeriod: (p) => set({ journalPeriod: p }),
  setActivePurchaseDate: (d) => set({ activePurchaseDate: d }),
  setShortcutEdit: (v) => set({ shortcutEdit: v }),
  logError: (source, message) =>
    set((s) => ({
      errorLog: [
        ...s.errorLog,
        {
          at: new Date().toISOString(),
          source: String(source || 'app'),
          message: String(message || '').slice(0, 500),
        },
      ].slice(-50),
    })),
  clearErrorLog: () => set({ errorLog: [] }),
}))

/* ---------- derivasi inbox (port rebuildInbox) ---------- */

interface InboxInputs {
  products: Product[]
  onlineOrders: Order[]
  titipRequests: { id: string; item: string; customerName: string; status: string; time: string }[]
  threads: Record<string, { name: string; lastMessage?: string; unread: number }>
  pendingCustomers: PendingCustomer[]
  inboxReadIds: string[]
  lowStockThreshold: number
}

function buildInboxItems(inp: InboxInputs): InboxItem[] {
  const items: InboxItem[] = []
  inp.products
    .filter((p) => p.stock <= inp.lowStockThreshold)
    .forEach((p) =>
      items.push({
        id: 'stock-' + p.id,
        kind: 'stock',
        title: 'Stok menipis: ' + p.name + ' (sisa ' + stockText(p) + ')',
        time: 'Perlu dikulak',
        read: false,
        icon: 'box',
        target: 'produk',
      }),
    )
  inp.onlineOrders
    .filter((o) => o.status === 'active')
    .forEach((o) =>
      items.push({
        id: 'order-' + o.docId,
        kind: 'order',
        title: 'Pesanan ' + o.id + ' · ' + o.name + ' · ' + money(o.total),
        time: o.time,
        read: false,
        icon: 'bag',
        target: 'online',
      }),
    )
  inp.titipRequests
    .filter((t) => t.status === 'baru' || t.status === 'diproses')
    .forEach((t) =>
      items.push({
        id: 'titip-' + t.id,
        kind: 'titip',
        title: 'Titipan: ' + t.item + ' (' + t.customerName + ')',
        time: t.time,
        read: false,
        icon: 'bag',
        target: 'online',
      }),
    )
  Object.entries(inp.threads)
    .filter(([, t]) => t.unread > 0)
    .forEach(([id, t]) =>
      items.push({
        id: 'chat-' + id,
        kind: 'chat',
        title: 'Chat dari ' + t.name + ': ' + (t.lastMessage || 'pesan baru'),
        time: 'Baru saja',
        read: false,
        icon: 'chat',
        target: 'chat',
      }),
    )
  inp.pendingCustomers
    .filter((p) => p.status === 'waiting')
    .forEach((p) =>
      items.push({
        id: 'signup-' + p.id,
        kind: 'signup',
        title: 'Pendaftar baru: ' + p.name,
        time: p.meta,
        read: false,
        icon: 'user',
        target: 'approvals',
      }),
    )
  const readIds = new Set(inp.inboxReadIds)
  items.forEach((x) => {
    if (readIds.has(x.id)) x.read = true
  })
  return items
}

function persistInboxRead(ids: string[]) {
  try {
    localStorage.setItem(INBOX_READ_KEY, JSON.stringify(ids))
  } catch {
    /* abaikan */
  }
  void useSettingsStore.getState().saveStoreSettings({ inboxReadIds: ids }).catch(() => {})
}

/* ---------- bangun state gabungan ---------- */

function buildAdminState(): LocalAdminState {
  const ui = useAdminUIStore.getState()
  const st = useSettingsStore.getState()
  const journalEntries = useLedgerStore.getState().journalEntries
  const purchaseNotes = useLedgerStore.getState().purchaseNotes
  const onlineOrdersRec = useOrdersStore.getState().onlineOrders
  const onlineOrders = onlineOrdersRec.map(recordToOrder)
  const customers = useCustomersStore.getState().customers
  const pendingCustomers = useCustomersStore.getState().pendingCustomers
  const adminCustomerNotes = useNotesStore.getState().adminCustomerNotes
  const storeMemos = useNotesStore.getState().storeMemos
  const titipRequests = useNotesStore.getState().titipRequests
  const rumpiMessages = useChatStore.getState().rumpiPosts
  const threads = useChatStore.getState().threads
  const recipes = useCatalogStore.getState().recipes
  const patunganList = useCatalogStore.getState().patunganList
  const rutinPackages = useCatalogStore.getState().rutinPackages
  const hajatanPackages = useCatalogStore.getState().hajatanPackages
  const products = useProductsStore.getState().products
  const gs = st.gatewaySlides

  const pinnedChatIds = Array.isArray(st.pinnedChatIds) ? st.pinnedChatIds : []
  const pinnedSet = new Set(pinnedChatIds)
  const directThreads: Record<string, DirectThread> = {}
  for (const [id, t] of Object.entries(threads)) {
    directThreads[id] = {
      id,
      name: t.name,
      initial: t.initial,
      photoURL: t.photoURL ?? '',
      messages: t.messages,
      unread: t.unread,
      customerUnread: t.customerUnread,
      lastMessage: t.lastMessage ?? '',
      updatedAt: t.updatedAt ?? 0,
      pinned: pinnedSet.has(id),
      loading: !!t._loadingMessages,
    }
  }

  const customerData: Customer[] = customers.map((c) => ({
    ...c,
    history: onlineOrdersRec.filter((o) => o.customerId === c.id).map(recordToOrder),
  }))

  const inboxItems = buildInboxItems({
    products,
    onlineOrders,
    titipRequests,
    threads,
    pendingCustomers,
    inboxReadIds: st.inboxReadIds,
    lowStockThreshold: st.lowStockDefault,
  })

  const noopUnsub = () => () => {}

  return {
    todayKey: todayKeyJakarta(),
    journalEntries,
    journalPeriod: ui.journalPeriod,
    lowStockThreshold: st.lowStockDefault,
    onlineOrders,
    customerData,
    pendingCustomers,
    adminCustomerNotes,
    purchaseNotes,
    activePurchaseDate: ui.activePurchaseDate,
    rumpiMessages,
    directThreads,
    activeDirectThread: useChatStore.getState().activeDirectThread,
    storeMemos: storeMemos.map((m) => ({ ...m, at: m.time })),
    titipRequests: titipRequests as unknown as TitipRequest[],
    inboxItems,
    inboxReadIds: st.inboxReadIds,
    pinnedChatIds,
    togglePinChat: (id) => {
      const cur = useSettingsStore.getState().pinnedChatIds
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 50)
      try {
        localStorage.setItem(PINNED_CHAT_KEY, JSON.stringify(next))
      } catch {
        /* abaikan */
      }
      void useSettingsStore.getState().saveStoreSettings({ pinnedChatIds: next }).catch(() => {})
    },
    shortcutIds: st.dashboardShortcutIds,
    shortcutEdit: ui.shortcutEdit,
    kasirMember: ui.kasirMember,
    kasirRedeem: ui.kasirRedeem,
    lastReceipt: ui.lastReceipt,
    adminCat: ui.adminCat,
    coin: {
      enabled: st.coinProgramEnabled,
      value: st.coinRate,
      redeemPercent: st.coinRedeemLimit,
      events: st.coinEvents as unknown as CoinEvents,
      rewards: {
        checkin: st.coinRewards.checkin,
        mission: st.coinRewards.mission,
        guess: st.coinRewards.guess,
      },
      spendRule: st.coinSpendRule,
      spendReward: st.coinSpendReward,
      rule: st.coinRule,
    },
    storeName: st.storeName,
    openTime: st.openTime,
    closeTime: st.closeTime,
    rutinPackages: rutinPackages as unknown as ServicePackageAdmin[],
    hajatanPackages: hajatanPackages as unknown as ServicePackageAdmin[],
    patunganList: patunganList as unknown as PatunganAdmin[],
    recipes: recipes as unknown as RecipeAdmin[],
    homeControl: {
      runningText: st.runningText,
      gatewayTitle1: gs.title1,
      gatewayCopy1: gs.copy1,
      gatewayTitle2: gs.title2,
      gatewayCopy2: gs.copy2,
      gatewayTitle3: gs.title3,
      gatewayCopy3: gs.copy3,
      flashProductId: st.flashProductId,
      flashPrice: st.flashPrice,
      flashRule: st.flashRule,
      kabarStatus: st.kabarStatus,
      kabarMood: st.kabarMood,
      homeSections: st.homeSections as unknown as HomeControlState['homeSections'],
      carouselSlots: st.carouselSlots,
    },
    errorLog: ui.errorLog,

    /* langganan: diorkestrasi useAuthStore per peran — tidak ada di sini */
    subscribeAll: noopUnsub,
    subscribeJournal: noopUnsub,
    subscribeOrders: noopUnsub,
    subscribeCustomers: noopUnsub,
    subscribeRumpi: noopUnsub,
    subscribeChatThreads: noopUnsub,
    subscribeMemos: noopUnsub,
    subscribeSettings: noopUnsub,
    subscribeTitip: noopUnsub,
    subscribeAdminNotes: noopUnsub,
    subscribePackages: noopUnsub,
    subscribeRecipes: noopUnsub,
    watchThreadMessages: (threadId: string) => {
      useChatStore.getState().watchThreadMessages(threadId)
      return () => {}
    },

    /* aksi tulis -> store resmi */
    saveStoreSettings: (patch) => useSettingsStore.getState().saveStoreSettings(patch),
    recordJournal: (entry) => useLedgerStore.getState().recordJournal(entry),
    saveRestock: (payload) =>
      useLedgerStore.getState().saveRestock({
        supplier: payload.supplier,
        items: payload.items.map((i) => ({
          productId: i.productId ?? undefined,
          name: i.name,
          qtyPcs: i.qtyPcs,
          unitCost: i.unitCost,
          costChoice: i.costChoice as 'new' | 'avg',
          salePrice: i.salePrice,
          lineTotal: i.lineTotal,
        })),
        total: payload.total,
      }),
    addManualPurchaseNote: (input) => useLedgerStore.getState().addManualPurchaseNote(input),
    updateStockNote: (docId, input) => useLedgerStore.getState().updateStockNote(docId, input),
    deleteStockNote: (docId) => useLedgerStore.getState().deleteStockNote(docId),
    loadStockNotes: (dateKey) => useLedgerStore.getState().loadStockNotes(dateKey),
    completeCashSale: (input) =>
      useCheckoutStore
        .getState()
        .completeCashSale({ ...input, member: useAdminUIStore.getState().kasirMember }),
    settleOrder: (docId) => useOrdersStore.getState().settleOrder(docId),
    rejectTransfer: (docId, reason) =>
      useOrdersStore.getState().rejectTransfer(docId, reason ?? ''),
    setOrderStatus: (docId, status) => useOrdersStore.getState().updateStatus(docId, status),
    cancelOrder: (docId) => useOrdersStore.getState().cancel(docId),
    deleteOrder: (docId) => useOrdersStore.getState().deleteOrder(docId),
    approveCustomer: (id) => useCustomersStore.getState().approveCustomer(id),
    rejectCustomer: (id) => useCustomersStore.getState().rejectCustomer(id),
    identifyMemberByCode: async (code) => {
      const m = await useCustomersStore.getState().identifyMemberByCode(code)
      useAdminUIStore.getState().setKasirMember(m)
      useAdminUIStore.getState().setKasirRedeem(false)
      return m
    },
    adjustCoins: (uid, delta, detail) =>
      useCustomersStore.getState().adjustCoins(uid, delta, { detail }),
    grantBonusToAll: (amount, reason) =>
      useCustomersStore.getState().grantBonusToAll(amount, reason),
    addCustomerNote: (input) => useNotesStore.getState().addCustomerNote(input),
    addStoreMemo: (input) => useNotesStore.getState().addStoreMemo(input),
    deleteStoreMemo: (id) => useNotesStore.getState().deleteStoreMemo(id),
    sendRumpi: (text, photo) => useChatStore.getState().sendRumpi(text, photo || undefined),
    deleteRumpi: (id) => useChatStore.getState().deleteRumpi(id),
    likeRumpi: (id) => useChatStore.getState().likeRumpi(id),
    sendChatMessage: (threadId, text) => {
      useChatStore.getState().setActiveDirectThread(threadId)
      return useChatStore.getState().sendChatMessage(text)
    },
    markThreadRead: (threadId) => useChatStore.getState().markThreadRead(threadId),
    setTitipStatus: (docId, status) => useNotesStore.getState().setTitipStatus(docId, status),
    saveRutinPackage: (data, id) =>
      useCatalogStore.getState().saveRutinPackage(data, id ?? undefined),
    deleteRutinPackage: (id) => useCatalogStore.getState().deleteRutinPackage(id),
    saveHajatanPackage: (data, id) =>
      useCatalogStore.getState().saveHajatanPackage(data, id ?? undefined),
    deleteHajatanPackage: (id) => useCatalogStore.getState().deleteHajatanPackage(id),
    createPatungan: (data) => useCatalogStore.getState().createPatungan(data),
    saveRecipe: (data, id) => useCatalogStore.getState().saveRecipe(data, id ?? undefined),
    deleteRecipe: (id) => useCatalogStore.getState().deleteRecipe(id),
    setPatunganStatus: (id, status) => useCatalogStore.getState().setPatunganStatus(id, status),
    confirmPatunganPayment: (patunganId, customerId) =>
      useCatalogStore.getState().confirmPatunganPayment(patunganId, customerId),

    /* aksi lokal */
    setJournalPeriod: ui.setJournalPeriod,
    setLowStockThreshold: (n) =>
      void useSettingsStore.getState().saveStoreSettings({ lowStockDefault: n }).catch(() => {}),
    setActivePurchaseDate: ui.setActivePurchaseDate,
    setAdminCat: ui.setAdminCat,
    setKasirMember: ui.setKasirMember,
    setKasirRedeem: ui.setKasirRedeem,
    setLastReceipt: ui.setLastReceipt,
    setActiveDirectThread: (id) => useChatStore.getState().setActiveDirectThread(id ?? 'toko'),
    openThread: (id) => {
      useChatStore.getState().setActiveDirectThread(id)
      useChatStore.getState().watchThreadMessages(id)
      void useChatStore.getState().markThreadRead(id)
    },
    rebuildInbox: () => {},
    markAllInboxRead: () => {
      const ids = buildAdminState().inboxItems.map((x) => x.id).slice(0, 200)
      persistInboxRead(ids)
    },
    markInboxGroupRead: (kind) => {
      const ids = buildAdminState()
        .inboxItems.filter((x) => x.kind === kind)
        .map((x) => x.id)
      if (!ids.length) return
      const merged = [...new Set([...useSettingsStore.getState().inboxReadIds, ...ids])].slice(0, 200)
      persistInboxRead(merged)
    },
    markInboxItemRead: (id) => {
      const merged = [...new Set([...useSettingsStore.getState().inboxReadIds, id])].slice(0, 200)
      persistInboxRead(merged)
    },
    toggleShortcutEdit: () => ui.setShortcutEdit(!ui.shortcutEdit),
    addShortcut: (id) => {
      const ids = useSettingsStore.getState().dashboardShortcutIds
      if (ids.length >= 6 || ids.includes(id)) return
      const next = [...ids, id]
      try {
        localStorage.setItem(SHORTCUT_KEY, JSON.stringify(next))
      } catch {
        /* abaikan */
      }
      ui.setShortcutEdit(false)
      void useSettingsStore.getState().saveStoreSettings({ dashboardShortcutIds: next }).catch(() => {})
    },
    removeShortcut: (id) => {
      const next = useSettingsStore.getState().dashboardShortcutIds.filter((x) => x !== id)
      try {
        localStorage.setItem(SHORTCUT_KEY, JSON.stringify(next))
      } catch {
        /* abaikan */
      }
      void useSettingsStore.getState().saveStoreSettings({ dashboardShortcutIds: next }).catch(() => {})
    },
    logError: ui.logError,
    clearErrorLog: ui.clearErrorLog,
  }
}

/**
 * Pengganti mega-store: hook yang berlangganan store resmi dan
 * menyajikan bentuk LocalAdminState lama ke konsumen.
 */
export function useLocalAdminStore<T = LocalAdminState>(
  selector: (s: LocalAdminState) => T = (s) => s as unknown as T,
): T {
  // Berlangganan agar komponen render ulang saat data resmi berubah.
  useLedgerStore((s) => s.journalEntries)
  useLedgerStore((s) => s.purchaseNotes)
  useOrdersStore((s) => s.onlineOrders)
  useCustomersStore((s) => s.customers)
  useCustomersStore((s) => s.pendingCustomers)
  useNotesStore((s) => s.adminCustomerNotes)
  useNotesStore((s) => s.storeMemos)
  useNotesStore((s) => s.titipRequests)
  useChatStore((s) => s.rumpiPosts)
  useChatStore((s) => s.threads)
  useChatStore((s) => s.activeDirectThread)
  useCatalogStore((s) => s.recipes)
  useCatalogStore((s) => s.patunganList)
  useCatalogStore((s) => s.rutinPackages)
  useCatalogStore((s) => s.hajatanPackages)
  useProductsStore((s) => s.products)
  useSettingsStore((s) => s.storeSettings)
  useSettingsStore((s) => s.inboxReadIds)
  useSettingsStore((s) => s.pinnedChatIds)
  useSettingsStore((s) => s.dashboardShortcutIds)
  useSettingsStore((s) => s.lowStockDefault)
  useAdminUIStore()
  return selector(buildAdminState())
}

/** Kompat getState() untuk pemakaian non-hook (PosPage). */
useLocalAdminStore.getState = () => buildAdminState()

/** Selector praktis: jumlah notifikasi belum dibaca. */
export function useInboxUnread(): number {
  return useLocalAdminStore((s) => s.inboxItems.filter((x) => !x.read).length)
}

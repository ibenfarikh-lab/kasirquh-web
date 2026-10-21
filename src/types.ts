import type { Timestamp } from 'firebase/firestore'

export interface Product {
  id: string
  active: boolean
  name: string
  short: string
  cat: string
  unit: string
  price: number
  cost: number
  stock: number
  img: string
  hasPhoto: boolean
  barcode: string
  promo: boolean
  isActive: boolean
  lowStockAt: number
  wholesaleQty: number
  totalTerjual: number
  wholesalePrice: number
  wholesaleLabel: string
  oldPrice: number
  budgetEligible?: boolean
  budgetMaxQty: number
}

export interface ProductFormData {
  name: string
  cat: string
  unit: string
  price: number
  cost: number
  stock: number
  img: string
  barcode: string
  budgetEligible: boolean
  budgetMaxQty: number
  wholesaleQty: number
  wholesalePrice: number
  wholesaleLabel: string
}

export interface OrderItem {
  name: string
  qty: number
  subtotal: number
  productId: string
}

export interface Order {
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
  items: OrderItem[]
  total: number
  fullTotal: number
  coinUsed: number
  coinValue: number
  earnedCoins: number
  stockLines: { productId: string; qty: number }[]
  cancelConfirm: boolean
}

export interface Customer {
  id: string
  name: string
  email: string
  wa: string
  address: string
  photoURL: string
  coins: number
  spend: number
  history: Order[]
}

export interface PendingCustomer {
  id: string
  name: string
  email: string
  wa: string
  meta: string
  status: 'waiting' | 'rejected'
}

export interface JournalEntry {
  id: string
  date: string
  time: string
  direction: 'income' | 'expense'
  type: string
  description: string
  amount: number
  source: string
  method: string
  profit: number
  itemCount: number
}

export interface RumpiMessage {
  id: string
  name: string
  initial: string
  authorPhoto: string
  time: string
  text: string
  photo: string
  photoAlt: string
  admin: boolean
  seed: boolean
  likeCount: number
}

export interface ThreadMessage {
  id: string
  side: 'admin' | 'customer'
  time: string
  text: string
}

export interface CoinEntry {
  kind: 'income' | 'expense'
  amount: number
  label: string
  detail: string
  time: string
  sub: string
}

export interface CustomerNote {
  id: string
  customerId: string
  type: string
  amount: number
  note: string
  time: string
}

export interface RecipeItem {
  productId: string
  qty: number
}

export interface Recipe {
  id: string
  nama: string
  desc: string
  foto: string
  items: RecipeItem[]
}

export interface StockNoteItem {
  name: string
  qty: string
}

export interface StockNote {
  id: string
  date: string
  supplier: string
  items: StockNoteItem[]
  total: number
  source: string
}

export interface Patungan {
  id: string
  title: string
  product: string
  price: number
  slots: number
  joined: number
  deadline: string
  note: string
}

export interface PackageItem extends RecipeItem {}

export interface ServicePackage {
  id: string
  name: string
  desc: string
  items: PackageItem[]
}

export interface Promo {
  id: string
  title: string
  copy: string
  active: boolean
  productId?: string
  price?: number
}

export interface HomeSections {
  restock: { show: boolean; order: number }
  popular: { show: boolean; order: number }
  recipe: { show: boolean; order: number }
}

export interface GatewaySlides {
  title1: string
  copy1: string
  title2: string
  copy2: string
  title3: string
  copy3: string
}

export interface StoreSettings {
  storeName?: string
  coinRate?: number
  coinRule?: string
  coinRedeemLimit?: number
  flashProductId?: string | null
  flashRule?: string
  flashEndsAt?: Timestamp | null
  promoTitle?: string
  promoProductId?: string | null
  promoCopy?: string
  gatewayTitle1?: string
  gatewayCopy1?: string
  gatewayTitle2?: string
  gatewayCopy2?: string
  gatewayTitle3?: string
  gatewayCopy3?: string
  kabarStatus?: string
  kabarMood?: string
  homeSections?: HomeSections
  lowStockDefault?: number
  carouselSlots?: Record<string, string>
  [key: string]: unknown
}

export type SessionRole = 'admin' | 'customer' | null

export interface Session {
  role: SessionRole
  name: string | null
  customerId: string | null
  isGuest: boolean
  email: string | null
}

export type CartMap = Record<string, number>

export interface PriceAlert {
  productId: string
  name: string
  priceAtWatch: number
  watchedAt: string
}

export interface Routine {
  name: string
  interval: 'harian' | 'mingguan'
  day: string
  createdAt: string
}

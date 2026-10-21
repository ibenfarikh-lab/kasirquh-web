/**
 * KasirQuh React — src/stores/cart.ts
 * Keranjang pelanggan & kasir. Pengganti S.customerCart / S.adminCart
 * + addCustomerItem() / updateCustomerCart() dari js/app.js.
 */
import { create } from 'zustand'
import type { CartMap } from '../types'
import { useProductsStore } from './products'
import { toast } from '../components/ui'

interface CartState {
  customerCart: CartMap
  adminCart: CartMap
  addCustomerItem: (id: string, amount?: number) => void
  decCustomerItem: (id: string) => void
  clearCustomerCart: () => void
  addAdminItem: (id: string, amount?: number) => void
  decAdminItem: (id: string) => void
  clearAdminCart: () => void
  customerItemCount: () => number
  customerTotal: () => number
  adminItemCount: () => number
  adminTotal: () => number
}

function cleanCart(cart: CartMap): CartMap {
  const out: CartMap = {}
  for (const [id, qty] of Object.entries(cart)) {
    if (qty > 0) out[id] = qty
  }
  return out
}

/* Keranjang PERSISTEN (localStorage, pola sama seperti alerts.ts): reload
 * halaman tidak mengosongkan keranjang pelanggan maupun kasir. */
const CUSTOMER_CART_KEY = 'kasirquh-customer-cart'
const ADMIN_CART_KEY = 'kasirquh-admin-cart'

function loadCart(key: string): CartMap {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const out: CartMap = {}
      for (const [id, qty] of Object.entries(parsed)) {
        const n = Math.floor(Number(qty) || 0)
        if (id && n > 0) out[id] = n
      }
      return out
    }
  } catch {
    /* abaikan */
  }
  return {}
}

function persistCart(key: string, cart: CartMap) {
  try {
    localStorage.setItem(key, JSON.stringify(cart))
  } catch {
    /* abaikan */
  }
}

export const useCartStore = create<CartState>()((set, get) => ({
  customerCart: loadCart(CUSTOMER_CART_KEY),
  adminCart: loadCart(ADMIN_CART_KEY),

  addCustomerItem: (id, amount = 1) => {
    const p = useProductsStore.getState().products.find((x) => x.id === id)
    if (!p || p.isActive === false) return
    if ((p.stock || 0) <= 0) {
      toast('Stok habis')
      return
    }
    set((s) => ({
      customerCart: cleanCart({
        ...s.customerCart,
        [id]: (s.customerCart[id] || 0) + amount,
      }),
    }))
    persistCart(CUSTOMER_CART_KEY, get().customerCart)
    // Opsi B (user): tambah-keranjang tanpa toast — badge keranjang = feedback.
  },

  decCustomerItem: (id) => {
    set((s) => ({
      customerCart: cleanCart({
        ...s.customerCart,
        [id]: (s.customerCart[id] || 0) - 1,
      }),
    }))
    persistCart(CUSTOMER_CART_KEY, get().customerCart)
  },

  clearCustomerCart: () => {
    set({ customerCart: {} })
    persistCart(CUSTOMER_CART_KEY, {})
  },

  addAdminItem: (id, amount = 1) => {
    set((s) => ({
      adminCart: cleanCart({
        ...s.adminCart,
        [id]: (s.adminCart[id] || 0) + amount,
      }),
    }))
    persistCart(ADMIN_CART_KEY, get().adminCart)
  },

  decAdminItem: (id) => {
    set((s) => ({
      adminCart: cleanCart({
        ...s.adminCart,
        [id]: (s.adminCart[id] || 0) - 1,
      }),
    }))
    persistCart(ADMIN_CART_KEY, get().adminCart)
  },

  clearAdminCart: () => {
    set({ adminCart: {} })
    persistCart(ADMIN_CART_KEY, {})
  },

  customerItemCount: () =>
    Object.values(get().customerCart).reduce((sum, q) => sum + q, 0),

  customerTotal: () => {
    const { products } = useProductsStore.getState()
    return Object.entries(get().customerCart).reduce((sum, [id, qty]) => {
      const p = products.find((x) => x.id === id)
      return sum + (p ? p.price * qty : 0)
    }, 0)
  },

  adminItemCount: () =>
    Object.values(get().adminCart).reduce((sum, q) => sum + q, 0),

  adminTotal: () => {
    const { products } = useProductsStore.getState()
    return Object.entries(get().adminCart).reduce((sum, [id, qty]) => {
      const p = products.find((x) => x.id === id)
      return sum + (p ? p.price * qty : 0)
    }, 0)
  },
}))

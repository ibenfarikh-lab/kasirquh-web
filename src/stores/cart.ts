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

export const useCartStore = create<CartState>()((set, get) => ({
  customerCart: {},
  adminCart: {},

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
    // Opsi B (user): tambah-keranjang tanpa toast — badge keranjang = feedback.
  },

  decCustomerItem: (id) =>
    set((s) => ({
      customerCart: cleanCart({
        ...s.customerCart,
        [id]: (s.customerCart[id] || 0) - 1,
      }),
    })),

  clearCustomerCart: () => set({ customerCart: {} }),

  addAdminItem: (id, amount = 1) => {
    set((s) => ({
      adminCart: cleanCart({
        ...s.adminCart,
        [id]: (s.adminCart[id] || 0) + amount,
      }),
    }))
  },

  decAdminItem: (id) =>
    set((s) => ({
      adminCart: cleanCart({
        ...s.adminCart,
        [id]: (s.adminCart[id] || 0) - 1,
      }),
    })),

  clearAdminCart: () => set({ adminCart: {} }),

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

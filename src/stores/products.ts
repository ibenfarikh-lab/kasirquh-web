import { create } from 'zustand'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  increment,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getDb, requireOnline } from '../lib/firebase'
import { assertAdmin } from './auth'
import { useSettingsStore } from './settings'
import { withTimeout, WRITE_TIMEOUT_MS } from '../lib/firestore'
import type { Product, ProductFormData } from '../types'

export const IMG_EMPTY =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export function mapProduct(d: QueryDocumentSnapshot<DocumentData>): Product | null {
  const data = d.data() || {}
  const name = String(data.name || '').trim()
  if (!name) return null
  return {
    id: d.id,
    active: data.active !== false,
    name,
    short: name.length > 17 ? name.slice(0, 16) + '…' : name,
    cat: data.category || 'Lainnya',
    unit: data.unit || 'pcs',
    price: Math.max(0, Math.round(Number(data.price) || 0)),
    cost: Math.max(0, Math.round(Number(data.costPrice) || 0)),
    stock: Math.max(0, Number(data.stock) || 0),
    img: data.photoUrl || IMG_EMPTY,
    hasPhoto: !!data.photoUrl,
    barcode: data.barcode || '',
    promo: !!data.promo,
    isActive: data.isActive !== false,
    lowStockAt: Number(data.lowStockAt) || 5,
    wholesaleQty: Math.max(0, Number(data.wholesaleQty) || 0),
    totalTerjual: Math.max(0, Math.round(Number(data.totalTerjual) || 0)),
    wholesalePrice: Math.max(0, Math.round(Number(data.wholesalePrice) || 0)),
    wholesaleLabel: String(data.wholesaleLabel || ''),
    oldPrice: Math.max(0, Math.round(Number(data.oldPrice) || 0)),
    budgetEligible: data.budgetEligible,
    budgetMaxQty: Math.min(20, Math.max(1, Math.round(Number(data.budgetMaxQty) || 4))),
  }
}

export interface CsvProductItem {
  barcode: string
  name: string
  cat: string
  unit: string
  stock: number
  cost: number
  price: number
  photo?: string
}

interface ProductsState {
  products: Product[]
  loading: boolean
  subscribe: () => () => void
  refresh: () => Promise<void>
  save: (data: ProductFormData, id?: string) => Promise<void>
  remove: (id: string) => Promise<void>
  importFromCsv: (
    items: CsvProductItem[],
    onProgress?: (done: number, total: number) => void,
  ) => Promise<{ created: number; updated: number; total: number }>
}

export const useProductsStore = create<ProductsState>()((set, get) => ({
  products: [],
  loading: true,

  subscribe: () => {
    const db = getDb()
    const unsub = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const products = snap.docs
          .map((d) => mapProduct(d))
          .filter((p): p is Product => p !== null)
        set({ products, loading: false })
      },
      (err) => {
        console.error('[KasirQuh] langganan "products" gagal:', err)
        set({ loading: false })
      },
    )
    return unsub
  },

  refresh: async () => {
    const snap = await getDocs(collection(getDb(), 'products'))
    const products = snap.docs
      .map((d) => mapProduct(d))
      .filter((p): p is Product => p !== null)
    set({ products, loading: false })
  },

  save: async (data, id) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    const ts = serverTimestamp()
    const base: DocumentData = {
      name: data.name,
      category: data.cat,
      unit: data.unit || 'pcs',
      price: Math.round(data.price),
      costPrice: Math.round(data.cost),
      photoUrl: data.img || '',
      barcode: data.barcode || '',
      isActive: true,
      budgetEligible: !!data.budgetEligible,
      budgetMaxQty: Math.min(20, Math.max(1, Math.round(Number(data.budgetMaxQty) || 4))),
      wholesaleQty: Math.max(0, Math.round(Number(data.wholesaleQty) || 0)),
      wholesalePrice: Math.max(0, Math.round(Number(data.wholesalePrice) || 0)),
      wholesaleLabel: String(data.wholesaleLabel || ''),
      updatedAt: ts,
    }
    if (id) {
      const ref = doc(db, 'products', id)
      const snap = await getDoc(ref)
      const current = snap.exists()
        ? Math.max(0, Math.round(Number(snap.data().stock) || 0))
        : 0
      const delta = Math.round(data.stock) - current
      if (delta !== 0) base.stock = increment(delta)
      await withTimeout(updateDoc(ref, base), WRITE_TIMEOUT_MS, 'Simpan produk')
    } else {
      base.stock = Math.max(0, Math.round(data.stock))
      base.lowStockAt = useSettingsStore.getState().lowStockDefault || 5
      base.createdAt = ts
      await withTimeout(
        addDoc(collection(db, 'products'), base),
        WRITE_TIMEOUT_MS,
        'Tambah produk',
      )
    }
  },

  remove: async (id) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      deleteDoc(doc(getDb(), 'products', id)),
      WRITE_TIMEOUT_MS,
      'Hapus produk',
    )
  },

  importFromCsv: async (items, onProgress) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    const ts = serverTimestamp()
    const byBarcode: Record<string, string> = {}
    get().products.forEach((p) => {
      const code = String(p.barcode || '').trim()
      if (code && !byBarcode[code]) byBarcode[code] = p.id
    })
    const ops = (items || [])
      .map((item) => {
        const code = String(item.barcode || '').trim()
        const data: DocumentData = {
          name: String(item.name || '').trim(),
          category: String(item.cat || 'Lainnya').trim() || 'Lainnya',
          unit: String(item.unit || 'pcs').trim() || 'pcs',
          price: Math.max(0, Math.round(Number(item.price) || 0)),
          costPrice: Math.max(0, Math.round(Number(item.cost) || 0)),
          stock: Math.max(0, Number(item.stock) || 0),
          barcode: code,
          photoUrl: String(item.photo || '').trim(),
          isActive: true,
          updatedAt: ts,
        }
        return { existingId: code ? byBarcode[code] || null : null, data }
      })
      .filter((op) => op.data.name)

    const BATCH = 400
    let done = 0
    let created = 0
    let updated = 0
    try {
      for (let i = 0; i < ops.length; i += BATCH) {
        const batch = writeBatch(db)
        const slice = ops.slice(i, i + BATCH)
        slice.forEach((op) => {
          if (op.existingId) {
            batch.set(doc(db, 'products', op.existingId), op.data, { merge: true })
            updated++
          } else {
            batch.set(doc(collection(db, 'products')), {
              createdAt: ts,
              ...op.data,
            })
            created++
          }
        })
        await withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Impor produk')
        done += slice.length
        onProgress?.(done, ops.length)
      }
    } catch (e) {
      ;(e as { importedSoFar?: number }).importedSoFar = done
      throw e
    }
    return { created, updated, total: ops.length }
  },
}))

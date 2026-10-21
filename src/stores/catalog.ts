import { create } from 'zustand'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
import type { Recipe, RecipeItem } from '../types'
import { assertAdmin, requireCustomerId, useAuthStore } from './auth'

export function mapRecipe(d: QueryDocumentSnapshot<DocumentData>): Recipe {
  const data = d.data() || {}
  return {
    id: d.id,
    nama: String(data.nama || ''),
    desc: String(data.desc || ''),
    foto: String(data.foto || ''),
    items: cleanRecipeItems(data.items),
  }
}

export function cleanRecipeItems(items: unknown): RecipeItem[] {
  return ((items as DocumentData[] | undefined) || [])
    .map((it) => ({
      productId: String(it.productId || ''),
      qty: Math.max(1, Math.round(Number(it.qty) || 1)),
    }))
    .filter((it) => it.productId)
}

export interface PatunganParticipant {
  customerId: string
  name: string
  slots: number
  joinedAt: string
  paymentStatus: string
  paymentMethod: string
  paidAt?: string
}

export interface PatunganItem {
  id: string
  title: string
  productName: string
  pricePerSlot: number
  totalSlots: number
  filledSlots: number
  participants: PatunganParticipant[]
  deadline: string
  note: string
  status: string
}

export interface ServicePackageRecord {
  id: string
  name: string
  description: string
  items: RecipeItem[]
  isActive: boolean
  [key: string]: unknown
}

export interface PackageInput {
  name: string
  description?: string
  items: RecipeItem[]
}

export interface PatunganInput {
  title: string
  productName: string
  pricePerSlot: number
  totalSlots: number
  deadline: string
  note: string
}

export interface RecipeInput {
  nama: string
  desc?: string
  foto?: string
  items: RecipeItem[]
}

let recipesWatched = false

interface CatalogState {
  recipes: Recipe[]
  myRecipes: Recipe[]
  patunganList: PatunganItem[]
  rutinPackages: ServicePackageRecord[]
  hajatanPackages: ServicePackageRecord[]
  loading: boolean

  subscribeRecipes: () => () => void
  subscribeMyRecipes: (uid: string) => () => void
  subscribePatungan: () => () => void
  subscribeRutinPackages: () => () => void
  subscribeHajatanPackages: () => () => void
  clearRole: () => void

  saveRecipe: (data: RecipeInput, id?: string) => Promise<void>
  deleteRecipe: (id: string) => Promise<void>
  saveMyRecipe: (data: RecipeInput) => Promise<void>
  deleteMyRecipe: (id: string) => Promise<void>

  createPatungan: (data: PatunganInput) => Promise<void>
  joinPatungan: (patunganId: string, slots: number, payMethod?: string) => Promise<void>
  confirmPatunganPayment: (patunganId: string, customerId: string, method?: string) => Promise<void>
  setPatunganStatus: (id: string, status: string) => Promise<void>

  saveRutinPackage: (data: PackageInput, id?: string) => Promise<void>
  deleteRutinPackage: (id: string) => Promise<void>
  saveHajatanPackage: (data: PackageInput, id?: string) => Promise<void>
  deleteHajatanPackage: (id: string) => Promise<void>
}

export const useCatalogStore = create<CatalogState>()((set) => ({
  recipes: [],
  myRecipes: [],
  patunganList: [],
  rutinPackages: [],
  hajatanPackages: [],
  loading: true,

  subscribeRecipes: () => {
    if (recipesWatched) return () => {}
    recipesWatched = true
    const unsub = onSnapshot(
      query(collection(getDb(), 'recipes'), orderBy('createdAt', 'desc'), limit(20)),
      (snap) => {
        set({ recipes: snap.docs.map((d) => mapRecipe(d)), loading: false })
      },
      (err) => {
        console.error('[KasirQuh] langganan "recipes" gagal:', err)
        set({ loading: false })
      },
    )
    return unsub
  },

  subscribeMyRecipes: (uid) => {
    const unsub = onSnapshot(
      query(
        collection(getDb(), 'customers', uid, 'my_recipes'),
        orderBy('createdAt', 'desc'),
        limit(20),
      ),
      (snap) => {
        set({ myRecipes: snap.docs.map((d) => mapRecipe(d)) })
      },
      (err) => {
        console.error('[KasirQuh] langganan "my_recipes" gagal:', err)
      },
    )
    return unsub
  },

  subscribePatungan: () => {
    const unsub = onSnapshot(
      query(
        collection(getDb(), 'patungan'),
        where('status', 'in', ['aktif', 'penuh']),
        limit(20),
      ),
      (snap) => {
        try {
          const tsVal = (x: DocumentData) => {
            const c = x && x.createdAt
            if (!c) return 0
            if (typeof c.toMillis === 'function') return c.toMillis()
            const t = new Date(c).getTime()
            return isNaN(t) ? 0 : t
          }
          const patunganList = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() || {}) }) as PatunganItem)
            .sort((a, b) => tsVal(b) - tsVal(a))
          set({ patunganList })
        } catch (e) {
          console.error('[KasirQuh] patungan render gagal:', e)
        }
      },
      (err) => {
        console.error('[KasirQuh] langganan "patungan" gagal:', err)
      },
    )
    return unsub
  },

  subscribeRutinPackages: () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return () => {}
    const unsub = onSnapshot(
      query(collection(getDb(), 'rutinPackages'), where('isActive', '==', true)),
      (snap) => {
        try {
          set({
            rutinPackages: snap.docs.map(
              (d) => ({ id: d.id, ...(d.data() || {}) }) as ServicePackageRecord,
            ),
          })
        } catch (e) {
          console.error('[KasirQuh] rutin render gagal:', e)
        }
      },
      (err) => {
        console.error('[KasirQuh] langganan "rutinPackages" gagal:', err)
      },
    )
    return unsub
  },

  subscribeHajatanPackages: () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return () => {}
    const unsub = onSnapshot(
      query(collection(getDb(), 'hajatanPackages'), where('isActive', '==', true)),
      (snap) => {
        try {
          set({
            hajatanPackages: snap.docs.map(
              (d) => ({ id: d.id, ...(d.data() || {}) }) as ServicePackageRecord,
            ),
          })
        } catch (e) {
          console.error('[KasirQuh] hajatan render gagal:', e)
        }
      },
      (err) => {
        console.error('[KasirQuh] langganan "hajatanPackages" gagal:', err)
      },
    )
    return unsub
  },

  clearRole: () => {
    set({ myRecipes: [] })
  },

  saveRecipe: async (data, id) => {
    requireOnline()
    assertAdmin()
    const rec = data || {}
    const nama = String(rec.nama || '').trim()
    if (!nama) throw new Error('Isi nama resep dulu')
    const items = cleanRecipeItems(rec.items)
    if (!items.length) throw new Error('Isi bahan resep dulu')
    const payload: DocumentData = {
      nama: nama.slice(0, 54),
      desc: String(rec.desc || '').slice(0, 500),
      foto: String(rec.foto || ''),
      items: items,
      updatedAt: serverTimestamp(),
    }
    if (id) {
      await withTimeout(
        updateDoc(doc(getDb(), 'recipes', id), payload),
        WRITE_TIMEOUT_MS,
        'Simpan resep',
      )
    } else {
      payload.createdAt = serverTimestamp()
      await withTimeout(
        addDoc(collection(getDb(), 'recipes'), payload),
        WRITE_TIMEOUT_MS,
        'Tambah resep',
      )
    }
  },

  deleteRecipe: async (id) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      deleteDoc(doc(getDb(), 'recipes', id)),
      WRITE_TIMEOUT_MS,
      'Hapus resep',
    )
  },

  saveMyRecipe: async (data) => {
    requireOnline()
    const uid = requireCustomerId()
    const rec = data || {}
    const nama = String(rec.nama || '').trim()
    if (!nama) throw new Error('Isi nama resep dulu')
    const items = cleanRecipeItems(rec.items)
    if (!items.length) throw new Error('Isi bahan resep dulu')
    await withTimeout(
      addDoc(collection(getDb(), 'customers', uid, 'my_recipes'), {
        nama: nama.slice(0, 54),
        desc: String(rec.desc || '').slice(0, 500),
        foto: String(rec.foto || ''),
        items: items,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Simpan resepku',
    )
  },

  deleteMyRecipe: async (id) => {
    requireOnline()
    const uid = requireCustomerId()
    await withTimeout(
      deleteDoc(doc(getDb(), 'customers', uid, 'my_recipes', id)),
      WRITE_TIMEOUT_MS,
      'Hapus resepku',
    )
  },

  createPatungan: async (data) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      addDoc(collection(getDb(), 'patungan'), {
        title: String(data.title || ''),
        productName: String(data.productName || ''),
        pricePerSlot: Math.max(0, Math.round(Number(data.pricePerSlot) || 0)),
        totalSlots: Math.min(100, Math.max(2, Math.round(Number(data.totalSlots) || 0))),
        filledSlots: 0,
        participants: [],
        deadline: String(data.deadline || ''),
        note: String(data.note || ''),
        status: 'aktif',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Buat patungan',
    )
  },

  joinPatungan: async (patunganId, slots, payMethod) => {
    requireOnline()
    const uid = requireCustomerId()
    if (!uid) throw new Error('Login dulu untuk ikut patungan')
    const db = getDb()
    const ref = doc(db, 'patungan', patunganId)
    await withTimeout(
      runTransaction(db, async (t) => {
        const snap = await t.get(ref)
        if (!snap.exists()) throw new Error('Patungan tidak ditemukan')
        const d = snap.data() || {}
        if (d.status !== 'aktif') throw new Error('Patungan sudah ' + (d.status || 'ditutup'))
        const want = Math.min(10, Math.max(1, Math.round(Number(slots) || 1)))
        const filled = Number(d.filledSlots) || 0
        const total = Number(d.totalSlots) || 0
        if (filled + want > total) throw new Error('Slot tersisa ' + (total - filled))
        const parts = Array.isArray(d.participants) ? d.participants.slice() : []
        const me = parts.find((p: DocumentData) => p.customerId === uid)
        if (me) throw new Error('Kamu sudah ikut patungan ini')
        const sessionName = useAuthStore.getState().session.name
        parts.push({
          customerId: uid,
          name: sessionName || 'Warga',
          slots: want,
          joinedAt: new Date().toISOString(),
          paymentStatus: 'menunggu bayar',
          paymentMethod: payMethod === 'transfer' ? 'transfer' : 'tunai',
        })
        t.update(ref, {
          participants: parts,
          filledSlots: filled + want,
          status: filled + want >= total ? 'penuh' : 'aktif',
          updatedAt: serverTimestamp(),
        })
      }),
      WRITE_TIMEOUT_MS,
      'Ikut patungan',
    )
  },

  confirmPatunganPayment: async (patunganId, customerId, method) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    const ref = doc(db, 'patungan', patunganId)
    await withTimeout(
      runTransaction(db, async (t) => {
        const snap = await t.get(ref)
        if (!snap.exists()) throw new Error('Patungan tidak ditemukan')
        const d = snap.data() || {}
        const parts = Array.isArray(d.participants) ? d.participants.slice() : []
        const idx = parts.findIndex((p: DocumentData) => p.customerId === customerId)
        if (idx < 0) throw new Error('Peserta tidak ditemukan')
        parts[idx] = {
          ...parts[idx],
          paymentStatus: 'lunas',
          paymentMethod: method || parts[idx].paymentMethod || 'tunai',
          paidAt: new Date().toISOString(),
        }
        t.update(ref, { participants: parts, updatedAt: serverTimestamp() })
      }),
      WRITE_TIMEOUT_MS,
      'Konfirmasi pembayaran',
    )
  },

  setPatunganStatus: async (id, status) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      updateDoc(doc(getDb(), 'patungan', id), {
        status: status,
        updatedAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Ubah status patungan',
    )
  },

  saveRutinPackage: async (data, id) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    const ts = serverTimestamp()
    const base: DocumentData = {
      name: String(data.name || ''),
      description: String(data.description || ''),
      items: Array.isArray(data.items) ? data.items : [],
      isActive: true,
      updatedAt: ts,
    }
    if (id) {
      await withTimeout(
        updateDoc(doc(db, 'rutinPackages', id), base),
        WRITE_TIMEOUT_MS,
        'Simpan paket',
      )
    } else {
      base.createdAt = ts
      await withTimeout(
        addDoc(collection(db, 'rutinPackages'), base),
        WRITE_TIMEOUT_MS,
        'Tambah paket',
      )
    }
  },

  deleteRutinPackage: async (id) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      updateDoc(doc(getDb(), 'rutinPackages', id), {
        isActive: false,
        updatedAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Hapus paket',
    )
  },

  saveHajatanPackage: async (data, id) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    const ts = serverTimestamp()
    const base: DocumentData = {
      name: String(data.name || ''),
      description: String(data.description || ''),
      items: Array.isArray(data.items) ? data.items : [],
      isActive: true,
      updatedAt: ts,
    }
    if (id) {
      await withTimeout(
        updateDoc(doc(db, 'hajatanPackages', id), base),
        WRITE_TIMEOUT_MS,
        'Simpan paket',
      )
    } else {
      base.createdAt = ts
      await withTimeout(
        addDoc(collection(db, 'hajatanPackages'), base),
        WRITE_TIMEOUT_MS,
        'Tambah paket',
      )
    }
  },

  deleteHajatanPackage: async (id) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      updateDoc(doc(getDb(), 'hajatanPackages', id), {
        isActive: false,
        updatedAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Hapus paket',
    )
  },
}))

import { create } from 'zustand'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getDb, requireOnline } from '../lib/firebase'
import { todayKeyJakarta, withTimeout, WRITE_TIMEOUT_MS } from '../lib/firestore'
import type { JournalEntry, StockNote } from '../types'
import { assertAdmin } from './auth'
import { useSettingsStore } from './settings'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function dateKeyOf(ts: { toDate?: () => Date } | null | undefined): string {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date()
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

function timeOf(ts: { toDate?: () => Date } | null | undefined): string {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date()
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(d)
      .replace('.', ':')
  } catch {
    return ''
  }
}

export function mapJournal(d: QueryDocumentSnapshot<DocumentData>): JournalEntry {
  const data = d.data() || {}
  const cat = data.category || 'lainnya'
  let type = 'Lainnya'
  if (cat === 'penjualan') type = 'Penjualan'
  else if (cat === 'kulakan') type = 'Kulakan'
  else if (cat === 'beban_promosi') type = 'Penukaran koin'
  else if (String(data.note || '') === 'Saldo awal kas') type = 'Saldo Awal'
  return {
    id: d.id,
    date: dateKeyOf(data.createdAt),
    time: timeOf(data.createdAt),
    direction: data.type === 'pengeluaran' ? 'expense' : 'income',
    type: type,
    description: String(data.note || 'Transaksi'),
    amount: Math.round(Number(data.amount) || 0),
    source: String(data.refId || 'Manual'),
    method: String(data.method || ''),
    profit: Math.round(Number(data.profit) || 0),
    itemCount: Math.round(Number(data.itemCount) || 0),
  }
}

export function mapStockNote(d: QueryDocumentSnapshot<DocumentData>): StockNote {
  const data = d.data() || {}
  return {
    id: d.id,
    date: String(data.date || todayKeyJakarta()),
    supplier: String(data.supplier || ''),
    items: (data.items || []).map((it: DocumentData) => ({
      name: String(it.name || 'Barang'),
      qty: String(it.qty || '1'),
    })),
    total: Math.round(Number(data.total) || 0),
    source: String(data.source || 'manual'),
  }
}

export interface JournalInput {
  direction: 'income' | 'expense'
  type: string
  description: string
  amount: number
  orderId?: string
  source?: string
  method?: string
  profit?: number
  itemCount?: number
}

export interface RestockItem {
  productId?: string
  name: string
  qtyPcs: number
  unitCost: number
  costChoice: 'new' | 'avg'
  salePrice: number
  lineTotal: number
}

interface LedgerState {
  journalEntries: JournalEntry[]
  purchaseNotes: Record<string, StockNote[]>
  loading: boolean

  subscribeJournal: () => () => void
  clearRole: () => void

  recordJournal: (entry: JournalInput) => Promise<void>
  saveRestock: (input: { supplier: string; items: RestockItem[]; total: number }) => Promise<void>
  addManualPurchaseNote: (input: {
    supplier: string
    items: string[]
    total: number
  }) => Promise<void>
  updateStockNote: (
    docId: string,
    input: { supplier: string; items: { name: string; qty: string }[]; total: number },
  ) => Promise<void>
  deleteStockNote: (docId: string) => Promise<void>
  loadStockNotes: (dateStr?: string) => Promise<number>
}

export const useLedgerStore = create<LedgerState>()((set) => ({
  journalEntries: [],
  purchaseNotes: {},
  loading: true,

  subscribeJournal: () => {
    const unsub = onSnapshot(
      query(collection(getDb(), 'journal'), orderBy('createdAt', 'desc'), limit(200)),
      (snap) => {
        set({ journalEntries: snap.docs.map((d) => mapJournal(d)), loading: false })
      },
      (err) => {
        console.error('[KasirQuh] langganan "journal" gagal:', err)
        set({ loading: false })
      },
    )
    return unsub
  },

  clearRole: () => {
    set({ journalEntries: [], purchaseNotes: {}, loading: true })
  },

  recordJournal: async (entry) => {
    requireOnline()
    assertAdmin()
    const category =
      {
        Penjualan: 'penjualan',
        Kulakan: 'kulakan',
        'Penukaran koin': 'beban_promosi',
        'Saldo Awal': 'lainnya',
        Lainnya: 'lainnya',
      }[entry.type] || 'lainnya'
    await withTimeout(
      addDoc(collection(getDb(), 'journal'), {
        type: entry.direction === 'expense' ? 'pengeluaran' : 'pemasukan',
        category: category,
        amount: Math.round(Number(entry.amount) || 0),
        note: String(entry.description || 'Transaksi'),
        refId: String(entry.orderId || entry.source || ''),
        method: String(entry.method || ''),
        profit: Math.round(Number(entry.profit) || 0),
        itemCount: Math.round(Number(entry.itemCount) || 0),
        createdAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Catat jurnal',
    )
  },

  saveRestock: async ({ supplier, items, total }) => {
    requireOnline()
    assertAdmin()
    if (!items || !items.length) throw new Error('Tidak ada barang belanjaan')
    const db = getDb()
    const ts = serverTimestamp()
    const dateKey = todayKeyJakarta()
    const lowStockThreshold = useSettingsStore.getState().lowStockDefault

    await withTimeout(
      runTransaction(db, async (t) => {
        const noteItems: { name: string; qty: string; price: number }[] = []
        for (const item of items) {
          if (item.productId) {
            const ref = doc(db, 'products', item.productId)
            const snap = await t.get(ref)
            if (!snap.exists()) throw new Error('Produk "' + item.name + '" tidak ditemukan')
            const pd = snap.data() || {}
            const oldStock = Math.max(0, Number(pd.stock) || 0)
            const oldCost = Math.max(0, Math.round(Number(pd.costPrice) || 0))
            const newCost =
              item.costChoice === 'new'
                ? item.unitCost
                : oldStock + item.qtyPcs > 0
                  ? Math.round(
                      (oldCost * oldStock + item.unitCost * item.qtyPcs) / (oldStock + item.qtyPcs),
                    )
                  : item.unitCost
            t.update(ref, {
              stock: increment(item.qtyPcs),
              costPrice: newCost,
              price: Math.round(item.salePrice),
              updatedAt: ts,
            })
          } else {
            const ref = doc(collection(db, 'products'))
            t.set(ref, {
              name: item.name,
              category: 'Lainnya',
              unit: 'pcs',
              price: Math.round(item.salePrice),
              costPrice: item.unitCost,
              stock: item.qtyPcs,
              lowStockAt: lowStockThreshold,
              photoUrl: '',
              barcode: '',
              isActive: true,
              createdAt: ts,
              updatedAt: ts,
            })
          }
          noteItems.push({ name: item.name, qty: item.qtyPcs + ' pcs', price: item.lineTotal })
        }
        t.set(doc(collection(db, 'journal')), {
          type: 'pengeluaran',
          category: 'kulakan',
          amount: Math.round(total),
          note: 'Kulakan · Belanja Stok',
          refId: supplier,
          method: 'Kas',
          profit: 0,
          itemCount: 0,
          createdAt: ts,
        })
        t.set(doc(collection(db, 'stock_notes')), {
          date: dateKey,
          supplier: supplier,
          items: noteItems,
          total: Math.round(total),
          source: 'belanja_stok',
          createdAt: ts,
        })
        t.set(
          doc(db, 'store_settings', 'main'),
          { modal: increment(-Math.round(total)), updatedAt: ts },
          { merge: true },
        )
      }),
      WRITE_TIMEOUT_MS,
      'Simpan belanja stok',
    )
  },

  addManualPurchaseNote: async ({ supplier, items, total }) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    const ts = serverTimestamp()
    const batch = writeBatch(db)
    batch.set(doc(collection(db, 'stock_notes')), {
      date: todayKeyJakarta(),
      supplier: supplier,
      items: items.map((name) => ({ name: String(name), qty: '1' })),
      total: Math.round(total),
      source: 'manual',
      createdAt: ts,
    })
    batch.set(doc(collection(db, 'journal')), {
      type: 'pengeluaran',
      category: 'kulakan',
      amount: Math.round(total),
      note: 'Kulakan · Catatan manual',
      refId: supplier,
      method: 'Kas',
      profit: 0,
      itemCount: 0,
      createdAt: ts,
    })
    await withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Catat belanja')
  },

  updateStockNote: async (docId, { supplier, items, total }) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      updateDoc(doc(getDb(), 'stock_notes', docId), {
        supplier: supplier,
        items: items.map((it) => ({ name: String(it.name), qty: String(it.qty) })),
        total: Math.round(total),
      }),
      WRITE_TIMEOUT_MS,
      'Ubah catatan',
    )
  },

  deleteStockNote: async (docId) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      deleteDoc(doc(getDb(), 'stock_notes', docId)),
      WRITE_TIMEOUT_MS,
      'Hapus catatan',
    )
  },

  loadStockNotes: async (dateStr) => {
    requireOnline()
    assertAdmin()
    const db = getDb()
    let q = query(collection(db, 'stock_notes'), orderBy('date', 'desc'))
    if (dateStr) q = query(collection(db, 'stock_notes'), where('date', '==', dateStr), orderBy('date', 'desc'))
    else q = query(collection(db, 'stock_notes'), orderBy('date', 'desc'), limit(50))
    const snap = await getDocs(q)
    const grouped: Record<string, StockNote[]> = {}
    snap.docs.forEach((d) => {
      const note = mapStockNote(d)
      ;(grouped[note.date] = grouped[note.date] || []).push(note)
    })
    set({ purchaseNotes: grouped })
    return Object.values(grouped).flat().length
  },
}))

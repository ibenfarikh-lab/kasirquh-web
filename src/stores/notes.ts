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
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getDb, requireOnline } from '../lib/firebase'
import { withTimeout, WRITE_TIMEOUT_MS } from '../lib/firestore'
import type { CustomerNote } from '../types'
import { assertAdmin, requireCustomerId, useAuthStore } from './auth'

export interface StoreMemo {
  id: string
  title: string
  body: string
  time: string
}

export interface TitipRequest {
  id: string
  customerId: string
  customerName: string
  item: string
  note: string
  method: string
  status: string
  time: string
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

function formatTanggalIndonesia(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''))
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return String(key)
  }
}

function sortDocsDesc(
  docs: QueryDocumentSnapshot<DocumentData>[],
  field: string,
): QueryDocumentSnapshot<DocumentData>[] {
  const ms = (d: DocumentData) => {
    const ts = d[field] as { toMillis?: () => number } | null | undefined
    return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0
  }
  return docs.slice().sort((a, b) => ms(b.data() || {}) - ms(a.data() || {}))
}

export function mapCustomerNote(d: QueryDocumentSnapshot<DocumentData>): CustomerNote {
  const data = d.data() || {}
  return {
    id: d.id,
    customerId: String(data.customerId || ''),
    type: data.type || 'catatan',
    amount: Math.round(Number(data.amount) || 0),
    note: String(data.note || ''),
    time: data.noteDate
      ? formatTanggalIndonesia(data.noteDate)
      : data.createdAt
        ? dateTimeOf(data.createdAt)
        : '',
  }
}

function mapStoreMemo(d: QueryDocumentSnapshot<DocumentData>): StoreMemo {
  const dd = d.data() || {}
  return {
    id: d.id,
    title: String(dd.title || ''),
    body: String(dd.body || dd.text || ''),
    time: dd.createdAt ? dateTimeOf(dd.createdAt) : 'Baru saja',
  }
}

function mapTitipRequest(d: QueryDocumentSnapshot<DocumentData>): TitipRequest {
  const dd = d.data() || {}
  return {
    id: d.id,
    customerId: String(dd.customerId || ''),
    customerName: String(dd.customerName || 'Pelanggan'),
    item: String(dd.item || ''),
    note: String(dd.note || ''),
    method: String(dd.method || ''),
    status: String(dd.status || 'baru'),
    time: dd.createdAt ? dateTimeOf(dd.createdAt) : 'Baru saja',
  }
}

interface NotesState {
  customerNotesList: CustomerNote[]
  adminCustomerNotes: CustomerNote[]
  storeMemos: StoreMemo[]
  titipRequests: TitipRequest[]
  loading: boolean

  subscribeCustomerNotes: (uid: string) => () => void
  subscribeAdminNotes: () => () => void
  clearRole: () => void

  addCustomerNote: (input: {
    customerId: string
    type?: string
    amount?: number
    note: string
    date?: string
  }) => Promise<void>
  addStoreMemo: (input: { title?: string; body: string }) => Promise<void>
  deleteStoreMemo: (id: string) => Promise<void>
  submitTitipRequest: (input: { item: string; note?: string; method?: string }) => Promise<void>
  setTitipStatus: (docId: string, status: string) => Promise<void>
}

export const useNotesStore = create<NotesState>()((set) => ({
  customerNotesList: [],
  adminCustomerNotes: [],
  storeMemos: [],
  titipRequests: [],
  loading: true,

  subscribeCustomerNotes: (uid) => {
    const unsub = onSnapshot(
      query(collection(getDb(), 'customer_notes'), where('customerId', '==', uid), limit(60)),
      (snap) => {
        set({
          customerNotesList: sortDocsDesc(snap.docs, 'createdAt').map((d) => mapCustomerNote(d)),
          loading: false,
        })
      },
      (err) => {
        console.error('[KasirQuh] langganan "customer_notes" gagal:', err)
        set({ loading: false })
      },
    )
    return unsub
  },

  subscribeAdminNotes: () => {
    const db = getDb()
    const unsubs: (() => void)[] = []
    unsubs.push(
      onSnapshot(
        query(collection(db, 'customer_notes'), orderBy('createdAt', 'desc'), limit(30)),
        (snap) => {
          set({ adminCustomerNotes: snap.docs.map((d) => mapCustomerNote(d)) })
        },
        (err) => {
          console.error('[KasirQuh] langganan "customer_notes" gagal:', err)
        },
      ),
    )
    unsubs.push(
      onSnapshot(
        query(collection(db, 'store_memos'), orderBy('createdAt', 'desc'), limit(30)),
        (snap) => {
          set({ storeMemos: snap.docs.map((d) => mapStoreMemo(d)) })
        },
        (err) => {
          console.error('[KasirQuh] langganan "store_memos" gagal:', err)
        },
      ),
    )
    unsubs.push(
      onSnapshot(
        query(collection(db, 'titip_requests'), orderBy('createdAt', 'desc'), limit(50)),
        (snap) => {
          set({ titipRequests: snap.docs.map((d) => mapTitipRequest(d)) })
        },
        (err) => {
          console.error('[KasirQuh] langganan "titip_requests" gagal:', err)
        },
      ),
    )
    return () => {
      unsubs.forEach((u) => {
        try {
          u()
        } catch {
        }
      })
    }
  },

  clearRole: () => {
    set({
      customerNotesList: [],
      adminCustomerNotes: [],
      storeMemos: [],
      titipRequests: [],
      loading: true,
    })
  },

  addCustomerNote: async ({ customerId, type, amount, note, date }) => {
    requireOnline()
    assertAdmin()
    if (!customerId) throw new Error('Pilih pelanggan dulu')
    if (!String(note || '').trim()) throw new Error('Tulis isi catatan dulu')
    const payload: DocumentData = {
      customerId: customerId,
      type: type || 'catatan',
      amount: Math.round(Number(amount) || 0),
      note: String(note).trim(),
      createdAt: serverTimestamp(),
    }
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      payload.noteDate = date.trim()
    }
    await withTimeout(
      addDoc(collection(getDb(), 'customer_notes'), payload),
      WRITE_TIMEOUT_MS,
      'Tambah catatan',
    )
  },

  addStoreMemo: async ({ title, body }) => {
    requireOnline()
    assertAdmin()
    const isi = String(body || '').trim()
    if (!isi) throw new Error('Tulis catatan dulu')
    await withTimeout(
      addDoc(collection(getDb(), 'store_memos'), {
        title: String(title || '').trim().slice(0, 80),
        body: isi.slice(0, 500),
        createdAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Tambah memo',
    )
  },

  deleteStoreMemo: async (id) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      deleteDoc(doc(getDb(), 'store_memos', id)),
      WRITE_TIMEOUT_MS,
      'Hapus memo',
    )
  },

  submitTitipRequest: async ({ item, note, method }) => {
    requireOnline()
    const uid = requireCustomerId()
    const barang = String(item || '').trim()
    if (!barang) throw new Error('Tulis barang yang dititip dulu')
    await withTimeout(
      addDoc(collection(getDb(), 'titip_requests'), {
        customerId: uid,
        customerName: useAuthStore.getState().session.name || 'Pelanggan',
        item: barang.slice(0, 100),
        note: String(note || '').slice(0, 300),
        method: String(method || 'Ambil di warung'),
        status: 'baru',
        createdAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Kirim titipan',
    )
  },

  setTitipStatus: async (docId, status) => {
    requireOnline()
    assertAdmin()
    const allowed = ['baru', 'diproses', 'tersedia', 'selesai', 'dibatalkan']
    if (!allowed.includes(status)) throw new Error('Status tidak valid')
    await withTimeout(
      updateDoc(doc(getDb(), 'titip_requests', docId), {
        status: status,
        updatedAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Ubah status titipan',
    )
  },
}))

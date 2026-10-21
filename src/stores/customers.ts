/**
 * KasirQuh React — src/stores/customers.ts
 * Data pelanggan + persetujuan + koin. Pengganti js/store/customers.js
 * (approveCustomer, rejectCustomer, grantCoins, grantGameCoins, adjustCoins,
 * saveCustomerDoc, updateCustomerName, grantBonusToAll) plus langganan
 * dokumen pelanggan sendiri dari js/store/chat.js (startCustomerSubs).
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
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { getDb, requireOnline } from '../lib/firebase'

/** Hasil identifikasi member kasir (lebih lengkap dari KasirMember). */
export interface MemberLookup {
  uid: string
  name: string
  memberCode: string
  coins: number
}
import { todayKeyJakarta, withTimeout, WRITE_TIMEOUT_MS } from '../lib/firestore'
import { assertAdmin, notifyUser, useAuthStore } from './auth'
import { useSettingsStore } from './settings'
import { usePromoStore } from './promo'
import { useOrdersStore } from './orders'

export interface CustomerRecord {
  id: string
  name: string
  email: string
  wa: string
  address: string
  photoURL: string
  coins: number
  /** Total belanja (dihitung dari pesanan — lihat refreshSpend) */
  spend: number
  /** Riwayat ringkas: [label, sub][] */
  history: [string, string][]
}

export interface PendingCustomerRecord {
  id: string
  name: string
  email: string
  wa: string
  meta: string
  status: 'waiting' | 'rejected'
}

export interface GrantCoinsMeta {
  reason?: string
  label?: string
  detail?: string
  claimKey?: string
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

function mapCustomer(id: string, d: DocumentData): CustomerRecord {
  return {
    id,
    name: String(d.name || 'Pelanggan'),
    email: String(d.email || ''),
    wa: String(d.wa || ''),
    address: String(d.address || ''),
    photoURL: String(d.photoURL || ''),
    coins: Math.max(0, Math.floor(Number(d.coins) || 0)),
    spend: 0,
    history: [],
  }
}

function mapPending(id: string, d: DocumentData): PendingCustomerRecord {
  return {
    id,
    name: String(d.name || 'Pelanggan'),
    email: String(d.email || ''),
    wa: String(d.wa || 'Tanpa nomor WA'),
    meta: 'Mendaftar ' + (d.createdAt ? dateTimeOf(d.createdAt) : 'baru saja'),
    status: d.approvalStatus === 'rejected' ? 'rejected' : 'waiting',
  }
}

interface CustomersState {
  /** Pelanggan approved (admin) */
  customers: CustomerRecord[]
  /** Pendaftar pending/rejected (admin) */
  pendingCustomers: PendingCustomerRecord[]
  loading: boolean

  /** Langganan admin: customers approved + pending/rejected. Return unsub gabungan. */
  subscribeCustomers: () => () => void
  /** Langganan live dokumen customers/{uid} milik sesi. Return unsub. */
  subscribeMyDoc: (uid: string) => () => void
  /** Bersihkan state lingkup peran (dipanggil saat ganti peran/logout). */
  clearRole: () => void
  /** Hitung ulang spend + history dari daftar pesanan (dari js/store/derived.js). */
  refreshSpend: (orders: { customerId: string; id: string; rawStatus: string; time: string; total: number }[]) => void

  approveCustomer: (uid: string) => Promise<void>
  rejectCustomer: (uid: string) => Promise<void>
  /** Grant koin transaksional: cek klaim ganda di dalam transaksi.
   *  Return true bila koin benar-benar dikreditkan, false bila klaim
   *  ditolak karena penanda (lastCheckin/lastGuessDate/missionClaims)
   *  sudah tercatat — dua perangkat tidak bisa klaim bersamaan. */
  grantCoins: (uid: string, amount: number, meta?: GrantCoinsMeta) => Promise<boolean>
  grantGameCoins: (
    uid: string,
    requestedCoins: number,
    meta?: { dateField?: string; todayField?: string; reason?: string; label?: string; points?: number },
  ) => Promise<{ granted: number; capped: boolean }>
  adjustCoins: (uid: string, delta: number, meta?: GrantCoinsMeta) => Promise<void>
  saveCustomerDoc: (patch: DocumentData) => Promise<void>
  updateCustomerName: (name: string) => Promise<void>
  grantBonusToAll: (amount: number, reason: string) => Promise<number>
  /** Cari member by kode (KQ-XXXXXXXX) untuk kasir. Return null bila tidak valid. */
  identifyMemberByCode: (code: string) => Promise<MemberLookup | null>
}

export const useCustomersStore = create<CustomersState>()((set, get) => ({
  customers: [],
  pendingCustomers: [],
  loading: true,

  subscribeCustomers: () => {
    const db = getDb()
    const applySpendSoon = () => {
      // spend dihitung ulang tiap ada perubahan pelanggan/pesanan
      get().refreshSpend(useOrdersStore.getState().onlineOrders)
    }
    const unsubApproved = onSnapshot(
      query(collection(db, 'customers'), where('approvalStatus', '==', 'approved')),
      (snap) => {
        set({
          customers: snap.docs.map((d) => mapCustomer(d.id, d.data() || {})),
          loading: false,
        })
        applySpendSoon()
      },
      (err) => {
        console.error('[KasirQuh] langganan "customers" gagal:', err)
        set({ loading: false })
      },
    )
    const unsubPending = onSnapshot(
      query(collection(db, 'customers'), where('approvalStatus', 'in', ['pending', 'rejected'])),
      (snap) => {
        set({ pendingCustomers: snap.docs.map((d) => mapPending(d.id, d.data() || {})) })
      },
      (err) => {
        console.error('[KasirQuh] langganan "customers pending" gagal:', err)
      },
    )
    return () => {
      unsubApproved()
      unsubPending()
    }
  },

  subscribeMyDoc: (uid) => {
    const unsub = onSnapshot(
      doc(getDb(), 'customers', uid),
      (snap) => {
        if (!snap.exists()) return
        const data = snap.data() || {}
        const authState = useAuthStore.getState()
        useAuthStore.setState({
          myCustomerDoc: { id: uid, ...(data as Record<string, unknown>) },
        })
        if (data.approvalStatus === 'rejected') {
          notifyUser('Pendaftaran ditolak warung')
          void authState.logout()
          return
        }
        if (data.approvalStatus !== 'approved') {
          /* JANGAN signOut di sini — status non-approved pada subscription
           * live sering kali transient (cache basi / race saat login ulang).
           * Cukup tampilkan mode terbatas; sesi Firebase dipertahankan. */
          return
        }
        usePromoStore.getState().setCoinBalance(Math.max(0, Math.round(Number(data.coins) || 0)))
        if (data.name) {
          const s = useAuthStore.getState().session
          useAuthStore.setState({ session: { ...s, name: String(data.name) } })
        }
      },
      (err) => {
        console.error('[KasirQuh] langganan "customers/' + uid + '" gagal:', err)
      },
    )
    return unsub
  },

  clearRole: () => {
    set({ customers: [], pendingCustomers: [], loading: true })
  },

  refreshSpend: (orders) => {
    set((s) => ({ customers: applySpendToCustomers(s.customers, orders) }))
  },

  approveCustomer: async (uid) => {
    requireOnline()
    assertAdmin()
    /* Opsi A: generate memberCode unik KQ-XXXXXXXX (8 char awal UID, uppercase) */
    const memberCode = 'KQ-' + String(uid).slice(0, 8).toUpperCase()
    await withTimeout(
      updateDoc(doc(getDb(), 'customers', uid), {
        approvalStatus: 'approved',
        memberCode: memberCode,
      }),
      WRITE_TIMEOUT_MS,
      'Setujui pelanggan',
    )
  },

  rejectCustomer: async (uid) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      updateDoc(doc(getDb(), 'customers', uid), { approvalStatus: 'rejected' }),
      WRITE_TIMEOUT_MS,
      'Tolak pelanggan',
    )
  },

  grantCoins: async (uid, amount, meta) => {
    amount = Math.round(Number(amount) || 0)
    if (!uid || !amount) return false
    requireOnline()
    meta = meta || {}
    const db = getDb()
    const ts = serverTimestamp()
    const todayKey = todayKeyJakarta()
    const claimKey =
      meta.reason === 'misi' && meta.claimKey
        ? String(meta.claimKey).replace(/[./]/g, '_')
        : null
    /* Transaksional (pola Native grantCoins di admin_repository.dart):
     * penanda klaim DIBACA di dalam runTransaction dari dokumen yang sama
     * yang ditulis — cek + tulis saldo + ledger + penanda atomik dalam satu
     * transaksi, jadi klaim bersamaan dari dua perangkat tidak bisa lolos
     * dua-duanya. Anti-klaim-ganda tidak lagi bertumpu pada guard UI. */
    return withTimeout(
      runTransaction(db, async (tx) => {
        const ref = doc(db, 'customers', uid)
        const snap = await tx.get(ref)
        const data = snap.exists() ? snap.data() : {}
        if (meta.reason === 'harian' && data.lastCheckin === todayKey) return false
        if (meta.reason === 'tebak_harga' && data.lastGuessDate === todayKey) return false
        if (claimKey) {
          const claims = (data.missionClaims || {}) as Record<string, unknown>
          if (claims[claimKey] === true) return false
        }
        const update: DocumentData = { coins: increment(amount) }
        if (meta.reason === 'harian') update.lastCheckin = todayKey
        if (meta.reason === 'tebak_harga') update.lastGuessDate = todayKey
        if (claimKey) update['missionClaims.' + claimKey] = true
        tx.update(ref, update)
        tx.set(doc(collection(db, 'coin_ledger')), {
          customerId: uid,
          amount: amount,
          reason: meta.reason || 'harian',
          label: meta.label || 'Koin masuk',
          detail: meta.detail || '',
          createdAt: ts,
        })
        return true
      }),
      WRITE_TIMEOUT_MS,
      'Klaim koin',
    )
  },

  grantGameCoins: async (uid, requestedCoins, meta) => {
    requestedCoins = Math.max(0, Math.floor(Number(requestedCoins) || 0))
    if (!uid || !requestedCoins) return { granted: 0, capped: false }
    requireOnline()
    meta = meta || {}
    const db = getDb()
    const ts = serverTimestamp()
    const today = todayKeyJakarta()
    const GAME_MAX_COINS_PER_DAY = 500
    const dateField = meta.dateField || 'gameCoinsDate'
    const todayField = meta.todayField || 'gameCoinsToday'
    return withTimeout(
      runTransaction(db, async (tx) => {
        const ref = doc(db, 'customers', uid)
        const snap = await tx.get(ref)
        const data = snap.exists() ? snap.data() : {}
        const already =
          data[dateField] === today ? Math.max(0, Math.floor(Number(data[todayField]) || 0)) : 0
        const grant = Math.max(0, Math.min(requestedCoins, GAME_MAX_COINS_PER_DAY - already))
        if (!grant) return { granted: 0, capped: true }
        const upd: DocumentData = { coins: increment(grant) }
        upd[dateField] = today
        upd[todayField] = already + grant
        tx.update(ref, upd)
        tx.set(doc(collection(db, 'coin_ledger')), {
          customerId: uid,
          amount: grant,
          reason: meta.reason || 'game_tangkap_diskon',
          label: meta.label || 'Tangkap Diskon',
          detail: String(meta.points || 0) + ' poin',
          createdAt: ts,
        })
        return { granted: grant, capped: grant < requestedCoins }
      }),
      WRITE_TIMEOUT_MS,
      'Klaim koin game',
    )
  },

  adjustCoins: async (uid, delta, meta) => {
    requireOnline()
    assertAdmin()
    delta = Math.round(Number(delta) || 0)
    if (!uid || !delta) return
    meta = meta || {}
    const db = getDb()
    const ts = serverTimestamp()
    const batch = writeBatch(db)
    batch.update(doc(db, 'customers', uid), { coins: increment(delta) })
    batch.set(doc(collection(db, 'coin_ledger')), {
      customerId: uid,
      amount: delta,
      reason: meta.reason || 'koreksi_admin',
      label: meta.label || 'Koreksi admin',
      detail: meta.detail || '',
      createdAt: ts,
    })
    if (delta < 0) {
      const coinRate = useSettingsStore.getState().coinRate
      batch.set(doc(collection(db, 'journal')), {
        type: 'pengeluaran',
        category: 'beban_promosi',
        amount: Math.abs(delta) * Math.max(1, coinRate),
        note: 'Penukaran koin · ' + Math.abs(delta).toLocaleString('id-ID') + ' koin',
        refId: '',
        method: 'Koin Warga',
        profit: 0,
        itemCount: 0,
        createdAt: ts,
      })
    }
    await withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Atur koin')
  },

  saveCustomerDoc: async (patch) => {
    const uid = useAuthStore.getState().session.customerId
    const isGuest = useAuthStore.getState().session.isGuest
    if (!uid || isGuest) return // tamu: sesi-saja
    requireOnline()
    await withTimeout(
      updateDoc(doc(getDb(), 'customers', uid), patch),
      WRITE_TIMEOUT_MS,
      'Simpan profil',
    )
  },

  updateCustomerName: async (name) => {
    requireOnline()
    const uid = useAuthStore.getState().session.customerId
    if (!uid) throw new Error('Masuk dulu sebagai pelanggan')
    const nama = String(name || '').trim().slice(0, 50)
    if (!nama) throw new Error('Isi nama dulu')
    const s = useAuthStore.getState().session
    useAuthStore.setState({ session: { ...s, name: nama } }) // langsung berlaku di sesi
    try {
      await withTimeout(
        updateDoc(doc(getDb(), 'customers', uid), { name: nama }),
        WRITE_TIMEOUT_MS,
        'Ganti nama',
      )
    } catch (error) {
      if (!error || (error as { code?: string }).code !== 'permission-denied') throw error
      // permission-denied → diam: nama tetap sesi-saja, tanpa crash
    }
  },

  grantBonusToAll: async (amount, reason) => {
    amount = Math.max(0, Math.floor(Number(amount) || 0))
    reason = String(reason || '').trim()
    if (!amount) throw new Error('Jumlah koin wajib diisi')
    if (!reason) throw new Error('Alasan wajib diisi')
    requireOnline()
    assertAdmin()
    const snap = await getDocs(
      query(collection(getDb(), 'customers'), where('approvalStatus', '==', 'approved')),
    )
    let n = 0
    for (const d of snap.docs) {
      await get().grantCoins(d.id, amount, {
        /* Skema ledger seragam Native: reason = kode tetap 'bonus_event';
         * alasan bebas admin masuk ke detail saja. */
        reason: 'bonus_event',
        label: 'Bonus event',
        detail: reason,
      })
      n++
    }
    return n
  },

  identifyMemberByCode: async (code) => {
    const c = String(code || '').toUpperCase()
    if (!/^KQ-[A-Z0-9]{8}$/i.test(c)) return null
    const snap = await withTimeout(
      getDocs(query(collection(getDb(), 'customers'), where('memberCode', '==', c), limit(2))),
      WRITE_TIMEOUT_MS,
      'Cari member',
    )
    if (snap.empty || snap.size > 1) return null
    const d0 = snap.docs[0]
    const data = d0.data() || {}
    if (data.approvalStatus !== 'approved') return null
    return {
      uid: d0.id,
      name: String(data.name || 'Member'),
      memberCode: c,
      coins: Math.max(0, Math.round(Number(data.coins) || 0)),
    }
  },
}))

/**
 * refreshCustomerSpend (js/store/derived.js): hitung spend + history tiap
 * pelanggan dari daftar pesanan. Dipanggil orders store setiap pesanan berubah.
 */
export function applySpendToCustomers(
  customers: CustomerRecord[],
  orders: { customerId: string; id: string; rawStatus: string; time: string; total: number }[],
): CustomerRecord[] {
  const spendMap: Record<string, number> = {}
  const histMap: Record<string, [string, string][]> = {}
  const statusLabel = (raw: string) =>
    ({ menunggu: 'Menunggu', dikemas: 'Dikemas', dikirim: 'Dikirim', selesai: 'Selesai', dibatalkan: 'Dibatalkan' } as Record<string, string>)[raw] || raw
  ;(orders || []).forEach((order) => {
    if (!order.customerId) return
    spendMap[order.customerId] = (spendMap[order.customerId] || 0) + order.total
    ;(histMap[order.customerId] = histMap[order.customerId] || []).push([
      '#' + order.id + ' · ' + statusLabel(order.rawStatus),
      order.time + ' · Rp' + order.total.toLocaleString('id-ID'),
    ])
  })
  return (customers || []).map((c) => ({
    ...c,
    spend: spendMap[c.id] || 0,
    history: histMap[c.id] || [],
  }))
}

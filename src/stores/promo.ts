import { create } from 'zustand'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { getDb, requireOnline } from '../lib/firebase'
import { withTimeout, WRITE_TIMEOUT_MS, todayKeyJakarta } from '../lib/firestore'
import { toast } from '../components/ui'
import type { CoinEntry, Promo } from '../types'
import { assertAdmin, requireCustomerId, useAuthStore } from './auth'
import { useSettingsStore } from './settings'
import { useCustomersStore } from './customers'

const REASON_LABELS: Record<string, string> = {
  harian: 'Check-in harian',
  belanja: 'Bonus belanja',
  tukar: 'Penukaran koin',
  koreksi_admin: 'Koreksi admin',
  misi: 'Hadiah misi',
  tebak_harga: 'Tebak Harga',
  game_buru_diskon: 'Buru Diskon',
  game_tangkap_diskon: 'Tangkap Diskon',
}

function mapCoinEntry(d: DocumentData): CoinEntry {
  const amount = Math.round(Number(d.amount) || 0)
  const detail = String(d.detail || '')
  const ts = d.createdAt as { toDate?: () => Date } | null | undefined
  const time =
    ts && typeof ts.toDate === 'function'
      ? (() => {
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
              .format(ts.toDate())
              .replace('.', ':')
          } catch {
            return ''
          }
        })()
      : ''
  return {
    kind: amount >= 0 ? 'income' : 'expense',
    amount: Math.abs(amount),
    label: String(d.label || REASON_LABELS[String(d.reason)] || 'Koin'),
    detail: detail,
    time: time,
    sub: detail ? (time ? detail + ' · ' + time : detail) : time,
  }
}

export type CheckinResult = 'claimed' | 'sudah' | 'nonaktif' | 'tamu'

let checkinInflight: Promise<CheckinResult> | null = null

async function runCheckinOnce(
  customerId: string,
  myCustomerDoc: { lastCheckin?: string },
): Promise<CheckinResult> {
  const todayKey = todayKeyJakarta()
  const settings = useSettingsStore.getState()
  const markDone = () => usePromoStore.setState({ dailyCheckedIn: true })
  if (myCustomerDoc.lastCheckin === todayKey) {
    markDone()
    return 'sudah'
  }
  if (
    !(
      settings.coinProgramEnabled &&
      settings.coinEvents.checkin &&
      settings.coinRewards.checkin > 0
    )
  ) {
    markDone()
    return 'nonaktif'
  }
  try {
    const granted = await useCustomersStore
      .getState()
      .grantCoins(customerId, settings.coinRewards.checkin, {
        reason: 'harian',
        label: 'Check-in harian',
        detail: 'Bonus hari ini',
      })
    markDone()
    if (!granted) return 'sudah'
    setTimeout(() => {
      toast('Bonus harian · +' + settings.coinRewards.checkin + ' Koin Warga')
    }, 180)
    return 'claimed'
  } catch (error) {
    if (!error || (error as { code?: string }).code !== 'OFFLINE') {
      toast(
        (error as { message?: string })?.message ||
          'Bonus harian gagal · bisa dicoba lagi',
      )
    }
    return 'tamu'
  }
}

export interface PromoAdminRecord extends Promo {
  [key: string]: unknown
}

interface PromoState {
  coinBalance: number
  coinHistory: CoinEntry[]
  dailyCheckedIn: boolean
  promosAdmin: PromoAdminRecord[]

  setCoinBalance: (n: number) => void
  subscribeCoinHistory: (uid: string) => () => void
  subscribePromosAdmin: () => () => void
  clearRole: () => void

  checkin: () => Promise<CheckinResult>
  checkinLabel: () => string
  claimMission: (
    detailLabel: string,
    claimKey: string,
    opts?: { amount?: number; reason?: string; label?: string },
  ) => Promise<void>

  savePromo: (data: { title: string; copy?: string; badge?: string; isActive?: boolean }, id?: string) => Promise<void>
  setPromoActive: (id: string, isActive: boolean) => Promise<void>
  deletePromo: (id: string) => Promise<void>
}

export const usePromoStore = create<PromoState>()((set, get) => ({
  coinBalance: 0,
  coinHistory: [],
  dailyCheckedIn: false,
  promosAdmin: [],

  setCoinBalance: (n) => set({ coinBalance: Math.max(0, Math.round(n || 0)) }),

  subscribeCoinHistory: (uid) => {
    const unsub = onSnapshot(
      query(collection(getDb(), 'coin_ledger'), where('customerId', '==', uid), limit(60)),
      (snap) => {
        const ms = (d: DocumentData) => {
          const ts = d.createdAt as { toMillis?: () => number } | null | undefined
          return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0
        }
        const coinHistory = snap.docs
          .slice()
          .sort((a, b) => ms(b.data() || {}) - ms(a.data() || {}))
          .map((d) => mapCoinEntry(d.data() || {}))
        set({ coinHistory })
      },
      (err) => {
        console.error('[KasirQuh] langganan "coin_ledger" gagal:', err)
      },
    )
    return unsub
  },

  subscribePromosAdmin: () => {
    const unsub = onSnapshot(
      query(collection(getDb(), 'promos'), limit(30)),
      (snap) => {
        set({
          promosAdmin: snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() || {}) }) as PromoAdminRecord,
          ),
        })
      },
      (err) => {
        console.error('[KasirQuh] langganan "promos_admin" gagal:', err)
      },
    )
    return unsub
  },

  clearRole: () => {
    set({ coinBalance: 0, coinHistory: [], dailyCheckedIn: false, promosAdmin: [] })
  },

  checkin: async () => {
    const { session, myCustomerDoc } = useAuthStore.getState()
    if (session.isGuest || get().dailyCheckedIn || !session.customerId || !myCustomerDoc) {
      return 'tamu'
    }
    if (checkinInflight) return checkinInflight
    const run = runCheckinOnce(session.customerId, myCustomerDoc)
    checkinInflight = run
    try {
      return await run
    } finally {
      if (checkinInflight === run) checkinInflight = null
    }
  },

  checkinLabel: () => {
    const { session, myCustomerDoc } = useAuthStore.getState()
    const settings = useSettingsStore.getState()
    const todayKey = todayKeyJakarta()
    if (myCustomerDoc && myCustomerDoc.lastCheckin === todayKey) return 'Sudah diambil'
    if (get().dailyCheckedIn) return 'Sudah diambil'
    if (!session.customerId) return 'Memuat…'
    return settings.coinProgramEnabled && settings.coinEvents.checkin
      ? '+' + settings.coinRewards.checkin + ' koin'
      : 'Nonaktif'
  },

  claimMission: async (detailLabel, claimKey, opts) => {
    const settings = useSettingsStore.getState()
    const reason = opts?.reason || 'misi'
    const amount = Math.max(0, Math.round(Number(opts?.amount) || 0)) || settings.coinRewards.mission
    const label = opts?.label || 'Hadiah misi'
    const eventOn = reason === 'tebak_harga' ? settings.coinEvents.guess : settings.coinEvents.mission
    if (!settings.coinProgramEnabled || !eventOn || !(amount > 0)) {
      toast(reason === 'tebak_harga' ? 'Event tebak harga sedang dimatikan admin' : 'Event misi sedang dimatikan admin')
      return
    }
    const uid = requireCustomerId()
    try {
      const granted = await useCustomersStore.getState().grantCoins(uid, amount, {
        reason: reason,
        label: label,
        detail: detailLabel,
        claimKey: claimKey,
      })
      toast(granted ? amount + ' Koin Warga masuk' : 'Hadiah ini sudah pernah diklaim')
    } catch (error) {
      if (!error || (error as { code?: string }).code !== 'OFFLINE') {
        toast((error as { message?: string })?.message || 'Bonus gagal')
      }
    }
  },

  savePromo: async (data, id) => {
    requireOnline()
    assertAdmin()
    const title = String((data && data.title) || '').trim()
    if (!title) throw new Error('Isi judul promo dulu')
    const payload: DocumentData = {
      title: title.slice(0, 64),
      copy: String((data && data.copy) || '').slice(0, 110),
      badge: String((data && data.badge) || 'PROMO').slice(0, 12) || 'PROMO',
      isActive: !data || data.isActive !== false,
      updatedAt: serverTimestamp(),
    }
    if (id) {
      await withTimeout(
        updateDoc(doc(getDb(), 'promos', id), payload),
        WRITE_TIMEOUT_MS,
        'Simpan promo',
      )
    } else {
      payload.createdAt = serverTimestamp()
      await withTimeout(
        addDoc(collection(getDb(), 'promos'), payload),
        WRITE_TIMEOUT_MS,
        'Tambah promo',
      )
    }
  },

  setPromoActive: async (id, isActive) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      updateDoc(doc(getDb(), 'promos', id), {
        isActive: isActive !== false,
        updatedAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Ubah status promo',
    )
  },

  deletePromo: async (id) => {
    requireOnline()
    assertAdmin()
    await withTimeout(deleteDoc(doc(getDb(), 'promos', id)), WRITE_TIMEOUT_MS, 'Hapus promo')
  },
}))


export function calcEarnedCoins(total: number): number {
  const s = useSettingsStore.getState()
  if (
    s.coinProgramEnabled &&
    s.coinEvents.spend &&
    s.coinSpendReward > 0 &&
    s.coinSpendRule > 0
  ) {
    return Math.floor(total / s.coinSpendRule) * s.coinSpendReward
  }
  return 0
}

export function calcMaxRedeem(total: number, balance: number): { coins: number; value: number } {
  const s = useSettingsStore.getState()
  if (!s.coinProgramEnabled || s.coinRate <= 0 || s.coinRedeemLimit <= 0) {
    return { coins: 0, value: 0 }
  }
  const maxValue = Math.floor((total * s.coinRedeemLimit) / 100)
  const coins = Math.max(0, Math.min(balance, Math.floor(maxValue / s.coinRate)))
  return { coins: coins, value: coins * s.coinRate }
}

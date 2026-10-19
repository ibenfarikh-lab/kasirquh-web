/**
 * KasirQuh React — src/stores/alerts.ts
 * Pantau harga. Pengganti S.priceAlerts + priceWatching() dari js/app.js.
 * Disimpan di localStorage (perangkat) — sederhana & offline-friendly.
 */
import { create } from 'zustand'
import type { PriceAlert } from '../types'

const KEY = 'kasirquh.priceAlerts.v1'

function load(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function persist(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(alerts))
  } catch {
    /* abaikan */
  }
}

interface AlertsState {
  alerts: PriceAlert[]
  isWatching: (productId: string) => boolean
  toggle: (alert: PriceAlert) => boolean
}

export const useAlertsStore = create<AlertsState>()((set, get) => ({
  alerts: load(),

  isWatching: (productId) => get().alerts.some((a) => a.productId === productId),

  /** Toggle pantau; return true bila sekarang dipantau. */
  toggle: (alert) => {
    const exists = get().alerts.some((a) => a.productId === alert.productId)
    const alerts = exists
      ? get().alerts.filter((a) => a.productId !== alert.productId)
      : [...get().alerts, alert]
    persist(alerts)
    set({ alerts })
    return !exists
  },
}))

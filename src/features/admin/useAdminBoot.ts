/**
 * KasirQuh React — src/features/admin/useAdminBoot.ts
 * Helper kecil milik Worker Admin: pasang langganan data admin (localAdmin)
 * sekali halaman admin dipasang, setelah Firebase siap.
 */
import { useEffect } from 'react'
import { authPersistenceReady } from '../../lib/firebase'
import { useLocalAdminStore } from './localAdmin'

export function useAdminBoot() {
  const subscribeAll = useLocalAdminStore((s) => s.subscribeAll)
  useEffect(() => {
    let unsub: (() => void) | null = null
    authPersistenceReady.then(() => {
      try {
        unsub = subscribeAll()
      } catch {
        /* Firebase belum siap — halaman tetap render dengan state kosong */
      }
    })
    return () => {
      if (unsub) unsub()
    }
  }, [subscribeAll])
}

/** Peta nama view lama -> rute React admin. */
export function adminRoute(view: string): string {
  const map: Record<string, string> = {
    dashboard: '/admin',
    kasir: '/admin/kasir',
    pesanan: '/admin/pesanan',
    note: '/admin/catatan',
    menu: '/admin/menu',
    online: '/admin/online',
    data: '/admin/data',
    produk: '/admin/produk',
    chat: '/admin/chat',
    bookkeeping: '/admin/pembukuan',
    'pengaturan-koin': '/admin/pengaturan-koin',
    hajatan: '/admin/hajatan',
    patungan: '/admin/patungan',
    rutin: '/admin/rutin',
    'belanja-stok': '/admin/belanja-stok',
    'catatan-toko': '/admin/catatan-toko',
    pengaturan: '/admin/pengaturan',
    'profil-toko': '/admin/profil-toko',
    'ai-admin': '/admin/ai',
    'kendali-beranda': '/admin/kendali-beranda',
  }
  return map[view] || '/admin/menu'
}

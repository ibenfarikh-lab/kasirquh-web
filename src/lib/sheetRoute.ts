/**
 * KasirQuh React — src/lib/sheetRoute.ts
 * Back-button untuk sheet/modal — Opsi A (route-based, dipilih user 2026-10-20).
 * Dipakai terpusat oleh komponen Sheet (src/components/ui.tsx) dan overlay
 * fullscreen Chat Toko, agar tombol back browser menutup sheet/modal alih-alih
 * pindah halaman. Tanpa pushState/back()/popstate manual.
 */
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Back-button untuk sheet/modal — Opsi A (route-based, dipilih user 2026-10-20).
 *
 * Cara kerja:
 * - Sheet terbuka → dorong SATU entry history dengan search param `?sheet=<id>`
 *   (param lain dipertahankan). Tanpa pushState/back()/popstate manual.
 * - User tekan back browser → Router POP natural → param hilang → hook mendeteksi
 *   dan memanggil onClose. Sheet tertutup, user tetap di halaman.
 * - Semua penutup eksplisit (×, backdrop, Escape, tutup programatik) mengalir lewat
 *   onClose induk → hook membersihkan param via `replace` (tanpa travers history,
 *   jadi aman dari race dengan navigate induk).
 * - Sheet bertumpuk: tiap sheet punya id sendiri; back beruntun menutup satu per satu.
 * - Back tanpa sheet terbuka = navigasi normal (hook tidak ikut campur).
 */
export function useSheetRoute(sheetId: string, open: boolean, onClose: () => void): void {
  const navigate = useNavigate()
  const location = useLocation()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  // Entry history milik sheet ini sudah didorong (guard anti double-push,
  // termasuk double-invoke StrictMode di dev).
  const pushedRef = useRef(false)

  // Buka → dorong entry.
  useEffect(() => {
    if (open && !pushedRef.current) {
      pushedRef.current = true
      const sp = new URLSearchParams(location.search)
      sp.set('sheet', sheetId)
      navigate({ search: `?${sp.toString()}` }, { replace: false })
    }
    // location.search sengaja tidak jadi dep: baca sekali saat buka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheetId, navigate])

  // Lokasi berubah saat sheet terbuka & entry milik kita → user tekan back → tutup.
  useEffect(() => {
    if (!open || !pushedRef.current) return
    const sp = new URLSearchParams(location.search)
    if (sp.get('sheet') !== sheetId) {
      pushedRef.current = false
      onCloseRef.current()
    }
  }, [location, open, sheetId])

  // Induk menutup (×/backdrop/Escape/programatik) → bersihkan param via replace.
  // replace (bukan back) agar tidak race dengan navigate yang mungkin dilakukan
  // induk di handler yang sama (mis. login sukses → tutup + pindah halaman).
  useEffect(() => {
    if (!open && pushedRef.current) {
      pushedRef.current = false
      const sp = new URLSearchParams(location.search)
      if (sp.get('sheet') === sheetId) {
        sp.delete('sheet')
        const s = sp.toString()
        navigate({ search: s ? `?${s}` : '' }, { replace: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheetId, navigate])
}

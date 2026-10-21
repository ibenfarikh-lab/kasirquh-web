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
 *   onClose induk → hook membersihkan param via `replace` (tanpa travers history).
 *   Pembersihan DITUNDA satu ketuk dan diverifikasi ke lokasi TERKINI: induk
 *   boleh menavigasi di handler yang sama (mis. login sukses → tutup + lanjut
 *   ke aksi tertunda) — navigasi itu diproses router sebagai transisi yang
 *   mendarat SETELAH commit tutup, jadi cleanup yang membaca lokasi basi di
 *   commit tutup akan menavigasi `{search:''}` ke pathname lama dan menimpa
 *   tujuan induk (regresi kelanjutan pasca-login, terbukti via repro jsdom:
 *   replaceState /beranda/koin lalu replaceState /beranda dari cleanup).
 * - Sheet bertumpuk: tiap sheet punya id sendiri; back beruntun menutup satu per satu.
 * - Back tanpa sheet terbuka = navigasi normal (hook tidak ikut campur).
 */
export function useSheetRoute(sheetId: string, open: boolean, onClose: () => void): void {
  const navigate = useNavigate()
  const location = useLocation()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  // Lokasi & status buka TERKINI (diperbarui tiap render) untuk verifikasi
  // cleanup tertunda — jangan pernah menavigasi dari lokasi basi.
  const locationRef = useRef(location)
  locationRef.current = location
  const openRef = useRef(open)
  openRef.current = open
  // Entry history milik sheet ini sudah didorong (guard anti double-push,
  // termasuk double-invoke StrictMode di dev).
  const pushedRef = useRef(false)
  // Pathname saat entry sheet didorong + nomor generasi push — acuan cleanup:
  // param hanya boleh dibersihkan selama user masih di pathname yang sama
  // dan sheet yang sama belum dibuka lagi.
  const pushedPathnameRef = useRef<string | null>(null)
  const pushGenRef = useRef(0)
  // Param ?sheet=<id> milik sheet ini SUDAH PERNAH TERLIHAT di lokasi.
  // Wajib sebelum ketiadaan param boleh diartikan "user tekan back" — tanpa
  // guard ini, effect deteksi-back menembak di commit pembuka (lokasi di
  // closure masih yang lama, navigate() belum berlaku) dan sheet yang baru
  // dibuka langsung tertutup lagi ("muncul sebentar lalu hilang").
  const sawParamRef = useRef(false)

  // Buka → dorong entry.
  useEffect(() => {
    if (open && !pushedRef.current) {
      pushedRef.current = true
      pushedPathnameRef.current = location.pathname
      pushGenRef.current += 1
      const sp = new URLSearchParams(location.search)
      sp.set('sheet', sheetId)
      navigate({ search: `?${sp.toString()}` }, { replace: false })
    }
    // location.search sengaja tidak jadi dep: baca sekali saat buka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheetId, navigate])

  // Konfirmasi + deteksi back. Param harus TERLIHAT dulu di lokasi sebelum
  // ketiadaannya boleh diartikan user tekan back.
  useEffect(() => {
    if (!open || !pushedRef.current) return
    const sp = new URLSearchParams(location.search)
    if (sp.get('sheet') === sheetId) {
      sawParamRef.current = true
      return
    }
    if (sawParamRef.current) {
      pushedRef.current = false
      pushedPathnameRef.current = null
      sawParamRef.current = false
      onCloseRef.current()
    }
  }, [location, open, sheetId])

  // Induk menutup (×/backdrop/Escape/programatik) → bersihkan param via replace.
  // Pembersihan ditunda 50ms lalu diverifikasi ke lokasi TERKINI (locationRef):
  // navigasi induk yang diterbitkan di handler tutup yang sama (kelanjutan
  // pasca-login AuthSheet dsb.) diproses router sebagai transisi dan mendarat
  // sesudah commit tutup — cleanup seketika akan membaca lokasi basi (pathname
  // lama + param sheet) dan menavigasi `{search:''}` ke pathname lama,
  // menimpa tujuan induk. Setelah jeda: bila pathname sudah berubah, sheet
  // sudah dibuka lagi, atau param sudah tidak ada (mis. via back), cleanup
  // tidak melakukan apa-apa; selain itu param dibersihkan seperti biasa.
  useEffect(() => {
    if (!open && pushedRef.current) {
      pushedRef.current = false
      sawParamRef.current = false
      const gen = pushGenRef.current
      const pushedPath = pushedPathnameRef.current
      pushedPathnameRef.current = null
      const t = setTimeout(() => {
        if (openRef.current || pushGenRef.current !== gen) return
        const now = locationRef.current
        if (now.pathname !== pushedPath) return
        const sp = new URLSearchParams(now.search)
        if (sp.get('sheet') !== sheetId) return
        sp.delete('sheet')
        const s = sp.toString()
        navigate({ search: s ? `?${s}` : '' }, { replace: true })
      }, 50)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheetId, navigate])
}

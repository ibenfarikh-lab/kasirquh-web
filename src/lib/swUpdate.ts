/**
 * KasirQuh React — src/lib/swUpdate.ts
 * Deteksi update service worker otomatis.
 * Kalau ada versi baru, tampilkan prompt ke user (tidak perlu clear cache manual).
 */
import { useEffect, useState } from 'react'

export function useSWUpdate() {
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | undefined

    async function checkForUpdate() {
      try {
        registration = await navigator.serviceWorker.getRegistration()
        if (!registration) return

        // Cek update setiap 60 detik
        setInterval(() => {
          registration?.update().catch(() => {})
        }, 60000)

        // Kalau sudah ada SW menunggu (dari kunjungan sebelumnya) → otomatis update
        if (registration.waiting) {
          setUpdating(true)
          autoApply(registration.waiting)
        }

        // Dengarkan SW baru yang terinstall
        registration.addEventListener('updatefound', () => {
          const newSW = registration!.installing
          if (!newSW) return
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdating(true)
              autoApply(newSW)
            }
          })
        })
      } catch {
        /* abaikan */
      }
    }

    checkForUpdate()
  }, [])

  function autoApply(sw: ServiceWorker) {
    // Tunggu 3 detik agar user lihat notifikasi, lalu reload otomatis
    setTimeout(() => {
      sw.postMessage({ type: 'SKIP_WAITING' })
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        window.location.reload()
      })
      setTimeout(() => {
        if (!reloaded) {
          reloaded = true
          window.location.reload()
        }
      }, 2000)
    }, 3000)
  }


  return { updating }
}

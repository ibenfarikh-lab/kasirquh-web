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

        setInterval(() => {
          registration?.update().catch(() => {})
        }, 60000)

        if (registration.waiting) {
          setUpdating(true)
          autoApply(registration.waiting)
        }

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
      }
    }

    checkForUpdate()
  }, [])

  function autoApply(sw: ServiceWorker) {
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

/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { skipWaiting, clientsClaim } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import type { MessagePayload } from 'firebase/messaging'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

skipWaiting()
clientsClaim()

self.addEventListener('message', (e) => {
  if ((e.data as { type?: string })?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/__/, /^\/games\//],
  }),
)

const firebaseApp = initializeApp({
  apiKey: 'AIzaSyDyI4SeDiLg8vSAhwrjHAWQQ3W49Jnp6Ks',
  authDomain: 'kasirquh-app.firebaseapp.com',
  projectId: 'kasirquh-app',
  storageBucket: 'kasirquh-app.firebasestorage.app',
  messagingSenderId: '279862438786',
  appId: '1:279862438786:web:4c03692c2c2d9340b8fd9b',
})

try {
  const messaging = getMessaging(firebaseApp)
  onBackgroundMessage(messaging, (payload: MessagePayload) => {
    const title = payload.notification?.title || 'Warunge Mimi'
    const options: NotificationOptions = {
      body: payload.notification?.body || 'Ada kabar baru',
      icon: '/assets/img/img-005.png',
      badge: '/assets/img/img-005.png',
      data: payload.data || {},
    }
    self.registration.showNotification(title, options)
  })
} catch {
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | undefined
  const url = (data && data.url) || '/'
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of clientList) {
        const win = client as WindowClient
        if (win.url.includes(self.location.origin) && 'focus' in win) {
          return win.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
      return undefined
    })(),
  )
})

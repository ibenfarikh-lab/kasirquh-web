/* KasirQuh — Firebase Cloud Messaging Service Worker
 * Menangani push notification saat aplikasi di background/tertutup.
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDyI4SeDiLg8vSAhwrjHAWQQ3W49Jnp6Ks",
  authDomain: "kasirquh-app.firebaseapp.com",
  projectId: "kasirquh-app",
  storageBucket: "kasirquh-app.firebasestorage.app",
  messagingSenderId: "279862438786",
  appId: "1:279862438786:web:4c03692c2c2d9340b8fd9b"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Warunge Mimi';
  const options = {
    body: (payload.notification && payload.notification.body) || 'Ada kabar baru',
    icon: '/assets/img/img-005.png',
    badge: '/assets/img/img-005.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

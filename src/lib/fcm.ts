/**
 * KasirQuh React — src/lib/fcm.ts
 * Firebase Cloud Messaging (push notification), foreground.
 * Port js/fcm.js ke modular SDK.
 *
 * VAPID key publik (aman di client-side) dari Firebase Console.
 */
import { deleteToken, getToken, isSupported, onMessage } from 'firebase/messaging'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDb, getFirebaseAuth, getFirebaseMessaging } from './firebase'

const FCM_VAPID_KEY =
  'BCqm7CrTfNFb3NWswI3crJLVuL_LptKcU3iR9_miapPhkKwfREd1liSoJ-h0dpTcdGwNiKtlA75nTZeA1vJusCE'

let initialized = false
let currentToken: string | null = null

/** Pasang handler pesan foreground (sekali). */
export async function initFcm(): Promise<boolean> {
  if (initialized) return true
  try {
    if (!('Notification' in window)) return false
    if (!(await isSupported())) return false
    const messaging = await getFirebaseMessaging()
    if (!messaging) return false
    onMessage(messaging, (payload) => {
      // Keputusan user (2026-10-21): notifikasi foreground TIDAK diteruskan ke
      // toast (biang tumpukan toast). Cukup notifikasi sistem + penanda Inbox.
      const title = payload.notification?.title || 'Warunge Mimi'
      const body = payload.notification?.body || 'Ada kabar baru'
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon: '/assets/img/img-005.png' })
        } catch {
          /* abaikan */
        }
      }
    })
    initialized = true
    return true
  } catch {
    return false
  }
}

/** Minta izin + ambil token + simpan ke fcm_tokens. Dipanggil setelah login. */
export async function registerFcmToken(): Promise<string | null> {
  if (!(await initFcm())) return null
  try {
    if ((await Notification.requestPermission()) !== 'granted') return null
    const messaging = await getFirebaseMessaging()
    if (!messaging) return null
    const registration = await navigator.serviceWorker.ready
    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: registration,
    })
    if (!token) return null
    currentToken = token
    const uid = getFirebaseAuth().currentUser?.uid || 'anon'
    try {
      await setDoc(
        doc(getDb(), 'fcm_tokens', uid + '_' + token.slice(-12)),
        { uid, token, platform: 'web', updatedAt: serverTimestamp() },
        { merge: true },
      )
    } catch {
      try {
        localStorage.setItem('fcm_token_pending', token)
      } catch {
        /* abaikan */
      }
    }
    return token
  } catch {
    return null
  }
}

/** Hapus token saat logout. */
export async function unregisterFcmToken(): Promise<void> {
  if (!currentToken) return
  try {
    const messaging = await getFirebaseMessaging()
    if (messaging) await deleteToken(messaging)
  } catch {
    /* abaikan */
  }
  currentToken = null
}

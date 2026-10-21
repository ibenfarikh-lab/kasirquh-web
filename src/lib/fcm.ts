import { deleteToken, getToken, isSupported, onMessage } from 'firebase/messaging'
import { arrayUnion, doc, setDoc } from 'firebase/firestore'
import { getDb, getFirebaseAuth, getFirebaseMessaging } from './firebase'

const FCM_VAPID_KEY =
  'BCqm7CrTfNFb3NWswI3crJLVuL_LptKcU3iR9_miapPhkKwfREd1liSoJ-h0dpTcdGwNiKtlA75nTZeA1vJusCE'

let initialized = false
let currentToken: string | null = null

export async function initFcm(): Promise<boolean> {
  if (initialized) return true
  try {
    if (!('Notification' in window)) return false
    if (!(await isSupported())) return false
    const messaging = await getFirebaseMessaging()
    if (!messaging) return false
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'Warunge Mimi'
      const body = payload.notification?.body || 'Ada kabar baru'
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon: '/assets/img/img-005.png' })
        } catch {
        }
      }
    })
    initialized = true
    return true
  } catch {
    return false
  }
}

export async function registerFcmToken(role: 'customer' | 'admin'): Promise<string | null> {
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
    const uid = getFirebaseAuth().currentUser?.uid
    if (!uid) return token
    try {
      if (role === 'admin') {
        await setDoc(
          doc(getDb(), 'store_settings', 'main'),
          { adminFcmTokens: arrayUnion(token) },
          { merge: true },
        )
      } else {
        await setDoc(doc(getDb(), 'customers', uid), { fcmToken: token }, { merge: true })
      }
    } catch {
      try {
        localStorage.setItem('fcm_token_pending', token)
      } catch {
      }
    }
    return token
  } catch {
    return null
  }
}

export async function unregisterFcmToken(): Promise<void> {
  if (!currentToken) return
  try {
    const messaging = await getFirebaseMessaging()
    if (messaging) await deleteToken(messaging)
  } catch {
  }
  currentToken = null
}

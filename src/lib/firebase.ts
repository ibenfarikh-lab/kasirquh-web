/**
 * KasirQuh React — src/lib/firebase.ts
 *
 * Pengganti js/config.js + js/firebase.js (compat SDK via CDN).
 * Sekarang memakai Firebase Modular SDK (npm) — tree-shakeable, ter-bundle Vite.
 *
 * CATATAN: nilai di bawah adalah konfigurasi client-side PUBLIK (bukan secret),
 * sama seperti di repo lama. Keamanan dijaga oleh Firestore Security Rules
 * + Firebase Auth, bukan oleh kerahasiaan config ini.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getMessaging, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: 'AIzaSyDyI4SeDiLg8vSAhwrjHAWQQ3W49Jnp6Ks',
  authDomain: 'kasirquh-app.firebaseapp.com',
  projectId: 'kasirquh-app',
  storageBucket: 'kasirquh-app.firebasestorage.app',
  messagingSenderId: '279862438786',
  appId: '1:279862438786:web:4c03692c2c2d9340b8fd9b',
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let initError: string | null = null

/** Promise yang resolve setelah auth persistence siap (pengganti FB.authPersistenceReady). */
export const authPersistenceReady: Promise<void> = (async () => {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
    await setPersistence(auth, browserLocalPersistence)
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err)
    console.error('[KasirQuh] Firebase init gagal:', initError)
  }
})()

export function getFirebaseApp(): FirebaseApp {
  if (!app) throw new Error('Firebase belum siap' + (initError ? ': ' + initError : ''))
  return app
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase Auth belum siap')
  return auth
}

export function getDb(): Firestore {
  if (!db) throw new Error('Firestore belum siap')
  return db
}

/** Messaging hanya tersedia di environment browser yang mendukung. */
export function getFirebaseMessaging(): Messaging | null {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return null
    return getMessaging(getFirebaseApp())
  } catch {
    return null
  }
}

/**
 * Pengganti FB.requireOnline(): lempar error jujur bila offline.
 * Pemanggil WAJIB menangkap dan menampilkan toast "Butuh koneksi internet".
 */
export function requireOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Butuh koneksi internet')
  }
}

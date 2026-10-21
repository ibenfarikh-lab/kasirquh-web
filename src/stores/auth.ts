import { create } from 'zustand'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import {
  authPersistenceReady,
  getDb,
  getFirebaseAuth,
  requireOnline,
} from '../lib/firebase'
import { withTimeout, WRITE_TIMEOUT_MS } from '../lib/firestore'
import { initFcm, registerFcmToken, unregisterFcmToken } from '../lib/fcm'
import { setSoundRole } from '../lib/audio'
import { toast } from '../components/ui'
import type { Session, SessionRole } from '../types'
import { useOrdersStore } from './orders'
import { useCustomersStore } from './customers'
import { useChatStore } from './chat'
import { usePromoStore } from './promo'
import { useNotesStore } from './notes'
import { useLedgerStore } from './ledger'
import { useCatalogStore } from './catalog'

export interface MyCustomerDoc {
  id: string
  name?: string
  coins?: number
  lastCheckin?: string
  missionClaims?: Record<string, boolean>
  approvalStatus?: string
  [key: string]: unknown
}

export interface RegisterCustomerInput {
  name: string
  email: string
  password: string
  wa: string
  address: string
}

const GUEST_SESSION: Session = {
  role: null,
  name: null,
  customerId: null,
  isGuest: true,
  email: null,
}

const roleUnsubs: (() => void)[] = []

let sessionSeq = 0
let sessionPromise: Promise<void> | null = null
let sessionResolve: (() => void) | null = null
let sessionToken = 0

function beginSession() {
  sessionSeq += 1
  const seq = sessionSeq
  sessionPromise = new Promise<void>((resolve) => {
    sessionResolve = resolve
  })
  sessionToken = seq
}

function endSession() {
  if (sessionResolve && sessionToken === sessionSeq) {
    const resolve = sessionResolve
    sessionResolve = null
    resolve()
  }
}

const SESSION_CYCLE_POLL_MS = 100
const SESSION_CYCLE_TIMEOUT_MS = 5000
const TOKEN_CLAIMS_RETRY_DELAYS_MS = [500, 1000]

function waitForSessionCycle(seqBefore: number): Promise<void> {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const timer = setInterval(() => {
      const cycleDone = sessionSeq > seqBefore && sessionResolve === null
      if (cycleDone || Date.now() - startedAt >= SESSION_CYCLE_TIMEOUT_MS) {
        clearInterval(timer)
        resolve()
      }
    }, SESSION_CYCLE_POLL_MS)
  })
}

interface AuthState {
  session: Session
  sessionStartedAt: string | null
  myCustomerDoc: MyCustomerDoc | null
  authReady: boolean
  loginDoor: 'customer' | null
  pendingGuestAction: string | null
  setPendingGuestAction: (action: string | null) => void
  loginSheetOpen: boolean
  loginSheetMessage: string | null
  openLoginSheet: (action?: string | null, message?: string | null) => void
  closeLoginSheet: () => void
  adminSheetOpen: boolean
  openAdminSheet: () => void
  closeAdminSheet: () => void

  init: () => () => void
  handleAuthState: (user: User | null) => Promise<void>
  sessionReady: () => Promise<void>
  registerCustomer: (input: RegisterCustomerInput) => Promise<void>
  loginCustomer: (email: string, password: string) => Promise<{ id: string; name: string }>
  loginAdmin: (email: string, password: string) => Promise<{ email: string }>
  logout: () => Promise<void>
  resetToGuest: () => void
}

export const useAuthStore = create<AuthState>()((set, get) => {
  function clearRoleSubs() {
    const unsubs = roleUnsubs.splice(0)
    unsubs.forEach((unsub) => {
      try {
        unsub()
      } catch {
      }
    })
  }

  function startAdminSubs() {
    clearRoleSubs()
    roleUnsubs.push(
      usePromoStore.getState().subscribePromosAdmin(),
      useOrdersStore.getState().subscribeAdminOrders(),
      useCustomersStore.getState().subscribeCustomers(),
      useLedgerStore.getState().subscribeJournal(),
      useNotesStore.getState().subscribeAdminNotes(),
      useChatStore.getState().subscribeAdminThreads(),
    )
  }

  function startCustomerSubs(uid: string) {
    clearRoleSubs()
    roleUnsubs.push(
      useCustomersStore.getState().subscribeMyDoc(uid),
      useOrdersStore.getState().subscribeCustomerOrders(uid),
      usePromoStore.getState().subscribeCoinHistory(uid),
      useNotesStore.getState().subscribeCustomerNotes(uid),
      useCatalogStore.getState().subscribeMyRecipes(uid),
      useChatStore.getState().subscribeCustomerThread(uid),
    )
  }

  function setGuestSession() {
    clearRoleSubs()
    useOrdersStore.getState().clearRole()
    useCustomersStore.getState().clearRole()
    useChatStore.getState().clearRole()
    usePromoStore.getState().clearRole()
    useNotesStore.getState().clearRole()
    useLedgerStore.getState().clearRole()
    useCatalogStore.getState().clearRole()
    set({
      session: { ...GUEST_SESSION },
      sessionStartedAt: null,
      myCustomerDoc: null,
      loginDoor: null,
    })
  }

  return {
    session: { ...GUEST_SESSION },
    sessionStartedAt: null,
    myCustomerDoc: null,
    authReady: false,
    loginDoor: null,
    pendingGuestAction: null,
    setPendingGuestAction: (action) => set({ pendingGuestAction: action }),
    loginSheetOpen: false,
    loginSheetMessage: null,
    openLoginSheet: (action, message) =>
      set({ loginSheetOpen: true, pendingGuestAction: action ?? null, loginSheetMessage: message ?? null }),
    closeLoginSheet: () => set({ loginSheetOpen: false, loginSheetMessage: null }),
    adminSheetOpen: false,
    openAdminSheet: () => set({ adminSheetOpen: true }),
    closeAdminSheet: () => set({ adminSheetOpen: false }),

    init: () => {
      let unsub: (() => void) | null = null
      let cancelled = false
      void authPersistenceReady.then(() => {
        if (cancelled) return
        try {
          unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
            void get().handleAuthState(user)
          })
        } catch (err) {
          console.error('[KasirQuh] onAuthStateChanged gagal:', err)
        }
      })
      return () => {
        cancelled = true
        if (unsub) unsub()
      }
    },

    sessionReady: () => sessionPromise || Promise.resolve(),

    handleAuthState: async (user) => {
      const sessionWasGuest = get().session.isGuest
      void sessionWasGuest
      beginSession()
      try {
        clearRoleSubs()
        setGuestSession()

        if (!user) {
          set({ authReady: true })
          return
        }

        const uid = user.uid

        let isAdmin = false
        for (let attempt = 0; ; attempt++) {
          try {
            const token = await user.getIdTokenResult()
            isAdmin = !!(token && token.claims && token.claims.admin === true)
            break
          } catch (err) {
            if (attempt >= TOKEN_CLAIMS_RETRY_DELAYS_MS.length) {
              console.warn(
                '[KasirQuh] getIdTokenResult gagal 3x, lanjut sebagai non-admin:',
                err,
              )
              break
            }
            await new Promise((resolve) =>
              setTimeout(resolve, TOKEN_CLAIMS_RETRY_DELAYS_MS[attempt]),
            )
          }
        }

        if (isAdmin) {
          if (get().loginDoor === 'customer') {
            set({ loginDoor: null })
            try {
              await signOut(getFirebaseAuth())
            } catch {
            }
            return
          }
          set({
            session: {
              role: 'admin',
              name: 'Admin Warunge Mimi',
              customerId: null,
              isGuest: false,
              email: user.email,
            },
            sessionStartedAt: new Date().toISOString(),
            authReady: true,
          })
          startAdminSubs()
          void initFcm().then((ok) => {
            if (ok) void registerFcmToken('admin').catch(() => {})
          }).catch(() => {})
          return
        }

        let data: MyCustomerDoc | null = null
        try {
          const snap = await getDoc(doc(getDb(), 'customers', uid))
          data = snap.exists() ? ({ id: uid, ...(snap.data() as Record<string, unknown>) } as MyCustomerDoc) : null
        } catch {
          data = null
        }
        if (!data || data.approvalStatus !== 'approved') {
          set({ authReady: true })
          return
        }

        set({
          session: {
            role: 'customer',
            name: (data.name as string) || 'Pelanggan',
            customerId: uid,
            isGuest: false,
            email: user.email,
          },
          sessionStartedAt: new Date().toISOString(),
          myCustomerDoc: data,
          authReady: true,
        })
        usePromoStore.getState().setCoinBalance(Math.max(0, Math.round(Number(data.coins) || 0)))
        startCustomerSubs(uid)
        void initFcm().then((ok) => {
          if (ok) void registerFcmToken('customer').catch(() => {})
        }).catch(() => {})
      } finally {
        endSession()
      }
    },

    registerCustomer: async ({ name, email, password, wa, address }) => {
      requireOnline()
      const auth = getFirebaseAuth()
      let cred
      try {
        cred = await withTimeout(
          createUserWithEmailAndPassword(auth, email, password),
          WRITE_TIMEOUT_MS,
          'Pendaftaran',
        )
      } catch (error) {
        throw new Error(authErrorMessage(error))
      }
      const uid = cred.user.uid
      try {
        await withTimeout(
          setDoc(doc(getDb(), 'customers', uid), {
            name: name,
            email: email,
            wa: wa || '',
            address: address || '',
            approvalStatus: 'pending',
            coins: 0,
            createdAt: serverTimestamp(),
          }),
          WRITE_TIMEOUT_MS,
          'Pendaftaran',
        )
      } catch (error) {
        try {
          await cred.user.delete()
        } catch {
        }
        throw new Error(authErrorMessage(error))
      }
      try {
        await signOut(auth)
      } catch {
      }
    },

    loginCustomer: async (email, password) => {
      requireOnline()
      const auth = getFirebaseAuth()
      set({ loginDoor: 'customer' })
      const seqBeforeSignIn = sessionSeq
      let cred
      try {
        cred = await signInWithEmailAndPassword(auth, email, password)
      } catch (error) {
        set({ loginDoor: null })
        throw new Error(authErrorMessage(error))
      }
      const uid = cred.user.uid
      const reject = async (msg: string): Promise<never> => {
        set({ loginDoor: null })
        try {
          await signOut(auth)
        } catch {
        }
        throw new Error(msg)
      }
      await waitForSessionCycle(seqBeforeSignIn)
      set({ loginDoor: null })
      if (!auth.currentUser) {
        throw new Error('Ini akun admin — masuk lewat pintu admin (ketuk logo toko)')
      }
      let data: Record<string, unknown> | null = null
      try {
        const snap = await getDoc(doc(getDb(), 'customers', uid))
        data = snap.exists() ? (snap.data() as Record<string, unknown>) : null
      } catch (error) {
        try {
          await signOut(auth)
        } catch {
        }
        throw new Error(authErrorMessage(error))
      }
      if (!data) return reject('Akun tidak ditemukan, silakan daftar dulu')
      if (data.approvalStatus === 'pending') return reject('Pendaftaran masih menunggu persetujuan warung')
      if (data.approvalStatus === 'rejected') return reject('Pendaftaran ditolak')
      await get().sessionReady()
      return { id: uid, name: String(data.name || 'Pelanggan') }
    },

    loginAdmin: async (email, password) => {
      requireOnline()
      const auth = getFirebaseAuth()
      let cred
      try {
        cred = await signInWithEmailAndPassword(auth, email, password)
      } catch (error) {
        throw new Error(authErrorMessage(error))
      }
      let claims: Record<string, unknown> | null = null
      try {
        const token = await cred.user.getIdTokenResult(true)
        claims = (token && (token.claims as Record<string, unknown>)) || {}
      } catch {
        claims = null
      }
      if (!claims || claims.admin !== true) {
        try {
          await signOut(auth)
        } catch {
        }
        throw new Error('Akun ini bukan admin')
      }
      await get().sessionReady()
      if (get().session.role !== 'admin') {
        clearRoleSubs()
        set({
          session: {
            role: 'admin',
            name: 'Admin Warunge Mimi',
            customerId: null,
            isGuest: false,
            email: email,
          },
          sessionStartedAt: new Date().toISOString(),
          myCustomerDoc: null,
        })
        startAdminSubs()
      }
      return { email: email }
    },

    logout: async () => {
      setGuestSession()
      void unregisterFcmToken().catch(() => {})
      try {
        await signOut(getFirebaseAuth())
      } catch {
      }
    },

    resetToGuest: () => {
      setGuestSession()
    },
  }
})

setSoundRole(useAuthStore.getState().session.role)
useAuthStore.subscribe((s) => setSoundRole(s.session.role))

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code || ''
  if (code === 'auth/email-already-in-use') return 'Email sudah dipakai'
  if (code === 'auth/invalid-email') return 'Format email belum benar'
  if (code === 'auth/weak-password') return 'Kata sandi minimal 6 karakter'
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
    return 'Email atau kata sandi salah'
  if (code === 'auth/user-not-found') return 'Belum terdaftar, silakan daftar dulu'
  if (code === 'auth/too-many-requests') return 'Terlalu banyak percobaan, coba lagi nanti'
  if (code === 'auth/network-request-failed' || code === 'OFFLINE') return 'Butuh koneksi internet'
  if (code === 'permission-denied') return 'Akses ditolak — hubungi admin warung'
  return (error as { message?: string } | null)?.message || 'Terjadi kesalahan, coba lagi'
}

export function assertAdmin(): void {
  const role: SessionRole = useAuthStore.getState().session.role
  if (role !== 'admin') throw new Error('Hanya admin yang boleh melakukan ini')
}

export function activeCustomerId(): string | null {
  const s = useAuthStore.getState().session
  return s.role === 'customer' && !s.isGuest ? s.customerId : null
}

export function requireCustomerId(): string {
  const uid = activeCustomerId()
  if (!uid) throw new Error('Masuk dulu sebagai pelanggan')
  return uid
}

export function notifyUser(msg: string): void {
  toast(msg)
}

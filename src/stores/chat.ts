import { create } from 'zustand'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getDb, getFirebaseAuth, requireOnline } from '../lib/firebase'
import { withTimeout, WRITE_TIMEOUT_MS } from '../lib/firestore'
import type { RumpiMessage, ThreadMessage } from '../types'
import { playNotification } from '../lib/audio'
import { assertAdmin, notifyUser, requireCustomerId, useAuthStore } from './auth'
import { useCustomersStore } from './customers'

export interface ChatThread {
  name: string
  initial: string
  photoURL?: string
  messages: ThreadMessage[]
  unread: number
  customerUnread: number
  lastMessage?: string
  updatedAt: number
  _loadingMessages?: boolean
}

function timeOf(ts: { toDate?: () => Date } | null | undefined): string {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date()
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(d)
      .replace('.', ':')
  } catch {
    return ''
  }
}

function millisOf(
  ts: { toMillis?: () => number; toDate?: () => Date } | null | undefined,
  fallback = 0,
): number {
  try {
    if (ts && typeof ts.toMillis === 'function') return ts.toMillis()
    if (ts && typeof ts.toDate === 'function') return ts.toDate().getTime()
  } catch {
  }
  return fallback
}

function dateTimeOf(ts: { toDate?: () => Date } | null | undefined): string {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date()
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    })
      .format(d)
      .replace('.', ':')
  } catch {
    return 'Baru saja'
  }
}

export function mapRumpi(d: QueryDocumentSnapshot<DocumentData>): RumpiMessage {
  const data = d.data() || {}
  const name = String(data.authorName || 'Warga')
  return {
    id: d.id,
    name: name,
    initial: (name.charAt(0) || 'W').toUpperCase(),
    authorPhoto: String(data.authorPhoto || ''),
    time: data.createdAt ? dateTimeOf(data.createdAt) : 'Baru saja',
    text: String(data.text || ''),
    photo: String(data.imageUrl || ''),
    photoAlt: 'Foto yang dibagikan',
    admin: data.authorRole === 'admin',
    seed: !!data.isSeed,
    likeCount: Math.max(0, Math.round(Number(data.likeCount) || 0)),
  }
}

export function mapThreadMessage(d: QueryDocumentSnapshot<DocumentData>): ThreadMessage {
  const data = d.data() || {}
  return {
    id: d.id,
    side: data.senderRole === 'admin' ? 'admin' : 'customer',
    time: data.createdAt ? timeOf(data.createdAt) : 'Baru saja',
    text: String(data.text || ''),
  }
}

async function migrateLegacyThread(uid: string): Promise<void> {
  const db = getDb()
  const threadRef = doc(db, 'chat_threads', uid)
  const legacyRef = doc(db, 'chat_threads', 'toko_' + uid)
  try {
    const legacySnap = await getDoc(legacyRef)
    const legacyData = legacySnap.exists() ? (legacySnap.data() as DocumentData) : null
    if (legacyData && !legacyData.migratedTo) {
      const tsMillis = (v: unknown) =>
        v && typeof (v as { toMillis?: () => number }).toMillis === 'function'
          ? (v as { toMillis: () => number }).toMillis()
          : String(v == null ? '' : v)
      const msgKey = (m: DocumentData) =>
        String(m.senderId || '') + '|' + String(m.text || '') + '|' + tsMillis(m.createdAt)
      const [legacyMsgs, existingMsgs] = await Promise.all([
        getDocs(query(collection(legacyRef, 'messages'), orderBy('createdAt', 'asc'))),
        getDocs(query(collection(threadRef, 'messages'), orderBy('createdAt', 'asc'))),
      ])
      const seen = new Set(existingMsgs.docs.map((d) => msgKey(d.data() || {})))
      const batch = writeBatch(db)
      legacyMsgs.docs.forEach((md) => {
        const m = md.data() || {}
        if (seen.has(msgKey(m))) return
        batch.set(doc(collection(threadRef, 'messages')), {
          senderId: m.senderId || uid,
          senderRole: m.senderRole || 'customer',
          text: String(m.text || ''),
          createdAt: m.createdAt || serverTimestamp(),
        })
      })
      const threadSnap = await getDoc(threadRef)
      if (legacyData.lastMessage && !((threadSnap.data() || {}).lastMessage as string)) {
        batch.set(
          threadRef,
          {
            lastMessage: legacyData.lastMessage,
            updatedAt: legacyData.updatedAt || serverTimestamp(),
            unreadCustomer: Number(legacyData.unreadCustomer) || 0,
            unreadAdmin: Number(legacyData.unreadAdmin) || 0,
          },
          { merge: true },
        )
      }
      batch.set(legacyRef, { migratedTo: uid, migratedAt: serverTimestamp() }, { merge: true })
      await batch.commit()
    }
  } catch {
  }
  try {
    const legacySnap = await getDoc(legacyRef)
    const legacyData = legacySnap.exists() ? (legacySnap.data() as DocumentData) : null
    if (legacyData && legacyData.migratedTo === uid) {
      const legacyMsgs = await getDocs(collection(legacyRef, 'messages'))
      const targets = legacyMsgs.docs.map((d) => d.ref)
      targets.push(legacyRef)
      for (let i = 0; i < targets.length; i += 400) {
        const batch = writeBatch(db)
        targets.slice(i, i + 400).forEach((ref) => batch.delete(ref))
        await batch.commit()
      }
    }
  } catch {
  }
}

let msgUnsub: (() => void) | null = null

interface ChatState {
  rumpiPosts: RumpiMessage[]
  threads: Record<string, ChatThread>
  activeDirectThread: string

  subscribeRumpi: () => () => void
  subscribeCustomerThread: (uid: string) => () => void
  subscribeAdminThreads: () => () => void
  clearRole: () => void

  ensureCustomerThread: () => ChatThread
  patchThread: (id: string, patch: Partial<ChatThread>) => void
  upsertAdminThread: (id: string, data: DocumentData) => ChatThread
  refreshThreadNames: () => void
  resolveThreadId: (threadId: string) => string
  setActiveDirectThread: (id: string) => void

  watchThreadMessages: (threadId: string) => void
  stopWatchingThread: () => void

  sendChatMessage: (text: string, photo?: string) => Promise<void>
  markThreadRead: (threadId: string) => Promise<void>

  sendRumpi: (text: string, photo?: string) => Promise<void>
  deleteRumpi: (postId: string) => Promise<void>
  likeRumpi: (postId: string) => Promise<void>
}

export const useChatStore = create<ChatState>()((set, get) => ({
  rumpiPosts: [],
  threads: {},
  activeDirectThread: 'toko',

  subscribeRumpi: () => {
    const unsub = onSnapshot(
      query(collection(getDb(), 'rumpi_posts'), orderBy('createdAt', 'desc'), limit(20)),
      (snap) => {
        set({ rumpiPosts: snap.docs.map((d) => mapRumpi(d)) })
      },
      (err) => {
        console.error('[KasirQuh] langganan "rumpi_posts" gagal:', err)
      },
    )
    return unsub
  },

  subscribeCustomerThread: (uid) => {
    const db = getDb()
    let isFirstChatLoad = true
    const threadId = uid
    const threadRef = doc(db, 'chat_threads', threadId)
    void setDoc(
      threadRef,
      { type: 'toko', customerId: uid, createdAt: serverTimestamp() },
      { merge: true },
    ).catch(() => {
    })
    void migrateLegacyThread(uid)

    const unsubs: (() => void)[] = []
    unsubs.push(
      onSnapshot(
        threadRef,
        (snap) => {
          get().ensureCustomerThread()
          if (snap.exists()) {
            const d = snap.data() || {}
            get().patchThread('toko', { customerUnread: Number(d.unreadCustomer) || 0 })
          }
        },
        (err) => {
          console.error('[KasirQuh] langganan "chat_threads" gagal:', err)
        },
      ),
    )

    const msgRef = query(
      collection(threadRef, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(30),
    )
    get().patchThread('toko', { _loadingMessages: true })
    void getDocs(msgRef)
      .then((snap) => {
        get().ensureCustomerThread()
        get().patchThread('toko', {
          _loadingMessages: false,
          messages: snap.docs.map((d) => mapThreadMessage(d)).reverse(),
        })
      })
      .catch(() => {
      })
    const loadingTimer = setTimeout(() => {
      const thread = get().threads['toko']
      if (thread && thread._loadingMessages) {
        get().patchThread('toko', { _loadingMessages: false })
      }
    }, 15000)
    unsubs.push(
      onSnapshot(
        msgRef,
        (snap) => {
          if (!isFirstChatLoad) {
            try {
              snap.docChanges().forEach((change) => {
                if (change.type !== 'added') return
                const md = change.doc.data() || {}
                if (md.senderRole === 'admin') {
                  try {
                    playNotification('chat')
                  } catch {
                  }
                }
              })
            } catch {
            }
          }
          isFirstChatLoad = false
          get().ensureCustomerThread()
          get().patchThread('toko', {
            _loadingMessages: false,
            messages: snap.docs.map((d) => mapThreadMessage(d)).reverse(),
          })
        },
        (err) => {
          get().patchThread('toko', { _loadingMessages: false })
          console.error('[KasirQuh] langganan "chat messages" gagal:', err)
        },
      ),
    )
    return () => {
      clearTimeout(loadingTimer)
      unsubs.forEach((u) => {
        try {
          u()
        } catch {
        }
      })
    }
  },

  subscribeAdminThreads: () => {
    const db = getDb()
    const chatRef = query(
      collection(db, 'chat_threads'),
      orderBy('updatedAt', 'desc'),
      limit(50),
    )
    let isFirstAdminChatLoad = true
    const adminChatPrevUnread: Record<string, number> = {}
    const handleSnap = (snap: { docs: QueryDocumentSnapshot<DocumentData>[]; docChanges: () => { type: string; doc: QueryDocumentSnapshot<DocumentData> }[] }) => {
      if (!isFirstAdminChatLoad) {
        try {
          snap.docChanges().forEach((change) => {
            const d = change.doc.data() || {}
            const unread = Number(d.unreadAdmin) || 0
            const prev = adminChatPrevUnread[change.doc.id] || 0
            if ((change.type === 'added' && unread > 0) || (change.type === 'modified' && unread > prev)) {
              try {
                playNotification('chat')
              } catch {
              }
            }
            adminChatPrevUnread[change.doc.id] = unread
          })
        } catch {
        }
      }
      isFirstAdminChatLoad = false
      try {
        snap.docChanges().forEach((change) => {
          const dd = change.doc.data() || {}
          adminChatPrevUnread[change.doc.id] = Number(dd.unreadAdmin) || 0
        })
      } catch {
      }
      snap.docs
        .filter((d) => (d.data() || {}).type === 'toko')
        .forEach((d) => get().upsertAdminThread(d.id, d.data() || {}))
    }
    void getDocs(chatRef)
      .then((snap) => handleSnap(snap))
      .catch(() => {
      })
    const unsub = onSnapshot(
      chatRef,
      (snap) => handleSnap(snap),
      (err) => {
        console.error('[KasirQuh] langganan "chat_threads" gagal:', err)
      },
    )
    return unsub
  },

  clearRole: () => {
    get().stopWatchingThread()
    set({ threads: {}, activeDirectThread: 'toko' })
  },

  ensureCustomerThread: () => {
    if (!get().threads['toko']) {
      const thread: ChatThread = {
        name: 'Warunge Mimi',
        initial: 'W',
        messages: [],
        unread: 0,
        customerUnread: 0,
        updatedAt: Date.now(),
      }
      set((s) => ({ threads: { ...s.threads, toko: thread } }))
    }
    return get().threads['toko']
  },

  patchThread: (id, patch) => {
    const cur = get().threads[id]
    if (!cur) return
    set((s) => ({ threads: { ...s.threads, [id]: { ...cur, ...patch } } }))
  },

  upsertAdminThread: (id, d) => {
    const customerId = String(d.customerId || id.replace(/^toko_/, ''))
    const customer = useCustomersStore.getState().customers.find((c) => c.id === customerId)
    const name = customer ? customer.name : 'Pelanggan'
    const prev = get().threads[id]
    const thread: ChatThread = {
      name: name,
      initial: (name.charAt(0) || '?').toUpperCase(),
      photoURL: customer ? String(customer.photoURL || '') : '',
      messages: prev ? prev.messages : [],
      unread: Number(d.unreadAdmin) || 0,
      customerUnread: prev ? prev.customerUnread : 0,
      lastMessage: String(d.lastMessage || ''),
      updatedAt: millisOf(d.updatedAt, prev?.updatedAt ?? 0),
    }
    set((s) => ({ threads: { ...s.threads, [id]: thread } }))
    return thread
  },

  refreshThreadNames: () => {
    const customers = useCustomersStore.getState().customers
    const patch: Record<string, ChatThread> = {}
    let changed = false
    Object.entries(get().threads).forEach(([id, thread]) => {
      if (!thread || id === 'toko') return
      const customerId = id.replace(/^toko_/, '')
      const customer = customers.find((c) => c.id === customerId)
      if (customer && customer.name && customer.name !== thread.name) {
        patch[id] = {
          ...thread,
          name: customer.name,
          initial: (customer.name.charAt(0) || '?').toUpperCase(),
        }
        changed = true
      }
    })
    if (changed) set((s) => ({ threads: { ...s.threads, ...patch } }))
  },

  resolveThreadId: (threadId) => {
    const { session } = useAuthStore.getState()
    if (threadId === 'toko' && session.role !== 'admin' && session.customerId) {
      return session.customerId
    }
    return threadId
  },

  setActiveDirectThread: (id) => set({ activeDirectThread: id }),

  watchThreadMessages: (threadId) => {
    get().stopWatchingThread()
    if (!threadId) return
    get().patchThread(threadId, { _loadingMessages: true })
    const ref = query(
      collection(getDb(), 'chat_threads', threadId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(30),
    )
    const clearLoading = () => get().patchThread(threadId, { _loadingMessages: false })
    void getDocs(ref)
      .then((snap) => {
        if (!get().threads[threadId] || get().activeDirectThread !== threadId) return
        clearLoading()
        get().patchThread(threadId, {
          messages: snap.docs.map((d) => mapThreadMessage(d)).reverse(),
        })
      })
      .catch(() => {
      })
    const timer = setTimeout(() => {
      const th = get().threads[threadId]
      if (th && th._loadingMessages && get().activeDirectThread === threadId) {
        clearLoading()
        notifyUser('Gagal memuat pesan · periksa koneksi lalu buka ulang')
      }
    }, 15000)
    msgUnsub = onSnapshot(
      ref,
      (snap) => {
        clearTimeout(timer)
        if (!get().threads[threadId]) get().upsertAdminThread(threadId, {})
        clearLoading()
        get().patchThread(threadId, {
          messages: snap.docs.map((d) => mapThreadMessage(d)).reverse(),
        })
      },
      (err) => {
        clearTimeout(timer)
        clearLoading()
        console.error('[KasirQuh] langganan "chat messages" gagal:', err)
      },
    )
  },

  stopWatchingThread: () => {
    if (msgUnsub) {
      try {
        msgUnsub()
      } catch {
      }
      msgUnsub = null
    }
  },

  sendChatMessage: async (text, photo) => {
    text = String(text || '').trim()
    photo = String(photo || '')
    if (!text && !photo) throw new Error('Tulis pesan dulu')
    requireOnline()
    const { session } = useAuthStore.getState()
    const db = getDb()
    const ts = serverTimestamp()
    let threadId: string
    let side: 'admin' | 'customer'
    let customerId: string
    if (session.role === 'admin') {
      threadId = get().activeDirectThread
      if (!threadId || threadId === 'toko') throw new Error('Pilih percakapan dulu')
      side = 'admin'
      customerId = threadId.replace(/^toko_/, '')
    } else {
      customerId = requireCustomerId()
      threadId = customerId
      side = 'customer'
    }
    if (!threadId || threadId === 'null' || threadId === 'undefined') {
      throw new Error('ID percakapan tidak valid')
    }
    const threadRef = doc(db, 'chat_threads', threadId)
    const unreadField = side === 'admin' ? 'unreadCustomer' : 'unreadAdmin'
    const header: DocumentData = {
      type: 'toko',
      customerId: customerId,
      lastMessage: text || (photo ? '[Foto]' : ''),
      updatedAt: ts,
    }
    header[unreadField] = increment(1)
    await withTimeout(setDoc(threadRef, header, { merge: true }), WRITE_TIMEOUT_MS, 'Kirim pesan')
    await withTimeout(
      addDoc(collection(threadRef, 'messages'), {
        senderId: side === 'admin' ? 'admin' : customerId,
        senderRole: side,
        text: text,
        imageUrl: photo,
        createdAt: ts,
      }),
      WRITE_TIMEOUT_MS,
      'Kirim pesan',
    )
  },

  markThreadRead: async (threadId) => {
    try {
      if (!threadId) return
      const { session } = useAuthStore.getState()
      const realId = get().resolveThreadId(threadId)
      const field = session.role === 'admin' ? 'unreadAdmin' : 'unreadCustomer'
      const update: DocumentData = {}
      update[field] = 0
      await setDoc(doc(getDb(), 'chat_threads', realId), update, { merge: true })
    } catch {
    }
  },

  sendRumpi: async (text, photo) => {
    text = String(text || '').trim()
    if (!text) throw new Error('Tulis dulu')
    requireOnline()
    const { session, myCustomerDoc } = useAuthStore.getState()
    const isAdmin = session.role === 'admin'
    await withTimeout(
      addDoc(collection(getDb(), 'rumpi_posts'), {
        authorId: isAdmin ? 'admin' : session.customerId || 'tamu',
        authorName: isAdmin ? 'Mimi · Warung' : session.name || 'Warga',
        authorRole: isAdmin ? 'admin' : 'customer',
        authorPhoto: isAdmin ? '' : String((myCustomerDoc && myCustomerDoc.photoURL) || ''),
        text: text,
        imageUrl: photo || '',
        likeCount: 0,
        isSeed: false,
        createdAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Kirim postingan',
    )
  },

  deleteRumpi: async (postId) => {
    requireOnline()
    assertAdmin()
    await withTimeout(
      deleteDoc(doc(getDb(), 'rumpi_posts', postId)),
      WRITE_TIMEOUT_MS,
      'Hapus postingan',
    )
  },

  likeRumpi: async (postId) => {
    requireOnline()
    const user = getFirebaseAuth().currentUser
    const uid = user ? user.uid : null
    if (!uid) throw new Error('Masuk dulu sebagai pelanggan')
    const db = getDb()
    await withTimeout(
      runTransaction(db, async (t) => {
        const postRef = doc(db, 'rumpi_posts', postId)
        const likeRef = doc(collection(postRef, 'likes'), uid)
        const likeSnap = await t.get(likeRef)
        if (likeSnap.exists()) {
          t.delete(likeRef)
          t.update(postRef, { likeCount: increment(-1) })
        } else {
          t.set(likeRef, { uid: uid, createdAt: serverTimestamp() })
          t.update(postRef, { likeCount: increment(1) })
        }
      }),
      WRITE_TIMEOUT_MS,
      'Suka postingan',
    )
  },
}))

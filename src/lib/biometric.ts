
const DB_NAME = 'kasirquh-bio'
const STORE = 'keys'
const RECORD_ID = 'fingerprint-login'

const PRF_FALLBACK_SETTLE_MS = 800

interface BioRecord {
  email: string
  role: string
  credentialId: string
  salt: string
  iv: string
  data: string
  createdAt: number
}

interface BioDb {
  enrollments?: Record<string, BioRecord>
  credentialId?: string
  email?: string
}

export interface BioCredentials {
  email: string
  password: string
  role: string
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64ToBuf(b64: string): ArrayBuffer {
  b64 = b64.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes.buffer
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGetAll(): Promise<BioDb> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(RECORD_ID)
    req.onsuccess = () => resolve((req.result as BioDb) || { enrollments: {} })
    req.onerror = () => reject(req.error)
  })
}

async function dbPut(email: string, record: BioRecord): Promise<void> {
  const all = await dbGetAll()
  all.enrollments = all.enrollments || {}
  all.enrollments[email] = record
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(all, RECORD_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function dbDelete(email: string): Promise<void> {
  const all = await dbGetAll()
  if (all.enrollments) delete all.enrollments[email]
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(all, RECORD_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function migrateIfNeeded(all: BioDb): BioDb {
  if (all && all.credentialId && all.email && !all.enrollments) {
    const o: Record<string, BioRecord> = {}
    o[all.email] = all as unknown as BioRecord
    return { enrollments: o }
  }
  return all
}

function prfOutputFrom(res: Credential | null): ArrayBuffer | null {
  try {
    const r = res as unknown as {
      getClientExtensionResults?: () => { prf?: { results?: { first?: ArrayBuffer } } }
    }
    const ext = r.getClientExtensionResults?.()
    return (ext?.prf?.results?.first as ArrayBuffer) || null
  } catch {
    return null
  }
}

export async function bioIsSupported(): Promise<boolean> {
  if (!window.isSecureContext) return false
  if (!window.PublicKeyCredential) return false
  if (
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function'
  )
    return false
  try {
    const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    if (!ok) return false
    const p = PublicKeyCredential as unknown as {
      getClientCapabilities?: () => Promise<{ prf?: boolean }>
    }
    if (typeof p.getClientCapabilities === 'function') {
      try {
        const caps = await p.getClientCapabilities()
        return caps.prf !== false
      } catch {
        return true
      }
    }
    return true
  } catch {
    return false
  }
}

export async function bioIsEnrolled(role?: string): Promise<boolean> {
  const all = migrateIfNeeded(await dbGetAll())
  const ens = all.enrollments || {}
  const keys = Object.keys(ens)
  if (!role) return keys.length > 0
  return keys.some((em) => ens[em].role === role)
}

export async function bioEnrolledEmail(role?: string): Promise<string | null> {
  const all = migrateIfNeeded(await dbGetAll())
  const ens = all.enrollments || {}
  let keys = Object.keys(ens)
  if (role) keys = keys.filter((em) => ens[em].role === role)
  return keys.length ? keys[0] : null
}

export async function bioRegister(email: string, password: string, role?: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const rpId = location.hostname
  let createdCred: PublicKeyCredential | null = null

  async function getPrfViaGet(): Promise<ArrayBuffer> {
    if (!createdCred) throw new Error('Kredensial belum dibuat')
    const assert = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: createdCred.rawId, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { eval: { first: salt } } },
      } as PublicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null
    const out = prfOutputFrom(assert)
    if (out) return out
    const ebc: Record<string, { first: Uint8Array }> = {}
    ebc[bufToB64(createdCred.rawId)] = { first: salt }
    const assert2 = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: createdCred.rawId, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { evalByCredential: ebc } },
      } as PublicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null
    const out2 = prfOutputFrom(assert2)
    if (out2) return out2
    throw new Error(
      'Perangkat tidak mengembalikan kunci sidik jari (PRF). Pastikan Chrome terbaru & sidik jari terdaftar di HP.',
    )
  }

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Warunge Mimi', id: rpId },
      user: {
        id: new TextEncoder().encode(email.slice(0, 64)),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
      extensions: { prf: { eval: { first: salt } } },
    } as PublicKeyCredentialCreationOptions,
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('Pembuatan kredensial dibatalkan')
  createdCred = cred

  let prfOut = prfOutputFrom(cred)
  if (!prfOut) {
    await new Promise((res) => setTimeout(res, PRF_FALLBACK_SETTLE_MS))
    prfOut = await getPrfViaGet()
  }

  const key = await crypto.subtle.importKey('raw', prfOut, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(password),
  )
  await dbPut(email, {
    email,
    role: role || 'customer',
    credentialId: bufToB64(createdCred.rawId),
    salt: bufToB64(salt.buffer as ArrayBuffer),
    iv: bufToB64(iv.buffer as ArrayBuffer),
    data: bufToB64(enc),
    createdAt: Date.now(),
  })
}

export async function bioAuthenticate(role?: string): Promise<BioCredentials> {
  const all = migrateIfNeeded(await dbGetAll())
  const ens = all.enrollments || {}
  let keys = Object.keys(ens)
  if (role) keys = keys.filter((em) => ens[em].role === role)
  if (!keys.length) throw new Error('Belum ada sidik jari terdaftar di perangkat ini.')
  const stored = ens[keys[0]]
  const assert = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: b64ToBuf(stored.credentialId), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: b64ToBuf(stored.salt) } } },
    } as PublicKeyCredentialRequestOptions,
  })) as PublicKeyCredential | null
  const prfOut = prfOutputFrom(assert)
  if (!prfOut) throw new Error('Gagal membaca sidik jari.')
  const key = await crypto.subtle.importKey('raw', prfOut, 'AES-GCM', false, ['decrypt'])
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(stored.iv)) },
    key,
    b64ToBuf(stored.data),
  )
  return {
    email: stored.email,
    password: new TextDecoder().decode(dec),
    role: stored.role || 'customer',
  }
}

export async function bioRemove(email?: string): Promise<void> {
  if (email) {
    await dbDelete(email)
    return
  }
  const all = migrateIfNeeded(await dbGetAll())
  const ens = all.enrollments || {}
  await Promise.all(Object.keys(ens).map((em) => dbDelete(em)))
}

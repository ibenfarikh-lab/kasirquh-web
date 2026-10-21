/**
 * KasirQuh React — src/lib/guestGate.ts
 * Gerbang ISI mode tamu (selaras Native, perintah user 2026-10-21):
 * tidak ada akun tamu — tamu yang mendarat di konten terkunci dikembalikan
 * ke Beranda dan sheet login dibuka dengan kalimat pola Native
 * "Masuk dulu untuk ...". Tabel ini satu-satunya sumber pemetaan
 * rute → aksi tertunda + kalimat ajakan; dipakai GuestContentGuard di
 * App.tsx. Titik ketuk di halaman memakai openLoginSheet langsung dengan
 * action & kalimat yang sama dari tabel ini.
 */

export interface GuestGate {
  /** Kunci aksi tertunda — dilanjutkan AuthSheet setelah login berhasil. */
  action: string
  /** Kalimat ajakan kontekstual pola "Masuk dulu untuk ...". */
  message: string
}

export const GUEST_GATES = {
  coin: { action: 'coin', message: 'Masuk dulu untuk lihat dompet koinmu' },
  missions: { action: 'missions', message: 'Masuk dulu untuk ikut misi koin' },
  quiz: { action: 'quiz', message: 'Masuk dulu untuk main Tebak Harga' },
  chat: { action: 'chat', message: 'Masuk dulu untuk membuka Chat' },
  account: { action: 'account', message: 'Masuk dulu untuk membuka Akunmu' },
} as const satisfies Record<string, GuestGate>

/**
 * Rute konten terkunci untuk tamu. Chat & Akun adalah tab bergembok;
 * sub-halamannya (Rumpi, Chat Toko, Riwayat, Catatan & Tagihan, Detail
 * Pesanan) adalah isi tab itu. Koin/Misi/Tebak Harga adalah fitur koin —
 * tamu tidak punya dompet, jadi isinya tidak pernah ditampilkan ke tamu.
 */
export function guestGateForPath(pathname: string): GuestGate | null {
  if (pathname === '/beranda/koin') return GUEST_GATES.coin
  if (pathname === '/beranda/misi') return GUEST_GATES.missions
  if (pathname === '/beranda/kuis') return GUEST_GATES.quiz
  if (pathname === '/beranda/chat' || pathname.startsWith('/beranda/chat/')) return GUEST_GATES.chat
  if (
    pathname === '/beranda/akun' ||
    pathname === '/beranda/riwayat' ||
    pathname === '/beranda/catatan' ||
    pathname.startsWith('/beranda/pesanan/')
  ) {
    return GUEST_GATES.account
  }
  return null
}

/** Rute tujuan setelah login untuk aksi tertunda (selain checkout/chat/account bawaan AuthSheet). */
export const PENDING_GUEST_ROUTES: Record<string, string> = {
  coin: '/beranda/koin',
  missions: '/beranda/misi',
  quiz: '/beranda/kuis',
  recipe: '/beranda/resep-baru',
  titip: '/beranda/titip',
  patungan: '/beranda/patungan',
  rumpi: '/beranda/chat/rumpi',
}

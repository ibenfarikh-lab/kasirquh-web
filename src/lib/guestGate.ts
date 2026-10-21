
export interface GuestGate {
  action: string
  message: string
}

export const GUEST_GATES = {
  coin: { action: 'coin', message: 'Masuk dulu untuk lihat dompet koinmu' },
  missions: { action: 'missions', message: 'Masuk dulu untuk ikut misi koin' },
  quiz: { action: 'quiz', message: 'Masuk dulu untuk main Tebak Harga' },
  gameTangkap: { action: 'game-tangkap', message: 'Masuk dulu untuk main Tangkap Diskon' },
  gameBuru: { action: 'game-buru', message: 'Masuk dulu untuk main Buru Diskon' },
  chat: { action: 'chat', message: 'Masuk dulu untuk membuka Chat' },
  account: { action: 'account', message: 'Masuk dulu untuk membuka Akunmu' },
} as const satisfies Record<string, GuestGate>

export function guestGateForPath(pathname: string): GuestGate | null {
  if (pathname === '/beranda/koin') return GUEST_GATES.coin
  if (pathname === '/beranda/misi') return GUEST_GATES.missions
  if (pathname === '/beranda/kuis') return GUEST_GATES.quiz
  if (pathname.startsWith('/beranda/game/')) {
    return pathname.endsWith('/buru-diskon') ? GUEST_GATES.gameBuru : GUEST_GATES.gameTangkap
  }
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

export const PENDING_GUEST_ROUTES: Record<string, string> = {
  coin: '/beranda/koin',
  missions: '/beranda/misi',
  quiz: '/beranda/kuis',
  'game-tangkap': '/beranda/game/tangkap-diskon',
  'game-buru': '/beranda/game/buru-diskon',
  recipe: '/beranda/resep-baru',
  titip: '/beranda/titip',
  patungan: '/beranda/patungan',
  rumpi: '/beranda/chat/rumpi',
}

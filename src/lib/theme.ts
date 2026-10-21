/**
 * KasirQuh React — src/lib/theme.ts
 * Port js/shared/theme.js (vanilla): tema per peran (customer/admin).
 *
 * Aturan main (sesuai vanilla):
 * - Pilihan disimpan per peran: customer di 'kasirquh-customer-prefs' (JSON),
 *   admin di 'kasirquh-admin-theme'.
 * - Yang diterapkan ke DOM: document.body.dataset.uiTheme = 'light'|'dark'
 *   (inilah yang dibaca CSS: body[data-ui-theme="..."]) + colorScheme.
 * - 'system' mengikuti prefers-color-scheme OS.
 * - Keputusan terkunci user 2026-10-12: opsi tema HANYA Terang/Gelap/Otomatis.
 *   Nilai lama 'oled' yang tersimpan di perangkat DIPETAKAN ke 'dark' saat
 *   dibaca (migrasi baca di readChoice) — tidak ada lagi tema 'oled'.
 */

export type ThemeChoice = 'light' | 'dark' | 'system'
export type Role = 'customer' | 'admin'

const CUSTOMER_PREFS_KEY = 'kasirquh-customer-prefs'
const ADMIN_THEME_KEY = 'kasirquh-admin-theme'
const VALID: ThemeChoice[] = ['light', 'dark', 'system']

/** Resolved theme: 'system' mengikuti prefers-color-scheme OS. */
export function resolvedTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'system') {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  }
  return choice === 'dark' ? 'dark' : 'light'
}

/** Port applyRoleTheme (vanilla): tulis ke body[data-ui-theme] + colorScheme. */
export function applyTheme(choice: ThemeChoice) {
  const actual = resolvedTheme(choice)
  try {
    document.body.dataset.uiTheme = actual
    document.documentElement.style.colorScheme = actual
  } catch {
    /* abaikan */
  }
}

function readChoice(raw: string | null): ThemeChoice | null {
  // Migrasi baca: nilai 'oled' lama (keputusan 2026-10-12: OLED = gelap).
  if (raw === 'oled') return 'dark'
  return raw && (VALID as string[]).includes(raw) ? (raw as ThemeChoice) : null
}

export function getCustomerTheme(): ThemeChoice {
  try {
    const raw = localStorage.getItem(CUSTOMER_PREFS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { theme?: string }
      const c = readChoice(p.theme ?? null)
      if (c) return c
    }
  } catch {
    /* abaikan */
  }
  return 'light'
}

export function setCustomerTheme(choice: ThemeChoice) {
  try {
    const raw = localStorage.getItem(CUSTOMER_PREFS_KEY)
    const p = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    p.theme = choice
    localStorage.setItem(CUSTOMER_PREFS_KEY, JSON.stringify(p))
  } catch {
    /* abaikan */
  }
  applyTheme(choice)
}

export function getAdminTheme(): ThemeChoice {
  try {
    const c = readChoice(localStorage.getItem(ADMIN_THEME_KEY))
    if (c) return c
  } catch {
    /* abaikan */
  }
  return 'dark'
}

export function setAdminTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(ADMIN_THEME_KEY, choice)
  } catch {
    /* abaikan */
  }
  applyTheme(choice)
}

/** Terapkan tema sesuai peran aktif. Dipanggil saat ganti peran / boot. */
export function activateRoleTheme(role: Role) {
  applyTheme(role === 'admin' ? getAdminTheme() : getCustomerTheme())
}

/** Ikuti perubahan tema OS bila pilihan = 'system' (port refreshSystemTheme). */
export function watchSystemTheme(onChange: () => void): () => void {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = () => onChange()
    if (mq.addEventListener) mq.addEventListener('change', fn)
    else mq.addListener(fn)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', fn)
      else mq.removeListener(fn)
    }
  } catch {
    return () => {}
  }
}

/**
 * KasirQuh React — src/lib/gateway.ts
 * Penanda "gateway sudah dilewati" (pengunjung pertama) di localStorage.
 */

const GATEWAY_SEEN_KEY = 'kasirquh.gatewaySeen.v1'

/** Tandai gateway sudah dilewati (pengunjung pertama). */
export function markGatewaySeen() {
  try {
    localStorage.setItem(GATEWAY_SEEN_KEY, '1')
  } catch {
    /* abaikan */
  }
}

/** Hapus penanda (mis. setelah logout) agar gateway tampil lagi. */
export function clearGatewaySeen() {
  try {
    localStorage.removeItem(GATEWAY_SEEN_KEY)
  } catch {
    /* abaikan */
  }
}

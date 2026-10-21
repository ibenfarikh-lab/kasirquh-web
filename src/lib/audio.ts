/**
 * KasirQuh React — src/lib/audio.ts
 * Audio notifikasi (Web Audio API). Port dari js/shared/audio.js vanilla.
 *
 * 3 jenis bunyi: order | promo | chat
 * 3 mode: system | mimi | silent (silent → getar jika diaktifkan)
 */

export type SoundKind = 'order' | 'promo' | 'chat'
export type SoundMode = 'system' | 'mimi' | 'silent'

const ADMIN_SOUND_KEY = 'kasirquh-admin-sounds'
/** Kunci preferensi dering khusus pelanggan (terpisah dari admin agar di
 *  perangkat bersama preferensi dua peran tidak saling menimpa). */
export const CUSTOMER_SOUND_KEY = 'kasirquh-customer-sounds'
const VIBRATE_KEY = 'kasirquh-vibrate-silent'

/** Peran sesi aktif (diatur auth store lewat setSoundRole). */
let soundRole: 'admin' | 'customer' | null = null

/** Dipanggil auth store setiap peran sesi berubah. */
export function setSoundRole(role: 'admin' | 'customer' | null): void {
  soundRole = role
}

function soundKey(): string {
  return soundRole === 'customer' ? CUSTOMER_SOUND_KEY : ADMIN_SOUND_KEY
}

let audioCtx: AudioContext | null = null

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain: number,
) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type || 'sine'
  osc.frequency.setValueAtTime(frequency, start)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain || 0.055, start + 0.015)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp)
  amp.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function ensureAudio(): AudioContext | null {
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioCtor()
    } catch {
      return null
    }
  }
  if (audioCtx.state === 'suspended') {
    try {
      void audioCtx.resume()
    } catch {
      /* abaikan */
    }
  }
  return audioCtx
}

function getSoundMode(kind: SoundKind): SoundMode {
  try {
    const raw = localStorage.getItem(soundKey())
    if (raw) {
      const parsed = JSON.parse(raw) as Record<SoundKind, SoundMode>
      return parsed[kind] || 'system'
    }
  } catch {
    /* abaikan */
  }
  return 'system'
}

function getVibrateWhenSilent(): boolean {
  try {
    return localStorage.getItem(VIBRATE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Putar notifikasi bunyi.
 * @param kind jenis: order | promo | chat
 * @param mode override mode (default dari pengaturan tersimpan)
 */
export function playNotification(kind: SoundKind, mode?: SoundMode): void {
  const m = mode || getSoundMode(kind)

  if (m === 'silent') {
    if (getVibrateWhenSilent() && navigator.vibrate) {
      const pattern = kind === 'order' ? [70, 45, 70] : kind === 'promo' ? [45, 35, 45, 35, 45] : [55]
      try {
        navigator.vibrate(pattern)
      } catch {
        /* abaikan */
      }
    }
    return
  }

  const ctx = ensureAudio()
  if (!ctx) return

  const doPlay = () => {
    if (ctx.state === 'suspended') return
    try {
      const now = ctx.currentTime + 0.06
      if (m === 'system') {
        tone(ctx, 720, now, 0.15, 'sine', 0.22)
        tone(ctx, 940, now + 0.17, 0.2, 'sine', 0.2)
      } else if (kind === 'order') {
        tone(ctx, 523, now, 0.16, 'sine', 0.25)
        tone(ctx, 659, now + 0.15, 0.16, 'sine', 0.25)
        tone(ctx, 784, now + 0.3, 0.28, 'sine', 0.22)
      } else if (kind === 'promo') {
        tone(ctx, 660, now, 0.12, 'triangle', 0.22)
        tone(ctx, 990, now + 0.13, 0.2, 'triangle', 0.2)
      } else if (kind === 'chat') {
        tone(ctx, 800, now, 0.12, 'sine', 0.3)
        tone(ctx, 1000, now + 0.15, 0.12, 'sine', 0.3)
      } else {
        tone(ctx, 880, now, 0.1, 'sine', 0.22)
        tone(ctx, 880, now + 0.16, 0.1, 'sine', 0.22)
      }
    } catch {
      /* abaikan */
    }
  }

  if (ctx.state === 'suspended') {
    try {
      void ctx.resume().then(doPlay).catch(doPlay)
    } catch {
      doPlay()
    }
  } else {
    doPlay()
  }
}

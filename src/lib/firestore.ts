export const WRITE_TIMEOUT_MS = 30000

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(
        (label || 'Operasi') + ' terlalu lama · periksa koneksi lalu coba lagi',
      )
      ;(error as { code?: string }).code = 'TIMEOUT'
      reject(error)
    }, ms)
  })
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) clearTimeout(timer)
    }),
    timeout,
  ])
}

export function todayKeyJakarta(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

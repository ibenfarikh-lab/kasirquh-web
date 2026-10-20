/**
 * KasirQuh React — src/pages/admin/CalculatorPage.tsx
 * Pengganti CalculatorSheet (dulu #calculatorModal + js/features/admin/calc.js):
 * halaman penuh, bukan modal. Data/logika sama persis, tanpa wrapper Sheet.
 *
 * 2026-10-20: display panel diperbarui —
 *  1. kolom data lebar (panel penuh, min-height besar),
 *  2. kalkulasi otomatis: hasil sementara tampil live di bawah ekspresi,
 *  3. ekspresi panjang wrap multi-baris dan menumpuk ke atas
 *     (bukan overflow ke samping/ellipsis).
 * 2026-10-20: batas panjang ekspresi dihapus (permintaan user).
 * 2026-10-20: display punya scrollbar sendiri (max-height + auto-scroll ke
 *  hasil terbaru) agar tombol tidak tenggelam saat ekspresi panjang.
 */
import { useState, useRef, useEffect } from 'react'
import { calcDisplayValue, calcResult } from '../../features/admin/localAdmin'

const KEYS = [
  { key: 'C', label: 'C' },
  { key: 'back', label: '⌫', aria: 'Hapus angka terakhir' },
  { key: '/', label: '÷', aria: 'Bagi', cls: 'op' },
  { key: '*', label: '×', aria: 'Kali', cls: 'op' },
  { key: '7', label: '7' },
  { key: '8', label: '8' },
  { key: '9', label: '9' },
  { key: '-', label: '−', aria: 'Kurang', cls: 'op' },
  { key: '4', label: '4' },
  { key: '5', label: '5' },
  { key: '6', label: '6' },
  { key: '+', label: '+', aria: 'Tambah', cls: 'op' },
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '=', label: '=', aria: 'Hitung hasil', cls: 'equals' },
  { key: '0', label: '0', cls: 'zero-pack' },
  { key: '00', label: '00', cls: 'zero-pack' },
  { key: '000', label: '000', cls: 'zero-pack' },
]

/**
 * Tidak ada batas panjang ekspresi: kalkulator menerima input sebanyak apa pun
 * (permintaan user — "kalkulator bisa banyak hitungan"). Evaluasi hasil dan
 * format tampilan berjalan O(n), jadi ekspresi sangat panjang tetap ringan.
 */

/**
 * Hasil live dari ekspresi yang sedang diketik (operator buntut diabaikan).
 * Null bila belum ada operasi lengkap (angka-operator-angka).
 */
function liveResultValue(expression: string): number | null {
  const trimmed = expression.replace(/[+\-*/]+$/, '')
  if (!/\d[+\-*/]/.test(trimmed)) return null
  try {
    const v = calcResult(trimmed)
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

function formatNum(n: number): string {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

export default function CalculatorPage() {
  const [expression, setExpression] = useState('')
  const displayRef = useRef<HTMLDivElement>(null)

  // Auto-scroll display ke bagian terbaru: ekspresi akhir + hasil live
  // selalu terlihat tanpa scroll manual (saat scrollbar aktif).
  useEffect(() => {
    const el = displayRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [expression])

  const press = (key: string) => {
    let next = expression
    if (key === 'C') next = ''
    else if (key === 'back') next = next.slice(0, -1)
    else if (key === '=') {
      if (!next || /[+\-*/]$/.test(next)) return
      next = String(calcResult(next))
    } else {
      const isOp = /[+\-*/]/.test(key)
      const last = next.slice(-1)
      if (isOp && (!next || /[+\-*/]/.test(last))) return
      next = next + key
    }
    setExpression(next)
  }

  const live = liveResultValue(expression)
  const exprText = calcDisplayValue(expression)
  const showLive = live !== null && String(live) !== expression

  return (
    <div className="admin-screen">
      <div id="calculatorView" className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Hitung tanpa pindah aplikasi</small>
            <h2>Kalkulator Kasir</h2>
          </span>
        </div>
        <div ref={displayRef} className="calc-display" role="status" aria-label="Layar kalkulator">
          <div className="calc-expr" aria-label={'Ekspresi: ' + exprText}>
            {exprText}
          </div>
          {showLive && (
            <div className="calc-live" aria-label={'Hasil sementara: ' + formatNum(live)}>
              = {formatNum(live)}
            </div>
          )}
        </div>
        <div className="calc-grid">
          {KEYS.map((k) => (
            <button
              key={k.key}
              data-calc={k.key}
              className={k.cls || undefined}
              aria-label={k.aria}
              onClick={() => press(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

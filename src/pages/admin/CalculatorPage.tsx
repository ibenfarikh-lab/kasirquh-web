/**
 * KasirQuh React — src/pages/admin/CalculatorPage.tsx
 * Pengganti CalculatorSheet (dulu #calculatorModal + js/features/admin/calc.js):
 * halaman penuh, bukan modal. Data/logika sama persis, tanpa wrapper Sheet.
 */
import { useState } from 'react'
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

export default function CalculatorPage() {
  const [expression, setExpression] = useState('')

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
      next = (next + key).slice(0, 28)
    }
    setExpression(next)
  }

  return (
    <div className="admin-screen">
      <div id="calculatorView" className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Hitung tanpa pindah aplikasi</small>
            <h2>Kalkulator Kasir</h2>
          </span>
        </div>
        <input
          className="calc-display"
          value={calcDisplayValue(expression)}
          readOnly
          aria-label="Hasil kalkulator"
        />
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

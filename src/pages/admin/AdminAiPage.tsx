/**
 * KasirQuh React — src/pages/admin/AdminAiPage.tsx
 * Halaman AI Admin (dulu AdminAiSheet): #adminAiModal +
 * js/features/admin/ai.js.
 * Jawaban hanya memakai data sesi ini (produk, jurnal, pelanggan).
 */
import { useState } from 'react'
import { toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import {
  useLocalAdminStore,
  adminAiResponse,
  adminAiStock,
  adminAiSales,
  adminAiTransactions,
  adminAiCustomers,
  adminAiCash,
} from '../../features/admin/localAdmin'
import { useProductsStore } from '../../stores/products'


const CHIPS = [
  { key: 'stock', label: 'Prioritas restok' },
  { key: 'sales', label: 'Omzet hari ini' },
  { key: 'transactions', label: 'Transaksi hari ini' },
  { key: 'customers', label: 'Pelanggan baru' },
  { key: 'cash', label: 'Cek arus kas' },
] as const

export default function AdminAiPage() {
  useAdminBoot()
  const products = useProductsStore((s) => s.products)
  const journalEntries = useLocalAdminStore((s) => s.journalEntries)
  const pendingCustomers = useLocalAdminStore((s) => s.pendingCustomers)
  const lowStockThreshold = useLocalAdminStore((s) => s.lowStockThreshold)
  const todayKey = useLocalAdminStore((s) => s.todayKey)

  const [answer, setAnswer] = useState(
    'Pilih ringkasan atau tanyakan omzet, transaksi, stok, pelanggan, maupun arus kas. Jawaban hanya memakai data sesi ini.',
  )
  const [input, setInput] = useState('')

  const ctx = { products, journalEntries, pendingCustomers, lowStockThreshold, todayKey }

  const ask = (q: string) => {
    if (!q.trim()) {
      toast('Tulis pertanyaan dulu')
      return
    }
    setAnswer(adminAiResponse(q, ctx))
    setInput('')
  }

  return (
    <div className="admin-screen">
      <div id="adminAiView" className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Asisten operasional</small>
            <h2>AI Admin</h2>
          </span>
        </div>
      <div className="admin-ai-answer" aria-live="polite" style={{ whiteSpace: 'pre-line' }}>
        {answer}
      </div>
      <div className="ai-admin-chips">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            data-admin-ai={c.key}
            onClick={() => {
              if (c.key === 'stock') setAnswer(adminAiStock(products, lowStockThreshold))
              else if (c.key === 'sales') setAnswer(adminAiSales(journalEntries, todayKey))
              else if (c.key === 'transactions')
                setAnswer(adminAiTransactions(journalEntries, todayKey))
              else if (c.key === 'customers') setAnswer(adminAiCustomers(pendingCustomers))
              else setAnswer(adminAiCash(journalEntries))
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="admin-ai-compose">
        <input
          className="ai-admin-input"
          placeholder="Contoh: stok apa yang menipis?"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ask(input)
            }
          }}
        />
        <button type="button" onClick={() => ask(input)}>
          Tanya
        </button>
      </div>
        <AdminNav />
      </div>
    </div>
  )
}

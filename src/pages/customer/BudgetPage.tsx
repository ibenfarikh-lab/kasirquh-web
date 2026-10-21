import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import { money, groupedNumber, numericValue } from '../../lib/format'
import type { CartMap } from '../../types'

function getBudgetEligible() {
  const products = useProductsStore.getState().products
  return products.filter((p) => p.isActive !== false && p.stock > 0 && p.price > 0 && p.budgetEligible !== false)
}

export default function BudgetPage() {
  const navigate = useNavigate()
  const addCustomerItem = useCartStore((s) => s.addCustomerItem)
  const [amountText, setAmountText] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const eligible = useMemo(
    () => getBudgetEligible().sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [],
  )

  const amount = numericValue(amountText)

  const bundle: CartMap = useMemo(() => {
    const picked = eligible.filter((p) => selected.has(p.id)).sort((a, b) => a.price - b.price)
    if (!amount || !picked.length) return {}
    let left = amount
    const out: CartMap = {}
    for (const p of picked) {
      if (left < p.price) break
      const maxQ = Math.min(p.budgetMaxQty || 4, p.stock, Math.floor(left / p.price))
      if (maxQ > 0) {
        out[p.id] = maxQ
        left -= maxQ * p.price
      }
    }
    return out
  }, [eligible, selected, amount])

  const rows = Object.entries(bundle)
  const total = rows.reduce((s, [id, q]) => {
    const p = eligible.find((x) => x.id === id)
    return s + (p ? p.price * q : 0)
  }, 0)

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function apply() {
    if (!rows.length) return
    rows.forEach(([id, q]) => addCustomerItem(id, q))
    navigate('/beranda/keranjang')
  }

  return (
    <div id="budgetCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Belanja tetap terukur</p>
          <h1>Mode Anggaran</h1>
        </div>
      </header>
      <main className="content">
        <p className="service-note">Tentukan budget, pilih produk yang dimau, kami hitungkan jumlahnya agar pas.</p>
        <div className="form-stack">
          <label htmlFor="budgetAmountInput">Batas belanja (Rp)</label>
          <input
            id="budgetAmountInput"
            inputMode="numeric"
            placeholder="Contoh: 75.000"
            value={amountText}
            onChange={(e) => setAmountText(groupedNumber(e.target.value))}
          />
        </div>
        <div className="section-title" style={{ marginTop: 12 }}>
          Pilih produk <small id="budgetSelectedCount">({selected.size} dipilih)</small>
        </div>
        <div id="budgetProductList" className="stock-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {eligible.length ? (
            eligible.map((p) => (
              <label key={p.id} className="stock-task">
                <input
                  type="checkbox"
                  className="stock-check"
                  checked={selected.has(p.id)}
                  onChange={(e) => toggle(p.id, e.target.checked)}
                />
                <span className="task-copy">
                  <b>{p.name}</b>
                  <small>
                    {money(p.price)} · Stok {p.stock}
                  </small>
                </span>
              </label>
            ))
          ) : (
            <div className="empty-note">
              Belum ada produk untuk Mode Anggaran.
              <br />
              <small>Admin dapat mengaktifkannya di form produk.</small>
            </div>
          )}
        </div>
        <div id="budgetPreview" className="order-items" style={{ marginTop: 12 }}>
          {rows.length ? (
            <>
              {rows.map(([id, q]) => {
                const p = eligible.find((x) => x.id === id)
                if (!p) return null
                return (
                  <div key={id}>
                    <span>
                      {p.name} ×{q}
                    </span>
                    <b>{money(p.price * q)}</b>
                  </div>
                )
              })}
              <div>
                <span>Total</span>
                <b>{money(total)}</b>
              </div>
              <div>
                <span>Sisa budget</span>
                <b>{money(amount - total)}</b>
              </div>
            </>
          ) : (
            <div>
              <span>Pilih produk untuk melihat hitungan.</span>
              <b>—</b>
            </div>
          )}
        </div>
        <button id="applyBudget" className="primary-wide" disabled={!rows.length} onClick={apply}>
          Masukkan ke keranjang
        </button>
      </main>
    </div>
  )
}

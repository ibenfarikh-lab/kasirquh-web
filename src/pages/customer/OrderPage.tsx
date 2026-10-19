/**
 * KasirQuh React — src/pages/customer/OrderPage.tsx
 * Pengganti OrderSheet (#orderModal; port renderActiveOrder) —
 * halaman penuh, bukan modal. Pesanan diambil dari param route :id.
 */
import { useParams } from 'react-router-dom'
import { money } from '../../lib/format'
import { useOrdersLocal } from '../../features/customer/local'

export default function OrderPage() {
  const { id } = useParams()
  const activeOrder = useOrdersLocal((s) => s.activeOrder)
  const history = useOrdersLocal((s) => s.history)

  // Pertahankan perilaku sheet: tampilkan pesanan aktif; cocokkan dengan :id
  // bila diberikan, fallback ke riwayat untuk id yang cocok.
  const activeMatch = activeOrder && (!id || activeOrder.id === id) ? activeOrder : null
  const historyMatch = !activeMatch ? history.find((o) => o.id === id) || null : null
  const shownId = activeMatch ? activeMatch.id : historyMatch ? historyMatch.id : null

  return (
    <div id="orderCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Pesanan aktif</p>
          <h1 id="orderPageId">{shownId || 'Belum ada pesanan'}</h1>
        </div>
      </header>
      <main className="content">
        <div id="orderPageBody">
          {activeMatch ? (
            <div className="service-row">
              <div>
                <h3>{activeMatch.id}</h3>
                <p>{activeMatch.status}</p>
                <p>{activeMatch.detail}</p>
              </div>
            </div>
          ) : historyMatch ? (
            <article className="online-order">
              <div className="order-topline">
                <time>{historyMatch.time}</time>
                <span className={`order-status ${historyMatch.status === 'done' ? 'done' : 'waiting'}`}>
                  {historyMatch.status === 'done' ? 'Selesai' : 'Menunggu Diproses'}
                </span>
              </div>
              <div className="order-goods">
                <strong className="order-info-line">
                  <span>Rincian Barang</span>
                </strong>
                {historyMatch.items.map((it, i) => (
                  <div key={i}>
                    <span>
                      {it.name} — {it.qty}
                    </span>
                    <b>{money(it.subtotal)}</b>
                  </div>
                ))}
              </div>
              <div className="order-total">
                <span>Total Belanja:</span>
                <b>{money(historyMatch.total)}</b>
              </div>
            </article>
          ) : (
            <div className="empty-note">
              Belum ada pesanan aktif.
              <br />
              <small>Pesanan yang dibuat dari keranjang akan tampil di sini.</small>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

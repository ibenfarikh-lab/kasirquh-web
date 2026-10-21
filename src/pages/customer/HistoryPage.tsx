import { money } from '../../lib/format'
import { useOrdersLocal } from '../../features/customer/local'
import type { Order } from '../../types'

function statusLabel(o: Order): string {
  if (o.status === 'done') return 'Selesai'
  if (o.rawStatus === 'dikemas') return 'Dikemas'
  if (o.rawStatus === 'dikirim') return 'Dikirim'
  return 'Menunggu Diproses'
}

export default function HistoryPage() {
  const history = useOrdersLocal((s) => s.history)

  return (
    <div id="historyCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Arsip belanja</p>
          <h1>Riwayat Pesanan</h1>
        </div>
      </header>
      <main className="content">
        <div id="historyList">
          {history.length ? (
            history.map((o) => (
              <article key={o.id} className="online-order">
                <div className="order-topline">
                  <time>{o.time}</time>
                  <span className={`order-status ${o.status === 'done' ? 'done' : 'waiting'}`}>{statusLabel(o)}</span>
                </div>
                <div className="order-goods">
                  <strong className="order-info-line">
                    <span>Rincian Barang</span>
                  </strong>
                  {o.items.map((it, i) => (
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
                  <b>{money(o.total)}</b>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-note">Belum ada riwayat pesanan.</div>
          )}
        </div>
      </main>
    </div>
  )
}

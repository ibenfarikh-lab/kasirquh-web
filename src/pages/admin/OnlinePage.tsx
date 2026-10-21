import { useState } from 'react'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { money } from '../../lib/format'
import { Icon, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import type { Order } from '../../types'

function statusLabel(order: Order): string {
  if (order.status === 'done') return 'Selesai'
  if (order.rawStatus === 'dikemas') return 'Dikemas'
  if (order.rawStatus === 'dikirim') return 'Dikirim'
  return 'Menunggu Diproses'
}

function OrderCard({ order }: { order: Order }) {
  const settleOrder = useLocalAdminStore((s) => s.settleOrder)
  const setOrderStatus = useLocalAdminStore((s) => s.setOrderStatus)
  const cancelOrder = useLocalAdminStore((s) => s.cancelOrder)
  const deleteOrder = useLocalAdminStore((s) => s.deleteOrder)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const waDigits = String(order.wa || '').replace(/\D/g, '')

  const fail = (error: unknown, fb: string) => {
    const e = error as { code?: string; message?: string }
    if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : fb)
  }

  return (
    <article className="online-order">
      <div className="order-topline">
        <time>{order.time}</time>
        <span className={'order-status ' + (order.status === 'done' ? 'done' : 'waiting')}>
          {statusLabel(order)}
        </span>
      </div>
      <div className="order-customer">
        <b className="order-info-line">
          <Icon name="user" />
          <span>
            {order.name} ({order.wa})
          </span>
        </b>
      </div>
      <p className="order-address order-info-line">
        <Icon name="home" />
        <span>{order.address}</span>
      </p>
      <span className="order-method">{order.method}</span>
      <div className="order-goods">
        <strong className="order-info-line">
          <Icon name="box" />
          <span>Rincian Barang</span>
        </strong>
        {order.items.map((item, i) => (
          <div key={i}>
            <span>
              {item.name} — {item.qty}x
            </span>
            <b>{money(item.subtotal)}</b>
          </div>
        ))}
      </div>
      <div className="order-total">
        <span>Total Belanja:</span>
        <b>{money(order.total)}</b>
      </div>
      <div className="order-actions">
        {waDigits ? (
          <button
            className="order-action wa"
            aria-label="Hubungi lewat WhatsApp"
            onClick={() => window.open('https://wa.me/' + waDigits, '_blank')}
          >
            <Icon name="chat" />
          </button>
        ) : null}
        {order.status === 'active' ? (
          <>
            {order.rawStatus === 'menunggu' ? (
              <button
                className="order-action pack"
                aria-label="Tandai dikemas"
                onClick={() =>
                  setOrderStatus(order.docId, 'dikemas')
                    .then(() => {})
                    .catch((e) => fail(e, 'Gagal update status'))
                }
              >
                <span>Dikemas</span>
              </button>
            ) : null}
            {order.rawStatus === 'dikemas' ? (
              <button
                className="order-action ship"
                aria-label="Tandai dikirim"
                onClick={() =>
                  setOrderStatus(order.docId, 'dikirim')
                    .then(() => {})
                    .catch((e) => fail(e, 'Gagal update status'))
                }
              >
                <span>Dikirim</span>
              </button>
            ) : null}
            <button
              className="order-action cancel-order"
              aria-label="Batalkan pesanan"
              onClick={() => {
                if (!confirmCancel) {
                  setConfirmCancel(true)
                  toast('Tap lagi untuk membatalkan ' + order.id)
                  return
                }
                setConfirmCancel(false)
                cancelOrder(order.docId)
                  .then(() => toast('Pesanan ' + order.id + ' dibatalkan · stok & koin dikembalikan'))
                  .catch((e) => fail(e, 'Pembatalan gagal'))
              }}
            >
              <Icon name="trash" />
              <span>{confirmCancel ? 'Tap lagi untuk batalkan' : 'Batalkan pesanan'}</span>
            </button>
            <button
              className="order-action finish"
              aria-label="Tandai selesai"
              onClick={() =>
                settleOrder(order.docId)
                  .then(() => toast('Pesanan ' + order.id + ' selesai · penjualan masuk Pembukuan'))
                  .catch((e) => fail(e, 'Gagal menyelesaikan'))
              }
            >
              <Icon name="check" />
            </button>
          </>
        ) : (
          <button
            className="order-action delete"
            aria-label="Hapus pesanan"
            onClick={() =>
              deleteOrder(order.docId)
                .then(() => {})
                .catch((e) => fail(e, 'Hapus gagal'))
            }
          >
            <Icon name="trash" />
          </button>
        )}
      </div>
    </article>
  )
}

export default function OnlinePage() {
  useAdminBoot()
  const onlineOrders = useLocalAdminStore((s) => s.onlineOrders)
  const [tab, setTab] = useState<'active' | 'done'>('active')

  const active = onlineOrders.filter((x) => x.status === 'active')
  const done = onlineOrders.filter((x) => x.status === 'done')
  const list = tab === 'active' ? active : done

  return (
    <div className="admin-screen">
      <div id="onlineView" className="subview admin-page active">
        <div className="admin-task-head">
          <span>
            <small>Pesanan pelanggan</small>
            <h2>Kasir Online</h2>
          </span>
        </div>
        <div className="online-tabs" role="tablist" aria-label="Status pesanan online">
          <button
            className={'online-tab' + (tab === 'active' ? ' active' : '')}
            role="tab"
            aria-selected={tab === 'active'}
            onClick={() => setTab('active')}
          >
            <Icon name="clock" />
            <span>Sedang Berlangsung</span>
          </button>
          <button
            className={'online-tab' + (tab === 'done' ? ' active' : '')}
            role="tab"
            aria-selected={tab === 'done'}
            onClick={() => setTab('done')}
          >
            <Icon name="check" />
            <span>Selesai</span>
          </button>
        </div>
        <section className={'online-panel' + (tab === 'active' ? ' active' : '')}>
          <div className="online-order-list">
            {list.length ? (
              list.map((o) => <OrderCard key={o.docId} order={o} />)
            ) : tab === 'active' ? (
              <div className="notification-empty">
                <span className="empty-state-icon">
                  <Icon name="receipt" />
                </span>
                <b>Belum ada pesanan</b>
                <p>Pesanan pelanggan dari checkout akan tampil di sini.</p>
              </div>
            ) : (
              <div className="notification-empty">
                <span className="empty-state-icon">
                  <Icon name="check" />
                </span>
                <b>Belum ada pesanan selesai</b>
              </div>
            )}
          </div>
        </section>
      </div>
      <AdminNav />
    </div>
  )
}

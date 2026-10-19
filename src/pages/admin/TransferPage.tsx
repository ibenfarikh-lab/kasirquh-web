/**
 * KasirQuh React — src/pages/admin/TransferPage.tsx
 * Pengganti TransferSheet (dulu #transferModal + renderTransfers() di
 * js/features/admin/orders.js): halaman penuh konfirmasi pembayaran
 * transfer — verifikasi (lunaskan) atau tolak. Logika sama persis,
 * tanpa wrapper Sheet.
 */
import { useState } from 'react'
import { toast } from '../../components/ui'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { money } from '../../lib/format'

function transferLabel(order: {
  status: string
  transferStatus: string
}): 'LUNAS' | 'DITOLAK' | 'PERIKSA' {
  if (order.status === 'done') return 'LUNAS'
  if (order.transferStatus === 'rejected') return 'DITOLAK'
  return 'PERIKSA'
}

export default function TransferPage() {
  const orders = useLocalAdminStore((s) => s.onlineOrders)
  const settleOrder = useLocalAdminStore((s) => s.settleOrder)
  const rejectTransfer = useLocalAdminStore((s) => s.rejectTransfer)
  const [busyId, setBusyId] = useState<string | null>(null)

  const transfers = orders.filter((o) => o.method === 'Transfer')

  const verify = (docId: string) => {
    setBusyId(docId)
    settleOrder(docId)
      .then(() => toast('Transfer terverifikasi · penjualan masuk Pembukuan'))
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE')
          toast(e && e.message ? e.message : 'Verifikasi gagal')
      })
      .finally(() => setBusyId((b) => (b === docId ? null : b)))
  }

  const reject = (docId: string) => {
    setBusyId(docId)
    rejectTransfer(docId)
      .then(() => toast('Transfer ditolak · status tersimpan'))
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Penolakan gagal')
      })
      .finally(() => setBusyId((b) => (b === docId ? null : b)))
  }

  return (
    <div className="admin-screen">
      <div id="transferView" className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Pembayaran non-tunai</small>
            <h2>Konfirmasi Transfer</h2>
          </span>
        </div>
        <div className="transfer-list">
          {transfers.length ? (
            transfers.map((order) => {
              const state = transferLabel(order)
              const ref = order.transferReference ? (
                <>
                  <br />
                  Referensi: {order.transferReference}
                </>
              ) : (
                <>
                  <br />
                  <small>Pelanggan belum menulis referensi transfer</small>
                </>
              )
              return (
                <article className="transfer-card" key={order.docId}>
                  <header>
                    <span>
                      <b>
                        #{order.id} · {order.name}
                      </b>
                      <small>
                        {money(order.total)} · {order.time}
                      </small>
                    </span>
                    <span
                      className={
                        state === 'PERIKSA'
                          ? 'notice-count'
                          : state === 'LUNAS'
                            ? 'stock-pill'
                            : 'approval-state rejected'
                      }
                    >
                      {state}
                    </span>
                  </header>
                  {state === 'LUNAS' ? null : (
                    <>
                      <div className="transfer-proof">
                        KONFIRMASI TRANSFER
                        {ref}
                        <br />
                        {money(order.total)}
                        <br />
                        {order.time}
                      </div>
                      {state === 'DITOLAK' ? (
                        <div className="card-actions">
                          <button
                            className="verify"
                            disabled={busyId === order.docId}
                            onClick={() => verify(order.docId)}
                          >
                            Verifikasi
                          </button>
                          <small className="form-hint-note">
                            Penolakan tersimpan · Verifikasi untuk melunaskan bila ternyata sudah
                            dibayar.
                          </small>
                        </div>
                      ) : (
                        <div className="card-actions">
                          <button
                            className="verify"
                            disabled={busyId === order.docId}
                            onClick={() => verify(order.docId)}
                          >
                            Verifikasi
                          </button>
                          <button
                            className="reject"
                            disabled={busyId === order.docId}
                            onClick={() => reject(order.docId)}
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </article>
              )
            })
          ) : (
            <div className="empty-note">Belum ada bukti transfer.</div>
          )}
        </div>
      </div>
    </div>
  )
}

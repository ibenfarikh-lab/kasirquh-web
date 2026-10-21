/**
 * KasirQuh React — src/pages/admin/ReceiptPage.tsx
 * Pengganti ReceiptSheet (dulu #receiptModal + renderReceipt() di
 * js/features/admin/pos.js): halaman penuh struk 58mm dari transaksi
 * terakhir + unduh .txt. Logika sama persis, tanpa wrapper Sheet.
 *
 * Param :id DIPAKAI: id 'terakhir' (atau tanpa id) → struk terakhir yang
 * persisten (useLocalAdminStore.lastReceipt, tersimpan di localStorage).
 * Id lain → transaksi dibaca dari dokumen orders/{id} (sumber data struk
 * yang punya rincian item) lalu dipetakan ke bentuk struk.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, type DocumentData } from 'firebase/firestore'
import { Icon, toast } from '../../components/ui'
import { useLocalAdminStore, type LastReceipt } from '../../features/admin/localAdmin'
import { getDb } from '../../lib/firebase'
import { money } from '../../lib/format'

/** Petakan dokumen orders/{id} ke bentuk struk 58mm. */
function orderToReceipt(d: DocumentData): LastReceipt {
  const items = ((d.items || []) as DocumentData[]).map((it) => ({
    name: String(it.name || 'Produk'),
    qty: Number(it.qty) || 0,
    total: Math.round(Number(it.subtotal) || (Number(it.price) || 0) * (Number(it.qty) || 0)),
  }))
  const redeemCoins = Math.round(Number(d.coinUsed) || 0)
  const ts = d.createdAt as { toDate?: () => Date } | undefined
  const at =
    ts && typeof ts.toDate === 'function'
      ? new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(ts.toDate())
      : ''
  return {
    at,
    items,
    total: Math.round(Number(d.total) || 0),
    rawTotal: Math.round(Number(d.fullTotal != null ? d.fullTotal : d.total) || 0),
    cashReceived: 0,
    change: 0,
    redeemCoins,
    earnedCoins: Math.round(Number(d.earnedCoins) || 0),
    // Nilai Rp per koin efektif dari dokumen order (coinValue = total Rp).
    coinValue: redeemCoins > 0 ? Math.round((Number(d.coinValue) || 0) / redeemCoins) : 1,
    member: d.customerName
      ? { name: String(d.customerName), memberCode: '' }
      : null,
  }
}

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const lastReceipt = useLocalAdminStore((s) => s.lastReceipt)
  const [byId, setById] = useState<LastReceipt | null>(null)
  const [byIdState, setByIdState] = useState<'idle' | 'loading' | 'found' | 'missing'>('idle')

  useEffect(() => {
    if (!id || id === 'terakhir') {
      setById(null)
      setByIdState('idle')
      return
    }
    let alive = true
    setByIdState('loading')
    getDoc(doc(getDb(), 'orders', id))
      .then((snap) => {
        if (!alive) return
        if (!snap.exists()) {
          setByIdState('missing')
          return
        }
        setById(orderToReceipt(snap.data()))
        setByIdState('found')
      })
      .catch(() => {
        if (alive) setByIdState('missing')
      })
    return () => {
      alive = false
    }
  }, [id])

  const receipt =
    byIdState === 'found' ? byId : byIdState === 'idle' ? lastReceipt : null
  const emptyNote =
    byIdState === 'loading'
      ? 'Memuat transaksi…'
      : byIdState === 'missing'
        ? 'Transaksi tidak ditemukan.'
        : 'Belum ada transaksi.'

  const download = () => {
    if (!receipt) {
      toast('Belum ada transaksi untuk diunduh')
      return
    }
    const lines = [
      'WARUNGE MIMI',
      'Warung kelontong warga',
      receipt.at,
      '----------------------------',
      ...receipt.items.map((x) => x.name + ' x' + x.qty + '  ' + money(x.total)),
      '----------------------------',
      'TOTAL  ' + money(receipt.total),
      'UANG DITERIMA  ' + money(receipt.cashReceived || receipt.total),
      'KEMBALIAN  ' + money(receipt.change || 0),
      'Terima kasih',
    ]
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'struk-warunge-mimi.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
    toast('Struk 58mm diunduh')
  }

  return (
    <div className="admin-screen">
      <div id="receiptView" className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Siap untuk pencetak 58mm</small>
            <h2>Struk Termal</h2>
          </span>
        </div>
        <div className="receipt-paper">
          {!receipt ? (
            <div className="empty-note">{emptyNote}</div>
          ) : (
            <>
              <h3>WARUNGE MIMI</h3>
              <p>Warung kelontong warga</p>
              <p>{receipt.at}</p>
              {receipt.member ? (
                <p>
                  Member: {receipt.member.name}
                  {receipt.member.memberCode ? ` (${receipt.member.memberCode})` : ''}
                </p>
              ) : null}
              <hr />
              {receipt.items.map((x, i) => (
                <div className="receipt-line" key={i}>
                  <span>
                    {x.name} ×{x.qty}
                  </span>
                  <b>{money(x.total)}</b>
                </div>
              ))}
              <hr />
              <div className="receipt-line total">
                <span>TOTAL</span>
                <b>{money(receipt.total)}</b>
              </div>
              {receipt.redeemCoins > 0 ? (
                <div className="receipt-line">
                  <span>Koin dipakai</span>
                  <b>
                    {receipt.redeemCoins.toLocaleString('id-ID')} (
                    {money(receipt.redeemCoins * (receipt.coinValue || 1))})
                  </b>
                </div>
              ) : null}
              {receipt.earnedCoins > 0 ? (
                <div className="receipt-line">
                  <span>Koin didapat</span>
                  <b>{receipt.earnedCoins.toLocaleString('id-ID')}</b>
                </div>
              ) : null}
              <div className="receipt-line">
                <span>UANG DITERIMA</span>
                <b>{money(receipt.cashReceived || receipt.total)}</b>
              </div>
              <div className="receipt-line">
                <span>KEMBALIAN</span>
                <b>{money(receipt.change || 0)}</b>
              </div>
              <p style={{ marginTop: 12 }}>Terima kasih</p>
            </>
          )}
        </div>
        <button className="download-card" disabled={!receipt} onClick={download}>
          <Icon name="download" /> Unduh struk .txt
        </button>
      </div>
    </div>
  )
}

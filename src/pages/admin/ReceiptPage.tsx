/**
 * KasirQuh React — src/pages/admin/ReceiptPage.tsx
 * Pengganti ReceiptSheet (dulu #receiptModal + renderReceipt() di
 * js/features/admin/pos.js): halaman penuh struk 58mm dari transaksi
 * terakhir + unduh .txt. Logika sama persis, tanpa wrapper Sheet.
 *
 * Param :id dibaca dari route; data struk tetap dari transaksi terakhir
 * (useLocalAdminStore.lastReceipt) seperti sheet sebelumnya.
 */
import { useParams } from 'react-router-dom'
import { Icon, toast } from '../../components/ui'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { money } from '../../lib/format'

export default function ReceiptPage() {
  useParams<{ id: string }>()
  const receipt = useLocalAdminStore((s) => s.lastReceipt)

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
            <div className="empty-note">Belum ada transaksi.</div>
          ) : (
            <>
              <h3>WARUNGE MIMI</h3>
              <p>Warung kelontong warga</p>
              <p>{receipt.at}</p>
              {receipt.member ? (
                <p>
                  Member: {receipt.member.name} ({receipt.member.memberCode})
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

/**
 * KasirQuh React — src/pages/admin/ReportsPage.tsx
 * Pecahan dari DataPage: tab Laporan kini halaman tersendiri di KELOLA WARUNG.
 * Isi identik dengan tab Laporan lama (metrik omset/laba + tabel transaksi),
 * tanpa tab lagi. Ditautkan dari Menu dan shortcut dashboard.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { money } from '../../lib/format'
import { Icon } from '../../components/ui'
import AdminNav from '../../components/AdminNav'

export default function ReportsPage() {
  useAdminBoot()
  const navigate = useNavigate()
  const journalEntries = useLocalAdminStore((s) => s.journalEntries)

  const sales = useMemo(
    () => journalEntries.filter((x) => x.type === 'Penjualan'),
    [journalEntries],
  )
  const revenue = sales.reduce((s, x) => s + x.amount, 0)
  const profit = sales.reduce((s, x) => s + (x.profit || 0), 0)
  const items = sales.reduce((s, x) => s + (x.itemCount || 0), 0)
  const hasSales = sales.length > 0

  return (
    <div className="admin-screen">
      <div id="reportView" className="subview admin-page active">
        <div className="admin-task-head">
          <span>
            <small>Omset, laba &amp; transaksi</small>
            <h2>Laporan</h2>
          </span>
        </div>

        <section className="data-panel active">
          <div className="report-metrics">
            <article className="report-metric">
              <small>TOTAL OMSET</small>
              <b className={hasSales ? undefined : 'empty-value'}>
                {hasSales ? money(revenue) : 'Belum ada data'}
              </b>
            </article>
            <article className="report-metric profit">
              <small>LABA</small>
              <b className={hasSales ? undefined : 'empty-value'}>
                {hasSales ? money(profit) : 'Belum ada data'}
              </b>
            </article>
            <article className="report-metric">
              <small>TRANSAKSI SUKSES</small>
              <b className={hasSales ? undefined : 'empty-value'}>
                {hasSales ? sales.length : 'Belum ada data'}
              </b>
            </article>
            <article className="report-metric">
              <small>TOTAL ITEM BARANG</small>
              <b className={hasSales ? undefined : 'empty-value'}>
                {hasSales ? items : 'Belum ada data'}
              </b>
            </article>
          </div>
          {hasSales ? (
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Metode</th>
                  <th>Qty</th>
                  <th>Omset</th>
                  <th>Laba</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Waktu">{entry.time}</td>
                    <td data-label="Metode">{entry.method || entry.source}</td>
                    <td data-label="Qty">{entry.itemCount || 0}</td>
                    <td data-label="Omset">{money(entry.amount)}</td>
                    <td data-label="Laba">{money(entry.profit || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="report-empty">
              <span className="empty-state-icon">
                <Icon name="receipt" />
              </span>
              <h3>Belum ada transaksi pada periode ini</h3>
              <p>Lakukan penjualan di Kasir agar omzet, laba, dan jumlah barang tercatat di sini.</p>
              <button onClick={() => navigate('/admin/kasir')}>Buka Kasir</button>
            </div>
          )}
        </section>
      </div>
      <AdminNav />
    </div>
  )
}

/**
 * KasirQuh React — src/pages/admin/DataPage.tsx
 * Pengganti #dataView: tab Data Pelanggan, Persetujuan, dan Laporan
 * (renderCustomerData, setDataTab, renderFinance bagian laporan).
 * Termasuk detail pelanggan + catatan/tagihan (kasbon) via sheet.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { money, numericValue } from '../../lib/format'
import { Icon, Sheet, SheetHeader, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import type { Customer } from '../../types'

type DataTab = 'customers' | 'approvals' | 'reports'

export default function DataPage() {
  useAdminBoot()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const journalEntries = useLocalAdminStore((s) => s.journalEntries)
  const customerData = useLocalAdminStore((s) => s.customerData)
  const pendingCustomers = useLocalAdminStore((s) => s.pendingCustomers)
  const approveCustomer = useLocalAdminStore((s) => s.approveCustomer)
  const rejectCustomer = useLocalAdminStore((s) => s.rejectCustomer)

  const [tab, setTab] = useState<DataTab>('customers')
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    const t = params.get('tab')
    if (t === 'approvals' || t === 'reports' || t === 'customers') setTab(t)
  }, [params])

  const sales = useMemo(
    () => journalEntries.filter((x) => x.type === 'Penjualan'),
    [journalEntries],
  )
  const revenue = sales.reduce((s, x) => s + x.amount, 0)
  const profit = sales.reduce((s, x) => s + (x.profit || 0), 0)
  const items = sales.reduce((s, x) => s + (x.itemCount || 0), 0)
  const hasSales = sales.length > 0

  const spendTotal = customerData.reduce((s, c) => s + c.spend, 0)

  const fail = (error: unknown, fb: string) => {
    const e = error as { code?: string; message?: string }
    if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : fb)
  }

  return (
    <div className="admin-screen">
      <div id="dataView" className="subview admin-page active">
        <div className="admin-task-head">
          <span>
            <small>Warga &amp; transaksi</small>
            <h2>Data</h2>
          </span>
        </div>
        <div className="data-tabs" role="tablist" aria-label="Bagian data">
          <button
            className={'data-tab' + (tab === 'customers' ? ' active' : '')}
            role="tab"
            aria-selected={tab === 'customers'}
            onClick={() => setTab('customers')}
          >
            <Icon name="users" />
            <span>Data Pelanggan</span>
          </button>
          <button
            className={'data-tab' + (tab === 'approvals' ? ' active' : '')}
            role="tab"
            aria-selected={tab === 'approvals'}
            onClick={() => setTab('approvals')}
          >
            <Icon name="clock" />
            <span>Persetujuan</span>
          </button>
          <button
            className={'data-tab' + (tab === 'reports' ? ' active' : '')}
            role="tab"
            aria-selected={tab === 'reports'}
            onClick={() => setTab('reports')}
          >
            <Icon name="bars" />
            <span>Laporan</span>
          </button>
        </div>

        <section className={'data-panel' + (tab === 'customers' ? ' active' : '')}>
          <article className="finance-total">
            <small>TOTAL BELANJA PELANGGAN</small>
            <b className={spendTotal ? undefined : 'empty-value'}>
              {!customerData.length
                ? 'Belum ada data'
                : spendTotal
                  ? money(spendTotal)
                  : 'Belum ada transaksi'}
            </b>
            <span>
              {customerData.length
                ? customerData.length + ' pelanggan aktif'
                : 'Belum ada data pelanggan'}
            </span>
          </article>
          <div className="customer-list">
            {customerData.length ? (
              customerData.map((x) => (
                <button className="customer-row" key={x.id} onClick={() => setDetailId(x.id)}>
                  <span className="avatar">
                    {x.photoURL ? (
                      <img src={x.photoURL} alt={'Foto ' + x.name} />
                    ) : (
                      x.name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span>
                    <b>{x.name}</b>
                    <small>{x.email || x.wa || 'Akun pelanggan'}</small>
                  </span>
                  <span className="customer-total">
                    {x.spend ? money(x.spend) : 'Belum ada transaksi'}
                  </span>
                </button>
              ))
            ) : (
              <div className="notification-empty">
                <span className="empty-state-icon">
                  <Icon name="users" />
                </span>
                <b>Belum ada data pelanggan</b>
                <p>Pelanggan akan tampil setelah pendaftaran disetujui admin.</p>
              </div>
            )}
          </div>
        </section>

        <section className={'data-panel' + (tab === 'approvals' ? ' active' : '')}>
          <p className="approval-title">DAFTAR PELANGGAN MENUNGGU PERSETUJUAN ADMIN</p>
          <div className="approval-list">
            {pendingCustomers.length ? (
              pendingCustomers.map((x) => (
                <article className="approval-item" key={x.id}>
                  <header>
                    <span>
                      <b className="order-info-line">
                        <Icon name="user" />
                        <span>{x.name}</span>
                      </b>
                      <small className="approval-email">
                        {x.email || 'Email belum dicantumkan'}
                      </small>
                      <small>
                        {x.wa || 'Tanpa nomor WA'} · {x.meta || 'Pendaftaran baru'}
                      </small>
                    </span>
                    {x.status === 'rejected' ? (
                      <span className="approval-state rejected">DITOLAK</span>
                    ) : (
                      <span className="new-badge">MENUNGGU</span>
                    )}
                  </header>
                  {x.status === 'rejected' ? null : (
                    <div className="approval-actions">
                      <button
                        className="approve"
                        onClick={() =>
                          approveCustomer(x.id)
                            .then(() => toast(x.name + ' disetujui · akun bisa masuk'))
                            .catch((e) => fail(e, 'Gagal menyetujui'))
                        }
                      >
                        Setujui
                      </button>
                      <button
                        className="reject"
                        onClick={() =>
                          rejectCustomer(x.id)
                            .then(() => toast(x.name + ' ditolak'))
                            .catch((e) => fail(e, 'Gagal menolak'))
                        }
                      >
                        Tolak
                      </button>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="notification-empty">
                <span className="empty-state-icon">
                  <Icon name="clock" />
                </span>
                <b>Belum ada pendaftar</b>
                <p>Pendaftaran baru dari pelanggan akan masuk ke antrean ini.</p>
              </div>
            )}
          </div>
        </section>

        <section className={'data-panel' + (tab === 'reports' ? ' active' : '')}>
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
      <CustomerDetailSheet customerId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}

/* ---------- Detail pelanggan + kasbon (pengganti #customerDetailModal) ---------- */

function CustomerDetailSheet({
  customerId,
  onClose,
}: {
  customerId: string | null
  onClose: () => void
}) {
  const customerData = useLocalAdminStore((s) => s.customerData)
  const adminCustomerNotes = useLocalAdminStore((s) => s.adminCustomerNotes)
  const addCustomerNote = useLocalAdminStore((s) => s.addCustomerNote)
  const todayKey = useLocalAdminStore((s) => s.todayKey)

  const customer: Customer | undefined = customerId
    ? customerData.find((c) => c.id === customerId)
    : undefined

  const [kasbonDate, setKasbonDate] = useState(todayKey)
  const [kasbonType, setKasbonType] = useState('belanja')
  const [kasbonAmount, setKasbonAmount] = useState('')
  const [kasbonNote, setKasbonNote] = useState('')
  const [saving, setSaving] = useState(false)

  const notes = useMemo(
    () =>
      customerId ? adminCustomerNotes.filter((n) => n.customerId === customerId) : [],
    [adminCustomerNotes, customerId],
  )

  const saveKasbon = () => {
    if (!customer) return
    const typeMap: Record<string, string> = {
      belanja: 'tagihan',
      pembayaran: 'pembayaran',
      cicilan: 'tagihan',
      umum: 'catatan',
    }
    setSaving(true)
    addCustomerNote({
      customerId: customer.id,
      type: typeMap[kasbonType] || 'catatan',
      amount: numericValue(kasbonAmount),
      note: kasbonNote,
      date: kasbonDate || todayKey,
    })
      .then(() => {
        setKasbonAmount('')
        setKasbonNote('')
        setKasbonDate(todayKey)
        toast('Catatan tersimpan · tampil di aplikasi pelanggan')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal menyimpan catatan')
      })
      .finally(() => setSaving(false))
  }

  const typeLabel: Record<string, string> = {
    tagihan: 'Tagihan',
    pembayaran: 'Pembayaran',
    catatan: 'Catatan',
  }

  return (
    <Sheet open={customerId !== null} onClose={onClose} sheetClassName="sheet feature-sheet">
      <SheetHeader kicker="Detail pelanggan" title={customer ? customer.name : 'Pelanggan'} onClose={onClose} />
      {customer ? (
        <>
          <div className="note-card">
            <p>
              {(customer.email ? customer.email + ' · ' : '') +
                (customer.wa || 'Tanpa nomor WA') +
                ' · ' +
                (customer.address || 'Alamat belum diisi')}
            </p>
            <strong>
              {customer.spend ? 'Total belanja ' + money(customer.spend) : 'Belum ada transaksi'}
            </strong>
          </div>
          <div className="kasbon-admin">
            <b>Catatan &amp; Tagihan dari Toko</b>
            <div>
              {notes.length ? (
                notes.map((n) => (
                  <article className="note-card" key={n.id}>
                    <header>
                      <h3>
                        {typeLabel[n.type] || 'Catatan'}
                        {n.amount ? ' · ' + money(n.amount) : ''}
                      </h3>
                      <small>{n.time || ''}</small>
                    </header>
                    <p>{n.note}</p>
                  </article>
                ))
              ) : (
                <div className="empty-note">Belum ada catatan untuk pelanggan ini.</div>
              )}
            </div>
            <div className="form-stack">
              <label htmlFor="kasbonDate">Waktu</label>
              <input
                id="kasbonDate"
                type="date"
                value={kasbonDate}
                onChange={(e) => setKasbonDate(e.target.value)}
              />
              <label htmlFor="kasbonType">Jenis catatan</label>
              <select
                id="kasbonType"
                value={kasbonType}
                onChange={(e) => setKasbonType(e.target.value)}
              >
                <option value="belanja">Belanja (belum dibayar)</option>
                <option value="pembayaran">Pembayaran</option>
                <option value="cicilan">Cicilan</option>
                <option value="umum">Catatan Umum</option>
              </select>
              <label htmlFor="kasbonAmount">Nominal (Rp)</label>
              <input
                id="kasbonAmount"
                inputMode="numeric"
                placeholder="Contoh: 50.000"
                value={kasbonAmount}
                onChange={(e) => setKasbonAmount(e.target.value.replace(/[^\d]/g, ''))}
              />
              <label htmlFor="kasbonNote">Keterangan/Rincian</label>
              <textarea
                id="kasbonNote"
                placeholder="Contoh: Ambil beras 1 karung"
                value={kasbonNote}
                onChange={(e) => setKasbonNote(e.target.value)}
              />
            </div>
            <button className="primary-wide" disabled={saving} onClick={saveKasbon}>
              {saving ? 'Menyimpan…' : 'Simpan Catatan'}
            </button>
          </div>
          <div className="customer-detail-history">
            <b>Riwayat singkat</b>
            <div>
              {customer.history.length ? (
                customer.history.map((h) => (
                  <article key={h.docId}>
                    <b>
                      Pesanan {h.id} · {money(h.total)}
                    </b>
                    <small>{h.time}</small>
                  </article>
                ))
              ) : (
                <div className="notification-empty">Belum ada riwayat belanja.</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </Sheet>
  )
}

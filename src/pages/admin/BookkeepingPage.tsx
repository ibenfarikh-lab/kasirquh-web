/**
 * KasirQuh React — src/pages/admin/BookkeepingPage.tsx
 * Pengganti #bookkeepingView + js/features/admin/finance.js: periode
 * hari/minggu/bulan, ringkasan kas masuk/keluar/saldo, jurnal transaksi,
 * saldo awal, dan pencatatan manual.
 */
import { useMemo, useState } from 'react'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import {
  useLocalAdminStore,
  entriesForPeriod,
  cashBalance,
  type JournalPeriod,
} from '../../features/admin/localAdmin'
import { money, numericValue } from '../../lib/format'
import { Icon, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import type { JournalEntry } from '../../types'

function journalIcon(type: string): string {
  if (type === 'Penjualan') return 'receipt'
  if (type === 'Kulakan') return 'box'
  return 'book'
}

function financeValue(hasData: boolean, value: string): { text: string; empty: boolean } {
  return { text: hasData ? value : 'Belum ada data', empty: !hasData }
}

export default function BookkeepingPage() {
  useAdminBoot()

  const journalEntries = useLocalAdminStore((s) => s.journalEntries)
  const journalPeriod = useLocalAdminStore((s) => s.journalPeriod)
  const setJournalPeriod = useLocalAdminStore((s) => s.setJournalPeriod)
  const todayKey = useLocalAdminStore((s) => s.todayKey)
  const recordJournal = useLocalAdminStore((s) => s.recordJournal)

  const [manualOpen, setManualOpen] = useState(false)
  const [openingMode, setOpeningMode] = useState(false)
  const [ledgerType, setLedgerType] = useState<'income' | 'expense'>('income')
  const [ledgerDesc, setLedgerDesc] = useState('')
  const [ledgerAmount, setLedgerAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const visible = useMemo(
    () => entriesForPeriod(journalEntries, journalPeriod, todayKey),
    [journalEntries, journalPeriod, todayKey],
  )
  const income = visible.filter((x) => x.direction === 'income').reduce((s, x) => s + x.amount, 0)
  const expense = visible.filter((x) => x.direction === 'expense').reduce((s, x) => s + x.amount, 0)
  const balance = cashBalance(journalEntries)
  const hasAny = journalEntries.length > 0
  const hasOpening = journalEntries.some((e) => e.type === 'Saldo Awal')

  const incomeV = financeValue(visible.some((x) => x.direction === 'income'), money(income))
  const expenseV = financeValue(visible.some((x) => x.direction === 'expense'), money(expense))
  const balanceV = financeValue(hasAny, money(balance))

  const resetForm = () => {
    setOpeningMode(false)
    setLedgerType('income')
    setLedgerDesc('')
    setLedgerAmount('')
  }

  const toggleManual = () => {
    const next = !manualOpen
    resetForm()
    setManualOpen(next)
  }

  const setOpening = () => {
    if (hasOpening) {
      toast('Saldo awal sudah pernah diisi')
      return
    }
    setOpeningMode(true)
    setManualOpen(true)
    setLedgerType('income')
    setLedgerDesc('Saldo awal kas')
    setLedgerAmount('')
  }

  const save = () => {
    const description = ledgerDesc.replace(/[<>]/g, '').trim()
    const amount = numericValue(ledgerAmount)
    if (!description || !amount) {
      toast('Lengkapi keterangan dan nominal')
      return
    }
    setSaving(true)
    recordJournal({
      direction: openingMode ? 'income' : ledgerType,
      type: openingMode ? 'Saldo Awal' : 'Lainnya',
      description: openingMode ? 'Saldo awal kas' : description,
      amount,
      source: openingMode ? 'Pengaturan awal' : 'Manual',
      method: openingMode ? 'Kas' : 'Manual',
    })
      .then(() => {
        if (openingMode) {
          setManualOpen(false)
          resetForm()
          toast('Saldo awal masuk sebagai transaksi pertama')
        } else {
          resetForm()
          toast('Transaksi manual masuk jurnal')
        }
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Simpan jurnal gagal')
      })
      .finally(() => setSaving(false))
  }

  const periods: { id: JournalPeriod; label: string }[] = [
    { id: 'day', label: 'Hari' },
    { id: 'week', label: 'Minggu' },
    { id: 'month', label: 'Bulan' },
  ]

  return (
    <div className="admin-screen">
      <div id="bookkeepingView" className="subview bookkeeping-page active">
        <div className="bookkeeping-head">
          <span>
            <small>Satu kas · seluruh aplikasi</small>
            <h2>Pembukuan</h2>
          </span>
          <div className="bookkeeping-actions">
            {hasOpening ? null : (
              <button className="secondary" aria-expanded={openingMode} onClick={setOpening}>
                <Icon name="cash" />
                Isi saldo awal
              </button>
            )}
            <button aria-expanded={manualOpen} onClick={toggleManual}>
              <Icon name="edit" />
              Catat
            </button>
          </div>
        </div>
        <div className="period-switch" role="tablist" aria-label="Periode pembukuan">
          {periods.map((p) => (
            <button
              key={p.id}
              className={journalPeriod === p.id ? 'active' : ''}
              role="tab"
              aria-selected={journalPeriod === p.id}
              onClick={() => setJournalPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <section className="bookkeeping-summary" aria-label="Ringkasan kas">
          <article className="cash-card in">
            <small>UANG MASUK</small>
            <b className={incomeV.empty ? 'empty-value' : undefined}>{incomeV.text}</b>
          </article>
          <article className="cash-card out">
            <small>UANG KELUAR</small>
            <b className={expenseV.empty ? 'empty-value' : undefined}>{expenseV.text}</b>
          </article>
          <article className="cash-card balance">
            <small>SALDO KAS</small>
            <b
              className={
                (balanceV.empty ? 'empty-value' : '') +
                (hasAny && balance < 0 ? ' cash-negative' : '')
              }
            >
              {balanceV.text}
            </b>
          </article>
        </section>
        {manualOpen ? (
          <section className="manual-ledger-form">
            <h3>{openingMode ? 'Isi saldo awal' : 'Catat transaksi manual'}</h3>
            <div className="manual-ledger-grid">
              <select
                aria-label="Jenis transaksi"
                value={ledgerType}
                disabled={openingMode}
                onChange={(e) => setLedgerType(e.target.value as 'income' | 'expense')}
              >
                <option value="income">Uang masuk</option>
                <option value="expense">Uang keluar</option>
              </select>
              <input
                maxLength={80}
                placeholder="Keterangan"
                aria-label="Keterangan transaksi"
                value={ledgerDesc}
                disabled={openingMode}
                onChange={(e) => setLedgerDesc(e.target.value)}
              />
              <input
                inputMode="numeric"
                placeholder="Nominal"
                aria-label="Nominal transaksi"
                value={ledgerAmount}
                onChange={(e) => setLedgerAmount(e.target.value.replace(/[^\d]/g, ''))}
              />
              <button disabled={saving} onClick={save}>
                {saving ? 'Menyimpan…' : openingMode ? 'Isi saldo awal' : 'Simpan'}
              </button>
            </div>
          </section>
        ) : null}
        <div className="journal-title">
          <h3>Jurnal transaksi</h3>
          <small>{visible.length ? visible.length + ' pergerakan' : 'Belum ada pergerakan'}</small>
        </div>
        <div className="journal-list">
          {visible.length ? (
            visible.map((entry: JournalEntry) => (
              <article className="journal-entry" key={entry.id}>
                <span className="journal-icon">
                  <Icon name={journalIcon(entry.type)} />
                </span>
                <span className="journal-copy">
                  <b>{entry.description}</b>
                  <small>
                    {entry.time} · {entry.source}
                    {entry.method ? ' · ' + entry.method : ''}
                  </small>
                </span>
                <strong className={'journal-amount ' + entry.direction}>
                  {entry.direction === 'income' ? '+' : '−'}
                  {money(entry.amount)}
                </strong>
              </article>
            ))
          ) : (
            <div className="journal-empty">
              <span className="empty-state-icon">
                <Icon name="book" />
              </span>
              <b>Belum ada transaksi</b>
              <p>Isi saldo awal, lakukan penjualan di Kasir, atau catat kulakan di Belanja Stok.</p>
            </div>
          )}
        </div>
      </div>
      <AdminNav />
    </div>
  )
}
